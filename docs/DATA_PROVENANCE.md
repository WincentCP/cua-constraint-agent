# Main v1 — Data Provenance

## Archive identity

| Item | Recorded value |
|---|---|
| Archive | `main_observation_v1(5).zip` |
| Study ID | `main_observation_v1` |
| SHA-256 | `74f48100b4dc6ae074573596dc87beed18770d4c3740f2c01f5efcd57a2d885c` |
| Controller commit | `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1` |
| OpenApps commit | `6e6782794433c60468d65ac75bc3f03c56007f8c` |
| Protocol | `cdea_main_v1` |
| Recorded approval | Wincent Coleus Phan · 2026-10-20 09:59:30 UTC |
| Researcher-reported live-provenance review | **PASS** · six readiness gates marked passed |

## Recorded archive checks

- ZIP integrity passed; `results.csv`: **256** rows, `pairs.csv`: **128**, `summary.csv`: **40**.
- `analysis.json` records **128 valid**, **0 invalid**, **0 not-started** pairs; aggregate successes reconcile with episode records.
- Manifest records frozen source/config/model identities; archive includes readiness approval and six evidence references.
- Episode records include process identifiers and browser/server trace paths.

## Verification scope

**PASS is the researcher's recorded live-evidence review, not an independent host-level attestation.** Archive checks support integrity and traceability; this documentation update did not independently confirm original-host execution or replay every episode.

**Historical `num_ctx` caveat (2026-10-27):** The recorded Main manifest and all 256 Main episode JSONs lack an explicit `num_ctx`; the archived context-window value cannot be established from those fields. A later runner commit sets Main `num_ctx=8192`, matching Scale, for **future executions only**. The Scale historical manifest and its 512 episodes explicitly record `8192`. Never backfill the historical Main archive or describe the runtime context as verified without original request-side evidence.

Preserve the original archive unchanged. For review, provide its fingerprint, `manifest.json`, readiness evidence and paired traces alongside the [Main results](MAIN_RESULTS_V1.md) and [frozen protocol](MAIN_PROTOCOL_V1.md).

## Notebook input alias

The study source can also be supplied to the current notebook under the name `main_observation.zip`. Its SHA-256 remains `74f48100b4dc6ae074573596dc87beed18770d4c3740f2c01f5efcd57a2d885c`. Renaming is not a new experiment and does not alter recorded source history.
