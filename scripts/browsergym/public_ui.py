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
    if (title == path or app_name == path
            or (app_name.endswith("s") and app_name[:-1] == path)):
        return ("redundant_current_app_link: the current URL is already this "
                "app's root page. Do not reload the same dock/launcher icon. "
                "Inspect information in the current app using other observed "
                "controls; a generic clickable entry may represent a card/row.")
    return None


def active_dialog_context(observation: dict, allowed_bids: set[str]) -> dict | None:
    """Identify ONE dialog from the public BrowserGym accessibility tree.

    nodeId / childIds reveal which current BIDs belong to a dialog versus
    the page behind it. This is NOT a DOM or backend lookup, nor a task-
    specific heuristic. No controls or BIDs are synthesized.

    Missing hierarchy or incomplete visibility info fails open. This is a
    conservative proxy for possible modal occlusion, not a hit test.
    """
    obj = observation.get("axtree_object") or {}
    nodes = obj.get("nodes") if isinstance(obj, dict) else None
    props = observation.get("extra_element_properties") or {}
    if not isinstance(nodes, list) or not isinstance(props, dict):
        return None

    def role(node: dict) -> str:
        v = node.get("role")
        return str(v.get("value") or "").casefold() if isinstance(v, dict) else ""

    def visible(node: dict) -> bool:
        if node.get("ignored"):
            return False
        bid = node.get("browsergym_id")
        meta = props.get(str(bid)) if bid is not None else None
        visibility = meta.get("visibility") if isinstance(meta, dict) else None
        return not (isinstance(visibility, (int, float))
                    and not isinstance(visibility, bool) and visibility <= 0)

    dialogs = [
        node for node in nodes if isinstance(node, dict)
        and role(node) in ("dialog", "alertdialog") and visible(node)
    ]
    if len(dialogs) != 1:
        return None

    dialog = dialogs[0]
    by_id = {
        str(n["nodeId"]): n for n in nodes
        if isinstance(n, dict) and n.get("nodeId") is not None
    }
    queue = list(dialog.get("childIds") or [])
    visited = set()
    inside = set()
    controls = []
    allowed = {str(bid) for bid in allowed_bids}
    dialog_bid = dialog.get("browsergym_id")
    if dialog_bid is not None and str(dialog_bid) in allowed:
        inside.add(str(dialog_bid))

    while queue and len(visited) < 500:
        nid = str(queue.pop(0))
        if nid in visited:
            continue
        visited.add(nid)
        node = by_id.get(nid)
        if not node or not visible(node):
            continue
        bid = node.get("browsergym_id")
        bid = str(bid) if bid is not None else ""
        if bid in allowed:
            inside.add(bid)
            kind = role(node)
            extra = props.get(bid) or {}
            if (kind in ("button", "link", "textbox", "combobox", "checkbox",
                         "radio", "tab", "menuitem", "option")
                    or kind in ("generic", "group")
                    and isinstance(extra, dict) and extra.get("clickable") is True):
                if len(controls) < 20:
                    controls.append({
                        "bid": bid,
                        "role": kind,
                        "name": _node_text(node)[:120],
                    })
        queue.extend(node.get("childIds") or [])
    if queue or not controls:
        return None

    return {
        "dialog_bid": str(dialog_bid) if dialog_bid is not None else None,
        "dialog_name": _node_text(dialog)[:120],
        "allowed_inside_bids": sorted(inside),
        "controls": controls,
    }


def dialog_background_action_guard(action: str, dialog: dict | None) -> str | None:
    """Reject foreground-dialog-incompatible BID actions for both methods.

    Never auto-dismiss dialogs, force click, or run browser retries. The
    shared model may choose an alternative in the same observation once.
    """
    if dialog is None or not action.startswith(("click(", "fill(", "press(")):
        return None
    try:
        bid = json.loads(action[action.index("(") + 1:].split(",", 1)[0].rstrip(")"))
    except (ValueError, TypeError):
        return None
    if not isinstance(bid, str) or bid in dialog["allowed_inside_bids"]:
        return None
    return (
        "dialog_blocks_background_action: a visible dialog is active. "
        "The selected BID belongs to the page BEHIND the dialog and may be "
        "intercepted. Choose one of the current dialog controls from the "
        "accessibility tree (e.g. Close if available). Do not force-click "
        "or invent element IDs."
    )
