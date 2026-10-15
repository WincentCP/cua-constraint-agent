# Windows new-device setup — Shopping-only PoC

## 0. Install required software from a new Windows laptop

First, open **PowerShell as Administrator** and enable WSL2:

```powershell
wsl --install
wsl --update
```

Restart if Windows requests it. On Windows with WSL already enabled, an error saying the distribution is already installed is not a reason to reinstall.

Then open a **new PowerShell** session and install required tools one by one:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id astral-sh.uv -e
winget install --id Docker.DockerDesktop -e
```

Close and reopen PowerShell to refresh PATH. Start Docker Desktop manually, enable **WSL 2 based engine / Linux containers**, and wait for the service to say _Running_. If WinGet is unavailable, use the official installers linked from Git, Node.js, uv and Docker Desktop websites instead.

**Do not download four local LLMs yet.** Ollama and model checkpoint downloads are later-stage dependencies; they are not needed for the first PoC inspection. Budget sufficient Docker storage (tens of GB, beyond the ~13 GB Shopping image).

## Prerequisites

Windows 10/11, PowerShell, Git, **Node.js 24+**, Docker Desktop using Linux containers with **WSL2**, and uv/uvx. The device has RTX 5060 Laptop + 16 GB RAM; run one small local model at a time **later**. Ollama is not required to inspect task 284.

Use the official Windows installers or `winget` for Git, Node.js LTS, Docker Desktop and uv. Docker Desktop must show **Running** before starting Shopping. Reopen PowerShell after installing tools.

```powershell
git --version
node --version
npm.cmd --version
docker --version
docker info --format '{{.OSType}}'
uvx --version
```

Docker info should report `linux`. On Windows, `npm.cmd` avoids common PowerShell `npm.ps1` execution-policy errors.

## 1. Clone and test

```powershell
New-Item -ItemType Directory -Path "$HOME\Projects" -Force | Out-Null
Set-Location "$HOME\Projects"
git clone https://github.com/WincentCP/cua-constraint-agent.git
Set-Location .\cua-constraint-agent
npm.cmd ci
npx.cmd playwright install chromium
Copy-Item config/webarena.example.json config/webarena.local.json
npm.cmd run webarena:doctor
npm.cmd run webarena:validate
npm.cmd run format:check
npm.cmd run build
npm.cmd test
npm.cmd run test:integration
```

## 2. Run only Shopping (version pinned)

```powershell
uvx --from webarena-verified==1.2.3 webarena-verified --help
uvx --from webarena-verified==1.2.3 webarena-verified env start --site shopping
uvx --from webarena-verified==1.2.3 webarena-verified env status --site shopping
Start-Process "http://localhost:7770"
```

First boot downloads a substantial Docker image. Avoid installing or starting the other WebArena websites.

## 3. Inspect official PoC task 284

```powershell
npm.cmd run webarena:prepare -- --task 284 --stage poc
npm.cmd run webarena:inspect -- --task 284 --stage poc
npm.cmd run artifacts:report -- --stage poc
```

Outputs:

```text
output/poc/task-inputs/284.json
output/poc/284/accessibility/01.yaml
output/poc/284/inspection.json
output/poc/284/inspection.har
reports/poc/poc-review.md
reports/poc/stage-summary.md
reports/poc/artifact-index.csv
```

`inspection.har` is **not** `network.har`. It records an inspection only. The official agent task evaluator requires a separate complete run. To avoid destroying audit evidence, repeating `prepare` or `inspect` on existing output is rejected unless `--force` is explicitly supplied.

Review the checklist `reports/poc/poc-review.md` and send `inspection.json`, Accessibility Tree and command output for audit. **Stop before pilot**; manually verify the two meaningful information-acquisition choices.

```powershell
uvx --from webarena-verified==1.2.3 webarena-verified env stop --site shopping
```

## 4. Pilot preparation — only after PoC GO

```powershell
npm.cmd run webarena:catalog
npm.cmd run artifacts:init -- --stage pilot
```

Public task catalog: `output/catalog/shopping-tasks.json`, accompanied by `reports/catalog/shopping-task-index.csv` with `UNREVIEWED` rows. **Catalog membership is not proof of suitability**.

Six Shopping-only pilot candidates: 279, 284, 323, 436, 506, 528. Pilot creates all 48 model/method/task directories, but **no model run data** until the autonomous runner exists. The future command `npm.cmd run pilot:gate` reads official per-run evaluator outputs only.

The main experiment must use 32 other Shopping tasks. Do not collect main results until the runner, held-out screening, competence check and research freeze are finished.

## Troubleshooting

- If `docker info` fails: start Docker Desktop and confirm WSL2/Linux containers.
- If CLI download fails: check network/uvx installation; do not silently switch benchmark versions.
- If `prepare` rejects the public intent: stop, preserve logs and re-audit the pinned dataset instead of bypassing validation.
- If `inspect` times out: inspect website availability and Docker logs; do not edit task ground truth.
- Keep `output/`, `reports/` and `config/webarena.local.json` private/backed up; they are gitignored. HAR may contain authentication headers.

## After PoC: local model setup (not required to inspect task 284)

Only after PoC GO and a working model-driven runner exist:

```powershell
winget install --id Ollama.Ollama -e
ollama --version
ollama pull qwen3.5:9b-q4_K_M
ollama pull ministral-3:8b-instruct-2512-q4_K_M
ollama pull granite4.1:8b-q4_K_M
ollama run hf.co/Salesforce/Llama-xLAM-2-8b-fc-r-gguf:Q4_K_M
```

After the last command enters the model chat, type `/bye`, then check `ollama list`. Run only one model at a time on 16 GB RAM and check actual GPU/VRAM utilization before attempting batch experiments. Keep the four checkpoint names in `config/models.json` consistent with `ollama list`; freeze exact digests only after competence testing.

## Development-only agent episode after PoC inspection PASS

The command below requires a locally running Shopping Docker website, Ollama, a downloaded Q4_K_M model, and a successful public task export. It is not the six-task pilot or an unattended main runner:

```powershell
ollama list
npm.cmd run agent:run -- --stage poc --task 284 --model-label qwen3.5-9b --method Baseline --max-steps 16 --evaluate
```

A new method run requires the **Shopping persistent environment to be reset**, not merely Playwright restarted. The runner refuses to overwrite a previous method/model/task cell; preserve evidence before restarting. Results are stored in `output/poc/runs/<model>/<method>/284/`.

After approved live pilot episodes (not during initial setup):

```powershell
npm.cmd run results:export -- --stage pilot
```

The exporter creates `reports/pilot/run-inventory.csv`, `analysis-results.csv`, and `analysis-summary.md`. Upload the first two _sanitized CSVs_, not HAR, into `notebooks/thesis_analysis.ipynb` on Google Colab. See `docs/EVIDENCE_PROTOCOL.md`.
