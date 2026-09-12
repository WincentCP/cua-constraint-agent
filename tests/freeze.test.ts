import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config, hash } from "../src/core/config.ts";
import {
  developmentGate,
  assertIdentity,
  verifyFreeze,
  makeFreeze,
  type Identity,
} from "../src/experiment/freeze.ts";
import {
  createExperiment,
  durableAppend,
  failedOutcome,
  validateExperiment,
  writeJson,
} from "../src/experiment/runner.ts";
import { manifest, taskMetadata } from "../src/experiment/manifest.ts";
import { loadTask } from "../src/environment/dataset.ts";
import { type Row } from "../src/experiment/metrics.ts";

function fixture(demo = false) {
  const parent = mkdtempSync(join(tmpdir(), "cua-gate-")),
    out = join(parent, "repeat"),
    plan = manifest("repeatability"),
    identity = { test: "synthetic gate unit fixture", model: { demo } };
  const experiment = createExperiment(
      out,
      "repeatability",
      demo,
      plan,
      identity,
    ),
    rows: Row[] = plan.map((cell, i) => ({
      id: String(i),
      experiment_id: experiment.id,
      config_hash: experiment.config_hash,
      demo,
      cell,
      task: taskMetadata(loadTask(cell.base)),
      attempt: 0,
      rerun_reason: null,
      replaces: [],
      outcome: {
        ...failedOutcome("unit test only"),
        terminal: "ACT",
        verification: "PASS",
      },
      evaluation: {
        outcome: "VERIFIED_ACT_SUCCESS",
        vda: 1,
        probe_count: 2,
        final_effect_correct: true,
        evidence_complete_before_act: true,
        budget_exhausted: false,
        public_refutations: [],
        detail: "unit fixture only",
      },
      events: [
        {
          seq: 1,
          type: "PROBE_SELECTION",
          timestamp: "test",
          data: { selected: { id: cell.base + "-probe" } },
        },
      ],
      final_world: null,
    }));
  return {
    parent,
    out,
    experiment,
    rows,
    identity,
    save: () =>
      rows.forEach((row) => durableAppend(join(out, "episodes.jsonl"), row)),
    close: () => rmSync(parent, { recursive: true, force: true }),
  };
}
test("Development gate accepts consistent full real-mode evidence and rejects demo", () => {
  for (const demo of [false, true]) {
    const f = fixture(demo);
    try {
      f.save();
      const gate = developmentGate(f.out);
      assert.equal(gate.passed, !demo);
      assert.equal(gate.selected_runs, 36);
      if (demo) assert(gate.problems.some((p) => p.includes("Demo")));
    } finally {
      f.close();
    }
  }
});
test("Gate rejects missing pairs, instability, insufficient baseline competence and mixed identities", () => {
  for (const flaw of ["missing", "unstable", "incompetent", "identity"]) {
    const f = fixture();
    try {
      if (flaw === "missing") f.rows.pop();
      if (flaw === "unstable")
        f.rows[0].events[0].data.selected.id = "different";
      if (flaw === "incompetent")
        for (const r of f.rows)
          if (r.cell.policy === "Baseline") {
            r.evaluation.vda = 0;
            r.evaluation.outcome = "FALSE_ABSTENTION";
          }
      if (flaw === "identity")
        for (const r of f.rows) r.config_hash = "wrong-experiment";
      f.save();
      assert.equal(developmentGate(f.out).passed, false, flaw);
    } finally {
      f.close();
    }
  }
});
test("Frozen identity and integrity changes are rejected; demo cannot create a research freeze", () => {
  const f = fixture(true);
  try {
    f.save();
    assert.throws(
      () =>
        makeFreeze(
          f.out,
          join(f.parent, "freeze.json"),
          f.identity as unknown as Identity,
        ),
      /gate failed/,
    );
    assert.throws(() => assertIdentity({ a: 1 }, { a: 2 }), /changed/);
    const path = join(f.parent, "invalid-freeze.json");
    writeJson(path, { id: "wrong", identity: f.identity });
    assert.throws(
      () => verifyFreeze(path, f.identity as unknown as Identity),
      /integrity/,
    );
    const content = {
      identity: f.identity,
      gate: { passed: false },
      main_manifest: manifest("main"),
    };
    writeJson(path, { id: hash(content), ...content });
    assert.throws(
      () => verifyFreeze(path, f.identity as unknown as Identity),
      /Invalid research freeze/,
    );
  } finally {
    f.close();
  }
});
test("Resuming an edited configuration or manifest fails instead of silently mixing conditions", () => {
  const f = fixture();
  try {
    assert.equal(validateExperiment(f.experiment), f.experiment);
    const changed = structuredClone(f.experiment);
    changed.config.budget.probes++;
    assert.throws(() => validateExperiment(changed), /integrity/);
    const changedPlan = structuredClone(f.experiment);
    changedPlan.plan.reverse();
    assert.throws(() => validateExperiment(changedPlan), /integrity/);
  } finally {
    f.close();
  }
});
