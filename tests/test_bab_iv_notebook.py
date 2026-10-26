"""Kontrak notebook Bab IV tanpa memerlukan dataset penelitian."""
import ast
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / 'notebooks/cdea_bab_iv.ipynb'


class BabIVNotebookContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.notebook = json.loads(NOTEBOOK.read_text(encoding='utf-8'))
        cls.code = '\n'.join(''.join(c['source']) for c in cls.notebook['cells']
                             if c['cell_type'] == 'code')
        cls.prose = '\n'.join(''.join(c['source']) for c in cls.notebook['cells']
                              if c['cell_type'] == 'markdown')

    def test_notebook_clean_and_compiles(self):
        self.assertEqual(len(self.notebook['cells']), 49)
        for cell in self.notebook['cells']:
            if cell['cell_type'] == 'code':
                self.assertEqual(cell.get('outputs'), [])
                self.assertIsNone(cell.get('execution_count'))
                ast.parse(''.join(cell['source']))

    def test_chapter_four_numbering(self):
        tables = re.findall(r'^### Tabel (4\.\d+)\b', self.prose, re.M)
        figures = re.findall(r'^### Gambar (4\.\d+)\b', self.prose, re.M)
        self.assertEqual(tables, [f'4.{n}' for n in range(1, 7)])
        self.assertEqual(figures, [f'4.{n}' for n in range(1, 10)])
        self.assertIn('Gambar_4_9', self.code)
        self.assertIn('Tabel_4_6', self.code)

    def test_source_contract(self):
        for token in ('main_observation.zip', 'scale_reference.zip', 'cdea_main_v1',
                      'cdea_scale_v1', 'cdea_small_extension_v1',
                      "'size'].eq('small')", 'raw_excluded', 'origin_archive'):
            self.assertIn(token, self.code)
        self.assertIn('Scale Small', self.code)
        self.assertIn('Main Large', self.code)


if __name__ == '__main__':
    unittest.main()
