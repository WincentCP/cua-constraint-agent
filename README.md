# Constraint-Directed Computer-Use Agent

Controlled research system comparing **Baseline generic probe selection** with **Proposed UNKNOWN-coverage selection**. Both receive the same goal, public Accessibility Tree, evidence ledger, eligible probes, model, budget, executor and verifier. Only the probe-selection rule differs.

The approved methodology is [PRD-FINAL](docs/PRD-FINAL.md). Main evaluation contains **32 base tasks × 2 policies = 64 runs**: 16 solvable (8 single-feasible, 8 multi-feasible), 8 no-solution, and 8 unavailable-evidence. Initial information is grouped into U2/U3/U4 (11/10/11 tasks).

This is a local CLI research tool with a synthetic website in isolated Chromium. It does not include a participant study, voice interface, payment flow, or production deployment.

## Setup and engineering checks

Requires Node.js 24+, npm and Git. Real-model runs additionally require Ollama with `qwen2.5:7b`.

```powershell
npm ci
npx playwright install chromium
npm run build
npm test
npm run test:integration
npm run experiment -- validate
npm run experiment -- main --demo --out exports/demo-main-v1
```

Demo uses a deterministic test double and is **not research data**. Use a fresh output directory for each experiment.

To inspect the redesigned LEUCO kaos storefront manually with an isolated development task:

```powershell
npm run preview -- --task development-01 --port 4173
```

Open `http://127.0.0.1:4173`. This preview is for UI inspection only and is not research data.

## Research workflow

Start Ollama, then:

```powershell
ollama pull qwen2.5:7b
npm run experiment -- doctor
npm run experiment -- development --out exports/development-v1
npm run experiment -- repeatability --out exports/repeatability-v1
npm run experiment -- gate --input exports/repeatability-v1
```

After the gate passes, commit the validated source/configuration/tests, freeze, then collect main data:

```powershell
npm run experiment -- freeze --gate exports/repeatability-v1 --out exports/freeze-v1.json
npm run experiment -- main --freeze exports/freeze-v1.json --out exports/main-v1
npm run experiment -- export --input exports/main-v1
```

See [SETUP](docs/SETUP.md), [EXPERIMENT](docs/EXPERIMENT.md), and [STATUS](docs/STATUS.md) for prerequisites, interpretation and observed validation evidence.

## Evaluation and outputs

The independent evaluator runs after the agent outcome and browser world are frozen. Successful ACT requires a correct final cart **and valid public evidence for all four constraints before dispatch**. Correct abstentions require public support. Healthy budget exhaustion counts as failure; infrastructure failures are recorded separately.

Each experiment writes `experiment.json`, `journal.jsonl`, `events.jsonl`, `episodes.jsonl`, `episodes.csv`, `metrics.json`, `metrics.csv`, `paired-probes.csv`, and `failures.json`. On completion or a handled interruption it also writes `report.html` and `report.md`. Public UI screenshots are stored under `screenshots/<attempt-id>/`. Original attempts are retained. Primary comparison uses the earliest complete infrastructure-free pair, and probe efficiency uses only jointly correct pairs.

Open `report.html` in a browser for the tables and screenshot gallery. Regenerate a report from existing final-contract data with:

```powershell
npm run experiment -- report --input exports/demo-main-v1
```

Demo reports are explicitly labeled and can illustrate implementation in a thesis, but their metrics must not be presented as real-model research findings. Keep the whole output directory together so image links remain valid.

## Code boundaries

| Directory               | Responsibility                                                        |
| ----------------------- | --------------------------------------------------------------------- |
| `src/environment`       | Private fixture generator and isolated synthetic HTTP world           |
| `src/browser`           | Public Accessibility Tree observation, controls and cart verifier     |
| `src/core`              | Goal schema, evidence, common budget and policy selection             |
| `src/agent`             | Shared execution loop and Ollama structured-output planner            |
| `src/evaluation`        | Offline oracle validating observations against private specifications |
| `src/experiment`        | Manifest, recorder, paired metrics, development gate and freeze       |
| `scripts/experiment.ts` | CLI entry point                                                       |
| `tests`                 | Unit, browser integration and research-invariant tests                |

Generated artifacts, dependencies and models are excluded from Git. Existing ignored outputs from older designs are not evidence for this PRD.
