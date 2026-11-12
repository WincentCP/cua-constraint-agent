"""Uji integrasi notebook asli memakai data fixture, tanpa episode penelitian."""
import csv
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import zipfile

import nbformat
from nbconvert.preprocessors import ExecutePreprocessor
from audit_archives import audit

ROOT = Path(__file__).resolve().parents[2]
NOTEBOOK = ROOT / 'notebooks/main_analysis.ipynb'
GROUPS = [('bank_information', 5), ('cross_app_workflow', 18), ('primitive_control', 9)]
FAMILIES = ('qwen3.5', 'ministral3', 'granite4.1', 'xlam2')


def csv_bytes(rows):
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue().encode('utf-8')


def make_archive(path, protocol, include_large):
    """Fixture berbasis schema runner; seluruh outcome khusus uji otomatis."""
    sizes = ('small', 'large') if include_large else (('large',) if protocol == 'cdea_main_v1' else ('small',))
    pairs, episodes = [], []
    index = 0
    for size in sizes:
        for family, large_size, small_size in zip(FAMILIES, ('9b', '8b', '8b', '8b'), ('4b', '3b', '3b', '3b')):
            label = family + '-' + (large_size if size == 'large' else small_size)
            for category, count in GROUPS:
                for task_idx in range(count):
                    index += 1
                    pair_id = f'pair_{index:03d}'
                    task = f'test_fixture_{category}_{task_idx:02d}'
                    b = (task_idx + index // 5) % 4 != 0
                    p = (task_idx + index // 7) % 6 != 0
                    pair = {
                        'pair_id': pair_id, 'task_group': 'fixture', 'task': task,
                        'stratum': category, 'model_label': label, 'family': family, 'size': size,
                        'pair_status': 'paired_scale_completed', 'paired_valid': 'true',
                        'baseline_success': str(b).lower(), 'proposed_success': str(p).lower(),
                        'comparable_probe_decisions': 1, 'policy_action_divergences': int(b != p),
                    }
                    pairs.append(pair)
                    for method, success in [('Baseline', b), ('Proposed', p)]:
                        episodes.append({
                            'pair_id': pair_id, 'method': method, 'task_group': 'fixture',
                            'task': task, 'stratum': category, 'model_label': label,
                            'official_success_raw': str(success).lower(),
                            'paired_analysis_success': str(success).lower(),
                            'episode_valid': 'true', 'analysis_included': 'true',
                            'steps': 6 if method == 'Baseline' else 5,
                            'model_calls': 3, 'model_seconds': 12.4,
                            'total_seconds': 31.6 if method == 'Baseline' else 30.1,
                            'repair_requests': 0, 'end_reason': 'environment_ended',
                            'episode_artifact': '',
                        })
    manifest = {
        'protocol': protocol, 'planned_pairs': len(pairs), 'planned_episodes': len(episodes),
        'controller_git_commit': 'TEST_FIXTURE_ONLY', 'openapps_git_commit': 'TEST_FIXTURE_ONLY',
        'shared_parameters': {'seed': 233, 'max_steps': 40},
        'pairs': [{'pair_id': p['pair_id']} for p in pairs],
    }
    with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('manifest.json', json.dumps(manifest))
        archive.writestr('pairs.csv', csv_bytes(pairs))
        archive.writestr('results.csv', csv_bytes(episodes))


def verify(protocol, package_mode=False):
    with TemporaryDirectory(prefix='cdea_notebook_fixture_') as directory:
        work = Path(directory)
        make_archive(work / 'main_observation.zip', 'cdea_main_v1', include_large=False)
        make_archive(work / 'scale_reference.zip', protocol, include_large=protocol == 'cdea_scale_v1')
        report = audit(work / 'main_observation.zip', work / 'scale_reference.zip')
        assert report['selected_pairs_total'] == 256
        nb = nbformat.read(NOTEBOOK, as_version=4)
        # The production notebook defaults to the Small-only archive name; fixtures use the legacy test filename.\n        for cell in nb.cells:\n            if cell.cell_type == 'code' and "SCALE_ZIP = 'scale_reference_small_v1.zip'" in cell.source:\n                cell.source = cell.source.replace(\n                    "SCALE_ZIP = 'scale_reference_small_v1.zip'",\n                    "SCALE_ZIP = 'scale_reference.zip'"\n                )\n                break\n        if package_mode:
            # Simulasikan paket pengguna: 2 arsip sumber berada di dalam Dataset_CDEA/.
            package_path = work / 'Dataset_CDEA(1).zip'
            with zipfile.ZipFile(package_path, 'w', compression=zipfile.ZIP_DEFLATED) as package:
                package.write(work / 'main_observation.zip', 'Dataset_CDEA/main_observation.zip')
                package.write(work / 'scale_reference.zip', 'Dataset_CDEA/scale_reference.zip')
            (work / 'main_observation.zip').unlink()
            (work / 'scale_reference.zip').unlink()
            found = False
            for cell in nb.cells:
                if cell.cell_type == 'code' and "DATASET_PAKET = ''" in cell.source:
                    cell.source = cell.source.replace(
                        "DATASET_PAKET = ''",
                        "DATASET_PAKET = " + repr(str(package_path)))
                    found = True
                    break
            assert found, 'DATASET_PAKET setting was not found in notebook'
        ExecutePreprocessor(timeout=180, kernel_name='python3').preprocess(
            nb, {'metadata': {'path': str(work)}})
        outputs = work / 'CDEA_Analysis_Results'
        figures = sorted((outputs / 'figures').glob('Gambar_4_*.png'))
        tables = sorted((outputs / 'tables').glob('Tabel_4_*.csv'))
        expected_figures = [f'Gambar_4_{i}.png' for i in range(1, 10)]
        expected_tables = [f'Tabel_4_{i}.csv' for i in range(1, 7)]
        assert [p.name for p in figures] == expected_figures
        assert [p.name for p in tables] == expected_tables
        assert not list((outputs / 'summary').glob('*pemetaan*.json'))
        archive_path = work / 'CDEA_Analysis_Results.zip'
        assert archive_path.is_file()
        with zipfile.ZipFile(archive_path) as result_zip:
            assert any(name.startswith('CDEA_Analysis_Results/figures/Gambar_4_1.png')
                       for name in result_zip.namelist())
        assert (outputs / 'summary' / 'ringkasan_statistik.csv').is_file()
        # The fixture has no episode JSON traces or selected probe examples.
        # The notebook intentionally skips its optional 17_probe_examples.csv.
        detailed = list((outputs / 'detailed_analysis').glob('*.csv'))
        assert len(detailed) == 25
        # Enam keluaran tambahan sesuai catatan dosen; 17_probe_examples opsional.
        required = {
            '22_task_level_differences.csv',
            '23_task_level_sign_tests.csv',
            '24_episode_efficiency_distribution.csv',
            '25_episode_termination_reasons.csv',
            '26_cdea_loss_pairs.csv',
            '27_ledger_trace_scope.csv',
        }
        actual = {p.name for p in detailed}
        assert required.issubset(actual), sorted(required - actual)
        with (outputs / 'detailed_analysis' / '23_task_level_sign_tests.csv').open(
                encoding='utf-8') as f:
            tests = list(csv.DictReader(f))
        assert {(t['study'], t['cohort']) for t in tests} == {
            ('Main Large', 'primary_bank_5_tasks'),
            ('Main Large', 'all_32_tasks'),
            ('Scale Small', 'all_32_tasks'),
        }
        for t in tests:
            assert (int(t['improved_tasks']) + int(t['worsened_tasks'])
                    + int(t['tied_tasks']) == int(t['unique_tasks']))
            assert 0 <= float(t['exact_sign_test_p_two_sided']) <= 1
        with (outputs / 'detailed_analysis' / '24_episode_efficiency_distribution.csv').open(
                encoding='utf-8') as f:
            efficiencies = list(csv.DictReader(f))
        assert len(efficiencies) == 4
        assert all(int(e['episode_rows']) == 128 and int(e['max_steps_setting']) == 40
                   for e in efficiencies)
        assert all(int(e['episodes_reaching_cap']) == 0 for e in efficiencies)
        with (outputs / 'detailed_analysis' / '25_episode_termination_reasons.csv').open(
                encoding='utf-8') as f:
            terminations = list(csv.DictReader(f))
        assert sum(int(e['episodes']) for e in terminations) == 512
        assert not (outputs / 'detailed_analysis' / '17_probe_examples.csv').exists()
        print(f'PASS {protocol} (package={package_mode}): 6 tabel, 9 gambar, 128 pasangan Small')


def verify_small_only_archive():
    # Run the full notebook against the 128-pair Small-only protocol.
    verify('cdea_small_extension_v1')

if __name__ == '__main__':
    verify('cdea_scale_v1', package_mode=True)
    verify_small_only_archive()
