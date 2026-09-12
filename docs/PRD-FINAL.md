# PRD Final — Constraint-Directed Probe Selection untuk Computer-Use Agent

**Status:** Approved research contract — implementation integrated; empirical evaluation pending  
**Versi:** Final research contract, 10 September 2026  
**Repository:** `WincentCP/cua-constraint-agent`  
**Primary audience:** GPT Astra / coding agent, peneliti, dosen pembimbing  
**Source of truth:** Dokumen ini menggantikan keputusan metodologi lama yang bertentangan dengannya.

---

## 1. Ringkasan Eksekutif

Penelitian ini menguji **cara computer-use agent memilih informasi apa yang perlu diperiksa sebelum bertindak** pada tugas web yang memiliki beberapa syarat sekaligus.

Contoh task:

> Cari salah satu kaos merah ukuran M, berbahan katun, maksimal Rp140.000, dan tersedia. Masukkan satu ke keranjang.

Masalahnya, tidak semua informasi penting tersedia di halaman awal. Harga varian, kecocokan ukuran/warna, bahan, atau stok dapat baru diketahui setelah agent membuka detail tertentu. Agent yang bertindak terlalu cepat dapat memilih produk tanpa bukti lengkap. Agent yang memeriksa terlalu banyak hal juga tidak efisien.

Penelitian membandingkan dua kondisi yang **mendapat informasi, tools, model, evidence matrix, kandidat probe, dan budget yang sama**:

- **Baseline — Generic Probe Selection:** agent bebas menentukan pemeriksaan berikutnya berdasarkan seluruh informasi yang tersedia.
- **Proposed — Constraint-Directed Probe Selection:** agent wajib memprioritaskan probe yang dapat menyelesaikan constraint yang masih berstatus `UNKNOWN`.

Dengan desain ini, yang diuji bukan manfaat memiliki checklist constraint. Kedua kondisi sama-sama memilikinya. Variabel yang diuji hanya **strategi memilih probe berikutnya**.

Main benchmark terdiri dari **32 base task × 2 policy = 64 run**. Tidak ada human study. Tidak ada voice/STT/TTS. Tidak ada EARLY/STAGED. Kompleksitas task dikontrol melalui jumlah constraint yang masih `UNKNOWN` pada observasi awal: **U2, U3, dan U4**.

Keberhasilan tidak cukup dinilai dari produk akhir yang kebetulan benar. Sebuah `ACT` hanya dianggap benar jika:

1. produk/varian final memang memenuhi seluruh goal; dan
2. **sebelum ACT**, semua constraint wajib sudah memiliki bukti publik yang valid menurut evaluator terpisah.

---

## 2. Latar Belakang dan Masalah Penelitian

Computer-use agent adalah agent AI yang dapat membaca antarmuka dan melakukan tindakan pada komputer atau browser untuk menyelesaikan task. Pada web, agent sering harus membuat keputusan dari informasi yang tersebar di beberapa halaman atau state UI.

Pada task multi-constraint, final result yang terlihat benar belum tentu diperoleh dengan alasan yang benar. Agent dapat secara kebetulan memilih produk yang sesuai walaupun belum memeriksa harga, stok, atau atribut lain. Hal ini penting karena sistem yang hanya dinilai dari outcome akhir dapat terlihat berhasil meskipun sebenarnya bertindak tanpa bukti yang cukup.

LiveLedger / *When Is Enough Not Enough? Illusory Completion in Search Agents* menunjukkan masalah serupa pada search agents: agent dapat menganggap task selesai ketika masih ada constraint yang belum terverifikasi. Paper tersebut menunjukkan bahwa explicit constraint-state tracking membantu mengurangi underverified answers. Karena manfaat tracking itu sendiri sudah pernah ditunjukkan, penelitian ini **tidak mengklaim evidence/constraint ledger sebagai novelty**.

Gap yang diuji di sini lebih sempit:

> Jika kedua agent sudah memiliki constraint state yang sama, apakah strategi yang secara eksplisit memprioritaskan pemeriksaan untuk constraint yang masih `UNKNOWN` menghasilkan keputusan yang lebih tepat dan/atau lebih efisien daripada generic probe selection?

WebArena dan benchmark web-agent lain mendukung penggunaan lingkungan terkontrol dan evaluator programatik untuk mengukur functional correctness. Prinsip ini digunakan di penelitian ini agar tiap task mempunyai ground truth yang jelas dan dapat diulang.

### 2.1 Masalah inti

Terdapat tiga kegagalan yang ingin dibedakan:

1. **Wrong action:** agent bertindak dan memilih hasil yang salah.
2. **Underverified action:** agent bertindak sebelum seluruh syarat mempunyai bukti, meskipun hasil akhirnya kebetulan benar.
3. **Inefficient exploration:** agent mengambil terlalu banyak pemeriksaan sebelum dapat membuat keputusan yang benar.

### 2.2 Mengapa masalah ini penting

Pada agent yang melakukan side effect seperti menambahkan item ke keranjang, "hasil akhirnya benar" tidak cukup sebagai satu-satunya bukti reliability. Agent harus dapat menunjukkan bahwa keputusan dibuat setelah syarat-syarat yang relevan benar-benar diperiksa.

Penelitian ini fokus pada **reliability dan evidence acquisition**, bukan pada e-commerce sebagai produk. Domain produk dipilih karena mudah membuat task multi-constraint yang jelas, realistis, dan memiliki ground truth yang dapat diverifikasi.

---

## 3. Tujuan, Research Question, dan Hipotesis

### 3.1 Tujuan penelitian

Merancang dan mengevaluasi strategi **constraint-directed probe selection** untuk computer-use agent berbasis Accessibility Tree pada controlled web tasks multi-constraint.

### 3.2 Research questions

