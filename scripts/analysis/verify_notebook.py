"""Run the official notebook against synthetic fixtures, never research outcomes."""
import csv
import hashlib
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import zipfile

import nbformat
from nbconvert.preprocessors import ExecutePreprocessor

from audit_archives import audit, read_source

ROOT = Path(__file__).resolve().parents[2]
NOTEBOOK = ROOT / "notebooks" / "main_analysis.ipynb"
GROUPS = [("bank_information", 5), ("cross_app_workflow", 18), ("primitive_control", 9)]
FAMILIES = ("qwen3.5", "ministral3", "granite4.1", "xlam2")


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def csv_bytes(rows):
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue().encode("utf-8")


def make_archive(path, protocol, sizes):
    """Build schema-only fixtures; outcomes are synthetic and CI-only."""
    pairs, episodes = [], []
    index = 0
    for size in sizes:
        for family, large_size, small_size in zip(
            FAMILIES, ("9b", "8b", "8b", "8b"), ("4b", "3b", "3b", "3b")
        ):
            label = family + "-" + (large_size if size == "large" else small_size)
            for category, count in GROUPS:
                for task_idx in range(count):
                    index += 1
                    pair_id = f"pair_{index:03d}"
                    task = f"test_fixture_{category}_{task_idx:02d}"
                    baseline = (task_idx + index // 5) % 4 != 0
                    proposed = (task_idx + index // 7) % 6 != 0
                    pairs.append({
                        "pair_id": pair_id,
                        "task_group": "fixture",
                        "task": task,
                        "stratum": category,
                        "model_label": label,
                        "family": family,
                        "size": size,
                        "pair_status": "paired_small_study_completed",
                        "paired_valid": "true",
                        "baseline_success": str(baseline).lower(),
                        "proposed_success": str(proposed).lower(),
                        "comparable_probe_decisions": 1,
                        "policy_action_divergences": int(baseline != proposed),
                    })
                    for method, success in (("Baseline", baseline), ("Proposed", proposed)):
                        episodes.append({
                            "pair_id": pair_id,
                            "method": method,
                            "task_group": "fixture",
                            "task": task,
                            "stratum": category,
                            "model_label": label,
                            "official_success_raw": str(success).lower(),
                            "paired_analysis_success": str(success).lower(),
                            "episode_valid": "true",
                            "analysis_included": "true",
                            "steps": 6 if method == "Baseline" else 5,
                            "model_calls": 3,
                            "model_seconds": 12.4,
                            "total_seconds": 31.6 if method == "Baseline" else 30.1,
                            "repair_requests": 0,
                            "end_reason": "environment_ended",
                            "episode_artifact": "",
                        })
    manifest = {
        "protocol": protocol,
        "planned_pairs": len(pairs),
        "planned_episodes": len(episodes),
        "controller_git_commit": "TEST_FIXTURE_ONLY",
        "openapps_git_commit": "TEST_FIXTURE_ONLY",
        "shared_parameters": {"seed": 233, "max_steps": 40},
        "pairs": [{"pair_id": row["pair_id"]} for row in pairs],
    }
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        archive.writestr("pairs.csv", csv_bytes(pairs))
        archive.writestr("results.csv", csv_bytes(episodes))


def build_fixture_bundle(work: Path) -> Path:
    main = work / "main_study.zip"
    small = work / "small_model_study.zip"
    make_archive(main, "cdea_main_v1", ("large",))
    make_archive(small, "cdea_small_study", ("small",))

    report = audit(main, small)
    assert report["selected_pairs_total"] == 256

    files = [
        {"path": "main_study.zip", "sha256": _sha(main.read_bytes()), "size_bytes": main.stat().st_size},
        {"path": "small_model_study.zip", "sha256": _sha(small.read_bytes()), "size_bytes": small.stat().st_size},
    ]
    manifest = {"schema_version": 1, "package_id": "ci_fixture_only", "files": files, "derived_files": []}
    bundle_path = work / "dataset_bundle.zip"
    with zipfile.ZipFile(bundle_path, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        bundle.writestr("DATASET_BUNDLE.json", json.dumps(manifest))
        bundle.write(main, "main_study.zip")
        bundle.write(small, "small_model_study.zip")
    return bundle_path


def verify_notebook():
    with TemporaryDirectory(prefix="cdea_notebook_fixture_") as directory:
        work = Path(directory)
        bundle_path = build_fixture_bundle(work)
        notebook = nbformat.read(NOTEBOOK, as_version=4)
        found = False
        for cell in notebook.cells:
            if cell.cell_type == "code" and "DATASET_BUNDLE = 'dataset_bundle.zip'" in cell.source:
                cell.source = cell.source.replace(
                    "DATASET_BUNDLE = 'dataset_bundle.zip'",
                    "DATASET_BUNDLE = " + repr(str(bundle_path)),
                )
                found = True
                break
        assert found, "DATASET_BUNDLE setting was not found in notebook"

        ExecutePreprocessor(timeout=240, kernel_name="python3").preprocess(
            notebook, {"metadata": {"path": str(work)}}
        )
        outputs = work / "analysis_results"
        figures = sorted((outputs / "figures").glob("Gambar_4_*.png"))
        tables = sorted((outputs / "tables").glob("Tabel_4_*.csv"))
        assert [path.name for path in figures] == [f"Gambar_4_{i}.png" for i in range(1, 10)]
        assert [path.name for path in tables] == [f"Tabel_4_{i}.csv" for i in range(1, 7)]
        assert (outputs / "summary" / "ringkasan_statistik.csv").is_file()

        archive_path = work / "analysis_results.zip"
        assert archive_path.is_file()
        with zipfile.ZipFile(archive_path) as result_zip:
            assert result_zip.testzip() is None
            assert any(name.startswith("analysis_results/figures/Gambar_4_1.png")
                       for name in result_zip.namelist())

        detailed = list((outputs / "detailed_analysis").glob("*.csv"))
        assert len(detailed) == 26, sorted(path.name for path in detailed)
        required = {
            "22_task_level_differences.csv",
            "23_task_level_sign_tests.csv",
            "24_episode_efficiency_distribution.csv",
            "25_episode_termination_reasons.csv",
            "26_cdea_loss_pairs.csv",
            "29_failure_trace_audit.csv",
        }
        actual = {path.name for path in detailed}
        assert required.issubset(actual), sorted(required - actual)

        with (outputs / "detailed_analysis" / "23_task_level_sign_tests.csv").open(encoding="utf-8") as stream:
            tests = list(csv.DictReader(stream))
        assert {(row["study"], row["cohort"]) for row in tests} == {
            ("Main Study", "primary_bank_5_tasks"),
            ("Main Study", "all_32_tasks"),
            ("Small-Model Study", "all_32_tasks"),
        }
        for row in tests:
            assert int(row["improved_tasks"]) + int(row["worsened_tasks"]) + int(row["tied_tasks"]) == int(row["unique_tasks"])
            assert 0 <= float(row["exact_sign_test_p_two_sided"]) <= 1

        with (outputs / "detailed_analysis" / "24_episode_efficiency_distribution.csv").open(encoding="utf-8") as stream:
            efficiencies = list(csv.DictReader(stream))
        assert len(efficiencies) == 4
        assert all(int(row["episode_rows"]) == 128 and int(row["max_steps_setting"]) == 40 for row in efficiencies)
        assert all(int(row["episodes_reaching_cap"]) == 0 for row in efficiencies)

        with (outputs / "detailed_analysis" / "25_episode_termination_reasons.csv").open(encoding="utf-8") as stream:
            terminations = list(csv.DictReader(stream))
        assert sum(int(row["episodes"]) for row in terminations) == 512

        with (outputs / "detailed_analysis" / "26_cdea_loss_pairs.csv").open(encoding="utf-8") as stream:
            loss_pairs = list(csv.DictReader(stream))
        with (outputs / "detailed_analysis" / "29_failure_trace_audit.csv").open(encoding="utf-8") as stream:
            failure_audit = list(csv.DictReader(stream))
        assert len(failure_audit) == 2 * len(loss_pairs)
        assert all(row["cause_verified"].lower() == "false" for row in failure_audit)
        assert all(row["trace_available"].lower() == "false" for row in failure_audit)

        print("PASS dataset bundle fixture: 6 tables, 9 figures, 26 detailed CSVs, one notebook")


if __name__ == "__main__":
    verify_notebook()
