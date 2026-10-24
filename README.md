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

These rates summarize the supplied experiment archives. Source records and evidence limitations are documented separately; the notebook concentrates on reproducible paired-outcome statistics.

## Research analysis notebook

Open **[notebooks/cdea_main_scale_compact.ipynb](notebooks/cdea_main_scale_compact.ipynb)** in Jupyter or Google Colab. Upload the previously supplied Main ZIP, the Scale ZIP, or both without extracting them. Automatic discovery uses `manifest.json`; explicitly set `MAIN_ZIP` or `SCALE_ZIP` if several archives share a protocol.

The notebook has **17 cells** (9 code and 8 Markdown), grouped into **seven analysis sections**:

1. Dataset coverage, valid matched pairs, consistency checks, and statistical methods.
2. Main experiment: primary bank-information outcome, task/model breakdown, and McNemar.
3. Scale experiment: all eight checkpoints, small and large groups, family-level outcomes.
4. Treatment-effect interaction across sizes, task categories, and a sensitivity analysis excluding xLAM's different backbone.
5. CDEA mechanism: comparable probes, policy divergence, tentative evidence, and stored traces.
6. Within-pair efficiency, success-conditioned resource use, and unsuccessful episode reasons.
7. Results synthesis and reproducible ZIP export.

With both archives loaded, analysis exports **nine independently rendered PNG figures** (one analysis question per image) and **20 populated CSV tables**, plus source fingerprints. Scale-only execution yields five PNGs / 14 CSVs; Main-only execution yields four PNGs / 13 CSVs.

Dependencies: Python 3, `pandas`, `numpy`, `matplotlib`, `scipy`, all present in standard Google Colab runtimes. Main and Scale outcomes are always analyzed separately and are never treated as independent replicates.

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
| [Reproducibility](docs/REPRODUCIBILITY.md) | Environment and execution instructions |
| [Main data provenance](docs/DATA_PROVENANCE.md) / [Scale source notes](docs/SCALE_REFERENCE_V4_ANALYSIS.md#dataset-source-notes) | Archive origins, hashes, and evidence limitations |

To reproduce the results, run the compact notebook on the supplied archives. Historical execution utilities, source records, and evidence-checking scripts are retained separately; they are not part of the statistical notebook.

## Interpretation limits

Shared tasks and seeded environments create dependent outcomes. Exact McNemar p-values are exploratory and unadjusted. Task-cluster bootstrap intervals are sensitivity analyses, not population-level guarantees. The xLAM 3B/8B models have different backbones; treating their difference as caused solely by parameter count is inappropriate. Observed action divergence alone is not proof that evidence acquisition caused success.

OpenApps belongs to [facebookresearch/OpenApps](https://github.com/facebookresearch/OpenApps) and BrowserGym to [ServiceNow/BrowserGym](https://github.com/ServiceNow/BrowserGym).
