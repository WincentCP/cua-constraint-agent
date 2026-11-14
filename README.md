# CDEA — Computer-Using Agent Research

Repository ini memuat implementasi **Constraint-Driven Evidence Acquisition (CDEA)** untuk Computer-Using Agent (CUA) berbasis Large Language Model (LLM), konfigurasi eksperimen, notebook analisis, pengujian otomatis, dan tabel hasil penelitian.

Dalam kode dan arsip eksperimen, CDEA menggunakan label internal **`Proposed`**. Istilah `Proposed` dan CDEA merujuk pada metode yang sama.

## Ringkasan penelitian

Penelitian membandingkan CDEA dengan Baseline `progress-score` pada lingkungan OpenApps menggunakan BrowserGym.

| Kelompok | Pasangan | Baseline | CDEA | Selisih |
|---|---:|---:|---:|---:|
| Main Study | 128 | 73/128 (57,03%) | 97/128 (75,78%) | +18,75 pp |
| Small-Model Study | 128 | 43/128 (33,59%) | 54/128 (42,19%) | +8,59 pp |

Pada tingkat tugas, Main Study menunjukkan 11 tugas membaik, tidak ada yang memburuk, dan 21 tidak berubah (uji tanda dua sisi, p = 0,00098; interval task-cluster bootstrap 95%: 9,38–29,69 pp). Pada Small-Model Study, 10 tugas membaik, 5 memburuk, dan 17 tidak berubah (p = 0,30176; interval 95%: 0,00–17,97 pp).

Angka tersebut berasal dari arsip terpilih yang dijelaskan dalam [results/README.md](results/README.md). Hasil Main dan Small dilaporkan terpisah; keduanya tidak diperlakukan sebagai satu eksperimen dengan konfigurasi identik.

## Cakupan data yang dianalisis

Kumpulan tugas berisi 32 tugas:
- 9 tugas dasar (`primitive_control`);
- 18 tugas lintas aplikasi (`cross_app_workflow`); dan
- 5 tugas informasi perbankan (`bank_information`).

Analisis menggunakan:
- **Main Study:** 128 pasangan valid atau 256 episode dari `main_observation.zip`.
- **Small-Model Study:** 128 pasangan atau 256 episode dari `scale_reference_small_v1.zip`, yang hanya memuat 4 model Small (3B–4B). Arsip sumber lengkap `scale_reference.zip` tetap dipertahankan untuk audit; 128 pasangan Large dari arsip tersebut tidak masuk ke Small-Model Study.

Dengan demikian, dataset terpilih memuat **256 pasangan dan 512 episode**. Jumlah tersebut bukan keseluruhan riwayat pelaksanaan eksperimen, retry, Proof of Concept (PoC), Pilot, atau run lainnya.

## Struktur repository

Repository Git memisahkan source code, konfigurasi, analisis, hasil turunan, dan pengujian. Arsip eksperimen mentah serta keluaran runtime berukuran besar disimpan secara lokal atau dalam paket data terpisah, bukan di-commit ke Git.

```text
.
├── .github/workflows/       # CI: compile, offline tests, dan validasi kontrak
├── config/                  # Rencana Main/Pilot/Small, task set, konfigurasi model
├── docs/                    # Readiness template dan panduan struktur/penelusuran
├── notebooks/               # Notebook analisis penelitian
├── results/                 # Tabel hasil turunan yang dilacak + provenance
├── scripts/
│   ├── analysis/            # Audit arsip, build tabel turunan, verifikasi notebook
│   └── browsergym/          # Development runner, Pilot, Main, Small, dan utilitas
├── tests/                   # Pengujian offline berbasis kontrak/fixture
├── requirements-analysis.txt
├── .gitignore
└── README.md
```

| Lokasi | Isi dan fungsi |
|---|---|
| `config/` | Rencana eksperimen, task set 32 tugas, dan konfigurasi model Main/Small. |
| `scripts/browsergym/` | Runner untuk Development, Pilot, Main Study, dan Small-Model Study; termasuk kebijakan serta pemeriksaan kesiapan. |
| `scripts/analysis/` | Audit arsip, pembuatan tabel hasil turunan, dan verifikasi notebook menggunakan fixture. |
| `notebooks/main_analysis.ipynb` | Analisis statistik, pembuatan grafik, tabel, dan analisis rinci dari arsip Main dan Small. |
| `results/` | Hasil turunan terpilih yang dilacak Git beserta provenance; bukan arsip episode mentah. |
| `docs/` | Template readiness dan panduan untuk menelusuri source code, data, serta keluaran lokal. |
| `tests/` | Pengujian offline; fixture sintetis bukan data hasil penelitian. |
| `.github/workflows/` | Otomatisasi pemeriksaan pada GitHub Actions; tidak menjalankan episode penelitian. |

