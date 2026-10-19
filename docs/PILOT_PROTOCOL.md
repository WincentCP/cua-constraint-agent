# Pilot v1: exploratory matched BrowserGym/OpenApps experiment

## Status and why this is a pilot

Pilot orchestration is implemented. **NO local live pilot has been run by CI.**
The pilot is intended to discover failure modes, invalids, model compatibility,
information-acquisition opportunities and whether CDEA's reranker is ever
exercised. It is NOT confirmatory evidence and must not be presented as main.

Stop fixing individual model mistakes between pilot episodes. Every change to
the controller, prompt, candidate generator, retry policy, method, budget or
task list AFTER the first actual pilot pair requires a NEW pilot ID and a
documented protocol revision. Never merge exploratory pilot with main results.

## Fixed candidate plan (official pinned OpenApps task keys)

`config/pilot_plan.json` contains these six *provisional pilot candidates*
chosen by task type before observing new pilot outcomes:

| # | Group | Task | Role |
| - | - | - | - |
| 1 | all_tasks | add_call_mom_to_my_todo | Writing-only task; control for agent/action path |
| 2 | all_tasks | mark_water_plants_as_done | Read/select existing task; control |
| 3 | longer_horizon | plan_elena_birthday_todo_message | Two-app composite |
| 4 | openbanking | message_bob_the_savings_balance | Read balance, then message |
| 5 | openbanking | add_todo_for_the_card_minimum_payment | Read card information, then write |
| 6 | openbanking | add_todo_to_review_largest_card_charge | Scan ledger for a charge, then write |

These 6 task *IDs* are not six repeated prompt variants. The plan spans three
official Hydra task groups. Eligibility for meaningful two-option probes has
NOT been established in live runs; zero opportunities are legitimate pilot
findings, not grounds for deleting a task after scoring. This pilot set must
remain distinct from the later *independently selected* 32 main task families.

Four exact model labels from `config/models.json`:
`qwen3.5-9b`, `ministral3-8b`,
`granite4.1-8b`, `xlam2-8b`.

**6 tasks x 4 models x 2 methods = 24 matched pairs / 48 episodes.**
Fixed seed 233; max 20 BrowserGym steps *per arm*; Ollama model
timeout 240 s *per call*, temperature 0, think false and 640 maximum
prediction tokens. Stable counterbalanced paired order determined before
running any episode from task/model/seed hash. Both methods get equal public
observation, validation, click timeout and one bounded model-action repair.

Official browser reward is read only by the evaluator and after action
execution; only public goal and public BrowserGym observation are available
to the model. Baseline picks the model's high generic progress-scored
information probe, while CDEA ranks the *same* eligible candidates by
unknown public-constraint coverage then estimated forward cost.

**Scientific limitation:** candidates and coverage/cost are supplied by the
model itself. When it never emits at least two eligible information probes,
both policies share the ordinary model action. This is a treatment
non-engagement problem, not evidence that one method is superior.

## Prerequisites and low-cost checks

Use Windows PowerShell from the thesis repo. Requires pinned `$HOMEOpenApps`,
`uv`, correct BrowserGym/Chromium, local Ollama and models installed.
Do NOT run old matched development artifacts as pilot.

First update source and validate all SIX official task IDs using Hydra,
without starting a browser or calling any model:

    cd C:\Users\Administrator\cua-constraint-agent
    git pull --ff-only
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_pilot.ps1 -DryRun

Then check FOUR exact model tags and digests without Chromium:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_pilot.ps1 -CheckModels

The four-model check will fail clearly if any configured model is absent.
To start with only an installed Qwen, do an explicit staged check:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_pilot.ps1 -CheckModels -ModelLabel qwen3.5-9b

`-DryRun` does not create pilot outputs. `-CheckModels` calls the
Ollama /api/tags endpoint but does NOT launch the model for inference.

## Running and resuming the exploratory pilot

Start with ONE new paired **pilot** task (both arms, same frozen plan).
This is a pilot episode, not a separate cherry-picked development round:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_pilot.ps1 -Run -PilotId pilot_v1 -ModelLabel qwen3.5-9b -MaxPairs 1 -StopOnInvalid