**RQ1 — Verified decision accuracy**  
Dengan model, tools, Accessibility Tree observation, evidence matrix, eligible probes, dan interaction budget yang sama, apakah constraint-directed probe selection meningkatkan keputusan yang benar dibanding generic probe selection?

**RQ2 — Probe efficiency**  
Pada task yang diselesaikan dengan benar oleh kedua kondisi, apakah constraint-directed probe selection membutuhkan lebih sedikit probe untuk mencapai keputusan yang terverifikasi?

**RQ3 — Mechanism check**  
Bagaimana perbedaan performa antara Proposed dan Baseline berubah ketika jumlah constraint yang masih `UNKNOWN` pada awal task meningkat dari U2 menjadi U3 dan U4?

RQ3 berfungsi sebagai **mechanism analysis**, bukan klaim generalisasi luas. Jika gap Proposed meningkat ketika lebih banyak constraint belum terbukti, hasil tersebut memperkuat argumen bahwa mekanisme bekerja sesuai tujuan. Jika tidak, hasil tersebut tetap valid dan membatasi klaim penelitian.

### 3.3 Hipotesis kerja

- **H1:** Proposed memiliki Verified Decision Accuracy yang sama atau lebih tinggi daripada Baseline, terutama pada task dengan lebih banyak `UNKNOWN` awal.
- **H2:** Pada paired-correct runs, Proposed memiliki jumlah probe yang lebih rendah.
- **H3:** Keuntungan Proposed diperkirakan lebih terlihat pada U3/U4 dibanding U2.

Hipotesis bukan Definition of Done. Hasil nol atau negatif tetap merupakan hasil penelitian yang sah.

---

## 4. Batas Scope

### 4.1 In scope

- Satu domain terkontrol: pemilihan produk pada synthetic e-commerce-like website.
- Tepat tiga kandidat produk per task.
- Empat required constraints yang konsisten pada semua main task.
- Observation berbasis Accessibility Tree / semantic UI representation.
- Evidence tracking dengan status `SATISFIED`, `REFUTED`, atau `UNKNOWN`.
- Generic baseline dan constraint-directed proposed policy.
- Browser interaction nyata pada Chromium melalui automation tool.
- Post-action verification.
- Independent evaluator/oracle setelah agent selesai.
- Main benchmark 64 run.
- Structured logging dan export hasil untuk analisis.

### 4.2 Out of scope

- Human study atau participant testing.
- Klaim usability untuk pengguna tunanetra.
- Voice, STT, TTS, microphone, VAD, audio interaction.
- Consent/participant management.
- Live marketplace seperti Shopee/Tokopedia/Amazon sebagai main benchmark.
- Checkout, pembayaran, akun, OTP, CAPTCHA.
- Multi-agent system.
- RAG/vector database.
- Model training/fine-tuning sebagai kontribusi.
- Vision/screenshot reasoning sebagai variabel penelitian.
- Mobile/web multi-domain benchmark.
- Production deployment.
- Membuktikan Accessibility Tree lebih baik daripada screenshot/DOM representation.

### 4.3 Posisi Accessibility Tree

Accessibility Tree digunakan sebagai **representasi semantik UI** yang menyediakan struktur seperti role, name, state, dan value. Ia adalah supporting representation, bukan novelty dan bukan bukti bahwa sistem telah diuji untuk pengguna tunanetra.

---

## 5. Controlled Environment dan Definisi Task

### 5.1 Bentuk task

Setiap base task memiliki:

- 3 kandidat produk;
- satu natural-language instruction;
- satu canonical goal yang dimiliki evaluator;
- empat required constraints;
- public information yang sebagian tersedia di list page dan sebagian harus diperoleh melalui probe;
- satu expected terminal decision.

Contoh instruction:

> Cari salah satu kaos merah ukuran M, berbahan katun, maksimal Rp140.000, dan tersedia. Masukkan satu ke keranjang.

### 5.2 Empat required constraints

Semua main task menggunakan empat constraint yang sama agar U2/U3/U4 dapat dibandingkan dengan jelas:

1. **Variant match:** varian yang diminta (warna + ukuran) memang tersedia sebagai pilihan yang valid.
2. **Material match:** bahan produk sesuai dengan permintaan.
3. **Price constraint:** harga aktual varian yang diminta tidak melebihi batas harga.
4. **Availability constraint:** varian yang diminta tersedia/in stock.

`Quantity = 1` adalah postcondition aksi, bukan bagian dari initial unknown count.

### 5.3 Evidence state

Untuk setiap kandidat × constraint, status hanya boleh:

- `SATISFIED`: bukti publik yang sudah dikunjungi mendukung constraint.
- `REFUTED`: bukti publik yang sudah dikunjungi membuktikan constraint gagal.
- `UNKNOWN`: bukti belum tersedia atau belum cukup.

`UNKNOWN` tidak boleh dianggap `SATISFIED`.

Setiap evidence update harus mempunyai provenance minimal:

- candidate;
- constraint;
- status;
- public value/fact;
- source observation atau probe;
- timestamp/step sebelum ACT.

### 5.4 Initial UNKNOWN level

Task diberi label:

- **U2:** tepat 2 dari 4 jenis constraint belum dapat dibuktikan dari initial observation.
- **U3:** tepat 3 dari 4 belum dapat dibuktikan.
- **U4:** seluruh 4 constraint masih membutuhkan pemeriksaan.

Agar label tidak ambigu, untuk satu base task **jenis constraint yang tersembunyi di initial state harus konsisten di ketiga kandidat**. Contoh U2 dapat menyembunyikan price dan availability untuk semua kandidat, sementara variant match dan material sudah dapat dibaca.

U2/U3/U4 menggantikan desain EARLY/STAGED lama.

### 5.5 Probe

**Probe** adalah satu tindakan eksplorasi read-only yang dipilih untuk memperoleh informasi baru, misalnya:

