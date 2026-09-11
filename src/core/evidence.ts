import {
  fields,
  same,
  type Candidate,
  type Fact,
  type Goal,
  type Ledger,
  type Constraint,
} from "./types.ts";

export class Evidence {
  readonly facts: Fact[] = [];
  add(facts: Fact[]) {
    for (const fact of facts)
      if (
        !this.facts.some(
          (f) =>
            f.candidate === fact.candidate &&
            f.constraint === fact.constraint &&
            f.source === fact.source,
        )
      )
        this.facts.push(structuredClone(fact));
  }
  relevant(candidate: string, k: Constraint, g: Goal) {
    return this.facts.filter(
      (f) =>
        f.candidate === candidate &&
        f.constraint === k &&
        (!f.scope ||
          (same(f.scope.size, g.size) && same(f.scope.color, g.color))),
    );
  }
  ledger(candidates: Candidate[], g: Goal): Ledger {
    return Object.fromEntries(
      candidates.map((c) => [
        c.id,
        Object.fromEntries(
          fields.map((k) => {
            const sources = this.relevant(c.id, k, g),
              values = sources
                .filter((f) => f.value !== null)
                .map((f) => f.value),
              distinct = new Set(values.map((v) => JSON.stringify(v)));
            let state: "UNKNOWN" | "SATISFIED" | "REFUTED" = "UNKNOWN";
            if (distinct.size === 1) {
              const v = values[0];
              const pass =
                k === "variant"
                  ? typeof v === "object" &&
                    v !== null &&
                    same(v.size, g.size) &&
                    same(v.color, g.color)
                  : k === "material"
                    ? typeof v === "string" && same(v, g.material)
                    : k === "price"
                      ? typeof v === "number" && v <= g.maxPrice
                      : v === true;
              state = pass ? "SATISFIED" : "REFUTED";
            }
            return [k, { state, sources }];
          }),
        ),
      ]),
    ) as Ledger;
  }
}
export const satisfied = (ledger: Ledger, candidate: string) =>
  fields.every((k) => ledger[candidate]?.[k].state === "SATISFIED");
export const refuted = (ledger: Ledger, candidate: string) =>
  fields.some((k) => ledger[candidate]?.[k].state === "REFUTED");
export const evidenceUnavailable = (ledger: Ledger, candidate: string) =>
  fields.some(
    (k) =>
      ledger[candidate][k].state === "UNKNOWN" &&
      ledger[candidate][k].sources.some(
        (f) => f.value === null && f.source.endsWith("belum dipublikasikan"),
      ),
  );
