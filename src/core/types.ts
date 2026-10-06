export type Policy = "Baseline" | "Proposed";
export type EvidenceState = "SATISFIED" | "REFUTED" | "UNKNOWN";
export type ControlKind = "link" | "button" | "textbox" | "combobox";

export type ConstraintSpec = {
  id: string;
  description: string;
  required: boolean;
  hints: string[];
};

export type EvidenceFact = {
  subject: string;
  constraint: string;
  state: Exclude<EvidenceState, "UNKNOWN">;
  value?: unknown;
  source: string;
  observation_id: string;
  step: number;
  timestamp: string;
};

export type LedgerCell = {
  state: EvidenceState;
  sources: EvidenceFact[];
};

export type Ledger = Record<string, Record<string, LedgerCell>>;

export type AccessibleControl = {
  id: string;
  role: ControlKind;
  name: string;
  url?: string;
};

export type Probe = {
  id: string;
  subject: string;
  label: string;
  control: AccessibleControl;
  may_answer: string[];
  forward_cost: number;
  order: number;
};

export type PlannerScores = Record<string, number>;
