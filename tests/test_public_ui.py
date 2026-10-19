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
