import { readFileSync } from "node:fs";
import { z } from "zod";
import type { ConstraintSpec } from "../core/types.ts";
import type { WebArenaTask } from "./schema.ts";
import { loadStudyProtocol } from "../experiment/study.ts";

const ConstraintSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]*$/),
    description: z.string().min(1),
    required: z.literal(true),
    hints: z.array(z.string().min(1)).min(1),
  })
  .strict();

const DevelopmentTaskSchema = z
  .object({
    task_id: z.number().int().nonnegative(),
    sites: z.tuple([z.literal("shopping")]),
    intent_template_id: z.number().int().nonnegative(),
    public_intent: z.string().min(1),
    rationale: z.string().min(1),
    constraints: z.array(ConstraintSchema).min(3),
  })
  .strict();

const PocManifestSchema = z
  .object({
    schema_version: z.literal(1),
    status: z.literal("POC_DEVELOPMENT_ONLY"),
    source_dataset_tag: z.string(),
    tasks: z.array(DevelopmentTaskSchema).length(3),
  })
  .strict();
const PilotManifestSchema = z
  .object({
    schema_version: z.literal(3),
    status: z.literal("PILOT_CANDIDATES_UNREVIEWED"),
    source_dataset_tag: z.string(),
    tasks: z.array(DevelopmentTaskSchema).length(6),
  })
  .strict();
const MainCandidateSchema = z
  .object({
    task_id: z.number().int().nonnegative(),
    sites: z.tuple([z.literal("shopping")]),
    intent_template_id: z.number().int().nonnegative(),
    public_intent: z.string().min(1),
    group: z.enum([
      "product_navigation",
      "product_comparison",
      "order_retrieval",
      "review_and_mutation",
    ]),
  })
  .strict();
const MainManifestSchema = z
  .object({
    schema_version: z.literal(1),
    status: z.literal("CANDIDATES_UNSCREENED"),
    source_dataset_tag: z.string(),
    screening_basis: z.string().min(1),
    tasks: z.array(MainCandidateSchema).length(32),
  })
  .strict();

export type PocManifest = z.infer<typeof PocManifestSchema>;
export type PilotManifest = z.infer<typeof PilotManifestSchema>;
export type MainCandidateManifest = z.infer<typeof MainManifestSchema>;
export type DevelopmentTaskSpec = z.infer<typeof DevelopmentTaskSchema>;
export type PilotTaskSpec = DevelopmentTaskSpec;
export type DevelopmentStage = "poc" | "pilot";

function validateDevelopmentTaskSpecs(tasks: DevelopmentTaskSpec[]) {
  for (const task of tasks) {
    const names = task.constraints.map((c) => c.id);
    if (new Set(names).size !== names.length) {
      throw new Error(
        "Duplicate public requirement IDs in task " + task.task_id,
      );
    }
    if (
      task.constraints.length <
      loadStudyProtocol().suitability.min_required_constraints
    ) {
      throw new Error("Too few public requirements in task " + task.task_id);
    }
  }
}

function ids(tasks: Array<{ task_id: number }>) {
  return tasks.map((task) => task.task_id);
}

function templates(tasks: Array<{ intent_template_id: number }>) {
  return tasks.map((task) => task.intent_template_id);
}

function assertUnique(values: number[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error("Duplicate " + label);
  }
}

export function loadPocManifest(
  path = new URL("../../config/poc-tasks.json", import.meta.url),
): PocManifest {
  const manifest = PocManifestSchema.parse(
    JSON.parse(readFileSync(path, "utf8")),
  );
  const protocol = loadStudyProtocol();
  if (manifest.source_dataset_tag !== protocol.benchmark.dataset_tag) {
    throw new Error("PoC benchmark version mismatch");
  }
  if (
    ids(manifest.tasks)
      .slice()
      .sort((a, b) => a - b)
      .join(",") !==
    protocol.scope.poc_task_ids
      .slice()
      .sort((a, b) => a - b)
      .join(",")
  ) {
    throw new Error("PoC task list does not match registered study protocol");
  }
  assertUnique(ids(manifest.tasks), "PoC IDs");
  assertUnique(templates(manifest.tasks), "PoC template IDs");
  validateDevelopmentTaskSpecs(manifest.tasks);
  return manifest;
}