If that pair is recorded, finish remaining Qwen pairs without revisiting it:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_pilot.ps1 -Run -PilotId pilot_v1 -ModelLabel qwen3.5-9b

Then run the other three configured models when installed. You can use
`-ModelLabel ministral3-8b` (similarly Granite and xLAM), or
omit `-ModelLabel` to complete all remaining scheduled pairs:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_pilot.ps1 -Run -PilotId pilot_v1

One invocation need not execute 24 pairs; the fixed manifest still lists
all 24, and result files have all 48 planned episode rows. All runs require
an explicit `-Run` and stable `-PilotId` string.

**Never start two processes with the same PilotId at once.** A lock protects
against simultaneous writers. If the machine crashes, verify no process is
running before deleting a stale `.pilot_running.lock`. If an
unfinished pair directory lacks `pair.json`, the runner
stops rather than erasing/retrying the uncertain execution. Archive it and
document the interruption; never relabel it as a model task failure.

An attempted pair with an invalid arm receives a `pair.json` and
is not retried automatically. If any infrastructure issue undermines a run,
document it separately and plan a new pilot ID; do not selectively redo only
unsuccessful tasks under the original pilot ID.

## Output files (small and auditable)

    output/pilot/pilot_v1/
      manifest.json             # immutable protocol, task/model schedule, code SHA
      model_digests.json        # first-seen checkpoint digest lock per model
      results.csv               # exactly 48 planned rows (method x pair)
      summary.csv               # by-model and overall paired-valid metrics
      episodes/
        pair_001/
          pair.json             # parity, outcome, probe diagnostics, errors
          Baseline/episode/episode.json
          Proposed/episode/episode.json
          Baseline/episode/browsergym/  # official logs, traces
          Proposed/episode/browsergym/
          Baseline/server/               # isolated server and database
          Proposed/server/
        ...pair_024/

Technical logs remain nested alongside their episode and excluded via
`.gitignore`; they are NOT required to be put in Git.

The manifest locks the exact controller commit, pinned OpenApps SHA,
model names, initial task set, order, seed, and budget. Resuming with a
different commit/task/model file fails before running a new episode.
A separate digest lock requires each model checkpoint to remain constant
across its own pilot pairs. Pair arms recheck the model digest too.

## Interpret results correctly

- **Not started:** future pair has two `not_run` rows and no reward.
- **Valid paired failure:** both arms complete and evaluate to reward 0; success
  0 counts legitimately in the denominator.
- **Invalid/incomplete pair:** if either arm errors, loses model contract, has
  mismatched initial state or fails BrowserGym, neither arm enters the paired
  success-rate denominator. The raw episode JSON and any observed reward are
  retained without converting missing/not-run episodes to task failures.
- **Valid pair:** both arms complete official BrowserGym episodes, same initial
  state and the frozen checkpoint. Success rate is success/valid paired pairs.
- **Reporting:** always show the total 24 scheduled pairs, valid count, invalid
  count and not-started count. An empty valid denominator is blank, not 0%.
  Report by-model Baseline/Proposed success separately, then probe
  opportunities, comparable probe decisions, and action divergences.
- **Non-engagement:** if comparable probes and divergences remain zero, the
  planned method comparison is not yet causally informative. That does NOT
  invalidate running or reporting the exploratory pilot; it tells us what
  design decision is required before freeze/main.

`results.csv` contains both `official_success_raw` and
`paired_analysis_success`, but only the latter is used for paired
success summaries. Do not count invalid or missing arms as zeros, and do
not claim pilot superiority on the basis of a small or selected subset.

## What this implementation deliberately does NOT do

No automatic retries of invalid pairs, no task selection based on observed
success, no hidden server-state access for the decision policy, no synthetic
probe injection, no policy advantage shortcut, no graphs/Excel/Notebook
in the execution loop, and no main-experiment orchestrator yet.

GitHub CI verifies deterministic scheduling, validity denominators, digest
and manifest immutability, atomic CSV publication, resumability, and
simulated pilot artifacts on Windows and Linux. **CI does not run local
Ollama, OpenApps or Chromium.** The user's first live pilot run remains
the meaningful acceptance test.
