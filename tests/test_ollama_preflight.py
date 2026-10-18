import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "ollama_preflight", ROOT / "scripts/browsergym/ollama_preflight.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class OllamaPreflightContract(unittest.TestCase):
    def test_local_url_only(self):
        self.assertEqual(mod.validate_ollama_url("http://localhost:11434/"),
                         "http://localhost:11434")
        for value in ("https://example.com:11434", "http://10.0.0.5:11434",
                      "http://localhost:11434/api/generate",
                      "http://localhost", "file:///etc/hosts"):
            with self.assertRaises(ValueError):
                mod.validate_ollama_url(value)

    def test_exact_model_label_and_tag(self):
        cfg = json.loads((ROOT / "config/models.json").read_text(encoding="utf-8"))
        target = mod.get_model(cfg, "qwen3.5-9b")
        result = mod.find_installed_model(
            {"models": [{"name": target, "digest": "sha256:abc"}]}, target)
        self.assertEqual(result["digest"], "sha256:abc")
        with self.assertRaises(LookupError):
            mod.find_installed_model({"models": [{"name": "qwen3.5:latest"}]}, target)
        with self.assertRaises(ValueError):
            mod.get_model(cfg, "nonexistent")

    def test_response_must_be_structured_json(self):
        self.assertTrue(mod.validate_structured_reply(
            {"message": {"content": '{"ready": true}'}}))
        for payload in ({"message": {"content": ""}},
                        {"message": {"content": "ready"}},
                        {"message": {"content": '{"ready":false}'}}):
            with self.assertRaises(ValueError):
                mod.validate_structured_reply(payload)

    def test_thinking_only_response_has_bounded_diagnostic(self):
        with self.assertRaisesRegex(ValueError, "thinking_characters") as ctx:
            mod.validate_structured_reply({
                "message": {"content": "", "thinking": "private reasoning text"},
                "done_reason": "length", "eval_count": 80
            })
        msg = str(ctx.exception)
        self.assertIn('"done_reason": "length"', msg)
        self.assertIn('"eval_count": 80', msg)
        self.assertNotIn("private reasoning", msg)

    def test_probe_no_browser_and_stores_digest(self):
        expected_model = "qwen3.5:9b-q4_K_M"
        calls = []
        def fake_client(url, data=None, timeout=0):
            calls.append((url, data, timeout))
            if url.endswith("/api/tags"):
                return {"models": [{"name": expected_model, "digest": "sha256:abc"}]}
            if url.endswith("/api/chat"):
                self.assertEqual(data["model"], expected_model)
                self.assertEqual(data["options"]["temperature"], 0)
                self.assertIs(data["think"], False)
                self.assertEqual(data["options"]["num_predict"], 256)
                self.assertNotIn("think", data["options"])
                self.assertFalse(data["stream"])
                return {"message": {"content": '{"ready":true}'}}
            raise AssertionError("Unexpected request")

        result = mod.probe(expected_model, "http://127.0.0.1:11434",
                           client=fake_client)
        self.assertTrue(result["chat_verified"])
        self.assertEqual(result["model_digest"], "sha256:abc")
        self.assertEqual(len(calls), 2)

    def test_tags_only_skips_model_inference(self):
        def fake_client(url, data=None, timeout=0):
            if url.endswith("/api/chat"):
                raise AssertionError("No inference allowed")
            return {"models": [{"name": "granite4.1:8b-q4_K_M", "digest": "abc"}]}
        result = mod.probe("granite4.1:8b-q4_K_M",
                           "http://localhost:11434", do_chat=False, client=fake_client)
        self.assertFalse(result["chat_verified"])


if __name__ == "__main__":
    unittest.main()
