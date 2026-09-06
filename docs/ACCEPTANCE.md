# Pemetaan acceptance dan checklist pilot

Lulus unit test hanya membuktikan fungsi yang diuji. “Ditulis” bukan “dijalankan”.

| AC | Bukti saat handoff |
| --- | --- |
| 01 | Browser test EARLY P/B1 ditulis; belum dijalankan |
| 02–03 | Unit router P/B1 dan non-evidence annotation lulus |
| 04–05 | Unit base price, missing/scope/conflict, extractor lulus |
| 06 | Domain no-solution ada; full browser belum diuji |
| 07–08 | Unit ceilings dan restoration route cost lulus; full trace belum diuji |
| 09 | Unit staged HTML leakage lulus; browser snapshot test ditulis |
| 10 | Detached replacement browser test ditulis; belum dijalankan |
| 11 | Deterministic verifier diimplementasikan; fault browser belum diuji |
| 12 | Oracle versus fake-cart stored state lulus unit; browser belum diuji |
| 13 | Add tidak di-retry dalam kode; timeout-after-effect integration belum diuji |
| 14–15 | Pending-model stop unit lulus; browser/TTS/real mic race belum diuji |
| 16 | Grammar approval ambigu dan TTL/effect binding lulus unit |
| 17–18 | State/dedup/budget ada; transition race dan semua no-progress fault belum diuji |
| 19 | Crash restart SQLite lulus unit; disk full/browser crash belum diuji |
| 20–22 | Alur voice dan UI awal ada; bantuan audio tetap/reference resolution/manual masih gap |
| 23 | Oracle independen dan fake-cart unit lulus; replay same-trace belum diuji |
| 24 | CSV/null/denominator unit lulus; export real benchmark belum ada |
| 25 | Expiry verbatim/delete cascade SQLite lulus; salinan download tanggung jawab peneliti |
| 26 | Belum: seluruh engine nyata offline belum dijalankan |
| 27 | Dataset terpisah dan parser demo diuji; generalisasi model nyata belum diuji |
| 28 | 64-cell manifest, pasangan domain data, holdout template dan study balance lulus unit |

## Checklist manual — catat bukti, jangan sekadar centang

- [ ] Semua gap kritis STATUS.md ditutup; integration test lulus pada commit target.
- [ ] Identitas hardware, model digest/quantization, engine versions, TTS rate dicatat.
- [ ] Goal parser memahami nominal rupiah dan mempertahankan field saat koreksi.
- [ ] B1 menyelesaikan dua STAGED solvable berbeda dengan probe nyata.
- [ ] Snapshot/LLM payload terbesar masuk context tanpa pemotongan.
- [ ] Stop/Escape saat LLM, action, TTS, dan transisi tidak memicu dispatch baru.
- [ ] “Ya, tapi ukuran L”, silence, noise, dan late STT tidak memberikan approval salah.
- [ ] Denied mic, STT/TTS mati, output audio gagal: bantuan dan keluar dapat diakses.
- [ ] Satu alur tanpa melihat layar: consent → readiness → goal → approval → result → NEXT.
- [ ] Screen reader, fokus, keyboard, volume, pronunciation rupiah diuji.
- [ ] Audio mentah tidak masuk file, logs, export, atau backup.
- [ ] Semua proses hanya loopback; internet dimatikan setelah instalasi dan task tetap jalan.
- [ ] Consent, kontak, prosedur etik, withdrawal dan data custodian benar-benar terisi.
- [ ] Pilot terpisah dari empat peserta utama; manifest/order/config dibekukan.

Simpan catatan pilot di penyimpanan penelitian lokal, bukan commit yang berisi identitas/transkrip peserta. Kegagalan pilot tidak boleh diubah menjadi klaim perbedaan kebijakan.
