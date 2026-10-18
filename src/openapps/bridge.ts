import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type OpenAppsSettings = {
  openappsDir: string;
  url: string;
};

export function execChecked(command: string, args: string[], cwd: string, timeout = 180_000) {
  const run = spawnSync(command, args, {
    cwd,
    shell: false,
    windowsHide: true,
    encoding: "utf8",
    timeout,
    env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8",
      USER: process.env.USER || process.env.USERNAME || "researcher" },
  });
  if (run.error || run.status !== 0) {
    throw new Error(command + " " + args.slice(0, 3).join(" ") + " failed: " +
      String(run.error ?? run.stderr ?? run.stdout).slice(0, 1200));
  }
  return String(run.stdout).trim();
}

export function checkUpstream(dir: string) {
  const full = resolve(dir);
  if (!existsSync(resolve(full, "config/tasks/openbanking.yaml")))
    throw new Error("OpenApps repository not found at " + full);
  const expected = JSON.parse(readFileSync("config/openapps.json", "utf8")) as { upstream_commit: string };
  const actual = execChecked("git", ["rev-parse", "HEAD"], full, 10_000);
  if (actual !== expected.upstream_commit)
    throw new Error("OpenApps SHA mismatch: expected " + expected.upstream_commit +
      ", actual " + actual + ". Run git checkout of the pinned commit in OpenApps.");
  return actual;
}

export function bridge(settings: OpenAppsSettings, command: "goal" | "initial" | "evaluate",
  options: { task?: string; initialFile?: string; pageUrl?: string } = {}) {
  const runner = resolve("scripts/openapps_bridge.py");
  const args = ["run", "python", runner, command, "--url", settings.url];
  if (options.task) args.push("--task", options.task);
  if (options.initialFile) args.push("--initial-file", options.initialFile);
  if (options.pageUrl) args.push("--page-url", options.pageUrl);
  const raw = execChecked("uv", args, resolve(settings.openappsDir));
  try { return JSON.parse(raw) as Record<string, unknown>; }
  catch { throw new Error("Bridge returned invalid JSON: " + raw.slice(0, 300)); }
}

export function assertPublicGoal(result: Record<string, unknown>): string {
  if (typeof result.goal !== "string" || result.goal.length < 8)
    throw new Error("OpenApps public task goal unavailable");
  return result.goal;
}

export function assertOfficialScore(result: Record<string, unknown>): number {
  if (result.evaluator !== "OpenApps Task.check_if_task_is_complete" ||
      (result.reward !== 0 && result.reward !== 1) ||
      result.success !== (result.reward === 1)) {
    throw new Error("Invalid OpenApps evaluation result");
  }
  return Number(result.reward);
}

// When execution crashes, its post-error app reward is useful diagnostic
// context but MUST NOT enter the valid experimental success column.
export function classifyEpisodeScore(
  result: Record<string, unknown>,
  runnerError: string | null,
): { officialSuccess: boolean | null; diagnosticReward: number | null } {
  const reward = assertOfficialScore(result);
  return runnerError === null
    ? { officialSuccess: reward === 1, diagnosticReward: null }
    : { officialSuccess: null, diagnosticReward: reward };
}
