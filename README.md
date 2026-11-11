# CDEA — Computer-Using Agent Research

Repository ini berisi implementasi **Constraint-Driven Evidence Acquisition (CDEA)** untuk Computer-Using Agent (CUA), konfigurasi eksperimen, notebook analisis, serta pengujian otomatis. Penelitian membandingkan CDEA dengan Baseline *progress-score* pada lingkungan OpenApps melalui BrowserGym.

Di dalam kode dan arsip eksperimen, metode CDEA menggunakan label internal **Proposed**. Dengan demikian, Proposed dan CDEA merujuk pada metode yang sama.

## Ringkasan penelitian

- **Metode:** Baseline progress-score dan CDEA (Proposed).
- **Kumpulan tugas:** 32 tugas, terdiri atas 9 tugas dasar, 18 tugas lintas aplikasi, dan 5 tugas informasi perbankan.
- **Main Study:** 4 model Large, 32 tugas, 128 pasangan pengujian, dan 256 episode terjadwal.
- **Small-Model Extension:** 4 model Small, 32 tugas, 128 pasangan pengujian, dan 256 episode terjadwal.
- **Lingkungan:** OpenApps dan BrowserGym.
- **Model runtime:** Ollama.

## Struktur repository

~~~text
.
├── .github/workflows/ci.yml
├── docs/
│   └── MAIN_READINESS_TEMPLATE.json
├── config/
│   ├── main_plan.json
│   ├── main_taskset_v1.json
│   ├── models.json
│   ├── models_small_extension.json
│   ├── pilot_plan.json
│   └── small_extension_plan.json
├── notebooks/
│   └── main_analysis.ipynb
├── scripts/
│   ├── analysis/
│   │   ├── audit_archives.py
│   │   └── verify_notebook.py
│   └── browsergym/
│       ├── main.py
│       ├── small_extension.py
│       ├── shared_policy.py
│       ├── run_main.ps1
│       ├── run_small_extension.ps1
│       └── skrip pendukung lainnya
├── tests/
├── requirements-analysis.txt
└── README.md
~~~

Keterangan:

| Lokasi | Fungsi |
|---|---|
| config/ | Rencana eksperimen, daftar 32 tugas, dan konfigurasi model. |
| scripts/browsergym/ | Implementasi kebijakan, runner eksperimen, pemeriksaan kesiapan, dan skrip pendukung. |
| scripts/analysis/ | Audit arsip dan pemeriksaan notebook analisis. |
| notebooks/ | Analisis hasil eksperimen, tabel, grafik, dan statistik. |
| tests/ | Pengujian fungsi dan kontrak sistem secara offline. |
| docs/ | Template readiness Main dengan status awal pending; bukan persetujuan eksperimen. |
| .github/workflows/ci.yml | Pengujian otomatis melalui GitHub Actions. |

## Konfigurasi model

Daftar model yang digunakan tersimpan pada file konfigurasi berikut.

**Main Study — Large**
- qwen3.5-9b
- ministral3-8b
- granite4.1-8b
- xlam2-8b

Konfigurasi: [config/models.json](config/models.json).

**Small-Model Extension — Small**
- qwen3.5-4b
- ministral3-3b
- granite4.1-3b
- xlam2-3b

Konfigurasi: [config/models_small_extension.json](config/models_small_extension.json).

## Data penelitian

Arsip sumber penelitian tidak disimpan di repository. File yang digunakan oleh analisis adalah:

- **main_observation.zip:** arsip Main Study dengan protokol cdea_main_v1, berisi 128 pasangan pengujian.
- **scale_reference.zip:** arsip sumber untuk analisis kelompok Small. Format yang didukung dijelaskan pada bagian berikut.

File arsip, paket dataset, dan keluaran analisis dikecualikan dari Git melalui file [.gitignore](.gitignore). Jangan mengunggah arsip eksperimen atau data aplikasi ke repository publik sebelum izin penggunaan, privasi, dan kelayakan distribusinya diperiksa.

### Format arsip Scale yang didukung

Notebook analisis menerima 2 format arsip Scale:

1. **cdea_small_extension_v1** — arsip Small-only dengan 128 pasangan dan 256 episode terjadwal. Format ini dihasilkan oleh runner Small-Model Extension.
2. **cdea_scale_v1** — arsip Scale dengan 256 pasangan dan 512 episode terjadwal, terdiri atas 128 pasangan Large dan 128 pasangan Small. Notebook hanya mengambil 128 pasangan Small dari arsip ini. Hasil Large dari arsip Scale tidak digunakan dalam analisis perbandingan; hasil Large berasal dari arsip Main Study.

Kedua format harus memiliki 32 tugas dan 4 model Small pada kelompok Small yang dipilih. Notebook memeriksa protokol, identitas pasangan, hasil episode, dan kesesuaian roster tugas sebelum analisis.

### Menyiapkan data untuk notebook

Letakkan main_observation.zip dan scale_reference.zip di direktori kerja notebook. Nama file dapat berbeda apabila variabel MAIN_ZIP dan SCALE_ZIP pada sel kode pertama notebook diubah sesuai lokasi file.

Sebagai alternatif, notebook dapat menemukan paket Dataset_CDEA*.zip di direktori kerja atau /content (umum digunakan oleh Google Colab). Paket tersebut harus berisi DATASET_CDEA.json dan arsip sumber dengan nama serta nilai SHA-256 yang tercantum di dalam manifest. Notebook memeriksa SHA-256 sebelum mengekstrak arsip sumber.

