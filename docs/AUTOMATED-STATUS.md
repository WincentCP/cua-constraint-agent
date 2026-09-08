# Status sistem berdasarkan PRD otomatis

Status ini membedakan implementasi, verifikasi di komputer pembangunan, dan gate yang masih harus dijalankan dengan model penelitian nyata.

## Sudah selesai

- CLI eksperimen tanpa GUI dengan single episode, development, repeatability, main, per-policy, metrics, export, doctor, dan freeze.
- Canonical task loader memuat goal dari fixture; jalur benchmark tidak memanggil LLM goal parser.
- Dataset tervalidasi: 16 base task, EARLY/STAGED, P/B1, 64 main episode; 12 solvable, 2 no-solution, 2 unavailable-evidence.
- Shared accessibility observation, evidence matrix, eligible probe generator, ACT guard, ABSTAIN, fresh verification, dan independent oracle.
- Trace/journal durabel sebelum startup dan action, crash recovery sebagai infrastructure failure, duplicate/mixed identity rejection, dan output immutable per direktori.
- Recovery teknis satu slot bersama untuk structured output/browser retry; retry membayar budget yang sama dan cart effect tidak di-retry.
- Empat primary metrics terpisah per presentation/policy, paired task comparison, denominator incomplete/null, dan failure taxonomy.
- Development gate 4 STAGED task × 2 policy × 3 repeat = 24 episode dengan stabilitas serta competence B1 pada minimal dua task.
- Dokumentasi PRD, setup, acceptance mapping, dan batas interpretasi sudah dipisahkan dari dokumentasi UI/voice lama.

## Bukti yang dijalankan

- `npm run typecheck` lulus.
- `npm run build` lulus.
- `npm run experiment -- validate` lulus untuk 38 scenario fixture dan manifest 64 episode.
- Unit test baru `tests/experiment.test.ts`: 8 lulus.
- Main demo 64 episode selesai di Chromium nyata: 64/64 attempted, 0 infrastructure failure, 0 unattempted. Ini plumbing check dengan `DemoModel`, bukan hasil penelitian.
- Single demo EARLY ACT selesai dan oracle memverifikasi final cart.

## Belum lulus

- `npm run experiment -- doctor` pada mesin ini menemukan `qwen2.5:7b` belum terpasang. Jalankan `ollama pull qwen2.5:7b` lalu doctor ulang.
- Repeatability 24 episode dengan Ollama nyata, baseline competence B1, freeze, dan main 64 episode nyata belum dijalankan.
- Tidak ada hasil participant, claim P unggul, atau bukti generalisasi ke website/model lain.

Demo output berada di direktori yang di-ignore Git (`exports/`) dan sengaja tidak menjadi bagian repository.
