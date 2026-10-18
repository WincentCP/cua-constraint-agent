import { randomUUID, createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { openInspectionSession } from "../src/browser/session.ts";
import { OllamaModel } from "../src/agent/ollama.ts";
import { assertOfficialScore, assertPublicGoal, bridge, checkUpstream, execChecked } from "../src/openapps/bridge.ts";
import { pocTasks, requireLoopbackUrl, requirePocTask } from "../src/openapps/manifest.ts";
import { runDevelopmentLoop } from "../src/openapps/runner.ts";

function opt(name: string, fallback?: string) {
  const n = process.argv.indexOf("--" + name);
  return n < 0 ? fallback : process.argv[n + 1];
}
function flag(name: string) { return process.argv.includes("--" + name); }
function json(path: string, value: unknown) { writeFileSync(path, JSON.stringify(value, null, 2) + "\n"); }
function fingerprint(x: unknown) {
  return createHash("sha256").update(JSON.stringify(x)).digest("hex");
}
async function main() {
  const cmd = process.argv[2] || "doctor";
  if (cmd === "main-freeze" || cmd === "pilot") {
    throw new Error("BLOCKED: No 32 OpenApps task approvals, independent pilot, verified reset or supervisor signoff. Do not fabricate experiments.");
  }
  if (!["doctor", "smoke", "run"].includes(cmd))
    throw new Error("Expected doctor, smoke, or run");
  const openappsDir = resolve(opt("openapps-dir", join(process.env.USERPROFILE || process.env.HOME || ".", "OpenApps"))!);
  const url = requireLoopbackUrl(opt("url", "http://localhost:5001")!);
  const upstreamSha = checkUpstream(openappsDir);
  const settings = { openappsDir, url };
  if (cmd === "doctor") {
    console.log("PASS: Pinned OpenApps checkout " + upstreamSha);
    console.log("PoC candidates: " + pocTasks.map(x => x.key).join(", "));
    const models = JSON.parse(readFileSync("config/models.json", "utf8")) as Array<{label:string;name:string}>;
    console.log("Registered models: " + models.map(x=>x.label).join(", "));
    console.log("Live app and Ollama not asserted; run smoke and run separately.");
    return;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error("OpenApps homepage HTTP " + res.status);
  const goal = bridge(settings, "goal", { task: pocTasks[0].key });
  assertPublicGoal(goal);
  if (cmd === "smoke") {
    console.log("PASS: Live homepage and public task configuration.");
    console.log("Optional official component check: cd OpenApps; uv run python -m pytest tests/test_openbanking.py -q -x");
    console.log("NOT VERIFIED: end-to-end agent reward, paired reset, task suitability.");
    return;
  }
  const task = requirePocTask(opt("task", "")!);
  if (!flag("fresh-state-confirmed"))
    throw new Error("Must start a NEW pristine OpenApps environment and attest --fresh-state-confirmed. For PoC only; does not prove reset.");
  const policy = opt("method", "Baseline");
  if (policy !== "Baseline" && policy !== "Proposed") throw new Error("Invalid method");
  const modelLabel = opt("model-label", "granite4.1-8b");
  const models = JSON.parse(readFileSync("config/models.json", "utf8")) as Array<{label:string;name:string}>;
  const model = models.find(m=>m.label === modelLabel);
  if (!model) throw new Error("Unknown model label");
  const budget = Number(opt("max-steps", "16"));
  if (!Number.isInteger(budget) || budget < 1 || budget > 60)
    throw new Error("Invalid --max-steps");
  const publicGoal = assertPublicGoal(bridge(settings, "goal", { task: task.key }));
  const client = new OllamaModel(model.name);
  const digest = await client.resolveDigest();
  const id = randomUUID();
  const root = resolve("output", "openapps", "poc", id);
  mkdirSync(root, { recursive: true });
  const initial = bridge(settings, "initial");
  const initialPath = join(root, "initial_state.private.json");
  json(initialPath, initial);
  const metadata: Record<string, unknown> = {
    run_id: id, stage: "poc", task_key: task.key, task_family: task.family,
    method: policy, model_label: model.label, model_name: model.name, model_digest: digest,
    upstream_sha: upstreamSha, initial_state_sha256: fingerprint(initial),
    public_goal: publicGoal, browser_budget: budget, started_at: new Date().toISOString(),
    environment_reset_proof: "UNVERIFIED", official_success: null,
    result_type: "development_only",
  };
  json(join(root, "metadata.json"), metadata);
  const session = await openInspectionSession({ harPath: join(root, "network.har"), allowedOrigins: [url] });
  let failed: string | null = null;
  try {
    await session.goto(url);
    await session.page.screenshot({ path: join(root, "initial.png") });
    const outcome = await runDevelopmentLoop({
      page: session.page, model: client, policy, goal: publicGoal,
      constraints: task.constraints, budget,
      saveSnapshot(step, snapshot) {
        writeFileSync(join(root, "aria-" + String(step).padStart(3,"0") + ".yaml"), snapshot);
      },
      record(entry) {
        appendFileSync(join(root, "trace.jsonl"), JSON.stringify(entry) + "\n");
      },
    });
    metadata.agent_stats = outcome;
  } catch(e) {
    failed = e instanceof Error ? e.message : String(e);
    metadata.runner_error = failed;
    console.error("Agent error (still evaluating environment state): " + failed);
  } finally {
    try {
      await session.page.screenshot({ path: join(root, "final.png") });
      const score = bridge(settings, "evaluate", {
        task: task.key, initialFile: initialPath, pageUrl: session.page.url(),
      });
      metadata.official_success = assertOfficialScore(score) === 1;
      json(join(root, "official_result.json"), score);
    } catch (e) {
      metadata.evaluation_error = e instanceof Error ? e.message : String(e);
      console.error("OFFICIAL EVALUATOR ERROR: " + metadata.evaluation_error);
    }
    await session.close();
    metadata.finished_at = new Date().toISOString();
    metadata.run_complete = failed === null && typeof metadata.official_success === "boolean";
    json(join(root, "metadata.json"), metadata);
  }
  console.log("Development artifacts: " + root);
  console.log("Official success: " + String(metadata.official_success));
  if (!metadata.run_complete) process.exitCode = 2;
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
