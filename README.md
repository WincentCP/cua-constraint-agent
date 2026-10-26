# CDEA — Computer-Use Agent Research

Constraint-Driven Evidence Acquisition (CDEA) ranks model-proposed information probes by coverage of unknown constraints and estimated forward cost. The comparison is **Baseline vs Proposed (CDEA)** on OpenApps tasks through BrowserGym. No model weights are trained.

## Active research design

**The Large group always comes from the frozen Main Study. Only four Small checkpoints are added by the model-size extension. No new Large Scale study is scheduled.**

| Cohort | Input | OpenApps tasks | Checkpoints | Matched pairs | Episodes |
|---|---|---:|---:|---:|---:|
| Main Large (8B–9B) | `main_observation.zip` | 32 | 4 | 128 | 256 |
| Extension Small (3B–4B) | Small-only results from `scale_reference.zip` | 32 | 4 | 128 | 256 |
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

Open [notebooks/cdea_bab_iv.ipynb](notebooks/cdea_bab_iv.ipynb), upload `main_observation.zip` and `scale_reference.zip` (or `Dataset_CDEA.zip`), then **Run All**.

- The notebook selects four Large checkpoints **only from Main** (`cdea_main_v1`) and four Small checkpoints from the historical Scale (`cdea_scale_v1`) or a new Small-only archive (`cdea_small_extension_v1`).
- The historical Scale's 128 Large pairs are excluded. Output includes **6 main CSV tables, 9 ordered color figures, 23 detailed CSV reports**, plus summary and source SHA-256 metadata.
- Output figure and table labels follow Bab IV of the thesis: see [Bab IV output mapping](docs/BAB_IV_OUTPUTS.md). The previous [compact notebook](notebooks/cdea_main_scale_compact.ipynb) is kept for reproducibility of prior analyses.
- Source archives are read-only. Their stable input names are aliases for the original reference archives documented by hash.

Install analysis dependencies with `python -m pip install -r requirements-analysis.txt`. To check source consistency independently of the notebook:

```powershell
python scripts/analysis/audit_archives.py --main main_observation.zip --small scale_reference.zip --output archive_audit.json
python scripts/analysis/verify_notebook.py
```

The second command executes synthetic **test fixtures only**, not the research datasets. See [reproducibility](docs/REPRODUCIBILITY.md) and [Bab III wording sync](docs/THESIS_SYNC.md).

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

## Peta kode utama

Untuk membaca kode tanpa tersesat, gunakan **[Peta Kode CDEA](docs/CODE_MAP.md)**. File dikelompokkan berdasarkan fungsi, tanpa memindahkan file implementasi yang menjadi acuan eksperimen.

| Kelompok | Mulai dari | Kegunaan |
|---|---|---|
| **1. Penyiapan & eksperimen** | [`main.py`](scripts/browsergym/main.py), [`small_extension.py`](scripts/browsergym/small_extension.py), [`config/`](config/) | Menetapkan tugas, model, dan jadwal *paired runs* |
| **2. Agen & CDEA** | [`matched_dev.py`](scripts/browsergym/matched_dev.py), [`shared_policy.py`](scripts/browsergym/shared_policy.py) | Mengelola episode dan memilih tindakan *Baseline*/*Proposed* |
| **3. Lingkungan & pemeriksaan** | [`isolated_openapps.py`](scripts/browsergym/isolated_openapps.py), [`evaluator_controls.py`](scripts/browsergym/evaluator_controls.py) | Isolasi lingkungan dan uji kontrol evaluator |
| **4. Analisis & verifikasi** | [`cdea_bab_iv.ipynb`](notebooks/cdea_bab_iv.ipynb), [`scripts/analysis/`](scripts/analysis/) | Mengolah hasil menjadi tabel, grafik, dan pemeriksaan arsip |

**Alur ringkas:** Konfigurasi → *Experiment Controller* → *Agent Controller* → kebijakan CDEA → BrowserGym/OpenApps → hasil episode → notebook Bab IV.

## Reporting rules

All numbers above are **outcomes recorded in the specified archives**, not new executions. The original eight-checkpoint Scale ZIP remains unchanged; its 128 Large pairs are never used for the active size comparison. Main Large outcomes used in the Main and extension analyses are **one dataset reused**, not two independent sets of runs. Distinct controller revisions and the xLAM backbone difference prevent a causal conclusion about parameter count alone. A policy-action divergence alone does not establish valid evidence acquisition.

OpenApps: [facebookresearch/OpenApps](https://github.com/facebookresearch/OpenApps) · BrowserGym: [ServiceNow/BrowserGym](https://github.com/ServiceNow/BrowserGym).
