# Main Experiment v1 — Results

This document summarizes the main-results archive `main_observation_v1(5).zip`, supplied by the researcher. It reports the results recorded in the archive; it is not itself a runtime re-execution.

## Study identification

- Study: `cdea_main_v1`
- Main ID: `main_observation_v1`
- Controller commit: `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1`
- Upstream OpenApps commit: `6e6782794433c60468d65ac75bc3f03c56007f8c`
- Four model checkpoints: Qwen3.5-9B, Ministral3-8B, Granite4.1-8B, xLAM2-8B (exact digests recorded in `model_digests.json`)
- Design: 32 official tasks × 4 models × 2 methods = 128 matched pairs / 256 episodes
- Main task order SHA-256: `73d4a4a8e377422072c6ab27c066f87f8acbed7683ed50168c3407c861d61333`
- Shared budget: seed 233, up to 40 browser steps per arm; temperature 0; model timeout 240 seconds; 640 output tokens

## Main results

The archive records 128 completed, valid pairs, zero invalid pairs, and zero not-started pairs.

| Cohort | Valid pairs | Baseline success | Proposed/CDEA success | Proposed minus Baseline |
|---|---:|---:|---:|---:|
| Bank information (primary) | 20 | 10/20 (50.0%) | 18/20 (90.0%) | +40.0 percentage points |
| Cross-app workflow | 72 | 35/72 (48.6%) | 51/72 (70.8%) | +22.2 percentage points |
| Primitive control | 36 | 28/36 (77.8%) | 28/36 (77.8%) | 0.0 percentage points |
| **All tasks** | **128** | **73/128 (57.0%)** | **97/128 (75.8%)** | **+18.8 percentage points** |

### Primary paired inference

For the 20 bank-information pairs, the paired-outcome table is:

| Outcome | Pairs |
|---|---:|
| Both methods succeed | 9 |
| Proposed succeeds; Baseline fails | 9 |
| Baseline succeeds; Proposed fails | 1 |
| Neither succeeds | 1 |

Paired difference: `(9 - 1) / 20 = +0.40`. The archived two-sided exact McNemar sensitivity analysis reports `p = 0.021484375` (exploratory, unadjusted).

**Interpretation:** The observed results favor CDEA on the selected OpenBanking cohort. These five bank task IDs are each repeated across four models, and tasks share benchmark state/templates; the observations should not be treated as independent draws from a population of all computer-using agents. The exploratory p-value is not a stand-alone proof of universal superiority.

### Treatment-mechanism diagnostics

From the archived episode records:

- 48 distinct matched pairs contain at least one comparable information-probe decision.
- 33 distinct pairs record at least one policy-action divergence.
- A recorded divergence is evidence that the methods can choose different actions; a causal mechanism claim requires trace-level review of what was observed and why the actions mattered.

## Outputs used

The supplied archive includes:

- `manifest.json`: study identity, schedule, approvals, model/plan digests
- `model_digests.json`: installed checkpoint identities
- `results.csv`: 256 episode-level records
- `pairs.csv`: 128 paired outcomes
- `summary.csv`: 40 aggregate rows
- `analysis.json`: planned denominators, primary table and inference
- `episodes/pair_001` through `episodes/pair_128`: paired traces and retained episode/server artifacts
- `preflight/` and `readiness/`: recorded evidence reviews and approval

See [DATA_PROVENANCE.md](DATA_PROVENANCE.md) for the artifact fingerprint, reported review status, and verification scope. The raw archive is retained separately from this Git repository and is not silently replaced by a generated report.

## Related documents

- [Preregistered Main protocol](MAIN_PROTOCOL_V1.md)
- [Frozen task roster](MAIN_TASKSET_V1.md)
- [Main plan configuration](../config/main_plan.json)
