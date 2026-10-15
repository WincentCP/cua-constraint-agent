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

const PilotTaskSchema = z
  .object({
    task_id: z.number().int().nonnegative(),
    sites: z.tuple([z.literal("shopping")]),
    intent_template_id: z.number().int().nonnegative(),
    public_intent: z.string().min(1),
    rationale: z.string().min(1),
    constraints: z.array(ConstraintSchema).min(3),
  })
  .strict();

const PilotManifestSchema = z
  .object({
    schema_version: z.literal(2),
    status: z.literal("PILOT_ONLY"),
    source_dataset_tag: z.string(),
    primary_poc_task: z.number().int().nonnegative(),
    tasks: z.array(PilotTaskSchema).length(6),
  })
  .strict();

export type PilotTaskSpec = z.infer<typeof PilotTaskSchema>;
export type PilotManifest = z.infer<typeof PilotManifestSchema>;

export function loadPilotManifest(
  path = new URL("../../config/pilot-tasks.json", import.meta.url),
): PilotManifest {
  const manifest = PilotManifestSchema.parse(
    JSON.parse(readFileSync(path, "utf8")),
  );
  const protocol = loadStudyProtocol();
  const ids = manifest.tasks.map((task) => task.task_id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate pilot task IDs");
  }
  if (manifest.source_dataset_tag !== protocol.benchmark.dataset_tag) {
    throw new Error("Pilot manifest dataset tag differs from pinned benchmark");
  }
  if (manifest.primary_poc_task !== protocol.scope.poc_task_id) {
    throw new Error("PoC task differs from study protocol");
  }
  if (!ids.includes(manifest.primary_poc_task)) {
    throw new Error("primary_poc_task must be present in tasks");
  }
  for (const task of manifest.tasks) {
    const constraintIds = task.constraints.map((constraint) => constraint.id);
    if (new Set(constraintIds).size !== constraintIds.length) {
      throw new Error(`Duplicate constraint IDs for task ${task.task_id}`);
    }
    if (
      task.constraints.filter((constraint) => constraint.required).length <
      protocol.suitability.min_required_constraints
    ) {
      throw new Error(`Insufficient requirements in task ${task.task_id}`);
    }
  }
  return manifest;
}

export function verifyPublicPilotTask(
  task: WebArenaTask,
  manifest = loadPilotManifest(),
) {
  const spec = manifest.tasks.find((candidate) => candidate.task_id === task.task_id);
  if (!spec) throw new Error(`Task ${task.task_id} is not in the pilot manifest`);
  if (
    task.sites.length !== 1 ||
    task.sites[0] !== "shopping" ||
    task.intent_template_id !== spec.intent_template_id ||
    task.intent !== spec.public_intent
  ) {
    throw new Error(
      `Official task ${task.task_id} differs from the pre-reviewed public metadata. Stop and re-audit before running.`,
    );
  }
  return spec;
}

export function constraintSpecsForTask(
  taskId: number,
  manifest = loadPilotManifest(),
): ConstraintSpec[] {
  const task = manifest.tasks.find((candidate) => candidate.task_id === taskId);
  if (!task) throw new Error(`Task ${taskId} is not in the pilot manifest`);
  return task.constraints;
}
