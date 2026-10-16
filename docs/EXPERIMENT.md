# Registered design — WebArena-Verified Shopping (v1.2.3)

**Research question:** Under matched browser observations, candidate actions, model and budgets, does constraint-directed evidence acquisition improve the **official WebArena-Verified task success** of small local computer-use agents versus a Baseline ranking policy? Efficiency and evidence quality are secondary, not interchangeable with the official success score.

## Stages and strict holdout

- **PoC: 3 development tasks (279, 284, 528).** Respectively: product-name + min/max retrieval; minimum shoe-storage capacity and lowest feasible price; refund form drafting without submission. They are for debugging the full browser→LLM→action→HAR→official evaluator pipeline, not independent evaluation data.
- **Pilot: 6 held-out tasks (96, 323, 436, 506, 571, 689).** Order status/arrival retrieval; cancelled-order refund; historical reordering; category/budget/rating/cart/purchase; account-address update; coupon-contact-form drafting. Six distinct public intent templates; **48 preplanned task × model × method episodes**.
- **Main: exactly 32 candidate tasks** from `config/main-candidates.json`, 8 per stratum (product navigation, product comparison, order retrieval, reviews/forms/mutations), totaling **256 planned episodes** (32 × 4 × 2). The 32 are **public-instruction candidates, not 32 approved tasks**. They share neither task ID nor public intent template with PoC/pilot. Main eligibility requires live, outcome-blind screening; if any candidate fails, get a pre-data supervisor decision rather than quietly dropping it or claiming 32 valid tasks.

All stages use **Shopping only**; no Shopping Admin, GitLab, Reddit, Map, LEUCO, or benchmark hidden evaluator expectations.

## Preregistered suitability criteria (apply before results)

`npm run screening:init -- --stage poc|pilot|main` produces a **PENDING review JSON** and public candidate CSV. The reviewer records, separately for each task:

1. **Official task/evaluator identity:** `task_id`, template ID and exact public intent match the pinned CLI catalog, and evaluator is available.
2. **At least three substantive public task requirements:** write the requirements in `public_constraints`; formatting/output JSON keys **alone** do not constitute evidence-acquisition constraints.
3. **At least two meaningful, distinct possible information-acquisition choices** in reachable visible UI: write them in `evidence_choices`. Merely counting links or matching keyword hints does not qualify.
4. **Visible evidence and supported controls** through the Accessibility Tree/Playwright; correctly handles authentication, form/checkout mutation and safe non-submit cases.
5. **Reproducible persistent Shopping reset** to equivalent start states across Baseline/Proposed; isolated browser contexts and `env stop/start` alone do **not** prove reset.
6. **Same observation/action/prompt/budget** boundary for both methods, and **no hidden reference answer leakage**.
7. Reviewer identity, reasoning, and **existing non-empty local evidence files**; checks are human attestations, not mechanically proven correctness.

Set `decision: PASS` only for a truly eligible task, set every checklist item only after observing it, and preserve genuine screenshots/log evidence. `npm run screening:require -- --stage main` refuses any incomplete review. All three reviews plus provisional pilot gate and signoff are mandatory before main freeze. Never select/exclude tasks because Proposed wins or Baseline loses.

If one of 32 main candidates is trivial or unsupported, **the 32-candidate pool is not yet sufficient**, and protocol revision requires supervisor agreement **before observing main outcomes**. Do not invent eligibility or loosen rubric after method scores.

## Experimental treatment and fairness

Shared, fixed across conditions:

- official public task/initial state; identical task-model pair with **fresh persistent reset between runs**;
- one of four local Q4_K_M model candidates; same quantization/digest within paired runs;
- system prompt, previous model-observed constraint states, accessibility snapshot, eligible probe list, action executor, browser version and constrained site origins;
- decision budget **16 actions**, temperature **0**, up to three checkpoint screenshots (screenshots are measurements, not a treatment variable);
- same publicly derived `may_answer` relevance hints and evidence-store implementation, available on both sides;
- official CLI v1.2.3 and evaluator, independent of agent.

**Only probe ranking differs.**

- **Baseline:** model-estimated generic forward progress and stable order.
- **Proposed:** number of unresolved public constraints a candidate might help answer, then lower estimated forward cost and stable order.

`may_answer` is a **relevance hint**, not a verified fact. Model quotes are accepted as **observational trace annotations** only if they appear in the visible Accessibility Tree; this is not independent factual verification and not evaluator ground truth. Blind or independently documented human audit is required to report **evidence correctness/constraint coverage** as a scientific outcome.

No MASM-specific treatment. If common lightweight execution memory becomes necessary for browser operation, add it **identically for both methods**, document changes and rerun development checks before freezing.

