"""Offline fail-closed tests for pinned Scale compatibility auditor."""
import hashlib
import json
import sqlite3
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, main
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"/"browsergym"))
import audit_scale_compatibility as compat

def fixture(root, *, invalid=False):
    root=Path(root)
    blobs={}
    m={"controller_git_commit":compat.CONTROLLER,"openapps_git_commit":compat.UPSTREAM,"pairs":[{"pair_id":"pair_001"}]}
    for path,(field,_) in compat.BLOBS.items():
        raw=("snapshot "+path+"\n").encode()
        f=root/path
        f.parent.mkdir(parents=True,exist_ok=True)
        f.write_bytes(raw)
        m[field]=hashlib.sha256(raw).hexdigest()
        blobs[path]=(field,compat.git_blob(raw))
    (root/"manifest.json").write_text(json.dumps(m))
    for method in ("Baseline","Proposed"):
        d=root/"episodes"/"pair_001"/method
        (d/"episode").mkdir(parents=True)
        (d/"server/databases").mkdir(parents=True)
        (d/"server/logs").mkdir(parents=True)
        goal="Check one and then check two"
        cons=compat.goal_constraints(goal) if not invalid else [{"id":"C1","text":"generic"}]
        (d/"episode/episode.json").write_text(json.dumps({"public_goal":goal,"public_constraints":cons,"trace":[{"ledger":{x["id"]:{"state":"UNKNOWN"} for x in cons},"candidate_probes":[]}]}))
        con=sqlite3.connect(d/"server/databases/todo.db")
        con.execute("CREATE TABLE todos (id INTEGER, title TEXT, "+("completed" if invalid else "done")+" INTEGER)")
        con.commit();con.close()
        (d/"server/logs/config.yaml").write_text("apps:\n  todo: {}\n")
        (d/"server/logs/requests.log").write_text("2026-10-22T15:00:00Z 127.0.0.1 GET "+("/todo/items" if invalid else "/todo")+" 200 1ms\n")
    return blobs

class AuditTests(TestCase):
    def test_goal_and_git_hash(self):
        self.assertEqual(compat.goal_constraints("A and then B"),[{"id":"c1","description":"A"},{"id":"c2","description":"B"}])
        self.assertEqual(len(compat.git_blob(b"example")),40)
    def test_good_fixture_is_compatible_but_not_live_attested(self):
        with tempfile.TemporaryDirectory() as root:
            blobs=fixture(root)
            with patch.dict(compat.BLOBS,blobs):
                report=compat.audit(root)
        self.assertTrue(report["config_source_compatible"])
        self.assertFalse(report["independent_live_execution_verified"])
    def test_incompatible_episode_is_rejected(self):
        with tempfile.TemporaryDirectory() as root:
            blobs=fixture(root,invalid=True)
            with patch.dict(compat.BLOBS,blobs):
                report=compat.audit(root)
        self.assertFalse(report["pinned_contract_compatible"])
        self.assertEqual(report["compatibility_blockers"]["pinned_todo_schema_mismatch"],2)
        self.assertEqual(report["compatibility_blockers"]["public_constraint_contract_mismatch"],2)
        self.assertEqual(report["compatibility_blockers"]["pinned_unsupported_access_log_routes"],2)
    def test_config_drift_fails_closed(self):
        with tempfile.TemporaryDirectory() as root:
            blobs=fixture(root)
            blobs["config/scale_plan.json"]=("plan_sha256","f"*40)
            with patch.dict(compat.BLOBS,blobs):
                report=compat.audit(root)
        self.assertFalse(report["config_source_compatible"])
    def test_unknown_source_commit_fails_closed(self):
        with tempfile.TemporaryDirectory() as root:
            blobs=fixture(root)
            path=Path(root)/"manifest.json"
            m=json.loads(path.read_text());m["controller_git_commit"]="unknown";path.write_text(json.dumps(m))
            with patch.dict(compat.BLOBS,blobs):
                report=compat.audit(root)
        self.assertFalse(report["supported_pinned_revisions"])
        self.assertFalse(report["pinned_contract_compatible"])
if __name__=="__main__":main()
