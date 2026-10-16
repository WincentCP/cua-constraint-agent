import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { makeFreeze, sha256, verifyFreeze } from "./freeze.ts";
import { loadStudyProtocol } from "./study.ts";
import {
  loadPocManifest,
  loadPilotManifest,
  loadMainCandidateManifest,
} from "../webarena/specs.ts";
import { defaultScreeningPath, requireApprovedScreening } from "./screening.ts";
import { evaluatePilotGate } from "./pilot-gate.ts";

const DigestSchema = z
  .array(
    z
      .object({
        label: z.string().min(1),
        name: z.string().min(1),
        digest: z.string().regex(/^[a-f0-9]{64}$/i),
      })
      .strict(),
  )
  .length(4);

function data(path: string) {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;
}

function assertNonempty(path: string, label: string) {
  if (
    !existsSync(path) ||
    !statSync(path).isFile() ||
    statSync(path).size === 0
  ) {
    throw new Error("Missing " + label + ": " + path);
  }
}

function modelConfigs() {
  return z
    .array(z.object({ label: z.string(), name: z.string() }).strict())
    .length(4)
    .parse(data("config/models.json"));
}

function fingerprintFiles() {
  const paths = [
    "src/agent/runner.ts",
    "src/agent/ollama.ts",
    "src/core/policy.ts",
    "src/core/evidence.ts",
    "src/browser/accessibility.ts",
    "src/browser/session.ts",
    "src/experiment/results.ts",
  ];
  return Object.fromEntries(
    paths.map((path) => [path, sha256(readFileSync(path, "utf8"))]),
  );
}

export function currentStudyFingerprint() {
  return {
    study: sha256(loadStudyProtocol()),
    poc: sha256(loadPocManifest()),
    pilot: sha256(loadPilotManifest()),
    main_candidates: sha256(loadMainCandidateManifest()),
    code: fingerprintFiles(),
  };
}

export function readModelDigests(path: string) {
  const values = DigestSchema.parse(data(path));
  const configured = modelConfigs();
  if (new Set(values.map((entry) => entry.label)).size !== 4) {
    throw new Error("Duplicate model digests");
  }
  for (const model of configured) {
    const actual = values.find((entry) => entry.label === model.label);
    if (!actual || actual.name !== model.name) {
      throw new Error("Model digest list must match config/models.json");
    }
  }
  return values;
}

export function requireMainFreeze(path: string, selected: number[]) {
  assertNonempty(path, "main research freeze");
  const freeze = JSON.parse(readFileSync(path, "utf8")) as {
    identity?: Record<string, unknown>;
  };
  const identity = freeze.identity;
  if (!identity) throw new Error("Missing frozen study identity");
  // Integrity check and current-source agreement. No hidden evaluator answers.
  verifyFreeze(path, identity);
  const target = loadMainCandidateManifest()
    .tasks.map((task) => task.task_id)
    .sort((a, b) => a - b);
  const requested = selected.slice().sort((a, b) => a - b);
  if (
    JSON.stringify(target) !== JSON.stringify(requested) ||
    JSON.stringify(target) !== JSON.stringify(identity.task_ids)
  ) {
    throw new Error(
      "Main task IDs differ from the reviewed and frozen 32-candidate selection",
    );
  }
  if (sha256(currentStudyFingerprint()) !== sha256(identity.fingerprints)) {
    throw new Error("Code/protocol/task manifest changed after main freeze");
  }
  const reviewPath = defaultScreeningPath("main");
  assertNonempty(reviewPath, "main screening review");
  if (sha256(data(reviewPath)) !== identity.main_screening_sha256) {
    throw new Error("Main screening review changed after freeze");
  }
  return identity;
}

export function createApprovedMainFreeze(args: {
  experimentId: string;
  digestsPath: string;
  resetEvidencePath: string;
  approvedBy: string;
  approvalReference: string;
  pilotRoot?: string;
  mainReview?: string;
  catalogPath?: string;
}) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(args.experimentId)) {
    throw new Error("Invalid experiment ID");
  }
  if (!args.approvedBy.trim() || !args.approvalReference.trim()) {
    throw new Error("Supervisor sign-off name and reference are required");
  }
  const dest = join(
    "output",
    "main",
    args.experimentId,
    "research-freeze.json",
  );
  if (existsSync(dest))
    throw new Error("Research freeze already exists and cannot be overwritten");
  const catalog = args.catalogPath ?? "output/catalog/shopping-tasks.json";
  for (const stage of ["poc", "pilot", "main"] as const) {
    requireApprovedScreening(
      stage === "main"
        ? (args.mainReview ?? defaultScreeningPath(stage))
        : defaultScreeningPath(stage),
      stage,
      catalog,
    );
  }
  const models = modelConfigs();
  const result = evaluatePilotGate(args.pilotRoot ?? "output/pilot", models);
  if (result.status !== "PROVISIONAL_PASS") {
    throw new Error(
      "Pilot operational gate is not provisionally passed: " +
        result.completed_valid +
        "/48 valid",
    );
  }
  assertNonempty(args.resetEvidencePath, "site reset evidence");
  const modelDigests = readModelDigests(args.digestsPath);
  for (const episode of result.episodes.filter((item) => item.valid)) {
    const expected = modelDigests.find((item) => item.label === episode.model);
    if (!expected || episode.model_digest !== expected.digest.toLowerCase()) {
      throw new Error(
        "Pilot run used a model checkpoint different from proposed main freeze: " +
        episode.model + " / " + episode.task_id,
      );
    }
  }
  const taskIds = loadMainCandidateManifest()
    .tasks.map((task) => task.task_id)
    .sort((a, b) => a - b);
  const review = data(args.mainReview ?? defaultScreeningPath("main"));
  const identity = {
    task_ids: taskIds,
    fingerprints: currentStudyFingerprint(),
    main_screening_sha256: sha256(review),
    pilot_gate_summary: {
      status: result.status,
      valid: result.completed_valid,
      official_successes: result.official_successes,
    },
    model_digests: modelDigests,
    reset_evidence_sha256: sha256(readFileSync(args.resetEvidencePath, "utf8")),
    approved_by: args.approvedBy.trim(),
    approval_reference: args.approvalReference.trim(),
    budget: loadStudyProtocol().execution,
    note: "Supervisor signoff and manually reviewed UI evidence are attestations, not independently verified by CI.",
  };
  return { path: dest, freeze: makeFreeze(dest, identity) };
}
