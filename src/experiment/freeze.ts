import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { totalmem, freemem, cpus } from "node:os";
import { chromium } from "playwright";
import { config, hash, localEndpoint } from "../core/config.ts";
import {
  mainTasks,
  developmentTasks,
  validateDataset,
} from "../environment/dataset.ts";
import { manifest } from "./manifest.ts";
import { selectedPairs, type Row } from "./metrics.ts";
import {
  readJson,
  readLines,
  writeJson,
  validateExperiment,
  type Experiment,
} from "./runner.ts";

export function hardwareStatus() {
  return {
    total_ram_gib: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
    free_ram_gib: Math.round((freemem() / 1024 ** 3) * 10) / 10,
    logical_cpus: cpus().length,
    inference_tested: false,
  };
}
export function sourceIdentity() {
  const rootPath = process.cwd(),
    files: string[] = [];
  const visit = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const p = join(path, entry.name);
      if (entry.isDirectory()) visit(p);
      else if (entry.isFile()) files.push(p);
    }
  };
  for (const path of ["src", "scripts", "tests", "config"])
    visit(join(rootPath, path));
  for (const path of [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "docs/PRD-FINAL.md",
    "docs/EXPERIMENT.md",
    "docs/LLM-BENCHMARK.md",
  ])
    files.push(join(rootPath, path));
  const sources = Object.fromEntries(
    files
      .sort()
      .map((path) => [
        relative(rootPath, path).replaceAll("\\", "/"),
        createHash("sha256").update(readFileSync(path)).digest("hex"),
      ]),
  );
  return { hash: hash(sources), files: sources };
}
export async function runtimeIdentity(endpoint: string, demo = false) {
  endpoint = localEndpoint(endpoint);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
  });
  let browserVersion: string;
  try {
    browserVersion = browser.version();
  } finally {
    await browser.close();
  }
  const environment = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    browser: browserVersion,
    headless: true,
    executable: process.env.CHROMIUM_PATH ?? "playwright-managed",
  };
  if (demo)
    return {
      environment,
      model: { demo: true },
      source: sourceIdentity().hash,
      dataset: hash({ mainTasks, developmentTasks }),
      config: hash(config),
    };
  const get = async (path: string) => {
    const response = await fetch(endpoint + path, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error(`Ollama ${path}: HTTP ${response.status}`);
    return response.json() as Promise<any>;
  };
  const [tags, version] = await Promise.all([
    get("/api/tags"),
    get("/api/version"),
  ]);
  const model = tags.models?.find(
    (m: any) => m.name === config.model.name || m.model === config.model.name,
  );
  if (!model?.digest)
    throw Error(
      `Install the configured model first: ollama pull ${config.model.name}`,
    );
  return {
    environment,
    model: {
      name: config.model.name,
      digest: model.digest,
      provider: "Ollama",
      version: version.version,
      endpoint,
    },
    source: sourceIdentity().hash,
    dataset: hash({ mainTasks, developmentTasks }),
    config: hash(config),
  };
}
export type Identity = Awaited<ReturnType<typeof runtimeIdentity>>;
export function assertIdentity(expected: unknown, actual: unknown) {
  if (hash(expected) !== hash(actual))
    throw Error(
      "Frozen source, dataset, config, model or runtime changed; use a new development cycle",
    );
}
export function developmentGate(out: string) {
  const experiment = readJson<Experiment>(join(out, "experiment.json")),
    rows = readLines<Row>(join(out, "episodes.jsonl")),
    problems: string[] = [];
  validateExperiment(experiment);
  if (
    rows.some(
      (r) =>
        r.experiment_id !== experiment.id ||
        r.config_hash !== experiment.config_hash ||
        r.demo !== experiment.demo,
    )
  )
    problems.push("Attempt identity differs from gate experiment");
  if (experiment.demo || rows.some((r) => r.demo))
    problems.push("Demo cannot satisfy research gate");
  if (experiment.mode !== "repeatability")
    problems.push("Gate requires repeatability experiment");
  if (hash(experiment.plan) !== hash(manifest("repeatability")))
    problems.push("Development manifest differs");
  const pairs = selectedPairs(rows, experiment.plan);
  if (pairs.some((p) => p.attempt === null))
    problems.push("Missing healthy development pairs");
  const selected = pairs.flatMap((p) =>
    p.Baseline && p.Proposed ? [p.Baseline, p.Proposed] : [],
  );
  const competent = new Set(
    selected
      .filter(
        (r) =>
          r.cell.policy === "Baseline" &&
          r.task.type === "solvable" &&
          r.evaluation.vda === 1 &&
          r.evaluation.probe_count >= 2,
      )
      .map((r) => r.cell.base),
  );
  if (competent.size < 3)
    problems.push(
      "Baseline must solve at least 3 distinct multi-probe development tasks",
    );
  for (const base of new Set(experiment.plan.map((c) => c.base)))
    for (const policy of ["Baseline", "Proposed"]) {
      const attempts = selected.filter(
        (r) => r.cell.base === base && r.cell.policy === policy,
      );
      const signatures = attempts.map((r) =>
        hash({
          outcome: r.evaluation.outcome,
          probes: r.events
            .filter((e) => e.type === "PROBE_SELECTION")
            .map((e) => e.data.selected.id),
        }),
      );
      if (attempts.length !== 3 || new Set(signatures).size !== 1)
        problems.push(
          `Unstable or missing repeated trajectory: ${base}/${policy}`,
        );
    }
  if (
    selected.some(
      (r) =>
        r.evaluation.outcome === "BUDGET_EXHAUSTED" ||
        r.outcome.counters.invalid_outputs > 0,
    )
  )
    problems.push("Development budget/schema needs review");
  return {
    passed: problems.length === 0,
    problems,
    baseline_competent_tasks: [...competent],
    selected_runs: selected.length,
    identity: experiment.identity,
    experiment_id: experiment.id,
    evidence_hash: hash(rows),
    criteria: {
      distinct_baseline_multi_probe_successes: 3,
      repeats: 3,
      exact_trajectory_repeatability: true,
      no_budget_or_schema_failures: true,
    },
  };
}
export function makeFreeze(gateOut: string, out: string, identity: Identity) {
  if (existsSync(out)) throw Error("Freeze destination already exists");
  const gate = developmentGate(gateOut);
  if (!gate.passed)
    throw Error(`Development gate failed: ${gate.problems.join("; ")}`);
  assertIdentity(gate.identity, identity);
  const validation = validateDataset();
  if (!validation.passed) throw Error(validation.errors.join("; "));
  const dirty = execFileSync(
    "git",
    [
      "status",
      "--porcelain",
      "--",
      "src",
      "scripts",
      "tests",
      "config",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "docs/PRD-FINAL.md",
      "docs/EXPERIMENT.md",
      "docs/LLM-BENCHMARK.md",
    ],
    { encoding: "utf8" },
  ).trim();
  if (dirty)
    throw Error(
      "Commit the validated research code/config/tests before freezing",
    );
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const content = {
    schema_version: 1,
    created: new Date().toISOString(),
    commit,
    identity,
    sources: sourceIdentity(),
    config,
    main_manifest: manifest("main"),
    validation,
    gate,
    rerun_rule:
      "Earliest complete infrastructure-free pair; rerun both policies only after infrastructure failure; preserve all attempts",
  };
  const frozen = { id: hash(content), ...content };
  writeJson(out, frozen);
  return frozen;
}
export function verifyFreeze(path: string, identity: Identity) {
  const frozen = readJson(path),
    { id, ...content } = frozen;
  if (hash(content) !== id) throw Error("Freeze file integrity mismatch");
  assertIdentity(frozen.identity, identity);
  if (
    !frozen.gate?.passed ||
    frozen.gate.identity?.model?.demo ||
    hash(frozen.main_manifest) !== hash(manifest("main"))
  )
    throw Error("Invalid research freeze");
  return frozen;
}
