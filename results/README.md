# CDEA Research Results

This directory contains the verified, thesis-facing result tables extracted
from the supplied master archive.

## Tables
- `success_by_model.csv`: success counts and percentages by model.
- `success_by_task.csv`: success counts and percentages by task.
- `model_size_comparison_by_task.csv`: descriptive comparison by task and model size.
- `decision_comparison_by_group.csv`: comparable-decision and action-divergence counts.
- `small_model_higher_uplift_tasks.csv`: tasks with higher uplift in the Small group.
- `small_model_success_comparison_examples.csv`: selected cross-size comparison examples.
- `build_manifest.json`: source archive checksums and output checksums.

The result tables are derived from the Main Study and Small-Model Study archives.
The raw `dataset_bundle.zip` is not included in this commit; keep the master
archive as the source copy. The bundle is required to rebuild the tables with
`scripts/analysis/build_public_results.py`.
