"""Read completed/partial BrowserGym paired DEVELOPMENT artifacts without rerunning.

Run from anywhere:
    python scripts/browsergym/inspect_pair.py --latest
    python scripts/browsergym/inspect_pair.py --pair PATH_TO_PAIR_JSON

No Ollama, OpenApps, evaluator or third-party dependencies.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "output" / "browsergym" / "matched_dev"
METHODS = ("Baseline", "Proposed")


def latest_pair(root: Path = DEFAULT_OUTPUT) -> Path:
    candidates = list(root.glob("*/pair.json"))
    if not candidates:
        raise FileNotFoundError(
            f"No pair.json files in {root}. Run matched development first."
        )
    return max(candidates, key=lambda p: (p.stat().st_mtime_ns, p.parent.name))


def resolve_pair(path: str | None, root: Path = DEFAULT_OUTPUT) -> Path:
    if path is None:
        return latest_pair(root)
    result = Path(path).expanduser()
    if not result.is_absolute():
        # Prefer an explicit path relative to the caller if it exists. If a
        # caller has changed into the OpenApps checkout, support the common
        # thesis-repo-relative output/browsergym/... form as well.
        from_cwd = Path.cwd() / result
        result = from_cwd if from_cwd.exists() else ROOT / result
    if result.is_dir():
        result = result / "pair.json"
    if not result.is_file():
        raise FileNotFoundError(f"Matched development report is missing: {result}")
    return result


def load_json(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"JSON report must be an object: {path}")
    return data


def _text(value, limit=180):
    if value is None:
        return "-"
    return str(value).replace("\r", " ").replace("\n", " ")[:limit]


def describe_pair(path: Path) -> str:
    """Summarize both episodes even when the pair is invalid or incomplete."""
    pair = load_json(path)
    lines = [
        "PAIRED DEVELOPMENT REPORT (NOT PILOT/MAIN)",
        f"Artifact: {path}",
        f"Status: {_text(pair.get('status'))}",
        f"Task: {_text(pair.get('task_group', 'unknown'))} / {_text(pair.get('task'))}",
        f"Model: {_text(pair.get('model_label'))}",
        f"Initial-state parity: {_text(pair.get('initial_hash_parity'))}",
    ]
    if pair.get("error"):
        lines.append("Pair error: " + _text(pair["error"], 350))
    for method in METHODS:
        artifact = path.parent / method / "episode" / "episode.json"
        lines.append("")
        lines.append("--- " + method + " ---")
        if not artifact.is_file():
            lines.append("No episode artifact: this method may not have run.")
            continue
        rec = load_json(artifact)
        lines.append(
            f"Status={_text(rec.get('status'))} "
            f"official_success={_text(rec.get('official_success'))} "
            f"reward={_text(rec.get('official_reward'))}"
        )
        lines.append(
            f"end_reason={_text(rec.get('end_reason'))} "
            f"browser_steps={_text(rec.get('steps'))} "
            f"model_calls={_text(rec.get('model_calls'))} "
            f"invalid_actions={_text(rec.get('invalid_model_actions'))} "
            f"repairs={_text(rec.get('repair_requests'))}"
        )
        if rec.get("error"):
            lines.append("Episode error: " + _text(rec["error"], 350))
        if rec.get("failure_stage"):
            lines.append(
                "Failure stage: " + _text(rec["failure_stage"])
                + " | end_reason=" + _text(rec.get("end_reason"))
                + " | failed_action=" + _text(rec.get("failed_action"))
            )
        if rec.get("bid_click_timeout_ms"):
            lines.append(
                "Click timeout: " + _text(rec["bid_click_timeout_ms"]) + " ms"
                + " | BrowserGym core=" + _text(rec.get("browsergym_core_version"))
                + " | forced retry=" + _text(rec.get("click_force_retry"))
            )
        trace = rec.get("trace") or []
        if not isinstance(trace, list):
            lines.append("Malformed trace array.")
            continue
        for item in trace[:40]:
            if not isinstance(item, dict):
                continue
            target = item.get("target") if isinstance(item.get("target"), dict) else {}
            lines.append(
                f"  step {_text(item.get('step'))}: "
                f"{_text(item.get('action'), 120)}"
                f" | target={_text(target.get('role'), 40)}:{_text(target.get('name'), 100)}"
                f" | probes={len(item.get('candidate_probes') or [])}"
            )
            before, after = item.get("url_before"), item.get("url_after")
            if before is not None:
                lines.append(
                    f"    URL: {_text(before, 150)} -> {_text(after, 150)}"
                    f" | changed={_text(item.get('url_changed'))}"
                    f" | AXTree changed={_text(item.get('axtree_changed'))}"
                )
            if item.get("invalid_attempts"):
                for bad in item["invalid_attempts"][:2]:
                    lines.append(
                        f"    rejected bid={_text(bad.get('attempted_bid'), 50)}"
                        f" reason={_text(bad.get('error'), 200)}"
                    )
            for modal_key in ("active_dialog", "active_dialog_after_error"):
                modal = item.get(modal_key)
                if isinstance(modal, dict):
                    controls = modal.get("controls") or []
                    names = "; ".join(
                        _text(control.get("bid"), 30) + " "
                        + _text(control.get("role"), 30) + ":"
                        + _text(control.get("name"), 80)
                        for control in controls[:8] if isinstance(control, dict)
                    )
                    lines.append(
                        "    ACTIVE DIALOG: " + _text(modal.get("dialog_name"))
                        + " | BID=" + _text(modal.get("dialog_bid"))
                        + " | controls=" + (names or "-")
                    )
            if item.get("guard_blocked"):
                lines.append("    GUARD BLOCKED: " + _text(item["guard_blocked"]))
            if item.get("agent_error"):
                lines.append("    MODEL ACTION ERROR: " + _text(item["agent_error"]))
            if item.get("browser_error"):
                lines.append(
                    "    BROWSER ERROR: " + _text(item["browser_error"])
                    + " | category=" + _text(item.get("browser_error_category"))
                    + " | timeout_ms=" + _text(item.get("browser_timeout_ms"))
                )
            if item.get("public_clickable_hints"):
                sample = item["public_clickable_hints"][:5]
                lines.append(
                    "    Public clickable rows: "
                    + "; ".join(
                        _text(h.get("bid"), 30) + " " + _text(h.get("visible_label"), 95)
                        for h in sample if isinstance(h, dict)
                    )
                )
        if len(trace) > 40:
            lines.append(f"  ({len(trace) - 40} more recorded trace entries omitted)")
    lines.append("")
    diagnostics = pair.get("policy_diagnostics") or {}
    if diagnostics:
        lines.append("Comparable probe decisions: "
                     + _text(diagnostics.get("comparable_probe_decisions")))
        lines.append("Policy action divergences: "
                     + _text(diagnostics.get("policy_action_divergences")))
    if not diagnostics or not diagnostics.get("comparable_probe_decisions"):
        lines.append(
            "RESEARCH GATE: no comparable information-probe decisions demonstrated. "
            "Do NOT infer effectiveness or CDEA superiority from this pair."
        )
    if pair.get("status") != "paired_development_completed":
        lines.append(
            "VALIDITY GATE: this is NOT a complete matched pair. "
            "Do not include it in pilot/main results."
        )
    lines.append("End of read-only diagnosis; no models or servers were started.")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    options = p.add_mutually_exclusive_group()
    options.add_argument("--pair", help="pair.json file or its parent directory")
    options.add_argument("--latest", action="store_true",
                         help="inspect newest development pair (the default)")
    args = p.parse_args(argv)
    try:
        print(describe_pair(resolve_pair(args.pair)))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print("INVALID REPORT: " + type(exc).__name__ + ": " + str(exc), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
