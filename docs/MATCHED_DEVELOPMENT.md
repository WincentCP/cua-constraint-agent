# Matched Baseline/CDEA development — not pilot/main data

## Live Qwen matched Todo checkpoint (2026-10-19)

User-reported Windows pair `9e6c49d077dc4475a5ddbb5f95b2fc9d` completed
both methods with official success True and matching initial hashes. Baseline
used 3 actions and 3 model calls. Comparable probe decisions = 0, policy
action divergences = 0. Thus the pair validates matched execution, **not**
CDEA's information-acquisition mechanism.

## Next: first OpenBanking information-acquisition task

The pinned upstream OpenApps repository keeps `config/tasks/openbanking.yaml`
as a standalone Hydra task group; it is **not** part of `tasks=all_tasks`
(the canonical default tasks). Select it explicitly:

    git pull --ff-only
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_matched_dev.ps1 -TaskGroup openbanking -Task add_todo_to_review_largest_card_charge -MaxSteps 20

This official OpenBanking extension task requires inspecting a bank account's
card transactions, selecting the largest charge, then writing a Todo. It is
**PoC/development only** and is NOT a frozen pilot or confirmatory main task.
Both arms use the same 20-step budget and separate clean OpenApps instances.
Successful task completion is not guaranteed, and true CDEA suitability still
requires at least two substantive information-acquisition alternatives.
For a later harder alternative, `-Task reconcile_the_largest_account` requires
cross-account comparison plus two follow-on app edits.

## Observed Qwen OpenBanking development failure (2026-10-19)

User-reported paired episode `52e1e3ff2cec4c6aab7daedf1d84c3a4`:
both methods scored official reward 0.0 with no probe opportunities. Both
trajectories selected OpenBanking dock/launcher links in the order
`click("64")`, `click("96")`, `click("96")`, then the fourth identical
click was blocked by the pre-existing three-consecutive-click guard. The
trace did not preserve per-action URLs, so it alone does NOT prove that
`click("64")` reached `/openbanking`; inspect the new URL diagnostics.

The pinned upstream OpenApps source shows that the desktop shell **and the
persistent cross-app chrome dock** both include a link named OpenBanking.
The account-index rows themselves are visible `div[hx-get]` controls
without a semantic link/button role. BrowserGym can click a generic
element BID when it has been assigned one, but Qwen may not recognize it
from a bare generic accessibility entry.

Shared development adapter changes (both Baseline and Proposed):

- The currently observed page URL and accessible link name may identify a
  redundant click on the same app's ROOT dock link. Such an action is
  rejected before browser execution and uses the existing ONE shared model
  correction allowance; it does not auto-navigate, substitute a BID, grant
  extra steps, or make a privileged API call. Clicking from desktop to the
  app is allowed, as is an app-detail back-link to the app root.
- `public_ui.clickable_generic_hints()` uses **only BrowserGym public
  axtree_object and extra_element_properties** to describe visible,
  clickable generic containers via their public descendant accessibility
  text. Each displayed BID must already exist in the current AXTree
  allowlist. No HTML attribute, bank database, account ID, target answer,
  evaluator config or invented bid is exposed. If BrowserGym does not
  identify a row as clickable, no hint is invented; the row will need
  separate live inspection.
- Every executed action logs URL before/after, whether it changed, and
  whether the public AXTree text changed. This distinguishes a dock reload
  from actual navigation into a bank account and helps locate missing
  accessibility affordances without wasting another model run.
- The symmetric simulated regression reproduces OpenBanking root + dock
  and tests rejection of the self-link, repair to a generic bank row and
  subsequent official BrowserGym click. Simulated behavior is NOT proof
  that the live website supplies matching clickable metadata.

This remains a controller development patch, not a policy performance
result. It must be frozen *before* formal pilot/main runs.

## Matched Qwen Todo safety-guard checkpoint (2026-10-19)

New local matched pair `cab5013d6a17421b83ca93f2df478295` returned
`paired_development_completed` with initial-state parity PASS. Both
methods executed one browser action (two model calls total per arm),
then ended `safety_guard_blocked`, official success False, with zero
probe opportunities. Since three repeated consecutive clicks require
at least two prior browser actions, the likely guard was
`empty_todo_submission`; the saved episode JSON must still be consulted
for the actual attempted second action.

The DEV controller now includes BOTH safety guards in the one-repair
shared public observation/action validator, not only JSON/BID and dock
checks. This is symmetric for Baseline and CDEA. The model itself must
choose the correction (typically `fill` on a current public textbox);
the code never substitutes a guessed BID or inserts the expected Todo
title. A repeat guard rejection ends without executing the action.
The candidate action is assigned to the executable slot ONLY after all
parsing and guard checks pass; this fixes a rejected-action retention
bug after two failed attempts.

The two-arm regression covers premature Add -> successful model-selected
fill; repeat premature Add -> safe stop; and repeat current-app dock
link -> no stale action executed. These are synthetic CI tests, NOT
live post-fix acceptance or evidence of CDEA benefit.

## New low-cost compatibility and artifact inspection gates

After git pull --ff-only, before spending time on another live pair:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\inspect_pair.ps1

This summarizes the most recent paired JSON report without starting Ollama,
OpenApps or Chromium; no hand-written PowerShell variables or JSON parsing
needed. To inspect a nonlatest pair use -PairPath followed by its pair.json
file path.

When evaluating a newly installed model (including the existing Qwen):

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\check_model_compatibility.ps1

For another ALREADY installed configured model:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\check_model_compatibility.ps1 -ModelLabel ministral3-8b

