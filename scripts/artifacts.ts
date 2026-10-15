import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultOutputRoot,
  defaultReportRoot,
  ensureArtifactLayout,
  ensureFactorialRunLayout,
  parseExperimentStage,
  refreshArtifactReport,
  type ExperimentMethod,
} from "../src/experiment/artifacts.ts";
import { loadPilotManifest } from "../src/webarena/specs.ts";
import {
  assertMainTaskSelection,
  loadStudyProtocol,
} from "../src/experiment/study.ts";
import { readTasks } from "../src/webarena/io.ts";

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

    const protocol = loadStudyProtocol();
    const pilot = loadPilotManifest();
    const pilotIds = pilot.tasks.map((task) => task.task_id);

    if (
      stage === "poc" &&
      (taskIds.length !== 1 || taskIds[0] !== protocol.scope.poc_task_id)
    ) {
      throw new Error(
        "PoC artifacts must use only the pre-registered primary task",
      );
    }
    if (
      stage === "pilot" &&
      (taskIds.length !== pilotIds.length ||
        taskIds.some((id) => !pilotIds.includes(id)))
    ) {
      throw new Error(
        "Pilot artifacts must use the six registered Shopping tasks",
      );
    }
    if (stage === "pilot") {
      const existingManifestPath = resolve(outputRoot, "stage-manifest.json");
      if (existsSync(existingManifestPath)) {
        const previous = JSON.parse(
          readFileSync(existingManifestPath, "utf8"),
        ) as { task_ids?: number[] };
        const retired = (previous.task_ids ?? []).filter(
          (id) => !pilotIds.includes(id),
        );
        if (retired.length) {
          throw new Error(
            `Existing pilot output contains retired tasks: ${retired.join(", ")}. Archive it instead of mixing protocols.`,
          );
        }
      }
    }
    if (command === "init" && stage === "main") {
      assertMainTaskSelection(taskIds, pilotIds, protocol);
      const catalogPath = resolve(
        option("catalog", "output/catalog/shopping-tasks.json")!,
      );
      if (!existsSync(catalogPath)) {
        throw new Error(
          "Missing official public Shopping catalog; run npm run webarena:catalog first",
        );
      }
      const catalog = readTasks(catalogPath);
      const knownShopping = new Set(
        catalog
          .filter(
            (task) => task.sites.length === 1 && task.sites[0] === "shopping",
          )
          .map((task) => task.task_id),
      );
      const invalid = taskIds.filter((id) => !knownShopping.has(id));
      if (invalid.length) {
        throw new Error(
          `Main selection includes non-Shopping or unknown task IDs: ${invalid.join(", ")}`,
        );
      }
      console.log(
        "Main artifact scaffold only: task suitability, freeze and live runner are not automatically approved.",
      );
    }

    ensureArtifactLayout({
      stage,
      experimentId,
      outputRoot,
      reportRoot,
      taskIds,
    });

    if (command === "init" && (stage === "pilot" || stage === "main")) {
      const models = JSON.parse(
        readFileSync("config/models.json", "utf8"),
      ) as Array<{ label: string; name: string }>;
      const methods: ExperimentMethod[] = ["Baseline", "Proposed"];
      for (const model of models) {
        for (const method of methods) {
          ensureFactorialRunLayout({
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
        "  npm run artifacts:init -- --stage main --experiment-id thesis-v1 --tasks <32-comma-separated-shopping-ids>\n" +
        "  npm run artifacts:report -- --stage pilot",
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
