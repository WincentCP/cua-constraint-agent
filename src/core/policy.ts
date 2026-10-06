import type { Ledger, PlannerScores, Policy, Probe } from "./types.ts";

function unknownCoverage(probe: Probe, ledger: Ledger) {
  const row = ledger[probe.subject] ?? {};
  return probe.may_answer.filter(
    (constraint) => !row[constraint] || row[constraint].state === "UNKNOWN",
  ).length;
}

/**
 * Experimental treatment boundary.
 *
 * Baseline: generic model progress score, then stable discovery order.
 * Proposed: unresolved-constraint coverage, then lower forward cost, then
 * stable discovery order.
 *
 * Probe eligibility and may_answer annotations must be shared across both
 * conditions.
 */
export function selectProbe(
  policy: Policy,
  probes: Probe[],
  ledger: Ledger,
  scores: PlannerScores,
): Probe {
  if (!probes.length) throw new Error("No eligible probes");

  return [...probes].sort((a, b) => {
    if (policy === "Proposed") {
      return (
        unknownCoverage(b, ledger) - unknownCoverage(a, ledger) ||
        a.forward_cost - b.forward_cost ||
        a.order - b.order
      );
    }

    return (scores[b.id] ?? 0) - (scores[a.id] ?? 0) || a.order - b.order;
  })[0];
}
