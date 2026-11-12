# Hasil Penelitian

Folder ini berisi tabel hasil turunan untuk skripsi CDEA. Tabel diekstrak dari paket `Dataset_CDEA_small_only.zip` dan dicocokkan dengan catatan pasangan pada arsip sumber. Arsip mentah tidak disimpan di repository.

Dalam kode dan arsip, metode CDEA menggunakan label internal `Proposed`. Dengan demikian, kolom `proposed` pada file CSV merujuk pada CDEA.

## 1. Cakupan data terpilih

| Sumber | Protokol | Isi arsip sumber | Data yang digunakan |
|---|---|---:|---:|
| `main_observation.zip` | `cdea_main_v1` | 128 pasangan Large / 256 episode | 128 pasangan Large / 256 episode |
| `scale_reference_small_v1.zip` | `cdea_small_extension_v1` | 128 pasangan Small / 256 episode | 128 pasangan Small / 256 episode |

Arsip sumber Scale lengkap (`scale_reference.zip`, `cdea_scale_v1`) tetap berisi 256 pasangan dan 512 episode (128 Small + 128 Large). Arsip analisis `scale_reference_small_v1.zip` adalah subset yang hanya memuat 128 pasangan Small. Pasangan Large dari arsip sumber tidak disalin ke subset ini dan tetap tersedia di arsip sumber lengkap untuk audit.

Dataset terpilih berisi:
- 256 pasangan pengujian;
- 512 episode;
- 32 tugas unik; dan
- 8 varian model (4 Large dan 4 Small).

Distribusi tugas terdiri atas 9 tugas dasar, 18 tugas lintas aplikasi, dan 5 tugas informasi perbankan.

## 2. Ringkasan keberhasilan

| Kelompok | Pasangan | Baseline | CDEA | Selisih |
|---|---:|---:|---:|---:|
| Main Study — Large | 128 | 73/128 (57,03%) | 97/128 (75,78%) | +18,75 pp |
| Small-Model Extension — Small | 128 | 43/128 (33,59%) | 54/128 (42,19%) | +8,59 pp |

### Analisis tingkat tugas

| Kelompok | Tugas membaik | Tugas memburuk | Tidak berubah | Uji tanda dua sisi | Interval task-cluster bootstrap 95% |
|---|---:|---:|---:|---:|---:|
| Main Large | 11 | 0 | 21 | p = 0,00098 | 9,38–29,69 pp |
| Scale Small | 10 | 5 | 17 | p = 0,30176 | 0,00–17,97 pp |

Unit analisis inferensial adalah tugas unik, bukan 128 pasangan model–tugas yang dianggap independen. Empat model pada setiap kelompok menjalankan tugas yang sama sehingga hasilnya memiliki pengelompokan berdasarkan tugas.

### Kelompok fokus informasi perbankan

Main Study mencakup 5 tugas informasi perbankan yang dijalankan pada 4 model Large, sehingga terdapat 20 pasangan model–tugas:
- Baseline: 10/20 berhasil (50,00%).
- CDEA: 18/20 berhasil (90,00%).
- Uji tanda tingkat tugas: p = 0,125.

Angka 20 pasangan digunakan untuk ringkasan keberhasilan, sedangkan analisis inferensial tingkat tugas menggunakan 5 tugas unik. Hasil ini belum menunjukkan peningkatan yang signifikan secara statistik pada tingkat tugas.

## 3. Keputusan pencarian informasi dan evidence ledger

- **Main Study:** 48 pasangan memiliki keputusan pencarian yang dapat dibandingkan; 33 di antaranya menunjukkan tindakan berbeda antara Baseline dan CDEA.
- **Small-Model Extension:** 75 pasangan memiliki keputusan yang dapat dibandingkan; 49 di antaranya menunjukkan tindakan berbeda.
- **Evidence ledger Main:** terdapat 96 pembaruan berstatus `SATISFIED` dengan kutipan yang terlihat pada accessibility tree (AXTree).
- Dari 96 pembaruan tersebut, 40 peristiwa informasi perbankan juga sesuai dengan pemeriksaan fakta sederhana pada snapshot database. Sebanyak 56 lainnya hanya dapat diperiksa berdasarkan keterlihatan kutipan.
- Pada arsip Small terpilih tidak ditemukan pembaruan evidence ledger.

Keterlihatan kutipan pada AXTree menunjukkan bahwa kutipan tercatat dalam pengamatan antarmuka. Hal tersebut tidak otomatis membuktikan kebenaran semantik informasi atau terpenuhinya seluruh constraint.

## 4. Efisiensi pada pasangan yang sama-sama berhasil

| Kelompok | Pasangan kedua metode berhasil | Selisih rata-rata tindakan CDEA terhadap Baseline | Selisih rata-rata waktu CDEA terhadap Baseline |
|---|---:|---:|---:|
| Main Large | 72 | −0,19 tindakan | −1,30 detik |
| Scale Small | 33 | +0,06 tindakan | +1,14 detik |

