"""Shared public-only planner and ranking-policy boundary for paired development.

Both methods see the SAME prompt/schema, goal-derived constraints, candidate
eligibility, tentative evidence ledger and model scores. Only probe ranking
changes. Metadata are unverified model heuristics, never official evidence.
"""
from __future__ import annotations

import json
import re
from hashlib import sha256

from qwen_dev import describe_bid, parse_action, permitted_bids

METHODS = ("Baseline", "Proposed")
PROBE_ROLES = frozenset({
    "link", "button", "generic", "checkbox", "radio", "tab",
    "menuitem", "option", "combobox",
})
MAX_PROBES = 6
MAX_CONSTRAINTS = 6

COMMON_SYSTEM = (
    "You are a computer-use agent. Complete the public goal using only the "
    "visible browser accessibility tree. Return ONE JSON object, no markdown. "
    "Always provide a next action such as "
    '{"action":"click","bid":"40"}, '
    '{"action":"fill","bid":"21","text":"Call Mom"}, '
    '{"action":"press","bid":"21","key":"Enter"}, '
    '{"action":"back"}, or {"action":"finish"}. '
    "Use only observed element IDs. A click on a textbox does not type; "
    "use fill to enter text. Submit only when required inputs are filled. "
    "Finish only after the requested change is visible. "
    "If there are two or more meaningful UI controls to INSPECT information "
    "before acting, you may additionally include "
    '"decision":"probe","probes":[{"bid":"40","progress_score":4,'
    '"forward_cost":1,"may_answer":["c1"]},...]'. '
    "A probe is a click on an observed control to discover information, "
    "not a submit/write action. Score generic forward progress 0..5; "
    "may_answer must cite public constraint IDs; forward_cost 1..5. "
    "If no real inspection choice, omit probes and use decision act. "
    "Optional evidence: [{\"constraint\":\"c1\",\"state\":\"SATISFIED\","
    "\"quote\":\"exact substring from the current accessibility tree\"}]. "
    "Report evidence only with literal visible quotes; do not guess. "
    "Do not mention or use private evaluator state."
)


def public_constraints(goal: str) -> list[dict]:
    """Literal public goal fragments, not expected values from task configuration."""
    if not isinstance(goal, str) or not goal.strip():
        raise ValueError("Missing public goal")
    fragments = re.split(
        r"\s*;\s*|\s+\band then\b\s+|\s+\bthen\b\s+|\s+\band also\b\s+",
        goal.strip(), flags=re.IGNORECASE,
    )
    fragments = [part.strip(" .\n\t") for part in fragments if part.strip(" .\n\t")]
    if not fragments:
        fragments = [goal.strip()]
    if len(fragments) > MAX_CONSTRAINTS:
        # Preserve whole goal rather than silently discarding requirements.
        fragments = [goal.strip()]
    return [{"id": f"c{i+1}", "description": part[:400]} for i, part in enumerate(fragments)]


def initial_ledger(constraints: list[dict]) -> dict:
    return {item["id"]: {"state": "UNKNOWN", "quote": "", "observation_sha256": ""}
            for item in constraints}


def public_messages(goal: str, url: str, tree: str, bids: set[str],
                    history: list[str], constraints: list[dict], ledger: dict) -> list[dict]:
    """Identical for Baseline and Proposed; no policy name in model messages."""
    visible_ledger = {
        key: {"state": ledger[key]["state"], "quote": ledger[key]["quote"]}
        for key in (item["id"] for item in constraints)
    }
    user = (
        "Goal: " + goal
        + "\nCurrent URL: " + str(url)
        + "\nAllowed element IDs: " + ", ".join(sorted(bids))[:1600]
        + "\nPublic goal constraints: " + json.dumps(constraints, ensure_ascii=False)
        + "\nTentative evidence from prior visible observations (not verified): "
        + json.dumps(visible_ledger, ensure_ascii=False)
        + "\nPrevious actions: " + json.dumps(history[-6:])
        + "\nCurrent accessibility tree:\n" + tree[:16000]
    )
    return [{"role": "system", "content": COMMON_SYSTEM},
            {"role": "user", "content": user}]


