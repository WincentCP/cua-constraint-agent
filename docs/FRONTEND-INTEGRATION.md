# Integrasi desain LEUCO

## Audit sebelum implementasi

Referensi: https://github.com/WincentCP/designskripsi pada commit `0253898e3eec30f8a63838511cccc8b5b69961ec`.

Desain aktif berada di `src/pages`, bukan layout absolut hasil impor di `src/imports/ProductPage`. React 19, React Router, Vite 8 dan Tailwind 4 menjadi alat prototipe. Tidak ditemukan berkas brand-kit terpisah; token diambil dari komponen aktif: hitam `#040404`, lime `#e5f33c`, putih, Big Shoulders Display untuk judul dan wordmark, Outfit untuk isi, tombol persegi, gambar studio besar, hero dua kolom, strip merek miring, detail dua kolom dan panel informasi berbingkai bawah. Mode: preserve. Design variance 6, motion 2, density 4; gerakan dibatasi pada feedback agar capture stabil. Aturan estetika generik skill tunduk pada brand pengguna, termasuk kontras header hitam dengan halaman putih.

| Halaman sumber | Fungsi                                  | Integrasi penelitian                                                                                            |
| -------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| ProductList    | Kampanye dan tiga kartu kaos            | Hero LEUCO dan tiga kandidat dari fixture; fakta awal hanya dari `task.initial`                                 |
| ProductDetail  | Foto, pilihan ukuran, harga, lima panel | Tata letak gambar/informasi dan panel dipertahankan; menggunakan varian fixture dan tautan probe yang sudah ada |
| CartPage       | Keranjang client-side, ringkasan, hapus | Keranjang server, jumlah 0/1, verifikasi harga/varian; tidak menambah aksi hapus                                |
| Navbar / Root  | Identitas dan kategori                  | Wordmark dan gaya dipertahankan; navigasi hanya menuju fungsi yang tersedia                                     |

Temuan awal: deskripsi produk membocorkan material, harga terlihat pada semua panel, tombol ukuran membocorkan stok lewat disabled state, panel memakai tombol sementara driver memerlukan tautan, dan cart React mengganti item tanpa POST. Pencarian/profil/filter/urutkan/lihat-semua belum memiliki handler nyata. Font Google dan gambar Unsplash membutuhkan internet yang diblokir browser penelitian. Prototipe juga memakai angka harga sebagai string; nilai tersebut bukan dataset penelitian.

## Keputusan integrasi

- Pertahankan server-rendered TypeScript di repo penelitian. Port komposisi visual dan aset, bukan state/cart/router React. Tidak menambah React/Vite ke runtime eksperimen.
- Dataset penelitian tetap kaos S/M/L/XL, empat constraint, 32 base task dan 64 run. Kartu memakai tiga ilustrasi desain kaos LEUCO yang tidak diturunkan dari private attributes dan tidak menyatakan fakta kandidat.
- Deskripsi Indonesia bersifat editorial dan tidak mengandung bahan, ukuran, warna, harga atau stok tersembunyi. Informasi publik tetap melalui `publicLine` dan `visibleFields`.
- Rute, urutan kandidat/probe, role group, isi fakta, POST dan verifikasi tetap. Label navigasi dipersingkat; paragraf fakta memisahkan label/nilai secara visual dan parser membaca teks publik gabungannya. Tidak menambah opsi varian yang tidak ada pada fixture.
- Tidak menampilkan status evaluator atau mematikan tombol berdasarkan private stock/evidence. Penolakan POST diberi halaman Indonesia tanpa mengubah status/effect.
- Aset disajikan lokal dari allowlist, tanpa request internet, cookie baru, analytics atau localStorage. Font/gambar/CSS berada dalam cakupan freeze.
- Preview manual memakai development task terisolasi; reset tidak tersedia dalam halaman yang dilihat agent. Preview bukan hasil eksperimen.

## Validasi dan penggunaan

Lihat bagian akhir dokumen untuk hasil validasi integrasi. Perubahan UI mengubah source identity: gate/freeze lama tidak dapat dipakai untuk pengumpulan main baru. Demo hanya bukti engineering.

## Revisi detail produk, 12 September 2026

Navigasi diringkas menjadi Ringkasan, Harga & stok, Harga, Bahan, dan Stok. Halaman menampilkan fakta publik sekali, dengan nilai harga lebih menonjol. Fakta awal tetap tersedia sesuai kontrak `initial ∪ panelFields`; panel lain tidak diprefetch atau disimpan tersembunyi dalam DOM.

Tautan tetap memiliki tujuan server yang sama. JavaScript mengambil HTML publik hanya setelah klik, mengganti bagian informasi tanpa memuat ulang gambar/halaman, dan memperbarui URL setelah respons siap. Back/Forward mengambil ulang panel yang sesuai. Kegagalan permintaan beralih ke navigasi biasa; tautan tetap bekerja tanpa JavaScript.

Selama permintaan berlangsung, isi lama disembunyikan dan tombol tambah sementara dinonaktifkan berdasarkan status jaringan publik. Driver menunggu `aria-busy` selesai sebelum merekam observasi. Ini tidak bergantung pada stok, kecocokan produk, atau informasi evaluator. Permintaan yang digantikan dibatalkan agar respons lama tidak menimpa pilihan terbaru.
