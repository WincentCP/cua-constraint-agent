"""Synthetic-only smoke test of the committed Colab notebook.

This does not create or claim WebArena benchmark results.
"""
import csv
import json
import os
import tempfile
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

REPO = Path(__file__).resolve().parents[1]
NOTEBOOK = json.loads((REPO / "notebooks" / "thesis_analysis.ipynb").read_text("utf-8"))
COLS = [
    "stage", "task_id", "model", "method", "technical_valid",
    "official_success", "official_status", "duration_ms", "actions",
    "probes", "model_calls", "run_id", "issue",
]
MODELS = ["qwen3.5-9b", "ministral3-8b", "granite4.1-8b", "xlam2-8b"]


def check_notebook(stage: str, empty: bool) -> None:
    with tempfile.TemporaryDirectory(prefix="cua-notebook-smoke-") as temp:
        old = Path.cwd()
        os.chdir(temp)
        try:
            task_ids = [279, 284, 323, 436, 506, 528] if stage == "pilot" else list(range(600, 632))
            rows = []
            for tid in task_ids:
                for i, model in enumerate(MODELS):
                    for method in ["Baseline", "Proposed"]:
                        success = (tid + i + int(method == "Proposed")) % 3 == 0
                        rows.append({
                            "stage": stage, "task_id": tid, "model": model,
                            "method": method, "technical_valid": not empty,
                            "official_success": success if not empty else "",
                            "official_status": ("success" if success else "failure") if not empty else "",
                            "duration_ms": 12000 + tid if not empty else "",
                            "actions": 4 if not empty else "",
                            "probes": 3 if not empty else "",
                            "model_calls": 5 if not empty else "",
                            "run_id": ("synthetic-" + str(tid) + "-" + model + "-" + method) if not empty else "",
                            "issue": "MISSING" if empty else "",
                        })
            for file, subset in [
                ("run-inventory.csv", rows),
                ("analysis-results.csv", [] if empty else rows),
            ]:
                with open(file, "w", encoding="utf-8", newline="") as handle:
                    writer = csv.DictWriter(handle, fieldnames=COLS)
                    writer.writeheader()
                    writer.writerows(subset)

            globals_for_notebook = {"__name__": "__main__", "display": lambda *_: None}
            for cell in NOTEBOOK["cells"]:
                if cell["cell_type"] == "code":
                    source = "".join(cell["source"])
                    exec(compile(source, "<colab-smoke>", "exec"), globals_for_notebook)
            assert Path("thesis_outputs.zip").is_file()
            folder = globals_for_notebook["OUTPUT"]
            assert (folder / "coverage_summary.csv").is_file()
            if empty:
                assert not (folder / "success_by_model.png").exists()
            else:
                assert (folder / "success_by_model.png").exists()
                assert (folder / "success_by_model.pdf").exists()
                assert (folder / "main_paired_mcnemar.csv").exists()
        finally:
            os.chdir(old)


if __name__ == "__main__":
    check_notebook("pilot", empty=True)
    check_notebook("main", empty=False)
    print("Notebook synthetic smoke passed (empty pilot and complete main).")
