"""Offline matched-run simulations: paired isolation and official-action parity."""
from argparse import Namespace
import copy
from contextlib import contextmanager
from dataclasses import dataclass
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1] / "scripts/browsergym"
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location("matched_dev", HERE / "matched_dev.py")
matched = importlib.util.module_from_spec(spec)
sys.modules["matched_dev"] = matched
spec.loader.exec_module(matched)


def args():
    return Namespace(openapps_dir="/fake/OpenApps", ollama_url="http://127.0.0.1:11434",
                     model_label="qwen3.5-9b", task="add_call_mom_to_my_todo",
                     seed=233, max_steps=10, model_timeout=180)


def identity():
    return {"label": "qwen3.5-9b", "name": "qwen3.5:9b-q4_K_M",
            "digest": "sha256:fixed", "ollama_url": "http://127.0.0.1:11434"}


@dataclass
class Server:
    url: str
    database_dir: str
    logs_dir: str = "/tmp/log"
    server_log: str = "/tmp/log"
    pid: int = 1
    job_id: int = 100


class PairTests(unittest.TestCase):
    def test_pair_order_is_deterministic_and_both_methods_present(self):
        a = matched.pair_order("example_task", "qwen3.5-9b", 233)
        self.assertEqual(a, matched.pair_order("example_task", "qwen3.5-9b", 233))
        self.assertEqual(set(a), set(matched.METHODS))

    def test_all_four_labels_resolve_exact_names_and_digests(self):
        models = json.loads(matched.MODELS_FILE.read_text(encoding="utf-8"))
        self.assertEqual(len(models), 4)
        for model in models:
            def fake_client(url, timeout):
                self.assertTrue(url.endswith("/api/tags"))
                return {"models": [{"name": model["name"], "digest": "sha256:fixed"}]}
            self.assertEqual(matched.model_identity(model["label"],
                                                    "http://127.0.0.1:11434",
                                                    fake_client)["digest"], "sha256:fixed")
        def bad_client(url, timeout):
            return {"models": [{"name": models[0]["name"], "digest": ""}]}
        with self.assertRaisesRegex(RuntimeError, "digest"):
            matched.model_identity(models[0]["label"], "http://127.0.0.1:11434",
                                   bad_client)

    def test_parity_pass_and_fail_closed_if_mismatched(self):
        @contextmanager
        def server(root, directory):
            method = directory.parent.name
            yield Server(url=f"http://127.0.0.1:{15001 if method == 'Baseline' else 15101}",
                         database_dir=method + "/databases")

        def perform(second_mismatch=False):
            with tempfile.TemporaryDirectory() as folder:
                base = Path(folder)
                report = {"artifact_dir": str(base), "episodes": {}}
                def run_fake(root, server, method, identity, parameters, destination, expected):
                    destination.mkdir(parents=True)
                    fake_hash = "OTHER" if method == "Proposed" and second_mismatch else "START"
                    record = {"valid": True, "status": "development_success",
                              "official_reward": 1.0, "official_success": True,
                              "steps": 4, "model_calls": 4, "probe_opportunities": 0,
                              "invalid_model_actions": 0, "repair_requests": 0,
                              "repaired_steps": 0,
                              "policy_overrides": 0, "end_reason": "official_success",
                              "initial_sha256": fake_hash, "trace": []}
                    (destination / "episode.json").write_text(json.dumps(record))
                    return record
                with (patch.object(matched, "model_identity", return_value=identity()),
                      patch.object(matched, "isolated_openapps", side_effect=server),
                      patch.object(matched, "run_episode", side_effect=run_fake),
                      patch.object(matched, "pair_order", return_value=["Baseline", "Proposed"])):
                    if second_mismatch:
                        with self.assertRaisesRegex(RuntimeError, "parity"):
                            matched.run_pair(args(), report)
                    else:
                        matched.run_pair(args(), report)
                        self.assertEqual(report["status"], "paired_development_completed")
                        self.assertTrue(report["initial_hash_parity"])
                        self.assertEqual(set(report["episodes"]), set(matched.METHODS))
                        self.assertEqual(report["policy_diagnostics"]["comparable_probe_decisions"], 0)
        perform()
        perform(True)

    def test_comparable_decisions_only_count_identical_observations(self):
        def item(obs, choice):
            return {"observation_sha256": obs, "probe_opportunity": True,
                    "candidate_probes": [{"bid": "1"}, {"bid": "2"}],
                    "action": choice}
        examples = {
            "Baseline": {"trace": [item("A", 'click("1")'), item("B", 'click("1")')]},
            "Proposed": {"trace": [item("A", 'click("2")'), item("C", 'click("2")')]},
        }
        d = matched.comparable_decisions(examples)
        self.assertEqual(d["comparable_probe_decisions"], 1)
        self.assertEqual(d["policy_action_divergences"], 1)
        self.assertTrue(d["treatment_separation_observed"])


