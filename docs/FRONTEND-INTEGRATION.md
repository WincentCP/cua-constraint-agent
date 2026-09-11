# Integrasi desain SNKRS

## Audit sebelum implementasi

Referensi: https://github.com/WincentCP/designskripsi pada commit `0253898e3eec30f8a63838511cccc8b5b69961ec`.

Desain aktif berada di `src/pages`, bukan layout absolut hasil impor di `src/imports/ProductPage`. React 19, React Router, Vite 8 dan Tailwind 4 menjadi alat prototipe. Tidak ditemukan berkas brand-kit terpisah; token diambil dari komponen aktif: hitam `#040404`, lime `#e5f33c`, putih, Big Shoulders Display untuk judul dan wordmark, Outfit untuk isi, tombol persegi, gambar studio besar, hero dua kolom, strip merek miring, detail dua kolom dan panel informasi berbingkai bawah. Mode: preserve. Design variance 6, motion 2, density 4; gerakan dibatasi pada feedback agar capture stabil. Aturan estetika generik skill tunduk pada brand pengguna, termasuk kontras header hitam dengan halaman putih.

| Halaman sumber | Fungsi                                  | Integrasi penelitian                                                                                            |
| -------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| ProductList    | Kampanye dan tiga kartu sneaker         | Hero SNKRS dan tiga kandidat dari fixture; fakta awal hanya dari `task.initial`                                 |
| ProductDetail  | Foto, pilihan ukuran, harga, lima panel | Tata letak gambar/informasi dan panel dipertahankan; menggunakan varian fixture dan tautan probe yang sudah ada |
| CartPage       | Keranjang client-side, ringkasan, hapus | Keranjang server, jumlah 0/1, verifikasi harga/varian; tidak menambah aksi hapus                                |
| Navbar / Root  | Identitas dan kategori                  | Wordmark dan gaya dipertahankan; navigasi hanya menuju fungsi yang tersedia                                     |

Temuan: deskripsi sneaker membocorkan material, harga terlihat pada semua panel, tombol ukuran membocorkan stok lewat disabled state, panel memakai tombol sementara driver memerlukan tautan, dan cart React mengganti item tanpa POST. Pencarian/profil/filter/urutkan/lihat-semua belum memiliki handler nyata. Font Google dan gambar Unsplash membutuhkan internet yang diblokir browser penelitian. Prototipe juga memakai angka harga sneaker sebagai string; nilai tersebut bukan dataset penelitian.

## Keputusan integrasi

- Pertahankan server-rendered TypeScript di repo penelitian. Port komposisi visual dan aset, bukan state/cart/router React atau dataset sneaker. Tidak menambah React/Vite ke runtime eksperimen.
- Dataset penelitian tetap kaos S/M/L/XL, empat constraint, 32 base task dan 64 run. Sneaker menjadi visual kampanye saja, tanpa harga yang bisa dianggap fakta kandidat. Kartu memakai ilustrasi kaos koleksi generik berlabel, sama untuk semua kandidat dan tidak diturunkan dari private attributes. Mengganti domain penelitian ke sneaker membutuhkan perubahan metodologi terpisah.
- Deskripsi Indonesia bersifat editorial dan tidak mengandung bahan, ukuran, warna, harga atau stok tersembunyi. Informasi publik tetap melalui `publicLine` dan `visibleFields`.
- Rute, urutan kandidat/probe, role group, nama kontrol, paragraph fakta, POST dan verifikasi tetap. Tidak menambah opsi varian yang tidak ada pada fixture.
- Tidak menampilkan status evaluator atau mematikan tombol berdasarkan private stock/evidence. Penolakan POST diberi halaman Indonesia tanpa mengubah status/effect.
- Aset disajikan lokal dari allowlist, tanpa request internet, cookie baru, analytics atau localStorage. Font/gambar/CSS berada dalam cakupan freeze.
- Preview manual memakai development task terisolasi; reset tidak tersedia dalam halaman yang dilihat agent. Preview bukan hasil eksperimen.

## Validasi dan penggunaan

Lihat bagian akhir dokumen untuk hasil validasi integrasi. Perubahan UI mengubah source identity: gate/freeze lama tidak dapat dipakai untuk pengumpulan main baru. Demo hanya bukti engineering.
