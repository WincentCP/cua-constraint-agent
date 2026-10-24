"""Static contracts for the self-contained notebook and selected source cohorts."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / "notebooks" / "cdea_main_scale_compact.ipynb"


class NotebookSourceContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
        cls.code = "\n".join("".join(c["source"]) for c in cls.notebook["cells"]
                             if c["cell_type"] == "code")
        cls.prose = "\n".join("".join(c["source"]) for c in cls.notebook["cells"]
                              if c["cell_type"] == "markdown")

    def test_seven_sections_and_code_cells(self):
        self.assertEqual(len(self.notebook["cells"]), 17)
        self.assertEqual(len([c for c in self.notebook["cells"] if c["cell_type"]=="code"]), 9)
        self.assertEqual(len([c for c in self.notebook["cells"] if c["cell_type"]=="markdown"]), 8)

    def test_selected_large_source_is_only_main(self):
        self.assertIn("find_archive('cdea_main_v1',MAIN_ZIP)",self.code)
        self.assertIn("large=main['valid'].copy()",self.code)
        self.assertIn("Large outcomes must come exclusively from Main",self.code)
        self.assertIn("small['pairs']=raw_scale['pairs'].loc[raw_scale['pairs']['size'].eq('small')]",self.code)
        self.assertIn("A Large checkpoint appeared in the selected Small cohort",self.code)

    def test_new_protocol_and_legacy_small_selector(self):
        self.assertIn("'cdea_small_extension_v1'"," ".join([self.code]))
        self.assertIn("'cdea_scale_v1'",self.code)
        self.assertIn("raw_scale['counts']['planned_pairs'] != 256",self.code)
        self.assertIn("raw_scale['counts']['planned_pairs'] != 128",self.code)
        self.assertIn("128",self.code)
        self.assertIn("Source-specific pair IDs collide",self.code)

    def test_no_new_scale_large_execution(self):
        runner = (ROOT / "scripts" / "browsergym" / "small_extension.py").read_text(encoding="utf-8")
        self.assertIn('"planned_matched_pairs":128',runner)
        self.assertNotIn("size_interactions",runner)
        self.assertNotIn("256 pairs, 512 episodes",runner)
        models = json.loads((ROOT/"config/models_small_extension.json").read_text(encoding="utf-8"))
        self.assertEqual(len(models),4)
        self.assertTrue(all(m["size"]=="small" for m in models))

    def test_primary_results_do_not_claim_independence(self):
        self.assertIn("origin_archive",self.code)
        self.assertIn("source_mapping",self.code)
        self.assertIn("raw_excluded",self.code)
        self.assertIn("controller_commit",self.code)


if __name__ == "__main__":
    unittest.main()
