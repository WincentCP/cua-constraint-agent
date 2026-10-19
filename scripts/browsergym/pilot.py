"""Exploratory paired pilot: official OpenApps + BrowserGym, 6 x 4 x 2.

This is an ORCHESTRATOR, not a second agent or evaluator. It reuses the
matched Baseline/CDEA environment/decision implementation. It freezes a
pilot task list, model names, controller git SHA, budgets, order and seed,
records every planned episode (even missing/invalid ones), and NEVER
automatically reruns an attempted pair. Pilot != confirmatory main.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
import csv
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from types import SimpleNamespace

import matched_dev
from ollama_preflight import MODELS_FILE, get_model

ROOT = Path(__file__).resolve().parents[2]
PILOT_PLAN = ROOT / "config" / "pilot_plan.json"
OUTPUT_ROOT = ROOT / "output" / "pilot"
PILOT_ID = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$")
FIELDS = (
    "pair_id", "pair_index", "family", "task_group", "task", "model_label",
    "method", "pair_status", "paired_valid", "analysis_included",
    "episode_status", "episode_valid", "official_success_raw",
    "paired_analysis_success", "official_reward_raw", "steps",
    "model_calls", "invalid_model_actions", "repair_requests",
    "repaired_steps", "probe_opportunities", "policy_overrides",
    "model_seconds", "total_seconds", "end_reason",
    "initial_state_parity", "comparable_probe_decisions",
    "policy_action_divergences", "treatment_separation_observed",
    "episode_artifact", "error",
)
SUMMARY_FIELDS = (
    "model_label", "method", "planned_pairs", "valid_pairs",
    "invalid_pairs", "not_started_pairs", "paired_successes",
    "paired_failures", "success_rate_valid_pairs",
    "avg_browser_steps_on_success", "avg_total_seconds_on_success",
    "probe_opportunities_on_valid_pairs",
    "comparable_probe_decisions_valid_pairs",
    "policy_action_divergences_valid_pairs",
)


def canonical(data) -> bytes:
    return json.dumps(
        data, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def hash_file(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def load_object(path: Path) -> dict:
    obj = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(obj, dict):
        raise ValueError("Expected JSON object: " + str(path))
    return obj


def git_head(path: Path) -> str:
    return subprocess.run(
        ["git", "-C", str(path), "rev-parse", "HEAD"],
        check=True, capture_output=True, text=True,
    ).stdout.strip()


def validate_plan(plan: dict, model_configs: list) -> list[dict]:
    """Fail before starting any server if schedule/parameters are ambiguous."""
    if plan.get("protocol") != "cdea_pilot_v1":
        raise ValueError("Unexpected pilot protocol")
    if (plan.get("status") != "exploratory_pilot_not_main"
            or plan.get("seed") != 233
            or plan.get("max_steps") != 20
            or plan.get("model_timeout") != 240):
        raise ValueError("Pilot budgets/seed/status differ from reviewed v1 design")
    model_labels = plan.get("model_labels")
    available = {
        item["label"] for item in model_configs if isinstance(item, dict)
        and isinstance(item.get("label"), str)
    }
    if (not isinstance(model_labels, list) or len(model_labels) != 4
            or len(set(model_labels)) != 4
            or set(model_labels) != available):
        raise ValueError("Pilot must use all FOUR exactly configured model labels")
    for label in model_labels:
        name = get_model(model_configs, label)
        if not isinstance(name, str) or not name:
            raise ValueError("Pilot model has no configured Ollama name")
    tasks = plan.get("tasks")
    if not isinstance(tasks, list) or len(tasks) != 6:
        raise ValueError("Pilot plan must contain exactly SIX task families")
    seen = set()
    for item in tasks:
        if not isinstance(item, dict):
            raise ValueError("Pilot task entry must be an object")
        group, task, family = (item.get("task_group"), item.get("task"),
                               item.get("family"))
        if group not in matched_dev.TASK_GROUPS:
            raise ValueError("Unsupported official task group: " + str(group))
        if not isinstance(task, str) or not matched_dev.TASK_KEY.fullmatch(task):
            raise ValueError("Invalid official task key")
        if not isinstance(family, str) or not matched_dev.TASK_KEY.fullmatch(family):
            raise ValueError("Invalid task family label")
        if (group, task) in seen:
            raise ValueError("Duplicate pilot task entry")
        seen.add((group, task))
    if len({x["family"] for x in tasks}) != 6:
        raise ValueError("Each pilot task must have distinct family label")
    return [{
        "task": item["task"], "task_group": item["task_group"],
        "family": item["family"]
    } for item in tasks]


def official_task_preflight(openapps: Path, tasks: list[dict]) -> None:
    """Read official Hydra task registry; do not instantiate or run task oracle."""
    from hydra import compose, initialize_config_dir
    grouped = defaultdict(list)
    for item in tasks:
        grouped[item["task_group"]].append(item["task"])
    with initialize_config_dir(
        config_dir=str(openapps / "config"), version_base=None
    ):
        for group, names in grouped.items():
            cfg = compose(config_name="config", overrides=[f"tasks={group}"])
            missing = [name for name in names if name not in cfg.tasks]
            if missing:
                raise RuntimeError(
                    f"Official OpenApps tasks={group} missing: {missing}"
                )


def pair_schedule(plan: dict) -> list[dict]:
    pairs = []
    for task in plan["tasks"]:
        for model_label in plan["model_labels"]:
            pair_index = len(pairs) + 1
            pairs.append({
                "pair_id": f"pair_{pair_index:03d}",
                "pair_index": pair_index,
                "task": task["task"],
                "task_group": task["task_group"],
                "family": task["family"],
                "model_label": model_label,
                "order": matched_dev.pair_order(
                    task["task"], model_label, plan["seed"],
                ),
            })
    return pairs


def create_manifest(pilot_id: str, plan: dict, repo_sha: str,
                    models: list, model_config_sha: str,
                    plan_sha: str, openapps_sha: str) -> dict:
    if openapps_sha != matched_dev.UPSTREAM_PIN:
        raise RuntimeError("OpenApps git SHA does not match the pinned version")
    pairs = pair_schedule(plan)
    if len(pairs) != 24:
        raise RuntimeError("Pilot pair count is not 24")
    return {
        "mode": "official_browsergym_exploratory_pilot",
        "pilot_id": pilot_id,
        "protocol": plan["protocol"],
        "not_main_experiment": True,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "controller_git_commit": repo_sha,
        "openapps_git_commit": openapps_sha,
        "pilot_plan_sha256": plan_sha,
        "model_config_sha256": model_config_sha,
        "model_names": {label: get_model(models, label)
                        for label in plan["model_labels"]},
        "shared_parameters": {
            "seed": plan["seed"], "max_steps": plan["max_steps"],
            "model_timeout": plan["model_timeout"],
            "temperature": matched_dev.TEMPERATURE,
            "num_predict": matched_dev.NUM_PREDICT,
            "action_subsets": list(matched_dev.ACTION_SUBSETS),
            "bid_click_timeout_ms": matched_dev.DEV_CLICK_TIMEOUT_MS,
            "click_force_retry": False,
            "bounded_shared_repairs": 1,
        },
        "rules": {
            "paired_validity": plan["pair_validity_rule"],
            "invalid_episode": plan["invalid_episode_rule"],
            "analysis": plan["analysis_rule"],
        },
        "pairs": pairs,
        "planned_pairs": len(pairs),
        "planned_episodes": 2 * len(pairs),
    }


def assert_frozen(existing: dict, expected: dict) -> None:
    # Only the creation timestamp is allowed to differ upon reopening.
    except_date = lambda item: {
        key: value for key, value in item.items() if key != "created_utc"
    }
    if except_date(existing) != except_date(expected):
        raise RuntimeError(
            "Existing pilot manifest differs from current plan, models, "
            "repo commit or parameters. Never rewrite a started pilot. "
            "Restore its frozen code/config or start a NEW pilot ID."
        )


def atomic_json(path: Path, data) -> None:
    tmp = path.with_name(path.name + ".tmp")
    try:
        tmp.write_bytes(
            json.dumps(data, indent=2, ensure_ascii=False,
                       sort_keys=True).encode("utf-8") + b"\n"
        )
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink()


def atomic_csv(path: Path, fields: tuple[str, ...], rows: list[dict]) -> None:
    tmp = path.with_name(path.name + ".tmp")
    try:
        with tmp.open("w", newline="", encoding="utf-8-sig") as file:
            writer = csv.DictWriter(file, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink()


def open_pilot(pilot_id: str, plan: dict, models: list,
               plan_sha: str, model_config_sha: str,
               repo_sha: str, openapps_sha: str) -> tuple[Path, dict]:
    if not PILOT_ID.fullmatch(pilot_id):
        raise ValueError("Pilot ID must be 1-40 ASCII letters/digits/_/-")
    directory = OUTPUT_ROOT / pilot_id
    manifest_file = directory / "manifest.json"
    expected = create_manifest(
        pilot_id, plan, repo_sha, models, model_config_sha, plan_sha,
        openapps_sha,
    )
    if directory.exists() and not manifest_file.is_file():
        raise RuntimeError(
            "Pilot directory exists without frozen manifest: " + str(directory)
        )
    if manifest_file.is_file():
        existing = load_object(manifest_file)
        assert_frozen(existing, expected)
        return directory, existing
    directory.mkdir(parents=True, exist_ok=False)
    atomic_json(manifest_file, expected)
    return directory, expected


def freeze_model_digest(directory: Path, manifest: dict,
                        identity: dict) -> None:
    """Append first-seen Ollama digest; subsequent runs must match EXACTLY."""
    lock_path = directory / "model_digests.json"
    current = load_object(lock_path) if lock_path.exists() else {}
    label, actual = identity["label"], identity["digest"]
    expected_name = manifest["model_names"].get(label)
    if identity["name"] != expected_name:
        raise RuntimeError("Model configured name differs from pilot manifest")
    if label in current:
        entry = current[label]
        if (not isinstance(entry, dict)
                or entry.get("digest") != actual
                or entry.get("name") != expected_name):
            raise RuntimeError(
                f"Ollama model digest/name for {label} CHANGED during pilot; "
                "refusing non-comparable continuation"
            )
    else:
        current[label] = {"name": expected_name, "digest": actual}
        atomic_json(lock_path, current)


def _read_episode(path: Path) -> dict | None:
    if not path.is_file():
        return None
    try:
        return load_object(path)
    except (ValueError, OSError, json.JSONDecodeError):
        return None


def load_pair(directory: Path, slot: dict) -> dict | None:
    path = directory / "episodes" / slot["pair_id"] / "pair.json"
    if not path.is_file():
        return None
    obj = load_object(path)
    for field in ("pair_id", "task", "task_group", "model_label"):
        if obj.get(field) != slot[field]:
            raise RuntimeError(
                "Mismatched frozen pilot pair artifact " + str(path)
            )
    return obj


def inspect_slot(directory: Path, slot: dict, locks: dict) -> dict:
    """Read raw records, but count outcomes ONLY if both arms are valid."""
    report = load_pair(directory, slot)
    pair_dir = directory / "episodes" / slot["pair_id"]
    episodes = {
        method: _read_episode(pair_dir / method / "episode" / "episode.json")
        for method in matched_dev.METHODS
    }
    status = report.get("status") if report else "not_started"
    locked = locks.get(slot["model_label"])
    def episode_valid(method):
        ep = episodes[method]
        if not isinstance(ep, dict):
            return False
        if (ep.get("study_phase") != "pilot" or
            ep.get("method") != method or
            ep.get("task") != slot["task"] or
            ep.get("task_group") != slot["task_group"] or
            ep.get("pilot_id") != directory.name or
            not ep.get("valid") or
            not ep.get("run_complete") or
            not isinstance(ep.get("official_success"), bool) or
            not isinstance(ep.get("initial_sha256"), str)):
            return False
        return (
            isinstance(locked, dict)
            and ep.get("model_digest") == locked.get("digest")
            and ep.get("model") == locked.get("name")
        )
    valid_pair = bool(
        report is not None and status == "paired_pilot_completed"
        and report.get("initial_hash_parity") is True
        and all(episode_valid(method) for method in matched_dev.METHODS)
        and episodes["Baseline"]["initial_sha256"]
        == episodes["Proposed"]["initial_sha256"]
        and report.get("model_identity", {}).get("digest")
        == locked.get("digest") if isinstance(locked, dict) else False
    )
    comparison = report.get("policy_diagnostics") if report else {}
    if not isinstance(comparison, dict):
        comparison = {}
    results = []
    for method in matched_dev.METHODS:
        ep = episodes[method] or {}
        path = pair_dir / method / "episode" / "episode.json"
        raw_success = ep.get("official_success")
        results.append({
            **{k: slot[k] for k in (
                "pair_id", "pair_index", "family", "task_group",
                "task", "model_label",
            )},
            "method": method,
            "pair_status": status,
            "paired_valid": valid_pair,
            "analysis_included": valid_pair,
            "episode_status": ep.get("status", "not_run"),
            "episode_valid": ep.get("valid", ""),
            "official_success_raw": raw_success
                if isinstance(raw_success, bool) else "",
            "paired_analysis_success": raw_success if valid_pair else "",
            "official_reward_raw": ep.get("official_reward", "")
                if ep.get("official_reward") is not None else "",
            "steps": ep.get("steps", ""),
            "model_calls": ep.get("model_calls", ""),
            "invalid_model_actions": ep.get("invalid_model_actions", ""),
            "repair_requests": ep.get("repair_requests", ""),
            "repaired_steps": ep.get("repaired_steps", ""),
            "probe_opportunities": ep.get("probe_opportunities", ""),
            "policy_overrides": ep.get("policy_overrides", ""),
            "model_seconds": ep.get("model_seconds", ""),
            "total_seconds": ep.get("total_seconds", ""),
            "end_reason": ep.get("end_reason", ""),
            "initial_state_parity": (
                report.get("initial_hash_parity", "") if report else ""
            ),
            "comparable_probe_decisions": (
                comparison.get("comparable_probe_decisions", "") if valid_pair else ""
            ),
            "policy_action_divergences": (
                comparison.get("policy_action_divergences", "") if valid_pair else ""
            ),
            "treatment_separation_observed": (
                comparison.get("treatment_separation_observed", "")
                if valid_pair else ""
            ),
            "episode_artifact": str(path.relative_to(directory).as_posix())
                if path.is_file() else "",
            "error": ep.get("error", "") or
                     (report.get("error", "") if report else ""),
        })
    return {
        "pair_id": slot["pair_id"], "status": status, "valid": valid_pair,
        "rows": results, "comparison": comparison if valid_pair else {},
    }


def _fmt_avg(values) -> str:
    return f"{sum(values) / len(values):.3f}" if values else ""


def summarize(views: list[dict], model_labels: list[str]) -> list[dict]:
    result = []
    for label in [*model_labels, "ALL_MODELS"]:
        for method in matched_dev.METHODS:
            selected = [
                v for v in views
                if label == "ALL_MODELS" or
                any(row["model_label"] == label for row in v["rows"])
            ]
            valid = [v for v in selected if v["valid"]]
            invalid = [v for v in selected if not v["valid"]
                       and v["status"] != "not_started"]
            pending = [v for v in selected if v["status"] == "not_started"]
            method_rows = [
                next(row for row in v["rows"] if row["method"] == method)
                for v in valid
            ]
            successes = [row for row in method_rows
                         if row["paired_analysis_success"] is True]
            n_success = len(successes)
            comparable = sum(
                int(v["comparison"].get("comparable_probe_decisions", 0))
                for v in valid
            )
            divergent = sum(
                int(v["comparison"].get("policy_action_divergences", 0))
                for v in valid
            )
            result.append({
                "model_label": label, "method": method,
                "planned_pairs": len(selected),
                "valid_pairs": len(valid),
                "invalid_pairs": len(invalid),
                "not_started_pairs": len(pending),
                "paired_successes": n_success,
                "paired_failures": len(valid) - n_success,
                "success_rate_valid_pairs":
                    f"{n_success / len(valid):.4f}" if valid else "",
                "avg_browser_steps_on_success":
                    _fmt_avg([float(row["steps"]) for row in successes]),
                "avg_total_seconds_on_success":
                    _fmt_avg([float(row["total_seconds"]) for row in successes]),
                "probe_opportunities_on_valid_pairs":
                    sum(int(row["probe_opportunities"] or 0)
                        for row in method_rows),
                "comparable_probe_decisions_valid_pairs": comparable,
                "policy_action_divergences_valid_pairs": divergent,
            })
    return result


def refresh_csv(directory: Path, manifest: dict) -> tuple[list[dict], list[dict]]:
    lock_path = directory / "model_digests.json"
    locks = load_object(lock_path) if lock_path.exists() else {}
    views = [inspect_slot(directory, slot, locks)
             for slot in manifest["pairs"]]
    rows = [row for view in views for row in view["rows"]]
    summary = summarize(
        views, list(manifest["model_names"].keys())
    )
    atomic_csv(directory / "results.csv", FIELDS, rows)
    atomic_csv(directory / "summary.csv", SUMMARY_FIELDS, summary)
    return views, summary


def acquire_lock(directory: Path) -> Path:
    """Do not allow two simultaneous writers to the same pilot output."""
    path = directory / ".pilot_running.lock"
    fd = os.open(str(path), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as file:
        file.write(f"PID={os.getpid()}\n")
    return path


def execute_pairs(directory: Path, manifest: dict, args,
                  identities: dict) -> int:
    lock = acquire_lock(directory)
    interrupted = False
    try:
        # The pilot lock must cover model-digest initialization, CSV writes
        # and execution. Otherwise two invocations could alter the model
        # digest registry BEFORE the concurrency guard is held.
        for identity in identities.values():
            freeze_model_digest(directory, manifest, identity)
        refresh_csv(directory, manifest)
        selected = [
            slot for slot in manifest["pairs"]
            if args.model_label is None or
            slot["model_label"] == args.model_label
        ]
        count = 0
        for slot in selected:
            path = directory / "episodes" / slot["pair_id"]
            report_path = path / "pair.json"
            if report_path.is_file():
                # Recorded failures and partial pairs are never silently
                # retried; both are counted and retained on resume.
                load_pair(directory, slot)
                continue
            if path.exists():
                raise RuntimeError(
                    "Incomplete pair folder WITHOUT pair.json; do not rerun "
                    "blindly. Inspect and archive the artifact: " + str(path)
                )
            if args.max_pairs is not None and count >= args.max_pairs:
                break
            path.mkdir(parents=True, exist_ok=False)
            count += 1
            identity = identities[slot["model_label"]]
            report = {
                "mode": "official_browsergym_exploratory_pilot",
                "pilot_id": directory.name,
                "pair_id": slot["pair_id"],
                "pair_index": slot["pair_index"],
                "family": slot["family"],
                "status": "invalid_pair",
                "task_group": slot["task_group"],
                "task": slot["task"],
                "model_label": slot["model_label"],
                "artifact_dir": str(path),
                "initial_hash_parity": False,
                "episodes": {},
                "pilot_manifest_sha256":
                    hash_file(directory / "manifest.json"),
            }
            episode_args = SimpleNamespace(
                openapps_dir=str(args.openapps_dir),
                model_label=slot["model_label"],
                task=slot["task"], task_group=slot["task_group"],
                seed=manifest["shared_parameters"]["seed"],
                max_steps=manifest["shared_parameters"]["max_steps"],
                model_timeout=manifest["shared_parameters"]["model_timeout"],
                ollama_url=args.ollama_url,
                study_phase="pilot", pilot_id=directory.name,
            )
            print(
                f"PILOT {slot['pair_id']}/24 | {slot['model_label']} | "
                f"{slot['task_group']}/{slot['task']}", flush=True
            )
            try:
                matched_dev.run_pair(episode_args, report)
                if report.get("order") != slot["order"]:
                    raise RuntimeError(
                        "Paired order drifted from frozen pilot schedule"
                    )
                if report["model_identity"]["digest"] != identity["digest"]:
                    raise RuntimeError(
                        "Model digest drifted from pilot lock within pair"
                    )
            except KeyboardInterrupt:
                report.update(status="invalid_pair",
                              error="KeyboardInterrupt: manual interruption")
                interrupted = True
            except Exception as exc:
                report.update(
                    status="invalid_pair",
                    error=type(exc).__name__ + ": " + str(exc)[:1000],
                )
            finally:
                atomic_json(report_path, report)
                refresh_csv(directory, manifest)
            print(f"  Pair recorded: {report['status']} | {report_path}",
                  flush=True)
            if interrupted or (
                args.stop_on_invalid and report["status"] != "paired_pilot_completed"
            ):
                break
    finally:
        if lock.exists():
            lock.unlink()
    views, summary = refresh_csv(directory, manifest)
    valid = sum(v["valid"] for v in views)
    invalid = sum(v["status"] != "not_started" and not v["valid"]
                  for v in views)
    remaining = sum(v["status"] == "not_started" for v in views)
    print(
        f"PILOT RECORDED: valid_pairs={valid} invalid_pairs={invalid} "
        f"not_started_pairs={remaining} planned_pairs=24. "
        f"CSV: {directory / 'results.csv'}",
        flush=True,
    )
    print(
        "MECHANISM: check summary.csv comparable_probe_decisions_valid_pairs "
        "and policy_action_divergences_valid_pairs before interpreting CDEA.",
        flush=True,
    )
    return 130 if interrupted else 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--dry-run", action="store_true",
                        help="Validate pinned task inventory; NO browser or Ollama")
    action.add_argument("--check-models", action="store_true",
                        help="Check the 4 Ollama names/digests; NO browser")
    action.add_argument("--run", action="store_true",
                        help="Execute or resume one explicitly named pilot")
    parser.add_argument("--pilot-id",
                        help="Stable folder name, e.g. pilot_v1; required with --run")
    parser.add_argument("--openapps-dir", type=Path, required=True)
    parser.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    parser.add_argument("--model-label", default=None,
                        help="Optional selected model for staged execution")
    parser.add_argument("--max-pairs", type=int, default=None,
                        help="Limit newly executed pairs this invocation")
    parser.add_argument("--stop-on-invalid", action="store_true",
                        help="Stop after the first invalid pair")
    args = parser.parse_args(argv)
    if args.run and not args.pilot_id:
        parser.error("--run requires explicit --pilot-id")
    if args.pilot_id and not PILOT_ID.fullmatch(args.pilot_id):
        parser.error("pilot-id must be ASCII alphanumeric/_/- (max 40)")
    if args.max_pairs is not None and not 1 <= args.max_pairs <= 24:
        parser.error("--max-pairs must be between 1 and 24")
    plan = load_object(PILOT_PLAN)
    models = json.loads(MODELS_FILE.read_text(encoding="utf-8"))
    tasks = validate_plan(plan, models)
    if args.model_label is not None and args.model_label not in plan["model_labels"]:
        parser.error("Unknown pilot model label")
    openapps = args.openapps_dir.expanduser().resolve()
    if not (openapps / "launch.py").is_file():
        raise RuntimeError("Pinned OpenApps checkout missing at " + str(openapps))
    openapps_sha = git_head(openapps)
    if openapps_sha != matched_dev.UPSTREAM_PIN:
        raise RuntimeError("OpenApps checkout SHA differs from official pin")
    official_task_preflight(openapps, tasks)
    schedule = pair_schedule(plan)
    if args.dry_run:
        print("PILOT DRY RUN PASS: 6 task families / 4 models / "
              "2 methods = 24 matched pairs, 48 planned episodes.")
        for t in tasks:
            print(f"  {t['task_group']}/{t['task']} [{t['family']}]")
        print("Pinned OpenApps: " + openapps_sha)
        print("No Ollama, browsers, data collection, or output files started.")
        return 0

    labels = (
        [args.model_label] if args.model_label else list(plan["model_labels"])
    )
    identities = {}
    missing = []
    for label in labels:
        try:
            identities[label] = matched_dev.model_identity(
                label, args.ollama_url,
            )
        except Exception as exc:
            missing.append(f"{label}: {type(exc).__name__}: {exc}")
    if missing:
        for error in missing:
            print("PILOT PREFLIGHT FAIL: " + error, file=sys.stderr)
        print("No pilot episode was started. Install/check each required "
              "model, or select one installed model with --model-label.",
              file=sys.stderr)
        return 2
    if args.check_models:
        for label in labels:
            print(f"MODEL OK: {label} {identities[label]['name']} "
                  f"digest={identities[label]['digest'][:16]}")
        print("No browser or pilot episode was started.")
        return 0

    directory, manifest = open_pilot(
        args.pilot_id, plan, models, hash_file(PILOT_PLAN),
        hash_file(MODELS_FILE), git_head(ROOT), openapps_sha,
    )
    # Digests and CSV output are initialized INSIDE execute_pairs' exclusive
    # writer lock. Resume always refuses overwritten/inconsistent episodes.
    return execute_pairs(directory, manifest, args, identities)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError, OSError) as exc:
        print(f"PILOT ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(2)
