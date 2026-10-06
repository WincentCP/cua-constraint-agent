import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultOutputRoot,
  defaultReportRoot,
  ensureArtifactLayout,
  ensureMainRunLayout,
  parseExperimentStage,
  refreshArtifactReport,
  type ExperimentMethod,
} from "../src/experiment/artifacts.ts";
import { loadPilotManifest } from "../src/webarena/specs.ts";

function option(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function parseTaskIds(value?: string) {
  if (!value) return [];
  const ids = value.split(",").map((part) => Number(part.trim()));
  if (ids.some((id) => !Number.isInteger(id) || id < 0)) {
    throw new Error(`Invalid --tasks value: ${value}`);
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

function defaultTaskIds(stage: "poc" | "pilot" | "main") {
  const manifest = loadPilotManifest();
  if (stage === "poc") return [manifest.primary_poc_task];
  if (stage === "pilot") return manifest.tasks.map((task) => task.task_id);
  return [];
}

const command = process.argv[2] ?? "help";

try {
  if (command === "init" || command === "report") {
    const stage = parseExperimentStage(option("stage", "poc")!);
    const experimentId = option("experiment-id");
    const explicitTaskIds = parseTaskIds(option("tasks"));
    const taskIds =
      explicitTaskIds.length > 0 ? explicitTaskIds : defaultTaskIds(stage);
    const outputRoot = resolve(
      option("output", defaultOutputRoot(stage, experimentId))!,
    );
    const reportRoot = resolve(
      option("reports", defaultReportRoot(stage, experimentId))!,
    );

    ensureArtifactLayout({
      stage,
      experimentId,
      outputRoot,
      reportRoot,
      taskIds,
    });

    if (command === "init" && stage === "main" && taskIds.length > 0) {
      const models = JSON.parse(
        readFileSync("config/models.json", "utf8"),
      ) as Array<{ label: string; name: string }>;
      const methods: ExperimentMethod[] = ["Baseline", "Proposed"];
      for (const model of models) {
        for (const method of methods) {
          ensureMainRunLayout({
            outputRoot,
            modelLabel: model.label,
            method,
            taskIds,
          });
        }
      }
    }

    const report = refreshArtifactReport({
      stage,
      experimentId,
      outputRoot,
      reportRoot,
    });
    console.log(`Artifact root: ${outputRoot}`);
    console.log(`Report root:   ${reportRoot}`);
    console.log(`Indexed files: ${report.fileCount}`);
  } else {
    console.log(
      "Usage:\n" +
        "  npm run artifacts:init -- --stage poc\n" +
        "  npm run artifacts:init -- --stage pilot\n" +
        "  npm run artifacts:init -- --stage main --experiment-id thesis-v1 --tasks 284,323\n" +
        "  npm run artifacts:report -- --stage pilot",
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
