# Revisi implementasi PRD v4 — research hardening

Dokumen ini adalah delta normatif yang disepakati setelah audit end-to-end. PRD asli tetap menyimpan konteks dan requirement lain; bila terjadi konflik pada metode penelitian, delta ini berlaku. P/B1 adalah metode evaluasi. Kontribusi yang diuji adalah kebijakan prioritas pemeriksaan dan manfaat empirisnya, bukan klaim algoritma pertama.

## Research framing

**Main RQ:** Dengan model, observasi publik, tools, verifier, dan interaction budget yang sama, apakah constraint-directed evidence acquisition meningkatkan verified task success dan efisiensi pemerolehan bukti pada task solvable, sambil mempertahankan appropriate abstention ketika tidak ada solusi atau bukti yang cukup, dibandingkan generic LLM progress-based exploration?

- **RQ1 — Effectiveness:** verified objective success pada task solvable.
- **RQ2 — Evidence efficiency and abstention:** decisive evidence, informative probes, evidence closure, excess probe cost, dan keputusan ACT/ABSTAIN.
- **RQ3 — Exploratory accessibility:** pemahaman proposal/hasil/uncertainty, correction, dan interaksi nonvisual voice + keyboard/screen reader. Temuan peserta kecil tidak digeneralisasi luas.

## Keputusan implementasi

1. **P dan B1 adalah agent yang sama.** Keduanya menerima goal, public observation, evidence matrix, eligible probes, route/cost, model/config, parser, observer/extractor, executor/verifier/recovery, approval/UI, dan runtime ceiling yang sama. Kondisi tidak diberikan kepada model. Observasi sesudah pilihan berbeda boleh berbeda.
2. **Prioritas P tidak diubah tanpa keputusan peneliti:** jumlah constraint `SATISFIED`, coverage constraint `UNKNOWN` yang diperkirakan dapat dijawab, forward cost lebih rendah, stable deterministic tie-break. B1 memakai `generic_progress_score` dari LLM dengan tie-break deterministik dan boleh mempertimbangkan seluruh goal, constraints, evidence, feasibility, route, costs, serta remaining budget. Jangan melemahkan B1.
3. **Satu probe eligible bukan comparison.** Pilih deterministik identik untuk P/B1 dan lewati ranking LLM bila annotation tidak diperlukan oleh fungsi lain. Disagreement nol memicu inspeksi implementasi, bukan kegagalan penelitian dan bukan alasan mengubah baseline/dataset.
4. **Oracle memakai independent reference goal.** Parsed goal, reference goal, kecocokan, reason, feasible state, dan wrong final effect disimpan terpisah. Outcome agent dibekukan sebelum oracle. Pada participant correction, simpan task awal, transcript, parsed revisions, dan revision history; maksud revisi memerlukan anotasi independen bila tidak pasti, bukan disalin dari parser/cart.
5. **Attempted-run ledger mendahului browser:** buat run ID → persist attempt → startup browser → execute. Startup failure/crash tetap `infrastructure_failed`, tidak ditimpa, dan masuk attempted denominator.
6. **Reporting memisahkan identitas eksperimen.** Split, session mode, demo, config, prompt, dataset, freeze, dan model tidak dicampur. Report menampilkan planned, attempted, completed, infrastructure failure, oracle null, unattempted, duplicate, dan replacement. Duplicate `base + presentation + condition` ditolak. Replacement memakai pasangan P/B1, ID serta alasan baru, dan tidak mengganti original analysis.
7. **Budget mengukur interaksi nyata.** Probe, browser action, observation, LLM call/token, dan wall time terpisah. Setiap dispatch menambah action; retry forward dispatch juga menambah probe. Binding failure sebelum dispatch tidak dihitung. ADD_CART tidak diulang; reconciliation terbatas.
8. **RQ2 memakai reference evidence path evaluator-only.** Setiap controlled task menentukan keputusan ACT/ABSTAIN, decisive constraints, serta minimum public evidence path sederhana. Data ini tidak masuk agent context. Report menghitung probes to evidence closure, informative probe rate, evidence acquired per probe, dan excess probe cost; denominator yang tidak bermakna adalah `null/N/A`.
9. **Matched ACT/ABSTAIN tetap dalam 64 episode.** Beberapa scenario memakai goal/struktur hampir sama tetapi outcome benar berbeda: ACT, no-solution dengan public refutation, atau unavailable-evidence dengan decisive fact yang memang tidak tersedia. Ini menguji kecukupan bukti, bukan kebiasaan selalu bertindak/abstain.
10. **Failure taxonomy ringan:** goal/parser, grounding/binding, constraint/evidence, probe-budget, execution, verification, infrastructure, dan voice/device. Gunakan terminal reason yang ada; tidak menambah hierarchy exception.
11. **Participant menerima system task.** Task dibacakan sekali; peserta berkata `mulai` atau correction singkat. “Bukan yang itu” menolak kandidat, “ya tapi ukuran L” merevisi goal dan membatalkan approval lama, sedangkan “lebih murah” tanpa angka meminta satu klarifikasi. Correction tidak mereset budget/deadline. Progress feedback singkat dan bermakna, bukan narasi setiap klik.
12. **Voice worker dipertahankan selama sesi sehat.** Callback/turn lama ditolak, cancellation membersihkan pending request, worker stuck boleh restart dan insidennya dicatat. Raw audio tidak disimpan. Saat TTS, mic ditutup; stop suara tidak tersedia dan Escape tetap tersedia. Jangan mengklaim hands-free penuh.
13. **Startup tetap satu command.** `npm start` membangun frontend, menyalakan Ollama lokal milik aplikasi, memakai preflight cache tervalidasi atau menjalankan preflight penuh, lalu membuka Coordinator. `npm run start:full` memaksa pemeriksaan penuh. Model tidak diganti tanpa development/pilot comparison sebelum freeze.

## Batas klaim dan gate

Accessibility Tree, voice, evidence matrix, verifier, approval, dan oracle adalah supporting infrastructure. Jangan mengklaim first accessibility-tree CUA, first verifier/shopping/blind-user agent, universal superiority, atau novelty yang sudah terbukti tanpa pembandingan literatur memadai.

Build, unit, HTTP, browser synthetic, serta axe adalah bukti engineering terbatas. Dua keberhasilan B1 STAGED dengan model nyata adalah competence check minimum, bukan bukti baseline kuat pada seluruh dataset. Interaction ceilings ditentukan pada development/pilot berdasarkan kelayakan task dan perangkat, bukan gap P terbesar.

Sistem belum boleh disebut participant-ready sampai real Ollama, Chromium, microphone, faster-whisper, TTS Bahasa Indonesia, keyboard, NVDA/screen reader, latency, dan satu pilot pengguna target benar-benar lulus. Satu domain tetap dipertahankan; perubahan domain, RQ, baseline, urutan P, atau protokol setelah freeze memerlukan keputusan peneliti.
