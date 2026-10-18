"""Trusted OpenApps scoring boundary; not imported or read by the browser agent.

Uses OpenApps' actual Task.check_if_task_is_complete() with live app state.
Only the PUBLIC goal is provided by 'goal'. Expected values stay in this
evaluator process and are never sent to the LLM.
"""
import argparse
import contextlib
import io
import json
import sys
from pathlib import Path

from hydra.utils import instantiate
from omegaconf import OmegaConf
from open_apps.state import get_current_state

PILOT_AND_MAIN_DISABLED = {
    "add_todo_to_review_largest_card_charge",
    "reconcile_the_largest_account",
    "report_the_card_statement_balance_and_headroom",
}


def task_config(key: str):
    if key not in PILOT_AND_MAIN_DISABLED:
        raise ValueError("Only registered OpenBanking development PoC tasks are allowed")
    config_path = Path.cwd() / "config" / "tasks" / "openbanking.yaml"
    if not config_path.is_file():
        raise FileNotFoundError(f"OpenApps task config missing: {config_path}")
    return OmegaConf.load(config_path)[key]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["goal", "initial", "evaluate"])
    parser.add_argument("--task")
    parser.add_argument("--url", default="http://localhost:5001")
    parser.add_argument("--initial-file")
    parser.add_argument("--page-url")
    args = parser.parse_args()

    if args.command == "goal":
        cfg = task_config(args.task)
        print(json.dumps({"key": args.task, "goal": str(cfg.goal)}, ensure_ascii=False))
        return

    # The official app-state reader is intentionally isolated from agent code.
    state = get_current_state(args.url)
    if args.command == "initial":
        print(json.dumps(state, ensure_ascii=False, sort_keys=True))
        return

    if not args.task or not args.initial_file or not args.page_url:
        parser.error("evaluate needs --task, --initial-file, and --page-url")
    cfg = task_config(args.task)
    task = instantiate(cfg)
    initial = json.loads(Path(args.initial_file).read_text(encoding="utf-8"))
    current = state
    current["_url"] = args.page_url.rstrip("/")

    with contextlib.redirect_stdout(io.StringIO()):
        success = bool(task.check_if_task_is_complete(initial, current))
    print(json.dumps({
        "evaluator": "OpenApps Task.check_if_task_is_complete",
        "task_key": args.task,
        "reward": 1.0 if success else 0.0,
        "success": success,
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"OpenApps evaluator bridge error: {error}", file=sys.stderr)
        raise
