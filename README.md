# CDEA — Computer-Using Agent Research

Repository ini memuat implementasi **Constraint-Driven Evidence Acquisition (CDEA)** untuk Computer-Using Agent (CUA) berbasis Large Language Model (LLM), konfigurasi eksperimen, notebook analisis, pengujian otomatis, dan tabel hasil penelitian.

Dalam kode dan arsip eksperimen, CDEA menggunakan label internal **\`Proposed\`**. Istilah \`Proposed\` dan CDEA merujuk pada metode yang sama.

## Ringkasan penelitian

Penelitian membandingkan CDEA dengan Baseline \`progress-score\` pada lingkungan OpenApps menggunakan BrowserGym.

| Kelompok | Pasangan | Baseline | CDEA | Selisih |
|---|---:|---:|---:|---:|
| Main Study — Large | 128 | 73/128 (57,03%) | 97/128 (75,78%) | +18,75 pp |
| Small-Model Extension — Small | 128 | 43/128 (33,59%) | 54/128 (42,19%) | +8,59 pp |

Pada tingkat tugas, Main Study menunjukkan 11 tugas membaik, tidak ada yang memburuk, dan 21 tidak berubah (uji tanda dua sisi, p = 0,00098; interval task-cluster bootstrap 95%: 9,38–29,69 pp). Pada Small-Model Extension, 10 tugas membaik, 5 memburuk, dan 17 tidak berubah (p = 0,30176; interval 95%: 0,00–17,97 pp).

Angka tersebut berasal dari arsip terpilih yang dijelaskan dalam [results/README.md](results/README.md). Hasil Main dan Small dilaporkan terpisah; keduanya tidak diperlakukan sebagai satu eksperimen dengan konfigurasi identik.

## Cakupan data yang dianalisis

Kumpulan tugas berisi 32 tugas:
- 9 tugas dasar (\`primitive_control\`);
- 18 tugas lintas aplikasi (\`cross_app_workflow\`); dan
- 5 tugas informasi perbankan (\`bank_information\`).

Analisis menggunakan:
- **Main Large:** 128 pasangan valid atau 256 episode dari \`main_observation.zip\`.
- **Scale Small:** 128 pasangan Small terpilih atau 256 episode dari \`scale_reference.zip\`. Arsip Scale juga memuat 128 pasangan Large, tetapi pasangan tersebut tidak digunakan dalam dataset perbandingan skripsi.

Dengan demikian, dataset terpilih memuat **256 pasangan dan 512 episode**. Jumlah tersebut bukan keseluruhan riwayat pelaksanaan eksperimen, retry, Proof of Concept (PoC), Pilot, atau run lainnya.

## Struktur repository

\`\`\`text
.
├── .github/workflows/       # Pengujian otomatis
├── config/                  # Rencana eksperimen, task set, dan konfigurasi model
├── docs/                    # Template readiness Main
├── notebooks/               # Notebook analisis hasil
├── results/                 # Tabel hasil olahan dan provenance
├── scripts/
│   ├── analysis/            # Audit arsip dan pemeriksaan notebook
│   └── browsergym/          # Runner, kebijakan, dan skrip pendukung
├── tests/                   # Pengujian offline
├── requirements-analysis.txt
└── README.md
\`\`\`

| Lokasi | Isi |
|---|---|
| \`config/\` | Rencana Main dan Small, daftar 32 tugas, serta konfigurasi model. |
| \`scripts/browsergym/\` | Implementasi Baseline dan CDEA, runner, pemeriksaan kesiapan, dan utilitas eksperimen. |
| \`scripts/analysis/\` | Audit konsistensi arsip dan verifikasi notebook. |
| \`notebooks/\` | Analisis statistik, tabel, dan grafik. |
| \`results/\` | Tabel hasil turunan yang dicocokkan dengan catatan arsip serta metadata provenance. |
| \`tests/\` | Pengujian kontrak sistem tanpa menjalankan browser atau inferensi model. |
| \`docs/\` | Template readiness; bukan persetujuan untuk menjalankan eksperimen. |

## Konfigurasi model

**Main Study — Large** (\`config/models.json\`):
- \`qwen3.5-9b\`
- \`ministral3-8b\`
- \`granite4.1-8b\`
- \`xlam2-8b\`

**Small-Model Extension — Small** (\`config/models_small_extension.json\`):
- \`qwen3.5-4b\`
- \`ministral3-3b\`
- \`granite4.1-3b\`
- \`xlam2-3b\`

Nama model runtime dan label analisis dapat dilihat pada kedua file konfigurasi tersebut.

## Versi eksperimen dan provenance

Commit repository, commit Agent Controller, dan commit OpenApps merupakan identitas yang berbeda. Arsip mencatat versi pengendali dan OpenApps berikut:

| Kelompok | Protokol / arsip | Agent Controller | OpenApps |
|---|---|---|---|
| Main Large | \`cdea_main_v1\` / \`main_observation_v1\` | \`ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1\` | \`6e6782794433c60468d65ac75bc3f03c56007f8c\` |
| Scale Small terpilih | \`cdea_scale_v1\` / \`scale_reference_v4\` | \`ff655d1389bc84aa8100b6321220f5ec01c4e3b4\` | \`6e6782794433c60468d65ac75bc3f03c56007f8c\` |

Kedua kelompok menggunakan seed 233, batas 40 langkah, timeout model 240 detik, temperature 0, \`num_predict\` 640, dan \`think=false\`.

**Catatan konteks model:** \`config/main_plan.json\` mencantumkan \`num_ctx=8192\`, tetapi nilai tersebut tidak tercantum dalam manifest arsip Main. Karena itu, konfigurasi tersebut tidak dapat dianggap sebagai verifikasi independen atas nilai context window yang benar-benar digunakan saat run Main. Manifest Scale secara eksplisit mencatat \`num_ctx=8192\`.

Digest checkpoint model disalin dari manifest sumber. Digest tersebut tidak membuktikan secara independen checkpoint yang benar-benar dimuat oleh host Ollama ketika eksperimen dijalankan. Rincian dan checksum arsip tersedia di [results/provenance.json](results/provenance.json).

## Data penelitian

Arsip sumber dan snapshot aplikasi tidak disimpan di repository. Paket dataset yang diberikan memuat:
- \`main_observation.zip\`: arsip Main Study dengan 128 pasangan Large.
- \`scale_reference.zip\`: arsip Scale dengan 256 pasangan, yaitu 128 Large dan 128 Small.

Tabel hasil olahan yang dipublikasikan di repository meliputi:
- keberhasilan per model;
- keberhasilan per tugas;
- perbandingan jumlah model berhasil berdasarkan ukuran model;
- tugas dengan peningkatan CDEA yang lebih besar pada Small; dan
- contoh tugas ketika Small memiliki lebih banyak model yang berhasil daripada Large.

Daftar file, arti kolom, cakupan data, dan batas interpretasinya dijelaskan dalam [results/README.md](results/README.md). File arsip dan keluaran notebook lokal dikecualikan dari Git melalui [.gitignore](.gitignore).

### Format arsip Scale yang didukung notebook

Notebook menerima 2 format arsip Scale:

1. **\`cdea_small_extension_v1\`** — arsip Small-only dengan 128 pasangan dan 256 episode.
2. **\`cdea_scale_v1\`** — arsip Scale dengan 256 pasangan dan 512 episode, terdiri atas 128 pasangan Large dan 128 pasangan Small. Notebook memilih hanya 128 pasangan Small; hasil Large dari arsip ini tidak digunakan dalam perbandingan skripsi.

Kedua format harus memiliki 32 tugas dan 4 model Small pada kelompok yang dipilih. Notebook memeriksa protokol, identitas pasangan, hasil episode, dan kesesuaian roster tugas sebelum analisis.

### Menyiapkan data untuk notebook

Letakkan \`main_observation.zip\` dan \`scale_reference.zip\` di direktori kerja notebook. Nama file dapat diubah melalui variabel \`MAIN_ZIP\` dan \`SCALE_ZIP\` pada sel konfigurasi notebook.

Notebook juga dapat menemukan paket \`Dataset_CDEA*.zip\` di direktori kerja atau \`/content\` (misalnya Google Colab). Paket dapat berisi:
1. \`DATASET_CDEA.json\` yang mencantumkan nama dan SHA-256 arsip sumber; atau
2. folder \`Dataset_CDEA/\` yang berisi \`main_observation.zip\` dan \`scale_reference.zip\`.

Notebook mengekstrak hanya 2 arsip sumber yang diperlukan. Jika file dengan nama yang sama sudah tersedia, SHA-256 harus cocok dengan isi paket. Protokol setiap arsip juga diperiksa sebelum analisis dijalankan.

## Audit arsip

Gunakan Python 3.11 atau lebih baru. Pasang dependensi:

\`\`\`bash
python -m pip install -r requirements-analysis.txt
\`\`\`

Setelah mengekstrak kedua arsip sumber dari paket dataset, jalankan:

\`\`\`bash
python scripts/analysis/audit_archives.py --main main_observation.zip --small scale_reference.zip --output archive_audit.json
\`\`\`

Audit memeriksa integritas ZIP, manifest, protokol, jumlah pasangan dan episode, identitas pasangan, kesesuaian hasil pasangan dengan hasil episode, serta kesamaan roster 32 tugas dan 4 model pada kelompok yang dipilih.

**Batas audit:** pemeriksaan tersebut menilai konsistensi internal arsip dan tabel turunan. Audit tidak membuktikan secara independen host pelaksanaan, runtime, model yang dimuat, atau kebenaran seluruh informasi yang ditampilkan aplikasi.

## Menjalankan analisis

1. Siapkan arsip sumber sesuai format yang didukung.
2. Pasang dependensi dari \`requirements-analysis.txt\`.
3. Buka [notebooks/main_analysis.ipynb](notebooks/main_analysis.ipynb) menggunakan Jupyter atau Google Colab.
4. Pastikan \`MAIN_ZIP\` dan \`SCALE_ZIP\` menunjuk ke arsip yang benar.
5. Jalankan seluruh sel notebook secara berurutan.

Notebook menghasilkan folder \`CDEA_Analysis_Results/\` dan file \`CDEA_Analysis_Results.zip\`. Keluaran mencakup 9 grafik utama, 6 tabel utama, analisis rinci, dan ringkasan statistik. Keluaran notebook tersebut dibuat secara lokal dan tidak dilacak di Git; tabel ringkasan terpilih tersedia di folder \`results/\`.

## Pemeriksaan offline

Verifikasi notebook dengan fixture sintetis:

\`\`\`bash
python scripts/analysis/verify_notebook.py
\`\`\`

Jalankan seluruh pengujian offline:

\`\`\`bash
python -m unittest discover -s tests -v
\`\`\`

Periksa rencana tanpa menjalankan browser atau inferensi model:

\`\`\`bash
python scripts/browsergym/main.py --dry-run
python scripts/browsergym/small_extension.py --dry-run
\`\`\`

Fixture sintetis hanya digunakan untuk menguji alur notebook dan kontrak perangkat lunak. Fixture tersebut **bukan** data hasil penelitian. Perintah \`--dry-run\` hanya memeriksa rencana dan konfigurasi; perintah tersebut tidak menjalankan episode BrowserGym, server OpenApps, atau inferensi Ollama.

GitHub Actions menjalankan pemeriksaan kode dan pengujian otomatis pada Ubuntu dan Windows. Job analisis juga memverifikasi notebook menggunakan fixture sintetis.

## Menjalankan eksperimen baru

Pelaksanaan eksperimen penuh berbeda dari pemeriksaan offline. Eksekusi memerlukan checkout OpenApps pada commit yang dipatok dalam konfigurasi, BrowserGym, Ollama, serta checkpoint model yang sesuai.

Main Study memiliki pemeriksaan kesiapan (*readiness gate*) dan menggunakan [template readiness Main](docs/MAIN_READINESS_TEMPLATE.json). File readiness yang dibuat melalui opsi \`-InitReadiness\` berstatus \`pending\` dan **bukan** persetujuan menjalankan eksperimen. Main hanya dapat dijalankan setelah persyaratan readiness dipenuhi dan disetujui.

Small-Model Extension menggunakan identitas pengujian (\`ExtensionId\`) tersendiri. Runner memeriksa commit OpenApps dan konfigurasi sebelum menjalankan pasangan.

Skrip PowerShell:
- [run_main.ps1](scripts/browsergym/run_main.ps1)
- [run_small_extension.ps1](scripts/browsergym/run_small_extension.ps1)

Jangan menjalankan eksperimen baru jika tujuannya hanya memeriksa atau mengolah arsip penelitian yang sudah tersedia.

## Batas interpretasi hasil

- Penelitian membandingkan CDEA dengan Baseline \`progress-score\`; kondisi Vanilla tidak diuji.
- Perbedaan tindakan pencarian menunjukkan perbedaan pemilihan kandidat, bukan bukti langsung bahwa informasi yang ditemukan benar atau menyebabkan keberhasilan tugas.
- Keterlihatan kutipan pada AXTree tidak sama dengan verifikasi kebenaran seluruh informasi atau pemenuhan seluruh constraint.
- Perbandingan Large dan Small bersifat eksploratori karena kedua kelompok menggunakan versi Agent Controller berbeda dan provenance arsip Scale belum diverifikasi secara independen.
- Pengujian menggunakan satu seed dan satu konfigurasi tampilan aplikasi.
- Hasil hanya berlaku untuk arsip, tugas, model, dan konfigurasi yang benar-benar tersedia dan diperiksa.

## Lisensi dan penggunaan

Repository ini tidak menyertakan arsip data eksperimen atau salinan lingkungan OpenApps. Periksa lisensi dan ketentuan penggunaan setiap dependensi serta lingkungan eksternal sebelum penggunaan atau distribusi lebih lanjut.
