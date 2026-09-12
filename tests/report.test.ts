import test from "node:test";
import assert from "node:assert/strict";
import { renderReport } from "../src/experiment/report.ts";
import { calculateMetrics } from "../src/experiment/metrics.ts";
import { config } from "../src/core/config.ts";
import {
  type Experiment,
  validateExperiment,
} from "../src/experiment/runner.ts";
import { hash } from "../src/core/config.ts";
test("Empty reports show missing data rather than invented success and escape text", () => {
  const e: Experiment = {
    schema_version: 1,
    id: "<script>alert(1)</script>",
    mode: "main",
    demo: true,
    config,
    config_hash: "test",
    plan: [],
    created: "test",
    identity: {},
    freeze_id: null,
  };
  const r = renderReport(e, [], calculateMetrics([], []));
  assert(r.markdown.includes("DEMO — BUKAN HASIL PENELITIAN"));
  assert(r.html.includes("&lt;script&gt;"));
  assert(!r.html.includes("<script>"));
  assert(!r.markdown.includes("100.0%"));
  assert(r.markdown.includes("pasangan valid untuk analisis: 0"));
});
test("Real development reports cannot be mistaken for frozen main results", () => {
  const e = {
    id: "dev",
    mode: "development",
    demo: false,
    plan: [],
    created: "test",
    freeze_id: null,
  } as unknown as Experiment;
  const r = renderReport(e, [], calculateMetrics([], []));
  assert(r.markdown.includes("DEVELOPMENT — BUKAN HASIL MAIN"));
  assert(r.markdown.includes("belum terikat pada freeze"));
});
test("Historical export can verify its own configuration without requiring current settings", () => {
  const old = structuredClone(config);
  old.budget.probes++;
  const e: Experiment = {
    schema_version: 1,
    id: "history",
    mode: "main",
    demo: true,
    config: old,
    plan: [],
    created: "test",
    identity: {},
    freeze_id: null,
    config_hash: hash({ config: old, identity: {}, plan: [], demo: true }),
  };
  assert.equal(validateExperiment(e, false), e);
  assert.throws(() => validateExperiment(e), /differs/);
  e.plan.push({ base: "bad", policy: "Baseline", pair: "bad:r1", repeat: 1 });
  assert.throws(() => validateExperiment(e, false), /integrity/);
});
