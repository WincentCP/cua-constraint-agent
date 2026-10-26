# Main v1 — Frozen Experiment Protocol

**Frozen:** 2026-10-20. This document summarizes the **pre-execution protocol**; later results and the recorded researcher live-provenance review are documented in [Main results](MAIN_RESULTS_V1.md) and [Data provenance](DATA_PROVENANCE.md). Editorial compression does not revise the registered design, frozen code or prior Git history.

## Research question and outcomes

Does Proposed (Constraint-Driven Evidence Acquisition/CDEA), ranking eligible information probes by **unknown-constraint coverage** and **forward cost**, improve official OpenApps task completion over Baseline's general progress ranking?

| Measure | Registered specification |
|---|---|
| Primary cohort | 5 held-out OpenBanking read-before-act tasks × 4 models = **20 matched pairs** |
| Primary endpoint | Binary official BrowserGym task success, evaluated per valid matched pair |
| Primary effect | (Proposed-only successes − Baseline-only successes) / valid bank pairs |
| Null hypothesis | Equal probability of Proposed-only and Baseline-only success |
| Exploratory inference | Two-sided exact McNemar; α = 0.05; unadjusted, non-cluster-robust; only after all 128 scheduled pairs have terminal outcomes |
| Secondary outcomes | Overall and by-model/category success; paired difference; valid/invalid/not-started coverage; steps, latency, repairs, invalid actions, probe opportunities and divergences |

The five bank task IDs repeat across four models on shared seeded application data. The study has **no independent-task power justification**; neither unadjusted McNemar nor task-level aggregates establish population-wide superiority. If no comparable probes or no action divergence occur, the CDEA ranking intervention is **not demonstrated**, regardless of success rates. Review traces before causal attribution. Do not change targets or analyses after observing outcomes.

## Frozen design and treatment

| Item | Frozen setting |
|---|---|
| Task roster | [32 official OpenApps IDs](../config/main_taskset_v1.json): 5 bank information, 18 cross-app workflow, 9 primitive control |
| Task-order SHA-256 | `73d4a4a8e377422072c6ab27c066f87f8acbed7683ed50168c3407c861d61333` |
| Upstream OpenApps | `facebookresearch/OpenApps` @ `6e6782794433c60468d65ac75bc3f03c56007f8c` |
| Controller freeze | `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1` |
| Model labels | `qwen3.5-9b`, `ministral3-8b`, `granite4.1-8b`, `xlam2-8b` |
| Design size | **32 tasks × 4 models × 2 methods = 128 pairs / 256 episodes** |
| Order | Fixed SHA-256-derived ordering of seed/task/model; predefined method-arm order |
| Agent configuration | Seed 233; **40 BrowserGym actions/arm**; Ollama 240 s/call, temperature 0, think false, 640 output tokens; `num_ctx=8192` for new Main executions |
| Actions and repairs | BrowserGym BID/navigation subset; shared parser/guards; one same-observation action repair; no forced click retry |
| Isolation | Fresh owned OpenApps server and separate database per arm |

Baseline and Proposed use the same official evaluator, model digest, public goal/observation, initial app-state hash, action set, prompt schema and budgets. Both rank the **same eligible model-generated information probes**; only the ranking policy differs. The official reward is never included in agent prompts. All four model model variants digests and the controller, plan, taskset, seed, order and approvals are locked before the first Main pair; digests are rechecked before each arm. Distinct Pilot IDs and mere wording variations are excluded. Changing frozen settings requires **a new study version/ID**.

**2026-10-27 context-window update:** the current Main code now passes `num_ctx=8192` explicitly to Ollama for both methods, matching the Small extension setting. It saves the value in the manifest/episode metadata and rejects mismatched episode settings. This does **not** establish which context window was used in already-recorded Main archives; verify historical values from original requests/logs. Existing frozen Main artifacts are not modified, and revised execution needs a fresh study ID/version.

## Pair validity and reporting

- **Valid:** Both original official episodes complete; runtime/agent flags are valid, official reward matches binary success, initial-state hash matches, servers/databases are separately owned, method order/model/code/protocol match the freeze, and trace-derived probe diagnostics reproduce recorded pair fields.
- **Valid failure:** Official reward 0 counts as an unsuccessful episode in the valid denominator.
- **Invalid/incomplete:** Retain original artifacts; exclude both arms from the paired-success denominator; never silently rerun/relabel.
- **Not started:** Preserve as `not_started`, never impute failure.
- **Integrity:** Preserve failed/unsealed directories and inspect any stale lock before recovery; never select reruns by outcome. Publish all 128 planned pair rows and 256 episode rows, including invalid/missing states.
- **Analysis:** Withhold inference during partial collection. After terminal outcomes, report the primary paired 2×2 table, exploratory test, denominators and probe diagnostics; inspect traces before causal claims.

## Six pre-execution readiness gates

At protocol freeze, [the readiness template](MAIN_READINESS_TEMPLATE.json) is pending; this is **not** the approved evidence record retained in the later archive. Before a new Main run, all six checks require truthful human-reviewed evidence:

| Gate | Required evidence |
|---|---|
| `pilot_provenance_verified` | Accepted Pilot close-out, source traces and documented provenance |
| `official_evaluator_controls_passed` | Positive/negative official evaluator controls, reset and isolation parity |
| `four_model_live_compatibility_passed` | Four frozen model digests and actual BrowserGym/action compatibility beyond offline model checks |
| `cdea_mechanism_verified` | Same-public-observation eligible probe comparison, action divergence and reviewed trace |
| `all_main_tasks_suitability_screened` | Pinned official Hydra keys, evaluator, UI and suitability review before Main outcomes |
| `statistical_protocol_preregistered` | Signed task/model/budget, outcomes, denominator and inference plan |

Any failed/missing gate means **NO-GO**. Approval must identify the reviewer (`approved_by`), UTC time, each passed check and genuine evidence file, with SHA-256 hashes locked across the study. The software can validate flags and files, **not** the authenticity of human evidence.

## Execution reference (Windows PowerShell)

```powershell
python -m unittest discover -s tests -v
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -CheckModels
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -AuditTasks
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -InitReadiness
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -CheckReadiness
```

The first commands are code/registration/model/evaluator preflight checks, **not research episodes**; `-InitReadiness` creates a pending template. `-CheckReadiness` validates recorded hashes and flags, not independent evidence authenticity. After a documented six-gate human approval, a **new study ID** can execute one pair using:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -Run -MainId new_main_id -ReadinessFile .\output\main\readiness_v1.json -ModelLabel qwen3.5-9b -MaxPairs 1 -StopOnInvalid
```

Resume only untouched scheduled pairs under identical frozen code/plan/model/readiness hashes. Existing Main/Pilot IDs are not for revised experiments.

**Result contract:** `manifest.json`, `model_digests.json`, `results.csv` (256 rows), `pairs.csv` (128), `summary.csv` (40), `analysis.json`, plus `episodes/pair_001` through `pair_128` with Baseline/Proposed trace and isolated-server artifacts. GitHub CI tests contracts only and does not execute the recorded Main episodes.
