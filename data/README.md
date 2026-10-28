# Dataset dan Lampiran Digital CDEA

Berkas yang dirujuk skripsi adalah **`Dataset_CDEA.zip`**. Berkas asli lengkap disiapkan sebagai paket terpisah; **arsip ZIP belum diunggah ke branch `main` repo ini** pada pemeriksaan 2026-10-28. Informasi di sini tidak boleh dianggap sebagai tautan data yang sudah tersedia di repo.

Untuk melengkapi repo, unggah paket `Dataset_CDEA.zip` yang diberikan bersama hasil audit skripsi ke path **`data/Dataset_CDEA.zip`** melalui GitHub `Add file > Upload files`. Berkas paket berukuran sekitar 11,6 MB, di bawah batas unggahan per file GitHub Web (25 MiB). Setelah unggah, verifikasi SHA-256:

```text
9d7e6cbd838b42690d69318aec75f97cb0bb1887cc0bde01f1ab4db0535aac1d  Dataset_CDEA.zip
```

**Tabel ringkas di repo saat ini:** [Hasil 8 model](derived/lampiran_D_per_model_8.csv) dan [Hasil 32 tugas](derived/lampiran_E_per_task_32.csv). Keduanya merupakan turunan ringkas dari arsip, bukan pengganti trace dan dataset lengkap.

**Isi ZIP** (nama sesuai Lampiran F pada skripsi):

| Berkas | Isi |
|---|---|
| `main_observation.zip` | Arsip sumber Main Large (128 pasangan, 256 episode) |
| `scale_reference.zip` | Arsip sumber Scale historis (256 pasangan: Large dan Small) |
| `Notebook_CDEA.ipynb` | Notebook yang dapat membaca paket ZIP dan menandai sumber `num_ctx` |
| `NUM_CTX_MAIN_CONFIRMATION.json` | Konfirmasi peneliti (2026-10-28): Main menggunakan `num_ctx=8192` |
| `manifest_main_researcher_amended.json` | Salinan manifest Main dengan `num_ctx=8192`, bertanda konfirmasi setelah eksperimen; bukan manifest asli |
| `DATASET_CDEA.json` | Identitas dan checksum sumber |
| `AUDIT_REPORT.json` | Audit struktur dan rekonsiliasi pasangan |
| `LAMPIRAN_ANALISIS.json` | Checksum CSV turunan |
| `README_LAMPIRAN.txt` | Panduan isi paket |
| `SHA256SUMS.txt` | Daftar checksum |
| `derived/selected_pairs.csv` | 256 pasangan dari Main Large + Scale Small |
| `derived/selected_results.csv` | 512 episode terpilih |
| `derived/lampiran_D_per_model_8.csv` | Hasil per 8 model |
| `derived/lampiran_E_per_task_32.csv` | Hasil per 32 tugas |
| `derived/lampiran_E4_ukuran_model_32.csv` | Perbandingan hasil per tugas dan ukuran |
| `derived/tabel_4_7_small_menang_6.csv` | 6 tugas ketika Small unggul pada setidaknya satu metode |
| `derived/analisis_peningkatan_cdea_small_5.csv` | 5 tugas dengan perubahan keberhasilan CDEA lebih besar pada Small |

Kedua sumber asli **dipertahankan byte-for-byte**. Model Large dalam arsip Scale **tidak** dihitung ulang sebagai pengujian independen dalam analisis gabungan.

| Sumber | SHA-256 sumber historis |
|---|---|
| `main_observation.zip` | `74f48100b4dc6ae074573596dc87beed18770d4c3740f2c01f5efcd57a2d885c` |
| `scale_reference.zip` | `052ecf15e2466109175153022baa7a1007a8a88c7358307823f85c3947b38f96` |

**Konfigurasi berdasarkan konfirmasi peneliti:** `num_ctx` Main Large = **8192 token** (dikonfirmasi peneliti pada 2026-10-28), Small = **8192 token** (tercatat pada manifest historis). Perbedaan asal pencatatan harus tetap dinyatakan: nilai Main tidak ada pada manifest/episode asli, sehingga disajikan lewat berkas konfirmasi dan salinan manifest teranotasi. Kedua arsip sumber tidak diubah; verifikasi arsip bukan bukti independen eksekusi live historis.

Cara penggunaan dan reproduksi tercatat dalam [panduan analisis](../docs/REPRODUCIBILITY.md). Setelah paket diunggah, tautan unduhnya adalah `data/Dataset_CDEA.zip` di repo privat (memerlukan izin akses pembaca).
