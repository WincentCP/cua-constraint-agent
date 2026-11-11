# Main v1 — Data Provenance

## Archive identity

| Item | Recorded value |
|---|---|
| Archive | `main_observation_v1(5).zip` |
| Study ID | `main_observation_v1` |
| SHA-256 | `74f48100b4dc6ae074573596dc87beed18770d4c3740f2c01f5efcd57a2d885c` |
| Controller commit | `ee8e7a0a60ea54ee9ff27acc0baf1424af2b80a1` |
| OpenApps commit | `6e6782794433c60468d65ac75bc3f03c56007f8c` |
| Protocol | `cdea_main_v1` |
| Recorded approval | Wincent Coleus Phan · 2026-10-20 09:59:30 UTC |
| Researcher-reported live-provenance review | **PASS** · six readiness gates marked passed |

## Recorded archive checks

- ZIP integrity passed; `results.csv`: **256** rows, `pairs.csv`: **128**, `summary.csv`: **40**.
- `analysis.json` records **128 valid**, **0 invalid**, **0 not-started** pairs; aggregate successes reconcile with episode records.
- Manifest records frozen source/config/model identities; archive includes readiness approval and six evidence references.
- Episode records include process identifiers and browser/server trace paths.

## Verification scope

**PASS is the researcher's recorded live-evidence review, not an independent host-level attestation.** Archive checks support integrity and traceability; this documentation update did not independently confirm original-host execution or replay every episode.

**Catatan pencatatan `num_ctx` (2026-10-27):** Manifest dan 256 episode Main asli tidak memuat field `num_ctx`. Kode pada commit pengendali Main asli tidak mengirimkan opsi `num_ctx` secara eksplisit pada request Ollama, sehingga nilainya tidak dapat disimpulkan hanya dari berkas arsip. Arsip Scale historis memang mencatat `8192`. Runner Main yang diperbarui kemudian menerapkan 8192 secara eksplisit untuk eksekusi baru.

**Konfirmasi peneliti (2026-10-28):** Peneliti secara langsung mengonfirmasi bahwa **`num_ctx=8192`** merupakan pengaturan yang sebenarnya digunakan saat Main Study historis. Untuk mendokumentasikannya, paket `Dataset_CDEA.zip` kini menyertakan `NUM_CTX_MAIN_CONFIRMATION.json` dan `manifest_main_researcher_amended.json` (salinan manifest dengan `num_ctx=8192` dan jejak asal konfirmasi). **Kedua ZIP sumber, manifest asli, dan seluruh episode tidak diubah** sehingga checksum asal tetap berlaku. Catatan tersebut adalah informasi yang dikonfirmasi peneliti setelah pelaksanaan, **bukan** field yang terekam oleh runtime pada manifest asli ataupun verifikasi independen dari log permintaan Ollama.

Arsip sumber asli harus tetap tidak berubah. Untuk pemeriksaan, gunakan fingerprint, `manifest.json`, readiness evidence, dan paired traces dari arsip sumber yang disimpan terpisah. Konfigurasi protokol tersedia di [`config/main_plan.json`](../config/main_plan.json), sedangkan analisis tersedia di [notebook utama](../notebooks/main_analysis.ipynb).

## Notebook input alias

The study source can also be supplied to the current notebook under the name `main_observation.zip`. Its SHA-256 remains `74f48100b4dc6ae074573596dc87beed18770d4c3740f2c01f5efcd57a2d885c`. Renaming is not a new experiment and does not alter recorded source history.
