# Constraint-Driven Evidence Acquisition (CDEA) for Computer-Using Agents

Undergraduate thesis research on **Baseline vs Proposed (CDEA)** in official OpenApps tasks through BrowserGym, with local Ollama model checkpoints.

CDEA changes how an agent ranks model-proposed *information probes* using unknown constraint coverage and forward cost. Both arms share task IDs, prompts, permitted browser actions, environment resets, and evaluation budgets. This repository does **not** train a new language model.

## Thesis analysis design

The canonical comparison is **Main Large + Small-Model Extension**. The primary Main experiment remains frozen. Rather than reusing separately executed Scale Large data, the model-size comparison uses the **existing Main Large** outcomes and selects **only Scale Small** outcomes.

| Selected cohort | Source ZIP | Tasks | Checkpoints | Matched pairs | Episodes |
|---|---|---:|---:|---:|---:|
| Main Large (8B-9B) | `main_observation_v1(5).zip` | 32 | 4 | 128 | 256 |
| Extension Small (3B-4B) | `scale_reference_v4.zip` (`size=small`) | 32 | 4 | 128 | 256 |
| **Derived model-size view** | **Main Large + Scale Small** | **32 unique tasks** | **8** | **256** | **512** |

The original Scale ZIP still contains 256 scheduled pairs (including 128 Large), but **the 128 Scale Large pairs are excluded from the derived comparison**, not deleted or relabeled. Main Large pairs are reused in the size analysis and must not be counted again as independent Main study replications.

**Recorded outcomes:**

| Reported cohort | Baseline | CDEA | Difference |
|---|---:|---:|---:|
| Main bank-information primary | 10/20 (50.00%) | 18/20 (90.00%) | +40.00 pp |
| Main Large overall | 73/128 (57.03%) | 97/128 (75.78%) | +18.75 pp |
| Extension Small | 43/128 (33.59%) | 54/128 (42.19%) | +8.59 pp |
| **Derived size view** | **116/256 (45.31%)** | **151/256 (58.98%)** | **+13.67 pp** |

The descriptive interaction **Small treatment advantage minus Large treatment advantage** is -10.16 pp (task-cluster sensitivity interval -21.09 to +0.78 pp). Excluding the xLAM family yields -9.38 pp (interval -25.00 to +4.17 pp). These exploratory intervals include zero.

## Notebook and reproducibility

Open [**notebooks/cdea_main_scale_compact.ipynb**](notebooks/cdea_main_scale_compact.ipynb) in Google Colab or Jupyter, and upload the **original Main and Scale ZIPs**, without extracting them. The notebook automatically selects the correct source cohort based on ZIP protocol and `size=small`. If there are multiple candidate ZIPs, set `MAIN_ZIP` and `SCALE_ZIP` at the top.

The **17-cell, seven-section notebook** analyzes:

1. Input archive identities, scheduled/valid pair counts, source mapping and inference methods.
2. Main primary bank-information outcomes, model and task strata, paired effect sizes.
3. Eight-checkpoint comparison using Main Large + Scale Small, without original Scale Large.
4. Size interactions, task-category heterogeneity, task-bootstrap sensitivity and xLAM-excluded analysis.
5. Comparable information probes, action divergence, stored trace-level evidence indicators.
6. Paired steps, model time/calls, repair requests and failure patterns.
7. Separate PNG figures, CSV reports, source fingerprints and reproducible output ZIP.

With both original archives supplied, the notebook produces **nine separate, single-panel PNG charts** and **22 CSV reports**.

**Interpretation limit:** Main and Scale source runs record different controller commits (`ee8e7a0` vs `ff655d1`) and not all runtime parameters are identically specified. This design enables an exploratory *between-checkpoint, cross-run* comparison; it cannot isolate parameter count as the sole explanation. Source-evidence limitations are documented separately and do not change the statistics reported from the input archives.

See [Main Study results](docs/MAIN_RESULTS_V1.md), [revised derived analysis](docs/MAIN_SMALL_EXTENSION_ANALYSIS.md), and [original full Scale archive report](docs/SCALE_REFERENCE_V4_ANALYSIS.md).

## Repository map

| Path | Role |
|---|---|
| `notebooks/cdea_main_scale_compact.ipynb` | Compact, outcome-focused thesis analysis |
| [Main protocol](docs/MAIN_PROTOCOL_V1.md) / [Main results](docs/MAIN_RESULTS_V1.md) | Frozen Main design and previous analysis |
| [Original Scale protocol](docs/SCALE_PROTOCOL_V1.md) / [Derived model-size analysis](docs/MAIN_SMALL_EXTENSION_ANALYSIS.md) | Frozen Scale archive and the new Small-only analysis selection |
| `config/main_plan.json` / `config/scale_plan.json` | Study configuration |
| `config/models.json` / `config/models_scale.json` | Checkpoint definitions |
| `scripts/browsergym/main.py` / `scripts/browsergym/scale.py` | Study execution orchestration |
| `scripts/browsergym/matched_dev.py` / `shared_policy.py` | Paired-controller logic |
| [Reproducibility](docs/REPRODUCIBILITY.md) | Environment and execution instructions |
| [Main data provenance](docs/DATA_PROVENANCE.md) / [Scale source notes](docs/SCALE_REFERENCE_V4_ANALYSIS.md#dataset-source-notes) | Archive origins, hashes, and evidence limitations |

To reproduce the results, run the compact notebook on the supplied archives. Historical execution utilities, source records, and evidence-checking scripts are retained separately; they are not part of the statistical notebook.

## Interpretation limits

The Main study and the derived size comparison reuse the same Large data; do not present them as independent experiments. The Small and Large source runs used different controller revisions, so model-size interactions are exploratory. Task IDs recur across checkpoint families and McNemar tests are unadjusted; task-resampled bootstrap intervals are sensitivity analyses. xLAM 3B and 8B use different backbones, and policy divergence alone is not evidence of correctly acquired information.

OpenApps belongs to [facebookresearch/OpenApps](https://github.com/facebookresearch/OpenApps) and BrowserGym to [ServiceNow/BrowserGym](https://github.com/ServiceNow/BrowserGym).
