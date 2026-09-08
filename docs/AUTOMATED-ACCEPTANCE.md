# Pemetaan requirement PRD otomatis

Scope mengacu pada PRD lampiran tanggal 8 September 2026. Status pengujian aktual disimpan terpisah di [AUTOMATED-STATUS](AUTOMATED-STATUS.md).

| ID | Implementasi | Verifikasi |
| --- | --- | --- |
| FR-01 Task loading | `experiment/tasks.ts`, `AgentRun.startCanonical`; canonical goal divalidasi Zod, di-clone, tanpa parser LLM | Unit canonical loader; integrasi menghitung nol pemanggilan goal parser |
| FR-02 Browser reset | Fixture/world baru dan browser context baru per episode, cart kosong, cookie terisolasi, entry URL tetap | Integrasi enam episode ACT/ABSTAIN; browser suite |
| FR-03 Semantic observation | `browser/observer.ts`, Playwright ARIA snapshot, tree, role, nama, state, descriptor registry | Unit extractor dan integrasi binding |
| FR-04 Evidence tracking | `core/evidence.ts`; candidate × constraint matrix, fakta dengan sumber/variant scope | Unit missing/conflicting/wrong-scope evidence |
| FR-05 Shared probes | `agent/routes.ts`; satu enumerator dan budget filtering untuk P/B1 | Unit routes dan policy; model input tidak diberi label policy |
| FR-06 P selection | `core/router.ts`; satisfied count, UNKNOWN coverage, forward cost, deterministic tie-break | Unit ranking coverage |
| FR-07 B1 selection | Shared LLM annotation dengan `generic_progress_score`; selector B1 mengabaikan ranking coverage | Unit ranking P/B1, planner allowlist |
| FR-08 Probe execution | `AgentRun.dispatch`; descriptor rebinding, Playwright click/select, verify/recovery | Browser integration dan retry accounting |
| FR-09 Evidence update | Hanya facts dari observation publik masuk evidence store; `may_answer` tidak menjadi fakta | Unit evidence; leakage test |
| FR-10 ACT guard | Full feasibility, fresh variant evidence, effect-bound guard sebelum dispatch | Approval/guard unit; false-toast/fake-cart integration |
| FR-11 ABSTAIN | `no_feasible_in_scope` dan `insufficient_evidence`, dipetakan ke dua kategori PRD | Integrasi no-solution dan unavailable-evidence di EARLY/STAGED |
| FR-12 Verification | Fresh observation sesudah action, exact cart/variant/quantity verification | Browser integration termasuk cart palsu |
| FR-13 Oracle | `evaluation/oracle.ts`; runner membekukan outcome dan menutup browser sebelum evaluasi privat | Integrasi urutan freeze → oracle dan reference goal |
| FR-14 Logging | `experiment/runner.ts`; timestamp, episode ID, journal, observations, evidence matrix, eligible/selected probes, reason code, dispatch, recovery, frozen outcome, oracle | Unit interrupted export, integrasi artifact dan startup failure |
| FR-15 Metrics | `experiment/metrics.ts`; empat primary metrics, diagnostic, failure taxonomy, paired comparison | Unit denominator, incomplete/null, duplicate/mixed config, repeatability |
| FR-16 Benchmark | `scripts/experiment.ts`; main 64 episode, repeatability 24, per-policy, freeze, export | Manifest unit, CLI demo benchmark dan integration runner |

Constraint `requested_variant_available` memeriksa kombinasi size, color, dan availability; `requested_variant_price` memakai scope varian yang sama; `requested_material` aktif hanya bila goal mensyaratkan material. Quantity selalu satu dan diverifikasi pada final cart.

System DoD memerlukan software dan tes berjalan. Research Experiment DoD tetap memerlukan model lokal nyata, B1 competence, repeatability yang lulus, freeze, dan 64 episode main nyata. Hasil demo tidak memenuhi Research Experiment DoD.
