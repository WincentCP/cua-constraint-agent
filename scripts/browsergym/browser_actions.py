"""Shared helpers for safe BrowserGym element selection and action guards."""
from __future__ import annotations

import json
import re

BID_PATTERN = re.compile(r"\[([A-Za-z0-9_.:-]+)\]")


def permitted_bids(obs: dict, rendered_tree: str) -> set[str]:
    nodes = obs.get("axtree_object", {}).get("nodes", [])
    node_ids = {str(node["browsergym_id"]) for node in nodes if isinstance(node, dict)
                and node.get("browsergym_id") is not None
                and not node.get("ignored", False)}
    return node_ids & set(BID_PATTERN.findall(rendered_tree))


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
    """Prevent repeated clicks and empty todo submissions."""
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
    """Compare observed Todo records for diagnostics; never fed to the model."""
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
