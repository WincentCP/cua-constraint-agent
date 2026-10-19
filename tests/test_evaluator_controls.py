"""Offline contracts for live evaluator/isolation gates (live Windows test separate)."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1] / "scripts/browsergym"
sys.path.insert(0, str(HERE))


def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


isolation = load("isolated_openapps")
controls = load("evaluator_controls")


class FakeResponse:
    status = 200
    def __init__(self, body):
        self.body = body.encode("utf-8")
    def __enter__(self):
        return self
    def __exit__(self, *_):
        return False
    def read(self):
        return self.body


class TestIsolation(unittest.TestCase):
    def test_owner_probe_accepts_only_matching_database(self):
        with tempfile.TemporaryDirectory() as folder:
            db = Path(folder) / "databases"
            with patch.object(isolation, "urlopen", return_value=FakeResponse(
                "database_path: " + db.as_posix() + "/todo.db"
            )):
                self.assertTrue(isolation.require_ownership("http://127.0.0.1:15001", db))
            with patch.object(isolation, "urlopen", return_value=FakeResponse(
                "database_path: /somebody/elses/todo.db"
            )):
                with self.assertRaisesRegex(RuntimeError, "ownership mismatch"):
                    isolation.require_ownership("http://127.0.0.1:15001", db)

    def test_owner_probe_accepts_json_escaped_paths(self):
        with tempfile.TemporaryDirectory() as folder:
            db = Path(folder) / "databases"
            body = json.dumps({
                "todo": {"database_path": str(db / "todo.db")},
                "calendar": {"database_path": str(db / "calendar.db")},
            })
            with patch.object(isolation, "urlopen", return_value=FakeResponse(body)):
                self.assertTrue(isolation.require_ownership("http://127.0.0.1:15001", db))

    def test_windows_paths_in_json_repr_and_plain_text(self):
        win = r"C:\Users\Administrator\cua-constraint-agent\output\browsergym\controls\abc\server\databases"
        todo = win + r"\todo.db"
        calendar = win + r"\calendar.db"
        entries = {"todo": {"database_path": todo}, "calendar": {"database_path": calendar}}
        for body in (json.dumps(entries), str(entries), "database_path: " + todo):
            matched, observed = isolation.database_paths_match_episode(
                body, [win.upper().replace("\\", "/")]
            )
            self.assertTrue(matched, body)
            self.assertTrue(observed)

    def test_foreign_database_and_prefix_collision_rejected(self):
        d = r"C:\Users\Administrator\research\episode\databases"
        bad_cases = [
            {"todo": {"database_path": d + r"-other\todo.db"}},
            {"todo": {"database_path": d + r"\todo.db"},
             "calendar": {"database_path": r"C:\other\calendar.db"}},
            {"todo": {"database_path": r"C:\other\todo.db"},
             "goal": "path mentioned: " + d + r"\todo.db"},
            {"goal": d + r"\todo.db"},
        ]
        for example in bad_cases:
            self.assertFalse(
                isolation.database_paths_match_episode(json.dumps(example), [d])[0],
                example,
            )

    def test_missing_database_metadata_fails_closed(self):
        self.assertFalse(
            isolation.database_paths_match_episode(
                json.dumps({"todo": [{"title": "Call Mom"}]}), [r"C:\episode\db"]
            )[0]
        )

    def test_unique_database_and_fail_closed_reuse(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / "openapps"
            root.mkdir()
            (root / "launch.py").write_text("# dummy")
            run_dir = Path(folder) / "episode"
            class Process:
                pid = 98765
                returncode = None
                def poll(self):
                    return None
            with (patch.object(isolation, "check_pinned_openapps"),
                  patch.object(isolation, "pick_job_id", return_value=133),
                  patch.object(isolation, "require_ownership", return_value=True),
                  patch.object(isolation.subprocess, "Popen", return_value=Process()) as spawn,
                  patch.object(isolation, "stop_owned_process") as stop):
                with isolation.isolated_openapps(root, run_dir) as server:
                    self.assertEqual(server.url, "http://127.0.0.1:18301")
                    self.assertIn("episode", server.database_dir)
                    self.assertNotEqual(server.database_dir, server.logs_dir)
                self.assertTrue(spawn.called)
                args = spawn.call_args.args[0]
                self.assertIn("headless=True", args)
                self.assertIn("+job_id=133", args)
                self.assertTrue(any(part.startswith("databases_dir=") for part in args))
                stop.assert_called_once()
                with self.assertRaisesRegex(RuntimeError, "Refusing to reuse"):
                    with isolation.isolated_openapps(root, run_dir):
                        pass


class TestEvaluatorGates(unittest.TestCase):
    @staticmethod
    def state():
        return {"todo": [{"id": 1, "title": "Water plants", "done": False}],
                "calendar": [{"name": "Fixed"}], "messenger": []}

    def test_only_exact_todo_addition_allowed(self):
        before = self.state()
        after = self.state()
        after["todo"].append({"id": 2, "title": "Call Mom", "done": False})
        controls.require_only_expected_addition(before, after, "Call Mom")
        corrupted = self.state()
        corrupted["todo"].append({"id": 2, "title": "Other", "done": False})
        with self.assertRaises(RuntimeError):
            controls.require_only_expected_addition(before, corrupted, "Call Mom")
        corrupted = self.state()
        corrupted["calendar"].append({"name": "changed"})
        corrupted["todo"].append({"id": 2, "title": "Call Mom", "done": False})
        with self.assertRaises(RuntimeError):
            controls.require_only_expected_addition(before, corrupted, "Call Mom")

    def test_element_ids_must_come_from_public_tree(self):
        obs = {"axtree_object": {"nodes": [
            {"browsergym_id": "21", "role": {"value": "textbox"}, "name": {"value": "New Todo"}},
            {"browsergym_id": "bad", "role": {"value": "textbox"}, "name": {"value": "New Todo"}, "ignored": True},
        ]}}
        with patch.object(controls, "extract_axtree_text", return_value="[21] textbox New Todo"):
            self.assertEqual(controls.find_visible_bid(obs, role="textbox", name="New Todo"), "21")
            with self.assertRaisesRegex(RuntimeError, "got 0"):
                controls.find_visible_bid(obs, role="button", name="Add")

    def test_initial_hash_mismatch_fails_gate(self):
        def fake(root, dirname, label, report):
            record = {"initial_sha256": "a" if label == "negative" else "b",
                      "server": {"database_dir": label}}
            report["controls"][label] = record
            return record
        with tempfile.TemporaryDirectory() as folder:
            report = {"controls": {}, "artifact_dir": folder}
            from argparse import Namespace
            with patch.object(controls, "check_one", side_effect=fake):
                with self.assertRaisesRegex(RuntimeError, "hashes differ"):
                    controls.run(Namespace(openapps_dir=folder), report)
                self.assertFalse(report["initial_hash_parity"])


if __name__ == "__main__":
    unittest.main()
