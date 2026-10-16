# Evidence collection for Bab IV and appendices

**Rule:** screenshots, quotes from an Accessibility Tree and model-declared SUCCESS are **not** official task success. Official WebArena-Verified outcomes are `eval_result.json`, generated from a real agent `agent_response.json` and agent `network.har`. All raw evidence is local/private, not Git-tracked.

## PoC (279, 284, 528 — development only)

- For **each** PoC task, export the exact public task input, inspect initial page (ARIA snapshot, `screenshots/start-01.png`, `inspection.json`, `inspection.har`) and preserve the details of **two meaningful probe choices**, not just two arbitrary hyperlinks.
- Review `reports/poc/poc-screening.json`: at least three public requirements and explicit evidence choices per task, actual evaluator availability, browser control support, persistent reset, no hidden answer leakage, real screenshots and reviewer notes. Draft fields start **PENDING**, never auto-PASS.
- Next, separately test a **model-driven browser episode** for each task type and, if a real agent output exists, evaluate with the pinned official CLI. `inspection.har` never substitutes for agent `network.har`.
- Suggested Bab IV visuals: environment overview (task 279), product capacity/price selection (284), form-before-submit checkpoint (528), sample model decision trace and honest GO/MODIFY/REJECT review outcomes.

## Pilot (96, 323, 436, 506, 571, 689)

**6 × 4 × 2 = 48 registered episodes**, held out from PoC by task and template. The pilot review `reports/pilot/pilot-screening.json` records all eligibility evidence independently of success. If difficult mutations are unsupported by the runner, mark **REJECT**; do not mislabel technical errors as Proposed failing. The operational pilot gate must be approved by the supervisor before collecting pilot outcomes.

Every valid episode lives at `output/pilot/runs/<model>/<baseline|proposed>/<task-id>/`. `pilot:gate` counts official successes, technical validity, model and task diversity. If no valid official evaluator outputs exist, FAIL is correct. `results:export -- --stage pilot` creates `run-inventory.csv` (all 48), `analysis-results.csv` (valid official only) and `paired-first-decisions.csv` (diagnostic, not evidence accuracy).

Suggested Bab IV visuals: 48-run coverage, per-model successes and floor effects, error categories, median actions/runtime, first-decision divergence, evidence-quality audit exemplars and conditional GO/NO-GO.

## Main (32 candidates; not frozen yet)

`config/main-candidates.json` names all **32 public Shopping candidate IDs**, eight in each of four task groups, with 22 unique main templates. `reports/task-screening/main-review.json` must have 32 substantiated PASS reviews before any frozen set. A catalog ID without actual UI choices/constraints **does not qualify**.

A frozen main requires official catalog verification, 3-stage screening, pilot GO, real model digests, persistent reset evidence, supervisor approval, and study/code fingerprint. `main:freeze` records the identity without running tasks; `artifacts:init --stage main` and main CSV export refuse an unfrozen study. **No main batch agent runner is claimed to exist yet.**

With **256 complete valid official episodes**, Colab calculates per-model paired outcomes, exact McNemar tests with Holm adjustment, confidence/uncertainty (where implemented), and task success/efficiency figures. There are only **32 distinct task IDs**; do not treat 256 evaluations as 256 independent tasks.

## Recording standards

1. The **same** initial/final screenshot and decision-checkpoint rule for Baseline and Proposed (up to three meaningful decision screenshots per run). Do not select examples based solely on favorable outcomes.
2. Per-step trace stores publicly grounded observations, model-reported constraint states, eligible probe IDs, estimated progress scores, selected probe, action, and observed rationale. Treat simple quote-substring matching as **diagnostic, not correctness**.
3. **Evidence correctness / required constraint coverage** requires independent human verification against saved observations, preferably blinded to method. Register the sampling/audit plan before viewing main outcomes. An unaudited constraint is `UNVERIFIED`, never marked correct by the model or script.
4. Per-run identity: unique run ID, task, model digest, stage, method, benchmark/evaluator versions, settings and timestamps. Do not overwrite an existing episode. Log any invalid/error/timeout/retry.
5. Fresh **persistent Magento reset** between independent episodes; Playwright context isolation is insufficient. Log reset proof and balanced execution order. See `docs/RESET_PROTOCOL.md`.
6. `run-inventory.csv` includes missing, invalid and unrun cells; **never convert them to official failures**. Record the planned denominator separately.
7. Local HAR, screenshots, accessibility trees and model traces may contain personal or session information; keep raw `output/` and `reports/` private/backed up. Redact approved screenshots for thesis. Upload only sanitized CSVs to Colab.
8. Store source configs/code, freeze manifest, screening decisions, and selected review examples in the thesis appendix. Retain large raw experiment data in a private digital archive instead of printing 256 screenshots.

## Suggested Bab IV and lampiran outline

**Bab IV:** environment and model configuration; three PoC GO/MODIFY findings; pilot competence and floor effect; outcome-blind main screening/freeze; official paired task success; secondary audited evidence quality; efficiency and treatment-divergence diagnostic; failure cases and threats to validity.

**Appendices:** public task IDs/intents, screening rubric and anonymized reviews, freeze hashes and model provenance, evaluator conventions, example screenshots for _pre-specified_ failure/success categories, reset logs, analysis scripts/Colab, and source links. Do not embed private HAR or exposed credentials in the manuscript.

**Status:** Only synthetic browser CI exercises the current development runner. Real PoC/pilot/main scores, persistent reset, model competence and human audit have not yet been completed on the laptop.
