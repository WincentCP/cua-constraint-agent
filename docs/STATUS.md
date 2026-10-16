# Implementation status — evidence, not claims

## Current study design

WebArena-Verified **v1.2.3**, **Shopping only**. Three PoC development tasks **279, 284, 528**; six separate pilot candidates **96, 323, 436, 506, 571, 689**; **32 explicit main candidates** in config/main-candidates.json. The main pool spans 22 public intent templates, none used in PoC or pilot. No IDs overlap among the three stages.

**PoC=3 development tasks; Pilot=6 × 4 × 2=48 runs; Main=32 × 4 × 2=256 planned runs.** Main task eligibility is currently **UNREVIEWED** and research identity is **NOT FROZEN**.

## Implemented and CI-testable

- Pinned public benchmark CLI, exact task/template/intent checks; fail closed on changed public metadata.
- Independent PoC/pilot/main manifests with run-stage and template-isolation guards.
- Registered task suitability rubric, JSON reviewer checklists, candidate CSVs and approvals that start **PENDING** (and cannot silently overwrite a review).
- Human review validation requires public constraints, 2 meaningful observed choices, action/reset/evaluator checks, reviewer, notes and real nonempty local evidence.
- Main freeze command with approved stage screenings, a provisional 48-run pilot gate, exact four-model digest manifest, persisted reset proof and supervisor approval reference; main scaffold and result export refuse missing/changed freeze.
- Baseline/Proposed common prompt, visible Accessibility Tree and previous model-observed ledger state; policy switch confined to candidate probe ranking.
- Development-only local Ollama + Playwright **single-episode runner**, private initial/final/decision screenshots, JSONL action traces, agent HAR, typed metadata, official evaluator invocation.
- PoC screenshot and ARIA inspection separated from executed agent output.
- Pilot operational gate reads real official evaluation metadata, rejects no-data and evaluator errors.
- Stage artifact indexes, sanitized 48/256 expected-cell CSVs, paired first-decision divergence diagnostics.
- Colab notebook exports 300-DPI figures, descriptive tables and complete-main-only exact paired McNemar tests.
- Cross-platform CI, synthetic browser/agent and Colab fixture tests; zero invented benchmark task successes.

## Not yet validated/completed — STOP conditions

- Actual full **live** Shopping inspection and official task evaluator for all three PoC types on the user's Windows RTX 5060.
- Browser agent capabilities for difficult checkout, form drafting without submission, address update and account order workflows.
- Verified **persistent** Magento site reset and matched initial states across paired runs.
- Human-screened and approved PoC/pilot/main tasks; candidate metadata alone is not eligibility.
- Real Ollama model competence, model digests/hardware logs and reproducible 48 valid pilot episodes.
- Reviewed/approved all 32 candidates, final supervisor signoff and genuine frozen main identity.
- Balanced/reset-safe 48/256-run orchestration; main agent runner is deliberately disabled.
- Actual main results, independent evidence-correctness audit, confirmatory statistics or finished Bab IV.

**No test fixture, successful GitHub Action or model-stated SUCCESS should be reported as official WebArena task success.** If any candidate is not suitable under the registered criteria, discuss a pre-main protocol revision with the supervisor rather than fabricating eligibility. Do not switch to MASM as a Proposed-only addition.

See [EXPERIMENT.md](EXPERIMENT.md) and [SETUP.md](SETUP.md).
