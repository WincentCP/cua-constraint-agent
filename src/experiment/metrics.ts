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

export function exactMcNemar(
  baselineWrongProposedCorrect: number,
  baselineCorrectProposedWrong: number,
) {
  const b = baselineWrongProposedCorrect,
    c = baselineCorrectProposedWrong,
    n = b + c;
  if (![b, c].every((x) => Number.isInteger(x) && x >= 0))
    throw Error("McNemar discordant counts must be non-negative integers");
  if (!n) return 1;
  const k = Math.min(b, c);
  let combination = 1n,
    tail = 0n;
  for (let i = 0; i <= k; i++) {
    if (i > 0)
      combination = (combination * BigInt(n - i + 1)) / BigInt(i);
    tail += combination;
  }
  const denominator = 1n << BigInt(n);
  return Math.min(1, (2 * Number(tail)) / Number(denominator));
}

export function exactWilcoxonSignedRank(differences: number[]) {
  const nonzero = differences
    .map((delta, index) => ({ delta, abs: Math.abs(delta), index }))
    .filter((x) => x.abs > 0)
    .sort((a, b) => a.abs - b.abs || a.index - b.index);
  const ranked: { delta: number; rank2: number }[] = [];
  for (let i = 0; i < nonzero.length; ) {
    let j = i + 1;
    while (j < nonzero.length && nonzero[j].abs === nonzero[i].abs) j++;
    const averageRank = ((i + 1) + j) / 2,
      rank2 = Math.round(averageRank * 2);
    for (let k = i; k < j; k++)
      ranked.push({ delta: nonzero[k].delta, rank2 });
    i = j;
  }
  const total2 = ranked.reduce((sum, x) => sum + x.rank2, 0),
    plus2 = ranked
      .filter((x) => x.delta > 0)
      .reduce((sum, x) => sum + x.rank2, 0),
    minus2 = total2 - plus2,
    observed2 = Math.min(plus2, minus2);
  if (!ranked.length)
    return {
      nonzero_pairs: 0,
      zero_differences: differences.length,
      w_plus: 0,
      w_minus: 0,
      statistic: 0,
      p_value: 1,
      method:
        "zero differences discarded; tied absolute differences use average ranks; exact two-sided sign-permutation distribution",
    };
  let counts = Array<bigint>(total2 + 1).fill(0n);
  counts[0] = 1n;
  let reachable = 0;
  for (const { rank2 } of ranked) {
    const next = [...counts];
    for (let sum = 0; sum <= reachable; sum++)
      if (counts[sum]) next[sum + rank2] += counts[sum];
    counts = next;
    reachable += rank2;
  }
  let extreme = 0n;
  for (let sum = 0; sum <= total2; sum++)
    if (Math.min(sum, total2 - sum) <= observed2) extreme += counts[sum];
  const totalAssignments = 1n << BigInt(ranked.length);
  return {
    nonzero_pairs: ranked.length,
    zero_differences: differences.length - ranked.length,
    w_plus: plus2 / 2,
    w_minus: minus2 / 2,
    statistic: observed2 / 2,
    p_value: Number(extreme) / Number(totalAssignments),
    method:
      "zero differences discarded; tied absolute differences use average ranks; exact two-sided sign-permutation distribution",
  };
}
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
  const validPairs = pairs.filter((p) => p.Baseline && p.Proposed),
    baselineWrongProposedCorrect = validPairs.filter(
      (p) =>
        p.Baseline!.evaluation.vda === 0 && p.Proposed!.evaluation.vda === 1,
    ).length,
    baselineCorrectProposedWrong = validPairs.filter(
      (p) =>
        p.Baseline!.evaluation.vda === 1 && p.Proposed!.evaluation.vda === 0,
    ).length,
    overallProbePairs = efficiency.find((e) => e.group === "overall")!.pairs,
    probeDifferences = overallProbePairs.map((p) => p.delta),
    statistics = {
      mcnemar_exact_two_sided: {
        paired_n: validPairs.length,
        baseline_wrong_proposed_correct: baselineWrongProposedCorrect,
        baseline_correct_proposed_wrong: baselineCorrectProposedWrong,
        discordant_n:
          baselineWrongProposedCorrect + baselineCorrectProposedWrong,
        p_value: exactMcNemar(
          baselineWrongProposedCorrect,
          baselineCorrectProposedWrong,
        ),
      },
      wilcoxon_signed_rank_exact: {
        jointly_correct_pairs: overallProbePairs.length,
        ...exactWilcoxonSignedRank(probeDifferences),
        difference_definition:
          "Proposed probes - Baseline probes; negative favors Proposed",
      },
    };
  return {
    schema_version: 3,
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
    statistics,
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
