# Acceptance gates — live smoke verified 2026-10-18

1. **PASS (local Windows, user-supplied console evidence, 2026-10-18):** live OpenApps + BrowserGym smoke executed a single Python `pass` action, returned a nonempty AXTree and official reward `0.0`, and printed `PASS: official BrowserGym observation, action, and reward`. The official evaluator also printed `Differences found` as expected for an intentionally unsolved task. This verifies the one-action harness path, **not** task solvability, evaluator accuracy, state reset or model/CDEA performance.
2. **PENDING:** Independent positive and negative controls for the official evaluator (private oracle never shown to agent).
3. **PENDING:** Per-episode isolated database and initial state hash parity (manual restart alone does not prove parity).
4. **PENDING:** Shared Ollama adapter across all four models, with identical action/observation budgets and model digests.
5. **PENDING:** Baseline uses general model progress; CDEA prioritizes unresolved constraint evidence. Freeze treatment before pilot.
6. **PENDING:** Independent held-out pilot and suitability screening/freeze of 32 tasks.
7. **PENDING:** Confirmatory runs across all methods/models; official task success, steps, latency, evidence correctness, invalid-run status.

Archive: archive/custom-openapps-runner-20261018. Current main is a prototype, not a result.

## Next engineering milestone

Run the local Ollama model API preflight added in scripts/browsergym/ollama_preflight.py; this is a prerequisite, NOT a BrowserGym integration. Next integrate the Ollama adapter into official BrowserGym using a **shared** observation/action interface for Baseline and CDEA. Begin with one deterministic task and a single development model. Do not count the no-op smoke reward or archived runner PoCs as outcomes. Before paired comparisons, prove fresh initial-state hashes and independent evaluator positive/negative controls. Verify all four model identifiers and digests before pilot/main runs.

## Qwen development runner

The first unpaired real-task runner is available at scripts/browsergym/qwen_dev.py. It uses the official BrowserGym HighLevelActionSet and OpenApps evaluator, and restricts model choices to a small allowlist with live AXTree element IDs. This is a **development-only artifact**; successful static CI does not validate live Qwen task completion. Automated fresh-state parity, model-digest checks across all four models, evaluator controls and CDEA method parity remain pending.
