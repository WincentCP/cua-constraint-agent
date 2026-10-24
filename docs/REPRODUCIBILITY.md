# Reproducing CDEA Main + Small Extension Analysis

This guide reproduces **the numerical analysis from user-supplied archives**. The selected Large checkpoint observations belong to frozen Main. The selected Small checkpoint observations belong to the Small extension (historical Scale source filtered to Small, or new Small-only source). A numerical notebook run is not an execution of new browser episodes.

## Input archives and source assignment

| Model-size cohort | Current reference ZIP | Included pairs | Model parameters |
|---|---|---:|---|
| Large | `main_observation_v1(5).zip` | 128 | Four 8B–9B checkpoints |
| Small | `scale_reference_v4.zip`, `size == 'small'` | 128 | Four 3B–4B checkpoints |

The historical Scale ZIP also includes 128 Large pairs. **They are never selected** in the active comparison, and no duplicate copy of Main Large is introduced. The originals are not modified. Check source SHA-256 and cohort counts before interpreting results; source records and limitations are documented in [the canonical analysis](MAIN_SMALL_EXTENSION_ANALYSIS.md).

## Re-run notebook analysis (Jupyter or Google Colab)

1. Open [the notebook](../notebooks/cdea_main_scale_compact.ipynb).
2. Upload the two original ZIPs **without unzipping**.
3. Run all cells. If multiple eligible ZIPs are present, set `MAIN_ZIP` and `SCALE_ZIP` explicitly at the top.
4. Check cohort mapping, planned/valid/invalid status, and source-controller configurations in the first section.
5. Find separately rendered figures in `cdea_analysis_outputs/figures/`, tables in `cdea_analysis_outputs/tables/`, and the source summary in `sources_and_methods.json`.

Expected recorded outcomes with the specified reference archives:

| Group | Baseline | Proposed/CDEA | Delta |
|---|---:|---:|---:|
| Main Large | 73/128 | 97/128 | +18.75 pp |
| Historical Scale Small | 43/128 | 54/128 | +8.59 pp |
| Derived size comparison | 116/256 | 151/256 | +13.67 pp |

The notebook also accepts `cdea_small_extension_v1` Small-only ZIPs from the **new** runner, but those must be treated as their own source archive; the values above are not predetermined results of new runs.

## Validate current source code and Small-only schedule

For the repository contract tests, Python 3.11 is sufficient:

```powershell
python -m unittest discover -s tests -v
python scripts/browsergym/small_extension.py --dry-run
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_small_extension.ps1 -DryRun
```

The dry run must schedule **128 pairs / 256 episode slots across four Small checkpoints**. The registry is `config/models_small_extension.json`; no 8B–9B checkpoint is in the active extension. The frozen Main study configuration remains in `config/main_plan.json` and `config/models.json`.

For genuinely new Small-only experiments with OpenApps/BrowserGym/Ollama installed, see [the active protocol and runner instructions](SMALL_EXTENSION_PROTOCOL.md). The frozen Main original protocol and source records remain available under [Main protocol](MAIN_PROTOCOL_V1.md) and [data source](DATA_PROVENANCE.md).

## Inference and interpretation

The task IDs repeat across checkpoint families, so exact McNemar p-values are exploratory and unadjusted; bootstrap ranges are task-resampled sensitivity intervals. The Main and Small reference data use different controller commits; Main shared-parameter metadata is not identical to Scale. xLAM's smaller and larger checkpoints have different backbones. Accordingly, **the size-interaction result is exploratory, not a causal estimate solely attributable to parameter count**.

Policy-action divergence alone does not confirm correct evidence acquisition. Preserve recorded mechanism limitations and distinguish observed outcomes from assumptions about their cause.
