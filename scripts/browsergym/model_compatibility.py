"""Cheap local Ollama ACTION-CONTRACT preflight. No browser/server required.

Two synthetic public AXTree decisions exercise the EXACT shared planner schema
and action parser before a real paired episode. These are NOT research tasks:
correct synthetic responses cannot establish real browser task solvability.
"""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys
from uuid import uuid4

from ollama_preflight import (MODELS_FILE, find_installed_model, get_model,
                              request_json, validate_ollama_url)
from shared_policy import (choose_action, initial_ledger, public_constraints,
                           public_messages, rejected_action_diagnostic, repair_message)

ROOT = Path(__file__).resolve().parents[2]
NUM_PREDICT = 640
CASES = (
    {
        "case": "synthetic_navigation",
        "goal": "Open the OpenTodos application from this launcher.",
        "url": "http://127.0.0.1:5011/",
        "tree": "[17] link OpenTodos\n[23] link OpenCalendar",
        "nodes": [
            {"browsergym_id": "17", "role": {"value": "link"},
             "name": {"value": "OpenTodos"}},
            {"browsergym_id": "23", "role": {"value": "link"},
             "name": {"value": "OpenCalendar"}},
        ],
        "expected_action": 'click("17")',
    },
    {
        "case": "synthetic_text_input",
        "goal": "On this Todo page, type 'Review receipts' into New Todo. "
                "Do not click Add yet.",
        "url": "http://127.0.0.1:5011/todo",
        "tree": "[11] textbox New Todo\n[12] button Add",
        "nodes": [
            {"browsergym_id": "11", "role": {"value": "textbox"},
             "name": {"value": "New Todo"}},
            {"browsergym_id": "12", "role": {"value": "button"},
             "name": {"value": "Add"}},
        ],
        "expected_action": 'fill("11", "Review receipts")',
    },
    {
        "case": "synthetic_information_probe",
        "goal": "Inspect these account pages to determine which one has the highest "
                "available balance before doing any write action.",
        "url": "http://127.0.0.1:5011/openbanking",
        "tree": "[31] link Business Checking\n[32] link Business Savings\n"
                "[33] button Send message",
        "nodes": [
            {"browsergym_id": "31", "role": {"value": "link"},
             "name": {"value": "Business Checking"}},
            {"browsergym_id": "32", "role": {"value": "link"},
             "name": {"value": "Business Savings"}},
            {"browsergym_id": "33", "role": {"value": "button"},
             "name": {"value": "Send message"}},
        ],
        "expected_action": None,
        "acceptable_actions": ('click("31")', 'click("32")'),
    },
)


