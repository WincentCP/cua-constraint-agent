"""Grounded BrowserGym public-navigation adapter contracts (no live OpenApps)."""
import importlib.util
from pathlib import Path
import sys
import unittest

HERE = Path(__file__).resolve().parents[1] / "scripts/browsergym"
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location("public_ui", HERE / "public_ui.py")
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)
import shared_policy as policy


def bank_tree(url="http://127.0.0.1:5011/openbanking"):
    return {
        "url": url,
        "axtree_object": {"nodes": [
            {"nodeId": "a", "browsergym_id": "96", "role": {"value": "link"},
             "name": {"value": "OpenBanking"}},
            {"nodeId": "b", "browsergym_id": "111", "role": {"value": "generic"},
             "name": {"value": ""}, "childIds": ["c", "d"]},
            {"nodeId": "c", "role": {"value": "StaticText"},
             "name": {"value": "BUS COMPLETE CHK (...5555)"}},
            {"nodeId": "d", "role": {"value": "StaticText"},
             "name": {"value": "Available balance"}},
            {"nodeId": "e", "browsergym_id": "112", "role": {"value": "generic"},
             "name": {"value": ""}, "childIds": ["f"]},
            {"nodeId": "f", "role": {"value": "StaticText"},
             "name": {"value": "Hidden account"}},
            {"nodeId": "g", "browsergym_id": "113", "role": {"value": "generic"},
             "name": {"value": ""}, "childIds": ["h"]},
            {"nodeId": "h", "role": {"value": "StaticText"},
             "name": {"value": "Nonclickable"}},
        ]},
        "extra_element_properties": {
            "111": {"visibility": 1.0, "clickable": True},
            "112": {"visibility": 0.0, "clickable": True},
            "113": {"visibility": 1.0, "clickable": False},
        },
    }


def modal_tree():
    """Synthetic public AXTree for native OpenBanking-like informational dialog."""
    return {
        "url": "http://127.0.0.1:5001/openbanking",
        "axtree_object": {"nodes": [
            {"nodeId": "behind", "browsergym_id": "20",
             "role": {"value": "button"},
             "name": {"value": "Open an account"}},
            {"nodeId": "rootdlg", "browsergym_id": "141",
             "role": {"value": "dialog"}, "name": {"value": "Open an account"},
             "childIds": ["article"]},
            {"nodeId": "article", "role": {"value": "generic"},
             "childIds": ["close", "body", "footer"]},
            {"nodeId": "close", "browsergym_id": "142",
             "role": {"value": "button"}, "name": {"value": "Close"}},
            {"nodeId": "body", "role": {"value": "StaticText"},
             "name": {"value": "Call our customer service line"}},
            {"nodeId": "footer", "role": {"value": "generic"}, "childIds": ["x"]},
            {"nodeId": "x", "browsergym_id": "143",
             "role": {"value": "button"}, "name": {"value": "Close"}},
        ]},
        "extra_element_properties": {
            "20": {"clickable": True, "visibility": 1.0},
            "141": {"visibility": 1.0},
            "142": {"clickable": True, "visibility": 1.0},
            "143": {"clickable": True, "visibility": 1.0},
        },
    }