def _model_object(reply: dict) -> dict:
    message = reply.get("message")
    raw = message.get("content") if isinstance(message, dict) else None
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError("Model returned empty visible JSON")
    obj = json.loads(raw)
    if not isinstance(obj, dict):
        raise ValueError("Model reply must be a JSON object")
    return obj


def grounded_evidence(obj: dict, tree: str, ledger: dict, step: int) -> list[dict]:
    """Verify quotation presence only; never call this fact-checked evidence."""
    result = []
    proposed = obj.get("evidence", [])
    if not isinstance(proposed, list):
        return result
    observation_sha = sha256(tree.encode("utf-8")).hexdigest()
    for entry in proposed[:MAX_CONSTRAINTS]:
        if not isinstance(entry, dict):
            continue
        key, state, quote = entry.get("constraint"), entry.get("state"), entry.get("quote")
        if (key not in ledger or state not in ("SATISFIED", "REFUTED")
                or not isinstance(quote, str) or not (2 <= len(quote) <= 200)
                or quote not in tree):
            continue
        existing = ledger[key]["state"]
        new_state = state if existing in ("UNKNOWN", state) else "UNKNOWN"
        ledger[key] = {
            "state": new_state,
            "quote": quote if new_state != "UNKNOWN" else "",
            "observation_sha256": observation_sha,
            "step": step,
        }
        result.append({"constraint": key, "state": new_state,
                       "quote": quote, "grounded_in_axtree": True,
                       "verified_correctness": False})
    return result


def _probe_candidates(obj: dict, bids: set[str], observation: dict,
                      constraint_ids: set[str]) -> list[dict]:
    raw = obj.get("probes", [])
    if not isinstance(raw, list):
        return []
    result = []
    seen = set()
    for item in raw[:MAX_PROBES]:
        if not isinstance(item, dict):
            continue
        bid = item.get("bid")
        if not isinstance(bid, str) or bid not in bids or bid in seen:
            continue
        role = describe_bid(observation, bid)["role"].casefold()
        if role not in PROBE_ROLES:
            continue
        score, cost, answers = (item.get("progress_score"),
                                item.get("forward_cost"), item.get("may_answer"))
        if (type(score) is not int or not 0 <= score <= 5
                or type(cost) is not int or not 1 <= cost <= 5
                or not isinstance(answers, list)):
            continue
        ids = [key for key in answers if isinstance(key, str) and key in constraint_ids]
        result.append({"bid": bid, "action": "click(" + json.dumps(bid) + ")",
                       "progress_score": score, "forward_cost": cost,
                       "may_answer": sorted(set(ids)), "order": len(result),
                       "target": describe_bid(observation, bid)})
        seen.add(bid)
    return result


def choose_action(reply: dict, method: str, observation: dict, tree: str,
                  constraints: list[dict], ledger: dict, step: int) -> tuple[str, dict]:
    """Rank actual information probes differently while keeping execution shared."""
    if method not in METHODS:
        raise ValueError("Unknown ranking policy")
    bids = permitted_bids(observation, tree)
    if not bids:
        raise ValueError("No public accessible BrowserGym target IDs")
    obj = _model_object(reply)
    primary = parse_action(reply, bids)
    evidence = grounded_evidence(obj, tree, ledger, step)
    probes = _probe_candidates(obj, bids, observation,
                               {item["id"] for item in constraints})
    opportunity = obj.get("decision") == "probe" and len(probes) >= 2
    selected = primary
    selected_probe = None
    if opportunity:
        if method == "Baseline":
            selected_probe = min(probes, key=lambda x: (-x["progress_score"], x["order"]))
        else:
            def proposed_key(item):
                unknown = sum(ledger[key]["state"] == "UNKNOWN"
                              for key in item["may_answer"])
                return (-unknown, item["forward_cost"], item["order"])
            selected_probe = min(probes, key=proposed_key)
        selected = selected_probe["action"]
    return selected, {
        "model_primary_action": primary,
        "decision": obj.get("decision", "act"),
        "candidate_probes": probes,
        "probe_opportunity": opportunity,
        "selected_probe": selected_probe,
        "policy_overrode_primary": selected != primary,
        "grounded_tentative_evidence": evidence,
        "ledger": {key: dict(val) for key, val in ledger.items()},
    }
