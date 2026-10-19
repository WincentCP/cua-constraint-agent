"""Run existing Qwen diagnostics against a NEW independently-owned OpenApps server."""
from __future__ import annotations
import argparse
from dataclasses import asdict
import json
from pathlib import Path
import subprocess
import sys
from uuid import uuid4

from isolated_openapps import isolated_openapps

ROOT = Path(__file__).resolve().parents[2]

def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--openapps-dir", required=True)
    args = p.parse_args()
    root = Path(args.openapps_dir).expanduser().resolve()
    folder = ROOT / "output/browsergym/isolated_qwen" / uuid4().hex
    folder.mkdir(parents=True, exist_ok=False)
    report = {"status": "invalid_episode", "mode": "isolated_unpaired_dev_only",
              "path": str(folder), "server": None}
    try:
        with isolated_openapps(root, folder / "server") as server:
            report["server"] = asdict(server)
            command = [sys.executable, str(ROOT / "scripts/browsergym/qwen_dev.py"),
                       "--openapps-dir", str(root), "--url", server.url,
                       "--fresh-state-confirmed"]
            completed = subprocess.run(command, cwd=str(root), check=False)
            report["qwen_runner_exit"] = completed.returncode
            if completed.returncode != 0:
                raise RuntimeError(f"Qwen runner exit {completed.returncode}")
            report["status"] = "development_run_executed"
    except Exception as error:
        report["error"] = type(error).__name__ + ": " + str(error)
        print("INVALID ISOLATED DEVELOPMENT RUN: " + report["error"], file=sys.stderr)
        return_code = 2
    else:
        print("Isolated Qwen development run completed (not an experiment).")
        return_code = 0
    finally:
        artifact = folder / "report.json"
        artifact.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print("Isolation artifact: " + str(artifact))
    return return_code

if __name__ == "__main__":
    raise SystemExit(main())
