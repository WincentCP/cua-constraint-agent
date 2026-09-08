# PRD sumber eksperimen otomatis

Sumber: PRD_Constraint_Directed_CUA.docx, lampiran pengguna pada 8 September 2026. Dokumen ini menggantikan scope studi manusia pada PRD terdahulu.

PRODUCT REQUIREMENTS DOCUMENT

Constraint-Directed Computer-Use Agent

Berbasis Accessibility Tree dengan Constraint-Directed Evidence Acquisition



Dokumen | Research Implementation PRD
Status | Final Research Scope
Jenis Evaluasi | Technical / Automated Evaluation
Environment | Synthetic Local E-Commerce Web
Browser | Chromium melalui Playwright
Fokus Utama | P vs B1: strategi pemilihan pemeriksaan berikutnya



Inti penelitian: Jika dua computer-use agent memiliki model, browser, informasi, pilihan tindakan, dan budget yang sama, apakah agent yang secara eksplisit mengetahui syarat mana yang belum terbukti dapat mencari bukti berikutnya dengan lebih tepat dan efisien daripada agent yang mengeksplorasi secara umum?





Daftar Isi

1. Ringkasan dan Masalah Penelitian

2. Tujuan, RQ, dan Hipotesis

3. Research Gap dan Novelty

4. Scope dan Prinsip Desain

5. Rancangan Sistem

6. Desain Eksperimen

7. Metrik dan Analisis

8. Requirement Implementasi

9. Testing dan Validasi

10. Arsitektur dan Tech Stack

11. Definition of Done

12. Batas Interpretasi dan Output Penelitian

Lampiran A. Skema Data Minimum

Lampiran B. Referensi Utama



1. Ringkasan dan Masalah Penelitian

Penelitian ini membangun dan mengevaluasi computer-use agent (CUA) yang menyelesaikan tugas di browser dengan mencari bukti yang diperlukan sebelum melakukan tindakan akhir. Fokus penelitian bukan sekadar apakah agent dapat mengklik atau menavigasi halaman, tetapi bagaimana agent menentukan informasi apa yang perlu diperiksa berikutnya ketika instruksi pengguna memiliki beberapa syarat.

Contoh task: “Cari salah satu kaos merah ukuran M, maksimal Rp140.000, berbahan katun, yang tersedia. Masukkan satu ke keranjang.”



Sebuah produk dapat terlihat cocok pada halaman daftar, tetapi setelah diperiksa lebih lanjut ukuran M bisa habis, harga varian bisa melewati batas, atau bahan produk tidak sesuai. Agent yang bertindak terlalu cepat berisiko salah, sedangkan agent yang memeriksa semua informasi tanpa prioritas menjadi tidak efisien.

Masalah penelitian utama adalah: bagaimana computer-use agent memilih pemeriksaan browser berikutnya ketika sebagian constraint masih belum memiliki bukti cukup?

2. Tujuan, Research Questions, dan Hipotesis

Tujuan utama adalah mengevaluasi apakah explicit constraint state membantu agent memperoleh bukti yang diperlukan secara lebih tepat dan efisien dibanding generic LLM exploration, dengan capability dan interaction budget yang dibuat sama.

2.1 Research Questions

RQ1 - Effectiveness: Apakah constraint-directed policy meningkatkan verified task success dibanding generic LLM exploration pada capability dan interaction budget yang sama?

RQ2 - Evidence Efficiency & Abstention: Apakah constraint-directed policy memperoleh bukti yang cukup dengan lebih sedikit pemeriksaan dan lebih tepat menentukan kapan agent boleh ACT atau harus ABSTAIN?

2.2 Hipotesis

H1: Proposed Policy (P) diperkirakan memiliki verified task success setara atau lebih tinggi dibanding Baseline (B1), terutama pada kondisi informasi bertahap.

H2: P diperkirakan membutuhkan lebih sedikit probe untuk mencapai evidence closure.

H3: P diperkirakan memiliki informative probe rate lebih tinggi karena pemeriksaan diarahkan pada constraint yang masih UNKNOWN.

Penelitian tidak mensyaratkan P harus menang. Hasil P > B1, P ≈ B1, maupun P < B1 tetap valid selama eksperimen fair dan reproducible.

3. Research Gap dan Novelty

Penelitian ini tidak mengklaim novelty pada accessibility tree, constraint tracking, reasoning-action loop, verification, browser automation, maupun penggunaan LLM sebagai computer-use agent. Komponen-komponen tersebut sudah digunakan atau dibahas pada penelitian sebelumnya.

