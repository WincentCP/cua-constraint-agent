# Scale Study v1 — exploratory model-size follow-up

This independent follow-up addresses whether **CDEA's advantage over Baseline varies by model size**. It does not replace, rewrite, or retroactively alter the frozen Main v1 protocol or archive.

## Study design
- 32 frozen official OpenApps task IDs (5 bank information, 18 cross-app, 9 primitive controls), reused from Main v1 for comparability.
- Four families, two model sizes each: Qwen3.5 4B/9B; Ministral3 3B/8B; Granite4.1 3B/8B; xLAM2 3B/8B.
- 32 tasks x 8 checkpoints = **256 Baseline/Proposed matched pairs, 512 official episodes**.
- Same policies, official reward, prompt format, action subset, guard/repair rule, separate OpenApps database per arm and matched initial-state hash.
- Seed 233; 40 browser actions per episode; temperature 0; Ollama timeout 240 seconds, num_predict 640, num_ctx 8192, think false. Local Q4_K_M checkpoints and exact installed digests captured.
- Task × model pair order preassigned with SHA256. No outcome-based reruns, substitutions, or dropping invalid/unstarted results.
- xLAM2 3B/8B differ in backbone: size effects for this family **cannot** be causally isolated.

## Endpoint and statistical interpretation
Primary descriptive endpoint: official binary task completion among valid Baseline/Proposed matched pairs. For each family and size, `delta = success(Proposed) - success(Baseline)`. Exploratory family interaction `delta_small - delta_large` is emitted only if all 32 task pairs in both sizes were valid. No p-value / confidence claim in this release. Report invalid/missing denominators and comparable probe opportunities/divergences, not only successes. The 32 tasks are fixed and reused across models, so contrasts are exploratory and correlated.

## Output contract
`output/scale/<scale_id>/manifest.json`, `model_digests.json`, `results.csv` (512 episode slots), `pairs.csv` (256 pairs), `summary.csv` (64 rows), `analysis.json`, and `episodes/pair_001...pair_256` with isolated server evidence, trace, episode.json, and pair.json. Aborted and incomplete cases remain invalid/not_started rather than fabricated success/failure.

## Execution (Windows, from repository root)
1. Install OpenApps at `$HOME\OpenApps` on pinned git commit `6e6782794433c60468d65ac75bc3f03c56007f8c`, BrowserGym/Playwright, uv, Ollama.
2. Pull all 8 exact model names from `config/models_scale.json`. If any exact Ollama/Hugging Face tag is unavailable, **do not silently substitute**; amend protocol in a new version before running.
3. Offline validation: `python -m unittest discover -s tests -v` and `powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_scale.ps1 -DryRun`.
4. Confirm all model digests + synthetic JSON/BID compatibility: `powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_scale.ps1 -CheckModels` (no official episodes).
5. First smoke pair: `powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_scale.ps1 -Run -ScaleId scale_v1_live -MaxPairs 1 -StopOnInvalid`.
6. After inspecting the trace, resume the same frozen study ID with `-Run -ScaleId scale_v1_live`. Model-specific staged `-ModelLabel` runs are allowed; eight model identities must still be installed to lock the manifest.
7. Do not modify code/model tags/plan between a study's first pair and its last. New versions require new study IDs and new experiments. Examine `analysis.json` invalid/unstarted counts and inspect action-probe traces before interpreting CDEA mechanism.

Offline CI checks Python and PowerShell parsing; **they are not live task or model evidence**.
