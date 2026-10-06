import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { writeJson } from "../webarena/io.ts";

export const experimentStages = ["poc", "pilot", "main"] as const;
export type ExperimentStage = (typeof experimentStages)[number];
export type ExperimentMethod = "Baseline" | "Proposed";

type StageManifest = {
  schema_version: 1;
  layout_version: 1;
  stage: ExperimentStage;
  experiment_id: string | null;
  created_at: string;
  updated_at: string;
  task_ids: number[];
};

export type ArtifactLayoutOptions = {
  stage: ExperimentStage;
  outputRoot: string;
  reportRoot: string;
  taskIds?: number[];
  experimentId?: string;
};

function safeSegment(value: string, label: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}

export function parseExperimentStage(value: string): ExperimentStage {
  if (!experimentStages.includes(value as ExperimentStage)) {
    throw new Error(
      `Invalid stage: ${value}. Expected one of: ${experimentStages.join(", ")}`,
    );
  }
  return value as ExperimentStage;
}

export function defaultOutputRoot(
  stage: ExperimentStage,
  experimentId?: string,
) {
  if (stage !== "main") return join("output", stage);
  if (!experimentId) {
    throw new Error("Main stage requires --experiment-id");
  }
  return join("output", "main", safeSegment(experimentId, "experiment id"));
}

export function defaultReportRoot(
  stage: ExperimentStage,
  experimentId?: string,
) {
  if (stage !== "main") return join("reports", stage);
  if (!experimentId) {
    throw new Error("Main stage requires --experiment-id");
  }
  return join("reports", "main", safeSegment(experimentId, "experiment id"));
}

export function taskArtifactDir(outputRoot: string, taskId: number) {
  if (!Number.isInteger(taskId) || taskId < 0) {
    throw new Error(`Invalid task id: ${taskId}`);
  }
  return join(resolve(outputRoot), String(taskId));
}

export function mainRunRoot(
  outputRoot: string,
  modelLabel: string,
  method: ExperimentMethod,
) {
  return join(
    resolve(outputRoot),
    "runs",
    safeSegment(modelLabel, "model label"),
    method.toLowerCase(),
  );
}

export function mainTaskArtifactDir(
  outputRoot: string,
  modelLabel: string,
  method: ExperimentMethod,
  taskId: number,
) {
  return taskArtifactDir(mainRunRoot(outputRoot, modelLabel, method), taskId);
}

function readManifest(path: string): StageManifest | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as StageManifest;
}

export function ensureArtifactLayout(options: ArtifactLayoutOptions) {
  const outputRoot = resolve(options.outputRoot);
  const reportRoot = resolve(options.reportRoot);
  const taskIds = [...new Set(options.taskIds ?? [])].sort((a, b) => a - b);

  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(reportRoot, { recursive: true });

  if (options.stage === "main") {
    mkdirSync(join(outputRoot, "runs"), { recursive: true });
    mkdirSync(join(outputRoot, "summary"), { recursive: true });
  } else {
    mkdirSync(join(outputRoot, "task-inputs"), { recursive: true });
    for (const taskId of taskIds) {
      const dir = taskArtifactDir(outputRoot, taskId);
      mkdirSync(join(dir, "accessibility"), { recursive: true });
    }
  }

  const manifestPath = join(outputRoot, "stage-manifest.json");
  const previous = readManifest(manifestPath);
  if (previous && previous.stage !== options.stage) {
    throw new Error(
      `Artifact root already belongs to stage ${previous.stage}: ${outputRoot}`,
    );
  }
  const experimentId = options.experimentId ?? null;
  if (
    previous &&
    previous.experiment_id !== null &&
    previous.experiment_id !== experimentId
  ) {
    throw new Error(
      `Artifact root already belongs to experiment ${previous.experiment_id}`,
    );
  }

  const now = new Date().toISOString();
  const mergedTaskIds = [
    ...new Set([...(previous?.task_ids ?? []), ...taskIds]),
  ].sort((a, b) => a - b);
  const manifest: StageManifest = {
    schema_version: 1,
    layout_version: 1,
    stage: options.stage,
    experiment_id: experimentId,
    created_at: previous?.created_at ?? now,
    updated_at: now,
    task_ids: mergedTaskIds,
  };
  writeJson(manifestPath, manifest);

  return { outputRoot, reportRoot, manifestPath };
}

