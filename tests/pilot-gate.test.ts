import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluatePilotGate } from "../src/experiment/pilot-gate.ts";
import { loadPilotManifest } from "../src/webarena/specs.ts";

const models = [
  { label: "qwen3.5-9b" },
  { label: "ministral3-8b" },
  { label: "granite4.1-8b" },
  { label: "xlam2-8b" },
];

function makeEpisode(
  root: string,
  taskId: number,
  model: string,
  method: string,
  pass: boolean,
) {
  const dir = join(root, "runs", model, method.toLowerCase(), String(taskId));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "agent_response.json"),
    JSON.stringify({
      task_type: "NAVIGATE",
      status: "SUCCESS",
      retrieved_data: null,
      error_details: null,
    }),
  );
  writeFileSync(
    join(dir, "network.har"),
    JSON.stringify({ log: { entries: [] } }),
  );
  writeFileSync(
    join(dir, "eval_result.json"),
    JSON.stringify({
      task_id: taskId,
      status: pass ? "success" : "failure",
      score: pass ? 1 : 0,
    }),
  );
}

test("pilot gate stays FAIL with no results; no invented successes", () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-gate-empty-"));
  try {
    const report = evaluatePilotGate(dir, models);
    assert.equal(report.expected, 48);
    assert.equal(report.completed_valid, 0);
    assert.equal(report.status, "FAIL");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("official task failure is valid, evaluator errors are invalid", () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-gate-"));
  try {
    let passCount = 0;
    for (const task of loadPilotManifest().tasks) {
      for (const model of models) {
        for (const method of ["Baseline", "Proposed"]) {
          const pass =
            (task.task_id === 279 || task.task_id === 284) &&
            (model.label === "qwen3.5-9b" || model.label === "ministral3-8b") &&
            passCount < 10;
          if (pass) passCount++;
          makeEpisode(dir, task.task_id, model.label, method, pass);
        }
      }
    }
    const pass = evaluatePilotGate(dir, models);
    assert.equal(pass.completed_valid, 48);
    assert.equal(pass.status, "FAIL"); // 8 successful runs, below 10
    assert.equal(pass.official_successes, 8);
    const dirForFirst = join(dir, "runs", "qwen3.5-9b", "baseline", "279");
    writeFileSync(
      join(dirForFirst, "eval_result.json"),
      JSON.stringify({ task_id: 279, status: "error", score: 0 }),
    );
    const error = evaluatePilotGate(dir, models);
    assert.equal(error.completed_valid, 47);
    assert.equal(error.invalid_or_missing, 1);
    assert(
      error.episodes.some((episode) => episode.reason === "EVALUATOR_ERROR"),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pilot gate passes when preregistered operational checks pass", () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-gate-pass-"));
  try {
    let count = 0;
    for (const task of loadPilotManifest().tasks) {
      for (const model of models) {
        for (const method of ["Baseline", "Proposed"]) {
          makeEpisode(dir, task.task_id, model.label, method, count < 12);
          count++;
        }
      }
    }
    const result = evaluatePilotGate(dir, models);
    assert.equal(result.completed_valid, 48);
    assert.equal(result.official_successes, 12);
    assert.equal(result.status, "PROVISIONAL_PASS");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
