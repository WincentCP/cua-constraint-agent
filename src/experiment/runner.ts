import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { config, hash, type Config } from "../core/config.ts";
import {
  emptyCounters,
  type AgentOutcome,
  type Event,
  type Log,
} from "../core/types.ts";
import { runAgent } from "../agent/run.ts";
import { type Model } from "../agent/planner.ts";
import { openBrowser, type Driver, type Capture } from "../browser/session.ts";
import { openWorld, type Fault } from "../environment/world.ts";
import { loadTask, type Task } from "../environment/dataset.ts";
import { evaluate } from "../evaluation/oracle.ts";
import { taskMetadata, type Cell } from "./manifest.ts";
import {
  calculateMetrics,
  csv,
  flatRow,
  selectedPairs,
  type Row,
} from "./metrics.ts";

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
export function durableAppend(path: string, value: unknown) {
  let fd: number | undefined;
  try {
    fd = openSync(path, "a");
    appendFileSync(fd, JSON.stringify(value) + "\n", "utf8");
    fsyncSync(fd);
  } catch (e) {
    throw Error(`storage_write_failed: ${e}`);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
export const readJson = <T = any>(path: string): T =>
  JSON.parse(readFileSync(path, "utf8"));
export const writeJson = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
export function readLines<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line, i) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        throw Error(
          `Corrupt journal ${path}:${i + 1}; preserve original and repair explicitly`,
        );
      }
    });
}
export type Experiment = {
  schema_version: 1;
  id: string;
  mode: string;
  demo: boolean;
  config: Config;
  config_hash: string;
  plan: Cell[];
  created: string;
  identity: unknown;
  freeze_id: string | null;
};
export function validateExperiment(
  experiment: Experiment,
  requireCurrent = true,
) {
  if (
    experiment.schema_version !== 1 ||
    hash({
      config: experiment.config,
      identity: experiment.identity,
      plan: experiment.plan,
      demo: experiment.demo,
    }) !== experiment.config_hash
  )
    throw Error("Experiment configuration/manifest integrity mismatch");
  if (requireCurrent && hash(experiment.config) !== hash(config))
    throw Error("Experiment configuration differs from current configuration");
  return experiment;
}
export function createExperiment(
  out: string,
  mode: string,
  demo: boolean,
  plan: Cell[],
  identity: unknown,
  freeze_id: string | null = null,
) {
  out = resolve(out);
  if (existsSync(out))
    throw Error(
      "Output already exists; use a new directory or explicit resume",
    );
  mkdirSync(out, { recursive: true });
  const experiment: Experiment = {
    schema_version: 1,
    id: randomUUID(),
    mode,
    demo,
    config: structuredClone(config),
    config_hash: hash({ config, identity, plan, demo }),
    plan,
    created: new Date().toISOString(),
    identity,
    freeze_id,
  };
  writeJson(join(out, "experiment.json"), experiment);
  return experiment;
}
export function failedOutcome(detail: string): AgentOutcome {
  const now = new Date().toISOString();
  return {
    terminal: "INFRASTRUCTURE_FAILURE",
    detail,
    selected: null,
    verification: "NOT_RUN",
    counters: emptyCounters(),
    started: now,
    ended: now,
    wall_ms: 0,
  };
}
export async function episode(
  task: Task,
  cell: Cell,
  model: Model,
  cfg: Config = config,
  options: {
    fault?: Fault;
    sink?: Log;
    signal?: AbortSignal;
    capture?: Capture;
    screenshotDirectory?: { absolute: string; relative: string };
  } = {},
) {
  const events: Event[] = [],
    log: Log = (type, data) => {
      const event = {
        seq: events.length + 1,
        timestamp: new Date().toISOString(),
        type,
        data: structuredClone(data),
      };
      options.sink?.(type, event);
      events.push(event);
    };
  let environment: Awaited<ReturnType<typeof openWorld>> | undefined,
    driver: Driver | undefined,
    outcome = failedOutcome("not_started"),
    quiescent = true;
  try {
    environment = await openWorld(task, options.fault);
    driver = await openBrowser(
      environment.origin,
      environment.secret,
      log,
      () => {
        environment!.world.forbidden_effect = true;
      },
      undefined,
      options.capture ??
        (options.screenshotDirectory
          ? async (page, observation) => {
              const folder = options.screenshotDirectory!;
              try {
                mkdirSync(folder.absolute, { recursive: true });
                const file = `${observation.id}.png`;
                await page.screenshot({
                  path: join(folder.absolute, file),
                  fullPage: true,
                  timeout: 5000,
                });
                log("SCREENSHOT", {
                  observation: observation.id,
                  url: observation.url,
                  step: observation.step,
                  path: `${folder.relative}/${file}`,
                });
              } catch (error) {
                log("SCREENSHOT_FAILURE", {
                  observation: observation.id,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
          : undefined),
    );
    log("BROWSER", { version: driver.version });
    outcome = await runAgent(
      driver,
      structuredClone(task.goal),
      cell.policy,
      model,
      cfg,
      log,
      options.signal,
    );
  } catch (e) {
    outcome = failedOutcome(e instanceof Error ? e.message : String(e));
  } finally {
    try {
      await driver?.close();
    } catch {
      quiescent = false;
    }
    try {
      await environment?.close();
    } catch {
      quiescent = false;
    }
  }
  // The browser and server are closed before freezing and evaluating. No evaluator
  // output is passed back to the agent or used for recovery in this attempt.
  const frozenOutcome = deepFreeze(structuredClone(outcome));
  log("AGENT_FROZEN", frozenOutcome);
  deepFreeze(events);
  const world = environment?.world ?? {
    task: structuredClone(task),
    cart: [],
    forbidden_effect: false,
    closed: true,
    requests: [],
  };
  deepFreeze(world);
  const evaluation = evaluate(world, frozenOutcome, events, quiescent);
  return {
    outcome: structuredClone(frozenOutcome),
    evaluation,
    events: structuredClone(events),
    final_world: structuredClone(world),
  };
}
export async function recordRun(
  out: string,
  experiment: Experiment,
  cell: Cell,
  model: Model,
  attempt = 0,
  rerun_reason: string | null = null,
  replaces: string[] = [],
  signal?: AbortSignal,
): Promise<Row> {
  validateExperiment(experiment);
  if (model.demo !== experiment.demo)
    throw Error("Model mode differs from experiment");
  const id = randomUUID(),
    start = {
      id,
      cell,
      attempt,
      rerun_reason,
      replaces,
      timestamp: new Date().toISOString(),
    };
  durableAppend(join(out, "journal.jsonl"), {
    type: "ATTEMPT_STARTED",
    ...start,
  });
  const result = await episode(
    loadTask(cell.base),
    cell,
    model,
    experiment.config,
    {
      signal,
      screenshotDirectory: experiment.config.reporting.screenshots
        ? {
            absolute: join(out, "screenshots", id),
            relative: `screenshots/${id}`,
          }
        : undefined,
      sink: (_type, event) =>
        durableAppend(join(out, "events.jsonl"), { attempt_id: id, event }),
    },
  );
  const row: Row = {
    id,
    experiment_id: experiment.id,
    config_hash: experiment.config_hash,
    demo: experiment.demo,
    cell,
    task: taskMetadata(loadTask(cell.base)),
    attempt,
    rerun_reason,
    replaces,
    ...result,
  };
  durableAppend(join(out, "episodes.jsonl"), row);
  durableAppend(join(out, "journal.jsonl"), { type: "ATTEMPT_FINISHED", id });
  return row;
}
export function recoverInterrupted(out: string, experiment: Experiment) {
  const rows = readLines<Row>(join(out, "episodes.jsonl")),
    journal = readLines<any>(join(out, "journal.jsonl"));
  for (const start of journal.filter(
    (e) => e.type === "ATTEMPT_STARTED" && !rows.some((r) => r.id === e.id),
  )) {
    const events = readLines<{ attempt_id: string; event: Event }>(
        join(out, "events.jsonl"),
      )
        .filter((e) => e.attempt_id === start.id)
        .map((e) => e.event),
      outcome = failedOutcome("interrupted_attempt_recovered_from_journal");
    const row: Row = {
      id: start.id,
      experiment_id: experiment.id,
      config_hash: experiment.config_hash,
      demo: experiment.demo,
      cell: start.cell,
      task: taskMetadata(loadTask(start.cell.base)),
      attempt: start.attempt,
      rerun_reason: start.rerun_reason,
      replaces: start.replaces,
      outcome,
      events,
      final_world: null,
      evaluation: {
        outcome: "INFRASTRUCTURE_FAILURE",
        vda: null,
        final_effect_correct: null,
        evidence_complete_before_act: null,
        budget_exhausted: false,
        probe_count: events.filter(
          (e) => e.type === "ACTION_INTENT" && e.data.exploratory,
        ).length,
        public_refutations: [],
        detail: outcome.detail,
      },
    };
    durableAppend(join(out, "episodes.jsonl"), row);
    rows.push(row);
  }
  return rows;
}
export function exportResults(out: string) {
  const experiment = validateExperiment(
      readJson<Experiment>(join(out, "experiment.json")),
      false,
    ),
    rows = readLines<Row>(join(out, "episodes.jsonl")),
    metrics = calculateMetrics(rows, experiment.plan);
  if (
    rows.some(
      (r) =>
        r.experiment_id !== experiment.id ||
        r.config_hash !== experiment.config_hash ||
        r.demo !== experiment.demo,
    )
  )
    throw Error("Attempt identity differs from experiment");
  writeJson(join(out, "metrics.json"), metrics);
  writeFileSync(join(out, "metrics.csv"), csv(metrics.accuracy));
  writeFileSync(join(out, "episodes.csv"), csv(rows.map(flatRow)));
  writeFileSync(
    join(out, "paired-probes.csv"),
    csv(
      metrics.efficiency.flatMap((e) =>
        e.pairs.map((p) => ({ group: e.group, ...p })),
      ),
    ),
  );
  writeJson(
    join(out, "failures.json"),
    rows
      .filter((r) => r.evaluation.vda !== 1)
      .map((r) => ({
        id: r.id,
        cell: r.cell,
        attempt: r.attempt,
        ...r.evaluation,
      })),
  );
  return metrics;
}
export function rerunCells(
  rows: Row[],
  experiment: Experiment,
  pair: string,
  reason: string,
) {
  if (!reason.trim()) throw Error("A rerun reason is required");
  const cells = experiment.plan.filter((c) => c.pair === pair);
  if (cells.length !== 2) throw Error("Unknown pair");
  const originals = rows.filter((r) => r.cell.pair === pair),
    latest = Math.max(-1, ...originals.map((r) => r.attempt));
  if (
    selectedPairs(rows, experiment.plan).find((p) => p.pair === pair)
      ?.attempt !== null
  )
    throw Error("Healthy pairs cannot be rerun");
  if (!originals.some((r) => r.attempt === latest && r.evaluation.vda === null))
    throw Error("Rerun requires a recorded infrastructure failure");
  return {
    cells,
    attempt: latest + 1,
    replaces: originals.filter((r) => r.attempt === latest).map((r) => r.id),
  };
}
