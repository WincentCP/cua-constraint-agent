"""Read-only, model-free DEV audit of public BrowserGym OpenBanking UI.

One isolated pinned OpenApps process, one official browser navigation step,
then inspect the CURRENT public BrowserGym observation. NO Ollama and NO
experimental policy intervention. This identifies whether HTMX account rows
are in AXTree, actionable metadata, the model BID allowlist, or only DOM.

The agent itself never receives DOM data. DOM is read here only to diagnose
a public UI accessibility gap BEFORE selecting/freezing a research method.
This script never prints/uses official reward as a result.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import sys
from uuid import uuid4

from public_ui import clickable_generic_hints
from qwen_dev import describe_bid, permitted_bids
from smoke import extract_axtree_text, UPSTREAM_PIN

ROOT = Path(__file__).resolve().parents[2]
TASK = "add_todo_to_review_largest_card_charge"


def _public_dom_click_targets(observation: dict, bids: set[str], limit=64) -> list[dict]:
    """Return bounded markers for public HTMX/pointer targets from DOM snapshot.

    Do not return hx-get URLs, page source, private task targets, backend
    records, or unmarked IDs. DOM-targets are diagnostics ONLY and cannot
    become permitted model actions through this function.
    """
    dom = observation.get("dom_object")
    if not isinstance(dom, dict):
        return []
    strings = dom.get("strings")
    documents = dom.get("documents")
    if not isinstance(strings, list) or not isinstance(documents, list):
        return []

    def val(index):
        if isinstance(index, int) and 0 <= index < len(strings):
            return strings[index]
        return ""

    selected = []
    for document in documents[:8]:
        nodes = document.get("nodes", {}) if isinstance(document, dict) else {}
        arrays = nodes.get("attributes")
        names = nodes.get("nodeName")
        if not isinstance(arrays, list) or not isinstance(names, list):
            continue
        for idx, attrs in enumerate(arrays):
            if (not isinstance(attrs, list) or len(attrs) % 2 or
                    idx >= len(names)):
                continue
            props = {str(val(attrs[i])).casefold(): str(val(attrs[i + 1]))
                     for i in range(0, len(attrs), 2)}
            if not props:
                continue
            has_htmx = "hx-get" in props
            pointer = "cursor:pointer" in props.get("style", "").replace(" ", "").lower()
            if not (has_htmx or pointer):
                continue
            bid = props.get("bid")
            if not bid:
                continue
            selected.append({
                "bid": bid,
                "tag": str(val(names[idx])).casefold(),
                "has_public_htmx_get": has_htmx,
                "has_pointer_cursor": pointer,
                "in_agent_allowed_bids": bid in bids,
                "in_axtree": any(
                    n.get("browsergym_id") is not None
                    and str(n["browsergym_id"]) == bid
                    for n in observation.get("axtree_object", {}).get("nodes", [])
                    if isinstance(n, dict)
                ),
            })
            if len(selected) >= limit:
                return selected
    return selected


def summarize_public_ui(observation: dict, flatten=None) -> dict:
    """Inspect ONLY public BrowserGym observations and generated action hints."""
    tree = extract_axtree_text(observation, flatten=flatten)
    allowed = permitted_bids(observation, tree)
    nodes = observation.get("axtree_object", {}).get("nodes", [])
    props = observation.get("extra_element_properties", {}) or {}
    if not isinstance(props, dict):
        props = {}
    hints = clickable_generic_hints(observation, allowed)
    roles = Counter()
    generic = []
    omitted = []
    for node in nodes:
        if not isinstance(node, dict) or not node.get("browsergym_id"):
            continue
        bid = str(node["browsergym_id"])
        role = str(node.get("role", {}).get("value") or "")
        roles[role] += 1
        meta = props.get(bid) or {}
        if not isinstance(meta, dict):
            meta = {}
        if role.casefold() in ("generic", "group", "heading", "button", "link"):
            descriptor = {
                "bid": bid,
                "role": role,
                "name": str(node.get("name", {}).get("value") or "")[:120],
                "ignored": bool(node.get("ignored")),
                "in_agent_allowed_bids": bid in allowed,
                "visible": meta.get("visibility") not in (0, 0.0),
                "is_clickable": meta.get("clickable") is True,
                "in_set_of_marks": meta.get("set_of_marks") is True,
            }
            if bid in allowed and len(generic) < 140:
                generic.append(descriptor)
            elif (meta.get("set_of_marks") is True or
                  meta.get("clickable") is True) and len(omitted) < 50:
                omitted.append(descriptor)
    additional = [
        {"bid": bid,
         "clickable": meta.get("clickable") is True,
         "set_of_marks": meta.get("set_of_marks") is True}
        for bid, meta in props.items()
        if isinstance(meta, dict)
        and (meta.get("clickable") is True or meta.get("set_of_marks") is True)
        and bid not in allowed
    ][:80]
    return {
        "public_page_path": str(observation.get("url", "")).split("/", 3)[-1],
        "axtree_characters": len(tree),
        "agent_axtree_truncated_at_16000": len(tree) > 16000,
        "visible_agent_prompt_excerpt": tree[:16000],
        "axtree_bids_by_role": dict(sorted(roles.items())),
        "allowed_bids_count": len(allowed),
        "actionable_generic_hints": hints,
        "axtree_allowed_role_metadata": generic,
        "axtree_omitted_actionable_ids": omitted,
        "nonallowed_actionable_metadata": additional,
        "public_dom_htmx_or_pointer_targets":
            _public_dom_click_targets(observation, allowed),
    }


def _openbanking_link_bid(observation: dict, flatten=None) -> str:
    tree = extract_axtree_text(observation, flatten=flatten)
    bids = permitted_bids(observation, tree)
    selected = [
        bid for bid in bids
        if (describe_bid(observation, bid).get("role", "").casefold() == "link"
            and describe_bid(observation, bid).get("name", "").strip().casefold()
            == "openbanking")
    ]
    if len(selected) != 1:
        raise RuntimeError(
            "Expected one visible OpenBanking link on official desktop; "
            f"observed {len(selected)}. Do not guess a BID."
        )
    return selected[0]


def run(root: Path, output: Path) -> dict:
    """Model-free official BrowserGym setup, one UI-only navigation, no reward use."""
    from browsergym.core.action.highlevel import HighLevelActionSet
    from action_timeout import configure_bounded_click_timeout
    from isolated_openapps import isolated_openapps
    from matched_dev import ACTION_SUBSETS, SEED, build_env_args

    with isolated_openapps(root, output / "server") as server:
        env_args, _ = build_env_args(root, server.url, TASK, 2, "openbanking")
        actions = HighLevelActionSet(
            subsets=list(ACTION_SUBSETS), strict=True, multiaction=False,
            retry_with_force=False,
        )
        bg_version = configure_bounded_click_timeout(actions)
        exp_dir = output / "browsergym"
        exp_dir.mkdir(parents=True, exist_ok=False)
        env = env_args.make_env(
            action_mapping=actions.to_python_code, exp_dir=exp_dir
        )
        try:
            start, _ = env.reset(seed=SEED)
            bid = _openbanking_link_bid(start)
            obs, _, _, _, _ = env.step(
                'click(' + json.dumps(bid) + ')'
            )
            if obs.get("last_action_error"):
                raise RuntimeError(
                    "Official BrowserGym navigation error: "
                    + str(obs["last_action_error"])[:600]
                )
            if not str(obs.get("url") or "").split("?", 1)[0].endswith("/openbanking"):
                raise RuntimeError(
                    "The model-free public link did not reach OpenBanking root"
                )
            return {
                "mode": "public_ui_diagnostic_only",
                "not_pilot_main": True,
                "no_ollama_calls": True,
                "official_rewards_not_used": True,
                "upstream_sha": UPSTREAM_PIN,
                "browsergym_core_version": bg_version,
                "first_action": "click observed OpenBanking app link",
                "public_observation": summarize_public_ui(obs),
            }
        finally:
            env.close()


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--openapps-dir", type=Path, required=True)
    args = parser.parse_args(argv)
    folder = ROOT / "output" / "browsergym" / "ui_audit" / uuid4().hex
    folder.mkdir(parents=True, exist_ok=False)
    try:
        report = run(args.openapps_dir.expanduser().resolve(), folder)
        report["status"] = "completed"
        code = 0
    except Exception as exc:
        report = {
            "mode": "public_ui_diagnostic_only",
            "status": "invalid_diagnostic",
            "error": type(exc).__name__ + ": " + str(exc),
        }
        code = 2
    artifact = folder / "ui_audit.json"
    artifact.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
    if code:
        print("UI AUDIT ERROR: " + report["error"], file=sys.stderr)
    else:
        p = report["public_observation"]
        print("MODEL-FREE PUBLIC UI AUDIT - NOT PILOT/MAIN")
        print("OpenBanking allowed AXTree BIDs:", p["allowed_bids_count"])
        print("Visible generic actionable hints:", len(p["actionable_generic_hints"]))
        for item in p["actionable_generic_hints"][:12]:
            print("  bid=" + item["bid"] + " name="
                  + item["visible_label"][:100] + " marker="
                  + item["browsergym_marker"])
        print("DOM HTMX/pointer targets:",
              len(p["public_dom_htmx_or_pointer_targets"]))
        print("DOM targets not in allowed AXTree BIDs:",
              sum(not x["in_agent_allowed_bids"]
                  for x in p["public_dom_htmx_or_pointer_targets"]))
        print("Actionable metadata lacking allowed AXTree BID:",
              len(p["nonallowed_actionable_metadata"]))
        print("AXTree truncated in prompt:",
              p["agent_axtree_truncated_at_16000"])
        print("No model calls; results are diagnosis ONLY.")
    print("UI AUDIT ARTIFACT:", artifact)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
