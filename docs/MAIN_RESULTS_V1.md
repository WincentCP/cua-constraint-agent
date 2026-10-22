# Main v1 — Results

**Source:** researcher-supplied `main_observation_v1(5).zip` · Study `cdea_main_v1` · Main ID `main_observation_v1`. These are recorded archive outcomes, not a new runtime execution.

| Design | Value |
|---|---|
| Benchmark | OpenApps via BrowserGym |
| Methods | Baseline vs Proposed (CDEA) |
| Models | Qwen3.5-9B, Ministral3-8B, Granite4.1-8B, xLAM2-8B |
| Workload | 32 official tasks × 4 models × 2 methods |
| Coverage | **128 valid pairs / 256 episodes**; 0 invalid, 0 not started |
| Budget | Seed 233, up to 40 actions/arm, temperature 0, model timeout 240 s, 640 output tokens |
| Frozen controller | `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1` |
| OpenApps commit | `6e6782794433c60468d65ac75bc3f03c56007f8c` |
| Task order SHA-256 | `73d4a4a8e377422072c6ab27c066f87f8acbed7683ed50168c3407c861d61333` |

## Success rates

| Cohort | Valid pairs | Baseline | Proposed | Difference |
|---|---:|---:|---:|---:|
| Bank information (primary) | 20 | 10/20 (50.0%) | 18/20 (90.0%) | **+40.0 pp** |
| Cross-app workflow | 72 | 35/72 (48.6%) | 51/72 (70.8%) | +22.2 pp |
| Primitive control | 36 | 28/36 (77.8%) | 28/36 (77.8%) | 0.0 pp |
| **Overall** | **128** | **73/128 (57.0%)** | **97/128 (75.8%)** | **+18.8 pp** |

## Primary paired inference (bank information)

| Paired outcome | Pairs |
|---|---:|
| Both succeed | 9 |
| Proposed only | 9 |
| Baseline only | 1 |
| Neither succeeds | 1 |

Paired difference = (9 − 1) / 20 = **+40.0 pp**. Exploratory, unadjusted two-sided exact McNemar: **p = 0.021484375**. Five banking task IDs are repeated across four models and share benchmark state; this test is **not cluster-robust** and does not establish population-wide superiority.

## Mechanism diagnostics

- **48** matched pairs with comparable information-probe decisions.
- **33** matched pairs with policy-action divergence.
- Divergence shows a different action choice; causal attribution requires review of public observations, selected probes and episode traces.

**Archive outputs:** `manifest.json`, `model_digests.json`, `results.csv`, `pairs.csv`, `summary.csv`, `analysis.json`, `readiness/`, `preflight/`, and `episodes/pair_001` through `pair_128`.

See [32-task roster](MAIN_TASKSET_V1.md), [frozen protocol](MAIN_PROTOCOL_V1.md) and [provenance/verification scope](DATA_PROVENANCE.md).
