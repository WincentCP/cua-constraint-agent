# Audit tambahan skripsi CDEA — 5 November 2026

Dokumen ini mencatat analisis tambahan yang diminta pembimbing (Kusno Prasetya) dan batas klaim yang **boleh** ditulis pada skripsi. Dokumen ini bukan perubahan terhadap protokol eksperimen, bukan eksperimen baru, dan bukan pengesahan bahwa semua riwayat eksekusi historis dapat diverifikasi secara independen.

## Input dan kontrol reproduksi

| Sumber yang dianalisis | SHA-256 |
|---|---|
| `main_observation.zip` (Main Large) | `74f48100b4dc6ae074573596dc87beed18770d4c3740f2c01f5efcd57a2d885c` |
| `scale_reference.zip` (hanya Small historis) | `052ecf15e2466109175153022baa7a1007a8a88c7358307823f85c3947b38f96` |

Ke-128 pasangan Large berasal dari Main; 128 pasangan Small berasal dari Scale. **128 pasangan Scale Large tidak dihitung ulang.** Masing-masing kelompok memuat 32 tugas × 4 model. Dataset dan controller historis tidak diubah.

Notebook `notebooks/main_analysis.ipynb` sekarang menyertakan bagian **07A — Analisis tambahan sesuai catatan pembimbing** yang menambahkan CSV berikut ke `hasil_analisis_cdea/detailed_analysis/`:

- `22_task_level_differences.csv`: jumlah keberhasilan Baseline, CDEA, dan selisih per ID tugas.
- `23_task_level_sign_tests.csv`: uji tanda eksak dua sisi dengan **tugas sebagai unit analisis**; *tie* dikeluarkan dari penyebut uji tanda.
- `24_episode_efficiency_distribution.csv`: rerata, median, Q1, Q3, IQR, jumlah dan persentase episode mencapai batas langkah.
- `25_episode_termination_reasons.csv`: kategori `end_reason` beserta penyebut **semua episode terpilih**, bukan hanya episode gagal.
- `26_cdea_loss_pairs.csv`: seluruh pasangan Baseline berhasil dan CDEA gagal, dengan status data perbedaan kebijakan bila tercatat; **bukan** kesimpulan penyebab.
- `27_ledger_trace_scope.csv`: cakupan status ledger dan grounding menurut trace, bukan bukti kebenaran fakta atau semua subsyarat tugas.

Enam tabel utama dan sembilan grafik Bab IV lama dipertahankan. Keluaran analisis baru didasarkan pada arsip historis, tidak menjalankan kembali OpenApps.

## Statistik independen yang direproduksi

| Cohort | Baseline | CDEA | Selisih poin persentase | Tugas membaik | Memburuk | Sama | Uji tanda p (2 sisi) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Main Large — 32 tugas | 73/128 | 97/128 | +18,75 | 11 | 0 | 21 | 0,0009765625 |
| Main Large — perbankan 5 tugas | 10/20 | 18/20 | +40,00 | 4 | 0 | 1 | 0,125 |
| Scale Small — 32 tugas | 43/128 | 54/128 | +8,59 | 10 | 5 | 17 | 0,3017578125 |

Selisih agregat menggunakan pasangan tugas–model. Untuk uji tanda, keempat model diringkas dalam setiap tugas. Bootstrap berbasis klaster tugas (4.000 resampling, seed 233) sudah tersedia pada bagian notebook asli. **Jangan menjadikan p McNemar 20 pasangan perbankan sebagai inferensi utama yang menganggap 20 tugas independen.** Protokol Main telah menetapkan lima tugas bank sebagai fokus utama; jangan menggeser fokus itu setelah melihat hasil. P = 0,125 pada tingkat tugas wajib dilaporkan dengan jujur.

## Temuan efisiensi yang dihitung dari episode

| Kelompok | Metode | Median langkah | IQR | Mencapai 40 langkah |
|---|---|---:|---:|---:|
| Main Large | Baseline | 10 | 7,5 | 0/128 (0%) |
| Main Large | CDEA | 9 | 6,5 | 0/128 (0%) |
| Scale Small | Baseline | 34 | 22 | 54/128 (42,19%) |
| Scale Small | CDEA | 27,5 | 25 | 50/128 (39,06%) |

`steps >= 40` dan `end_reason = action_budget_exhausted` dihitung **terpisah**; tidak menyamakan batas langkah dengan batas waktu panggilan model 240 detik. Evaluasi efisiensi yang membandingkan *pasangan sama-sama berhasil* tetap dipertahankan.

## Ledger, keberhasilan negatif, dan sumber

Pemeriksaan trace terpilih menunjukkan tidak ada evidence `SATISFIED/REFUTED` pada Small historis, sedangkan Main memiliki pembaruan ledger yang tercatat. Kecocokan kutipan dengan AXTree berarti teks kutipan terlihat pada observasi; ini **tidak membuktikan kesimpulan constraint benar secara semantik, atau semua tindakan tugas telah selesai**. Audit faktual kasus-kasus tertentu harus dibedakan dari verifikasi otomatis kutipan.

