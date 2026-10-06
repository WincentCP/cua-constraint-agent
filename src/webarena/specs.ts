import { readFileSync } from "node:fs";
import { z } from "zod";
import type { ConstraintSpec } from "../core/types.ts";

const ConstraintSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]*$/),
    description: z.string().min(1),
    required: z.boolean(),
    hints: z.array(z.string().min(1)).min(1),
  })
  .strict();

const PilotTaskSchema = z
  .object({
    task_id: z.number().int().nonnegative(),
    sites: z.array(z.string().min(1)).min(1),
    rationale: z.string().min(1),
    constraints: z.array(ConstraintSchema).min(2),
  })
  .strict();

const PilotManifestSchema = z
  .object({
    schema_version: z.literal(1),
    status: z.literal("PILOT_ONLY"),
    primary_poc_task: z.number().int().nonnegative(),
    tasks: z.array(PilotTaskSchema).min(1),
  })
  .strict();

export type PilotTaskSpec = z.infer<typeof PilotTaskSchema>;
export type PilotManifest = z.infer<typeof PilotManifestSchema>;

export function loadPilotManifest(
  path = new URL("../../config/pilot-tasks.json", import.meta.url),
): PilotManifest {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const manifest = PilotManifestSchema.parse(raw);
  const ids = manifest.tasks.map((task) => task.task_id);
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate pilot task IDs");
  if (!ids.includes(manifest.primary_poc_task)) {
    throw new Error("primary_poc_task must be present in tasks");
  }
  for (const task of manifest.tasks) {
    const constraintIds = task.constraints.map((constraint) => constraint.id);
    if (new Set(constraintIds).size !== constraintIds.length) {
      throw new Error(`Duplicate constraint IDs for task ${task.task_id}`);
    }
  }
  return manifest;
}

export function constraintSpecsForTask(
  taskId: number,
  manifest = loadPilotManifest(),
): ConstraintSpec[] {
  const task = manifest.tasks.find((candidate) => candidate.task_id === taskId);
  if (!task) throw new Error(`Task ${taskId} is not in the pilot manifest`);
  return task.constraints;
}
