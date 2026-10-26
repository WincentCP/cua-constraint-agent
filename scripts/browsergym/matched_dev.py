"""Matched Baseline / CDEA DEVELOPMENT episodes on official BrowserGym + OpenApps.

NOT a pilot or main experiment. One selected installed Ollama model, one public
OpenApps task, two independent app DBs, identical model/AXTree/action budgets.
The treatment is only candidate-probe ranking in shared_policy.py.
"""
from __future__ import annotations

import argparse
from dataclasses import asdict
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.request import urlopen
from uuid import uuid4

from action_timeout import DEV_CLICK_TIMEOUT_MS, configure_bounded_click_timeout
from evaluator_controls import require_state
from public_ui import (active_dialog_context, clickable_generic_hints,
                       dialog_background_action_guard, redundant_current_app_link)
from isolated_openapps import isolated_openapps
from ollama_preflight import (MODELS_FILE, find_installed_model, get_model,
                              request_json, validate_ollama_url)
from qwen_dev import (describe_bid, guarded_action, should_stop_for_unexpected_todo,
                      summarize_todo_delta)
from shared_policy import (METHODS, choose_action, initial_ledger, public_constraints,
                           public_messages, rejected_action_diagnostic, repair_message)
from smoke import extract_axtree_text, hash_state, UPSTREAM_PIN

ROOT = Path(__file__).resolve().parents[2]
SEED = 233
TEMPERATURE = 0
NUM_PREDICT = 640
ACTION_SUBSETS = ("bid", "nav")
TASK_KEY = re.compile(r"^[a-z][a-z0-9_]*$")
TASK_GROUPS = ("all_tasks", "openbanking", "longer_horizon")


def pair_order(task: str, model_label: str, seed: int) -> list[str]:
    """Stable counterbalancing; never choose order after observing outcomes."""
    digest = sha256(f"{task}|{model_label}|{seed}".encode("utf-8")).digest()
    return list(METHODS if digest[0] % 2 == 0 else reversed(METHODS))


def model_identity(label: str, ollama_url: str, client=request_json, *,
                   models_file: Path = MODELS_FILE) -> dict:
    configured = json.loads(Path(models_file).read_text(encoding="utf-8"))
    name = get_model(configured, label)
    origin = validate_ollama_url(ollama_url)
    installed = find_installed_model(client(origin + "/api/tags", timeout=15), name)
    digest = installed.get("digest")
    if not isinstance(digest, str) or not digest:
        raise RuntimeError("Model digest is unavailable; refuse matched run")
    return {"label": label, "name": name, "digest": digest, "ollama_url": origin}


def verify_model_identity(identity: dict, client=request_json) -> None:
    """Fail closed if the installed model changed between paired arms."""
    installed = find_installed_model(
        client(identity["ollama_url"] + "/api/tags", timeout=15),
        identity["name"],
    )
    observed_digest = installed.get("digest")
    if observed_digest != identity["digest"]:
        raise RuntimeError(
            "Ollama model digest changed during matched development; "
            "pair cannot be interpreted as a same-checkpoint comparison"
        )


def build_env_args(root: Path, url: str, task_key: str, max_steps: int,
                   task_group: str = "all_tasks"):
    from hydra import compose, initialize_config_dir
    from hydra.utils import instantiate
    from open_apps.tasks.add_tasks_to_browsergym import register_tasks_with_browsergym

    if task_group not in TASK_GROUPS:
        raise ValueError(f"Unsupported official OpenApps task group: {task_group}")
    os.chdir(root)
    with initialize_config_dir(config_dir=str(root / "config"), version_base=None):
        cfg = compose(config_name="config", overrides=["headless=True",
                                                       f"tasks={task_group}"])
        if task_key not in cfg.tasks:
            raise ValueError(
                f"Official OpenApps task {task_key!r} is not in tasks={task_group}. "
                "Use --task-group openbanking for the standalone OpenBanking tasks."
            )
        task = instantiate(cfg.tasks[task_key])
        register_tasks_with_browsergym([task])
        cfg.browsergym_env_args.task_name = task.task_id
        cfg.browsergym_env_args.task_kwargs.base_url = url
        cfg.browsergym_env_args.max_steps = max_steps
        return instantiate(cfg.browsergym_env_args), task


def record_error(record: dict, error: Exception) -> None:
    record["status"] = "invalid_episode"
    record["valid"] = False
    record["official_success"] = None
    record["error"] = type(error).__name__ + ": " + str(error)


