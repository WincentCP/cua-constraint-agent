# Research Documentation

This folder contains the current research reference documents for the **Constraint-Driven Evidence Acquisition (CDEA)** study. Start with the root [README](../README.md) for the overall question, setup, and headline results.

## Main experiment

| Document | Purpose |
|---|---|
| [Main results](MAIN_RESULTS_V1.md) | Observed completion rates, paired outcomes, exploratory statistical analysis, and mechanism diagnostics |
| [Main protocol](MAIN_PROTOCOL_V1.md) | **Frozen, pre-experiment** study design, sampling, analysis plan, integrity gates, and limitations |
| [Main task set](MAIN_TASKSET_V1.md) | Selection rationale and definitions of all 32 official OpenApps tasks |
| [Data provenance](DATA_PROVENANCE.md) | Archive identity, SHA-256 fingerprint, recorded researcher review, and scope of verification |
| [Reproducibility](REPRODUCIBILITY.md) | Environment setup, checkpoints, validation commands, and result-artifact locations |
| [Readiness template](MAIN_READINESS_TEMPLATE.json) | Original pre-run template; its pending values are intentional and **not** the signed record in the archived experiment |

## Earlier research stage

- [Pilot protocol](PILOT_PROTOCOL.md) — frozen design and criteria for the earlier exploratory pilot.

## Source-of-truth conventions

- The frozen implementation is identified by controller commit `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1`; later documentation-only commits do not alter that study controller.
- The Main result dataset is preserved separately as `main_observation_v1(5).zip`. Its identity and hash are listed in [Data provenance](DATA_PROVENANCE.md).
- The Main protocol was authored before collection and intentionally describes *pre-experiment* conditions. Later results belong in [Main results](MAIN_RESULTS_V1.md), **not** in a rewritten preregistration.
- Historical development notes have been removed from the current documentation tree to keep the repository focused. Their revisions remain recoverable through ordinary Git history.
