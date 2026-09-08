# Research Context for CUA Constraint Agent

## How to use this file

Use this file as the short, canonical handoff context for an AI assistant or researcher.
It summarizes the research design, the implementation boundary, and the current evidence.
Do not treat a requirement as implemented merely because it is written here.

When more detail is needed, read the source documents in this order:

1. `docs/PRD-REVISION.md` for the frozen research framing and method decisions.
2. `docs/STATUS.md` for what has actually been implemented and verified.
3. `docs/SETUP.md` for local setup and operational commands.
4. `docs/AUDIT.md` for risks, bottlenecks, and remaining research gates.

Always distinguish **requirement**, **implementation**, and **verified evidence**.
Do not claim participant readiness, real-model success, voice readiness, NVDA readiness,
or main-benchmark results unless the relevant gate is explicitly recorded as passed.

## Project in one paragraph

This project is a small, controlled computer-use-agent experiment. It tests whether
explicit constraint state can guide evidence acquisition before a browser action. The
proposed policy P is compared with a capability-matched generic LLM exploration baseline
B1. Both conditions use the same model, prompt, browser, tools, observer, verifier,
recovery, approval UI, and interaction budget. The only treatment difference is the
probe-selection policy. The system is not a general web agent or a production shopping
assistant.

## Research question and contribution

### Main RQ

With the same model, public observations, tools, verifier, and interaction budget, does
constraint-directed evidence acquisition improve verified task success and evidence
efficiency on solvable tasks while preserving appropriate abstention when no solution or
sufficient evidence exists, compared with generic LLM progress-based exploration?

### RQ1 Effectiveness

Does the proposed policy improve verified objective success on solvable tasks?

### RQ2 Evidence efficiency and abstention

Does it obtain decisive evidence with fewer or more informative probes, reach evidence
closure sooner, and correctly distinguish ACT from ABSTAIN?

### RQ3 Exploratory accessibility

Can blind or screen-reader users understand the proposal, result, uncertainty, and
correction flow through voice, keyboard, and screen reader? RQ3 is exploratory and must
not be generalized from a small sample.

The contribution is an empirical evaluation of a constraint-directed evidence-acquisition
policy. P/B1 is the evaluation design, not the novelty itself. Do not claim a first
accessibility-tree CUA, first verifier, first shopping agent, first blind-user CUA, or
universal superiority without a separate literature review.

## Mechanism

The user goal is decomposed into constraints. Each constraint has one of three evidence
statuses:

- `SATISFIED`: public evidence supports the constraint;
- `FAILED`: public evidence refutes the constraint;
- `UNKNOWN`: evidence is missing or insufficient.

The agent selects a probe, meaning one browser inspection or exploration action, to close
an evidence gap. `UNKNOWN` is not `SATISFIED`. The agent may ACT only when all required
constraints have sufficient public evidence. If there is no feasible candidate or a
decisive fact is genuinely unavailable, the agent should ABSTAIN rather than guess.

## Fair P/B1 treatment

Both conditions receive the same:

- goal and public observation;
- evidence matrix and eligible probes;
- model, prompt, parser, and inference configuration;
- browser, routes, tools, observer, extractor, executor, verifier, and recovery;
- approval UI and runtime/action/probe ceilings.

P ranks probes by:

1. more `SATISFIED` constraints;
2. greater predicted coverage of answerable `UNKNOWN` constraints;
3. lower forward cost;
4. stable deterministic tie-break.

B1 ranks probes with the LLM's generic `generic_progress_score`. B1 may consider the
whole goal, all constraints, evidence, feasibility, route, cost, and remaining budget.
Do not weaken B1 or label the condition to the model. If only one probe is eligible, both
conditions choose it deterministically and it is not a router comparison.

## Controlled benchmark

The benchmark uses one conceptual domain: a synthetic web shop with three plausible
candidate T-shirts per task. A typical public instruction is:

> Cari salah satu kaos merah ukuran M, maksimal 140000 rupiah, berbahan katun, yang tersedia. Masukkan satu ke keranjang.

There are 16 base task templates. Each has two evidence presentations:

- `EARLY`: important variant evidence is visible earlier;
- `STAGED`: decisive evidence appears after additional inspection.

Each presentation runs under both P and B1:

`16 base tasks × 2 presentations × 2 policies = 64 episodes.`

Per policy, the 32 episodes contain:

- 24 solvable tasks: 12 EARLY and 12 STAGED;
- 4 no-solution tasks;
- 4 unavailable-evidence tasks.

Solvable tasks require a verified cart action. No-solution tasks require evidence that
relevant candidates fail. Unavailable-evidence tasks contain a decisive public fact that
the supported route does not reveal; the correct behavior is uncertainty/abstention.

Each controlled task also has evaluator-only decisive constraints and a manually defined
minimum evidence path. The agent must never receive this path. Metrics include probes to
evidence closure, informative probe rate, evidence acquired per probe, and excess probe
cost (`actual probes - reference minimum probes`) when the denominator is meaningful.

## End-to-end episode flow

1. Freeze the dataset/configuration/model/prompt/budget for the run.
2. Create and persist `session_id`, `run_id`, and `attempt_id` before browser startup.
3. Record `TASK_START`. A startup crash remains an attempted `infrastructure_failed` run.
4. Read the system task once. The participant says `mulai` or gives a short correction;
   the participant does not repeat the whole task.
5. Observe the public Accessibility Tree and update the evidence matrix.
6. Discover eligible probes and select the next probe using P or B1.
7. Dispatch browser actions. Log observations, actions, retries, recovery, clarification,
   approval, rejection, correction, and user intervention with timestamps and correlation IDs.
