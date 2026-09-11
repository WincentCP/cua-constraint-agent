import { type AgentOutcome, type Event } from "../core/types.ts";
import { type Evaluation } from "../evaluation/oracle.ts";
import { type Cell, type taskMetadata } from "./manifest.ts";

export type Row = {
  id: string;
  experiment_id: string;
  config_hash: string;
  demo: boolean;
  cell: Cell;
  task: ReturnType<typeof taskMetadata>;
  attempt: number;
  rerun_reason: string | null;
  replaces: string[];
  outcome: AgentOutcome;
  evaluation: Evaluation;
  events: Event[];
  final_world: unknown;
};
export const median = (values: number[]) => quantile(values, 0.5);
function quantile(values: number[], q: number) {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b),
    i = (v.length - 1) * q,
    lo = Math.floor(i),
    hi = Math.ceil(i);
  return v[lo] + (v[hi] - v[lo]) * (i - lo);
}
const distribution = (v: number[]) => ({
  n: v.length,
  median: median(v),
  min: v.length ? Math.min(...v) : null,
  max: v.length ? Math.max(...v) : null,
  q1: quantile(v, 0.25),
  q3: quantile(v, 0.75),
  iqr: v.length ? quantile(v, 0.75)! - quantile(v, 0.25)! : null,
  values: v,
});
export function selectedPairs(rows: Row[], plan: Cell[]) {
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw Error("Duplicate attempt ID");
  if (
    new Set(rows.map((r) => `${r.config_hash}:${r.demo}:${r.experiment_id}`))
      .size > 1
  )
    throw Error("Mixed experiment identities");
  const originalKeys = new Set(plan.map((c) => `${c.pair}:${c.policy}`));
  if (rows.some((r) => !originalKeys.has(`${r.cell.pair}:${r.cell.policy}`)))
    throw Error("Attempt outside manifest");
  if (
    rows.some(
      (r) =>
        !plan.some(
          (c) =>
            c.base === r.cell.base &&
            c.pair === r.cell.pair &&
            c.policy === r.cell.policy &&
            c.repeat === r.cell.repeat,
        ),
    )
  )
    throw Error("Attempt cell differs from manifest");
  if (
    new Set(rows.map((r) => `${r.cell.pair}:${r.cell.policy}:${r.attempt}`))
      .size !== rows.length
  )
    throw Error("Duplicate policy attempt");
  return [...new Set(plan.map((c) => c.pair))].map((pair) => {
    const attempts = [
      ...new Set(
        rows.filter((r) => r.cell.pair === pair).map((r) => r.attempt),
      ),
    ].sort((a, b) => a - b);
    // Predeclared rule: earliest complete infrastructure-free pair, never best result.
    for (const attempt of attempts) {
      const group = rows.filter(
          (r) => r.cell.pair === pair && r.attempt === attempt,
        ),
        b = group.find((r) => r.cell.policy === "Baseline"),
        p = group.find((r) => r.cell.policy === "Proposed");
      if (b && p && b.evaluation.vda !== null && p.evaluation.vda !== null)
        return { pair, attempt, Baseline: b, Proposed: p };
    }
    return { pair, attempt: null, Baseline: null, Proposed: null };
  });
}
export function calculateMetrics(rows: Row[], plan: Cell[]) {
  const pairs = selectedPairs(rows, plan),
    valid = pairs.flatMap((p) =>
      p.Baseline && p.Proposed ? [p.Baseline, p.Proposed] : [],
    );
  const selectors: { group: string; matches: (r: Row) => boolean }[] = [
    { group: "overall", matches: () => true },
    ...["solvable", "no-solution", "unavailable-evidence"].map((type) => ({
      group: type,
      matches: (r: Row) => r.task.type === type,
    })),
    ...["single-feasible", "multi-feasible"].map((subtype) => ({
      group: subtype,
      matches: (r: Row) => r.task.subtype === subtype,
    })),
    ...[2, 3, 4].map((n) => ({
      group: `U${n}`,
      matches: (r: Row) => r.task.unknown === n,
    })),
  ];
  const accuracy = selectors.flatMap((s) =>
    (["Baseline", "Proposed"] as const).map((policy) => {
      const all = rows.filter((r) => r.cell.policy === policy && s.matches(r)),
        assessed = valid.filter(
          (r) => r.cell.policy === policy && s.matches(r),
        ),
        healthy = all.filter((r) => r.evaluation.vda !== null);
      return {
        group: s.group,
        policy,
        primary_paired_n: assessed.length,
        correct: assessed.reduce((sum, r) => sum + r.evaluation.vda!, 0),
        vda: assessed.length
          ? assessed.reduce((sum, r) => sum + r.evaluation.vda!, 0) /
            assessed.length
          : null,
        recorded_attempts: all.length,
        infrastructure_failures: all.filter((r) => r.evaluation.vda === null)
          .length,
        all_healthy_attempts_n: healthy.length,
        all_healthy_attempts_vda: healthy.length
          ? healthy.reduce((sum, r) => sum + r.evaluation.vda!, 0) /
            healthy.length
          : null,
      };
    }),
  );
  const efficiency = selectors.map((s) => {
    const both = pairs.filter(
      (p) =>
        p.Baseline?.evaluation.vda === 1 &&
        p.Proposed?.evaluation.vda === 1 &&
        s.matches(p.Baseline),
    );
    return {
      group: s.group,
      jointly_correct_pairs: both.length,
      Baseline: distribution(
        both.map((p) => p.Baseline!.evaluation.probe_count),
      ),
      Proposed: distribution(
        both.map((p) => p.Proposed!.evaluation.probe_count),
      ),
      delta_probe: distribution(
        both.map(
          (p) =>
            p.Proposed!.evaluation.probe_count -
            p.Baseline!.evaluation.probe_count,
        ),
      ),
      pairs: both.map((p) => ({
        base: p.Baseline!.task.base,
        attempt: p.attempt,
        baseline: p.Baseline!.evaluation.probe_count,
        proposed: p.Proposed!.evaluation.probe_count,
        delta:
          p.Proposed!.evaluation.probe_count -
          p.Baseline!.evaluation.probe_count,
      })),
    };
  });
  const mechanism = [2, 3, 4].map((n) => {
    const baseline = accuracy.find(
        (a) => a.group === `U${n}` && a.policy === "Baseline",
      )!,
      proposed = accuracy.find(
        (a) => a.group === `U${n}` && a.policy === "Proposed",
      )!;
    return {
      unknown: n,
      Baseline: baseline.vda,
      Proposed: proposed.vda,
      absolute_vda_difference:
        baseline.vda !== null && proposed.vda !== null
          ? proposed.vda - baseline.vda
          : null,
      paired_probe: efficiency.find((e) => e.group === `U${n}`),
    };
  });
  return {
    schema_version: 2,
    demo: rows[0]?.demo ?? null,
    planned_original_runs: plan.length,
    original_attempts: rows.filter((r) => r.attempt === 0).length,
    unattempted_original: plan.filter(
      (c) =>
        !rows.some(
          (r) =>
            r.attempt === 0 &&
            r.cell.pair === c.pair &&
            r.cell.policy === c.policy,
        ),
    ).length,
    rerun_attempts: rows.filter((r) => r.attempt > 0).length,
    infrastructure_failures: rows.filter((r) => r.evaluation.vda === null)
      .length,
    selected_valid_pairs: valid.length / 2,
    pairs_without_valid_result: pairs
      .filter((p) => p.attempt === null)
      .map((p) => p.pair),
    selected_pairs: pairs.map((p) => ({
      pair: p.pair,
      attempt: p.attempt,
      Baseline: p.Baseline?.id ?? null,
      Proposed: p.Proposed?.id ?? null,
    })),
    accuracy,
    efficiency,
    mechanism,
    outcomes: Object.fromEntries(
      [...new Set(rows.map((r) => r.evaluation.outcome))].map((o) => [
        o,
        rows.filter((r) => r.evaluation.outcome === o).length,
      ]),
    ),
  };
}
export function csv(rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap(Object.keys))],
    quote = (value: unknown) => {
      let text =
        value == null
          ? ""
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
      if (typeof value === "string" && /^[=+@-]/.test(text)) text = "'" + text;
      return `"${text.replaceAll('"', '""')}"`;
    };
  return (
    [
      keys.map(quote).join(","),
      ...rows.map((r) => keys.map((k) => quote(r[k])).join(",")),
    ].join("\r\n") + "\r\n"
  );
}
export function flatRow(r: Row) {
  return {
    attempt_id: r.id,
    base: r.task.base,
    policy: r.cell.policy,
    task_type: r.task.type,
    subtype: r.task.subtype,
    initial_unknown: r.task.unknown,
    pair: r.cell.pair,
    attempt: r.attempt,
    rerun_reason: r.rerun_reason,
    demo: r.demo,
    ...r.evaluation,
    ...r.outcome.counters,
    terminal: r.outcome.terminal,
    wall_ms: r.outcome.wall_ms,
  };
}
