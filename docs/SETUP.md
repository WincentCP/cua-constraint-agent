# Instalasi lokal dan konfigurasi peneliti

Panduan ini tidak menyatakan engine atau model telah terpasang di komputer Anda. Jalur paling sederhana adalah Linux/Ubuntu dengan Chrome. macOS dan Windows perlu menyesuaikan lokasi Python/eSpeak; belum diuji pada perangkat tersebut.

## 1. Dependency aplikasi

Pasang Node.js **24 atau lebih baru** dan Git. SQLite menggunakan modul bawaan Node `node:sqlite`; tidak perlu database jaringan. Dari direktori project:

```bash
npm ci
npx playwright install chromium
npm run build
npm test
```

Pada Linux, jika Chromium mengeluhkan library OS yang hilang, peneliti dapat menjalankan `npx playwright install --with-deps chromium` dengan hak administrator yang diperlukan. Instalasi hanya sebelum sesi; tidak saat penelitian berlangsung.

Untuk mencoba antarmuka tanpa model:

```bash
npm run demo
```

Buka `http://localhost:3050/study`. Demo tidak memerlukan Ollama/STT/TTS karena inputnya teks dan planner-nya simulasi. Chromium diperlukan untuk menjalankan task sintetis; jika belum terpasang, demo tetap memandu consent/readiness dan memberi fallback yang dapat diulang atau ditutup, tetapi task browser akan dilewati. Data demo tidak masuk hasil penelitian. Hentikan dengan Ctrl+C.

## 2. Ollama dan model

Pasang Ollama dari situs resminya. Unduh model sebelum offline:

```bash
ollama pull qwen2.5:7b
```

`npm start` membuat proses Ollama khusus di `127.0.0.1:11435`, dengan `OLLAMA_NO_CLOUD=1`. Port 11435 dan 3050 harus kosong. Startup menolak port yang dipakai proses lain; aplikasi tidak mematikan Ollama desktop pengguna di port 11434.

Model yang diunduh oleh akun OS yang sama biasanya tersedia untuk proses Ollama khusus. Verifikasi lewat preflight; jangan menganggap nama model sudah cukup tanpa digest. Jika model tidak terdeteksi, periksa akun OS dan direktori model Ollama. Jangan menambahkan cloud endpoint/API key sebagai fallback.

## 3. STT faster-whisper small

Siapkan Python 3.10+ dan virtual environment:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r workers/requirements.txt
```

Unduh model **sekali** saat internet tersedia:

```bash
.venv/bin/python -c "from huggingface_hub import snapshot_download; snapshot_download('Systran/faster-whisper-small', local_dir='models/faster-whisper-small')"
```

Saat worker berjalan, `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, dan `local_files_only=True` mencegah unduhan otomatis. STT diatur `device=cpu`, `compute_type=int8`, `language=id`.

Pada Windows, gunakan `.venv\Scripts\python.exe` dan atur `PYTHON` di `.env` sesuai lokasi executable. Dependensi native pada Windows/macOS harus diuji di perangkat Anda.

## 4. TTS eSpeak NG Bahasa Indonesia

Pasang eSpeak NG melalui package manager OS. Contoh Ubuntu:

```bash
sudo apt-get install espeak-ng
espeak-ng --voices=id
espeak-ng -v id "Seratus lima puluh ribu rupiah"
```

Pastikan daftar voice mengandung Indonesian/`id`, dan dengarkan contoh dengan headphone studi. Kualitas/keterpahaman tidak boleh disimpulkan dari keberhasilan menghasilkan WAV saja.

## 5. Konfigurasi aplikasi

Salin `.env.example` menjadi `.env`, lalu isi melalui editor teks. `.env` tidak di-commit.

| Variabel | Isi yang diperlukan |
| --- | --- |
| `RESEARCHER_TOKEN` | String acak panjang; jangan gunakan contoh atau password akun lain |
| `RESEARCHER_CONTACT` | Kontak nyata peneliti untuk pertanyaan/withdrawal |
| `CONSENT_VERSION` | Versi penjelasan consent yang benar-benar digunakan |
| `ETHICS_PROCEDURE` | Dasar persetujuan/prosedur kampus yang nyata; jangan mengarang nomor etik |
| `DATA_CUSTODIAN` | Penanggung jawab data |
| `DELETION_PLAN` | Prosedur penghapusan dan kontak, termasuk salinan export peneliti |
| `HUMAN_STUDY_ENABLED` | Tetap `false` sampai gate teknis dan checklist pilot yang relevan dipenuhi |
| `PYTHON` | Default `.venv/bin/python`, sesuaikan OS |
| `STT_MODEL_PATH` | Default `./models/faster-whisper-small` |
| `ESPEAK_BIN` | Default `espeak-ng`, atau path executable yang sah |
| `TTS_RATE` | Default 155; tentukan melalui pilot sebelum freeze |

