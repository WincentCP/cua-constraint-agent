import type {
  ConstraintSpec,
  EvidenceFact,
  Ledger,
  LedgerCell,
} from "./types.ts";

export class EvidenceStore {
  readonly facts: EvidenceFact[] = [];

  add(facts: EvidenceFact[]) {
    for (const fact of facts) {
      const duplicate = this.facts.some(
        (existing) =>
          existing.subject === fact.subject &&
          existing.constraint === fact.constraint &&
          existing.state === fact.state &&
          existing.source === fact.source &&
          existing.observation_id === fact.observation_id,
      );
      if (!duplicate) this.facts.push(structuredClone(fact));
    }
  }

  ledger(subjects: string[], constraints: ConstraintSpec[]): Ledger {
    return Object.fromEntries(
      subjects.map((subject) => [
        subject,
        Object.fromEntries(
          constraints.map((constraint) => {
            const sources = this.facts.filter(
              (fact) =>
                fact.subject === subject && fact.constraint === constraint.id,
            );
            const states = new Set(sources.map((source) => source.state));
            const state: LedgerCell["state"] =
              states.size === 1 ? [...states][0] : "UNKNOWN";
            return [constraint.id, { state, sources } satisfies LedgerCell];
          }),
        ),
      ]),
    );
  }
}

export function requiredEvidenceComplete(
  ledger: Ledger,
  subject: string,
  constraints: ConstraintSpec[],
) {
  return constraints
    .filter((constraint) => constraint.required)
    .every(
      (constraint) => ledger[subject]?.[constraint.id]?.state === "SATISFIED",
    );
}
