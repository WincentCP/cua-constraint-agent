# CUA Constraint Agent — WebArena-Verified Shopping study

Research prototype comparing **Baseline** versus **constraint-directed evidence acquisition (Proposed)** in text/Accessibility-Tree computer-use agents. The benchmark supplies public tasks, the Shopping website and the official evaluator; the research method is implemented in this repository.

## Research design (registered candidates; not completed runs)

| Stage | Official task IDs | Use |
|---|---|---|
| **PoC (3)** | **279, 284, 528** | Development/debugging: retrieval, product comparison, draft form |
| **Pilot (6)** | **96, 323, 436, 506, 571, 689** | Feasibility on 4 models × 2 methods = **48 runs** |
| **Main (32)** | See [config/main-candidates.json](config/main-candidates.json) | Held-out candidates on 4 models × 2 methods = **256 runs**, **NOT yet approved or frozen** |

All 41 task IDs are distinct. The **32 main candidates also use templates disjoint from PoC and pilot**, reducing development–test leakage. All 41 candidates are sourced from the **official WebArena-Verified v1.2.3 public Shopping task dataset**. No hidden evaluator reference answers are included in manifests or agent prompts.

Main candidate groups (8 each): product navigation/filtering, product comparison, order retrieval, and reviews/form/account mutations. Individual candidate suitability is **UNREVIEWED** until live UI evidence confirms ≥3 meaningful public constraints and ≥2 distinct evidence-acquisition choices, browser action support, site reset and official evaluation. **All 32 must pass to freeze this exact set**; if not, consult the supervisor and revise the preregistered design *before* main outcomes.

## What works in code, and what does not

Implemented: public task metadata checks, stage isolation, a shared Baseline/Proposed probe-selection boundary, evidence ledger, Playwright Shopping inspector/screenshot/HAR, **development-only one-task** Ollama agent runner and decision traces, human suitability-review generator/gates, pilot operational gate, protected research-freeze workflow, official-result CSV exporter, Colab plots and paired main analysis. Synthetic integration and offline CI tests verify plumbing.

**Not yet established:** live WebArena PoC success on the user's Windows RTX 5060 laptop, robust browser action handling for all task types, reproducible **persistent** Magento reset, competent four-model pilot, all 32 main UI screens, a 48/256-episode unattended runner, or final experiment outcomes. **CI PASS does not prove agent task success**. The main runner remains locked.

Research methods differ **only** in probe ranking; they receive matched instructions, model, candidate controls, shared accessible observations/ledger context and configured action budget. Baseline ranks model-estimated progress; Proposed ranks unresolved constraint relevance, then forward cost/order. Model-reported grounded quotes are *diagnostic until separately audited*, never ground-truth evaluator outcomes.

## New machine: PoC and screening

Follow the full [PowerShell setup](docs/SETUP.md). On an existing checked-out repository:

```powershell
git pull origin main
npm.cmd ci
npx.cmd playwright install chromium
Copy-Item config/webarena.example.json config/webarena.local.json
npm.cmd run webarena:validate
npm.cmd run artifacts:init -- --stage poc
```

Start **Shopping only**:

```powershell
uvx --from webarena-verified==1.2.3 webarena-verified env start --site shopping
npm.cmd run webarena:prepare -- --stage poc --task 279
npm.cmd run webarena:inspect -- --stage poc --task 279
npm.cmd run webarena:prepare -- --stage poc --task 284
npm.cmd run webarena:inspect -- --stage poc --task 284
npm.cmd run webarena:prepare -- --stage poc --task 528
npm.cmd run webarena:inspect -- --stage poc --task 528
npm.cmd run artifacts:report -- --stage poc
```

The three PoC inspections create screenshots, public Accessibility Trees, and **inspection.har** (not an agent run). Complete [PoC screening](docs/EXPERIMENT.md) before treating any PoC as feasible.

Generate independent candidate screening reviews (all rows start **PENDING**, never auto-PASS):

```powershell
npm.cmd run webarena:catalog
npm.cmd run screening:init -- --stage poc
npm.cmd run screening:init -- --stage pilot
npm.cmd run screening:init -- --stage main
npm.cmd run screening:check -- --stage main
```

Review files: `reports/poc/poc-screening.json`, `reports/pilot/pilot-screening.json`, `reports/task-screening/main-review.json`. Evidence screenshots and HAR remain local/gitignored; **do not share HAR publicly or upload it to Colab**.

## Later, after approvals and live tests

```powershell
npm.cmd run artifacts:init -- --stage pilot
npm.cmd run agent:run -- --stage pilot --task 96 --model-label qwen3.5-9b --method Baseline --max-steps 16 --pilot-approved --fresh-environment-confirmed --evaluate
npm.cmd run pilot:gate
npm.cmd run results:export -- --stage pilot
```

Pilot runs require **approved human screenings of all PoC and pilot candidates**, a real reset of persistent Magento state, local Ollama and a validated evaluator. The approval flags are user attestations, not automated proof of reset. Existing run cells cannot be overwritten.

**Main activation is intentionally blocked** until all 32 UI reviews PASS, the 48-run pilot reaches its provisional operational gate, supervisor signoff, model digests and reset evidence are available, and `npm run main:freeze` creates a valid research identity. `artifacts:init --stage main` refuses an unfrozen study. See [the protocol](docs/EXPERIMENT.md).

For Bab IV, use [notebooks/thesis_analysis.ipynb](notebooks/thesis_analysis.ipynb) on Google Colab with **sanitized** `run-inventory.csv` and `analysis-results.csv`. The notebook does not invent scores and runs paired McNemar only for complete main data.

## Evidence, reproducibility and safety

- [Research protocol](docs/EXPERIMENT.md)
- [Task screening and reset protocol](docs/RESET_PROTOCOL.md)
- [Bab IV and appendix evidence](docs/EVIDENCE_PROTOCOL.md)
- [Artifact layout](docs/ARTIFACTS.md)
- [Current implementation status](docs/STATUS.md)

Development outputs (`output/`, `reports/`, `config/webarena.local.json`) are gitignored. They must be backed up separately. Pilot and main runs count only **official** WebArena-Verified evaluator results; self-declared model success and hint coverage are never official success.

Local validation:

```powershell
npm.cmd run format:check
npm.cmd run build
npm.cmd test
npm.cmd run test:integration
npm.cmd run webarena:validate
```
