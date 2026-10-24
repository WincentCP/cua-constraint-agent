"""Offline contracts only. No live OpenApps/Ollama execution."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/browsergym"))
import scale

class ScaleContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan,cls.models,cls.roster=scale.load()
        cls.tasks=scale.validate(cls.plan,cls.models,cls.roster)
        cls.schedule=scale.schedule(cls.plan,cls.models,cls.tasks)

    def test_expected_4_families_8_checkpoints(self):
        self.assertEqual(len(self.models),8)
        self.assertEqual(len({m["family"] for m in self.models}),4)
        self.assertEqual(len({m["label"] for m in self.models}),8)
        self.assertEqual(len([m for m in self.models if m["size"]=="small"]),4)

    def test_schedule_256_pairs_512_episodes(self):
        self.assertEqual(len(self.schedule),256)
        self.assertEqual(self.schedule,scale.schedule(self.plan,self.models,self.tasks))
        self.assertEqual(sum(x["stratum"]=="bank_information" for x in self.schedule),40)
        self.assertTrue(all(set(x["order"])=={"Baseline","Proposed"} for x in self.schedule))
        self.assertEqual(len({(x["task"],x["model_label"]) for x in self.schedule}),256)

    def test_config_drift_fail_closed(self):
        for key,val in (("num_ctx",4096),("max_steps",30),("planned_matched_pairs",128)):
            bad=copy.deepcopy(self.plan);bad[key]=val
            with self.assertRaises(ValueError): scale.validate(bad,self.models,self.roster)
        bad_models=copy.deepcopy(self.models);bad_models[0]["size"]="large"
        with self.assertRaises(ValueError): scale.validate(self.plan,bad_models,self.roster)

    def test_size_interaction_uses_same_task_intersection(self):
        small = next(m for m in self.models if m["family"] == "granite4.1" and m["size"] == "small")
        large = next(m for m in self.models if m["family"] == "granite4.1" and m["size"] == "large")
        def view(model, task, baseline, proposed, valid=True):
            return {"slot":{"family":model["family"],"size":model["size"],
                            "task_group":"openbanking","task":task},
                    "valid":valid,
                    "rows":[{"paired_analysis_success":baseline},
                            {"paired_analysis_success":proposed}]}
        sample = [
            view(small, "bank_a", False, True),
            view(large, "bank_a", True, True),
            view(small, "bank_b", False, False),
            view(large, "bank_b", False, True, valid=False),
        ]
        item = next(x for x in scale.size_interactions(sample, self.models)
                    if x["family"] == "granite4.1")
        self.assertEqual(item["small"]["valid_pairs"], 2)
        self.assertEqual(item["large"]["valid_pairs"], 1)
        self.assertEqual(item["common_valid_tasks"], 1)
        self.assertEqual(item["matched_small_cdea_delta"], 1.0)
        self.assertEqual(item["matched_large_cdea_delta"], 0.0)
        self.assertEqual(item["interaction_small_minus_large"], 1.0)
        self.assertFalse(item["fully_observed"])

    def test_digest_and_model_registry(self):
        entries=[{"name":m["name"],"digest":"sha256:"+m["label"]} for m in self.models]
        client=lambda url,timeout:{"models":entries}
        results=scale.identities_for(self.plan,self.models,"http://127.0.0.1:11434",client=client)
        self.assertEqual(len(results),8)
        bad=entries[:-1]
        with self.assertRaises(LookupError):
            scale.identities_for(self.plan,self.models,"http://127.0.0.1:11434",
                                 client=lambda url,timeout:{"models":bad})

    def test_missing_pairs_are_not_failures(self):
        entries=[{"name":m["name"],"digest":"sha256:"+m["label"]} for m in self.models]
        identities=scale.identities_for(self.plan,self.models,"http://127.0.0.1:11434",
                                        client=lambda url,timeout:{"models":entries})
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)/"scale_trial"
            root.mkdir()
            mf=scale.manifest(root.name,self.plan,self.models,self.roster,self.schedule,identities,"sha")
            scale.pilot.atomic_json(root/"manifest.json",mf)
            result=scale.report_outputs(root,mf)
            self.assertEqual(result["valid_pairs"],0)
            self.assertEqual(result["not_started_pairs"],256)
            self.assertEqual(len(list(__import__("csv").DictReader((root/"results.csv").open(encoding="utf-8-sig")))),512)
            self.assertEqual(len(list(__import__("csv").DictReader((root/"pairs.csv").open(encoding="utf-8-sig")))),256)
            self.assertEqual(len(list(__import__("csv").DictReader((root/"summary.csv").open(encoding="utf-8-sig")))),64)
            self.assertTrue(all(x["interaction_small_minus_large"] is None for x in result["interactions"]))
            (root/"episodes"/self.schedule[0]["pair_id"]).mkdir(parents=True)
            result=scale.report_outputs(root,mf)
            self.assertEqual(result["invalid_pairs"],1)
            self.assertEqual(result["not_started_pairs"],255)

if __name__=="__main__":
    unittest.main()
