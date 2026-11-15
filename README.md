# CUA Constraint Agent (CDEA)

> **INTERNAL OBSERVATION ONLY — NOT FOR PRODUCTION USE OR EXTERNAL VALIDATION.**

This repository is an internal research and engineering workspace for observing the CDEA controller, experiment traces, and analysis outputs. It is not a production-ready agent, a validated decision system, or an independently certified benchmark.

Do not use it with real accounts or operational data. Do not treat an evidence-ledger status as proof that a task was completed or that a value was factually verified.

## Known evidence-ledger limitations

The current implementation has limitations that must remain explicit during internal review:

- `public_constraints()` derives constraints from goal text using a limited set of separators. Compound instructions can remain grouped into one constraint even when they require several distinct actions.
- `grounded_evidence()` checks whether a model-provided quote appears in the current accessibility tree (AXTree). Quote presence alone does not establish semantic entailment, successful state mutation, or completion of every action in a compound constraint.
- The evidence record explicitly sets `verified_correctness=false`. Therefore, `SATISFIED` and `REFUTED` in the current ledger must be interpreted as tentative, quote-grounded states—not independently verified outcomes.
- The preserved archive audit records 96 Main Study and 8 Small-Model Study transitions to `SATISFIED`, with no transitions to `REFUTED`. These are transition counts, not factual-verification counts.
- The Main Study source archive does not retain AXTree text observation files. Its quote/hash records therefore cannot be independently reproduced from archived AXTree text. The Small-Model Study archive retains observation artifacts, but one of its eight ledger transitions has no corresponding `grounded_in_axtree=true` evidence entry.
- Small-Model Study `pair_232` (Proposed) has a `SATISFIED` ledger state while its official task outcome is unsuccessful. Ledger status and official task success must be reported separately.
- Main Study and Small-Model Study were produced under different controller commits. Cross-cohort comparisons are descriptive and must not be presented as if both cohorts used an identical controller version.

A passed archive-integrity or notebook-reproduction check confirms internal file consistency; it does **not** independently verify the semantic correctness of ledger entries or attest the original execution host.

## Data and provenance

- `results/provenance.json` is the source of record for archive identities, SHA-256 checksums, selection rules, and recorded validation notes.
- The raw experiment archives and generated output files are intentionally excluded from Git by `.gitignore`. The tracked `output/` folders are placeholders, not complete experiment results.
- Use the exact Main and Small source archives named in the provenance record. Do not substitute the full Scale source archive for the selected Small-Model Study archive.
- `notebooks/main_analysis.ipynb` is the repository's single analysis notebook.

## Offline checks

From the repository root:

```bash
python -m unittest discover -s tests -v
python scripts/analysis/verify_notebook.py
python scripts/browsergym/main.py --dry-run
python scripts/browsergym/small_study.py --dry-run
```

These checks validate code contracts, schedule configuration, and analysis reproducibility with the available fixtures. They do not constitute a new live experiment or prove ledger correctness.

## Change-control rule for ledger work

Do not silently rewrite historical episode records, frozen study plans, source archives, or reported outcomes. A revised live ledger design should be introduced under a new, clearly versioned protocol and output location. Historical episodes may be audited separately using preserved traces, AXTree artifacts where available, SQLite snapshots, and the official task outcome; any post-hoc verification must be labelled as a separate audit rather than a change to the original run.

---

**Repository status: internal observation and review only.**