- membuka detail produk;
- membuka bagian/accordion varian;
- membuka informasi stok;
- membuka informasi harga varian.

Probe adalah unit pemilihan yang dibandingkan antara Baseline dan Proposed.

Aksi kembali/backtracking, final add-to-cart, dan read-only verification tidak dihitung sebagai exploratory probe, tetapi tetap boleh dicatat sebagai supporting browser actions.

---

## 6. Dua Kondisi Eksperimen

Prinsip utama fairness:

> **Semua hal sama kecuali aturan memilih probe berikutnya.**

Kedua kondisi menerima:

- task/canonical goal yang sama;
- initial public observation yang sama;
- Accessibility Tree yang sama;
- evidence matrix yang sama;
- eligible probes yang sama;
- semantic interpretation/annotation probe yang sama;
- model dan generation configuration yang sama;
- browser/tools yang sama;
- action/recovery/verification rules yang sama;
- interaction budget yang sama.

### 6.1 Baseline — Generic Probe Selection

Baseline melihat seluruh evidence matrix, goal, history, probe descriptions, dan remaining budget yang sama dengan Proposed.

Baseline **tidak kehilangan constraint state**. Ia bebas menentukan probe berikutnya berdasarkan generic progress toward task completion.

Baseline tidak boleh sengaja dilemahkan. Ia boleh menggunakan `UNKNOWN` jika model menganggap itu penting. Jika Baseline memilih pola yang sama dengan Proposed, itu adalah hasil yang valid.

### 6.2 Proposed — Constraint-Directed Probe Selection

Proposed menggunakan input yang sama tetapi probe selection mengikuti aturan eksplisit:

1. Kandidat yang sudah mempunyai required constraint `REFUTED` dapat dikeluarkan dari exploration oleh shared eligibility filter. Filter ini berlaku identik pada kedua kondisi.
2. Untuk setiap eligible probe, tentukan berapa required constraint yang masih `UNKNOWN` dan secara publik berpotensi dijawab oleh probe tersebut.
3. Proposed memprioritaskan probe dengan **UNKNOWN coverage terbesar**.
4. Jika seri, prioritaskan probe dengan forward cost lebih rendah.
5. Jika masih seri, gunakan deterministic stable tie-break yang tidak berhubungan dengan jawaban benar.

Tidak ada prioritas tambahan berdasarkan private ground truth, answer position, seed, atau evaluator annotation.

### 6.3 Shared probe interpretation

Jika sistem memerlukan LLM untuk menafsirkan kontrol UI dan memperkirakan constraint apa yang mungkin dijawab oleh suatu probe, interpretasi tersebut dilakukan **identik sebelum policy selection** dan tersedia pada kedua kondisi.

`may_answer` hanya berarti probe *mungkin* mengungkap informasi tentang constraint. Ia tidak boleh dianggap sebagai bukti bahwa constraint sudah terpenuhi.

### 6.4 Single eligible probe

Jika hanya ada satu eligible probe, kedua kondisi memilih probe yang sama secara deterministik. Kejadian tersebut tetap menjadi bagian trajectory, tetapi bukan bukti perbedaan policy.

---

## 7. Decision Rules dan Outcome Mapping

### 7.1 Kapan agent boleh ACT

Runtime agent hanya boleh melakukan final `ACT` (menambahkan tepat satu produk ke cart) ketika seluruh required constraints untuk kandidat yang dipilih tidak lagi `UNKNOWN` dan telah dinilai `SATISFIED` oleh evidence state yang berasal dari public observations.

Namun keputusan research **tidak ditentukan oleh penilaian agent sendiri**. Setelah run selesai, evaluator terpisah memvalidasi apakah bukti tersebut benar-benar ada dan benar.

### 7.2 Verified ACT

`ACT` hanya dianggap benar jika kedua syarat berikut terpenuhi:

**A. Final-effect correctness**

- cart berisi tepat satu item;
- produk benar-benar termasuk feasible set menurut ground truth;
- warna dan ukuran tepat;
- material tepat;
- actual variant price <= max price;
- availability benar;
- quantity = 1;
- tidak ada forbidden/extra effect.

**B. Pre-ACT evidence completeness**

Sebelum action dikirim, evaluator dapat menemukan valid public evidence untuk keempat required constraints kandidat tersebut dalam recorded trajectory.

Jika A benar tetapi B salah, hasil tetap **FAIL** sebagai underverified action.

### 7.3 No-solution

Correct `NO_SOLUTION` membutuhkan:

- cart tetap kosong;
- tidak ada feasible candidate menurut ground truth; dan
- untuk setiap kandidat relevan, trajectory memiliki public evidence yang cukup untuk merefutasi minimal satu required constraint;
- agent berhenti dengan reason no feasible solution.

### 7.4 Insufficient evidence

Correct `INSUFFICIENT_EVIDENCE` membutuhkan:

- cart tetap kosong;
- terdapat kandidat yang belum dapat direfutasi secara lengkap; tetapi
- minimal satu decisive required fact memang **tidak tersedia** melalui supported public route;
- agent menyatakan bukti tidak cukup, bukan mengklaim no-solution.

### 7.5 Budget exhaustion

`BUDGET_EXHAUSTED` adalah kategori terpisah.

Ia **bukan abstention yang benar**, karena agent berhenti akibat resource ceiling, bukan karena berhasil membuktikan tidak ada solusi atau bukti memang tidak tersedia.

Pada primary accuracy, healthy-run budget exhaustion dihitung sebagai keputusan tidak berhasil.

### 7.6 Outcome categories

Evaluator harus menghasilkan salah satu kategori utama berikut:

