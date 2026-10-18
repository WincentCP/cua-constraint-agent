import importlib.util
from pathlib import Path
import unittest
from tempfile import TemporaryDirectory

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
        self.assertIn('env.step("pass")', text)
        self.assertNotIn("1078.81", text)

    def test_raw_browsergym_observation_uses_official_tree_formatter(self):
        obs = {"axtree_object": {"nodes": [{"role": {"value": "RootWebArea"}}]},
               "last_action_error": "", "url": "http://127.0.0.1:5001"}
        seen = []
        def fake_browsergym_formatter(tree):
            seen.append(tree)
            return '- RootWebArea "OpenApps"'
        result = mod.extract_axtree_text(obs, flatten=fake_browsergym_formatter)
        self.assertIn("OpenApps", result)
        self.assertIs(seen[0], obs["axtree_object"])

    def test_raw_observation_missing_tree_reports_keys(self):
        with self.assertRaisesRegex(RuntimeError, "observed keys: url"):
            mod.extract_axtree_text({"url": "http://127.0.0.1:5001"},
                                    flatten=lambda _: "must not run")
        with self.assertRaisesRegex(RuntimeError, "empty text"):
            mod.extract_axtree_text({"axtree_object": {"nodes": [{}]}},
                                    flatten=lambda _: "")

    def test_make_env_explicit_browsergym_arguments(self):
        class FakeEnvArgs:
            def make_env(self, action_mapping, exp_dir):
                assert action_mapping is None
                assert exp_dir.is_dir()
                return {"mapping": action_mapping, "path": exp_dir}

        with TemporaryDirectory() as tmp:
            p = Path(tmp) / "episode"
            env = mod.make_smoke_env(FakeEnvArgs(), p)
            self.assertEqual(env["path"], p)
            self.assertTrue(p.is_dir())

    def test_browsergym_action_error_rejected_even_with_reward(self):
        mod.validate_noop_step({"last_action_error": ""}, 0.0)
        with self.assertRaisesRegex(RuntimeError, "BrowserGym action failed"):
            mod.validate_noop_step({"last_action_error": "NameError: noop"}, 0.0)
        with self.assertRaisesRegex(RuntimeError, "Invalid official evaluator"):
            mod.validate_noop_step({"last_action_error": ""}, -1)


if __name__ == "__main__":
    unittest.main()
