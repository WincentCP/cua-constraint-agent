import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  authHeadersForTask,
  taskAllowedOrigins,
} from "../src/webarena/auth.ts";
import {
  WebArenaConfigSchema,
  WebArenaTaskSchema,
  WebArenaAgentResponseSchema,
} from "../src/webarena/schema.ts";
import {
  loadPocManifest,
  loadPilotManifest,
  loadMainCandidateManifest,
  verifyPublicStageTask,
  verifyPublicMainCandidate,
  verifyRegisteredPublicCatalog,
  constraintSpecsForTask,
} from "../src/webarena/specs.ts";
import {
  loadStudyProtocol,
  assertMainTaskSelection,
} from "../src/experiment/study.ts";
import { webArenaInvocation } from "../src/webarena/official-cli.ts";
import {
  extractControls,
  probesFromControls,
} from "../src/browser/accessibility.ts";
import { buildAgentPrompt } from "../src/agent/runner.ts";

const pocIds = [279, 284, 528];
const pilotIds = [96, 323, 436, 506, 571, 689];

test("registered 3/6/32 stages are disjoint by ID, and main templates are held out", () => {
  const protocol = loadStudyProtocol();
  const poc = loadPocManifest();
  const pilot = loadPilotManifest();
  const main = loadMainCandidateManifest();
  assert.equal(protocol.benchmark.pypi_version, "1.2.3");
  assert.equal(protocol.scope.poc_task_count, 3);
  assert.deepEqual(
    poc.tasks.map((task) => task.task_id),
    pocIds,
  );
  assert.deepEqual(
    pilot.tasks.map((task) => task.task_id),
    pilotIds,
  );
  assert.equal(main.tasks.length, 32);
  assert.equal(
    new Set(main.tasks.map((task) => task.intent_template_id)).size,
    22,
  );
  assert.equal(poc.status, "POC_DEVELOPMENT_ONLY");
  assert.equal(pilot.status, "PILOT_CANDIDATES_UNREVIEWED");
  assert.equal(main.status, "CANDIDATES_UNSCREENED");
  const dev = [...poc.tasks, ...pilot.tasks];
  const all = [...dev, ...main.tasks];
  assert.equal(new Set(all.map((task) => task.task_id)).size, 41);
  assert.equal(new Set(dev.map((task) => task.intent_template_id)).size, 9);
  const devTemplates = new Set(dev.map((task) => task.intent_template_id));
  assert(
    main.tasks.every((task) => !devTemplates.has(task.intent_template_id)),
  );
  for (const task of dev) {
    assert.deepEqual(task.sites, ["shopping"]);
    assert(task.public_intent.length > 25);
    assert(
      task.constraints.length >= protocol.suitability.min_required_constraints,
    );
    assert(task.constraints.every((constraint) => constraint.required));
  }
  assert.equal(protocol.execution.max_steps, 16);
  assert.equal(protocol.metrics.primary, "official_task_success");
});

test("stage task verification enforces official public instructions and stage boundaries", () => {
  const spec = loadPocManifest().tasks.find((task) => task.task_id === 284)!;
  const task = WebArenaTaskSchema.parse({
    sites: ["shopping"],
    task_id: spec.task_id,
    intent_template_id: spec.intent_template_id,
    start_urls: ["http://localhost:7770"],
    intent: spec.public_intent,
  });
  assert.equal(verifyPublicStageTask(task, "poc").task_id, 284);
  assert.throws(() => verifyPublicStageTask(task, "pilot"), /not registered/);
  const config = WebArenaConfigSchema.parse(
    JSON.parse(readFileSync("config/webarena.example.json", "utf8")),
  );
  assert.deepEqual(Object.keys(config.environments), ["__SHOPPING__"]);
  assert.deepEqual(taskAllowedOrigins(task), ["http://localhost:7770"]);
  assert.equal(
    authHeadersForTask(task, config)["X-M2-Customer-Auto-Login"],
    "emma.lopez@gmail.com:Password.123",
  );
  assert.throws(
    () => taskAllowedOrigins({ ...task, sites: ["gitlab"] }),
    /Shopping-only/,
  );
  assert.throws(
    () => verifyPublicStageTask({ ...task, intent: "changed" }, "poc"),
    /re-audit/,
  );
  assert.throws(
    () => verifyPublicStageTask({ ...task, sites: ["reddit"] }, "poc"),
    /re-audit/,
  );
  assert.throws(() =>
    WebArenaTaskSchema.parse({ ...task, hidden_answer: "leak" }),
  );
  const candidate = loadMainCandidateManifest().tasks[0];
  const mainTask = WebArenaTaskSchema.parse({
    task_id: candidate.task_id,
    intent_template_id: candidate.intent_template_id,
    sites: ["shopping"],
    start_urls: ["http://localhost:7770"],
    intent: candidate.public_intent,
  });
  assert.equal(verifyPublicMainCandidate(mainTask).task_id, candidate.task_id);
  assert.throws(
    () => verifyPublicMainCandidate({ ...mainTask, intent: "edited" }),
    /re-audit/,
  );
});

