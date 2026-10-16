import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  defaultScreeningPath,
  inspectScreening,
  requireApprovedScreening,
  stageTasks,
  writeScreeningDraft,
  type ScreeningStage,
} from "../src/experiment/screening.ts";
import { loadMainCandidateManifest } from "../src/webarena/specs.ts";
import { writeJson } from "../src/webarena/io.ts";

function option(name: string, fallback?: string) {
  const idx = process.argv.indexOf("--" + name);
  return idx < 0 ? fallback : process.argv[idx + 1];
}

function csvCell(value: string | number) {
  const s = String(value);
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
  return '"' + safe.replaceAll('"', '""') + '"';
}

try {
  const command = process.argv[2];
  const stage = option("stage", "main");
  if (stage !== "poc" && stage !== "pilot" && stage !== "main") {
    throw new Error("Expected --stage poc|pilot|main");
  }
  const typedStage: ScreeningStage = stage;
  const reviewPath = resolve(option("review", defaultScreeningPath(stage))!);
  const catalog = resolve(
    option("catalog", "output/catalog/shopping-tasks.json")!,
  );
  if (command === "init") {
    const draft = writeScreeningDraft(typedStage, reviewPath);
    const tasks = stageTasks(stage);
    const candidates =
      stage === "main" ? loadMainCandidateManifest().tasks : [];
    const group = new Map(candidates.map((task) => [task.task_id, task.group]));
    const csv =
      [
        "task_id,intent_template_id,group,public_intent,screening_status",
        ...tasks.map((task) =>
          [
            task.task_id,
            task.intent_template_id,
            group.get(task.task_id) ?? stage,
            task.public_intent,
            "PENDING",
          ]
            .map(csvCell)
            .join(","),
        ),
      ].join("\n") + "\n";
    const csvPath = resolve(dirname(reviewPath), stage + "-candidates.csv");
    mkdirSync(dirname(csvPath), { recursive: true });
    writeFileSync(csvPath, csv, "utf8");
    console.log(
      "Review draft: " +
        reviewPath +
        " (" +
        draft.tasks.length +
        " PENDING; no automatic approval)",
    );
    console.log("Public task list: " + csvPath);
  } else if (command === "check" || command === "require") {
    const result =
      command === "require"
        ? requireApprovedScreening(reviewPath, stage, catalog)
        : inspectScreening(reviewPath, stage, catalog);
    const reportPath = resolve(
      dirname(reviewPath),
      stage + "-screening-check.json",
    );
    writeJson(reportPath, {
      schema_version: 1,
      stage,
      status: result.approved ? "APPROVED" : "INCOMPLETE",
      expected: result.expected,
      review_sha256: result.review_sha256,
      failures: result.failures,
      note: "This verifies review completeness and official PUBLIC task identity. Human UI/evidence attestations are not automatically independently established.",
    });
    console.log(
      "Screening " +
        stage +
        ": " +
        (result.approved ? "APPROVED" : "INCOMPLETE") +
        " (" +
        (result.expected - result.failures.length) +
        "/" +
        result.expected +
        " reviewed PASS)",
    );
    console.log("Audit: " + reportPath);
  } else {
    console.log(
      "Usage:\n" +
        "  npm run screening:init -- --stage poc|pilot|main\n" +
        "  npm run screening:check -- --stage poc|pilot|main --catalog output/catalog/shopping-tasks.json\n" +
        "  npm run screening:require -- --stage main --catalog output/catalog/shopping-tasks.json",
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
