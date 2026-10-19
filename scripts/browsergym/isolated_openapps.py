"""Ephemeral, owned OpenApps servers for local BrowserGym acceptance gates.

Each context launches a NEW pinned OpenApps process with unique database and log
paths. A /environment_variables ownership probe prevents attaching to an
unrelated process on a reused port. Only the child we started may be stopped.
"""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
import os
from pathlib import Path
import secrets
import signal
import socket
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from smoke import UPSTREAM_PIN


@dataclass(frozen=True)
class IsolatedServer:
    url: str
    pid: int
    database_dir: str
    logs_dir: str
    server_log: str
    job_id: int


def check_pinned_openapps(root: Path) -> str:
    root = root.expanduser().resolve()
    if not (root / "launch.py").is_file():
        raise RuntimeError(f"OpenApps checkout missing: {root}")
    actual = subprocess.run(
        ["git", "-C", str(root), "rev-parse", "HEAD"],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    if actual != UPSTREAM_PIN:
        raise RuntimeError(f"OpenApps pin mismatch: {actual} != {UPSTREAM_PIN}")
    return actual


def _port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def pick_job_id() -> int:
    # OpenApps picks its first open port from 5001 + 100 * job_id.
    # These are non-Chrome-restricted ports; independent jobs use separate IDs.
    for _ in range(120):
        job_id = 100 + secrets.randbelow(301)
        if _port_available(5001 + job_id * 100):
            return job_id
    raise RuntimeError("Could not reserve an OpenApps job port")


def require_ownership(url: str, database_dir: Path, timeout: float = 2.0) -> bool:
    """Return False while booting; raise if a different server owns the port."""
    try:
        with urlopen(url + "/environment_variables", timeout=timeout) as reply:
            if reply.status != 200:
                return False
            body = reply.read().decode("utf-8", errors="replace")
    except (URLError, HTTPError, TimeoutError, ConnectionError, OSError):
        return False
    expected = database_dir.resolve().as_posix()
    if expected not in body and str(database_dir.resolve()) not in body:
        raise RuntimeError(
            "OpenApps port ownership mismatch: responding server uses another database_dir"
        )
    return True


def stop_owned_process(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        # /T kills any process tree created by *our* launched server, not an
        # unrelated server previously listening on port 5001.
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            capture_output=True, check=False, timeout=12,
        )
    else:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    try:
        process.wait(timeout=12)
    except subprocess.TimeoutExpired:
        if os.name == "nt":
            process.kill()
        else:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        process.wait(timeout=5)


@contextmanager
def isolated_openapps(root: Path, run_dir: Path, *, startup_seconds: int = 120):
    """Launch and destroy one private OpenApps server; fail closed on reuse."""
    root = root.expanduser().resolve()
    check_pinned_openapps(root)
    run_dir = run_dir.expanduser().resolve()
    database_dir = run_dir / "databases"
    logs_dir = run_dir / "logs"
    if database_dir.exists() or logs_dir.exists():
        raise RuntimeError(f"Refusing to reuse an OpenApps isolation directory: {run_dir}")
    database_dir.mkdir(parents=True)
    logs_dir.mkdir(parents=True)
    job_id = pick_job_id()
    url = f"http://127.0.0.1:{5001 + job_id * 100}"
    logfile = run_dir / "server.log"
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    env["USER"] = env.get("USER") or env.get("USERNAME") or "research"
    command = [
        sys.executable, "-u", str(root / "launch.py"),
        "headless=True", "seed=233",
        f"logs_dir={logs_dir.as_posix()}",
        f"databases_dir={database_dir.as_posix()}",
        f"+job_id={job_id}",
    ]
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    with logfile.open("w", encoding="utf-8") as stream:
        process = subprocess.Popen(
            command, cwd=str(root), env=env, stdout=stream,
            stderr=subprocess.STDOUT, creationflags=flags,
            start_new_session=(os.name != "nt"),
        )
        try:
            deadline = time.monotonic() + startup_seconds
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    raise RuntimeError(
                        f"OpenApps server exited (code {process.returncode}); inspect {logfile}"
                    )
                if require_ownership(url, database_dir):
                    break
                time.sleep(0.5)
            else:
                raise RuntimeError(f"OpenApps did not become ready; inspect {logfile}")
            yield IsolatedServer(
                url=url, pid=process.pid,
                database_dir=str(database_dir), logs_dir=str(logs_dir),
                server_log=str(logfile), job_id=job_id,
            )
        finally:
            stop_owned_process(process)
