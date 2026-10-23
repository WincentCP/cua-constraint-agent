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

## Repository and documentation guide

| File | Purpose |
|---|---|
| `scripts/browsergym/main.py` | Frozen Main experiment orchestration and analysis |
| `scripts/browsergym/run_main.ps1` | Windows experiment and preflight commands |
| `scripts/browsergym/matched_dev.py` | Matched Baseline/Proposed controller |
| `config/main_plan.json` | Frozen parameters, validity rules and analysis plan |
| `config/main_taskset_v1.json` | Frozen 32-task selection |
| `config/models.json` | Model configurations |
| [Main task set](docs/MAIN_TASKSET_V1.md) | Official OpenApps task IDs and categories |
| [Main protocol](docs/MAIN_PROTOCOL_V1.md) | Frozen design, validity and readiness gates |
| [Main results](docs/MAIN_RESULTS_V1.md) | Success rates, paired statistics and mechanism diagnostics |
| [Data provenance](docs/DATA_PROVENANCE.md) | Archive SHA-256, researcher-reported live-review PASS and verification scope |
| [Reproducibility](docs/REPRODUCIBILITY.md) | Runtime, preflight checks and archived outputs |
| [Pilot results (archive)](docs/archive/PILOT_RESULTS_V1.md) | Pilot success, matched outcomes, mechanism diagnostics and archive fingerprint |
| [Pilot protocol (archive)](docs/archive/PILOT_PROTOCOL.md) | Preserved six-task exploratory Pilot design |
| [Readiness template](docs/MAIN_READINESS_TEMPLATE.json) | Original pending pre-run template; not the signed archive record |
| `tests/` | Offline code and protocol-contract tests |

The frozen protocols describe pre-execution conditions. Results and subsequent researcher approval are recorded separately in the linked results and provenance documents.

Raw experiment results are retained separately as `main_observation_v1(5).zip`. They are **not** automatically generated or authenticated by GitHub Actions. The original archive SHA-256, output file inventory, and provenance review scope are recorded in [Data provenance](docs/DATA_PROVENANCE.md).

## Running and inspecting the experiment

The original setup used Windows PowerShell, local Ollama, and the pinned OpenApps/BrowserGym environment, including BrowserGym core 0.13.4. See the [reproducibility guide](docs/REPRODUCIBILITY.md) for environment prerequisites, the exact model tags, and archive verification. Exact installed model digests and study hashes are retained in the original Main archive.

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

## Scale archive integrity and provenance

For the independent model-size follow-up (32 tasks, eight checkpoints, 256 pairs / 512 episodes), run the read-only auditor:

```powershell
python .\scripts\browsergym\audit_scale_archive.py ".\scale_observation_v1.zip" --report .\scale_validation_report.json
python .\scripts\browsergym\audit_scale_archive.py ".\scale_observation_v1.zip" --require-runtime-contract
```

The first command validates numerical consistency and reports missing runtime evidence without changing episode results. The second additionally fails unless archived model digests, server launch metadata, database snapshots, and logs meet the stricter evidence contract. An offline archive check cannot independently certify that historic OpenApps and Ollama processes ran. In particular, a health-check run of a staging service does not authenticate historical experiment episodes. Obtain actual model digests from the Ollama registry, server PIDs from processes launched by the official runner, and database paths from its per-arm isolated instances; never replace absent evidence with invented values. Keep invalid and unstarted pairs visible.

See [Scale Study protocol](docs/SCALE_PROTOCOL_V1.md) for new runs. This check leaves the frozen Main study unchanged.

## Acknowledgments

The benchmark uses [OpenApps](https://github.com/facebookresearch/OpenApps) and [BrowserGym](https://github.com/ServiceNow/BrowserGym); model inference uses Ollama. The upstream sources and their respective licenses remain those of their maintainers.
