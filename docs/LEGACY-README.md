# Arsip antarmuka studi sebelumnya

Dokumen historis; ikuti README di root dan PRD-AUTOMATED.md untuk scope aktif.

# Ruang Akses — Constraint-Directed Computer-Use Agent

Research MVP lokal berdasarkan PRD CUA v4 dan revisi metodologi 7 September 2026. Aplikasi menguji apakah constraint-directed evidence acquisition membantu agent memperoleh bukti yang tepat sebelum bertindak—atau abstain ketika solusi/bukti tidak tersedia—dibanding generic LLM progress-based exploration. Semua inferensi dirancang berjalan di komputer peneliti; tidak ada cloud inference, checkout, atau biaya API.

**Status: MVP telah diperkeras dan diaudit end-to-end, tetapi belum siap pengambilan data manusia.** Unit/HTTP/browser synthetic dan UI demo nyata telah diuji; Ollama/STT/TTS/mikrofon/screen-reader pada perangkat studi tetap menjadi gate. Jangan menyamakan demo dengan bukti kelayakan penelitian. Lihat [audit](AUDIT.md), [revisi PRD](PRD-REVISION.md), dan [status verifikasi](STATUS.md).

## Mulai dari sini

1. Ikuti [panduan instalasi dan konfigurasi](SETUP.md).
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
| Evaluasi | Oracle independen setelah outcome dibekukan; automatic task evaluation, structured session trace, dan manifest 64 episode |
| Privasi | Tidak ada video/raw audio; audio hanya memori, retention 30/90 hari, bearer token dan origin/host guard |

P dan B1 menerima goal, observasi publik, evidence matrix, eligible probes, model, prompt/parser, tools, verifier, dan budget yang sama. `src/core/router.ts` adalah satu-satunya percabangan pemilihan probe berdasarkan kondisi. P mengurutkan jumlah constraint `SATISFIED`, coverage `UNKNOWN`, forward cost, lalu stable tie-break; B1 memakai `generic_progress_score` LLM tanpa dibatasi hanya pada sebagian constraint. Satu eligible probe dipilih deterministik pada kedua kondisi tanpa comparison. `may_answer` tidak pernah menjadi fakta. Agent tidak mengimpor fixture, reference evidence path, atau oracle.

## Perintah

| Perintah | Tujuan |
| --- | --- |
| `npm run build` | Typecheck dan build frontend |
| `npm test` | Unit, lifecycle, dataset, SQLite, HTTP smoke |
| `npm run test:integration` | Browser Chromium nyata dengan planner demo berlabel |
| `npm run demo` | Coordinator demo teknis dengan input teks |
| `npm start` | Build, jalankan Ollama milik aplikasi, gunakan preflight cache bila valid, backend, buka Coordinator |
| `npm run start:full` | Paksa full preflight sebelum backend |
| `npm run stop` | Shutdown melalui endpoint lokal terautentikasi |
| `npm run preflight` | Pemeriksaan engine nyata; port 3050 harus kosong |
| `npm run benchmark -- --development` | Mulai 12 episode development P/B1 melalui backend aktif |
| `npm run freeze -- --pilot-approved` | Bekukan kode/config/model/dataset setelah pilot; perlu git bersih |
| `npm run benchmark` | Mulai 64 episode main dari freeze; tidak boleh demo |

Di demo, ketik `siap` setelah consent, lalu `lanjut`. Sistem membacakan task; peserta cukup mengetik/berkata `mulai` atau memberi koreksi singkat, lalu `ya` saat menyetujui proposal. Diam tidak berarti setuju. Mode nyata menggunakan mikrofon, bukan browser SpeechRecognition atau layanan suara internet.

## Struktur

- `src/core/`: kontrak, evidence, router, approval, batas runtime.
- `src/agent/`: planner lokal, loop run, route, perencana demo terisolasi.
- `src/browser/`: browser task, observer/registry, verifier deterministik.
- `src/fixture/`: dataset dan dunia sintetis privat.
- `src/evaluation/`: oracle independen, canonical research events, evaluasi task/sesi, dan analisis berpasangan.
- `src/server.ts`, `src/storage.ts`, `src/voice.ts`: coordinator, data, worker adapter.
- `web/`, `public/vad-worklet.js`: antarmuka dan VAD lokal.
- `workers/`: STT/TTS Python melalui stdin/stdout, tanpa audio di disk.
- `scripts/`: startup, preflight, freeze, benchmark.
- `tests/`: unit/HTTP dan suite integrasi browser.

## Reproduksibilitas dan batas klaim

Main terdiri dari 16 base × 2 presentasi × 2 policy = 64 episode. Denominator solvable 24 per policy, atau 12 untuk setiap presentasi. Unit inferensi adalah base (12 solvable), bukan 64 sampel independen. Report memisahkan split, mode, config/prompt/dataset/freeze/model, serta planned, attempted, completed, infrastructure failure, oracle null, replacement, dan unattempted. Angka keberhasilan denominator penuh tetap `N/A` sampai cell original lengkap. Metadata demo tidak masuk ringkasan penelitian.

Manifest, prompt, kode, lockfile, model digest, dan konfigurasi harus dibekukan setelah pilot. Main dapat dilanjutkan hanya pada cell original yang belum tercatat. Duplicate cell ditolak; hasil asli dan infrastructure failure tidak ditimpa. Replacement selalu berupa pasangan P/B1 dengan pair ID serta alasan eksplisit dan dianalisis terpisah.

Tidak ada hasil benchmark main, data peserta, approval etik, atau klaim P lebih unggul yang disertakan dalam repo ini.

## Automatic evaluation dan research recording

Saat Task 1 dibuat, backend otomatis menandai `SESSION_RECORDING_STARTED`; tidak ada tombol tambahan untuk peserta. “Recording” pada MVP berarti structured session trace lokal—bukan rekaman layar atau audio mentah. Setiap task menyimpan waktu, status `SUCCESS/FAILED/ABORTED`, verdict `task_success` dari oracle ACT/ABSTAIN independen, action/retry/recovery/clarification/intervention, failure taxonomy, serta URL dan fingerprint accessibility state terakhir. Event mempunyai timestamp, session/task ID, canonical type, result, metadata, dan schema version.

Setelah sesi ditutup, SQLite menyimpan session summary berisi task success rate, average/median completion time, action failure rate, recovery success rate, clarification, intervention/takeover, help, total action, dan hasil tiap task. JSON mempertahankan event mentah dan hasil turunan; CSV mengekspor field hasil task. Kegagalan telemetry opsional menandai recording `DEGRADED` tanpa menghentikan agent. Durable action intent tetap fail-closed karena dispatch tanpa audit trail akan merusak keselamatan dan validitas.

## Dokumentasi

- [SETUP](SETUP.md): langkah konfigurasi yang harus dilakukan di komputer peneliti.
- [STATUS](STATUS.md): pengujian yang benar-benar dilakukan dan gap yang masih terbuka.
- [ACCEPTANCE](ACCEPTANCE.md): pemetaan AC-01–28 dan checklist manual.
- [GITHUB](GITHUB.md): membuat repository privat dan push tanpa membagikan token di chat.
- [PRD asli](PRD.md): sumber requirement; implementasi tidak menggantikan spesifikasi.

Referensi teknis: [Playwright ARIA snapshots](https://playwright.dev/docs/aria-snapshots), [Ollama API chat](https://docs.ollama.com/api/chat), [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [bahasa eSpeak NG](https://github.com/espeak-ng/espeak-ng/blob/master/docs/languages.md).
