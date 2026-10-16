# Windows setup from zero — Shopping-only study

This setup targets Windows PowerShell with RTX 5060 Laptop / 16 GB RAM. PoC inspection does not require Ollama; the **development agent runner** does. No live WebArena task success is claimed by repository CI.

## 1. Install tools

Open **PowerShell as Administrator**, install WSL2 and restart if prompted:

```powershell
wsl --install
wsl --update
```

Open fresh PowerShell; install Git, **Node.js 24+**, uv and Docker Desktop with WinGet:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id astral-sh.uv -e
winget install --id Docker.DockerDesktop -e
```

Start Docker Desktop in **WSL2 Linux-containers** mode; verify it shows Running. Reopen the terminal to refresh PATH.

```powershell
git --version
node --version
npm.cmd --version
docker info --format '{{.OSType}}'
uvx --version
```

Docker should print `linux`. On Windows, use `npm.cmd` and `npx.cmd` to avoid PowerShell execution-policy errors. The Shopping Docker image is large; allow tens of GB of disk space.

## 2. Clone or update

For a new device:

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

For an existing checkout use `git pull origin main` followed by `npm.cmd ci` and `npm.cmd run webarena:validate`. **Do not delete your local `output/` or `reports/` without backing them up first.** Old pilot stage manifests containing retired IDs 279/284/528 will be rejected—archive them rather than mixing protocols.

## 3. Start Shopping only

```powershell
uvx --from webarena-verified==1.2.3 webarena-verified env start --site shopping
uvx --from webarena-verified==1.2.3 webarena-verified env status --site shopping
Start-Process "http://localhost:7770"
```

This establishes the website, **not** that its persistent database has been restored to pristine state. See [RESET_PROTOCOL.md](RESET_PROTOCOL.md).

## 4. Inspect the **three distinct PoC tasks** (no LLM required)

```powershell
npm.cmd run artifacts:init -- --stage poc
npm.cmd run webarena:prepare -- --task 279 --stage poc
npm.cmd run webarena:inspect -- --task 279 --stage poc
npm.cmd run webarena:prepare -- --task 284 --stage poc
npm.cmd run webarena:inspect -- --task 284 --stage poc
npm.cmd run webarena:prepare -- --task 528 --stage poc
npm.cmd run webarena:inspect -- --task 528 --stage poc
npm.cmd run artifacts:report -- --stage poc
```

Each inspection writes `output/poc/<id>/inspection.json`, `inspection.har`, `screenshots/start-01.png` and `accessibility/01.yaml` plus a stage artifact index. Do not confuse `inspection.har` with the **actual agent** `network.har`.

Tasks: **279** Sony Bluetooth headphones names and price range; **284** least expensive shoe storage of ≥12 pairs; **528** refund contact form filled but **not submitted**. This PoC deliberately covers retrieval, navigation/comparison and form drafting; inspection and an actual evaluated agent episode must be checked separately.

Do not claim GO from inspection automatically.

## 5. Produce *public catalog* and screening reviews

```powershell
npm.cmd run webarena:catalog
npm.cmd run screening:init -- --stage poc
npm.cmd run screening:init -- --stage pilot
npm.cmd run screening:init -- --stage main
npm.cmd run screening:check -- --stage poc
npm.cmd run screening:check -- --stage pilot
npm.cmd run screening:check -- --stage main
```

**All rows initially show PENDING.** Edit the generated JSON review files with genuinely verified `decision`, `public_constraints` (≥3 actual requirements), `evidence_choices` (≥2 observed meaningful alternatives), eight checkboxes, `reviewer`, `notes`, and `evidence_files` pointing to real, nonempty evidence under the project directory. File locations:

- `reports/poc/poc-screening.json` (three PoC tasks)
- `reports/pilot/pilot-screening.json` (six pilot tasks)
- `reports/task-screening/main-review.json` (32 main candidates)

`screening:require -- --stage main` fails until **every** main candidate is reviewed PASS, public metadata matches the pinned catalog, and all required evidence exists. **Do not mark PASS just to unlock the program.** If the 32 fixed candidates cannot meet the rubric, consult the supervisor before collecting main outcomes.

`screening:init` refuses to overwrite previous reviews. Do not run `--force` on PoC inspections without intentionally archiving old evidence.

## 6. Development-only local agent on PoC (after inspection review)

After Docker Shopping works and Ollama is installed:

```powershell
winget install --id Ollama.Ollama -e
ollama --version
ollama pull qwen3.5:9b-q4_K_M
ollama list
npm.cmd run agent:run -- --stage poc --task 284 --model-label qwen3.5-9b --method Baseline --max-steps 16 --evaluate
```

Further models (run **one model at a time** on 16 GB RAM) from `config/models.json`:

```powershell
ollama pull ministral-3:8b-instruct-2512-q4_K_M
ollama pull granite4.1:8b-q4_K_M
ollama run hf.co/Salesforce/Llama-xLAM-2-8b-fc-r-gguf:Q4_K_M
```

Exit the last model chat with `/bye`. Check actual Ollama model names/tags; model names may need a documented preregistered adjustment **before pilot** if they do not exist. Repeat with task **279** and task **528**, evaluating genuine agent performance for each. The code supports only a single development episode per command and **has not been proven competent on the live Magento environment**.

## 7. Pilot preparation and result export — only after PoC GO

Pilot task IDs: **96, 323, 436, 506, 571, 689**. Review and approve all pilot screening rows, validate persistent reset, and get supervisor approval of the operational gate **before scores**.

```powershell
npm.cmd run artifacts:init -- --stage pilot
npm.cmd run webarena:prepare -- --stage pilot --task 96
npm.cmd run agent:run -- --stage pilot --task 96 --model-label qwen3.5-9b --method Baseline --max-steps 16 --pilot-approved --fresh-environment-confirmed --evaluate
npm.cmd run pilot:gate
npm.cmd run results:export -- --stage pilot
```

The runner checks that **both PoC and pilot screenings are approved** before pilot execution; the approval flags are only attestations, not an environment reset. All **48 episodes** require a future audited reset/run scheduling procedure. The gate remains FAIL until enough real, technically valid official results exist.

## 8. Main research freeze — deliberately not ready yet

After screening **all 32**, pilot GO, actual environment reset proof and supervisor signoff:

1. Build a private JSON file `config/model-digests.local.json` with four `{ "label", "name", "digest" }` entries matching the four configured models; each `digest` must be a real 64-hex SHA-256 from the local model store (Ollama `/api/tags` includes full digest).
2. Save verified reset evidence as a private nonempty file, e.g. `reports/pilot/reset-proof.md`. Do not invent the log.
3. Call the frozen protocol gate:

```powershell
npm.cmd run main:freeze -- --experiment-id thesis-v1 --model-digests config/model-digests.local.json --reset-evidence reports/pilot/reset-proof.md --approved-by "Supervisor" --approval-ref "approval-reference"
npm.cmd run artifacts:init -- --stage main --experiment-id thesis-v1
```

Replace approval fields with **actual** authorized information. This requires all three screening JSONs, official catalog, provisional pilot gate, exact model digests and genuine reset proof. It creates a research identity and directory scaffold, **not** a main 256-episode runner.

## 9. Google Colab / Bab IV

After valid official pilot outputs:

```powershell
npm.cmd run results:export -- --stage pilot
```

Upload **only sanitized CSVs** (`reports/pilot/run-inventory.csv`, `reports/pilot/analysis-results.csv`) to `notebooks/thesis_analysis.ipynb` in Google Colab. Empty/invalid runs do not become task failures, and main paired statistics remain blocked until all 256 official rows are complete.

Stop Shopping when finished:

```powershell
uvx --from webarena-verified==1.2.3 webarena-verified env stop --site shopping
```

**Never publish raw `network.har`, `inspection.har`, session cookies, personal order data, or live credentials.** Preserve local output/report folders with backups; they are gitignored.
