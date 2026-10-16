import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { OllamaModel } from "../src/agent/ollama.ts";
import { runAgentLoop } from "../src/agent/runner.ts";
import { openInspectionSession } from "../src/browser/session.ts";
import {
  defaultOutputRoot,
  defaultReportRoot,
  ensureArtifactLayout,
  factorialTaskArtifactDir,
  refreshArtifactReport,
  type ExperimentMethod,
} from "../src/experiment/artifacts.ts";
import { RunRecorder, type RunMetadata } from "../src/experiment/recorder.ts";
import { loadStudyProtocol } from "../src/experiment/study.ts";
import {
  authHeadersForTask,
  taskAllowedOrigins,
} from "../src/webarena/auth.ts";
import { readConfig, readTask, writeJson } from "../src/webarena/io.ts";
import { runCommand, webArenaVerified } from "../src/webarena/official-cli.ts";
import { verifyPublicStageTask } from "../src/webarena/specs.ts";
import { defaultScreeningPath, requireApprovedScreening } from "../src/experiment/screening.ts";

function option(name: string, fallback?: string) {
  const idx = process.argv.indexOf("--" + name);
  return idx >= 0 ? process.argv[idx + 1] : fallback;
}

function flag(name: string) {
  return process.argv.includes("--" + name);
}

function exactInt(value: string | undefined, label: string) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1)
    throw new Error("Invalid " + label);
  return result;
}

