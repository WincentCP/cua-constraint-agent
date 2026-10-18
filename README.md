# CDEA Computer-Use Agent — OpenApps

**Primary benchmark: Meta Research OpenApps.** Compare Baseline generic-progress probe ranking with Proposed Constraint-Directed Evidence Acquisition (CDEA), using identical visible observations, public goals, model calls, candidate controls, action budgets, and the same model per matched pair.

**Status: development PoC only. NO validated end-to-end model/official reward runs, no approved pilot/main task list, no 32-task main claim.** WebArena-Verified legacy source and protocols are preserved in the [webarena-verified-archive branch](https://github.com/WincentCP/cua-constraint-agent/tree/webarena-verified-archive).

See [Setup](docs/SETUP.md), [experiment protocol](docs/EXPERIMENT.md), [task review](docs/TASK_SCREENING.md), [evaluation protocol](docs/EVALUATION.md), [status](docs/STATUS.md), and [limitations](docs/LIMITATIONS.md).

## Run on the Windows warnet PC

Prerequisites: Node.js 24, Git, Ollama, `uv`, Playwright Chromium; checkout the exact OpenApps commit pinned in `config/openapps.json`. Do not mix different OpenApps versions between paired runs.

```powershell
cd "$HOME\OpenApps"
git fetch origin
git checkout 6e6782794433c60468d65ac75bc3f03c56007f8c
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$env:USER = $env:USERNAME
uv sync
uv run playwright install chromium
uv run launch.py
```

In a *second* PowerShell:

```powershell
cd "$HOME\cua-constraint-agent"
npm ci
npx playwright install chromium
npm run build
npm test
npm run openapps:doctor
npm run openapps:smoke
```

After fresh environment confirmation and availability of a locally running Ollama checkpoint:

```powershell
npm run poc:run -- --task add_todo_to_review_largest_card_charge --method Baseline --model-label granite4.1-8b --fresh-state-confirmed
```

To compare Proposed, **stop OpenApps and start a genuinely fresh database seed first**, prove equal initial state fingerprints, then run the same task/model with `--method Proposed`. A browser tab reset alone does NOT reset persistent app SQLite state.

Do not treat browser launch, pytest PASS, CLI smoke, model-finished claims, or unverified saved traces as official end-to-end task success. The PoC runner saves an external evaluator result separately.

## Research boundaries

- PoC: three registered OpenBanking tasks. Debugging data; excluded from confirmatory inference.
- Pilot: six **not yet selected** held-out task families; planned 6 x 4 models x 2 policies = 48 first-attempt evaluations; **blocked** until task suitability + reset + model competency checks.
- Main: **target** 32 suitable tasks x 4 models x 2 policies = 256 first-attempt evaluations; **blocked** pending 32 independently screened tasks, supervisor approval and preregistered analysis. Variations of the same task count as correlated members of the same family, not independent tasks.
- Evaluator: OpenApps `Task.check_if_task_is_complete(initial_state,current_state)`, invoked outside the agent; no expected target-state values in prompts.
- Local-only website/model. Persist outputs outside ephemeral warnet storage before logout. Treat traces, HAR and app SQLite snapshots as private research data.

`main` is OpenApps-first; WebArena isn't part of current procedures. 
