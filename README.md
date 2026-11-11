# CDEA — Computer-Use Agent Research

Repository ini berisi implementasi **Constraint-Driven Evidence Acquisition (CDEA)** untuk Computer-Use Agent (CUA), konfigurasi eksperimen, serta alat analisis dan pengujian. Penelitian membandingkan Baseline *progress-score* dengan CDEA pada lingkungan OpenApps melalui BrowserGym.

## Struktur repository

| Lokasi | Isi |
|---|---|
| `config/` | Konfigurasi eksperimen, model, dan daftar tugas |
| `scripts/browsergym/` | Runner eksperimen, implementasi agen, dan kebijakan CDEA |
| `scripts/analysis/` | Audit arsip dan verifikasi notebook |
| `notebooks/` | Notebook analisis hasil penelitian |
| `tests/` | Pengujian kontrak dan fungsi secara offline |
| `docs/` | Panduan reproduksi, provenance data, dan template readiness yang dipakai runner |

## Data penelitian

Arsip sumber `main_observation.zip` dan `scale_reference.zip` **tidak disimpan di repository**. Simpan kedua arsip tersebut secara terpisah, lalu letakkan di direktori kerja saat menjalankan analisis. Paket dataset eksternal `Dataset_CDEA.zip` juga dapat digunakan jika tersedia.

Arsip berisi snapshot aplikasi dan data eksperimen. Sebelum membagikannya, periksa terlebih dahulu izin penggunaan, privasi, dan kelayakan distribusinya. File CSV hasil analisis juga tidak dilacak di Git; file tersebut dibuat ulang melalui notebook.

Rincian identitas dan pemeriksaan sumber data tersedia di [Data Provenance](docs/DATA_PROVENANCE.md).

## Menjalankan analisis

Pasang dependensi:

```powershell
python -m pip install -r requirements-analysis.txt
```

Audit arsip sumber:

```powershell
python scripts/analysis/audit_archives.py --main main_observation.zip --small scale_reference.zip --output archive_audit.json
```

Buka [`notebooks/main_analysis.ipynb`](notebooks/main_analysis.ipynb) di Jupyter atau Google Colab. Unggah `Dataset_CDEA.zip` atau kedua arsip sumber, lalu jalankan **Run All**.

Notebook menghasilkan folder `CDEA_Analysis_Results/` dan paket `CDEA_Analysis_Results.zip`, yang berisi grafik, tabel utama, analisis rinci, dan ringkasan statistik. Seluruh keluaran tersebut dikecualikan dari Git melalui `.gitignore`.

Panduan lengkap tersedia di [Reproducibility](docs/REPRODUCIBILITY.md).

## Pengujian offline

```powershell
python scripts/analysis/verify_notebook.py
python -m unittest discover -s tests -v
```

Pengujian notebook menggunakan data fixture sintetis. Hasil pengujian tersebut memeriksa alur kode dan format keluaran, bukan menggantikan perhitungan dari arsip penelitian asli.

## Menjalankan eksperimen baru (opsional)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_main.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_small_extension.ps1 -DryRun
```

Eksekusi penuh membutuhkan OpenApps, BrowserGym, Ollama, dan model yang sesuai. Folder hasil eksperimen disimpan secara lokal di `output/` dan tidak diunggah ke Git.

## Batas interpretasi

Perbandingan Main Large dan Scale Small bersifat eksploratori karena kedua sumber menggunakan revisi Agent Controller yang berbeda. Penelitian ini membandingkan CDEA dengan Baseline *progress-score* dan tidak menguji kondisi Vanilla. Perbedaan tindakan atau status evidence ledger tidak dengan sendirinya membuktikan kebenaran faktual seluruh informasi maupun hubungan sebab-akibat terhadap keberhasilan tugas.
