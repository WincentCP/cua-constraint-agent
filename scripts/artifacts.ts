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
import {
  loadPocManifest,
  loadPilotManifest,
  loadMainCandidateManifest,
  verifyPublicMainCandidate,
} from "../src/webarena/specs.ts";
import { requireMainFreeze } from "../src/experiment/main-freeze.ts";
import { join } from "node:path";
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
  if (stage === "poc") return loadPocManifest().tasks.map((task) => task.task_id);
  if (stage === "pilot") return loadPilotManifest().tasks.map((task) => task.task_id);
  return loadMainCandidateManifest().tasks.map((task) => task.task_id);
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
    const pocIds = loadPocManifest().tasks.map((task) => task.task_id);
    const pilot = loadPilotManifest();
    const pilotIds = pilot.tasks.map((task) => task.task_id);

    if (
      stage === "poc" &&
      (taskIds.length !== pocIds.length || taskIds.some((id) => !pocIds.includes(id)))
    ) {
      throw new Error(
        "PoC artifacts require exactly three registered development tasks",
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
    if (stage === "poc" || stage === "pilot") {
      const currentIds = stage === "poc" ? pocIds : pilotIds;
      const existingManifestPath = resolve(outputRoot, "stage-manifest.json");
      if (existsSync(existingManifestPath)) {
        const previous = JSON.parse(
          readFileSync(existingManifestPath, "utf8"),
        ) as { task_ids?: number[] };
        const retired = (previous.task_ids ?? []).filter(
          (id) => !currentIds.includes(id),
        );
        if (retired.length) {
          throw new Error(
            `Existing ${stage} output contains retired tasks: ${retired.join(", ")}. Archive it instead of mixing protocols.`,
          );
        }
      }
    }
    if (command === "init" && stage === "main") {
      assertMainTaskSelection(taskIds, pilotIds, protocol);
      requireMainFreeze(join(outputRoot, "research-freeze.json"), taskIds);
      const catalogPath = resolve(
        option("catalog", "output/catalog/shopping-tasks.json")!,
      );
      if (!existsSync(catalogPath)) {
        throw new Error(
          "Missing official public Shopping catalog; run npm run webarena:catalog first",
        );
      }
      const catalog = readTasks(catalogPath);
      for (const id of taskIds) {
        const task = catalog.find((entry) => entry.task_id === id);
        if (!task) throw new Error("Missing official Shopping task " + id);
        verifyPublicMainCandidate(task);
      }
      console.log(
        "Main scaffold uses previously screened/frozen tasks only; does not execute any model.",
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
        "  npm run artifacts:init -- --stage main --experiment-id thesis-v1 [--tasks <32-registered-ids>] (requires freeze)\n" +
        "  npm run artifacts:report -- --stage pilot",
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