Nilai negatif berarti CDEA menggunakan lebih sedikit tindakan atau waktu daripada Baseline. Analisis ini hanya mencakup pasangan ketika kedua metode sama-sama berhasil; hasilnya tidak menggambarkan efisiensi seluruh episode.

## 5. Daftar file

| File | Isi | Sumber turunan |
|---|---|---|
| `success_by_model.csv` | Jumlah dan persentase keberhasilan Baseline dan CDEA untuk 8 model | `derived/lampiran_D_per_model_8.csv` |
| `success_by_task.csv` | Jumlah dan persentase keberhasilan untuk masing-masing 32 tugas, digabungkan pada 8 varian model | `derived/lampiran_E_per_task_32.csv` |
| `model_size_comparison_by_task.csv` | Jumlah model Large dan Small yang berhasil pada setiap tugas dan metode | `derived/lampiran_E4_ukuran_model_32.csv` |
| `small_model_higher_uplift_tasks.csv` | 5 tugas dengan peningkatan CDEA yang lebih besar pada Small daripada Large | `derived/analisis_peningkatan_cdea_small_5.csv` |
| `small_model_success_comparison_examples.csv` | 6 tugas ketika Small memiliki lebih banyak model berhasil daripada Large pada setidaknya satu metode | `derived/tabel_4_7_small_menang_6.csv` |
| `pair_outcomes.csv.gz` | Hasil tingkat pasangan untuk 128 Main Large dan 128 Scale Small terpilih, termasuk indikator keputusan pencarian per pasangan | `derived/selected_pairs.csv`, Main `results.csv`, dan Scale `pairs.csv` |
| `decision_comparison_by_group.csv` | Ringkasan jumlah pasangan dengan keputusan sebanding dan tindakan berbeda pada setiap kelompok | Main `results.csv` dan Scale `pairs.csv` |
| `provenance.json` | Identitas arsip, checksum, konfigurasi, commit eksperimen, seleksi data, dan hasil pemeriksaan | Manifest arsip sumber |

### Arti kolom utama

- `baseline_n` dan `proposed_n`: jumlah keberhasilan.
- `baseline_pct` dan `proposed_pct`: persentase keberhasilan.
- `delta_pp`: selisih persentase CDEA dikurangi Baseline dalam poin persentase.
- `baseline_large`, `baseline_small`, `proposed_large`, dan `proposed_small`: jumlah model yang berhasil pada masing-masing kelompok untuk tugas terkait, bukan persentase.
- `paired_valid`: status validitas pasangan menurut catatan arsip.
- `comparable_probe_decisions`: indikator pasangan bernilai 1 jika terdapat keputusan pencarian yang dapat dibandingkan, dan 0 jika tidak.
- `policy_action_divergences`: indikator pasangan bernilai 1 jika terdapat tindakan berbeda pada keputusan yang dapat dibandingkan, dan 0 jika tidak.

Pada Main Study, kedua indikator tersebut diambil dari `results.csv`. Nilainya tercatat pada kedua baris episode (Baseline dan Proposed) untuk pasangan yang sama. Skrip `build_public_results.py` memeriksa kesamaan kedua catatan dan menghitungnya satu kali pada tingkat pasangan. Pada Scale Small, indikator dicocokkan langsung dengan `pairs.csv` arsip Scale. Ringkasan jumlah pasangan tersedia di `decision_comparison_by_group.csv`.

Persentase dalam file turunan mengikuti nilai yang diekspor dari tabel sumber dan ditampilkan dengan presisi dua angka desimal. Jangan menghitung ulang atau mengganti angka sumber tanpa memperbarui proses pengolahan dan pemeriksaan kesesuaiannya.

### Membangun ulang tabel pasangan dan keputusan

Dengan paket dataset yang sama, jalankan:

```bash
python scripts/analysis/build_public_results.py --package "Dataset_CDEA_small_only.zip" --output-dir results
```

Skrip akan berhenti jika SHA-256 paket tidak cocok dengan nilai pada `results/provenance.json`. Skrip menghasilkan `pair_outcomes.csv.gz` dan `decision_comparison_by_group.csv`; file sumber eksperimen tidak diubah.

## 6. Identitas dan checksum arsip sumber

| Arsip | ID arsip | Ukuran | SHA-256 |
|---|---|---:|---|
| `main_observation.zip` | `main_observation_v1` | 3.971.324 byte | `74f48100b4dc6ae074573596dc87beed18770d4c3740f2c01f5efcd57a2d885c` |
| `scale_reference.zip` (sumber lengkap) | `scale_reference_v4` | 23.343.948 byte | `25d4ae4f6c595bb8658d6d0dcbf0b6017e3f2b9d0f1ce7de3b80d582eadbb0b5` |
| `scale_reference_small_v1.zip` (subset Small-only) | `scale_reference_small_v1` | 11.758.406 byte | `3fd21228b1df5e65f8c6ffd5e117a12e7a3f7c978a514bbe4ef399df8a4c750b` |