### Keluaran lokal yang tidak disimpan di Git

Folder berikut dibuat saat runner atau notebook dijalankan. Folder tersebut sengaja dikecualikan oleh `.gitignore`, sehingga tidak muncul pada tampilan repository GitHub yang baru di-clone.

```text
output/
├── browsergym/matched_dev/<run_id>/  # artefak Development
├── pilot/<pilot_id>/                 # artefak Pilot
├── main/<main_id>/                   # artefak Main Study
├── small_extension/<scale_id>/       # artefak Small-Model Study
└── preflight/main_models/            # bukti pemeriksaan model sebelum Main

CDEA_Analysis_Results/                # grafik, tabel, dan analisis dari notebook
CDEA_Analysis_Results.zip             # paket hasil notebook
```

Arsip input seperti `main_observation.zip`, `scale_reference_small_v1.zip`, dan `Dataset_CDEA_small_only.zip` juga disimpan terpisah dari source code. Karena itu, tidak adanya folder `output/` atau arsip dataset di GitHub bukan berarti runner tidak memiliki mekanisme untuk membuat atau membaca artefak tersebut.

**Penting:** `results/` adalah tabel hasil turunan yang memang dilacak Git; `output/` berisi rekaman run yang dibuat runner; sedangkan `CDEA_Analysis_Results/` berisi keluaran notebook. Ketiganya memiliki fungsi berbeda dan tidak boleh dianggap sebagai satu jenis output.

Lihat [docs/REPOSITORY_MAP.md](docs/REPOSITORY_MAP.md) untuk struktur artefak setiap runner, alur dari eksperimen hingga analisis, dan batas interpretasi bukti yang tersedia.

## Konfigurasi model

**Main Study** (`config/models.json`):
- `qwen3.5-9b`
- `ministral3-8b`
- `granite4.1-8b`
- `xlam2-8b`

**Small-Model Study** (`config/models_small_extension.json`):
- `qwen3.5-4b`
- `ministral3-3b`
- `granite4.1-3b`
- `xlam2-3b`

Nama model runtime dan label analisis dapat dilihat pada kedua file konfigurasi tersebut.

## Versi eksperimen dan provenance

Commit repository, commit Agent Controller, dan commit OpenApps merupakan identitas yang berbeda. Arsip mencatat versi pengendali dan OpenApps berikut:

| Kelompok | Protokol / arsip | Agent Controller | OpenApps |
|---|---|---|---|
| Main Study | `cdea_main_v1` / `main_observation_v1` | `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1` | `6e6782794433c60468d65ac75bc3f03c56007f8c` |
| Small-Model Study | `cdea_small_extension_v1` / `scale_reference_small_v1` (subset dari `scale_reference_v4`) | `ff655d1389bc84aa8100b6321220f5ec01c4e3b4` | `6e6782794433c60468d65ac75bc3f03c56007f8c` |

Kedua kelompok menggunakan seed 233, batas 40 langkah, timeout model 240 detik, temperature 0, `num_predict` 640, dan `think=false`.

**Catatan konteks model:** `config/main_plan.json` mencantumkan `num_ctx=8192`, tetapi nilai tersebut tidak tercantum dalam manifest arsip Main. Karena itu, konfigurasi tersebut tidak dapat dianggap sebagai verifikasi independen atas nilai context window yang benar-benar digunakan saat run Main. Manifest Scale secara eksplisit mencatat `num_ctx=8192`.

Digest checkpoint model disalin dari manifest sumber. Digest tersebut tidak membuktikan secara independen checkpoint yang benar-benar dimuat oleh host Ollama ketika eksperimen dijalankan. Rincian dan checksum arsip tersedia di [results/provenance.json](results/provenance.json).

## Data penelitian

Arsip sumber dan snapshot aplikasi tidak disimpan di repository. Paket dataset yang diberikan memuat:
- `main_observation.zip`: arsip Main Study dengan 128 pasangan Large.
- `scale_reference_small_v1.zip`: arsip analisis Small-only dengan 128 pasangan Small dan 256 episode.
- Arsip sumber lengkap `scale_reference.zip` (256 pasangan / 512 episode) disimpan di dalam paket pada `source_archives/scale_reference_v4_full_source.zip` untuk audit; arsip ini tidak digunakan sebagai input Scale pada notebook.

