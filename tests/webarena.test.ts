import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  extractControls,
  probesFromControls,
} from "../src/browser/accessibility.ts";
import {
  WebArenaAgentResponseSchema,
  WebArenaTaskSchema,
} from "../src/webarena/schema.ts";
import { loadPilotManifest } from "../src/webarena/specs.ts";

const expectedPilotIds = [284, 323, 493, 523, 552, 562];

test("pilot task manifest is explicit, six-task, and starts with task 284", () => {
  const manifest = loadPilotManifest();
  assert.equal(manifest.status, "PILOT_ONLY");
  assert.equal(manifest.primary_poc_task, 284);
  assert.deepEqual(
    manifest.tasks.map((task) => task.task_id),
    expectedPilotIds,
  );
  for (const task of manifest.tasks) {
    assert(task.constraints.length >= 3);
    assert(task.constraints.every((constraint) => constraint.required));
  }
});

test("four-model manifest is pre-registered without selecting a winner", () => {
  const models = JSON.parse(readFileSync("config/models.json", "utf8")) as Array<{
    label: string;
    name: string;
  }>;
  assert.equal(models.length, 4);
  assert.equal(new Set(models.map((model) => model.label)).size, 4);
  assert(models.every((model) => /q4[_-]k[_-]m/i.test(model.name)));
});

test("official task and agent-response contracts are strict", () => {
  const task = WebArenaTaskSchema.parse({
    sites: ["shopping"],
    task_id: 284,
    intent_template_id: 207,
    start_urls: ["http://localhost:7770"],
    intent:
      "View the product page for the least expensive shoe storage with a minimum storage capacity of 12 pairs.",
  });
  assert.equal(task.task_id, 284);
  assert.throws(() =>
    WebArenaTaskSchema.parse({ ...task, hidden_answer: "leak" }),
  );

  const response = WebArenaAgentResponseSchema.parse({
    task_type: "NAVIGATE",
    status: "SUCCESS",
    retrieved_data: null,
    error_details: null,
  });
  assert.equal(response.status, "SUCCESS");
});

test("accessibility controls are parsed and hint mapping remains annotation-only", () => {
  const snapshot =
    '- main:\n  - textbox "Search"\n  - link "Shoe storage 12 pairs":\n    - /url: /shoe-storage\n  - button "Sort by price"';
  const controls = extractControls(snapshot);
  assert.equal(controls.length, 3);
  const constraints = loadPilotManifest().tasks[0].constraints;
  const probes = probesFromControls(controls, constraints);
  assert(
    probes.some((probe) => probe.may_answer.includes("product_category")),
  );
  assert(
    probes.some((probe) => probe.may_answer.includes("minimum_capacity")),
  );
  assert(
    probes.some((probe) => probe.may_answer.includes("least_expensive")),
  );
});
