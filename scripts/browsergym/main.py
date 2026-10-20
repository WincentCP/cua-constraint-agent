"""Preregistered, execution-gated official OpenApps Main: 32 x 4 x 2.

Pure orchestrator: Baseline and Proposed reuse matched_dev.run_pair, the same
public AXTree/model prompts/action policy and official BrowserGym evaluator.
No synthetic observations, no fallback reward, no selective reruns.
Offline CI tests do NOT constitute live experimental evidence.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
import json
from math import comb, isfinite
import os
from pathlib import Path
import re
import subprocess
import sys
from types import SimpleNamespace

import matched_dev
import pilot
from ollama_preflight import MODELS_FILE, get_model

ROOT = Path(__file__).resolve().parents[2]
MAIN_PLAN = ROOT / "config" / "main_plan.json"
TASKSET = ROOT / "config" / "main_taskset_v1.json"
PILOT_PLAN = ROOT / "config" / "pilot_plan.json"
OUTPUT_ROOT = ROOT / "output" / "main"
MAIN_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$")
COHORTS = ("bank_information", "cross_app_workflow", "primitive_control", "ALL_TASKS")
METHODS = ("Baseline", "Proposed")
RESULT_FIELDS = (
    "main_id", "pair_id", "pair_index", "task_index", "stratum", "family",
    "task_group", "task", "model_label", "method", "pair_status",
    "paired_valid", "analysis_included", "episode_status", "episode_valid",
    "official_success_raw", "paired_analysis_success", "official_reward_raw",
    "steps", "model_calls", "invalid_model_actions", "repair_requests",
    "repaired_steps", "probe_opportunities", "policy_overrides",
    "model_seconds", "total_seconds", "end_reason", "initial_state_parity",
    "comparable_probe_decisions", "policy_action_divergences",
    "treatment_separation_observed", "episode_artifact", "error",
)
PAIR_FIELDS = (
    "pair_id", "pair_index", "task_index", "stratum", "family", "task_group",
    "task", "model_label", "pair_status", "paired_valid",
    "baseline_success", "proposed_success", "discordance", "paired_delta",
)
SUMMARY_FIELDS = (
    "cohort", "model_label", "method", "planned_pairs", "valid_pairs",
    "invalid_pairs", "not_started_pairs", "paired_successes", "paired_failures",
    "success_rate_valid_pairs", "avg_browser_steps_on_success",
    "avg_total_seconds_on_success", "probe_opportunities_valid_pairs",
    "comparable_probe_decisions_valid_pairs",
    "policy_action_divergences_valid_pairs", "proposed_only_successes",
    "baseline_only_successes",
)


def load_plan() -> tuple[dict, dict, list]:
    return (pilot.load_object(MAIN_PLAN), pilot.load_object(TASKSET),
            json.loads(MODELS_FILE.read_text(encoding="utf-8")))


def validate_plan(plan: dict, roster: dict, models: list) -> list[dict]:
    """Validate plan/roster against Pilot exclusions BEFORE scheduling anything."""
    if (plan.get("schema_version") != 1
            or plan.get("protocol") != "cdea_main_v1"
            or plan.get("status") != "preregistered_execution_gated"):
        raise ValueError("Main protocol/status/version differs from reviewed v1")
    if (roster.get("protocol") != plan.get("taskset_protocol")
            or plan.get("taskset_file") != "config/main_taskset_v1.json"
            or plan.get("task_order_sha256") != roster.get("task_order_sha256")
            or plan.get("pinned_openapps_commit") != matched_dev.UPSTREAM_PIN
            or roster.get("openapps_git_commit") != matched_dev.UPSTREAM_PIN):
        raise ValueError("Main frozen roster/official OpenApps pin mismatch")
    expected_controls = {
        "seed": 233, "max_steps": 40, "model_timeout": 240,
        "temperature": matched_dev.TEMPERATURE,
        "num_predict": matched_dev.NUM_PREDICT,
        "think": False, "action_subsets": list(matched_dev.ACTION_SUBSETS),
        "bounded_shared_repairs": 1, "click_force_retry": False,
        "planned_tasks": 32, "planned_matched_pairs": 128,
        "planned_episodes": 256,
    }
    for key, value in expected_controls.items():
        if plan.get(key) != value:
            raise ValueError(f"Changed frozen main control: {key}")
    labels = plan.get("model_labels")
    if (not isinstance(labels, list) or len(labels) != 4
            or len(set(labels)) != 4
            or labels != roster.get("model_labels")
            or set(labels) != {m["label"] for m in models}):
        raise ValueError("Main requires the four exact frozen model labels")
    if plan.get("methods") != list(METHODS):
        raise ValueError("Main method set drifted")
    for label in labels:
        if not get_model(models, label):
            raise ValueError("Model name missing: " + label)
    if plan.get("readiness_protocol") != "cdea_main_readiness_v1":
        raise ValueError("Main readiness protocol drift")
    if plan.get("analysis", {}).get("primary_cohort") != "bank_information":
        raise ValueError("Main primary analysis cohort drift")
    if plan.get("analysis", {}).get("primary_planned_pairs") != 20:
        raise ValueError("Main primary sample definition drift")
    if plan.get("analysis", {}).get("interim_inference") is not False:
        raise ValueError("Interim inference is forbidden")

    tasks = roster.get("tasks")
    if not isinstance(tasks, list) or len(tasks) != 32:
        raise ValueError("Main requires 32 pinned official task IDs")
    pilot_ids = {
        (item["task_group"], item["task"])
        for item in pilot.load_object(PILOT_PLAN)["tasks"]
    }
    if {(x["task_group"], x["task"]) for x in roster["pilot_exclusions"]} != pilot_ids:
        raise ValueError("Pilot exclusions changed")
    seen, families, strata = set(), set(), Counter()
    for i, task in enumerate(tasks, start=1):
        group, key = task.get("task_group"), task.get("task")
        if (group not in matched_dev.TASK_GROUPS
                or not isinstance(key, str)
                or not matched_dev.TASK_KEY.fullmatch(key)
                or (group, key) in seen
                or (group, key) in pilot_ids
                or task.get("main_index") != i):
            raise ValueError(f"Duplicate, invalid or Pilot-overlapping main task #{i}")
        if (not isinstance(task.get("family"), str)
                or task["family"] in families
                or not matched_dev.TASK_KEY.fullmatch(task["family"])):
            raise ValueError("Main task operational family invalid/duplicated")
        expected_stratum = {
            "all_tasks": "primitive_control",
            "longer_horizon": "cross_app_workflow",
            "openbanking": "bank_information",
        }[group]
        if task.get("stratum") != expected_stratum:
            raise ValueError("Main stratum drift")
        strata[expected_stratum] += 1
        seen.add((group, key))
        families.add(task["family"])
    if strata != {"primitive_control": 9,
                  "cross_app_workflow": 18, "bank_information": 5}:
        raise ValueError("Frozen main stratum allocation drift")
    roster_bytes = "".join(
        f'{task["task_group"]}/{task["task"]}\n' for task in tasks
    ).encode("utf-8")
    if sha256(roster_bytes).hexdigest() != plan["task_order_sha256"]:
        raise ValueError("Frozen main task order checksum mismatch")
    return tasks


def pair_schedule(plan: dict, tasks: list[dict]) -> list[dict]:
    """Seeded pre-outcome shuffle of all task/model units, fixed paired order."""
    pairs = []
    for task in tasks:
        for model in plan["model_labels"]:
            pairs.append({
                "task_index": task["main_index"],
                "task": task["task"], "task_group": task["task_group"],
                "family": task["family"], "stratum": task["stratum"],
                "model_label": model,
                "order": matched_dev.pair_order(task["task"], model, plan["seed"]),
            })
    pairs.sort(key=lambda s: sha256(
        f'{plan["seed"]}|{s["task_group"]}/{s["task"]}|{s["model_label"]}'
        .encode("utf-8")
    ).hexdigest())
    for i, pair in enumerate(pairs, start=1):
        pair["pair_index"] = i
        pair["pair_id"] = f"pair_{i:03d}"
    if len(pairs) != 128 or any(set(p["order"]) != set(METHODS) for p in pairs):
        raise RuntimeError("Main schedule not 128 matched pairs")
    return pairs


def require_clean_repo() -> str:
    root_sha = pilot.git_head(ROOT)
    proc = subprocess.run(
        ["git", "-C", str(ROOT), "status", "--porcelain"],
        capture_output=True, text=True, check=True,
    )
    if proc.stdout.strip():
        raise RuntimeError("Uncommitted/untracked repo changes; freeze controller first")
    return root_sha


def verify_readiness(path: Path, plan: dict, controller_sha: str) -> dict:
    """Require evidence-bearing HUMAN attestation; cannot certify provenance."""
    path = path.expanduser().resolve()
    obj = pilot.load_object(path)
    if (obj.get("protocol") != plan["readiness_protocol"]
            or obj.get("status") != "approved"
            or not isinstance(obj.get("approved_by"), str)
            or not obj["approved_by"].strip()
            or obj.get("controller_git_commit") != controller_sha
            or obj.get("task_order_sha256") != plan["task_order_sha256"]
            or obj.get("openapps_git_commit") != plan["pinned_openapps_commit"]):
        raise ValueError("Main readiness approval/identity incomplete or mismatched")
    stamp = obj.get("approved_utc")
    if not isinstance(stamp, str):
        raise ValueError("Readiness approval needs an offset-aware UTC date")
    when = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    if when.tzinfo is None:
        raise ValueError("Readiness approval timestamp needs an explicit offset")
    checks = obj.get("checks")
    if not isinstance(checks, dict) or set(checks) != set(plan["readiness_checks"]):
        raise ValueError("Readiness evidence checklist does not match frozen protocol")
    evidence = {}
    for key in plan["readiness_checks"]:
        row = checks[key]
        if not isinstance(row, dict) or row.get("passed") is not True:
            raise ValueError("Readiness check not approved: " + key)
        location = row.get("evidence_path")
        if not isinstance(location, str) or not location.strip():
            raise ValueError("Readiness missing evidence for " + key)
        source = Path(location).expanduser().resolve()
        if not source.is_file() or source == path:
            raise ValueError("Readiness evidence must be a separate existing file: " + key)
        evidence[key] = pilot.hash_file(source)
    return {"readiness_sha256": pilot.hash_file(path),
            "readiness_evidence_sha256": evidence,
            "approval_timestamp_utc": stamp,
            "approved_by": obj["approved_by"].strip()}


def create_manifest(main_id: str, plan: dict, tasks: list[dict],
                    models: list, repo_sha: str, openapps_sha: str,
                    approval: dict) -> dict:
    if openapps_sha != matched_dev.UPSTREAM_PIN:
        raise RuntimeError("Official OpenApps pin mismatch before Main")
    schedule = pair_schedule(plan, tasks)
    return {
        "mode": "official_browsergym_main_confirmatory",
        "main_id": main_id, "protocol": plan["protocol"],
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "controller_git_commit": repo_sha,
        "openapps_git_commit": openapps_sha,
        "main_plan_sha256": pilot.hash_file(MAIN_PLAN),
        "taskset_sha256": pilot.hash_file(TASKSET),
        "model_config_sha256": pilot.hash_file(MODELS_FILE),
        "pilot_plan_sha256": pilot.hash_file(PILOT_PLAN),
        "task_order_sha256": plan["task_order_sha256"],
        "readiness_sha256": approval["readiness_sha256"],
        "readiness_evidence_sha256": approval["readiness_evidence_sha256"],
        "approved_by": approval["approved_by"],
        "approval_timestamp_utc": approval["approval_timestamp_utc"],
        "model_names": {label: get_model(models, label)
                        for label in plan["model_labels"]},
        "shared_parameters": {
            "seed": plan["seed"], "max_steps": plan["max_steps"],
            "model_timeout": plan["model_timeout"],
            "temperature": plan["temperature"],
            "num_predict": plan["num_predict"], "think": False,
            "action_subsets": plan["action_subsets"],
            "bid_click_timeout_ms": matched_dev.DEV_CLICK_TIMEOUT_MS,
            "bounded_shared_repairs": 1, "click_force_retry": False,
        },
        "paired_validity_rule": plan["paired_validity_rule"],
        "invalid_episode_rule": plan["invalid_episode_rule"],
        "preregistered_analysis": plan["analysis"],
        "planned_pairs": 128, "planned_episodes": 256,
        "pairs": schedule,
    }


def open_main(main_id: str, expected: dict) -> tuple[Path, dict]:
    if not MAIN_ID_RE.fullmatch(main_id):
        raise ValueError("Main ID must be 1-40 ASCII letters/digits/_/-")
    directory = OUTPUT_ROOT / main_id
    manifest_path = directory / "manifest.json"
    if directory.exists() and not manifest_path.is_file():
        raise RuntimeError("Unsealed Main folder; inspect before continuing: " + str(directory))
    if manifest_path.is_file():
        existing = pilot.load_object(manifest_path)
        pilot.assert_frozen(existing, expected)
        return directory, existing
    directory.mkdir(parents=True, exist_ok=False)
    pilot.atomic_json(manifest_path, expected)
    return directory, expected


def freeze_model_digest(directory: Path, manifest: dict, identity: dict) -> None:
    lock = directory / "model_digests.json"
    current = pilot.load_object(lock) if lock.is_file() else {}
    label = identity["label"]
    expected = manifest["model_names"].get(label)
    if identity["name"] != expected:
        raise RuntimeError("Main model name not identical to frozen configuration")
    if not isinstance(identity.get("digest"), str) or not identity["digest"]:
        raise RuntimeError("Main model has no installed digest")
    entry = {"name": expected, "digest": identity["digest"]}
    if label in current and current[label] != entry:
        raise RuntimeError("Main model digest/name drift; start a new protocol")
    if label not in current:
        current[label] = entry
        pilot.atomic_json(lock, current)


def load_pair(directory: Path, slot: dict, manifest: dict) -> dict | None:
    file = directory / "episodes" / slot["pair_id"] / "pair.json"
    if not file.is_file():
        return None
    report = pilot.load_object(file)
    for key in ("pair_id", "pair_index", "task", "task_group",
                "model_label", "family", "stratum"):
        if report.get(key) != slot[key]:
            raise RuntimeError("Main pair artifact does not match frozen slot: " + str(file))
    if (report.get("main_id") != directory.name
            or report.get("main_manifest_sha256")
            != pilot.hash_file(directory / "manifest.json")):
        raise RuntimeError("Main pair artifact does not match frozen manifest")
    return report


def inspect_slot(directory: Path, slot: dict, manifest: dict,
                 locks: dict) -> dict:
    root = directory / "episodes" / slot["pair_id"]
    report = load_pair(directory, slot, manifest)
    status = report.get("status") if report else (
        "unsealed_pair" if root.exists() else "not_started"
    )
    paths = {
        method: root / method / "episode" / "episode.json"
        for method in METHODS
    }
    episodes = {method: pilot._read_episode(path) for method, path in paths.items()}
    locked = locks.get(slot["model_label"])
    settings = manifest["shared_parameters"]

    def valid_episode(method: str) -> bool:
        ep = episodes[method]
        if not isinstance(ep, dict) or not isinstance(locked, dict):
            return False
        reward = ep.get("official_reward")
        score_valid = (isinstance(reward, (int, float))
                       and not isinstance(reward, bool)
                       and isfinite(reward)
                       and isinstance(ep.get("official_success"), bool)
                       and ep["official_success"] is (reward >= 1.0))
        return bool(
            score_valid
            and ep.get("mode") == "paired_main_confirmatory"
            and ep.get("study_phase") == "main"
            and ep.get("main_id") == directory.name
            and ep.get("pilot_id") is None
            and ep.get("method") == method
            and ep.get("task") == slot["task"]
            and ep.get("task_group") == slot["task_group"]
            and ep.get("model") == locked.get("name")
            and ep.get("model_digest") == locked.get("digest")
            and ep.get("upstream_commit") == manifest["openapps_git_commit"]
            and ep.get("valid") is True
            and ep.get("run_complete") is True
            and ep.get("status") in ("main_success", "main_unsuccessful")
            and ep.get("status") == (
                "main_success" if ep["official_success"] else "main_unsuccessful"
            )
            and isinstance(ep.get("initial_sha256"), str)
            and len(ep["initial_sha256"]) == 64
            and isinstance(ep.get("trace"), list)
            and ep.get("seed") == settings["seed"]
            and ep.get("max_steps") == settings["max_steps"]
            and ep.get("temperature") == settings["temperature"]
            and ep.get("num_predict") == settings["num_predict"]
            and ep.get("think") is False
            and ep.get("action_subsets") == settings["action_subsets"]
            and ep.get("click_force_retry") is False
            and ep.get("bid_click_timeout_ms") == settings["bid_click_timeout_ms"]
            and isinstance(ep.get("steps"), int)
            and 0 <= ep["steps"] <= settings["max_steps"]
            and isinstance(ep.get("server"), dict)
            and isinstance(ep["server"].get("database_dir"), str)
            and bool(ep["server"]["database_dir"])
        )

    valid_pair = bool(
        report is not None
        and status == "paired_main_completed"
        and report.get("initial_hash_parity") is True
        and report.get("order") == slot["order"]
        and isinstance(locked, dict)
        and report.get("model_identity", {}).get("digest") == locked.get("digest")
        and report.get("model_identity", {}).get("name") == locked.get("name")
        and all(valid_episode(method) for method in METHODS)
        and episodes["Baseline"]["initial_sha256"]
        == episodes["Proposed"]["initial_sha256"]
        and episodes["Baseline"]["server"]["database_dir"]
        != episodes["Proposed"]["server"]["database_dir"]
    )
    comparison = {}
    if valid_pair:
        comparison = matched_dev.comparable_decisions(episodes)
        declared = report.get("policy_diagnostics")
        if not isinstance(declared, dict) or any(
            declared.get(k) != value for k, value in comparison.items()
        ):
            valid_pair = False
            comparison = {}
    rows = []
    for method in METHODS:
        ep = episodes[method] or {}
        raw = ep.get("official_success")
        rows.append({
            **{key: slot[key] for key in (
                "pair_id", "pair_index", "task_index", "stratum",
                "family", "task_group", "task", "model_label",
            )},
            "main_id": directory.name, "method": method,
            "pair_status": status, "paired_valid": valid_pair,
            "analysis_included": valid_pair,
            "episode_status": ep.get("status", "not_run"),
            "episode_valid": ep.get("valid", ""),
            "official_success_raw": raw if isinstance(raw, bool) else "",
            "paired_analysis_success": raw if valid_pair else "",
            "official_reward_raw": ep.get("official_reward")
                if ep.get("official_reward") is not None else "",
            **{key: ep.get(key, "") for key in (
                "steps", "model_calls", "invalid_model_actions",
                "repair_requests", "repaired_steps", "probe_opportunities",
                "policy_overrides", "model_seconds", "total_seconds",
                "end_reason",
            )},
            "initial_state_parity": report.get("initial_hash_parity", "")
                if report else "",
            "comparable_probe_decisions": comparison.get(
                "comparable_probe_decisions", "") if valid_pair else "",
            "policy_action_divergences": comparison.get(
                "policy_action_divergences", "") if valid_pair else "",
            "treatment_separation_observed": comparison.get(
                "treatment_separation_observed", "") if valid_pair else "",
            "episode_artifact": str(paths[method].relative_to(directory).as_posix())
                if paths[method].is_file() else "",
            "error": ep.get("error", "") or report.get("error", "") if report
                else ep.get("error", ""),
        })
    return {
        "slot": slot, "status": status, "valid": valid_pair,
        "rows": rows, "comparison": comparison,
    }


def exact_mcnemar_two_sided(proposed_only: int, baseline_only: int) -> float:
    """Exact conditional binomial McNemar; unadjusted exploratory sensitivity."""
    n = proposed_only + baseline_only
    if n == 0:
        return 1.0
    smaller = min(proposed_only, baseline_only)
    return min(1.0, 2 * sum(comb(n, k) for k in range(smaller + 1)) / (2 ** n))


def _outcome(view: dict) -> tuple[bool, bool] | None:
    if not view["valid"]:
        return None
    arm = {row["method"]: row["paired_analysis_success"]
           for row in view["rows"]}
    return bool(arm["Baseline"]), bool(arm["Proposed"])


def analysis(views: list[dict], manifest: dict) -> dict:
    primary_views = [v for v in views if v["slot"]["stratum"] == "bank_information"]
    valid = [v for v in primary_views if v["valid"]]
    outcomes = [(_outcome(v), v["slot"]) for v in valid]
    p_only = sum(p and not b for (b, p), _ in outcomes)
    b_only = sum(b and not p for (b, p), _ in outcomes)
    both = sum(b and p for (b, p), _ in outcomes)
    neither = sum(not b and not p for (b, p), _ in outcomes)
    finished = all(v["status"] != "not_started" for v in views)
    counts = Counter(v["status"] for v in views)
    breakdown = []
    for task_index in sorted({v["slot"]["task_index"] for v in primary_views}):
        sub = [v for v in primary_views if v["slot"]["task_index"] == task_index]
        pairs = [_outcome(v) for v in sub if v["valid"]]
        bp = sum(p and not b for b, p in pairs)
        bb = sum(b and not p for b, p in pairs)
        breakdown.append({
            "task_index": task_index, "task": sub[0]["slot"]["task"],
            "planned_pairs": len(sub), "valid_pairs": len(pairs),
            "proposed_only": bp, "baseline_only": bb,
            "paired_delta": ((bp - bb) / len(pairs)) if pairs else None,
        })
    return {
        "protocol": manifest["protocol"], "main_id": manifest["main_id"],
        "analysis_status": "complete_attempts" if finished else "partial_no_interim_inference",
        "total_planned_pairs": len(views), "total_valid_pairs":
            sum(v["valid"] for v in views),
        "total_invalid_pairs": sum(
            not v["valid"] and v["status"] != "not_started" for v in views
        ),
        "total_not_started_pairs": sum(v["status"] == "not_started" for v in views),
        "pair_statuses": dict(counts),
        "primary": {
            "cohort": "bank_information", "planned_pairs": len(primary_views),
            "valid_pairs": len(valid),
            "invalid_pairs": sum(not v["valid"] and v["status"] != "not_started"
                                 for v in primary_views),
            "not_started_pairs": sum(v["status"] == "not_started"
                                     for v in primary_views),
            "both_success": both, "proposed_only": p_only,
            "baseline_only": b_only, "neither_success": neither,
            "paired_success_delta": (p_only - b_only) / len(valid) if valid else None,
            "exact_mcnemar_p_two_sided_unadjusted_exploratory":
                exact_mcnemar_two_sided(p_only, b_only) if finished else None,
            "interpretation": (
                "Exploratory sensitivity only: five bank task IDs reuse "
                "application/seed/templates and model responses are correlated. "
                "Do not infer broad causal superiority from an unadjusted p-value."
            ),
            "by_task": breakdown,
        },
        "inference_released": finished,
    }


def summarize(views: list[dict], labels: list[str]) -> list[dict]:
    rows = []
    for cohort in COHORTS:
        for label in [*labels, "ALL_MODELS"]:
            selected = [v for v in views if (
                cohort == "ALL_TASKS" or v["slot"]["stratum"] == cohort
            ) and (
                label == "ALL_MODELS" or v["slot"]["model_label"] == label
            )]
            valid = [v for v in selected if v["valid"]]
            p_only = b_only = 0
            for view in valid:
                b, p = _outcome(view)
                p_only += int(p and not b)
                b_only += int(b and not p)
            for method in METHODS:
                episodes = [
                    next(row for row in v["rows"] if row["method"] == method)
                    for v in valid
                ]
                successes = [r for r in episodes
                             if r["paired_analysis_success"] is True]
                def avg(key):
                    return (f'{sum(float(r[key]) for r in successes) / len(successes):.3f}'
                            if successes else "")
                rows.append({
                    "cohort": cohort, "model_label": label, "method": method,
                    "planned_pairs": len(selected), "valid_pairs": len(valid),
                    "invalid_pairs": sum(not v["valid"] and v["status"] != "not_started"
                                         for v in selected),
                    "not_started_pairs": sum(v["status"] == "not_started"
                                             for v in selected),
                    "paired_successes": len(successes),
                    "paired_failures": len(valid) - len(successes),
                    "success_rate_valid_pairs":
                        f"{len(successes) / len(valid):.4f}" if valid else "",
                    "avg_browser_steps_on_success": avg("steps"),
                    "avg_total_seconds_on_success": avg("total_seconds"),
                    "probe_opportunities_valid_pairs":
                        sum(int(r["probe_opportunities"] or 0) for r in episodes),
                    "comparable_probe_decisions_valid_pairs":
                        sum(v["comparison"].get("comparable_probe_decisions", 0)
                            for v in valid),
                    "policy_action_divergences_valid_pairs":
                        sum(v["comparison"].get("policy_action_divergences", 0)
                            for v in valid),
                    "proposed_only_successes": p_only,
                    "baseline_only_successes": b_only,
                })
    return rows


def refresh_reports(directory: Path, manifest: dict) -> tuple[list[dict], dict]:
    lock = directory / "model_digests.json"
    locks = pilot.load_object(lock) if lock.is_file() else {}
    views = [inspect_slot(directory, slot, manifest, locks)
             for slot in manifest["pairs"]]
    result_rows = [row for view in views for row in view["rows"]]
    pair_rows = []
    for view in views:
        o = _outcome(view)
        if o is None:
            baseline = proposed = discordance = paired_delta = ""
        else:
            baseline, proposed = o
            discordance = (
                "proposed_only" if proposed and not baseline
                else "baseline_only" if baseline and not proposed
                else "both" if baseline else "neither"
            )
            paired_delta = int(proposed) - int(baseline)
        pair_rows.append({
            **{k: view["slot"][k] for k in (
                "pair_id", "pair_index", "task_index", "stratum", "family",
                "task_group", "task", "model_label",
            )}, "pair_status": view["status"], "paired_valid": view["valid"],
            "baseline_success": baseline, "proposed_success": proposed,
            "discordance": discordance, "paired_delta": paired_delta,
        })
    pilot.atomic_csv(directory / "results.csv", RESULT_FIELDS, result_rows)
    pilot.atomic_csv(directory / "pairs.csv", PAIR_FIELDS, pair_rows)
    pilot.atomic_csv(directory / "summary.csv", SUMMARY_FIELDS,
                     summarize(views, list(manifest["model_names"])))
    report = analysis(views, manifest)
    pilot.atomic_json(directory / "analysis.json", report)
    return views, report


def acquire_lock(directory: Path) -> Path:
    path = directory / ".main_running.lock"
    fd = os.open(str(path), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        stream.write(f"PID={os.getpid()}\n")
    return path


def execute_pairs(directory: Path, manifest: dict, args,
                  identities: dict) -> int:
    lock = acquire_lock(directory)
    interrupted = False
    try:
        for identity in identities.values():
            freeze_model_digest(directory, manifest, identity)
        refresh_reports(directory, manifest)
        selected = [
            slot for slot in manifest["pairs"]
            if args.model_label is None or slot["model_label"] == args.model_label
        ]
        run_count = 0
        for slot in selected:
            pair_dir = directory / "episodes" / slot["pair_id"]
            report_path = pair_dir / "pair.json"
            if report_path.exists():
                load_pair(directory, slot, manifest)
                continue
            if pair_dir.exists():
                raise RuntimeError(
                    "Unsealed Main pair folder: do NOT rerun uncertain work; inspect "
                    + str(pair_dir)
                )
            if args.max_pairs is not None and run_count >= args.max_pairs:
                break
            pair_dir.mkdir(parents=True, exist_ok=False)
            run_count += 1
            identity = identities[slot["model_label"]]
            report = {
                "mode": "official_browsergym_main_confirmatory",
                "main_id": directory.name,
                **{key: slot[key] for key in (
                    "pair_id", "pair_index", "task_index", "task_group",
                    "task", "model_label", "family", "stratum",
                )},
                "artifact_dir": str(pair_dir), "status": "invalid_pair",
                "initial_hash_parity": False, "episodes": {},
                "main_manifest_sha256": pilot.hash_file(directory / "manifest.json"),
            }
            episode_args = SimpleNamespace(
                openapps_dir=str(args.openapps_dir),
                model_label=slot["model_label"], task=slot["task"],
                task_group=slot["task_group"], seed=manifest["shared_parameters"]["seed"],
                max_steps=manifest["shared_parameters"]["max_steps"],
                model_timeout=manifest["shared_parameters"]["model_timeout"],
                ollama_url=args.ollama_url, study_phase="main",
                main_id=directory.name, pilot_id=None,
            )
            print(f"MAIN {slot['pair_id']}/128 | {slot['model_label']} | "
                  f"{slot['task_group']}/{slot['task']}", flush=True)
            try:
                matched_dev.run_pair(episode_args, report)
                if report.get("order") != slot["order"]:
                    raise RuntimeError("Main paired order drifted")
                if (report.get("model_identity", {}).get("name") != identity["name"]
                        or report.get("model_identity", {}).get("digest")
                        != identity["digest"]):
                    raise RuntimeError("Main model identity drifted")
            except KeyboardInterrupt:
                report.update(status="invalid_pair",
                              error="KeyboardInterrupt: manual interruption")
                interrupted = True
            except Exception as exc:
                report.update(status="invalid_pair",
                              error=f"{type(exc).__name__}: {str(exc)[:1000]}")
            finally:
                pilot.atomic_json(report_path, report)
                refresh_reports(directory, manifest)
            print(f"Recorded Main pair status={report['status']}: {report_path}",
                  flush=True)
            if interrupted or (
                args.stop_on_invalid and report["status"] != "paired_main_completed"
            ):
                break
    finally:
        if lock.exists():
            lock.unlink()
    views, report = refresh_reports(directory, manifest)
    print(
        "MAIN RECORDED (NOT A READINESS CERTIFICATE): "
        f"valid={report['total_valid_pairs']} "
        f"invalid={report['total_invalid_pairs']} "
        f"not_started={report['total_not_started_pairs']} "
        f"planned=128; CSV={directory / 'results.csv'}",
        flush=True,
    )
    if interrupted:
        return 130
    if report["total_invalid_pairs"]:
        return 3
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true",
                      help="Static plan check, no browser, Ollama, or outputs")
    mode.add_argument("--check-models", action="store_true",
                      help="Four-model synthetic action-contract preflight (no browser)")
    mode.add_argument("--run", action="store_true",
                      help="Gate-checked execution; requires approved readiness file")
    parser.add_argument("--main-id")
    parser.add_argument("--readiness-file", type=Path)
    parser.add_argument("--openapps-dir", type=Path)
    parser.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    parser.add_argument("--model-label")
    parser.add_argument("--max-pairs", type=int)
    parser.add_argument("--stop-on-invalid", action="store_true")
    args = parser.parse_args(argv)
    if args.run:
        if not args.main_id or args.readiness_file is None or args.openapps_dir is None:
            parser.error("--run requires --main-id, --readiness-file, --openapps-dir")
    if not args.run and (args.main_id or args.readiness_file
                         or args.max_pairs is not None or args.stop_on_invalid):
        parser.error("Main ID/readiness/max-pairs/stop-on-invalid only valid with --run")
    if args.model_label and args.model_label not in (
        "qwen3.5-9b", "ministral3-8b", "granite4.1-8b", "xlam2-8b"
    ):
        parser.error("Unknown frozen model label")
    if args.max_pairs is not None and not 1 <= args.max_pairs <= 128:
        parser.error("--max-pairs must be 1..128")
    plan, roster, models = load_plan()
    tasks = validate_plan(plan, roster, models)
    schedule = pair_schedule(plan, tasks)
    if args.openapps_dir is not None:
        openapps = args.openapps_dir.expanduser().resolve()
        if not (openapps / "launch.py").is_file():
            raise RuntimeError("Pinned OpenApps checkout is missing")
        sha = pilot.git_head(openapps)
        if sha != plan["pinned_openapps_commit"]:
            raise RuntimeError("OpenApps checkout differs from official pin")
        pilot.official_task_preflight(openapps, tasks)
        args.openapps_dir = openapps
    else:
        sha = None
    if args.dry_run:
        print("MAIN TASKSET DRY RUN PASS: 32 tasks / 4 models / "
              "2 methods = 128 matched pairs, 256 planned episodes.")
        print("Ordered roster SHA-256: " + plan["task_order_sha256"])
        print("Group counts: 9 original / 18 longer-horizon / 5 OpenBanking")
        print("Official Hydra registration: " + (
            "verified in pinned checkout" if sha else "NOT CHECKED (no --openapps-dir)"
        ))
        print(f"Deterministic schedule: {schedule[0]['pair_id']} to "
              f"{schedule[-1]['pair_id']}")
        print("Execution still BLOCKED absent approved readiness evidence.")
        print("No main output, OpenApps server, or Ollama inference created.")
        return 0

    labels = [args.model_label] if args.model_label else plan["model_labels"]
    if args.check_models:
        from model_compatibility import run_check
        errors = []
        for label in labels:
            try:
                record = run_check(label, args.ollama_url)
                if record["status"] != "action_contract_pass":
                    raise RuntimeError(record["status"])
                print(f"MODEL ACTION-CONTRACT OK {label} "
                      f"digest={record['model_digest'][:16]} "
                      f"synthetic_probe={record['synthetic_probe_menu_demonstrated']}")
            except Exception as exc:
                errors.append(f"{label}: {type(exc).__name__}: {exc}")
        if errors:
            for item in errors:
                print("MAIN MODEL PREFLIGHT FAIL: " + item, file=sys.stderr)
            return 2
        print("Only synthetic actions checked; no live BrowserGym episodes.")
        return 0

    # DO NOT create output/manifest before the pre-declared readiness gate.
    repo_sha = require_clean_repo()
    approval = verify_readiness(args.readiness_file, plan, repo_sha)
    identities = {}
    errors = []
    for label in labels:
        try:
            identities[label] = matched_dev.model_identity(label, args.ollama_url)
        except Exception as exc:
            errors.append(f"{label}: {type(exc).__name__}: {exc}")
    if errors:
        for item in errors:
            print("MAIN MODEL PREFLIGHT FAIL: " + item, file=sys.stderr)
        return 2
    manifest_expected = create_manifest(
        args.main_id, plan, tasks, models, repo_sha, sha, approval,
    )
    directory, manifest = open_main(args.main_id, manifest_expected)
    return execute_pairs(directory, manifest, args, identities)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError, OSError, FileNotFoundError) as exc:
        print(f"MAIN BLOCKED/ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(2)
