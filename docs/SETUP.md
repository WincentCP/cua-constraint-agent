# New-device setup

## 1. Clone and install

```powershell
git clone https://github.com/WincentCP/cua-constraint-agent.git
cd cua-constraint-agent
npm ci
npx playwright install chromium
```

Install and verify Docker Desktop, `uvx`, and optionally Ollama:

```powershell
npm run webarena:doctor
```

## 2. Create local WebArena configuration

```powershell
Copy-Item config/webarena.example.json config/webarena.local.json
```

`config/webarena.local.json` is gitignored.

## 3. Validate committed research scaffolding

```powershell
npm run webarena:validate
```

Expected state:

- primary PoC task = 284;
- pilot task IDs = 284, 323, 493, 523, 552, 562;
- four pre-registered local model candidates;
- no main experiment freeze yet.

## 4. Start the environment for task 284

```powershell
uvx webarena-verified env start --site shopping
uvx webarena-verified env status --site shopping
```

Shopping uses `http://localhost:7770` by default.

## 5. Export official task input

```powershell
npm run webarena:prepare -- --task 284
```

The official CLI renders benchmark URL placeholders using `config/webarena.local.json`. The agent receives public task metadata only.

## 6. Inspect the task before agent integration

```powershell
npm run webarena:inspect -- --task 284
```

Review:

```text
output/pilot/284/inspection.json
output/pilot/284/accessibility-1.yaml
output/pilot/284/network.har
```

Do not treat initial hint mapping as ground truth.

## 7. Stop environment

```powershell
uvx webarena-verified env stop --site shopping
```
