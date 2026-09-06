# Revisi implementasi PRD v4

Dokumen ini adalah delta yang sengaja berbeda dari PRD referensi. PRD asli tetap menjadi catatan requirement dan keputusan awal; delta ini berlaku untuk implementasi setelah audit end-to-end.

## Keputusan yang diubah

1. **P adalah constraint-directed, bukan candidate-order-first.** Setelah filtering bersama, P mengurutkan `satisfied constraint`, lalu coverage terhadap constraint yang masih `UNKNOWN`, baru forward cost dan urutan stabil.
2. **Batas LLM menjadi 12 call/run**, sama untuk P dan B1. Recovery verifikasi memakai satu settle-read dan paling banyak satu retry idempoten; ADD_CART tidak pernah diulang.
3. **STAGED boleh menampilkan bukti publik parsial yang material** di daftar/detail, tetapi harga/stok varian tetap tertutup sampai route yang benar. Pada unavailable-evidence, fakta penentu benar-benar tidak muncul di route publik.
4. **Attempted-run ledger dimulai sebelum browser task.** Browser failure dicatat sebagai `infrastructure_failed` dengan denominator tetap. Participant ditawari mengulang item yang sama; benchmark resume hanya sel yang belum tercatat.
5. **Manipulation check wajib.** Setiap run menyimpan counterfactual P/B1 choice dan `routerDisagreements`. Development benchmark gagal-gate bila ada comparison tetapi disagreement nol. Angka demo tidak masuk hasil penelitian.
6. **Startup satu perintah dengan preflight cache.** `npm start` selalu membangun frontend, menyalakan Ollama milik aplikasi, memakai preflight tersimpan bila hash config/prompt/model masih sama, dan menjalankan preflight penuh bila cache tidak valid. `npm run start:full` memaksa pemeriksaan penuh.
7. **Percakapan mengakui goal dan status kerja.** Ack goal/correction, status mic eksplisit, earcon listen/working, cancel turn lama, repeat/skip/stop, dan correction budget diproses sebagai turn baru.

## Alasan penelitian

Perubahan ini mengurangi bottleneck yang tidak menguji novelty, mencegah denominator bias akibat browser gagal sebelum run dibuat, dan membuat perbedaan P/B1 dapat diaudit. Tidak ada perubahan model, prompt, verifier, oracle, atau data privat yang hanya menguntungkan satu kondisi.

## Gate sebelum main

Build/unit/HTTP/browser synthetic harus lulus; development dengan model nyata harus menunjukkan minimal dua STAGED success untuk B1 dan disagreement non-zero; preflight voice harus lulus; pilot keyboard/screen-reader, mic/VAD, TTS Bahasa Indonesia, stop/late-STT, dan latency maksimum tetap wajib sebelum `HUMAN_STUDY_ENABLED=true` atau freeze.
