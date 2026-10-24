"""Small-only extension contracts; no browser or model service required."""
import copy
import csv
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/browsergym"))
import small_extension as ext


class SmallExtensionContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan, cls.models, cls.roster = ext.load()
        cls.tasks = ext.validate(cls.plan, cls.models, cls.roster)
        cls.schedule = ext.schedule(cls.plan, cls.models, cls.tasks)

    def test_registry_contains_only_four_small_checkpoints(self):
        self.assertEqual(self.plan["protocol"], "cdea_small_extension_v1")
        self.assertEqual(len(self.models), 4)
        self.assertEqual({m["size"] for m in self.models}, {"small"})
        self.assertEqual({m["family"] for m in self.models},
                         {"qwen3.5", "ministral3", "granite4.1", "xlam2"})
        self.assertEqual(len({m["label"] for m in self.models}), 4)
        self.assertFalse(any("-8b" in m["label"] or "-9b" in m["label"] for m in self.models))

    def test_128_pairs_256_episode_slots(self):
        self.assertEqual(len(self.tasks), 32)
        self.assertEqual(len(self.schedule), 128)
        self.assertEqual(self.schedule, ext.schedule(self.plan, self.models, self.tasks))
        self.assertEqual(sum(x["stratum"] == "bank_information" for x in self.schedule), 20)
        self.assertEqual(len({(x["task_group"],x["task"],x["model_label"]) for x in self.schedule}), 128)
        self.assertTrue(all(x["size"] == "small" for x in self.schedule))
        self.assertTrue(all(set(x["order"]) == {"Baseline","Proposed"} for x in self.schedule))

    def test_reject_old_full_scale_configuration(self):
        for key,value in (("num_ctx", 4096), ("max_steps",30),
                          ("planned_matched_pairs",256), ("planned_episodes",512),
                          ("protocol","cdea_scale_v1")):
            bad=copy.deepcopy(self.plan)
            bad[key]=value
            with self.assertRaises(ValueError):
                ext.validate(bad,self.models,self.roster)
        bad_models=copy.deepcopy(self.models)
        bad_models[0]["size"]="large"
        with self.assertRaises(ValueError):
            ext.validate(self.plan,bad_models,self.roster)
        bad_models=copy.deepcopy(self.models)
        bad_models[0]["family"]=bad_models[1]["family"]
        with self.assertRaises(ValueError):
            ext.validate(self.plan,bad_models,self.roster)

    def test_four_checkpoint_identity_gate(self):
        tags=[{"name":m["name"],"digest":"sha256:"+m["label"]} for m in self.models]
        good=ext.identities_for(self.plan,self.models,"http://127.0.0.1:11434",
                                client=lambda url,timeout:{"models":tags})
        self.assertEqual(len(good),4)
        with self.assertRaises(LookupError):
            ext.identities_for(self.plan,self.models,"http://127.0.0.1:11434",
                               client=lambda url,timeout:{"models":tags[:-1]})

    def test_output_keeps_invalid_and_unstarted_slots(self):
        tags=[{"name":m["name"],"digest":"sha256:"+m["label"]} for m in self.models]
        identities=ext.identities_for(self.plan,self.models,"http://127.0.0.1:11434",
                                      client=lambda url,timeout:{"models":tags})
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)/"small_trial"
            folder.mkdir()
            manifest=ext.manifest(folder.name,self.plan,self.models,self.roster,
                                  self.schedule,identities,"controller-sha")
            self.assertEqual(manifest["planned_pairs"],128)
            self.assertEqual(manifest["planned_episodes"],256)
            ext.pilot.atomic_json(folder/"manifest.json",manifest)
            result=ext.report_outputs(folder,manifest)
            self.assertEqual(result["protocol"],"cdea_small_extension_v1")
            self.assertEqual(result["valid_pairs"],0)
            self.assertEqual(result["not_started_pairs"],128)
            self.assertNotIn("interactions",result)
            def count(file):
                with (folder/file).open(newline="",encoding="utf-8-sig") as stream:
                    return len(list(csv.DictReader(stream)))
            self.assertEqual(count("results.csv"),256)
            self.assertEqual(count("pairs.csv"),128)
            self.assertEqual(count("summary.csv"),32)
            (folder/"episodes"/self.schedule[0]["pair_id"]).mkdir(parents=True)
            result=ext.report_outputs(folder,manifest)
            self.assertEqual(result["invalid_pairs"],1)
            self.assertEqual(result["not_started_pairs"],127)

    def test_dry_run_excludes_large_checkpoints(self):
        self.assertEqual(ext.main(["--dry-run"]),0)


if __name__ == "__main__":
    unittest.main()