Novelty yang diuji: Constraint-directed probe scheduling - explicit constraint state dipakai untuk menentukan pemeriksaan browser mana yang harus diprioritaskan berikutnya, lalu mekanisme ini diuji secara terkontrol terhadap generic exploration.



3.1 Kontribusi Penelitian

Mekanisme constraint-directed evidence acquisition untuk memprioritaskan bukti yang masih belum diketahui.

Perbandingan P vs B1 yang capability-matched; komponen lain dibuat sama dan treatment diisolasi pada probe selection.

Evaluasi correctness sekaligus evidence efficiency, termasuk kapan agent harus ACT atau ABSTAIN.

Benchmark synthetic yang terkontrol, dapat di-reset, dan dapat direproduksi.

4. Scope dan Prinsip Desain

4.1 In Scope

Synthetic local e-commerce environment

Chromium + Playwright

Accessibility-tree based observation

Canonical constraint loader

Evidence-state tracking

Shared eligible probe generator

Proposed Policy (P)

Baseline Policy (B1)

ACT/ABSTAIN decision

Post-action verification

Independent oracle

Structured trace

Benchmark runner

Metric calculation

Result export

4.2 Out of Scope

Human participant study dan klaim usability/accessibility manusia

Voice, microphone, STT/TTS, camera, participant recording

Public unrestricted websites, login, checkout, pembayaran, CAPTCHA

Multimodal screenshot reasoning/vision model

Multi-agent, RAG, browser extension

Perbandingan banyak LLM atau banyak browser engine

Production deployment dan dashboard kompleks

4.3 Prinsip Validitas

Isolate the treatment: perbedaan P dan B1 hanya pada cara memilih probe berikutnya.

Capability-matched: model, browser, accessibility observation, probe set, executor, verifier, oracle, task, dan budget harus sama.

UNKNOWN tidak boleh dianggap SATISFIED.

Final browser state dinilai oleh independent oracle, bukan klaim agent.

Model, prompt, dataset, budget, evaluator, dan konfigurasi eksperimen dibekukan sebelum main run.

5. Rancangan Sistem

5.1 Environment dan Task

Environment berupa web e-commerce sintetis lokal. Semua task berada pada satu keluarga: memilih satu dari tiga kaos, memastikan seluruh syarat terpenuhi, lalu menambahkan tepat satu item yang benar ke keranjang. Tidak ada checkout, pembayaran, akun, maupun website publik.

Instruksi natural language tetap tersedia untuk keterbacaan manusia, tetapi main benchmark tidak menggunakan LLM goal parser. Canonical constraints dibaca langsung dari fixture agar kemampuan parsing tidak menjadi confounding variable.

Elemen | Contoh
Instruksi | Cari kaos merah ukuran M, maksimal Rp140.000, berbahan katun, yang tersedia.
Canonical constraint | color=red; size=M; max_price=140000; material=cotton; available=true; quantity=1
Final action | Tambahkan tepat satu produk/varian yang sesuai ke keranjang.



5.2 Evidence State

Untuk setiap candidate × constraint, sistem menyimpan salah satu dari tiga state berikut.

State | Makna
SATISFIED | Ada bukti publik bahwa constraint terpenuhi.
REFUTED | Ada bukti publik bahwa constraint tidak terpenuhi.
UNKNOWN | Belum ada bukti yang cukup.



Constraint | Status contoh
Warna = merah | SATISFIED
Ukuran = M | SATISFIED
Harga ≤ Rp140.000 | UNKNOWN
Bahan = katun | UNKNOWN
Tersedia | SATISFIED



5.3 Accessibility-Tree Observation

Agent membaca halaman melalui accessibility tree atau representasi semantic UI setara yang berisi role, accessible name, value, text, state, selected/expanded/disabled state, dan hierarchy yang relevan. Accessibility tree dipakai sebagai grounding representation, bukan sebagai klaim bahwa sistem lebih usable bagi pengguna tunanetra.

5.4 Probe dan Shared Probe Generation

Probe adalah satu pemeriksaan browser untuk memperoleh bukti tambahan, misalnya membuka detail, memilih ukuran, membuka informasi bahan, atau memeriksa stok varian. Probe berbeda dari ACT; probe mengumpulkan informasi, sedangkan ACT mengubah final task state.

Satu shared component menghasilkan eligible probes untuk kedua policy. Pada browser state yang sama, P dan B1 harus menerima daftar probe yang sama; yang berbeda hanya ranking/selection.

