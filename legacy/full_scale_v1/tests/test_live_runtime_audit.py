"""Offline regression coverage for verifiable, newly captured Scale output."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import csv
import json
from pathlib import Path
import sqlite3
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/browsergym"))
import audit_scale_runtime as runtime
from audit_scale_archive import audit as structural_audit


def csv_write(path, rows):
    with Path(path).open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def put_json(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data), encoding="utf-8")


def build_run(root):
    root = Path(root)
    digest = "a" * 64
    upstream = "6e6782794433c60468d65ac75bc3f03c56007f8c"
    label = "qwen3.5-4b"
    model = "qwen3.5:4b-q4_K_M"
    task = "mark_water_plants_as_done"
    goal = "Mark water plants as done"
    task_group = "all_tasks"
    manifest = {
        "protocol": "cdea_scale_v1",
        "scale_id": "scale_runtime_check",
        "planned_pairs": 256, "planned_episodes": 512,
        "controller_git_commit": "b" * 40,
        "openapps_git_commit": upstream,
        "model_checkpoint_digests": {label:digest},
        "model_names": {label:model},
        "models": [{"label":label}],
        "created_utc":"2026-10-24T00:00:00+00:00",
        "plan_sha256":"c" * 64, "model_config_sha256":"d" * 64,
        "taskset_sha256":"e" * 64,
        "pairs": [{"pair_id":f"pair_{i:03d}"} for i in range(1,257)],
    }
    put_json(root / "manifest.json", manifest)
    put_json(root / "model_digests.json", {label:{"name":model,"digest":digest}})
    pair_rows = []
    result_rows = []
    for i in range(1,257):
        pid = f"pair_{i:03d}"
        valid = i == 1
        pair_rows.append({"pair_id":pid, "model_label":label,
                          "task":task, "task_group":task_group,
                          "pair_status":"paired_scale_completed" if valid else "not_started",
                          "paired_valid":str(valid),
                          "baseline_success":"False" if valid else "",
                          "proposed_success":"True" if valid else ""})
        for method in ("Baseline", "Proposed"):
            result_rows.append({"pair_id":pid,"method":method,
                                "pair_status":"paired_scale_completed" if valid else "not_started",
                                "paired_valid":str(valid),
                                "official_success_raw":str(method == "Proposed") if valid else "",
                                "paired_analysis_success":str(method == "Proposed") if valid else ""})
    csv_write(root / "pairs.csv", pair_rows)
    csv_write(root / "results.csv", result_rows)
    csv_write(root / "summary.csv", [{"cohort":"ALL_TASKS"} for _ in range(64)])
    put_json(root / "analysis.json",
             {"valid_pairs":1,"invalid_pairs":0,"not_started_pairs":255,
              "baseline_successes":0,"proposed_successes":1})

    first = datetime(2026,10,24,tzinfo=timezone.utc)
    when = lambda n: (first+timedelta(seconds=n)).isoformat()
    put_json(root / "episodes/pair_001/pair.json",
             {"status":"paired_scale_completed","initial_hash_parity":True,"pair_id":"pair_001"})
    for i, method in enumerate(("Baseline", "Proposed")):
        base = root / "episodes" / "pair_001" / method
        server = base / "server"
        episode = base / "episode"
        (episode / "observations").mkdir(parents=True)
        (server / "databases").mkdir(parents=True)
        (server / "logs").mkdir(parents=True)
        axtree = 'RootWebArea "OpenApps"'
        after = 'RootWebArea "Todo"'
        (episode / "observations/step_001_before.axtree.txt").write_bytes(axtree.encode())
        (episode / "observations/step_001_after.axtree.txt").write_bytes(after.encode())
        url = f"http://127.0.0.1:{50101+i}"
        pid = 1001+i
        database_dir = str(server / "databases")
        logs_dir = str(server / "logs")
        put_json(server / "launcher.json", {
            "pid":pid, "server_url":url, "database_dir":database_dir,
            "logs_dir":logs_dir, "ownership_confirmed":True,
            "openapps_commit":upstream,"launcher_sha256":"f"*64,
            "command":["python","-u","C:/OpenApps/launch.py"],
            "returncode":-15,"launched_at_utc":when(10+i*30),
            "ready_at_utc":when(12+i*30),
            "stopped_at_utc":when(20+i*30)})
        (server / "server.log").write_text("OpenApps started on port\n")
        (server / "logs/config.yaml").write_text("apps:\n  todo:\n    database_path: todos.db\n")
        con = sqlite3.connect(server / "databases/todo.db")
        con.execute("CREATE TABLE todos(id INTEGER PRIMARY KEY, title TEXT, done INTEGER)")
        con.commit(); con.close()
        success = method == "Proposed"
        put_json(episode / "episode.json",{
            "method":method, "task":task, "task_group":task_group,
            "model":model,"model_digest":digest, "upstream_commit":upstream,
            "study_phase":"scale", "run_complete":True,"valid":True,
            "official_success":success, "official_reward":1.0 if success else 0.0,
            "initial_sha256":"1"*64,"public_goal":goal,
            "public_constraints":runtime.public_constraints(goal),
            "server":{"pid":pid,"url":url,"database_dir":database_dir,"logs_dir":logs_dir},
            "steps":1,"started_at_utc":when(13+i*30),"finished_at_utc":when(19+i*30),
            "trace":[{"step":1,"action":"click(\"2\")","candidate_probes":[],
                      "observation_artifact":"observations/step_001_before.axtree.txt",
                      "observation_sha256":sha256(axtree.encode()).hexdigest(),
                      "next_observation_artifact":"observations/step_001_after.axtree.txt",
                      "next_observation_sha256":sha256(after.encode()).hexdigest()}]
        })


class LiveRunnerAuditTests(unittest.TestCase):
    def test_utc_enforces_timezone(self):
        self.assertIsNotNone(runtime.utc("2026-10-24T00:00:00Z"))
        with self.assertRaises(ValueError):
            runtime.utc("2026-10-24T00:00:00")
        with self.assertRaises(ValueError):
            runtime.utc("2026-10-24T07:00:00+07:00")

    def test_observation_path_rejects_traversal(self):
        with TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/"observations").mkdir()
            (root/"observations/step_001_before.axtree.txt").write_bytes(b"abc")
            class Reader:
                def exists(self, p):return (root/p.lstrip("/")).exists()
                def read(self, p):return (root/p.lstrip("/")).read_bytes()
            reader=Reader()
            good=sha256(b"abc").hexdigest()
            self.assertTrue(runtime.trace_artifact(reader,"","observations/step_001_before.axtree.txt",good))
            self.assertFalse(runtime.trace_artifact(reader,"","../somewhere",good))
            self.assertFalse(runtime.trace_artifact(reader,"","/absolute",good))

    def test_new_manifest_field_passes_numeric_audit(self):
        with TemporaryDirectory() as tmp:
            build_run(tmp)
            report=structural_audit(tmp)
        self.assertTrue(report["archive_counts_consistent"])

    def test_internal_runtime_contract_and_incomplete_schedule_separate(self):
        with TemporaryDirectory() as tmp:
            build_run(tmp)
            with patch.object(runtime,"source_checks",return_value={"pinned_git":True}):
                report=runtime.audit(tmp)
        self.assertEqual(report["runtime_artifact_contract"],"PASS")
        self.assertEqual(report["inspected_valid_episodes"],2)
        self.assertFalse(report["run_complete"])
        self.assertEqual(report["not_started_pairs"],255)

    def test_tampered_observation_fails(self):
        with TemporaryDirectory() as tmp:
            build_run(tmp)
            path=Path(tmp)/"episodes/pair_001/Proposed/episode/observations/step_001_before.axtree.txt"
            path.write_bytes(b"changed")
            with patch.object(runtime,"source_checks",return_value={"pinned_git":True}):
                report=runtime.audit(tmp)
        self.assertEqual(report["runtime_artifact_contract"],"FAIL")
        self.assertIn("missing_or_changed_raw_observation",report["blockers"])

    def test_pretend_source_commit_fails(self):
        with TemporaryDirectory() as tmp:
            build_run(tmp)
            with patch.object(runtime,"source_checks",return_value={"controller_git_commit":False}):
                report=runtime.audit(tmp)
        self.assertEqual(report["runtime_artifact_contract"],"FAIL")
        self.assertIn("frozen_source_mismatch",report["blockers"])

    def test_tampered_runtime_identity_fails(self):
        with TemporaryDirectory() as tmp:
            build_run(tmp)
            target=Path(tmp)/"episodes/pair_001/Baseline/server/launcher.json"
            d=json.loads(target.read_text())
            d["pid"]=1234
            target.write_text(json.dumps(d))
            with patch.object(runtime,"source_checks",return_value={"pinned_git":True}):
                report=runtime.audit(tmp)
        self.assertEqual(report["runtime_artifact_contract"],"FAIL")
        self.assertIn("server_process_identity_mismatch",report["blockers"])


if __name__=="__main__":
    unittest.main()
