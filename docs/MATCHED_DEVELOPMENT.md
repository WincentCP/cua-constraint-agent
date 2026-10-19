# Matched Baseline/CDEA development — not pilot/main data

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

1. Qwen live paired Baseline vs CDEA outcome and reset parity on Windows.
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
