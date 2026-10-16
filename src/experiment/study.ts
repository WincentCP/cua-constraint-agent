import { readFileSync } from "node:fs";
import { z } from "zod";

const StudySchema = z
  .object({
    schema_version: z.literal(2),
    benchmark: z
      .object({
        name: z.literal("WebArena-Verified"),
        pypi_version: z.string().regex(/^\d+\.\d+\.\d+$/),
        site: z.literal("shopping"),
        dataset_tag: z.string().regex(/^v\d+\.\d+\.\d+$/),
      })
      .strict(),
    scope: z
      .object({
        poc_task_count: z.literal(3),
        poc_task_ids: z.tuple([
          z.number().int().nonnegative(),
          z.number().int().nonnegative(),
          z.number().int().nonnegative(),
        ]),
        pilot_task_count: z.literal(6),
        main_task_count: z.literal(32),
        model_count: z.literal(4),
        methods: z.tuple([z.literal("Baseline"), z.literal("Proposed")]),
      })
      .strict(),
    execution: z
      .object({
        max_steps: z.number().int().min(1).max(60),
        temperature: z.literal(0),
        max_decision_screenshots: z.number().int().min(0).max(10),
        require_site_reset_between_episodes: z.literal(true),
      })
      .strict(),
    metrics: z
      .object({
        primary: z.literal("official_task_success"),
        secondary: z.array(z.string().min(1)).min(4),
        diagnostic: z.array(z.string().min(1)).min(1),
        paired_unit: z.literal("task_id + model_label"),
      })
      .strict(),
    suitability: z
      .object({
        min_required_constraints: z.number().int().min(3),
        min_information_choices: z.number().int().min(2),
      })
      .strict(),
    pilot_gate: z
      .object({
        min_valid_run_fraction: z.number().gt(0).lte(1),
        min_official_successes: z.number().int().min(1),
        min_successful_models: z.number().int().min(1).max(4),
        min_successful_tasks: z.number().int().min(1).max(6),
        caveat: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type StudyProtocol = z.infer<typeof StudySchema>;

export function loadStudyProtocol(
  path = new URL("../../config/study.json", import.meta.url),
): StudyProtocol {
  const protocol = StudySchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (
    protocol.benchmark.dataset_tag !==
    "v" + protocol.benchmark.pypi_version
  ) {
    throw new Error("Dataset tag and pinned CLI version disagree");
  }
  if (
    new Set(protocol.scope.poc_task_ids).size !== protocol.scope.poc_task_count
  ) {
    throw new Error("PoC must contain exactly three distinct development IDs");
  }
  return protocol;
}

/** Main tasks must be held out from every development stage. */
export function assertMainTaskSelection(
  taskIds: number[],
  pilotIds: number[],
  protocol = loadStudyProtocol(),
) {
  if (
    taskIds.length !== protocol.scope.main_task_count ||
    taskIds.some((id) => !Number.isInteger(id) || id < 0) ||
    new Set(taskIds).size !== taskIds.length
  ) {
    throw new Error(
      "Main selection requires exactly " +
        protocol.scope.main_task_count +
        " distinct task IDs",
    );
  }
  const development = new Set([...protocol.scope.poc_task_ids, ...pilotIds]);
  const overlap = taskIds.filter((id) => development.has(id));
  if (overlap.length) {
    throw new Error(
      "Main tasks overlap PoC/pilot development sets: " + overlap.join(", "),
    );
  }
}
