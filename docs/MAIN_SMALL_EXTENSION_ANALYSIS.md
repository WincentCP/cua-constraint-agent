# Main Study + Small-Model Extension | Derived Analysis v1

## Methodology and exact source selection

This analysis reuses **four Large (8B-9B) model checkpoints from the frozen Main Study**, and only the **four Small (3B-4B) checkpoint results from the original Scale archive**. There is no replacement, rewriting or imputation of episode outcomes.

| Analyzed group | Original archive | Models | Valid paired task-model units | Episodes |
|---|---|---:|---:|---:|
| Main Large | `main_observation_v1(5).zip` | 4 | 128 | 256 |
| Scale Small | `scale_reference_v4.zip`, filter `size == "small"` | 4 | 128 | 256 |
| **Derived comparison** | **Main Large + Scale Small** | **8** | **256** | **512** |

Both selected groups use the same 32 OpenApps task IDs. The original Scale archive additionally contains **128 Large pairs**, deliberately excluded here. Those original Scale Large records are preserved in the unmodified ZIP and remain described by [the original Scale study report](SCALE_REFERENCE_V4_ANALYSIS.md). The Main observations appear in both the original Main descriptive analysis and the derived model-size comparison; they must not be counted as independent replicated data.

## Results computed from selected records

| Analysis | Baseline success | Proposed success | Treatment effect |
|---|---:|---:|---:|
| Main bank-information primary | 10/20 (50.00%) | 18/20 (90.00%) | +40.00 percentage points |
| Main Large overall | 73/128 (57.03%) | 97/128 (75.78%) | +18.75 pp |
| Scale Small only | 43/128 (33.59%) | 54/128 (42.19%) | +8.59 pp |
| **Derived model-size view** | **116/256 (45.31%)** | **151/256 (58.98%)** | **+13.67 pp** |

- Paired combined table: both success **105**, CDEA-only **46**, Baseline-only **11**, neither successful **94** (total **256**).
- Size interaction as **Small treatment effect minus Large treatment effect**: **-10.16 pp**; task-bootstrap sensitivity interval **[-21.09, +0.78] pp**.
- Excluding backbone-confounded xLAM family: **-9.38 pp**, sensitivity interval **[-25.00, +4.17] pp**.
- The intervals span zero; there is **no conclusive size-interaction inference**.
- The exact paired McNemar test is exploratory, unadjusted and not task-cluster robust.
- Mechanism/trace/efficiency analyses compare **Main Large** with **Scale Small** only. They do not include the archived Scale Large episodes.

## Source-configuration comparability

| Input | Controller commit recorded in archive | Seed | Max actions | Temperature | num_predict | num_ctx |
|---|---|---:|---:|---:|---:|---|
| Main Large | `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1` | 233 | 40 | 0 | 640 | Not specified in Main shared parameters |
| Scale Small | `ff655d1389bc84aa8100b6321220f5ec01c4e3b4` | 233 | 40 | 0 | 640 | 8192 |

Both record upstream OpenApps revision `6e6782794433c60468d65ac75bc3f03c56007f8c`. The distinct controller commits and incomplete parameter parity are potential confounders of the between-source model-size contrast. The xLAM checkpoint pair also differs in backbone. Therefore, **do not attribute the apparent larger advantage of CDEA on Large checkpoints solely to parameter count**.

## Run reproducibly

Use [notebooks/cdea_main_scale_compact.ipynb](../notebooks/cdea_main_scale_compact.ipynb) with the two original ZIPs. The notebook performs manifest/protocol and paired-outcome consistency checks, filters the Scale archive to `size=small` and adds explicit source columns before analyzing. It exports nine independent PNG charts, 22 CSV reports, and `sources_and_methods.json` recording source hashes, selected counts and the exclusion rule. The original ZIP archives are never mutated.

The numerical data are outcomes **recorded in the provided reference archives**. Source-evidence limitations are separate from this descriptive/statistical recalculation.
