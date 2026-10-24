"""Read-only evidence audit for NEW official Scale experiment runs.

Checks artifacts emitted by the unmodified BrowserGym/OpenApps evaluator path,
the pinned repository, and the owned server runner. It cannot independently
attest the provenance of historical host processes or re-run task evaluators.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime
from hashlib import sha256
import json
from pathlib import Path, PurePosixPath
import re
import sqlite3
import subprocess
import tempfile

from audit_scale_archive import Archive, as_bool, valid_digest
from shared_policy import public_constraints

ROOT = Path(__file__).resolve().parents[2]
FILES = {
    "plan_sha256": "config/scale_plan.json",
    "model_config_sha256": "config/models_scale.json",
    "taskset_sha256": "config/main_taskset_v1.json",
}
METHODS = ("Baseline", "Proposed")


def utc(value):
    if not isinstance(value, str):
        raise ValueError("missing UTC timestamp")
    value = value.replace("Z", "+00:00")
    result = datetime.fromisoformat(value)
    if result.tzinfo is None or result.utcoffset().total_seconds() != 0:
        raise ValueError("timestamp must be explicitly UTC")
    return result


def is_sha256(value):
    return isinstance(value, str) and bool(re.fullmatch("[a-fA-F0-9]{64}", value))


def todo_schema(db_bytes):
    """Inspect a captured SQLite DB read-only, without modifying the ZIP."""
    with tempfile.TemporaryDirectory() as directory:
        db_path = Path(directory) / "todo.db"
        db_path.write_bytes(db_bytes)
        con = sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True)
        try:
            table = con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='todos'").fetchone()
            if not table:
                return set()
            return {row[1] for row in con.execute('PRAGMA table_info("todos")')}
        finally:
            con.close()


def trace_artifact(reader, base, relative, digest):
    if not isinstance(relative, str) or not relative.startswith("observations/"):
        return False
    path = PurePosixPath(relative)
    if path.is_absolute() or ".." in path.parts or not is_sha256(digest):
        return False
    target = base + "/" + relative
    return reader.exists(target) and sha256(reader.read(target)).hexdigest() == digest


def git_head(repo):
    return subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"],
                          capture_output=True, check=True, text=True).stdout.strip()


def source_checks(manifest, repo_root, openapps_root):
    checks = {}
    for field, relative in FILES.items():
        path = repo_root / relative
        checks[field] = path.is_file() and sha256(path.read_bytes()).hexdigest() == manifest.get(field)
    checks["controller_git_commit"] = git_head(repo_root) == manifest.get("controller_git_commit")
    if openapps_root is not None:
        checks["openapps_git_commit"] = git_head(openapps_root) == manifest.get("openapps_git_commit")
        launcher = openapps_root / "launch.py"
        checks["openapps_launch.py_exists"] = launcher.is_file()
    else:
        checks["openapps_git_commit"] = None
    return checks


def audit(source, *, repo_root=ROOT, openapps_root=None):
    repo_root = Path(repo_root)
    if openapps_root is not None:
        openapps_root = Path(openapps_root)
    archive = Archive(source)
    try:
        manifest = archive.json("manifest.json")
        analysis = archive.json("analysis.json")
        records = archive.csv("pairs.csv")
        episode_rows = archive.csv("results.csv")
        digests = archive.json("model_digests.json")
        source_status = source_checks(manifest, repo_root, openapps_root)
        blockers = Counter()
        examples = {}

        def flag(name, slot):
            blockers[name] += 1
            if len(examples.setdefault(name, [])) < 5:
                examples[name].append(slot)

        planned = manifest.get("pairs", [])
        if manifest.get("protocol") != "cdea_scale_v1":
            flag("unexpected_protocol", "manifest")
        if (manifest.get("planned_pairs") != 256 or manifest.get("planned_episodes") != 512
                or len(planned) != 256 or len(records) != 256
                or len(episode_rows) != 512):
            flag("scheduled_counts_or_slots", "manifest")
        if [x.get("pair_id") for x in planned] != [x.get("pair_id") for x in records]:
            flag("schedule_membership_or_order", "pairs.csv")
        rows = {(x.get("pair_id"), x.get("method")): x for x in episode_rows}
        if len(rows) != len(episode_rows):
            flag("duplicate_episode_slots", "results.csv")
        if not isinstance(digests, dict):
            digests = {}
            flag("missing_model_registry", "model_digests.json")
        for label, digest in (manifest.get("model_checkpoint_digests") or {}).items():
            indexed = digests.get(label)
            if (not valid_digest(digest) or not isinstance(indexed, dict)
                    or indexed.get("digest") != digest
                    or indexed.get("name") != (manifest.get("model_names") or {}).get(label)):
                flag("checkpoint_registry_mismatch", label)
        if any(value is False for value in source_status.values()):
            flag("frozen_source_mismatch", "git/config")

        valid_count = 0
        invalid_count = 0
        not_started_count = 0
        inspected_episodes = 0
        for item in records:
            pair_id = item.get("pair_id", "")
            is_valid = as_bool(item.get("paired_valid"))
            if is_valid is None:
                flag("invalid_pair_boolean", pair_id)
            if item.get("pair_status") == "not_started":
                not_started_count += 1
                continue
            if not is_valid:
                invalid_count += 1
                continue
            valid_count += 1
            pair_path = "episodes/" + pair_id + "/pair.json"
            if not archive.exists(pair_path):
                flag("missing_pair_report", pair_id)
                continue
            pair_report = archive.json(pair_path)
            if (pair_report.get("status") != "paired_scale_completed"
                    or pair_report.get("initial_hash_parity") is not True
                    or pair_report.get("pair_id") != pair_id):
                flag("pair_runtime_report_mismatch", pair_id)
            initial_hashes = []
            for method, success_col in (("Baseline", "baseline_success"),
                                        ("Proposed", "proposed_success")):
                slot = pair_id + "/" + method
                row = rows.get((pair_id, method))
                base = "episodes/" + slot
                ep_path = base + "/episode/episode.json"
                if row is None or not archive.exists(ep_path):
                    flag("missing_episode_or_row", slot)
                    continue
                inspected_episodes += 1
                ep = archive.json(ep_path)
                digest = (manifest.get("model_checkpoint_digests") or {}).get(item.get("model_label"))
                if (ep.get("method") != method
                        or ep.get("model_digest") != digest
                        or ep.get("model") != (manifest.get("model_names") or {}).get(item.get("model_label"))
                        or ep.get("upstream_commit") != manifest.get("openapps_git_commit")
                        or ep.get("task") != item.get("task")
                        or ep.get("task_group") != item.get("task_group")
                        or ep.get("study_phase") != "scale"
                        or ep.get("run_complete") is not True
                        or ep.get("valid") is not True):
                    flag("episode_identity_mismatch", slot)
                official_success = ep.get("official_success")
                official_reward = ep.get("official_reward")
                if (type(official_success) is not bool
                        or not isinstance(official_reward, (int, float))
                        or isinstance(official_reward, bool)
                        or not 0 <= official_reward <= 1
                        or official_success != (official_reward >= 1)
                        or as_bool(row.get("paired_analysis_success")) != official_success
                        or as_bool(item.get(success_col)) != official_success):
                    flag("reward_csv_record_mismatch", slot)
                initial_hashes.append(ep.get("initial_sha256"))
                if not is_sha256(ep.get("initial_sha256")):
                    flag("missing_initial_state_fingerprint", slot)
                goal = ep.get("public_goal")
                try:
                    expected_constraints = public_constraints(goal)
                except (TypeError, ValueError):
                    expected_constraints = []
                if ep.get("public_constraints") != expected_constraints or not expected_constraints:
                    flag("public_goal_constraints_mismatch", slot)
                constraint_ids = {x["id"] for x in expected_constraints}
                trace = ep.get("trace")
                if not isinstance(trace, list):
                    flag("missing_trace", slot)
                    trace = []
                stepped = 0
                for pos, step in enumerate(trace):
                    if not isinstance(step, dict):
                        flag("malformed_trace_entry", slot)
                        continue
                    trace_base = base + "/episode"
                    if not trace_artifact(archive, trace_base, step.get("observation_artifact"), step.get("observation_sha256")):
                        flag("missing_or_changed_raw_observation", f"{slot}/trace[{pos}]")
                    if "next_observation_artifact" in step:
                        stepped += 1
                        if not trace_artifact(archive, trace_base, step.get("next_observation_artifact"), step.get("next_observation_sha256")):
                            flag("missing_or_changed_next_observation", f"{slot}/trace[{pos}]")
                    for probe in step.get("candidate_probes", []):
                        if not isinstance(probe, dict) or not set(probe.get("may_answer") or []).issubset(constraint_ids):
                            flag("trace_constraint_id_mismatch", f"{slot}/trace[{pos}]")
                            break
                if ep.get("steps") != stepped:
                    flag("trace_step_count_mismatch", slot)
                launcher_path = base + "/server/launcher.json"
                if not archive.exists(launcher_path):
                    flag("missing_launcher_record", slot)
                    continue
                launcher = archive.json(launcher_path)
                server = ep.get("server") or {}
                command = launcher.get("command")
                if (type(launcher.get("pid")) is not int or launcher["pid"] <= 0
                        or server.get("pid") != launcher.get("pid")
                        or launcher.get("server_url") != server.get("url")
                        or launcher.get("database_dir") != server.get("database_dir")
                        or launcher.get("logs_dir") != server.get("logs_dir")
                        or launcher.get("ownership_confirmed") is not True
                        or launcher.get("openapps_commit") != manifest.get("openapps_git_commit")
                        or not is_sha256(launcher.get("launcher_sha256"))
                        or not isinstance(command, list) or not any(str(x).endswith("launch.py") for x in command)
                        or launcher.get("returncode") is None):
                    flag("server_process_identity_mismatch", slot)
                if openapps_root is not None and (openapps_root / "launch.py").is_file():
                    if sha256((openapps_root / "launch.py").read_bytes()).hexdigest() != launcher.get("launcher_sha256"):
                        flag("server_launcher_source_mismatch", slot)
                try:
                    started = utc(launcher.get("launched_at_utc"))
                    ready = utc(launcher.get("ready_at_utc"))
                    ep_start = utc(ep.get("started_at_utc"))
                    ep_end = utc(ep.get("finished_at_utc"))
                    stopped = utc(launcher.get("stopped_at_utc"))
                    if not started <= ready <= ep_start <= ep_end <= stopped:
                        raise ValueError("unexpected timestamp ordering")
                except (ValueError, AttributeError, TypeError, OverflowError):
                    flag("runtime_timestamp_mismatch", slot)
                config_path = base + "/server/logs/config.yaml"
                if not archive.exists(config_path) or not re.search(
                        r"(?m)^apps\s*:", archive.read(config_path).decode("utf-8-sig", "replace")):
                    flag("missing_official_hydra_config", slot)
                log_path = base + "/server/server.log"
                if not archive.exists(log_path) or not archive.read(log_path).strip():
                    flag("missing_server_stdout_log", slot)
                db_path = base + "/server/databases/todo.db"
                if not archive.exists(db_path):
                    flag("missing_todo_database", slot)
                else:
                    try:
                        columns = todo_schema(archive.read(db_path))
                        if not {"id", "title", "done"}.issubset(columns):
                            flag("unmatched_todo_schema", slot)
                    except (sqlite3.DatabaseError, OSError):
                        flag("unreadable_todo_database", slot)
            if len(initial_hashes) == 2 and (initial_hashes[0] != initial_hashes[1]):
                flag("initial_state_parity_mismatch", pair_id)

        for field, expected in (("valid_pairs", valid_count),
                                ("invalid_pairs", invalid_count),
                                ("not_started_pairs", not_started_count)):
            if analysis.get(field) != expected:
                flag("analysis_denominator_mismatch", field)
        complete = valid_count + invalid_count == 256 and not_started_count == 0
        internal_pass = not blockers and inspected_episodes == valid_count * 2 and valid_count > 0
        return {
            "protocol": manifest.get("protocol"),
            "source": Path(source).name,
            "source_checks": source_status,
            "scheduled_pairs": len(planned),
            "valid_pairs": valid_count,
            "invalid_pairs": invalid_count,
            "not_started_pairs": not_started_count,
            "inspected_valid_episodes": inspected_episodes,
            "run_complete": complete,
            "runtime_artifact_contract": "PASS" if internal_pass else "FAIL",
            "blockers": dict(blockers),
            "examples": examples,
            "verification_scope": (
                "Source, captured launcher, official runner records, raw AXTree digests, "
                "and archive consistency. Historical process origin and official reward "
                "authenticity require independently retained original-host evidence "
                "or re-execution; this offline check does not attest either."
            ),
        }
    finally:
        archive.close()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("source", help="Path to output/scale/<id> or an archived ZIP")
    p.add_argument("--repo-root", type=Path, default=ROOT)
    p.add_argument("--openapps-dir", type=Path)
    p.add_argument("--report", type=Path)
    p.add_argument("--require-runtime-contract", action="store_true")
    p.add_argument("--require-complete", action="store_true")
    args = p.parse_args()
    try:
        report = audit(args.source, repo_root=args.repo_root, openapps_root=args.openapps_dir)
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError,
            sqlite3.DatabaseError) as exc:
        p.exit(2, f"RUNTIME AUDIT ERROR: {type(exc).__name__}: {exc}\n")
    output = json.dumps(report, indent=2, sort_keys=True) + "\n"
    print(output, end="")
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(output, encoding="utf-8")
    if (args.require_runtime_contract and report["runtime_artifact_contract"] != "PASS") or (
            args.require_complete and not report["run_complete"]):
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