## Menjalankan audit arsip

Gunakan Python 3.11 atau lebih baru. Pasang dependensi analisis:

~~~bash
python -m pip install -r requirements-analysis.txt
~~~

Jalankan audit terhadap kedua arsip:

~~~bash
python scripts/analysis/audit_archives.py --main main_observation.zip --small scale_reference.zip --output archive_audit.json
~~~

Audit memeriksa integritas ZIP, manifest, protokol, jumlah pasangan dan episode, identitas pasangan, kesesuaian hasil pasangan dengan hasil episode, serta kesamaan roster 32 tugas dan 4 model pada kelompok yang dipilih.

**Batas audit:** pemeriksaan ini menilai konsistensi internal arsip. Audit tidak membuktikan secara independen bahwa seluruh episode benar-benar dijalankan pada host, konfigurasi, atau runtime yang dinyatakan dalam manifest.

## Menjalankan analisis

1. Siapkan kedua arsip sumber sesuai format yang didukung.
2. Pasang dependensi dari requirements-analysis.txt.
3. Buka [notebooks/main_analysis.ipynb](notebooks/main_analysis.ipynb) menggunakan Jupyter atau Google Colab.
4. Pastikan variabel MAIN_ZIP dan SCALE_ZIP menunjuk ke arsip yang benar.
5. Jalankan seluruh sel notebook secara berurutan.

Notebook menghasilkan folder CDEA_Analysis_Results/ dan file CDEA_Analysis_Results.zip. Keluaran mencakup 9 grafik utama, 6 tabel utama, analisis rinci, dan ringkasan statistik. File hasil tersebut tidak dilacak di Git.

## Pemeriksaan dan pengujian offline

Pemeriksaan notebook menggunakan arsip fixture sintetis, bukan data hasil eksperimen penelitian:

~~~bash
python scripts/analysis/verify_notebook.py
~~~

Skrip tersebut menjalankan notebook dengan 2 format arsip Scale yang didukung, yaitu cdea_scale_v1 dan cdea_small_extension_v1. Pengujian ini memeriksa kompatibilitas alur analisis dan format keluaran, bukan mengesahkan hasil eksperimen asli.

Jalankan seluruh pengujian offline:

~~~bash
python -m unittest discover -s tests -v
~~~

Pemeriksaan rencana eksperimen tanpa menjalankan browser atau inferensi model:

~~~bash
python scripts/browsergym/main.py --dry-run
python scripts/browsergym/small_extension.py --dry-run
~~~

Perintah --dry-run hanya memeriksa rencana dan konfigurasi. Perintah tersebut tidak menjalankan episode BrowserGym, tidak memulai server OpenApps, dan tidak melakukan inferensi Ollama.

GitHub Actions menjalankan pemeriksaan kode dan pengujian otomatis pada Ubuntu dan Windows. Job analisis juga menjalankan notebook menggunakan data fixture sintetis.

## Menjalankan eksperimen baru

Pelaksanaan eksperimen penuh berbeda dari pemeriksaan --dry-run. Eksekusi memerlukan checkout OpenApps pada commit yang dipatok dalam konfigurasi, BrowserGym, Ollama, serta checkpoint model yang sesuai.

Main Study memiliki pemeriksaan kesiapan (*readiness gate*). Runner menggunakan [template readiness Main](docs/MAIN_READINESS_TEMPLATE.json). File readiness yang dibuat melalui opsi -InitReadiness berstatus pending dan **bukan** persetujuan untuk menjalankan eksperimen. Eksekusi Main memerlukan file readiness yang telah disetujui dan lolos pemeriksaan.

Small-Model Extension menggunakan identitas pengujian (ExtensionId) tersendiri. Runner akan memeriksa commit OpenApps dan konfigurasi sebelum menjalankan pasangan pengujian.

Skrip PowerShell tersedia di:

- [scripts/browsergym/run_main.ps1](scripts/browsergym/run_main.ps1)
- [scripts/browsergym/run_small_extension.ps1](scripts/browsergym/run_small_extension.ps1)

Jangan menjalankan eksperimen baru jika tujuannya hanya memeriksa atau mengolah arsip penelitian yang sudah tersedia.

## Batas interpretasi hasil

- Penelitian membandingkan CDEA dengan Baseline progress-score; kondisi Vanilla tidak diuji.
- Perbedaan tindakan pencarian menunjukkan perbedaan pemilihan kandidat, bukan bukti langsung bahwa informasi yang ditemukan benar atau menyebabkan keberhasilan tugas.
- Keterlihatan kutipan pada AXTree tidak sama dengan verifikasi kebenaran seluruh informasi atau pemenuhan seluruh constraint.
- Perbandingan Large dan Small bersifat eksploratori karena sumber menggunakan versi Agent Controller berbeda dan provenance arsip Small belum diverifikasi secara independen.
- Hasil analisis hanya berlaku untuk arsip, tugas, model, dan konfigurasi yang benar-benar tersedia dan diperiksa.

## Lisensi dan penggunaan

Periksa file lisensi dan ketentuan penggunaan dari setiap dependensi serta lingkungan eksternal yang digunakan. Repository ini tidak menyertakan arsip data eksperimen atau salinan lingkungan OpenApps.
