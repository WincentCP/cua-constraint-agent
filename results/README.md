# Experiment Results

This folder contains compact, derived result tables for the CDEA thesis. The tables were extracted from the supplied `Dataset_CDEA(1).zip` package and checked against the corresponding source archive records.

## Included files

| File | Contents | Original source |
|---|---|---|
| `success_by_model.csv` | Baseline and CDEA success counts/rates for 4 Large and 4 Small models | `derived/lampiran_D_per_model_8.csv` |
| `success_by_task.csv` | Success counts and rates for each of the 32 tasks, aggregated across 8 model variants | `derived/lampiran_E_per_task_32.csv` |
| `model_size_comparison_by_task.csv` | Successful-model counts by size and method for each task | `derived/lampiran_E4_ukuran_model_32.csv` |
| `small_model_higher_uplift_tasks.csv` | 5 tasks where the CDEA uplift was larger in Small than Large | `derived/analisis_peningkatan_cdea_small_5.csv` |
| `small_model_success_comparison_examples.csv` | 6 tasks where Small had more successful models than Large in at least one method | `derived/tabel_4_7_small_menang_6.csv` |
| `pair_outcomes.csv.gz` | Pair-level outcomes for the 128 Main Large and 128 selected Scale Small pairs | `derived/selected_pairs.csv` |
| `provenance.json` | Source archive identifiers, checksums, experiment commits, configurations, and validation notes | Source archive manifests |

## Which source records are included?

The Main Study contributes all 128 valid Large pairs from `main_observation.zip`. The Small-Model Extension contributes the 128 valid Small pairs selected from `scale_reference.zip`. The 128 Large pairs also present in the Scale archive are not included in the thesis comparison dataset.

The combined analysis therefore contains 256 pairs and 512 episodes:
- Main Large: 128 pairs / 256 episodes.
- Scale Small: 128 pairs / 256 episodes.

The pair-level and episode-level files are gzip-compressed CSV files. They can be opened after decompression with standard tools, for example:

```bash
gzip -dk pair_outcomes.csv.gz
```

## Reproducibility and limitations

The raw source archives are not stored in this repository. Their exact SHA-256 hashes and sizes are recorded in `provenance.json`. A separately obtained source archive should match the recorded checksum before being used for re-analysis.

The Main manifest does not explicitly record `num_ctx`. The value 8192 is explicitly recorded in the Scale manifest only. Do not treat the Main value as independently confirmed by the manifest.

The archive checks performed for this release verify ZIP integrity, record counts, pair/episode consistency, and agreement of the published derived tables with source pair records. They do not independently prove the execution host, runtime environment, or model digests at the time of the experiments.

The files in this folder are research outputs, not synthetic CI fixtures. GitHub Actions uses separate synthetic fixtures only for automated software tests.
