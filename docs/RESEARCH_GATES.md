# Acceptance gates — live smoke verified 2026-10-18

1. **PASS (local Windows, user-supplied console evidence, 2026-10-18):** live OpenApps + BrowserGym smoke executed a single Python `pass` action, returned a nonempty AXTree and official reward `0.0`, and printed `PASS: official BrowserGym observation, action, and reward`. The official evaluator also printed `Differences found` as expected for an intentionally unsolved task. This verifies the one-action harness path, **not** task solvability, evaluator accuracy, state reset or model/CDEA performance.
2. **USER-SUPPLIED GATED LIVE EVIDENCE:** The user completed the one-command run_validation pipeline through a Qwen success with official reward 1.0; the pipeline only runs Qwen after negative/positive official evaluator controls pass. Independent control artifacts should still be retained for thesis audit.
3. **PASS FOR QWEN DEVELOPMENT PAIR (2026-10-19, user-supplied console output):** Fresh isolated Baseline and Proposed Todo episodes completed with identical initial app state; pair artifact: `output/browsergym/matched_dev/9e6c49d077dc4475a5ddbb5f95b2fc9d/pair.json`. This does not validate all task families.
4. **IMPLEMENTED, LIVE CHECK PENDING:** Shared matched runner resolves all four exact model labels and installed digests and enforces common action/observation budgets. Only Qwen has demonstrated live end-to-end task success.
5. **IMPLEMENTED, LIVE MECHANISM CHECK PENDING:** Baseline ranks candidate information probes by generic model progress; CDEA by unknown-constraint coverage then forward cost, on the same model-supplied probe menu. Probe annotations are unverified heuristics. In the successful Qwen Todo pair, comparable probe decisions=0 and policy divergences=0, so the method effect remains untested. Freeze only after an eligible information-acquisition dev test.
6. **PENDING:** Independent held-out pilot and suitability screening/freeze of 32 tasks.
7. **PENDING:** Confirmatory runs across all methods/models; official task success, steps, latency, evidence correctness, invalid-run status.

Archive: archive/custom-openapps-runner-20261018. Current main is a prototype, not a result.

## Next engineering milestone

NEXT: test a real OpenBanking read-then-act task using the standalone official Hydra `tasks=openbanking` group, verify two meaningful public information probes are reachable, and audit action/evidence correctness. The successful Qwen Todo paired run is a technical validation only. Only after a valid mechanism check should the common protocol be frozen for independent pilot screening and installation/verification of all four models.

## Qwen development runner

The unpaired Qwen runner at `scripts/browsergym/qwen_dev.py` has user-reported official reward 1.0 on Todo. The paired runner now supports Qwen Baseline and Proposed with initial-hash parity, and can select standalone OpenBanking tasks via `--task-group openbanking`. These remain development-only artifacts; evidence acquisition policy effect, four-model parity, independent pilot/main task families, and confirmatory results are pending.

## Current engineering checkpoint (2026-10-19)

The user's Qwen3.5 BrowserGym development trace showed official reward 1.0
in four actual actions (Todo Call Mom) with a logged state delta and an
isolated server. The separate matched runner (scripts/browsergym/matched_dev.py)
now supports shared policy comparison across config/models.json labels.
See docs/MATCHED_DEVELOPMENT.md for the single Windows command. Its CI
contracts do NOT verify live pair outcomes. On 2026-10-19 the user supplied
live matched Todo output with Baseline success=True, Proposed success=True,
initial-hash parity PASS, Baseline 3 browser steps / 3 model calls and ZERO
comparable probe decisions (ZERO treatment divergences). Next validate the
standalone OpenBanking group; the 32 qualifying main task families remain
conditional on independent screening.

## Observed OpenBanking mechanism test (2026-10-19)

The user ran matched Qwen Baseline/Proposed with the official standalone
OpenBanking task `add_todo_to_review_largest_card_charge`. Both returned
`official_success=False`, with 0 comparable information probes and 0
observed treatment divergence. Trace showed three actual clicks on
OpenBanking-labelled links (BIDs 64, 96, 96) followed by the common
repeated-click guard. The upstream desktop chrome exposes persistent app
links on app pages while its account rows are nonsemantic HTMX divs. A
shared public BrowserGym AXTree/extra-properties adapter now offers a
bounded same-app-link repair and publicly labelled clickable generic rows.
Its live effectiveness remains UNVERIFIED; do not treat this task as a
valid mechanism comparison until real acquisition alternatives occur.