Kedua arsip menggunakan commit OpenApps `6e6782794433c60468d65ac75bc3f03c56007f8c`, tetapi Agent Controller berbeda:
- Main: `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1`.
- Scale: `ff655d1389bc84aa8100b6321220f5ec01c4e3b4`.

Konfigurasi Main pada `config/main_plan.json` mencantumkan `num_ctx=8192`, tetapi manifest arsip Main tidak mencatat nilai tersebut. Manifest Scale secara eksplisit mencatat `num_ctx=8192`. Perbedaan sumber pencatatan ini tidak boleh disamakan dengan verifikasi independen atas runtime.

SHA-256 paket analisis `Dataset_CDEA_small_only.zip` adalah `cccbb4608aab683d089341142c86644463e292b86f04e4d607a099bc3f7f7d5f` (15.774.265 byte). Paket mempertahankan arsip Scale lengkap sebagai sumber audit dan menggunakan `scale_reference_small_v1.zip` sebagai input Scale Small-only. Rincian lengkap tersedia pada `provenance.json`.


### Perbaikan arsip Scale (12 November 2026)

Arsip sumber Scale lengkap telah direkonsiliasi agar memuat **256/256 file `pair.json`**. Metadata untuk `pair_109`–`pair_256` dibangun ulang dari manifest, `pairs.csv`, `results.csv`, dan `episode.json`; 108 metadata pasangan yang sudah cocok dipertahankan byte-identik. File episode, trace, observasi, dan database dari arsip terbaru tidak diubah atau dibuat sintetis.

Nilai `total_seconds` pada 256 baris Scale di `derived/selected_results.csv` juga diperiksa dan diperbarui terhadap episode terbaru (148 nilai berubah). Checksum baru untuk arsip Scale dan paket luar tercatat di `provenance.json`. Pemeriksaan tersebut menguji konsistensi internal; bukan verifikasi independen atas runtime atau host eksperimen.


### Subset Scale Small-only

Arsip turunan `scale_reference_small_v1.zip` memakai protokol arsip `cdea_small_extension_v1` dan hanya memuat 4 model Small: Qwen 3.5 4B, Ministral 3 3B, Granite 4.1 3B, dan xLAM 2 3B. Cakupannya 128/128 pasangan, 256/256 episode, 128/128 `pair.json`, 256 trace, 14.018 file observasi, dan 1.280 database SQLite. Checksum inventori internal mencakup 17.508 file (tidak menghitung file inventori itu sendiri). Arsip ini merupakan subset data sumber, bukan eksperimen baru.

## 7. Membuka data pasangan

File `pair_outcomes.csv.gz` dikompresi dengan gzip. Untuk mengekstraknya:

```bash
gzip -dk pair_outcomes.csv.gz
```

Hasil ekstraksi adalah `pair_outcomes.csv`. File CSV dapat dibuka dengan Python, R, Excel, atau perangkat analisis data lain yang mendukung CSV.

## 8. Pemeriksaan dan keterbatasan

Pemeriksaan yang dicatat dalam `provenance.json` meliputi:
- integritas ZIP paket dan kedua arsip sumber;
- kesesuaian ID pasangan terpilih dengan arsip sumber;
- kesesuaian hasil pasangan dan catatan episode;
- kesesuaian indikator keputusan Main antara dua baris episode untuk setiap pasangan;
- kesesuaian indikator keputusan Scale dengan catatan pasangan sumber;
- kesesuaian ringkasan keputusan per kelompok dengan tabel pasangan;
- kesesuaian tabel keberhasilan per model dan per tugas; dan
- kesesuaian tabel perbandingan ukuran model dan daftar tugas turunan.

Pemeriksaan tersebut membuktikan konsistensi internal data yang tersedia, bukan verifikasi independen atas host, runtime, checkpoint yang benar-benar dimuat, atau seluruh keadaan aplikasi ketika eksperimen berlangsung.

Batas interpretasi utama:
1. Penelitian membandingkan CDEA dan Baseline progress-score; kondisi Vanilla tidak diuji.
2. Main dan Scale menggunakan versi Agent Controller berbeda.
3. Provenance arsip Scale belum diverifikasi secara independen.
4. Hanya satu seed (233) dan satu konfigurasi tampilan aplikasi yang digunakan.
5. Perbandingan Large dan Small bersifat eksploratori dan tidak membuktikan pengaruh kausal ukuran parameter.
6. Arsip sumber tidak memuat seluruh riwayat retry, PoC, Pilot, dan run lainnya.

File dalam folder ini adalah **hasil penelitian turunan**, bukan fixture sintetis untuk Continuous Integration (CI). GitHub Actions menggunakan fixture terpisah hanya untuk pengujian otomatis perangkat lunak.
