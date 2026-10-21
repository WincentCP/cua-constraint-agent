# Reproducibility and Environment

This guide documents the environment and output contract for the frozen CDEA Main study. It is intended for **inspection and independent reproduction**, not for modifying the completed study or its data.

## Frozen study components

| Component | Specification |
|---|---|
| Thesis implementation | `WincentCP/cua-constraint-agent` at `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1` |
| Official environment | `facebookresearch/OpenApps` at `6e6782794433c60468d65ac75bc3f03c56007f8c` |
| Browser agent harness | Official BrowserGym action/environment/evaluator pathway; controller guards BrowserGym core `0.13.4` |
| Language model runtime | Local Ollama; checkpoint tags in [models.json](../config/models.json) |
| Main plan | [main_plan.json](../config/main_plan.json) |
| Frozen 32-task roster | [main_taskset_v1.json](../config/main_taskset_v1.json) |
| Experimental analysis rules | [Main protocol](MAIN_PROTOCOL_V1.md) |

The original study was run with a Windows/PowerShell workflow. The repository's GitHub Actions checks Python 3.11 on Windows and Ubuntu, but the CI workflow **does not run OpenApps, Chromium, Ollama, or the completed experiment**.

## Environment prerequisites

- Git, Python 3.11, PowerShell, and the `uv` Python environment runner.
- A separate checkout of the pinned OpenApps project; its source and dependency environment must match the pinned commit.
- A Playwright Chromium installation compatible with the upstream OpenApps environment.
- Ollama running locally with the **four exact checkpoints** expected by the study. The model labels and Ollama tags are:

| Label | Ollama model tag |
|---|---|
| `qwen3.5-9b` | `qwen3.5:9b-q4_K_M` |
| `ministral3-8b` | `ministral-3:8b-instruct-2512-q4_K_M` |
| `granite4.1-8b` | `granite4.1:8b-q4_K_M` |
| `xlam2-8b` | `hf.co/Salesforce/Llama-xLAM-2-8b-fc-r-gguf:Q4_K_M` |

For result interpretation, **model tags alone are insufficient**: compare locally installed digests against `model_digests.json` in the original Main archive.

## Read-only checks and code validation

Run these commands from a checkout of the repository, with OpenApps available at `$HOME\OpenApps` (or pass `-OpenAppsDir` where supported).

```powershell
python -m unittest discover -s tests -v
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -CheckModels
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -AuditTasks
```

These checks validate code contracts, local model compatibility diagnostics, task registration, and basic evaluator controls as documented in [Main protocol](MAIN_PROTOCOL_V1.md). They are **preflights**, not task-solving episodes or independent confirmation of the archived Main execution.

To conduct a new, separately identified experiment, follow the **six evidence-gated readiness checks and exact execution procedure** in the frozen [Main protocol](MAIN_PROTOCOL_V1.md). Never reuse the completed Main ID for a changed controller, model, task set, or analysis plan.

## Archived result layout

The supplied result ZIP includes:

```text
manifest.json
model_digests.json
results.csv          # 256 episode rows
pairs.csv            # 128 paired task-model units
summary.csv          # 40 grouped summaries
analysis.json        # denominators, paired outcomes, and statistics
readiness/           # recorded approval and evidence files
preflight/           # relevant checks preserved in the study archive
episodes/
  pair_001/
    pair.json
    Baseline/...
    Proposed/...
  ...
  pair_128/
```

To check the fingerprint of the unchanged archive on Windows:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '.\main_observation_v1(5).zip'
```

Compare the printed hash to [Data provenance](DATA_PROVENANCE.md). The CSV columns are defined by `RESULT_FIELDS`, `PAIR_FIELDS` and `SUMMARY_FIELDS` in `scripts/browsergym/main.py`. The reported results and planned denominators are summarized in [Main results](MAIN_RESULTS_V1.md).

## Interpretation and verification boundaries

- `results.csv` records arm-level outcomes; `pairs.csv` is the primary unit for matched comparisons; `analysis.json` contains the planned primary exploratory inference.
- Valid pairs must satisfy the parity, integrity, success consistency, and matching conditions in the frozen protocol. Do not silently drop incomplete or invalid observations.
- Per-episode runtime logs and recorded approvals support auditability. Consult [Data provenance](DATA_PROVENANCE.md) for what has been checked and the distinction between researcher review and independent verification.
- Neither code-contract test success nor file-hash agreement by itself proves a live execution on the original host.
