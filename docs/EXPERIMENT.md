# Preregisterable CDEA vs Baseline study design — OpenApps

## Research problem
Can constraint-directed selection of information-acquisition actions improve independent official task success over generic progress ranking for small local browser agents, under controlled initial states and common observations?

**Experimental unit:** one OpenApps task x one fixed model x one policy. The **pair** is Baseline/Proposed on matched task/model with independent reset. Families, models, and environment variations create dependence; report accordingly.

## Treatment isolation
- Shared: same public goal; visible Playwright Accessibility Tree; eligible UI controls and public-only relevance hints; agent JSON format; current model-observed constraint state ledger; model checkpoint/quantization/digest; Ollama temperature=0; browser, app seed, action budget (development default 16).
- Baseline: rank candidate controls by model's forward-progress score; deterministic tie order.
- Proposed: rank controls by number of unresolved public constraints plausibly answerable, then estimated forward cost and stable tie order.
- No privileged DOM, evaluator config/target state, hidden account amounts, file system, or server-state APIs in model input. The evaluator bridge operates separately from the agent.
- The heuristic relevance hints are shared between arms and **not verified evidence**. Quotes in current visible accessibility snapshot are provenance annotations, not validated factual correctness.
- Intervention on the *ranking policy only*. If baseline/proposed choose identical actions for most steps, disclose null treatment separation before making causal claims.

## Outcomes
1. **Primary:** independent OpenApps state evaluator reward (0/1) on final app state.
2. **Secondary:** human-audited correctness of acquired evidence; constraint satisfaction coverage; action count; LLM calls; elapsed time; invalid actions and errors; first-decision divergence.
3. **Exploratory:** differences by pre-screened evidence-acquisition complexity and UI variation. Do not claim mechanism merely because success improved.

## Task selection and leakage
Only use **public instructions** for task eligibility and public constraints. Never derive prompt constraints from reward target-state answer fields. All selected tasks must require at least three **substantive** constraints and at least two **genuine** information-acquisition alternatives. A compound task that simply recites title/date/message is not eligible even if it has four subgoals.

Task pool: official OpenApps `config/tasks/openbanking.yaml` (nine named tasks, one nav-only), `config/tasks/longer_horizon.yaml` (100 composites, mostly goal-specified answer strings), others after independent review. There is **currently no evidence** that 32 independent qualifying tasks exist. Task families/variations of same seed are not independent sample units. Do not quietly invent 32 bespoke task formulations while claiming official benchmark comparability.

## Stages
**PoC**: three development OpenBanking task families (`src/openapps/manifest.ts`). Confirm site, browser accessibility, model actions, independent evaluator, and model-invisible answer boundary; no significance testing.

**Pilot**: plan six task families x 4 models x 2 methods = 48 episodes. Tasks must not overlap PoC by seed and target pattern. Check technical validity, model competence/floor effects, task suitability and reset reliability. The numerical success gate must be decided with supervisor **before outcomes**, not retrofitted. Retry policy fixed before observing results.

**Main**: goal 32 eligible task families x four fixed models x two policies = 256 episodes. Hold out from screening tune/pilot. Cannot start unless 32 genuine qualifying tasks and official checker are independently verified; document protocol revision instead of stretching criteria.

## Paired run scheduling
Block by task and model. Randomize/counterbalance Baseline/Proposed order; every episode begins with fresh SQLite app seed and identical state fingerprint (or documented equivalence). Different run UUIDs, isolate Chrome contexts. Only compare official results of valid completed episodes. Preserve failures and classify separately: runner error, evaluator failure, app reset failure, completed unsuccessful task, success. No reruns just for Proposed.

## Analysis
- Main primary: paired success risk difference, paired discordant outcome counts and confidence intervals; exact McNemar as per-model secondary with multiplicity correction.
- For pooled summaries, cluster bootstrap by independent task family (or model task-family explicitly) because four models reuse the same tasks. Treat confidence intervals as exploratory if 32 independent families cannot be established.
- Analyze invalid/missing cells and floor effects; do not discard them invisibly. Task difficulty/moderator hypotheses are secondary and small-N.
- Blinded audit of evidence correctness sampled using a **predeclared** selection method; dual rater agreement where feasible. An AXTree substring is not evidence truth.
- Never report 48 or 256 'independent tasks'; they are episode counts, not independent families.

## Threats
- Public task family selection bias; model instruction-following rather than acquisition; reward brittleness when extra app state changes; partial-observation control selection; app-version drift; evaluator leakage; SQLite residue; weak small-model planning; language/quantization differences; time budget and shared prompt fairness.

**STOP condition:** if pilot and main lack sufficient official evidence-seeking task families, propose narrower claims or a different benchmark to supervisor rather than silently redefining outcomes.
