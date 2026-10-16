# Artifact layout and audit indexes

`output/` stores raw machine-readable evidence; `reports/` stores derived indices, sanitized analysis exports, manual screenshots/reviews and gate reports. Both are **gitignored**; back up your laptop's results separately. `inspection.har` is not an evaluated agent trace, and no generated screenshot is a task-success score.

## Stage structure

```text
config/
  poc-tasks.json             # 3 PoC IDs: 279, 284, 528
  pilot-tasks.json           # 6 different pilot IDs: 96, 323, 436, 506, 571, 689
  main-candidates.json       # 32 fixed, UNSCREENED candidate IDs

output/poc/
  stage-manifest.json
  task-inputs/{279,284,528}.json
  <task-id>/
    accessibility/01.yaml
    screenshots/start-01.png
    inspection.json
    inspection.har
  runs/<model>/<baseline|proposed>/<task-id>/
    run_metadata.json
    trace.jsonl
    accessibility/0001.yaml
    screenshots/{initial,decision-0001,final}.png
    agent_response.json
    network.har
    eval_result.json          # only if official evaluator was invoked

output/pilot/
  stage-manifest.json
  task-inputs/<task-id>.json
  <task-id>/inspection.json
  runs/<model>/<baseline|proposed>/<task-id>/...
output/main/<experiment-id>/
  research-freeze.json       # must pre-exist before main scaffold
  stage-manifest.json
  runs/<model>/<baseline|proposed>/<task-id>/...
  summary/

reports/poc/
  poc-review.md
  poc-screening.json         # created PENDING; edit only after live evidence
  poc-candidates.csv
  artifact-index.{json,csv}
  stage-summary.md
reports/pilot/
  pilot-screening.json       # 6 PENDING rows until human review
  pilot-candidates.csv
  task-screening.csv
  pilot-gate.{json,md}
  pilot-run-index.csv
  run-inventory.csv
  analysis-results.csv
  paired-first-decisions.csv
  artifact-index.{json,csv}
reports/task-screening/
  main-review.json           # 32 PENDING rows
  main-candidates.csv
  main-screening-check.json
reports/main/<experiment-id>/
  artifact-index.{json,csv}
  run-inventory.csv
  analysis-results.csv
  paired-first-decisions.csv
```

Some files are generated only after the corresponding CLI is run, and no `eval_result.json` exists without an official benchmark evaluation. The development runner is **one-task-at-a-time**, and main batch execution is **not implemented**.

## Commands and evidence boundaries

```powershell
npm.cmd run artifacts:init -- --stage poc
npm.cmd run webarena:prepare -- --stage poc --task 284
npm.cmd run webarena:inspect -- --stage poc --task 284
npm.cmd run webarena:catalog
npm.cmd run screening:init -- --stage poc
npm.cmd run screening:init -- --stage pilot
npm.cmd run screening:init -- --stage main
npm.cmd run screening:check -- --stage main
npm.cmd run artifacts:report -- --stage poc
npm.cmd run results:export -- --stage pilot
```

Pilot init is possible after manually approved PoC eligibility, but executing approved pilot episodes additionally requires validated reset and screening. Existing pilot output from the previous 279/284/528 overlap protocol is **not compatible** with the current pilot and must be archived (never mixed).

`main:freeze` requires **all 41 task reviews** approved, real pilot operational gate, exact digests and supervisor approval, plus genuine reset proof. Main scaffold or main CSV export refuses absent/outdated freeze.

`pilot:gate` is **FAIL** without evaluated episodes; `results:export` keeps missing official results **NULL**, not zero. The optional paired-first-decision diagnostic can show method disagreement but cannot prove evidence correctness.

For Bab IV/Colab, use only sanitized `run-inventory.csv` and `analysis-results.csv`. Keep all HAR, session headers, passwords, screenshot originals and evaluator internal details private. See [EVIDENCE_PROTOCOL.md](EVIDENCE_PROTOCOL.md) and [RESET_PROTOCOL.md](RESET_PROTOCOL.md).
