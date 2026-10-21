# Constraint-Driven Evidence Acquisition for Computer-Using Agents

**Undergraduate thesis research** · OpenApps · BrowserGym · Ollama · Matched-pair comparison

This repository implements and evaluates **Constraint-Driven Evidence Acquisition (CDEA)** as an information-probe ranking strategy for computer-using agents (CUAs). It compares CDEA (the **Proposed** policy) with a **Baseline** progress-based ranking policy under matched tasks, model checkpoints, observation/action interfaces, and evaluation budgets.

## Research question

Does prioritizing information-gathering actions by **constraint coverage** and **forward cost** improve an agent's official task-completion rate compared with baseline progress-based ranking, especially when information must be retrieved before an action can be completed?

The intervention is **probe ranking**, not training a new language model. Both methods receive the same eligible model-generated probe candidates and share the BrowserGym action interface and official OpenApps task evaluator.

## Experiment design

| Item | Specification |
|---|---|
| Benchmark / environment | Official OpenApps tasks via BrowserGym |
| Comparison | Baseline vs Proposed (CDEA) |
| Models | Qwen3.5-9B, Ministral3-8B, Granite4.1-8B, xLAM2-8B |
| Tasks | 32 frozen OpenApps task IDs |
| Matched pairs | 128 (one task × model per pair) |
| Episodes | 256 (two methods per pair) |
| Primary cohort | 5 bank-information tasks × 4 models = 20 pairs |
| Secondary cohorts | 18 cross-app workflows; 9 primitive controls; overall |
| Primary endpoint | Official binary task-completion success |
| Planned paired analysis | Success-rate difference; exploratory exact two-sided McNemar |
| Agent budget | Maximum 40 browser actions per method/episode |
| Frozen controller commit | `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1` |
| Frozen upstream OpenApps commit | `6e6782794433c60468d65ac75bc3f03c56007f8c` |

The *primitive-control* cohort tests basic operations; the *cross-app* cohort tests multi-step workflows; the *bank-information* cohort tests tasks that require finding previously unknown banking details. **All tasks** is an aggregate, not a fourth disjoint task category.

## Main experiment results

The supplied `main_observation_v1` archive records **128 completed valid matched pairs** (256 episode records), with no invalid or unstarted pairs.

| Cohort | Pairs | Baseline | Proposed (CDEA) | Difference |
|---|---:|---:|---:|---:|
| **Bank information (primary)** | 20 | 10/20 (50.0%) | 18/20 (90.0%) | **+40.0 pp** |
| Cross-app workflow | 72 | 35/72 (48.6%) | 51/72 (70.8%) | +22.2 pp |
| Primitive control | 36 | 28/36 (77.8%) | 28/36 (77.8%) | 0.0 pp |
| **Overall** | **128** | **73/128 (57.0%)** | **97/128 (75.8%)** | **+18.8 pp** |

Primary bank-information paired outcomes: 9 both succeeded, 9 Proposed-only, 1 Baseline-only, and 1 neither. The archived exploratory exact two-sided McNemar result is **p = 0.021484375**, unadjusted. Five bank task IDs each evaluated on four models are not independent population samples; the p-value must not be interpreted as conclusive general superiority.

Episode-level diagnostics identify **48 pairs** with comparable information-probe decisions and **33 pairs** with policy-action divergences. These are mechanism-engagement diagnostics; inspect the corresponding traces before making causal claims.

For more detail see **[Main results](docs/MAIN_RESULTS_V1.md)** and the frozen [Main protocol](docs/MAIN_PROTOCOL_V1.md).

## Repository guide

| Location | Purpose |
|---|---|
| `scripts/browsergym/main.py` | Frozen Main experiment orchestration and analysis |
| `scripts/browsergym/run_main.ps1` | Windows experiment and preflight commands |
| `scripts/browsergym/matched_dev.py` | Shared matched Baseline/Proposed controller |
| `config/main_plan.json` | Frozen parameters, validity rules and analysis plan |
| `config/main_taskset_v1.json` | 32-task frozen selection |
| `config/models.json` | Model configurations |
| `docs/MAIN_PROTOCOL_V1.md` | Preregistered research design and analysis limitations |
| `docs/MAIN_RESULTS_V1.md` | Recorded outcomes and paired statistics |
| `docs/DATA_PROVENANCE.md` | Archive identity, researcher-reported audit status, verification scope |
| `docs/DEVELOPMENT_HISTORY.md` | Prior implementation, development and troubleshooting notes |
| `tests/` | Offline code and protocol-contract tests |

Raw experiment results are retained separately as `main_observation_v1(5).zip`. They are **not** automatically generated or authenticated by GitHub Actions. The original archive SHA-256, output file inventory, and provenance review scope are recorded in [Data provenance](docs/DATA_PROVENANCE.md).

## Running and inspecting the experiment

The original setup used Windows PowerShell, local Ollama, and the pinned OpenApps/BrowserGym environment, including BrowserGym core 0.13.4. Install/check the required four Ollama checkpoints and verify the frozen task roster before an experiment; exact image/model digests and study hashes are documented in the original main archive.

For code and registration preflight (these commands are *not* experimental episodes):

```powershell
python -m unittest discover -s tests -v
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -CheckModels
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -AuditTasks
```

For an actual new experiment, follow [Main protocol](docs/MAIN_PROTOCOL_V1.md): complete its independent readiness review, use a new study identifier where the protocol requires it, and preserve all valid, invalid, missing and unstarted outcomes. **Do not alter or rerun the frozen Main experiment to improve the reported results.**

## Provenance and audit status

The researcher **reports that the live-execution provenance review passed** the defined evidence checks. The archive contains a recorded approval, six marked-passed readiness gates, model identities, per-episode traces, server logs, and process metadata. The archive's result counts and ZIP entry integrity were checked for this documentation release. These repository checks do not themselves amount to independent original-host attestation; refer to [Data provenance](docs/DATA_PROVENANCE.md) for the exact scope.

## Research limitations

- Evaluation uses one OpenApps benchmark and a limited frozen 32-task roster.
- Repeated model/task evaluations and shared seeded benchmark data create dependencies.
- Exact McNemar is reported as an *exploratory*, unadjusted sensitivity analysis, not cluster-robust population inference.
- Observed policy divergence needs trace review before attributing a success to the proposed mechanism.

## Acknowledgments

The benchmark uses [OpenApps](https://github.com/facebookresearch/OpenApps) and [BrowserGym](https://github.com/ServiceNow/BrowserGym); model inference uses Ollama. The upstream sources and their respective licenses remain those of their maintainers.
