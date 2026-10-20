# Main Experiment v1 — preregistration and readiness-gated orchestration

**Protocol frozen:** 2026-10-20. **Status: main code and design prepared, Main execution NOT authorized.** These instructions describe a planned study, not results. The researcher reports the live Pilot is completed and accepted. This repository cannot independently authenticate local Pilot execution from its CI; the recorded Pilot close-out evidence and any limitations still belong in the human readiness review.

## Research question and preregistered outcomes

**Question:** Does the Constraint-Driven Evidence Acquisition (CDEA) probe reranker improve official OpenApps task success relative to the paired Baseline with the same model, public observation, candidate probe menu, validation and available actions, particularly when information must be retrieved before acting?

- Primary cohort: exactly five official OpenBanking read-before-act task IDs, with four model checkpoints each. **20 matched task/model pairs planned.**
- Primary endpoint: binary **official BrowserGym task completion**. A paired success delta on valid bank pairs equals (Proposed-only successes minus Baseline-only successes) divided by the number of valid bank pairs. Report the full 2-by-2 outcome table and all 20 planned/valid/invalid/not-started units.
- Null hypothesis: on bank tasks, the probability of a Proposed-only success equals the probability of a Baseline-only success. The alternative is unequal discordant probabilities; a positive Proposed delta is substantively desirable.
- Inferential sensitivity: **two-sided exact McNemar** with exploratory alpha 0.05, released only after the whole 128-pair schedule has been attempted. The p-value is **unadjusted, not cluster robust**, and cannot by itself substantiate population-level superiority. Only five bank task IDs share one OpenBanking seed/accounts and each is evaluated on four models; effective independent information is limited. No statistical power justification exists for this sample size.
- Primary diagnostics: by-task and by-model effects, actual candidate information-probe opportunities, comparable public decisions on matched probe sets, and action divergences. Information retrieval does not automatically imply two eligible probes.
- Secondary cohorts: all 32 task IDs together, 18 longer-horizon workflows and 9 original controls. Report paired success differences, planned/valid/invalid/not-started coverage, successful-episode steps and latency, repair and invalid action counts, and reranking engagement.
- Zero comparable probes or zero action divergences makes the claimed CDEA mechanism **untested**, regardless of apparent successful task completions. Examine traces for real causal relevance, rather than inferring it from CSV alone.
- Main is a benchmark over **32 different official task IDs**, not 32 independent task-generating environments. Shared application templates, contacts, seeded accounts and models create dependence. Do not generalize to all CUAs from this single source.

The confirmatory target and any exploratory p-value must not be changed after looking at Main outcomes. If the effect is negative or near zero, that is a valid result.

## Immutable design and treatment

- Frozen task roster: config/main_taskset_v1.json. Ordered group/task SHA-256: 73d4a4a8e377422072c6ab27c066f87f8acbed7683ed50168c3407c861d61333.
- Official OpenApps source: facebookresearch/OpenApps pinned at 6e6782794433c60468d65ac75bc3f03c56007f8c.
- Distinct Pilot task IDs excluded. No wording-only variations counted as independent tasks.
- Four model labels: qwen3.5-9b, ministral3-8b, granite4.1-8b and xlam2-8b. All four configured model tags MUST be installed and their exact digests pinned in the immutable Main manifest **before the first pair**, even when collecting only one model in a staged invocation. Recheck digests before each arm.
- **32 tasks × 4 models × 2 methods = 128 pairs / 256 episodes.** All pairs are prescheduled by SHA-256 sorting on seed/task/model, independent of observed outcomes. The two method arms have a predetermined pair order.
- Seed 233. **40 BrowserGym steps per method arm**, rather than Pilot's 20, due to 3–4-subtask Main workflows. Ollama time limit 240 s per call, temperature 0, think false, 640 predicted tokens, BrowserGym bid/nav action subsets, one shared same-observation action repair, no forced click retries.
- Both arms share the same official evaluator, model checkpoint, initial application-state SHA, action/parser/guard code, observation budget and prompt schema. The sole treatment is Baseline's general progress-based ranking versus CDEA's constraint coverage and forward-cost ranking **over the same eligible model-supplied information probes**.
- Fresh isolated OpenApps server and unique owned database per arm. Official evaluator rewards are never put into the agent prompt or used to choose actions.
- The first approved Main run pins the clean thesis controller Git commit, official OpenApps SHA, entire immutable schedule, model-config SHA, plan SHA, taskset SHA, Pilot-exclusion-plan SHA, readiness approval/evidence hashes, shared budgets and statistical analysis. All four checkpoint digests are frozen before the first pair, not on first use.
- Changes to any fixed task, model, prompt/controller, budget or analysis protocol require a new study version and fresh ID, not a silent overwrite.

## Paired validity, missingness, and research integrity

A pair is **valid** only when both original official Main episodes completed, the agent/runtime validity fields are true, official success is a boolean consistent with actual numeric official reward, both arms share the initial-state hash, each has a distinct owned database, method order follows the freeze, both match pinned code/protocol/model, and recomputed trace probe diagnostics match the saved pair diagnostics.

