# Reproduksi Analisis CDEA

## Sumber data

- `main_observation.zip` — Main Large, protokol `cdea_main_v1`, 128 pasangan.
- `scale_reference.zip` — arsip historis Scale, protokol `cdea_scale_v1`, 256 pasangan; notebook memilih hanya 128 pasangan Small.

Nama file tersebut adalah alias input; identitas dan hash dari arsip asli tetap berlaku. Hasil Large berasal dari Main dan tidak dihitung dua kali.

## Menjalankan notebook asli

```powershell
python -m pip install -r requirements-analysis.txt
python scripts/analysis/audit_archives.py --main main_observation.zip --small scale_reference.zip --output archive_audit.json
```

Buka [`notebooks/main_analysis.ipynb`](../notebooks/main_analysis.ipynb) di Jupyter atau Colab, unggah kedua ZIP (atau `Dataset_CDEA.zip`), kemudian **Run All**. Notebook tidak memodifikasi ZIP sumber.

Keluaran: 6 tabel utama, 9 gambar berwarna, 23 CSV analisis rinci, serta ringkasan statistik dan pemetaan gambar/tabel. Nama output mengikuti notebook asli.

## Pengujian kode

```powershell
python -m unittest discover -s tests -v
python scripts/analysis/verify_notebook.py
```

Uji integrasi menjalankan notebook dengan fixture. Auditor arsip dapat memeriksa format `cdea_small_extension_v1` secara terpisah. **Notebook asli hanya menerima** `cdea_scale_v1` sebagai sumber Small; hasil Small-only baru tidak otomatis dapat dibuka dalam notebook yang sama.

## Hasil referensi

| Kelompok | Baseline | Proposed |
|---|---:|---:|
| Main Large | 73/128 (57,03%) | 97/128 (75,78%) |
| Small historis | 43/128 (33,59%) | 54/128 (42,19%) |
| Informasi perbankan | 10/20 (50,00%) | 18/20 (90,00%) |

Perbandingan dua sumber menggunakan revisi pengendali yang berbeda. Nilai statistik bersifat eksploratori dan uji CI tidak membuktikan sendiri provenance eksekusi runtime historis.
