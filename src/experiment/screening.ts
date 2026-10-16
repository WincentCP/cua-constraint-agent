import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { z } from "zod";
import { sha256 } from "./freeze.ts";
import { loadStudyProtocol } from "./study.ts";
import { loadPocManifest, loadPilotManifest, loadMainCandidateManifest } from "../webarena/specs.ts";
import { readTasks } from "../webarena/io.ts";

export type ScreeningStage = "poc" | "pilot" | "main";

const CheckSchema = z.object({
  official_task_and_evaluator: z.boolean(),
  public_constraints_grounded: z.boolean(),
  two_meaningful_evidence_choices: z.boolean(),
  visible_ui_evidence: z.boolean(),
  actions_supported: z.boolean(),
  repeatable_site_reset: z.boolean(),
  shared_method_conditions: z.boolean(),
  no_hidden_answer_leak: z.boolean(),
}).strict();

const RowSchema = z.object({
  task_id: z.number().int().nonnegative(),
  intent_template_id: z.number().int().nonnegative(),
  decision: z.enum(["PENDING", "PASS", "REJECT"]),
  public_constraints: z.array(z.string()),
  evidence_choices: z.array(z.string()),
  checks: CheckSchema,
  evidence_files: z.array(z.string()),
  reviewer: z.string(),
  notes: z.string(),
}).strict();

export const ScreeningSchema = z.object({
  schema_version: z.literal(1),
  stage: z.enum(["poc", "pilot", "main"]),
  dataset_tag: z.string(),
  created_at: z.string().datetime(),
  tasks: z.array(RowSchema),
}).strict();

export type ScreeningReview = z.infer<typeof ScreeningSchema>;
type TaskIdentity = { task_id: number; intent_template_id: number; public_intent: string };

export function stageTasks(stage: ScreeningStage): TaskIdentity[] {
  if (stage === "poc") return loadPocManifest().tasks;
  if (stage === "pilot") return loadPilotManifest().tasks;
  return loadMainCandidateManifest().tasks;
}

export function defaultScreeningPath(stage: ScreeningStage) {
  if (stage === "main") return join("reports", "task-screening", "main-review.json");
  return join("reports", stage, stage + "-screening.json");
}

export function generateScreening(stage: ScreeningStage): ScreeningReview {
  const protocol = loadStudyProtocol();
  return {
    schema_version: 1,
    stage,
    dataset_tag: protocol.benchmark.dataset_tag,
    created_at: new Date().toISOString(),
    tasks: stageTasks(stage).map((task) => ({
      task_id: task.task_id,
      intent_template_id: task.intent_template_id,
      decision: "PENDING",
      public_constraints: [],
      evidence_choices: [],
      checks: {
        official_task_and_evaluator: false,
        public_constraints_grounded: false,
        two_meaningful_evidence_choices: false,
        visible_ui_evidence: false,
        actions_supported: false,
        repeatable_site_reset: false,
        shared_method_conditions: false,
        no_hidden_answer_leak: false,
      },
      evidence_files: [],
      reviewer: "",
      notes: "",
    })),
  };
}

export function writeScreeningDraft(stage: ScreeningStage, path: string) {
  const target = resolve(path);
  if (existsSync(target)) throw new Error("Review already exists; refusing to overwrite " + target);
  const draft = generateScreening(stage);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(draft, null, 2) + "\n", "utf8");
  return draft;
}

export function inspectScreening(
  path: string,
  stage: ScreeningStage,
  catalogPath?: string,
  projectRoot = process.cwd(),
) {
  const review = ScreeningSchema.parse(JSON.parse(readFileSync(resolve(path), "utf8")));
  const registered = stageTasks(stage);
  const protocol = loadStudyProtocol();
  if (review.stage !== stage || review.dataset_tag !== protocol.benchmark.dataset_tag ||
      review.tasks.length !== registered.length) {
    throw new Error("Screening stage, version, or task count mismatch");
  }
  const byId = new Map(registered.map((task) => [task.task_id, task]));
  const seen = new Set<number>();
  const failures: Array<{ task_id: number; reasons: string[] }> = [];

  let official = new Map<number, ReturnType<typeof readTasks>[number]>();
  if (catalogPath) {
    official = new Map(readTasks(resolve(catalogPath)).map((task) => [task.task_id, task]));
  }

  for (const row of review.tasks) {
    const spec = byId.get(row.task_id);
    if (!spec || seen.has(row.task_id) || spec.intent_template_id !== row.intent_template_id) {
      throw new Error("Review uses unregistered, duplicate, or changed task/template ID");
    }
    seen.add(row.task_id);
    const reasons: string[] = [];
    if (!catalogPath) reasons.push("OFFICIAL_CATALOG_NOT_PROVIDED");
    else {
      const task = official.get(row.task_id);
      if (!task || task.intent_template_id !== spec.intent_template_id ||
          task.intent !== spec.public_intent ||
          task.sites.length !== 1 || task.sites[0] !== "shopping") {
        reasons.push("OFFICIAL_TASK_MISMATCH");
      }
    }
    if (row.decision !== "PASS") reasons.push("NOT_APPROVED");
    if (row.public_constraints.length < protocol.suitability.min_required_constraints ||
        new Set(row.public_constraints.map((x) => x.trim().toLowerCase())).size !== row.public_constraints.length ||
        row.public_constraints.some((x) => x.trim().length < 8)) {
      reasons.push("PUBLIC_REQUIREMENTS_NOT_DOCUMENTED");
    }
    if (row.evidence_choices.length < protocol.suitability.min_information_choices ||
        new Set(row.evidence_choices.map((x) => x.trim().toLowerCase())).size !== row.evidence_choices.length ||
        row.evidence_choices.some((x) => x.trim().length < 8)) {
      reasons.push("MEANINGFUL_CHOICES_NOT_DOCUMENTED");
    }
    for (const [key, passed] of Object.entries(row.checks)) {
      if (!passed) reasons.push("CHECK_FAILED_" + key.toUpperCase());
    }
    if (!row.reviewer.trim() || row.notes.trim().length < 20) {
      reasons.push("REVIEWER_OR_RATIONALE_MISSING");
    }
    if (!row.evidence_files.length) reasons.push("EVIDENCE_FILES_MISSING");
    for (const file of row.evidence_files) {
      const root = resolve(projectRoot);
      const full = resolve(root, file);
      if (isAbsolute(file) || !(full.startsWith(root + sep)) ||
          !existsSync(full) || !statSync(full).isFile() || statSync(full).size === 0) {
        reasons.push("EVIDENCE_FILE_INVALID");
      }
    }
    if (reasons.length) failures.push({ task_id: row.task_id, reasons });
  }
  const approved = failures.length === 0;
  return { approved, expected: registered.length, reviewed: review.tasks.length, failures, review, review_sha256: sha256(review) };
}

export function requireApprovedScreening(
  path: string, stage: ScreeningStage, catalogPath: string, projectRoot = process.cwd(),
) {
  const result = inspectScreening(path, stage, catalogPath, projectRoot);
  if (!result.approved) {
    throw new Error(
      stage + " screening has not passed (" + result.failures.length + " tasks incomplete). " +
      result.failures.slice(0, 3).map((x) => x.task_id + ":" + x.reasons.join("+")).join("; "),
    );
  }
  return result;
}
