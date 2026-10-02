# LLM benchmark protocol

This phase selects one sufficiently competent and reproducible local LLM before the main policy experiment. It is a model-selection pre-study, not the thesis contribution. The main contribution remains Baseline versus Proposed UNKNOWN-coverage probe selection with the selected model/configuration frozen.

## Candidate set

Primary pilot candidates use the same Ollama runtime and the same Q4_K_M quantization class:

- `qwen3.5:9b-q4_K_M`
- `ministral-3:8b-instruct-2512-q4_K_M`
- `granite4.1:8b-q4_K_M`
- `hf.co/Salesforce/Llama-xLAM-2-8b-fc-r-gguf:Q4_K_M`

### Inclusion/exclusion rationale

A candidate in the Model-Selection Pre-Study must be selected **before performance results are inspected** and should satisfy all of the following:

1. approximately 8–10B parameters so local compute demand is comparable;
2. runnable through the same local Ollama serving stack;
3. available in the same Q4_K_M quantization class;
4. suitable for structured JSON / agentic decision output without model-specific prompt tuning;
5. feasible on the fixed benchmark machine.

The four active models satisfy that operational comparison target while providing different model families. The original committed set also included RNJ-1 8B Instruct Q4_K_M. RNJ-1 was removed before the full Model-Selection Pre-Study after two separate fresh pilots on the fixed benchmark machine reproduced the same deployment failure: warm-up failure plus infrastructure failures on `development-02` and `development-03`, with Ollama diagnostics showing `GGML_ASSERT(hparams.is_swa_any()) failed` during model loading. The other three candidates had zero infrastructure failures in both pilots. This was a deployment-eligibility exclusion only; RNJ-1 was not removed for VDA, latency or model quality.

After RNJ-1 was excluded for reproducible deployment incompatibility, OLMo 3 7B Instruct was temporarily added and completed a feasibility pilot. Before any full Model-Selection Pre-Study run, the candidate set was refined again: OLMo was superseded by Salesforce Llama-xLAM-2 8B FC-R Q4_K_M. This refinement occurred after feasibility data had been observed, so the history is retained explicitly rather than described as pre-pilot. The reason for the refinement is methodological task alignment and tighter size comparability: xLAM-2 is an 8B action/function-calling model, Salesforce publishes the Q4_K_M GGUF, and the model can be invoked through Ollama from the official Hugging Face repository. All RNJ and OLMo pilot outputs remain diagnostic history and are excluded from model-selection evidence.

Gemma is not in the active set because the nearest operationally suitable Gemma checkpoints do not match the committed dense 8–10B comparison as cleanly. NVIDIA Nemotron is not mixed into the current active set because the protocol prioritizes a directly reproducible Ollama/Q4_K_M path from the model publisher. Alternative families may be considered only in a future protocol revision before a new collection cycle.

The committed benchmark runner retains Ollama 0.13.3 as the fixed minimum runtime version for this audited protocol.

### Reproducible deployment incompatibility

A single failed warm-up/episode does not remove a candidate. First diagnose the machine and run **one fresh pilot output** with the unchanged committed candidate list. If the same candidate again has reproducible deployment/infrastructure failure while the other candidates are healthy, it may be declared **deployment-ineligible** before the full Model-Selection Pre-Study. Preserve both failed pilot outputs, document the reason in `docs/STATUS.md`, remove that candidate from `scripts/benchmark/models.json`, commit the protocol revision, and start another fresh pilot. The runner accepts 3–4 committed active candidates.

Granite 3.3 8B Instruct Q4_K_M remains a **predeclared deployment fallback only** for Granite 4.1: if Granite 4.1 shows the reproducible incompatibility above, replace it with `granite3.3:8b-instruct-q4_K_M` in the committed candidate list instead of silently switching during a benchmark.

Never exclude/replace a candidate because its VDA, latency, or repeatability is poor. Deployment eligibility is decided only from reproducible infrastructure compatibility, before the full Model-Selection Pre-Study.

## Repository runner

The benchmark is executed from the committed repository scripts; no chat-provided ZIP or external helper is part of the research workflow.

From a clean checkout with all four active models already installed and Ollama running:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\benchmark\run.ps1 -Mode pilot
```

The runner rejects Node.js older than 24 and Ollama older than 0.13.3, verifies the committed active candidates use Q4_K_M tags, performs build/tests/validation, captures the machine environment and Git commit, checks that every candidate is installed before model episodes begin, records `ollama show` plus `ollama ps` after warm-up for deployment/offload diagnosis, runs the declared episodes, preserves automatic screenshots/raw traces, restores `config/experiment.json` exactly, and generates `summary.csv`, `runs.csv` and `summary.json`.

Before timed benchmark episodes for each candidate, the runner performs one identical unscored warm-up inference and keeps the model resident briefly. This removes first-load latency from the 60-second per-call research timeout. Warm-up output and timing are written to `warmup.json`; warm-up is not included in VDA, repeatability, token, or latency summaries.

The pilot is the recommended feasibility/preflight check on a new benchmark machine and is not used for model selection. The currently committed four-model set requires a clean 12-episode pilot. Continue only when the **currently committed active candidate set** completes a fresh pilot with zero infrastructure failures. Do not add repeated manual per-model smoke tests once that clean pilot exists. A healthy pilot reduces infrastructure risk but does not guarantee that the longer full benchmark cannot encounter a later infrastructure failure. The Model-Selection Pre-Study benchmark remains mandatory under the predeclared lean protocol:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\benchmark\run.ps1 -Mode full
```

