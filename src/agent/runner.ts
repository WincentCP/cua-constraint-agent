import type { Page } from "playwright";
import { EvidenceStore } from "../core/evidence.ts";
import { selectProbe } from "../core/policy.ts";
import type { ConstraintSpec, Policy, Probe } from "../core/types.ts";
import { extractControls, probesFromControls } from "../browser/accessibility.ts";
import type { WebArenaTask, WebArenaAgentResponse } from "../webarena/schema.ts";
import { WebArenaAgentResponseSchema } from "../webarena/schema.ts";
import type { RunRecorder } from "../experiment/recorder.ts";
import type { ModelClient } from "./ollama.ts";
import { parseAgentPlan } from "./ollama.ts";

const SYSTEM = [
  "You are a browser agent operating only on the public Shopping website.",
  "Do not assume that a task is solved until you have observed supporting evidence.",
  "Never use evaluator answers, browser internals, hidden DOM, filesystem, or external domains.",
  "Return exactly one JSON object with keys:",
  "progress_scores (map of probe ID to estimated forward progress 0-10),",
  "input_text_by_probe (map from textbox/combobox probe ID to a search phrase or option),",
  "evidence (array of {constraint_id,state:'SATISFIED'|'REFUTED',quote} with an EXACT visible quote),",
  "finish (boolean), final_response (official task response JSON or null), rationale (short string).",
  "Score ALL candidate probes even if you recommend finishing.",
  "For retrieval tasks, final_response.retrieved_data MUST be an array;",
  "for navigation/mutation, use null. Never invent facts.",
  "If unfinished, set finish=false and final_response=null. Do not choose a probe:",
  "the experiment controller will choose from your progress scores and shared candidate list.",
].join("\n");

function validEvidence(
  proposed: Array<{ constraint_id: string; state: "SATISFIED" | "REFUTED"; quote: string }>,
  snapshot: string,
  constraints: ConstraintSpec[],
) {
  const visible = snapshot.toLocaleLowerCase("en-US").replace(/\s+/g, " ");
  const ids = new Set(constraints.map((constraint) => constraint.id));
  return proposed.filter((entry) =>
    ids.has(entry.constraint_id) &&
    entry.quote.trim().length >= 3 &&
    visible.includes(entry.quote.toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim()),
  );
}

function userPrompt(
  task: WebArenaTask,
  snapshot: string,
  constraints: ConstraintSpec[],
  probes: Probe[],
  step: number,
  maxSteps: number,
) {
  return JSON.stringify({
    task_intent: task.intent,
    current_step: step,
    action_budget: maxSteps,
    observable_accessibility_tree: snapshot.slice(0, 14_000),
    public_requirements: constraints.map((c) => ({ id: c.id, description: c.description })),
    eligible_probes: probes.map((p) => ({
      id: p.id,
      label: p.label,
      role: p.control.role,
      may_answer: p.may_answer,
    })),
    // Method is deliberately excluded: both conditions use this same model prompt.
  });
}

async function executeProbe(page: Page, probe: Probe, input?: string) {
  const control = probe.control;
  const locator = control.name
    ? page.getByRole(control.role, { name: control.name, exact: true }).first()
    : page.getByRole(control.role).first();
  if (control.role === "textbox") {
    if (!input?.trim()) throw new Error("Model did not provide input for textbox");
    await locator.fill(input);
    await locator.press("Enter");
    return "fill-and-enter";
  }
  if (control.role === "combobox") {
    if (!input?.trim()) throw new Error("Model did not provide an option for combobox");
    try {
      await locator.selectOption({ label: input }, { timeout: 4_000 });
      return "select-option";
    } catch {
      await locator.fill(input);
      await locator.press("Enter");
      return "fill-combobox";
    }
  }
  await locator.click({ timeout: 10_000 });
  return "click";
}

export type RunnerStats = {
  steps: number;
  actions: number;
  probes: number;
  model_calls: number;
  claimed_success: boolean;
};

