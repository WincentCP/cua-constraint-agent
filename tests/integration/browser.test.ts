import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DemoModel } from "../../src/agent/planner.ts";
import { config } from "../../src/core/config.ts";
import { fields, type Event, type AgentOutcome } from "../../src/core/types.ts";
import {
  mainTasks,
  developmentTasks,
  feasibleProducts,
} from "../../src/environment/dataset.ts";
import { openWorld } from "../../src/environment/world.ts";
import { openBrowser } from "../../src/browser/session.ts";
import { Evidence } from "../../src/core/evidence.ts";
import {
  episode,
  failedOutcome,
  createExperiment,
  durableAppend,
  recoverInterrupted,
  recordRun,
  exportResults,
} from "../../src/experiment/runner.ts";
import { manifest } from "../../src/experiment/manifest.ts";
import { evaluate } from "../../src/evaluation/oracle.ts";
import { writeReport } from "../../src/experiment/report.ts";

test("Real Accessibility Tree has exact U-levels and public-only facts for all 32 tasks", async () => {
  for (const task of mainTasks) {
    const world = await openWorld(task),
      events: Event[] = [],
      driver = await openBrowser(
        world.origin,
        world.secret,
        (type, data) =>
          events.push({
            seq: events.length + 1,
            type,
            data,
            timestamp: new Date().toISOString(),
          }),
        () => {},
      );
    try {
      const o = await driver.observe(0),
        ledger = new Evidence();
      ledger.add(o.facts);
      const state = ledger.ledger(o.candidates, task.goal);
      assert.equal(o.candidates.length, 3);
      for (const c of o.candidates)
        assert.equal(
          fields.filter((k) => state[c.id][k].state === "UNKNOWN").length,
          task.unknown,
          task.id,
        );
      assert(
        !/withheld|feasible|oracle|expected_terminal|unknown_level/.test(
          JSON.stringify(o),
        ),
      );
      for (const fact of o.facts)
        assert(task.initial.includes(fact.constraint));
    } finally {
      await driver.close();
      await world.close();
    }
  }
});
test("All 64 deterministic engineering runs achieve the specified outcomes with isolated browser/world state", async () => {
  for (const cell of manifest("main")) {
    const task = mainTasks.find((t) => t.id === cell.base)!,
      r = await episode(task, cell, new DemoModel());
    assert.equal(
      r.evaluation.vda,
      1,
      `${cell.base}/${cell.policy}: ${r.evaluation.outcome} ${r.outcome.detail}`,
    );
    assert.equal(
      r.evaluation.outcome,
      task.type === "solvable"
        ? "VERIFIED_ACT_SUCCESS"
        : task.type === "no-solution"
          ? "CORRECT_NO_SOLUTION"
          : "CORRECT_INSUFFICIENT_EVIDENCE",
    );
    assert.equal(r.evaluation.probe_count, r.outcome.counters.probes);
    assert(r.events.some((e) => e.type === "AGENT_FROZEN"));
    if (task.type === "solvable") {
      assert.equal(r.outcome.verification, "PASS");
      assert.equal((r.final_world as any).cart.length, 1);
      assert.equal(r.events.filter((e) => e.type === "ACT_INTENT").length, 1);
    }
  }
});
test("Independent oracle rejects coincidental success and validates evidence before ACT rather than after", async () => {
  const task = developmentTasks.find(
      (t) => t.subtype === "single-feasible" && t.unknown === 4,
    )!,
    cell = {
      base: task.id,
      policy: "Baseline" as const,
      pair: "test",
      repeat: 1,
    };
  const r = await episode(task, cell, new DemoModel());
  assert.equal(r.evaluation.vda, 1);
  const late = evaluate(
    r.final_world,
    { ...r.outcome, terminal: "BUDGET_EXHAUSTED" },
    r.events,
    true,
  );
  assert.equal(late.outcome, "BUDGET_EXHAUSTED");
  assert.equal(late.vda, 0);
  const misdirected = structuredClone(r.events);
  misdirected.find((e) => e.type === "ACT_INTENT")!.data.control.candidate =
    "different-product";
  assert.equal(
    evaluate(r.final_world, r.outcome, misdirected, true).outcome,
    "WRONG_ACT",
  );
  const stripped = r.events.filter((e) => e.type !== "OBSERVATION");
  assert.equal(
    evaluate(r.final_world, r.outcome, stripped, true).outcome,
    "UNDERVERIFIED_ACT",
  );
  const post = [
    ...stripped,
    ...r.events
      .filter((e) => e.type === "OBSERVATION")
      .map((e, i) => ({ ...e, seq: 1000 + i })),
  ];
  assert.equal(
    evaluate(r.final_world, r.outcome, post, true).outcome,
    "UNDERVERIFIED_ACT",
  );
  const wrong = structuredClone(r.final_world);
  wrong.cart[0].price += 1;
  assert.equal(evaluate(wrong, r.outcome, r.events, true).outcome, "WRONG_ACT");
  assert.equal(
    evaluate(r.final_world, r.outcome, r.events, false).outcome,
    "INFRASTRUCTURE_FAILURE",
  );
  const world = structuredClone(r.final_world);
  world.closed = false;
  assert.throws(
    () => evaluate(world, r.outcome, r.events, true),
    /frozen world/,
  );
});
test("False success UI, incorrect prices, and missing cart effects never become success or repeated adds", async () => {
  const task = developmentTasks[0],
    cell = {
      base: task.id,
      policy: "Proposed" as const,
      pair: "fault",
      repeat: 1,
    };
  for (const fault of ["false-toast", "fake-cart", "wrong-price"] as const) {
    const result = await episode(task, cell, new DemoModel(), config, {
      fault,
    });
    assert.equal(result.evaluation.vda, 0, fault);
    assert.equal(
      result.events.filter((e) => e.type === "ACT_INTENT").length,
      1,
      fault,
    );
  }
});
test("Healthy budget exhaustion remains a failure and model outages remain infrastructure failures", async () => {
  const task = developmentTasks[2],
    cell = {
      base: task.id,
      policy: "Baseline" as const,
      pair: "budget",
      repeat: 1,
    };
  const limited = structuredClone(config);
  limited.budget.probes = 1;
  const r = await episode(task, cell, new DemoModel(), limited);
  assert.equal(r.evaluation.outcome, "BUDGET_EXHAUSTED");
  assert.equal(r.evaluation.vda, 0);
  const noCalls = structuredClone(config);
  noCalls.budget.model_calls = 0;
  assert.equal(
    (await episode(task, cell, new DemoModel(), noCalls)).evaluation.outcome,
    "BUDGET_EXHAUSTED",
  );
  const abort = new AbortController();
  abort.abort();
  assert.equal(
    (
      await episode(task, cell, new DemoModel(), config, {
        signal: abort.signal,
      })
    ).evaluation.outcome,
    "INFRASTRUCTURE_FAILURE",
  );
});
test("Abstention needs public refutations/unavailability; agent claims alone do not count", async () => {
  for (const type of ["no-solution", "unavailable-evidence"]) {
    const task = developmentTasks.find((t) => t.type === type)!,
      cell = {
        base: task.id,
        policy: "Proposed" as const,
        pair: "abstain",
        repeat: 1,
      },
      r = await episode(task, cell, new DemoModel());
    assert.equal(r.evaluation.vda, 1);
    assert.equal(
      evaluate(
        r.final_world,
        r.outcome,
        r.events.filter((e) => e.type !== "OBSERVATION"),
        true,
      ).outcome,
      "FALSE_ABSTENTION",
    );
  }
});
test("Durable recorder recovers interrupted attempts without erasing originals", async () => {
  const parent = mkdtempSync(join(tmpdir(), "cua-final-test-")),
    out = join(parent, "run");
  try {
    const plan = manifest("development").slice(0, 2),
      experiment = createExperiment(out, "development", true, plan, {
        test: true,
      });
    durableAppend(join(out, "journal.jsonl"), {
      type: "ATTEMPT_STARTED",
      id: "interrupted",
      cell: plan[0],
      attempt: 0,
      rerun_reason: null,
      replaces: [],
    });
    const rows = recoverInterrupted(out, experiment);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].evaluation.vda, null);
    assert.equal(recoverInterrupted(out, experiment).length, 1);
    const recorded = await recordRun(out, experiment, plan[1], new DemoModel());
    const shots = recorded.events.filter((e) => e.type === "SCREENSHOT");
    assert(shots.length > 0);
    assert.equal(
      recorded.events.filter((e) => e.type === "SCREENSHOT_FAILURE").length,
      0,
    );
    assert.equal(
      readFileSync(join(out, shots[0].data.path))
        .subarray(0, 8)
        .toString("hex"),
      "89504e470d0a1a0a",
    );
    for (const call of recorded.events.filter((e) => e.type === "MODEL_CALL"))
      assert(!JSON.stringify(call.data.input).includes("screenshots/"));
    const report = writeReport(out);
    assert(existsSync(report.html));
    assert(
      readFileSync(report.markdown, "utf8").includes(
        "DEMO — BUKAN HASIL PENELITIAN",
      ),
    );
    const metrics = exportResults(out);
    assert.equal(metrics.infrastructure_failures, 1);
    assert.equal(metrics.selected_valid_pairs, 0);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