Data Small memuat 10 pasangan Baseline-only; sejumlah pasangan tidak mempunyai *policy-action divergence* yang tercatat. Tidak boleh menyimpulkan semua kerugian itu disebabkan aturan pemeringkatan CDEA. Analisis kasus harus mengacu pada trace dan keadaan aplikasi; jika tidak cukup, jelaskan bahwa penyebab belum dapat dipastikan.

Pada Main historis, fungsi `public_constraints(goal)` membagi instruksi tugas publik menjadi constraint `c1`, `c2`, dst. `public_messages` menyusun skema pesan bersama, dan `_probe_candidates` memvalidasi serta mendeduplikasi ID sebelum pemeringkatan. **Tidak ada akses ke logika evaluator privat melalui pembentukan constraint.** Namun penjelasan algoritma pada lampiran skripsi harus menampilkan validasi/deduplikasi, jangan merepresentasikan daftar `may_answer` mentah sebagai masukan langsung Persamaan (2).

Main dan Scale Small berasal dari **commit controller berbeda**; uji beda ukuran model hanya eksploratori. Nilai `num_ctx=8192` Main berasal dari konfirmasi peneliti setelah run, **bukan parameter yang terekam pada manifest atau episode Main historis**.

## Daftar pengamanan untuk revisi sesuai catatan dosen

| Catatan pembimbing | Tindakan pada fase ini | Perlu dikerjakan dalam revisi naskah |
|---|---|---|
| Pembanding Vanilla | Tidak menambah eksperimen | Persempit semua klaim menjadi perbandingan dengan Baseline *progress-score*; jangan menyatakan keunggulan dari CUA tanpa override |
| Bukti mekanisme | Ringkasan trace dan ledger | Bedakan perubahan pilihan tindakan dengan fakta informasi benar; gunakan audit kasus secara hati-hati |
| Independensi statistik | Uji tanda tugas dan bootstrap klaster | Laporkan fokus bank (5 tugas, p = 0,125), Large 32, Small 32; bedakan inferensi eksploratori McNemar |
| Riwayat run | Verifikasi arsip terpilih | Jelaskan run lain, retry, Pilot dan PoC **hanya bila bukti tersedia**; tidak menyebut nol invalid berarti tidak pernah ada retry |
| Asal constraint & prompt | Cocokkan kode Main historis | Tambahkan asal otomatis dari tujuan publik dan lampiran prompt kedua metode |
| CDEA merugikan | Daftar pasangan Baseline-only | Bahas kasus Small yang memburuk dan apa yang tidak dapat ditentukan dari trace |
| Persamaan vs kode | Verifikasi sanitasi historis | Perbaiki pseudocode Lampiran C, bukan kode eksperimen |
| Satu seed/tampilan | Tidak membuat run baru | Jadikan keterbatasan utama di Bab IV serta saran di Bab V |
| Efisiensi | Median, IQR, penghentian | Laporkan penyebut dan bedakan action cap/timeout |
| Landasan teori/gap | Tidak diubah dalam kode | Hubungkan heuristik CDEA dengan greedy coverage/set cover dan value of information tanpa mengklaim optimisasi formal |
| Penulisan, tabel, pustaka | Bukan pekerjaan notebook | Revisi nomor subbab, istilah CDEA, tabel 4.7–4.8, jumlah referensi, dan bibliografi |

## Hal yang BELUM dibuktikan oleh update analisis

1. Tidak ada pembanding Vanilla; klaim hanya terhadap Baseline *progress-score*.
2. Verifikasi faktual **seluruh** status SATISFIED dan subsyarat tugas memerlukan penilaian semantik berbasis keadaan aplikasi.
3. Seluruh riwayat run di luar dua arsip terpilih, retry dan catatan PoC/Pilot sebenarnya belum diinventarisasi.
4. Log respons model **sebelum sanitasi** mungkin tidak tersedia sehingga frekuensi ID `may_answer` mentah yang salah tidak boleh dianggap nol.
5. Provenance host independen untuk run Scale tidak bisa dipastikan hanya dari arsip; catatan Scale memuat `observed_real_launcher_count = 0` dan `verified_ollama_digest_set = 0`. Konsistensi internal digests tidak membuktikan pelaksanaan independen.
6. Eksperimen memakai satu seed dan kondisi antarmuka; tidak menguji variabilitas antar-run/tampilan.

**Untuk fase penulisan:** ChatGPT for Word cukup menerapkan redaksi yang disusun dan terverifikasi, bukan menginterpretasikan ulang nilai p, mengubah riwayat eksperimen, atau menyatakan semua keberatan metodologis telah terbukti selesai.
