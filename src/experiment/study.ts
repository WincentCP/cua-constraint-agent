import { readFileSync } from "node:fs";
import { z } from "zod";

const StudySchema = z
  .object({
    schema_version: z.literal(1),
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
        poc_task_id: z.number().int().nonnegative(),
        pilot_task_count: z.literal(6),
        main_task_count: z.literal(32),
        model_count: z.literal(4),
        methods: z.tuple([z.literal("Baseline"), z.literal("Proposed")]),
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
  const protocol = StudySchema.parse(
    JSON.parse(readFileSync(path, "utf8")),
  );
  if (protocol.benchmark.dataset_tag !== `v${protocol.benchmark.pypi_version}`) {
    throw new Error("Dataset tag and pinned CLI version disagree");
  }
  return protocol;
}

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
      `Main selection requires exactly ${protocol.scope.main_task_count} distinct task IDs`,
    );
  }
  const excluded = taskIds.filter((id) => pilotIds.includes(id));
  if (excluded.length) {
    throw new Error(`Main tasks overlap the development/pilot set: ${excluded.join(", ")}`);
  }
}
