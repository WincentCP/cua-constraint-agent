"""Offline contracts for the source-locked 32-task Main roster.

No BrowserGym/Ollama/execution claims. Optional OPENAPPS_DIR verifies official
YAML key/type/signature against the pinned checkout, without loading Hydra.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import unittest
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "config" / "main_taskset_v1.json"
PILOT = ROOT / "config" / "pilot_plan.json"
FROZEN_SHA256 = "73d4a4a8e377422072c6ab27c066f87f8acbed7683ed50168c3407c861d61333"
UPSTREAM_PIN = "6e6782794433c60468d65ac75bc3f03c56007f8c"
SOURCE_FILES = {
    "all_tasks": "config/tasks/original_tasks.yaml",
    "longer_horizon": "config/tasks/longer_horizon.yaml",
    "openbanking": "config/tasks/openbanking.yaml",
}
STRATA = {
    "all_tasks": "primitive_control",
    "longer_horizon": "cross_app_workflow",
    "openbanking": "bank_information",
}


def parse_official_yaml_sections(source: str) -> dict[str, tuple[str, list[str]]]:
    """Parse top-level task headers and _target_ types, not full YAML semantics."""
    starts = list(re.finditer(r"(?m)^([a-z][a-z0-9_]*):[ \t]*$", source))
    found: dict[str, tuple[str, list[str]]] = {}
    for index, match in enumerate(starts):
        end = starts[index + 1].start() if index + 1 < len(starts) else len(source)
        section = source[match.start():end]
        targets = re.findall(
            r"_target_:\s*open_apps\.tasks\.tasks\.([A-Za-z]+Task)",
            section,
        )
        if not targets:
            continue
        ops = targets[1:] if targets[0] == "CompositeTask" else targets
        found[match.group(1)] = (targets[0], ops)
    return found


class FrozenMainTaskset(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.main = json.loads(MAIN.read_text(encoding="utf-8"))
        cls.pilot = json.loads(PILOT.read_text(encoding="utf-8"))

    def test_frozen_identity_and_expected_counts(self):
        cfg = self.main
        self.assertEqual(cfg["schema_version"], 1)
        self.assertEqual(cfg["protocol"], "cdea_main_taskset_v1")
        self.assertEqual(cfg["status"], "taskset_frozen_execution_not_authorized")
        self.assertIs(cfg["execution_authorized"], False)
        self.assertEqual(cfg["openapps_git_commit"], UPSTREAM_PIN)
        self.assertEqual(cfg["source_files"], SOURCE_FILES)
        self.assertEqual(cfg["seed"], 233)
        self.assertEqual(cfg["methods"], ["Baseline", "Proposed"])
        self.assertEqual(cfg["model_labels"], self.pilot["model_labels"])
        self.assertEqual(cfg["planned_tasks"], 32)
        self.assertEqual(cfg["planned_matched_pairs"], 128)
        self.assertEqual(cfg["planned_episodes"], 256)
        self.assertEqual(len(cfg["tasks"]), 32)

    def test_frozen_order_is_cryptographically_locked(self):
        cfg = self.main
        roster_bytes = "".join(
            f'{task["task_group"]}/{task["task"]}\n'
            for task in cfg["tasks"]
        ).encode("utf-8")
        self.assertEqual(hashlib.sha256(roster_bytes).hexdigest(), FROZEN_SHA256)
        self.assertEqual(cfg["task_order_sha256"], FROZEN_SHA256)

    def test_no_pilot_overlap_or_prompt_paraphrase(self):
        pilot_tasks = {
            (item["task_group"], item["task"]) for item in self.pilot["tasks"]
        }
        frozen_exclusions = {
            (item["task_group"], item["task"])
            for item in self.main["pilot_exclusions"]
        }
        self.assertEqual(frozen_exclusions, pilot_tasks)
        seen: set[tuple[str, str]] = set()
        families: set[str] = set()
        for pos, task in enumerate(self.main["tasks"], start=1):
            key = (task["task_group"], task["task"])
            self.assertEqual(task["main_index"], pos)
            self.assertNotIn(key, pilot_tasks)
            self.assertNotIn(key, seen)
            self.assertNotIn(task["family"], families)
            self.assertRegex(task["task"], r"^[a-z][a-z0-9_]*$")
            self.assertNotIn("__", task["task"])
            self.assertTrue(task["selection_reason"])
            seen.add(key)
            families.add(task["family"])

    def test_source_groups_operations_and_strata(self):
        counts = Counter(task["task_group"] for task in self.main["tasks"])
        self.assertEqual(counts, {"all_tasks": 9, "longer_horizon": 18, "openbanking": 5})
        signatures = set()
        for task in self.main["tasks"]:
            group = task["task_group"]
            self.assertEqual(task["source_task_file"], SOURCE_FILES[group])
            self.assertEqual(task["stratum"], STRATA[group])
            self.assertIs(
                task["requires_unknown_bank_value"],
                group == "openbanking",
            )
            self.assertTrue(task["operations"])
            for operation in task["operations"]:
                self.assertRegex(operation, r"^[A-Za-z]+Task$")
            if group == "all_tasks":
                self.assertNotEqual(task["source_type"], "CompositeTask")
                self.assertEqual(task["operations"], [task["source_type"]])
            else:
                self.assertEqual(task["source_type"], "CompositeTask")
            if group == "longer_horizon":
                signature = tuple(sorted(task["operations"]))
                self.assertNotIn(signature, signatures)
                signatures.add(signature)
        self.assertEqual(len(signatures), 18)
        longer_count = Counter(
            len(task["operations"]) for task in self.main["tasks"]
            if task["task_group"] == "longer_horizon"
        )
        self.assertEqual(longer_count, {2: 8, 3: 6, 4: 4})

    def test_optional_pinned_openapps_source_contract(self):
        path = os.getenv("OPENAPPS_DIR")
        if not path:
            self.skipTest("Set OPENAPPS_DIR to validate pinned OpenApps task sources")
        root = Path(path).expanduser().resolve()
        self.assertTrue((root / "launch.py").is_file(), f"Missing OpenApps: {root}")
        actual = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        self.assertEqual(actual, UPSTREAM_PIN)
        inventories = {
            group: parse_official_yaml_sections(
                (root / filename).read_text(encoding="utf-8")
            )
            for group, filename in SOURCE_FILES.items()
        }
        for task in self.main["tasks"]:
            group, key = task["task_group"], task["task"]
            with self.subTest(group=group, task=key):
                self.assertIn(key, inventories[group])
                source_type, operations = inventories[group][key]
                self.assertEqual(task["source_type"], source_type)
                self.assertEqual(task["operations"], operations)


if __name__ == "__main__":
    unittest.main()
