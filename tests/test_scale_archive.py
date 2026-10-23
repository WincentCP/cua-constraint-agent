"""Offline checks for truthful Scale archive reporting."""
import csv
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/browsergym"))
import audit_scale_archive as scale_audit


def write_csv(path, fields, rows):
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def build_archive(root, invalid_count=7):
    directory = Path(root)
    pair_rows = []
    result_rows = []
    scheduled = []
    for i in range(1, 257):
        pid = f"pair_{i:03d}"
        is_valid = i > invalid_count
        scheduled.append({"pair_id": pid})
        pair_rows.append({"pair_id": pid,
                          "paired_valid": str(is_valid),
                          "pair_status": "paired_scale_completed" if is_valid else "invalid_pair",
                          "baseline_success": "False" if is_valid else "",
                          "proposed_success": "False" if is_valid else ""})
        for method in ("Baseline", "Proposed"):
            result_rows.append({"pair_id": pid, "method": method,
                                "paired_valid": str(is_valid),
                                "pair_status": pair_rows[-1]["pair_status"],
                                "paired_analysis_success": "False" if is_valid else ""})
    (directory / "manifest.json").write_text(json.dumps({
        "protocol": "cdea_scale_v1", "planned_matched_pairs": 256,
        "planned_episodes": 512, "pairs": scheduled, "models": []}), encoding="utf-8")
    (directory / "analysis.json").write_text(json.dumps({
        "valid_pairs": 256-invalid_count, "invalid_pairs": invalid_count,
        "not_started_pairs": 0, "baseline_successes": 0, "proposed_successes": 0}), encoding="utf-8")
    (directory / "model_digests.json").write_text("{}", encoding="utf-8")
    write_csv(directory / "pairs.csv", pair_rows[0].keys(), pair_rows)
    write_csv(directory / "results.csv", result_rows[0].keys(), result_rows)
    write_csv(directory / "summary.csv", ("cohort",), [{"cohort":"ALL_TASKS"}]*64)


class ArchiveAuditContracts(unittest.TestCase):
    def test_checkpoint_hash_contract(self):
        self.assertTrue(scale_audit.valid_digest("a" * 64))
        self.assertTrue(scale_audit.valid_digest("sha256:" + "c" * 64))
        for wrong in (None, "", "sha256:placeholder", "sha256:" + "1" * 63, 42):
            self.assertFalse(scale_audit.valid_digest(wrong))

    def test_strict_boolean_parser(self):
        self.assertIs(scale_audit.as_bool("True"), True)
        self.assertIs(scale_audit.as_bool("False"), False)
        self.assertIsNone(scale_audit.as_bool("unknown"))

    def test_missing_inputs_fail_closed(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(ValueError):
                scale_audit.audit(root)

    def test_counts_and_runtime_evidence_are_separate(self):
        with tempfile.TemporaryDirectory() as root:
            build_archive(root)
            report = scale_audit.audit(root)
        self.assertTrue(report["archive_counts_consistent"])
        self.assertEqual(report["observed"]["invalid_pairs"], 7)
        self.assertEqual(report["observed"]["valid_pairs"], 249)
        self.assertFalse(report["runner_contract_complete"])
        self.assertFalse(report["independent_live_execution_verified"])
        self.assertEqual(report["episode_runtime_evidence_blockers"]["missing_episode_file"], 512)

    def test_mismatched_counts_not_accepted(self):
        with tempfile.TemporaryDirectory() as root:
            build_archive(root)
            file = Path(root) / "analysis.json"
            doc = json.loads(file.read_text(encoding="utf-8"))
            doc["invalid_pairs"] = 0
            file.write_text(json.dumps(doc), encoding="utf-8")
            report = scale_audit.audit(root)
        self.assertFalse(report["archive_counts_consistent"])
        self.assertIn("analysis_invalid_pairs", report["numerical_discrepancies"])


if __name__ == "__main__":
    unittest.main()
