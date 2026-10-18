"""Official OpenApps + BrowserGym smoke. No Ollama, no CDEA, no task mutation."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit
from urllib.request import urlopen
from uuid import uuid4

UPSTREAM_PIN = "6e6782794433c60468d65ac75bc3f03c56007f8c"
TASKS = ("mark_water_plants_as_done", "add_call_mom_to_my_todo")


def validate_url(value: str) -> str:
    parsed = urlsplit(value)
    if (parsed.scheme != "http" or parsed.hostname not in ("localhost", "127.0.0.1")
            or parsed.port is None or parsed.username or parsed.password
            or parsed.path not in ("", "/") or parsed.query or parsed.fragment):
        raise ValueError("Expected a localhost HTTP origin with port")
    return "http://" + parsed.hostname + ":" + str(parsed.port)


def hash_state(state: object) -> str:
    raw = json.dumps(state, sort_keys=True, default=str, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def make_smoke_env(env_args: object, exp_dir: Path):
    """Use BrowserGym experiments EnvArgs' required mapping and directory."""
    exp_dir.mkdir(parents=True, exist_ok=True)
    # No high-level command translation is needed for the literal Python pass
    # action. Passing None deliberately executes the original Python source.
    return env_args.make_env(action_mapping=None, exp_dir=exp_dir)


def validate_noop_step(observation: dict, reward: float) -> None:
    """Do not silently count BrowserGym-captured action errors as successes."""
    if not isinstance(observation, dict):
        raise RuntimeError("BrowserGym step returned no observation")
    action_error = observation.get("last_action_error", "")
    if action_error:
        raise RuntimeError("BrowserGym action failed: " + str(action_error))
    if not isinstance(reward, (int, float)) or not 0 <= reward <= 1:
        raise RuntimeError("Invalid official evaluator reward")


def run(args: argparse.Namespace, report: dict) -> None:
    url = validate_url(args.url)
    root = Path(args.openapps_dir).expanduser().resolve()
    if not (root / "launch.py").is_file():
        raise RuntimeError("OpenApps checkout missing: " + str(root))
    actual = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD"],
                            check=True, text=True, capture_output=True).stdout.strip()
    report["upstream_sha"] = actual
    if actual != UPSTREAM_PIN:
        raise RuntimeError("OpenApps pin mismatch; expected " + UPSTREAM_PIN)
    with urlopen(url, timeout=7) as response:
        if response.status != 200:
            raise RuntimeError("OpenApps server HTTP " + str(response.status))

    # Keep dependency imports inside run(), so standalone contract tests do not
    # install BrowserGym or start a model. Upstream packages come from uv.
    from hydra import compose, initialize_config_dir
    from hydra.utils import instantiate
    from open_apps.state import get_current_state
    from open_apps.tasks.add_tasks_to_browsergym import register_tasks_with_browsergym

    os.chdir(root)
    with initialize_config_dir(config_dir=str(root / "config"), version_base=None):
        cfg = compose(config_name="config", overrides=["headless=True"])
        task = instantiate(cfg.tasks[args.task])
        register_tasks_with_browsergym([task])
        cfg.browsergym_env_args.task_name = task.task_id
        cfg.browsergym_env_args.task_kwargs.base_url = url
        cfg.browsergym_env_args.max_steps = 1
        cfg.browsergym_env_args.headless = True
        env_args = instantiate(cfg.browsergym_env_args)

    report["task_id"] = task.task_id
    report["initial_state_sha256"] = hash_state(get_current_state(url))
    env = None
    try:
        env = make_smoke_env(env_args, Path(report["experiment_dir"]))
        obs, _ = env.reset(seed=233)
        if not isinstance(obs, dict) or not str(obs.get("axtree_txt", "")).strip():
            raise RuntimeError("Missing official BrowserGym AXTree observation")
        report["axtree_characters"] = len(obs["axtree_txt"])
        # A literal Python pass is supported without an action mapper and
        # does not interact with any page or alter task data.
        next_obs, reward, terminated, truncated, _ = env.step("pass")
        validate_noop_step(next_obs, reward)
        report.update(official_reward=float(reward), terminated=bool(terminated),
                      truncated=bool(truncated), steps=1,
                      final_state_sha256=hash_state(get_current_state(url)),
                      status="smoke_valid")
    finally:
        if env is not None:
            env.close()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--openapps-dir", required=True)
    p.add_argument("--url", default="http://127.0.0.1:5001")
    p.add_argument("--task", choices=TASKS, default="mark_water_plants_as_done")
    args = p.parse_args(argv)
    out = Path(__file__).resolve().parents[2] / "output/browsergym/smoke"
    out.mkdir(parents=True, exist_ok=True)
    artifact = out / (uuid4().hex + ".json")
    report = {"status": "invalid_episode", "method": "none: no-op infrastructure smoke",
              "task": args.task, "official_reward": None,
              "experiment_dir": str(out / ("episode-" + artifact.stem))}
    try:
        run(args, report)
    except Exception as error:
        report["error"] = type(error).__name__ + ": " + str(error)
        print("INVALID SMOKE: " + report["error"], file=sys.stderr)
        code = 2
    else:
        print("PASS: official BrowserGym observation, action, and reward")
        print("Official smoke reward: " + str(report["official_reward"]))
        print("A no-op reward of 0 is NOT a CDEA failure.")
        code = 0
    finally:
        artifact.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print("Artifact: " + str(artifact))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