| Outcome | Definisi | Primary success? |
|---|---|---:|
| `VERIFIED_ACT_SUCCESS` | ACT, final effect benar, semua required evidence tersedia sebelum ACT | Ya |
| `UNDERVERIFIED_ACT` | ACT dilakukan saat minimal satu required constraint belum memiliki bukti valid | Tidak |
| `WRONG_ACT` | ACT dengan final product/variant/effect salah | Tidak |
| `CORRECT_NO_SOLUTION` | Tidak bertindak dan semua kandidat telah direfutasi dengan benar | Ya |
| `CORRECT_INSUFFICIENT_EVIDENCE` | Tidak bertindak karena decisive evidence benar-benar tidak tersedia | Ya |
| `FALSE_ABSTENTION` | Tidak bertindak walaupun task seharusnya dapat diselesaikan/dibuktikan | Tidak |
| `BUDGET_EXHAUSTED` | Budget habis sebelum keputusan benar | Tidak |
| `EXECUTION_OR_VERIFICATION_FAILURE` | Policy telah menghasilkan intent tetapi eksekusi/verifikasi teknis gagal | Tidak pada healthy-run analysis; laporkan terpisah |
| `INFRASTRUCTURE_FAILURE` | Browser/model/storage/runtime tidak tersedia atau crash | Bukan policy outcome; laporkan dan tangani dengan rerun protocol |

Evaluator juga boleh menyimpan orthogonal flags seperti `final_effect_correct`, `evidence_complete_before_act`, dan `budget_exhausted` agar failure analysis tidak bergantung pada satu label saja.

---

## 8. Independent Evaluator / Oracle

### 8.1 Prinsip

Evaluator/oracle adalah komponen offline yang **tidak boleh memengaruhi execution**.

Agent tidak boleh menerima:

- feasible set privat;
- answer label;
- ground-truth product predicates yang belum dibuka;
- evaluator decision;
- scenario seed yang membocorkan jawaban;
- hidden route map;
- reward/success boolean.

### 8.2 Tugas evaluator

Setelah agent outcome dibekukan, evaluator:

1. membaca final world/cart state;
2. menentukan feasible set dari canonical task ground truth;
3. mengecek final effect;
4. membaca recorded public observations/provenance sebelum ACT;
5. menentukan apakah semua required constraints benar-benar sudah terverifikasi sebelum ACT;
6. memetakan run ke outcome category;
7. menghitung metric fields.

### 8.3 Menghindari circular evaluation

Evidence completeness tidak dinilai dari pernyataan agent "sudah yakin".

Evaluator harus memvalidasi recorded evidence terhadap evaluator-owned task specification. Dengan demikian agent tidak menjadi hakim untuk keberhasilannya sendiri.

### 8.4 Goal parsing

Main benchmark tidak boleh menjadikan natural-language goal parsing sebagai sumber variasi penelitian.

Setiap fixture mempunyai **canonical structured goal** yang diberikan identik ke kedua conditions. Natural-language instruction tetap disimpan untuk keterbacaan/demo, tetapi main comparison tidak boleh gagal hanya karena parser Bahasa Indonesia salah.

Jika natural-language goal parser dipertahankan untuk demo, ia berada di luar main experimental path.

---

## 9. Dataset Main: 32 Base Tasks

### 9.1 Total

Main dataset terdiri dari:

- **16 solvable**
- **8 no-solution**
- **8 unavailable-evidence**

Setiap base task dijalankan satu kali pada Baseline dan satu kali pada Proposed:

**32 base × 2 policy = 64 main runs.**

Tidak ada EARLY/STAGED multiplier.

### 9.2 Solvable subtype

Dari 16 solvable:

- **8 single-feasible:** hanya satu kandidat memenuhi seluruh constraint.
- **8 multi-feasible:** dua atau lebih kandidat memenuhi seluruh constraint.

Pada multi-feasible task, agent sukses jika memasukkan **tepat satu** kandidat dari feasible set. Banyaknya feasible product tidak menambah skor.

### 9.3 Distribusi initial UNKNOWN

Distribusi main dibuat hampir seimbang:

| Task type | U2 | U3 | U4 | Total |
|---|---:|---:|---:|---:|
| Solvable — single-feasible | 3 | 2 | 3 | 8 |
| Solvable — multi-feasible | 2 | 3 | 3 | 8 |
| No-solution | 3 | 3 | 2 | 8 |
| Unavailable-evidence | 3 | 2 | 3 | 8 |
| **Total** | **11** | **10** | **11** | **32** |

Distribusi boleh diubah sedikit **hanya sebelum freeze** bila fixture feasibility menuntut, tetapi tiga level UNKNOWN dan 16/8/8 outcome ratio harus dipertahankan kecuali ada keputusan metodologi baru.

### 9.4 Requirements untuk solvable task

- Ada minimal satu feasible candidate.
- Semua required evidence untuk minimal satu feasible candidate dapat diperoleh melalui supported public probes.
- Ada path lengkap untuk mencapai verified ACT di bawah chosen budget.
- Wrong-looking decoys harus plausible, bukan trap yang sengaja dibuat hanya agar Proposed menang.

### 9.5 Requirements untuk no-solution

- Tidak ada feasible candidate.
- Setiap kandidat mempunyai minimal satu required constraint yang dapat direfutasi melalui public evidence.
- Semua refutation yang diperlukan dapat diperoleh dalam supported route dan budget.
- Correct terminal decision adalah `NO_SOLUTION`, bukan insufficient evidence.

### 9.6 Requirements untuk unavailable-evidence

- Ada minimal satu kandidat yang tidak dapat dibuktikan gagal hanya dari evidence yang tersedia.
- Minimal satu decisive fact sengaja tidak tersedia melalui supported public route.
- Agent tidak boleh menggunakan hidden backend truth.
- Correct terminal decision adalah `INSUFFICIENT_EVIDENCE`.

### 9.7 Anti-leakage requirements

