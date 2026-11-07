# Peta Kode CDEA

Panduan singkat untuk menemukan kode penting. Lokasi implementasi tidak dipindahkan agar impor, pengujian, dan jejak eksperimen tetap konsisten.

## 1. Persiapan & Experiment Controller

| Lokasi | Fungsi |
|---|---|
| [`config/main_plan.json`](../config/main_plan.json) | Parameter Main Study |
| [`config/main_taskset_v1.json`](../config/main_taskset_v1.json) | Daftar 32 tugas OpenApps |
| [`config/models.json`](../config/models.json) | Empat varian model Large |
| [`config/small_extension_plan.json`](../config/small_extension_plan.json) dan [`config/models_small_extension.json`](../config/models_small_extension.json) | Empat varian model Small |
| **[`scripts/browsergym/main.py`](../scripts/browsergym/main.py)** | Jadwal dan hasil pengujian Main |
| [`scripts/browsergym/small_extension.py`](../scripts/browsergym/small_extension.py) | Runner pengujian Small |

Satu *paired run* menggunakan tugas dan varian model yang sama untuk episode Baseline serta Proposed.

## 2. Agent Controller & CDEA

| Lokasi | Fungsi |
|---|---|
| **[`scripts/browsergym/matched_dev.py`](../scripts/browsergym/matched_dev.py)** | Mengelola siklus pengamatan, permintaan model, dan tindakan |
| **[`scripts/browsergym/shared_policy.py`](../scripts/browsergym/shared_policy.py)** | Memilih tindakan sesuai strategi Baseline atau Proposed |
| [`scripts/browsergym/ollama_preflight.py`](../scripts/browsergym/ollama_preflight.py) | Memeriksa model Ollama sebelum eksekusi |

Baseline memprioritaskan *progress score*; Proposed memprioritaskan *constraint coverage*, kemudian *forward cost* saat tersedia kandidat pencarian yang dapat dibandingkan.

## Peta Persamaan Skripsi

Penomoran berikut mengikuti skripsi versi November 2026. Rumus pemeringkatan berada pada pengendali agen; rumus hasil pengujian dihitung dari pasangan yang tercatat pada notebook. Komentar `Persamaan (1)`, `(2)`, dan `(3)` juga tersedia langsung pada `choose_action()`.

| Persamaan | Konsep | Lokasi implementasi |
|---|---|---|
| (1) | Baseline: `progress_score` tertinggi, lalu urutan awal | [`shared_policy.py`, `choose_action()`](../scripts/browsergym/shared_policy.py) |
| (2) | Cakupan ID `may_answer` valid dan unik berstatus `UNKNOWN` | [`shared_policy.py`, `_probe_candidates()` dan `choose_action()`](../scripts/browsergym/shared_policy.py) |
| (3) | CDEA: cakupan terbesar, lalu `forward_cost` terkecil, lalu urutan awal | [`shared_policy.py`, `choose_action()`](../scripts/browsergym/shared_policy.py) |
| (4) | Tingkat keberhasilan dari episode valid | [`main_analysis.ipynb`](../notebooks/main_analysis.ipynb), ringkasan pasangan |
| (5) | Selisih keberhasilan CDEA dan Baseline | [`main_analysis.ipynb`](../notebooks/main_analysis.ipynb), `paired_stats()` |
| (6) | Uji McNemar eksak pada pasangan tidak sejalan | [`main_analysis.ipynb`](../notebooks/main_analysis.ipynb), `binomtest()`; analisis eksploratori |
| (7) | Perbandingan manfaat Small dan Large | [`main_analysis.ipynb`](../notebooks/main_analysis.ipynb), analisis beda kelompok dan bootstrap tugas |

**Catatan:** Pemilihan CDEA bersifat leksikografis, **bukan** optimasi rasio coverage/biaya ataupun implementasi greedy set-cover klasik secara penuh. Sebelum menghitung cakupan, `_probe_candidates()` memvalidasi ID constraint dan menghapus duplikasi (`sorted(set(ids))`). Pengujian ulang notebook memakai data simulasi uji, bukan bukti independen eksekusi historis.

## 3. Lingkungan & Pemeriksaan

| Lokasi | Fungsi |
|---|---|
| **[`scripts/browsergym/isolated_openapps.py`](../scripts/browsergym/isolated_openapps.py)** | Lingkungan OpenApps terpisah untuk setiap episode |
| [`scripts/browsergym/evaluator_controls.py`](../scripts/browsergym/evaluator_controls.py) | Pemeriksaan kontrol evaluator |
| [`scripts/browsergym/inspect_pair.py`](../scripts/browsergym/inspect_pair.py) | Diagnostik hasil dan tindakan pasangan |

## 4. Analisis & Verifikasi

| Lokasi | Fungsi |
|---|---|
| **[`notebooks/main_analysis.ipynb`](../notebooks/main_analysis.ipynb)** | Analisis data, 6 tabel, dan 9 grafik |
| [`scripts/analysis/audit_archives.py`](../scripts/analysis/audit_archives.py) | Audit konsistensi arsip Main dan Small |
| [`scripts/analysis/verify_notebook.py`](../scripts/analysis/verify_notebook.py) | Uji notebook menggunakan fixture |
| [`docs/REPRODUCIBILITY.md`](REPRODUCIBILITY.md) | Cara menjalankan pemeriksaan |

### Urutan membaca

```text
main.py
  ↓
matched_dev.py
  ↓
shared_policy.py
  ↓
isolated_openapps.py
  ↓
small_extension.py
  ↓
main_analysis.ipynb
```

Prioritaskan **`shared_policy.py`**, **`matched_dev.py`**, dan **`main.py`** untuk menjelaskan kontribusi penelitian.

File `tests/` berisi pengujian otomatis, `docs/` menyimpan protokol dan keterlacakan, sedangkan `legacy/` memuat materi historis yang bukan bagian runner aktif.
