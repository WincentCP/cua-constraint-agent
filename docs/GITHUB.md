# Membuat repo privat dan push

Nama yang disarankan: `cua-constraint-agent`. Pemilik akun yang teridentifikasi pada koneksi GitHub: `WincentCP`. Jangan unggah `.env`, `data/`, `models/`, `.runtime/`, `.venv/`, atau export peserta; semuanya masuk `.gitignore`.

## Dengan GitHub CLI di komputer Anda

Pasang GitHub CLI bila belum ada, lalu masuk melalui browser milik Anda:

```bash
gh auth login
```

Jika menggunakan arsip source yang tidak menyertakan riwayat `.git`, buka terminal di root project:

```bash
git init -b main
git add .
git commit -m "Build local constraint-directed CUA research MVP"
gh repo create cua-constraint-agent --private --source=. --remote=origin --push
```

Jika git meminta identitas, atur nama dan email commit yang ingin Anda gunakan. Jangan memakai data pribadi yang tidak ingin dicantumkan pada riwayat commit. GitHub mendukung email noreply akun Anda.

Jika repository sudah dibuat, jangan menjalankan create lagi. Periksa `git remote -v`, lalu sambungkan **URL repo Anda yang benar** dan lakukan `git push -u origin main`.

## Tanpa GitHub CLI

1. Di GitHub, pilih **New repository** pada akun `WincentCP`.
2. Nama `cua-constraint-agent`; visibility **Private**.
3. Jika akan melakukan push git lokal, biarkan repo kosong. Jika meminta assistant melanjutkan lewat Contents API, inisialisasi dengan README agar branch/commit awal tersedia.
4. Buat repo dan salin URL-nya. Anda dapat mengirim **URL repo saja** untuk melanjutkan unggah; jangan kirim password, personal access token, atau `.env`.
5. Bila konektor GitHub belum dapat melihat repo baru, berikan akses melalui pengaturan integrasi GitHub Anda. Hak akses repo baru tidak selalu otomatis sama dengan repo lama.

Push baru dianggap selesai setelah commit/branch pada remote diperiksa. Adanya git commit lokal atau arsip ZIP tidak berarti repository GitHub sudah dibuat.
