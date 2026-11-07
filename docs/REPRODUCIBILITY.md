# Reproduksi Analisis CDEA

## Sumber data

- `main_observation.zip` — Main Large, protokol `cdea_main_v1`, 128 pasangan.
- `scale_reference.zip` — arsip historis Scale, protokol `cdea_scale_v1`, 256 pasangan; notebook memilih hanya 128 pasangan Small.

Nama file tersebut adalah alias input; identitas dan hash dari arsip asli tetap berlaku. Hasil Large berasal dari Main dan tidak dihitung dua kali.

**Konteks model:** peneliti mengonfirmasi Main menggunakan `num_ctx=8192` (2026-10-28); arsip Main asli tidak mencatatnya dalam manifest/episode. Paket dataset dilengkapi `NUM_CTX_MAIN_CONFIRMATION.json` dan `manifest_main_researcher_amended.json` sebagai dokumentasi konfirmasi. Notebook salinan di paket menampilkan 8192 dengan label asal konfirmasi. Untuk Small, `num_ctx=8192` tercatat langsung dalam arsip asli. Manifest dan ZIP sumber historis tidak dimodifikasi.

## Menjalankan notebook utama

```powershell
python -m pip install -r requirements-analysis.txt
python scripts/analysis/audit_archives.py --main main_observation.zip --small scale_reference.zip --output archive_audit.json
```

Buka [`notebooks/main_analysis.ipynb`](../notebooks/main_analysis.ipynb) di Jupyter atau Google Colab. Unggah `Dataset_CDEA.zip` atau kedua arsip sumber `main_observation.zip` dan `scale_reference.zip`, kemudian pilih **Run All**. Notebook tidak memodifikasi ZIP sumber.

Keluaran: 6 tabel utama, 9 gambar berwarna, hingga **26 CSV analisis rinci** (termasuk 6 CSV tambahan untuk catatan pembimbing), serta ringkasan statistik. File `17_probe_examples.csv` hanya dibuat bila tersedia contoh probe di trace; fixture CI tanpa trace menghasilkan **25 CSV rinci** (19 tabel asal dan 6 tabel tambahan). Tidak ada berkas `pemetaan_bab_iv.json`. Nama output mengikuti notebook asli.

## Kecocokan dengan rumus skripsi

[Peta Persamaan (1)–(7)](CODE_MAP.md#peta-persamaan-skripsi) menunjukkan lokasi penghitungan. Persamaan (1)–(3) berada di `scripts/browsergym/shared_policy.py` (komentar inline pada `choose_action()`). Persamaan (4)–(7) dihitung oleh `notebooks/main_analysis.ipynb`; pengujian notebook dengan data simulasi uji tidak menggantikan arsip penelitian asli. Nama `Proposed` pada sumber historis berarti CDEA.

## Pengujian kode

```powershell
python -m unittest discover -s tests -v
python scripts/analysis/verify_notebook.py
```

Uji integrasi menjalankan notebook dengan fixture. Auditor arsip dapat memeriksa format `cdea_small_extension_v1` secara terpisah. **Notebook utama hanya menerima** `cdea_scale_v1` sebagai sumber Small; hasil Small-only baru tidak otomatis dapat dibuka dalam notebook yang sama.

## Hasil referensi

| Kelompok | Baseline | Proposed |
|---|---:|---:|
| Main Large | 73/128 (57,03%) | 97/128 (75,78%) |
| Small historis | 43/128 (33,59%) | 54/128 (42,19%) |
| Informasi perbankan | 10/20 (50,00%) | 18/20 (90,00%) |

Perbandingan dua sumber menggunakan revisi pengendali yang berbeda. Nilai statistik bersifat eksploratori dan uji CI tidak membuktikan sendiri provenance eksekusi runtime historis.

## Analisis tambahan sesuai review pembimbing (2026-11-05)

Notebook utama sekarang menyertakan bagian **07A** untuk memenuhi kebutuhan analisis tambahan dari catatan pembimbing, tanpa mengubah angka hasil atau grafik lama. Selain 6 tabel utama dan 9 gambar, bagian ini menghasilkan 6 CSV baru di `hasil_analisis_cdea/detailed_analysis/`:

- `22_task_level_differences.csv` dan `23_task_level_sign_tests.csv`: uji tanda eksak dengan ID tugas sebagai unit; model-model untuk tugas yang sama tidak dihitung sebagai tugas independen.
- `24_episode_efficiency_distribution.csv`: median, kuartil/IQR, dan proporsi mencapai batas langkah.
- `25_episode_termination_reasons.csv`: alasan penghentian dan penyebut semua episode terpilih.
- `26_cdea_loss_pairs.csv`: daftar pasangan ketika Baseline berhasil dan CDEA gagal.
- `27_ledger_trace_scope.csv`: cakupan ledger pada trace, tanpa klaim validasi kebenaran faktual.

Output rinci yang dihasilkan berjumlah **hingga 26 CSV** (25 jika trace fixture tidak memiliki contoh probe opsional). Uji `verify_notebook.py` menggunakan fixture sintetis; hasil fixture bukan pengganti perhitungan dari ZIP penelitian asli. Gunakan hash input untuk merekonsiliasi arsip; lihat [pemetaan review pembimbing](THESIS_REVIEW_ANALYSIS_2026-11-05.md).

**Batas interpretasi wajib:** lima tugas perbankan adalah fokus utama yang tercatat pada protokol Main; p uji tanda berbasis tugas adalah **0,125**, bukan bukti signifikansi pada tingkat tugas. McNemar berbasis 20 pasangan hanya analisis eksploratori, bukan uji dengan 20 tugas independen. Main dan Scale menggunakan controller berbeda, dan ledger Scale Small yang tercatat tidak diperbarui. Hasil ini tidak membuktikan CDEA lebih baik daripada agen Vanilla tanpa override.
