# Acceptance gates — live smoke verified 2026-10-18

1. **PASS (local Windows, user-supplied console evidence, 2026-10-18):** live OpenApps + BrowserGym smoke executed a single Python `pass` action, returned a nonempty AXTree and official reward `0.0`, and printed `PASS: official BrowserGym observation, action, and reward`. The official evaluator also printed `Differences found` as expected for an intentionally unsolved task. This verifies the one-action harness path, **not** task solvability, evaluator accuracy, state reset or model/CDEA performance.
2. **USER-SUPPLIED GATED LIVE EVIDENCE:** The user completed the one-command run_validation pipeline through a Qwen success with official reward 1.0; the pipeline only runs Qwen after negative/positive official evaluator controls pass. Independent control artifacts should still be retained for thesis audit.
3. **PARTIALLY VALIDATED:** Isolated OpenApps per-episode launcher and initial hash parity are implemented and were a prerequisite of the successful gated Qwen run. Cross-arm Baseline/CDEA parity remains to be verified live on Windows.
4. **IMPLEMENTED, LIVE CHECK PENDING:** Shared matched runner resolves all four exact model labels and installed digests and enforces common action/observation budgets. Only Qwen has demonstrated live end-to-end task success.
5. **IMPLEMENTED, LIVE MECHANISM CHECK PENDING:** Baseline ranks candidate information probes by generic model progress; CDEA by unknown-constraint coverage then forward cost, on the same model-supplied probe menu. Probe annotations are unverified heuristics, not verified evidence. The Todo PoC does not establish treatment divergence. Freeze only after an eligible information-acquisition dev test.
6. **PENDING:** Independent held-out pilot and suitability screening/freeze of 32 tasks.
7. **PENDING:** Confirmatory runs across all methods/models; official task success, steps, latency, evidence correctness, invalid-run status.

Archive: archive/custom-openapps-runner-20261018. Current main is a prototype, not a result.

## Next engineering milestone

Run the local Ollama model API preflight added in scripts/browsergym/ollama_preflight.py; this is a prerequisite, NOT a BrowserGym integration. Next integrate the Ollama adapter into official BrowserGym using a **shared** observation/action interface for Baseline and CDEA. Begin with one deterministic task and a single development model. Do not count the no-op smoke reward or archived runner PoCs as outcomes. Before paired comparisons, prove fresh initial-state hashes and independent evaluator positive/negative controls. Verify all four model identifiers and digests before pilot/main runs.

## Qwen development runner

The first unpaired real-task runner is available at scripts/browsergym/qwen_dev.py. It uses the official BrowserGym HighLevelActionSet and OpenApps evaluator, and restricts model choices to a small allowlist with live AXTree element IDs. This is a **development-only artifact**; successful static CI does not validate live Qwen task completion. Automated fresh-state parity, model-digest checks across all four models, evaluator controls and CDEA method parity remain pending.

## Current engineering checkpoint (2026-10-19)

The user's Qwen3.5 BrowserGym development trace showed official reward 1.0
in four actual actions (Todo Call Mom) with a logged state delta and an
isolated server. The separate matched runner (scripts/browsergym/matched_dev.py)
now supports shared policy comparison across config/models.json labels.
See docs/MATCHED_DEVELOPMENT.md for the single Windows command. Its CI
contracts do NOT verify live pair outcomes. Pilot and main selection gates
remain pending, and the task-family count is conditional on screening.
