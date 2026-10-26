# Analisis CDEA — Main Large dan Small historis

## Sumber yang digunakan

Notebook [`main_analysis.ipynb`](../notebooks/main_analysis.ipynb) menggunakan arsip Main dan Scale historis berikut.

| Kelompok | Arsip input | Varian model | Pasangan valid | Episode |
|---|---|---:|---:|---:|
| Main Large (8B–9B) | `main_observation.zip` | 4 | 128 | 256 |
| Scale Small (3B–4B) | `scale_reference.zip`, hanya `size=small` | 4 | 128 | 256 |
| **Perbandingan** | **Main Large + Scale Small** | **8** | **256** | **512** |

Kedua kelompok memakai 32 tugas OpenApps yang sama. Arsip Scale historis juga mencatat 128 pasangan Large, tetapi bagian tersebut **tidak dipakai** karena Main Large merupakan sumber tunggal untuk kelompok besar. Arsip sumber tidak diubah. Lihat [riwayat Scale](../legacy/full_scale_v1/docs/SCALE_REFERENCE_V4_ANALYSIS.md) untuk konteks historis.

Runner Small-only terbaru menghasilkan protokol `cdea_small_extension_v1`. Auditor arsip mendukung protokol tersebut, tetapi **notebook asli hanya menerima arsip Small berprotokol `cdea_scale_v1`**.

## Hasil dari arsip referensi

| Pengujian | Baseline | Proposed | Selisih absolut |
|---|---:|---:|---:|
| Main — informasi perbankan | 10/20 (50,00%) | 18/20 (90,00%) | +40,00 poin persentase |
| Main — keseluruhan | 73/128 (57,03%) | 97/128 (75,78%) | +18,75 poin persentase |
| Scale Small | 43/128 (33,59%) | 54/128 (42,19%) | +8,59 poin persentase |
| **Gabungan** | **116/256 (45,31%)** | **151/256 (58,98%)** | **+13,67 poin persentase** |

Hasil pasangan gabungan: keduanya berhasil **105**, hanya Proposed berhasil **46**, hanya Baseline berhasil **11**, dan keduanya gagal **94** (total **256**).

Manfaat CDEA pada Small lebih rendah sebesar **10,16 poin persentase** dibandingkan Large dalam data yang dianalisis. Perbandingan ini bersifat eksploratori; uji *exact McNemar* tidak disesuaikan untuk pengujian berganda maupun pengelompokan berdasarkan tugas.

## Perbandingan konfigurasi sumber

| Parameter | Main Large | Scale Small |
|---|---|---|
| Controller commit | `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1` | `ff655d1389bc84aa8100b6321220f5ec01c4e3b4` |
| OpenApps commit | `6e6782794433c60468d65ac75bc3f03c56007f8c` | Sama |
| Seed | 233 | 233 |
| Max actions | 40 | 40 |
| Temperature | 0 | 0 |
| num_predict | 640 | 640 |
| num_ctx | Tidak dicantumkan dalam parameter bersama | 8192 |

Revisi pengendali berbeda, informasi konfigurasi Main tidak sepenuhnya identik, . Karena itu, hasil ukuran model tidak dapat dikaitkan secara kausal hanya dengan jumlah parameter. Perbedaan tindakan tidak otomatis membuktikan keberhasilan memperoleh informasi.

## Menjalankan analisis

Ikuti [panduan reproduksi](REPRODUCIBILITY.md) menggunakan kedua ZIP di atas. Notebook menghasilkan **6 tabel utama, 9 grafik, 20 CSV rinci**, dan metadata sumber. Hasil tersebut merupakan perhitungan ulang dari arsip yang diberikan, bukan eksekusi baru atau verifikasi independen atas asal runtime.
