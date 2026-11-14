# Peta Repository dan Keluaran Eksperimen CDEA

Dokumen ini menjelaskan perbedaan antara source code yang dilacak Git, artefak eksperimen yang dibuat runner saat dijalankan, arsip data yang dipakai untuk analisis, dan keluaran notebook. Tujuannya agar setiap file dapat ditelusuri tanpa menyamakan arsip historis dengan output yang baru dibuat.

## 1. Empat lapisan yang berbeda

| Lapisan | Lokasi | Isi |
|---|---|---|
| Source code dan konfigurasi | `scripts/`, `config/`, `tests/`, `.github/` | Implementasi runner, aturan eksperimen, konfigurasi model, dan pengujian. |
| Artefak run | `output/` (lokal, diabaikan Git) | Manifest, identitas model, hasil episode, trace, observasi, snapshot server/database, dan ringkasan runner. |
| Arsip input analisis | Paket dataset terpisah | Arsip Main dan Small yang dibaca notebook; bukan dibuat ulang oleh notebook. |
| Keluaran analisis | `CDEA_Analysis_Results/` (lokal) dan `results/` (tracked) | Grafik/tabel notebook dan tabel turunan terpilih yang dipublikasikan di repository. |

Paket demonstrasi sidang dapat mengemas beberapa lapisan tersebut dalam satu ZIP untuk memudahkan pemeriksaan. Struktur ZIP kemasan tidak harus sama dengan struktur source repository karena fungsinya berbeda.

## 2. Lokasi keluaran setiap runner

Semua lokasi di bawah relatif terhadap root repository. Folder baru muncul setelah runner benar-benar dijalankan; perintah `--dry-run` tidak menghasilkan episode eksperimen.

### Development / matched development

Runner: `scripts/browsergym/matched_dev.py`  
Wrapper: `scripts/browsergym/run_matched_dev.ps1`

```text
output/browsergym/matched_dev/<run_id>/
├── pair.json
├── Baseline/
│   ├── episode/
│   │   ├── episode.json
│   │   └── browsergym/
│   │       ├── trace.jsonl
│   │       └── observations/
│   └── server/
│       ├── server.log
│       ├── logs/
│       └── databases/
└── Proposed/
    ├── episode/
    └── server/
```

Ini adalah artefak Development/matched development. Kode secara eksplisit menandainya bukan hasil Pilot atau Main. Jangan mengubah labelnya menjadi Pilot/PoC tanpa bukti run dan protokol yang sesuai.

### Pilot

Runner: `scripts/browsergym/pilot.py`  
Wrapper: `scripts/browsergym/run_pilot.ps1`

```text
output/pilot/<pilot_id>/
├── manifest.json
├── model_digests.json
├── results.csv
├── summary.csv
└── episodes/
    └── <pair_id>/
        ├── pair.json
        ├── Baseline/
        │   ├── episode/
        │   └── server/
        └── Proposed/
            ├── episode/
            └── server/
```

Pilot adalah tahap eksploratori dan manifest-nya menandai `not_main_experiment=true`. Output Pilot tidak boleh digabungkan ke hasil Main.

### Main Study

Runner: `scripts/browsergym/main.py`  
Wrapper: `scripts/browsergym/run_main.ps1`

```text
output/main/<main_id>/
├── manifest.json
├── model_digests.json
├── results.csv
├── pairs.csv
├── summary.csv
├── analysis.json
└── episodes/
    └── <pair_id>/
        ├── pair.json
        ├── Baseline/
        │   ├── episode/
        │   └── server/
        └── Proposed/
            ├── episode/
            └── server/
```

Main menggunakan readiness gate. Manifest dan artefak run Main baru dibuat setelah pemeriksaan dan persetujuan yang dipersyaratkan lolos.

### Small-Model Study

Runner: `scripts/browsergym/small_extension.py`  
Wrapper: `scripts/browsergym/run_small_extension.ps1`

```text
output/small_extension/<scale_id>/
├── manifest.json
├── model_digests.json
├── results.csv
├── pairs.csv
├── summary.csv
├── analysis.json
└── episodes/
    └── <pair_id>/
        ├── pair.json
        ├── Baseline/
        │   ├── episode/
        │   └── server/
        └── Proposed/
            ├── episode/
            └── server/
```

Small-Model Study menggunakan konfigurasi dan ID tersendiri. Jangan menyamakan arsip Scale penuh dengan subset Small-only yang dipakai sebagai input analisis.

## 3. Input dan keluaran notebook

Notebook analisis: `notebooks/main_analysis.ipynb`.

Input utama yang didukung untuk analisis skripsi:
- `main_observation.zip` — arsip Main Study;
- `scale_reference_small_v1.zip` — arsip Small-only; atau
- `Dataset_CDEA_small_only.zip` — paket yang memuat arsip yang diperlukan beserta metadata/checksum.

Notebook membaca dan memeriksa arsip tersebut, lalu menghasilkan:

```text
CDEA_Analysis_Results/
├── figures/             # grafik Bab IV
├── tables/              # tabel utama Bab IV
├── detailed_analysis/   # CSV analisis rinci
└── summary/             # ringkasan statistik

CDEA_Analysis_Results.zip
```

Keluaran notebook bersifat lokal dan tidak dilacak Git. Notebook tidak menjalankan ulang episode BrowserGym; ia menganalisis arsip eksperimen yang sudah tersedia.

## 4. Apa yang disimpan di folder results/

`results/` berisi tabel turunan terpilih, provenance, dan dokumentasi interpretasi yang dilacak Git. Contohnya:
- `success_by_model.csv` dan `success_by_task.csv`;
- `pair_outcomes.csv.gz`;
- `decision_comparison_by_group.csv`;
- tabel perbandingan ukuran model dan contoh tugas;
- `provenance.json` dan `README.md`.

Skrip `scripts/analysis/build_public_results.py` dapat membangun ulang tabel publik tertentu dari paket dataset yang diberikan. Skrip tersebut tidak menjalankan ulang eksperimen.

## 5. Pengujian dan batas bukti

- `tests/` memeriksa kontrak dan perilaku kode secara offline.
- `scripts/analysis/verify_notebook.py` menjalankan notebook menggunakan fixture sintetis untuk memastikan proses analisis dan ekspor bekerja. Fixture ini bukan data penelitian.
- GitHub Actions menjalankan pemeriksaan kode, tes offline, dry-run, dan verifikasi notebook berbasis fixture. CI tidak menjalankan browser, server OpenApps, atau inferensi Ollama.
- Keberadaan runner Pilot/Main/Small di repository membuktikan implementasi kodenya tersedia, bukan bahwa semua run historis tahap tersebut tersimpan di paket arsip.
- Arsip penelitian yang dipakai dalam analisis skripsi dibatasi pada 128 pasangan Main dan 128 pasangan Small (256 pasangan/512 episode). Arsip itu tidak mewakili seluruh riwayat retry, PoC, Pilot, atau run lain.

Untuk pemeriksaan sidang, telusuri secara berurutan: **runner dan konfigurasi → manifest/episode archive yang tersedia → input notebook → keluaran notebook → tabel turunan di `results/`**. Jika salah satu artefak tidak tersedia, nyatakan sebagai tidak tersedia; jangan membuat placeholder yang tampak seperti hasil eksperimen.
