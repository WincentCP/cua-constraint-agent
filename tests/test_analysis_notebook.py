"""Contracts for the single official CDEA analysis notebook."""
import ast
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / "notebooks" / "main_analysis.ipynb"


class AnalysisNotebookContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
        cls.code = "\n".join("".join(c["source"]) for c in cls.notebook["cells"]
                             if c["cell_type"] == "code")
        cls.prose = "\n".join("".join(c["source"]) for c in cls.notebook["cells"]
                              if c["cell_type"] == "markdown")

    def test_exactly_one_notebook_and_valid_python_cells(self):
        notebooks = list((ROOT / "notebooks").glob("*.ipynb"))
        self.assertEqual(notebooks, [NOTEBOOK])
        self.assertEqual(len(self.notebook["cells"]), 50)
        self.assertEqual(sum(c["cell_type"] == "code" for c in self.notebook["cells"]), 25)
        for cell in self.notebook["cells"]:
            if cell["cell_type"] == "code":
                ast.parse("".join(cell["source"]))

    def test_tables_figures_and_output_names(self):
        tables = re.findall(r"^### Tabel (4\.\d+)\b", self.prose, re.M)
        figures = re.findall(r"^### Gambar (4\.\d+)\b", self.prose, re.M)
        self.assertEqual(tables, [f"4.{n}" for n in range(1, 7)])
        self.assertEqual(figures, [f"4.{n}" for n in range(1, 10)])
        self.assertIn("Gambar_4_9", self.code)
        self.assertIn("Tabel_4_6", self.code)
        self.assertIn("Path('analysis_results')", self.code)
        self.assertIn("analysis_results.zip", self.code)

    def test_clean_dataset_inputs_and_historical_protocol_only(self):
        for token in (
            "main_study.zip",
            "small_model_study.zip",
            "dataset_bundle.zip",
            "cdea_main_v1",
            "cdea_small_study",
            "Main Study",
            "Small-Model Study",
        ):
            self.assertIn(token, self.code)
        self.assertNotIn("audit_only", self.code)
        self.assertNotIn("CDEA_Analysis_Results", self.code)

    def test_trace_outputs_are_part_of_official_notebook(self):
        for token in ("29_failure_trace_audit", "cause_verified", "policy_override_steps"):
            self.assertIn(token, self.code)
        self.assertEqual(
            self.notebook["metadata"].get("cdea_revision"),
            "main_small_study_two_archives_single_notebook",
        )


if __name__ == "__main__":
    unittest.main()
