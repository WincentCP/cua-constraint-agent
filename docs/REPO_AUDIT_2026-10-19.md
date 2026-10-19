# Reliability audit and research gates — 2026-10-19

**Scope:** Current official BrowserGym/OpenApps main branch, isolated
server and evaluator gates, shared Baseline/CDEA paired development runner,
public-AXTree adapter, Ollama, PowerShell wrappers and Windows/Ubuntu CI.

**Decision:** Reasonable to continue ONE controlled Qwen development run
after the cheap preflight and read-only artifact inspection. NOT ready for
pilot, task-set freeze or main experiments yet.

## Verified from user-supplied local Windows outputs

- Official unpaired Qwen Todo execution: reward 1.0 with four BrowserGym
  actions and exact Todo state delta.
- Independent official Todo evaluator positive and negative controls passed
  as prerequisites to the one-command validation; retain original artifacts.
- Paired Qwen Todo episode 9e6c49d077dc4475a5ddbb5f95b2fc9d: both arms
  success True, equal fresh-state hashes, Baseline 3 steps / 3 model calls.
  Comparable information-probe decisions: ZERO.
- Paired Qwen OpenBanking episode 52e1e3ff2cec4c6aab7daedf1d84c3a4:
  both arms success False. Each repeatedly clicked persistent
  OpenBanking-labelled navigation, then hit the common repetition guard.
  Comparable information-probe decisions: ZERO.
- After that failed OpenBanking episode, a shared public-AXTree clickable-row
  adapter and a redundant current-app link guard were added. Their new live
  effectiveness on the real bank page is NOT verified by the above runs.

## Risk register

| Risk | Mitigation / audit conclusion |
| --- | --- |
| Unrelated OpenApps process or contaminated database | Owned per-arm ephemeral server/database, port ownership checks, pinned upstream commit, official evaluator start-state parity and cross-arm SHA parity; tested with simulated Windows paths |
| Invalid/hallucinated BrowserGym element ID | Current-AXTree bid allowlist, no automatic ID substitution, one bounded same-observation model repair shared by both methods |
| Persistent chrome dock navigation loop | Common current-app root-link guard before BrowserGym step; same simulated regression for both methods; still needs post-patch live validation |
| Nonsemantic HTMX bank account row | BrowserGym public AXTree generic clickable hints; no guessed IDs when BrowserGym lacks metadata; still a live risk |
| New Ollama model incompatible with JSON/actions | New three-case synthetic action-contract preflight, no browser required, reports validity, task-intent warning and whether a synthetic probe menu was produced |
| Model changed between the paired arms | Model exact name/digest recorded and rechecked through Ollama tags before each arm, fail closed if digest changes |
| Random isolated localhost port changes the model prompt | Shared planner uses the current public route path/query, not the random port, making matched-arm prompt input more comparable |
| Untrusted or adversarial UI instructions | Shared system prompt treats webpage text as untrusted; parser restricts model output to allowlisted BrowserGym commands. This is NOT a general-purpose security sandbox |
| PowerShell text copy/paste errors | New one-command read-only paired artifact inspector avoids manually typing variables or parsing JSON |
| Large AXTree or Ollama context truncation | New AXTree/prompt length flags plus Ollama prompt evaluation counters when available; actual hardware/context behavior still requires live verification |
| Model cannot create meaningful information probes | Synthetic probe diagnostic and explicit mechanism status. Live treatment separation is STILL unverified |
| Model output invalid vs infrastructure invalid | Different status/reasons logged. How to include model errors in statistical denominators must be defined and frozen before pilot/main |
| Only Qwen is installed / tested | Other models must pass installed-tag/digest plus action-contract and live matched compatibility gates before selecting the final study models |
| Independent 32 main task families not yet frozen | Screen task suitability independently; no claim that 32 eligible tasks or 256 valid main runs have been established |

## Limitations of the automated verification

- CI executes Python 3.11 compilation and simulated unit/contract tests on
  both Windows and Ubuntu. CI does NOT start the OpenApps server, Chromium,
  Ollama, a real banking page or the real official evaluator.
- The current policy difference is only ranking a shared model-supplied
  information-probe menu. Its model-supplied coverage/cost estimates are
  heuristics; AXTree quote grounding proves literal visibility, not semantic
  correctness. No causal method advantage has been established.
- The official Todo evaluator controls do not demonstrate independent
  correctness of all OpenBanking/composite task evaluators.
- Every controller/model/prompt change belongs to development. Freeze the
  chosen model versions, candidate logic, prompt, retry policy, budgets,
  selection criteria and analysis protocol BEFORE pilot/main.
- Owned process checks are meant to stop accidental contamination; they do
  not protect against an attacker with control over local processes.

## Safe Windows commands

After updating the thesis repository with git pull --ff-only:

Read the most recent paired result WITHOUT starting a model or browser:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\inspect_pair.ps1

Check the currently installed Qwen model's exact JSON/BID contract WITHOUT
starting OpenApps or Chromium:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\check_model_compatibility.ps1

Only if the above outputs are understood, run ONE Qwen information-acquisition
developer pair with separate fresh app databases:

    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_matched_dev.ps1 -TaskGroup openbanking -Task add_todo_to_review_largest_card_charge -MaxSteps 20

Then inspect saved artifacts using the first command. Do not rerun the same
failure repeatedly without identifying the cause in the trace. Other models
remain optional until their installation and compatibility are verified.

**Go/no-go:** OFFLINE contract gate must pass before a new developer pair;
LIVE information-acquisition and candidate divergence, task screening,
independent evaluator scrutiny, full model compatibility and preregistered
analysis are required before any pilot or main experiment.
