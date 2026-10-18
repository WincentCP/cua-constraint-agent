# Risks and next engineering milestones

1. **Upstream official runner is Bash-specific.** Its `launch_apps_via_shell()` uses `/bin/bash`, so the new runner calls the official task evaluator through a Windows-compatible Python bridge. External parity validation is compulsory.
2. **The current accessibility agent is intentionally minimal.** It can click buttons/links and fill simple textbox or select a combobox. It cannot yet guarantee calendar widgets, rich editors, app-specific custom controls, or reliable alternative probes for CDEA. A failed task may be a control-execution failure, not a CDEA failure.
3. **OpenApps task stock may be too small for 32 independent evidence-seeking task families.** The long-horizon file has 100 composites but most contain all answer values directly in their goals. Stop before pilot if task pool does not meet research question.
4. **Reset is a hard scientific requirement.** The runner takes a trusted state fingerprint but does not implement new DB reset orchestration. Both methods must restart from equivalent persistent state; `--fresh-state-confirmed` is a manual PoC acknowledgment, not proof.
5. **Prompt/context controlledness.** Current shared prompt has 14k snapshot truncation and an iterative evidence ledger; large app pages and simplistic hint matching can bias CDEA.
6. **Model tags/VRAM/time.** Four local Q4 models require actual availability and immutable digest checks on the warnet PC. Do not pretend 256 real episodes have been collected.
7. **Reproducibility.** All source and config changes after screening require a new protocol version and rerun of development validations.
8. **Current 32-task analysis notebook was WebArena-specific**, retained only on archive branch. OpenApps analysis and export must be implemented and verified **before** pilot/main; no statistical output exists now.
9. **Environment portability.** Python deps may differ across native Windows, Linux; pin upstream version, capture Python/Node/Git SHA, package manifests and exact environment outputs.
10. **Data access.** Keep `output/`, `.env`, state snapshots and HTTP HAR private; avoid publishing passwords or personal data.
