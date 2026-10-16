import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { Page } from "playwright";
import { z } from "zod";
import { writeJson } from "../webarena/io.ts";

export const RunMetadataSchema = z
  .object({
    schema_version: z.literal(1),
    run_id: z.string().uuid(),
    stage: z.enum(["poc", "pilot", "main"]),
    task_id: z.number().int().nonnegative(),
    model_label: z.string().min(1),
    model_name: z.string().min(1),
    model_digest: z.string().regex(/^[a-f0-9]{64}$/i).nullable().optional(),
    method: z.enum(["Baseline", "Proposed"]),
    benchmark_version: z.string().min(1),
    git_commit: z.string().min(1),
    started_at: z.string().datetime(),
    ended_at: z.string().datetime().nullable(),
    duration_ms: z.number().nonnegative().nullable(),
    max_steps: z.number().int().positive(),
    steps_executed: z.number().int().nonnegative(),
    actions: z.number().int().nonnegative(),
    probes: z.number().int().nonnegative(),
    model_calls: z.number().int().nonnegative(),
    claimed_success: z.boolean(),
    execution_state: z.enum(["RUNNING", "COMPLETED", "ERROR"]),
    error_code: z.string().nullable(),
    official_status: z.string().nullable(),
    official_score: z.number().min(0).max(1).nullable(),
  })
  .strict();

export type RunMetadata = z.infer<typeof RunMetadataSchema>;

export type DecisionTrace = {
  event: "DECISION" | "FINAL" | "ERROR";
  at: string;
  step: number;
  page_url: string;
  observation_file: string | null;
  screenshot_file: string | null;
  constraints: Record<string, "UNKNOWN" | "SATISFIED" | "REFUTED">;
  eligible_probe_ids: string[];
  progress_scores: Record<string, number>;
  selected_probe_id: string | null;
  selected_probe_label: string | null;
  model_rationale: string;
  action: string | null;
  evidence_updates: Array<{
    constraint_id: string;
    state: "SATISFIED" | "REFUTED";
    quote: string;
  }>;
};

export class RunRecorder {
  readonly root: string;
  private metadata: RunMetadata;

  constructor(root: string, metadata: RunMetadata) {
    this.root = resolve(root);
    const existing = [
      "run_metadata.json",
      "trace.jsonl",
      "agent_response.json",
      "network.har",
      "eval_result.json",
    ];
    if (existing.some((name) => existsSync(join(this.root, name)))) {
      throw new Error(
        "Run artifacts already exist. Archive the prior run before attempting this task/model/method again.",
      );
    }
    mkdirSync(this.root, { recursive: true });
    this.metadata = RunMetadataSchema.parse(metadata);
    writeJson(join(this.root, "run_metadata.json"), this.metadata);
  }

  path(...parts: string[]) {
    return join(this.root, ...parts);
  }

  relative(path: string) {
    const result = relative(this.root, resolve(path)).split(sep).join("/");
    if (result.startsWith("..") || result.startsWith("/")) {
      throw new Error("Evidence path must stay inside the run directory");
    }
    return result;
  }

  async screenshot(page: Pick<Page, "screenshot">, filename: string) {
    if (!/^(initial|final|decision-\d{4})\.png$/.test(filename)) {
      throw new Error("Invalid screenshot filename");
    }
    const path = this.path("screenshots", filename);
    mkdirSync(this.path("screenshots"), { recursive: true });
    await page.screenshot({ path, fullPage: true, animations: "disabled" });
    return this.relative(path);
  }

  accessibility(step: number, value: string) {
    if (!Number.isInteger(step) || step < 0) throw new Error("Invalid step");
    const file = this.path(
      "accessibility",
      String(step).padStart(4, "0") + ".yaml",
    );
    mkdirSync(this.path("accessibility"), { recursive: true });
    writeFileSync(file, value, "utf8");
    return this.relative(file);
  }

  decision(event: DecisionTrace) {
    // No raw prompts, credentials or private evaluator expectations in traces.
    appendFileSync(
      this.path("trace.jsonl"),
      JSON.stringify(event) + "\n",
      "utf8",
    );
  }

  update(fields: Partial<RunMetadata>) {
    this.metadata = RunMetadataSchema.parse({ ...this.metadata, ...fields });
    writeJson(this.path("run_metadata.json"), this.metadata);
  }

  get summary() {
    return structuredClone(this.metadata);
  }
}
