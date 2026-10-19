"""Shared PUBLIC BrowserGym observation helpers (no backend/evaluator access).

Only current URL, AXTree and extra_element_properties may be used. In
particular, there is no DOM query, privileged account API, hidden benchmark
state, task target, or fixed app URL in these functions.
"""
from __future__ import annotations

import json
import re
from urllib.parse import urlsplit

from qwen_dev import describe_bid


def _node_text(node: dict) -> str:
    name = node.get("name")
    if isinstance(name, dict):
        value = name.get("value")
        return str(value).strip() if isinstance(value, str) else ""
    return ""


def clickable_generic_hints(observation: dict, allowed_bids: set[str],
                            limit: int = 16) -> list[dict]:
    """Label actionable nonsemantic UI containers using public AXTree children.

    BrowserGym enriches AXTree observations with extra_element_properties from
    its public rendered DOM snapshot. A generic HTML container may contain
    visible text but have no accessibility name itself. Here we combine *only*
    public AXTree descendant text and BrowserGym's own clickable flag. This
    never creates new BIDs, expands the action set, or reads href/hx_get.
    """
    nodes = observation.get("axtree_object", {}).get("nodes", [])
    props = observation.get("extra_element_properties", {})
    if not isinstance(nodes, list) or not isinstance(props, dict):
        return []
    by_id = {str(n["nodeId"]): n for n in nodes if isinstance(n, dict)
             and n.get("nodeId") is not None}

    def child_label(node: dict) -> str:
        queue = list(node.get("childIds") or [])
        seen = set()
        parts = []
        while queue and len(parts) < 12 and len(seen) < 70:
            child_id = str(queue.pop(0))
            if child_id in seen:
                continue
            seen.add(child_id)
            child = by_id.get(child_id)
            if not child or child.get("ignored"):
                continue
            role = child.get("role", {}).get("value", "")
            if role in ("StaticText", "InlineTextBox", "text"):
                value = _node_text(child)
                if value and value not in parts:
                    parts.append(value)
            elif role not in ("button", "link", "textbox"):
                queue.extend(child.get("childIds") or [])
        return " ".join(parts).strip()[:180]

    hints = []
    seen_bids = set()
    for node in nodes:
        if not isinstance(node, dict) or node.get("ignored"):
            continue
        if node.get("role", {}).get("value", "").casefold() not in ("generic", "group"):
            continue
        bid = str(node.get("browsergym_id") or "")
        if bid not in allowed_bids or bid in seen_bids:
            continue
        meta = props.get(bid)
        if not isinstance(meta, dict) or meta.get("clickable") is not True:
            continue
        visibility = meta.get("visibility")
        if isinstance(visibility, (int, float)) and visibility <= 0:
            continue
        label = _node_text(node) or child_label(node)
        if not label:
            continue
        hints.append({"bid": bid, "role": node["role"]["value"],
                      "visible_label": label})
        seen_bids.add(bid)
        if len(hints) >= limit:
            break
    return hints


def redundant_current_app_link(action: str, observation: dict) -> str | None:
    """Reject dock/current-app icon reloads using public URL + AXTree names.

    Applies to all apps and all policies; not a model-derived target route.
    Does not block app navigation from the home page or sub-page back links.
    """
    if not action.startswith("click(") or not action.endswith(")"):
        return None
    try:
        bid = json.loads(action[len("click("):-1])
    except (ValueError, TypeError):
        return None
    if not isinstance(bid, str):
        return None
    target = describe_bid(observation, bid)
    if target["role"].casefold() != "link":
        return None
    title = re.sub(r"[^a-z0-9]", "", target["name"].casefold())
    if not title.startswith("open"):
        return None
    path = urlsplit(str(observation.get("url") or "")).path.strip("/").casefold()
    if not path or "/" in path:
        return None
    app_name = title[4:]
    if app_name == path or (app_name.endswith("s") and app_name[:-1] == path):
        return ("redundant_current_app_link: the current URL is already this "
                "app's root page. Do not reload the same dock/launcher icon. "
                "Inspect information in the current app using other observed "
                "controls; a generic clickable entry may represent a card/row.")
    return None
