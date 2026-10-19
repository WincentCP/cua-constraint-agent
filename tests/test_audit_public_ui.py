"""Contract tests for model-free public UI observability diagnosis."""
from pathlib import Path
import sys
import unittest

HERE = Path(__file__).resolve().parents[1] / "scripts/browsergym"
sys.path.insert(0, str(HERE))
import audit_public_ui as audit


def public_bank_obs():
    strings = [
        "div", "h2", "bid", "111", "444", "hx-get",
        "/openbanking/accounts/1", "/openbanking/accounts/2",
        "style", "cursor: pointer;", "22",
    ]
    return {
        "url": "http://127.0.0.1:5001/openbanking",
        "axtree_object": {"nodes": [
            {"nodeId": "title", "browsergym_id": "22",
             "role": {"value": "heading"}, "name": {"value": "Your accounts"}},
            {"nodeId": "row", "browsergym_id": "111",
             "role": {"value": "generic"}, "name": {"value": ""},
             "childIds": ["label"]},
            {"nodeId": "label", "role": {"value": "StaticText"},
             "name": {"value": "Business Checking (...5555)"}},
            {"nodeId": "ignored_row", "browsergym_id": "444",
             "role": {"value": "generic"}, "name": {"value": ""},
             "ignored": True},
        ]},
        "extra_element_properties": {
            "22": {"clickable": False, "visibility": 1.0,
                   "set_of_marks": False},
            "111": {"clickable": False, "visibility": 1.0,
                    "set_of_marks": True},
            "444": {"clickable": False, "visibility": 1.0,
                    "set_of_marks": True},
        },
        "dom_object": {"strings": strings, "documents": [{
            "nodes": {
                "attributes": [
                    [2, 3, 5, 6, 8, 9],
                    [2, 4, 5, 7, 8, 9],
                    [2, 10],
                ],
                "nodeName": [0, 0, 1],
            }
        }]},
    }


def flatten_visible(tree):
    return "[22] heading Your accounts\n[111] generic\nBusiness Checking (...5555)"


class AuditUITests(unittest.TestCase):
    def test_public_dom_diagnostics_do_not_promote_hidden_or_ignored_bids(self):
        obs = public_bank_obs()
        report = audit.summarize_public_ui(obs, flatten=flatten_visible)
        self.assertEqual(report["allowed_bids_count"], 2)
        self.assertEqual(report["public_page_path"], "openbanking")
        self.assertFalse(report["agent_axtree_truncated_at_16000"])
        self.assertEqual(len(report["actionable_generic_hints"]), 1)
        hint = report["actionable_generic_hints"][0]
        self.assertEqual(hint["bid"], "111")
        self.assertIn("Business Checking", hint["visible_label"])
        self.assertEqual(hint["browsergym_marker"], "set_of_marks")
        self.assertEqual(len(report["public_dom_htmx_or_pointer_targets"]), 2)
        dom = report["public_dom_htmx_or_pointer_targets"]
        self.assertTrue(dom[0]["in_agent_allowed_bids"])
        self.assertFalse(dom[1]["in_agent_allowed_bids"])
        self.assertTrue(dom[1]["in_axtree"])
        self.assertIn({"bid": "444", "clickable": False,
                       "set_of_marks": True},
                      report["nonallowed_actionable_metadata"])
        self.assertNotIn("openbanking/accounts/2", str(report["public_dom_htmx_or_pointer_targets"]))

    def test_missing_dom_snapshot_is_safe_and_not_an_authorization_to_act(self):
        obs = public_bank_obs()
        del obs["dom_object"]
        report = audit.summarize_public_ui(obs, flatten=flatten_visible)
        self.assertEqual(report["public_dom_htmx_or_pointer_targets"], [])
        self.assertEqual(report["allowed_bids_count"], 2)
        self.assertNotIn("444", str(report["actionable_generic_hints"]))

    def test_model_free_app_navigation_requires_observed_unique_link(self):
        obs = public_bank_obs()
        with self.assertRaisesRegex(RuntimeError, "Expected one visible"):
            audit._openbanking_link_bid(obs, flatten=flatten_visible)
        obs = {
            "axtree_object": {"nodes": [{
                "nodeId": "app", "browsergym_id": "64",
                "role": {"value": "link"}, "name": {"value": "OpenBanking"}
            }]}
        }
        def flatten(tree):
            return "[64] link OpenBanking"
        self.assertEqual(audit._openbanking_link_bid(obs, flatten=flatten), "64")

    def test_diagnostic_never_calls_model_or_reads_task_oracle(self):
        import inspect
        source = inspect.getsource(audit.run)
        self.assertNotIn("request_json(", source)
        self.assertNotIn("get_current_state(", source)
        self.assertNotIn("reward >= ", source)
        self.assertIn("summarize_public_ui(obs)", source)


if __name__ == "__main__":
    unittest.main()
