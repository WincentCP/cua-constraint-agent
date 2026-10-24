"""Owned OpenApps server process capture and lifecycle regression tests."""
from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/browsergym"))
import isolated_openapps as isolated


class FakeProcess:
    pid = 17321
    returncode = None
    def poll(self):
        return None


class RuntimeCaptureTests(unittest.TestCase):
    def test_launcher_record_from_owned_process(self):
        with tempfile.TemporaryDirectory() as root:
            upstream = Path(root) / "OpenApps"
            upstream.mkdir()
            (upstream / "launch.py").write_text("print('openapps entry')\n", encoding="utf-8")
            server_dir = Path(root) / "run" / "Baseline" / "server"
            process = FakeProcess()
            def stop_owned(p):
                self.assertIs(p, process)
                p.returncode = -15

            with (patch.object(isolated, "check_pinned_openapps", return_value=isolated.UPSTREAM_PIN),
                  patch.object(isolated, "pick_job_id", return_value=100),
                  patch.object(isolated, "require_ownership", return_value=True),
                  patch.object(isolated, "stop_owned_process", side_effect=stop_owned),
                  patch.object(isolated.subprocess, "Popen", return_value=process)):
                with isolated.isolated_openapps(upstream, server_dir) as owned:
                    record = json.loads((server_dir / "launcher.json").read_text())
                    self.assertEqual(owned.pid, process.pid)
                    self.assertEqual(record["pid"], process.pid)
                    self.assertTrue(record["ownership_confirmed"])
                    self.assertEqual(record["openapps_commit"], isolated.UPSTREAM_PIN)
                    self.assertEqual(record["server_url"], owned.url)
                    self.assertEqual(record["database_dir"], owned.database_dir)
                    self.assertEqual(record["logs_dir"], owned.logs_dir)
                    self.assertEqual(record["launcher_sha256"],
                                     sha256((upstream / "launch.py").read_bytes()).hexdigest())
                    self.assertIn("ready_at_utc", record)
            record = json.loads((server_dir / "launcher.json").read_text())
            self.assertIn("stopped_at_utc", record)
            self.assertEqual(record["returncode"], -15)
            self.assertRegex(record["stopped_at_utc"], r"\+00:00$")

    def test_original_host_timestamp_timezone(self):
        value = isolated.utc_now()
        self.assertRegex(value, r"^\d{4}-\d\d-\d\dT.*\+00:00$")
        self.assertNotIn("Z", value)

    def test_launch_metadata_writer_atomic(self):
        with tempfile.TemporaryDirectory() as root:
            target = Path(root) / "launcher.json"
            isolated.write_launch_record(target, {"pid": 100, "ownership_confirmed": True})
            self.assertEqual(json.loads(target.read_text())["pid"], 100)
            self.assertFalse((Path(root) / "launcher.json.tmp").exists())


if __name__ == "__main__":
    unittest.main()
