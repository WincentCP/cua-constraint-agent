import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseAgentPlan, OllamaModel } from "../src/agent/ollama.ts";
import { buildResultsDataset } from "../src/experiment/results.ts";
import { RunMetadataSchema, RunRecorder } from "../src/experiment/recorder.ts";

const example = () =>
  RunMetadataSchema.parse({
    schema_version: 1,
    run_id: "11111111-1111-4111-8111-111111111111",
    stage: "poc",
    task_id: 284,
    model_label: "qwen3.5-9b",
    model_name: "qwen3.5:9b-q4_K_M",
    method: "Baseline",
    benchmark_version: "1.2.3",
    git_commit: "deadbeef",
    started_at: "2026-10-15T01:00:00.000Z",
    ended_at: null,
    duration_ms: null,
    max_steps: 16,
    steps_executed: 0,
    actions: 0,
    probes: 0,
    model_calls: 0,
    claimed_success: false,
    execution_state: "RUNNING",
    error_code: null,
    official_status: null,
    official_score: null,
  });

test("recorder tracks run identity, decision log, and protects existing evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "cua-recorder-"));
  try {
    const recorder = new RunRecorder(join(root, "284"), example());
    recorder.accessibility(1, '- link "Shoe storage"\n');
    recorder.decision({
      event: "DECISION",
      at: "2026-10-15T01:00:00.000Z",
      step: 1,
      page_url: "http://localhost:7770",
      observation_file: "accessibility/0001.yaml",
      screenshot_file: null,
      constraints: { category: "UNKNOWN" },
      eligible_probe_ids: ["link:0:Shoe storage"],
      progress_scores: {},
      selected_probe_id: "link:0:Shoe storage",
      selected_probe_label: "Shoe storage",
      model_rationale: "Inspect visible product",
      action: "click",
      evidence_updates: [],
    });
    recorder.update({
      steps_executed: 1,
      actions: 1,
      probes: 1,
      ended_at: "2026-10-15T01:00:01.000Z",
      duration_ms: 1000,
      execution_state: "COMPLETED",
    });
    assert.equal(recorder.summary.actions, 1);
    assert(existsSync(recorder.path("trace.jsonl")));
    assert.match(
      readFileSync(recorder.path("trace.jsonl"), "utf8"),
      /"DECISION"/,
    );
    assert.throws(
      () => new RunRecorder(join(root, "284"), example()),
      /already exist/,
    );
    assert.throws(() => recorder.relative(join(root, "outside")), /inside/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("local model JSON parsing rejects malformed or off-contract plans", () => {
  const parsed = parseAgentPlan(
    JSON.stringify({
      progress_scores: { a: 2 },
      evidence: [],
      finish: false,
      rationale: "Search",
      input_text_by_probe: { a: "shoe" },
    }),
  );
  assert.equal(parsed.progress_scores.a, 2);
  assert.throws(() => parseAgentPlan("no JSON"), /JSON/);
  assert.throws(() => parseAgentPlan('{"finish":"yes"}'));
  assert.throws(() => new OllamaModel("qwen", "https://remote.example"));
});

test("pilot result export is explicitly incomplete without official runs", () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-results-"));
  try {
    const result = buildResultsDataset({
      stage: "pilot",
      outputRoot: join(dir, "pilot"),
      reportRoot: join(dir, "reports"),
      models: [
        { label: "qwen3.5-9b" },
        { label: "ministral3-8b" },
        { label: "granite4.1-8b" },
        { label: "xlam2-8b" },
      ],
    });
    assert.equal(result.expected, 48);
    assert.equal(result.valid, 0);
    assert.equal(result.success, 0);
    assert.equal(result.rows.length, 48);
    assert(result.rows.every((row) => row.official_success === null));
    assert.match(
      readFileSync(join(dir, "reports", "analysis-summary.md"), "utf8"),
      /INCOMPLETE/,
    );
    assert.equal(
      readFileSync(join(dir, "reports", "analysis-results.csv"), "utf8").split(
        "\n",
      ).length,
      2,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
