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
| `num_ctx` Main (konfirmasi peneliti) | `NUM_CTX_MAIN_CONFIRMATION.json` dan `manifest_main_researcher_amended.json` | Di paket digital; salinan ringkas konfirmasi di repo pada `data/NUM_CTX_MAIN_CONFIRMATION.json` |
| Audit dan daftar checksum | `AUDIT_REPORT.json`, `LAMPIRAN_ANALISIS.json`, `SHA256SUMS.txt` | Di paket digital |

Paket digital berisi **17 file**, bernama `Dataset_CDEA.zip`. Cara unggah dan checksum: [data/README.md](../data/README.md).

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

Berkas lampiran digital dapat dikirim terpisah kepada dosen, atau diunggah ke `data/Dataset_CDEA.zip` supaya berkas dapat diakses langsung melalui repo privat. Berikan izin akses kepada dosen/penguji.
