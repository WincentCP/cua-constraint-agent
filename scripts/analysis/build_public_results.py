"""Build thesis-facing CSV results from the clean CDEA dataset bundle.

This script does not run experiments or modify source archives. It verifies the
Main Study and Small-Model Study inputs independently and writes deterministic
result tables from those two study archives.
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
BUNDLE_MANIFEST = "DATASET_BUNDLE.json"
REQUIRED_DERIVED = {
    "success_by_model.csv": ("derived/lampiran_D_per_model_8.csv", 8),
    "success_by_task.csv": ("derived/lampiran_E_per_task_32.csv", 32),
    "model_size_comparison_by_task.csv": ("derived/lampiran_E4_ukuran_model_32.csv", 32),
    "small_model_higher_uplift_tasks.csv": ("derived/analisis_peningkatan_cdea_small_5.csv", 5),
    "small_model_success_comparison_examples.csv": ("derived/tabel_4_7_small_menang_6.csv", 6),
}


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _read_csv_bytes(data: bytes) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(data.decode("utf-8-sig"))))


def _read_nested_csv(payload: bytes, suffix: str) -> list[dict[str, str]]:
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        if archive.testzip() is not None:
            raise ValueError(f"Nested archive is corrupt while reading {suffix}")
        matches = [name for name in archive.namelist() if name.endswith(suffix)]
        if len(matches) != 1:
            raise ValueError(f"Expected one nested archive member ending in {suffix!r}; found {len(matches)}")
        return _read_csv_bytes(archive.read(matches[0]))


def _nested_manifest(payload: bytes, expected_protocol: str, label: str) -> dict:
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        if archive.testzip() is not None:
            raise ValueError(f"{label} ZIP integrity check failed")
        matches = [name for name in archive.namelist()
                   if name.endswith("manifest.json") and name.count("/") <= 1]
        if len(matches) != 1:
            raise ValueError(f"{label} must contain exactly one manifest.json")
        manifest = json.loads(archive.read(matches[0]))
    if manifest.get("protocol") != expected_protocol:
        raise ValueError(f"{label} protocol mismatch: {manifest.get('protocol')!r}")
    return manifest


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
        if {row.get("method") for row in rows} != {"Baseline", "Proposed"}:
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
    for field in ("baseline_success", "proposed_success"):
        if _as_bool(selected.get(field)) != _as_bool(source.get(field)):
            raise ValueError(f"{field} mismatch for {source_name}:{selected['source_pair_id']}")


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
    if denominator <= 0:
        raise ValueError("Percentage denominator must be positive")
    value = (Decimal(numerator) * Decimal("100") / Decimal(denominator)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return format(value, ".2f")


def _write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    if not rows:
        raise ValueError(f"Cannot write an empty CSV: {path.name}")
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def build(package_path: Path, output_dir: Path, *, skip_package_hash_check: bool = False) -> dict:
    if not package_path.is_file():
        raise FileNotFoundError(package_path)
    package_bytes = package_path.read_bytes()
    package_sha = _sha256(package_bytes)
    output_dir.mkdir(parents=True, exist_ok=True)

    provenance_path = output_dir / "provenance.json"
    if provenance_path.is_file() and not skip_package_hash_check:
        provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
        expected = provenance.get("dataset_package", {}).get("sha256")
        if expected and package_sha != expected:
            raise ValueError("Dataset bundle SHA-256 does not match results/provenance.json")

    with zipfile.ZipFile(io.BytesIO(package_bytes)) as bundle:
        if bundle.testzip() is not None:
            raise ValueError("Dataset bundle ZIP integrity check failed")
        names = set(bundle.namelist())
        if BUNDLE_MANIFEST not in names:
            raise ValueError(f"{BUNDLE_MANIFEST} is missing")
        metadata = json.loads(bundle.read(BUNDLE_MANIFEST))
        records = {item["path"]: item for item in metadata.get("files", [])}
        required_archives = {
            "main_study.zip": "cdea_main_v1",
            "small_model_study.zip": "cdea_small_study",
        }
        payloads: dict[str, bytes] = {}
        manifests: dict[str, dict] = {}
        for member, protocol in required_archives.items():
            if member not in names or member not in records:
                raise ValueError(f"Required dataset archive missing: {member}")
            payload = bundle.read(member)
            if _sha256(payload) != records[member]["sha256"]:
                raise ValueError(f"SHA-256 mismatch: {member}")
            if len(payload) != int(records[member]["size_bytes"]):
                raise ValueError(f"Size mismatch: {member}")
            payloads[member] = payload
            manifests[member] = _nested_manifest(payload, protocol, member)

        for item in metadata.get("derived_files", []):
            member = item["path"]
            if member not in names:
                raise ValueError(f"Derived dataset file missing: {member}")
            if _sha256(bundle.read(member)) != item["sha256"]:
                raise ValueError(f"Derived dataset SHA-256 mismatch: {member}")

        selected_member = "derived/selected_pairs.csv"
        if selected_member not in names:
            raise ValueError("derived/selected_pairs.csv is missing")
        selected = _read_csv_bytes(bundle.read(selected_member))
        derived_payloads = {
            output_name: bundle.read(source_path)
            for output_name, (source_path, _) in REQUIRED_DERIVED.items()
        }

    main_manifest = manifests["main_study.zip"]
    small_manifest = manifests["small_model_study.zip"]
    for label, manifest in (("Main Study", main_manifest), ("Small-Model Study", small_manifest)):
        if int(manifest.get("planned_pairs", -1)) != 128 or int(manifest.get("planned_episodes", -1)) != 256:
            raise ValueError(f"{label} archive must declare 128 pairs and 256 episodes")

    main_pairs_rows = _read_nested_csv(payloads["main_study.zip"], "pairs.csv")
    main_results_rows = _read_nested_csv(payloads["main_study.zip"], "results.csv")
    small_pairs_rows = _read_nested_csv(payloads["small_model_study.zip"], "pairs.csv")
    main_pairs = {row["pair_id"]: row for row in main_pairs_rows}
    main_decisions = aggregate_main_decisions(main_results_rows)
    small_pairs = {row["pair_id"]: row for row in small_pairs_rows}

    if len(main_pairs) != 128 or len(main_decisions) != 128:
        raise ValueError("Main Study source must contain 128 pairs and 128 pair-level decision records")
    if len(small_pairs) != 128 or any(row.get("size") != "small" for row in small_pairs.values()):
        raise ValueError("Small-Model Study archive must contain exactly 128 Small pairs")

    if len({row.get("selected_pair_id") for row in selected}) != len(selected):
        raise ValueError("Selected pair IDs must be unique")
    if any(not _as_bool(row.get("paired_valid")) for row in selected):
        raise ValueError("The selected publication dataset must contain only valid pairs")

    main_selected = [row for row in selected if row.get("source_archive") == "main_study.zip"]
    small_selected = [row for row in selected if row.get("source_archive") == "small_model_study.zip"]
    if len(main_selected) != SELECTED_PER_GROUP or len(small_selected) != SELECTED_PER_GROUP or len(selected) != 256:
        raise ValueError("Selected dataset must contain 128 Main Study and 128 Small-Model Study pairs")

    for row in selected:
        source_pair_id = row["source_pair_id"]
        if row.get("source_archive") == "main_study.zip":
            source = main_pairs.get(source_pair_id)
            decisions = main_decisions.get(source_pair_id)
            if source is None or decisions is None or row.get("size") != "large":
                raise ValueError(f"Missing Main source record for {source_pair_id}")
            _check_selected_pair(row, source, "Main Study")
            row["comparable_probe_decisions"] = str(decisions["comparable_probe_decisions"])
            row["policy_action_divergences"] = str(decisions["policy_action_divergences"])
        elif row.get("source_archive") == "small_model_study.zip":
            source = small_pairs.get(source_pair_id)
            if source is None or row.get("size") != "small":
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
    _write_csv(decision_path, summary_rows)

    source_table_hashes = {}
    for output_name, payload in derived_payloads.items():
        rows = _read_csv_bytes(payload)
        expected_rows = REQUIRED_DERIVED[output_name][1]
        if len(rows) != expected_rows:
            raise ValueError(f"{output_name} must contain {expected_rows} rows")
        if output_name in {"success_by_model.csv", "success_by_task.csv"}:
            for row in rows:
                denominator = int(row["n"])
                baseline = int(row["baseline_n"])
                proposed = int(row["proposed_n"])
                row["baseline_pct"] = _round_percentage(baseline, denominator)
                row["proposed_pct"] = _round_percentage(proposed, denominator)
                row["delta_pp"] = _round_percentage(proposed - baseline, denominator)
        path = output_dir / output_name
        _write_csv(path, rows)
        source_table_hashes[output_name] = _sha256(path.read_bytes())

    outputs = {
        "pair_outcomes.csv.gz": _sha256(pair_outcomes_path.read_bytes()),
        "decision_comparison_by_group.csv": _sha256(decision_path.read_bytes()),
        **source_table_hashes,
    }
    build_manifest = {
        "dataset_bundle": package_path.name,
        "dataset_bundle_sha256": package_sha,
        "selected_pairs": len(selected),
        "selected_episodes": 512,
        "source_archives": {
            name: {"sha256": _sha256(payload), "size_bytes": len(payload)}
            for name, payload in payloads.items()
        },
        "outputs": outputs,
        "decision_summary": summary_rows,
        "scope": "Derived result tables; source archives are read-only and are not modified.",
    }
    (output_dir / "build_manifest.json").write_text(
        json.dumps(build_manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return build_manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, default=Path("dataset_bundle.zip"))
    parser.add_argument("--output-dir", type=Path, default=Path("results"))
    parser.add_argument("--skip-package-hash-check", action="store_true")
    args = parser.parse_args()
    print(json.dumps(build(args.package, args.output_dir,
                           skip_package_hash_check=args.skip_package_hash_check),
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
