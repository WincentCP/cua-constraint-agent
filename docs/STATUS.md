# Status implementasi — 6 September 2026

## Sudah diverifikasi di lingkungan pembangunan

- TypeScript strict `tsc --noEmit`: lulus.
- Build produksi React/Vite: lulus.
- 31 test unit/lifecycle/dataset/SQLite/HTTP: lulus setelah perbaikan turn suara, ledger, report, dan manipulation check.
- HTTP smoke benar-benar memulai backend demo lokal dan memeriksa halaman, token peneliti, origin luar, akses fixture dan penolakan consent.
- Browser integration Chromium nyata: 13/13 lulus, mencakup success EARLY/STAGED P/B1, no-solution, unavailable evidence, budget exhaustion, decline, false toast, fake cart, dan detached reference.
- Demo coordinator nyata diuji melalui consent → readiness → lanjut → goal ack → approval → verified result; correction budget membuat revision baru, Escape menutup sesi, dan console tidak berisi error.
- Turn `PREPARE_PLAY` yang berpapasan dengan onset ucapan kini dibatalkan eksplisit dan dibersihkan di UI agar keluaran basi tidak pernah diputar.
- Jika izin mikrofon gagal, UI menyatakan langkah perbaikan dan menyediakan tombol “Coba lagi mikrofon”; respons `REJECTED` juga diberi status/pesan yang dapat dibaca screen reader.
- Uji model untuk unit/lifecycle memakai test double atau `DemoModel` yang eksplisit; **bukan inferensi qwen2.5:7b**.

## Belum diverifikasi — jangan dianggap lulus

- Ollama qwen2.5:7b, faster-whisper, eSpeak NG, microphone/VAD, dan screen-reader pada perangkat studi.
- Satu task end-to-end dengan Ollama, faster-whisper, eSpeak NG dan Chromium nyata.
- Microphone/VAD, half-duplex dan timing stop/onset pada perangkat studi, termasuk output audio gagal.
- Uji keyboard/screen reader dan visual QA pada perangkat peserta.
- Baseline B1 dengan model nyata pada dua task STAGED berbeda, latency/payload maksimum, dan kelayakan 20 menit.
- Manifest penelitian final, freeze setelah pilot, 64 episode main, pilot peserta, dan studi empat peserta.
- Development benchmark demo smoke merekam 12/12 result, 9 verified dan 3 budget-limited; 15/39 counterfactual router comparisons berbeda. Demo dikeluarkan dari research summary dan bukan hasil penelitian.

## Gap implementasi yang masih harus ditutup sebelum DoD PRD

1. Pengujian race suara/pergantian turn belum lengkap: onset–PREPARE_PLAY sudah memiliki pembatalan eksplisit, tetapi REPEAT saat inference, hasil STT terlambat, callback audio terminal, dan semua fault injection belum dibuktikan lewat perangkat nyata.
2. Konten bantuan audio tetap dan consent audio mandiri belum dibundel. UI consent dapat dibaca screen reader dan keyboard, tetapi fallback audio tanpa worker belum memenuhi seluruh FR-U/PR.
3. Browser-start failure kini masuk ledger sebagai `infrastructure_failed` dan participant mengulang item yang sama; replacement pair main tetap perlu protokol peneliti.
4. Recovery sekarang satu settle-read + satu retry idempoten; delayed effect, no-progress signature, late STT, dan disconnect fault-injection masih perlu diuji eksplisit.
5. Pilot peserta/practice task, resolusi referensi nonvisual “yang tadi/yang kedua”, intervensi peneliti melalui UI, bunyi kerja terjadwal, dan protokol replacement pair belum lengkap. Jangan mengklaim semua alur FR-H/U selesai.
6. Empat template saat ini terutama memvariasikan label semantik, bukan empat layout yang sepenuhnya berbeda. Validasi dan finalisasi variasi presentasi sebelum freeze.
7. Metric evidence acquisition, router disagreement, cost averages, verifier/recovery counters tersedia; screen-reader/user-experience duration dan replacement analysis masih manual.
8. Worker eSpeak output WAV streaming, STT startup latency, pelepasan buffer seluruh jalur error, dan shutdown lintas OS membutuhkan integration test nyata.
9. Freeze menjaga hash konfigurasi/source/model; kompetensi model dan konteks maksimum tetap keputusan pilot empiris, bukan jaminan validasi statis.

Daftar ini sengaja eksplisit. Ini adalah kode MVP awal yang dapat dilanjutkan, bukan klaim sistem matang, implementasi PRD penuh, atau hasil skripsi yang sudah selesai. Flag `HUMAN_STUDY_ENABLED` default false untuk mencegah aktivasi studi tanpa penilaian manual.
