# CUA Constraint Agent — WebArena-Verified Transition

This is the active research codebase for the thesis **Computer-Use Agent with Constraint-Directed Evidence Acquisition**.

The previous LEUCO synthetic e-commerce implementation is preserved on the `leuco-legacy` branch. `main` is intentionally focused on validating whether the research treatment can be transferred to an established benchmark before any new main experiment is frozen.

## Current research stage

**Stage 2–4 only: WebArena-Verified feasibility pilot.**

The repository currently supports:

- a generic evidence ledger (`SATISFIED` / `REFUTED` / `UNKNOWN`);
- capability-matched Baseline vs Proposed probe selection;
- official WebArena-Verified task input contracts;
- Playwright Accessibility Tree inspection and HAR recording;
- a pre-registered six-task pilot manifest;
- a pre-registered four-model manifest for the later main experiment;
- official WebArena-Verified CLI handoff for task export and evaluation;
- research-identity hashing/freeze utilities.

It **does not yet claim** that the six pilot tasks are suitable for the final experiment. Suitability must be established by running the pilot on the target device. Pilot output is not main-experiment data.

## Branches

- `main` — active WebArena-Verified research direction.
- `leuco-legacy` — complete snapshot of the former LEUCO implementation before migration.

## Device setup

Requirements:

- Windows 10/11 + PowerShell
- Node.js 24+
- Docker Desktop / WSL2
- `uv` / `uvx`
- Playwright Chromium
- Ollama is only required when model-driven pilot execution is added after feasibility is confirmed

```powershell
npm ci
npx playwright install chromium
Copy-Item config/webarena.example.json config/webarena.local.json
npm run webarena:doctor
npm run webarena:validate
```

## Stage 2 — primary PoC task 284

Start the official Shopping environment:

```powershell
uvx webarena-verified env start --site shopping
```

Export only public task input from the official benchmark:

```powershell
npm run webarena:prepare -- --task 284
```

Capture the initial Accessibility Tree, visible controls, constraint-hint mapping, and HAR trace:

```powershell
npm run webarena:inspect -- --task 284
```

Expected artifacts:

```text
output/pilot/
  tasks.json
  284/
    accessibility-1.yaml
    inspection.json
    network.har
```

`inspection.json` is diagnostic. A `may_answer` mapping is never treated as evidence.

## Stage 3 — six-task pilot

The pre-registered pilot IDs are:

```text
284, 323, 493, 523, 552, 562
```

They were chosen for feasibility auditing because their official tasks contain multiple requirements and objective evaluator outputs. They are **not automatically accepted as the final thesis subset**.

See `docs/EXPERIMENT.md`.

## Stage 4 — freeze only after pilot

If the pilot confirms construct validity, then and only then:

- choose the final held-out task subset;
- lock four models/configurations;
- lock Baseline/Proposed prompts and budgets;
- lock task annotations and evaluator versions;
- generate a research freeze before main data collection.

No main results should be collected from the current pilot configuration.

## Official WebArena-Verified outputs

The official evaluator expects, per task:

```text
<output-root>/<task-id>/
  agent_response.json
  network.har
```

After both exist:

```powershell
npm run webarena:evaluate -- --task 284
```

This calls the official `webarena-verified eval-tasks` CLI. Our research layer may add evidence/process metrics later, but it must not replace the official task-success evaluator.

## Verification

CI checks:

```powershell
npm run format:check
npm run build
npm test
npm run test:integration
npm run webarena:validate
```

The integration test launches Chromium locally against a synthetic `data:` page only to verify the Accessibility Tree + HAR plumbing. CI deliberately does **not** claim that WebArena task 284 has been solved; live benchmark execution requires the official Docker environment on the research device.
