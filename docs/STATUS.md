# Status implementasi — 7 September 2026

Status ini memisahkan implementasi dari bukti yang benar-benar sudah dijalankan. Sistem adalah research MVP yang diperkeras, **belum participant-ready** dan belum menghasilkan hasil main benchmark.

## Sudah diimplementasikan

- P/B1 capability-matched; hanya probe selector yang berbeda. Single eligible probe tidak memanggil ranking LLM dan tidak dihitung sebagai comparison.
- Oracle fixed benchmark memakai independent scenario/reference goal, menyimpan parsed goal dan mismatch. Participant correction menyimpan revision history serta menandai kebutuhan adjudikasi manual tanpa memakai cart sebagai intended-goal oracle.
- Run ID dan attempt dipersist sebelum browser startup. Startup failure/process interruption tetap menjadi original `infrastructure_failed` yang tidak ditimpa.
- Report mengisolasi split/mode/demo/config/prompt/dataset/freeze/model; denominator planned/attempted/completed/infrastructure/oracle-null/unattempted, duplicate, serta paired replacement eksplisit.
- Budget memisahkan probe/action/observation/LLM/token/wall time. Forward retry membayar action dan probe; binding failure sebelum dispatch tidak membayar browser action.
- Controlled scenarios menyimpan evaluator-only decision, decisive constraints, dan minimum evidence path; metric closure, informative probe, evidence per probe, dan excess cost tersedia.
- Dataset main tetap 64 episode dengan matched ACT/no-solution/unavailable-evidence counterfactual pada sebagian base.
- Failure taxonomy tersedia tanpa exception hierarchy baru.
- Participant dapat menerima system task dengan `mulai`, memberi correction singkat, reject proposal, repeat/skip/stop, dan menggunakan Escape. Stale approval/turn dibatalkan.
- Voice worker dipertahankan selama sesi sehat; timeout/restart dan stale/cancelled request dicatat/dibatalkan. Mic ditutup saat TTS dan bantuan menyebut Escape sebagai stop yang tetap tersedia.
- Automated accessibility QA memakai axe; warna status/teks yang sebelumnya gagal contrast sudah diperbaiki.

## Sudah diverifikasi di lingkungan pembangunan ini

- TypeScript strict dan build produksi: lulus.
- Unit/lifecycle/dataset/SQLite/HTTP: 39 test lulus.
- Browser integration memakai Playwright + Chromium nyata: 13 test lulus, termasuk EARLY/STAGED P/B1, no-solution, unavailable evidence, budget exhaustion, rejection, false toast, fake cart, detached reference, retry accounting, serta reference-goal oracle.
- Automated axe coordinator + keyboard skip-link: 1 test lulus.
- HTTP startup-failure test membuktikan attempted run sudah ada sebelum browser dan dipulihkan sebagai infrastructure failure dengan run ID yang sama.
- Test planner/demo membuktikan `mulai`, short correction, vague price clarification, dan single-probe no-ranking.
- Semua hasil di atas memakai `DemoModel`/test double yang eksplisit; **bukan inferensi model penelitian nyata**.

Chromium Playwright belum tersedia pada percobaan pertama lalu dipasang; suite diulang dan lulus. Shell pembangunan saat ini melaporkan Node 22.14.0, sedangkan runtime normatif repo adalah Node 24+, sehingga startup penuh Node 24 tetap gate perangkat.

## Belum diverifikasi — jangan dianggap lulus

- Ollama qwen2.5:7b (atau model final setelah development comparison), digest/structured output compatibility, dan dua STAGED success B1 nyata.
- Startup penuh satu command pada Node 24 dengan Ollama, faster-whisper, eSpeak NG, dan Chromium.
- Mikrofon/VAD nyata, faster-whisper, TTS Bahasa Indonesia, latency, cancellation/restart worker, serta kegagalan audio setelah terminal.
- Keyboard-only lengkap dan NVDA/screen reader nyata, termasuk focus order, live region, earcon, collision TTS/screen reader, repeat/stop/correction.
- Pilot dengan pengguna tunanetra target; consent/prosedur etik dan researcher intervention protocol.
- Freeze final, seluruh 64 main original attempts, replacement analysis bila diperlukan, dan studi participant.
- Perbandingan development-only Qwen2.5 7B/Qwen3 4B/Qwen3 8B belum dijalankan; current model tidak diubah.

## Remaining research gates

1. Tetapkan interaction ceiling dari feasibility development/pilot, bukan konfigurasi yang memperbesar selisih P.
2. Validasi setiap intended-solvable mempunyai path lengkap termasuk commit dan verification di bawah seluruh ceiling.
3. Jalankan competence check B1 pada minimal dua STAGED task dengan model nyata. Disagreement nol hanya memicu audit implementasi, bukan manipulasi baseline/dataset.
4. Jalankan preflight perangkat dan pilot nonvisual nyata. Jangan mengaktifkan `HUMAN_STUDY_ENABLED` sebelum bukti dicatat.
5. Freeze commit/config/prompt/dataset/model sesudah pilot, lalu jalankan main original cells tanpa menimpa failure. Laporkan main yang belum lengkap sebagai belum lengkap.
6. Lakukan review sebelum main terhadap fairness, baseline weakening, oracle/reference-path leakage, denominator, replacement, dan budget symmetry.

Daftar ini sengaja eksplisit. Repo menyediakan eksperimen kecil yang dapat diaudit, bukan general computer-use agent, sistem produksi, atau bukti bahwa P lebih unggul.