test("four local quantized models and pinned official invocation are explicit", () => {
  const models = JSON.parse(
    readFileSync("config/models.json", "utf8"),
  ) as Array<{ label: string; name: string }>;
  assert.equal(models.length, 4);
  assert.equal(new Set(models.map((model) => model.label)).size, 4);
  assert(models.every((model) => /q4[_-]k[_-]m/i.test(model.name)));
  const invocation = webArenaInvocation([
    "agent-input-get",
    "--task-ids",
    "284",
  ]);
  assert.deepEqual(invocation.args.slice(0, 3), [
    "--from",
    "webarena-verified==1.2.3",
    "webarena-verified",
  ]);
});

test("main selection rejects PoC and pilot overlap", () => {
  const mainIds = loadMainCandidateManifest().tasks.map((task) => task.task_id);
  assert.doesNotThrow(() => assertMainTaskSelection(mainIds, pilotIds));
  assert.throws(
    () => assertMainTaskSelection(mainIds.slice(0, 31), pilotIds),
    /32/,
  );
  assert.throws(
    () => assertMainTaskSelection([...mainIds.slice(0, 31), 284], pilotIds),
    /overlap/,
  );
  assert.throws(
    () => assertMainTaskSelection([...mainIds.slice(0, 31), 323], pilotIds),
    /overlap/,
  );
  assert.throws(
    () =>
      assertMainTaskSelection([...mainIds.slice(0, 31), mainIds[0]], pilotIds),
    /distinct/,
  );
});

test("agent prompt is method-blind and can include the same evidence state for either policy", () => {
  const spec = loadPocManifest().tasks.find((x) => x.task_id === 284)!;
  const task = WebArenaTaskSchema.parse({
    task_id: 284,
    intent_template_id: spec.intent_template_id,
    sites: ["shopping"],
    start_urls: ["http://localhost:7770"],
    intent: spec.public_intent,
  });
  const snap = '- link "Shoe storage 12 pairs"';
  const probes = probesFromControls(
    extractControls(snap),
    constraintSpecsForTask(284, "poc"),
  );
  const states = {
    category: "UNKNOWN",
    capacity: "SATISFIED",
    price_optimality: "UNKNOWN",
  } as const;
  const payload = buildAgentPrompt(
    task,
    snap,
    spec.constraints,
    probes,
    1,
    16,
    states,
  );
  assert.equal(
    payload.includes('"previous_model_observed_constraint_states"'),
    true,
  );
  assert.equal(payload.includes('"method"'), false);
  assert.equal(payload.includes('"policy"'), false);
  assert.equal(payload.includes('"SATISFIED"'), true);
});

test("official response strict and accessibility hints remain diagnostic", () => {
  const response = WebArenaAgentResponseSchema.parse({
    task_type: "NAVIGATE",
    status: "SUCCESS",
    retrieved_data: null,
    error_details: null,
  });
  assert.equal(response.status, "SUCCESS");
  const snapshot =
    '- main:\n  - textbox "Search"\n  - link "Shoe storage 12 pairs":\n    - /url: /shoe-storage\n  - button "Sort by price"';
  const controls = extractControls(snapshot);
  assert.equal(controls.length, 3);
  const constraints = constraintSpecsForTask(284, "poc");
  const probes = probesFromControls(controls, constraints);
  assert(probes.some((probe) => probe.may_answer.includes("category")));
  assert(probes.some((probe) => probe.may_answer.includes("capacity")));
  assert(probes.some((probe) => probe.may_answer.includes("price_optimality")));
});

test("all registered task manifests must match one official PUBLIC catalog", () => {
  const registered = [
    ...loadPocManifest().tasks,
    ...loadPilotManifest().tasks,
    ...loadMainCandidateManifest().tasks,
  ];
  const tasks = registered.map((task) =>
    WebArenaTaskSchema.parse({
      task_id: task.task_id,
      intent_template_id: task.intent_template_id,
      intent: task.public_intent,
      sites: ["shopping"],
      start_urls: ["http://localhost:7770"],
    }),
  );
  assert.equal(verifyRegisteredPublicCatalog(tasks).registered, 41);
  const altered = tasks.map((task) => ({ ...task }));
  altered[40].intent += " altered";
  assert.throws(
    () => verifyRegisteredPublicCatalog(altered),
    /Registered task/,
  );
  assert.throws(
    () => verifyRegisteredPublicCatalog(tasks.slice(1)),
    /Registered task/,
  );
  assert.throws(
    () => verifyRegisteredPublicCatalog([...tasks, tasks[0]]),
    /duplicate/,
  );
});
