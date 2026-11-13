# Thesis Source Map

Dokumen ini memetakan tabel dan lampiran skripsi ke file implementasi, hasil turunan, dan arsip sumber. Nama kelompok yang digunakan dalam skripsi adalah **Main Study** (4 model Large) dan **Small-Model Study** (4 model Small). Nama file dan ID protokol teknis tetap dipertahankan agar data dapat ditelusuri.

## 1. Identitas arsip sumber

| Arsip | Isi | SHA-256 |
|---|---|---|
| `Dataset_CDEA_small_only.zip` | Paket sumber dan hasil turunan untuk Main Study dan Small-Model Study | `cccbb4608aab683d089341142c86644463e292b86f04e4d607a099bc3f7f7d5f` |
| `main_observation.zip` | 128 pasangan Large / 256 episode untuk Main Study | `74f48100b4dc6ae074573596dc87beed18770d4c3740f2c01f5efcd57a2d885c` |
| `scale_reference_small_v1.zip` | 128 pasangan Small / 256 episode untuk Small-Model Study; mencakup 128 `pair.json` | `3fd21228b1df5e65f8c6ffd5e117a12e7a3f7c978a514bbe4ef399df8a4c750b` |
| `source_archives/scale_reference_v4_full_source.zip` | Arsip Scale lengkap untuk audit sumber; bukan input Small-Model Study | `25d4ae4f6c595bb8658d6d0dcbf0b6017e3f2b9d0f1ce7de3b80d582eadbb0b5` |
| `Hasil_Analisis_CDEA_small_only.zip` | Paket ekspor tabel, grafik, dan analisis rinci Bab IV | `b681d9f5bb6098b5cec8dec154bbf7685ae00bfb88f15da2399aa2f3f300b404` |

**Catatan penyimpanan:** arsip ZIP mentah tidak disimpan dalam Git. Nama, ukuran, dan checksum dicatat di sini serta di `results/provenance.json`. File hasil turunan yang paling sering dirujuk tersedia langsung di folder `results/`. Untuk pemeriksaan episode, trace, AXTree, dan snapshot database, gunakan arsip sumber yang SHA-256-nya cocok dengan daftar di atas.

## 2. Pemetaan lampiran

| Bagian skripsi | File yang mendukung di repository | File sumber di dalam arsip |
|---|---|---|
| Lampiran A.1 – Daftar tugas | `config/main_taskset_v1.json`; `results/success_by_task.csv` | `main_observation/main_observation_v1/pairs.csv`; `derived/lampiran_E_per_task_32.csv` |
| Lampiran B.1 – Cakupan pengujian | `results/provenance.json`; `results/scale_small_only_manifest.json` | `DATASET_CDEA.json`; manifest Main dan `scale_reference_small_v1/manifest.json`; `derived/selected_pairs.csv` |
| Lampiran B.2 – Daftar model | `config/models.json`; `config/models_small_extension.json`; `results/scale_small_only_manifest.json` | `manifest.json` dan `model_digests.json` pada arsip Main dan Small |
| Lampiran B.3 – Parameter pelaksanaan | `config/main_plan.json`; `config/small_extension_plan.json`; `results/provenance.json` | `shared_parameters` pada manifest Main dan Small |
| Lampiran C – Pseudocode dan prompt | `scripts/browsergym/shared_policy.py`; `tests/test_shared_policy.py` | Implementasi kebijakan yang digunakan dalam repository |
| Lampiran D.1 – Hasil per model | `results/success_by_model.csv` | `derived/lampiran_D_per_model_8.csv` |
| Lampiran D.2–D.3 – Hasil perbandingan pasangan | `results/pair_outcomes.csv.gz`; `results/decision_comparison_by_group.csv` | `derived/selected_pairs.csv`; `pairs.csv` dan `episodes/{pair_id}/pair.json` pada arsip sumber |
| Lampiran E.1–E.3 – Hasil per tugas | `results/success_by_task.csv` | `derived/lampiran_E_per_task_32.csv` |
| Lampiran E.4 – Perbandingan kelompok model | `results/model_size_comparison_by_task.csv` | `derived/lampiran_E4_ukuran_model_32.csv` |
| Lampiran E.5 – Tugas dengan peningkatan Small lebih besar | `results/small_model_higher_uplift_tasks.csv` | `derived/analisis_peningkatan_cdea_small_5.csv` |
| Tabel 4.7 – Contoh tugas ketika Small unggul | `results/small_model_success_comparison_examples.csv` | `derived/tabel_4_7_small_menang_6.csv` |

## 3. Analisis rinci Bab IV

Notebook analisis utama hanya satu, yaitu `notebooks/main_analysis.ipynb`. Notebook tersebut membaca arsip Main dan Small-Model Study, lalu menghasilkan 6 tabel utama, 9 gambar, ringkasan statistik, dan file CSV analisis rinci.

Hasil ekspor yang disediakan dalam paket analisis mencakup folder:

- `Hasil_Analisis_CDEA/detailed_analysis/`
- `Hasil_Analisis_CDEA/tables/`
- `Hasil_Analisis_CDEA/figures/`
- `Hasil_Analisis_CDEA/summary/`

Untuk audit kasus per pasangan, gunakan `pair.json`, `episode/episode.json`, `browsergym/trace.jsonl`, berkas observasi AXTree, dan snapshot database di dalam arsip `scale_reference_small_v1.zip` atau `main_observation.zip`, sesuai kelompok pengujian.

## 4. Aturan konsistensi

1. **Main Study** berarti 4 model Large (8B–9B).
2. **Small-Model Study** berarti 4 model Small (3B–4B).
3. `cdea_small_extension_v1`, `small_extension_plan.json`, dan `models_small_extension.json` adalah ID atau nama teknis asli; jangan menggantinya pada kode atau nama file.
4. `Proposed` tetap menjadi label internal pada arsip dan kode untuk metode CDEA.
5. Persentase pada CSV publik dihitung dari jumlah keberhasilan menggunakan pembulatan `ROUND_HALF_UP` hingga 2 angka desimal. Arsip sumber tidak diubah.
6. Arsip Scale lengkap dipertahankan untuk provenance; hanya subset 128 pasangan Small yang digunakan untuk Small-Model Study.
