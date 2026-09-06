# Ruang Akses — Constraint-Directed Computer-Use Agent

Research MVP lokal berdasarkan PRD CUA v4 (6 September 2026). Aplikasi memilih satu produk dan varian pada toko sintetis, meminta persetujuan eksplisit, lalu memverifikasi keranjang. Semua inferensi dirancang berjalan di komputer peneliti; tidak ada cloud inference, checkout, atau biaya API.

**Status: implementasi awal, belum siap pengambilan data manusia.** TypeScript, build frontend, dan pengujian unit/HTTP telah dijalankan. Pengujian browser dengan engine lokal nyata dan uji suara pada perangkat studi belum lulus gate karena belum dijalankan di lingkungan pembangunan ini. Jangan menyamakan demo atau unit test dengan bukti kelayakan penelitian. Lihat [status verifikasi](docs/STATUS.md).

## Mulai dari sini

1. Ikuti [panduan instalasi dan konfigurasi](docs/SETUP.md).
2. Coba demo teknis dengan `npm ci`, `npx playwright install chromium`, `npm run build`, lalu `npm run demo`.
3. Buka `http://localhost:3050/study`. Demo menggunakan teks dan perencana simulasi; bukan benchmark penelitian.
4. Untuk engine nyata, pasang Ollama, model qwen2.5:7b, faster-whisper small CPU INT8, serta eSpeak NG `id`. Kemudian `npm start` menjalankan pemeriksaan dan layanan lokal.
5. Jalankan pilot, lengkapi checklist, baru freeze dan benchmark. Keunggulan P bukan syarat kelulusan pilot.

## Apa yang dibangun

| Komponen | Implementasi |
| --- | --- |
| Coordinator | React, consent, mic/VAD, half-duplex, Escape, halaman `/study` |
| Peneliti | Readiness, hasil/timeline sederhana, export JSON/CSV, abort, hapus sesi |
| Backend | Node.js 24+, TypeScript, HTTP dan satu WebSocket, SQLite lokal |
| Agent | Observer ARIA, registry referensi, bukti bersumber, route historis, shared verifier |
| Kebijakan | P constraint-directed dan B1 generic lookahead; hanya router yang bercabang |
| Efek keranjang | Kelayakan penuh, state segar, approval terikat efek, sekali pakai |
| Lingkungan | Tiga produk, EARLY/STAGED, empat variasi label/presentasi, state server privat |
| Evaluasi | Oracle setelah outcome dibekukan dan browser ditutup; manifest 64 episode |
| Privasi | Raw audio hanya memori, retention 30/90 hari, bearer token dan origin/host guard |

P dan B1 menerima model, prompt, hasil annotation, matrix, tools, dan budget yang sama. `src/core/router.ts` adalah satu-satunya percabangan pemilihan berdasarkan kondisi. `may_answer` tidak pernah menjadi fakta. Agent tidak mengimpor fixture atau oracle.

## Perintah

| Perintah | Tujuan |
| --- | --- |
| `npm run build` | Typecheck dan build frontend |
| `npm test` | Unit, lifecycle, dataset, SQLite, HTTP smoke |
| `npm run test:integration` | Browser Chromium nyata dengan planner demo berlabel |
| `npm run demo` | Coordinator demo teknis dengan input teks |
| `npm start` | Jalankan Ollama milik aplikasi, preflight, backend, buka Coordinator |
| `npm run stop` | Shutdown melalui endpoint lokal terautentikasi |
| `npm run preflight` | Pemeriksaan engine nyata; port 3050 harus kosong |
| `npm run benchmark -- --development` | Mulai 12 episode development P/B1 melalui backend aktif |
| `npm run freeze -- --pilot-approved` | Bekukan kode/config/model/dataset setelah pilot; perlu git bersih |
| `npm run benchmark` | Mulai 64 episode main dari freeze; tidak boleh demo |

Di demo, ketik `siap` setelah consent, lalu `lanjut`. Salin instruksi task sebagai goal, jawab `ya` saat ditawarkan barang, lalu `lanjut`. Diam tidak berarti setuju. Mode nyata menggunakan mikrofon, bukan browser SpeechRecognition atau layanan suara internet.

## Struktur

- `src/core/`: kontrak, evidence, router, approval, batas runtime.
- `src/agent/`: planner lokal, loop run, route, perencana demo terisolasi.
- `src/browser/`: browser task, observer/registry, verifier deterministik.
- `src/fixture/`: dataset dan dunia sintetis privat.
- `src/evaluation/`: oracle independen dan ringkasan/analisis berpasangan.
- `src/server.ts`, `src/storage.ts`, `src/voice.ts`: coordinator, data, worker adapter.
- `web/`, `public/vad-worklet.js`: antarmuka dan VAD lokal.
- `workers/`: STT/TTS Python melalui stdin/stdout, tanpa audio di disk.
- `scripts/`: startup, preflight, freeze, benchmark.
- `tests/`: unit/HTTP dan suite integrasi browser.

## Reproduksibilitas dan batas klaim

Main terdiri dari 16 base × 2 presentasi × 2 policy = 64 episode. Denominator solvable 24 per policy, atau 12 untuk setiap presentasi. Unit inferensi adalah base (12 solvable), bukan 64 sampel independen. Analisis bootstrap bersifat deskriptif dan berkelompok per base. Metadata demo tidak masuk ringkasan penelitian.

Manifest, prompt, kode, lockfile, model digest, dan konfigurasi harus dibekukan setelah pilot. Jika main telah dicoba, endpoint menolak pengulangan otomatis. Re-run pasangan karena infrastruktur perlu protokol replacement dengan ID baru; alur otomatis replacement belum diimplementasikan.

Tidak ada hasil benchmark main, data peserta, approval etik, atau klaim P lebih unggul yang disertakan dalam repo ini.

## Dokumentasi

- [SETUP](docs/SETUP.md): langkah konfigurasi yang harus dilakukan di komputer peneliti.
- [STATUS](docs/STATUS.md): pengujian yang benar-benar dilakukan dan gap yang masih terbuka.
- [ACCEPTANCE](docs/ACCEPTANCE.md): pemetaan AC-01–28 dan checklist manual.
- [GITHUB](docs/GITHUB.md): membuat repository privat dan push tanpa membagikan token di chat.
- [PRD asli](docs/PRD.md): sumber requirement; implementasi tidak menggantikan spesifikasi.

Referensi teknis: [Playwright ARIA snapshots](https://playwright.dev/docs/aria-snapshots), [Ollama API chat](https://docs.ollama.com/api/chat), [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [bahasa eSpeak NG](https://github.com/espeak-ng/espeak-ng/blob/master/docs/languages.md).
