# Skrip Presentasi Sistem LEUCO

Skrip ini dirancang untuk presentasi sekitar 5–7 menit. Jalankan preview sebelum mulai presentasi agar halaman langsung siap dibuka.

```powershell
npm run preview -- --task development-03 --port 4173
```

Task demo `development-03` adalah mencari kaos biru ukuran L, berbahan linen, maksimal Rp140.000, dan tersedia. Task ini menggunakan level U4, sehingga halaman awal sengaja belum menampilkan fakta produk.

## 1. Pembukaan

**Yang diucapkan:**

> Sistem yang saya bangun adalah lingkungan e-commerce sintetis bernama LEUCO. Sistem ini digunakan untuk menguji bagaimana computer-use agent memilih informasi yang perlu diperiksa sebelum melakukan tindakan.
>
> Fokus penelitiannya bukan membuat toko online produksi, tetapi menguji strategi pemilihan informasi pada task dengan beberapa constraint.

**Yang dilakukan:**

- Buka `http://127.0.0.1:4173`.
- Tunjukkan halaman koleksi dan tiga produk kaos.
- Jangan klik produk dulu selama menjelaskan fungsi halaman awal.

## 2. Menjelaskan halaman awal

**Yang diucapkan:**

> Pada halaman awal terdapat tiga kandidat produk. Informasi seperti nama dan deskripsi desain bersifat publik. Untuk task ini, informasi varian, bahan, harga, dan stok belum ditampilkan di awal karena level task-nya U4.
>
> Artinya, agent harus melakukan eksplorasi untuk mendapatkan bukti yang belum diketahui.

**Yang dilakukan:**

- Tunjukkan tiga kartu produk.
- Tunjukkan bahwa setiap kartu memiliki tombol **Lihat detail**.
- Tunjukkan bahwa tampilannya menyerupai e-commerce biasa, tetapi tidak ada fitur checkout atau pembayaran.

## 3. Membuka detail produk

**Yang diucapkan:**

> Saya membuka Studio Edition Tee. Halaman detail memisahkan informasi editorial produk dari informasi yang digunakan untuk memeriksa constraint.

**Yang dilakukan:**

- Klik kartu atau tombol **Lihat detail** pada Studio Edition Tee.
- Tunjukkan judul, ilustrasi, deskripsi, dan bagian **Tentang produk**.
- Tunjukkan tab informasi di bawahnya.

## 4. Memeriksa informasi yang diperlukan

**Yang diucapkan:**

> Agent tidak langsung menambahkan produk. Agent terlebih dahulu membuka tab yang dapat menjawab constraint yang belum diketahui.

**Yang dilakukan:**

- Klik tab **Ringkasan**.
- Ucapkan:

  > Di sini saya mendapatkan varian dan bahan: ukuran L, warna biru, dan bahan linen.

- Klik tab **Harga & stok**.
- Ucapkan:

  > Di sini saya mendapatkan harga Rp133.000 dan status tersedia. Semua syarat task sekarang sudah memiliki bukti publik.

- Tunjukkan bahwa tab berpindah tanpa memuat ulang seluruh halaman.

## 5. Menambahkan produk ke keranjang

**Yang diucapkan:**

> Karena varian, bahan, harga, dan ketersediaan sudah sesuai, agent boleh melakukan ACT, yaitu menambahkan satu produk ke keranjang.

**Yang dilakukan:**

- Klik **Tambah satu ke keranjang**.
- Tunggu halaman keranjang terbuka.
- Tunjukkan nama produk, varian, harga satuan, jumlah satu, dan total.

**Yang diucapkan:**

> Keranjang diverifikasi kembali oleh sistem. Produk yang masuk harus sama dengan produk yang dipilih, harganya harus sesuai, dan jumlahnya harus satu.

## 6. Menjelaskan backend dengan bahasa sederhana

**Yang diucapkan:**

> Di backend, setiap task dijalankan dalam world yang terisolasi. World ini memiliki task, tiga produk, keranjang kosong, dan server lokal dengan cookie khusus.
>
> Backend menyimpan atribut sebenarnya seperti ukuran, warna, bahan, harga, dan stok. Namun atribut tersebut tidak langsung diberikan kepada agent. Backend hanya menampilkan fakta yang memang diizinkan pada halaman awal atau panel yang sedang dibuka.
>
> Saat agent membuka panel, server mengirimkan fakta publik untuk panel tersebut. Saat tombol keranjang diklik, server memeriksa produk, ketersediaan, dan kondisi keranjang. Jika valid, server mengisi keranjang. Jika tidak valid, server mengembalikan penolakan tanpa mengubah keranjang.

## 7. Menjelaskan hubungan dengan penelitian

**Yang diucapkan:**

> Setiap observasi dan tindakan dicatat dalam event log. Evaluator independen kemudian memeriksa apakah semua constraint sudah memiliki bukti sebelum ACT, bukan hanya apakah keranjangnya terlihat benar setelah tindakan.
>
> Penelitian membandingkan dua strategi. Baseline memilih probe secara umum, sedangkan Proposed memprioritaskan probe yang dapat menjawab constraint berstatus UNKNOWN. Keduanya menerima task, UI, model, budget, dan evaluator yang sama.

## 8. Penutup

**Yang diucapkan:**

> Jadi, frontend berfungsi sebagai e-commerce sintetis yang familiar, sedangkan backend menyediakan controlled environment untuk mengukur pengambilan bukti oleh agent. Hasil utama penelitian diambil dari main benchmark 64 run dan report yang sudah diekspor, bukan dari demo live ini.

## Catatan saat presentasi

- Demo ini menggunakan development task dan boleh menggunakan `--demo` agar tidak bergantung pada Ollama.
- Jangan menyebut demo deterministic sebagai hasil eksperimen Qwen.
- Jika ditanya mengapa tidak ada checkout, pembayaran, atau pilihan banyak ukuran, jelaskan bahwa fitur tersebut berada di luar scope PRD.
- Jika diminta menunjukkan hasil penelitian, buka `report.html` dari main benchmark yang sudah selesai.
- Jika halaman tampak kosong setelah diklik, tunggu sebentar atau reload preview. Demo tidak mengubah data main benchmark.
