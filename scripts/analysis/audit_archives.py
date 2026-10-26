"""Audit konsistensi arsip Main dan Small tanpa mengubah sumber."""
import argparse
import csv
from hashlib import sha256
import io
import json
from pathlib import Path
import zipfile

PROTOCOLS = {'main': {'cdea_main_v1'},
             'small': {'cdea_scale_v1', 'cdea_small_extension_v1'}}
METHODS = {'Baseline', 'Proposed'}


def read_source(path, role):
    if not path.is_file():
        raise FileNotFoundError(path)
    with zipfile.ZipFile(path) as source:
        if source.testzip() is not None:
            raise ValueError(f'ZIP rusak: {path}')
        matches = [name for name in source.namelist()
                   if name.endswith('manifest.json') and name.count('/') <= 1]
        if len(matches) != 1:
            raise ValueError('Arsip harus memiliki tepat 1 manifest.json')
        prefix = matches[0][:-len('manifest.json')]
        manifest = json.loads(source.read(matches[0]))
        protocol = manifest.get('protocol')
        if protocol not in PROTOCOLS[role]:
            raise ValueError(f'Protokol {role} tidak didukung: {protocol}')

        def rows(name):
            raw = source.read(prefix + name).decode('utf-8-sig')
            return list(csv.DictReader(io.StringIO(raw)))

        pairs, episodes = rows('pairs.csv'), rows('results.csv')

    count = int(manifest.get('planned_pairs', -1))
    expected = 128 if role == 'main' or protocol == 'cdea_small_extension_v1' else 256
    if count != expected or len(pairs) != count or len(manifest.get('pairs', [])) != count:
        raise ValueError(f'Jumlah pasangan {role} tidak konsisten')
    if int(manifest.get('planned_episodes', -1)) != 2 * count:
        raise ValueError(f'Jadwal episode {role} tidak konsisten')
    roster = [p.get('pair_id') for p in manifest['pairs']]
    ids = [p.get('pair_id') for p in pairs]
    if len(set(ids)) != count or set(ids) != set(roster):
        raise ValueError(f'Identitas pasangan {role} tidak cocok')
    slots = [(r.get('pair_id'), r.get('method')) for r in episodes]
    if len(slots) != len(set(slots)) or not all(m in METHODS and p in ids for p, m in slots):
        raise ValueError(f'Identitas episode {role} tidak cocok')
    if len(episodes) != 2 * count:
        raise ValueError(f'Baris episode {role} harus mengikuti semua slot terjadwal')

    eps = {slot: ep for slot, ep in zip(slots, episodes)}
    selected, total_valid = [], 0
    for pair in pairs:
        valid = str(pair.get('paired_valid', '')).strip().lower() in {'true', '1'}
        if valid:
            total_valid += 1
            for method, key in [('Baseline', 'baseline_success'), ('Proposed', 'proposed_success')]:
                ep = eps.get((pair['pair_id'], method))
                if ep is None:
                    raise ValueError(f'Episode {method} hilang pada {pair["pair_id"]}')
                expected_success = str(pair.get(key, '')).strip().lower()
                recorded = str(ep.get('paired_analysis_success', '')).strip().lower()
                if expected_success not in {'true', 'false', '1', '0'} or recorded != expected_success:
                    raise ValueError(f'Keberhasilan pasangan dan episode tidak cocok: {pair["pair_id"]}')
                official = str(ep.get('official_success_raw', '')).strip().lower()
                if official and official != recorded:
                    raise ValueError(f'Hasil evaluator berbeda: {pair["pair_id"]}')
        if role == 'main' or pair.get('size') == 'small':
            selected.append(pair)
    if role == 'small' and protocol == 'cdea_small_extension_v1' and len(selected) != count:
        raise ValueError('Protokol Small-only memuat pasangan Large')
    if len(selected) != 128:
        raise ValueError('Harus ada 128 pasangan terjadwal per kelompok terpilih')
    groups = {(p['task_group'], p['task']) for p in selected}
    checkpoints = {p['model_label'] for p in selected}
    if len(groups) != 32 or len(checkpoints) != 4:
        raise ValueError('Roster tugas atau checkpoint tidak sesuai 32 × 4')
    return {
        'archive': path.name, 'sha256': sha256(path.read_bytes()).hexdigest(),
        'protocol': protocol, 'planned_pairs': count, 'valid_pairs': total_valid,
        'selected_pairs': len(selected), 'selected_valid_pairs': sum(
            str(p.get('paired_valid', '')).lower() in ('true', '1') for p in selected),
        'excluded_large_pairs': count - len(selected),
        'task_ids': sorted(groups), 'checkpoints': sorted(checkpoints),
    }


def audit(main_path, small_path):
    main = read_source(main_path, 'main')
    small = read_source(small_path, 'small')
    if main['task_ids'] != small['task_ids']:
        raise ValueError('Task set Main dan Small berbeda')
    return {
        'main': {k: v for k, v in main.items() if k != 'task_ids'},
        'small': {k: v for k, v in small.items() if k != 'task_ids'},
        'unique_tasks': 32, 'selected_pairs_total': 256,
        'scope': 'Konsistensi arsip; bukan attestasi runtime independen',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--main', default='main_observation.zip', type=Path)
    parser.add_argument('--small', default='scale_reference.zip', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    report = audit(args.main, args.small)
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text + '\n', encoding='utf-8')
    print(text)


if __name__ == '__main__':
    main()