- Nama/slug tidak boleh mengandung answer label.
- Urutan feasible product tidak boleh selalu sama.
- Product ordering harus bervariasi secara terencana.
- UI label tidak boleh menyebut `correct`, `constraint`, `oracle`, `answer`, atau metadata evaluator.
- Private fixture fields tidak boleh masuk ke observation payload agent.
- U2/U3/U4 tidak boleh diberitahukan sebagai label kepada policy.

---

## 10. Metrics dan Formula

### 10.1 Primary metric — Verified Decision Accuracy (VDA)

Untuk run ke-i:

`VDA_i = 1` jika outcome adalah salah satu:

- `VERIFIED_ACT_SUCCESS`
- `CORRECT_NO_SOLUTION`
- `CORRECT_INSUFFICIENT_EVIDENCE`

Selain itu `VDA_i = 0` untuk healthy assessable run.

Formula:

**VDA = jumlah correct verified decisions / jumlah valid assessable runs**

VDA wajib dilaporkan:

- overall;
- per policy;
- per task type: solvable / no-solution / unavailable-evidence;
- per initial UNKNOWN level: U2 / U3 / U4.

Untuk solvable, laporkan juga single-feasible vs multi-feasible.

### 10.2 Secondary metric — Probe Count to Correct Decision

`ProbeCount_i` adalah jumlah exploratory probe dispatch sampai terminal correct decision.

Agar agent yang gagal cepat tidak terlihat "lebih efisien", comparison utama probe hanya dilakukan pada **paired-correct base tasks**, yaitu base di mana Baseline dan Proposed sama-sama memperoleh `VDA_i = 1`.

Untuk tiap paired-correct base:

**DeltaProbe_i = ProbeCount_Proposed,i - ProbeCount_Baseline,i**

Interpretasi:

- `DeltaProbe < 0`: Proposed lebih efisien.
- `DeltaProbe = 0`: sama.
- `DeltaProbe > 0`: Baseline lebih efisien.

Laporkan median, range/IQR, dan paired distribution. Jangan hanya menampilkan satu average global.

### 10.3 Mechanism analysis — effect by UNKNOWN level

Untuk U2/U3/U4, hitung:

- VDA Baseline;
- VDA Proposed;
- absolute VDA difference;
- paired probe difference pada jointly correct runs.

Jika keuntungan Proposed meningkat seiring U2 → U3 → U4, hal itu mendukung causal story bahwa unknown-directed selection lebih berguna ketika kebutuhan evidence acquisition meningkat.

### 10.4 Diagnostic metrics

Boleh dicatat otomatis tetapi tidak menjadi headline claim:

- underverified ACT rate;
- wrong ACT count;
- false abstention count;
- budget exhaustion count;
- informative probe rate;
- total browser actions;
- LLM calls/tokens;
- wall time;
- execution/verification failures;
- infrastructure failures.

### 10.5 Metrics yang tidak lagi primary

- Excess probe cost terhadap manually-defined minimum path.
- Evidence acquired per probe.
- Recovery success rate sebagai kontribusi.
- Completion time sebagai headline efficiency metric.

Metric tersebut boleh tetap tersedia sebagai diagnostic bila implementasinya murah, tetapi tidak boleh memperumit main analysis.

---

## 11. Interaction Budget

Budget harus sama untuk Baseline dan Proposed.

Budget mencakup minimal:

- maximum exploratory probes;
- maximum browser actions;
- maximum model calls;
- overall run deadline.

Angka final ditentukan pada development split berdasarkan feasibility, **bukan berdasarkan gap yang membuat Proposed terlihat paling bagus**.

Requirements:

- Semua intended-solvable task mempunyai minimal satu verified-success path di bawah budget.
- Semua no-solution task mempunyai full-public-refutation path di bawah budget.
- Unavailable-evidence task tetap unavailable meskipun budget masih tersedia.
- Budget tidak boleh diubah setelah main results mulai dilihat.
- Retry/recovery yang benar-benar melakukan forward browser interaction harus mengonsumsi action budget.

---

## 12. Post-Action Verification

Verification adalah shared reliability layer, bukan variabel eksperimen.

Setelah side-effect action:

1. baca state baru;
2. cek expected effect;
3. jika jelas benar → PASS;
4. jika tidak jelas → boleh satu bounded safe re-check/recovery;
5. jangan melakukan blind repeated `ADD_TO_CART` yang dapat menggandakan quantity.

Verifier harus identik di Baseline dan Proposed.

Verification success tidak menggantikan independent oracle; verifier digunakan saat runtime, oracle digunakan untuk research assessment.

---

## 13. Development, Freeze, dan Main Evaluation

### 13.1 Development split

Development tasks harus terpisah dari 32 main tasks.

Digunakan untuk:

- memastikan model memahami schema dan tools;
- memastikan Baseline bukan strawman;
- memilih budget yang feasible;
- memvalidasi U2/U3/U4 generation;
- menguji evaluator/oracle;
- menguji repeatability dasar.

### 13.2 Baseline competence gate

Sebelum freeze, Baseline harus dapat menyelesaikan beberapa development tasks yang benar-benar membutuhkan multi-probe exploration.

Tujuannya bukan memastikan Baseline tinggi, tetapi memastikan ia kompeten dan tidak sengaja dibuat lemah.

### 13.3 Repeatability check

Sebelum freeze, jalankan subset kecil development task beberapa kali pada kedua policy.

Jika trajectory sangat tidak stabil, perbaiki determinism/configuration sebelum main. Jangan menambah repeated main trials hanya karena satu development failure kecuali variability memang terbukti mengancam interpretasi.

### 13.4 Freeze

Sebelum main, lock:

- code commit;
- 32-task manifest;
- model/provider/version;
- model configuration;
- prompts/shared annotations;
- policy rules;
- budget;
- evaluator rules;
- package/dependency lock;
- browser version/config;
- randomization/order manifest.