Anda dapat membuat token lokal sendiri dengan `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, lalu menyalinnya ke `.env`. Jangan kirim token atau `.env` ke chat/GitHub. Jika kosong, aplikasi membuat token lokal di `.runtime/researcher-token` untuk panel; token ini berbeda dari session token peserta.

## 6. Startup dan preflight

```bash
npm start
```

Startup mengecek port, menjalankan Ollama milik aplikasi, lalu memakai `data/preflight.json` hanya bila config/prompt/model digest masih cocok. Jika cache tidak valid, startup menjalankan preflight penuh: storage, model/digest, satu parse JSON nyata, satu probe/verifikasi browser nyata, worker, TTS, dan STT. `npm run start:full` selalu memaksa pemeriksaan penuh. Jika gagal, startup berhenti dan menulis `data/preflight.json`. Setelah lolos, backend berjalan di `http://localhost:3050`, Coordinator `/study`, panel `/research`.

Preflight STT memakai PCM hening untuk memeriksa pemuatan/inferensi. **Ini bukan tes akurasi ucapan.** Pemeriksaan mikrofon, ucapan Bahasa Indonesia peneliti, keyboard stop, keterpahaman TTS, payload konteks maksimum, dan alur hands-free masih wajib manual.

Jangan menjalankan `npm run preflight` bersamaan dengan backend: keduanya memerlukan port 3050 untuk fixture. Untuk preflight mandiri, jalankan Ollama khusus 11435 di terminal tersendiri, tetapi kosongkan 3050.

Untuk berhenti:

```bash
npm run stop
```

Shutdown terautentikasi menutup backend dan supervisor menutup Ollama miliknya. Jika backend belum hidup, gunakan Ctrl+C di terminal startup. Proses lain tidak dimatikan berdasarkan PID lama.

## 7. Urutan sebelum studi utama

1. `npm test` dan `npm run test:integration` harus lulus di perangkat target.
2. Jalankan development dengan model nyata: `npm run benchmark -- --development` ketika backend aktif. Command menunggu sampai semua episode selesai dan menggagalkan gate bila P/B1 tidak pernah berbeda.
3. B1 harus menyelesaikan sedikitnya dua STAGED solvable berbeda dengan probe nyata. Periksa latency, invalid output, trace, kemampuan parser koreksi, dan batas konteks 8192.
4. Selesaikan checklist manual dan perbaiki gap pada `docs/STATUS.md`. Lakukan pilot peserta terpisah sesuai prosedur kampus. Jangan mengaktifkan studi hanya karena build lulus.
5. Catat bukti pemeriksaan, tentukan manifest/prompt/config final, dan isi informasi penelitian yang benar. `HUMAN_STUDY_ENABLED=true` adalah tindakan eksplisit peneliti setelah menilai kesiapan, bukan sertifikasi otomatis.
6. Commit kode yang telah lolos pilot. Jalankan `npm run freeze -- --pilot-approved`, lalu commit `config/freeze.json`.
7. Jalankan `npm run benchmark` untuk 64 episode. Jangan mengubah kode, model, budget, atau main dataset setelah freeze.
8. User study: empat peserta utama, masing-masing empat task; pilih slot peserta 1–4. Dataset study berbeda dari main. Tidak ada kondisi yang diumumkan pada UI peserta.

## 8. Privasi

Tidak ada kamera, screenshot peserta, rekaman layar, atau file raw audio. Worker memproses PCM/WAV di memori. Transkrip/feedback dan model I/O yang mungkin memuat verbatim mengikuti retention 30 hari; event semantik/outcome berkode 90 hari. Data sintetis benchmark dapat disimpan lebih lama.

Gunakan panel untuk export/hapus sesi. Export dibuat sebagai respons download, tidak disimpan sebagai salinan tambahan oleh aplikasi. **Salinan yang sudah Anda unduh berada di luar pengelolaan aplikasi**: peneliti bertanggung jawab menghapusnya sesuai consent/withdrawal. Gunakan enkripsi disk dan akun OS penelitian. Jangan unggah data peserta ke repository.

## Troubleshooting

| Gejala | Langkah |
| --- | --- |
| Node tidak punya `node:sqlite` | Gunakan Node 24+ |
| Chromium executable tidak ditemukan | Jalankan install Playwright sebelum sesi |
| Port dipakai | Tutup aplikasi yang Anda kenali; jangan kill semua proses |
| Model tidak tersedia | Cek unduhan qwen2.5:7b, akun OS dan direktori model |
| `model_context_not_validated` | Validasi payload maksimum pada pilot; revisi shared schema/prompt sebelum freeze |
| STT tidak tersedia | Cek interpreter `.venv`, direktori model lokal, paket CTranslate2/CPU |
| Suara tidak terdengar | Cek voice id, output headphone, gesture awal audio Chrome |
| Izin mic ditolak | Pengaturan situs Chrome → mikrofon; izin hanya setelah consent |
| Panel menolak akses | Gunakan researcher token lokal, bukan session token |
| Studi terkunci | Periksa semua field etik, hasil preflight dan flag aktivasi manusia |
| Main sudah pernah dicoba | Pertahankan hasil asli; susun protokol replacement berpasangan, jangan hapus kegagalan |

## Sumber resmi

[ARIA snapshots Playwright](https://playwright.dev/docs/aria-snapshots), [API Ollama](https://docs.ollama.com/api/chat), [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [daftar bahasa eSpeak NG](https://github.com/espeak-ng/espeak-ng/blob/master/docs/languages.md).