Contoh Eligible Probe | Tujuan
open_product(A) | Membuka detail kandidat A
inspect_material(A) | Mencari bukti bahan
select_size(A, M) | Memunculkan state varian ukuran M
inspect_variant_stock(A, M) | Mencari bukti ketersediaan varian



5.5 Proposed Policy (P)

P menerima current observation, canonical constraints, evidence state, eligible probes, probe history, dan remaining budget. P harus memprioritaskan probe berdasarkan constraint yang masih UNKNOWN, relevansi probe terhadap UNKNOWN tersebut, expected evidence coverage, dan interaction cost relatif. Implementasi tidak perlu memakai formula matematis kompleks; yang penting explicit constraint state benar-benar memengaruhi probe selection.

5.6 Baseline Policy (B1)

B1 adalah Generic LLM Exploration Policy. B1 menerima observation, goal constraints, eligible probes, history, dan remaining budget yang sama, tetapi tidak menggunakan constraint-directed coverage ranking. LLM memilih probe berdasarkan generic progress: “probe mana yang paling membantu melanjutkan task?” Baseline harus tetap kompeten dan tidak boleh sengaja dibuat lemah.

Komponen | P | B1
Task / constraints | Sama | Sama
Browser / model | Sama | Sama
Accessibility observation | Sama | Sama
Eligible probes | Sama | Sama
Executor / verifier / oracle | Sama | Sama
Interaction budget | Sama | Sama
Probe selection | Constraint-directed | Generic progress



5.7 ACT, ABSTAIN, dan Evidence Closure

ACT adalah tindakan final untuk memasukkan produk/varian ke keranjang. ACT hanya boleh dilakukan jika seluruh required constraints terhadap kandidat telah SATISFIED.

ABSTAIN_NO_SOLUTION: bukti menunjukkan tidak ada kandidat yang memenuhi seluruh syarat.

ABSTAIN_INSUFFICIENT_EVIDENCE: informasi penentu memang tidak tersedia; agent harus tidak menebak.

Evidence closure tercapai ketika bukti sudah cukup untuk ACT, ABSTAIN_NO_SOLUTION, atau ABSTAIN_INSUFFICIENT_EVIDENCE.

5.8 Verify-After-Action dan Oracle

Setelah ACT, sistem melakukan fresh observation untuk memastikan cart benar-benar berubah dan item/varian/quantity sesuai. Setelah episode outcome dibekukan, independent oracle menilai final browser state terhadap reference goal privat. Oracle tidak boleh memberi informasi kepada agent selama episode berjalan.

6. Desain Eksperimen

6.1 Main Benchmark

Main benchmark terdiri dari 16 base task. Setiap base task diuji dalam dua presentation condition (EARLY dan STAGED) dan dengan dua policy (P dan B1).

Total main experiment: 16 base task × 2 kondisi × 2 policy = 64 episode.



Jenis Base Task | Jumlah Base Task | Episode per Policy
Solvable | 12 | 24
No-solution | 2 | 4
Unavailable-evidence | 2 | 4
Total | 16 | 32



6.2 EARLY vs STAGED

Kondisi | Deskripsi | Peran
EARLY | Sebagian besar informasi penting tersedia lebih awal. | Sanity check / kondisi lebih mudah.
STAGED | Informasi penentu baru muncul setelah probe tertentu. | Kondisi utama yang sensitif terhadap probe scheduling.



EARLY dan STAGED pada base task yang sama harus mempunyai goal, candidate identities, underlying product truth, dan correct final outcome yang sama. Yang berbeda hanya kapan evidence menjadi visible.

6.3 Interaction Budget

P dan B1 harus memiliki interaction budget identik, misalnya maksimum probe atau episode step limit. Nilai final ditentukan pada development stage lalu dibekukan. Budget tidak boleh diubah khusus untuk salah satu policy pada main experiment.

6.4 Development Gate dan Repeatability

Validasi fixture dan synthetic website.

Pilih satu model lokal yang kompeten.

Pastikan B1 mampu menyelesaikan minimal dua STAGED development tasks.

Lakukan repeatability check: 4 STAGED task × 2 policy × 3 pengulangan = 24 development episodes.

Jika stabil, freeze model, prompts, dataset, budget, verifier, oracle, dan metric definitions sebelum main run.

Development episodes tidak masuk ke main result. Jika bug fundamental ditemukan setelah main dimulai, main run tersebut dinyatakan invalid dan seluruh benchmark dijalankan ulang setelah perbaikan/version bump.