def run_episode(root: Path, server, method: str, identity: dict,
                args, destination: Path, expected_initial: str | None) -> dict:
    from browsergym.core.action.highlevel import HighLevelActionSet
    from open_apps.state import get_current_state

    phase = getattr(args, "study_phase", "development")
    if phase not in ("development", "pilot", "main", "scale"):
        raise ValueError("Unknown study phase")
    destination.mkdir(parents=True, exist_ok=False)
    path = destination / "episode.json"
    record = {
        "mode": ("paired_pilot_exploratory" if phase == "pilot"
                 else "paired_main_confirmatory" if phase == "main"
                 else "paired_scale_exploratory" if phase == "scale"
                 else "paired_development_only"),
        "study_phase": phase,
        "pilot_id": getattr(args, "pilot_id", None) if phase == "pilot" else None,
        "main_id": getattr(args, "main_id", None) if phase == "main" else None,
        "task": args.task,
        "task_group": args.task_group, "method": method,
        "model": identity["name"], "model_digest": identity["digest"],
        "server": asdict(server), "upstream_commit": UPSTREAM_PIN,
        "started_at_utc": datetime.now(timezone.utc).isoformat(),
        "seed": args.seed, "max_steps": args.max_steps, "num_predict": NUM_PREDICT,
        "temperature": TEMPERATURE, "think": False, "action_subsets": list(ACTION_SUBSETS),
        "browsergym_core_version": None,
        "bid_click_timeout_ms": DEV_CLICK_TIMEOUT_MS,
        "click_force_retry": False,
        "status": "invalid_episode", "valid": False, "run_complete": False,
        "official_reward": None, "official_success": None,
        "steps": 0, "model_calls": 0, "model_seconds": 0,
        "model_input_characters": 0, "max_prompt_eval_tokens": None,
        "invalid_model_actions": 0, "repair_requests": 0, "repaired_steps": 0,
        "max_action_validation_retries_per_step": 1,
        "validation_includes_shared_safety_guards": True,
        "trace": [], "probe_opportunities": 0, "policy_overrides": 0,
    }
    if phase in ("main", "scale"):
        record["num_ctx"] = args.num_ctx
    if phase == "scale":
        record["scale_id"] = args.scale_id
    started = time.monotonic()
    env = None
    try:
        before = get_current_state(server.url)
        require_state(server.url, before)
        start_hash = hash_state(before)
        record["initial_sha256"] = start_hash
        if expected_initial is not None and start_hash != expected_initial:
            raise RuntimeError("PAIR RESET PARITY FAILURE: initial application states differ")
        env_args, _task = build_env_args(root, server.url, args.task,
                                         args.max_steps, args.task_group)
        actions = HighLevelActionSet(
            subsets=list(ACTION_SUBSETS), strict=True, multiaction=False,
            retry_with_force=False,
        )
        record["browsergym_core_version"] = configure_bounded_click_timeout(actions)
        experiment_dir = destination / "browsergym"
        experiment_dir.mkdir(parents=True, exist_ok=True)
        env = env_args.make_env(
            action_mapping=actions.to_python_code, exp_dir=experiment_dir,
        )
        obs, _ = env.reset(seed=args.seed)
        if hash_state(env.unwrapped.task.initial_state) != start_hash:
            raise RuntimeError("Official evaluator initial state differs from state fingerprint")
        goal = obs.get("goal")
        if not isinstance(goal, str) or not goal.strip():
            raise RuntimeError("No public BrowserGym task goal")
        constraints = public_constraints(goal)
        ledger = initial_ledger(constraints)
        record["public_goal"] = goal
        record["public_constraints"] = constraints
        record["model_prompt_policy"] = "shared_identical_for_both_methods"
        history = []
        observations_dir = destination / "observations"
        observations_dir.mkdir(parents=True, exist_ok=True)
        previous_state = get_current_state(server.url)
        reward = None
        end_reason = "action_budget_exhausted"

        for step in range(args.max_steps):
            tree = extract_axtree_text(obs)
            tree_path = observations_dir / f"step_{step + 1:03d}_before.axtree.txt"
            # Write exact bytes to preserve the recorded SHA-256 on Windows.
            tree_path.write_bytes(tree.encode("utf-8"))
            from qwen_dev import permitted_bids
            bids = permitted_bids(obs, tree)
            if not bids:
                raise RuntimeError("No visible BrowserGym element IDs")
            clickable_hints = clickable_generic_hints(obs, bids)
            dialog = active_dialog_context(obs, bids)
            messages = public_messages(goal, str(obs.get("url", "")), tree,
                                       bids, history, constraints, ledger,
                                       clickable_hints=clickable_hints,
                                       active_dialog=dialog)
            request = {
                "model": identity["name"], "stream": False,
                "think": False, "format": "json",
                "options": {"temperature": TEMPERATURE, "num_predict": NUM_PREDICT},
            }
            if phase in ("main", "scale"):
                request["options"]["num_ctx"] = args.num_ctx
            invalid_attempts = []
            model_telemetry = []
            attempted_error = None
            action = None
            decision = None
            model_seconds_for_step = 0.0
            # At most ONE shared repair for a rejected model action or public
            # safety-guard violation, without executing the rejected action.
            # Neither method gets evaluator information, a hidden target, an
            # extra browser step or a fabricated fallback bid.
            for attempt in range(2):
                request["messages"] = (
                    messages if attempt == 0
                    else messages + [repair_message(attempted_error, bids)]
                )
                request_characters = sum(
                    len(message["content"]) for message in request["messages"]
                )
                record["model_input_characters"] += request_characters
                started_model = time.monotonic()
                reply = request_json(
                    identity["ollama_url"] + "/api/chat",
                    data=request, timeout=args.model_timeout,
                )
                elapsed = round(time.monotonic() - started_model, 3)
                model_seconds_for_step = round(model_seconds_for_step + elapsed, 3)
                record["model_calls"] += 1
                counts = reply.get("prompt_eval_count")
                if isinstance(counts, int) and not isinstance(counts, bool):
                    previous_max = record["max_prompt_eval_tokens"] or 0
                    record["max_prompt_eval_tokens"] = max(previous_max, counts)
                model_telemetry.append({
                    "attempt": attempt + 1,
                    "prompt_characters": request_characters,
                    "prompt_eval_count": counts if isinstance(counts, int) else None,
                    "output_eval_count": reply.get("eval_count"),
                    "done_reason": str(reply.get("done_reason") or "")[:60],
                })
                record["model_seconds"] = round(
                    record["model_seconds"] + elapsed, 3
                )
                # Failed model output cannot partially change the tentative
                # evidence ledger before we ask the model to correct it.
                trial_ledger = {key: dict(value) for key, value in ledger.items()}
                try:
                    trial_action, trial_decision = choose_action(
                        reply, method, obs, tree, constraints,
                        trial_ledger, step + 1,
                    )
                    # The OpenApps chrome has a persistent app dock even
                    # *inside* the selected app. Clicking its own icon again
                    # reloads the root instead of opening an account row.
                    # Reject identical current-app root link actions before
                    # BrowserGym execution for BOTH methods.
                    loop_error = redundant_current_app_link(trial_action, obs)
                    if loop_error:
                        raise ValueError(loop_error)
                    dialog_error = dialog_background_action_guard(trial_action, dialog)
                    if dialog_error:
                        raise ValueError("safety_guard_blocked: " + dialog_error)
                    # Like a nonexistent BID, a guard-rejected action must
                    # NEVER survive as the selected executable action. Give
                    # the model the same ONE shared correction opportunity
                    # using this unchanged public observation.
                    guard_error = guarded_action(
                        trial_action, obs, history, str(obs.get("url", "")),
                    )
                    if guard_error:
                        raise ValueError("safety_guard_blocked: " + guard_error)
                except (ValueError, TypeError, KeyError) as exc:
                    attempted_error = exc
                    diagnostic = rejected_action_diagnostic(reply, bids)
                    invalid_attempts.append({
                        "attempt": attempt + 1,
                        "error": type(exc).__name__ + ": " + str(exc)[:400],
                        **diagnostic,
                    })
                    record["invalid_model_actions"] += 1
                    if attempt == 0:
                        record["repair_requests"] += 1
                    continue
                # Commit only an accepted, parser- and guard-validated action.
                # The tentative ledger is discarded for rejected candidates.
                action, decision = trial_action, trial_decision
                ledger.update(trial_ledger)
                if attempt > 0:
                    record["repaired_steps"] += 1
                break

            if action is None:
                last = invalid_attempts[-1]
                guard_prefix = "ValueError: safety_guard_blocked: "
                end_reason = (
                    "safety_guard_blocked"
                    if last["error"].startswith(guard_prefix)
                    else "agent_output_invalid"
                )
                rejected = {
                    "step": step + 1,
                    "model_seconds": model_seconds_for_step,
                    "agent_error": last["error"],
                    "invalid_attempts": invalid_attempts,
                    "model_telemetry": model_telemetry,
                    "active_dialog": dialog,
                    "url_before": str(obs.get("url", "")),
                    "axtree_characters": len(tree),
                    "axtree_truncated_for_model": len(tree) > 16000,
                    "observation_sha256": sha256(tree.encode()).hexdigest(),
                    "observation_artifact": tree_path.relative_to(destination).as_posix(),
                }
                if end_reason == "safety_guard_blocked":
                    rejected["guard_blocked"] = last["error"][len(guard_prefix):]
                record["trace"].append(rejected)
                break
            record["probe_opportunities"] += int(decision["probe_opportunity"])
            record["policy_overrides"] += int(decision["policy_overrode_primary"])
            entry = {
                "step": step + 1, "observation_sha256": sha256(tree.encode()).hexdigest(),
                "observation_artifact": tree_path.relative_to(destination).as_posix(),
                "action": action, "model_seconds": model_seconds_for_step,
                "url_before": str(obs.get("url", "")),
                "axtree_characters": len(tree),
                "axtree_truncated_for_model": len(tree) > 16000,
                "model_telemetry": model_telemetry,
                "public_clickable_hints": clickable_hints,
                "active_dialog": dialog,
                "invalid_attempts": invalid_attempts,
                "repair_used": bool(invalid_attempts), **decision,
            }
            if action.startswith(("click(", "fill(", "press(")):
                bid = json.loads(
                    action[action.index("(") + 1:].split(",", 1)[0].rstrip(")")
                )
                entry["target"] = describe_bid(obs, bid)
            record["trace"].append(entry)
            if action == "finish":
                end_reason = "model_finish"
                break
            # This action was already checked against shared safety guards
            # before accepting it from the bounded validation/repair loop.
            history.append(action)
            t0 = time.monotonic()
            obs, reward, terminated, truncated, step_info = env.step(action)
            record["steps"] += 1
            entry["url_after"] = str(obs.get("url", ""))
            entry["url_changed"] = entry["url_after"] != entry["url_before"]
            next_tree = extract_axtree_text(obs)
            next_path = observations_dir / f"step_{step + 1:03d}_after.axtree.txt"
            next_path.write_bytes(next_tree.encode("utf-8"))
            entry["next_observation_artifact"] = next_path.relative_to(destination).as_posix()
            entry["next_observation_sha256"] = sha256(next_tree.encode("utf-8")).hexdigest()
            entry["axtree_changed"] = (
                sha256(next_tree.encode("utf-8")).hexdigest()
                != entry["observation_sha256"]
            )
            entry["official_reward"] = float(reward)
            entry["action_seconds"] = round(time.monotonic() - t0, 3)
            if obs.get("last_action_error"):
                raw_error = str(obs["last_action_error"])
                entry["browser_error"] = raw_error[:1600]
                is_timeout = ("TimeoutError:" in raw_error
                              and re.search(r"Timeout [0-9]+ms exceeded", raw_error))
                dialog_occlusion = (
                    "intercepts pointer events" in raw_error.lower()
                    and "<dialog" in raw_error.lower()
                )
                failure = (
                    "browser_action_occluded_by_dialog" if dialog_occlusion
                    else "browser_action_timeout" if is_timeout
                    else "browser_action_error"
                )
                entry["browser_error_category"] = failure
                from qwen_dev import permitted_bids as _permitted
                entry["active_dialog_after_error"] = active_dialog_context(
                    obs, _permitted(obs, next_tree),
                )
                timeout_match = re.search(r"Timeout ([0-9]+)ms exceeded", raw_error)
                if timeout_match:
                    entry["browser_timeout_ms"] = int(timeout_match.group(1))
                if isinstance(step_info, dict) and "action_exec_timeout" in step_info:
                    entry["browsergym_action_exec_timeout_s"] = step_info["action_exec_timeout"]
                record["end_reason"] = failure
                record["failure_stage"] = "browsergym_action_execution"
                record["failed_action"] = action
                record["failed_action_target"] = entry.get("target")
                # Never automatically retry a click after an ambiguous timeout:
                # the target application may have already processed it.
                raise RuntimeError("BrowserGym action error: " + entry["browser_error"])
            current_state = get_current_state(server.url)
            delta = summarize_todo_delta(previous_state, current_state)
            previous_state = current_state
            if delta.get("added") or delta.get("changed") or delta.get("removed"):
                entry["todo_delta"] = delta
            if should_stop_for_unexpected_todo(delta):
                end_reason = "unexpected_empty_todo"
                break
            if reward >= 1.0:
                end_reason = "official_success"
                break
            if terminated or truncated:
                end_reason = "environment_ended"
                break

        # This trusted call occurs ONLY after the decision loop, not in prompt.
        if reward is None:
            reward = float(env.unwrapped.task.reward())
        record["official_reward"] = float(reward)
        record["official_success"] = bool(reward >= 1.0)
        record["valid"] = end_reason not in ("agent_output_invalid", "unexpected_empty_todo")
        record["run_complete"] = True
        record["status"] = (phase + "_success" if reward >= 1.0
                            else phase + "_unsuccessful")
        record["end_reason"] = end_reason
        record["final_ledger"] = ledger
        if not record["valid"]:
            record["status"] = "invalid_agent_episode"
            record["official_success"] = None
    except Exception as exc:
        record_error(record, exc)
    finally:
        if env is not None:
            try:
                env.close()
            except Exception as exc:
                if record["valid"]:
                    record_error(record, exc)
        try:
            record["final_sha256"] = hash_state(get_current_state(server.url))
        except Exception:
            record["final_sha256"] = None
        record["total_seconds"] = round(time.monotonic() - started, 3)
        record["finished_at_utc"] = datetime.now(timezone.utc).isoformat()
        path.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
        print(f"{method}: {record['status']} reward={record['official_reward']} "
              f"steps={record['steps']} model_calls={record['model_calls']} "
              f"invalid_actions={record['invalid_model_actions']} "
              f"repaired_steps={record['repaired_steps']} artifact={path}",
              flush=True)
        if record["status"] == "invalid_agent_episode":
            last = record["trace"][-1] if record["trace"] else {}
            if last.get("invalid_attempts"):
                attempted = [item.get("attempted_bid")
                             for item in last["invalid_attempts"]]
                print(f"  Rejected model bids: {attempted}; "
                      f"allowed bids: {last['invalid_attempts'][-1]['allowed_bids'][:25]}; "
                      f"reason: {last.get('agent_error')}", flush=True)
    return record


