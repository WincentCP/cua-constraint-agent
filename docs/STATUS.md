# Implementation status

Implemented: final 32-task dataset; shared browser agent and evidence ledger; Baseline/Proposed selection; independent pre-ACT evaluator; durable recording; paired metrics; exact paired McNemar/Wilcoxon statistics; development/repeatability/freeze/main CLI; interrupted-attempt recovery and paired infrastructure reruns.

Repository CI validates formatting, TypeScript build, unit tests, browser integration tests and dataset invariants. The LEUCO local storefront uses only public fixture facts, preserves the controlled probe routes and records screenshots as documentation rather than planner input.

The next clean pre-study cycle uses four Q4_K_M local candidates: Qwen3.5 9B, Ministral-3 8B Instruct, Granite 4.1 8B and RNJ-1 8B Instruct. The benchmark runner records stable machine/runtime/model identity, rejects a resume after that identity changes, saves per-model Ollama metadata, verifies actual Q4_K_M quantization, and requires a 12/12 healthy pilot before full Phase 1.

Pending research data: fresh four-model pilot on the chosen benchmark machine; full Phase 1 model selection; selected-model repeatability gate; formal freeze; 64-run main paired experiment. Older pilot/full outputs from previous candidate/config/environment cycles remain diagnostic history and are not final evidence.
