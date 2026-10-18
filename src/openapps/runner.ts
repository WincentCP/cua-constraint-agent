import type { Page } from "playwright";
import { EvidenceStore } from "../core/evidence.ts";
import { selectProbe } from "../core/policy.ts";
import type { ConstraintSpec, Policy, Probe } from "../core/types.ts";
import { extractControls, probesFromControls } from "../browser/accessibility.ts";
import { parseAgentPlan, type ModelClient } from "../agent/ollama.ts";

export type DevRunStats = { steps: number; actions: number; modelCalls: number;
  modelFinished: boolean; lastPageUrl: string };
export type TraceEvent = Record<string, unknown>;

export const SHARED_SYSTEM_PROMPT = [
  "You operate ONLY the visible public OpenApps browser UI.",
  "Use the task goal and Accessibility Tree, not hidden data, evaluator code, or filesystem.",
  "Return one JSON object with: progress_scores (probe ID -> forward progress 0..10),",
  "input_text_by_probe (textbox/combobox ID -> user-visible text),",
  "evidence (array of {constraint_id,state:'SATISFIED'|'REFUTED',quote}),",
  "finish (boolean), rationale (short string).",
  "Score all listed candidate probes. Do not pick the action: the controller selects it.",
  "Evidence quotes must be EXACT text visible in the current Accessibility Tree.",
  "Only finish when you believe the goal has been completed; official evaluation is external.",
].join("\n");

export function makePrompt(goal: string, snapshot: string, constraints: ConstraintSpec[],
  probes: Probe[], step: number, budget: number, ledger: Record<string, string>) {
  return JSON.stringify({
    public_goal: goal,
    previous_model_observed_states: ledger,
    step, max_steps: budget,
    visible_accessibility_tree: snapshot.slice(0, 14000),
    public_constraints: constraints.map(c => ({ id: c.id, description: c.description })),
    candidate_probes: probes.map(p => ({ id: p.id, role: p.control.role,
      label: p.label, possible_public_constraint_relevance: p.may_answer })),
  });
}

export async function performProbe(page: Page, probe: Probe, input?: string) {
  const c = probe.control;
  const loc = c.name
    ? page.getByRole(c.role, { name: c.name, exact: true }).first()
    : page.getByRole(c.role).first();
  if (c.role === "textbox") {
    if (!input?.trim()) throw new Error("Model must supply textbox content");
    await loc.fill(input);
    await loc.press("Enter");
    return "fill-and-enter";
  }
  if (c.role === "combobox") {
    if (!input?.trim()) throw new Error("Model must supply combobox option");
    await loc.selectOption({ label: input }, { timeout: 4500 });
    return "select-option";
  }
  await loc.click({ timeout: 10000 });
  return "click";
}

export async function runDevelopmentLoop(opts: {
  page: Page; model: ModelClient; policy: Policy; goal: string;
  constraints: ConstraintSpec[]; budget: number;
  record: (entry: TraceEvent) => void;
  saveSnapshot: (step: number, snapshot: string) => void;
}) : Promise<DevRunStats> {
  if (!Number.isInteger(opts.budget) || opts.budget < 1 || opts.budget > 60)
    throw new Error("Invalid browser decision budget");
  const store = new EvidenceStore();
  const visited = new Set<string>();
  const stats: DevRunStats = { steps: 0, actions: 0, modelCalls: 0,
    modelFinished: false, lastPageUrl: opts.page.url() };
  for (let step = 1; step <= opts.budget; step++) {
    stats.steps = step;
    const snapshot = await opts.page.locator("body").ariaSnapshot();
    opts.saveSnapshot(step, snapshot);
    const probes = probesFromControls(extractControls(snapshot), opts.constraints)
      .slice(0, 40).filter(p => !visited.has(opts.page.url() + "::" + p.id));
    const prior = store.ledger(["task"], opts.constraints);
    const states = Object.fromEntries(opts.constraints.map(c =>
      [c.id, prior.task[c.id].state]));
    stats.modelCalls++;
    const raw = await opts.model.complete(SHARED_SYSTEM_PROMPT,
      makePrompt(opts.goal, snapshot, opts.constraints, probes, step, opts.budget, states));
    const plan = parseAgentPlan(raw);
    const normalized = snapshot.toLowerCase().replace(/\s+/g, " ");
    const accepted = plan.evidence.filter(e =>
      opts.constraints.some(c => c.id === e.constraint_id) &&
      e.quote.trim().length > 2 &&
      normalized.includes(e.quote.toLowerCase().replace(/\s+/g, " ").trim()));
    store.add(accepted.map(e => ({
      subject: "task", constraint: e.constraint_id, state: e.state,
      value: { visible_quote: e.quote }, source: opts.page.url(),
      observation_id: "aria-" + step, step, timestamp: new Date().toISOString(),
    })));
    const entry: TraceEvent = {
      at: new Date().toISOString(), step, method: opts.policy,
      url: opts.page.url(), control_count: probes.length,
      candidates: probes.map(p => ({ id: p.id, label: p.label, may_answer: p.may_answer })),
      model_progress: plan.progress_scores, diagnostic_evidence_only: accepted,
      rationale: plan.rationale,
    };
    if (plan.finish) {
      stats.modelFinished = true;
      opts.record({ ...entry, event: "MODEL_FINISH", official_success: null });
      break;
    }
    if (!probes.length) throw new Error("No unattempted accessible controls");
    const chosen = selectProbe(opts.policy, probes, store.ledger(["task"], opts.constraints),
      plan.progress_scores);
    visited.add(opts.page.url() + "::" + chosen.id);
    const action = await performProbe(opts.page, chosen, plan.input_text_by_probe[chosen.id]);
    stats.actions++;
    stats.lastPageUrl = opts.page.url();
    opts.record({ ...entry, event: "DECISION", selected: chosen.id, action });
  }
  stats.lastPageUrl = opts.page.url();
  return stats;
}
