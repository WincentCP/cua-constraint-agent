# Live Scale execution — operator runbook

This runbook covers **new** official OpenApps/BrowserGym episodes, using the frozen Scale v1 32-task roster and eight configured Ollama checkpoints. It does not modify Main v1, an existing Scale archive, or any already sealed pair.

## 1. Lock source and runtime

Use Windows PowerShell from the repository root. Install Python 3.11, Git, PowerShell, uv, pinned OpenApps at `$HOME\OpenApps`, BrowserGym core, Playwright Chromium, and the eight exact Ollama model tags from [models_scale.json](../config/models_scale.json).

~~~powershell
git status --porcelain
git rev-parse HEAD
git -C "$HOME\OpenApps" rev-parse HEAD
ollama list
python -m unittest discover -s tests -v
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_scale.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_scale.ps1 -CheckModels
~~~

The repo must be clean. The OpenApps commit must equal `6e6782794433c60468d65ac75bc3f03c56007f8c`. The model compatibility check is a preflight, not an official task outcome. A model tag or controller change requires a new study ID.

## 2. Execute one authentic matched pair

~~~powershell
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_scale.ps1 -Run -ScaleId scale_live_20261024_v1 -MaxPairs 1 -StopOnInvalid
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\audit_scale_live.ps1 -ScaleId scale_live_20261024_v1
~~~

The `scale_live_20261024_v1` identifier is an **example new study ID**, not a claim that an episode has run. Do not use an existing study ID containing previous observations. The runner constructs the original OpenApps server process and BrowserGym environment, asks the pinned Ollama model for real actions, and records the official evaluator reward without injecting outcome targets.

Per arm, the enhanced runner captures:

- `server/launcher.json`: observed server PID, launch command, original OpenApps commit and launcher hash, server ownership probe, and UTC start/ready/stop times and exit code.
- `server/server.log`, `server/logs/config.yaml`, and `server/databases/`: original server stdout, upstream Hydra configuration, and isolated application state.
- `episode/episode.json`, `episode/observations/`, and `episode/browsergym/`: executed action trace, per-step raw AXTree files with matching SHA-256 hashes, and BrowserGym artifacts.
- `pair.json`: matched reset-state parity, both arm identities, official outcomes, and comparable CDEA probe diagnostics.

If the first pair is invalid, **retain it** and inspect its real failure. Never replace an invalid run with a fabricated valid record or silently rerun an observed pair.

## 3. Complete the same frozen study

When the first pair and its runtime evidence have been inspected:

~~~powershell
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_scale.ps1 -Run -ScaleId scale_live_20261024_v1
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\audit_scale_live.ps1 -ScaleId scale_live_20261024_v1 -RequireComplete
~~~

An unchanged manifest retains the original schedule, frozen controller/configuration hashes, model checkpoint digests, and source identity. The audit checks numerical denominators, real launcher records, source Git/worktree identity, captured observation digests, Todo database schema, and recorded official rewards against CSV fields. Its `runtime_artifact_contract: PASS` means **the captured artifacts are internally consistent**, not that a separate observer independently witnessed each host process. Preserve raw machine-side evidence and original archive hashes if host-level attestation is required.

The required archive contract is **256 planned matched pairs**, **512 episode slots**, and **64 summary rows**. Real failures, invalid episodes, and unstarted pairs remain visible; the analysis never imputes them as valid successes.

## 4. Preserve and compare

Record the source commit and exact hashes of each archive, checkpoint digest, and original logs before evaluating differences against a prior reference dataset. Do not reuse a source commit from a historic archive unless that exact code was what actually executed. Keep the original observed reference data separate from the new run rather than making existing evidence conform to revised code.

Source-compatibility, structural integrity, official task rewards, and provenance are different checks. A clean repository and green CI establish software/test quality; they do not independently verify unexecuted episodes.
