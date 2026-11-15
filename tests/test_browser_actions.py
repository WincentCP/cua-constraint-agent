import importlib.util
from pathlib import Path
import sys
import unittest

HERE = Path(__file__).resolve().parents[1] / "scripts/browsergym"
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location("browser_actions", HERE / "browser_actions.py")
actions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(actions)


class TestBrowserActions(unittest.TestCase):

    def test_structured_model_actions_are_restricted(self):
        bids = {"a1", "b2"}
        good = [
            ('{"action":"click","bid":"a1"}', 'click("a1")'),
            ('{"action":"fill","bid":"b2","text":"Call Mom"}', 'fill("b2", "Call Mom")'),
            ('{"action":"press","bid":"b2","key":"Enter"}', 'press("b2", "Enter")'),
            ('{"action":"back"}', "go_back()"),
            ('{"action":"finish"}', "finish"),
        ]
        for raw, expected in good:
            self.assertEqual(actions.parse_action({"message": {"content": raw}}, bids), expected)
        bad = [
            '{"action":"click","bid":"ghost"}',
            '{"action":"press","bid":"a1","key":"F12"}',
            '{"action":"goto","url":"http://evil.example"}',
            '{"action":"fill","bid":"a1","text":""}',
            "click('a1')",
        ]
        for raw in bad:
            with self.assertRaises((ValueError, TypeError)):
                actions.parse_action({"message": {"content": raw}}, bids)

    def test_bid_from_live_raw_axtree(self):
        obs = {"axtree_object": {"nodes": [
            {"browsergym_id": "a1", "ignored": False},
            {"browsergym_id": "b2", "ignored": True},
        ]}}
        self.assertEqual(actions.permitted_bids(obs, "[a1] button\n[b2] box\n[ghost]"), {"a1"})

    def test_describe_bid_uses_public_axtree(self):
        obs = {"axtree_object": {"nodes": [
            {"browsergym_id": "226", "role": {"value": "textbox"},
             "name": {"value": "New Todo"}, "value": {"value": "Call Mom"}},
        ]}}
        self.assertEqual(actions.describe_bid(obs, "226")["value"], "Call Mom")
        self.assertEqual(actions.describe_bid(obs, "999")["name"], "")

    def test_guard_prevents_repeated_click_and_blank_submit(self):
        obs = {"axtree_object": {"nodes": [
            {"browsergym_id": "22", "role": {"value": "button"}, "name": {"value": "Add"}},
            {"browsergym_id": "226", "role": {"value": "textbox"}, "name": {"value": "New Todo"}},
        ]}}
        self.assertIn("repeated_click_limit", actions.guarded_action(
            'click("226")', obs, ['click("226")', 'click("226")'],
            "http://localhost:5001/todo"))
        self.assertIn("empty_todo_submission", actions.guarded_action(
            'click("22")', obs, [], "http://localhost:5001/todo"))
        obs["axtree_object"]["nodes"][1]["value"] = {"value": "Call Mom"}
        self.assertIsNone(actions.guarded_action(
            'click("22")', obs, [], "http://localhost:5001/todo"))

    def test_todo_delta_and_empty_item_detection(self):
        original = {"todo": [{"id": 1, "title": "Existing", "done": False}]}
        changed = {"todo": [
            {"id": 1, "title": "Existing", "done": False},
            {"id": 2, "title": "", "done": False},
        ]}
        delta = actions.summarize_todo_delta(original, changed)
        self.assertEqual(delta["added"][0]["id"], "2")
        self.assertTrue(actions.should_stop_for_unexpected_todo(delta))
        self.assertFalse(actions.should_stop_for_unexpected_todo(
            actions.summarize_todo_delta(original, original)))


if __name__ == "__main__":
    unittest.main()
