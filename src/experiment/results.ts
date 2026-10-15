import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { z } from "zod";
import { loadPilotManifest } from "../webarena/specs.ts";
import { readTasks } from "../webarena/io.ts";
import { loadStudyProtocol, assertMainTaskSelection } from "./study.ts";
import { RunMetadataSchema } from "./recorder.ts";

export type DatasetStage = "pilot" | "main";

export type ResultsRow = {
  stage: DatasetStage;
  task_id: number;
  model: string;
  method: "Baseline" | "Proposed";
  technical_valid: boolean;
  official_success: boolean | null;
  official_status: string | null;
  duration_ms: number | null;
  actions: number | null;
  probes: number | null;
  model_calls: number | null;
  run_id: string | null;
  issue: string;
};

const EvalSchema = z
  .object({
    task_id: z.number().int(),
    intent_template_id: z.number().int(),
    sites: z.tuple([z.literal("shopping")]),
    task_revision: z.literal(2),
    status: z.enum(["success", "failure", "partial_match", "error"]),
    score: z.number().min(0).max(1),
    evaluators_results: z
      .array(
        z
          .object({
            evaluator_name: z.string(),
            status: z.enum(["success", "failure", "partial_match", "error"]),
            score: z.number(),
          })
          .passthrough(),
      )
      .min(1),
    webarena_verified_version: z.string(),
    webarena_verified_evaluator_checksum: z.string().regex(/^[a-f0-9]{64}$/i),
    webarena_verified_data_checksum: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .passthrough();

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Values read from model output are not exported; guard spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(str) ? "'" + str : str;
  return '"' + safe.replaceAll('"', '""') + '"';
}

function writeCsv(path: string, rows: ResultsRow[]) {
  const columns: Array<keyof ResultsRow> = [
    "stage",
    "task_id",
    "model",
    "method",
    "technical_valid",
    "official_success",
    "official_status",
    "duration_ms",
    "actions",
    "probes",
    "model_calls",
    "run_id",
    "issue",
  ];
  writeFileSync(
    path,
    [
      columns.join(","),
      ...rows.map((row) => columns.map((key) => csvValue(row[key])).join(",")),
    ].join("\n") + "\n",
    "utf8",
  );
}

export function buildResultsDataset(args: {
  stage: DatasetStage;
  outputRoot: string;
  reportRoot: string;
  catalogPath?: string;
  models: Array<{ label: string }>;
}) {
  const protocol = loadStudyProtocol();
  const pilot = loadPilotManifest();
  if (
    args.models.length !== protocol.scope.model_count ||
    new Set(args.models.map((model) => model.label)).size !== args.models.length
  ) {
    throw new Error("Expected the four configured unique models");
  }

  const root = resolve(args.outputRoot);
  const reports = resolve(args.reportRoot);
  const taskSpecs: Array<{ task_id: number; intent_template_id: number }> =
    args.stage === "pilot"
      ? pilot.tasks
      : (() => {
          const path = join(root, "stage-manifest.json");
          if (!existsSync(path)) throw new Error("Missing main stage manifest");
          const main = JSON.parse(readFileSync(path, "utf8")) as {
            task_ids?: number[];
          };
          const selected = main.task_ids ?? [];
          assertMainTaskSelection(
            selected,
            pilot.tasks.map((task) => task.task_id),
            protocol,
          );
          const catalogFile = resolve(
            args.catalogPath ?? "output/catalog/shopping-tasks.json",
          );
          if (!existsSync(catalogFile))
            throw new Error("Missing official Shopping catalog");
          const catalog = readTasks(catalogFile);
          return selected.map((id) => {
            const t = catalog.find((task) => task.task_id === id);
            if (!t || t.sites.length !== 1 || t.sites[0] !== "shopping") {
              throw new Error("Unknown or non-Shopping main task: " + id);
            }
            return t;
          });
        })();

  const rows: ResultsRow[] = [];
  for (const task of taskSpecs) {
    for (const model of args.models) {
      for (const method of protocol.scope.methods) {
        const dir = join(
          root,
          "runs",
          model.label,
          method.toLowerCase(),
          String(task.task_id),
        );
        const row: ResultsRow = {
          stage: args.stage,
          task_id: task.task_id,
          model: model.label,
          method,
          technical_valid: false,
          official_success: null,
          official_status: null,
          duration_ms: null,
          actions: null,
          probes: null,
          model_calls: null,
          run_id: null,
          issue: "MISSING",
        };
        try {
          const meta = RunMetadataSchema.parse(
            JSON.parse(readFileSync(join(dir, "run_metadata.json"), "utf8")),
          );
          row.run_id = meta.run_id;
          if (
            meta.stage !== args.stage ||
            meta.task_id !== task.task_id ||
            meta.model_label !== model.label ||
            meta.method !== method ||
            meta.benchmark_version !== protocol.benchmark.pypi_version
          ) {
            throw new Error("RUN_METADATA_MISMATCH");
          }
          row.duration_ms = meta.duration_ms;
          row.actions = meta.actions;
          row.probes = meta.probes;
          row.model_calls = meta.model_calls;
          if (meta.execution_state !== "COMPLETED" || !meta.ended_at) {
            throw new Error("RUN_INCOMPLETE");
          }
          if (
            !existsSync(join(dir, "trace.jsonl")) ||
            !existsSync(join(dir, "agent_response.json")) ||
            !existsSync(join(dir, "network.har"))
          ) {
            throw new Error("MISSING_AGENT_EVIDENCE");
          }
          const har = JSON.parse(
            readFileSync(join(dir, "network.har"), "utf8"),
          ) as {
            log?: { entries?: unknown[] };
          };
          if (!Array.isArray(har.log?.entries) || !har.log.entries.length) {
            throw new Error("INVALID_HAR");
          }
          const result = EvalSchema.parse(
            JSON.parse(readFileSync(join(dir, "eval_result.json"), "utf8")),
          );
          if (
            result.task_id !== task.task_id ||
            result.intent_template_id !== task.intent_template_id ||
            result.webarena_verified_version !== protocol.benchmark.pypi_version
          ) {
            throw new Error("OFFICIAL_METADATA_MISMATCH");
          }
          if (result.status === "error") throw new Error("EVALUATOR_ERROR");
          if ((result.status === "success") !== (result.score === 1)) {
            throw new Error("INVALID_OFFICIAL_SCORE");
          }
          row.technical_valid = true;
          row.official_success = result.status === "success";
          row.official_status = result.status;
          row.issue = "";
        } catch (error) {
          // No local Windows username/path or raw exception may enter Colab CSV.
          const code = error instanceof Error ? error.message : "";
          row.issue = code.startsWith("ENOENT")
            ? "MISSING"
            : [
                  "RUN_METADATA_MISMATCH",
                  "RUN_INCOMPLETE",
                  "MISSING_AGENT_EVIDENCE",
                  "INVALID_HAR",
                  "OFFICIAL_METADATA_MISMATCH",
                  "EVALUATOR_ERROR",
                  "INVALID_OFFICIAL_SCORE",
                ].includes(code)
              ? code
              : "INVALID_ARTIFACT";
        }
        rows.push(row);
      }
    }
  }
  mkdirSync(reports, { recursive: true });
  writeCsv(join(reports, "run-inventory.csv"), rows);
  writeCsv(
    join(reports, "analysis-results.csv"),
    rows.filter((row) => row.technical_valid),
  );
  const valid = rows.filter((row) => row.technical_valid);
  const success = valid.filter((row) => row.official_success === true);
  const expected =
    protocol.scope.model_count *
    protocol.scope.methods.length *
    taskSpecs.length;
  const summary = [
    "# " + args.stage.toUpperCase() + " analysis export",
    "",
    "Expected episodes: " + expected,
    "Technically valid with official evaluation: " + valid.length,
    "Official successes among valid episodes: " + success.length,
    "Coverage: " +
      (valid.length === expected
        ? "COMPLETE"
        : "INCOMPLETE; do not report the observed success fraction as the study success rate"),
    "",
    "run-inventory.csv includes missing/invalid cells. analysis-results.csv includes only technically valid official results.",
    "Neither file replaces raw run evidence. Never interpret missing runs as task failures.",
    "",
  ].join("\n");
  writeFileSync(join(reports, "analysis-summary.md"), summary, "utf8");
  return {
    expected,
    valid: valid.length,
    success: success.length,
    rows,
    reports,
  };
}