class PublicUITests(unittest.TestCase):
    def test_generic_click_hints_are_visible_public_axtree_nodes_only(self):
        obs = bank_tree()
        hints = ui.clickable_generic_hints(obs, {"96", "111", "112", "113"})
        self.assertEqual(len(hints), 1)
        self.assertEqual(hints[0]["bid"], "111")
        self.assertEqual(hints[0]["role"], "generic")
        self.assertIn("BUS COMPLETE CHK", hints[0]["visible_label"])
        self.assertNotIn("Hidden account", str(hints))
        self.assertNotIn("Nonclickable", str(hints))
        self.assertNotIn("hx-get", str(hints))
        self.assertEqual(ui.clickable_generic_hints(obs, {"96"}), [])

    def test_unavailable_clickable_metadata_never_guesses_targets(self):
        obs = bank_tree()
        del obs["extra_element_properties"]
        self.assertEqual(ui.clickable_generic_hints(obs, {"96", "111"}), [])
        obs["extra_element_properties"] = {"111": {"clickable": "true"}}
        self.assertEqual(ui.clickable_generic_hints(obs, {"96", "111"}), [])

    def test_self_app_dock_reload_rejected_but_home_and_subpages_allowed(self):
        obs = bank_tree()
        self.assertIn("redundant_current_app_link",
                      ui.redundant_current_app_link('click("96")', obs))
        self.assertIsNone(ui.redundant_current_app_link('click("111")', obs))
        obs["url"] = "http://127.0.0.1:5011/"
        self.assertIsNone(ui.redundant_current_app_link('click("96")', obs))
        obs["url"] = "http://127.0.0.1:5011/openbanking/accounts/0"
        self.assertIsNone(ui.redundant_current_app_link('click("96")', obs))
        obs["url"] = "http://127.0.0.1:5011/openbanking"
        self.assertIsNone(ui.redundant_current_app_link('fill("96", "Hi")', obs))
        self.assertIsNone(ui.redundant_current_app_link('go_back()', obs))

    def test_active_dialog_exposes_only_current_public_descendant_controls(self):
        obs = modal_tree()
        dialog = ui.active_dialog_context(obs, {"20", "141", "142", "143"})
        self.assertIsNotNone(dialog)
        self.assertEqual(dialog["dialog_bid"], "141")
        self.assertEqual(dialog["dialog_name"], "Open an account")
        self.assertEqual(set(dialog["allowed_inside_bids"]), {"141", "142", "143"})
        self.assertEqual([c["bid"] for c in dialog["controls"]], ["142", "143"])
        self.assertNotIn("20", dialog["allowed_inside_bids"])
        self.assertEqual(
            ui.dialog_background_action_guard('click("20")', dialog)[:31],
            "dialog_blocks_background_action",
        )
        self.assertIsNone(ui.dialog_background_action_guard('click("142")', dialog))
        self.assertIsNone(ui.dialog_background_action_guard('press("141", "Escape")', dialog))
        self.assertIsNone(ui.dialog_background_action_guard('go_back()', dialog))
        self.assertIsNone(ui.dialog_background_action_guard('finish', dialog))

    def test_dialog_invisible_ambiguous_or_missing_hierarchy_fails_open(self):
        obs = modal_tree()
        obs["extra_element_properties"]["141"]["visibility"] = 0
        self.assertIsNone(ui.active_dialog_context(obs, {"20", "141", "142"}))
        obs = modal_tree()
        obs["axtree_object"]["nodes"][1]["childIds"] = []
        self.assertIsNone(ui.active_dialog_context(obs, {"20", "141", "142"}))
        obs = modal_tree()
        obs["axtree_object"]["nodes"].append({
            "nodeId": "dlg2", "browsergym_id": "144",
            "role": {"value": "alertdialog"}, "childIds": ["close"]
        })
        self.assertIsNone(ui.active_dialog_context(obs, {"20", "141", "142", "144"}))
        self.assertIsNone(ui.dialog_background_action_guard('click("20")', None))

    def test_modal_guidance_is_public_and_same_for_both_policies(self):
        obs = modal_tree()
        dialog = ui.active_dialog_context(obs, {"20", "141", "142", "143"})
        constraints = policy.public_constraints("Find largest card charge")
        ledger = policy.initial_ledger(constraints)
        msg = policy.public_messages(
            "Find largest card charge", obs["url"],
            "[20] button Open an account\n[142] button Close",
            {"20", "141", "142", "143"}, [], constraints, ledger,
            active_dialog=dialog,
        )
        self.assertIn("dialog", msg[1]["content"].lower())
        self.assertIn('"bid": "142"', msg[1]["content"])
        self.assertIn("Do NOT click controls behind", msg[1]["content"])
        self.assertNotIn("openbanking_all", str(msg))
        self.assertNotIn("target_state", str(msg))
        self.assertIn("dialog", policy.COMMON_SYSTEM.lower())

    def test_hint_prompt_is_pure_and_shared_between_methods(self):
        obs = bank_tree()
        hints = ui.clickable_generic_hints(obs, {"96", "111"})
        goal = "Find largest card charge, then add todo"
        constraints = policy.public_constraints(goal)
        ledger = policy.initial_ledger(constraints)
        messages = policy.public_messages(
            goal, obs["url"], "[96] link OpenBanking\n[111] generic",
            {"96", "111"}, [], constraints, ledger, clickable_hints=hints,
        )
        self.assertIn("BUS COMPLETE CHK", messages[1]["content"])
        self.assertIn("BrowserGym", messages[1]["content"])
        self.assertIn('"bid": "111"', messages[1]["content"])
        self.assertNotIn("tasks_target", str(messages))
        self.assertNotIn("target_state", str(messages))
        self.assertIn("do NOT click that same app", policy.COMMON_SYSTEM)


if __name__ == "__main__":
    unittest.main()
