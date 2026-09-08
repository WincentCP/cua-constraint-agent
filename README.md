# Constraint-Directed Computer-Use Agent

Sistem eksperimen otomatis berdasarkan PRD lampiran pengguna, 8 September 2026. Membandingkan policy P yang memilih pemeriksaan berdasarkan constraint yang belum terbukti dengan baseline B1 yang meranking kemajuan task secara umum. Browser, model lokal, observasi semantic, eligible probes, executor, verifier, oracle, dan budget sama untuk kedua policy.

**Jalur utama adalah CLI tanpa GUI.** Scope aktif adalah evaluasi teknis pada synthetic e-commerce; workflow studi manusia dan voice dari versi sebelumnya tidak diperlukan. PRD sumber tersedia di [PRD-AUTOMATED](docs/PRD-AUTOMATED.md), petunjuk operasional di [AUTOMATED-SETUP](docs/AUTOMATED-SETUP.md).

## Jalankan

```powershell
npm ci
npx playwright install chromium
npm run experiment -- validate
npm run experiment -- episode --demo --task development-01 --presentation EARLY --policy P
npm run experiment -- main --demo
```

Node.js 24+ diperlukan. Port 3050 harus kosong. Runner membuka synthetic environment, menjalankan Chromium headless, dan menutupnya secara otomatis. Mode demo menggunakan planner simulasi berlabel; outputnya bukan hasil penelitian.

Untuk model nyata:

```powershell
ollama pull qwen2.5:7b
npm run experiment -- doctor
npm run experiment -- repeatability --out exports/development-gate-v1
npm run experiment -- freeze --gate exports/development-gate-v1 --out config/experiment-freeze-v1.json
npm run experiment -- main --freeze config/experiment-freeze-v1.json --out exports/main-v1
```

Ollama harus berjalan di localhost:11434, atau tentukan port melalui `--ollama`. Canonical goal dimuat langsung dari fixture dan tidak memakai LLM parser. Main nyata memerlukan gate baseline competence dan 24 episode repeatability yang lulus. Tidak ada gate peserta, mikrofon, atau TTS.

## Implementasi

- 16 base task × EARLY/STAGED × P/B1 = 64 episode: 12 solvable, 2 no-solution, 2 unavailable-evidence.
- Accessibility observation melalui Playwright ARIA snapshots, evidence SATISFIED/REFUTED/UNKNOWN dengan sumber publik, shared eligible probes, serta ranking P/B1.
- ACT hanya setelah seluruh constraint terpenuhi; verifikasi memakai observasi baru. ABSTAIN membedakan no-solution dan insufficient evidence.
- Outcome dibekukan dan browser ditutup sebelum oracle membaca reference goal dan final state privat.
- Satu recovery teknis per episode, dipakai bersama oleh schema repair dan browser retry dengan budget yang tetap sama.
- CLI untuk single episode, development, repeatability, freeze, main/per-policy, metrics, dan export.
- Trace setiap episode, journal sebelum action, pemulihan attempt saat crash, dan output baru untuk setiap eksperimen.

## Output dan analisis

Setiap direktori ekspor berisi `episodes.jsonl`, `metrics.json`, `metrics.csv`, `failures.json`, dan `experiment-config.json`. Journal rinci berada di `events.jsonl`.

Empat primary metrics: verified solvable success, ACT/ABSTAIN correctness, probes to evidence closure, dan informative probe rate. EARLY/STAGED dilaporkan terpisah; P/B1 dipasangkan per base task. Attempt gagal dan sel yang belum dicoba tetap terlihat. Data demo tidak dapat meluluskan gate penelitian.

```powershell
npm run experiment -- metrics --input exports/main-v1
npm run experiment -- export --input exports/main-v1
npm run experiment -- --help
npm run build
npm test
npm run test:integration
```

## Struktur

| Direktori | Peran |
| --- | --- |
| `src/experiment` | Canonical task loader, validator, runner tanpa GUI, freeze identity, metrics |
| `src/core` | Evidence, constraint, budget, policy selector, ACT guard |
| `src/agent` | Shared agent loop, planner Ollama, public probe history |
| `src/browser` | Chromium isolation, accessibility observer, fresh-state verifier |
| `src/fixture` | Synthetic environment dan private dataset |
| `src/evaluation` | Oracle independen dan utilitas evaluasi |
| `scripts/experiment.ts` | Entrypoint CLI |
| `tests` | Unit dan integrasi browser |

Implementasi UI/voice terdahulu tetap tersimpan untuk kompatibilitas. Dokumentasinya berada di [arsip README](docs/LEGACY-README.md). Gunakan [status scope otomatis](docs/AUTOMATED-STATUS.md) untuk bukti pengujian terbaru. Tidak ada klaim P lebih unggul atau hasil penelitian model nyata yang disertakan.
