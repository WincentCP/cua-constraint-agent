# Constraint-Driven Evidence Acquisition (CDEA) for Computer-Using Agents

Undergraduate thesis research on **Baseline vs Proposed (CDEA)** in official OpenApps tasks through BrowserGym, with local Ollama model checkpoints.

CDEA changes how an agent ranks model-proposed *information probes* using unknown constraint coverage and forward cost. Both arms share task IDs, prompts, permitted browser actions, environment resets, and evaluation budgets. This repository does **not** train a new language model.

## Experimental design

| Study | Frozen tasks | Models | Paired units | Episodes | Main question |
|---|---:|---:|---:|---:|---|
| Main v1 | 32 | 4 (8B-9B) | 128 | 256 | Does CDEA improve task completion? |
| Scale v1 | 32 | 8 (3B-9B) | 256 | 512 | Does the recorded CDEA benefit differ by model size? |

Cohorts: 5 bank-information tasks (primary for Main), 18 cross-app workflows, 9 primitive controls. Main and Scale are separate datasets; **do not pool them as independent observations**. Success means the official binary reward as **recorded in the input archive**.

## Recorded results

| Study / subset | Baseline | CDEA | Delta |
|---|---:|---:|---:|
| Main v1: bank information (primary) | 10/20 (50.0%) | 18/20 (90.0%) | +40.0 pp |
| Main v1: all tasks | 73/128 (57.0%) | 97/128 (75.8%) | +18.8 pp |
| Scale reference v4: all checkpoints | 116/256 (45.3%) | 149/256 (58.2%) | +12.9 pp |
| Scale reference v4: small (3B-4B) | 43/128 (33.6%) | 54/128 (42.2%) | +8.6 pp |
| Scale reference v4: large (8B-9B) | 73/128 (57.0%) | 95/128 (74.2%) | +17.2 pp |

Results above describe archived records. The **Scale reference archive is not independently attested as a historical live run**. The notebook analyzes outcomes without attempting or claiming runtime attestation. Administrative review and machine evidence are distinct.

## One compact notebook for Bab IV

Open **[notebooks/cdea_main_scale_compact.ipynb](notebooks/cdea_main_scale_compact.ipynb)** in Jupyter or Google Colab. Upload the Main ZIP, the Scale ZIP, or both. If auto-discovery finds multiple archives of the same protocol, set `MAIN_ZIP` or `SCALE_ZIP` in the first code cell.

The notebook uses **11 cells** (5 code + 6 headings) and focuses on:
1. Study identity, matched-pair denominators and endpoint consistency (not runtime verification).
2. Main primary outcome, Scale overall and size effects, exploratory exact McNemar.
3. Eight checkpoints, within-family size differences on common tasks, task-category breakdowns, task-cluster bootstrap intervals.
4. Recorded probe/policy divergence and efficiency metrics.
5. Two figures and seven CSV tables exported to `analysis_outputs_compact/`.

The notebook requires Python 3, `pandas`, `numpy`, `matplotlib`, and `scipy`; dependencies are preinstalled in standard Colab runtimes. A missing Main ZIP is allowed: Scale analysis runs independently.

## Repository map

| Path | Role |
|---|---|
| `notebooks/cdea_main_scale_compact.ipynb` | Compact, outcome-focused thesis analysis |
| [Main protocol](docs/MAIN_PROTOCOL_V1.md) / [Main results](docs/MAIN_RESULTS_V1.md) | Frozen Main design and previous analysis |
| [Scale protocol](docs/SCALE_PROTOCOL_V1.md) / [Scale analysis](docs/SCALE_REFERENCE_V4_ANALYSIS.md) | Model-size study and recorded results |
| `config/main_plan.json` / `config/scale_plan.json` | Study configuration |
| `config/models.json` / `config/models_scale.json` | Checkpoint definitions |
| `scripts/browsergym/main.py` / `scripts/browsergym/scale.py` | Study execution orchestration |
| `scripts/browsergym/matched_dev.py` / `shared_policy.py` | Paired-controller logic |
| [Reproducibility](docs/REPRODUCIBILITY.md) / [Scale execution runbook](docs/LIVE_SCALE_RUNBOOK.md) | Environment and execution instructions |
| [Provenance](docs/DATA_PROVENANCE.md) | Separate evidence scope for the earlier Main archive |

Analysis runs **do not require** a runtime/host verification step. The standalone auditors under `scripts/browsergym/audit_scale_*.py` remain available for independent evidence review and are not part of the notebook flow. Raw traces, source identities, and earlier evidence documents are preserved.

## Interpretation limits

Shared tasks and seeded environments create dependent outcomes. Exact McNemar p-values are exploratory and unadjusted. Task-cluster bootstrap intervals are sensitivity analyses, not population-level guarantees. The xLAM 3B/8B models have different backbones; treating their difference as caused solely by parameter count is inappropriate. Observed action divergence alone is not proof that evidence acquisition caused success.

OpenApps belongs to [facebookresearch/OpenApps](https://github.com/facebookresearch/OpenApps) and BrowserGym to [ServiceNow/BrowserGym](https://github.com/ServiceNow/BrowserGym).
