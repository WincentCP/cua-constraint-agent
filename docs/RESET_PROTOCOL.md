# Persistent Shopping reset and experiment fairness protocol

## Why this is a hard gate

Playwright's `browser.newContext()` isolates cookies, but **does not reset database state** in the Shopping website: carts, orders, reviews and account addresses can persist. The pinned WebArena-Verified v1.2.3 README documents `env start` and `env stop`; these commands **must not be assumed** to recreate a pristine persistent database. No automated restore/reset procedure has yet been validated on the target laptop.

**Do not collect pilot or main comparison scores until a real restore procedure is demonstrated.** If the shipped image cannot be deterministically reset, stop and redesign the experiment with supervisor approval.

## Minimal manual verification (before pilot)

1. Use **Shopping only** from WebArena-Verified v1.2.3; record environment version, Docker container/image identity, browser/Playwright version, wall time and model digest.
2. Document the initial data state relevant to each task: initial cart contents, target account addresses, test orders and review state using visible UI or an authorized environment-level restoration check. Never expose benchmark reference answers to the agent.
3. Produce a controlled test mutation on the development PoC environment (not a main task): e.g. modify cart or a disposable test field and record it, including screenshots/log.
4. Restore from the **known baseline snapshot/volume/database image** through a tested mechanism supported by your local deployment. Do **not** rely on browser session changes or `env stop/start` as proof.
5. Reopen via a fresh browser context and verify the mutation is gone and all relevant starting conditions match the baseline. Record image/volume checksum or environment provenance and observed UI state.
6. Repeat the restore twice; confirm reproducibility after both Baseline and Proposed episodes, including failure/timeout exits. Record exact commands in a private reset log without credentials or hidden evaluator references.
7. Define fixed run-order allocation (balance Baseline first vs Proposed first for task/model pairs), action budgets, repetitions (one registered episode per cell), failure/timeouts and retry rule **before running pilot**.
8. Save the reset protocol and test proof locally under `reports/pilot/`, and link relevant proof files in screening JSON. The frozen main identity must include a SHA-256 checksum of real reset evidence.

`--fresh-environment-confirmed` is only a **human attestation**, never verification of database reset. Likewise, approving all checklist checkboxes only records human review—it cannot independently prove a site is clean.

## If reset is not achievable

Do not attempt to compensate by switching methods in place or manually deleting only visible cart items. That leaves hidden history mutated and biases task success. Escalate to supervisor, choose a benchmark setup with a guaranteed reset or redefine the task pool before main. Preserve failed reset logs as PoC findings.

## Security

Session/cookie/auth headers may be present in HAR. Preserve raw HAR on the local device; redact any screenshot or attachment shared outside the research archive. Never commit a live session or private order record to GitHub. The Colab notebook consumes only sanitized CSV.
