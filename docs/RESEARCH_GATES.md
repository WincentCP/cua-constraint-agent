# Acceptance gates (none implied complete by static CI)

1. Live OpenApps + BrowserGym one-action smoke: accessibility observation, browser action, official reward.
2. Independent positive and negative controls for the official evaluator (private oracle never shown to agent).
3. Per-episode isolated database and initial state hash parity (manual restart alone does not prove parity).
4. Shared Ollama adapter across all four models, with identical action/observation budgets and model digests.
5. Baseline uses general model progress; CDEA prioritizes unresolved constraint evidence. Freeze treatment before pilot.
6. Independent held-out pilot and suitability screening/freeze of 32 tasks.
7. Confirmatory runs across all methods/models; official task success, steps, latency, evidence correctness, invalid-run status.

Archive: archive/custom-openapps-runner-20261018. Current main is a prototype, not a result.
