"""Isolated live negative/positive controls for the OFFICIAL OpenApps evaluator.

No LLM and no CDEA logic: controls deliberately use the private expected task
value to test the evaluator. Never feed these actions/values into an agent.
"""
from __future__ import annotations

from dataclasses import asdict
import argparse
import json
import os
from pathlib import Path
import sys
from urllib.request import urlopen
from uuid import uuid4

from isolated_openapps import isolated_openapps
from smoke import extract_axtree_text, hash_state

ROOT = Path(__file__).resolve().parents[2]
TASK = "add_call_mom_to_my_todo"
WRONG_TITLE = "Unrelated diagnostic item"


def ax_value(node: dict, field: str) -> str:
    obj = node.get(field, {})
    return str(obj.get("value", "")) if isinstance(obj, dict) else ""


def find_visible_bid(obs: dict, *, role: str, name: str) -> str:
    """Find one live, public AXTree target, never a memorized BrowserGym bid."""
    tree = extract_axtree_text(obs)
    hits = []
    for node in obs["axtree_object"]["nodes"]:
        if not isinstance(node, dict) or node.get("ignored", False):
            continue
        bid = str(node.get("browsergym_id", ""))
        if (bid and f"[{bid}]" in tree
                and ax_value(node, "role").lower() == role.lower()
                and ax_value(node, "name").strip().casefold() == name.casefold()):
            hits.append(bid)
    if len(hits) != 1:
        raise RuntimeError(f"Expected one visible {role} named {name!r}; got {len(hits)}")
    return hits[0]


def require_state(url: str, state: dict) -> None:
    """Guard against OpenApps state.py silently returning [] on HTTP failure."""
    with urlopen(url + "/todo_all", timeout=10) as result:
        if result.status != 200:
            raise RuntimeError(f"Todo state endpoint returned HTTP {result.status}")
        direct_todos = json.load(result)
    if (not isinstance(state, dict) or not isinstance(state.get("todo"), list)
            or not state["todo"] or state["todo"] != direct_todos):
        raise RuntimeError("Unhealthy or inconsistent Todo state probe")
    if not all(isinstance(item, dict) and "id" in item and "title" in item
               and "done" in item for item in direct_todos):
        raise RuntimeError("Todo state shape is invalid")


def require_only_expected_addition(before: dict, after: dict, title: str) -> None:
    """Ensure diagnostic controls changed exactly the intended new Todo."""
    if set(before) != set(after):
        raise RuntimeError("App state keys changed during control")
    if any(before[key] != after[key] for key in before if key != "todo"):
        raise RuntimeError("Unrelated app state changed during control")
    old, new = before["todo"], after["todo"]
    if len(new) != len(old) + 1 or new[:-1] != old:
        raise RuntimeError("Todo state was not exactly one appended item")
    created = new[-1]
    if (created.get("title") != title or bool(created.get("done"))
            or created.get("id") in {item.get("id") for item in old}):
        raise RuntimeError("Appended Todo has unexpected title, done flag, or id")


def make_env_args(root: Path, url: str, task):
    from hydra import compose, initialize_config_dir
    from hydra.utils import instantiate
    from open_apps.tasks.add_tasks_to_browsergym import register_tasks_with_browsergym

    os.chdir(root)
    with initialize_config_dir(config_dir=str(root / "config"), version_base=None):
        cfg = compose(config_name="config", overrides=["headless=True"])
        register_tasks_with_browsergym([task])
        cfg.browsergym_env_args.task_name = task.task_id
        cfg.browsergym_env_args.task_kwargs.base_url = url
        cfg.browsergym_env_args.max_steps = 5
        env_args = instantiate(cfg.browsergym_env_args)
    return env_args


def execute_control(env, title: str, trace: list[dict]) -> tuple[dict, float]:
    """Navigate, fill, and submit with observed IDs using official actions."""
    obs, _ = env.reset(seed=233)
    def perform(kind: str, *, role: str, name: str, value: str | None = None):
        nonlocal obs
        bid = find_visible_bid(obs, role=role, name=name)
        action = f"{kind}({json.dumps(bid)}"
        if value is not None:
            action += f", {json.dumps(value)}"
        action += ")"
        obs, reward, terminated, truncated, _ = env.step(action)
        if obs.get("last_action_error"):
            raise RuntimeError(f"Official BrowserGym action error: {obs['last_action_error']}")
        trace.append({"action": action, "role": role, "name": name, "reward": float(reward)})
        if (terminated or truncated) and len(trace) < 3:
            # This task should not terminate on navigation or entering text.
            raise RuntimeError("BrowserGym ended before Todo submission")
        return float(reward)

    perform("click", role="link", name="OpenTodos")
    perform("fill", role="textbox", name="New Todo", value=title)
    reward = perform("click", role="button", name="Add")
    return obs, reward


