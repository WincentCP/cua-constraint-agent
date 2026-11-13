from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "analysis" / "build_public_results.py"
SPEC = spec_from_file_location("build_public_results", SCRIPT)
MODULE = module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class MainDecisionAggregationTests(unittest.TestCase):
    def test_aggregates_mirrored_episode_rows_once_per_pair(self):
        rows = [
            {"pair_id": "p1", "method": "Baseline", "comparable_probe_decisions": "1", "policy_action_divergences": "1"},
            {"pair_id": "p1", "method": "Proposed", "comparable_probe_decisions": "1", "policy_action_divergences": "1"},
            {"pair_id": "p2", "method": "Baseline", "comparable_probe_decisions": "0", "policy_action_divergences": "0"},
            {"pair_id": "p2", "method": "Proposed", "comparable_probe_decisions": "0", "policy_action_divergences": "0"},
        ]
        result = MODULE.aggregate_main_decisions(rows)
        self.assertEqual(result["p1"]["comparable_probe_decisions"], 1)
        self.assertEqual(result["p1"]["policy_action_divergences"], 1)
        self.assertEqual(result["p2"]["comparable_probe_decisions"], 0)

    def test_rejects_mismatched_mirrored_episode_rows(self):
        rows = [
            {"pair_id": "p1", "method": "Baseline", "comparable_probe_decisions": "1", "policy_action_divergences": "0"},
            {"pair_id": "p1", "method": "Proposed", "comparable_probe_decisions": "0", "policy_action_divergences": "0"},
        ]
        with self.assertRaises(ValueError):
            MODULE.aggregate_main_decisions(rows)

    def test_thesis_percentage_rounding_uses_half_up(self):
        self.assertEqual(MODULE._round_percentage(25, 32), "78.13")
        self.assertEqual(MODULE._round_percentage(17, 32), "53.13")
        self.assertEqual(MODULE._round_percentage(16, 32), "50.00")
        self.assertEqual(MODULE._round_percentage(16 - 11, 32), "15.63")
        self.assertEqual(MODULE._round_percentage(11 - 16, 32), "-15.63")

    def test_summarizes_decision_comparison_at_pair_level(self):
        rows = [
            {"paired_valid": "true", "comparable_probe_decisions": "1", "policy_action_divergences": "1"},
            {"paired_valid": "true", "comparable_probe_decisions": "1", "policy_action_divergences": "0"},
            {"paired_valid": "true", "comparable_probe_decisions": "0", "policy_action_divergences": "0"},
        ]
        summary = MODULE.summarize_decisions("test", rows)
        self.assertEqual(summary["valid_pairs"], 3)
        self.assertEqual(summary["pairs_with_comparable_decisions"], 2)
        self.assertEqual(summary["pairs_with_different_actions"], 1)
        self.assertEqual(summary["pairs_with_same_action_when_comparable"], 1)
        self.assertEqual(summary["pairs_without_comparable_decision"], 1)


if __name__ == "__main__":
    unittest.main()