Default outputs are `exports/llm-benchmark-pilot-v1` and `exports/llm-benchmark-full-v1`. Existing output directories are never overwritten. The exact candidate list is versioned in `scripts/benchmark/models.json`.

## Pilot

Use Baseline only on:

- development-01 (U2)
- development-02 (U3)
- development-03 (U4)

Run every active model/task combination once. With the currently committed four-candidate set this is 12 pilot episodes.

The pilot is a pipeline/feasibility check, not the final model-selection result. It verifies model loading, structured-output logging, repair/failure handling and resource suitability before the full benchmark. The go/no-go condition is **all episodes healthy for the currently committed active candidate set, with zero recorded infrastructure failures**. If an infrastructure failure occurs, preserve it and diagnose the environment. Use the reproducible deployment-incompatibility rule above rather than repeatedly retrying indefinitely. Repeatability is assessed in the Model-Selection Pre-Study benchmark, where each of the six predeclared development tasks is repeated three times.

## Model-Selection Pre-Study

If the pilot is healthy, run every eligible candidate on the six predeclared development tasks `development-01`, `development-03`, `development-05`, `development-06`, `development-07`, and `development-11`, with three repetitions per task, still using Baseline only. This subset is fixed before data collection, balances U2/U3/U4 at two tasks each, and includes single-feasible, multi-feasible, no-solution, and unavailable-evidence cases. The remaining development tasks stay available for diagnostics but are not part of the Model-Selection Pre-Study.

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
- same server-enforced dynamic JSON Schema for planner responses, the same post-response validation, and the same one-repair rule;
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

## Superseded development result and protocol revision

An earlier completed 72-episode Model-Selection Pre-Study selected `qwen3.5:9b-q4_K_M` under the predeclared lexicographic rule. Qwen completed 18/18 healthy runs correctly (VDA 1.00), with zero invalid outputs, zero repairs, zero unrecovered structured failures, and perfect outcome/trajectory repeatability across the six repeated development tasks. Ministral completed 14/18 correctly (VDA 0.778) with four unrecovered structured failures; Granite completed 9/18 correctly (VDA 0.50) with nine unrecovered structured failures; xLAM-2 completed 6/18 correctly (VDA 0.333) with twelve unrecovered structured failures. No candidate had an infrastructure failure in the full pre-study.

That selection is no longer the final selection evidence. The following repeatability gate exposed a systematic schema-completeness failure on `development-05` Proposed: in all three repetitions Qwen returned syntactically valid JSON with only the two stock probes even though eight probes were eligible, after which the one permitted repair returned the complete score list. The gate correctly rejected those runs because selected gate runs must contain no schema repair.

Before any main data collection, the shared planner transport was minimally revised from generic `format: "json"` to an Ollama JSON Schema whose score array has `minItems` and `maxItems` equal to the current eligible-probe count, restricts `probe_id` to the current eligible IDs, constrains `progress` to integer 0–100, and disallows extra properties. The existing application-level exact-set validation and one-repair rule remain unchanged. Because the model-facing interface changed, the previous pilot/pre-study outputs remain audit history only; final model selection must be repeated from a fresh pilot and fresh full pre-study on the same four candidates.

## Efficient end-to-end workflow

Use the shortest workflow that preserves the predeclared controls:

1. machine/environment check;
2. one clean pilot on the committed active set: 4 models × 3 development tasks × 1 run = 12 episodes;
3. Model-Selection Pre-Study benchmark: 4 × 6 × 3 = 72 episodes;
4. select one model from the fresh post-revision pre-study using the same predeclared lexicographic rule and lock its configuration against further tuning;
5. run the repeatability gate on the selected model: `development-01`, `development-03`, `development-05`, and `development-06` × 2 policies × 3 repetitions = 24 runs;
6. after the gate passes, create the formal experiment freeze;
7. collect the main paired experiment: 32 base tasks × 2 policies = 64 planned main episodes;
8. perform the predeclared offline statistical analysis and report the results.

The full model benchmark and the repeatability gate answer different questions and are not duplicates. The Model-Selection Pre-Study asks which LLM is sufficiently reliable and competent under one shared Baseline policy. The gate asks whether the final selected model plus both experimental policies produce a stable system before main data collection.

Do not repeat the 64-run main experiment three times: the task is the statistical unit and Baseline/Proposed are paired within each of the 32 tasks. Infrastructure reruns follow the separate documented rerun rule and are not additional experimental repetitions.

After model selection, set `config/experiment.json` to the exact selected model tag, commit that selection, and keep the exact model name/digest, quantization, prompt, inference settings, source revision, dependencies, browser/runtime, budget, dataset and evaluator fixed while running the gate. The bootstrap model in the repository is not evidence of model selection. The formal freeze is created only after the gate passes.

Primary inference is the exact two-sided McNemar test for paired VDA. Probe-count comparison is restricted to jointly correct pairs and uses the paired Wilcoxon signed-rank analysis specified in the thesis plan; U2/U3/U4 are descriptive/exploratory mechanism strata rather than the primary treatment variable.
