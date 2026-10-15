import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  WebArenaAgentResponseSchema,
  WebArenaTaskSchema,
} from "../src/webarena/schema.ts";
import {
  loadPilotManifest,
  verifyPublicPilotTask,
} from "../src/webarena/specs.ts";
import {
  loadStudyProtocol,
  assertMainTaskSelection,
} from "../src/experiment/study.ts";
import { webArenaInvocation } from "../src/webarena/official-cli.ts";
import { extractControls, probesFromControls } from "../src/browser/accessibility.ts";

const pilotIds = [279, 284, 323, 436, 506, 528];

test("the six development tasks are Shopping-only and have distinct templates", () => {
  const protocol = loadStudyProtocol();
  const manifest = loadPilotManifest();
  assert.equal(protocol.benchmark.pypi_version, "1.2.3");
  assert.equal(manifest.source_dataset_tag, "v1.2.3");
  assert.equal(manifest.status, "PILOT_ONLY");
  assert.equal(manifest.primary_poc_task, 284);
  assert.deepEqual(manifest.tasks.map((task) => task.task_id), pilotIds);
  assert.equal(new Set(manifest.tasks.map((task) => task.intent_template_id)).size, 6);
  for (const task of manifest.tasks) {
    assert.deepEqual(task.sites, ["shopping"]);
    assert(task.public_intent.length > 25);
    assert(task.constraints.length >= protocol.suitability.min_required_constraints);
    assert(task.constraints.every((constraint) => constraint.required));
  }
});

test("task verification rejects altered intents and cross-site substitution", () => {
  const manifest = loadPilotManifest();
  const spec = manifest.tasks.find((task) => task.task_id === 284)!;
  const task = WebArenaTaskSchema.parse({
    sites: ["shopping"],
    task_id: spec.task_id,
    intent_template_id: spec.intent_template_id,
    start_urls: ["http://localhost:7770"],
    intent: spec.public_intent,
  });
  assert.equal(verifyPublicPilotTask(task).task_id, 284);
  assert.throws(() => verifyPublicPilotTask({ ...task, intent: "changed" }), /re-audit/);
  assert.throws(() => verifyPublicPilotTask({ ...task, sites: ["gitlab"] }), /re-audit/);
  assert.throws(() =>
    WebArenaTaskSchema.parse({ ...task, hidden_answer: "leak" }),
  );
});

test("four Q4_K_M local models and two methods are explicit", () => {
  const models = JSON.parse(readFileSync("config/models.json", "utf8")) as Array<{
    label: string;
    name: string;
  }>;
  assert.equal(models.length, 4);
  assert.equal(new Set(models.map((model) => model.label)).size, 4);
  assert(models.every((model) => /q4[_-]k[_-]m/i.test(model.name)));
  const inv = webArenaInvocation(["agent-input-get", "--task-ids", "284"]);
  assert.equal(inv.args[0], "--from");
  assert.equal(inv.args[1], "webarena-verified==1.2.3");
  assert.equal(inv.args[2], "webarena-verified");
});

test("main requires exactly 32 tasks, none reused from development", () => {
  const nonPilot = Array.from({ length: 32 }, (_, i) => i + 600);
  assert.doesNotThrow(() => assertMainTaskSelection(nonPilot, pilotIds));
  assert.throws(() => assertMainTaskSelection(nonPilot.slice(0, 31), pilotIds), /32/);
  assert.throws(() => assertMainTaskSelection([...nonPilot.slice(0, 31), 284], pilotIds), /overlap/);
});

test("official response remains structurally strict", () => {
  const response = WebArenaAgentResponseSchema.parse({
    task_type: "NAVIGATE",
    status: "SUCCESS",
    retrieved_data: null,
    error_details: null,
  });
  assert.equal(response.status, "SUCCESS");
});

test("Accessibility Tree mapping is diagnostic and not ground truth", () => {
  const snapshot =
    '- main:\n  - textbox "Search"\n  - link "Shoe storage 12 pairs":\n    - /url: /shoe-storage\n  - button "Sort by price"';
  const controls = extractControls(snapshot);
  assert.equal(controls.length, 3);
  const constraints = loadPilotManifest().tasks.find((t) => t.task_id === 284)!.constraints;
  const probes = probesFromControls(controls, constraints);
  assert(probes.some((probe) => probe.may_answer.includes("category")));
  assert(probes.some((probe) => probe.may_answer.includes("capacity")));
  assert(probes.some((probe) => probe.may_answer.includes("price_optimality")));
});
