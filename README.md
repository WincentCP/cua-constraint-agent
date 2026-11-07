# CDEA — Computer-Use Agent Research

Constraint-Driven Evidence Acquisition (CDEA) memprioritaskan tindakan pencarian informasi berdasarkan kebutuhan tugas yang belum terpenuhi serta perkiraan langkah lanjutan. Penelitian membandingkan **Baseline** dan **Proposed (CDEA)** pada OpenApps melalui BrowserGym; tidak ada pelatihan ulang bobot model.

## Peta kode — 4 kelompok

| Kelompok | File utama | Peran |
|---|---|---|
| **1. Persiapan & eksperimen** | [`config/`](config/), [`main.py`](scripts/browsergym/main.py), [`small_extension.py`](scripts/browsergym/small_extension.py) | Konfigurasi tugas, varian model, dan jadwal pengujian |
| **2. Agen & CDEA** | [`matched_dev.py`](scripts/browsergym/matched_dev.py), [`shared_policy.py`](scripts/browsergym/shared_policy.py) | Interaksi agen dan pemilihan tindakan Baseline/Proposed |
| **3. Lingkungan & pemeriksaan** | [`isolated_openapps.py`](scripts/browsergym/isolated_openapps.py), [`evaluator_controls.py`](scripts/browsergym/evaluator_controls.py) | Isolasi episode dan kontrol evaluator |
| **4. Analisis & verifikasi** | [`main_analysis.ipynb`](notebooks/main_analysis.ipynb), [`scripts/analysis/`](scripts/analysis/) | Statistik, grafik, pemeriksaan hasil |

**Mulai di sini:** [Notebook Bab IV](notebooks/main_analysis.ipynb) · [Cara menjalankan analisis](docs/REPRODUCIBILITY.md) · [Peta kode](docs/CODE_MAP.md) · [Daftar tugas](config/main_taskset_v1.json).

**Rumus skripsi:** [Peta Persamaan (1)–(7)](docs/CODE_MAP.md#peta-persamaan-skripsi) menjelaskan lokasi kode pemeringkatan dan analisis statistik tanpa mengubah eksperimen historis.

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

Angka tersebut berasal dari arsip referensi, bukan eksekusi baru. **Peneliti mengonfirmasi nilai `num_ctx=8192` pada Main historis (2026-10-28).** Manifest dan episode Main asli tidak mencatat parameter ini; karena itu konfirmasi disimpan sebagai [metadata terpisah](data/NUM_CTX_MAIN_CONFIRMATION.json) dan manifest salinan beranotasi di `Dataset_CDEA.zip`. Nilai Small 8192 tercatat dalam sumber aslinya. Runner untuk **eksekusi baru** juga menggunakan `num_ctx=8192` secara eksplisit. Pengaturan baru tidak dijadikan bukti historis.

## Data dan lampiran digital

Paket data pendukung terpisah bernama **`Dataset_CDEA.zip`** (17 berkas: dua arsip sumber, notebook salinan, CSV hasil terpilih, metadata, dan audit). Paket ini disiapkan terpisah dan **belum diunggah ke repository**; ikuti [panduan unggah dan verifikasi checksum](data/README.md) untuk menjadikannya tersedia pada `data/Dataset_CDEA.zip`. [Pemetaan nama berkas skripsi](docs/THESIS_ARTIFACTS.md).

Notebook dalam paket dan [notebook utama repo](notebooks/main_analysis.ipynb) dapat menghitung ulang hasil dari dua arsip sumber. Arsip Main dan Scale tidak diedit, serta arsip Scale Large tidak dihitung sebagai pasangan tambahan.

## Notebook analisis

Notebook utama adalah **[`notebooks/main_analysis.ipynb`](notebooks/main_analysis.ipynb)**, diselaraskan dari notebook Bab IV terbaru yang diberikan peneliti. Hanya satu notebook analisis utama ditempatkan pada folder aktif.

Notebook ini menggunakan protokol `cdea_main_v1` dan `cdea_scale_v1`. Unggah `Dataset_CDEA.zip` (atau dua arsip `main_observation.zip` dan `scale_reference.zip`), lalu jalankan **Run All** di Jupyter atau Google Colab. Keluaran mencakup 6 tabel utama, 9 grafik berwarna, dan hingga **26 tabel rinci** (25 pada fixture tanpa contoh probe di trace), termasuk enam tabel tambahan untuk catatan pembimbing.

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

Sumber Main dan Scale menggunakan revisi pengendali berbeda, sehingga perbandingan ukuran model bersifat eksploratori. Perbedaan tindakan saja tidak membuktikan keberhasilan akuisisi informasi. Pemeriksaan format arsip maupun CI tidak merupakan bukti independen bahwa episode historis dijalankan secara langsung.

Rujukan: [Protokol Main](docs/MAIN_PROTOCOL_V1.md) · [Protokol Small](docs/SMALL_EXTENSION_PROTOCOL.md) · [Asal data](docs/DATA_PROVENANCE.md) · [Analisis sumber](docs/MAIN_SMALL_EXTENSION_ANALYSIS.md).

## Analisis tambahan catatan pembimbing

Notebook `notebooks/main_analysis.ipynb` memuat analisis tambahan berbasis **tugas** (uji tanda eksak), median/IQR dan penyebab penghentian episode, pasangan Baseline-only, serta status ledger dalam trace. Keluaran tersebut adalah **analisis ulang arsip lama**, bukan eksperimen baru. Lihat [catatan verifikasi dan batas klaim](docs/THESIS_REVIEW_ANALYSIS_2026-11-05.md) dan [cara menjalankan notebook](docs/REPRODUCIBILITY.md).

**Interpretasi untuk revisi skripsi:** Skenario B membatasi klaim pada CDEA versus Baseline *progress-score*; tidak ada pembanding Vanilla. Protokol lima tugas bank dipertahankan, tetapi uji tanda berbasis lima tugas memberi p = 0,125. Selisih hasil pada model Small tidak boleh ditafsirkan hanya akibat ukuran parameter karena sumber controller berbeda. Pencocokan kutipan AXTree bukan validasi kebenaran faktual suatu constraint.
