"""Build the published pair-level result tables from the supplied CDEA package.

This script does not run experiments or modify the source archive. It restores
Main Study decision-comparison metrics from the two episode rows per pair and
checks that the Scale metrics match the Scale pair records.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
import zipfile

MAIN_GROUP = "Main Study"
SMALL_GROUP = "Small-Model Study"
SELECTED_PER_GROUP = 128


def _find_one(names: list[str], suffix: str) -> str:
    matches = [name for name in names if name.endswith(suffix)]
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one package member ending in {suffix!r}; found {len(matches)}")
    return matches[0]


def _read_csv_member(archive: zipfile.ZipFile, member: str) -> list[dict[str, str]]:
    raw = archive.read(member).decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(raw)))


def _as_bool(value: str | bool | None) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "1", "yes"}


def _as_nonnegative_int(value: str | int | None, *, field: str) -> int:
    try:
        result = int(value or 0)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid integer in {field}: {value!r}") from exc
    if result < 0:
        raise ValueError(f"Negative value in {field}: {value!r}")
    return result


def aggregate_main_decisions(main_episode_rows: list[dict[str, str]]) -> dict[str, dict[str, int]]:
    """Aggregate pair-level Main metrics, checking mirrored arm records."""
    by_pair: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in main_episode_rows:
        by_pair[row["pair_id"]].append(row)

    aggregated: dict[str, dict[str, int]] = {}
    for pair_id, rows in by_pair.items():
        if len(rows) != 2:
            raise ValueError(f"Main pair {pair_id} must have exactly two episode rows")
        methods = {row.get("method") for row in rows}
        if methods != {"Baseline", "Proposed"}:
            raise ValueError(f"Main pair {pair_id} must contain Baseline and Proposed rows")

        metrics: dict[str, int] = {}
        for field in ("comparable_probe_decisions", "policy_action_divergences"):
            values = {_as_nonnegative_int(row.get(field), field=field) for row in rows}
            if len(values) != 1:
                raise ValueError(f"Mirrored Main values differ for {pair_id}: {field}={values}")
            metrics[field] = values.pop()
        if metrics["policy_action_divergences"] > metrics["comparable_probe_decisions"]:
            raise ValueError(f"Main pair {pair_id} has more divergences than comparable decisions")
        aggregated[pair_id] = metrics
    return aggregated


def _check_selected_pair(selected: dict[str, str], source: dict[str, str], source_name: str) -> None:
    if _as_bool(selected.get("paired_valid")) != _as_bool(source.get("paired_valid")):
        raise ValueError(f"Validity mismatch for {source_name}:{selected['source_pair_id']}")
    for selected_field, source_field in (
        ("baseline_success", "baseline_success"),
        ("proposed_success", "proposed_success"),
    ):
        if _as_bool(selected.get(selected_field)) != _as_bool(source.get(source_field)):
            raise ValueError(f"{selected_field} mismatch for {source_name}:{selected['source_pair_id']}")


def summarize_decisions(group_name: str, rows: list[dict[str, str]]) -> dict[str, int | str]:
    valid_rows = [row for row in rows if _as_bool(row.get("paired_valid"))]
    comparable = sum(
        _as_nonnegative_int(row.get("comparable_probe_decisions"), field="comparable_probe_decisions") > 0
        for row in valid_rows
    )
    divergent = sum(
        _as_nonnegative_int(row.get("policy_action_divergences"), field="policy_action_divergences") > 0
        for row in valid_rows
    )
    if divergent > comparable:
        raise ValueError(f"{group_name}: divergent pairs exceed comparable pairs")
    return {
        "study_group": group_name,
        "valid_pairs": len(valid_rows),
        "pairs_with_comparable_decisions": comparable,
        "pairs_with_different_actions": divergent,
        "pairs_with_same_action_when_comparable": comparable - divergent,
        "pairs_without_comparable_decision": len(valid_rows) - comparable,
    }


def _round_percentage(numerator: int, denominator: int) -> str:
    """Format a rate or difference using decimal ROUND_HALF_UP to 2 places."""
    if denominator <= 0:
        raise ValueError("Percentage denominator must be positive")
    value = (Decimal(numerator) * Decimal("100") / Decimal(denominator)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return format(value, ".2f")


def publish_source_tables(package: zipfile.ZipFile, names: list[str], output_dir: Path) -> dict[str, str]:
    """Publish thesis-facing CSVs from the exact derived files in the dataset package."""
    sources = {
        "success_by_model.csv": "derived/lampiran_D_per_model_8.csv",
        "success_by_task.csv": "derived/lampiran_E_per_task_32.csv",
        "model_size_comparison_by_task.csv": "derived/lampiran_E4_ukuran_model_32.csv",
        "small_model_higher_uplift_tasks.csv": "derived/analisis_peningkatan_cdea_small_5.csv",
        "small_model_success_comparison_examples.csv": "derived/tabel_4_7_small_menang_6.csv",
    }
    hashes: dict[str, str] = {}
    for output_name, source_suffix in sources.items():
        rows = _read_csv_member(package, _find_one(names, source_suffix))
        expected_rows = {
            "success_by_model.csv": 8,
            "success_by_task.csv": 32,
            "model_size_comparison_by_task.csv": 32,
            "small_model_higher_uplift_tasks.csv": 5,
            "small_model_success_comparison_examples.csv": 6,
        }[output_name]
        if len(rows) != expected_rows:
            raise ValueError(f"{output_name} must contain {expected_rows} rows")

        if output_name in {"success_by_model.csv", "success_by_task.csv"}:
            for row in rows:
                denominator = int(row["n"])
                baseline = int(row["baseline_n"])
                cdea = int(row["proposed_n"])
                row["baseline_pct"] = _round_percentage(baseline, denominator)
                row["proposed_pct"] = _round_percentage(cdea, denominator)
                row["delta_pp"] = _round_percentage(cdea - baseline, denominator)

        output_path = output_dir / output_name
        with output_path.open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
        hashes[output_name] = hashlib.sha256(output_path.read_bytes()).hexdigest()
    return hashes


def build(package_path: Path, output_dir: Path, *, skip_package_hash_check: bool = False) -> dict:
    if not package_path.is_file():
        raise FileNotFoundError(package_path)
    package_sha = hashlib.sha256(package_path.read_bytes()).hexdigest()
    output_dir.mkdir(parents=True, exist_ok=True)

    provenance_path = output_dir / "provenance.json"
    if provenance_path.is_file() and not skip_package_hash_check:
        provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
        expected = provenance.get("dataset_package", {}).get("sha256")
        if expected and package_sha != expected:
            raise ValueError("Dataset package SHA-256 does not match results/provenance.json")

    with zipfile.ZipFile(package_path) as package:
        if package.testzip() is not None:
            raise ValueError("Dataset package ZIP integrity check failed")
        names = package.namelist()
        selected_member = _find_one(names, "/derived/selected_pairs.csv")
        main_pairs_member = _find_one(names, "/main_observation/main_observation_v1/pairs.csv")
        main_results_member = _find_one(names, "/main_observation/main_observation_v1/results.csv")
        scale_pairs_member = _find_one(names, "/scale_reference/scale_reference_v4/pairs.csv")

        selected = _read_csv_member(package, selected_member)
        main_pairs = {row["pair_id"]: row for row in _read_csv_member(package, main_pairs_member)}
        main_decisions = aggregate_main_decisions(_read_csv_member(package, main_results_member))
        scale_pairs = {row["pair_id"]: row for row in _read_csv_member(package, scale_pairs_member)}

    if len(main_pairs) != SELECTED_PER_GROUP or len(main_decisions) != SELECTED_PER_GROUP:
        raise ValueError("Main source must contain 128 pairs and 128 pair-level decision records")
    if sum(row.get("size") == "small" for row in scale_pairs.values()) != SELECTED_PER_GROUP:
        raise ValueError("Scale source must contain exactly 128 Small pairs")

    if len({row.get("selected_pair_id") for row in selected}) != len(selected):
        raise ValueError("Selected pair IDs must be unique")
    if any(not _as_bool(row.get("paired_valid")) for row in selected):
        raise ValueError("The selected publication dataset must contain only valid pairs")

    main_selected = [row for row in selected if row.get("source_archive") == "main_observation.zip"]
    small_selected = [
        row for row in selected
        if row.get("source_archive") == "scale_reference.zip" and row.get("size") == "small"
    ]
    if (
        len(main_selected) != SELECTED_PER_GROUP
        or len(small_selected) != SELECTED_PER_GROUP
        or len(selected) != 2 * SELECTED_PER_GROUP
    ):
        raise ValueError("Selected dataset must contain 128 Main Large and 128 Small-Model Study pairs")

    for row in selected:
        source_pair_id = row["source_pair_id"]
        if row.get("source_archive") == "main_observation.zip":
            source = main_pairs.get(source_pair_id)
            decisions = main_decisions.get(source_pair_id)
            if source is None or decisions is None:
                raise ValueError(f"Missing Main source record for {source_pair_id}")
            _check_selected_pair(row, source, "Main")
            row["comparable_probe_decisions"] = str(decisions["comparable_probe_decisions"])
            row["policy_action_divergences"] = str(decisions["policy_action_divergences"])
        elif row.get("source_archive") == "scale_reference.zip" and row.get("size") == "small":
            source = scale_pairs.get(source_pair_id)
            if source is None or source.get("size") != "small":
                raise ValueError(f"Missing Small-Model Study source record for {source_pair_id}")
            _check_selected_pair(row, source, "Small-Model Study")
            for field in ("comparable_probe_decisions", "policy_action_divergences"):
                if _as_nonnegative_int(row.get(field), field=field) != _as_nonnegative_int(source.get(field), field=field):
                    raise ValueError(f"{field} mismatch for Small-Model Study:{source_pair_id}")
        else:
            raise ValueError(f"Unexpected selected source or size: {row.get('source_archive')} / {row.get('size')}")

    if len({row["task"] for row in main_selected}) != 32 or len({row["task"] for row in small_selected}) != 32:
        raise ValueError("Each selected group must contain the same 32 unique tasks")
    if {row["task"] for row in main_selected} != {row["task"] for row in small_selected}:
        raise ValueError("Main and Small task rosters differ")

    summary_rows = [
        summarize_decisions(MAIN_GROUP, main_selected),
        summarize_decisions(SMALL_GROUP, small_selected),
    ]
    expected = [(48, 33, 15, 80), (75, 49, 26, 53)]
    for row, counts in zip(summary_rows, expected):
        actual = (
            row["pairs_with_comparable_decisions"],
            row["pairs_with_different_actions"],
            row["pairs_with_same_action_when_comparable"],
            row["pairs_without_comparable_decision"],
        )
        if actual != counts:
            raise ValueError(f"Unexpected decision comparison counts for {row['study_group']}: {actual}")

    pair_outcomes_path = output_dir / "pair_outcomes.csv.gz"
    pair_buffer = io.StringIO(newline="")
    pair_writer = csv.DictWriter(pair_buffer, fieldnames=list(selected[0]), lineterminator="\n")
    pair_writer.writeheader()
    pair_writer.writerows(selected)
    with pair_outcomes_path.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0) as compressed:
            compressed.write(pair_buffer.getvalue().encode("utf-8"))

    decision_path = output_dir / "decision_comparison_by_group.csv"
    with decision_path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(summary_rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(summary_rows)

    with zipfile.ZipFile(package_path) as package:
        source_table_hashes = publish_source_tables(package, package.namelist(), output_dir)

    return {
        "package_sha256": package_sha,
        "selected_pairs": len(selected),
        "outputs": {
            "pair_outcomes.csv.gz": hashlib.sha256(pair_outcomes_path.read_bytes()).hexdigest(),
            "decision_comparison_by_group.csv": hashlib.sha256(decision_path.read_bytes()).hexdigest(),
            **source_table_hashes,
        },
        "decision_summary": summary_rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, default=Path("Dataset_CDEA_small_only.zip"))
    parser.add_argument("--output-dir", type=Path, default=Path("results"))
    parser.add_argument("--skip-package-hash-check", action="store_true")
    args = parser.parse_args()
    print(json.dumps(build(args.package, args.output_dir, skip_package_hash_check=args.skip_package_hash_check), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
