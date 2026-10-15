import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildResultsDataset } from "../src/experiment/results.ts";
import {
  defaultOutputRoot,
  defaultReportRoot,
} from "../src/experiment/artifacts.ts";

function option(name: string, fallback?: string) {
  const index = process.argv.indexOf("--" + name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

try {
  const stage = option("stage", "pilot");
  if (stage !== "pilot" && stage !== "main") {
    throw new Error("Use --stage pilot or main");
  }
  const experimentId = option("experiment-id");
  const models = JSON.parse(
    readFileSync("config/models.json", "utf8"),
  ) as Array<{
    label: string;
    name: string;
  }>;
  const result = buildResultsDataset({
    stage,
    models,
    outputRoot: resolve(
      option("output", defaultOutputRoot(stage, experimentId))!,
    ),
    reportRoot: resolve(
      option("reports", defaultReportRoot(stage, experimentId))!,
    ),
    catalogPath: option("catalog"),
  });
  console.log(
    "Result inventory: " +
      result.valid +
      "/" +
      result.expected +
      " valid official episodes",
  );
  console.log("Official successes among valid: " + result.success);
  console.log("Reports: " + result.reports);
  if (result.valid !== result.expected) {
    console.log("INCOMPLETE — do not interpret missing episodes as failures.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