Setelah freeze, jangan mengubah komponen tersebut berdasarkan main results.

### 13.5 Run ordering

Setiap base memiliki Baseline dan Proposed pair.

Urutan policy sebaiknya diacak/counterbalanced agar efek cache, warming, atau urutan tidak selalu menguntungkan satu kondisi.

Browser/world state harus reset penuh per run.

---

## 14. Infrastructure Failure dan Rerun Protocol

Infrastructure failures harus dipisahkan dari policy failures.

Contoh infrastructure failure:

- browser gagal start/crash;
- model server tidak tersedia;
- storage gagal;
- process interrupted sebelum valid terminal decision.

Aturan:

1. Original attempt tetap disimpan.
2. Jangan mengubahnya menjadi policy failure atau diam-diam menghapusnya.
3. Jika rerun diperlukan karena infrastructure failure, rerun **kedua policy untuk base yang sama** dengan attempt ID baru.
4. Catat reason rerun.
5. Primary policy comparison menggunakan valid paired runs sesuai predeclared rerun rule, dan jumlah original infrastructure failure tetap dilaporkan.

Healthy `BUDGET_EXHAUSTED` bukan infrastructure failure dan tidak boleh direrun hanya karena hasilnya buruk.

---

## 15. Data yang Harus Direkam

Minimal per run:

- base task ID;
- policy;
- task type;
- initial UNKNOWN count;
- model/config/freeze identifier;
- ordered list of public observations;
- evidence-state transitions + provenance;
- eligible probe set per decision point;
- selected probe;
- exploratory probe count;
- browser action count;
- ACT/abstain terminal reason;
- evidence snapshot immediately before ACT;
- final cart/world state;
- verification result;
- evaluator outcome category;
- VDA;
- failure reason jika ada;
- run start/end and wall time;
- token/model call counts jika tersedia.

Raw logs dapat lebih detail, tetapi reporting layer harus tetap sederhana.

---

## 16. System Architecture — Conceptual Contract

PRD ini **tidak mengunci folder, class, function, framework pattern, atau exact API**. GPT Astra boleh merestrukturisasi repository untuk mencapai implementasi paling sederhana dan maintainable.

Namun sistem secara konseptual harus memisahkan tanggung jawab berikut:

1. **Controlled Environment** — menghasilkan web state publik dan private ground truth.
2. **Observer** — mengambil semantic/Accessibility Tree observation.
3. **Evidence Tracker** — memperbarui candidate × constraint state dari public evidence.
4. **Probe Discovery/Interpretation** — menentukan eligible read-only exploration actions dan apa yang mungkin mereka jawab.
5. **Policy Selection** — satu-satunya experimental branch: Baseline vs Proposed.
6. **Executor + Runtime Verifier** — menjalankan browser action dan mengecek postcondition.
7. **Independent Evaluator/Oracle** — menilai run setelah outcome beku.
8. **Benchmark Runner + Recorder** — menjalankan manifest dan menyimpan hasil.

Astra bebas menggabungkan atau memisahkan modul engineering selama boundary research di atas tetap dapat diaudit.

---

## 17. Technology Constraints

Tech stack bukan kontribusi penelitian. Gunakan solusi paling sederhana yang stabil dan reproducible.

Minimum expectations:

- satu primary application/runtime language bila memungkinkan;
- Chromium automation yang dapat membaca semantic/accessibility state;
- satu fixed LLM/model untuk kedua conditions;
- structured schema validation untuk output model;
- deterministic local evaluator;
- persistent structured result storage (SQLite atau equivalent sederhana);
- JSON/CSV export untuk analisis.

Existing Node.js/TypeScript + Playwright architecture boleh dipertahankan bila tetap paling sederhana. Astra **tidak wajib** mempertahankan struktur lama jika refactor besar justru menghasilkan sistem yang lebih bersih.

Model/provider juga bukan research variable. Gunakan satu model yang cukup kompeten dan freeze sebelum main. Jangan menjalankan model-comparison sebagai bagian dari main research.

---

## 18. Repository dan Documentation Contract

### 18.1 Prinsip repository

Final repository harus:

- mudah dijalankan ulang;
- tidak memiliki dead participant/voice code dari desain lama;
- tidak memiliki dua metodologi aktif sekaligus;
- tidak memiliki duplicate/contradictory config;
- memisahkan public agent input dari private evaluator truth;
- memiliki automated tests untuk research invariants;
- mempunyai satu workflow jelas untuk development, freeze, main benchmark, dan export.

### 18.2 Astra boleh menentukan struktur folder

Tidak ada folder tree normatif di PRD ini.

Astra boleh:

- rename/move files;
- merge modules;
- split modules;
- delete obsolete code;
- replace internal APIs;
- simplify frontend/backend;

selama behavior, research fairness, evaluator independence, dataset contract, dan reproducibility tetap terpenuhi.

### 18.3 Dokumentasi minimum setelah refactor

Disarankan final repository hanya mempunyai dokumentasi yang benar-benar berguna:

- **README** — apa project ini, scope, quick start, status.
- **PRD-FINAL** — dokumen ini sebagai metodologi/single source of truth.
- **SETUP** — dependency dan cara menjalankan sistem.
- **EXPERIMENT** — development → freeze → main → rerun/export procedure.
- **STATUS** — apa yang benar-benar sudah implemented/tested, bukan requirement.
- **RESULTS** — dibuat setelah main benchmark; tidak boleh berisi fabricated data sebelum eksperimen.

Dokumen lama boleh dihapus atau diarsipkan jika bertentangan dan berisiko membingungkan agent/reviewer.

---

## 19. Legacy Cleanup Requirements

Implementasi sekarang berasal dari desain lama yang masih memuat participant testing, voice interaction, EARLY/STAGED, dan policy lama. Refactor harus menghapus atau menonaktifkan secara final bagian yang tidak lagi sesuai.

