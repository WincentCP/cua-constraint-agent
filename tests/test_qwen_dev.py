import importlib.util
from pathlib import Path
import sys
import unittest
HERE = Path(__file__).resolve().parents[1] / "scripts/browsergym"
sys.path.insert(0,str(HERE))
spec = importlib.util.spec_from_file_location("dev",HERE / "qwen_dev.py")
dev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dev)

class TestDev(unittest.TestCase):
    def test_model_actions_restricted(self):
        bids={"a1","b2"}
        good=[
            ('{"action":"click","bid":"a1"}','click("a1")'),
            ('{"action":"fill","bid":"b2","text":"Call Mom"}','fill("b2", "Call Mom")'),
            ('{"action":"press","bid":"b2","key":"Enter"}','press("b2", "Enter")'),
            ('{"action":"back"}','go_back()'),
            ('{"action":"finish"}','finish'),
        ]
        for raw,expected in good:
            self.assertEqual(dev.parse_action({"message":{"content":raw}},bids),expected)
        bad=[
            '{"action":"click","bid":"ghost"}',
            '{"action":"press","bid":"a1","key":"F12"}',
            '{"action":"goto","url":"http://evil.example"}',
            '{"action":"fill","bid":"a1","text":""}',
            "click('a1')",
        ]
        for raw in bad:
            with self.assertRaises((ValueError,TypeError)):
                dev.parse_action({"message":{"content":raw}},bids)

    def test_bid_from_live_raw_axtree(self):
        obs={"axtree_object":{"nodes":[
            {"browsergym_id":"a1","ignored":False},
            {"browsergym_id":"b2","ignored":True}
        ]}}
        self.assertEqual(dev.permitted_bids(obs,"[a1] button\n[b2] box\n[ghost]"),{"a1"})

    def test_no_private_reward_in_prompt(self):
        contents=str(dev.messages("Add todo","http://localhost:5001","[a1] link",{"a1"},[]))
        self.assertNotIn("target_state",contents)
        self.assertNotIn("official_reward",contents)
