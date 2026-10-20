"""Offline contracts for no-model, no-Main main_suitability preflight.

Every mocked OpenApps object here is a contract fixture, NOT experimental data.
"""
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1] / "scripts" / "browsergym"
sys.path.insert(0, str(HERE))
import main_suitability as checker


class FakeResponse:
    def __init__(self, status=200, data=b"<html>visible</html>"):
        self.status = status
        self.data = data

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, n):
        return self.data[:n]


class SuitabilityContracts(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.out = Path(self.temp.name)
        self.plan, self.roster, self.models = checker.experiment.load_plan()
        self.tasks = checker.experiment.validate_plan(
            self.plan, self.roster, self.models
        )

    def test_read_only_routes_and_error_status(self):
        requested = []
        def ok(url, timeout):
            requested.append(url)
            self.assertEqual(timeout, 15)
            return FakeResponse()
        with patch.object(checker, "urlopen", side_effect=ok):
            result = checker.probe_app_routes("http://127.0.0.1:5001")
        self.assertEqual(len(result), 7)
        self.assertEqual(len(requested), 7)
        self.assertTrue(all(x["status"] == 200 for x in result))
        with patch.object(checker, "urlopen",
                          return_value=FakeResponse(status=500)):
            with self.assertRaisesRegex(RuntimeError, "status=500"):
                checker.probe_app_routes("http://127.0.0.1:5001")

    def test_full_negative_initial_evaluator_audit_is_read_only(self):
        base = {"todo": [{"title": "fixture only", "done": False}],
                "messenger": [], "calendar": [], "openbanking": {}}
        @contextmanager
        def mock_server(root, destination):
            self.assertEqual(root, self.out)
            self.assertEqual(destination, self.out / "case" / "isolated_server")
            yield types.SimpleNamespace(url="http://127.0.0.1:5001")
        fake_open_apps = types.ModuleType("open_apps")
        fake_state_module = types.ModuleType("open_apps.state")
        fake_state_module.get_current_state = lambda _url: base
        fake_task = types.SimpleNamespace(
            check_if_task_is_complete=lambda initial, current: False
        )
        calls = []
        def fake_build(root, url, key, steps, group):
            calls.append((key, group, steps))
            return object(), fake_task
        with patch.dict(sys.modules, {
            "open_apps": fake_open_apps, "open_apps.state": fake_state_module
        }), patch.object(checker, "isolated_openapps", side_effect=mock_server), \
             patch.object(checker, "require_state"), \
             patch.object(checker, "probe_app_routes", return_value=[
                {"route": "/", "status": 200, "body_nonempty": True}
             ]), patch.object(checker.matched_dev, "build_env_args",
                               side_effect=fake_build):
            out = checker.audit_live_initial_state(
                self.out, self.tasks, self.out / "case"
            )
        self.assertEqual(len(calls), 32)
        self.assertTrue(all(steps == 40 for _, _, steps in calls))
        self.assertTrue(out["passed"])
        self.assertEqual(len(out["task_checks"]), 32)
        self.assertEqual(out["initial_state_sha256"], out["final_state_sha256"])
        self.assertTrue(out["no_agent_browsergym_episodes"])
        self.assertTrue(out["official_positive_reward_not_tested"])
        self.assertTrue(out["model_probe_menu_not_tested"])

    def test_preflight_fails_closed_for_already_complete_task(self):
        base = {"todo": []}
        @contextmanager
        def server(*_args, **_kwargs):
            yield types.SimpleNamespace(url="http://127.0.0.1:5001")
        mod = types.ModuleType("open_apps.state")
        mod.get_current_state = lambda _url: base
        fake_task = types.SimpleNamespace(
            check_if_task_is_complete=lambda initial, current: True
        )
        with patch.dict(sys.modules, {
            "open_apps": types.ModuleType("open_apps"), "open_apps.state": mod
        }), patch.object(checker, "isolated_openapps", side_effect=server), \
             patch.object(checker, "require_state"), \
             patch.object(checker, "probe_app_routes", return_value=[]), \
             patch.object(checker.matched_dev, "build_env_args",
                          return_value=(object(), fake_task)):
            with self.assertRaisesRegex(RuntimeError, "already complete"):
                checker.audit_live_initial_state(
                    self.out, self.tasks, self.out / "case"
                )

    def test_report_is_created_only_under_non_study_preflight(self):
        openapps = self.out / "OpenApps"
        openapps.mkdir()
        (openapps / "launch.py").write_text("fixture not upstream\n")
        with patch.object(checker, "PREFLIGHT_ROOT", self.out / "preflight"), \
             patch.object(checker.pilot, "git_head",
                          return_value=checker.matched_dev.UPSTREAM_PIN), \
             patch.object(checker.pilot, "official_task_preflight"), \
             patch.object(checker, "audit_live_initial_state",
                          return_value={
                              "passed": True, "task_count": 32,
                              "task_checks": [{"task": str(i)} for i in range(32)],
                              "routes": []
                          }):
            directory, result = checker.run_audit(openapps)
        self.assertEqual(result["status"], "pass_limited_task_suitability_preflight")
        self.assertEqual(result["no_main_data_collected"], True)
        self.assertTrue((directory / "audit.json").is_file())
        self.assertFalse((self.out / "main").exists())


if __name__ == "__main__":
    unittest.main()
