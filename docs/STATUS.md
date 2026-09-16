# Implementation status

Final-contract refactor is in validation. This file will be updated with observed checks and artifact paths after validation.

Implemented: final 32-task dataset; shared browser agent and evidence ledger; Baseline/Proposed selection; independent pre-ACT evaluator; durable recording; paired metrics; development/repeatability/freeze/main CLI; interrupted-attempt recovery and paired infrastructure reruns.

Observed: unit tests and browser integration pass, including exact initial U-levels for all 32 tasks and all 64 deterministic policy runs. The LEUCO visual language is integrated into the local controlled world with three local kaos design assets, Indonesian copy, 2026 dates, responsive desktop/mobile layout, exact semantic probe labels, public-only fact visibility and empty/single-item cart states. The dedicated storefront integration checks pass, including a real card-to-detail-to-cart flow and rejected duplicate add. Demo is engineering evidence, not research data.

Pending: real-model competence, repeatability, development gate, freeze, main data collection, and export/analysis. Older ignored outputs are not evidence for this PRD.

Immediate next sequence:

1. Run `doctor` and `validate` on the machine that will be used for the real-model development cycle.
2. Run all 12 development tasks with the fixed real model.
3. Run repeatability on the first six development tasks, three repetitions, both policies.
4. Run the development gate and resolve only engineering failures before freeze.
5. Freeze source/config/dataset/model/runtime and the exact run-order manifest.
6. Run the 32 paired main tasks (64 planned runs), then export metrics and reports.

Current blocker: the configured `qwen2.5:7b` previously timed out while loading on the current workstation. Do not freeze or collect main data until the selected real model passes the competence/repeatability gate on a sufficiently capable machine, or a smaller model is selected through a fresh development cycle and used identically for both policies.