class FakeBrowserGym:
    def __init__(self):
        self.state = {"todo": [{"id": 1, "title": "Water plants", "done": False}],
                      "calendar": [], "map": [], "messenger": [], "openbanking": {}}
        self.url = "http://127.0.0.1:15001"
        self.field = ""
        self.unwrapped = self
        self.task = types.SimpleNamespace(initial_state=copy.deepcopy(self.state),
                                          reward=self.reward)
        self.commands = []
        self.closed = False

    def reward(self):
        return 1.0 if any(t["title"] == "Call Mom" for t in self.state["todo"]) else 0.0

    def observation(self):
        if self.url.endswith("/todo"):
            nodes = [
                {"browsergym_id": "21", "role": {"value": "textbox"},
                 "name": {"value": "New Todo"}, "value": {"value": self.field}},
                {"browsergym_id": "22", "role": {"value": "button"},
                 "name": {"value": "Add"}},
            ]
        else:
            nodes = [{"browsergym_id": "40", "role": {"value": "link"},
                      "name": {"value": "OpenTodos"}}]
        return {"goal": "Add Call Mom to my todo", "url": self.url,
                "axtree_object": {"nodes": nodes}, "last_action_error": ""}

    def reset(self, seed):
        return self.observation(), {}

    def step(self, action):
        self.commands.append(action)
        if action == 'click("40")':
            self.url += "/todo"
        elif action == 'fill("21", "Call Mom")':
            self.field = "Call Mom"
        elif action == 'click("22")' and self.field:
            self.state["todo"].append({"id": 2, "title": self.field, "done": False})
        else:
            raise RuntimeError("Fake BrowserGym unexpected action: " + action)
        reward = self.reward()
        return self.observation(), reward, reward >= 1.0, False, {}

    def close(self):
        self.closed = True


