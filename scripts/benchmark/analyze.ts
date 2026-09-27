import { parseArgs } from "node:util";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const { values } = parseArgs({
  options: {
    root: { type: "string" },
  },
});
if (!values.root) throw Error("--root is required");
const root = resolve(values.root);
if (!existsSync(root)) throw Error("Benchmark root not found: " + root);

type AnyRecord = Record<string, any>;
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const readJsonl = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

function findFiles(path: string, name: string, out: string[] = []) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const p = join(path, entry.name);
    if (entry.isDirectory()) findFiles(p, name, out);
    else if (entry.isFile() && entry.name === name) out.push(p);
  }
  return out;
}
function median(values: number[]) {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function csv(rows: AnyRecord[]) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const q = (v: unknown) => {
    const s =
      v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    [
      keys.map(q).join(","),
      ...rows.map((r) => keys.map((k) => q(r[k])).join(",")),
    ].join("\r\n") + "\r\n"
  );
}

const runs: AnyRecord[] = [];
for (const episodesPath of findFiles(root, "episodes.jsonl")) {
  const runDir = dirname(episodesPath);
  const experimentPath = join(runDir, "experiment.json");
  if (!existsSync(experimentPath)) continue;
  const experiment = readJson(experimentPath);
  const rows = readJsonl(episodesPath);
  const repetitionMatch = basename(runDir).match(/^r(\d+)$/);
  const repetition = repetitionMatch ? Number(repetitionMatch[1]) : null;

  for (const row of rows) {
    const modelCalls = row.events.filter(
      (e: AnyRecord) => e.type === "MODEL_CALL",
    );
    const invalid = row.events.filter(
      (e: AnyRecord) => e.type === "INVALID_STRUCTURED_OUTPUT",
    );
    const repairs = row.events.filter(
      (e: AnyRecord) => e.type === "SCHEMA_RECOVERY",
    );
    const trajectory = row.events
      .filter((e: AnyRecord) => e.type === "PROBE_SELECTION")
      .map((e: AnyRecord) => e.data.selected.id)
      .join(">");
    const timings = modelCalls
      .map((e: AnyRecord) => e.data?.output?.timing_ms)
      .filter(Boolean);
    const evalMs = timings
      .map((t: AnyRecord) => t.eval)
      .filter((v: unknown): v is number => typeof v === "number");
    const totalMs = timings
      .map((t: AnyRecord) => t.total)
      .filter((v: unknown): v is number => typeof v === "number");

    runs.push({
      model: experiment.config.model.name,
      digest: experiment.identity?.model?.digest ?? "",
      ollama_version: experiment.identity?.model?.version ?? "",
      task: row.task.base,
      repetition,
      vda: row.evaluation.vda,
      healthy: row.evaluation.vda !== null,
      outcome: row.evaluation.outcome,
      detail: row.outcome.detail ?? row.evaluation.detail ?? "",
      probe_count: row.evaluation.probe_count,
      trajectory,
      model_calls: modelCalls.length,
      invalid_outputs: invalid.length,
      first_pass_invalid: invalid.filter(
        (e: AnyRecord) => e.data?.attempt === 0,
      ).length,
      repairs: repairs.length,
      unrecovered_structured_failure:
        row.outcome.detail === "structured_output_failure" ? 1 : 0,
      input_tokens: row.outcome.counters.input_tokens,
      output_tokens: row.outcome.counters.output_tokens,
      wall_ms: row.outcome.wall_ms,
      median_eval_ms: median(evalMs),
      median_total_model_ms: median(totalMs),
      screenshots: row.events.filter((e: AnyRecord) => e.type === "SCREENSHOT")
        .length,
      screenshot_failures: row.events.filter(
        (e: AnyRecord) => e.type === "SCREENSHOT_FAILURE",
      ).length,
      run_dir: runDir,
    });
  }
}

if (!runs.length) throw Error("No benchmark episode records found");

const summaries: AnyRecord[] = [];
for (const model of [...new Set(runs.map((r) => r.model))]) {
  const rs = runs.filter((r) => r.model === model);
  const healthy = rs.filter((r) => r.healthy);
  const taskNames = [...new Set(rs.map((r) => r.task))];
  let outcomeRepeatable = 0;
  let trajectoryRepeatable = 0;
  let completeTriples = 0;
  for (const task of taskNames) {
    const tr = rs
      .filter((r) => r.task === task)
      .sort((a, b) => (a.repetition ?? 0) - (b.repetition ?? 0));
    if (tr.length === 3) {
      completeTriples++;
      if (new Set(tr.map((r) => r.outcome)).size === 1) outcomeRepeatable++;
      if (new Set(tr.map((r) => r.trajectory)).size === 1)
        trajectoryRepeatable++;
    }
  }
  const digests = [...new Set(rs.map((r) => r.digest).filter(Boolean))];
  const evalTimes = rs
    .map((r) => r.median_eval_ms)
    .filter((v): v is number => typeof v === "number");
  const totalTimes = rs
    .map((r) => r.median_total_model_ms)
    .filter((v): v is number => typeof v === "number");

  summaries.push({
    model,
    runs: rs.length,
    healthy_runs: healthy.length,
    infrastructure_failures: rs.length - healthy.length,
    correct_runs: healthy.filter((r) => r.vda === 1).length,
    healthy_vda: healthy.length
      ? healthy.filter((r) => r.vda === 1).length / healthy.length
      : null,
    invalid_outputs: rs.reduce((s, r) => s + r.invalid_outputs, 0),
    first_pass_invalid: rs.reduce((s, r) => s + r.first_pass_invalid, 0),
    repairs: rs.reduce((s, r) => s + r.repairs, 0),
    unrecovered_structured_failures: rs.reduce(
      (s, r) => s + r.unrecovered_structured_failure,
      0,
    ),
    complete_task_triples: completeTriples,
    outcome_repeatable_tasks: outcomeRepeatable,
    trajectory_repeatable_tasks: trajectoryRepeatable,
    outcome_repeatability: completeTriples
      ? outcomeRepeatable / completeTriples
      : null,
    trajectory_repeatability: completeTriples
      ? trajectoryRepeatable / completeTriples
      : null,
    median_eval_ms: median(evalTimes),
    median_total_model_ms: median(totalTimes),
    median_wall_ms: median(rs.map((r) => r.wall_ms)),
    input_tokens: rs.reduce((s, r) => s + r.input_tokens, 0),
    output_tokens: rs.reduce((s, r) => s + r.output_tokens, 0),
    screenshot_failures: rs.reduce((s, r) => s + r.screenshot_failures, 0),
    digest_count: digests.length,
    digest_consistent: digests.length === 1,
    digest: digests.length === 1 ? digests[0] : digests,
  });
}

writeFileSync(join(root, "runs.csv"), csv(runs));
writeFileSync(join(root, "summary.csv"), csv(summaries));
writeFileSync(
  join(root, "summary.json"),
  JSON.stringify(
    {
      generated_utc: new Date().toISOString(),
      root,
      models: summaries,
      interpretation:
        "Phase 1 is model selection only. Do not rank models by Proposed-minus-Baseline effect. Repetitions assess repeatability and are not independent task observations.",
    },
    null,
    2,
  ) + "\n",
);

console.log(JSON.stringify(summaries, null, 2));