export function loadPilotManifest(
  path = new URL("../../config/pilot-tasks.json", import.meta.url),
): PilotManifest {
  const manifest = PilotManifestSchema.parse(
    JSON.parse(readFileSync(path, "utf8")),
  );
  const protocol = loadStudyProtocol();
  const poc = loadPocManifest();
  if (manifest.source_dataset_tag !== protocol.benchmark.dataset_tag) {
    throw new Error("Pilot benchmark version mismatch");
  }
  assertUnique(ids(manifest.tasks), "pilot IDs");
  assertUnique(templates(manifest.tasks), "pilot template IDs");
  const pocIds = new Set(ids(poc.tasks));
  const pocTemplates = new Set(templates(poc.tasks));
  if (
    manifest.tasks.some(
      (task) =>
        pocIds.has(task.task_id) || pocTemplates.has(task.intent_template_id),
    )
  ) {
    throw new Error("PoC and pilot must be disjoint by task and template");
  }
  validateDevelopmentTaskSpecs(manifest.tasks);
  return manifest;
}

export function loadMainCandidateManifest(
  path = new URL("../../config/main-candidates.json", import.meta.url),
): MainCandidateManifest {
  const manifest = MainManifestSchema.parse(
    JSON.parse(readFileSync(path, "utf8")),
  );
  const protocol = loadStudyProtocol();
  const development = [
    ...loadPocManifest().tasks,
    ...loadPilotManifest().tasks,
  ];
  if (manifest.source_dataset_tag !== protocol.benchmark.dataset_tag) {
    throw new Error("Main candidate benchmark version mismatch");
  }
  assertUnique(ids(manifest.tasks), "main candidate IDs");
  const devIds = new Set(ids(development));
  const devTemplates = new Set(templates(development));
  for (const task of manifest.tasks) {
    if (devIds.has(task.task_id) || devTemplates.has(task.intent_template_id)) {
      throw new Error(
        "Main candidates must be held out from PoC/pilot IDs and templates",
      );
    }
  }
  for (const group of MainCandidateSchema.shape.group.options) {
    if (manifest.tasks.filter((task) => task.group === group).length !== 8) {
      throw new Error(
        "Main task strata must have eight candidates each: " + group,
      );
    }
  }
  return manifest;
}

export function developmentManifest(stage: DevelopmentStage) {
  return stage === "poc" ? loadPocManifest() : loadPilotManifest();
}

export function verifyPublicStageTask(
  task: WebArenaTask,
  stage: DevelopmentStage,
) {
  const spec = developmentManifest(stage).tasks.find(
    (candidate) => candidate.task_id === task.task_id,
  );
  if (!spec)
    throw new Error("Task " + task.task_id + " is not registered for " + stage);
  if (
    task.sites.length !== 1 ||
    task.sites[0] !== "shopping" ||
    task.intent_template_id !== spec.intent_template_id ||
    task.intent !== spec.public_intent
  ) {
    throw new Error(
      "Official task " +
        task.task_id +
        " differs from registered public metadata; stop and re-audit.",
    );
  }
  return spec;
}

export function verifyPublicPilotTask(task: WebArenaTask) {
  return verifyPublicStageTask(task, "pilot");
}

export function verifyPublicMainCandidate(
  task: WebArenaTask,
  manifest = loadMainCandidateManifest(),
) {
  const spec = manifest.tasks.find(
    (candidate) => candidate.task_id === task.task_id,
  );
  if (
    !spec ||
    task.sites.length !== 1 ||
    task.sites[0] !== "shopping" ||
    task.intent_template_id !== spec.intent_template_id ||
    task.intent !== spec.public_intent
  ) {
    throw new Error(
      "Official main candidate task differs from registered public metadata; stop and re-audit.",
    );
  }
  return spec;
}

export function constraintSpecsForTask(
  taskId: number,
  stage: DevelopmentStage,
): ConstraintSpec[] {
  const spec = developmentManifest(stage).tasks.find(
    (task) => task.task_id === taskId,
  );
  if (!spec)
    throw new Error("Task " + taskId + " not registered for stage " + stage);
  return spec.constraints;
}

/** Fail closed if any of the 41 preregistered PUBLIC Shopping inputs differ. */
export function verifyRegisteredPublicCatalog(tasks: WebArenaTask[]) {
  const registered = [
    ...loadPocManifest().tasks,
    ...loadPilotManifest().tasks,
    ...loadMainCandidateManifest().tasks,
  ];
  const byId = new Map(tasks.map((task) => [task.task_id, task]));
  if (byId.size !== tasks.length) {
    throw new Error("Official Shopping catalog has duplicate task IDs");
  }
  for (const entry of registered) {
    const task = byId.get(entry.task_id);
    if (
      !task ||
      task.intent_template_id !== entry.intent_template_id ||
      task.sites.length !== 1 ||
      task.sites[0] !== "shopping" ||
      task.intent !== entry.public_intent
    ) {
      throw new Error(
        "Registered task " +
          entry.task_id +
          " does not match pinned official public Shopping input",
      );
    }
  }
  return { registered: registered.length, catalog: tasks.length };
}
