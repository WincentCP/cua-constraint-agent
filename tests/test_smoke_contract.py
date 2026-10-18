import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "scripts/browsergym/smoke.py"
s = importlib.util.spec_from_file_location("bgsmoke", p)
mod = importlib.util.module_from_spec(s)
s.loader.exec_module(mod)


class TestContract(unittest.TestCase):
    def test_url_restriction(self):
        self.assertEqual(mod.validate_url("http://127.0.0.1:5001/"),
                         "http://127.0.0.1:5001")
        for bad in ("https://example.com", "http://192.168.1.1:5001",
                    "http://localhost", "http://localhost:5001/other",
                    "http://localhost:5001?x=1"):
            with self.assertRaises(ValueError):
                mod.validate_url(bad)

    def test_state_digest(self):
        self.assertEqual(mod.hash_state({"b": 1, "a": 2}),
                         mod.hash_state({"a": 2, "b": 1}))

    def test_public_official_integration_only(self):
        text = p.read_text(encoding="utf-8")
        self.assertIn("register_tasks_with_browsergym([task])", text)
        self.assertIn('env.step("noop()")', text)
        self.assertNotIn("1078.81", text)


if __name__ == "__main__":
    unittest.main()