## PoC — GO / MODIFY / REJECT

All three tasks must be independently inspected with initial screenshot/Accessibility Tree, at least two *meaningful* choices, working Shopping session, persisted reset evidence and no oracle leakage. Inspecting a page is NOT executing an agent. Each PoC type must separately demonstrate agent model calls/actions + official agent response/HAR/evaluation as a feasibility check (failure can be diagnosed, but cannot be mistaken for benchmark success). If unsupported task types persist, STOP and revise runner/scope, rather than starting pilot blindly.

The development-only runner supports **one task/model/method at a time**. It is not yet an approved full-trial orchestrator. Use `artifacts:init --stage poc`, `webarena:prepare`, `webarena:inspect` for each of 279/284/528; do not count debugging trajectories as pilot/main statistics.

## Pilot — competence and technical floor-effect gate

**Six distinct task IDs × four local model candidates × two methods = 48 episodes**. Run eligibility checks and confirm fresh persistent reset before collecting scores. All run cells are counted even when they fail; repeat policy must be set before reviewing outcomes, and no cherry-picking the best attempt.

The currently preregistered **provisional operational thresholds** are: at least **46/48** technically valid official evaluations, at least **10/48** official successes across ≥2 distinct tasks and ≥2 models. These are **not published benchmark standards**, might be difficult for local 8–9B models, and **require supervisor approval BEFORE PILOT OUTCOMES**. Inspect method-blind technical failure, model/task floor effects, and task suitability. If pilot fails, report it honestly; do not launch main, or lower the success threshold after seeing data.

`pilot:gate` outputs `FAIL` with no data and `PROVISIONAL_PASS` only if technical checks meet thresholds. A provisional pass is **NOT** authorization to run main.

## Main — research freeze and proper inference

Only after three approved screening documents, a provisional pilot GO, independently collected hardware/model digest and reset evidence, and supervisor signoff:

1. Create `config/model-digests.local.json` privately using the **exact real Ollama digests** for the four models; never fabricate model hashes.
2. Complete `reports/task-screening/main-review.json` for **all 32 candidates** with evidence. Preserve the review and screenshots.
3. Execute `npm run main:freeze -- --experiment-id thesis-v1 --model-digests config/model-digests.local.json --reset-evidence reports/pilot/reset-proof.md --approved-by "<name>" --approval-ref "<document-ref>"`. The command **refuses** incomplete screening, missing digests/reset evidence, or failed pilot gate. Frozen manifest/protocol/code fingerprints are guarded against changes.
4. `artifacts:init --stage main --experiment-id thesis-v1` scaffolds frozen paths only. **Main runner is still intentionally unavailable** until a separate, validated reset-safe batch implementation is completed.

### Predeclared analysis

**Primary:** binary official success (`eval_result.json` status success, not the model's SUCCESS claim). Analyze matched outcomes **within each task/model pair**; exact McNemar by model with Holm adjustment for four planned comparisons. This is not a 256-independent-task sample.

**Secondary:** independently reviewed evidence correctness/required-constraint coverage; browser actions, candidate probes chosen, model calls, wall clock time, invalid output/error rate and budget exhaustion. Examine medians, distributions and missingness. Record **first-decision divergence** as a diagnostic that demonstrates whether the policies actually chose different probes, **not** evidence of correctness.

No automated inference of evidence *correctness* from an ARIA substring or relevance hint. A fair blinded audit of representative trajectories must have its selection rule registered before outcomes are inspected; report limitations if evidence cannot be audited reliably.

Run-order balancing/randomization and robust persistent reset must be specified and implemented **before** the main runner is enabled. Never delete failed episodes, re-run only Proposed, or treat unevaluated runs as failures.

## Reporting and provenance

- `output/` and `reports/` remain private (gitignored). Back them up.
- Each one-task run records UUID, task/model/method, start/finish, budget, ARIA trees, selected probes, bounded screenshots, `trace.jsonl`, agent `network.har`, and (only after real official evaluation) `eval_result.json`.
- `results:export -- --stage pilot` outputs 48-cell inventory and only valid evaluated cells for Colab, plus pairwise first-decision diagnostics. Analogous main export is **blocked until freeze**.
- `notebooks/thesis_analysis.ipynb` creates descriptive figures but blocks confirmatory main tests when the 256-cell matrix is incomplete. Never share HAR/session cookies in Google Colab.
- Exact code/CI validity and local WebArena success are **separate claims**; no benchmark scores are available yet.

See [docs/RESET_PROTOCOL.md](RESET_PROTOCOL.md), [docs/EVIDENCE_PROTOCOL.md](EVIDENCE_PROTOCOL.md), and [docs/STATUS.md](STATUS.md).