def comparable_decisions(episodes: dict) -> dict:
    """Count choices only at equal public observations and opportunity sets."""
    left = episodes["Baseline"].get("trace", [])
    right = episodes["Proposed"].get("trace", [])
    def key(item):
        bids = tuple(sorted(p["bid"] for p in item.get("candidate_probes", [])))
        return (item.get("observation_sha256"), bids)
    baseline = {key(item): item for item in left if item.get("probe_opportunity")}
    matches = 0
    divergences = 0
    for item in right:
        k = key(item)
        other = baseline.get(k)
        if item.get("probe_opportunity") and other:
            matches += 1
            divergences += int(item["action"] != other["action"])
    return {"comparable_probe_decisions": matches,
            "policy_action_divergences": divergences,
            "treatment_separation_observed": divergences > 0}


def run_pair(args, report: dict) -> None:
    root = Path(args.openapps_dir).expanduser().resolve()
    extra_registry = getattr(args, "models_file", None)
    identity = (model_identity(args.model_label, args.ollama_url,
                               models_file=Path(extra_registry))
                if extra_registry is not None
                else model_identity(args.model_label, args.ollama_url))
    report["model_identity"] = identity
    report["order"] = pair_order(args.task, args.model_label, args.seed)
    report["planned_methods"] = list(METHODS)
    report["parameters"] = {
        "study_phase": getattr(args, "study_phase", "development"),
        "task_group": args.task_group, "seed": args.seed, "max_steps": args.max_steps,
        "model_timeout": args.model_timeout, "temperature": TEMPERATURE,
        "bid_click_timeout_ms": DEV_CLICK_TIMEOUT_MS,
        "click_force_retry": False,
        "num_predict": NUM_PREDICT, "think": False,
        "action_subsets": list(ACTION_SUBSETS),
    }
    if getattr(args, "study_phase", "development") in ("main", "scale"):
        report["parameters"]["num_ctx"] = args.num_ctx
    if getattr(args, "study_phase", "development") == "scale":
        report["parameters"]["scale_id"] = args.scale_id
    first_hash = None
    directories = set()
    base = Path(report["artifact_dir"])
    for method in report["order"]:
        verify_model_identity(identity)
        with isolated_openapps(root, base / method / "server") as server:
            record = run_episode(
                root, server, method, identity, args,
                base / method / "episode", first_hash,
            )
            report["episodes"][method] = {
                "status": record["status"], "valid": record["valid"],
                "official_reward": record["official_reward"],
                "official_success": record["official_success"],
                "initial_sha256": record.get("initial_sha256"),
                "steps": record["steps"], "model_calls": record["model_calls"],
                "max_prompt_eval_tokens": record["max_prompt_eval_tokens"],
                "invalid_model_actions": record["invalid_model_actions"],
                "repair_requests": record["repair_requests"],
                "repaired_steps": record["repaired_steps"],
                "probe_opportunities": record["probe_opportunities"],
                "policy_overrides": record["policy_overrides"],
                "end_reason": record.get("end_reason"),
                "artifact": str(base / method / "episode" / "episode.json"),
            }
            if not record["valid"]:
                raise RuntimeError(f"{method} invalid: {record.get('error', record['status'])}")
            if server.database_dir in directories:
                raise RuntimeError("Pair accidentally reused a database directory")
            directories.add(server.database_dir)
            if first_hash is None:
                first_hash = record["initial_sha256"]
            elif record["initial_sha256"] != first_hash:
                raise RuntimeError("Initial app state parity failed")

    def episode_from_file(method):
        path = base / method / "episode" / "episode.json"
        return json.loads(path.read_text(encoding="utf-8"))
    full = {method: episode_from_file(method) for method in METHODS}
    report["initial_hash_parity"] = True
    report["policy_diagnostics"] = comparable_decisions(full)
    comparison = report["policy_diagnostics"]
    if comparison["comparable_probe_decisions"] == 0:
        reason = ("no_probe_candidates" if not any(
            record["probe_opportunities"] for record in report["episodes"].values()
        ) else "no_comparable_probe_decisions")
    elif comparison["policy_action_divergences"] == 0:
        reason = "same_actions_at_comparable_probe_decisions"
    else:
        reason = "policy_separation_observed"
    report["mechanism_status"] = reason
    report["status"] = (
        "paired_pilot_completed"
        if getattr(args, "study_phase", "development") == "pilot"
        else "paired_main_completed"
        if getattr(args, "study_phase", "development") == "main"
        else "paired_scale_completed"
        if getattr(args, "study_phase", "development") == "scale"
        else "paired_development_completed"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--openapps-dir", required=True)
    parser.add_argument("--model-label", default="qwen3.5-9b")
    parser.add_argument("--task", default="add_call_mom_to_my_todo")
    parser.add_argument("--task-group", choices=TASK_GROUPS,
                        default="all_tasks")
    parser.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--max-steps", type=int, default=16)
    parser.add_argument("--model-timeout", type=int, default=240)
    args = parser.parse_args(argv)
    if not TASK_KEY.fullmatch(args.task):
        parser.error("task must be an official OpenApps task key")
    if not 1 <= args.max_steps <= 30 or not 30 <= args.model_timeout <= 600:
        parser.error("Invalid step budget or model timeout")
    base = ROOT / "output/browsergym/matched_dev" / uuid4().hex
    base.mkdir(parents=True, exist_ok=False)
    report = {"mode": "matched_development_only", "status": "invalid_pair",
              "task": args.task, "task_group": args.task_group,
              "model_label": args.model_label,
              "artifact_dir": str(base), "episodes": {},
              "initial_hash_parity": False}
    artifact = base / "pair.json"
    try:
        run_pair(args, report)
    except Exception as exc:
        report["status"] = "invalid_pair"
        report["error"] = type(exc).__name__ + ": " + str(exc)
        print("INVALID MATCHED DEVELOPMENT: " + report["error"], file=sys.stderr)
        result = 2
    else:
        print("PASS: matched development episodes finished with isolated equal initial states")
        print("Official success:", {k: report["episodes"][k]["official_success"]
                                    for k in METHODS})
        for method in METHODS:
            episode = report["episodes"][method]
            print(f"  {method}: end_reason={episode.get('end_reason')} "
                  f"steps={episode['steps']} model_calls={episode['model_calls']} "
                  f"probe_opportunities={episode['probe_opportunities']} "
                  f"repairs={episode['repair_requests']}")
        print("Policy diagnostics:", report["policy_diagnostics"])
        print("Mechanism status:", report["mechanism_status"])
        if report["mechanism_status"] != "policy_separation_observed":
            print("RESEARCH GATE: CDEA intervention has not demonstrated "
                  "a different decision on a comparable public probe menu.")
        print("NOT pilot/main results. Inspect probe opportunities and action divergence.")
        result = 0
    finally:
        artifact.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                            encoding="utf-8")
        print("Matched development artifact:", artifact)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
