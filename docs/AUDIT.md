# Audit end-to-end dan targeted research hardening

Audit ini membedakan requirement, implementasi aktual, dan hasil yang benar-benar diverifikasi. PRD referensi tidak diikuti ketika menambah latency/complexity tanpa explanatory power; keputusan metode terbaru dicatat di `PRD-REVISION.md`.

## 1. What Works

- Arsitektur tetap satu aplikasi React/Node/Playwright/SQLite dengan worker lokal; realistis diaudit untuk skripsi S1 dan tidak berkembang menjadi general web agent.
- Evidence berasal dari accessibility snapshot publik, scoped per kandidat/varian, dengan `SATISFIED/REFUTED/UNKNOWN`; unknown tidak diperlakukan sebagai bukti positif.
- Approval terikat run/revision/effect/harga/TTL dan single-use. ADD_CART tidak diulang; verifier membaca state segar dan reconciliation terbatas.
- P/B1 berbagi goal, observation, matrix, eligible probes, model/prompt/parser, routes/costs, executor, verifier/recovery, UI, dan budget. Kondisi hanya mengubah probe-selection policy.
- Oracle berjalan setelah outcome beku dan menilai stored cart terhadap independent scenario/reference goal. Fake cart/false toast tidak dapat mendefinisikan ground truth.
- Run ledger dibuat sebelum browser startup; crash/startup failure tetap attempted infrastructure failure.
- Main manifest tetap 64 episode dengan denominator 24 solvable, 4 no-solution, dan 4 unavailable-evidence per policy.
- Automated suite mencakup 39 unit/HTTP, 13 browser integration, dan 1 axe/keyboard test.

## 2. Critical Problems

- Sistem belum participant-ready: Ollama/model final, Node 24 startup, faster-whisper, TTS, microphone/VAD, NVDA, latency, dan pilot pengguna target belum diverifikasi bersama.
- Real-model B1 belum lulus competence check minimal dua STAGED task; hasil DemoModel tidak dapat dipakai sebagai bukti baseline penelitian.
- Automated AX/axe bukan bukti pengalaman screen reader atau voice yang natural. Collision TTS/NVDA, clarity mic state, earcon, pronunciation, dan stop saat TTS masih gate perangkat.
- Participant correction yang mengubah intended goal tidak dapat dinilai otomatis dengan aman. Implementasi sengaja menghasilkan `oracle_success=null` + manual adjudication requirement sambil mempertahankan original-task assessment.

## 3. Research Fit

Research mechanism sekarang eksplisit: di bawah budget yang sama, agent memilih public evidence probe; P memakai constraint state untuk menutup gap bukti, sedangkan B1 memakai generic LLM progress assessment. Agent ACT hanya setelah evidence closure atau ABSTAIN dengan reason yang tepat. Independent oracle menilai objective outcome tanpa membantu execution.

RQ1 didukung verified solvable success; RQ2 didukung probes-to-closure, informative probe rate, evidence/probe, excess cost, matched ACT/ABSTAIN, dan failure taxonomy; RQ3 tetap eksploratif pada pemahaman/correction/nonvisual flow. Accessibility Tree, voice, matrix, verifier, approval, dan oracle adalah supporting infrastructure, bukan novelty.

Kontribusi ini layak untuk skripsi S1 sebagai eksperimen kecil dan reproducible. Keunggulan P bukan asumsi atau Definition of Done; disagreement nol atau hasil negatif adalah limitation yang sah setelah implementation audit.

## 4. Bottlenecks

- Single eligible probe kini tidak membutuhkan annotation/ranking LLM; ini mengurangi latency identik pada P/B1 tanpa mengubah treatment.
- Verification memakai settle-read dan paling banyak satu bounded recovery; ADD_CART tidak mendapat blind retry.
- Voice worker tetap hidup selama sesi sehat sehingga model tidak reload per task; timeout/cancellation dapat memicu restart yang tercatat.
- Startup memakai validated preflight cache, dengan `start:full` untuk audit penuh.
- Remaining cost yang harus diukur, bukan ditebak: real goal parse/correction, multi-probe annotation, snapshot/token size, STT/TTS, wall time, dan memory feasibility model.

## 5. Conversation & UX Issues

Flow tidak lagi meminta participant mengulang task: system membacakan task satu kali, participant berkata `mulai` atau correction. Agent memberi acknowledgment dan status singkat, satu proposal, hasil/uncertainty, lalu menunggu `lanjut`. “Bukan yang itu” menolak kandidat; “ya tapi ukuran L” merevisi goal dan membatalkan stale approval; “lebih murah” meminta satu angka. Repeat/skip/stop/Escape tersedia dan informasi penting masuk live region/audio, bukan visual saja.

