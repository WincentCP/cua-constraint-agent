"""Offline-only contracts for the preregistered, gated Main orchestrator.

Synthetic fixtures below test failure modes/CSV integrity. They are not
research observations, do not measure live performance and must never be
included in Main results.
"""
from __future__ import annotations

import copy
import csv
import json
from pathlib import Path
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1] / "scripts" / "browsergym"
sys.path.insert(0, str(HERE))
import main as experiment


class MainContracts(unittest.TestCase):
    def setUp(self):
        self.plan, self.roster, self.models = experiment.load_plan()
        self.tasks = experiment.validate_plan(self.plan, self.roster, self.models)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root_patch = patch.object(experiment, "OUTPUT_ROOT", self.base / "output")
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.identities = {
            label: {
                "label": label,
                "name": experiment.get_model(self.models, label),
                "digest": "test-fixture-ollama-digest-" + label,
            }
            for label in self.plan["model_labels"]
        }
        self.identity = self.identities[self.plan["model_labels"][0]]

    def make_approval(self):
        evidence = self.base / "non-live-synthetic-contract-fixture.txt"
        evidence.write_text("offline fixture, NOT live research evidence\n",
                            encoding="utf-8")
        return {
            "readiness_sha256": "fixture-readiness",
            "readiness_evidence_sha256": {key: "fixture"
                for key in self.plan["readiness_checks"]},
            "approval_timestamp_utc": "2026-10-20T00:00:00+00:00",
            "approved_by": "test-fixture-not-a-researcher",
        }

    def manifest(self):
        return experiment.create_manifest(
            "main_contracts", self.plan, self.tasks, self.models,
            "fixture-repo-commit", experiment.matched_dev.UPSTREAM_PIN,
            self.make_approval(), self.identities,
        )

    def make_pair(self, directory, manifest, slot, *, baseline=False, proposed=True):
        """Create truthful-schema, explicitly synthetic offline fixtures."""
        experiment.freeze_model_digest(directory, manifest, self.identity)
        pair_dir = directory / "episodes" / slot["pair_id"]
        report = {
            "mode": "official_browsergym_main_confirmatory",
            "main_id": directory.name,
            **{key: slot[key] for key in (
                "pair_id", "pair_index", "task_index", "task_group", "task",
                "model_label", "family", "stratum",
            )},
            "artifact_dir": str(pair_dir), "status": "paired_main_completed",
            "order": slot["order"], "initial_hash_parity": True,
            "model_identity": self.identity,
            "policy_diagnostics": {
                "comparable_probe_decisions": 0,
                "policy_action_divergences": 0,
                "treatment_separation_observed": False,
            },
            "main_manifest_sha256": experiment.pilot.hash_file(
                directory / "manifest.json"
            ),
        }
        settings = manifest["shared_parameters"]
        for method, success in [("Baseline", baseline), ("Proposed", proposed)]:
            dst = pair_dir / method / "episode"
            dst.mkdir(parents=True)
            ep = {
                "mode": "paired_main_confirmatory",
                "study_phase": "main", "main_id": directory.name,
                "pilot_id": None, "method": method,
                "task": slot["task"], "task_group": slot["task_group"],
                "model": self.identity["name"],
                "model_digest": self.identity["digest"],
                "upstream_commit": experiment.matched_dev.UPSTREAM_PIN,
                "valid": True, "run_complete": True,
                "status": "main_success" if success else "main_unsuccessful",
                "official_success": success, "official_reward": float(success),
                "initial_sha256": "a" * 64,
                "seed": settings["seed"], "max_steps": settings["max_steps"],
                "temperature": settings["temperature"],
                "num_predict": settings["num_predict"],
                "num_ctx": settings["num_ctx"], "think": False,
                "action_subsets": settings["action_subsets"],
                "bid_click_timeout_ms": settings["bid_click_timeout_ms"],
                "click_force_retry": False, "steps": 4,
                "trace": [], "model_calls": 4, "model_seconds": 3.0,
                "total_seconds": 5.0, "invalid_model_actions": 0,
                "repair_requests": 0, "repaired_steps": 0,
                "probe_opportunities": 0, "policy_overrides": 0,
                "end_reason": "official_success" if success else "model_finish",
                "server": {"database_dir": str(
                    dst.parent / "server" / "databases"
                )},
            }
            experiment.pilot.atomic_json(dst / "episode.json", ep)
        experiment.pilot.atomic_json(pair_dir / "pair.json", report)
        return pair_dir

    def test_fixed_128_schedule_and_order(self):
        a = experiment.pair_schedule(self.plan, self.tasks)
        b = experiment.pair_schedule(self.plan, self.tasks)
        self.assertEqual(a, b)
        self.assertEqual(len(a), 128)
        self.assertEqual([r["pair_id"] for r in a],
                         [f"pair_{i:03d}" for i in range(1, 129)])
        self.assertEqual(len({(r["task_group"], r["task"], r["model_label"])
                              for r in a}), 128)
        self.assertEqual({r["stratum"] for r in a},
                         {"bank_information", "primitive_control",
                          "cross_app_workflow"})
        self.assertEqual(sum(r["stratum"] == "bank_information" for r in a), 20)
        for item in a:
            self.assertEqual(set(item["order"]), {"Baseline", "Proposed"})
            self.assertEqual(item["order"], experiment.matched_dev.pair_order(
                item["task"], item["model_label"], self.plan["seed"]
            ))

    def test_modified_plan_budget_roster_and_model_rejected(self):
        for key, value in [
            ("max_steps", 20), ("model_timeout", 60), ("seed", 4),
            ("num_predict", 999), ("num_ctx", 4096),
            ("planned_matched_pairs", 127),
            ("model_labels", self.plan["model_labels"][:3]),
            ("status", "approved"), ("task_order_sha256", "bad"),
        ]:
            with self.subTest(key=key):
                modified = copy.deepcopy(self.plan)
                modified[key] = value
                with self.assertRaises(ValueError):
                    experiment.validate_plan(modified, self.roster, self.models)
        changed = copy.deepcopy(self.roster)
        changed["tasks"][0] = copy.deepcopy(changed["tasks"][1])
        with self.assertRaises(ValueError):
            experiment.validate_plan(self.plan, changed, self.models)
        changed2 = copy.deepcopy(self.roster)
        changed2["tasks"][0]["task"] = self.roster["pilot_exclusions"][0]["task"]
        with self.assertRaises(ValueError):
            experiment.validate_plan(self.plan, changed2, self.models)

    def test_main_context_window_frozen_in_plan_and_manifest(self):
        self.assertEqual(self.plan["num_ctx"], 8192)
        self.assertEqual(self.manifest()["shared_parameters"]["num_ctx"], 8192)

    def test_all_four_checkpoint_digests_locked_before_main_begins(self):
        reduced = {self.identity["label"]: self.identity}
        with self.assertRaisesRegex(ValueError, "ALL FOUR"):
            experiment.create_manifest(
                "main_contracts", self.plan, self.tasks, self.models,
                "fixture-repo-commit", experiment.matched_dev.UPSTREAM_PIN,
                self.make_approval(), reduced,
            )
        manifest = self.manifest()
        self.assertEqual(
            set(manifest["model_checkpoint_digests"]),
            set(self.plan["model_labels"]),
        )
        directory, _ = experiment.open_main("main_contracts", manifest)
        for identity in self.identities.values():
            experiment.freeze_model_digest(directory, manifest, identity)
        registry = experiment.pilot.load_object(
            directory / "model_digests.json"
        )
        self.assertEqual(set(registry), set(self.plan["model_labels"]))
        drift = dict(self.identity, digest="changed-before-first-use")
        with self.assertRaisesRegex(RuntimeError, "immutable manifest"):
            experiment.freeze_model_digest(directory, manifest, drift)

    def test_main_manifest_immutability_and_digest_lock(self):
        manifest = self.manifest()
        directory, existing = experiment.open_main("main_contracts", manifest)
        self.assertEqual(existing["planned_pairs"], 128)
        self.assertEqual(experiment.open_main("main_contracts", manifest)[1], existing)
        changed = copy.deepcopy(manifest)
        changed["model_config_sha256"] = "bad"
        with self.assertRaisesRegex(RuntimeError, "manifest differs"):
            experiment.open_main("main_contracts", changed)
        experiment.freeze_model_digest(directory, manifest, self.identity)
        bad = {**self.identity, "digest": "changed"}
        with self.assertRaisesRegex(RuntimeError, "digest"):
            experiment.freeze_model_digest(directory, manifest, bad)

    def test_readiness_template_is_not_approval(self):
        template = experiment.pilot.load_object(
            experiment.READINESS_TEMPLATE
        )
        path = self.base / "attestation.json"
        experiment.pilot.atomic_json(path, template)
        with self.assertRaises(ValueError):
            experiment.verify_readiness(path, self.plan, "live-git-sha")
        self.assertFalse((self.base / "output").exists())

    def test_readiness_requires_real_paths_and_controller_hash(self):
        template = experiment.pilot.load_object(
            experiment.READINESS_TEMPLATE
        )
        path = self.base / "attestation.json"
        template.update(status="approved", approved_by="offline test",
                        approved_utc="2026-10-20T00:00:00Z",
                        controller_git_commit="local-commit-sha")
        for key in self.plan["readiness_checks"]:
            template["checks"][key] = {
                "passed": True, "evidence_path": "/missing/not-an-artifact"
            }
        experiment.pilot.atomic_json(path, template)
        with self.assertRaisesRegex(ValueError, "evidence"):
            experiment.verify_readiness(path, self.plan, "local-commit-sha")
        ev = self.base / "offline-fixture-evidence.txt"
        ev.write_text("fixture not live\n", encoding="utf-8")
        for key in self.plan["readiness_checks"]:
            template["checks"][key]["evidence_path"] = str(ev)
        experiment.pilot.atomic_json(path, template)
        with self.assertRaisesRegex(ValueError, "approval/identity"):
            experiment.verify_readiness(path, self.plan, "different-sha")
        result = experiment.verify_readiness(path, self.plan, "local-commit-sha")
        self.assertEqual(len(result["readiness_evidence_sha256"]), 6)
        self.assertEqual(result["readiness_sha256"],
                         experiment.pilot.hash_file(path))

    def test_valid_main_pair_and_csv_coverage_without_fabricating_missing(self):
        manifest = self.manifest()
        directory, _ = experiment.open_main("main_contracts", manifest)
        slot = next(s for s in manifest["pairs"]
                    if s["model_label"] == self.identity["label"])
        self.make_pair(directory, manifest, slot)
        locked = experiment.pilot.load_object(directory / "model_digests.json")
        view = experiment.inspect_slot(directory, slot, manifest, locked)
        self.assertTrue(view["valid"])
        self.assertEqual(view["rows"][0]["paired_analysis_success"], False)
        self.assertEqual(view["rows"][1]["paired_analysis_success"], True)
        views, output = experiment.refresh_reports(directory, manifest)
        self.assertEqual(len(views), 128)
        self.assertEqual(output["total_valid_pairs"], 1)
        self.assertEqual(output["total_not_started_pairs"], 127)
        self.assertIsNone(output["primary"][
            "exact_mcnemar_p_two_sided_unadjusted_exploratory"])
        with (directory / "results.csv").open(encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 256)
        self.assertEqual(sum(row["paired_valid"] == "True" for row in rows), 2)
        with (directory / "pairs.csv").open(encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 128)
        self.assertEqual(sum(row["paired_valid"] == "True" for row in rows), 1)
        with (directory / "summary.csv").open(encoding="utf-8-sig", newline="") as f:
            summaries = list(csv.DictReader(f))
        self.assertEqual(len(summaries), 40)

    def test_fail_closed_on_initial_state_reward_and_digest_drift(self):
        manifest = self.manifest()
        directory, _ = experiment.open_main("main_contracts", manifest)
        slot = next(s for s in manifest["pairs"]
                    if s["model_label"] == self.identity["label"])
        pair_dir = self.make_pair(directory, manifest, slot)
        locked = experiment.pilot.load_object(directory / "model_digests.json")
        path = pair_dir / "Proposed" / "episode" / "episode.json"
        original = experiment.pilot.load_object(path)
        for field, wrong in [
            ("initial_sha256", "b" * 64),
            ("official_reward", 0.0),
            ("model_digest", "drift"),
            ("study_phase", "pilot"),
            ("mode", "paired_pilot_exploratory"),
            ("max_steps", 20),
            ("num_ctx", 4096),
            ("valid", False),
            ("upstream_commit", "untrusted"),
        ]:
            with self.subTest(field=field):
                changed = copy.deepcopy(original)
                changed[field] = wrong
                experiment.pilot.atomic_json(path, changed)
                view = experiment.inspect_slot(directory, slot, manifest, locked)
                self.assertFalse(view["valid"])
                self.assertEqual(view["rows"][1]["paired_analysis_success"], "")
                self.assertEqual(view["rows"][1]["official_success_raw"], True)
        experiment.pilot.atomic_json(path, original)
        report_path = pair_dir / "pair.json"
        report = experiment.pilot.load_object(report_path)
        report["policy_diagnostics"]["policy_action_divergences"] = 2
        experiment.pilot.atomic_json(report_path, report)
        self.assertFalse(experiment.inspect_slot(
            directory, slot, manifest, locked
        )["valid"])

    def test_unsealed_pair_never_reruns_or_count_as_failure(self):
        manifest = self.manifest()
        directory, _ = experiment.open_main("main_contracts", manifest)
        slot = next(s for s in manifest["pairs"]
                    if s["model_label"] == self.identity["label"])
        unfinished = directory / "episodes" / slot["pair_id"]
        unfinished.mkdir(parents=True)
        args = SimpleNamespace(
            model_label=slot["model_label"], max_pairs=1,
            stop_on_invalid=False, openapps_dir=self.base / "OpenApps",
            ollama_url="http://127.0.0.1:11434",
        )
        with patch.object(experiment.matched_dev, "run_pair") as runnable:
            with self.assertRaisesRegex(RuntimeError, "Unsealed"):
                experiment.execute_pairs(
                    directory, manifest, args,
                    {slot["model_label"]: self.identity},
                )
            runnable.assert_not_called()
        self.assertFalse((directory / ".main_running.lock").exists())
        views, analysis_result = experiment.refresh_reports(directory, manifest)
        self.assertEqual(analysis_result["total_invalid_pairs"], 1)
        self.assertEqual(analysis_result["total_not_started_pairs"], 127)
        self.assertEqual(sum(v["valid"] for v in views), 0)

    def test_exact_mcnemar_is_exploratory_and_only_after_completion(self):
        self.assertEqual(experiment.exact_mcnemar_two_sided(0, 0), 1.0)
        self.assertEqual(experiment.exact_mcnemar_two_sided(1, 0), 1.0)
        self.assertEqual(experiment.exact_mcnemar_two_sided(5, 0), 0.0625)
        self.assertEqual(experiment.exact_mcnemar_two_sided(6, 0), 0.03125)
        manifest = self.manifest()
        mock_views = []
        for slot in manifest["pairs"]:
            proposed = slot["stratum"] == "bank_information"
            mock_views.append({
                "slot": slot, "status": "paired_main_completed",
                "valid": True, "comparison": {},
                "rows": [
                    {"method": "Baseline", "paired_analysis_success": False},
                    {"method": "Proposed", "paired_analysis_success": proposed},
                ],
            })
        result = experiment.analysis(mock_views, manifest)
        self.assertTrue(result["inference_released"])
        self.assertEqual(result["primary"]["planned_pairs"], 20)
        self.assertEqual(result["primary"]["paired_success_delta"], 1.0)
        self.assertIsNotNone(result["primary"][
            "exact_mcnemar_p_two_sided_unadjusted_exploratory"])
        mock_views[0]["status"] = "not_started"
        mock_views[0]["valid"] = False
        mock_views[0]["rows"] = []
        result = experiment.analysis(mock_views, manifest)
        self.assertFalse(result["inference_released"])
        self.assertIsNone(result["primary"][
            "exact_mcnemar_p_two_sided_unadjusted_exploratory"])
        # Even if no pair is marked not_started, unsealed/invalid-only work
        # must not release a statistical result from an empty primary sample.
        for view in mock_views:
            view["status"] = "unsealed_pair"
            view["valid"] = False
            view["rows"] = []
        blocked = experiment.analysis(mock_views, manifest)
        self.assertFalse(blocked["inference_released"])
        self.assertIsNone(blocked["primary"][
            "exact_mcnemar_p_two_sided_unadjusted_exploratory"])
        for view in mock_views:
            view["status"] = "invalid_pair"
        invalid_only = experiment.analysis(mock_views, manifest)
        self.assertFalse(invalid_only["inference_released"])
        self.assertIsNone(invalid_only["primary"][
            "exact_mcnemar_p_two_sided_unadjusted_exploratory"])

    def test_readiness_initialization_is_pending_and_never_overwrites(self):
        path = self.base / "pending_readiness.json"
        with patch.object(experiment, "require_clean_repo", return_value="fixed-git-sha"):
            self.assertEqual(experiment.main([
                "--init-readiness", "--readiness-file", str(path),
            ]), 0)
        item = experiment.pilot.load_object(path)
        self.assertEqual(item["status"], "pending")
        self.assertEqual(item["controller_git_commit"], "fixed-git-sha")
        self.assertTrue(all(
            check["passed"] is False and check["evidence_path"] == ""
            for check in item["checks"].values()
        ))
        with self.assertRaisesRegex(RuntimeError, "overwrite"):
            experiment.initialize_readiness(path, self.plan, "fixed-git-sha")
        with self.assertRaises(ValueError):
            experiment.verify_readiness(path, self.plan, "fixed-git-sha")
        self.assertFalse((self.base / "output").exists())

    def test_relative_readiness_evidence_and_non_utc_timestamp(self):
        path = self.base / "readiness" / "readiness_v1.json"
        path.parent.mkdir()
        evidence = path.parent / "evidence.txt"
        evidence.write_text("OFFLINE TEST EVIDENCE; NOT LIVE\n", encoding="utf-8")
        item = experiment.pilot.load_object(
            experiment.READINESS_TEMPLATE
        )
        item.update(status="approved", approved_by="test-fixture",
                    approved_utc="2026-10-20T09:00:00Z",
                    controller_git_commit="frozen-test-sha")
        for name in item["checks"]:
            item["checks"][name] = {"passed": True,
                                    "evidence_path": "evidence.txt"}
        experiment.pilot.atomic_json(path, item)
        result = experiment.verify_readiness(path, self.plan, "frozen-test-sha")
        self.assertEqual(
            set(result["readiness_evidence_sha256"]), set(item["checks"])
        )
        with patch.object(experiment, "require_clean_repo",
                          return_value="frozen-test-sha"):
            self.assertEqual(experiment.main([
                "--check-readiness", "--readiness-file", str(path),
            ]), 0)
        item["approved_utc"] = "2026-10-20T16:00:00+07:00"
        experiment.pilot.atomic_json(path, item)
        with self.assertRaisesRegex(ValueError, "UTC"):
            experiment.verify_readiness(path, self.plan, "frozen-test-sha")

    def test_four_model_action_contract_persists_preflight_only(self):
        import model_compatibility
        location = self.base / "main_models"
        def fake_contract(label, _url, *, num_ctx=None):
            self.assertEqual(num_ctx, 8192)
            return {
                "status": "action_contract_pass",
                "model_digest": "test-model-digest-" + label,
                "all_synthetic_actions_correct": True,
                "synthetic_probe_menu_demonstrated": False,
                "cases": [],
            }
        with patch.object(experiment, "MODEL_PREFLIGHT_ROOT", location), \
             patch.object(model_compatibility, "run_check",
                          side_effect=fake_contract), \
             patch.object(experiment.pilot, "git_head",
                          return_value="test-fixture-commit"):
            self.assertEqual(experiment.main(["--check-models"]), 0)
        files = list(location.glob("*.json"))
        self.assertEqual(len(files), 1)
        record = experiment.pilot.load_object(files[0])
        self.assertEqual(record["status"], "action_contract_pass")
        self.assertTrue(record["full_four_model_coverage"])
        self.assertEqual(len(record["results"]), 4)
        self.assertTrue(record["scientific_readiness_not_granted"])
        self.assertFalse((self.base / "output").exists())

    def test_model_action_contract_failure_preserves_failure_evidence(self):
        import model_compatibility
        location = self.base / "failed_models"
        with patch.object(experiment, "MODEL_PREFLIGHT_ROOT", location), \
             patch.object(model_compatibility, "run_check",
                          side_effect=RuntimeError("not installed")), \
             patch.object(experiment.pilot, "git_head",
                          return_value="test-fixture-commit"):
            self.assertEqual(experiment.main(["--check-models"]), 2)
        evidence = [experiment.pilot.load_object(path)
                    for path in location.glob("*.json")]
        self.assertEqual(len(evidence), 1)
        self.assertEqual(evidence[0]["status"], "blocked")
        self.assertEqual(len(evidence[0]["errors"]), 4)

    def test_dry_run_is_read_only_and_run_missing_gate_fails(self):
        self.assertEqual(experiment.main(["--dry-run"]), 0)
        self.assertFalse((self.base / "output").exists())
        with self.assertRaises(SystemExit) as x:
            experiment.main(["--run", "--main-id", "main_v1",
                             "--openapps-dir", str(self.base / "OpenApps")])
        self.assertEqual(x.exception.code, 2)
        self.assertFalse((self.base / "output").exists())


if __name__ == "__main__":
    unittest.main()
