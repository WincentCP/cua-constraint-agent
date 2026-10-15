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

export function parseAgentPlan(raw: string): AgentPlan {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start)
    throw new Error("Model did not return a JSON object");
  return AgentPlanSchema.parse(JSON.parse(raw.slice(start, end + 1)));
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

  async complete(system: string, user: string) {
    const response = await fetch(new URL("/api/chat", this.endpoint), {
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
