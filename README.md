# CDEA — Computer-Use Agent Research

Constraint-Driven Evidence Acquisition (CDEA) memprioritaskan tindakan pencarian informasi berdasarkan kebutuhan tugas yang belum terpenuhi serta perkiraan langkah lanjutan. Penelitian membandingkan **Baseline** dan **Proposed (CDEA)** pada OpenApps melalui BrowserGym; tidak ada pelatihan ulang bobot model.

## Peta kode — 4 kelompok

| Kelompok | File utama | Peran |
|---|---|---|
| **1. Persiapan & eksperimen** | [`config/`](config/), [`main.py`](scripts/browsergym/main.py), [`small_extension.py`](scripts/browsergym/small_extension.py) | Konfigurasi tugas, varian model, dan jadwal pengujian |
| **2. Agen & CDEA** | [`matched_dev.py`](scripts/browsergym/matched_dev.py), [`shared_policy.py`](scripts/browsergym/shared_policy.py) | Interaksi agen dan pemilihan tindakan Baseline/Proposed |
| **3. Lingkungan & pemeriksaan** | [`isolated_openapps.py`](scripts/browsergym/isolated_openapps.py), [`evaluator_controls.py`](scripts/browsergym/evaluator_controls.py) | Isolasi episode dan kontrol evaluator |
| **4. Analisis & verifikasi** | [`main_analysis.ipynb`](notebooks/main_analysis.ipynb), [`scripts/analysis/`](scripts/analysis/) | Statistik, grafik, pemeriksaan hasil |

**[Buka panduan file dan urutan membaca kode](docs/CODE_MAP.md).**

## Rancangan dan sumber hasil

| Kelompok | Sumber | Tugas | Varian model | Pasangan | Episode |
|---|---|---:|---:|---:|---:|
| Large (8B–9B) | `main_observation.zip` | 32 | 4 | 128 | 256 |
| Small (3B–4B) | bagian Small dari `scale_reference.zip` | 32 | 4 | 128 | 256 |
| **Analisis gabungan** | Main Large + Scale Small | **32 unik** | **8** | **256** | **512** |

Perbandingan ukuran model menggunakan hasil Large dari Main satu kali; rekaman Large historis pada arsip Scale tidak dimasukkan ulang.

| Hasil tercatat | Baseline | Proposed | Selisih absolut |
|---|---:|---:|---:|
| Main — informasi perbankan | 10/20 (50,00%) | 18/20 (90,00%) | +40,00 poin persentase |
| Main — semua tugas | 73/128 (57,03%) | 97/128 (75,78%) | +18,75 poin persentase |
| Small — semua tugas | 43/128 (33,59%) | 54/128 (42,19%) | +8,59 poin persentase |

Angka tersebut berasal dari arsip referensi, bukan eksekusi baru.

## Notebook analisis

Notebook utama adalah **[`notebooks/main_analysis.ipynb`](notebooks/main_analysis.ipynb)**, salinan identik dari file analisis yang disediakan peneliti. Tidak ada versi notebook lain dalam folder aktif.

Notebook ini menggunakan protokol `cdea_main_v1` dan `cdea_scale_v1`. Unggah `main_observation.zip` dan `scale_reference.zip` tanpa mengekstrak, lalu jalankan **Run All** di Jupyter atau Google Colab. Keluaran mencakup 6 tabel utama, 9 grafik berwarna, dan 23 tabel rinci.

```powershell
python -m pip install -r requirements-analysis.txt
python scripts/analysis/audit_archives.py --main main_observation.zip --small scale_reference.zip --output archive_audit.json
python scripts/analysis/verify_notebook.py
python -m unittest discover -s tests -v
```

`verify_notebook.py` menggunakan data fixture untuk menguji notebook dan tidak menjalankan episode penelitian. Auditor arsip juga dapat membaca hasil runner Small-only berprotokol `cdea_small_extension_v1`, tetapi notebook asli belum mendukung input protokol tersebut secara langsung. Lihat [panduan reproduksi](docs/REPRODUCIBILITY.md).

## Eksekusi baru (opsional)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_small_extension.ps1 -DryRun
```

Pengujian baru membutuhkan instalasi OpenApps, BrowserGym, Ollama, dan model terkait. Protokol serta identitas hasil eksperimen terdahulu tidak diubah oleh dokumentasi atau notebook.

## Batasan interpretasi

Sumber Main dan Scale menggunakan revisi pengendali berbeda. Tugas berulang antarvarian model dan keluarga xLAM memiliki perbedaan arsitektur. Karena itu, perbandingan ukuran model bersifat eksploratori; perubahan tindakan saja tidak membuktikan pencarian informasi yang benar. Pemeriksaan format arsip maupun CI tidak merupakan bukti independen bahwa episode historis dijalankan secara langsung.

Rujukan: [Protokol Main](docs/MAIN_PROTOCOL_V1.md) · [Protokol Small](docs/SMALL_EXTENSION_PROTOCOL.md) · [Asal data](docs/DATA_PROVENANCE.md) · [Analisis sumber](docs/MAIN_SMALL_EXTENSION_ANALYSIS.md).
