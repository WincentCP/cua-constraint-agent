"""Offline scientific-integrity contracts for the exploratory paired pilot."""
from __future__ import annotations

import copy
import csv
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1] / "scripts" / "browsergym"
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location("pilot", HERE / "pilot.py")
pilot = importlib.util.module_from_spec(spec)
sys.modules["pilot"] = pilot
spec.loader.exec_module(pilot)


class PilotContracts(unittest.TestCase):
    def setUp(self):
        self.plan = pilot.load_object(pilot.PILOT_PLAN)
        self.models = json.loads(pilot.MODELS_FILE.read_text(encoding="utf-8"))
        self.root = tempfile.TemporaryDirectory()
        self.addCleanup(self.root.cleanup)
        self.out = Path(self.root.name)
        self.output_patch = patch.object(pilot, "OUTPUT_ROOT", self.out)
        self.output_patch.start()
        self.addCleanup(self.output_patch.stop)
        self.args = SimpleNamespace(
            openapps_dir=self.out / "OpenApps",
            model_label="qwen3.5-9b", ollama_url="http://127.0.0.1:11434",
            max_pairs=1, stop_on_invalid=False,
        )
        self.identity = {
            "label": "qwen3.5-9b",
            "name": "qwen3.5:9b-q4_K_M",
            "digest": "test-sha256-model-digest",
        }
        self.identities = {self.identity["label"]: self.identity}

    def make_pilot(self):
        out, manifest = pilot.open_pilot(
            "pilot_contracts", self.plan, self.models,
            "demo_plan_sha", "demo_models_sha", "demo_git_sha",
            pilot.matched_dev.UPSTREAM_PIN,
        )
        pilot.freeze_model_digest(out, manifest, self.identity)
        return out, manifest

    @staticmethod
    def fake_paired_runner(args, report):
        report["model_identity"] = {
            "label": args.model_label,
            "name": "qwen3.5:9b-q4_K_M",
            "digest": "test-sha256-model-digest",
        }
        report["order"] = pilot.matched_dev.pair_order(
            args.task, args.model_label, args.seed,
        )
        report["initial_hash_parity"] = True
        report["policy_diagnostics"] = {
            "comparable_probe_decisions": 0,
            "policy_action_divergences": 0,
            "treatment_separation_observed": False,
        }
        report["status"] = "paired_pilot_completed"
        for method in pilot.matched_dev.METHODS:
            dest = Path(report["artifact_dir"]) / method / "episode"
            dest.mkdir(parents=True)
            (dest / "episode.json").write_text(
                json.dumps({
                    "mode": "paired_pilot_exploratory",
                    "study_phase": "pilot",
                    "pilot_id": args.pilot_id,
                    "model": "qwen3.5:9b-q4_K_M",
                    "model_digest": "test-sha256-model-digest",
                    "method": method, "task": args.task,
                    "task_group": args.task_group,
                    "valid": True, "run_complete": True,
                    "status": "pilot_success" if method == "Proposed"
                        else "pilot_unsuccessful",
                    "official_success": method == "Proposed",
                    "official_reward": float(method == "Proposed"),
                    "initial_sha256": "shared-initial-hash",
                    "steps": 5 if method == "Proposed" else 7,
                    "model_calls": 7, "invalid_model_actions": 1,
                    "repair_requests": 1, "repaired_steps": 1,
                    "model_seconds": 1.5, "total_seconds": 2.5,
                    "probe_opportunities": 0, "policy_overrides": 0,
                    "end_reason": "official_success" if method == "Proposed"
                        else "model_finish",
                    "trace": [],
                }), encoding="utf-8",
            )

    def test_schedule_six_four_two_is_unique_and_counterbalanced(self):
        tasks = pilot.validate_plan(self.plan, self.models)
        self.assertEqual(len(tasks), 6)
        self.assertEqual(len(self.plan["model_labels"]), 4)
        pairs = pilot.pair_schedule(self.plan)
        self.assertEqual(len(pairs), 24)
        self.assertEqual([x["pair_id"] for x in pairs],
                         [f"pair_{i:03d}" for i in range(1, 25)])
        self.assertEqual(len({(p["task_group"], p["task"], p["model_label"])
                              for p in pairs}), 24)
        for item in pairs:
            self.assertEqual(set(item["order"]), {"Baseline", "Proposed"})
            self.assertEqual(item["order"], pilot.matched_dev.pair_order(
                item["task"], item["model_label"], 233
            ))

    def test_invalid_plan_or_model_never_silently_schedules_less(self):
        for key, value in [
            ("max_steps", 21), ("seed", 42), ("status", "main"),
            ("model_labels", self.plan["model_labels"][:3]),
            ("tasks", self.plan["tasks"][:5]),
        ]:
            with self.subTest(field=key):
                altered = copy.deepcopy(self.plan)
                altered[key] = value
                with self.assertRaises(ValueError):
                    pilot.validate_plan(altered, self.models)
        duplicate = copy.deepcopy(self.plan)
        duplicate["tasks"][5] = duplicate["tasks"][0]
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            pilot.validate_plan(duplicate, self.models)
        wrong_group = copy.deepcopy(self.plan)
        wrong_group["tasks"][0]["task_group"] = "secret_tasks"
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            pilot.validate_plan(wrong_group, self.models)

    def test_pilot_manifest_is_immutable_across_resume(self):
        directory, first = self.make_pilot()
        later, second = pilot.open_pilot(
            "pilot_contracts", self.plan, self.models,
            "demo_plan_sha", "demo_models_sha", "demo_git_sha",
            pilot.matched_dev.UPSTREAM_PIN,
        )
        self.assertEqual(directory, later)
        self.assertEqual(first, second)
        with self.assertRaisesRegex(RuntimeError, "manifest differs"):
            pilot.open_pilot(
                "pilot_contracts", self.plan, self.models,
                "DIFFERENT_PLAN_SHA", "demo_models_sha",
                "demo_git_sha", pilot.matched_dev.UPSTREAM_PIN,
            )
        with self.assertRaisesRegex(RuntimeError, "manifest differs"):
            pilot.open_pilot(
                "pilot_contracts", self.plan, self.models,
                "demo_plan_sha", "demo_models_sha",
                "DIFFERENT_COMMIT", pilot.matched_dev.UPSTREAM_PIN,
            )
        self.assertEqual(pilot.load_object(directory / "manifest.json"), first)

    def test_pilot_id_and_upstream_sha_must_be_safe(self):
        for invalid in ("../parent", "a/b", "a\\b", "", "with spaces"):
            with self.subTest(pilot_id=invalid):
                with self.assertRaises(ValueError):
                    pilot.open_pilot(
                        invalid, self.plan, self.models,
                        "a", "b", "c", pilot.matched_dev.UPSTREAM_PIN,
                    )
        with self.assertRaisesRegex(RuntimeError, "pinned"):
            pilot.create_manifest(
                "pilot_contracts", self.plan, "sha", self.models, "a", "b", "bogus"
            )

    def test_model_digest_lock_is_append_only_and_rejects_mutations(self):
        directory, manifest = self.make_pilot()
        pilot.freeze_model_digest(directory, manifest, self.identity)
        locks = pilot.load_object(directory / "model_digests.json")
        self.assertEqual(locks["qwen3.5-9b"]["digest"],
                         "test-sha256-model-digest")
        changed = {**self.identity, "digest": "different"}
        with self.assertRaisesRegex(RuntimeError, "CHANGED"):
            pilot.freeze_model_digest(directory, manifest, changed)
        changed = {**self.identity, "name": "not-the-registered-model"}
        with self.assertRaisesRegex(RuntimeError, "configured name"):
            pilot.freeze_model_digest(directory, manifest, changed)
        self.assertEqual(
            pilot.load_object(directory / "model_digests.json"), locks
        )

    def test_partial_one_pair_resume_skips_and_preserves_original(self):
        directory, manifest = self.make_pilot()
        with patch.object(pilot.matched_dev, "run_pair",
                          side_effect=self.fake_paired_runner) as stub:
            self.assertEqual(
                pilot.execute_pairs(directory, manifest, self.args,
                                    self.identities), 0
            )
            self.assertEqual(stub.call_count, 1)
            first_pair = directory / "episodes" / "pair_001" / "pair.json"
            original = first_pair.read_bytes()
            self.assertEqual(
                pilot.execute_pairs(directory, manifest, self.args,
                                    self.identities), 0
            )
            self.assertEqual(stub.call_count, 2)
            self.assertEqual(first_pair.read_bytes(), original)
            self.assertTrue(
                (directory / "episodes" / "pair_005" / "pair.json").is_file()
            )
            self.assertFalse(
                (directory / "episodes" / "pair_002" / "pair.json").exists()
            )

    def test_rows_include_all_48_episodes_with_distinct_valid_denominator(self):
        directory, manifest = self.make_pilot()
        with patch.object(pilot.matched_dev, "run_pair",
                          side_effect=self.fake_paired_runner):
            pilot.execute_pairs(directory, manifest, self.args, self.identities)
        rows = list(csv.DictReader(
            (directory / "results.csv").open(encoding="utf-8-sig")
        ))
        self.assertEqual(len(rows), 48)
        pair1 = [x for x in rows if x["pair_id"] == "pair_001"]
        self.assertEqual(len(pair1), 2)
        base = next(x for x in pair1 if x["method"] == "Baseline")
        prop = next(x for x in pair1 if x["method"] == "Proposed")
        self.assertEqual(base["paired_analysis_success"], "False")
        self.assertEqual(prop["paired_analysis_success"], "True")
        self.assertEqual(base["episode_status"], "pilot_unsuccessful")
        self.assertEqual(prop["episode_status"], "pilot_success")
        self.assertEqual(base["paired_valid"], "True")
        self.assertEqual(len([x for x in rows if
                              x["pair_status"] == "not_started"]), 46)
        summary = list(csv.DictReader(
            (directory / "summary.csv").open(encoding="utf-8-sig")
        ))
        self.assertEqual(len(summary), 10)
        b = next(x for x in summary if
                 x["model_label"] == "qwen3.5-9b" and x["method"] == "Baseline")
        p = next(x for x in summary if
                 x["model_label"] == "qwen3.5-9b" and x["method"] == "Proposed")
        self.assertEqual(b["valid_pairs"], "1")
        self.assertEqual(b["not_started_pairs"], "5")
        self.assertEqual(b["paired_failures"], "1")
        self.assertEqual(b["success_rate_valid_pairs"], "0.0000")
        self.assertEqual(p["paired_successes"], "1")
        self.assertEqual(p["success_rate_valid_pairs"], "1.0000")
        overall = next(x for x in summary if
            x["model_label"] == "ALL_MODELS" and x["method"] == "Proposed"
        )
        self.assertEqual(overall["planned_pairs"], "24")
        self.assertEqual(overall["valid_pairs"], "1")

    def test_one_missing_arm_never_counts_a_baseline_reward(self):
        directory, manifest = self.make_pilot()
        slot = manifest["pairs"][0]
        base = directory / "episodes" / slot["pair_id"]
        base.mkdir(parents=True)
        report = {
            **slot, "status": "invalid_pair",
            "initial_hash_parity": False, "model_identity": self.identity,
            "error": "Proposed runtime stopped",
        }
        pilot.atomic_json(base / "pair.json", report)
        ep = base / "Baseline" / "episode" / "episode.json"
        ep.parent.mkdir(parents=True)
        ep.write_text(json.dumps({
            "mode": "paired_pilot_exploratory",
            "study_phase": "pilot", "pilot_id": directory.name,
            "method": "Baseline", "task": slot["task"],
            "task_group": slot["task_group"], "model": self.identity["name"],
            "model_digest": self.identity["digest"], "valid": True,
            "run_complete": True, "official_success": True,
            "official_reward": 1.0, "initial_sha256": "shared",
        }), encoding="utf-8")
        view = pilot.inspect_slot(
            directory, slot, pilot.load_object(directory / "model_digests.json")
        )
        self.assertFalse(view["valid"])
        self.assertEqual(view["status"], "invalid_pair")
        b = next(x for x in view["rows"] if x["method"] == "Baseline")
        p = next(x for x in view["rows"] if x["method"] == "Proposed")
        self.assertEqual(b["official_success_raw"], True)
        self.assertEqual(b["paired_analysis_success"], "")
        self.assertFalse(b["analysis_included"])
        self.assertEqual(p["episode_status"], "not_run")
        self.assertEqual(p["official_success_raw"], "")

    def test_no_valid_pair_success_rate_is_blank_not_zero(self):
        directory, manifest = self.make_pilot()
        views, summary = pilot.refresh_csv(directory, manifest)
        self.assertEqual(len(views), 24)
        self.assertEqual(len(summary), 10)
        self.assertTrue(all(x["success_rate_valid_pairs"] == "" for x in summary))
        self.assertTrue(all(x["paired_successes"] == 0 for x in summary))

    def test_initial_sha_mismatch_excluded_even_if_pair_claims_success(self):
        directory, manifest = self.make_pilot()
        with patch.object(pilot.matched_dev, "run_pair",
                          side_effect=self.fake_paired_runner):
            pilot.execute_pairs(directory, manifest, self.args, self.identities)
        slot = manifest["pairs"][0]
        ep = (directory / "episodes" / "pair_001" / "Proposed" /
              "episode" / "episode.json")
        rec = json.loads(ep.read_text(encoding="utf-8"))
        rec["initial_sha256"] = "different"
        ep.write_text(json.dumps(rec), encoding="utf-8")
        view = pilot.inspect_slot(directory, slot, pilot.load_object(
            directory / "model_digests.json"
        ))
        self.assertFalse(view["valid"])
        self.assertEqual(view["rows"][1]["paired_analysis_success"], "")

    def test_incomplete_pair_directory_refuses_silent_overwrite(self):
        directory, manifest = self.make_pilot()
        partial = directory / "episodes" / "pair_001"
        partial.mkdir(parents=True)
        (partial / "partial.log").write_text("incomplete")
        with patch.object(pilot.matched_dev, "run_pair") as stub:
            with self.assertRaisesRegex(RuntimeError, "Incomplete pair"):
                pilot.execute_pairs(directory, manifest, self.args,
                                    self.identities)
            stub.assert_not_called()
        self.assertEqual((partial / "partial.log").read_text(), "incomplete")
        self.assertFalse((directory / ".pilot_running.lock").exists())

    def test_interrupted_pair_saved_and_not_automatically_retried(self):
        directory, manifest = self.make_pilot()
        with patch.object(pilot.matched_dev, "run_pair",
                          side_effect=KeyboardInterrupt()):
            self.assertEqual(
                pilot.execute_pairs(directory, manifest, self.args,
                                    self.identities), 130,
            )
        invalid = directory / "episodes" / "pair_001" / "pair.json"
        self.assertEqual(pilot.load_object(invalid)["status"], "invalid_pair")
        self.assertFalse((directory / ".pilot_running.lock").exists())
        with patch.object(pilot.matched_dev, "run_pair",
                          side_effect=self.fake_paired_runner) as stub:
            pilot.execute_pairs(directory, manifest, self.args, self.identities)
            self.assertEqual(stub.call_count, 1)
            self.assertEqual(pilot.load_object(invalid)["status"], "invalid_pair")


if __name__ == "__main__":
    unittest.main()
