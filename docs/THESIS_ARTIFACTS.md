# Peta Berkas Pendukung Skripsi CDEA

Dokumentasi ini menghubungkan berkas penelitian dengan skripsi revisi November 2026 (Lampiran A–E). Paket data digital disediakan terpisah dan tidak menjadi Lampiran F.

| Dalam skripsi | Pada repositori / lampiran digital | Status |
|---|---|---|
| Kode implementasi CDEA (Persamaan 1–3) | `scripts/browsergym/shared_policy.py` | Di repo; komentar persamaan pada `choose_action()` |
| Pengendali agen | `scripts/browsergym/matched_dev.py` | Di repo |
| Pelaksanaan Main | `scripts/browsergym/main.py` | Di repo |
| Pelaksanaan Small | `scripts/browsergym/small_extension.py` | Di repo |
| Daftar 32 tugas | `config/main_taskset_v1.json` | Di repo |
| Konfigurasi Main | `config/main_plan.json` | Di repo; pengaturan untuk eksekusi baru |
| Notebook Bab IV (Persamaan 4–7) | `notebooks/main_analysis.ipynb` | Di repo |
| Notebook lampiran | `Notebook_CDEA.ipynb` di dalam `Dataset_CDEA.zip` | Di paket digital |
| Arsip Main historis | `main_observation.zip` di dalam paket | Di paket digital |
| Arsip Scale historis | `scale_reference.zip` di dalam paket | Di paket digital |
| CSV per pasangan / episode / model / tugas | `derived/*.csv` di dalam paket | Di paket digital |
| `num_ctx` Main (konfirmasi peneliti) | `NUM_CTX_MAIN_CONFIRMATION.json` dan `manifest_main_researcher_amended.json` | Di paket digital; salinan ringkas konfirmasi di repo pada `data/NUM_CTX_MAIN_CONFIRMATION.json` |
| Audit dan daftar checksum | `AUDIT_REPORT.json`, `LAMPIRAN_ANALISIS.json`, `SHA256SUMS.txt` | Di paket digital |

Paket digital berisi **17 file**, bernama `Dataset_CDEA.zip`. Cara unggah dan checksum: [data/README.md](../data/README.md).

**Lampiran C.1** menampilkan pseudocode ringkas dari pemilihan kandidat. Untuk implementasi penuh, termasuk validasi kandidat dan deduplikasi ID, lihat [`shared_policy.py`](../scripts/browsergym/shared_policy.py). **Lampiran C.2** memuat templat prompt historis Main. Nama internal `Proposed` dalam kode dan arsip historis adalah metode yang dalam skripsi disebut **CDEA**; nama historis ini tidak diganti agar bukti tetap bisa ditelusuri. [Peta Persamaan (1)–(7)](CODE_MAP.md#peta-persamaan-skripsi).

### Perbedaan sumber dan pengaturan

- `main_observation.zip` memiliki root internal `main_observation_v1/`, bukan `main_observation/`.
- `scale_reference.zip` memiliki root internal `scale_reference_v4/`, bukan `scale_reference/`.
- Peneliti mengonfirmasi `num_ctx=8192` digunakan pada Main historis (2026-10-28). Nilai tersebut **tidak terekam dalam manifest/episode asli**, sehingga dituangkan sebagai catatan terpisah dengan sumber konfirmasi peneliti. Salinan manifest teranotasi **bukan** pengganti manifest historis yang tersimpan pada ZIP sumber. Small mencatat nilai 8192 di arsip aslinya. Runner modern menerapkan `num_ctx=8192` juga untuk eksekusi baru.
- Besaran selisih success rate dalam tabel ilmiah memakai **poin persentase (pp)**, bukan pertumbuhan persentase relatif.
- Validasi arsip, checksum, dan keluaran notebook tidak membuktikan sendiri eksekusi live historis.

### Ringkasan data yang terrekonsiliasi

| Analisis | Baseline | Proposed | Selisih |
|---|---:|---:|---:|
| Main keseluruhan | 73/128 (57,03%) | 97/128 (75,78%) | +18,75 pp |
| Main informasi perbankan | 10/20 (50,00%) | 18/20 (90,00%) | +40,00 pp |
| Small | 43/128 (33,59%) | 54/128 (42,19%) | +8,59 pp |
| Gabungan (Main Large + Scale Small) | 116/256 (45,31%) | 151/256 (58,98%) | +13,67 pp |

Berkas paket digital dapat dibagikan terpisah kepada dosen/penguji melalui saluran terbatas setelah pemeriksaan konten. Repo ini bersifat **publik**; jangan mengunggah arsip berisi pesan, snapshot database, atau data pribadi tanpa peninjauan dan izin yang sesuai.

## Analisis tambahan pembimbing — 2026-11-05

Notebook utama sekarang mencakup **enam tabel CSV tambahan** pada `hasil_analisis_cdea/detailed_analysis/`: `22_task_level_differences.csv`, `23_task_level_sign_tests.csv`, `24_episode_efficiency_distribution.csv`, `25_episode_termination_reasons.csv`, `26_cdea_loss_pairs.csv`, dan `27_ledger_trace_scope.csv`.

Tabel ini mendukung revisi **Bab III (unit analisis), Bab IV (uji tanda berdasarkan tugas, penghentian, kegagalan, ruang lingkup ledger), dan Bab V (pembatasan kesimpulan)**. Nilai yang belum diverifikasi dari rekaman historis tidak boleh diubah menjadi klaim hasil. Catatan pembimbing dan batas interpretasi tersedia di [THESIS_REVIEW_ANALYSIS_2026-11-05.md](THESIS_REVIEW_ANALYSIS_2026-11-05.md).

File analisis baru bukan revisi algoritma CDEA. Untuk replikasi gunakan dua ZIP sumber asli dan [petunjuk reproduksi](REPRODUCIBILITY.md). Kesimpulan tetap dibatasi pada **CDEA vs Baseline progress-score**; tidak tersedia pembanding Vanilla.
