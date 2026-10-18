"""One Qwen BrowserGym/OpenApps task, development only; not a research run."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.request import urlopen
from uuid import uuid4
from ollama_preflight import MODELS_FILE, get_model, find_installed_model, request_json, validate_ollama_url
from smoke import UPSTREAM_PIN, validate_url, extract_axtree_text, hash_state

ROOT = Path(__file__).resolve().parents[2]
BID_PATTERN = re.compile(r"\[([A-Za-z0-9_.:-]+)\]")
TASK = "add_call_mom_to_my_todo"


def permitted_bids(obs: dict, rendered_tree: str) -> set[str]:
    nodes = obs.get("axtree_object", {}).get("nodes", [])
    node_ids = {str(node["browsergym_id"]) for node in nodes if isinstance(node, dict)
                and node.get("browsergym_id") is not None
                and not node.get("ignored", False)}
    return node_ids & set(BID_PATTERN.findall(rendered_tree))


def parse_action(payload: dict, bids: set[str]) -> str:
    message = payload.get("message")
    raw = message.get("content") if isinstance(message, dict) else None
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError("No visible model answer")
    obj = json.loads(raw)
    if not isinstance(obj, dict):
        raise ValueError("Model answer must be a JSON object")
    action = obj.get("action")
    if action == "finish":
        return "finish"
    if action == "back":
        return "go_back()"
    if action not in ("click", "fill", "press"):
        raise ValueError("Unrecognized model action")
    bid = obj.get("bid")
    if not isinstance(bid, str) or bid not in bids:
        raise ValueError("Model selected an unobserved element")
    if action == "click":
        return "click(" + json.dumps(bid) + ")"
    if action == "fill":
        value = obj.get("text")
        if not isinstance(value, str) or not 0 < len(value) <= 300:
            raise ValueError("Invalid text to fill")
        return "fill(" + json.dumps(bid) + ", " + json.dumps(value) + ")"
    key = obj.get("key")
    if key not in ("Enter", "Tab", "Escape", "ArrowUp", "ArrowDown"):
        raise ValueError("Invalid key for press")
    return "press(" + json.dumps(bid) + ", " + json.dumps(key) + ")"


def describe_bid(observation: dict, bid: str) -> dict:
    """Describe a selected element from the public AXTree only."""
    nodes = observation.get("axtree_object", {}).get("nodes", [])
    for node in nodes:
        if not isinstance(node, dict) or str(node.get("browsergym_id", "")) != bid:
            continue
        def ax_field(key):
            entry = node.get(key, {})
            return str(entry.get("value", ""))[:160] if isinstance(entry, dict) else ""
        return {"bid": bid, "role": ax_field("role"),
                "name": ax_field("name"), "value": ax_field("value")}
    return {"bid": bid, "role": "", "name": "", "value": ""}


def guarded_action(action: str, observation: dict, actions: list[str],
                   current_url: str) -> str | None:
    """Prevent repeated clicks and empty todo forms in this dev-only runner."""
    if action.startswith("click("):
        if len(actions) >= 2 and actions[-1] == action and actions[-2] == action:
            return "repeated_click_limit: third consecutive identical click"
        bid = json.loads(action[len("click("):-1])
        target = describe_bid(observation, bid)
        if (current_url.rstrip("/").endswith("/todo")
                and target["role"].lower() == "button"
                and target["name"].strip().lower() == "add"):
            nodes = observation.get("axtree_object", {}).get("nodes", [])
            typed = any(
                isinstance(node, dict) and not node.get("ignored", False)
                and str(node.get("role", {}).get("value", "")).lower() == "textbox"
                and str(node.get("value", {}).get("value", "")).strip()
                for node in nodes
            )
            if not typed:
                return "empty_todo_submission: Add clicked without typed textbox value"
    return None


def summarize_todo_delta(previous: dict, current: dict) -> dict:
    """Developer-only server-state differences: never fed to the model."""
    old = previous.get("todo")
    new = current.get("todo")
    if not isinstance(old, list) or not isinstance(new, list):
        return {"unavailable": True}
    def records(items):
        return {str(item["id"]): {"title": str(item.get("title", ""))[:160],
                                  "done": bool(item.get("done"))}
                for item in items if isinstance(item, dict) and "id" in item}
    before, after = records(old), records(new)
    return {
        "added": [{"id": key, **after[key]} for key in sorted(after.keys() - before.keys())],
        "removed": [{"id": key, **before[key]} for key in sorted(before.keys() - after.keys())],
        "changed": [{"id": key, "before": before[key], "after": after[key]}
                    for key in sorted(before.keys() & after.keys()) if before[key] != after[key]],
    }


def should_stop_for_unexpected_todo(delta: dict) -> bool:
    return any(not item.get("title", "").strip() for item in delta.get("added", []))



def messages(goal: str, url: str, tree: str, bids: set[str], history: list[str]) -> list[dict]:
    system = (
        "You are a computer-use agent. Complete the user's task using only visible "
        "browser controls. Respond with ONE JSON action, nothing else. Examples: "
        '{"action":"click","bid":"a1"}, '
        '{"action":"fill","bid":"a2","text":"Call Mom"}, '
        '{"action":"press","bid":"a2","key":"Enter"}, '
        '{"action":"back"}, {"action":"finish"}. '
        "Use only observed element ids. You can navigate by clicking visible links. "
        "Use finish only after the actual requested change was made. "
        "Do not invent controls or claim success without a UI action."
    )
    user = (
        "Goal: " + goal + "\nCurrent URL: " + url
        + "\nAllowed element IDs: " + ", ".join(sorted(bids))[:1600]
        + "\nPrevious actions: " + json.dumps(history[-6:])
        + "\nBrowser accessibility tree:\n" + tree[:16000]
    )
    return [{"role":"system","content":system},{"role":"user","content":user}]


def run(args, out):
    if not args.fresh_state_confirmed:
        raise RuntimeError("Start a NEW OpenApps server and confirm fresh state first")
    origin = validate_url(args.url)
    root = Path(args.openapps_dir).expanduser().resolve()
    if not (root / "launch.py").is_file():
        raise RuntimeError("OpenApps checkout not found")
    actual = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"],
                            check=True, capture_output=True, text=True).stdout.strip()
    if actual != UPSTREAM_PIN:
        raise RuntimeError("OpenApps commit does not match upstream pin")
    with urlopen(origin, timeout=7) as response:
        if response.status != 200:
            raise RuntimeError("OpenApps server unavailable")
    ollama_origin = validate_ollama_url(args.ollama_url)
    model = get_model(json.loads(MODELS_FILE.read_text(encoding="utf-8")), "qwen3.5-9b")
    installed = find_installed_model(request_json(ollama_origin + "/api/tags", timeout=15), model)
    if not installed.get("digest"):
        raise RuntimeError("Missing installed Ollama digest")
    out.update(model=model, digest=installed["digest"], upstream_sha=actual)
    from hydra import compose, initialize_config_dir
    from hydra.utils import instantiate
    from open_apps.tasks.add_tasks_to_browsergym import register_tasks_with_browsergym
    from open_apps.state import get_current_state
    from browsergym.core.action.highlevel import HighLevelActionSet
    os.chdir(root)
    with initialize_config_dir(config_dir=str(root / "config"), version_base=None):
        cfg = compose(config_name="config", overrides=["headless=True"])
        task = instantiate(cfg.tasks[TASK])
        register_tasks_with_browsergym([task])
        cfg.browsergym_env_args.task_name = task.task_id
        cfg.browsergym_env_args.task_kwargs.base_url = origin
        cfg.browsergym_env_args.max_steps = args.max_steps
        env_args = instantiate(cfg.browsergym_env_args)
    out["initial_sha256"] = hash_state(get_current_state(origin))
    actions = HighLevelActionSet(subsets=["bid", "nav"], strict=True, multiaction=False)
    exp_dir = Path(out["experiment_dir"])
    exp_dir.mkdir(parents=True, exist_ok=True)
    env = None
    reward = None
    try:
        env = env_args.make_env(action_mapping=actions.to_python_code, exp_dir=exp_dir)
        obs, _ = env.reset(seed=233)
        goal = obs.get("goal")
        if not isinstance(goal, str) or not goal:
            raise RuntimeError("No public BrowserGym goal")
        history = []
        previous_state = get_current_state(origin)  # developer diagnostics only
        for step in range(args.max_steps):
            tree = extract_axtree_text(obs)
            bids = permitted_bids(obs, tree)
            if not bids:
                raise RuntimeError("No observed BrowserGym bids")
            start = time.monotonic()
            reply = request_json(ollama_origin + "/api/chat", data={
                "model":model, "stream":False, "think":False, "format":"json",
                "messages":messages(goal, obs.get("url", ""), tree, bids, history),
                "options":{"temperature":0,"num_predict":384}
            }, timeout=240)
            elapsed = round(time.monotonic() - start, 3)
            try:
                action = parse_action(reply, bids)
            except (ValueError, TypeError) as exc:
                out["status"] = "model_output_invalid"
                out["trace"].append({"step":step+1,"model_error":str(exc)})
                break
            entry = {"step":step+1,"action":action,"model_seconds":elapsed}
            if action.startswith(("click(", "fill(", "press(")):
                chosen_bid = json.loads(action[action.index("(")+1:].split(",", 1)[0].rstrip(")"))
                entry["target"] = describe_bid(obs, chosen_bid)
            out["trace"].append(entry)
            if action == "finish":
                out["finish_claimed"] = True
                if reward is None:
                    reward = float(env.unwrapped.task.reward())
                if reward < 1:
                    out["status"] = "premature_finish"
                break
            blocked = guarded_action(action, obs, history, str(obs.get("url", "")))
            if blocked:
                entry["guard_blocked"] = blocked
                out["status"] = "safety_guard_blocked"
                break
            history.append(action)
            obs, reward, terminated, truncated, _ = env.step(action)
            reward = float(reward)
            out["steps"] += 1
            entry["official_reward"] = reward
            current_state = get_current_state(origin)
            delta = summarize_todo_delta(previous_state, current_state)
            entry["todo_delta"] = delta
            previous_state = current_state
            if obs.get("last_action_error"):
                entry["browser_error"] = str(obs["last_action_error"])[:400]
                out["status"] = "browser_action_error"
                break
            if should_stop_for_unexpected_todo(delta):
                out["status"] = "unexpected_empty_todo"
                break
            if reward >= 1 or terminated or truncated:
                break
        out["official_reward"] = reward
        out["official_success"] = reward is not None and reward >= 1
        out["run_complete"] = True
        if out["status"] == "invalid_episode":
            out["status"] = "development_completed"
    finally:
        if env is not None:
            env.close()
        out["final_sha256"] = hash_state(get_current_state(origin))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--openapps-dir", required=True)
    p.add_argument("--url", default="http://127.0.0.1:5001")
    p.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    p.add_argument("--max-steps", type=int, default=10)
    p.add_argument("--fresh-state-confirmed", action="store_true")
    args = p.parse_args()
    if not 1 <= args.max_steps <= 20:
        p.error("max-steps must be 1-20")
    folder = ROOT / "output/browsergym/dev"
    folder.mkdir(parents=True, exist_ok=True)
    ident = uuid4().hex
    path = folder / (ident + ".json")
    out = {"mode":"unpaired_dev_only","task":TASK,"status":"invalid_episode",
           "run_complete":False,"official_success":None,"official_reward":None,
           "steps":0,"trace":[],"experiment_dir":str(folder / ("episode-"+ident))}
    try:
        run(args, out)
    except Exception as exc:
        out["runner_error"] = type(exc).__name__ + ": " + str(exc)
        print("INVALID EPISODE: " + out["runner_error"], file=sys.stderr)
        code = 2
    else:
        print("DEVELOPMENT RUN COMPLETED")
        print("Official success: " + str(out["official_success"]).lower())
        print("Steps: " + str(out["steps"]))
        print("Not a Baseline/CDEA experiment.")
        print("Action trace:")
        for item in out["trace"]:
            action = item.get("action", "(no valid action)")
            rating = item.get("official_reward", "-")
            error = item.get("browser_error") or item.get("model_error")
            guard = item.get("guard_blocked")
            changes = item.get("todo_delta")
            target = item.get("target", {})
            if target:
                print("    element: " + str(target))
            if changes and (changes.get("added") or changes.get("removed") or changes.get("changed")):
                print("    todo delta: " + json.dumps(changes, ensure_ascii=False))
            if guard:
                print("    BLOCKED: " + guard)
            print("  step {0}: {1} | reward={2}{3}".format(
                item["step"], action, rating,
                (" | ERROR=" + str(error)) if error else ""
            ))
        code = 0
    finally:
        path.write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
        print("Development artifact: " + str(path))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
