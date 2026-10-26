# Peta Kode CDEA — Mulai dari Sini

Dokumen ini mengelompokkan **file penting** menurut alur penelitian. Lokasi file tidak dipindahkan agar impor, pengujian, dokumentasi, dan identitas kode eksperimen tetap konsisten.

## 1. Penyiapan & Experiment Controller

| File | Fungsi |
|---|---|
| [`config/main_plan.json`](../config/main_plan.json) | Parameter dan protokol Main Study |
| [`config/main_taskset_v1.json`](../config/main_taskset_v1.json) | Daftar 32 tugas OpenApps |
| [`config/models.json`](../config/models.json) | Empat checkpoint Large |
| [`config/small_extension_plan.json`](../config/small_extension_plan.json) dan [`models_small_extension.json`](../config/models_small_extension.json) | Konfigurasi 4 checkpoint Small |
| **[`scripts/browsergym/main.py`](../scripts/browsergym/main.py)** | Menjadwalkan dan mencatat *paired runs* Main |
| [`scripts/browsergym/small_extension.py`](../scripts/browsergym/small_extension.py) | Pengujian Small-only |

**Intinya:** 1 *paired run* = 1 tugas × 1 checkpoint yang mencakup episode *Baseline* dan *Proposed*.

## 2. Agent Controller & Metode CDEA

| File | Fungsi |
|---|---|
| **[`scripts/browsergym/matched_dev.py`](../scripts/browsergym/matched_dev.py)** | Menjalankan interaksi agen dengan model dan lingkungan |
| **[`scripts/browsergym/shared_policy.py`](../scripts/browsergym/shared_policy.py)** | Logika pemilihan tindakan *Baseline* dan *Proposed* |
| [`scripts/browsergym/ollama_preflight.py`](../scripts/browsergym/ollama_preflight.py) | Memeriksa identitas dan ketersediaan checkpoint |

**Intinya:** pada kesempatan pencarian yang memenuhi syarat, *Baseline* memprioritaskan *progress score*, sedangkan *Proposed* mengutamakan *constraint coverage*, lalu *forward cost*.

## 3. Lingkungan & Pemeriksaan Episode

| File | Fungsi |
|---|---|
| **[`scripts/browsergym/isolated_openapps.py`](../scripts/browsergym/isolated_openapps.py)** | Mengelola server dan basis data terpisah untuk episode |
| [`scripts/browsergym/evaluator_controls.py`](../scripts/browsergym/evaluator_controls.py) | Uji kontrol terhadap evaluator resmi, bukan pengganti evaluator BrowserGym |
| [`scripts/browsergym/inspect_pair.py`](../scripts/browsergym/inspect_pair.py) | Memeriksa rekaman dan diagnostik sebuah pasangan |

**Intinya:** tindakan dijalankan melalui BrowserGym pada OpenApps. Hasil dan status episode disimpan untuk pemeriksaan pasangan.

## 4. Analisis & Verifikasi Bab IV

| File | Fungsi |
|---|---|
| **[`notebooks/cdea_bab_iv.ipynb`](../notebooks/cdea_bab_iv.ipynb)** | Statistik, 6 tabel, dan 9 gambar Bab IV |
| [`scripts/analysis/audit_archives.py`](../scripts/analysis/audit_archives.py) | Memeriksa identitas serta konsistensi arsip |
| [`scripts/analysis/verify_notebook.py`](../scripts/analysis/verify_notebook.py) | Menguji notebook pada fixture 2 protokol Small |
| [`docs/BAB_IV_OUTPUTS.md`](BAB_IV_OUTPUTS.md) | Pemetaan tabel dan gambar terhadap subbab skripsi |

**Intinya:** notebook membaca `main_observation.zip` dan `scale_reference.zip` (atau arsip Small-only yang sesuai); ia tidak menjalankan ulang episode.

## Urutan membaca untuk menjelaskan kode ke dosen

```text
1. main.py                 Jadwal dan pengendalian eksperimen
2. matched_dev.py          Siklus interaksi Agent Controller
3. shared_policy.py        Perbedaan inti Baseline vs Proposed
4. isolated_openapps.py    Lingkungan episode terisolasi
5. small_extension.py      Pengujian 4 checkpoint Small
6. cdea_bab_iv.ipynb       Statistik, tabel, dan grafik Bab IV
```

**3 file yang perlu paling dikuasai:** `shared_policy.py`, `matched_dev.py`, dan `main.py`.

## File pendukung lainnya

- `tests/`: pengujian kontrak dan perilaku kode, bukan episode riset.
- `docs/`: protokol, sumber data, reproducibility, dan hubungan dengan skripsi.
- `legacy/full_scale_v1/`: rancangan Scale historis, bukan runner utama saat ini.
- `scripts/browsergym/run_main.ps1` dan `run_small_extension.ps1`: titik masuk eksekusi melalui PowerShell.

Lihat [README utama](../README.md) untuk perintah penggunaan dan [panduan reproduksi](REPRODUCIBILITY.md) untuk menjalankan analisis.
