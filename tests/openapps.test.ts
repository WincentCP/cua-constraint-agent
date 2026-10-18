import test from "node:test";
import assert from "node:assert/strict";
import { pocTasks, requirePocTask, requireLoopbackUrl } from "../src/openapps/manifest.ts";
import { makePrompt, pendingPublicSubmissions, publicSubmissionKind, SHARED_SYSTEM_PROMPT } from "../src/openapps/runner.ts";
import { assertOfficialScore, assertPublicGoal, classifyEpisodeScore } from "../src/openapps/bridge.ts";
import { parseAgentPlan } from "../src/agent/ollama.ts";

test("only three distinct, public-goal PoC tasks are registered", () => {
  assert.equal(pocTasks.length, 3);
  assert.equal(new Set(pocTasks.map(x => x.key)).size, 3);
  assert(pocTasks.every(x => x.constraints.length >= 3));
  assert(pocTasks.every(x => new Set(x.constraints.map(c=>c.id)).size === x.constraints.length));
  assert.throws(() => requirePocTask("conference_trip_setup"), /Unregistered/);
});

test("loopback-only origin enforced", () => {
  assert.equal(requireLoopbackUrl("http://localhost:5001"), "http://localhost:5001/");
  assert.throws(() => requireLoopbackUrl("https://example.com"));
  assert.throws(() => requireLoopbackUrl("http://192.168.1.2:5001"));
  assert.throws(() => requireLoopbackUrl("http://localhost:5001?token=a"));
});

test("treatment remains outside shared prompt and evaluator answers never enter prompt", () => {
  const c = requirePocTask("reconcile_the_largest_account").constraints;
  const prompt = makePrompt("Find largest account balance", "- button \"OpenBanking\"",
    c, [], 1, 16, Object.fromEntries(c.map(x=>[x.id,"UNKNOWN"])));
  assert(!prompt.includes("24310.55"));
  assert(!prompt.includes("BUS SELECT SAVINGS"));
  assert(!prompt.includes("Proposed"));
  assert(!prompt.includes("Baseline"));
  assert(!SHARED_SYSTEM_PROMPT.includes("Proposed"));
  assert(!SHARED_SYSTEM_PROMPT.includes("Baseline"));
});

test("official reward adapter rejects model-claimed success and malformed results", () => {
  assert.equal(assertOfficialScore({ evaluator:"OpenApps Task.check_if_task_is_complete",
    reward:1,success:true }), 1);
  assert.throws(() => assertOfficialScore({evaluator:"model",reward:1,success:true}));
  assert.throws(() => assertOfficialScore({evaluator:"OpenApps Task.check_if_task_is_complete",
    reward:0,success:true}));
  assert.equal(assertPublicGoal({ goal:"Inspect bank ledger" }),"Inspect bank ledger");
});


test("model UNKNOWN and blank evidence are discarded without inventing facts", () => {
  const plan = parseAgentPlan(JSON.stringify({
    progress_scores: { "link:0:OpenBanking": 8 },
    input_text_by_probe: {},
    evidence: [
      { constraint_id: "account", state: "SATISFIED", quote: "OpenBanking" },
      { constraint_id: "amount", state: "UNKNOWN", quote: "" },
      { constraint_id: "todo", state: "UNKNOWN", quote: "" },
      { constraint_id: "missing", state: "REFUTED", quote: "" },
    ],
    finish: false,
    rationale: "Inspect first; cannot infer bank values yet",
  }));
  assert.equal(plan.evidence.length, 1);
  assert.deepEqual(plan.evidence[0], {
    constraint_id: "account", state: "SATISFIED", quote: "OpenBanking",
  });
  assert.equal(plan.progress_scores["link:0:OpenBanking"], 8);
  assert.equal(plan.finish, false);
  assert.throws(() => parseAgentPlan(JSON.stringify({
    progress_scores: {}, input_text_by_probe: {}, evidence: [
      { constraint_id: "x", state: "HALLUCINATED", quote: "fake" },
    ], finish: false, rationale: "",
  })));
});

test("invalid runner episodes never count as negative task outcomes", () => {
  const scored = { evaluator: "OpenApps Task.check_if_task_is_complete",
    reward: 0, success: false };
  assert.deepEqual(classifyEpisodeScore(scored, "invalid JSON evidence"), {
    officialSuccess: null,
    diagnosticReward: 0,
  });
  assert.deepEqual(classifyEpisodeScore(scored, null), {
    officialSuccess: false,
    diagnosticReward: null,
  });
  assert.deepEqual(classifyEpisodeScore({ ...scored, reward: 1, success: true }, "crash"), {
    officialSuccess: null,
    diagnosticReward: 1,
  });
});


test("a claim of completion cannot substitute for actual public UI submissions", () => {
  const constraints = requirePocTask("add_todo_to_review_largest_card_charge").constraints;
  assert.deepEqual(pendingPublicSubmissions(constraints, new Set()), ["todo"]);
  assert.deepEqual(pendingPublicSubmissions(constraints, new Set(["todo"])), []);
  assert.equal(publicSubmissionKind("http://localhost:5001/openbanking", "button", "click"), null);
  assert.equal(publicSubmissionKind("http://localhost:5001/todo", "textbox", "fill-and-enter"), "todo");
  assert.equal(publicSubmissionKind("http://localhost:5001/messages", "textbox", "fill-and-enter"), "message");
  assert.equal(publicSubmissionKind("http://localhost:5001/todo", "button", "click"), null);
  const prompt = JSON.parse(makePrompt("Add a todo", "- textbox \"New Todo\"",
    constraints, [], 2, 16, {}, new Set()));
  assert.deepEqual(prompt.unattempted_required_ui_submissions, ["todo"]);
  assert(!JSON.stringify(prompt).includes("1078.81"));
  const composite = requirePocTask("reconcile_the_largest_account").constraints;
  assert.deepEqual(pendingPublicSubmissions(composite, new Set(["todo"])), ["message"]);
});
