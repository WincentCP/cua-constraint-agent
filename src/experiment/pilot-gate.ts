import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { loadStudyProtocol } from "./study.ts";
import { loadPilotManifest } from "../webarena/specs.ts";
import { WebArenaAgentResponseSchema } from "../webarena/schema.ts";
import { RunMetadataSchema } from "./recorder.ts";

const OfficialEvalSchema = z
  .object({
    task_id: z.number().int().nonnegative(),
    intent_template_id: z.number().int().nonnegative(),
    sites: z.tuple([z.literal("shopping")]),
    task_revision: z.literal(2),
    status: z.enum(["success", "failure", "partial_match", "error"]),
    score: z.number().min(0).max(1),
    evaluators_results: z
      .array(
        z
          .object({
            evaluator_name: z.string().min(1),
            status: z.enum(["success", "failure", "partial_match", "error"]),
            score: z.number().min(0).max(1),
          })
          .passthrough(),
      )
      .min(1),
    webarena_verified_version: z.string().min(1),
    webarena_verified_evaluator_checksum: z.string().regex(/^[a-f0-9]{64}$/i),
    webarena_verified_data_checksum: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .passthrough();

export type PilotEpisode = {
  task_id: number;
  model: string;
  method: "Baseline" | "Proposed";
  valid: boolean;
  official_success: boolean;
  reason: string;
};

export type PilotGateReport = {
  schema_version: 1;
  status: "PROVISIONAL_PASS" | "FAIL";
  disclaimer: string;
  expected: number;
  completed_valid: number;
  invalid_or_missing: number;
  official_successes: number;
  successful_models: string[];
  successful_tasks: number[];
  models_with_zero_success: string[];
  thresholds: {
    min_valid_runs: number;
    min_official_successes: number;
    min_successful_models: number;
    min_successful_tasks: number;
  };
  checks: Record<string, boolean>;
  episodes: PilotEpisode[];
};

function nonempty(path: string) {
  return existsSync(path) && statSync(path).isFile() && statSync(path).size > 0;
}

export function readEpisode(
  taskDir: string,
  taskId: number,
  intentTemplateId: number,
  model: string,
  method: "Baseline" | "Proposed",
): PilotEpisode {
  const result: PilotEpisode = {
    task_id: taskId,
    model,
    method,
    valid: false,
    official_success: false,
    reason: "MISSING_OFFICIAL_ARTIFACT",
  };
  const required = [
    "agent_response.json",
    "network.har",
    "eval_result.json",
    "run_metadata.json",
    "trace.jsonl",
  ];
  if (required.some((name) => !nonempty(join(taskDir, name)))) return result;
  try {
    const meta = RunMetadataSchema.parse(
      JSON.parse(readFileSync(join(taskDir, "run_metadata.json"), "utf8")),
    );
    if (
      meta.stage !== "pilot" ||
      meta.task_id !== taskId ||
      meta.model_label !== model ||
      meta.method !== method ||
      meta.execution_state !== "COMPLETED" ||
      meta.ended_at === null ||
      meta.benchmark_version !== loadStudyProtocol().benchmark.pypi_version
    ) {
      result.reason = "RUN_METADATA_MISMATCH";
      return result;
    }
    WebArenaAgentResponseSchema.parse(
      JSON.parse(readFileSync(join(taskDir, "agent_response.json"), "utf8")),
    );
    const har = JSON.parse(
      readFileSync(join(taskDir, "network.har"), "utf8"),
    ) as unknown;
    if (
      !har ||
      typeof har !== "object" ||
      !("log" in har) ||
      !har.log ||
      typeof har.log !== "object" ||
      !("entries" in har.log) ||
      !Array.isArray(har.log.entries) ||
      har.log.entries.length === 0
    ) {
      throw new Error("Invalid HAR structure");
    }
    // Only read top-level official status and score. Hidden evaluator
    // expectations inside eval_result are never passed into an agent.
    const evaluation = OfficialEvalSchema.parse(
      JSON.parse(readFileSync(join(taskDir, "eval_result.json"), "utf8")),
    );
    if (
      evaluation.task_id !== taskId ||
      evaluation.intent_template_id !== intentTemplateId
    ) {
      result.reason = "EVALUATOR_TASK_MISMATCH";
      return result;
    }
    if (
      evaluation.webarena_verified_version !==
      loadStudyProtocol().benchmark.pypi_version
    ) {
      result.reason = "EVALUATOR_VERSION_MISMATCH";
      return result;
    }
    if (evaluation.status === "error") {
      result.reason = "EVALUATOR_ERROR";
      return result;
    }
    if (
      (evaluation.status === "success" && evaluation.score !== 1) ||
      (evaluation.status === "failure" && evaluation.score !== 0) ||
      (evaluation.status === "partial_match" && evaluation.score === 1)
    ) {
      result.reason = "INCONSISTENT_EVALUATOR_STATUS";
      return result;
    }
    result.valid = true;
    result.official_success = evaluation.status === "success";
    result.reason =
      evaluation.status === "success"
        ? "PASS"
        : evaluation.status === "partial_match"
          ? "PARTIAL_TASK_MATCH"
          : "TASK_FAILURE";
    return result;
  } catch {
    result.reason = "INVALID_ARTIFACT_OR_SCHEMA";
    return result;
  }
}

export function evaluatePilotGate(
  outputRoot: string,
  models: Array<{ label: string }>,
): PilotGateReport {
  const protocol = loadStudyProtocol();
  const manifest = loadPilotManifest();
  if (
    models.length !== protocol.scope.model_count ||
    new Set(models.map((model) => model.label)).size !== models.length
  ) {
    throw new Error("Pilot requires four distinct model labels");
  }
  const root = resolve(outputRoot);
  const episodes: PilotEpisode[] = [];
  for (const task of manifest.tasks) {
    for (const model of models) {
      for (const method of protocol.scope.methods) {
        episodes.push(
          readEpisode(
            join(
              root,
              "runs",
              model.label,
              method.toLowerCase(),
              String(task.task_id),
            ),
            task.task_id,
            task.intent_template_id,
            model.label,
            method,
          ),
        );
      }
    }
  }

  const successful = episodes.filter((episode) => episode.official_success);
  const valid = episodes.filter((episode) => episode.valid);
  const successfulModels = [
    ...new Set(successful.map((episode) => episode.model)),
  ].sort();
  const successfulTasks = [
    ...new Set(successful.map((episode) => episode.task_id)),
  ].sort((a, b) => a - b);
  const minValid = Math.ceil(
    episodes.length * protocol.pilot_gate.min_valid_run_fraction,
  );
  const checks = {
    expected_design:
      episodes.length ===
      protocol.scope.pilot_task_count *
        protocol.scope.model_count *
        protocol.scope.methods.length,
    technical_validity: valid.length >= minValid,
    official_successes:
      successful.length >= protocol.pilot_gate.min_official_successes,
    model_diversity:
      successfulModels.length >= protocol.pilot_gate.min_successful_models,
    task_diversity:
      successfulTasks.length >= protocol.pilot_gate.min_successful_tasks,
  };
  return {
    schema_version: 1,
    status: Object.values(checks).every(Boolean) ? "PROVISIONAL_PASS" : "FAIL",
    disclaimer:
      "This operational feasibility gate cannot authorize the main experiment by itself. Task suitability, independent 32-task selection, fairness, freeze, and supervisor review remain mandatory.",
    expected: episodes.length,
    completed_valid: valid.length,
    invalid_or_missing: episodes.length - valid.length,
    official_successes: successful.length,
    successful_models: successfulModels,
    successful_tasks: successfulTasks,
    models_with_zero_success: models
      .map((model) => model.label)
      .filter((label) => !successfulModels.includes(label)),
    thresholds: {
      min_valid_runs: minValid,
      min_official_successes: protocol.pilot_gate.min_official_successes,
      min_successful_models: protocol.pilot_gate.min_successful_models,
      min_successful_tasks: protocol.pilot_gate.min_successful_tasks,
    },
    checks,
    episodes,
  };
}
