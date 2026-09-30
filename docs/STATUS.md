# Implementation status

The controlled Baseline-versus-Proposed experiment contract is implemented and validation-ready.

Implemented: final 32-task dataset; shared browser agent and evidence ledger; Baseline/Proposed selection; independent pre-ACT evaluator; durable recording; paired metrics; development/repeatability/freeze/main CLI; interrupted-attempt recovery and paired infrastructure reruns; a predeclared lean Baseline-only four-model Phase 1 runner (12-episode pilot, 72-episode full benchmark), 24-run selected-model repeatability gate, environment capture and summary export.

Current Phase 1 candidate set: Qwen3.5 9B Q4_K_M, Ministral-3 8B Instruct Q4_K_M, Granite 4.1 8B Q4_K_M and RNJ-1 8B Instruct Q4_K_M. Granite 3.3 8B Instruct Q4_K_M is the predeclared deployment fallback if Granite 4.1 cannot complete a clean pilot on the fixed benchmark machine. The runner requires Ollama 0.13.3+ because RNJ-1 requires that runtime generation.

Observed engineering evidence: unit tests and browser integration have passed in prior validation, including exact initial U-levels for all 32 tasks and all 64 deterministic demo policy runs. The LEUCO visual language is integrated into the local controlled world with three local kaos design assets, Indonesian copy, responsive layout, exact semantic probe labels, public-only fact visibility and empty/single-item cart states. Demo is engineering evidence, not research data.

Pending research evidence: fresh four-model pilot on the final benchmark machine, full Phase 1 model selection, selected-model repeatability gate, formal freeze and main data collection. Older pilot outputs remain diagnostic history and do not replace the new committed candidate protocol.
