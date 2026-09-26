# LLM benchmark protocol

This phase selects one sufficiently competent and reproducible local LLM before the main policy experiment. It is a model-selection pre-study, not the thesis contribution. The main contribution remains Baseline versus Proposed UNKNOWN-coverage probe selection with the selected model/configuration frozen.

## Candidate set

Primary pilot candidates use the same Ollama runtime and the same Q4_K_M quantization class:

- `qwen3.5:9b-q4_K_M`
- `ministral-3:8b-instruct-2512-q4_K_M`
- `granite4.2:8b-q4_K_M`
- `gemma2:9b-instruct-q4_K_M`

`nvidia/Nemotron-Cascade-8B` is an optional deployment-gate candidate. It may enter the full benchmark only if it can be served with a reproducible local setup that is comparable to the primary candidates; otherwise runtime differences would become an additional experimental variable.

## Pilot

Use Baseline only on:

- development-01 (U2)
- development-02 (U3)
- development-03 (U4)

Run every model/task combination three times. With four primary candidates this is 36 pilot episodes.

The pilot is a pipeline/feasibility gate, not the final model-selection result. It verifies model loading, structured-output logging, repair/failure handling, repeatability measurement and resource suitability before the full benchmark.

## Full Phase 1 benchmark

If the pilot is healthy, run every eligible candidate on all 12 development tasks with three repetitions per task, still using Baseline only.

The 32 main tasks are not used for model selection.

## Fairness controls

Everything except the model checkpoint must be held constant:

- same development tasks and task order rule;
- same planner prompt and public input representation;
- same eligible probes, evidence ledger and Baseline policy;
- same `temperature=0`, `seed=42`, `num_ctx=8192`, `num_predict=1536`;
- same probe/action/model-call/deadline budgets;
- same Ollama version and machine;
- same browser/runtime and source revision;
- same Q4_K_M quantization class for primary candidates;
- same structured-output validation and one-repair rule;
- same three repetitions;
- `think=false` for the benchmark configuration;
- no model-specific prompt tuning after results are observed;
- preserve invalid outputs, repairs and infrastructure failures rather than deleting unfavorable runs.

For reproducibility, record the configured model name, Ollama model digest, Ollama version, source/config/dataset hashes, runtime identity and hardware details.

A benchmark is not considered fair if models receive different prompts, different task subsets, different budgets, different quantization classes without justification, different serving stacks without justification, or if failed runs are selectively removed.

## Recorded measures

For every episode/model call preserve:

- Verified Decision Accuracy (VDA);
- terminal outcome;
- selected probe trajectory and probe count;
- raw model output;
- JSON/schema validity and repair events;
- model input/output tokens;
- Ollama timing diagnostics when available;
- infrastructure failures;
- repetition identity.

Three repetitions measure repeatability; they are not treated as three independent task observations.

## Model-selection rule

Use a gated/lexicographic rule rather than a post-hoc weighted score:

1. deployment reliability;
2. no unrecovered structured-output failures;
3. development-task competence (VDA);
4. repeatability of outcome and selected-probe trajectory;
5. repair rate and inference efficiency only as tie-breakers.

Do **not** select a model using the size of the Proposed-minus-Baseline effect. Model selection must be independent of the later treatment effect.

## Phase 2 and Phase 3

After selection, freeze the exact model name/digest, quantization, prompt, inference settings, source revision, dependencies, browser/runtime, budget, dataset and evaluator.

Then run the existing repeatability gate and, only after it passes, collect the main paired experiment:

- 32 base tasks;
- Baseline and Proposed for each task;
- 64 planned main episodes.

Primary inference remains exact McNemar analysis for paired VDA. Probe-count comparison is restricted to jointly correct pairs and uses paired nonparametric analysis as specified in the thesis analysis plan.
