import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { probesFromControls } from "../src/browser/accessibility.ts";
import { openInspectionSession } from "../src/browser/session.ts";
import {
  defaultOutputRoot,
  defaultReportRoot,
  factorialTaskArtifactDir,
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
import {
  readConfig,
  readTask,
  readTasks,
  writeJson,
} from "../src/webarena/io.ts";
import {
  requireSuccess,
  runCommand,
  webArenaVerified,
} from "../src/webarena/official-cli.ts";
import {
  developmentManifest,
  loadMainCandidateManifest,
  loadPilotManifest,
  loadPocManifest,
  verifyPublicStageTask,
  verifyRegisteredPublicCatalog,
} from "../src/webarena/specs.ts";
import { loadStudyProtocol } from "../src/experiment/study.ts";

function option(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function force() {
  return process.argv.includes("--force");
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
  if (!developmentManifest(stage).tasks.some((task) => task.task_id === id)) {
    throw new Error(
      `Task ${id} is not registered for ${stage}; see config/${stage}-tasks.json`,
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
    [
      "Docker daemon",
      runCommand("docker", ["info", "--format", "{{.OSType}}"]),
    ],
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
  const poc = loadPocManifest();
  const manifest = loadPilotManifest();
  const main = loadMainCandidateManifest();
  const protocol = loadStudyProtocol();
  const models = JSON.parse(
    readFileSync("config/models.json", "utf8"),
  ) as Array<{ label: string; name: string }>;

  if (models.length !== protocol.scope.model_count) {
    throw new Error("Study requires exactly four local model candidates");
  }
  if (new Set(models.map((model) => model.label)).size !== models.length) {
    throw new Error("Model labels must be unique");
  }
  if (models.some((model) => !/q4[_-]k[_-]m/i.test(model.name))) {
    throw new Error("All model candidates must use the Q4_K_M class");
  }
  if (manifest.tasks.length !== protocol.scope.pilot_task_count) {
    throw new Error("Pilot must have six tasks");
  }
  if (manifest.tasks.some((task) => task.sites.join(",") !== "shopping")) {
    throw new Error("Pilot scope is Shopping-only");
  }
  const expectedPilotRuns =
    manifest.tasks.length * models.length * protocol.scope.methods.length;
  const expectedMainRuns =
    protocol.scope.main_task_count *
    models.length *
    protocol.scope.methods.length;
  console.log(
    `PoC task IDs: ${poc.tasks.map((task) => task.task_id).join(", ")} (Shopping; development only)`,
  );
  console.log(
    `Pilot task IDs: ${manifest.tasks.map((task) => task.task_id).join(", ")} (Shopping only)`,
  );
  console.log(
    `Main candidate IDs: ${main.tasks.map((task) => task.task_id).join(", ")} (32 UNREVIEWED)`,
  );
  console.log(
    `Model candidates: ${models.map((model) => model.label).join(", ")}`,
  );
  console.log(
    `Benchmark CLI pinned: ${protocol.benchmark.name} ${protocol.benchmark.pypi_version}`,
  );
  console.log(
    `Design: ${expectedPilotRuns} pilot runs; ${expectedMainRuns} main runs (32 distinct held-out tasks)`,
  );
  console.log(
    "Pilot task suitability and model competence still require live validation.",
  );
}

function catalog() {
  const config = configPath();
  if (!existsSync(config)) throw new Error(`Missing ${config}`);
  const catalogPath = resolve(
    option("catalog", "output/catalog/shopping-tasks.json")!,
  );
  if (existsSync(catalogPath) && !force()) {
    throw new Error(
      `Catalog already exists: ${catalogPath}; use --force to refresh`,
    );
  }
  mkdirSync(resolve(catalogPath, ".."), { recursive: true });
  const temporary = `${catalogPath}.tmp-${process.pid}.json`;
  try {
    requireSuccess(
      webArenaVerified([
        "agent-input-get",
        "--sites",
        "shopping",
        "--config",
        config,
        "--output",
        temporary,
      ]),
    );
    const tasks = readTasks(temporary);
    if (
      !tasks.length ||
      tasks.some(
        (task) => task.sites.length !== 1 || task.sites[0] !== "shopping",
      )
    ) {
      throw new Error(
        "Official task catalog did not return Shopping-only public inputs",
      );
    }
    const verified = verifyRegisteredPublicCatalog(tasks);
    console.log(
      "Pinned Shopping catalog verified: " +
      verified.registered + " registered task IDs, " +
      verified.catalog + " official available tasks",
    );
    if (force()) rmSync(catalogPath, { force: true });
    renameSync(temporary, catalogPath);
    const reportPath = resolve("reports/catalog/shopping-task-index.csv");
    mkdirSync(resolve(reportPath, ".."), { recursive: true });
    const cell = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    writeFileSync(
      reportPath,
      [
        "task_id,intent_template_id,site,public_intent,screening_status",
        ...tasks.map((task) =>
          [
            task.task_id,
            task.intent_template_id,
            task.sites.join("+"),
            task.intent,
            "UNREVIEWED",
          ]
            .map(cell)
            .join(","),
        ),
      ].join("\n") + "\n",
      "utf8",
    );
    console.log(
      `Shopping public task catalog: ${tasks.length} tasks -> ${catalogPath}`,
    );
    console.log(`Screening index (not eligibility proof): ${reportPath}`);
  } finally {
    rmSync(temporary, { force: true });
  }
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
  if (existsSync(tasks) && !force()) {
    throw new Error(
      `Public task input already exists: ${tasks}; use --force only for an intentional repeat`,
    );
  }
  mkdirSync(resolve(tasks, ".."), { recursive: true });
  const temporary = `${tasks}.tmp-${process.pid}.json`;
  try {
    const result = requireSuccess(
      webArenaVerified([
        "agent-input-get",
        "--task-ids",
        String(id),
        "--config",
        config,
        "--output",
        temporary,
      ]),
    );
    const exported = readTasks(temporary);
    if (exported.length !== 1 || exported[0].task_id !== id) {
      throw new Error("Official CLI returned unexpected public task input");
    }
    verifyPublicStageTask(exported[0], stage);
    if (force()) rmSync(tasks, { force: true });
    renameSync(temporary, tasks);
    if (result.stdout.trim()) console.log(result.stdout.trim());
  } finally {
    rmSync(temporary, { force: true });
  }
  refreshCurrentReport(stage);
  console.log(`Official public task ${id} exported to ${tasks}`);
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
  const spec = verifyPublicStageTask(task, stage);

  const taskDir = taskArtifactDir(outputRoot(), id);
  const accessibilityDir = join(taskDir, "accessibility");
  const reportPath = join(taskDir, "inspection.json");
  const harPath = join(taskDir, "inspection.har");
  if (!force() && (existsSync(reportPath) || existsSync(harPath))) {
    throw new Error(
      `Inspection artifacts already exist in ${taskDir}; use --force to repeat deliberately`,
    );
  }
  if (force()) {
    rmSync(reportPath, { force: true });
    rmSync(harPath, { force: true });
    rmSync(accessibilityDir, { recursive: true, force: true });
    rmSync(join(taskDir, "screenshots"), { recursive: true, force: true });
  }
  mkdirSync(accessibilityDir, { recursive: true });
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
      const screenshotFile = `screenshots/start-${String(index + 1).padStart(2, "0")}.png`;
      const screenshotPath = join(taskDir, screenshotFile);
      mkdirSync(join(taskDir, "screenshots"), { recursive: true });
      await session.page.screenshot({
        path: screenshotPath,
        fullPage: true,
        animations: "disabled",
      });
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
        snapshot_file: `accessibility/${String(index + 1).padStart(2, "0")}.yaml`,
        screenshot_file: screenshotFile,
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
  writeJson(reportPath, report);
  refreshCurrentReport(stage);
  console.log(`Inspection written to ${reportPath}`);
  console.log(
    `Inspection HAR written to ${harPath} (not an agent network.har)`,
  );
}

function evaluate() {
  const id = taskId();
  const stage = currentStage();
  assertStageTask(stage, id);
  const label = option("model-label");
  const method = option("method");
  if (!label || (method !== "Baseline" && method !== "Proposed")) {
    throw new Error(
      "Official evaluation requires --model-label and --method Baseline|Proposed",
    );
  }
  const models = JSON.parse(
    readFileSync("config/models.json", "utf8"),
  ) as Array<{ label: string }>;
  if (!models.some((model) => model.label === label)) {
    throw new Error("Unknown model label: " + label);
  }
  const output = outputRoot();
  const runDir = factorialTaskArtifactDir(output, label, method, id);
  for (const required of [
    "run_metadata.json",
    "agent_response.json",
    "network.har",
  ]) {
    if (!existsSync(join(runDir, required))) {
      throw new Error("Missing agent-run artifact: " + join(runDir, required));
    }
  }
  const metadata = JSON.parse(
    readFileSync(join(runDir, "run_metadata.json"), "utf8"),
  ) as {
    stage: string;
    task_id: number;
    model_label: string;
    method: string;
    execution_state: string;
  };
  if (
    metadata.stage !== stage ||
    metadata.task_id !== id ||
    metadata.model_label !== label ||
    metadata.method !== method ||
    metadata.execution_state !== "COMPLETED"
  ) {
    throw new Error(
      "Refusing evaluation: run metadata does not match requested cell",
    );
  }
  if (existsSync(join(runDir, "eval_result.json")) && !force()) {
    throw new Error(
      "Official evaluation already exists; preserve evidence or explicitly use --force",
    );
  }
  const result = requireSuccess(
    webArenaVerified([
      "eval-tasks",
      "--config",
      configPath(),
      "--task-ids",
      String(id),
      "--output-dir",
      join(output, "runs", label, method.toLowerCase()),
    ]),
  );
  refreshCurrentReport(stage);
  console.log(result.stdout.trim());
  console.log(
    "Official evaluation output: " + join(runDir, "eval_result.json"),
  );
}

const command = process.argv[2] ?? "help";
try {
  if (command === "doctor") await doctor();
  else if (command === "validate") validate();
  else if (command === "catalog") catalog();
  else if (command === "prepare") prepare();
  else if (command === "inspect") await inspect();
  else if (command === "evaluate") evaluate();
  else {
    console.log(
      "Usage:\n" +
        "  npm run webarena:doctor\n" +
        "  npm run webarena:validate\n" +
        "  npm run webarena:catalog\n" +
        "  npm run webarena:prepare -- --task 279|284|528 --stage poc [--force]\n" +
        "  npm run webarena:inspect -- --task 279|284|528 --stage poc [--force]\n" +
        "  npm run webarena:evaluate -- --task 284 --stage poc --model-label qwen3.5-9b --method Baseline",
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