7. Metrik dan Analisis

Metrik Utama | Definisi | Interpretasi
Verified Solvable Success | Final cart berisi tepat satu produk/varian yang memenuhi seluruh constraint. | Lebih tinggi = lebih sering benar-benar menyelesaikan goal.
ACT/ABSTAIN Correctness | ACT hanya saat evidence cukup; no-solution/unavailable evidence harus abstain dengan kategori tepat. | Lebih tinggi = keputusan lebih dapat dipercaya.
Probes to Evidence Closure | Jumlah probe sampai bukti cukup untuk ACT/ABSTAIN. | Lebih rendah = evidence acquisition lebih efisien.
Informative Probe Rate | Proporsi probe yang mengubah UNKNOWN menjadi SATISFIED atau REFUTED. | Lebih tinggi = eksplorasi lebih terarah.



7.1 Diagnostic Metrics

Total browser actions

LLM calls dan token usage

Wall-clock time

Retries / recovery count

Invalid structured outputs

Verification failures

Failure type

Diagnostic metrics digunakan untuk menjelaskan trade-off dan penyebab failure; bukan headline claim.

7.2 Analisis

P dan B1 dibandingkan secara paired pada base task yang sama. EARLY dan STAGED dilaporkan terpisah. Analisis menekankan absolute difference, paired outcomes, effect magnitude, dan failure pattern. P-value tidak dipaksakan sebagai syarat utama kesimpulan.

7.3 Failure Taxonomy

Failure | Definisi singkat
Wrong Candidate | Produk yang dipilih tidak sesuai.
Constraint Violation | Satu atau lebih constraint tidak terpenuhi.
Premature ACT | Agent bertindak ketika evidence masih UNKNOWN.
Wrong Abstention | Agent abstain padahal solusi tersedia dan evidence dapat ditemukan.
Exploration Failure | Budget habis sebelum evidence closure.
Browser Execution Failure | Action gagal dijalankan.
Verification Failure | Final state tidak dapat diverifikasi.
Structured Output Failure | Model menghasilkan output invalid.
Environment Failure | Fixture/website tidak berada pada expected state.



8. Requirement Implementasi

8.1 Functional Requirements

ID | Requirement | Acceptance Summary
FR-01 | Task Loading | Memuat natural-language task dan canonical constraints dari fixture dengan task ID yang sama.
FR-02 | Browser Reset | Setiap episode dimulai dari deterministic state: cart kosong, fixture benar, URL awal benar, history bersih.
FR-03 | Semantic Observation | Mengambil structured browser observation yang cukup untuk reasoning agent.
FR-04 | Evidence Tracking | Menyimpan SATISFIED / REFUTED / UNKNOWN untuk setiap candidate × constraint.
FR-05 | Shared Probe Generation | Pada state sama, P dan B1 memperoleh eligible probe list identik.
FR-06 | Proposed Selection | P menggunakan explicit UNKNOWN constraints sebagai dasar selection.
FR-07 | Baseline Selection | B1 menggunakan generic progress evaluation, tanpa constraint-directed coverage ranking.
FR-08 | Probe Execution | Selected probe dapat dieksekusi melalui Playwright.
FR-09 | Evidence Update | Evidence berubah hanya ketika observation baru mendukung perubahan state.
FR-10 | ACT Guard | ACT ditolak jika required constraint masih UNKNOWN atau REFUTED.
FR-11 | ABSTAIN | Mendukung NO_SOLUTION dan INSUFFICIENT_EVIDENCE.
FR-12 | Verification | ACT selalu diikuti fresh-state observation.
FR-13 | Independent Oracle | Oracle hanya berjalan setelah outcome episode dibekukan.
FR-14 | Structured Logging | Seluruh step penting direkam secara terstruktur.
FR-15 | Metric Generation | Empat primary metrics dihitung otomatis.
FR-16 | Benchmark Runner | Seluruh 64 main episodes dapat dijalankan dalam satu workflow.



8.2 Non-Functional Requirements

Reproducibility: Experiment dapat dijalankan ulang menggunakan frozen config.

Reliability: Satu episode gagal tidak menghentikan seluruh benchmark.

Determinism: Environment dan fixtures sebisa mungkin deterministik.

Traceability: Setiap metric dapat ditelusuri kembali ke episode trace.

Simplicity: Tidak menambah infrastructure yang tidak diperlukan untuk menjawab RQ.

