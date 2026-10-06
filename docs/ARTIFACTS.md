# Experiment artifact layout

Experiment outputs are kept separate from source code so the repository stays clean while every PoC, pilot, and main-experiment artifact remains auditable.

## Principle

- `output/` contains raw evidence and machine-readable run artifacts.
- `reports/` contains generated indexes and summaries intended for audit, Bab IV preparation, and appendix preparation.
- both directories are ignored by Git; source code, protocols, configs, and freeze metadata definitions remain version-controlled.
- generated reports never override the official WebArena-Verified evaluator.

## Automatic layout

PoC:

```text
output/poc/
  stage-manifest.json
  task-inputs/
    284.json
  284/
    accessibility/
      01.yaml
    inspection.json
    network.har
    agent_response.json
    eval_result.json

reports/poc/
  artifact-index.json
  artifact-index.csv
  stage-summary.md
```

Pilot uses the same shape under `output/pilot/` and `reports/pilot/`, with one numeric task directory per pre-registered pilot task.

Main experiment:

```text
output/main/<experiment-id>/
  stage-manifest.json
  runs/
    <model>/
      baseline/
        <task-id>/
      proposed/
        <task-id>/
  summary/

reports/main/<experiment-id>/
  artifact-index.json
  artifact-index.csv
  stage-summary.md
```

The main runner will later write run-level model/method metrics into these pre-defined directories after the final task list and experiment identity are frozen.

## Commands

Initialize or refresh the current PoC layout:

```powershell
npm run artifacts:init -- --stage poc
```

Initialize all six pilot task directories:

```powershell
npm run artifacts:init -- --stage pilot
```

After the final task list is frozen, initialize the factorial main layout:

```powershell
npm run artifacts:init -- --stage main --experiment-id thesis-v1 --tasks 284,323
```

For `main`, supplying `--tasks` creates the four-model × two-method directory scaffold automatically.

Refresh an artifact inventory at any point:

```powershell
npm run artifacts:report -- --stage pilot
```

The WebArena `prepare`, `inspect`, and `evaluate` commands also refresh the stage report automatically.

## Research integrity

`stage-manifest.json` is an operational artifact manifest, not the research freeze. The authoritative experiment identity remains the separate cryptographic freeze created only after pilot review. Generated `artifact-index.*` files are derived indexes and may be regenerated without changing the experimental result.
