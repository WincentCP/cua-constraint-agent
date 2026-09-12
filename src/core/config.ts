import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";

export const ConfigSchema = z
  .object({
    version: z.literal("final-2026-09-10"),
    model: z
      .object({
        name: z.string().min(1),
        temperature: z.literal(0),
        seed: z.number().int(),
        num_ctx: z.number().int().positive(),
        num_predict: z.number().int().positive(),
      })
      .strict(),
    budget: z
      .object({
        probes: z.number().int().positive(),
        actions: z.number().int().positive(),
        model_calls: z.number().int().positive(),
        deadline_ms: z.number().int().positive(),
        action_ms: z.number().int().positive(),
        model_ms: z.number().int().positive(),
        recoveries: z.literal(1),
      })
      .strict(),
    order_seed: z.number().int(),
    reporting: z.object({ screenshots: z.boolean() }).strict(),
  })
  .strict();
export type Config = z.infer<typeof ConfigSchema>;
export const config = ConfigSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../../config/experiment.json", import.meta.url),
      "utf8",
    ),
  ),
);
export const hash = (value: unknown) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
export function localEndpoint(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) ||
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash
  )
    throw Error("Model endpoint must be a local HTTP origin");
  return u.origin;
}
