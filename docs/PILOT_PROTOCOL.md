# Pilot v1 — Exploratory OpenApps/BrowserGym Protocol

**Purpose:** Check agent/runtime compatibility, invalid episodes, information-probe opportunities and Baseline–Proposed (CDEA) treatment engagement before Main. Pilot outcomes are **exploratory** and separate from Main.

## Frozen task set

| # | Official Hydra task ID | Purpose |
|---:|---|---|
| 1 | `all_tasks/add_call_mom_to_my_todo` | To-do creation control |
| 2 | `all_tasks/mark_water_plants_as_done` | Existing to-do selection/completion |
| 3 | `longer_horizon/plan_elena_birthday_todo_message` | Two-app workflow |
| 4 | `openbanking/message_bob_the_savings_balance` | Retrieve bank balance, then message |
| 5 | `openbanking/add_todo_for_the_card_minimum_payment` | Retrieve payment value, then create to-do |
| 6 | `openbanking/add_todo_to_review_largest_card_charge` | Find a charge, then create to-do |

Official tasks and fixed selection: [`config/pilot_plan.json`](../config/pilot_plan.json). These six exact IDs are excluded from the frozen [Main task set](MAIN_TASKSET_V1.md).

## Fixed experiment design

| Item | Setting |
|---|---|
| Methods | Baseline vs Proposed (CDEA) |
| Models | `qwen3.5-9b`, `ministral3-8b`, `granite4.1-8b`, `xlam2-8b` |
| Size | **6 tasks × 4 models × 2 methods = 24 pairs / 48 episodes** |
| Seed and paired order | Seed 233; order predetermined from task/model/seed hash |
| Browser budget | 20 actions per arm |
| Ollama | 240 s/call; temperature 0; think false; up to 640 prediction tokens |
| Comparability | Same public goal/observation, checkpoint, action validation, timeout and one bounded repair |
| Treatment | Baseline ranks eligible model-supplied information probes by general progress; CDEA ranks the same probes by unknown-constraint coverage and estimated forward cost |

The official evaluator checks task completion after actions; its reward and hidden server state are not available to agent decisions. A model may supply fewer than two eligible probes; report non-engagement rather than attributing outcomes to CDEA.

## Run checks and Pilot (Windows PowerShell)

From the repository root, with pinned OpenApps at `$HOME\OpenApps`, `uv`, BrowserGym/Chromium and local Ollama:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_pilot.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_pilot.ps1 -CheckModels
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_pilot.ps1 -Run -PilotId pilot_v1 -ModelLabel qwen3.5-9b -MaxPairs 1 -StopOnInvalid
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_pilot.ps1 -Run -PilotId pilot_v1
```

`-DryRun` verifies official task IDs without episodes; `-CheckModels` checks model availability/digests without task-solving inference. The run uses an explicit Pilot ID and resumes only untouched scheduled pairs. Never use concurrent writers for the same ID or selectively rerun failures. Preserve interrupted/invalid pair folders and assign a **new ID** if protocol, controller, model, prompt, task set or budgets change.

## Outputs and interpretation

```text
output/pilot/pilot_v1/
  manifest.json
  model_digests.json
  results.csv              # 48 planned episode rows
  summary.csv
  episodes/pair_001/       # ... through pair_024
    pair.json
    Baseline/episode/episode.json
    Proposed/episode/episode.json
    Baseline/episode/browsergym/...
    Proposed/episode/browsergym/...
    Baseline/server/...
    Proposed/server/...
```

- **Valid pair:** both original official episodes complete using matching initial state, frozen model and evaluator; reward 0 is a valid unsuccessful task.
- **Invalid/incomplete pair:** exclude **both** arms from the paired success denominator, retaining their raw records.
- **Not started:** report separately; never impute as reward 0.
- **Always report:** 24 planned, valid/invalid/not-started counts; by-model and overall Baseline/Proposed success; probe opportunities, comparable decisions and action divergence.
- `results.csv` separates `official_success_raw` from `paired_analysis_success`; use the latter for paired estimates. No automatic invalid-pair retries or post-outcome task selection.

GitHub CI checks code contracts, **not** local OpenApps/Ollama/Chromium task execution. The researcher-reported completion status of the earlier Pilot is distinct from CI status; [Main readiness/provenance](DATA_PROVENANCE.md) documents the subsequent Main approval review.