def check_one(root: Path, run_dir: Path, label: str, report: dict) -> dict:
    from hydra import compose, initialize_config_dir
    from hydra.utils import instantiate
    from open_apps.state import get_current_state
    from browsergym.core.action.highlevel import HighLevelActionSet

    with isolated_openapps(root, run_dir / "server") as server:
        record = {"server": asdict(server), "label": label, "trace": []}
        report["controls"][label] = record
        before = get_current_state(server.url)
        require_state(server.url, before)
        record["initial_sha256"] = hash_state(before)
        os.chdir(root)
        with initialize_config_dir(config_dir=str(root / "config"), version_base=None):
            cfg = compose(config_name="config", overrides=["headless=True"])
            task = instantiate(cfg.tasks[TASK])
        if task.is_done:
            raise RuntimeError("This exact addition control expects an undone Todo")
        title = task.todo_name if label == "positive" else WRONG_TITLE
        if title == task.todo_name and label != "positive":
            raise RuntimeError("Invalid negative control target")
        env_args = make_env_args(root, server.url, task)
        actions = HighLevelActionSet(subsets=["bid", "nav"], strict=True, multiaction=False)
        experiment_dir = run_dir / "episode"
        experiment_dir.mkdir(parents=True, exist_ok=True)
        env = None
        try:
            env = env_args.make_env(action_mapping=actions.to_python_code, exp_dir=experiment_dir)
            _obs, reward = execute_control(env, title, record["trace"])
            official_initial = env.unwrapped.task.initial_state
            if hash_state(official_initial) != record["initial_sha256"]:
                raise RuntimeError("Evaluator's initial state differs from captured baseline")
            after = get_current_state(server.url)
            require_state(server.url, after)
            record["final_sha256"] = hash_state(after)
            record["official_reward"] = reward
            require_only_expected_addition(before, after, title)
            expected_reward = 1.0 if label == "positive" else 0.0
            if reward != expected_reward:
                raise RuntimeError(
                    f"{label} evaluator misclassified state: {reward} != {expected_reward}"
                )
            if record["initial_sha256"] == record["final_sha256"]:
                raise RuntimeError("Expected control mutation, but state hash did not change")
            record["status"] = "pass"
            return record
        finally:
            if env is not None:
                env.close()


def run(args: argparse.Namespace, report: dict) -> None:
    root = Path(args.openapps_dir).expanduser().resolve()
    # First negative: an actual wrong Todo via UI must not score as success.
    # Next positive: the exact target via UI must score 1. Both servers are
    # independent, so matching initial hashes also checks reset parity.
    base = Path(report["artifact_dir"])
    neg = check_one(root, base / "negative", "negative", report)
    pos = check_one(root, base / "positive", "positive", report)
    report["initial_hash_parity"] = (
        neg["initial_sha256"] == pos["initial_sha256"]
    )
    if not report["initial_hash_parity"]:
        raise RuntimeError("Isolated initial state hashes differ across controls")
    if neg["server"]["database_dir"] == pos["server"]["database_dir"]:
        raise RuntimeError("Control episodes unexpectedly shared a database directory")
    report["status"] = "controls_pass"


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--openapps-dir", required=True)
    args = p.parse_args()
    folder = ROOT / "output/browsergym/controls" / uuid4().hex
    folder.mkdir(parents=True, exist_ok=False)
    artifact = folder / "report.json"
    report = {"status": "controls_failed", "task": TASK, "mode": "evaluator_controls_only",
              "artifact_dir": str(folder), "initial_hash_parity": None, "controls": {}}
    try:
        run(args, report)
    except Exception as error:
        report["error"] = type(error).__name__ + ": " + str(error)
        print("FAIL: evaluator or isolation gate: " + report["error"], file=sys.stderr)
        code = 2
    else:
        print("PASS: isolated negative=0, positive=1, exact Todo deltas, initial hash parity")
        code = 0
    finally:
        artifact.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("Evaluator controls artifact: " + str(artifact))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