### REMOVE

- human-study split dan participant ordering;
- consent, participant IDs, participant retention logic;
- voice/STT/TTS/microphone/VAD runtime;
- voice/device failure taxonomy yang tidak relevan;
- human approval flow untuk add-to-cart;
- EARLY/STAGED sebagai experimental factor;
- old 16-base main design;
- proposed ranking yang mendahulukan `SATISFIED` count sebagai primary priority;
- goal parser dari main benchmark path;
- manually-defined minimum evidence path sebagai kebutuhan main metric;
- excess probe cost sebagai headline metric;
- documentation yang masih mengklaim target blind users/human study.

### KEEP / ADAPT

- controlled synthetic browser environment;
- Accessibility Tree observer;
- candidate/constraint evidence matrix;
- probe discovery;
- capability-matched two-condition framework;
- browser execution;
- post-action verifier;
- independent oracle/evaluator;
- structured trace/storage;
- benchmark/freeze concepts;
- tests yang masih menguji invariant relevan.

### ENHANCE

- evaluator untuk pre-ACT evidence completeness;
- new 32-task manifest dengan U2/U3/U4;
- explicit outcome mapping;
- paired metric reporting;
- anti-leakage tests;
- fairness test yang membuktikan kedua policy menerima input yang sama kecuali selection rule.

---

## 20. Acceptance Criteria

Implementasi belum dianggap sesuai PRD sebelum semua kondisi berikut dapat dibuktikan.

### Research fairness

**AC-01.** Baseline dan Proposed menerima goal, public observations, evidence matrix, eligible probes, model/config, tools, budget, executor, dan verifier yang sama.

**AC-02.** Satu-satunya experimental difference adalah probe-selection rule.

**AC-03.** Baseline dapat melihat constraint state lengkap dan tidak sengaja dibatasi agar terlihat lebih lemah.

**AC-04.** Proposed memprioritaskan UNKNOWN coverage; old SAT-count-first behavior tidak lagi menjadi policy utama.

### Evidence and action validity

**AC-05.** `UNKNOWN` tidak pernah dianggap `SATISFIED`.

**AC-06.** Setiap SATISFIED/REFUTED state mempunyai public evidence provenance.

**AC-07.** A correct final cart tanpa complete pre-ACT evidence menghasilkan `UNDERVERIFIED_ACT`, bukan success.

**AC-08.** Verified ACT memerlukan final-effect correctness + pre-ACT evidence completeness.

### Abstention and budget

**AC-09.** No-solution hanya benar jika seluruh kandidat telah mempunyai public refutation yang cukup.

**AC-10.** Insufficient-evidence hanya benar jika decisive fact memang tidak tersedia melalui supported public route.

**AC-11.** Budget exhaustion tidak diklasifikasikan sebagai correct abstention.

### Dataset

**AC-12.** Main manifest memiliki tepat 32 base: 16 solvable, 8 no-solution, 8 unavailable-evidence.

**AC-13.** Solvable terbagi 8 single-feasible dan 8 multi-feasible.

**AC-14.** Dataset mencakup U2/U3/U4 dengan distribusi yang hampir seimbang dan setiap task mempunyai label yang dapat diverifikasi secara deterministik.

**AC-15.** Tidak ada EARLY/STAGED experimental multiplier; main = 64 policy runs.

### Evaluator and leakage

**AC-16.** Private ground truth/oracle data tidak masuk agent context.

**AC-17.** Evaluator berjalan setelah outcome agent beku dan tidak memengaruhi recovery/planning.

**AC-18.** Natural-language parser bukan bagian wajib main benchmark.

### Reproducibility

**AC-19.** Development tasks terpisah dari main tasks.

**AC-20.** Model, prompt, policy, dataset, budget, evaluator, dependencies, and run-order manifest dapat difreeze.

**AC-21.** Main run dapat diulang dari clean state menggunakan documented procedure.

**AC-22.** Infrastructure failure dan policy failure dilaporkan terpisah.

### Repository quality

**AC-23.** Tidak ada active participant/voice/human-study path dalam final research runtime.

**AC-24.** README dan docs tidak bertentangan dengan PRD final.

**AC-25.** Test suite melindungi fairness, evidence validity, outcome mapping, dataset composition, oracle independence, dan no-leakage rules.

---

## 21. Testing Strategy

Astra harus memilih testing implementation yang efisien, tetapi coverage minimal meliputi:

### Unit-level

- evidence transition rules;
- U2/U3/U4 classification;
- proposed unknown-coverage ranking;
- stable tie-break;
- outcome mapping;
- VDA calculation;
- paired probe metric calculation;
- dataset counts/distribution.

### Integration-level

- Accessibility Tree observation dari browser nyata;
- probe → new public evidence;
- no hidden fact leakage;
- verified ACT;
- coincidentally-correct but underverified ACT;
- wrong ACT;
- correct no-solution;
- correct unavailable-evidence;
- budget exhaustion;
- safe add-to-cart verification;
- browser reset between runs.

### Research-invariant tests

- same input snapshot for policy comparison at identical state;
- only policy selection differs;
- baseline has access to the same ledger;
- oracle cannot be imported/called by agent execution path;
- main fixture answer cannot be inferred from IDs/order/labels;
- main manifest exactly 64 runs.

---

## 22. Reporting dan Analisis Hasil

Minimum final report:

### Table A — Verified Decision Accuracy

Per policy:

- overall;
- solvable;
- no-solution;
- unavailable-evidence;
- single-feasible;
- multi-feasible;
- U2;
- U3;
- U4.

### Table B — Paired Probe Efficiency

Hanya task di mana kedua policy correct:

- number of jointly correct pairs;
- median Baseline probes;
- median Proposed probes;
- median `DeltaProbe`;
- range/IQR.

