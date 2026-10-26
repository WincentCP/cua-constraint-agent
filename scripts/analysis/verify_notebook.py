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


def verify(protocol):
    with TemporaryDirectory(prefix='cdea_notebook_fixture_') as directory:
        work = Path(directory)
        make_archive(work / 'main_observation.zip', 'cdea_main_v1', include_large=False)
        make_archive(work / 'scale_reference.zip', protocol, include_large=protocol == 'cdea_scale_v1')
        report = audit(work / 'main_observation.zip', work / 'scale_reference.zip')
        assert report['selected_pairs_total'] == 256
        nb = nbformat.read(NOTEBOOK, as_version=4)
        ExecutePreprocessor(timeout=180, kernel_name='python3').preprocess(
            nb, {'metadata': {'path': str(work)}})
        outputs = work / 'hasil_analisis_cdea'
        figures = sorted((outputs / 'figures').glob('Gambar_4_*.png'))
        tables = sorted((outputs / 'tables').glob('Tabel_4_*.csv'))
        expected_figures = [f'Gambar_4_{i}.png' for i in range(1, 10)]
        expected_tables = [f'Tabel_4_{i}.csv' for i in range(1, 7)]
        assert [p.name for p in figures] == expected_figures
        assert [p.name for p in tables] == expected_tables
        assert not list((outputs / 'summary').glob('*pemetaan*.json'))
        assert (outputs / 'summary' / 'ringkasan_statistik.csv').is_file()
        assert len(list((outputs / 'detailed_analysis').glob('*.csv'))) >= 20
        print(f'PASS {protocol}: 6 tabel, 9 gambar, 128 pasangan Small')


def verify_small_only_archive():
    # Audit arsip Small-only tanpa memaksa notebook asli membacanya.
    with TemporaryDirectory(prefix='cdea_small_audit_fixture_') as directory:
        work = Path(directory)
        make_archive(work / 'main_observation.zip', 'cdea_main_v1', include_large=False)
        make_archive(work / 'scale_reference.zip', 'cdea_small_extension_v1', include_large=False)
        report = audit(work / 'main_observation.zip', work / 'scale_reference.zip')
        assert report['small']['selected_pairs'] == 128
        assert report['small']['excluded_large_pairs'] == 0
        print('PASS cdea_small_extension_v1: audit schema Small-only')


if __name__ == '__main__':
    verify('cdea_scale_v1')
    verify_small_only_archive()
