# CUA Thesis: official BrowserGym + OpenApps

## 2026-10-20 Main v1 implementation: frozen study plan, execution NO-GO

Main code and the held-out roster are prepared on PR #8. This plan uses
**32 official OpenApps task IDs x four Ollama models x Baseline/CDEA
= 128 matched pairs / 256 planned episodes**. No Main study episodes have
been run. The researcher considers the live Pilot finished; local evidence
acceptance still needs a truthful recorded readiness sign-off, as CI alone
cannot verify live execution.

- Frozen roster: config/main_taskset_v1.json and docs/MAIN_TASKSET_V1.md.
- Preregistered hypotheses, primary bank cohort, budgets and validity:
  config/main_plan.json and docs/MAIN_PROTOCOL_V1.md.
- Readiness-gated runner: scripts/browsergym/main.py and run_main.ps1.
- Human readiness attestation template: docs/MAIN_READINESS_TEMPLATE.json,
  initially pending and all false. Real external evidence required.
- Offline CI tests: tests/test_main.py and tests/test_main_taskset.py. Green
  CI does NOT certify local Ollama/OpenApps execution or pilot authenticity.

Windows preparation (NO Main experimental episodes collected):

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -DryRun
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -CheckModels
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -AuditTasks
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -InitReadiness

After truthful, documented human review of all six evidence gates in
output/main/readiness_v1.json, the researcher can check their sign-off with:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -CheckReadiness

CheckModels saves offline/synthetic model reports under
output/preflight/main_models/. AuditTasks uses one isolated temporary
OpenApps server to check official task registration, initial evaluator
negatives, and read-only app routes; it saves a report under
output/preflight/main_suitability/. Neither command is a Main episode or a
substitute for live model/evaluator and CDEA mechanism evidence.

ALL FOUR Ollama checkpoints/digests must be installed and frozen before the first Main pair, even when using -ModelLabel for staged collection.

Do NOT run Main before every required check genuinely passes. Do NOT
resume an old Pilot ID using the newly changed controller commit: the
Pilot manifest pins its original Git SHA.


## Exploratory pilot v1 runner (local Pilot reported complete by researcher)

The study has now advanced from one-off matched DEVELOPMENT checks to
a **24-pair / 48-episode** exploratory pilot runner. The implementation
reuses the same matched Baseline/CDEA BrowserGym code and isolated initial
states; no changes were made to information-probe ranking. The 6 official
task candidates, 4 exact model labels, seed, budgets and all 24 fixed pair
orders are in config/pilot_plan.json. The pilot task shortlist is exploratory,
not evidence of method performance or a frozen set of 32 main tasks.

See docs/PILOT_PROTOCOL.md for scientific validity, staged execution,
immutable pilot manifest, digest locks and invalid handling.

Minimal Windows commands (with the pinned OpenApps checkout and uv installed):

    git pull --ff-only
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_pilot.ps1 -DryRun
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_pilot.ps1 -CheckModels -ModelLabel qwen3.5-9b

The actual pilot requires an **explicit** -Run and stable -PilotId:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_pilot.ps1 -Run -PilotId pilot_v1 -ModelLabel qwen3.5-9b -MaxPairs 1 -StopOnInvalid

Results, including blank/not-run and invalid outcomes, are written under
output/pilot/pilot_v1/manifest.json, results.csv, summary.csv, and
episodes/pair_001 ... pair_024. The researcher reports completion of
the local live Pilot; GitHub CI does not collect or authenticate those outputs.


**Status: Qwen official matched Baseline/CDEA Todo development pair succeeded with equal fresh-state hashes (2026-10-19). CDEA evidence-acquisition mechanism still untested; not pilot/main results.**

## Review outcome (2026-10-19): developer-ready, NOT experiment-ready

See docs/REPO_AUDIT_2026-10-19.md for verified evidence, limitations and
remaining research blockers. The Windows + Ubuntu CI compiles and runs
71 offline/simulated tests; it cannot verify live Ollama, Playwright or the
OpenApps banking HTML.

After git pull --ff-only, use these independent, less error-prone commands:

Read the latest paired trace WITHOUT another browser/model run:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\inspect_pair.ps1

Check one installed local model's shared JSON and BID actions WITHOUT OpenApps:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\check_model_compatibility.ps1

