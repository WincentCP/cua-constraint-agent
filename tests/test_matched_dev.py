"""Offline matched-run simulations: paired isolation and official-action parity."""
from argparse import Namespace
import copy
from contextlib import contextmanager, nullcontext
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
import action_timeout
spec = importlib.util.spec_from_file_location("matched_dev", HERE / "matched_dev.py")
matched = importlib.util.module_from_spec(spec)
sys.modules["matched_dev"] = matched
spec.loader.exec_module(matched)


def args():
    return Namespace(openapps_dir="/fake/OpenApps", ollama_url="http://127.0.0.1:11434",
                     model_label="qwen3.5-9b", task="add_call_mom_to_my_todo",
                     task_group="all_tasks",
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

    def test_model_digest_rechecked_and_fail_closed_on_change(self):
        def good_client(url, timeout):
            self.assertEqual(url, "http://127.0.0.1:11434/api/tags")
            return {"models": [{
                "name": "qwen3.5:9b-q4_K_M", "digest": "sha256:fixed"
            }]}
        self.assertIsNone(matched.verify_model_identity(identity(), good_client))
        def drifted_client(url, timeout):
            return {"models": [{
                "name": "qwen3.5:9b-q4_K_M", "digest": "sha256:drifted"
            }]}
        with self.assertRaisesRegex(RuntimeError, "digest changed"):
            matched.verify_model_identity(identity(), drifted_client)

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
                              "steps": 4, "model_calls": 4,
                              "max_prompt_eval_tokens": None,
                              "probe_opportunities": 0,
                              "invalid_model_actions": 0, "repair_requests": 0,
                              "repaired_steps": 0,
                              "policy_overrides": 0, "end_reason": "official_success",
                              "initial_sha256": fake_hash, "trace": []}
                    (destination / "episode.json").write_text(json.dumps(record))
                    return record
                with (patch.object(matched, "model_identity", return_value=identity()),
                      patch.object(matched, "verify_model_identity"),
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
                        self.assertEqual(report["mechanism_status"], "no_probe_candidates")
                        self.assertEqual(set(report["episodes"]), set(matched.METHODS))
                        self.assertEqual(report["policy_diagnostics"]["comparable_probe_decisions"], 0)
        perform()
        perform(True)

    def test_hydra_selects_correct_standalone_official_task_group(self):
        """OpenBanking YAML is NOT included in the upstream all_tasks group."""
        from types import SimpleNamespace
        task_key = "add_todo_to_review_largest_card_charge"
        task_config = object()
        task = SimpleNamespace(task_id="dev-test-openbanking-task")
        composed = []
        registered = []

        hydra = types.ModuleType("hydra")
        hydra.__path__ = []
        utils = types.ModuleType("hydra.utils")
        hydra.initialize_config_dir = lambda **kw: nullcontext()
        def fake_compose(config_name, overrides):
            composed.append((config_name, overrides))
            group = next((x.split("=", 1)[1] for x in overrides
                          if x.startswith("tasks=")), "all_tasks")
            task_configs = {task_key: task_config} if group == "openbanking" else {}
            return SimpleNamespace(
                tasks=task_configs,
                browsergym_env_args=SimpleNamespace(
                    task_name="", task_kwargs=SimpleNamespace(base_url=None),
                    max_steps=0,
                ),
            )
        hydra.compose = fake_compose
        def fake_instantiate(config):
            return task if config is task_config else config
        utils.instantiate = fake_instantiate
        registry = types.ModuleType("open_apps.tasks.add_tasks_to_browsergym")
        registry.register_tasks_with_browsergym = (
            lambda tasks: registered.append(tasks)
        )
        packages = {}
        for name in ("open_apps", "open_apps.tasks"):
            module = types.ModuleType(name)
            module.__path__ = []
            packages[name] = module

        fake_modules = {**packages, "hydra": hydra, "hydra.utils": utils,
                        "open_apps.tasks.add_tasks_to_browsergym": registry}
        with (patch.dict(sys.modules, fake_modules),
              patch.object(matched.os, "chdir")):
            args_, selected = matched.build_env_args(
                Path("/fake/OpenApps"), "http://127.0.0.1:5011",
                task_key, 20, "openbanking",
            )
            self.assertIs(selected, task)
            self.assertEqual(args_.task_name, task.task_id)
            self.assertEqual(args_.task_kwargs.base_url, "http://127.0.0.1:5011")
            self.assertEqual(args_.max_steps, 20)
            self.assertEqual(registered, [[task]])
            self.assertIn("tasks=openbanking", composed[0][1])
            with self.assertRaisesRegex(ValueError, "tasks=all_tasks"):
                matched.build_env_args(
                    Path("/fake/OpenApps"), "http://127.0.0.1:5011",
                    task_key, 20, "all_tasks",
                )
            with self.assertRaisesRegex(ValueError, "Unsupported"):
                matched.build_env_args(
                    Path("/fake/OpenApps"), "http://127.0.0.1:5011",
                    task_key, 20, "nonexistent_group",
                )

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
        self.timeout_on_add = False
        self.timeout_modal_on_add = False

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
        if self.timeout_on_add and action == 'click("22")':
            # This is an attempted browser action, but not an official
            # successful application interaction. Never retry it blindly.
            observation = self.observation()
            observation["last_action_error"] = (
                "TimeoutError: Locator.click: Timeout 3000ms exceeded.\n"
                "Call log: waiting for get_by_test_id('22')"
                + ('\n<dialog open="" bid="141"></dialog> intercepts pointer events'
                   if self.timeout_modal_on_add else "")
            )
            return observation, 0.0, False, False, {"action_exec_timeout": 3.0}
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


class FakeBankBrowserGym(FakeBrowserGym):
    """Simulate actual OpenApps dock reappearing on the bank account index."""
    def __init__(self):
        super().__init__()
        self.state = {"todo": [], "openbanking": {}, "calendar": [],
                      "map": [], "messenger": []}
        self.task.initial_state = copy.deepcopy(self.state)

    def observation(self):
        if self.url.endswith("/openbanking"):
            nodes = [
                {"nodeId": "dock", "browsergym_id": "96",
                 "role": {"value": "link"}, "name": {"value": "OpenBanking"}},
                {"nodeId": "account-row", "browsergym_id": "111",
                 "role": {"value": "generic"}, "name": {"value": ""},
                 "childIds": ["account-label"]},
                {"nodeId": "account-label", "role": {"value": "StaticText"},
                 "name": {"value": "BUS COMPLETE CHK (...5555)"}},
            ]
            extra = {"111": {"clickable": True, "visibility": 1.0}}
        elif self.url.endswith("/openbanking/accounts/0"):
            nodes = [{"browsergym_id": "41", "role": {"value": "link"},
                      "name": {"value": "Back to accounts"}}]
            extra = {}
        else:
            nodes = [{"browsergym_id": "64", "role": {"value": "link"},
                      "name": {"value": "OpenBanking"}}]
            extra = {}
        return {"goal": "Find the largest Card charge; then add a todo",
                "url": self.url, "axtree_object": {"nodes": nodes},
                "extra_element_properties": extra, "last_action_error": ""}

    def step(self, action):
        self.commands.append(action)
        if action == 'click("64")' and self.url.endswith(":15001"):
            self.url += "/openbanking"
        elif action == 'click("111")' and self.url.endswith("/openbanking"):
            self.url += "/accounts/0"
        else:
            raise RuntimeError("Unexpected simulated bank action: " + action)
        return self.observation(), 0.0, False, False, {}


class FakeModalBankBrowserGym(FakeBankBrowserGym):
    """Simulated public AXTree dialog blocking clicks behind the UI overlay."""
    def __init__(self):
        super().__init__()
        self.dialog_open = False

    def observation(self):
        if self.url.endswith("/openbanking"):
            nodes = [
                {"nodeId": "cta", "browsergym_id": "20",
                 "role": {"value": "button"}, "name": {"value": "Open an account"}},
                {"nodeId": "account", "browsergym_id": "111",
                 "role": {"value": "generic"}, "name": {"value": ""},
                 "childIds": ["account-label"]},
                {"nodeId": "account-label", "role": {"value": "StaticText"},
                 "name": {"value": "Business Checking (...5555)"}},
            ]
            if self.dialog_open:
                nodes.extend([
                    {"nodeId": "dlg", "browsergym_id": "141",
                     "role": {"value": "dialog"},
                     "name": {"value": "Open an account"},
                     "childIds": ["article"]},
                    {"nodeId": "article", "role": {"value": "generic"},
                     "childIds": ["header", "footer"]},
                    {"nodeId": "header", "role": {"value": "StaticText"},
                     "name": {"value": "Call our customer service line"}},
                    {"nodeId": "footer", "role": {"value": "generic"},
                     "childIds": ["close"]},
                    {"nodeId": "close", "browsergym_id": "142",
                     "role": {"value": "button"},
                     "name": {"value": "Close"}},
                ])
            return {
                "goal": "Find largest Card charge; then add a todo",
                "url": self.url, "axtree_object": {"nodes": nodes},
                "extra_element_properties": {
                    "20": {"clickable": True, "visibility": 1.0},
                    "111": {"clickable": True, "visibility": 1.0},
                    "141": {"visibility": 1.0},
                    "142": {"clickable": True, "visibility": 1.0},
                },
                "last_action_error": "",
            }
        return super().observation()

    def step(self, action):
        self.commands.append(action)
        if action == 'click("64")' and self.url.endswith(":15001"):
            self.url += "/openbanking"
        elif action == 'click("20")' and self.url.endswith("/openbanking") and not self.dialog_open:
            self.dialog_open = True
        elif action == 'click("142")' and self.dialog_open:
            self.dialog_open = False
        elif action == 'click("111")' and not self.dialog_open and self.url.endswith("/openbanking"):
            self.url += "/accounts/0"
        else:
            raise RuntimeError("Unexpected simulated dialog action: " + action)
        return self.observation(), 0.0, False, False, {}


class EpisodeTests(unittest.TestCase):
    def run_fake_episode(self, method, *, first_invalid=False,
                         invalid_forever=False, bank_loop=False,
                         early_submit=False, guard_forever=False,
                         dock_forever=False, browser_timeout=False,
                         modal_repair=False, modal_forever=False,
                         browser_modal_timeout=False):
        fake = (
            FakeModalBankBrowserGym() if (modal_repair or modal_forever)
            else FakeBankBrowserGym() if bank_loop or dock_forever
            else FakeBrowserGym()
        )
        fake.timeout_on_add = browser_timeout or browser_modal_timeout
        fake.timeout_modal_on_add = browser_modal_timeout
        server = Server(url=fake.url, database_dir="/fake/db")

        class EnvArgs:
            def make_env(self, action_mapping, exp_dir):
                self.mapping = action_mapping
                self.exp_dir = exp_dir
                mapped = action_mapping('click("40")')
                self.assert_timeout_adapter = "timeout=3000" in mapped
                if not self.assert_timeout_adapter:
                    raise AssertionError("Expected validated shared bounded click mapping")
                return fake

        responses = [json.dumps({"action": "click", "bid": "40"}),
                     json.dumps({"action": "fill", "bid": "21", "text": "Call Mom"}),
                     json.dumps({"action": "click", "bid": "22"})]
        if bank_loop:
            responses = [
                json.dumps({"action": "click", "bid": "64"}),
                json.dumps({"action": "click", "bid": "96"}),
                json.dumps({"action": "click", "bid": "111"}),
                json.dumps({"action": "finish"}),
            ]
        if modal_repair:
            responses = [
                json.dumps({"action": "click", "bid": "64"}),
                json.dumps({"action": "click", "bid": "20"}),
                json.dumps({"action": "click", "bid": "20"}),
                json.dumps({"action": "click", "bid": "142"}),
                json.dumps({"action": "click", "bid": "111"}),
                json.dumps({"action": "finish"}),
            ]
        if modal_forever:
            responses = [
                json.dumps({"action": "click", "bid": "64"}),
                json.dumps({"action": "click", "bid": "20"}),
                json.dumps({"action": "click", "bid": "20"}),
                json.dumps({"action": "click", "bid": "20"}),
            ]
        if early_submit:
            responses = [
                json.dumps({"action": "click", "bid": "40"}),
                json.dumps({"action": "click", "bid": "22"}),
                json.dumps({"action": "fill", "bid": "21", "text": "Call Mom"}),
                json.dumps({"action": "click", "bid": "22"}),
            ]
        if guard_forever:
            responses = [
                json.dumps({"action": "click", "bid": "40"}),
                json.dumps({"action": "click", "bid": "22"}),
                json.dumps({"action": "click", "bid": "22"}),
            ]
        if dock_forever:
            responses = [
                json.dumps({"action": "click", "bid": "64"}),
                json.dumps({"action": "click", "bid": "96"}),
                json.dumps({"action": "click", "bid": "96"}),
            ]
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
                if n.get("browsergym_id") is not None
            )
        # Only mock unavailable external packages. Shared planning, guard,
        # hashes, trace, and independent evaluator assertions remain real.
        highlevel = types.ModuleType("browsergym.core.action.highlevel")
        class ActionSet:
            def __init__(self, subsets, strict, multiaction, retry_with_force=False):
                self.subsets = subsets
                self.python_includes = (
                    "retry_with_force=False\n"
                    "def fill(bid, value):\n"
                    "    elem.fill(value, timeout=500)\n\n"
                    "def click(bid):\n"
                    "    def do(force):\n"
                    "        elem.click(button=button, modifiers=modifiers, "
                    "force=force, timeout=500)\n"
                    "    call_fun(do, retry_with_force)\n\n"
                    "def dblclick(bid):\n"
                    "    elem.click(button=button, modifiers=modifiers, "
                    "force=False, timeout=500)\n"
                )
            def to_python_code(self, action):
                return self.python_includes + "\n" + action
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
                  patch.object(matched, "request_json", side_effect=fake_model_request),
                  patch.object(action_timeout, "distribution_version",
                               return_value="0.13.4")):
                result = matched.run_episode(
                    Path(folder), server, method, identity(), args(), destination, None,
                )
            saved = json.loads((destination / "episode.json").read_text())
        self.assertEqual(saved["model_prompt_policy"], "shared_identical_for_both_methods")
        self.assertGreater(saved["model_input_characters"], 0)
        self.assertIsNone(saved["max_prompt_eval_tokens"])
        self.assertEqual(saved["browsergym_core_version"], "0.13.4")
        self.assertEqual(saved["bid_click_timeout_ms"], 3000)
        self.assertFalse(saved["click_force_retry"])
        if browser_modal_timeout:
            self.assertFalse(saved["valid"])
            self.assertIsNone(saved["official_success"])
            self.assertEqual(saved["end_reason"], "browser_action_occluded_by_dialog")
            self.assertEqual(saved["status"], "invalid_episode")
            self.assertEqual(saved["trace"][-1]["browser_error_category"],
                             "browser_action_occluded_by_dialog")
            self.assertIn("intercepts pointer events",
                          saved["trace"][-1]["browser_error"])
            self.assertEqual(saved["model_calls"], 3)
            self.assertEqual(fake.commands, [
                'click("40")', 'fill("21", "Call Mom")', 'click("22")'
            ])
            self.assertTrue(fake.closed)
            return result
        if modal_repair:
            self.assertTrue(saved["valid"], saved.get("error"))
            self.assertEqual(saved["status"], "development_unsuccessful")
            self.assertEqual(saved["steps"], 4)
            self.assertEqual(saved["model_calls"], 6)
            self.assertEqual(saved["repair_requests"], 1)
            self.assertEqual(saved["repaired_steps"], 1)
            self.assertEqual(saved["invalid_model_actions"], 1)
            self.assertEqual(fake.commands, [
                'click("64")', 'click("20")', 'click("142")', 'click("111")'
            ])
            self.assertIn("dialog_blocks_background_action",
                          saved["trace"][2]["invalid_attempts"][0]["error"])
            self.assertEqual(saved["trace"][2]["action"], 'click("142")')
            self.assertEqual(saved["trace"][2]["active_dialog"]["dialog_bid"], "141")
            self.assertEqual(
                model_requests[2]["messages"][1],
                model_requests[3]["messages"][1],
            )
            self.assertIn("dialog", model_requests[3]["messages"][-1]["content"])
            self.assertEqual(saved["probe_opportunities"], 0)
            self.assertTrue(fake.closed)
            return result
        if modal_forever:
            self.assertTrue(saved["valid"], saved.get("error"))
            self.assertFalse(saved["official_success"])
            self.assertEqual(saved["end_reason"], "safety_guard_blocked")
            self.assertEqual(saved["steps"], 2)
            self.assertEqual(saved["model_calls"], 4)
            self.assertEqual(saved["repair_requests"], 1)
            self.assertEqual(saved["repaired_steps"], 0)
            self.assertEqual(saved["invalid_model_actions"], 2)
            self.assertEqual(fake.commands, ['click("64")', 'click("20")'])
            self.assertNotIn("action", saved["trace"][2])
            self.assertIn("dialog_blocks_background_action",
                          saved["trace"][2]["guard_blocked"])
            self.assertEqual(len(saved["trace"][2]["invalid_attempts"]), 2)
            self.assertTrue(fake.closed)
            return result
        if browser_timeout:
            self.assertFalse(saved["valid"])
            self.assertIsNone(saved["official_success"])
            self.assertEqual(saved["status"], "invalid_episode")
            self.assertFalse(saved["run_complete"])
            self.assertEqual(saved["end_reason"], "browser_action_timeout")
            self.assertEqual(saved["failure_stage"], "browsergym_action_execution")
            self.assertEqual(saved["failed_action"], 'click("22")')
            self.assertEqual(saved["trace"][-1]["browser_error_category"],
                             "browser_action_timeout")
            self.assertEqual(saved["trace"][-1]["browser_timeout_ms"], 3000)
            self.assertEqual(saved["trace"][-1]["browsergym_action_exec_timeout_s"], 3.0)
            self.assertEqual(saved["model_calls"], 3)
            self.assertEqual(saved["steps"], 3)
            self.assertEqual(fake.commands,
                             ['click("40")', 'fill("21", "Call Mom")',
                              'click("22")'])
            self.assertTrue(fake.closed)
            return result
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
        if early_submit:
            self.assertTrue(saved["valid"], saved.get("error"))
            self.assertTrue(saved["official_success"])
            self.assertEqual(saved["steps"], 3)
            self.assertEqual(saved["model_calls"], 4)
            self.assertEqual(saved["repair_requests"], 1)
            self.assertEqual(saved["repaired_steps"], 1)
            self.assertEqual(saved["invalid_model_actions"], 1)
            self.assertEqual(
                fake.commands, ['click("40")', 'fill("21", "Call Mom")',
                                'click("22")']
            )
            second = saved["trace"][1]
            self.assertIn("safety_guard_blocked: empty_todo_submission",
                          second["invalid_attempts"][0]["error"])
            self.assertEqual(second["action"], 'fill("21", "Call Mom")')
            self.assertTrue(second["repair_used"])
            self.assertEqual(len(second["model_telemetry"]), 2)
            self.assertEqual(model_requests[1]["messages"][1],
                             model_requests[2]["messages"][1])
            self.assertIn("empty_todo_submission",
                          model_requests[2]["messages"][-1]["content"])
            self.assertTrue(fake.closed)
            return result
        if guard_forever:
            self.assertTrue(saved["valid"], saved.get("error"))
            self.assertFalse(saved["official_success"])
            self.assertEqual(saved["status"], "development_unsuccessful")
            self.assertEqual(saved["end_reason"], "safety_guard_blocked")
            self.assertEqual(saved["steps"], 1)
            self.assertEqual(saved["model_calls"], 3)
            self.assertEqual(saved["invalid_model_actions"], 2)
            self.assertEqual(saved["repair_requests"], 1)
            self.assertEqual(saved["repaired_steps"], 0)
            self.assertEqual(fake.commands, ['click("40")'])
            self.assertIn("empty_todo_submission",
                          saved["trace"][1]["guard_blocked"])
            self.assertNotIn("action", saved["trace"][1])
            self.assertEqual(len(saved["trace"][1]["invalid_attempts"]), 2)
            self.assertTrue(fake.closed)
            return result
        if dock_forever:
            self.assertFalse(saved["valid"])
            self.assertIsNone(saved["official_success"])
            self.assertEqual(saved["status"], "invalid_agent_episode")
            self.assertEqual(saved["end_reason"], "agent_output_invalid")
            self.assertEqual(saved["steps"], 1)
            self.assertEqual(saved["model_calls"], 3)
            self.assertEqual(saved["invalid_model_actions"], 2)
            self.assertEqual(saved["repair_requests"], 1)
            self.assertEqual(saved["repaired_steps"], 0)
            self.assertEqual(fake.commands, ['click("64")'])
            self.assertEqual(len(saved["trace"][1]["invalid_attempts"]), 2)
            self.assertNotIn("action", saved["trace"][1])
            self.assertTrue(fake.closed)
            return result
        if bank_loop:
            self.assertTrue(saved["valid"], saved.get("error"))
            self.assertEqual(saved["status"], "development_unsuccessful")
            self.assertEqual(saved["steps"], 2)
            self.assertEqual(saved["model_calls"], 4)
            self.assertEqual(saved["repair_requests"], 1)
            self.assertEqual(saved["repaired_steps"], 1)
            self.assertEqual(fake.commands, ['click("64")', 'click("111")'])
            self.assertTrue(saved["trace"][0]["url_changed"])
            self.assertEqual(
                saved["trace"][0]["url_after"],
                "http://127.0.0.1:15001/openbanking",
            )
            self.assertEqual(
                saved["trace"][1]["url_after"],
                "http://127.0.0.1:15001/openbanking/accounts/0",
            )
            self.assertIn("redundant_current_app_link",
                          saved["trace"][1]["invalid_attempts"][0]["error"])
            self.assertEqual(
                saved["trace"][1]["public_clickable_hints"][0]["bid"], "111"
            )
            self.assertEqual(model_requests[1]["messages"][1],
                             model_requests[2]["messages"][1])
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
        self.assertEqual(
            len(saved["trace"][0]["model_telemetry"]),
            1 + int(first_invalid),
        )
        self.assertIn("axtree_truncated_for_model", saved["trace"][0])
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

    def test_same_app_dock_reclick_repaired_into_real_bank_account_for_both_policies(self):
        for method in matched.METHODS:
            with self.subTest(method=method):
                self.run_fake_episode(method, bank_loop=True)

    def test_guard_rejects_premature_add_and_repairs_with_public_fill(self):
        for method in matched.METHODS:
            with self.subTest(method=method):
                self.run_fake_episode(method, early_submit=True)

    def test_second_premature_add_stops_without_submitting_empty_todo(self):
        for method in matched.METHODS:
            with self.subTest(method=method):
                self.run_fake_episode(method, guard_forever=True)

    def test_second_dock_self_link_rejection_never_executes_stale_action(self):
        for method in matched.METHODS:
            with self.subTest(method=method):
                self.run_fake_episode(method, dock_forever=True)

    def test_open_dialog_background_click_is_repaired_into_close_for_both_methods(self):
        for method in matched.METHODS:
            with self.subTest(method=method):
                self.run_fake_episode(method, modal_repair=True)

    def test_open_dialog_rejected_twice_never_clicks_through_overlay(self):
        for method in matched.METHODS:
            with self.subTest(method=method):
                self.run_fake_episode(method, modal_forever=True)

    def test_dialog_interception_is_classified_as_invalid_not_model_failure(self):
        for method in matched.METHODS:
            with self.subTest(method=method):
                self.run_fake_episode(method, browser_modal_timeout=True)

    def test_action_timeout_is_invalid_without_automatic_duplicate_click(self):
        for method in matched.METHODS:
            with self.subTest(method=method):
                self.run_fake_episode(method, browser_timeout=True)

    def test_second_invalid_bid_fails_closed_without_browser_actions(self):
        for method in matched.METHODS:
            with self.subTest(method=method):
                self.run_fake_episode(method, invalid_forever=True)


if __name__ == "__main__":
    unittest.main()
