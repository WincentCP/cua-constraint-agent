# Windows warnet setup (PoC only)

## 1. Prerequisites and pinned benchmark
Install Git, Node 24, uv, Ollama. Clone Meta [OpenApps](https://github.com/facebookresearch/OpenApps). OpenApps official `launch.py` runs as a website on Windows, but its `launch_agent.py` uses `/bin/bash`; **do not use that unsupported Linux-oriented launcher here**.

PowerShell in the OpenApps directory:

```powershell
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$env:USER = $env:USERNAME
git fetch origin
git checkout 6e6782794433c60468d65ac75bc3f03c56007f8c
uv sync
uv run playwright install chromium
uv run launch.py
```

The pin refers to the upstream code version inspected during migration. If this pin cannot be built/run on the local PC, STOP, document the failure, and revise the pin in a recorded protocol change **before** collecting results.

## 2. In second PowerShell

```powershell
cd "$HOME\cua-constraint-agent"
npm ci
npx playwright install chromium
npm run build
npm test
npm run openapps:doctor
npm run openapps:smoke
```

`openapps:doctor` verifies upstream Git SHA and configs; `openapps:smoke` verifies localhost responds and the public task goal can be loaded. Neither attests to task scoring correctness or reset.

## 3. Official component tests

```powershell
cd "$HOME\OpenApps"
uv run python -m pytest tests/test_openbanking.py -q -x
```

Passing is a **component-level** benchmark test, not a completed autonomous episode.

## 4. Local Ollama model

```powershell
ollama list
```

The exact tags in `config/models.json` must exist; the runner reads and records immutable checkpoint SHA-256 digests via Ollama. Download only the model you intend to test initially. If tags differ, record mapping and approve before pilot. `npm run poc:run -- --task ...` runs only one PoC cell at a time.

## 5. Each experimental episode

- Start a fresh app process with new underlying per-run database directory; capture a trusted initial-state hash before any mutations.
- Hold OpenApps version, goal text, model digest, browser, temperature, context length and step budget constant across Baseline/Proposed.
- Launch a **single** development run; save `output/openapps/poc/<UUID>`.
- Collect official evaluator result and inspect browser action trace; classify environment errors separately.
- **Do not** invoke more task runs on an already-mutated app state.
- Export logs and evidence to an external persistent drive before the warnet resets.
- Do not upload private HAR cookies, personal financial data, SQLite DBs or .env to GitHub/Colab.

If the runner fails on Windows, see `docs/LIMITATIONS.md`. No pilot/main automation is approved yet.
