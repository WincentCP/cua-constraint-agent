# Pemetaan Artefak Skripsi CDEA

Dokumentasi ini menghubungkan berkas penelitian dengan nama yang dipakai di skripsi versi 2026-10-28.

| Dalam skripsi | Pada repositori / lampiran digital | Status |
|---|---|---|
| Kode implementasi CDEA | `scripts/browsergym/shared_policy.py` | Di repo |
| Pengendali agen | `scripts/browsergym/matched_dev.py` | Di repo |
| Pelaksanaan Main | `scripts/browsergym/main.py` | Di repo |
| Pelaksanaan Small | `scripts/browsergym/small_extension.py` | Di repo |
| Daftar 32 tugas | `config/main_taskset_v1.json` | Di repo |
| Konfigurasi Main | `config/main_plan.json` | Di repo; pengaturan untuk eksekusi baru |
| Notebook Bab IV | `notebooks/main_analysis.ipynb` | Di repo |
| Notebook lampiran | `Notebook_CDEA.ipynb` di dalam `Dataset_CDEA.zip` | Di paket digital |
| Arsip Main historis | `main_observation.zip` di dalam paket | Di paket digital |
| Arsip Scale historis | `scale_reference.zip` di dalam paket | Di paket digital |
| CSV per pasangan / episode / model / tugas | `derived/*.csv` di dalam paket | Di paket digital |
| Audit dan daftar checksum | `AUDIT_REPORT.json`, `LAMPIRAN_ANALISIS.json`, `SHA256SUMS.txt` | Di paket digital |

Paket digital berisi **15 file**, bernama `Dataset_CDEA.zip`. Cara unggah dan checksum: [data/README.md](../data/README.md).

### Perbedaan sumber dan pengaturan

- `main_observation.zip` memiliki root internal `main_observation_v1/`, bukan `main_observation/`.
- `scale_reference.zip` memiliki root internal `scale_reference_v4/`, bukan `scale_reference/`.
- Main historis tidak merekam `num_ctx` dalam manifest maupun episode. Pengaturan `num_ctx=8192` di runner modern hanya berlaku untuk **eksekusi baru**; tidak boleh dipakai untuk menyimpulkan nilai runtime historis.
- Besaran selisih success rate dalam tabel ilmiah memakai **poin persentase (pp)**, bukan pertumbuhan persentase relatif.
- Validasi arsip, checksum, dan keluaran notebook tidak membuktikan sendiri eksekusi live historis.

### Ringkasan data yang terrekonsiliasi

| Analisis | Baseline | Proposed | Selisih |
|---|---:|---:|---:|
| Main keseluruhan | 73/128 (57,03%) | 97/128 (75,78%) | +18,75 pp |
| Main informasi perbankan | 10/20 (50,00%) | 18/20 (90,00%) | +40,00 pp |
| Small | 43/128 (33,59%) | 54/128 (42,19%) | +8,59 pp |
| Gabungan (Main Large + Scale Small) | 116/256 (45,31%) | 151/256 (58,98%) | +13,67 pp |

Berkas lampiran digital dapat dikirim terpisah kepada dosen, atau diunggah ke `data/Dataset_CDEA.zip` supaya berkas dapat diakses langsung melalui repo privat. Berikan izin akses kepada dosen/penguji.
