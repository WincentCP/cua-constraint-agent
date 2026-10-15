import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
    JSON.stringify({
      log: {
        version: "1.2",
        entries: [{ request: { url: "http://localhost:7770/" } }],
      },
    }),
  );
  const spec = loadPilotManifest().tasks.find(
    (task) => task.task_id === taskId,
  );
  assert(spec);
  const status = pass ? "success" : "failure";
  const score = pass ? 1 : 0;
  writeFileSync(
    join(dir, "eval_result.json"),
    JSON.stringify({
      task_id: taskId,
      intent_template_id: spec.intent_template_id,
      sites: ["shopping"],
      task_revision: 2,
      status,
      score,
      evaluators_results: [
        { evaluator_name: "AgentResponseEvaluator", status, score },
      ],
      webarena_verified_version: "1.2.3",
      webarena_verified_evaluator_checksum: "a".repeat(64),
      webarena_verified_data_checksum: "b".repeat(64),
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
    const resultPath = join(dirForFirst, "eval_result.json");
    const official = JSON.parse(readFileSync(resultPath, "utf8"));
    writeFileSync(
      resultPath,
      JSON.stringify({
        ...official,
        status: "error",
        score: 0,
        evaluators_results: [
          {
            evaluator_name: "AgentResponseEvaluator",
            status: "error",
            score: 0,
          },
        ],
      }),
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

test("official partial-match result is technically valid but not success", () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-gate-partial-"));
  try {
    makeEpisode(dir, 279, models[0].label, "Baseline", false);
    const evalPath = join(
      dir,
      "runs",
      models[0].label,
      "baseline",
      "279",
      "eval_result.json",
    );
    const official = JSON.parse(readFileSync(evalPath, "utf8"));
    writeFileSync(
      evalPath,
      JSON.stringify({
        ...official,
        status: "partial_match",
        score: 0.5,
        evaluators_results: [
          {
            evaluator_name: "AgentResponseEvaluator",
            status: "partial_match",
            score: 0.5,
          },
        ],
      }),
    );
    const result = evaluatePilotGate(dir, models);
    assert.equal(result.completed_valid, 1);
    assert.equal(result.official_successes, 0);
    assert.equal(
      result.episodes.find(
        (episode) =>
          episode.task_id === 279 &&
          episode.model === models[0].label &&
          episode.method === "Baseline",
      )?.reason,
      "PARTIAL_TASK_MATCH",
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

test("pilot gate rejects wrong evaluator version, task template and empty HAR", () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-gate-provenance-"));
  try {
    const { label } = models[0];
    makeEpisode(dir, 284, label, "Baseline", true);
    const root = join(dir, "runs", label, "baseline", "284");
    const resultPath = join(root, "eval_result.json");
    const official = JSON.parse(readFileSync(resultPath, "utf8"));

    writeFileSync(
      resultPath,
      JSON.stringify({
        ...official,
        webarena_verified_version: "1.0.0",
      }),
    );
    let result = evaluatePilotGate(dir, models);
    assert.equal(result.completed_valid, 0);
    assert.equal(
      result.episodes.find(
        (x) =>
          x.task_id === 284 && x.model === label && x.method === "Baseline",
      )?.reason,
      "EVALUATOR_VERSION_MISMATCH",
    );

    writeFileSync(
      resultPath,
      JSON.stringify({
        ...official,
        intent_template_id: 9999,
      }),
    );
    result = evaluatePilotGate(dir, models);
    assert.equal(result.completed_valid, 0);
    assert.equal(
      result.episodes.find(
        (x) =>
          x.task_id === 284 && x.model === label && x.method === "Baseline",
      )?.reason,
      "EVALUATOR_TASK_MISMATCH",
    );

    writeFileSync(resultPath, JSON.stringify(official));
    writeFileSync(
      join(root, "network.har"),
      JSON.stringify({ log: { entries: [] } }),
    );
    result = evaluatePilotGate(dir, models);
    assert.equal(result.completed_valid, 0);
    assert.equal(result.official_successes, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
