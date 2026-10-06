# WebArena-Verified feasibility and experiment protocol

## Purpose

The immediate question is not whether Proposed beats Baseline. The immediate question is whether an established interactive benchmark contains tasks for which the thesis treatment — constraint-directed evidence acquisition — can be defined objectively without leaking evaluator ground truth.

## Stage 2: one-task proof of concept

Primary task: **284**.

Pass criteria:

1. official task input can be exported reproducibly;
2. the official site can be started/reset locally;
3. Playwright obtains a usable Accessibility Tree;
4. task requirements can be decomposed into public, auditable constraints;
5. at least two meaningful information-acquisition choices can occur before terminal completion;
6. HAR output is produced in the official evaluator format;
7. no private reference answer/evaluator expectation is exposed to the agent.

## Stage 3: six-task suitability pilot

Pre-registered task IDs: **284, 323, 493, 523, 552, 562**.

A task is eligible for the final candidate pool only if all are true:

- objective official evaluator exists;
- at least three required facts/rules can be stated before execution;
- evidence can be acquired from public UI observations;
- there are at least two plausible inspection/navigation choices at one or more states;
- task is not reducible to a single direct click or direct form copy;
- constraint annotations can be defined without consulting the hidden expected answer at runtime;
- task can be reset/replayed locally;
- Baseline and Proposed can share the same observation, action, budget, and eligible-probe construction.

Task removal must be justified by these criteria before main results exist. "Proposed does not win" is never a removal criterion.

## Treatment boundary

Both conditions share task intent, start state, browser, Accessibility Tree, public evidence store, eligible probes, `may_answer` annotations, action executor, resource budget, and evaluators.

Only probe ranking differs:

- **Baseline**: generic model-estimated progress score.
- **Proposed**: unresolved constraint coverage, then lower forward cost, then stable order.

`may_answer` is metadata about possible relevance, never proof that a constraint is satisfied.

## Stage 4: design finalization

Only after the six-task pilot:

1. define the final task-selection rule;
2. select the held-out main subset before viewing main results;
3. lock exactly four model IDs/configurations;
4. lock prompts, parsing rules, budgets, browser version, WebArena-Verified version, task list, constraint specs, and run order;
5. hash the complete research identity;
6. run competence/repeatability checks on development tasks;
7. create the research freeze;
8. begin main experiment.

A likely final factorial design is `task × 4 models × 2 methods`, but task count is intentionally **not frozen yet**.

## Evaluation layers

**Official benchmark layer:** WebArena-Verified owns task success through `agent_response.json` + `network.har`.

**Research layer:** the thesis may additionally measure evidence completeness before consequential action, probe/action count, budget exhaustion, invalid model output, correct abstention/refusal, and method effect across the four models.

The research layer must never redefine an official failure as official success.
