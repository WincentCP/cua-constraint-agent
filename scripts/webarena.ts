import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { probesFromControls } from "../src/browser/accessibility.ts";
import { openInspectionSession } from "../src/browser/session.ts";
import {
  defaultOutputRoot,
  defaultReportRoot,
  ensureArtifactLayout,
  parseExperimentStage,
  refreshArtifactReport,
  taskArtifactDir,
  type ExperimentStage,
} from "../src/experiment/artifacts.ts";
import {
  authHeadersForTask,
  taskAllowedOrigins,
} from "../src/webarena/auth.ts";
import { readConfig, readTask, writeJson } from "../src/webarena/io.ts";
import {
  requireSuccess,
  runCommand,
  webArenaVerified,
} from "../src/webarena/official-cli.ts";
import { loadPilotManifest } from "../src/webarena/specs.ts";

function option(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function taskId() {
  const value = option("task", "284");
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid task id: ${value}`);
  }
  return parsed;
}

function configPath() {
  return resolve(option("config", "config/webarena.local.json")!);
}

function currentStage(): Exclude<ExperimentStage, "main"> {
  const stage = parseExperimentStage(option("stage", "poc")!);
  if (stage === "main") {
    throw new Error(
      "The current WebArena inspection CLI is for PoC/pilot only. Main runs are enabled only after the experiment freeze and autonomous runner are finalized.",
    );
  }
  return stage;
}

function outputRoot() {
  const stage = currentStage();
  return resolve(option("output", defaultOutputRoot(stage))!);
}

function reportRoot() {
  const stage = currentStage();
  return resolve(option("reports", defaultReportRoot(stage))!);
}

function taskInputPath(id: number) {
  return resolve(
    option("tasks", join(outputRoot(), "task-inputs", `${id}.json`))!,
  );
}

function ensureCurrentLayout(stage: "poc" | "pilot", ids: number[]) {
  return ensureArtifactLayout({
    stage,
    outputRoot: outputRoot(),
    reportRoot: reportRoot(),
    taskIds: ids,
  });
}

function refreshCurrentReport(stage: "poc" | "pilot") {
  refreshArtifactReport({
    stage,
    outputRoot: outputRoot(),
    reportRoot: reportRoot(),
  });
}

function assertStageTask(stage: "poc" | "pilot", id: number) {
  const manifest = loadPilotManifest();
  if (stage === "poc" && id !== manifest.primary_poc_task) {
    throw new Error(
      `PoC is fixed to task ${manifest.primary_poc_task}; received task ${id}`,
    );
  }
  if (
    stage === "pilot" &&
    !manifest.tasks.some((task) => task.task_id === id)
  ) {
    throw new Error(
      `Task ${id} is not pre-registered in config/pilot-tasks.json`,
    );
  }
}

function printResult(
  label: string,
  status: "PASS" | "FAIL" | "WARN",
  detail: string,
) {
  console.log(`${status.padEnd(4)} ${label.padEnd(22)} ${detail}`);
}

async function doctor() {
  const checks = [
    ["Node", runCommand(process.execPath, ["--version"])],
    ["Docker", runCommand("docker", ["--version"])],
    ["uvx", runCommand("uvx", ["--version"])],
    ["Ollama (later stage)", runCommand("ollama", ["--version"])],
  ] as const;

  let failed = false;
  for (const [name, result] of checks) {
    const required = name !== "Ollama (later stage)";
    if (result.status === 0) {
      printResult(name, "PASS", result.stdout.trim() || "available");
    } else {
      printResult(
        name,
        required ? "FAIL" : "WARN",
        result.stderr || "not found",
      );
      failed ||= required;
    }
  }

  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    printResult("Playwright Chromium", "PASS", chromium.executablePath());
  } catch (error) {
    failed = true;
    printResult("Playwright Chromium", "FAIL", String(error));
  }

  if (failed) process.exitCode = 1;
}

function validate() {
  const manifest = loadPilotManifest();
  if (manifest.primary_poc_task !== 284) {
    throw new Error("PoC task must remain 284 until pilot review");
  }
  if (manifest.tasks.length !== 6) {
    throw new Error(
      "Pilot manifest must contain exactly 6 pre-registered tasks",
    );
  }

  const models = JSON.parse(
    readFileSync("config/models.json", "utf8"),
  ) as Array<{
    label: string;
    name: string;
  }>;
  if (models.length !== 4) {
    throw new Error("Main design requires exactly four pre-registered models");
  }
  if (new Set(models.map((model) => model.label)).size !== models.length) {
    throw new Error("Model labels must be unique");
  }
  if (models.some((model) => !/q4[_-]k[_-]m/i.test(model.name))) {
    throw new Error("All local model candidates must use the Q4_K_M class");
  }

  console.log(
    `Pilot manifest valid: ${manifest.tasks
      .map((task) => task.task_id)
      .join(", ")}`,
  );
  console.log(`Primary PoC task: ${manifest.primary_poc_task}`);
  console.log(
    `Model manifest valid: ${models.map((model) => model.label).join(", ")}`,
  );
  console.log("No main experiment is frozen by this command.");
}

function prepare() {
  const id = taskId();
  const stage = currentStage();
  assertStageTask(stage, id);
  ensureCurrentLayout(stage, [id]);

  const config = configPath();
  if (!existsSync(config)) {
    throw new Error(
      `Missing ${config}. Copy config/webarena.example.json to config/webarena.local.json first.`,
    );
  }
  const tasks = taskInputPath(id);
  mkdirSync(resolve(tasks, ".."), { recursive: true });
  const result = requireSuccess(
    webArenaVerified([
      "agent-input-get",
      "--task-ids",
      String(id),
      "--config",
      config,
      "--output",
      tasks,
    ]),
  );
  if (result.stdout.trim()) console.log(result.stdout.trim());
  refreshCurrentReport(stage);
  console.log(`Task ${id} exported to ${tasks}`);
}

async function inspect() {
  const id = taskId();
  const stage = currentStage();
  assertStageTask(stage, id);
  ensureCurrentLayout(stage, [id]);

  const tasks = taskInputPath(id);
  const config = configPath();
  if (!existsSync(tasks)) {
    throw new Error(`Missing ${tasks}; run webarena:prepare first.`);
  }
  if (!existsSync(config)) throw new Error(`Missing ${config}`);

  const task = readTask(tasks, id);
  const localConfig = readConfig(config);
  const manifest = loadPilotManifest();
  const spec = manifest.tasks.find((candidate) => candidate.task_id === id);
  if (!spec) throw new Error(`Task ${id} is not in pilot manifest`);

  const taskDir = taskArtifactDir(outputRoot(), id);
  const accessibilityDir = join(taskDir, "accessibility");
  mkdirSync(accessibilityDir, { recursive: true });
  const harPath = join(taskDir, "network.har");
  const session = await openInspectionSession({
    harPath,
    extraHTTPHeaders: authHeadersForTask(task, localConfig),
    allowedOrigins: taskAllowedOrigins(task),
  });

  const observations = [];
  try {
    for (let index = 0; index < task.start_urls.length; index++) {
      await session.goto(task.start_urls[index]);
      const snapshot = await session.capture();
      const probes = probesFromControls(snapshot.controls, spec.constraints);
      const snapshotPath = join(
        accessibilityDir,
        `${String(index + 1).padStart(2, "0")}.yaml`,
      );
      writeFileSync(snapshotPath, snapshot.accessibility, "utf8");
      observations.push({
        index,
        start_url: task.start_urls[index],
        page_url: snapshot.url,
        title: snapshot.title,
        controls: snapshot.controls,
        mapped_probes: probes.filter((probe) => probe.may_answer.length > 0),
        unmapped_control_count: probes.filter(
          (probe) => probe.may_answer.length === 0,
        ).length,
        snapshot_file: snapshotPath,
      });
    }
  } finally {
    await session.close();
  }

  const required = spec.constraints.filter((constraint) => constraint.required);
  const mapped = new Set(
    observations.flatMap((observation) =>
      observation.mapped_probes.flatMap((probe) => probe.may_answer),
    ),
  );
  const report = {
    schema_version: 1,
    stage: `${stage.toUpperCase()}_INSPECTION`,
    task,
    rationale: spec.rationale,
    constraints: spec.constraints,
    observations,
    initial_constraint_mapping: {
      required_count: required.length,
      mapped_required_count: required.filter((constraint) =>
        mapped.has(constraint.id),
      ).length,
      mapped_required_ids: required
        .filter((constraint) => mapped.has(constraint.id))
        .map((constraint) => constraint.id),
      note: "Initial-page hint mapping is diagnostic only. It is not evidence and is not a task-success score.",
    },
  };
  const reportPath = join(taskDir, "inspection.json");
  writeJson(reportPath, report);
  refreshCurrentReport(stage);
  console.log(`Inspection written to ${reportPath}`);
  console.log(`HAR written to ${harPath}`);
}

function evaluate() {
  const id = taskId();
  const stage = currentStage();
  assertStageTask(stage, id);
  ensureCurrentLayout(stage, [id]);

  const config = configPath();
  const output = outputRoot();
  const taskDir = taskArtifactDir(output, id);
  for (const required of ["agent_response.json", "network.har"]) {
    if (!existsSync(join(taskDir, required))) {
      throw new Error(
        `Missing ${join(
          taskDir,
          required,
        )}; official evaluation requires both files.`,
      );
    }
  }
  const result = requireSuccess(
    webArenaVerified([
      "eval-tasks",
      "--config",
      config,
      "--task-ids",
      String(id),
      "--output-dir",
      output,
    ]),
  );
  refreshCurrentReport(stage);
  console.log(result.stdout.trim());
  console.log(`Official evaluation completed for task ${id}`);
}

const command = process.argv[2] ?? "help";
try {
  if (command === "doctor") await doctor();
  else if (command === "validate") validate();
  else if (command === "prepare") prepare();
  else if (command === "inspect") await inspect();
  else if (command === "evaluate") evaluate();
  else {
    console.log(
      "Usage:\n" +
        "  npm run webarena:doctor\n" +
        "  npm run webarena:validate\n" +
        "  npm run webarena:prepare -- --task 284 [--stage poc|pilot]\n" +
        "  npm run webarena:inspect -- --task 284 [--stage poc|pilot]\n" +
        "  npm run webarena:evaluate -- --task 284 [--stage poc|pilot]",
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
