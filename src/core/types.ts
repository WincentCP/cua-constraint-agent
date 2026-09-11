import { z } from "zod";

export const fields = ["variant", "material", "price", "availability"] as const;
export type Constraint = (typeof fields)[number];
export type Policy = "Baseline" | "Proposed";
export type State = "SATISFIED" | "REFUTED" | "UNKNOWN";
export const GoalSchema = z
  .object({
    size: z.string().min(1),
    color: z.string().min(1),
    material: z.string().min(1),
    maxPrice: z.number().int().positive(),
    quantity: z.literal(1),
  })
  .strict();
export type Goal = z.infer<typeof GoalSchema>;
export type Variant = { size: string; color: string };
export type Fact = {
  candidate: string;
  constraint: Constraint;
  value: string | number | boolean | Variant | null;
  scope?: Variant;
  source: string;
  observation: string;
  step: number;
  timestamp: string;
};
export type Ledger = Record<
  string,
  Record<Constraint, { state: State; sources: Fact[] }>
>;
export type Candidate = { id: string; name: string };
export type Control = {
  candidate: string;
  name: string;
  role: "link" | "button";
  url: string;
  kind: "probe" | "back" | "act";
};
export type Observation = {
  id: string;
  url: string;
  snapshot: string;
  candidates: Candidate[];
  controls: Control[];
  facts: Fact[];
  step: number;
  timestamp: string;
};
export type Probe = {
  id: string;
  candidate: string;
  name: string;
  url: string;
  may_answer: Constraint[];
  forward_cost: number;
  action_cost: number;
  order: number;
};
export type Counters = {
  probes: number;
  actions: number;
  observations: number;
  model_calls: number;
  input_tokens: number;
  output_tokens: number;
  recoveries: number;
  invalid_outputs: number;
  informative_probes: number;
};
export const emptyCounters = (): Counters => ({
  probes: 0,
  actions: 0,
  observations: 0,
  model_calls: 0,
  input_tokens: 0,
  output_tokens: 0,
  recoveries: 0,
  invalid_outputs: 0,
  informative_probes: 0,
});
export type Terminal =
  | "ACT"
  | "NO_SOLUTION"
  | "INSUFFICIENT_EVIDENCE"
  | "BUDGET_EXHAUSTED"
  | "EXECUTION_OR_VERIFICATION_FAILURE"
  | "INFRASTRUCTURE_FAILURE";
export type AgentOutcome = {
  terminal: Terminal;
  detail: string;
  selected: string | null;
  verification: "PASS" | "FAIL" | "NOT_RUN";
  counters: Counters;
  started: string;
  ended: string;
  wall_ms: number;
};
export type Event = { seq: number; timestamp: string; type: string; data: any };
export type Log = (type: string, data: unknown) => void;
export class RunFailure extends Error {
  constructor(
    public terminal: Terminal,
    message: string,
  ) {
    super(message);
  }
}
export const same = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("id") === b.trim().toLocaleLowerCase("id");