export async function runAgentLoop(options: {
  page: Page;
  task: WebArenaTask;
  model: ModelClient;
  policy: Policy;
  constraints: ConstraintSpec[];
  recorder: RunRecorder;
  maxSteps: number;
  screenshotLimit?: number;
  onProgress?: (stats: RunnerStats) => void;
}): Promise<{ response: WebArenaAgentResponse; stats: RunnerStats }> {
  const { page, task, model, policy, constraints, recorder, maxSteps } = options;
  const screenshotLimit = options.screenshotLimit ?? 3;
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 60) {
    throw new Error("maxSteps must be from 1 to 60");
  }
  if (task.start_urls.length !== 1) {
    throw new Error("Development runner currently handles only single-start-URL Shopping tasks");
  }
  const evidence = new EvidenceStore();
  const attempted = new Set<string>();
  const stats: RunnerStats = { steps: 0, actions: 0, probes: 0, model_calls: 0, claimed_success: false };
  let screenshotsTaken = 0;
  await recorder.screenshot(page, "initial.png");

  for (let step = 1; step <= maxSteps; step++) {
    stats.steps = step;
    const url = page.url();
    const snapshot = await page.locator("body").ariaSnapshot();
    const observation = recorder.accessibility(step, snapshot);
    const probes = probesFromControls(extractControls(snapshot), constraints).slice(0, 40)
      .filter((probe) => !attempted.has(url + "::" + probe.id));
    stats.model_calls++;
    const raw = await model.complete(
      SYSTEM,
      userPrompt(task, snapshot, constraints, probes, step, maxSteps),
    );
    const plan = parseAgentPlan(raw);
    const accepted = validEvidence(plan.evidence, snapshot, constraints);
    evidence.add(accepted.map((item) => ({
      subject: "task",
      constraint: item.constraint_id,
      state: item.state,
      value: { visible_quote: item.quote },
      source: url,
      observation_id: "aria-step-" + step,
      step,
      timestamp: new Date().toISOString(),
    })));
    const ledger = evidence.ledger(["task"], constraints);
    const states = Object.fromEntries(
      constraints.map((constraint) => [
        constraint.id,
        ledger.task?.[constraint.id]?.state ?? "UNKNOWN",
      ]),
    );
    if (plan.finish) {
      const response = WebArenaAgentResponseSchema.parse(plan.final_response);
      stats.claimed_success = response.status === "SUCCESS";
      recorder.decision({
        event: "FINAL", at: new Date().toISOString(), step,
        page_url: url, observation_file: observation, screenshot_file: null,
        constraints: states, eligible_probe_ids: probes.map((probe) => probe.id),
        progress_scores: plan.progress_scores,
        selected_probe_id: null, selected_probe_label: null,
        model_rationale: plan.rationale,
        action: "final-response", evidence_updates: accepted,
      });
      options.onProgress?.({ ...stats });
      return { response, stats };
    }
    if (!probes.length) throw new Error("No eligible controls left; task unfinished");
    const selected = selectProbe(policy, probes, ledger, plan.progress_scores);
    attempted.add(url + "::" + selected.id);
    stats.probes++;

    let screenshot: string | null = null;
    if (selected.may_answer.length && screenshotsTaken < screenshotLimit) {
      screenshotsTaken++;
      screenshot = await recorder.screenshot(
        page,
        "decision-" + String(screenshotsTaken).padStart(4, "0") + ".png",
      );
    }
    const action = await executeProbe(page, selected, plan.input_text_by_probe[selected.id]);
    stats.actions++;
    recorder.decision({
      event: "DECISION", at: new Date().toISOString(), step,
      page_url: url, observation_file: observation, screenshot_file: screenshot,
      constraints: states, eligible_probe_ids: probes.map((probe) => probe.id),
      progress_scores: plan.progress_scores,
      selected_probe_id: selected.id, selected_probe_label: selected.label,
      model_rationale: plan.rationale, action, evidence_updates: accepted,
    });
    options.onProgress?.({ ...stats });
  }
  throw new Error("Action budget exhausted without a valid terminal response");
}