The compatibility check uses three synthetic public-AXTree decisions, prints
action-format validity, and separately warns if the model misses synthetic
targets or never generates two eligible probes. It does **not** count as
an official task or a successful CDEA comparison.

Both arms now revalidate the installed model digest before each episode and
receive the same public page route path (instead of different random local
server ports). The paired report includes an explicit mechanism status plus
token/AXTree diagnostic counters.

## Shared safety-action repair in development (2026-10-19)

A newer user-reported matched Qwen Todo pair (ID
`cab5013d6a17421b83ca93f2df478295`) confirmed both clean isolated
initial states but both arms stopped after one browser step at a safety
guard. Both official success flags were false; no probes occurred. The
guard source indicates a likely attempted empty Todo Add, but the exact
`guard_blocked` entry should be checked in the retained episode files.

The shared action validator now treats a guard-rejected action as eligible
for the SAME single same-observation repair already available to both
methods. No rejected Add, repeated click, or self-dock link is executed;
the model must select its own corrected visible BID/action. If it still
selects a blocked action, the run stops with an explicit diagnostic.
Previously rejected candidate actions can no longer remain in the
executable action variable after a failed correction. Windows and Linux
contract tests simulate both correction and fail-closed behavior.

This is a DEVELOPMENT controller change, not a formal result. It must be
frozen and independently validated before pilot/main.

## BrowserGym click timeout development fix (2026-10-19)

The user-reported OpenBanking DEVELOPMENT pair `eb6e44ecfb9e4832ba4e5a8c825c87ee`
ended as an invalid episode when a BrowserGym click on the visible
`Open an account` button (BID 20) timed out at 500 milliseconds.
The other arm did not run, so this is NOT evidence for/against CDEA.

The pinned browsergym-core 0.13.4 `click` function explicitly uses
`elem.click(..., timeout=500)` regardless of BrowserEnv default timeout.
The paired DEVELOPMENT runner now uses the official BrowserGym action
parser/environment/evaluator, but applies a narrowly scoped, audited
3,000-ms timeout to the generated `click` action for BOTH methods.
It never retries or forces a timed-out click because that may duplicate
a write action already applied by the app. Other BID actions are untouched.
The runner records the version, timeout and error category in artifacts
and refuses an unexpected BrowserGym version/source change.

This is a development controller adaptation (not an official upstream
default). It must be documented and frozen BEFORE pilot/main; its live
effect on OpenBanking has not yet been independently verified.

## OpenBanking dialog occlusion: root cause and DEV guard (2026-10-19)

A new local OpenBanking DEVELOPMENT attempt
`4d005cffea6641b382ea8bd60a84dc15` confirmed that retrying
the visible "Open an account" button at 3,000 ms does NOT resolve its
timeout. The Playwright log explicitly shows an open `<dialog>` subtree
(BID 141) intercepting pointer events. This is browser UI occlusion,
NOT a short-timeout issue. The upstream OpenApps source shows that
the button opens a read-only contact-information dialog with Close
controls; it is NOT the task's transaction ledger.

The shared development runner now detects ONE exposed accessibility
dialog and its current descendant BIDs using ONLY public BrowserGym
AXTree/extra_element_properties. It tells BOTH policies which current
dialog controls are visible, and rejects a background click/fill/press
BEFORE browser execution. The model gets the existing ONE identical
same-observation correction request, but the controller never automatically
closes the dialog, force-clicks, retries a click, or invents a BID.
Missing or ambiguous AXTree dialog information falls back to normal
execution and an explicit browser-error classification.

BrowserGym errors containing a dialog intercept are labeled
`browser_action_occluded_by_dialog`, remain invalid episodes,
and never become official task failures. This is a DEVELOPMENT controller
change, validated by simulated tests only; freeze it before pilot/main.
Even if navigation becomes reliable, CDEA is still unproven until
comparable information-probe decisions and policy divergences occur.

## OpenBanking no-op navigation and UI audit (2026-10-19)

Matched Qwen development pair `c312dda398474449a46bc2efbcacb8bb`
completed with equal initial states but BOTH arms spent all 20 steps
navigating between desktop and OpenBanking and clicking the inert
`Your accounts` heading. Both official rewards were zero and both had
ZERO generated probe menus or policy divergence. This is a model/controller
observability blocker, not evidence that CDEA loses/wins.

