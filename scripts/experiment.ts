import { parseArgs } from "node:util";
import { join, resolve } from "node:path";
import { config } from "../src/core/config.ts";
import { DemoModel, OllamaModel } from "../src/agent/planner.ts";
import { loadTask, validateDataset } from "../src/environment/dataset.ts";
import { manifest, type Cell } from "../src/experiment/manifest.ts";
import {
  createExperiment,
  recordRun,
  readJson,
  readLines,
  recoverInterrupted,
  exportResults,
  rerunCells,
  writeJson,
  validateExperiment,
  type Experiment,
} from "../src/experiment/runner.ts";
import { type Row } from "../src/experiment/metrics.ts";
import { writeReport } from "../src/experiment/report.ts";
import {
  assertIdentity,
  developmentGate,
  makeFreeze,
  runtimeIdentity,
  verifyFreeze,
  hardwareStatus,
} from "../src/experiment/freeze.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    demo: { type: "boolean", default: false },
    out: { type: "string" },
    input: { type: "string" },
    ollama: { type: "string", default: "http://127.0.0.1:11434" },
    task: { type: "string" },
    policy: { type: "string", default: "Baseline" },
    freeze: { type: "string" },
    gate: { type: "string" },
    pair: { type: "string" },
    reason: { type: "string" },
    help: { type: "boolean" },
  },
});
const command = positionals[0] ?? "help";
const required = (key: keyof typeof values) => {
  const value = values[key];
  if (typeof value !== "string" || !value.trim())
    throw Error(`--${key} is required`);
  return value;
};
async function main() {
  if (command === "help" || values.help) {
    console.log(
      `Constraint-directed CUA — PRD FINAL\n\nCommands:\n  validate\n  doctor [--demo]\n  episode --task development-01 --policy Baseline [--demo] --out DIR\n  development | repeatability [--demo] --out DIR\n  gate --input DIR\n  freeze --gate DIR --out FILE\n  main --freeze FILE --out DIR\n  main --demo --out DIR                  (engineering only)\n  resume --input DIR [--freeze FILE]\n  rerun --input DIR --pair BASE:r1 --reason TEXT [--freeze FILE]\n  metrics | export --input DIR\n\nCommon: --ollama http://127.0.0.1:11434\nReal main requires a passing development gate and immutable freeze.\n`,
    );
    console.log(
      "  report --input DIR                    (HTML/Markdown with screenshot references)",
    );
    return;
  }
  if (command === "validate") {
    const validation = validateDataset();
    console.log(JSON.stringify(validation, null, 2));
    if (!validation.passed) process.exitCode = 1;
    return;
  }
  if (command === "report") {
    console.log(
      JSON.stringify(writeReport(resolve(required("input"))), null, 2),
    );
    return;
  }
  if (command === "metrics" || command === "export") {
    console.log(
      JSON.stringify(exportResults(resolve(required("input"))), null, 2),
    );
    if (command === "export") writeReport(resolve(required("input")));
    return;
  }
  if (command === "gate") {
    const report = developmentGate(resolve(required("input")));
    writeJson(join(resolve(required("input")), "gate.json"), report);
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
    return;
  }
  const resume = command === "resume" || command === "rerun",
    out = resume
      ? resolve(required("input"))
      : values.out
        ? resolve(values.out)
        : "",
    previous = resume
      ? readJson<Experiment>(join(out, "experiment.json"))
      : undefined;
  const demo = previous?.demo ?? values.demo,
    identity = await runtimeIdentity(values.ollama!, demo);
  if (command === "doctor") {
    console.log(
      JSON.stringify(
        {
          ready: true,
          ...identity,
          hardware: hardwareStatus(),
          dataset: validateDataset(),
          note: "Installed-model/browser readiness only; inference and competence are not tested. Low free RAM can cause paging and model load timeouts.",
        },
        null,
        2,
      ),
    );
    return;
  }
  if (command === "freeze") {
    console.log(
      JSON.stringify(
        makeFreeze(
          resolve(required("gate")),
          resolve(required("out")),
          identity,
        ),
        null,
        2,
      ),
    );
    return;
  }
  if (
    ![
      "episode",
      "development",
      "repeatability",
      "main",
      "resume",
      "rerun",
    ].includes(command)
  )
    throw Error("Unknown command; use --help");
  let plan: Cell[],
    freeze_id: string | null = null;
  if (command === "main" || previous?.mode === "main") {
    if (!demo) {
      const frozen = verifyFreeze(resolve(required("freeze")), identity);
      freeze_id = frozen.id;
      plan = frozen.main_manifest;
    } else plan = manifest("main");
  } else if (command === "episode") {
    const task = loadTask(required("task"));
    if (!demo && task.split === "main")
      throw Error("Real main tasks must run through the frozen main manifest");
    const policy = values.policy;
    if (policy !== "Baseline" && policy !== "Proposed")
      throw Error("Policy must be Baseline or Proposed");
    // Single episodes remain diagnostic; paired metrics require both conditions.
    plan = [{ base: task.id, policy, pair: `${task.id}:r1`, repeat: 1 }];
  } else
    plan =
      previous?.plan ?? manifest(command as "development" | "repeatability");
  if (!out) throw Error("--out is required");
  if (previous) {
    validateExperiment(previous);
    assertIdentity(previous.identity, identity);
    if (previous.freeze_id !== freeze_id)
      throw Error("Freeze identity differs from original experiment");
  }
  const experiment =
      previous ??
      createExperiment(out, command, demo, plan, identity, freeze_id),
    model = demo ? new DemoModel() : new OllamaModel(config, values.ollama!);
  const controller = new AbortController(),
    stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    let rows = resume
      ? recoverInterrupted(out, experiment)
      : readLines<Row>(join(out, "episodes.jsonl"));
    if (command === "rerun") {
      const rerun = rerunCells(
        rows,
        experiment,
        required("pair"),
        required("reason"),
      );
      for (const cell of rerun.cells) {
        if (controller.signal.aborted) break;
        const row = await recordRun(
          out,
          experiment,
          cell,
          model,
          rerun.attempt,
          required("reason"),
          rerun.replaces,
          controller.signal,
        );
        console.log(`${cell.base} ${cell.policy}: ${row.evaluation.outcome}`);
        exportResults(out);
      }
    } else
      for (const cell of experiment.plan) {
        if (controller.signal.aborted) break;
        if (
          rows.some(
            (r) =>
              r.attempt === 0 &&
              r.cell.pair === cell.pair &&
              r.cell.policy === cell.policy,
          )
        )
          continue;
        const row = await recordRun(
          out,
          experiment,
          cell,
          model,
          0,
          null,
          [],
          controller.signal,
        );
        rows.push(row);
        console.log(
          `${rows.length}/${experiment.plan.length} ${cell.base} ${cell.policy}: ${row.evaluation.outcome} (${row.evaluation.probe_count} probes, ${row.outcome.wall_ms}ms)`,
        );
        exportResults(out);
        if (row.evaluation.vda === null) {
          console.error(
            "Infrastructure failure: batch stopped. Resolve the cause, then resume unattempted cells and explicitly rerun the affected pair.",
          );
          break;
        }
      }
    const metrics = exportResults(out);
    writeReport(out);
    console.log(
      JSON.stringify(
        {
          out,
          demo,
          planned: metrics.planned_original_runs,
          recorded: metrics.original_attempts,
          outcomes: metrics.outcomes,
        },
        null,
        2,
      ),
    );
    if (
      controller.signal.aborted ||
      metrics.infrastructure_failures ||
      metrics.unattempted_original
    )
      process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
