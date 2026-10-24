# Archived full-Scale v1: historical reference only

This directory preserves the former **eight-checkpoint (4 small + 4 large)** Scale v1 experiment implementation, configuration, reports, and optional runtime-audit utilities. It is retained as a historical source reference; **it is not part of the active runner, notebook selection, or default CI tests**.

The current study uses:
- Frozen Main results for all four Large checkpoints.
- Only the Small checkpoint outcomes from the previously supplied `scale_reference_v4.zip`.
- For new Small-only experiments: `config/small_extension_plan.json`, `config/models_small_extension.json`, `scripts/browsergym/small_extension.py`, and `scripts/browsergym/run_small_extension.ps1`.

Do not run archived scripts from this directory without checking out their **original frozen controller commit**. The archived paths are historical copies and are not maintained as a working runtime configuration. Any audit or historical execution claim must be supported by original records; these files are not a substitute for such records.

The original data archives are not stored in Git and have not been modified. Their recorded numerical results must not be edited, relabeled, or presented as newly executed tasks. 
