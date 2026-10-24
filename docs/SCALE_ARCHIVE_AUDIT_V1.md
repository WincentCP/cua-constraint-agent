# Scale Study v1 — source-compatibility and provenance review

**Review date:** 2026-10-24. **Subject:** researcher-supplied `scale_reference_v2(1).zip` (SHA-256 `911f145e3c0506d2a27da427e08ebbcefb2b94a868c5aa2c09ec314f648d9b41`). This is a read-only evaluation; the original archive was not modified.

## Independent checks and status

| Audit layer | Finding |
|---|---|
| ZIP CRC and 4,875 listed file digests | PASS (internal integrity only) |
| 256 pairs, 512 episodes, 64 summary rows | PASS (internal reconciliation) |
| Paired outcomes and reported probe metadata | PASS (recalculation only) |
| Source-compatibility of recorded controller constraints | FAIL |
| Source-compatibility of Todo databases | FAIL |
| Official task/evaluator consistency | FAIL for inspected canary |
| Independent execution-host attestation | NOT PROVIDED / NOT VERIFIED |

The ordinary numerical auditor `scripts/browsergym/audit_scale_archive.py` and compatibility auditor `scripts/browsergym/audit_scale_compatibility.py` address different questions. A zero exit code from a numerical check never certifies live execution. A compatibility PASS would still not prove provenance.

## Reproduced incompatibilities

1. Controller `shared_policy.public_constraints()` in pinned commit `0cf0a376f51d9a9717eb58c1c3b1974119fdcaea` derives lowercase IDs (`c1`, `c2`, …) and `description` from each actual public goal. All 512 archived episodes use uppercase `C1`, `C2` with generic `text` content. The 290 episodes containing `candidate_probes` use references that cannot pass the frozen controller's exact membership check; all 512 trace ledgers likewise use incompatible IDs.
2. The pinned upstream OpenApps Todo model uses `id`, `title`, `done`. All 512 archived `todo.db` snapshots contain a different `todos` schema (including `completed` instead of `done`).
3. The pinned official task `longer_horizon/gym_todo_and_message_bob` requires the exact Todo title `Renew gym membership` and a specified message to Bob. Sixteen archived public-goal records for this task omit the official goal specifics. One inspected purported success (`pair_009/Proposed`) stores generic task text in its Todo database and cannot be treated as an authenticated official evaluator success.
4. Git blob fingerprints against controller commit `0cf0a376...` **FAIL** for archived `config/scale_plan.json` (`ce507782...` vs pinned `be7d37f5...`) and `config/main_taskset_v1.json` (`65f9cdc2...` vs pinned `3512c0dd...`). `config/models_scale.json` matches (`30213fee...`). All three archived SHA-256 values match the archive's own manifest; internal checks are not source authentication.
5. All 512 archived `server/logs/config.yaml` files lack the `apps:` section produced by the pinned upstream Hydra configuration; 327 of 512 episodes contain request-log routes absent from the pinned OpenApps implementation, including `/todo/items` and `/openbanking/accounts/acct_001`. These are independently checkable source incompatibilities.
6. All 512 server logs are seven-line structured records, and request timestamps correspond exactly to trace timestamps. These patterns merit inspection of independent host evidence; the logs alone do not prove they are original server output.

### Reproduce the read-only source checks

~~~powershell
python .\scripts\browsergym\audit_scale_archive.py '.\scale_reference_v2(1).zip' --report .\scale_numeric_audit.json
python .\scripts\browsergym\audit_scale_compatibility.py '.\scale_reference_v2(1).zip' --report .\scale_source_audit.json --require-compatible
~~~

The second command deliberately returns exit code **3** for this archive because it fails the pinned source contracts. The source auditor is intentionally limited to two named pinned commits; unknown commits yield **unassessed**, not false PASS. Raw accessibility-tree verification, Ollama digest attestation, and full replay of official evaluators remain out of scope.

### Source references

- [Pinned controller policy](https://github.com/WincentCP/cua-constraint-agent/blob/0cf0a376f51d9a9717eb58c1c3b1974119fdcaea/scripts/browsergym/shared_policy.py)
- [Pinned controller runner](https://github.com/WincentCP/cua-constraint-agent/blob/0cf0a376f51d9a9717eb58c1c3b1974119fdcaea/scripts/browsergym/matched_dev.py)
- [Pinned OpenApps Todo model](https://github.com/facebookresearch/OpenApps/blob/6e6782794433c60468d65ac75bc3f03c56007f8c/src/open_apps/apps/todo_app/main.py)
- [Pinned official task definition](https://github.com/facebookresearch/OpenApps/blob/6e6782794433c60468d65ac75bc3f03c56007f8c/config/tasks/longer_horizon.yaml)
- [Pinned OpenApps task evaluator](https://github.com/facebookresearch/OpenApps/blob/6e6782794433c60468d65ac75bc3f03c56007f8c/src/open_apps/tasks/tasks.py)

## Decision for the thesis

**Source and statistical analysis can be frozen; live-results substantiation cannot yet be signed off.** Preserve this reference archive as-is and retain the recorded descriptive outcomes with their provenance qualification. Resolve by executing and documenting genuine OpenApps/BrowserGym episodes on the pinned software and checking expected goals, initial state, source schema, action traces, and official evaluator reward. Do not manufacture/modify provenance or retroactively change frozen study IDs to make the archive appear live.