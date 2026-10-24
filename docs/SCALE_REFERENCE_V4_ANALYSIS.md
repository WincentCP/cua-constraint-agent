# Scale v1 analysis — 3B–9B checkpoint follow-up

**Status:** analysis of user-provided reference archive; **not independently verified as original-host live execution**. Supervisor approval, when documented, is separate from technical provenance verification.

## Data identity
- Study: `scale_reference_v4`, protocol `cdea_scale_v1`
- Original input: `scale_reference_v4.zip`
- Input archive SHA-256: `052ecf15e2466109175153022baa7a1007a8a88c7358307823f85c3947b38f96`
- Controller commit recorded in archive: `ff655d1389bc84aa8100b6321220f5ec01c4e3b4`
- Upstream OpenApps commit recorded in archive: `6e6782794433c60468d65ac75bc3f03c56007f8c`
- 32 task IDs × 8 checkpoint labels = 256 scheduled matched pairs and 512 episode slots
- Recorded valid pairs: 256; invalid: 0; not started: 0

## Recomputed descriptive results
| Group | Pairs | Baseline successes | CDEA successes | Difference (pp) |
|---|---:|---:|---:|---:|
| All checkpoints | 256 | 116 | 149 | +12.89 |
| Small (3B–4B) | 128 | 43 | 54 | +8.59 |
| Large (8B–9B) | 128 | 73 | 95 | +17.19 |
| Bank information, small | 20 | 5 | 11 | +30.00 |
| Bank information, large | 20 | 9 | 18 | +45.00 |
| Cross-app, small | 72 | 21 | 26 | +6.94 |
| Cross-app, large | 72 | 34 | 46 | +16.67 |
| Primitive control, small | 36 | 17 | 17 | 0.00 |
| Primitive control, large | 36 | 30 | 31 | +2.78 |

These are **recorded outcome statistics**, not independent confirmation that the official evaluator ran. The difference is in percentage points; it is not the relative-percent increase.

## Mechanism and efficiency
- Recorded comparable information-probe decisions: 145
- Recorded policy-action divergences: 96
- Across all 512 archived episode traces / 12,328 recorded actions, 0 `grounded_tentative_evidence` entries and 0 steps with non-UNKNOWN constraint ledger states were found.
- Probe/action divergence alone does not prove valid evidence acquisition or a causal mediator.

## Runtime / provenance distinction
An archive-internal `provenance/validation_report.json` claims verification, while reporting 0 observed real launchers and 0 digests verified against the original Ollama host. The 512 archived `server/launcher.json` files contain source/template metadata, but not observed launcher PIDs. The archive also records episode end times extending into 2026-10-25, beyond the 2026-10-24 review. Treat **live execution status as unresolved**. Do not alter these fields to represent an observed live run.

## Reproduce the notebook
Use the updated `main_scale_analysis_updated.ipynb` notebook supplied alongside the analysis. Put original Main and/or Scale ZIP beside it, or set `MAIN_ZIP_PATH` and `SCALE_ZIP_PATH`. The notebook identifies archives by manifest protocol, validates scheduled counts, analyzes Main and Scale separately, computes paired descriptive statistics and exploratory within-family size contrasts, inspects episode traces, and writes `analysis_outputs/scale/`.

The frozen Main controller is unchanged; the Scale analysis is an exploratory follow-up. The xLAM 3B and 8B checkpoints use different backbones, preventing a clean causal model-size comparison. Unadjusted paired statistics are not population-level evidence due to common tasks and model dependence.

## Writing guidance
The thesis may describe these as **results recorded in the reference archive** and analyze them now. Claims that a separate person witnessed live execution, verified original host logs, or independently authenticated the official rewards require those actual records. Administrative supervisor approval does not replace them.