The synthetic preflight uses normal Ollama JSON action format, exactly the
shared public goal/constraint/AXTree prompt API, the same 640-token output
ceiling and bounded single-step correction policy. It tests fake navigation,
a Todo textbox and a two-option information-acquisition opportunity. It
validates the **action interface**, not actual app solvability. Target
correctness and whether it created a probe menu are reported separately and
are NOT reasons to cherry-pick better-outcome models.

The paired runner also rechecks the model name/digest before EACH arm,
strips the random localhost port from the **model text only**, records
per-step URL before/after, AXTree lengths/truncation and available Ollama
prompt token counters, and reports the explicit mechanism status:

- no_probe_candidates: neither arm invoked a two-option probe decision;
- no_comparable_probe_decisions: menus arose, but at different observations;
- same_actions_at_comparable_probe_decisions: both picked the same probes;
- policy_separation_observed: the two policies chose different probes at
  equivalent public menu/observation; this is only evidence the policy was
  exercised, NOT that CDEA improves task success.

Even if both arms have official reward 1.0, zero comparable probe decisions
is a RESEARCH BLOCKER for any claim about CDEA effectiveness.

## One-command Windows validation

From the thesis repository, with Ollama running:

    git pull --ff-only
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_matched_dev.ps1

No manually launched OpenApps server is needed. For another installed model:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_matched_dev.ps1 -ModelLabel 'ministral3-8b'

The exact four model labels are in config/models.json. A single Qwen pair
does not require all four models to be installed. The runner checks Ollama
model tag and digest before starting BrowserGym.

## Shared policy and action boundary

- SAME official OpenApps task/public goal, AXTree observation, allowed bid
  actions, model and digest, temperature=0, think=false, JSON action format,
  num_predict=640, max_steps=16, seed=233 and timeout in both arms.
- SAME system and user prompts for both methods, and the same public
  constraints derived from literal fragments of the public goal. Same
  candidate list and model-scored progress / cost / may_answer metadata.
- Baseline ranks information probes by the model's generic progress score,
  tie-breaking in stable discovery order.
- CDEA ranks those same information probes by unresolved public-constraint
  coverage, then estimated forward cost, then stable discovery order.
- Reranking occurs ONLY when the model explicitly reports at least TWO
  eligible public information-inspection candidates; otherwise both use the
  primary model action unchanged. Fake bids, textboxes as probes, malformed
  candidates and unknown constraint IDs cannot be selected as probe actions.
- Model-supplied probe labels, coverage and costs are HEURISTICS, not
  independently verified evidence. Tentative evidence ledger entries require
  exact quote matches in the current public AXTree and are explicitly marked
  as unverified correctness. No private state, expected answer, official
  reward or evaluator database is passed into the model context.
- The simple "Call Mom" task generally has no genuine acquisition choices.
  The matched Todo pair proves execution parity, NOT CDEA causal advantage.
  A real information-acquisition task must later show treatment separation.

## Pair validity and artifacts

- A seeded SHA-based method order is fixed before seeing results, making
  the run order reproducible and counterbalanced across task/model/seed.
- Each method gets its own isolated OpenApps process, database, and
  BrowserGym context; initial SHA-256 cross-app state must be identical,
  including the evaluator's initial observation. Mismatch aborts the pair.
- Same safety guards and per-step action/error logging in both arms.
- For a malformed or unobserved model action, BOTH methods get at most ONE
  identical public-only repair request at the SAME browser observation; no
  invalid bid is ever executed or substituted. It uses the current observed
  bid allowlist, not a private target. A second invalid response ends as an
  invalid agent episode with official_success=null and ZERO action steps if
  invalid from the first step.
- Both arms share the same model-call ceiling: at most two calls per browser
  decision (initial + at most one repair). Model call count, rejected bids,
  allowed bid sample, model output SHA, invalid-action count, repair requests,
  repaired steps, and latency are logged for auditing.
- The shared prompt now contains no concrete sample element IDs or task
  answers (such as bid 40 or Call Mom), reducing model copying errors.
- These development repairs are part of the shared controller policy, NOT
  task retries: no server reset or selective per-method replay occurs. Freeze
  the repair rule and disclose extra model cost before the actual pilot.
- Report a completed unsuccessful agent task separately from an invalid
  parser, browser or evaluator run. Neither side is rerun selectively.
- Results: output/browsergym/matched_dev/<UUID>/pair.json, plus separate
  method/episode/episode.json and method/server/server.log files.
- Every pair is DEVELOPMENT ONLY; results must not be counted among the
  intended 48 pilot or 256 main experiment episodes.
- CI runs syntax and synthetic contract tests on Windows and Ubuntu; it
  cannot run your local OpenApps + Ollama setup and must not be described as
  live proof.

## Remaining gates before pilot/main

1. **DONE (Qwen Todo development pair):** paired Baseline vs CDEA reward=1 for both with matching initial hashes. No probe opportunity on this task.
2. Verify all four exact model/digest/JSON action formats through matched
   development runs. Freeze shared prompt, action budget and policy settings.
3. Run at least one eligible information-acquisition task with TWO meaningful
   alternative probes and observe whether treatment decisions can diverge.
4. Screen independent six-task pilot and genuinely eligible 32-task main
   families. The planned task counts are conditional: do not treat variants
   or paraphrases of one family as independent tasks.
5. Freeze intervention, model identities, action space, prompt, retries,
   task selection and analysis before inferential runs.

Reference: docs/RESEARCH_GATES.md and the archived design at
archive/custom-openapps-runner-20261018/docs/EXPERIMENT.md.
