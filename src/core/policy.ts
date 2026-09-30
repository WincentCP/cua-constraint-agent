import { type Ledger, type Policy, type Probe } from "./types.ts";

// The only experimental branch. Baseline follows generic model-guided progress scores; Proposed ignores those scores for final ranking and uses explicit UNKNOWN coverage, then public forward cost and stable order. Eligibility, ledger and semantic annotations are shared.
export function selectProbe(
  policy: Policy,
  probes: Probe[],
  ledger: Ledger,
  scores: Record<string, number>,
): Probe {
  if (!probes.length) throw Error("No eligible probes");
  const unknown = (p: Probe) =>
    p.may_answer.filter((k) => ledger[p.candidate][k].state === "UNKNOWN")
      .length;
  return [...probes].sort((a, b) => {
    if (policy === "Proposed")
      return (
        unknown(b) - unknown(a) ||
        a.forward_cost - b.forward_cost ||
        a.order - b.order
      );
    return scores[b.id] - scores[a.id] || a.order - b.order;
  })[0];
}