def run_check(label: str, origin: str, *, client=request_json,
              timeout: int = 180, models_file: Path = MODELS_FILE,
              num_ctx: int | None = None) -> dict:
    if not 30 <= timeout <= 600:
        raise ValueError("Model timeout must be between 30 and 600 seconds")
    url = validate_ollama_url(origin)
    if num_ctx is not None and not 2048 <= num_ctx <= 131072:
        raise ValueError("num_ctx must be 2048..131072")
    configured = json.loads(Path(models_file).read_text(encoding="utf-8"))
    model = get_model(configured, label)
    status = find_installed_model(client(url + "/api/tags", timeout=15), model)
    digest = status.get("digest")
    if not isinstance(digest, str) or not digest.strip():
        raise RuntimeError("Ollama did not return an installed model digest")

    result = {
        "mode": "synthetic_action_contract_only",
        "status": "invalid_preflight",
        "model_label": label, "model_name": model,
        "model_digest": digest,
        "model_requests": 0, "cases": [],
        "all_structurally_valid": False,
        "all_synthetic_actions_correct": False,
        "synthetic_probe_menu_demonstrated": False,
    }

    for case in CASES:
        observation = {
            "url": case["url"], "axtree_object": {"nodes": case["nodes"]}
        }
        bids = {str(node["browsergym_id"]) for node in case["nodes"]}
        constraints = public_constraints(case["goal"])
        ledger = initial_ledger(constraints)
        messages = public_messages(case["goal"], case["url"],
                                   case["tree"], bids, [], constraints, ledger)
        entry = {"case": case["case"], "status": "action_invalid",
                 "action": None, "model_calls": 0, "rejected_attempts": [],
                 "synthetic_action_correct": False,
                 "probe_opportunity": False, "probe_candidates": 0}
        result["cases"].append(entry)
        last_error = None
        for attempt in range(2):
            request = {
                "model": model, "stream": False, "think": False, "format": "json",
                "messages": messages if attempt == 0
                            else messages + [repair_message(last_error, bids)],
                "options": {"temperature": 0, "num_predict": NUM_PREDICT},
            }
            if num_ctx is not None:
                request["options"]["num_ctx"] = num_ctx
            reply = client(url + "/api/chat", data=request, timeout=timeout)
            entry["model_calls"] += 1
            result["model_requests"] += 1
            entry["prompt_eval_count"] = reply.get("prompt_eval_count")
            entry["eval_count"] = reply.get("eval_count")
            entry["done_reason"] = reply.get("done_reason")
            trial_ledger = {k: dict(v) for k, v in ledger.items()}
            try:
                action, decision = choose_action(
                    reply, "Baseline", observation, case["tree"],
                    constraints, trial_ledger, 1,
                )
            except (ValueError, TypeError, KeyError) as exc:
                last_error = exc
                entry["rejected_attempts"].append({
                    "attempt": attempt + 1,
                    "error": type(exc).__name__ + ": " + str(exc)[:200],
                    **rejected_action_diagnostic(reply, bids),
                })
                continue
            entry["action"] = action
            entry["status"] = "action_structurally_valid"
            entry["synthetic_action_correct"] = (
                action in case["acceptable_actions"]
                if "acceptable_actions" in case
                else action == case["expected_action"]
            )
            entry["probe_opportunity"] = bool(decision["probe_opportunity"])
            entry["probe_candidates"] = len(decision["candidate_probes"])
            break
        if entry["status"] != "action_structurally_valid":
            entry["diagnosis"] = (
                "The model did not produce a shared-controller-compatible "
                "action after one same-observation repair. Do NOT start paired "
                "experiments with this model before checking its output format."
            )

    result["all_structurally_valid"] = all(
        case["status"] == "action_structurally_valid" for case in result["cases"]
    )
    result["all_synthetic_actions_correct"] = all(
        case["synthetic_action_correct"] for case in result["cases"]
    )
    result["synthetic_probe_menu_demonstrated"] = any(
        case["case"] == "synthetic_information_probe" and case["probe_opportunity"]
        for case in result["cases"]
    )
    if not result["all_structurally_valid"]:
        result["status"] = "action_contract_failed"
    else:
        result["status"] = "action_contract_pass"
    result["note"] = (
        "Synthetic JSON/BID interface only. Correctness of synthetic actions "
        "is a separate warning, not a browser success metric. No OpenApps "
        "server, official evaluator or CDEA treatment was run."
    )
    return result


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--model-label", default="qwen3.5-9b")
    p.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    p.add_argument("--model-timeout", type=int, default=180)
    p.add_argument("--models-file", type=Path, default=MODELS_FILE)
    p.add_argument("--num-ctx", type=int)
    args = p.parse_args(argv)
    base = ROOT / "output" / "ollama" / "action_contract"
    base.mkdir(parents=True, exist_ok=True)
    artifact = base / (uuid4().hex + ".json")
    record = {"mode": "synthetic_action_contract_only",
              "status": "invalid_preflight", "label": args.model_label}
    try:
        record = run_check(args.model_label, args.ollama_url,
                           timeout=args.model_timeout,
                           models_file=args.models_file, num_ctx=args.num_ctx)
    except (Exception,) as exc:
        # Diagnostic-only tool: all failures are explicitly reported and
        # never treated as task results. Avoid outputting raw model JSON.
        record["error"] = type(exc).__name__ + ": " + str(exc)[:400]
        print("ACTION CONTRACT PREFLIGHT ERROR:", record["error"], file=sys.stderr)
        exit_code = 2
    else:
        for case in record["cases"]:
            print(
                f"{case['case']}: {case['status']} "
                f"action={case['action']} "
                f"synthetic_target_correct={case['synthetic_action_correct']} "
                f"probe_candidates={case['probe_candidates']} "
                f"requests={case['model_calls']}"
            )
        if record["status"] == "action_contract_pass":
            print("PASS: model responds with valid shared planner actions.")
            if not record["all_synthetic_actions_correct"]:
                print(
                    "WARNING: Some synthetic actions missed the specified "
                    "target. Do not infer task-solving competence."
                )
            if not record["synthetic_probe_menu_demonstrated"]:
                print(
                    "RESEARCH WARNING: model did not provide two eligible "
                    "information probes on the synthetic choice. Even successful "
                    "browser execution cannot yet demonstrate a CDEA effect."
                )
            exit_code = 0
        else:
            print("FAIL: incompatible model action format; no browser run.", file=sys.stderr)
            exit_code = 2
        print("No official BrowserGym task was executed.")
    finally:
        artifact.write_text(
            json.dumps(record, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print("Action-contract artifact:", artifact)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