Tabel hasil olahan yang dipublikasikan di repository meliputi:
- keberhasilan per model;
- keberhasilan per tugas;
- perbandingan jumlah model berhasil berdasarkan ukuran model;
- perbandingan keputusan pencarian per kelompok;
- tugas dengan peningkatan CDEA yang lebih besar pada Small; dan
- contoh tugas ketika Small memiliki lebih banyak model yang berhasil daripada Large.

Daftar file, arti kolom, cakupan data, dan batas interpretasinya dijelaskan dalam [results/README.md](results/README.md). File arsip dan keluaran notebook lokal dikecualikan dari Git melalui [.gitignore](.gitignore).

### Format arsip Scale yang didukung notebook

Notebook menerima 2 format arsip Scale:

1. **`cdea_small_extension_v1`** — arsip Small-only dengan 128 pasangan dan 256 episode.
2. **`cdea_scale_v1`** — arsip Scale dengan 256 pasangan dan 512 episode, terdiri atas 128 pasangan Large dan 128 pasangan Small. Notebook memilih hanya 128 pasangan Small; hasil Large dari arsip ini tidak digunakan dalam perbandingan skripsi.

Untuk paket penelitian terbaru, gunakan format pertama (`cdea_small_extension_v1`) melalui `scale_reference_small_v1.zip`. Format penuh kedua tetap dipertahankan untuk audit dan kompatibilitas arsip lama. Kedua format harus memiliki 32 tugas dan 4 model Small pada kelompok yang dipilih. Notebook memeriksa protokol, identitas pasangan, hasil episode, dan kesesuaian roster tugas sebelum analisis.

### Menyiapkan data untuk notebook

Letakkan `main_observation.zip` dan `scale_reference_small_v1.zip` di direktori kerja notebook. Untuk paket dataset terbaru, gunakan `Dataset_CDEA_small_only.zip`; notebook akan mengekstrak kedua arsip analisis dari `DATASET_CDEA.json` dan memeriksa checksum.

Notebook juga dapat menemukan paket `Dataset_CDEA*.zip` di direktori kerja atau `/content` (misalnya Google Colab). Paket dapat berisi:
1. `DATASET_CDEA.json` yang mencantumkan nama dan SHA-256 arsip sumber; atau
2. folder legacy `Dataset_CDEA/` yang berisi `main_observation.zip` dan `scale_reference.zip` (arsip Scale penuh maupun Small Extension tetap didukung untuk kompatibilitas).

Notebook mengekstrak hanya 2 arsip sumber yang diperlukan. Jika file dengan nama yang sama sudah tersedia, SHA-256 harus cocok dengan isi paket. Protokol setiap arsip juga diperiksa sebelum analisis dijalankan.

## Audit arsip

Gunakan Python 3.11 atau lebih baru. Pasang dependensi:

```bash
python -m pip install -r requirements-analysis.txt
```

Setelah mengekstrak kedua arsip sumber dari paket dataset, jalankan:

```bash
python scripts/analysis/audit_archives.py --main main_observation.zip --small scale_reference_small_v1.zip --output archive_audit.json
```

Audit memeriksa integritas ZIP, manifest, protokol, jumlah pasangan dan episode, identitas pasangan, kesesuaian hasil pasangan dengan hasil episode, serta kesamaan roster 32 tugas dan 4 model pada kelompok yang dipilih.

Untuk membangun ulang tabel pasangan dan ringkasan keputusan pencarian dari paket dataset, jalankan:

```bash
python scripts/analysis/build_public_results.py --package "Dataset_CDEA_small_only.zip" --output-dir results
```

Skrip memeriksa SHA-256 paket terhadap `results/provenance.json`, memvalidasi catatan sumber, lalu membuat ulang `pair_outcomes.csv.gz` dan `decision_comparison_by_group.csv`. Skrip ini tidak menjalankan eksperimen dan tidak mengubah arsip sumber.

**Batas audit:** pemeriksaan tersebut menilai konsistensi internal arsip dan tabel turunan. Audit tidak membuktikan secara independen host pelaksanaan, runtime, model yang dimuat, atau kebenaran seluruh informasi yang ditampilkan aplikasi.

