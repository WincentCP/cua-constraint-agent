# Status publikasi dataset CDEA

Tanggal pemeriksaan: 11 November 2026.

## Hasil persiapan lokal

- Main: 3.227 file, 21.876.519 byte.
- Scale: 31.593 file, 87.564.215 byte.
- Total sumber historis: 34.820 file.
- Snapshot SQLite: 3.840 file.
- Pemeriksaan checksum lokal: seluruh file sumber cocok dengan manifest ekstraksi.
- Pemeriksaan pola otomatis: tidak ditemukan alamat email, token AWS/GitHub, bearer token, atau private-key marker pada file teks yang dipindai.

## Mengapa data mentah belum dimasukkan ke perubahan publik ini

Snapshot SQLite mencakup data aplikasi perbankan (termasuk kolom nomor rekening dan routing), pesan, kalender, serta to-do. Contoh yang diperiksa tampak sintetis, tetapi pemeriksaan sampel dan pemindaian pola tidak membuktikan bahwa seluruh konten aman untuk publikasi atau bahwa seluruh hak distribusinya tersedia.

Karena itu perubahan ini hanya mempublikasikan tabel turunan CSV yang relevan untuk memeriksa hasil skripsi. Direktori Main dan Scale yang telah diekstrak tetap tersedia dalam paket kerja lokal, bukan di repository publik.

## Struktur dataset lokal yang telah disiapkan

```text
data/
├── main_observation/main_observation_v1/   # 3.227 file
├── scale_reference/scale_reference_v4/     # 31.593 file
└── derived/                                # CSV turunan
```

Tidak ada ZIP dataset yang ditambahkan ke repository. Untuk mempublikasikan direktori mentah, lakukan peninjauan lisensi/privasi terlebih dahulu, lalu gunakan Git lokal untuk menambahkan folder hasil ekstraksi dan jalankan pemeriksaan checksum sebelum push.
