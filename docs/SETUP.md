# Setup

Run commands from the repository root on the benchmark machine.

## Dependencies

- Windows with a working NVIDIA driver for the selected benchmark GPU.
- Node.js 24 or newer, with npm.
- Git for source identity and freeze.
- Playwright's managed Chromium (installed by the repository command below).
- Ollama 0.13.3 or newer. RNJ-1 requires 0.13.3+, so the benchmark runner rejects an older runtime.
- The committed Model-Selection Pre-Study candidate set from `scripts/benchmark/models.json` (normally four models; three only after a documented reproducible deployment exclusion), all using the Q4_K_M quantization class.

```powershell
npm ci
npx playwright install chromium
ollama pull qwen3.5:9b-q4_K_M
ollama pull ministral-3:8b-instruct-2512-q4_K_M
ollama pull granite4.1:8b-q4_K_M
ollama pull rnj-1:8b-instruct-q4_K_M
```

Ollama stores models outside the repository, normally in `%USERPROFILE%\.ollama\models` on Windows. Start the Ollama desktop application, or run `ollama serve` in a separate terminal if it is not already serving. The default endpoint is `http://127.0.0.1:11434`.

Before research collection, verify the machine and repository:

```powershell
nvidia-smi
git status --short
node -v
npm -v
ollama --version
ollama list
npm run build
npm test
npm run test:integration
npm run experiment -- validate
```

`git status --short` should be empty. The benchmark runner repeats dependency installation, build, tests, formatting and dataset validation before dispatching research episodes. It also captures the Git commit, OS, RAM, GPU information, NVIDIA driver/VRAM when `nvidia-smi` is available, Ollama version and installed model list.

No Python, database server, API key, microphone or cloud service is required. JSONL is the persistent record format. The synthetic server binds an ephemeral loopback port per attempt and closes afterward.

## Model-Selection Pre-Study benchmark

Run the one-time preflight on a new benchmark machine:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\benchmark\run.ps1 -Mode pilot -Out exports\device-preflight-v1
```

The declared pilot is one run per active model on three development tasks. With the default four candidates this is 12 episodes. Go/no-go is **all pilot episodes healthy with zero infrastructure failures for the currently committed active set**. A clean pilot is not the final model-selection result.

If the machine, driver, Ollama version, repository revision and configuration remain unchanged, run the full model-selection benchmark:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\benchmark\run.ps1 -Mode full -Out exports\llm-benchmark-full-v1
```

Full Model-Selection Pre-Study is normally 4 models × 6 predeclared development tasks × 3 repetitions = 72 Baseline-only episodes. If one model is formally deployment-ineligible before full Model-Selection Pre-Study, the committed three-model set produces 54 episodes. The fixed task subset is `development-01`, `development-03`, `development-05`, `development-06`, `development-07`, and `development-11`. It balances U2/U3/U4 at two tasks each and covers both solvable subtypes plus no-solution and unavailable-evidence. The runner checks that every committed active model tag exists before starting model episodes.

Do not remove a candidate after one failure. Diagnose the machine and run one fresh pilot with the unchanged candidate list. If the same model again fails for reproducible deployment/infrastructure reasons while the others are healthy, preserve both pilot outputs, document the exclusion in `docs/STATUS.md`, update and commit `scripts/benchmark/models.json`, and start a fresh pilot. Never exclude a model for poor VDA or slow inference.

If Granite 4.1 is the reproducibly incompatible candidate, the predeclared fallback is `granite3.3:8b-instruct-q4_K_M`. Update and commit the candidate list, then start a fresh pilot. Never switch candidates in the middle of the full Model-Selection Pre-Study benchmark.

## Selected model, gate and freeze

`config/experiment.json` currently carries Qwen3.5 9B only as the bootstrap real-model configuration. During the Model-Selection Pre-Study the benchmark runner swaps the model field for each candidate and restores the file exactly afterward.

After Model-Selection Pre-Study, select one model using the rule in `docs/LLM-BENCHMARK.md`. Set `config/experiment.json` to the exact selected model tag and commit the change before the repeatability gate. Do not tune the prompt, budget, context, temperature or seed after seeing the benchmark result.

```powershell
npm run experiment -- doctor
npm run experiment -- repeatability --out exports/repeatability-v1
npm run experiment -- gate --input exports/repeatability-v1
npm run experiment -- freeze --gate exports/repeatability-v1 --out exports/freeze-v1.json
npm run experiment -- main --freeze exports/freeze-v1.json --out exports/main-v1
npm run experiment -- export --input exports/main-v1
```

The repeatability gate is 4 predeclared development tasks (`development-01`, `development-03`, `development-05`, `development-06`) × 2 policies × 3 repetitions = 24 runs. It requires a clean output with stable evaluator outcomes, no infrastructure/budget/schema failures, and baseline competence. Exact probe trajectories are reported as diagnostics but do not need to be identical. The main experiment remains 32 base tasks × 2 policies = 64 planned policy executions. The full 12-task development pool remains available for engineering diagnostics, but no additional 12-task batch is mandatory after the Model-Selection Pre-Study.

## Configuration

`config/experiment.json` is the single research configuration. It contains model options, common budgets and run-order seed. A different local Ollama origin may be passed with `--ollama`. Remote model endpoints are rejected.

Optional `CHROMIUM_PATH` selects an explicitly installed Chromium executable. Its path and version are included in runtime identity. Normally omit it and use the managed browser. `.env` files are not loaded.

Changing model digest, runtime, code, tests, configuration or dependencies after the gate requires a new development cycle and freeze. Do not upgrade them during main collection.

## Troubleshooting

- Ollama version rejected: upgrade Ollama to 0.13.3 or newer before starting a new pilot.
- `fetch failed`: start Ollama, check `ollama list`, then rerun `doctor`.
- Missing model: install the exact tag from `scripts/benchmark/models.json`; do not silently substitute another quantization.
- Missing browser executable: `npx playwright install chromium`.
- Output already exists: choose a new directory or follow the documented resume/rerun protocol.
- Environment changed after an infrastructure failure: preserve the old output and start a fresh pilot/full output rather than resuming across environments.
- Source identity differs: create a new development cycle; do not patch an old freeze.
- Model timeouts/browser crashes: preserve original records and diagnose them as infrastructure evidence.
- Ctrl+C stops the active attempt and retains its record. The benchmark `-Resume` option skips completed cells and preserves interrupted directories before rerunning an incomplete cell.
