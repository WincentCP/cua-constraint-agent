# CUA Constraint Agent — WebArena-Verified Shopping Feasibility

Research prototype for **constraint-directed evidence acquisition in text/Accessibility-Tree Computer-Use Agents**.

**Current scope:** local WebArena-Verified **Shopping only**. LEUCO is historical work on the `leuco-legacy` branch; it is **not** used for main experimental scores.

## Current stage — PoC first, not main-data collection

The core evidence ledger, Baseline/Proposed probe ranking, browser inspection, official CLI handoff and reproducible artifact layout have been implemented. A **development-only single-task Ollama agent runner**, screenshot capture, decision traces, run metadata, official-result CSV exporter and Google Colab notebook are now included. **The runner has not been validated against live Shopping/Ollama on the target RTX 5060 device, and there is no approved unattended 48/256-run pipeline.** CI passing is not the same as solving task 284 live.

- PoC: inspect official Shopping task **284** (zero model runs during inspection), then separately build and test an end-to-end agent run.
- Pilot: six **Shopping-only candidate** tasks **279, 284, 323, 436, 506, 528** (six different public intent templates). Task eligibility is pending live review. Planned design: **6 × 4 models × 2 methods = 48 agent runs**.
- Main: supervisor-required **32 Shopping tasks**, different from pilot, selected by fixed public-UI suitability criteria **before** main data collection. Planned design: **32 × 4 × 2 = 256 agent runs**.
- The four 8–9B Q4_K_M models are candidates pending model-competence checks. The scientific treatment is **Baseline vs Proposed**; model is a robustness factor.
- WebArena-Verified supplies task instructions, environments and objective evaluation. **It does not supply the proposed method.**

The benchmark CLI is pinned to **WebArena-Verified v1.2.3** (see `config/study.json`). No hidden reference answers/evaluator expectations may enter agent observations, task annotations or prompt context.

## Setup and first PoC

On Windows PowerShell with Git, Node **24+**, Docker Desktop/WSL2, uvx and Playwright:

```powershell
git clone https://github.com/WincentCP/cua-constraint-agent.git
cd cua-constraint-agent
npm.cmd ci
npx.cmd playwright install chromium
Copy-Item config/webarena.example.json config/webarena.local.json
npm.cmd run webarena:doctor
npm.cmd run webarena:validate
```

Start **Shopping only**:

```powershell
uvx --from webarena-verified==1.2.3 webarena-verified env start --site shopping
uvx --from webarena-verified==1.2.3 webarena-verified env status --site shopping
```

Export public task instruction and inspect initial visible Accessibility Tree:

```powershell
npm.cmd run webarena:prepare -- --task 284 --stage poc
npm.cmd run webarena:inspect -- --task 284 --stage poc
```

Expected outputs (generated on device, not checked into Git):

```text
output/poc/
  stage-manifest.json
  task-inputs/284.json
  284/
    accessibility/01.yaml
    inspection.json
    inspection.har            # NOT the agent's network.har
    screenshots/start-01.png
reports/poc/
  poc-review.md               # manual PASS/MODIFY/REJECT checklist
  artifact-index.json
  artifact-index.csv
  stage-summary.md
```

Inspection does **not** produce `agent_response.json` or an official success score. The official evaluator requires a real agent run with `agent_response.json` + `network.har` and writes `eval_result.json`.

```powershell
uvx --from webarena-verified==1.2.3 webarena-verified env stop --site shopping
```

**Stop for PoC review before launching pilot.** See [docs/SETUP.md](docs/SETUP.md), [docs/EXPERIMENT.md](docs/EXPERIMENT.md), [docs/ARTIFACTS.md](docs/ARTIFACTS.md) and [docs/STATUS.md](docs/STATUS.md).

## Later stages (not commands to run yet)

```powershell
npm.cmd run webarena:catalog
npm.cmd run artifacts:init -- --stage pilot
npm.cmd run pilot:gate
```

The catalog exports only public Shopping task inputs; it **does not** automatically approve task eligibility. Pilot run directories can be scaffolded, but run/evaluation artifacts require the future agent runner. The gate prints FAIL when no valid runs exist, never an invented pass.

## Local tests and CI

```powershell
npm.cmd run format:check
npm.cmd run build
npm.cmd test
npm.cmd run test:integration
npm.cmd run webarena:validate
```

CI covers code, schemas, artifact generation and browser/HAR plumbing against a local test page. **It cannot validate actual Shopping Docker or Ollama performance on your device.**

Large/raw `output/`, `reports/`, and machine-specific `config/webarena.local.json` are gitignored. Back up these folders separately. Do not publicly share HAR files containing authentication/session details.

## Evidence, agent development and Bab IV exports (NEW)

- PoC inspection now also saves a **real PNG screenshot**.
- The single-task development runner calls a local Ollama model, uses the **same model prompt and eligible actions** for Baseline and Proposed, records decision traces/evidence and bounded screenshots, and can invoke the official evaluator. The only implemented method switch is the probe-ranking rule. Real-world effectiveness/fairness remains subject to live validation.
- Every run has run_metadata.json, trace.jsonl, accessibility snapshots, screenshot checkpoints, agent_response.json, network.har, and optionally official eval_result.json.
- The results exporter emits an inventory of **all** expected cells (including missing runs) plus analysis-results.csv containing **only valid official results**. Never treat absent runs as failures.
- The Colab notebook notebooks/thesis_analysis.ipynb turns sanitized CSVs into PNG/PDF figures, descriptive tables, and exact paired McNemar tests (main only, once all 256 are complete).

After successful PoC inspection, local Docker reset confirmation, and Ollama setup, one **development-only** episode can be attempted:

```powershell
npm.cmd run agent:run -- --stage poc --task 284 --model-label qwen3.5-9b --method Baseline --max-steps 16 --evaluate
```

PoC agent outputs are stored under output/poc/runs/<model>/<method>/<task-id>/, separate from inspection evidence. The corresponding Proposed episode needs a **fresh site reset**, not just a fresh browser tab.

Once real, approved pilot data exist:

```powershell
npm.cmd run results:export -- --stage pilot
```

Then upload reports/pilot/run-inventory.csv and analysis-results.csv into the notebook. For main, use `--stage main --experiment-id <id>` **only after main study freeze and complete results**.

Read [docs/EVIDENCE_PROTOCOL.md](docs/EVIDENCE_PROTOCOL.md) for figure conventions, security, and honest experimental evidence boundaries.
