# Small-Model Extension Protocol v1

## Purpose and scope

This is a **new execution plan for four Small (3B–4B) checkpoints only**. The Large (8B–9B) evaluation is already provided by the separate, frozen Main Study. The extension runner does not schedule, rerun, or infer Large episodes.

| Parameter | Value |
|---|---|
| Protocol | `cdea_small_extension_v1` |
| Fixed task roster | `config/main_taskset_v1.json` (32 OpenApps task IDs) |
| Categories | 5 bank information, 18 cross-app workflow, 9 primitive control |
| Checkpoints | Qwen3.5-4B, Ministral3-3B, Granite4.1-3B, xLAM2-3B |
| Treatments | Baseline and Proposed (CDEA) |
| Schedule | 32 task IDs × 4 checkpoints = **128 pairs, 256 episodes** |
| Ollama | Exact installed Small checkpoint tags, Q4_K_M |
| Shared controls | seed 233; 40 browser steps; temperature 0; num_predict 640; num_ctx 8192; model timeout 240 s; think false |
| OpenApps commit | `6e6782794433c60468d65ac75bc3f03c56007f8c` |

The two arms in each pair share task goal, observation format, action budget, and evaluator. CDEA differs from Baseline only in policy ranking when comparable information probes are available. Invalid/not-started pairs are preserved with their original status and excluded only from valid-pair success denominators.

## Active files and execution

- `config/small_extension_plan.json` — protocol and exact schedule parameters.
- `config/models_small_extension.json` — **four Small tags, no 8B–9B**.
- `scripts/browsergym/small_extension.py` — runner, immutable schedule and outputs.
- `scripts/browsergym/run_small_extension.ps1` — PowerShell interface.

From a Windows checkout, after installing OpenApps/BrowserGym and local Ollama:

```powershell
python -m unittest discover -s tests -v
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_small_extension.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_small_extension.ps1 -CheckModels
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_small_extension.ps1 -Run -ExtensionId small_ext_trial -MaxPairs 1 -StopOnInvalid
```

The runner creates `output/small_extension/<ExtensionId>/`, with a frozen manifest, `model_digests.json`, `results.csv` (256 slots), `pairs.csv` (128 pairs), `summary.csv` (32 cohort/checkpoint/arm rows), `analysis.json`, and one pair directory per scheduled unit.

Some internal output field names (`scale_id`, `study_phase=scale`, `paired_scale_completed`) are inherited from the BrowserGym paired controller; the externally declared protocol is **`cdea_small_extension_v1`** and the schedule is strictly Small-only. These field names **do not** imply Large checkpoints were run.

## Existing research archives

The current notebook also accepts the earlier, unmodified `scale_reference_v4.zip` archive under protocol `cdea_scale_v1`; **it filters that source to exactly the 128 Small pairs** and excludes all 128 historical Large pairs. The old eight-checkpoint protocol, associated runner and optional auditing utilities are retained only under [legacy/full_scale_v1](../legacy/full_scale_v1/README.md).

The canonical comparison is **Main Large (128) + extension Small (128)**. Main Large is never counted twice. The notebook reports archive identifiers, matching task–model roster, matched success fractions, exploratory exact McNemar, task-cluster sensitivity ranges, within-family interactions, probe diagnostics and efficiency.

**Important limitation:** the Main and earlier Scale Small source data record different controller commits and are not a randomized pure-parameter-count experiment. Treat the size contrast as exploratory; do not claim that a change in parameter count alone caused the observed difference. Preserving original archive content and recorded source identity remains part of responsible data reporting.