### Figure/summary — Mechanism trend

Tampilkan gap Proposed - Baseline pada U2/U3/U4.

Interpretasi yang boleh dibuat:

- Proposed lebih accurate pada kondisi tertentu;
- Proposed lebih/kurang efisien pada jointly correct tasks;
- keuntungan tampak/tidak tampak meningkat dengan initial unknown count;
- failure pattern apa yang paling sering terjadi.

Interpretasi yang tidak boleh dibuat tanpa bukti tambahan:

- policy universal lebih baik untuk semua website;
- Accessibility Tree lebih baik daripada screenshot/DOM;
- sistem terbukti membantu pengguna tunanetra;
- hasil synthetic e-commerce langsung berlaku ke live marketplace;
- model tertentu superior secara umum.

---

## 23. Definition of Done

### 23.1 Engineering DoD

- final code sesuai acceptance criteria;
- legacy out-of-scope flow dihapus;
- unit/integration/research-invariant tests lulus;
- benchmark dapat dijalankan dari clean setup;
- export menghasilkan data yang cukup untuk VDA dan paired probe analysis;
- no stale docs atau dead research paths.

### 23.2 Pre-main research DoD

- 32-task main dataset selesai dan diaudit;
- U2/U3/U4 benar;
- Baseline competence gate lulus;
- interaction budget ditetapkan dari development;
- evaluator mengidentifikasi underverified ACT dengan benar;
- anti-leakage tests lulus;
- code/config/model/dataset/prompt/budget difreeze;
- main run order disimpan sebelum data collection.

### 23.3 Final research DoD

- 64 planned main policy runs dijalankan atau missing/infrastructure runs dijelaskan transparan;
- rerun mengikuti protocol;
- VDA dan paired probe metrics dihitung sesuai definisi;
- result dibreakdown menurut task type dan U2/U3/U4;
- semua negative/null results tetap dilaporkan;
- claims disesuaikan dengan evidence aktual.

---

## 24. Instruksi untuk GPT Astra

Gunakan dokumen ini sebagai **research contract**, bukan sebagai permintaan untuk mempertahankan arsitektur lama.

Urutan kerja yang diharapkan:

1. Audit repository aktual terhadap PRD ini.
2. Identifikasi code/docs/config lama yang bertentangan.
3. Pilih desain implementasi paling sederhana yang memenuhi semua research invariants.
4. Refactor secara menyeluruh; jangan mempertahankan fitur hanya karena sudah ada.
5. Buat/ubah tests sebelum menganggap requirement selesai.
6. Pastikan dataset dan evaluator tidak bocor ke agent.
7. Pastikan Baseline dan Proposed capability-matched.
8. Hapus dead code dan stale docs.
9. Jalankan full automated validation.
10. Jangan menjalankan main benchmark sebagai data final sebelum freeze gate benar-benar terpenuhi.

Astra boleh mengubah folder, modules, APIs, internal types, UI, atau implementation details selama:

- metodologi tidak berubah;
- experimental treatment tetap satu variabel;
- data/evaluator boundary aman;
- final system lebih sederhana, bukan lebih kompleks;
- reproducibility meningkat.

Jika ada konflik antara implementasi lama dan dokumen ini, **dokumen ini menang**.

---

## 25. Literatur Utama dan Posisi Penelitian

### LiveLedger / Illusory Completion

Ko, D. et al. (2026). *When Is Enough Not Enough? Illusory Completion in Search Agents.*  
https://arxiv.org/abs/2602.07549

Relevansi: menunjukkan bahwa final answer dapat terlihat benar walaupun constraint belum diverifikasi, serta menunjukkan manfaat explicit constraint-state tracking. Konsekuensinya, constraint ledger diberikan ke **kedua** policy dan tidak diklaim sebagai novelty penelitian ini.

### WebArena

Zhou, S. et al. (2023/ICLR 2024). *WebArena: A Realistic Web Environment for Building Autonomous Agents.*  
https://arxiv.org/abs/2307.13854

Relevansi: mendukung controlled/reproducible web environment dan functional programmatic evaluation untuk agent tasks.

### ReAct

Yao, S. et al. (ICLR 2023). *ReAct: Synergizing Reasoning and Acting in Language Models.*  
https://arxiv.org/abs/2210.03629

Relevansi: dasar umum agent yang menggabungkan reasoning dan action; mendukung generic exploration sebagai baseline family, bukan sebagai exact system replication.

### OSWorld

Xie, T. et al. (2024). *OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer Environments.*  
https://arxiv.org/abs/2404.07972

Relevansi: menunjukkan pentingnya executable environment, task success, dan reproducible computer-use evaluation.

### Morae (contextual only)

Peng, Y.-H. et al. (2025). *Morae: Proactively Pausing UI Agents for User Choices.*  
https://arxiv.org/abs/2508.21456

Relevansi: contoh UI-agent research yang memisahkan technical behavior dan user-centered concerns. Penelitian ini tidak mengulang human-study component tersebut.

---

## 26. Final Research Statement

Kontribusi penelitian ini bukan Accessibility Tree, bukan evidence matrix, dan bukan constraint tracking itu sendiri.

**Kontribusi yang diuji adalah:**

> sebuah strategi **constraint-directed probe selection** yang menggunakan constraint state yang sama dengan baseline, tetapi secara eksplisit memprioritaskan pemeriksaan yang dapat menutup constraint `UNKNOWN`; manfaatnya diuji melalui controlled paired benchmark menggunakan verified decisions, pre-ACT evidence completeness, probe efficiency, dan analysis berdasarkan initial unknown count.

Dengan demikian, penelitian mempunyai satu variabel eksperimen yang jelas, evaluator independen, dataset yang terstruktur, metric yang tidak ambigu, dan scope yang tetap realistis untuk skripsi S1.