The printed trace contained no `Public clickable rows` hints. The pinned
OpenApps code implements account navigation as HTMX `div` rows with
`cursor: pointer`, not ordinary links. BrowserGym `isClickable` can
miss delegated HTMX events; public `set_of_marks=True` is a second
BrowserGym-provided sign of an actionable pointer target. The common
generic-row helper now accepts either positive marker, but only on a
nonignored, currently permitted AXTree BID with visible child text.
Exactly the same hints are available to Baseline and Proposed.

Instead of another 40 Ollama-driven browser steps, run a ONE-SERVER,
ONE-BROWSER-ACTION model-free audit from the thesis repo:

    git pull --ff-only
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\audit_public_ui.ps1

This emits `output/browsergym/ui_audit/<id>/ui_audit.json` and counts
the publicly marked account-like generic candidates, AXTree allowlist
coverage, and diagnostic public DOM HTMX targets. The raw DOM markers
are developer diagnostics ONLY; they are NOT given to either model
and do not create or promote model-visible BIDs. No Ollama or pilot
runs are started and no official task reward is reported.

If hints remain at zero but public DOM identifies HTMX rows missing
from the AXTree BID allowlist, stop before further agent runs and
investigate observation coverage. A change to the allowed observation
modality would need symmetric application and a frozen research protocol.

## Next: official OpenBanking information-acquisition development pair

With the existing Qwen3.5 model and Ollama active, from PowerShell in this repo:

    git pull --ff-only
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_matched_dev.ps1 -TaskGroup openbanking -Task add_todo_to_review_largest_card_charge -MaxSteps 20

The previous Qwen OpenBanking pair ended with reward=0 for both arms and
no information-probe divergence: both repeatedly chose the OpenBanking
launcher/dock link rather than a bank row. The shared controller now guards
against current-app root reloads and exposes labelled nonsemantic clickable
rows *only when BrowserGym marks them in its public AXTree/metadata*, with
URL-before/after diagnostics. This patch still needs live validation.

OpenBanking tasks are in the upstream **standalone** `config/tasks/openbanking.yaml`
group, not the default canonical `all_tasks`. Both methods get their own
isolated OpenApps database, common public BrowserGym AXTree/action budgets, and
initial SHA parity. The previous simple Todo pair showed **zero** information
probe opportunities; this new task checks real bank information retrieval.
It remains PoC/development only. Read docs/MATCHED_DEVELOPMENT.md for validity
criteria. Do NOT label these episodes pilot or confirmatory results.

The former custom TypeScript runner (Baseline/CDEA), tests, documentation and Git history are preserved at branch **archive/custom-openapps-runner-20261018** (commit c2fae213b203dc4899d3ee05958c9a66bb3ba6a2).

## Architecture

- **Models:** four planned local Ollama models in config/models.json.
- **Treatment:** Baseline vs CDEA is implemented in a new matched *development* runner, with a shared policy API; live treatment separation on eligible information tasks is pending.
- **Harness:** official OpenApps task registration with BrowserGym environment and official evaluator. The smoke implementation exercises this foundation on a single non-mutating browser action.
- **Benchmark:** OpenApps apps/tasks including OpenBanking and Todo. The 32 task IDs are now frozen; live task suitability and readiness checks remain pending.

## Windows smoke test

Prerequisite: pinned OpenApps checkout at HOME/OpenApps, commit **6e6782794433c60468d65ac75bc3f03c56007f8c**, uv, and Playwright Chromium. OpenApps and Ollama are separate; the no-op smoke **does not need Ollama**.

**PowerShell 1:** start OpenApps and leave running:

    cd "$HOME\OpenApps"
    $env:USER = $env:USERNAME
    $env:PYTHONUTF8 = "1"
    uv run launch.py

**PowerShell 2:** run the official adapter smoke:

    cd "$HOME\cua-constraint-agent"
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_official_smoke.ps1

The Python runner imports upstream OpenApps task registration, creates its BrowserGym environment, reads raw BrowserGym `axtree_object` using its official `flatten_axtree_to_str` formatter (raw `env.reset()` does not produce `axtree_txt`), executes one literal Python `pass` (no-op) action with the required `action_mapping=None` and per-episode `exp_dir` arguments, checks `last_action_error` and records the official reward to output/browsergym/smoke/. A reward of zero is normal for a no-op. An invalid episode is not counted as a model failure.

