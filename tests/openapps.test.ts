import test from "node:test";
import assert from "node:assert/strict";
import { pocTasks, requirePocTask, requireLoopbackUrl } from "../src/openapps/manifest.ts";
import { makePrompt, SHARED_SYSTEM_PROMPT } from "../src/openapps/runner.ts";
import { assertOfficialScore, assertPublicGoal } from "../src/openapps/bridge.ts";

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