8. Propose an ACT only after evidence closure. A rejection or correction cancels stale
   plan/approval. A real retry/recovery dispatch consumes budget; pre-dispatch binding
   failure does not consume a browser action. `ADD_CART` is not blindly repeated.
9. Verify the fresh browser state. Freeze the agent outcome before running the offline oracle.
10. Evaluate the final state against the independent reference goal and persist per-task
    evaluation plus session summary.

## Independent oracle and reporting

The oracle does not use the parsed agent goal as ground truth and does not influence
execution. It compares the frozen final state with the evaluator-owned reference goal.
It may check product identity, size, color, actual variant price, availability, quantity,
cart state, final URL, and DOM/Accessibility-Tree fingerprint. It stores parsed goal,
reference goal, goal match, `oracle_success`, reason, feasible state, and wrong-final-effect
separately. If a correction changes intended user goal and cannot be safely adjudicated,
the original-task assessment is preserved and the oracle result may be `null` with a manual
adjudication requirement.

Reports must separate planned, attempted, completed, infrastructure-failed, oracle-null,
unattempted, duplicate, original, and paired replacement attempts. Development, demo,
pilot, study, and main results must not be mixed. A replacement never overwrites an
original failure.

Budget accounting separates probes, browser actions, observations, LLM calls, tokens, and
wall time. Any real forward exploration dispatch, including recovery, is paid for.

## Participant interaction boundary

Participant UX is intentionally simple:

`consent/readiness → task read once → mulai or correction → short working feedback → one proposal → approve/reject/correct → execute and verify → short result/uncertainty → lanjut`

The participant does not choose probes or inspect the evidence matrix. Useful controls are
`ulang`, `tolak`, `lewati`, `stop`, and Escape. During TTS the microphone is closed, so
voice stop is unavailable; Escape remains available. Do not claim full hands-free operation
before real device testing.

Accessibility Tree, voice, keyboard, live region, approval, verifier, and oracle are
supporting infrastructure. They do not by themselves prove screen-reader usability.

If no blind participant is available, complete RQ1/RQ2 with the controlled benchmark,
perform keyboard/NVDA/voice engineering QA, document recruitment attempts, and report RQ3
as unvalidated. Sighted participants or blindfold simulation are not substitutes for the
target user population. A single blind user or accessibility expert is formative case
evidence, not a population-level claim.

## Automatic research recording

Structured trace recording starts automatically at Task 1 without adding a participant
button. Canonical events include `TASK_START`, `OBSERVATION`, `ACTION_ATTEMPT`,
`ACTION_SUCCESS`, `ACTION_FAILED`, `VERIFICATION`, `RECOVERY_ATTEMPT`, `CLARIFICATION`,
`USER_INTERVENTION`, `ORACLE_CHECK`, and `TASK_END`.

Automatic per-task evaluation stores task ID, start/end time, completion time, final task
status (`SUCCESS`, `FAILED`, or `ABORTED`), actions, failed actions, retries, recovery,
clarifications, interventions, help, failure type, final URL/state, and oracle-grounded
task success. Raw event data remains available for later analysis. Telemetry is best effort,
but durable action intent is fail-closed. The current design does not record screen video
or raw user/TTS audio; this is deliberate for scope, latency, and privacy.

## Current evidence and gates

### Implemented and verified in the development environment

- TypeScript/build, unit/lifecycle/dataset/SQLite/HTTP/automatic-evaluation tests pass.
- Playwright/Chromium integration covers EARLY/STAGED P/B1, no-solution,
  unavailable-evidence, budget exhaustion, rejection, false toast, fake cart, detached
  reference, retry accounting, and reference-goal oracle behavior.
- Automated axe/keyboard smoke passes.
- Demo smoke persists structured events, oracle checks, final URL/AX fingerprint, and session summary.
- Startup-failure testing proves the attempted ledger exists before browser startup.

These checks use `DemoModel` or test doubles unless explicitly stated. They are plumbing
evidence, not real-model or participant evidence.

### Not yet verified and must not be claimed as passed

- Node 24 one-command startup with real Ollama and the final model;
- real B1 competence on at least two STAGED solvable tasks;
- faster-whisper, Indonesian TTS, microphone/VAD, latency, cancellation, and restart;
- full keyboard-only and real NVDA/screen-reader behavior;
- pilot with a target blind participant;
- final freeze and all 64 original main attempts;
- participant-ready status.

## Useful commands

From the repository root:

```bash
npm ci
npx playwright install chromium
npm run build
npm test
npm run test:integration
npm run demo
npm start
npm run start:full
npm run benchmark -- --development
npm run freeze -- --pilot-approved
npm run benchmark
```

`npm run demo` is text-only and uses a simulated planner. It is useful for UI and
recording smoke tests, not for research claims. Full study mode requires the actual local
model, browser, voice stack, valid ethics/configuration fields, and the relevant manual
gates.

## Literature anchors

- ReAct — https://openreview.net/forum?id=WE_vluYUL-X
- WebArena — https://arxiv.org/abs/2307.13854
- WorkArena — https://arxiv.org/abs/2403.07718
- Savant — https://arxiv.org/abs/2407.19537
- AskEase — https://doi.org/10.1145/3772318.3790661
- Accessibility research review — https://arxiv.org/abs/2101.04271
- Disability simulation caution — https://doi.org/10.1177/1948550614559650

These papers support the design context and methodological boundaries. They do not prove
that P is superior or that this project is the first system of its kind.
