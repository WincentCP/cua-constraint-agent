# Scale v1 — model-size follow-up analysis

Exploratory **Baseline vs CDEA** analysis from `scale_reference_v4.zip`: 32 fixed OpenApps tasks, eight checkpoint labels (3B–9B), 256 matched pairs, and 512 episode records.

## Main results

| Cohort | Valid pairs | Baseline success | CDEA success | Delta (pp) |
|---|---:|---:|---:|---:|
| All checkpoints | 256 | 116 (45.31%) | 149 (58.20%) | **+12.89** |
| Small models (3B–4B) | 128 | 43 (33.59%) | 54 (42.19%) | +8.59 |
| Large models (8B–9B) | 128 | 73 (57.03%) | 95 (74.22%) | +17.19 |
| Bank-information tasks — small | 20 | 5 | 11 | +30.00 |
| Bank-information tasks — large | 20 | 9 | 18 | +45.00 |
| Cross-app workflows — small | 72 | 21 | 26 | +6.94 |
| Cross-app workflows — large | 72 | 34 | 46 | +16.67 |
| Primitive controls — small | 36 | 17 | 17 | 0.00 |
| Primitive controls — large | 36 | 30 | 31 | +2.78 |

Rates are computed over the valid-pair denominator. A *percentage-point difference* is not a relative percent increase. The dataset reports 256 valid, 0 invalid, and 0 not-started pairs.

**Interpretation:** CDEA has a positive recorded aggregate difference, with a larger descriptive advantage in the 8B–9B group than in the 3B–4B group. These fixed, shared task IDs create dependence; size effects and exploratory exact McNemar comparisons should not be presented as population-level causal findings.

## Mechanism and scope

- 145 recorded comparable information-probe decisions; 96 recorded policy-action divergences.
- In the 512 archived episode traces (12,328 recorded action steps), no `grounded_tentative_evidence` entries or non-`UNKNOWN` ledger states were observed.
- Policy divergence is a mechanism-engagement indicator, **not** independent proof that obtaining information caused success.
- The xLAM 3B and 8B checkpoints use different model backbones, so their contrast is not a controlled parameter-count effect.

## Reproduce outcome analysis

Open [**Compact Main + Scale notebook**](../notebooks/cdea_main_scale_compact.ipynb) in Google Colab or Jupyter. Place a Main or Scale ZIP beside it, or set `MAIN_ZIP` and `SCALE_ZIP` in its first code cell. The notebook automatically detects manifest protocols, checks paired denominators and results consistency, and calculates success rates, exploratory McNemar, task-resampled sensitivity intervals, within-family size comparisons, and descriptive efficiency/probe indicators. It exports three figures and up to 15 populated CSV tables to `analysis_outputs_compact/` (13 when only the Scale ZIP is loaded).

The Main and Scale studies are analyzed separately; **do not combine their overlapping task/model observations as independent experimental replicates**.

## Dataset source notes

- Archive SHA-256: `052ecf15e2466109175153022baa7a1007a8a88c7358307823f85c3947b38f96`
- Recorded controller commit: `ff655d1389bc84aa8100b6321220f5ec01c4e3b4`
- Recorded upstream OpenApps commit: `6e6782794433c60468d65ac75bc3f03c56007f8c`
- The archive's `provenance/validation_report.json` includes a validation claim alongside **zero observed launcher records and zero verified Ollama digest sets**. Launcher records lack observed server PIDs, and some episode timestamps extend beyond the archive review date. These are unresolved source-evidence limitations, not inputs to the success-rate calculations. The original historical execution cannot be independently established from this archive alone.

The original ZIP and preserved execution utilities remain unchanged. For the thesis, report these calculations as **outcomes recorded in the supplied reference archive**, with the source notes above retained separately from the statistical workflow.
