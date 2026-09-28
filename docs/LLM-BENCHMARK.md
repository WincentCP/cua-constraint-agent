# LLM benchmark protocol

This phase selects one sufficiently competent and reproducible local LLM before the main policy experiment. It is a model-selection pre-study, not the thesis contribution. The main contribution remains Baseline versus Proposed UNKNOWN-coverage probe selection with the selected model/configuration frozen.

## Candidate set

Primary pilot candidates use the same Ollama runtime and the same Q4_K_M quantization class:

- `qwen3.5:9b-q4_K_M`
- `ministral-3:8b-instruct-2512-q4_K_M`
- `granite4.2:8b-q4_K_M`
- `gemma2:9b-instruct-q4_K_M`

`nvidia/Nemotron-Cascade-8B` is an optional deployment-gate candidate. It may enter the full benchmark only if it can be served with a reproducible local setup that is comparable to the primary candidates; otherwise runtime differences would become an additional experimental variable.

## Repository runner

The benchmark is executed from the committed repository scripts; no chat-provided ZIP or external helper is part of the research workflow.

From a clean checkout with all four models already installed and Ollama running:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\benchmark\run.ps1 -Mode pilot
```

The runner performs build/tests/validation, captures the machine environment and Git commit, checks each installed model, runs the declared episodes, preserves automatic screenshots/raw traces, restores `config/experiment.json` exactly, and generates `summary.csv`, `runs.csv` and `summary.json`.

Before timed benchmark episodes for each candidate, the runner performs one identical unscored warm-up inference and keeps the model resident briefly. This removes first-load latency from the 60-second per-call research timeout. Warm-up output and timing are written to `warmup.json`; warm-up is not included in VDA, repeatability, token, or latency summaries.

The pilot is the recommended one-time feasibility/preflight check on a new benchmark machine and is not used for model selection. If all 12 pilot episodes are healthy and the machine, driver, Ollama version, repository revision and configuration remain unchanged, do not add repeated manual per-model smoke tests or repeat the pilot without a documented reason. A healthy pilot reduces infrastructure risk but does not guarantee that the longer full benchmark cannot encounter a later infrastructure failure. The full Phase 1 benchmark remains mandatory and unchanged:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\benchmark\run.ps1 -Mode full
```

Default outputs are `exports/llm-benchmark-pilot-v1` and `exports/llm-benchmark-full-v1`. Existing output directories are never overwritten. The exact candidate list is versioned in `scripts/benchmark/models.json`.

## Pilot

Use Baseline only on:

- development-01 (U2)
- development-02 (U3)
- development-03 (U4)

Run every model/task combination once. With four primary candidates this is 12 pilot episodes.

The pilot is a pipeline/feasibility check, not the final model-selection result. It verifies model loading, structured-output logging, repair/failure handling and resource suitability before the full benchmark. The preferred go/no-go condition is 12/12 healthy pilot episodes with zero recorded infrastructure failures. If an infrastructure failure occurs, preserve it, diagnose the environment, and start a fresh pilot output after any environment change. Repeatability is assessed in the full Phase 1 benchmark, where every development task is repeated three times.

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

## Efficient end-to-end workflow

Use the shortest workflow that preserves the predeclared controls:

1. machine/environment check;
2. one pilot: 4 models × 3 development tasks × 1 run = 12 episodes;
3. full Phase 1 model benchmark: 4 models × 12 development tasks × 3 repetitions = 144 episodes;
4. select one model using the predeclared lexicographic rule and lock its configuration against further tuning;
5. run the repeatability gate on the selected model: first 6 development tasks × 2 policies × 3 repetitions = 36 runs;
6. after the gate passes, create the formal experiment freeze;
7. collect the main paired experiment: 32 base tasks × 2 policies = 64 planned main episodes;
8. perform the predeclared offline statistical analysis and report the results.

The full model benchmark and the repeatability gate answer different questions and are not duplicates. Phase 1 asks which LLM is sufficiently reliable and competent under one shared Baseline policy. The gate asks whether the final selected model plus both experimental policies produce a stable system before main data collection.

Do not repeat the 64-run main experiment three times: the task is the statistical unit and Baseline/Proposed are paired within each of the 32 tasks. Infrastructure reruns follow the separate documented rerun rule and are not additional experimental repetitions.

After model selection, keep the exact model name/digest, quantization, prompt, inference settings, source revision, dependencies, browser/runtime, budget, dataset and evaluator fixed while running the gate. The formal freeze is created only after the gate passes.

Primary inference is the exact two-sided McNemar test for paired VDA. Probe-count comparison is restricted to jointly correct pairs and uses the paired Wilcoxon signed-rank analysis specified in the thesis plan; U2/U3/U4 are descriptive/exploratory mechanism strata rather than the primary treatment variable.
