# Thesis source freeze — release checklist and evidence boundaries

**Prepared:** 2026-10-24. **Purpose:** stable, citable code/protocol documentation before thesis drafting. This source freeze is **not** a certificate that every reported experiment was live or that every archive passed an independent provenance audit.

## Source and design scope

- Research question: does constraint/forward-cost-aware ranking of eligible public information probes outperform Baseline progress ranking, and does the observed difference vary with model size?
- Main: frozen [Main protocol](MAIN_PROTOCOL_V1.md), 32 official OpenApps tasks × four 8–9B models × Baseline/Proposed (128 matched pairs, 256 episode slots).
- Scale: independent exploratory [Scale protocol](SCALE_PROTOCOL_V1.md), same 32 task IDs × eight checkpoints from four families (256 matched pairs, 512 episode slots); 3–4B compared with 8–9B.
- Intervention scope: `scripts/browsergym/shared_policy.py` ranks model-proposed eligible probes; model training is not part of the intervention.
- Frozen Main controller: `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1`; archived Scale claimed controller: `0cf0a376f51d9a9717eb58c1c3b1974119fdcaea`; upstream OpenApps: `6e6782794433c60468d65ac75bc3f03c56007f8c`.
- Historical Main results/approval are documented in [Main results](MAIN_RESULTS_V1.md) and [Main data provenance](DATA_PROVENANCE.md). The original Main ZIP was not supplied for this release check; earlier repository wording says the Main PASS is **researcher-reported**, not host-attested.
- The supplied Scale reference ZIP was inspected and fails selected source-compatibility checks. See [Scale results](SCALE_RESULTS_V1.md) and [Scale archive audit](SCALE_ARCHIVE_AUDIT_V1.md). Its numbers are descriptive *archive-reported* results, not verified live outcomes.

## Reproducibility / release commands

Run from a Python-compatible checkout on the committed revision:

~~~powershell
python -m unittest discover -s tests -v
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_scale.ps1 -DryRun
python .\scripts\browsergym\audit_scale_archive.py '.\scale_reference_v2(1).zip' --report .\scale_numeric_audit.json
python .\scripts\browsergym\audit_scale_compatibility.py '.\scale_reference_v2(1).zip' --report .\scale_source_audit.json --require-compatible
~~~

The last command is **expected to fail** for the supplied reference ZIP. Unit tests and dry-runs do not launch the historical model/benchmark runs. Actual runtime testing needs the original Windows/OpenApps/Ollama environment and the exact locked digests. Do not report a local unit-test PASS as runtime PASS.

## Release decisions

| Gate | State as of 2026-10-24 | Required action |
|---|---|---|
| Study plans and method definitions | Documented and versioned | Preserve frozen sources; change with new study IDs only |
| Paired-descriptive analysis of supplied Scale ZIP | Recomputed | Use as archive-reported reference, clearly labelled |
| Automated source-compatibility audit | Added and locally tested | Run on any candidate evidence ZIP; retain report |
| Original Main archive host provenance | Not independently verified in this review | Verify from original raw evidence before making independent claim |
| Supplied Scale archive compatibility | **FAIL**, including two of three source-config Git blobs and pinned-route/Hydra checks | Obtain genuine compatible run evidence; preserve existing ZIP unchanged |
| GitHub CI contract tests and review | Pending until branch integration | Merge only after CI checks and review |
| Research result ready to cite as verified live | **NO** | Address provenance gaps, do not recast archive data |

## Thesis drafting boundaries

- **Bab III (Method):** can describe source-controlled algorithm, matched-pair design, benchmark, pinned environment, metrics, and planned stratification.
- **Bab IV (Results):** may describe the reference archive with explicit provenance qualification. Do not call the Scale ZIP independently verified live official rewards; do not present incompatible rewards as observations produced by the pinned runner.
- **Bab V (Conclusions):** state descriptive patterns and limitations only unless verified execution evidence becomes available. The apparent +8.59 pp small-model and +17.19 pp large-model benefits are *not* validated causal findings.
- If a supervisor authorizes illustrative/simulated data in a dissertation context, mark it **explicitly** as illustrative/simulated in the thesis and data documentation, not solely in an easily overlooked file.

Freeze the exact merged commit SHA for thesis citations. Never silently edit original experiment data or approvals. A later valid live study should receive a fresh study ID and independent source/provenance audit rather than rewriting this record.
## Verification addendum (2026-10-24)

The offline compatibility auditor checks the exact controller/OpenApps pins, public constraint and trace IDs, Todo SQLite schema, a pinned official-task goal canary, archived Git blob identities for plan/model/taskset, presence of the expected upstream Hydra app configuration, and selected incompatible access-log routes. Seven auditor unit tests passed in the local expanded implementation; the committed auditor has five offline regression tests. Full GitHub CI results have not yet been confirmed. The supplied reference archive fails the strict compatibility gate (exit 3). This is an expected and documented **NO-GO for claiming independently verified live Scale results**, not a CI defect. Main result provenance is separately researcher-reported and was not re-audited against its original archive in this release.
