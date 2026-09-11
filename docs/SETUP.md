# Setup

Run commands from the repository root. On the original workstation:

`C:\Users\User\Documents\ChatGPT\skripsi\cua-constraint-agent`

## Dependencies

- Node.js 24 or newer, with npm.
- Git for version identity and freeze.
- Playwright's managed Chromium (separate from the npm package).
- Ollama serving the model in `config/experiment.json` (`qwen2.5:7b`).

```powershell
npm ci
npx playwright install chromium
ollama pull qwen2.5:7b
```

Ollama stores its model outside the repository, normally in `%USERPROFILE%\.ollama\models` on Windows. Start the Ollama desktop application, or run `ollama serve` in a separate terminal if it is not already serving. The default endpoint is `http://127.0.0.1:11434`.

```powershell
npm run experiment -- doctor
npm run experiment -- validate
npm run build
npm test
npm run test:integration
```

`doctor` checks browser startup, model digest and Ollama version. It does not establish model competence. Use `doctor --demo` for browser-only readiness.

The original workstation exposes about 6 GiB RAM and CPU inference. A real Qwen2.5 7B smoke attempt timed out during model loading; use demo for engineering checks on this machine. Run the real-model gate and main collection on a machine with sufficient available memory. An installed model is not proof that inference can run reliably. The doctor output includes total/free RAM and explicitly marks inference as untested.

The PRD permits choosing one capable model before freeze. A smaller model may be considered only through a new development cycle with the same model for both policies and a passing competence gate; do not mix model sizes in an experiment. Context and budget changes also require revalidation before freeze.

No Python, database server, API key, microphone or cloud service is required. JSONL is the persistent record format. The synthetic server binds an ephemeral loopback port per attempt and closes afterward.

## Configuration

`config/experiment.json` is the only research configuration. It contains model options, common budgets and run-order seed. A different local Ollama origin may be passed with `--ollama`. Remote model endpoints are rejected.

Optional `CHROMIUM_PATH` selects an explicitly installed Chromium executable. Its path and version are included in runtime identity. Normally omit it and use the managed browser. `.env` files are not loaded.

Changing model digest, runtime, code, tests, configuration or dependencies requires a new development cycle and freeze. Do not upgrade them during main collection.

## Troubleshooting

- `fetch failed`: start Ollama, check `ollama list`, then rerun `doctor`.
- Missing browser executable: `npx playwright install chromium`.
- Output already exists: choose a new directory or follow the resume/rerun protocol.
- Source identity differs: create a new development cycle; do not patch the old freeze.
- Model timeouts/browser crashes: preserve original records and follow paired infrastructure reruns.
- Ctrl+C stops the active attempt and retains its record. After a forced termination, `resume` marks unfinished journal entries as infrastructure failures.