**Windows compatibility:** upstream launch_agent.py uses /bin/bash to spawn its own server and cannot directly run on native Windows. This repo's smoke instead uses an already-running OpenApps server and the official registration / environment / task evaluator from the OpenApps package.

CI runs static, dependency-free contract checks on Windows and Linux; **it does not validate a live OpenApps task or an Ollama agent**.

## Next step: Ollama preflight (no task actions)

With Ollama running and the selected Qwen model pulled, open PowerShell in the thesis repo:

    cd "$HOME\cua-constraint-agent"
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\check_ollama.ps1

This read-only check uses the exact tag in config/models.json, records the locally installed Ollama model digest and sends a harmless structured JSON test prompt to /api/chat. For Qwen3.5 it explicitly sends top-level `think: false` with a 256-token response budget to avoid spending the whole budget on hidden reasoning; this setting is only for the API preflight, **not yet** an experimental model-policy decision. On an empty answer, the error includes `done_reason`, `eval_count`, and the length of any thinking field (never the thinking text). It writes output/ollama/preflight/*.json. It does **not** use a browser, solve a task, or validate Baseline/CDEA performance. A model listed in config/models.json is not automatically installed by this repository.

## Real task development run: Qwen + BrowserGym

BrowserGym's one-action no-op smoke and the separate Qwen Ollama API preflight both passed on the Windows research PC. This **new** runner uses the official BrowserGym HighLevelActionSet, AXTree and OpenApps evaluator with Qwen decisions, but has not yet passed a live task episode.

1. Stop the previous OpenApps server with Ctrl+C. Start a **new** OpenApps server in its own PowerShell window, so the task uses a fresh session DB:

       cd "$HOME\OpenApps"
       $env:USER = $env:USERNAME
       $env:PYTHONUTF8 = "1"
       uv run launch.py

2. Keep that window running and Ollama active. In a second PowerShell window run:

       cd "$HOME\cua-constraint-agent"
       git pull --ff-only
       powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_qwen_dev.ps1

This runs a **single unpaired development task**, add_call_mom_to_my_todo, at most ten BrowserGym actions. The model only receives the public goal and current accessibility tree; it chooses constrained actions from visible element IDs. The official evaluator returns success; no expected solution is inserted into the model prompt. Development artifacts are written to output/browsergym/dev. A true/false score is only a diagnostic development outcome, **not** a Baseline/CDEA experimental finding.

The fresh-state flag is a manual attestation and does not automate reset or prove parity. Do not reuse the same OpenApps session for another model and do not run pilot/main experiments yet.

## Inspect the existing failed development run (no rerun)

A prior Qwen development episode reported `official_success: false` after nine actions, and official state comparisons showed an unexpected empty-title todo. The evaluator checks the **whole app state**, so extra items can prevent task success even when the requested item is present. The exact cause (e.g., early submit, repeated submit, or action sequence error) **cannot be determined from console diffs alone**.

Read the saved local action trace without rerunning anything:

    cd "$HOME\cua-constraint-agent"
    $r = Get-Content ".\output\browsergym\dev\82c2d289cddd467e8b9d5a12d94cfccf.json" -Raw | ConvertFrom-Json
    $r | Select-Object status, official_success, official_reward, steps
    $r.trace | Format-List step, action, official_reward, browser_error, model_error

Send the nine action entries before changing the policy or retrying. The next runs also print their action trace automatically.

## Dev runner diagnostic safeguards

The prior nine-action Qwen run clicked the same bid four times and later returned
false on the official evaluator. The old action-only trace cannot identify
what bids 226 and 22 represented. The dev runner now records public AXTree
role/name/value of selected elements and a developer-only todo-state delta
after each action, stops a third repeated click, blocks an empty Add submission,
and stops on an unexpected new empty-title todo or premature finish.
Private state is never sent to the model. These are development diagnostics,
not a Baseline/CDEA policy or valid main-experiment results. Start a fresh
OpenApps server before any new development run.

## Before experimental results

See docs/RESEARCH_GATES.md. Required next: live smoke result, automated isolated resets, official evaluator positive/negative cases, shared Ollama adapter and action space, matched Baseline/CDEA episodes, independent pilot and frozen 32-task main set. Do not mix archived runner episodes into official-harness results.
