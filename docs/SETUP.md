# Setup

Run commands from the repository root on the machine that will collect benchmark data.

## Dependencies

- Windows with a stable NVIDIA driver for the benchmark GPU.
- Node.js 24 or newer, with npm.
- Git for source identity and freeze.
- Playwright's managed Chromium (installed by the benchmark runner).
- Ollama 0.13.3 or newer.

The locked pre-study candidate set is:

```powershell
ollama pull qwen3.5:9b-q4_K_M
ollama pull ministral-3:8b-instruct-2512-q4_K_M
ollama pull granite4.1:8b-q4_K_M
ollama pull rnj-1:8b-instruct-q4_K_M
```

All candidates must resolve to the same `Q4_K_M` quantization class. The runner verifies the actual quantization reported by `ollama show`, not only the model tag. `config/experiment.json` uses Qwen3.5 9B as the pre-study default so ordinary doctor checks do not require an obsolete extra model; the benchmark runner temporarily substitutes each candidate and restores the file exactly afterward. After Phase 1 selects one model, change the config to that exact selected model, commit the change, then run repeatability/gate/freeze.

Ollama stores models outside the repository, normally in `%USERPROFILE%\.ollama\models` on Windows. Start the Ollama desktop application, or run `ollama serve` in a separate terminal if it is not already serving. The default endpoint is `http://127.0.0.1:11434`.

## Clean-machine checks

```powershell
nvidia-smi
git --version
node -v
npm -v
ollama --version
ollama list
npm ci
npx playwright install chromium
npm run format:check
npm run build
npm test
npm run test:integration
npm run experiment -- validate
```

The benchmark runner repeats the npm/Playwright/build/test/validation checks before data collection. It records Git commit, Node/npm/Ollama versions, OS, RAM, CPU, GPU/VRAM/driver (when `nvidia-smi` is available), and installed Ollama model digests. A resume is rejected if this stable environment identity differs from the original benchmark output.

No Python, database server, API key, microphone or cloud service is required. JSONL is the persistent record format. The synthetic server binds an ephemeral loopback port per attempt and closes afterward.

## Phase 1 benchmark

From a clean checkout with the four models installed:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\benchmark\run.ps1 -Mode pilot -Out exports\device-preflight-final-v1
```

Pilot must finish 12/12 healthy before the full benchmark:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\benchmark\run.ps1 -Mode full -Out exports\llm-benchmark-full-final-v1
```

Use `-Resume` only when the repository revision, driver, hardware, Ollama version and installed model digests have not changed. The runner verifies this before continuing.

## Configuration

`config/experiment.json` is the research configuration. Current watchdog limits are deliberately above the older pilot values (`model_ms=120000`, `deadline_ms=360000`) so a slower but otherwise healthy 8–9B candidate is not classified as infrastructure failure merely because a single inference crosses the former 60-second limit. Probe/action/model-call budgets remain fixed and identical across models and policies.

A different local Ollama origin may be passed with `--ollama`. Remote model endpoints are rejected. Optional `CHROMIUM_PATH` selects an explicitly installed Chromium executable; normally omit it and use the managed browser. `.env` files are not loaded.

Changing model digest, runtime, code, tests, configuration or dependencies requires a new development cycle and freeze. Do not upgrade them during main collection.

## Troubleshooting

- `fetch failed`: start Ollama, check `ollama list`, then rerun.
- Missing browser executable: `npx playwright install chromium`.
- Output already exists: choose a new directory or use `-Resume` only when the environment identity is unchanged.
- Pilot exits nonzero: inspect `summary.csv`, per-model `doctor.json`, `warmup.json`, `ollama-show.txt` and episode failures before full benchmark.
- Model timeouts/browser crashes: preserve original records. Do not convert infrastructure failure into VDA=0.
- Main source/config/model changed after gate: create a new development cycle and freeze.
