# Experiment protocol

The methodology is fixed by [PRD-FINAL](PRD-FINAL.md). These operational rules are declared before data collection.

## Conditions and dataset

Main contains 32 base tasks and 64 planned runs. There are 12 separate development tasks. Task IDs, U-levels, split, expected outcomes, private attributes and seeds are not passed to the planner; it receives the canonical goal and recorded public UI state.

Both policies call the same structured-output planner at each multi-probe decision. It scores every eligible probe for generic task progress. Baseline follows those scores. Proposed ranks UNKNOWN coverage, then required forward browser action cost (including restoration), then stable discovery order. Eligibility filtering is shared. A single eligible probe bypasses the model identically. Public control labels supply shared probe annotations; annotations never count as evidence.

ACT/abstention rules, evidence updates, recovery and verification are shared. A public missing-fact notice can support insufficient evidence; exhausting a numeric budget cannot.

## Development and gate

1. Run build, unit tests, integration tests and dataset validation.
2. Run `development` with the fixed real model on all 12 development tasks.
3. Run `repeatability`: first six development tasks, three repetitions, both policies (36 runs). These cover U2/U3/U4 and both solvable subtypes.
4. Run `gate --input DIR` on that repeatability directory.

The gate requires real-model records bound to the current source/config/dataset/model/runtime, all 18 healthy complete pairs, Baseline correct on at least three distinct tasks requiring two or more probes, identical outcomes and selected-probe trajectories across three repetitions per task/policy, and no budget exhaustion or structured-output repair in selected gate runs.

These conservative engineering criteria are declared before main and do not require Proposed to outperform Baseline. Any development fix invalidates the old gate. Budget must support the public route bounds printed by validation and must not be tuned to maximize the policy gap.

## Freeze and main

Commit the tested source/config/tests and create the freeze **outside `config/`**, for example `exports/freeze-v1.json`. Freeze locks source hashes, code commit, dataset, model/provider/version/digest, model options, budget, browser/runtime, dependencies and exact run-order manifest, with gate criteria and evidence hash.

```powershell
npm run experiment -- freeze --gate exports/repeatability-v1 --out exports/freeze-v1.json
npm run experiment -- main --freeze exports/freeze-v1.json --out exports/main-v1
```

Base order and within-pair policy order are seeded before collection. Every attempt uses a new server, cookie, browser process/context and empty cart. The agent cannot access private fixture state or the evaluator. Model chat history does not cross runs.

Do not modify frozen components after inspecting main outcomes. Null/negative differences are valid results. Demo cannot satisfy the real-model gate.

## Interrupted runs and infrastructure reruns

```powershell
npm run experiment -- resume --input exports/main-v1 --freeze exports/freeze-v1.json
npm run experiment -- rerun --input exports/main-v1 --freeze exports/freeze-v1.json --pair main-01:r1 --reason "Ollama server stopped"
```

An original batch stops at its first infrastructure failure to avoid repeatedly dispatching against a broken browser/model. `resume` verifies configuration integrity, reconciles interrupted journal entries and runs only unattempted original cells. It does not silently retry failures. `rerun` requires a recorded infrastructure failure and dispatches both policies with a new attempt index. Original observations and results remain intact. If a rerun is interrupted, reconcile with `resume`, then issue another documented paired rerun.

Primary analysis selects the earliest complete infrastructure-free pair. It never selects the best result or mixes policies across attempts. Healthy budget exhaustion, wrong/underverified actions, false abstentions and execution/verification failures do not justify reruns. Missing pairs and every infrastructure attempt remain visible.

## Outcome precedence

Infrastructure failures are separate. A healthy run that reaches its deadline/budget before a verified terminal decision is `BUDGET_EXHAUSTED`, including a deadline reached after dispatch. Otherwise, for ACT: a wrong nonempty final effect is `WRONG_ACT`; missing pre-ACT evidence is `UNDERVERIFIED_ACT`; an evidenced intent with missing/unverified effect is `EXECUTION_OR_VERIFICATION_FAILURE`; a correct evidenced and verified effect is `VERIFIED_ACT_SUCCESS`. Orthogonal flags retain evidence completeness and final correctness when failures overlap.

For no-action terminals, budget exhaustion is failure. No-solution requires public refutation for every candidate and an empty private feasible set. Insufficient evidence requires recorded unavailable decisive facts for still-unrefuted candidates and no fully observable feasible solution. Agent assertions alone are not evaluator evidence.

## Export and interpretation

```powershell
npm run experiment -- export --input exports/main-v1
```

- `metrics.csv`: VDA by policy and overall/type/subtype/U-level with paired assessable denominators.
- `paired-probes.csv`: jointly correct pairs, Proposed minus Baseline probes. Medians, range and IQR are in `metrics.json`.
- `episodes.csv`: all attempts and diagnostics.
- `metrics.json`: selected pair IDs, missing cells, infrastructure/outcome counts and mechanism summaries.
- `events.jsonl`: durable observations, model input/output, evidence, selection, pre-ACT snapshots and frozen outcomes.
- `episodes.jsonl`: independent evaluations and final private worlds for offline audit.
- `report.html` and `report.md`: readable tables and a mechanically selected case gallery. Reports distinguish demo, development and main; they display missing pairs and infrastructure failures.
- `screenshots/<attempt-id>/obs-N.png`: actual screenshots of the public browser page at recorded observations, linked to observation IDs in `SCREENSHOT` events.

Screenshot recording is configured by `reporting.screenshots` in the single experiment configuration and is frozen with it. It is identical for both policies, never enters planner input, and does not replace Accessibility Tree evidence. Recording time is included in wall time/deadline; screenshot capture adds no exploratory probe. Capture errors are logged as `SCREENSHOT_FAILURE` and reported as missing documentation, without fabricating an image or changing the semantic evidence. Agent and evaluator do not consume PNG files.

Reports choose the first recorded attempt per policy and task type (including failures), and show initial, latest pre-ACT, and terminal screenshots where available. This selection rule is fixed and is not based on success. Keep demo captions when using those images to illustrate implementation in Bab 4. Quantitative findings must come from a valid frozen main run.

Run `npm run experiment -- report --input DIR` to regenerate HTML/Markdown after an interrupted process. The HTML is printable from a browser; keep the report beside its `screenshots` directory. The generator creates tables and captions, not unsupported scientific conclusions.

Verified ACT and correct abstentions score one; other healthy outcomes score zero. Probe comparison includes only jointly correct pairs. Negative delta favors Proposed. Report exclusions and original infrastructure failures. Single episodes are diagnostics, not paired comparisons.

Claims apply to this controlled task set and model. They do not establish live-website generalization, usability for blind users, or superiority of Accessibility Trees over other representations.
