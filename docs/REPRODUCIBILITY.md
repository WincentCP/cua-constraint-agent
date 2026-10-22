# Main v1 — Reproducibility

**Runtime:** Windows PowerShell · Python 3.11/`uv` · OpenApps · BrowserGym core 0.13.4 · Playwright Chromium · local Ollama.

| Frozen component | Value |
|---|---|
| CDEA controller commit | `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1` |
| OpenApps commit | `6e6782794433c60468d65ac75bc3f03c56007f8c` |
| Task set | [32 official task IDs](../config/main_taskset_v1.json) |
| Experiment plan | [Main configuration](../config/main_plan.json) |
| Protocol | [Frozen Main protocol](MAIN_PROTOCOL_V1.md) |

## Requirements

Install Git, Python 3.11, `uv`, PowerShell, the pinned OpenApps checkout at `$HOME\OpenApps`, and compatible Playwright Chromium. Use local Ollama with all four frozen checkpoints:

| Model label | Ollama tag |
|---|---|
| `qwen3.5-9b` | `qwen3.5:9b-q4_K_M` |
| `ministral3-8b` | `ministral-3:8b-instruct-2512-q4_K_M` |
| `granite4.1-8b` | `granite4.1:8b-q4_K_M` |
| `xlam2-8b` | `hf.co/Salesforce/Llama-xLAM-2-8b-fc-r-gguf:Q4_K_M` |

Confirm **checkpoint digests**, not just model tags, against archived `model_digests.json`.

## Read-only checks (PowerShell, from repo root)

```powershell
python -m unittest discover -s tests -v
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -CheckModels
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -AuditTasks
Get-FileHash -Algorithm SHA256 -LiteralPath '.\main_observation_v1(5).zip'
```

The last hash must match [Data provenance](DATA_PROVENANCE.md). Preflight and GitHub CI checks **do not execute the recorded Main episodes**. For any new study, use a **new Main ID** and the six-gate readiness workflow in the [protocol](MAIN_PROTOCOL_V1.md).

## Result archive

```text
main_observation_v1(5).zip
├── manifest.json
├── model_digests.json
├── results.csv       # 256 episodes
├── pairs.csv         # 128 matched pairs
├── summary.csv       # 40 summaries
├── analysis.json
├── readiness/
├── preflight/
└── episodes/
    ├── pair_001/
    │   ├── pair.json
    │   ├── Baseline/...
    │   └── Proposed/...
    └── ...pair_128/
```

`results.csv` stores arm outcomes; `pairs.csv` is the paired-analysis unit; `analysis.json` stores the primary exploratory statistics. Keep all invalid, failed and not-started records; evaluate parity and official rewards using the frozen rules. Logs/approvals support traceability; see [Data provenance](DATA_PROVENANCE.md) for recorded **researcher-reported PASS** and limits of independent verification.
