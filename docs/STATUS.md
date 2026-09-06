# Status implementasi — 6 September 2026

## Sudah diverifikasi di lingkungan pembangunan

- TypeScript strict `tsc --noEmit`: lulus.
- Build produksi React/Vite: lulus.
- 28 test unit/lifecycle/dataset/SQLite/HTTP: lulus pada saat checkpoint awal; lihat output verifikasi akhir untuk jumlah terbaru.
- HTTP smoke benar-benar memulai backend demo lokal dan memeriksa halaman, token peneliti, origin luar, akses fixture dan penolakan consent.
- Uji model untuk unit/lifecycle memakai test double atau `DemoModel` yang eksplisit; **bukan inferensi qwen2.5:7b**.

## Belum diverifikasi — jangan dianggap lulus

- Suite `tests/integration/browser.test.ts` telah ditulis tetapi belum dijalankan. Instalasi Chromium terblokir oleh batas penggunaan/approval lingkungan. Tidak dicoba mengakali pembatasan tersebut.
- Satu task end-to-end dengan Ollama, faster-whisper, eSpeak NG dan Chromium nyata.
- Microphone/VAD, half-duplex dan timing stop/onset pada perangkat studi, termasuk output audio gagal.
- Uji keyboard/screen reader dan visual QA pada perangkat peserta.
- Baseline B1 pada dua task STAGED berbeda, latency/payload maksimum, dan kelayakan 20 menit.
- Manifest penelitian final, freeze setelah pilot, 64 episode main, pilot peserta, dan studi empat peserta.
- GitHub remote belum dibuat/push saat dokumen ini disusun. Akun konektor teridentifikasi, tetapi pembuatan repo membutuhkan autentikasi/operasi tambahan. Gunakan `docs/GITHUB.md` bila belum diselesaikan pada handoff.

## Gap implementasi yang masih harus ditutup sebelum DoD PRD

1. Pengujian race suara/pergantian turn belum lengkap: khususnya onset berpapasan dengan PREPARE_PLAY, REPEAT saat inference, hasil STT terlambat, dan callback audio terminal. Kode memiliki fence/epoch, tetapi belum dibuktikan lewat perangkat nyata dan semua fault injection.
2. Konten bantuan audio tetap dan consent audio mandiri belum dibundel. UI consent dapat dibaca screen reader dan keyboard, tetapi fallback audio tanpa worker belum memenuhi seluruh FR-U/PR.
3. Episode dimulai setelah inisialisasi browser. Kegagalan peluncuran browser sebelum objek run tercipta saat ini tercatat sebagai gangguan batch; ledger attempted-run individual untuk fase STARTING perlu diperkuat sebelum main.
4. Versi implementasi ini hanya melakukan re-observe recovery; belum memiliki seluruh fault-injection acceptance untuk timeout efek dan no-progress signature. Browser integration yang ditulis belum menggantikan AC-10–19 penuh.
5. Pilot peserta/practice task, resolusi referensi nonvisual “yang tadi/yang kedua”, intervensi peneliti melalui UI, bunyi kerja terjadwal, dan protokol replacement pair belum lengkap. Jangan mengklaim semua alur FR-H/U selesai.
6. Empat template saat ini terutama memvariasikan label semantik, bukan empat layout yang sepenuhnya berbeda. Validasi dan finalisasi variasi presentasi sebelum freeze.
7. Metric evidence acquisition tersedia; ringkasan verifier/recovery/safety rinci, export attempt_id lengkap, dan pencatatan keseluruhan durasi pengalaman pengguna belum selengkap PRD. Event mentah tidak boleh dipakai untuk mengklaim metrik yang belum divalidasi.
8. Worker eSpeak output WAV streaming, STT startup latency, pelepasan buffer seluruh jalur error, dan shutdown lintas OS membutuhkan integration test nyata.
9. Freeze menjaga hash konfigurasi/source/model; kompetensi model dan konteks maksimum tetap keputusan pilot empiris, bukan jaminan validasi statis.

Daftar ini sengaja eksplisit. Ini adalah kode MVP awal yang dapat dilanjutkan, bukan klaim sistem matang, implementasi PRD penuh, atau hasil skripsi yang sudah selesai. Flag `HUMAN_STUDY_ENABLED` default false untuk mencegah aktivasi studi tanpa penilaian manual.
