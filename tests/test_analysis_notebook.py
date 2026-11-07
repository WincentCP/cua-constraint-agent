"""Kontrak notebook analisis yang disediakan peneliti."""
import ast
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / 'notebooks/main_analysis.ipynb'


class AnalysisNotebookContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notebook = json.loads(NOTEBOOK.read_text(encoding='utf-8'))
        cls.code = '\n'.join(''.join(c['source']) for c in cls.notebook['cells']
                             if c['cell_type'] == 'code')
        cls.prose = '\n'.join(''.join(c['source']) for c in cls.notebook['cells']
                              if c['cell_type'] == 'markdown')

    def test_source_notebook_is_complete(self):
        # Notebook final memuat 50 sel (25 kode, 25 markdown).
        # Hitung jumlah aktual, jangan mempertahankan angka dari revisi lama.
        self.assertEqual(len(self.notebook['cells']), 50)
        self.assertEqual(sum(c['cell_type'] == 'code' for c in self.notebook['cells']), 25)
        for cell in self.notebook['cells']:
            if cell['cell_type'] == 'code':
                ast.parse(''.join(cell['source']))

    def test_tables_and_figures_are_ordered(self):
        tables = re.findall(r'^### Tabel (4\.\d+)\b', self.prose, re.M)
        figures = re.findall(r'^### Gambar (4\.\d+)\b', self.prose, re.M)
        self.assertEqual(tables, [f'4.{n}' for n in range(1, 7)])
        self.assertEqual(figures, [f'4.{n}' for n in range(1, 10)])
        self.assertIn('Gambar_4_9', self.code)
        self.assertIn('Tabel_4_6', self.code)

    def test_selected_source_and_exclusions(self):
        for token in ('main_observation.zip', 'scale_reference.zip',
                      'cdea_main_v1', 'cdea_scale_v1', "'size'].eq('small')",
                      'raw_excluded', 'origin_archive', 'Main Large', 'Scale Small'):
            self.assertIn(token, self.code)
        # Notebook asli belum mendukung format Small-only dari runner baru.
        self.assertNotIn('cdea_small_extension_v1', self.code)


if __name__ == '__main__':
    unittest.main()
