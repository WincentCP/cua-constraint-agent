# Pilot v1 — Recorded Results

**Source:** Researcher-provided `pilot_observation_v1(2).zip` · Pilot ID `pilot_observation_v1` · protocol `cdea_pilot_v1`. The original ZIP is retained separately, not committed to Git.

| Study identity | Recorded value |
|---|---|
| Benchmark | Official OpenApps tasks through BrowserGym core `0.13.4` |
| Treatment | Baseline vs Proposed (CDEA) |
| Model set | Qwen3.5-9B, Ministral3-8B, Granite4.1-8B, xLAM2-8B |
| Coverage | **6 tasks × 4 models × 2 methods = 24 valid pairs / 48 episodes** |
| Invalid / not started | **0 / 0 pairs**, according to the archive |
| Controller commit | `7f886ecd163d0483b24e048405a567f902e721de` |
| OpenApps commit | `6e6782794433c60468d65ac75bc3f03c56007f8c` |
| ZIP SHA-256 | `566139e0f50652cd4bfc1f12550333bbd3a0b94095d18299d448a2864516dd56` |

## Success on valid matched pairs

| Cohort | Pairs | Baseline | Proposed (CDEA) | Difference |
|---|---:|---:|---:|---:|
| Primitive controls | 8 | 7/8 (87.50%) | 7/8 (87.50%) | 0.00 pp |
| Cross-app workflow | 4 | 2/4 (50.00%) | 2/4 (50.00%) | 0.00 pp |
| Bank information | 12 | 4/12 (33.33%) | 6/12 (50.00%) | +16.67 pp |
| **Overall** | **24** | **13/24 (54.17%)** | **15/24 (62.50%)** | **+8.33 pp** |

| Model | Pairs | Baseline | Proposed |
|---|---:|---:|---:|
| Granite4.1-8B | 6 | 2/6 | 3/6 |
| Ministral3-8B | 6 | 5/6 | 5/6 |
| Qwen3.5-9B | 6 | 5/6 | 6/6 |
| xLAM2-8B | 6 | 1/6 | 1/6 |

**Paired outcomes:** both succeed 13; Proposed-only 2; Baseline-only 0; neither 9.

## CDEA engagement diagnostics

- **8 comparable probe decisions** across 8 matched pairs.
- **4 matched pairs** record policy-action divergences, all on bank-information tasks.
- The two Proposed-only successes occur on bank-information tasks. Engagement and divergence are recorded diagnostics; causal attribution requires trace review.

## Archive verification and interpretation

- Verified ZIP CRC, 24 scheduled pairs in `manifest.json`, 48 rows in `results.csv`, 10 rows in `summary.csv`, and 24 paired `pair.json` files.
- Compared scheduled task/model IDs, paired success records, initial-state parity, and 48 episode JSON files. The archive retains 48 server logs, 48 `config.yaml`, 48 `requests.log`, and episode process identifiers.
- The researcher identifies this as a live Pilot. Archive consistency and recorded runtime artifacts do **not**, by themselves, constitute independent original-host execution attestation.
- Pilot is exploratory; its small, reused task/model set does not establish general superiority. These six task IDs were excluded from the [frozen Main task set](../MAIN_TASKSET_V1.md).

See [Pilot protocol](PILOT_PROTOCOL.md) for the frozen design and [Main results](../MAIN_RESULTS_V1.md) for the separate confirmatory-cohort analysis.
