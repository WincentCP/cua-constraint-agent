# CUA Thesis: official BrowserGym + OpenApps

**Status: research infrastructure prototype. Not a completed CDEA experiment.**

The former custom TypeScript runner (Baseline/CDEA), tests, documentation and Git history are preserved at branch **archive/custom-openapps-runner-20261018** (commit c2fae213b203dc4899d3ee05958c9a66bb3ba6a2).

## Architecture

- **Models:** four planned local Ollama models in config/models.json.
- **Treatment:** Baseline vs Constraint-Directed Evidence Acquisition (CDEA) is not yet connected to the new harness.
- **Harness:** official OpenApps task registration with BrowserGym environment and official evaluator. The smoke implementation exercises this foundation on a single non-mutating browser action.
- **Benchmark:** OpenApps apps/tasks including OpenBanking and Todo. Task suitability and a final set of 32 tasks still require screening.

## Windows smoke test

Prerequisite: pinned OpenApps checkout at HOME/OpenApps, commit **6e6782794433c60468d65ac75bc3f03c56007f8c**, uv, and Playwright Chromium. OpenApps and Ollama are separate; the no-op smoke **does not need Ollama**.

**PowerShell 1:** start OpenApps and leave running:

    cd "$HOME\OpenApps"
    $env:USER = $env:USERNAME
    $env:PYTHONUTF8 = "1"
    uv run launch.py

**PowerShell 2:** run the official adapter smoke:

    cd "$HOME\cua-constraint-agent"
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_official_smoke.ps1

The Python runner imports upstream OpenApps task registration, creates its BrowserGym environment, reads raw BrowserGym `axtree_object` using its official `flatten_axtree_to_str` formatter (raw `env.reset()` does not produce `axtree_txt`), executes one literal Python `pass` (no-op) action with the required `action_mapping=None` and per-episode `exp_dir` arguments, checks `last_action_error` and records the official reward to output/browsergym/smoke/. A reward of zero is normal for a no-op. An invalid episode is not counted as a model failure.

**Windows compatibility:** upstream launch_agent.py uses /bin/bash to spawn its own server and cannot directly run on native Windows. This repo's smoke instead uses an already-running OpenApps server and the official registration / environment / task evaluator from the OpenApps package.

CI runs static, dependency-free contract checks on Windows and Linux; **it does not validate a live OpenApps task or an Ollama agent**.

## Next step: Ollama preflight (no task actions)

With Ollama running and the selected Qwen model pulled, open PowerShell in the thesis repo:

    cd "$HOME\cua-constraint-agent"
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\check_ollama.ps1

This read-only check uses the exact tag in config/models.json, records the locally installed Ollama model digest and sends a harmless structured JSON test prompt to /api/chat. For Qwen3.5 it explicitly sends top-level `think: false` with a 256-token response budget to avoid spending the whole budget on hidden reasoning; this setting is only for the API preflight, **not yet** an experimental model-policy decision. On an empty answer, the error includes `done_reason`, `eval_count`, and the length of any thinking field (never the thinking text). It writes output/ollama/preflight/*.json. It does **not** use a browser, solve a task, or validate Baseline/CDEA performance. A model listed in config/models.json is not automatically installed by this repository.

## Before experimental results

See docs/RESEARCH_GATES.md. Required next: live smoke result, automated isolated resets, official evaluator positive/negative cases, shared Ollama adapter and action space, matched Baseline/CDEA episodes, independent pilot and frozen 32-task main set. Do not mix archived runner episodes into official-harness results.
