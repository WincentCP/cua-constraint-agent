import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  WebArenaAgentResponseSchema,
  WebArenaConfigSchema,
  WebArenaTaskSchema,
  type WebArenaAgentResponse,
  type WebArenaConfig,
  type WebArenaTask,
} from "./schema.ts";

export function readTasks(path: string): WebArenaTask[] {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw)) throw new Error("WebArena task export must be an array");
  return raw.map((task) => WebArenaTaskSchema.parse(task));
}

export function readTask(path: string, taskId: number) {
  const task = readTasks(path).find((candidate) => candidate.task_id === taskId);
  if (!task) throw new Error(`Task ${taskId} not found in ${path}`);
  return task;
}

export function readConfig(path: string): WebArenaConfig {
  return WebArenaConfigSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

export function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function writeAgentResponse(
  outputRoot: string,
  taskId: number,
  response: WebArenaAgentResponse,
) {
  const parsed = WebArenaAgentResponseSchema.parse(response);
  const path = join(outputRoot, String(taskId), "agent_response.json");
  writeJson(path, parsed);
  return path;
}
