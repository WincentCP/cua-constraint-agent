import { z } from "zod";

export interface ModelClient {
  complete(system: string, user: string): Promise<string>;
}

export const AgentPlanSchema = z
  .object({
    progress_scores: z.record(z.number().finite()).default({}),
    input_text_by_probe: z.record(z.string()).default({}),
    evidence: z
      .array(
        z.object({
          constraint_id: z.string(),
          state: z.enum(["SATISFIED", "REFUTED"]),
          quote: z.string().min(1),
        }),
      )
      .default([]),
    finish: z.boolean(),
    final_response: z.unknown().optional(),
    rationale: z.string().default(""),
  })
  .strict();

export type AgentPlan = z.infer<typeof AgentPlanSchema>;

// A local model may explicitly report that a public constraint is still
// UNKNOWN. That is *not an evidence claim*, and blank quotes are likewise not
// evidence. Normalize only these empty/unverified entries, while retaining the
// strict schema for verified evidence and all other fields. Same parser for
// both Baseline and Proposed.
const ModelOutputSchema = AgentPlanSchema.extend({
  evidence: z
    .array(
      z.object({
        constraint_id: z.string(),
        state: z.enum(["SATISFIED", "REFUTED", "UNKNOWN"]),
        quote: z.string().default(""),
      }),
    )
    .default([]),
});

export function parseAgentPlan(raw: string): AgentPlan {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start)
    throw new Error("Model did not return a JSON object");
  const candidate = ModelOutputSchema.parse(JSON.parse(raw.slice(start, end + 1)));
  const evidence = candidate.evidence.filter(
    (entry) => entry.state !== "UNKNOWN" && entry.quote.trim().length > 0,
  );
  return AgentPlanSchema.parse({ ...candidate, evidence });
}

export class OllamaModel implements ModelClient {
  constructor(
    readonly model: string,
    readonly endpoint = "http://127.0.0.1:11434",
    readonly timeoutMs = 120_000,
  ) {
    const url = new URL(endpoint);
    if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
      throw new Error("Only a local Ollama endpoint is supported");
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid Ollama protocol");
    }
  }

  async resolveDigest(): Promise<string> {
    let response: Response;
    try {
      response = await fetch(new URL("/api/tags", this.endpoint), {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new Error(
        "Cannot reach local Ollama at " +
          this.endpoint +
          "; verify that Ollama is running (ollama list). " +
          String(error),
      );
    }
    if (!response.ok) {
      throw new Error("Ollama model list failed: HTTP " + response.status);
    }
    const catalog = (await response.json()) as {
      models?: Array<{ name?: string; model?: string; digest?: string }>;
    };
    const entry = catalog.models?.find(
      (candidate) =>
        candidate.name === this.model || candidate.model === this.model,
    );
    if (!entry?.digest || !/^[a-f0-9]{64}$/i.test(entry.digest)) {
      throw new Error(
        "Local Ollama model missing or digest unavailable: " +
          this.model +
          ". Check ollama list and registered tag.",
      );
    }
    return entry.digest.toLowerCase();
  }

  async complete(system: string, user: string) {
    let response: Response;
    try {
      response = await fetch(new URL("/api/chat", this.endpoint), {
        method: "POST",
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: "json",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          options: { temperature: 0 },
        }),
      });
    } catch (error) {
      throw new Error(
        "Ollama completion unavailable at " +
          this.endpoint +
          " (check server, VRAM and model availability): " +
          String(error),
      );
    }
    if (!response.ok) {
      throw new Error(
        "Ollama HTTP " +
          response.status +
          ": " +
          (await response.text()).slice(0, 350),
      );
    }
    const parsed = (await response.json()) as {
      message?: { content?: string };
    };
    if (!parsed.message?.content) throw new Error("Empty Ollama response");
    return parsed.message.content;
  }
}
