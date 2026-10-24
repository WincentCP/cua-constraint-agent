# CDEA — Computer-Using Agent Research

Constraint-Driven Evidence Acquisition (CDEA) ranks model-proposed information probes by coverage of unknown constraints and estimated forward cost. The comparison is **Baseline vs Proposed (CDEA)** on OpenApps tasks through BrowserGym. No model weights are trained.

## Active research design

**The Large group always comes from the frozen Main Study. Only four Small checkpoints are added by the model-size extension. No new Large Scale study is scheduled.**

| Cohort | Input | OpenApps tasks | Checkpoints | Matched pairs | Episodes |
|---|---|---:|---:|---:|---:|
| Main Large (8B–9B) | `main_observation_v1(5).zip` | 32 | 4 | 128 | 256 |
| Extension Small (3B–4B) | Small-only results from `scale_reference_v4.zip` | 32 | 4 | 128 | 256 |
| **Size comparison** | **Main Large + Extension Small** | **32 unique IDs** | **8** | **256** | **512** |

**Recorded descriptive outcomes**

| Cohort | Baseline | CDEA | Difference |
|---|---:|---:|---:|
| Main bank-information primary | 10/20 (50.00%) | 18/20 (90.00%) | +40.00 pp |
| Main Large overall | 73/128 (57.03%) | 97/128 (75.78%) | +18.75 pp |
| Extension Small | 43/128 (33.59%) | 54/128 (42.19%) | +8.59 pp |
| **Combined size view** | **116/256 (45.31%)** | **151/256 (58.98%)** | **+13.67 pp** |

The descriptive interaction, **Small CDEA advantage minus Large CDEA advantage**, is -10.16 percentage points, with a task-bootstrap sensitivity interval of [-21.09, +0.78] pp. Excluding xLAM yields -9.38 pp ([-25.00, +4.17] pp). The intervals include zero; there is no conclusive model-size effect.

The source runs used **different controller revisions**, and the Main manifest did not specify every parameter recorded in Scale. These differences confound the size contrast. Shared task IDs introduce statistical dependence, so do not pool these with another Main replication or interpret exploratory p-values as population-generalizable evidence.

## Run the research notebook

Open [notebooks/cdea_main_scale_compact.ipynb](notebooks/cdea_main_scale_compact.ipynb) in Jupyter/Colab, upload the original Main ZIP and the original Scale ZIP **without extracting them**, then run all cells.

- The notebook accepts **`cdea_main_v1` for Large** and **`cdea_scale_v1` for Small** (filters historical Scale to `size=small`).
- For future four-checkpoint extensions, it also accepts **`cdea_small_extension_v1`** (already contains only Small).
- An ambiguous folder with two eligible Small archives requires setting `SCALE_ZIP` explicitly in the first code cell; `MAIN_ZIP` can likewise be set explicitly.
- It checks pair/episode agreement, tracks the originating archive, prevents duplicate task–model combinations, and **never substitutes historical Scale Large**.
- When both original ZIPs are available, it produces 9 independent single-panel PNG figures and 22 CSV reports; the original ZIPs are not mutated.

See [the selected source analysis](docs/MAIN_SMALL_EXTENSION_ANALYSIS.md) and [reproducibility guide](docs/REPRODUCIBILITY.md).

## New Small-only experiment (optional)

The current runner schedules **32 tasks × 4 Small checkpoints = 128 matched pairs / 256 episode slots**, and never includes 8B–9B checkpoints.

```powershell
python -m unittest discover -s tests -v
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_small_extension.ps1 -DryRun
# When OpenApps and all four Small checkpoints are installed:
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_small_extension.ps1 -CheckModels
# Only for a genuinely new experiment with a new ID:
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_small_extension.ps1 -Run -ExtensionId small_ext_v1 -MaxPairs 1 -StopOnInvalid
```

The script writes to `output/small_extension/<ExtensionId>/` and uses [`config/small_extension_plan.json`](config/small_extension_plan.json) and [`config/models_small_extension.json`](config/models_small_extension.json). The [Small Extension protocol](docs/SMALL_EXTENSION_PROTOCOL.md) describes its method and outputs. **This command does not retroactively create or verify the reference archive episodes.**

## Active repository map

| Location | Purpose |
|---|---|
| `notebooks/cdea_main_scale_compact.ipynb` | Main Large + Small Extension research analysis |
| `config/main_plan.json`, `config/models.json` | Frozen four-checkpoint Main protocol |
| `config/small_extension_plan.json`, `config/models_small_extension.json` | New four-Small-checkpoint runner configuration |
| `config/main_taskset_v1.json` | Shared 32 OpenApps task IDs |
| `scripts/browsergym/main.py` | Frozen Main experiment orchestration |
| `scripts/browsergym/small_extension.py` | Small-only experiment runner |
| `scripts/browsergym/run_small_extension.ps1` | Windows runner wrapper |
| `scripts/browsergym/shared_policy.py`, `matched_dev.py` | Baseline/CDEA action policy and paired runner |
| `docs/MAIN_SMALL_EXTENSION_ANALYSIS.md` | Selected data, effect sizes, sensitivity and limitations |
| `docs/MAIN_RESULTS_V1.md`, `docs/MAIN_PROTOCOL_V1.md` | Original Main results and frozen original protocol |
| `docs/DATA_PROVENANCE.md` | Existing source identity and scope of recorded evidence |
| `legacy/full_scale_v1/` | Archived eight-checkpoint Scale design and historical optional tools (not active) |

## Reporting rules

All numbers above are **outcomes recorded in the specified archives**, not new executions. The original eight-checkpoint Scale ZIP remains unchanged; its 128 Large pairs are never used for the active size comparison. Main Large outcomes used in the Main and extension analyses are **one dataset reused**, not two independent sets of runs. Distinct controller revisions and the xLAM backbone difference prevent a causal conclusion about parameter count alone. A policy-action divergence alone does not establish valid evidence acquisition.

OpenApps: [facebookresearch/OpenApps](https://github.com/facebookresearch/OpenApps) · BrowserGym: [ServiceNow/BrowserGym](https://github.com/ServiceNow/BrowserGym).
