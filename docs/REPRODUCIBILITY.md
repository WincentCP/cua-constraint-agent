# Reproduksi Analisis CDEA

## Arsip sumber

Notebook menggunakan 2 arsip:

- `main_observation.zip` — Main Large, protokol `cdea_main_v1`, dengan 128 pasangan terjadwal.
- `scale_reference.zip` — arsip Scale, protokol `cdea_scale_v1`; notebook memilih 128 pasangan Small dari 256 pasangan dalam arsip.

Arsip sumber tidak disimpan di repository. Letakkan kedua file di direktori kerja notebook atau unggah paket eksternal `Dataset_CDEA.zip`. Notebook memeriksa protokol, jumlah pasangan, konsistensi hasil, dan status pasangan valid sebelum analisis. Arsip sumber dibaca tanpa diubah.

## Menjalankan analisis

Pasang dependensi dan audit arsip:

```powershell
python -m pip install -r requirements-analysis.txt
python scripts/analysis/audit_archives.py --main main_observation.zip --small scale_reference.zip --output archive_audit.json
```

Buka [`notebooks/main_analysis.ipynb`](../notebooks/main_analysis.ipynb) di Jupyter atau Google Colab. Unggah `Dataset_CDEA.zip` atau kedua arsip sumber, kemudian pilih **Run All**.

## Keluaran

Notebook membuat folder `CDEA_Analysis_Results/` dan file `CDEA_Analysis_Results.zip`, dengan isi:

- 9 grafik PNG.
- 6 tabel utama CSV.
- Hingga 26 tabel analisis rinci CSV.
- Ringkasan statistik dan README keluaran.

File `17_probe_examples.csv` hanya dibuat jika trace menyediakan contoh probe. Karena itu, fixture CI tanpa trace menghasilkan 25 tabel rinci. Folder dan file hasil analisis sudah dimasukkan ke `.gitignore`, sehingga tidak ikut terunggah ke repository.

## Pengujian kode

```powershell
python scripts/analysis/verify_notebook.py
python -m unittest discover -s tests -v
```

`verify_notebook.py` menjalankan notebook menggunakan data fixture sintetis. Pengujian ini memeriksa struktur, alur analisis, serta format keluaran; hasil fixture bukan pengganti perhitungan dari arsip penelitian asli.

## Batas interpretasi

Main Large dan Scale Small menggunakan revisi Agent Controller yang berbeda. Karena itu, perbandingan ukuran model bersifat eksploratori. Uji tanda menggunakan tugas sebagai unit inferensi, sedangkan McNemar berbasis pasangan merupakan analisis tambahan. Penelitian tidak menguji kondisi Vanilla tanpa Override, sehingga hasilnya tidak dapat digunakan untuk menyimpulkan keunggulan CDEA terhadap kondisi tersebut.
