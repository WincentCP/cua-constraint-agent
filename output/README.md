# Experiment output tracking

This directory contains runtime artifacts produced by the CDEA experiment runners.

## Tracked study outputs

- `output/main/<main_id>/`: Main Study manifest, model digests, pair records, episode JSON, observations/traces, server logs, database snapshots, and generated CSV/analysis summaries.
- `output/small_study/<study_id>/`: Small-Model Study equivalents.
- `output/pilot/<pilot_id>/`: pilot run evidence when retained.
- `output/preflight/main_models/`: model action-contract and preflight evidence.

These outputs are intentionally **not ignored** by `.gitignore`. After a run, inspect the generated artifacts and add the relevant run directory explicitly:

```powershell
git status --short
git add output/main/<main_id>
git add output/small_study/<study_id>
git commit -m "Add CDEA experiment run outputs"
git push origin main
```

Replace the placeholders with the actual run IDs. Do not commit active run lock files or temporary `.tmp` files; those remain ignored.

## Important

Git does not automatically upload generated files. Removing the blanket ignore rule makes them eligible for tracking; they still need to be reviewed, staged, committed, and pushed.

Before committing a run, check repository size and inspect logs/observations for credentials or other sensitive data. Large run outputs can make repository history grow quickly. The compact source dataset bundle and the expanded runtime folders should not both be committed if they contain duplicate copies of the same artifacts.
