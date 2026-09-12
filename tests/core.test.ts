import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "../src/core/config.ts";
import {
  fields,
  emptyCounters,
  type Fact,
  type Probe,
  type Event,
} from "../src/core/types.ts";
import { Evidence, satisfied } from "../src/core/evidence.ts";
import { selectProbe } from "../src/core/policy.ts";
import {
  mainTasks,
  developmentTasks,
  validateDataset,
  feasibleProducts,
} from "../src/environment/dataset.ts";
import { manifest, taskMetadata } from "../src/experiment/manifest.ts";
import {
  calculateMetrics,
  selectedPairs,
  type Row,
} from "../src/experiment/metrics.ts";
import {
  failedOutcome,
  rerunCells,
  type Experiment,
} from "../src/experiment/runner.ts";
import { sharedInput, scoreProbes, DemoModel } from "../src/agent/planner.ts";
import { observationFrom } from "../src/browser/semantic.ts";
import { Driver } from "../src/browser/session.ts";
import { csv } from "../src/experiment/metrics.ts";

const goal = developmentTasks[0].goal,
  candidates = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
const fact = (
  constraint: Fact["constraint"],
  value: Fact["value"],
  source = "test",
): Fact => ({
  candidate: "a",
  constraint,
  value,
  source,
  observation: "obs-1",
  step: 0,
  timestamp: new Date().toISOString(),
});
test("32 main tasks, exact composition, U2/U3/U4 and disjoint development split", () => {
  assert.equal(validateDataset().passed, true);
  assert.equal(mainTasks.length, 32);
  assert.equal(manifest("main").length, 64);
  assert.deepEqual(
    [2, 3, 4].map((n) => mainTasks.filter((t) => t.unknown === n).length),
    [11, 10, 11],
  );
  for (const t of mainTasks) {
    assert.equal(t.initial.length, 4 - t.unknown);
    assert.equal(t.products.length, 3);
    assert(!developmentTasks.some((d) => d.id === t.id));
  }
  assert.equal(mainTasks.filter((t) => t.type === "solvable").length, 16);
  assert.equal(mainTasks.filter((t) => t.type === "no-solution").length, 8);
  assert.equal(
    mainTasks.filter((t) => t.type === "unavailable-evidence").length,
    8,
  );
  assert.equal(
    mainTasks.filter((t) => feasibleProducts(t).length === 2).length,
    8,
  );
  const positions = new Set(
    mainTasks
      .filter((t) => t.subtype === "single-feasible")
      .map((t) => t.products.indexOf(feasibleProducts(t)[0])),
  );
  assert.equal(positions.size, 3);
  for (const t of mainTasks)
    for (const p of t.products)
      assert(
        !/correct|answer|oracle|solvable|unknown|U[234]/i.test(
          p.id + " " + p.name,
        ),
      );
  const m = manifest("main");
  assert.deepEqual(m, manifest("main"));
  for (const t of mainTasks)
    assert.deepEqual(
      m
        .filter((c) => c.base === t.id)
        .map((c) => c.policy)
        .sort(),
      ["Baseline", "Proposed"],
    );
  assert(m.some((c, i) => i % 2 === 0 && c.policy === "Baseline"));
  assert(m.some((c, i) => i % 2 === 0 && c.policy === "Proposed"));
});
test("UNKNOWN, conflicts, null values and wrong-variant facts cannot satisfy ACT", () => {
  const e = new Evidence();
  assert(!satisfied(e.ledger(candidates, goal), "a"));
  e.add([fact("material", goal.material)]);
  assert.equal(e.ledger(candidates, goal).a.material.state, "SATISFIED");
  e.add([fact("material", "polyester", "conflicting source")]);
  assert.equal(e.ledger(candidates, goal).a.material.state, "UNKNOWN");
  e.add([
    { ...fact("price", 1), scope: { size: "impossible", color: goal.color } },
    fact("availability", null),
  ]);
  assert.equal(e.ledger(candidates, goal).a.price.state, "UNKNOWN");
  assert.equal(e.ledger(candidates, goal).a.availability.state, "UNKNOWN");
});
test("Proposed ranks UNKNOWN coverage then cost then stable order, ignoring generic scores", () => {
  const e = new Evidence();
  e.add([fact("material", goal.material)]);
  const ledger = e.ledger(candidates, goal);
  const probe = (
    id: string,
    may_answer: Probe["may_answer"],
    cost: number,
    order: number,
    candidate = "a",
  ): Probe => ({
    id,
    url: id,
    candidate,
    name: id,
    may_answer,
    forward_cost: cost,
    action_cost: cost,
    order,
  });
  const p = [
    probe("known", ["material"], 1, 0),
    probe("single", ["price"], 1, 1),
    probe("costly", ["price", "availability"], 3, 2),
    probe("best", ["price", "availability"], 1, 3),
    probe("tie", ["price", "availability"], 1, 4),
  ];
  assert.equal(selectProbe("Proposed", p, ledger, { known: 100 }).id, "best");
  assert.equal(
    selectProbe("Baseline", p, ledger, {
      known: 100,
      single: 2,
      costly: 3,
      best: 4,
      tie: 5,
    }).id,
    "known",
  );
  assert.equal(
    selectProbe("Baseline", [p[4]], ledger, {}).id,
    selectProbe("Proposed", [p[4]], ledger, {}).id,
  );
});
test("Both conditions receive identical full public input; annotation alone adds no facts", () => {
  const snapshot =
    '- main:\n  - group "A":\n    - link "Varian dan bahan A":\n      - /url: /product/a\n';
  const o = observationFrom(snapshot, "/", [], 0, "o1"),
    e = new Evidence(),
    ledger = e.ledger(o.candidates, goal),
    p: Probe[] = [
      {
        id: "/product/a",
        url: "/product/a",
        candidate: "a",
        name: "Varian dan bahan A",
        may_answer: ["variant", "material"],
        forward_cost: 1,
        action_cost: 1,
        order: 0,
      },
    ];
  const a = sharedInput(goal, o, ledger, p, [], {}),
    b = sharedInput(goal, o, ledger, p, [], {});
  assert.deepEqual(a, b);
  assert.deepEqual(Object.keys(a.evidence.a), [...fields]);
  assert.equal(o.facts.length, 0);
  assert(!JSON.stringify(a).includes("feasible"));
  assert(!("policy" in a));
});
test("Schema repair is bounded, records calls, and rejects invented IDs", async () => {
  const o = observationFrom("- main: []", "/", candidates, 0, "o"),
    e = new Evidence(),
    probe: Probe = {
      id: "p",
      url: "p",
      candidate: "a",
      name: "Harga",
      may_answer: ["price"],
      forward_cost: 1,
      action_cost: 1,
      order: 0,
    },
    input = sharedInput(goal, o, e.ledger(candidates, goal), [probe], [], {}),
    counters = emptyCounters();
  await assert.rejects(
    scoreProbes(
      {
        demo: true,
        complete: async () => ({
          text: '{"scores":[{"probe_id":"invented","progress":50}]}',
          input_tokens: 1,
          output_tokens: 1,
        }),
      },
      input,
      counters,
      config,
      new AbortController().signal,
      () => {},
    ),
    /structured_output_failure/,
  );
  assert.equal(counters.model_calls, 2);
  assert.equal(counters.recoveries, 1);
  assert.equal(counters.invalid_outputs, 2);
  const good = await scoreProbes(
    new DemoModel(),
    input,
    emptyCounters(),
    config,
    new AbortController().signal,
    () => {},
  );
  assert.equal(typeof good.p, "number");
});
function row(
  base: string,
  policy: "Baseline" | "Proposed",
  vda: 0 | 1 | null,
  probes: number,
  attempt = 0,
): Row {
  return {
    id: `${base}:${policy}:${attempt}`,
    experiment_id: "x",
    config_hash: "x",
    demo: true,
    cell: { base, policy, pair: `${base}:r1`, repeat: 1 },
    task: { ...taskMetadata(developmentTasks[0]), base },
    attempt,
    rerun_reason: null,
    replaces: [],
    outcome: failedOutcome("fixture"),
    events: [],
    final_world: null,
    evaluation: {
      outcome:
        vda === null
          ? "INFRASTRUCTURE_FAILURE"
          : vda === 1
            ? "VERIFIED_ACT_SUCCESS"
            : "BUDGET_EXHAUSTED",
      vda,
      probe_count: probes,
      budget_exhausted: vda === 0,
      final_effect_correct: null,
      evidence_complete_before_act: null,
      public_refutations: [],
      detail: "",
    },
  };
}
test("VDA includes healthy failures; probe efficiency excludes failed/unpaired tasks; reruns preserve earliest healthy pair", () => {
  const rows = [
    row("a", "Baseline", 1, 6),
    row("a", "Proposed", 1, 4),
    row("b", "Baseline", 0, 1),
    row("b", "Proposed", 1, 4),
    row("c", "Baseline", null, 0),
    row("c", "Proposed", 1, 3),
    row("c", "Baseline", 1, 5, 1),
    row("c", "Proposed", 1, 5, 1),
  ];
  const plan = rows.filter((r) => r.attempt === 0).map((r) => r.cell),
    metrics = calculateMetrics(rows, plan);
  assert.equal(metrics.accuracy[0].vda, 2 / 3);
  assert.equal(metrics.infrastructure_failures, 1);
  assert.equal(metrics.efficiency[0].jointly_correct_pairs, 2);
  assert.equal(metrics.efficiency[0].delta_probe.median, -1);
  assert.equal(metrics.selected_pairs[2].attempt, 1);
  const exp = { plan } as Experiment;
  assert.throws(
    () => rerunCells(rows, exp, "b:r1", "bad performance"),
    /Healthy/,
  );
  assert.throws(() => rerunCells(rows, exp, "c:r1", "again"), /Healthy/);
  const original = rows.filter((r) => r.attempt === 0);
  assert.equal(
    rerunCells(original, exp, "c:r1", "model server down").cells.length,
    2,
  );
  assert.throws(() => selectedPairs([...rows, rows[0]], plan), /Duplicate/);
});
test("Agent dependency graph cannot reach private environment or evaluator", () => {
  const seen = new Set<string>();
  function visit(path: string) {
    if (seen.has(path)) return;
    seen.add(path);
    const code = readFileSync(path, "utf8");
    assert(
      !/from\s+['"][^'"]*(environment|evaluation|experiment)\//.test(code),
      path,
    );
    assert(!/\bfetch\(/.test(code) || path.endsWith("planner.ts"), path);
    for (const m of code.matchAll(/from\s+['"]([^'"]+)['"]/g))
      if (m[1].startsWith(".")) visit(join(path, "..", m[1]));
  }
  visit(join(process.cwd(), "src", "agent", "run.ts"));
});

test("Concurrent browser shutdown callers await the same completed cleanup", async () => {
  let release!: () => void;
  let calls = 0;
  const closed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const server = {
    close: () => {
      calls++;
      return closed;
    },
    kill: async () => {},
  };
  const driver = new Driver(null as any, null as any, server as any, () => {});
  const first = driver.close(),
    second = driver.close();
  assert.equal(first, second);
  let done = false;
  void second.then(() => {
    done = true;
  });
  await Promise.resolve();
  assert.equal(done, false);
  release();
  await second;
  assert.equal(done, true);
  assert.equal(calls, 1);
});

test("CSV retains numeric negative probe deltas and quotes untrusted text", () => {
  const output = csv([{ delta: -2, reason: "=SUM(A1)", note: 'a,"b"' }]);
  assert(output.includes('"-2"'));
  assert(!output.includes("'-2"));
  assert(output.includes("'=SUM(A1)"));
  assert(output.includes('"a,""b"""'));
});
