import { config } from "../core/config.ts";
import { type Policy } from "../core/types.ts";
import {
  mainTasks,
  developmentTasks,
  shuffle,
  rng,
  type Task,
} from "../environment/dataset.ts";

export type Cell = {
  base: string;
  policy: Policy;
  pair: string;
  repeat: number;
};
export function manifest(
  mode: "main" | "development" | "repeatability",
): Cell[] {
  const random = rng(config.order_seed),
    tasks =
      mode === "main"
        ? mainTasks
        : mode === "repeatability"
          ? developmentTasks.slice(0, 6)
          : developmentTasks;
  const repeats = mode === "repeatability" ? 3 : 1,
    result: Cell[] = [];
  for (let repeat = 1; repeat <= repeats; repeat++)
    for (const task of shuffle(tasks, random)) {
      const policies: Policy[] =
        random() < 0.5 ? ["Baseline", "Proposed"] : ["Proposed", "Baseline"];
      result.push(
        ...policies.map((policy) => ({
          base: task.id,
          policy,
          pair: `${task.id}:r${repeat}`,
          repeat,
        })),
      );
    }
  return result;
}
export const taskMetadata = (t: Task) => ({
  base: t.id,
  split: t.split,
  type: t.type,
  subtype: t.subtype,
  unknown: t.unknown,
});
