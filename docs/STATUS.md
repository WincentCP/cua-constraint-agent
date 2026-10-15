# Research implementation status

## Scoped study

WebArena-Verified **v1.2.3 Shopping only**; no LEUCO in main evaluation. Six public-intent pilot candidates: 279, 284, 323, 436, 506, 528. Supervisor-mandated main design: 32 distinct Shopping tasks × 4 model candidates × 2 methods = 256 episodes.

## Implemented and unit/integration tested

- public Shopping-only manifest with six distinct intent templates and ≥3 instruction-derived requirements per task;
- pre-registered protocol and operational pilot decision thresholds;
- evidence ledger and shared candidate-probe ranking boundary;
- Accessibility Tree capture/control extraction, session isolation and diagnostic hints;
- official pinned `uvx` CLI handoff and public task input validation;
- `inspection.har` separated from the real agent `network.har`;
- public Shopping catalog export for later 32-task held-out screening;
- stage-isolated PoC/pilot/main folder layouts and appendix indexes;
- manual PoC and task suitability checklists that are not overwritten;
- pilot result checker that reads official evaluation status (distinguishes task failure vs evaluator error);
- main selection guard: exactly 32 distinct, pilot-disjoint public Shopping task IDs;
- basic research identity SHA-256 freeze utilities;
- initial-page PoC screenshot capture;
- **development-only single-task** Ollama browser runner with matched Baseline/Proposed model prompts, bounded action budget and evidence-state tracking;
- bounded decision checkpoint screenshots, run metadata and JSONL decision traces;
- pilot/main CSV exporter with missing-run inventory and official-evaluation validation;
- Google Colab notebook with graphics, descriptive tables and conditional paired McNemar tests;
- evidence preservation and appendix protocol in docs/EVIDENCE_PROTOCOL.md;
- offline unit and synthetic browser/HAR integration CI.

## Not yet completed / not to be claimed

- live Shopping Docker task 284 inspection on the target Windows device;
- actual ≥2 meaningful evidence-choice verification in the live UI;
- **live validation and debugging** of the newly added development-only model-driven runner on actual Shopping;
- valid end-to-end PoC run and official evaluator result;
- approved reset-safe batch orchestrator and actual 48-run pilot with suitability approvals;
- four-model WebArena competence/repeatability checks (older LEUCO run times do not prove WebArena ability);
- screened and frozen 32-task main subset;
- complete protocol/prompt/hardware/evaluator and model digest freeze;
- 256 real main-experiment results, statistical analysis and Bab IV exports.

No synthetic test or CI success is represented as a WebArena official task success. If PoC/pilot fails, reassess benchmark scope with supervisor rather than forcing the main experiment.
