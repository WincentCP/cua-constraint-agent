# OpenApps official task screening

Status: **PENDING**. Do not count the three PoC examples as independent benchmark successes or as main holdouts.

## Candidate sources
- `config/tasks/openbanking.yaml`: nine official tasks, with one pure navigation smoke task. Read-then-act and disambiguation tasks are strongest for CDEA; some have fewer than three constraints unless substantively decomposed.
- `config/tasks/longer_horizon.yaml`: 100 multi-app composites; repository comments explicitly say all produced values are in the goal. Most do not require finding hidden evidence.
- `config/tasks/original_tasks.yaml` and `user_goal_variations.yaml`: shallow/same-ground-truth task family variants. Do not count paraphrases as independent task types.
- Optional UI variation axes such as card-list layout and misleading descriptions. Variations of one task must be grouped in analysis.

## Eligibility fields (one signed review per candidate)
`task_key`, `upstream_sha`, `task_family`, `public_goal`, `public_requirements`, `evidence_sources`, `>=2 meaningful acquisition alternatives with paths`, `3 substantive constraints`, `visible accessible controls`, `official evaluator result demonstrated`, `repeatable reset proof`, `no leakage proof`, `independent from PoC/pilot`, `reviewer`, `time`, `PASS/FAIL/REVISE`.

## Review principle
Check actual **UI** and score determinism, not just task YAML. One bank amount appearing already on initial visible page is not a complex evidence-acquisition choice; a question requiring comparison across distinct account/transaction records may be. Two trivial buttons do not constitute two *meaningful* probes. Keep screenshots, AXTree and rationale. Select tasks **before** viewing comparative outcomes. Predeclare the minimum qualified-family count and split.

## Provisional 3 PoC task keys
1. `add_todo_to_review_largest_card_charge` — same-account card charge comparison.
2. `reconcile_the_largest_account` — cross-account available-balance comparison plus message/todo.
3. `report_the_card_statement_balance_and_headroom` — statement vs current balance and remaining headroom, then message/todo.

All 3 remain **PENDING live suitability verification**. Their purpose is method feasibility, not final confirmation. They are not yet approved as independent distinct families for main.
