# Pemetaan Notebook dan Bab IV

Notebook utama: `notebooks/cdea_bab_iv.ipynb`. Setiap grafik dibuat di sel terpisah dan disimpan pada `hasil_analisis_cdea/figures/`; tabel numerik pada `tables/`.

| Subbab | Keluaran utama | Isi |
|---|---|---|
| 4.1.1 | `Tabel_4_1.csv` | Cakupan dan validitas pasangan |
| 4.1.2 | `Gambar_4_1.png`, `Tabel_4_2.csv`, `Gambar_4_2.png` | Keberhasilan Main dan kategori tugas |
| 4.1.3 | `Tabel_4_3.csv`, `Gambar_4_3.png`, `Gambar_4_4.png` | Keputusan pencarian informasi |
| 4.1.4 | `Tabel_4_4.csv`, `Gambar_4_5.png`, `Gambar_4_6.png` | Selisih langkah dan efisiensi |
| 4.1.5 | `Tabel_4_5.csv` | Keberhasilan 4 varian Small |
| 4.1.6 | `Gambar_4_7.png`, `Tabel_4_6.csv`, `Gambar_4_8.png`, `Gambar_4_9.png` | Keberhasilan 8 varian dan variasi manfaat |

Urutan keluaran sama dengan naskah, termasuk posisi Gambar 4.1 sebelum Tabel 4.2. Data rinci di `detailed_analysis/`, statistik dan metadata sumber di `summary/`. Hasil dihitung dari arsip, bukan angka yang ditulis manual.

**Sumber:** `main_observation.zip` untuk Main Large, dan `scale_reference.zip` untuk Small dari Scale historis atau arsip Small-only `cdea_small_extension_v1`. Scale Large tidak digunakan ulang. Identitas, protokol, dan SHA-256 dicatat pada metadata.

**Satuan:** persentase menggunakan `%`; selisih absolut bukan kenaikan relatif.
