# Main Experiment v1 — Data and Execution Provenance

## Archive identity

| Item | Value |
|---|---|
| Archive received | `main_observation_v1(5).zip` |
| Study ID in manifest | `main_observation_v1` |
| Archive SHA-256 | `74f48100b4dc6ae074573596dc87beed18770d4c3740f2c01f5efcd57a2d885c` |
| Controller Git commit in manifest | `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1` |
| OpenApps Git commit in manifest | `6e6782794433c60468d65ac75bc3f03c56007f8c` |
| Protocol | `cdea_main_v1` |
| Recorded approval | `Wincent Coleus Phan`, 2026-10-20 09:59:30 UTC |

## Provenance review status

**Researcher-reported live-provenance review: PASS.** The researcher reports that the live evidence was checked against the study audit criteria. The archived `readiness/readiness_v1.json` marks all six readiness checks as passed and names the approving researcher.

This document distinguishes the recorded researcher approval from independent verification. The presence of logs, hashes, process IDs, and signed-off records supports traceability but, alone, does not independently demonstrate that each process executed on the claimed original host. No independent host-level attestation or external auditor report was supplied for this documentation update.

## Archive checks carried out for this repository update

- ZIP entry integrity check passed.
- `results.csv` contains 256 rows, `pairs.csv` 128 rows, and `summary.csv` 40 rows.
- `analysis.json` reports 128 valid pairs, zero invalid and zero not started; the success-rate totals recompute from the episode records.
- Per-episode records include server process identifiers and relevant browser/server trace paths.
- The archive has a readiness approval record and six associated evidence references.
- The archive's recorded commit/plan/task/model hashes are identified in the manifest.

**Scope:** These checks establish the archive's readability and internal result consistency. They do not replace review of original host logs, executable invocation records, or independent replay.

## Preservation and reproducibility

Keep the original ZIP unchanged and verify its SHA-256 before reproducing the analysis. When sharing the data with thesis examiners, include this fingerprint, `manifest.json`, the six evidence records, and complete paired episode traces. Do not modify historical pre-run protocol documents to retrofit the observed results.

The original frozen study design is in [MAIN_PROTOCOL_V1.md](MAIN_PROTOCOL_V1.md); the outcomes are summarized in [MAIN_RESULTS_V1.md](MAIN_RESULTS_V1.md).
