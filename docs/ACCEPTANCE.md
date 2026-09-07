# Pemetaan acceptance dan checklist pilot

Lulus unit test hanya membuktikan fungsi yang diuji. “Ditulis” bukan “dijalankan”.

| AC | Bukti saat handoff |
| --- | --- |
| 01 | Browser test EARLY P/B1 lulus dengan Chromium nyata |
| 02–03 | Unit router P/B1 dan non-evidence annotation lulus |
| 04–05 | Unit base price, missing/scope/conflict, extractor lulus |
| 06 | No-solution browser lulus dengan public refutations dan oracle |
| 07–08 | Unit ceilings dan restoration route cost lulus; full trace belum diuji |
| 09 | Unit + browser snapshot staged leakage lulus |
| 10 | Detached replacement browser test lulus |
| 11 | Deterministic verifier + false-toast browser test lulus |
| 12 | Oracle versus fake-cart lulus unit dan browser |
| 13 | Add tidak di-retry; fake-cart/empty-cart reconciliation lulus, delayed timeout fault masih manual |
| 14–15 | Pending-model stop unit lulus; browser/TTS/real mic race belum diuji |
| 16 | Grammar approval ambigu dan TTL/effect binding lulus unit |
| 17–18 | State/dedup/budget ada; transition race dan semua no-progress fault belum diuji |
| 19 | Crash restart SQLite lulus unit; disk full/browser crash belum diuji |
| 20–22 | Alur voice dan UI awal ada; bantuan audio tetap/reference resolution/manual masih gap |
| 23 | Reference-goal oracle, wrong parsed goal, fake-cart/false-toast, exact variant/price/quantity dan evaluator-path non-leakage lulus unit/browser; replay same-trace belum diuji |
| 24 | CSV/null, isolated experiment identity, incomplete denominator, duplicate dan replacement unit lulus; main benchmark belum dijalankan |
| 25 | Expiry verbatim/delete cascade SQLite lulus; salinan download tanggung jawab peneliti |
| 26 | Belum: seluruh engine nyata offline belum dijalankan pada perangkat studi |
| 27 | Dataset terpisah dan parser demo diuji; generalisasi model nyata belum diuji |
| 28 | 64-cell manifest, denominator 24/4/4 per policy, matched ACT/ABSTAIN, evaluator-only minimum paths, holdout template dan study balance lulus unit |

## Research-hardening checks

| Area | Bukti otomatis saat handoff | Gate yang masih nyata |
| --- | --- | --- |
| P/B1 fairness | Router unit, same annotation DTO, single-probe no-ranking/comparison, deterministic tie-break | Real-model trace review dan dua STAGED success B1 |
| Oracle independence | Wrong parsed goal tetap dinilai terhadap scenario/reference goal; participant correction menjadi manual-adjudication | Manual participant intent annotation protocol |
| Ledger/denominator | Browser startup failure sudah attempted; grouping/duplicate/replacement tests | Main original 64-run execution setelah freeze |
| Budget | Retry forward membayar probe+action; pre-dispatch binding failure tidak dihitung | Real trace/ceiling feasibility pada perangkat target |
| Evidence/abstention | Reference minimum paths tidak masuk planner; closure/excess metric; matched ACT/no-solution/unavailable browser tests | Dataset freeze review oleh peneliti |
| Accessibility | Automated axe dan keyboard skip-link lulus | Full keyboard, NVDA, mic, TTS/STT, earcon, collision, pilot pengguna target |
| Automatic evaluation | Canonical event mapping, oracle-grounded task status, action/retry/recovery counters, null denominator, median/rate, crash/startup failure, raw export dan summary persistence lulus | Review field/retention dengan protokol etik sebelum pilot |

## Checklist manual — catat bukti, jangan sekadar centang

- [ ] Semua gap kritis STATUS.md ditutup; integration test lulus pada commit target.
- [ ] Identitas hardware, model digest/quantization, engine versions, TTS rate dicatat.
- [ ] Goal parser memahami nominal rupiah dan mempertahankan field saat koreksi.
- [ ] B1 menyelesaikan dua STAGED solvable berbeda dengan probe nyata.
- [ ] Snapshot/LLM payload terbesar masuk context tanpa pemotongan.
- [ ] Stop/Escape saat LLM, action, TTS, dan transisi tidak memicu dispatch baru.
- [ ] “Ya, tapi ukuran L”, silence, noise, dan late STT tidak memberikan approval salah.
- [ ] Denied mic, STT/TTS mati, output audio gagal: bantuan dan keluar dapat diakses.
- [ ] Satu alur tanpa melihat layar: consent → readiness/practice → system task → “mulai”/correction → approval → result/uncertainty → post-task question → NEXT.
- [ ] Screen reader, fokus, keyboard, volume, pronunciation rupiah diuji.
- [ ] Audio mentah tidak masuk file, logs, export, atau backup.
- [ ] Semua proses hanya loopback; internet dimatikan setelah instalasi dan task tetap jalan.
- [ ] Consent, kontak, prosedur etik, withdrawal dan data custodian benar-benar terisi.
- [ ] Pilot terpisah dari empat peserta utama; manifest/order/config dibekukan.

Simpan catatan pilot di penyimpanan penelitian lokal, bukan commit yang berisi identitas/transkrip peserta. Kegagalan pilot tidak boleh diubah menjadi klaim perbedaan kebijakan.
