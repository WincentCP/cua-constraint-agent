# Research protocol — Shopping-only feasibility before main experiment

## Purpose and fixed scope

The research tests whether **constraint-directed evidence acquisition** improves the reliability/efficiency of text Accessibility-Tree CUAs **under matched observation/action/budget conditions**.

WebArena-Verified v1.2.3 supplies a public task pool, the locally resettable **Shopping** website, and an official deterministic evaluator. LEUCO, Shopping Admin, GitLab, Reddit, Map and cross-site tasks are excluded from the current experimental scope.

### Methods and fairness

Both **Baseline** and **Proposed** must receive the same public task instructions, start state, browser, Accessibility Tree, evidence ledger, candidate probes, action executor, resource budgets, and evaluator. Only ranking of eligible information-acquisition probes differs:

- Baseline: generic model-estimated task progress.
- Proposed: coverage of unresolved public requirements, then lower estimated forward cost, then stable discovery order.

The `may_answer` annotation indicates only **possible relevance** based on public task text/current visible UI. It is never evidence of satisfaction, never an oracle action→answer map, and never derived from hidden reference answers. Every action and terminal outcome must be logged.

The scientific hypothesis is about **method**, not which model is best. Four local Q4_K_M model candidates test robustness and are not selected because Proposed happens to win.

## Stage 1 — task 284 PoC (Shopping)

**Inspection (zero agent runs)** is structurally eligible only when all hold:

1. pinned official CLI exports public task 284 and it matches the pre-reviewed instruction;
2. Shopping starts, responds and can be reset locally;
3. Playwright captures meaningful Accessibility Tree and controls;
4. public instruction decomposes into three auditable constraints;
5. **at least two meaningful evidence-acquisition choices** are observed in a reachable state (not merely two arbitrary links);
6. `inspection.har` and inspection report are saved without treating inspection as an agent run;
7. no hidden expected answer or evaluator target is visible to the agent.

The automatically generated `reports/poc/poc-review.md` is a **manual review template**, not automatic PASS. Then, separately, a **PoC end-to-end agent run** must be built to navigate, produce `agent_response.json` and `network.har`, run the official evaluator, and record a technically valid outcome. Official task failure is distinguishable from evaluator failure.

If any essential precondition fails, **MODIFY or REJECT** WebArena before expanding scope.

## Stage 2 — six Shopping-only pilot candidates

Registered public task IDs (from v1.2.3), chosen by task text alone for diverse requirements and intent templates:

| ID  | Intended evidence-acquisition challenge                           | Site     |
| --- | ----------------------------------------------------------------- | -------- |
| 279 | Sony Bluetooth models, full names and min/max prices              | shopping |
| 284 | shoe-storage capacity and minimum feasible price (PoC reuse)      | shopping |
| 323 | March 2022 canceled orders, retained item, shipping and refund    | shopping |
| 436 | identify and reorder a canceled historical mattress order         | shopping |
| 506 | highest-rated feasible product, budget and cart cleanup           | shopping |
| 528 | recover prior order details, draft refund form without submitting | shopping |

These are **pilot candidates, not presumed eligible**. Each must pass an independent, recorded, live-site suitability screen: official evaluator exists; ≥3 public requirements; evidence available through UI; ≥2 meaningful inspection choices; not trivial single click/copy; no hidden answer leakage; deterministic reset/replay; and matched observation/actions/budgets. Record eligibility in `reports/pilot/task-screening.csv`, before interpreting method results. Never remove a task because Proposed lost.

The pilot includes **6 tasks × 4 model candidates × 2 methods = 48 agent episodes**, assuming suitability and runner readiness. Reusing task 284 from PoC is allowed for development; **no pilot task enters main**.

### Proposed operational pilot gate (requires supervisor approval before pilot)

- All 48 expected combinations are accounted for and at least **46/48 (95%)** produce valid technical outputs with a successful official evaluator invocation (task score zero can still be technically valid).
- At least **10/48** official task successes, spanning **≥2 distinct tasks and ≥2 distinct models**.
- Check per-model and per-task floor effects; a model with zero successes remains a competence concern, even if aggregate threshold passes.
- Validated task suitability, fair method boundaries, reproducible reset, and 32 independent main-eligible tasks are reviewed **separately**, not inferred from aggregate successes.

These are **pragmatic feasibility thresholds, not WebArena standards or evidence that Proposed is superior**. Their small sample cannot prove success rate/power; revise only by documented supervisor decision **before** looking at pilot method outcomes. `npm run pilot:gate` produces a `PROVISIONAL_PASS` or `FAIL`; provisional pass is **not** authorization for main.

Pilot runs are evaluated under `output/pilot/runs/<model>/<baseline|proposed>/<task-id>/` using the official `agent_response.json`, `network.har`, and `eval_result.json`. The future autonomous runner must generate them and reset the environment between conditions. Manual inspection artifacts do not count as runs.

## Stage 3 — supervisor-required main experiment

- **Exactly 32 distinct Shopping task IDs**, held out from PoC/pilot, selected using predeclared suitability criteria independently of method outcomes.
- Prefer non-overlapping intent templates where feasible to reduce development–test leakage; document any overlap.
- Freeze the 32 task IDs, public annotations, four exact local model digests/quantizations, prompt and budgets, randomized or balanced run order, browser/Docker/benchmark versions, reset protocol and evaluator checksums.
- **32 × 4 × 2 = 256 episodes**. Each task/model pair is evaluated with both methods under the same conditions.
- Primary measure: official verified task success. Secondary: evidence completeness before consequential actions, probes/actions, model calls, time, invalid outputs and budget exhaustion.
- Analysis: paired exact McNemar by model with multiplicity control; interaction/aggregate inference should account for repeated task IDs. No claim that 256 episodes are 256 independent tasks.
- Record both successes and failures, including timeouts/error types, without censoring losing runs.

`artifacts:init --stage main` **only creates directory structure**, checks exact count and official Shopping catalog identity, and is not a runnable main experiment. The autonomous runner, freeze command and statistical exports remain future work after PoC/pilot.

## Decision checkpoints

1. PoC inspection + end-to-end feasibility: **GO / MODIFY / REJECT**.
2. Six-task pilot: **PROVISIONAL_PASS / FAIL** with qualitative task/model review.
3. Supervisor approves 32-task held-out set and study freeze **before** collecting main data.

The official benchmark evaluator alone defines official task success; never convert self-reported success or diagnostic hint coverage into official success.
