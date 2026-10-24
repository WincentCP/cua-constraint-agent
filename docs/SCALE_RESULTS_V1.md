# Scale Study v1 — archive-reported results and interpretation

**Status (2026-10-24): descriptive review only; NOT independently verified live experimental evidence.** This is an exploratory follow-up to the frozen Main v1 protocol. No Main or Scale source observations have been replaced or relabelled.

## Dataset reviewed

- Input: researcher-supplied `scale_reference_v2(1).zip`, study ID `scale_reference_v2` (stored separately, not committed here).
- SHA-256: `911f145e3c0506d2a27da427e08ebbcefb2b94a868c5aa2c09ec314f648d9b41`.
- Manifest reports controller commit `0cf0a376f51d9a9717eb58c1c3b1974119fdcaea`, OpenApps commit `6e6782794433c60468d65ac75bc3f03c56007f8c`, 32 tasks and eight checkpoint labels.
- Structural archive review: ZIP integrity and 4,875 listed SHA-256 hashes match; 256 paired CSV rows, 512 episode CSV rows, 64 summary rows; 256 pairs labelled valid and 0 invalid/not started in the *archive*. These checks do not authenticate an execution.

## Success-rate summary (as recorded)

The unit is a valid Baseline/Proposed matched task × checkpoint pair. All percentages below are descriptive outcomes computed from archived `pairs.csv`, not independently verified official benchmark rewards. `pp` means percentage points, not percent relative change.

| Model size | Recorded valid pairs | Baseline successes | Proposed successes | Difference |
|---|---:|---:|---:|---:|
| Small (3–4B) | 128 | 43/128 (33.59%) | 54/128 (42.19%) | +8.59 pp |
| Large (8–9B) | 128 | 73/128 (57.03%) | 95/128 (74.22%) | +17.19 pp |
| All models | 256 | 116/256 (45.31%) | 149/256 (58.20%) | +12.89 pp |

| Model | Baseline /32 | Proposed /32 | Proposed − Baseline |
|---|---:|---:|---:|
| Qwen3.5 4B | 14 | 17 | +9.38 pp |
| Qwen3.5 9B | 20 | 27 | +21.88 pp |
| Ministral3 3B | 11 | 16 | +15.63 pp |
| Ministral3 8B | 21 | 28 | +21.88 pp |
| Granite4.1 3B | 10 | 13 | +9.38 pp |
| Granite4.1 8B | 18 | 24 | +18.75 pp |
| xLAM2 3B | 8 | 8 | +0.00 pp |
| xLAM2 8B | 14 | 16 | +6.25 pp |

| Task cohort | Pairs | Baseline | Proposed | Difference |
|---|---:|---:|---:|---:|
| Bank information | 40 | 14/40 (35.00%) | 29/40 (72.50%) | +37.50 pp |
| Cross-app workflow | 144 | 55/144 (38.19%) | 72/144 (50.00%) | +11.81 pp |
| Primitive control | 72 | 47/72 (65.28%) | 48/72 (66.67%) | +1.39 pp |

The archived 2×2 paired outcomes are: both succeed 102, Proposed-only 47, Baseline-only 14, neither succeed 93. In this archive, 145 comparable probe decisions and 96 action divergences are internally reconstructable from trace metadata. Of the 47 Proposed-only successes, 20 have no recorded policy-action divergence, so those wins cannot straightforwardly be attributed to probe-ranking decisions.

## Model-size interaction

The pre-specified exploratory contrast is (Proposed − Baseline at small size) minus (Proposed − Baseline at large size), evaluated on tasks valid at both sizes within family.

| Family | Common valid tasks | Small effect | Large effect | Small − large |
|---|---:|---:|---:|---:|
| Qwen3.5 | 32 | +9.38 pp | +21.88 pp | −12.50 pp |
| Ministral3 | 32 | +15.63 pp | +21.88 pp | −6.25 pp |
| Granite4.1 | 32 | +9.38 pp | +18.75 pp | −9.38 pp |
| xLAM2 | 32 | +0.00 pp | +6.25 pp | −6.25 pp |
| Overall, descriptive | 128 across families | +8.59 pp | +17.19 pp | −8.59 pp |

The consistent *direction in this archive* is a larger CDEA gain for the larger checkpoints. This does **not** establish a causal model-size effect or a population effect. The same 32 tasks recur across models on seeded environments, comparisons are correlated, sample size per family is limited, and the xLAM2 small/large checkpoints differ in backbone architecture. No confirmatory p-value or confidence claim is made.

## Critical validation caveat

The data above must not be reported as *verified live official OpenApps/BrowserGym results*. A separate source-compatibility audit finds 512/512 mismatched controller public-constraint records, 512/512 incompatible Todo database schemas, 290 episodes whose trace probe IDs conflict with the pinned controller, and 16 official-task goal canary mismatches. A sample archived success for `gym_todo_and_message_bob` is inconsistent with the pinned official task target. See [Scale provenance review](SCALE_ARCHIVE_AUDIT_V1.md).

## Thesis usage

Until authentic replay or independent source-level verification resolves these conflicts, use these figures only as a **researcher-supplied archival reference or explicitly identified illustrative dataset**. The Scale protocol and code can be described as implemented research methods, while a claim that the experiment ran live and achieved these official reward rates requires verifiable execution evidence. Keep the original archive unchanged; do not change checkpoint labels, hashes, validities, rewards, timestamps or logs to force acceptance.