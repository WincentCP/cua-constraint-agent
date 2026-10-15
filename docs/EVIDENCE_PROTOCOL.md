# Evidence collection and analysis protocol (Bab IV / Lampiran)

## Reproducible evidence, not decorative screenshots

A screenshot proves what was rendered at a particular moment. It does **not** prove official task success. Official WebArena-Verified task success comes only from the evaluator's `eval_result.json` paired with a real agent's `agent_response.json` and `network.har`.

Use the same rule for both Baseline and Proposed. Capture evidence consistently; never choose only wins after seeing outcomes. Every run has a unique UUID, task ID, model label, method and benchmark version. The autonomous runner is currently **development-only** and must be validated against a live local Shopping instance before pilot collection.

## PoC — Task 284

- `npm run webarena:prepare -- --task 284 --stage poc` exports only the **public** task input.
- `npm run webarena:inspect -- --task 284 --stage poc` captures initial accessibility snapshots, **screenshots/start-01.png**, and `inspection.har`. This is not an agent run.
- The generated `reports/poc/poc-review.md` must be completed by a human with PASS/MODIFY/REJECT, examples of at least two meaningful evidence-acquisition choices and reset observations.
- The development runner can later create one PoC agent episode with `runs/<model>/<baseline|proposed>/284/`, containing initial/final screenshots, selected decision checkpoints, public ARIA snapshots, `trace.jsonl`, `run_metadata.json`, `agent_response.json`, agent `network.har`, and (only after official evaluation) `eval_result.json`.
- Do not call an inspected site or a screenshot a solved task.

Suggested Bab IV figures: site screenshot, ARIA Tree excerpt, a visibly grounded candidate probe and the PoC decision checklist.

## Pilot — 6 tasks × 4 models × 2 methods = 48 expected independent episodes

Pilot candidate IDs: `279, 284, 323, 436, 506, 528`. Eligibility requires manual review of public-UI task requirements, multiple meaningful probe choices, and repeatable Shopping resets. The development runner currently handles **one task/model/method at a time**; it does not provide a validated 48-run unattended orchestrator.

Every completed agent episode is stored under `output/pilot/runs/<model>/<method>/<task-id>/`. A model can claim SUCCESS in `agent_response.json` and still fail officially. `npm run pilot:gate` and `npm run results:export -- --stage pilot` must not be interpreted as evidence of successful execution when official per-run artifacts are absent.

Suggested Bab IV displays: registered design, 48-run completeness audit, evaluator-status counts, success diversity across models/tasks, indicative floor effects, and GO/MODIFY/NO-GO justification.

## Main — 32 held-out Shopping tasks × 4 × 2 = 256 expected episodes

Select and freeze 32 eligible task IDs **before** examining main outcomes. The main runner/orchestrator, research freeze and 256 valid episodes are **not** claimed to exist yet.

Suggested Bab IV analyses from **complete paired task/model outcomes**: per-model Baseline vs Proposed success rate, paired discordant outcomes, exact McNemar tests with Holm adjustment, median runtime, actions, number of selected probes, invalid-output rates, and limitations. Task count is **32, not 256 independent tasks**.

## Evidence recording rules

1. Capture initial screenshot for **every run**. Capture at most three meaningful probe-decision screenshots (the same rule for both conditions). Capture final screenshot even for failures when browser remains available.
2. Save an ARIA snapshot per decision step, trace probe eligibility and scores, the selected probe, publicly grounded constraint states, and the model's rationale. The model rationale and quote-grounding **are diagnostic**, not evaluator ground truth.
3. Save official `network.har` **after closing Playwright context**. The separate `inspection.har` must never substitute for the agent HAR.
4. Save version and run identity. Do not overwrite an existing run; archive it and declare a replacement before repeating a cell. Do not silently pick a better attempt.
5. Reset persistent Magento site state between independent model/method episodes (isolated browser contexts are insufficient). Document how reset was verified. The runner currently requires explicit confirmation for pilot episodes; that flag is not proof a reset happened.
6. Raw screenshots, HAR, ARIA trees and prompts may contain names, login headers or account/session details. Keep them **locally**, back up securely, and redact screenshots before publishing. Never commit `output/`, `reports/`, credentials, HAR or a full run transcript to GitHub.
7. `run-inventory.csv` includes missing and invalid combinations. `analysis-results.csv` contains only runs with valid official results. **Missing runs are not task failures.** The exporter marks incomplete coverage clearly.
8. `notebooks/thesis_analysis.ipynb` is stored in GitHub. Load sanitized CSV exports into Colab and export 300-DPI PNG/PDF figures and CSV tables. The notebook will not conduct main confirmatory tests until all 256 registered episodes are valid.

## Suggested manuscript figures and appendices

Bab IV: workflow diagram, environment screenshot, PoC screenshot with public constraint, one Baseline/Proposed decision-trace comparison on the same task/model, pilot feasibility table, main success figure, paired McNemar table, and efficiency figures.

Appendix: platform versions, research freeze/manifest, selected task list, full prompt schema for both methods, recorded inclusion criteria, one or two **predefined** representative traces per type of outcome, the official evaluator format, sanitized metadata examples, and file/checksum inventory. Keep the complete 48/256 raw runs in offline/electronic archives rather than inserting hundreds of screenshots into printed pages.

## Current limitations

Only static CI and a **synthetic-browser mock** verify the new development-runner plumbing. The model-driven workflow, actual Magento reset and live WebArena task 284 remain unverified on the target RTX 5060 laptop. Completing this audit is a prerequisite to treating pilot data as experimental evidence.