async function main() {
  const stage = option("stage", "poc");
  if (stage !== "poc" && stage !== "pilot") {
    throw new Error(
      "Development runner is limited to PoC and approved single pilot episodes; main is frozen until runner validation",
    );
  }
  if (
    stage === "pilot" &&
    (!flag("pilot-approved") || !flag("fresh-environment-confirmed"))
  ) {
    throw new Error(
      "Pilot requires --pilot-approved and --fresh-environment-confirmed after manual site reset",
    );
  }
  const protocol = loadStudyProtocol();
  const taskId = exactInt(option("task", "284"), "task");
  const method = option("method", "Baseline");
  if (method !== "Baseline" && method !== "Proposed") {
    throw new Error("Expected --method Baseline or Proposed");
  }
  const label = option("model-label", "qwen3.5-9b");
  const models = JSON.parse(
    readFileSync("config/models.json", "utf8"),
  ) as Array<{
    label: string;
    name: string;
  }>;
  const model = models.find((candidate) => candidate.label === label);
  if (!model) throw new Error("Unknown model label: " + label);
  const maxSteps = exactInt(option("max-steps", "16"), "max-steps");
  if (maxSteps > 60) throw new Error("Hard cap: 60 browser decisions");
  if (stage === "pilot" && maxSteps !== protocol.execution.max_steps) {
    throw new Error(
      "Pilot requires the preregistered matched decision budget of " + protocol.execution.max_steps,
    );
  }
  const configPath = resolve(option("config", "config/webarena.local.json")!);
  if (!existsSync(configPath))
    throw new Error(
      "Copy config/webarena.example.json to config/webarena.local.json",
    );
  const outputRoot = resolve(option("output", defaultOutputRoot(stage))!);
  const reportRoot = resolve(option("reports", defaultReportRoot(stage))!);
  const input = resolve(
    option("tasks", join(outputRoot, "task-inputs", String(taskId) + ".json"))!,
  );
  if (!existsSync(input))
    throw new Error(
      "Export public task input with webarena:prepare first: " + input,
    );

  const task = readTask(input, taskId);
  const taskSpec = verifyPublicStageTask(task, stage);
  if (stage === "pilot") {
    const catalog = resolve(option("catalog", "output/catalog/shopping-tasks.json")!);
    requireApprovedScreening(defaultScreeningPath("poc"), "poc", catalog);
    requireApprovedScreening(defaultScreeningPath("pilot"), "pilot", catalog);
  }
  const siteConfig = readConfig(configPath);
  const root = factorialTaskArtifactDir(
    outputRoot,
    model.label,
    method as ExperimentMethod,
    taskId,
  );
  const runId = randomUUID();
  ensureArtifactLayout({
    stage,
    outputRoot,
    reportRoot,
    taskIds: stage === "poc" ? [taskId] : [],
  });
  const git = runCommand("git", ["rev-parse", "HEAD"]);
  const metadata: RunMetadata = {
    schema_version: 1,
    run_id: runId,
    stage,
    task_id: taskId,
    model_label: model.label,
    model_name: model.name,
    method: method as ExperimentMethod,
    benchmark_version: protocol.benchmark.pypi_version,
    git_commit: git.status === 0 ? git.stdout.trim() : "unknown",
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_ms: null,
    max_steps: maxSteps,
    steps_executed: 0,
    actions: 0,
    probes: 0,
    model_calls: 0,
    claimed_success: false,
    execution_state: "RUNNING",
    error_code: null,
    official_status: null,
    official_score: null,
  };
  const recorder = new RunRecorder(root, metadata);
  const started = Date.now();
  let session: Awaited<ReturnType<typeof openInspectionSession>> | undefined;
  let lastStats = {
    steps: 0,
    actions: 0,
    probes: 0,
    model_calls: 0,
    claimed_success: false,
  };
  let completed = false;
  try {
    // The same action and observation implementation serves both policies.
    // Isolated Playwright contexts do NOT reset persistent Magento cart/order data.
    session = await openInspectionSession({
      harPath: recorder.path("network.har"),
      extraHTTPHeaders: authHeadersForTask(task, siteConfig),
      allowedOrigins: taskAllowedOrigins(task),
    });
    await session.goto(task.start_urls[0]);
    const client = new OllamaModel(
      model.name,
      option("ollama", "http://127.0.0.1:11434"),
    );
    const outcome = await runAgentLoop({
      page: session.page,
      task,
      model: client,
      policy: method,
      constraints: taskSpec.constraints,
      recorder,
      maxSteps,
      screenshotLimit: protocol.execution.max_decision_screenshots,
      onProgress: (stats) => {
        lastStats = stats;
        recorder.update({
          steps_executed: stats.steps,
          actions: stats.actions,
          probes: stats.probes,
          model_calls: stats.model_calls,
        });
      },
    });
    lastStats = outcome.stats;
    await recorder.screenshot(session.page, "final.png");
    writeJson(recorder.path("agent_response.json"), outcome.response);
    completed = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recorder.decision({
      event: "ERROR",
      at: new Date().toISOString(),
      step: lastStats.steps,
      page_url: session?.page.url() ?? task.start_urls[0],
      observation_file: null,
      screenshot_file: null,
      constraints: {},
      eligible_probe_ids: [],
      progress_scores: {},
      selected_probe_id: null,
      selected_probe_label: null,
      model_rationale: message.slice(0, 500),
      action: null,
      evidence_updates: [],
    });
    if (session) {
      try {
        await recorder.screenshot(session.page, "final.png");
      } catch {
        /* site unavailable */
      }
    }
    writeJson(recorder.path("agent_response.json"), {
      task_type: "NAVIGATE",
      status: "UNKNOWN_ERROR",
      retrieved_data: null,
      error_details: message.slice(0, 500),
    });
    console.error("Development run failed: " + message);
  } finally {
    if (session) await session.close();
    recorder.update({
      ended_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      steps_executed: lastStats.steps,
      actions: lastStats.actions,
      probes: lastStats.probes,
      model_calls: lastStats.model_calls,
      claimed_success: lastStats.claimed_success,
      execution_state: completed ? "COMPLETED" : "ERROR",
      error_code: completed ? null : "RUNNER_FAILURE",
    });
  }

  if (completed && flag("evaluate")) {
    const evaluation = webArenaVerified([
      "eval-tasks",
      "--config",
      configPath,
      "--task-ids",
      String(taskId),
      "--output-dir",
      resolve(outputRoot, "runs", model.label, method.toLowerCase()),
    ]);
    if (evaluation.status !== 0) {
      recorder.update({ error_code: "EVALUATOR_ERROR" });
      console.error(
        "Official evaluation failed: " +
          (evaluation.stderr || evaluation.stdout),
      );
    } else {
      const resultPath = recorder.path("eval_result.json");
      if (existsSync(resultPath)) {
        const result = JSON.parse(readFileSync(resultPath, "utf8")) as {
          status?: string;
          score?: number;
        };
        recorder.update({
          official_status: result.status ?? null,
          official_score:
            typeof result.score === "number" ? result.score : null,
        });
      }
      console.log(
        "Official evaluator invoked (result must be audited): " + resultPath,
      );
    }
  }
  refreshArtifactReport({ stage, outputRoot, reportRoot });
  console.log("Run ID: " + runId);
  console.log("Artifacts: " + root);
  console.log("Execution state: " + (completed ? "COMPLETED" : "ERROR"));
  if (!completed) process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
