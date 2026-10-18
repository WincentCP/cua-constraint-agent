# Verification status — 18 Oct 2026

| Gate | Status |
|---|---|
| WebArena preserved in `webarena-verified-archive` | Created on GitHub |
| OpenApps first-class module, task manifest, Windows CLI | Implemented in migration |
| Upstream OpenApps commit identity | Pinned; live checkout still needs checking |
| OpenApps desktop app manually launched | User-provided `openapps:smoke` reports PASS on 127.0.0.1:5001; does not verify agent |
| OpenBanking pytest | User-provided log: **213 passed**, 4 nonfatal FastAPI deprecation warnings (Windows) |
| Agent end-to-end via local Ollama | **BLOCKED**: user's first PoC errored on model evidence UNKNOWN/empty quote (2026-10-18); input normalization fix committed, retest pending |
| Official score parity with BrowserGym | NOT YET VERIFIED |
| Positive and negative evaluator controls | NOT YET VERIFIED |
| Fresh DB reset and paired state hash | NOT YET VERIFIED |
| 3 public PoC task suitability reviews | PENDING |
| Independent held-out 6 pilot tasks | NOT SELECTED |
| Independent 32 qualifying main task families | NOT SELECTED |
| Pilot/main orchestration and analysis | BLOCKED |
| Complete confirmatory study results | NONE |

The original WebArena methodology and scripts remain on the archival branch. Avoid treating legacy WebArena test success or README docs as evidence of OpenApps success. The new `main` is experimental infrastructure in progress, not a validated completed thesis.

## 2026-10-18 PoC invalid run note

User-supplied error: Ollama returned evidence state `UNKNOWN` with empty quote; strict parser rejected it and the loop aborted. Evaluator reward 0 after this abort is **diagnostic only**, not a valid unsuccessful Baseline episode. Both method arms now use the same UNKNOWN/blank-evidence normalization; no fabricated SATISFIED claims. Restart from a **verified** clean persistent app state before any paired comparison; merely restarting the server may not reset SQLite data. CI and local PoC rerun pending for the fix.

## 2026-10-18 second PoC invalid run: modal interception

User-provided Granite 4.1 Baseline trace: a visible native OpenBanking `dialog[open]` intercepted a click on the background `Return to List of Apps` button. Playwright timed out after 10 seconds. `official_success=null`, hence no valid Baseline task outcome. Both arms now share semantic active-dialog scoping: observe only the visible dialog's AXTree controls while it is open; no force-click and no use of hidden evaluator/DOM data. A browser-level regression test covers foreground-only candidates, modal close, and restoring page controls. **Retest on live OpenApps is pending**. Check `ACTION_ATTEMPT` / `ACTION_ERROR` trajectory events if another control stalls. CI status must be checked separately.
