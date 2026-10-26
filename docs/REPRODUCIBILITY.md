# Reproducing the CDEA Bab IV Analysis

## Inputs

- `main_observation.zip`: Main Large, protocol `cdea_main_v1`, 128 scheduled paired runs.
- `scale_reference.zip`: historical protocol `cdea_scale_v1` (256 pairs), **select only 128 Small pairs**.
- A new Small-only `cdea_small_extension_v1` archive (128 pairs) can replace the historical Scale input.

These input names are shorter aliases of the archived reference ZIPs. Check SHA-256 in [data provenance](DATA_PROVENANCE.md) and [source analysis](MAIN_SMALL_EXTENSION_ANALYSIS.md). The Main Large group is never counted twice.

## Setup and Run All

```powershell
python -m pip install -r requirements-analysis.txt
python scripts/analysis/audit_archives.py --main main_observation.zip --small scale_reference.zip --output archive_audit.json
```

Open [Bab IV notebook](../notebooks/cdea_bab_iv.ipynb) in Jupyter or Colab, place the two source ZIPs beside it (or upload `Dataset_CDEA.zip`), and use **Run All**. The notebook reads source archives without changing them.

Expected output directory `hasil_analisis_cdea/`:
- `figures/Gambar_4_1.png` through `Gambar_4_9.png`;
- `tables/Tabel_4_1.csv` through `Tabel_4_6.csv`;
- `detailed_analysis/` (23 CSV reports), `summary/` (statistics and source mapping).
- `Hasil_Analisis_CDEA_Bab_IV_Terurut.zip` packages the output.

See [mapping](BAB_IV_OUTPUTS.md). The older compact notebook is kept unchanged for reproducing its prior output.

## Verification

```powershell
python -m unittest discover -s tests -v
python scripts/analysis/verify_notebook.py
```

The integration script builds test-only fixture archives and verifies **both** Small input protocols, export order and source exclusions. CI performs offline checks; it does not run BrowserGym/OpenApps research episodes.

## Recorded numerical reference

| Group | Baseline | Proposed | Absolute gap |
|---|---:|---:|---:|
| Main Large | 73/128 (57.03%) | 97/128 (75.78%) | +18.75 percentage points |
| Small from historical Scale | 43/128 (33.59%) | 54/128 (42.19%) | +8.59 percentage points |
| Main bank-information | 10/20 (50.00%) | 18/20 (90.00%) | +40.00 percentage points |

Different recorded controller commits, reused task IDs and the xLAM backbone contrast limit interpretation of size effects. McNemar p-values are exploratory and not task-cluster robust. A difference in selected actions is not itself proof of correct information acquisition. Numerical consistency checks and CI do not independently certify historical runtime provenance.
