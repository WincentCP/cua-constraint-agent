import test from "node:test";
import assert from "node:assert/strict";
import {
  EvidenceStore,
  requiredEvidenceComplete,
} from "../src/core/evidence.ts";
import { selectProbe } from "../src/core/policy.ts";
import type { ConstraintSpec, Probe } from "../src/core/types.ts";

const constraints: ConstraintSpec[] = [
  { id: "a", description: "A", required: true, hints: ["a"] },
  { id: "b", description: "B", required: true, hints: ["b"] },
  { id: "c", description: "C", required: true, hints: ["c"] },
];

function probe(
  id: string,
  may_answer: string[],
  cost: number,
  order: number,
): Probe {
  return {
    id,
    subject: "task",
    label: id,
    control: { id, role: "link", name: id },
    may_answer,
    forward_cost: cost,
    order,
  };
}

test("evidence ledger is generic and conflicts resolve to UNKNOWN", () => {
  const store = new EvidenceStore();
  const ledger0 = store.ledger(["task"], constraints);
  assert.equal(ledger0.task.a.state, "UNKNOWN");
  assert.equal(requiredEvidenceComplete(ledger0, "task", constraints), false);

  store.add([
    {
      subject: "task",
      constraint: "a",
      state: "SATISFIED",
      source: "page-1",
      observation_id: "o1",
      step: 1,
      timestamp: "2026-01-01T00:00:00.000Z",
    },
  ]);
  assert.equal(store.ledger(["task"], constraints).task.a.state, "SATISFIED");

  store.add([
    {
      subject: "task",
      constraint: "a",
      state: "REFUTED",
      source: "page-2",
      observation_id: "o2",
      step: 2,
      timestamp: "2026-01-01T00:00:01.000Z",
    },
  ]);
  assert.equal(store.ledger(["task"], constraints).task.a.state, "UNKNOWN");
});

test("Proposed ranks unresolved coverage, cost, then stable order", () => {
  const store = new EvidenceStore();
  store.add([
    {
      subject: "task",
      constraint: "a",
      state: "SATISFIED",
      source: "fixture",
      observation_id: "o",
      step: 0,
      timestamp: "2026-01-01T00:00:00.000Z",
    },
  ]);
  const ledger = store.ledger(["task"], constraints);
  const probes = [
    probe("known", ["a"], 1, 0),
    probe("single", ["b"], 1, 1),
    probe("costly", ["b", "c"], 3, 2),
    probe("best", ["b", "c"], 1, 3),
    probe("tie", ["b", "c"], 1, 4),
  ];

  assert.equal(
    selectProbe("Proposed", probes, ledger, { known: 100 }).id,
    "best",
  );
  assert.equal(
    selectProbe("Baseline", probes, ledger, {
      known: 100,
      single: 20,
      costly: 30,
      best: 40,
      tie: 50,
    }).id,
    "known",
  );
});