Mic ditutup selama TTS. Karena itu voice stop tidak tersedia saat agent berbicara; bantuan menyatakan Escape tetap tersedia dan sistem tidak diklaim hands-free penuh. Naturalness Bahasa Indonesia, panjang narasi, silence/noise, late STT, audio failure, task transition, dan seluruh sepuluh conversation scenarios masih memerlukan real voice/screen-reader pilot.

## 6. Research Validity Issues

- **Fairness:** P priority dibekukan pada SATISFIED count → UNKNOWN coverage → lower forward cost → stable tie-break. B1 melihat seluruh context dan tidak dilemahkan. Single-probe choice tidak dianggap router comparison.
- **Oracle/reference leakage:** evaluator-only reference goal/path/decisive constraints tidak masuk planner DTO. Wrong parsed goal tetap gagal terhadap fixed reference; participant revision tidak otomatis menjadi truth.
- **Benchmark realism:** matched scenarios membedakan ACT, public no-solution, dan truly unavailable evidence; actual variant price/stock tetap memerlukan inspection. Tiga candidate membatasi realism dan harus dinyatakan sebagai controlled scope, bukan live-web generalization.
- **Denominator:** report memisahkan experiment identity, incomplete main, infra/oracle-null, duplicate, original, dan paired replacement. Original failure tidak dihapus.
- **Budget:** actual dispatch membayar action; forward retry juga probe; pre-dispatch binding failure gratis karena belum ada browser interaction. Semua ceilings sama.
- **Freeze risk:** model, prompt, budget, dataset, baseline, atau P priority tidak boleh dipilih/diubah setelah melihat main untuk memaksimalkan kemenangan P.

## 7. Recommended Changes

| Masalah | Solusi | Priority | Revisi | Penguatan penelitian |
| --- | --- | --- | --- | --- |
| Real engine belum terbukti | Jalankan Node 24 one-command preflight dan trace satu task end-to-end | P0 | setup + bukti | Memisahkan implementation validity dari mock |
| B1 competence belum terbukti | Dua STAGED success model nyata + parse/annotation validity/latency | P0 | protokol | Mencegah baseline terlalu lemah |
| Nonvisual flow belum tervalidasi | Keyboard + NVDA + mic/STT/TTS + satu pilot target | P0 | test/protokol | Membuat RQ3 berbasis observasi nyata |
| Interaction ceilings belum empiris | Tetapkan dari feasibility path lengkap pada development/pilot | P0 | config/PRD bila berubah | Mencegah outcome-driven budget tuning |
| Reference path membutuhkan review | Audit manual setiap fixture sebelum freeze; jangan expose ke agent | P1 | dataset/test | Memberi denominator efisiensi yang dapat dijelaskan |
| Failure voice/recovery belum real | Fault injection stale STT/audio, timeout, cancel, device failure | P1 | test | Menjelaskan kegagalan dan menjaga outcome beku |
| Controlled task masih sempit | Perkuat hanya variasi kandidat/evidence yang plausible sebelum freeze | P2 | dataset + PRD | External validity terbatas tanpa scope creep |

## 8. Proposed Final Workflow

1. **Researcher:** install dependency/browser/voice engine sekali, isi `.env`, lalu `npm start`. Preflight memvalidasi local model, browser, worker, storage, dan config.
2. **Development/pilot:** jalankan capability checks, validasi path solvable di bawah ceiling, test keyboard/NVDA/voice, satu pilot target, lalu freeze code/config/prompt/dataset/model.
3. **Participant:** accessible consent → readiness/practice → task dibacakan → `mulai`/correction → meaningful working feedback → satu proposal → approve/reject/correct → execution + verification → hasil/uncertainty → post-task question → `lanjut`.
4. **Agent:** observe public AX → update evidence matrix → discover shared eligible probes → select P/B1 → acquire evidence sampai ACT/ABSTAIN → never act on UNKNOWN → bounded verification/recovery.
5. **Evaluator:** setelah outcome beku, oracle menilai independent reference goal; minimum path dan ACT/ABSTAIN truth hanya dipakai offline.
6. **Benchmark:** 64 original cells setelah freeze. Resume hanya unattempted original; replacement selalu paired ID baru. Report incomplete denominator apa adanya dan analisis pair per base, bukan 64 sampel independen.
