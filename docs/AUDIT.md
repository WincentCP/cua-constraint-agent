# Audit end-to-end dan keputusan pematangan

Audit ini membedakan instruksi PRD referensi dari permintaan pengguna. PRD tidak diikuti secara buta ketika menambah latency, mengulang observe tanpa informasi baru, atau membuat denominator benchmark bias.

## 1. What Works

- Boundary agent/browser/oracle bersih; agent tidak mengimpor fixture atau oracle.
- Evidence bersumber dari accessibility snapshot, scoped per kandidat/varian, deduplicated semantik, dan refuted/unknown tidak dipaksa menjadi feasible.
- Approval terikat effect, revision, harga, TTL, dan single-use. ADD_CART tidak di-retry; cart dibaca ulang untuk rekonsiliasi.
- P/B1 berbagi model, prompt, evidence, budget, route discovery, verifier, recovery, dan UI. Percabangan condition hanya di router.
- Public IDs kini opaque; title/seed tidak membocorkan posisi jawaban. Development dan main memakai posisi feasible yang berbeda.
- Export JSON/CSV, retention/delete, origin/host guard, session token/researcher token, dan independent oracle bekerja.
- Browser integration Chromium nyata: 13/13 lulus, termasuk no-solution, insufficient evidence, budget ceiling, approval decline, false toast, dan fake-cart oracle detection.
- Demo UI nyata berhasil consent, readiness, NEXT, goal ack, proposal, approval, dan verified result; correction budget menghasilkan revision baru; Escape menutup sesi; console bersih.

## 2. Critical Problems

- Engine Ollama, faster-whisper, eSpeak, microphone, dan screen-reader belum dijalankan pada perangkat studi; sistem belum boleh disebut siap participant.
- `fake-cart` sengaja menunjukkan batas trust UI: agent dapat mengklaim sukses dari tampilan palsu, tetapi oracle memisahkannya. Ini harus dilaporkan sebagai false completion.
- Real-model B1 belum dibuktikan competent pada dua STAGED task. Demo baseline adalah test double, bukan evidence model qwen.
- `Origin: null` pada form task sempat mematahkan runtime nyata; sekarang hanya diterima di fixture route dengan cookie rahasia, dan API tetap strict.

## 3. Research Fit

Masalah penelitian sekarang terlihat: budget probe terbatas, bukti constraint tersebar pada daftar/detail, dan policy memilih probe. P memprioritaskan constraint coverage. B1 tetap generic lookahead dengan input identik. Manipulation check membuktikan apakah treatment benar-benar berbeda.

Kontribusi masih realistis untuk skripsi S1 sebagai evaluasi controlled local agent, bukan klaim general web-agent atau superiority universal. Benchmark harus memasukkan solvable, no-solution, unavailable-evidence, dan budget-limited cells; success bukan satu-satunya outcome.

## 4. Bottlenecks

- Verification kini satu settle-read lalu satu retry idempoten, bukan observe loop sampai tiga detik.
- Full preflight setiap startup mahal; cache hash config/prompt/model dipakai, dengan `start:full` sebagai override.
- `npm run benchmark -- --development` menunggu completion dan mencetak progress/result count.
- Remaining expensive components yang harus diukur pada model nyata: goal parse/correction, annotation per probe, TTS/STT latency, dan payload context maksimum.

## 5. Conversation & UX Issues

Sudah diperbaiki: ack singkat setelah goal, status mic eksplisit, earcon listen/working, deferred speech agar TTS tidak hilang, cancellation turn lama, correction budget/size, approval “bukan yang itu”, repeat/skip/stop, dan task transition yang menunggu NEXT.

Masih wajib diuji dengan tunanetra: keterpahaman earcon, volume/rate suara Indonesia, apakah status “Mendengar stop atau koreksi” cukup jelas, silence/noise/late-STT, keyboard focus, screen reader live status, dan apakah narasi hasil terlalu panjang.

## 6. Research Validity Issues

- P/B1 fairness: shared inputs/code confirmed; `router_comparisons` dan `router_disagreements` tercatat. Development demo terakhir menghasilkan 15/39 disagreement; demo tidak masuk summary.
- Oracle leakage: agent hanya melihat public route; no-solution/unavailable tests memastikan private truth tidak dipakai.
- Dataset: public slugs opaque dan positions disjoint; template/layout holdout tetap perlu diperiksa sebelum freeze.
- Denominator: browser-start failure kini run result eksplisit; benchmark main resume hanya mengisi cell yang belum ada dan tidak menimpa kegagalan.
- Jika real B1 disagreement nol atau STAGED selalu gagal karena competence, itu limitation yang harus dilaporkan, bukan prompt yang dilemahkan.

## 7. Recommended Changes

| Masalah | Solusi | Prioritas | Code/PRD | Nilai penelitian |
|---|---|---:|---|---|
| Voice engine belum tervalidasi | Full preflight + pilot nyata dan simpan hardware/model digest | P0 | keduanya | Memisahkan failure agent dari failure perangkat |
| B1 belum terbukti kompeten | Dua STAGED success lintas base dan cek invalid-output rate | P0 | protokol | Manipulation/competence gate |
| Participant bisa bingung saat status | Uji screen reader/earcon/rate; potong narasi jika completion time naik | P1 | pilot + UI | Accessibility menjadi outcome |
| Fault timeout/late STT belum lengkap | Fault-injection test delayed POST, stale audio, disconnect | P1 | code/test | Recovery/stop fence terbukti kausal |
| Template masih mostly semantic labels | Tambah 2 layout ringan dengan kontrak AX sama sebelum freeze | P1 | dataset/PRD | Benchmark lebih realistis |
| Export belum punya attempt-level view khusus | Gunakan manifest_index, run start failure, counters, oracle terpisah | P1 | code/report | Denominator/replacement transparan |
| Full benchmark bisa panjang | Progress polling/resume; jangan parallelize satu session | P2 | code | Reproducible dan realistis |

## 8. Proposed Final Workflow

1. Researcher: `npm ci`, install browser/engine sekali, isi `.env`, lalu `npm start`; startup build dan memakai/menjalankan full preflight.
2. Researcher: jalankan development benchmark; command menunggu completion dan gate disagreement/competence.
3. Researcher: pilot voice/screen-reader/latency, isi checklist, `npm run freeze -- --pilot-approved`, lalu commit freeze.
4. Participant: consent, readiness “siap”, NEXT. Agent memberi ack singkat, membuka mic hanya pada listen, memberi earcon/status kerja, memeriksa bukti, meminta approval, memverifikasi cart, lalu menunggu NEXT.
5. Participant control: “ulang” mengulang audio terakhir, “bukan yang itu” menolak kandidat, koreksi ukuran/budget membuat revision baru, “lewati” menyimpan skipped, Escape/“selesai” menutup dispatch gate.
6. Researcher: panel melihat progress/results, abort bila perlu, export JSON/CSV setelah completion, dan delete session/export copies sesuai consent.
7. Main: 64 cells hanya setelah freeze; resume hanya unfinished cells, semua attempted/infrastructure/replacement dilaporkan; analisis utama paired by base, bukan 64 independent samples.