A valid failure with official reward zero **counts as a real unsuccessful episode**. An invalid/incomplete arm makes its pair invalid; **both arms are excluded** from valid-pair success denominators while all raw results remain available. A never-attempted pair remains **not_started**, not an imputed failure. A crashed, unsealed pair folder is retained and **never automatically rerun**. Do not selectively redo negative outcomes, hide invalids, or alter the denominator.

The runner writes a manifest, checkpoint digest registry, 256-row results CSV, 128-row pair CSV, 40-row cohort/model/method summary CSV and primary analysis JSON. Inference is withheld during partial/staged runs. Once all pairs have terminal completed/invalid states, the analysis JSON permits the **exploratory** exact McNemar calculation, alongside mandatory coverage. Manual trace review is still required before interpretation.

The lock file prevents parallel writers. A crash may leave a lock and an unsealed pair; archive and inspect before any attempt to recover. Failure exit codes should not be reinterpreted as task failures, and a successful CLI exit is never automatically a scientific GO.

## Six mandatory independent GO gates before any Main episode

**The readiness approval is a human attestation tied to specific evidence files; source code cannot establish that evidence is authentic.** See docs/MAIN_READINESS_TEMPLATE.json. The initial template is deliberately status=pending, with all checks false. Do not switch any check to true without genuine evidence.

| Gate ID | Required human-verifiable live/source evidence |
|---|---|
| pilot_provenance_verified | Existing Pilot close-out evidence accepted by the researcher, original source references and a documented provenance/limitations note; this review is a human attestation, not a CI-generated claim of independently verified live execution |
| official_evaluator_controls_passed | Real positive and negative official evaluator controls, with reset and isolation parity |
| four_model_live_compatibility_passed | All four exact model digests and live model action/BID/BrowserGym compatibility beyond synthetic test cases |
| cdea_mechanism_verified | Real same-observation eligible probe comparison and at least one CDEA-vs-Baseline policy-action divergence, with reviewed public trace |
| all_main_tasks_suitability_screened | Official pinned Hydra IDs, evaluator applicability, public UI accessibility, and source-based suitability screening before Main outcomes |
| statistical_protocol_preregistered | Signed review of the frozen task IDs, budgets, primary/secondary endpoints, invalid rules and inference limitations |

If any check fails, **NO-GO**. A successful offline test or a summary alone cannot replace an honestly recorded human evidence decision.

After a documented review, use -InitReadiness to create a **pending** JSON file under gitignored output/main. It autofills only the final controller Git SHA and public freeze identifiers; **all six checks are still false**. Populate approved_by, UTC approved_utc, and each check with a truthful passed flag and the path to genuine existing evidence. Relative evidence_path values are interpreted relative to the readiness JSON file's directory, not the shell's working directory. The runner SHA-256-hashes the approval and referenced files but cannot judge their scientific authenticity. The approval file and referenced evidence must remain byte-identical across any same-ID resumption.

## Execution instructions for Windows PowerShell

From the thesis repository (with pinned HOME/OpenApps, uv, local Ollama, BrowserGym/Chromium):

Pre-Main checks that **collect no Main research episodes**:

    python -m unittest discover -s tests -v
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -DryRun
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -CheckModels
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -AuditTasks
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -InitReadiness

DryRun checks 32 official Hydra keys and starts no model or server. CheckModels probes all four local models using **synthetic JSON/BID actions only** and saves diagnostic records under output/preflight/main_models/. AuditTasks starts one **isolated temporary OpenApps server**, checks HTTP entry points and official registration and verifies all 32 initial task evaluations are FALSE without taking any agent actions; its report is saved to output/preflight/main_suitability/. It does **not** prove real task solvability, model compatibility or CDEA divergence. InitReadiness creates output/main/readiness_v1.json with pending status and all evidence flags FALSE; it does not grant GO.

After independent review of the genuine evidence files, complete the six-check readiness file manually, then verify it without collecting Main data:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -CheckReadiness

Only this command's success **plus separate independent evidence review** is enough to satisfy the declared documentation gate. The software verifies referenced file hashes and recorded flags; it cannot substantiate their truth.

**Only when the six gates truly pass**, an explicit opt-in for one frozen Main pair (both methods) can be invoked:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -Run -MainId main_v1 -ReadinessFile .\output\main\readiness_v1.json -ModelLabel qwen3.5-9b -MaxPairs 1 -StopOnInvalid

The Main ID may be resumed only for untouched scheduled pairs, with the exact frozen controller SHA/plan/model/readiness/evidence hashes; repeated pairs are skipped, not re-executed. An invalid pair remains invalid. Never continue an old Pilot with this Main controller commit.

## Output directories (all are actual data only after successful live execution)

    output/main/main_v1/
      manifest.json
      model_digests.json
      results.csv
      pairs.csv
      summary.csv
      analysis.json
      episodes/pair_001/pair.json
      episodes/pair_001/Baseline/episode/episode.json
      episodes/pair_001/Baseline/episode/browsergym/...
      episodes/pair_001/Baseline/server/...
      episodes/pair_001/Proposed/episode/episode.json
      episodes/pair_001/Proposed/episode/browsergym/...
      episodes/pair_001/Proposed/server/...
      ...pair_128

**Offline unit-test fixtures are synthetic and never research observations.** GitHub Actions validates code syntax and mock/offline contracts on Windows and Ubuntu, not local live OpenApps, Ollama, or BrowserGym. Neither this document nor CI creates user research results.