class EpisodeTests(unittest.TestCase):
    def run_fake_episode(self, method, *, first_invalid=False, invalid_forever=False):
        fake = FakeBrowserGym()
        server = Server(url=fake.url, database_dir="/fake/db")

        class EnvArgs:
            def make_env(self, action_mapping, exp_dir):
                self.mapping = action_mapping
                self.exp_dir = exp_dir
                return fake

        responses = [json.dumps({"action": "click", "bid": "40"}),
                     json.dumps({"action": "fill", "bid": "21", "text": "Call Mom"}),
                     json.dumps({"action": "click", "bid": "22"})]
        if first_invalid:
            responses.insert(0, json.dumps({"action": "click", "bid": "999"}))
        if invalid_forever:
            responses = [
                json.dumps({"action": "click", "bid": "999"}),
                json.dumps({"action": "click", "bid": "998"}),
            ]
        replies = iter([{"message": {"content": raw}} for raw in responses])
        model_requests = []
        def fake_model_request(url, data, timeout):
            model_requests.append(copy.deepcopy(data))
            return next(replies)
        def tree(obs):
            return "\n".join(
                f"[{n['browsergym_id']}] {n['role']['value']} {n['name']['value']}"
                for n in obs["axtree_object"]["nodes"]
            )
        # Only mock unavailable external packages. Shared planning, guard,
        # hashes, trace, and independent evaluator assertions remain real.
        highlevel = types.ModuleType("browsergym.core.action.highlevel")
        class ActionSet:
            def __init__(self, subsets, strict, multiaction):
                self.to_python_code = object()
                self.subsets = subsets
        highlevel.HighLevelActionSet = ActionSet
        packages = {}
        for name in ("browsergym", "browsergym.core", "browsergym.core.action",
                     "open_apps"):
            module = types.ModuleType(name)
            module.__path__ = []
            packages[name] = module
        state = types.ModuleType("open_apps.state")
        state.get_current_state = lambda _: copy.deepcopy(fake.state)
        with tempfile.TemporaryDirectory() as folder:
            destination = Path(folder) / "episode"
            with (patch.dict(sys.modules, {**packages,
                                           "browsergym.core.action.highlevel": highlevel,
                                           "open_apps.state": state}),
                  patch.object(matched, "build_env_args", return_value=(EnvArgs(), None)),
                  patch.object(matched, "require_state"),
                  patch.object(matched, "extract_axtree_text", side_effect=tree),
                  patch.object(matched, "request_json", side_effect=fake_model_request)):
                result = matched.run_episode(
                    Path(folder), server, method, identity(), args(), destination, None,
                )
            saved = json.loads((destination / "episode.json").read_text())
        self.assertEqual(saved["model_prompt_policy"], "shared_identical_for_both_methods")
        if invalid_forever:
            self.assertFalse(saved["valid"])
            self.assertIsNone(saved["official_success"])
            self.assertEqual(saved["status"], "invalid_agent_episode")
            self.assertEqual(saved["end_reason"], "agent_output_invalid")
            self.assertEqual(saved["official_reward"], 0.0)
            self.assertEqual(saved["steps"], 0)
            self.assertEqual(saved["model_calls"], 2)
            self.assertEqual(saved["invalid_model_actions"], 2)
            self.assertEqual(saved["repair_requests"], 1)
            self.assertEqual(saved["repaired_steps"], 0)
            self.assertEqual(fake.commands, [])
            self.assertEqual(saved["initial_sha256"], saved["final_sha256"])
            self.assertEqual(
                [a["attempted_bid"] for a in saved["trace"][0]["invalid_attempts"]],
                ["999", "998"],
            )
            self.assertTrue(fake.closed)
            return result
        self.assertEqual(saved["invalid_model_actions"], int(first_invalid))
        self.assertEqual(saved["repair_requests"], int(first_invalid))
        self.assertEqual(saved["repaired_steps"], int(first_invalid))
        self.assertEqual(saved["model_calls"], 4 if first_invalid else 3)
        if first_invalid:
            # Repair is a second model call on the SAME observation, not an
            # extra browser action or hidden evaluator feedback.
            correction = model_requests[1]["messages"][-1]
            self.assertEqual(correction["role"], "user")
            self.assertIn("currently allowed IDs", correction["content"])
            self.assertIn("40", correction["content"])
            self.assertEqual(model_requests[0]["messages"][0],
                             model_requests[1]["messages"][0])
            self.assertEqual(saved["trace"][0]["invalid_attempts"][0]["attempted_bid"], "999")
            self.assertTrue(saved["trace"][0]["repair_used"])
            self.assertNotIn("raw_content", saved["trace"][0]["invalid_attempts"][0])
        self.assertTrue(saved["valid"], saved.get("error"))
        self.assertTrue(saved["official_success"])
        self.assertEqual(saved["official_reward"], 1.0)
        self.assertEqual(saved["steps"], 3)
        self.assertEqual(saved["probe_opportunities"], 0)
        self.assertEqual(fake.commands, ['click("40")', 'fill("21", "Call Mom")', 'click("22")'])
        self.assertTrue(fake.closed)
        return result

    def test_baseline_end_to_end_fake_browsergym(self):
        self.run_fake_episode("Baseline")

    def test_proposed_end_to_end_fake_browsergym(self):
        self.run_fake_episode("Proposed")

    def test_unobserved_bid_repairs_for_both_methods(self):
        for method in matched.METHODS:
            with self.subTest(method=method):
                self.run_fake_episode(method, first_invalid=True)

    def test_second_invalid_bid_fails_closed_without_browser_actions(self):
        for method in matched.METHODS:
            with self.subTest(method=method):
                self.run_fake_episode(method, invalid_forever=True)


if __name__ == "__main__":
    unittest.main()
