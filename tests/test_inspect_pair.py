"""Read-only, zero-dependency paired report inspection contract tests."""
import importlib.util
import io
import json
import os
from contextlib import redirect_stdout
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1] / "scripts/browsergym"
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location("inspect_pair", HERE / "inspect_pair.py")
inspector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inspector)


class InspectPairTests(unittest.TestCase):
    def make_pair(self, directory: Path, *, complete: bool, traces: bool):
        path = directory / "sample" / "pair.json"
        path.parent.mkdir(parents=True)
        report = {
            "status": "paired_development_completed" if complete else "invalid_pair",
            "task": "add_todo_to_review_largest_card_charge",
            "task_group": "openbanking",
            "model_label": "qwen3.5-9b",
            "initial_hash_parity": complete,
            "policy_diagnostics": {
                "comparable_probe_decisions": 0, "policy_action_divergences": 0
            } if complete else None,
        }
        path.write_text(json.dumps(report), encoding="utf-8")
        if traces:
            ep = {
                "status": "development_unsuccessful", "official_success": False,
                "official_reward": 0.0, "end_reason": "safety_guard_blocked",
                "steps": 3, "model_calls": 4,
                "invalid_model_actions": 0, "repair_requests": 0,
                "trace": [
                    {"step": 1, "action": 'click("64")', "target": {
                        "role": "link", "name": "OpenBanking"
                    }, "candidate_probes": []},
                    {"step": 2, "action": 'click("96")', "url_before":
                     "http://127.0.0.1:15001/openbanking",
                     "url_after": "http://127.0.0.1:15001/openbanking",
                     "url_changed": False, "axtree_changed": False,
                     "invalid_attempts": [{"attempted_bid": "96",
                                           "error": "redundant_current_app_link"}],
                     "public_clickable_hints": [
                         {"bid": "111", "visible_label": "Business Checking"}
                     ]},
                    {"step": 3, "action": 'click("96")',
                     "guard_blocked": "repeated_click_limit"},
                ],
            }
            for method in inspector.METHODS:
                episode = path.parent / method / "episode" / "episode.json"
                episode.parent.mkdir(parents=True)
                episode.write_text(json.dumps(ep), encoding="utf-8")
        return path

    def test_complete_pair_shows_end_reason_actions_and_mechanism_warning(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.make_pair(Path(folder), complete=True, traces=True)
            out = inspector.describe_pair(path)
            self.assertIn("Baseline", out)
            self.assertIn("Proposed", out)
            self.assertIn("safety_guard_blocked", out)
            self.assertIn("GUARD BLOCKED", out)
            self.assertIn("Business Checking", out)
            self.assertIn("URL:", out)
            self.assertIn("Comparable probe decisions: 0", out)
            self.assertIn("Do NOT infer effectiveness", out)
            self.assertIn("no models or servers were started", out)
            self.assertNotIn("VALIDITY GATE: this is NOT", out)

    def test_partial_pair_handles_missing_arm_without_crash(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.make_pair(Path(folder), complete=False, traces=False)
            out = inspector.describe_pair(path)
            self.assertEqual(out.count("No episode artifact:"), 2)
            self.assertIn("VALIDITY GATE", out)
            self.assertIn("RESEARCH GATE", out)

    def test_timeout_invalid_episode_is_distinct_from_task_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.make_pair(Path(folder), complete=False, traces=True)
            ep = path.parent / "Baseline" / "episode" / "episode.json"
            rec = json.loads(ep.read_text(encoding="utf-8"))
            rec.update({
                "status": "invalid_episode", "official_success": None,
                "official_reward": None, "failure_stage": "browsergym_action_execution",
                "end_reason": "browser_action_timeout", "failed_action": 'click("20")',
                "bid_click_timeout_ms": 3000, "click_force_retry": False,
                "browsergym_core_version": "0.13.4",
            })
            rec["trace"][-1]["browser_error"] = (
                "TimeoutError: Locator.click: Timeout 3000ms exceeded."
            )
            rec["trace"][-1]["browser_error_category"] = "browser_action_timeout"
            rec["trace"][-1]["active_dialog_after_error"] = {
                "dialog_bid": "141", "dialog_name": "Open an account",
                "controls": [{"bid": "142", "role": "button", "name": "Close"}],
            }
            rec["trace"][-1]["browser_timeout_ms"] = 3000
            ep.write_text(json.dumps(rec), encoding="utf-8")
            out = inspector.describe_pair(path)
            self.assertIn("Failure stage: browsergym_action_execution", out)
            self.assertIn("failed_action=click", out)
            self.assertIn("category=browser_action_timeout", out)
            self.assertIn("timeout_ms=3000", out)
            self.assertIn("forced retry=False", out)
            self.assertIn("ACTIVE DIALOG: Open an account", out)
            self.assertIn("142 button:Close", out)
            self.assertIn("Click timeout: 3000 ms", out)
            self.assertIn("VALIDITY GATE", out)

    def test_latest_selects_only_pair_reports(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            older = self.make_pair(root, complete=True, traces=False)
            recent = root / "newer" / "pair.json"
            recent.parent.mkdir()
            recent.write_text("{}")
            # NTFS and some CI filesystems have coarse or tied mtimes.
            newer = older.stat().st_mtime_ns + 5_000_000_000
            os.utime(recent, ns=(newer, newer))
            self.assertEqual(inspector.latest_pair(root), recent)
            self.assertEqual(inspector.resolve_pair(str(older.parent)), older)
            with self.assertRaises(FileNotFoundError):
                inspector.resolve_pair(str(root / "does-not-exist"))
            with self.assertRaises(FileNotFoundError):
                inspector.latest_pair(root / "empty")

    def test_repo_relative_pair_path_from_another_working_directory(self):
        """Regression for PowerShell Push-Location to OpenApps."""
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            expected = self.make_pair(
                repo / "output" / "browsergym" / "matched_dev",
                complete=True, traces=True,
            )
            elsewhere = repo / "OpenApps"
            elsewhere.mkdir()
            before = Path.cwd()
            try:
                os.chdir(elsewhere)
                with patch.object(inspector, "ROOT", repo):
                    path = "output/browsergym/matched_dev/sample/pair.json"
                    self.assertEqual(inspector.resolve_pair(path), expected)
                    self.assertEqual(
                        inspector.resolve_pair("output/browsergym/matched_dev/sample"),
                        expected,
                    )
                    buf = io.StringIO()
                    with redirect_stdout(buf):
                        self.assertEqual(inspector.main(["--pair", path]), 0)
                    self.assertIn("Baseline", buf.getvalue())
                    self.assertIn("Proposed", buf.getvalue())
            finally:
                os.chdir(before)

    def test_command_line_prints_without_ollama(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.make_pair(Path(folder), complete=True, traces=False)
            buf = io.StringIO()
            with redirect_stdout(buf):
                self.assertEqual(inspector.main(["--pair", str(path)]), 0)
            self.assertIn("PAIRED DEVELOPMENT REPORT", buf.getvalue())


if __name__ == "__main__":
    unittest.main()
