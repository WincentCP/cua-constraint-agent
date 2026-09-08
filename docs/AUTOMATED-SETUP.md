# Menjalankan eksperimen CUA otomatis

Scope aktif mengikuti [PRD lampiran](PRD-AUTOMATED.md): evaluasi teknis pada e-commerce sintetis lokal. Workflow ini tidak memerlukan React, consent peserta, SQLite, mikrofon, STT, TTS, atau preflight studi manusia. Antarmuka dan worker lama masih tersedia sebagai arsip implementasi terpisah.

## Instalasi

Gunakan Node.js 24 atau lebih baru, npm, Chromium Playwright, dan Ollama. Jalankan dari direktori `cua-constraint-agent`:

```powershell
npm ci
npx playwright install chromium
npm run typecheck
npm run experiment -- validate
```

Port 3050 harus kosong; runner menjalankan dan menutup synthetic environment sendiri. Hentikan server demo lama sebelum menjalankan eksperimen. `CHROMIUM_PATH` opsional menunjuk executable Chromium yang sama untuk semua episode.

## Coba tanpa model

```powershell
npm run experiment -- episode --demo --task development-01 --presentation EARLY --policy P
npm run experiment -- development --demo
npm run experiment -- repeatability --demo
npm run experiment -- main --demo
```

Mode demo menjalankan browser, action, verifier, oracle, trace, dan metric calculator sungguhan, tetapi mengganti LLM dengan `DemoModel`. Config dan setiap episode menyimpan `demo: true`. Hasil ini hanya memverifikasi alur program dan tidak dapat meluluskan research gate atau dipakai sebagai hasil P vs B1 nyata.

## Model lokal

```powershell
ollama pull qwen2.5:7b
```

Pastikan Ollama berjalan. Jika layanan belum aktif, jalankan `ollama serve` pada terminal terpisah. Kemudian:

```powershell
npm run experiment -- doctor
npm run experiment -- episode --task development-01 --presentation STAGED --policy B1
npm run experiment -- development
```

Default endpoint adalah `http://127.0.0.1:11434`. Gunakan `--ollama http://127.0.0.1:11435` jika Ollama lokal memakai port lain. Endpoint harus lokal; tidak ada API cloud. `doctor` memeriksa Node, fixture, model beserta digest, dan kemampuan meluncurkan Chromium. Ia tidak mengunduh model otomatis.

Model, temperature, seed, context, output token ceiling, dan interaction budget berada pada `src/core/config.ts`. P dan B1 memakai konfigurasi identik. Model hanya meranking probe; goal pada jalur eksperimen selalu dimuat dari canonical constraints fixture. Parsing bahasa alami bukan bagian benchmark.

## Development gate dan freeze

```powershell
npm run experiment -- repeatability --out exports/development-gate-v1
npm run experiment -- freeze --gate exports/development-gate-v1 --out config/experiment-freeze-v1.json
```

Repeatability menjalankan empat task development STAGED × dua policy × tiga pengulangan = 24 episode. Gate memerlukan set lengkap, model nyata, baseline B1 berhasil pada minimal dua task berbeda, serta termination, correctness, jumlah probe dan closure yang sama dalam tiga pengulangan setiap task/policy. Waktu proses dan token tidak harus identik. Definisi ini tersimpan di `development-gate.json`.

Kegagalan gate harus diperiksa melalui trace development. Tidak ada syarat P harus mengungguli B1. Pilih model/budget/prompt pada development; perubahan kemudian mengharuskan pengulangan gate. Jangan mengatur ulang eksperimen untuk memaksa keunggulan P.

Freeze menyimpan hash source, lockfile, prompt, dataset, seluruh budget, version setiap komponen, model digest, Ollama version, Node version, dan executable Chromium. Hash diperiksa kembali sebelum main. Commit yang hanya mencatat freeze/dokumentasi tidak membatalkan file hash yang sama. Jangan mengedit berkas freeze untuk melewati gate.

## Main benchmark

```powershell
npm run experiment -- main --freeze config/experiment-freeze-v1.json --out exports/main-v1
```

Ini menjalankan 64 episode otomatis. Untuk eksekusi terpisah per policy:

```powershell
npm run experiment -- main --policy P --freeze config/experiment-freeze-v1.json --out exports/main-P-v1
npm run experiment -- main --policy B1 --freeze config/experiment-freeze-v1.json --out exports/main-B1-v1
```

Gunakan main lengkap untuk analisis pasangan otomatis dalam satu direktori. Ekspor per policy menyediakan baris mentah; jangan menggabungkan eksperimen dengan config/model/dataset berbeda. Tidak ada resume/replacement otomatis atau penimpaan output. Sebuah episode gagal tetap tersimpan dan runner meneruskan episode berikutnya. Ctrl+C menghentikan episode aktif dan mencatat sisa manifest sebagai belum dicoba.

Jika bug fundamental ditemukan setelah main dimulai, tandai eksperimen tersebut invalid dalam catatan penelitian, lakukan version bump, ulang gate/freeze, lalu jalankan seluruh benchmark di direktori baru. Simpan direktori lama sebagai audit trail.

## Berkas hasil

| Berkas | Isi |
| --- | --- |
| `episodes.jsonl` | Satu baris per episode, metadata, trace, frozen outcome, oracle, counters |
| `metrics.json` | Empat primary metrics per EARLY/STAGED dan P/B1, pasangan per base, selisih absolut, coverage |
| `metrics.csv` | Satu baris per episode untuk analisis lanjutan |
| `failures.json` | Kategori failure, episode ID, dan alasan |
| `experiment-config.json` | Config, model digest, source hashes, manifest, dan freeze yang dipakai |
| `events.jsonl` | Journal yang ditulis dan disinkronkan ke disk sebelum action/startup; dipertahankan saat crash |
| `development-gate.json` | Hanya workflow repeatability; competence dan stabilitas setiap task/policy |

Hitung ulang atau ekspor sesudah runner selesai:

```powershell
npm run experiment -- metrics --input exports/main-v1
npm run experiment -- export --input exports/main-v1
```

Jika proses mati paksa, export memulihkan attempt yang sudah mempunyai `EPISODE_START` tetapi belum mempunyai outcome sebagai infrastructure failure. Outcome lama tidak ditimpa. Export menolak direktori yang masih dijalankan proses aktif.

Success rate penuh ditampilkan `null` bila manifest kelompok belum lengkap atau oracle belum dapat menilai seluruh attempt yang relevan. Closure dirata-ratakan hanya pada episode yang mencapai closure; jumlah episodenya ditampilkan. Informative probe rate menggunakan total probe informatif / total probe, dan `null` jika tidak ada probe. Recovery action tetap membayar budget action/probe. Satu slot recovery dipakai bersama oleh perbaikan structured output dan retry browser; ACT tidak pernah dicoba ulang.

## Pengujian

```powershell
npm run build
npm test
npm run test:integration
```

Suite browser membutuhkan port 3050 kosong dan dijalankan berurutan. Pengujian sintetis tidak membuktikan kompetensi Qwen; competence dan repeatability nyata tetap harus dijalankan sebelum freeze penelitian.
