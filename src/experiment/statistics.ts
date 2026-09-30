export type PairedBinary = { baseline: 0 | 1; proposed: 0 | 1 };

function choose(n: number, k: number) {
  k = Math.min(k, n - k);
  let value = 1;
  for (let i = 1; i <= k; i++) value = (value * (n - k + i)) / i;
  return value;
}

export function exactMcNemar(pairs: PairedBinary[]) {
  const counts = {
    both_correct: 0,
    baseline_only: 0,
    proposed_only: 0,
    both_incorrect: 0,
  };
  for (const pair of pairs) {
    if (pair.baseline && pair.proposed) counts.both_correct++;
    else if (pair.baseline) counts.baseline_only++;
    else if (pair.proposed) counts.proposed_only++;
    else counts.both_incorrect++;
  }
  const discordant = counts.baseline_only + counts.proposed_only,
    smaller = Math.min(counts.baseline_only, counts.proposed_only);
  let p = 1;
  if (discordant) {
    let tail = 0;
    for (let k = 0; k <= smaller; k++)
      tail += choose(discordant, k) / 2 ** discordant;
    p = Math.min(1, 2 * tail);
  }
  return {
    ...counts,
    discordant,
    p_value_two_sided_exact: p,
    method: "exact two-sided McNemar (binomial on discordant pairs)",
  };
}

export function exactWilcoxonSignedRank(differences: number[]) {
  const nonzero = differences.filter((d) => d !== 0),
    absolute = nonzero.map(Math.abs),
    sorted = absolute
      .map((value, index) => ({ value, index }))
      .sort((a, b) => a.value - b.value),
    doubledRanks = Array(nonzero.length).fill(0);
  for (let start = 0; start < sorted.length; ) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value)
      end++;
    const averageRank = (start + 1 + end) / 2;
    for (let i = start; i < end; i++)
      doubledRanks[sorted[i].index] = averageRank * 2;
    start = end;
  }
  const positive = nonzero.reduce(
      (sum, d, i) => sum + (d > 0 ? doubledRanks[i] : 0),
      0,
    ),
    negative = nonzero.reduce(
      (sum, d, i) => sum + (d < 0 ? doubledRanks[i] : 0),
      0,
    ),
    total = positive + negative,
    observed = Math.min(positive, negative);
  const distribution = new Map<number, number>([[0, 1]]);
  for (const rank of doubledRanks) {
    const next = new Map(distribution);
    for (const [sum, count] of distribution)
      next.set(sum + rank, (next.get(sum + rank) ?? 0) + count);
    distribution.clear();
    for (const [sum, count] of next) distribution.set(sum, count);
  }
  const assignments = 2 ** nonzero.length;
  let extreme = 0;
  for (const [sum, count] of distribution)
    if (Math.min(sum, total - sum) <= observed) extreme += count;
  return {
    n_pairs: differences.length,
    n_nonzero: nonzero.length,
    zero_differences: differences.length - nonzero.length,
    w_plus: positive / 2,
    w_minus: negative / 2,
    statistic: observed / 2,
    p_value_two_sided_exact: nonzero.length ? extreme / assignments : 1,
    method:
      "exact paired Wilcoxon signed-rank permutation; zero differences removed; average ranks for ties",
  };
}