## Menjalankan analisis

1. Siapkan arsip sumber sesuai format yang didukung.
2. Pasang dependensi dari `requirements-analysis.txt`.
3. Buka [notebooks/main_analysis.ipynb](notebooks/main_analysis.ipynb) menggunakan Jupyter atau Google Colab.
4. Pastikan `MAIN_ZIP` dan `SCALE_ZIP` menunjuk ke arsip yang benar.
5. Jalankan seluruh sel notebook secara berurutan.

Notebook menghasilkan folder `CDEA_Analysis_Results/` dan file `CDEA_Analysis_Results.zip`. Keluaran mencakup 9 grafik utama, 6 tabel utama, serta CSV analisis rinci untuk uji tingkat tugas, efisiensi, alasan penghentian, transisi status evidence ledger, dan audit trace pasangan Baseline-only, beserta ringkasan statistik. Keluaran notebook tersebut dibuat secara lokal dan tidak dilacak di Git; tabel ringkasan terpilih tersedia di folder `results/`.

## Pemeriksaan offline

Verifikasi notebook dengan fixture sintetis:

```bash
python scripts/analysis/verify_notebook.py
```

Jalankan seluruh pengujian offline:

```bash
python -m unittest discover -s tests -v
```

Periksa rencana tanpa menjalankan browser atau inferensi model:

```bash
python scripts/browsergym/main.py --dry-run
python scripts/browsergym/small_extension.py --dry-run
```

Fixture sintetis hanya digunakan untuk menguji alur notebook dan kontrak perangkat lunak. Fixture tersebut **bukan** data hasil penelitian. Perintah `--dry-run` hanya memeriksa rencana dan konfigurasi; perintah tersebut tidak menjalankan episode BrowserGym, server OpenApps, atau inferensi Ollama.

GitHub Actions menjalankan pemeriksaan kode dan pengujian otomatis pada Ubuntu dan Windows. Job analisis juga memverifikasi notebook menggunakan fixture sintetis.

## Menjalankan eksperimen baru

Pelaksanaan eksperimen penuh berbeda dari pemeriksaan offline. Eksekusi memerlukan checkout OpenApps pada commit yang dipatok dalam konfigurasi, BrowserGym, Ollama, serta checkpoint model yang sesuai.

Main Study memiliki pemeriksaan kesiapan (*readiness gate*) dan menggunakan [template readiness Main](docs/MAIN_READINESS_TEMPLATE.json). File readiness yang dibuat melalui opsi `-InitReadiness` berstatus `pending` dan **bukan** persetujuan menjalankan eksperimen. Main hanya dapat dijalankan setelah persyaratan readiness dipenuhi dan disetujui.

Small-Model Study menggunakan identitas pengujian (`ExtensionId`) tersendiri. Runner memeriksa commit OpenApps dan konfigurasi sebelum menjalankan pasangan.

Skrip PowerShell:
- [run_main.ps1](scripts/browsergym/run_main.ps1)
- [run_small_extension.ps1](scripts/browsergym/run_small_extension.ps1)

Jangan menjalankan eksperimen baru jika tujuannya hanya memeriksa atau mengolah arsip penelitian yang sudah tersedia.

## Batas interpretasi hasil

- Penelitian membandingkan CDEA dengan Baseline `progress-score`; kondisi Vanilla tidak diuji.
- Perbedaan tindakan pencarian menunjukkan perbedaan pemilihan kandidat, bukan bukti langsung bahwa informasi yang ditemukan benar atau menyebabkan keberhasilan tugas.
- Keterlihatan kutipan pada AXTree tidak sama dengan verifikasi kebenaran seluruh informasi atau pemenuhan seluruh constraint.
- Perbandingan Large dan Small bersifat eksploratori karena kedua kelompok menggunakan versi Agent Controller berbeda dan provenance arsip Scale belum diverifikasi secara independen.
- Pengujian menggunakan satu seed dan satu konfigurasi tampilan aplikasi.
- Hasil hanya berlaku untuk arsip, tugas, model, dan konfigurasi yang benar-benar tersedia dan diperiksa.

## Lisensi dan penggunaan

Repository ini tidak menyertakan arsip data eksperimen atau salinan lingkungan OpenApps. Periksa lisensi dan ketentuan penggunaan setiap dependensi serta lingkungan eksternal sebelum penggunaan atau distribusi lebih lanjut.


