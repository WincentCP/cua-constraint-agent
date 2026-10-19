# CUA Thesis: official BrowserGym + OpenApps

**Status: end-to-end Qwen development PoC succeeded; shared matched Baseline/CDEA runner now implemented. Not pilot/main results.**

## Next: isolated matched development pair

With Ollama active, from the thesis repository in PowerShell:

    git pull --ff-only
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_matched_dev.ps1

This launches Baseline and Proposed on separate fresh OpenApps databases
and checks initial-state SHA parity. It uses an identical AXTree, JSON action
interface, model tag/digest, model settings and step budget. CDEA reranks only
real public information-acquisition alternatives. The simple Todo task may have
no treatment opportunity. Read docs/MATCHED_DEVELOPMENT.md before interpreting
results. Do NOT label development outcomes as pilot or confirmatory results.

The former custom TypeScript runner (Baseline/CDEA), tests, documentation and Git history are preserved at branch **archive/custom-openapps-runner-20261018** (commit c2fae213b203dc4899d3ee05958c9a66bb3ba6a2).

## Architecture

- **Models:** four planned local Ollama models in config/models.json.
- **Treatment:** Baseline vs CDEA is implemented in a new matched *development* runner, with a shared policy API; live treatment separation on eligible information tasks is pending.
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

## Real task development run: Qwen + BrowserGym

BrowserGym's one-action no-op smoke and the separate Qwen Ollama API preflight both passed on the Windows research PC. This **new** runner uses the official BrowserGym HighLevelActionSet, AXTree and OpenApps evaluator with Qwen decisions, but has not yet passed a live task episode.

1. Stop the previous OpenApps server with Ctrl+C. Start a **new** OpenApps server in its own PowerShell window, so the task uses a fresh session DB:

       cd "$HOME\OpenApps"
       $env:USER = $env:USERNAME
       $env:PYTHONUTF8 = "1"
       uv run launch.py

2. Keep that window running and Ollama active. In a second PowerShell window run:

       cd "$HOME\cua-constraint-agent"
       git pull --ff-only
       powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_qwen_dev.ps1

This runs a **single unpaired development task**, add_call_mom_to_my_todo, at most ten BrowserGym actions. The model only receives the public goal and current accessibility tree; it chooses constrained actions from visible element IDs. The official evaluator returns success; no expected solution is inserted into the model prompt. Development artifacts are written to output/browsergym/dev. A true/false score is only a diagnostic development outcome, **not** a Baseline/CDEA experimental finding.

The fresh-state flag is a manual attestation and does not automate reset or prove parity. Do not reuse the same OpenApps session for another model and do not run pilot/main experiments yet.

## Inspect the existing failed development run (no rerun)

A prior Qwen development episode reported `official_success: false` after nine actions, and official state comparisons showed an unexpected empty-title todo. The evaluator checks the **whole app state**, so extra items can prevent task success even when the requested item is present. The exact cause (e.g., early submit, repeated submit, or action sequence error) **cannot be determined from console diffs alone**.

Read the saved local action trace without rerunning anything:

    cd "$HOME\cua-constraint-agent"
    $r = Get-Content ".\output\browsergym\dev\82c2d289cddd467e8b9d5a12d94cfccf.json" -Raw | ConvertFrom-Json
    $r | Select-Object status, official_success, official_reward, steps
    $r.trace | Format-List step, action, official_reward, browser_error, model_error

Send the nine action entries before changing the policy or retrying. The next runs also print their action trace automatically.

## Dev runner diagnostic safeguards

The prior nine-action Qwen run clicked the same bid four times and later returned
false on the official evaluator. The old action-only trace cannot identify
what bids 226 and 22 represented. The dev runner now records public AXTree
role/name/value of selected elements and a developer-only todo-state delta
after each action, stops a third repeated click, blocks an empty Add submission,
and stops on an unexpected new empty-title todo or premature finish.
Private state is never sent to the model. These are development diagnostics,
not a Baseline/CDEA policy or valid main-experiment results. Start a fresh
OpenApps server before any new development run.

## Before experimental results

See docs/RESEARCH_GATES.md. Required next: live smoke result, automated isolated resets, official evaluator positive/negative cases, shared Ollama adapter and action space, matched Baseline/CDEA episodes, independent pilot and frozen 32-task main set. Do not mix archived runner episodes into official-harness results.
