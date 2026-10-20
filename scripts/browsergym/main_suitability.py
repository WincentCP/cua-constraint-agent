"""Non-study source, initial-evaluator and route audit for the frozen 32 Main tasks.

This deliberately does not run any model, BrowserGym episode, successful task
action, positive-reward oracle, or Main treatment comparison. Outputs are
preflight evidence only, never trial results.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from urllib.request import urlopen
from uuid import uuid4

import main as experiment
import matched_dev
import pilot
from evaluator_controls import require_state
from isolated_openapps import isolated_openapps
from smoke import hash_state

ROOT = Path(__file__).resolve().parents[2]
PREFLIGHT_ROOT = ROOT / "output" / "preflight" / "main_suitability"
READ_ONLY_ROUTES = (
    "/", "/todo", "/calendar", "/messages", "/maps",
    "/codeeditor/", "/openbanking",
)


def probe_app_routes(base_url: str) -> list[dict]:
    results = []
    for route in READ_ONLY_ROUTES:
        with urlopen(base_url + route, timeout=15) as response:
            status = response.status
            body = response.read(300)
        if status != 200 or not body.strip():
            raise RuntimeError(f"Route {route!r}: status={status}, no HTML content")
        results.append({
            "route": route, "status": status, "body_nonempty": True,
        })
    return results


def audit_live_initial_state(openapps: Path, tasks: list[dict],
                             directory: Path) -> dict:
    """Test all 32 official evaluators against one unchanged *initial* app state.

    This is a negative no-op check only; a false initial reward never proves
    that an agent can complete the task or that CDEA has eligible probes.
    """
    destination = directory / "isolated_server"
    report = {
        "mode": "main_preflight_official_negative_evaluator_only",
        "study_phase": "preflight_not_main",
        "no_agent_browsergym_episodes": True,
        "task_count": len(tasks), "task_checks": [], "routes": [],
        "official_positive_reward_not_tested": True,
        "model_probe_menu_not_tested": True,
        "passed": False,
    }
    with isolated_openapps(openapps, destination) as server:
        from open_apps.state import get_current_state
        state = get_current_state(server.url)
        require_state(server.url, state)
        initial = hash_state(state)
        report["initial_state_sha256"] = initial
        report["routes"] = probe_app_routes(server.url)
        for item in tasks:
            # build_env_args instantiates the official task and registers it
            # with BrowserGym; it does NOT create an environment or step it.
            _, task = matched_dev.build_env_args(
                openapps, server.url, item["task"], 40, item["task_group"],
            )
            # Independent official scoring against the unchanged initial state.
            # Navigation tasks check _url; the initial state has no target URL.
            initially_complete = task.check_if_task_is_complete(state, state)
            if initially_complete is not False:
                raise RuntimeError(
                    "Official task unexpectedly already complete in fresh "
                    f"state: {item['task_group']}/{item['task']}"
                )
            report["task_checks"].append({
                "task_index": item["main_index"], "task_group": item["task_group"],
                "task": item["task"], "stratum": item["stratum"],
                "registered_with_official_browsergym": True,
                "initial_official_evaluator_complete": False,
            })
        after = get_current_state(server.url)
        require_state(server.url, after)
        report["final_state_sha256"] = hash_state(after)
        if report["final_state_sha256"] != initial:
            raise RuntimeError("Preflight modified initial state; reject audit")
    report["passed"] = len(report["task_checks"]) == 32
    return report


def run_audit(openapps: Path) -> tuple[Path, dict]:
    plan, roster, models = experiment.load_plan()
    tasks = experiment.validate_plan(plan, roster, models)
    openapps = openapps.expanduser().resolve()
    if not (openapps / "launch.py").is_file():
        raise RuntimeError("OpenApps pinned checkout missing launch.py")
    sha = pilot.git_head(openapps)
    if sha != matched_dev.UPSTREAM_PIN:
        raise RuntimeError("OpenApps checkout Git SHA does not match frozen pin")
    pilot.official_task_preflight(openapps, tasks)
    output = PREFLIGHT_ROOT / uuid4().hex
    output.mkdir(parents=True, exist_ok=False)
    report = {
        "mode": "non_study_main_task_suitability_preflight",
        "recorded_utc": datetime.now(timezone.utc).isoformat(),
        "status": "incomplete",
        "controller_git_commit": pilot.git_head(ROOT),
        "openapps_git_commit": sha,
        "task_order_sha256": plan["task_order_sha256"],
        "main_plan_sha256": pilot.hash_file(experiment.MAIN_PLAN),
        "taskset_sha256": pilot.hash_file(experiment.TASKSET),
        "no_main_data_collected": True,
    }
    try:
        report.update(audit_live_initial_state(openapps, tasks, output))
        if not report["passed"]:
            raise RuntimeError("Fewer than 32 official tasks passed initial-state checks")
        report["status"] = "pass_limited_task_suitability_preflight"
    except Exception as exc:
        report["status"] = "failed_suitability_preflight"
        report["error"] = type(exc).__name__ + ": " + str(exc)[:1000]
        raise
    finally:
        pilot.atomic_json(output / "audit.json", report)
    return output, report


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--openapps-dir", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        directory, report = run_audit(args.openapps_dir)
    except Exception as exc:
        print(f"MAIN SUITABILITY PREFLIGHT FAILED: {type(exc).__name__}: {exc}",
              file=sys.stderr)
        print("No Main episode was started. Inspect output/preflight/main_suitability.",
              file=sys.stderr)
        return 2
    print(
        f"PRE-MAIN TASK AUDIT PASS (limited): "
        f"{report['task_count']} official registered tasks, "
        f"{len(report['routes'])} HTTP routes, "
        "all official initial evaluations FALSE, no app-state mutation."
    )
    print(f"Preflight evidence: {directory / 'audit.json'}")
    print(
        "NOTE: this is NOT task solvability, positive reward, screenshot UI "
        "accessibility, four-model compatibility, or CDEA mechanism proof."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
