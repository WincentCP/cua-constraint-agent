"""Synthetic model-interface contract tests; never start Ollama or BrowserGym."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

HERE = Path(__file__).resolve().parents[1] / "scripts/browsergym"
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location(
    "model_compatibility", HERE / "model_compatibility.py"
)
compat = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compat)


def fake_reply(action, bid=None, **kw):
    obj = {"action": action, **kw}
    if bid is not None:
        obj["bid"] = bid
    return {"message": {"content": json.dumps(obj)}, "done_reason": "stop",
            "prompt_eval_count": 222, "eval_count": 24}


class ModelCompatibilityTests(unittest.TestCase):
    def client(self, *, invalid_first=False, always_invalid=False,
               semantic_miss=False, digest=True, offer_probes=False):
        requests = []
        calls_by_case = {}
        def get(url, *, timeout, data=None):
            requests.append({"url": url, "data": data, "timeout": timeout})
            if url.endswith("/api/tags"):
                return {
                    "models": [{
                        "name": "qwen3.5:9b-q4_K_M",
                        "digest": "sha256:fixed" if digest else "",
                    }]
                }
            self.assertTrue(url.endswith("/api/chat"))
            self.assertIsNotNone(data)
            self.assertEqual(data["think"], False)
            self.assertEqual(data["format"], "json")
            self.assertEqual(data["options"]["temperature"], 0)
            self.assertEqual(data["options"]["num_predict"], compat.NUM_PREDICT)
            self.assertEqual(data["model"], "qwen3.5:9b-q4_K_M")
            # Only fake public goal and accessibility IDs reach the model.
            msg = data["messages"][1]["content"]
            self.assertNotIn("private evaluator", msg)
            self.assertNotIn("target_state", msg)
            case = ("navigate" if "Open the OpenTodos" in msg else
                    "fill" if "On this Todo page" in msg else "probe")
            count = calls_by_case.get(case, 0)
            calls_by_case[case] = count + 1
            if always_invalid or (invalid_first and count == 0):
                return fake_reply("click", "999")
            if case == "navigate":
                return fake_reply("click", "23" if semantic_miss else "17")
            if case == "fill":
                return fake_reply("fill", "11", text="Review receipts")
            if offer_probes:
                return fake_reply(
                    "click", "31", decision="probe", probes=[
                        {"bid": "31", "progress_score": 5,
                         "forward_cost": 4, "may_answer": ["c1"]},
                        {"bid": "32", "progress_score": 3,
                         "forward_cost": 1, "may_answer": ["c1"]},
                    ]
                )
            return fake_reply("click", "31")
        return get, requests

    def test_shared_prompt_and_valid_actions_in_both_synthetic_cases(self):
        client, requests = self.client()
        result = compat.run_check(
            "qwen3.5-9b", "http://127.0.0.1:11434", client=client
        )
        self.assertEqual(result["status"], "action_contract_pass")
        self.assertTrue(result["all_structurally_valid"])
        self.assertTrue(result["all_synthetic_actions_correct"])
        self.assertEqual(result["model_requests"], 3)
        self.assertEqual(len(requests), 4)
        self.assertFalse(result["synthetic_probe_menu_demonstrated"])
        self.assertEqual(result["model_digest"], "sha256:fixed")
        self.assertEqual(result["cases"][0]["action"], 'click("17")')
        self.assertEqual(result["cases"][1]["action"], 'fill("11", "Review receipts")')

    def test_one_repair_is_shared_and_does_not_run_browser(self):
        client, requests = self.client(invalid_first=True)
        result = compat.run_check("qwen3.5-9b", "http://127.0.0.1:11434",
                                  client=client)
        self.assertEqual(result["status"], "action_contract_pass")
        self.assertEqual(result["model_requests"], 6)
        self.assertEqual([x["model_calls"] for x in result["cases"]], [2, 2, 2])
        self.assertEqual(len(result["cases"][0]["rejected_attempts"]), 1)
        self.assertIn("currently allowed IDs",
                      requests[2]["data"]["messages"][-1]["content"])
        self.assertNotIn("raw_content",
                         result["cases"][0]["rejected_attempts"][0])

    def test_second_invalid_action_fails_contract(self):
        client, _ = self.client(always_invalid=True)
        result = compat.run_check("qwen3.5-9b", "http://127.0.0.1:11434",
                                  client=client)
        self.assertEqual(result["status"], "action_contract_failed")
        self.assertFalse(result["all_structurally_valid"])
        self.assertEqual(result["model_requests"], 6)
        self.assertTrue(all(len(c["rejected_attempts"]) == 2
                            for c in result["cases"]))

    def test_synthetic_wrong_target_is_warning_not_parser_failure(self):
        client, _ = self.client(semantic_miss=True)
        result = compat.run_check("qwen3.5-9b", "http://127.0.0.1:11434",
                                  client=client)
        self.assertEqual(result["status"], "action_contract_pass")
        self.assertTrue(result["all_structurally_valid"])
        self.assertFalse(result["all_synthetic_actions_correct"])

    def test_optional_probe_menu_diagnostic_observes_two_real_candidates(self):
        client, _ = self.client(offer_probes=True)
        result = compat.run_check("qwen3.5-9b", "http://127.0.0.1:11434",
                                  client=client)
        self.assertEqual(result["status"], "action_contract_pass")
        self.assertTrue(result["synthetic_probe_menu_demonstrated"])
        self.assertEqual(result["cases"][2]["probe_candidates"], 2)
        self.assertTrue(result["cases"][2]["probe_opportunity"])

    def test_digest_missing_fails_before_model_chat(self):
        client, requests = self.client(digest=False)
        with self.assertRaisesRegex(RuntimeError, "digest"):
            compat.run_check("qwen3.5-9b", "http://127.0.0.1:11434", client=client)
        self.assertEqual(len(requests), 1)

    def test_unsafe_nonlocal_ollama_origin_rejected(self):
        client, requests = self.client()
        with self.assertRaises(ValueError):
            compat.run_check("qwen3.5-9b", "http://remote-host:11434", client=client)
        self.assertEqual(len(requests), 0)


if __name__ == "__main__":
    unittest.main()
