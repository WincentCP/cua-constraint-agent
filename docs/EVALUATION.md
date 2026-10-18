# OpenApps evaluation and evidence provenance

## Independent official scoring boundary
A trusted Python subprocess inside the installed OpenApps environment imports its own `open_apps.tasks.tasks` and reads `config/tasks/openbanking.yaml`; it evaluates `Task.check_if_task_is_complete(initial_state, current_state)` using OpenApps `get_current_state`. This uses the **official benchmark's state comparison logic**, although the Windows-specific bridge/integration is new and **must be verified against a live canonical BrowserGym episode** before results are called official-equivalent end-to-end.

The agent process receives only `{task_key, public_goal}` and generic public constraint descriptions; the score adapter sees seed/target state but never passes expected answers to the agent. The runner stores `initial_state.private.json` in the run artifact directory and an evaluation result only after navigation. **The state snapshot is private evaluation data, not an observation**.

If the runner throws, evaluate outcome for diagnostics but do not count the episode as a valid completed success. If the official bridge errors, mark `official_success=null`, not failure or success.

## Validity limitations to test
- `get_current_state` resolves equivalent state of the same app instance over localhost.
- Windows UTF-8 setup (`PYTHONUTF8=1`, `PYTHONIOENCODING=utf-8`, `USER`).
- App DB resets to identical seeds **after actual state-changing browser actions**, not merely session recreation.
- Reset comparison hashes cover every relevant seeded app state; record path and SHA.
- GUI actions via the available accessibility roles can complete the task; fields, multiselects, and cross-app navigation may be unsupported by initial runner.
- Relevance hints include no evaluator answer; lower model performance should not be disguised as environment invalidity.
- Version pin is a commit SHA, not a floating `main`.

## Artifact contract
A development episode writes to `output/openapps/poc/<UUID>/`: `metadata.json`, `initial_state.private.json`, `initial.png`, per-step `aria-NNN.yaml`, `trace.jsonl`, `network.har`, `final.png`, and when possible `official_result.json`. Files are gitignored; they are **not** sample results included in repository. Retain actual SHA-256 model and benchmark digests.

For appendix: task-screening signed evidence, start-state reset fingerprint, experimental random order, per-task/model-method outcome, trajectories, aggregate statistical scripts/notebooks, and explicit missingness/failure categories. Do **not** export HAR files or privileged bank state into shared datasets.

## Required before any inferential reporting
Demonstrate a known action producing reward 0 -> 1 on a fresh official task, negative control incorrect action -> reward 0, no-op -> reward 0, and matched reset -> same initial state fingerprint; compare against official BrowserGym `OpenAppsTask.reward()` for the same end state. This is a proposed verification test, **not yet done**.
