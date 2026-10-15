import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { evaluatePilotGate } from "../src/experiment/pilot-gate.ts";
import { writeJson } from "../src/webarena/io.ts";

function option(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

try {
  const models = JSON.parse(
    readFileSync("config/models.json", "utf8"),
  ) as Array<{ label: string; name: string }>;
  const outputRoot = resolve(option("output", "output/pilot"));
  const reportsRoot = resolve(option("reports", "reports/pilot"));
  mkdirSync(reportsRoot, { recursive: true });
  const report = evaluatePilotGate(outputRoot, models);
  writeJson(join(reportsRoot, "pilot-gate.json"), report);

  const columns = [
    "task_id",
    "model",
    "method",
    "technical_valid",
    "official_success",
    "reason",
  ];
  const rows = report.episodes.map((episode) =>
    [
      episode.task_id,
      episode.model,
      episode.method,
      episode.valid,
      episode.official_success,
      episode.reason,
    ].join(","),
  );
  writeFileSync(
    join(reportsRoot, "pilot-run-index.csv"),
    [columns.join(","), ...rows].join("\n") + "\n",
    "utf8",
  );

  const markdown = [
    "# Pilot operational feasibility gate",
    "",
    `Status: **${report.status}**`,
    `Valid runs: ${report.completed_valid}/${report.expected} (minimum ${report.thresholds.min_valid_runs})`,
    `Official successes: ${report.official_successes} (minimum ${report.thresholds.min_official_successes})`,
    `Successful models: ${report.successful_models.join(", ") || "none"}`,
    `Successful tasks: ${report.successful_tasks.join(", ") || "none"}`,
    `Models with zero official success: ${report.models_with_zero_success.join(", ") || "none"}`,
    "",
    "## Operational checks",
    ...Object.entries(report.checks).map(
      ([name, passed]) => `- ${name}: ${passed ? "PASS" : "FAIL"}`,
    ),
    "",
    `**Limitation:** ${report.disclaimer}`,
    "",
    "Official success comes only from WebArena-Verified eval_result.json. This report does not compare effectiveness or claim Proposed wins.",
    "",
  ].join("\n");
  writeFileSync(join(reportsRoot, "pilot-gate.md"), markdown, "utf8");
  console.log(
    `Pilot gate: ${report.status} (${report.completed_valid}/${report.expected} technically valid; ${report.official_successes} official successes)`,
  );
  console.log(`Report: ${join(reportsRoot, "pilot-gate.md")}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
