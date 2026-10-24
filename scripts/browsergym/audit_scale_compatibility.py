"""Fail-closed, read-only checks for the known Scale archive source contract.

Compatibility is NOT proof of historical live execution. The original ZIP is
never modified. Source blob fingerprints refer to controller commit
0cf0a376f51d9a9717eb58c1c3b1974119fdcaea.
"""
import argparse
from collections import Counter
from hashlib import sha1, sha256
import json
import re
import sqlite3
import tempfile
from pathlib import Path
from audit_scale_archive import Archive

CONTROLLER = "0cf0a376f51d9a9717eb58c1c3b1974119fdcaea"
UPSTREAM = "6e6782794433c60468d65ac75bc3f03c56007f8c"
BLOBS = {
    "config/scale_plan.json": ("plan_sha256", "be7d37f5b3d8a2bbd0b1dc5aaee9b4683d8e506e"),
    "config/models_scale.json": ("model_config_sha256", "30213fee331a0f9acd7f3cba2c3a1771c4fca349"),
    "config/main_taskset_v1.json": ("taskset_sha256", "3512c0dd56c6fde5b01242da9d777810ca51bcfd"),
}
BAD_ROUTES = {"/todo/items", "/openbanking/accounts/acct_001", "/openbanking/cards/card_001"}

def git_blob(data):
    return sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()

def goal_constraints(goal):
    if not isinstance(goal, str) or not goal.strip():
        return []
    parts = re.split(r"\s*;\s*|\s+\band then\b\s+|\s+\bthen\b\s+|\s+\band also\b\s+", goal.strip(), flags=re.I)
    parts = [v.strip(" .\n\t") for v in parts if v.strip(" .\n\t")]
    if not parts or len(parts) > 6:
        parts = [goal.strip()]
    return [{"id": f"c{i+1}", "description": v[:400]} for i, v in enumerate(parts)]

def columns(raw):
    with tempfile.TemporaryDirectory() as temp:
        p = Path(temp) / "todo.db"
        p.write_bytes(raw)
        db = sqlite3.connect("file:" + p.as_posix() + "?mode=ro", uri=True)
        try:
            tables = [x[0] for x in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
            for table in ("todos", "todo"):
                if table in tables:
                    return {x[1] for x in db.execute('PRAGMA table_info("' + table + '")')}
            return set()
        finally:
            db.close()

def audit(path):
    arc = Archive(path)
    try:
        m = arc.json("manifest.json")
        supported = m.get("controller_git_commit") == CONTROLLER and m.get("openapps_git_commit") == UPSTREAM
        checks = {}
        for path_name, (field, expected) in BLOBS.items():
            raw = arc.read(path_name) if arc.exists(path_name) else None
            checks[path_name] = {
                "present": raw is not None,
                "manifest_sha256_match": raw is not None and sha256(raw).hexdigest() == m.get(field),
                "pinned_git_blob_match": git_blob(raw) == expected if supported and raw is not None else False,
            }
        counters = Counter()
        examples = {}
        def fail(name, key):
            counters[name] += 1
            if len(examples.setdefault(name, [])) < 4:
                examples[name].append(key)
        for item in m.get("pairs", []):
            for method in ("Baseline", "Proposed"):
                slot = item["pair_id"] + "/" + method
                p = "episodes/" + slot
                ep_path = p + "/episode/episode.json"
                if not arc.exists(ep_path):
                    fail("missing_episode", slot)
                    continue
                counters["inspected"] += 1
                if not supported:
                    continue
                ep = arc.json(ep_path)
                expected = goal_constraints(ep.get("public_goal"))
                if not expected or ep.get("public_constraints") != expected:
                    fail("public_constraint_contract_mismatch", slot)
                ids = {x["id"] for x in expected}
                if any(isinstance(step.get("ledger"), dict) and set(step["ledger"]) != ids
                       for step in ep.get("trace", [])):
                    fail("trace_ledger_ids_mismatch", slot)
                if any(not set(probe.get("may_answer") or []).issubset(ids)
                       for step in ep.get("trace", [])
                       for probe in step.get("candidate_probes", [])
                       if isinstance(probe, dict)):
                    fail("trace_candidate_constraint_ids_mismatch", slot)
                if ep.get("task") == "gym_todo_and_message_bob" and ep.get("task_group") == "longer_horizon" and (
                    "Renew gym membership" not in (ep.get("public_goal") or "")
                    or "Thinking of renewing my gym membership" not in (ep.get("public_goal") or "")):
                    fail("official_goal_canary_mismatch", slot)
                todo = p + "/server/databases/todo.db"
                if not arc.exists(todo):
                    fail("missing_todo_db", slot)
                else:
                    try:
                        if not {"id", "title", "done"}.issubset(columns(arc.read(todo))):
                            fail("pinned_todo_schema_mismatch", slot)
                    except (sqlite3.DatabaseError, ValueError, OSError):
                        fail("unreadable_todo_db", slot)
                config = p + "/server/logs/config.yaml"
                if not arc.exists(config) or not re.search(r"(?m)^apps\s*:", arc.read(config).decode("utf-8-sig", "replace")):
                    fail("pinned_hydra_config_missing_apps", slot)
                log = p + "/server/logs/requests.log"
                if not arc.exists(log):
                    fail("missing_requests_log", slot)
                elif any((match := re.search(r"\b(?:GET|POST|PUT|DELETE|PATCH)\s+(\S+)", line))
                         and match.group(1).split("?", 1)[0] in BAD_ROUTES
                         for line in arc.read(log).decode("utf-8-sig", "replace").splitlines()):
                    fail("pinned_unsupported_access_log_routes", slot)
        blockers = {key: val for key, val in counters.items() if key != "inspected"}
        config_pass = supported and all(all(v.values()) for v in checks.values())
        return {
            "archive": Path(path).name, "supported_pinned_revisions": supported,
            "inspected_episodes": counters["inspected"],
            "config_source_checks": checks, "config_source_compatible": config_pass,
            "compatibility_blockers": blockers, "examples": examples,
            "pinned_contract_compatible": bool(config_pass and not blockers and counters["inspected"] == 512),
            "independent_live_execution_verified": False,
            "scope": "Selected offline source checks only; no host attestation or official evaluator replay.",
        }
    finally:
        arc.close()

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("archive")
    p.add_argument("--report", type=Path)
    p.add_argument("--require-compatible", action="store_true")
    a = p.parse_args()
    try:
        result = audit(a.archive)
    except (ValueError, OSError, KeyError, sqlite3.DatabaseError) as exc:
        p.exit(2, "AUDIT ERROR: " + str(exc) + "\n")
    body = json.dumps(result, indent=2, sort_keys=True) + "\n"
    print(body, end="")
    if a.report:
        a.report.parent.mkdir(parents=True, exist_ok=True)
        a.report.write_text(body, encoding="utf-8")
    return 3 if a.require_compatible and not result["pinned_contract_compatible"] else 0

if __name__ == "__main__":
    raise SystemExit(main())