Separation: Agent, verifier, dan oracle dipisahkan secara logis.

8.3 Structured Output dan Trace

LLM output harus menggunakan structured schema dan divalidasi menggunakan Zod. Free-form reasoning boleh disimpan untuk debugging, tetapi tidak menjadi metric utama.

Trace Minimum | Contoh isi
Episode metadata | episode_id, task_id, policy, condition, config hash
Observation | accessibility-tree snapshot / normalized semantic state
Evidence state | candidate × constraint state dan sumber bukti
Probe step | eligible probes, selected probe, reason code
Execution | browser action, result, retries
Decision | ACT / ABSTAIN category
Verification & Oracle | fresh state, final outcome, failure type
Metrics | primary dan diagnostic metrics



9. Testing dan Validasi

9.1 Testing Strategy

Level | Wajib Mencakup
Unit Tests | Constraint-state transition, evidence closure, ACT guard, oracle, metric calculator, fixture validation.
Integration Tests | Browser reset, Playwright action, observation extraction, probe execution, cart verification.
Policy Tests | P mempertimbangkan UNKNOWN; B1 tidak menerima constraint-directed ranking; eligible probes sama.
End-to-End Tests | Solvable, no-solution, unavailable evidence, EARLY, dan STAGED.



9.2 Dataset Validation

Solvable task benar-benar memiliki solusi yang sesuai semua constraint.

No-solution task benar-benar tidak memiliki solusi.

Unavailable-evidence benar-benar tidak dapat dipastikan dari public evidence.

EARLY/STAGED mempunyai underlying truth sama.

Oracle menghasilkan expected outcome untuk fixture tersebut.

Task yang gagal validation tidak boleh masuk main benchmark.

9.3 Experiment Integrity

Jangan tuning P berdasarkan main result.

Jangan melemahkan B1 dengan sengaja.

Jangan memberi P probe atau budget tambahan.

Jangan memberi oracle information kepada agent selama episode.

Jangan menghapus episode gagal dari hasil.

Simpan seluruh episode, failure reason, dan frozen configuration.

9.4 Recovery Policy

Main experiment mengizinkan maksimal satu safe recovery untuk failure teknis yang jelas, misalnya stale browser reference atau structured output gagal parse. Recovery tidak boleh mengubah strategi, memberi informasi baru, atau menambah reasoning budget. Jika recovery kedua tetap gagal, episode ditandai gagal sesuai failure taxonomy.

10. Arsitektur dan Tech Stack

Layer | Pilihan
Core | TypeScript / Node.js
Browser automation | Playwright + Chromium
Observation | Accessibility Tree / semantic browser representation
LLM | Ollama + satu model lokal yang dibekukan
Structured validation | Zod
Experiment data | JSON / JSONL / CSV
Optional storage | SQLite
Optional demo UI | React; tidak menjadi dependency eksperimen



10.1 Arsitektur Logis

Alur sistem: Task Fixture → Constraint Loader → Browser Environment → Accessibility Observation → Evidence Tracker → Shared Eligible Probe Generator → [P atau B1] → Probe Executor → Observation → Evidence Update → ACT/ABSTAIN → Verifier → Freeze Outcome → Oracle → Metrics



10.2 Main Agent Loop

Load task dan canonical constraints; reset browser.

Observe browser dan initialize evidence state.

Update evidence berdasarkan observation terbaru.

Jika evidence mendukung ACT, lakukan ACT lalu verify.

Jika bukti menunjukkan no-solution, ABSTAIN_NO_SOLUTION.

Jika evidence penting benar-benar unavailable, ABSTAIN_INSUFFICIENT_EVIDENCE.

Jika belum closure, generate shared eligible probes.

P memilih constraint-directed; B1 memilih generic-progress.

Execute selected probe, observe kembali, lalu ulangi sampai closure atau budget habis.

Freeze outcome, run oracle, calculate metrics, save trace.

10.3 CLI dan Output

Main experiment harus dapat dijalankan tanpa GUI. Minimal workflow yang tersedia: development gate, single episode, run P, run B1, main benchmark, calculate metrics, dan export results.

Output | Isi Minimum
episodes.jsonl | Structured trace seluruh episode.
metrics.json | Ringkasan metric programatik.
metrics.csv | Format mudah dianalisis/tabulasi.
failures.json | Failure taxonomy dan detail episode gagal.
experiment-config.json | Frozen configuration, model ID, prompt/version, budget, dataset/version.



11. Definition of Done

11.1 System DoD