export function ensureMainRunLayout(options: {
  outputRoot: string;
  modelLabel: string;
  method: ExperimentMethod;
  taskIds: number[];
}) {
  const runRoot = mainRunRoot(
    options.outputRoot,
    options.modelLabel,
    options.method,
  );
  mkdirSync(runRoot, { recursive: true });
  for (const taskId of options.taskIds) {
    mkdirSync(join(mainTaskArtifactDir(
      options.outputRoot,
      options.modelLabel,
      options.method,
      taskId,
    ), "accessibility"), { recursive: true });
  }
  return runRoot;
}

type ArtifactIndexEntry = {
  path: string;
  size_bytes: number;
  modified_at: string;
};

function portableRelative(root: string, path: string) {
  return relative(root, path).split(sep).join("/");
}

function collectFiles(root: string): ArtifactIndexEntry[] {
  if (!existsSync(root)) return [];
  const rows: ArtifactIndexEntry[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = statSync(path);
      rows.push({
        path: portableRelative(root, path),
        size_bytes: stat.size,
        modified_at: stat.mtime.toISOString(),
      });
    }
  }

  walk(root);
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function refreshArtifactReport(options: {
  stage: ExperimentStage;
  outputRoot: string;
  reportRoot: string;
  experimentId?: string;
}) {
  const outputRoot = resolve(options.outputRoot);
  const reportRoot = resolve(options.reportRoot);
  mkdirSync(reportRoot, { recursive: true });

  const files = collectFiles(outputRoot);
  const generatedAt = new Date().toISOString();
  const index = {
    schema_version: 1,
    stage: options.stage,
    experiment_id: options.experimentId ?? null,
    generated_at: generatedAt,
    file_count: files.length,
    files,
  };
  writeJson(join(reportRoot, "artifact-index.json"), index);

  const csv = [
    ["path", "size_bytes", "modified_at"].join(","),
    ...files.map((file) =>
      [file.path, file.size_bytes, file.modified_at].map(csvCell).join(","),
    ),
  ].join("\n");
  writeFileSync(join(reportRoot, "artifact-index.csv"), csv + "\n", "utf8");

  const count = (name: string) =>
    files.filter((file) => file.path.endsWith(name)).length;
  const taskIds = existsSync(join(outputRoot, "stage-manifest.json"))
    ? (
        JSON.parse(
          readFileSync(join(outputRoot, "stage-manifest.json"), "utf8"),
        ) as StageManifest
      ).task_ids
    : [];

  const summary = [
    `# ${options.stage.toUpperCase()} artifact summary`,
    "",
    `Generated: ${generatedAt}`,
    `Experiment ID: ${options.experimentId ?? "n/a"}`,
    `Registered tasks: ${taskIds.length ? taskIds.join(", ") : "none yet"}`,
    `Indexed files: ${files.length}`,
    "",
    "## Key artifact counts",
    "",
    `- inspection.json: ${count("inspection.json")}`,
    `- network.har: ${count("network.har")}`,
    `- agent_response.json: ${count("agent_response.json")}`,
    `- eval_result.json: ${count("eval_result.json")}`,
    "",
    "This is a generated artifact inventory for audit, appendix preparation, and later result aggregation. It is not a statistical analysis and does not redefine official WebArena-Verified evaluation.",
    "",
  ].join("\n");
  writeFileSync(join(reportRoot, "stage-summary.md"), summary, "utf8");

  return {
    fileCount: files.length,
    indexJson: join(reportRoot, "artifact-index.json"),
    indexCsv: join(reportRoot, "artifact-index.csv"),
    summary: join(reportRoot, "stage-summary.md"),
  };
}
