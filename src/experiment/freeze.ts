import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeJson } from "../webarena/io.ts";

export type ResearchFreeze = {
  schema_version: 1;
  status: "FROZEN";
  created_at: string;
  identity: Record<string, unknown>;
  sha256: string;
};

export function canonicalJson(value: unknown): string {
  const visit = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(visit);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, child]) => [key, visit(child)]),
      );
    }
    return input;
  };
  return JSON.stringify(visit(value));
}

export function sha256(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function makeFreeze(
  path: string,
  identity: Record<string, unknown>,
): ResearchFreeze {
  const content = {
    schema_version: 1 as const,
    status: "FROZEN" as const,
    created_at: new Date().toISOString(),
    identity,
  };
  const freeze = { ...content, sha256: sha256(content) };
  writeJson(path, freeze);
  return freeze;
}

export function verifyFreeze(
  path: string,
  currentIdentity: Record<string, unknown>,
) {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as ResearchFreeze;
  const { sha256: stored, ...content } = parsed;
  if (sha256(content) !== stored) throw new Error("Freeze integrity mismatch");
  if (sha256(parsed.identity) !== sha256(currentIdentity)) {
    throw new Error("Current research identity differs from frozen identity");
  }
  return parsed;
}