☐ Synthetic e-commerce environment berjalan lokal.

☐ 16 base task tersedia dalam EARLY dan STAGED.

☐ Task fixtures tervalidasi.

☐ Chromium dapat dikontrol melalui Playwright.

☐ Structured accessibility observation tersedia.

☐ Evidence tracker berjalan.

☐ Shared eligible probe generator berjalan.

☐ P dan B1 berjalan.

☐ ACT guard dan ABSTAIN logic berjalan.

☐ Post-action verifier berjalan.

☐ Independent oracle berjalan.

☐ Structured traces tersimpan.

☐ Metric calculator berjalan.

☐ Development gate dan repeatability check dapat dijalankan.

☐ Main benchmark dapat dijalankan otomatis.

☐ Hasil dapat diekspor ke JSON/CSV.

☐ Unit dan integration tests lulus.

11.2 Research Experiment DoD

☐ Baseline competence gate lulus.

☐ 24 development repeatability episodes selesai.

☐ Model dan prompt dibekukan.

☐ Dataset, budget, verifier, oracle, dan metrics dibekukan.

☐ Main experiment config disimpan.

☐ 64 main episodes selesai dan tidak ada episode hilang.

☐ EARLY dan STAGED dianalisis terpisah.

☐ Empat primary metrics tersedia.

☐ Failure taxonomy tersedia.

☐ Paired comparison P vs B1 dapat dibuat.

12. Batas Interpretasi dan Output Penelitian

12.1 Batas Interpretasi

Kesimpulan hanya berlaku pada synthetic e-commerce task, satu keluarga tugas, model, browser, observation representation, probe set, dan interaction budget yang benar-benar diuji. Penelitian tidak boleh menyimpulkan bahwa metode pasti lebih baik pada semua website/model, lebih accessible bagi pengguna tunanetra, lebih usable oleh manusia, atau siap digunakan untuk transaksi nyata.

12.2 Expected Research Output

Research agent dengan explicit constraint state untuk memilih pemeriksaan berikutnya.

Capability-matched baseline dengan generic exploration.

Controlled benchmark EARLY/STAGED yang reproducible.

Objective final-state evaluation melalui verifier dan independent oracle.

Structured dataset of runs untuk analisis dan failure inspection.

Empirical findings tentang effectiveness, abstention correctness, dan evidence efficiency.

Success criterion penelitian: Penelitian berhasil jika eksperimen dapat menjawab dengan valid apakah P lebih baik, setara, atau lebih buruk daripada B1, serta dalam kondisi apa perbedaan tersebut muncul. Sistem tidak dinilai sukses hanya jika P menang.





Lampiran A. Skema Data Minimum

A.1 Evidence Record

Field | Keterangan
episode_id | Identifier episode
candidate_id | Identifier kandidat produk
constraint_id | Identifier constraint
required_value | Nilai yang diwajibkan
observed_value | Nilai yang diamati
state | SATISFIED / REFUTED / UNKNOWN
source | Sumber evidence
probe_id | Probe yang menghasilkan evidence
step | Nomor step
timestamp | Waktu pencatatan



A.2 Experiment Config Minimum

model identifier dan version

model parameters / temperature

system prompt version

P prompt / B1 prompt version

dataset version

synthetic website version

interaction budget

probe generator version

verifier version

oracle version

metric definition version

Lampiran B. Referensi Utama

Yao et al. (2023). ReAct: Synergizing Reasoning and Acting in Language Models. ICLR 2023. Link

Zhou et al. (2024). WebArena: A Realistic Web Environment for Building Autonomous Agents. Link

Drouin et al. (2024). WorkArena: How Capable Are Web Agents at Solving Common Knowledge Work Tasks? ICML 2024. Link

Ko et al. (2026). When Is Enough Not Enough? Illusory Completion in Search Agents (Epistemic Ledger / LiveLedger). Link

Peng et al. (2025). Morae: Proactively Pausing UI Agents for User Choices. UIST 2025. Link

Mohanbabu et al. (2026). A11y-CUA Dataset: Characterizing the Accessibility Gap in Computer Use Agents. CHI 2026. Link

Final Research Statement

Jika dua computer-use agent mempunyai model, browser, informasi, pilihan tindakan, dan budget yang sama, apakah agent yang secara eksplisit mengetahui syarat mana yang belum terbukti dapat menentukan informasi berikutnya yang perlu diperiksa dengan lebih efektif dan efisien daripada agent yang melakukan eksplorasi secara umum?
