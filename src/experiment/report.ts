import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Experiment,
  readJson,
  readLines,
  exportResults,
} from "./runner.ts";
import { type Row, type calculateMetrics } from "./metrics.ts";

type Metrics = ReturnType<typeof calculateMetrics>;
const esc = (v: unknown) =>
  String(v ?? "—").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const md = (v: unknown) =>
  String(v ?? "—")
    .replaceAll("|", "\\|")
    .replace(/[\r\n]/g, " ")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const percent = (v: number | null) =>
  v === null ? "—" : `${(v * 100).toFixed(1)}%`;
export function renderReport(
  experiment: Experiment,
  rows: Row[],
  metrics: Metrics,
) {
  const label = experiment.demo
    ? "DEMO — BUKAN HASIL PENELITIAN"
    : experiment.mode === "main"
      ? "EKSPERIMEN MAIN — MODEL NYATA"
      : "DEVELOPMENT — BUKAN HASIL MAIN";
  const parts: string[] = [`# Laporan eksperimen CUA\n\n**${label}**\n\n`],
    html: string[] = [
      `<h1>Laporan eksperimen CUA</h1><p class="banner">${esc(label)}</p>`,
    ];
  const paragraph = (text: string) => {
    parts.push(md(text) + "\n\n");
    html.push(`<p>${esc(text)}</p>`);
  };
  const table = (title: string, headers: string[], data: unknown[][]) => {
    parts.push(
      `## ${title}\n\n| ${headers.map(md).join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${data.map((r) => `| ${r.map(md).join(" | ")} |`).join("\n")}\n\n`,
    );
    html.push(
      `<h2>${esc(title)}</h2><div class="table"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${data.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
    );
  };
  paragraph(
    `Experiment ID: ${experiment.id}. Dibuat: ${experiment.created}. Mode: ${experiment.mode}. Freeze: ${experiment.freeze_id ?? "belum ada"}.`,
  );
  paragraph(
    `Run asli: ${metrics.original_attempts}/${metrics.planned_original_runs}; belum dicoba: ${metrics.unattempted_original}; percobaan ulang: ${metrics.rerun_attempts}; kegagalan infrastruktur (semua attempt): ${metrics.infrastructure_failures}; pasangan valid untuk analisis: ${metrics.selected_valid_pairs}.`,
  );
  if (experiment.demo)
    paragraph(
      "Angka di laporan ini berasal dari planner simulasi untuk memvalidasi implementasi. Gunakan screenshot sebagai ilustrasi sistem dengan label demo. Angka ini tidak membuktikan performa Qwen atau hipotesis penelitian.",
    );
  if (!experiment.freeze_id && !experiment.demo)
    paragraph(
      "Laporan ini belum terikat pada freeze main. Jangan menganggapnya hasil penelitian final.",
    );
  table(
    "Verified Decision Accuracy",
    ["Kelompok", "Policy", "Benar", "Run berpasangan valid", "VDA"],
    metrics.accuracy.map((a) => [
      a.group,
      a.policy,
      a.correct,
      a.primary_paired_n,
      percent(a.vda),
    ]),
  );
  paragraph(
    "VDA menggunakan pasangan paling awal yang lengkap dan bebas kegagalan infrastruktur. Healthy budget exhaustion serta keputusan salah tetap dihitung sebagai gagal. Denominator nol ditampilkan sebagai tanda pisah.",
  );
  table(
    "Efisiensi probe — hanya jointly correct pairs",
    [
      "Kelompok",
      "Pasangan",
      "Median Baseline",
      "Median Proposed",
      "Median ΔP−B",
      "Rentang Δ",
      "IQR Δ",
    ],
    metrics.efficiency.map((e) => [
      e.group,
      e.jointly_correct_pairs,
      e.Baseline.median,
      e.Proposed.median,
      e.delta_probe.median,
      e.delta_probe.n
        ? `${e.delta_probe.min} sampai ${e.delta_probe.max}`
        : "—",
      e.delta_probe.iqr,
    ]),
  );
  table(
    "Mechanism check",
    ["UNKNOWN awal", "VDA Baseline", "VDA Proposed", "Gap (poin persentase)"],
    metrics.mechanism.map((m) => [
      `U${m.unknown}`,
      percent(m.Baseline),
      percent(m.Proposed),
      m.absolute_vda_difference === null
        ? "—"
        : (m.absolute_vda_difference * 100).toFixed(1),
    ]),
  );
  table(
    "Outcome — seluruh attempt",
    ["Outcome", "Jumlah"],
    Object.entries(metrics.outcomes),
  );
  const screenshotFailures = rows.reduce(
    (sum, r) =>
      sum + r.events.filter((e) => e.type === "SCREENSHOT_FAILURE").length,
    0,
  );
  paragraph(
    `Kegagalan capture screenshot: ${screenshotFailures}. Screenshot adalah dokumentasi UI, tidak menjadi input model atau bukti bagi evaluator. Semua file mentah tersedia di episodes.jsonl, events.jsonl dan CSV.`,
  );
  const cases: Row[] = [],
    seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.cell.policy}:${r.task.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      cases.push(r);
    }
  }
  paragraph(
    "Contoh berikut dipilih secara mekanis: attempt pertama yang terekam untuk setiap kombinasi policy dan jenis task, termasuk apabila gagal. Ini bukan pemilihan contoh terbaik.",
  );
  for (const r of cases) {
    const title = `${r.cell.base} / ${r.cell.policy} / ${r.task.type}`;
    parts.push(`## ${md(title)}\n\n`);
    html.push(`<h2>${esc(title)}</h2>`);
    paragraph(
      `${label}. Attempt: ${r.id}. Outcome: ${r.evaluation.outcome}. Probe: ${r.evaluation.probe_count}. Alasan: ${r.outcome.detail || r.evaluation.detail || "—"}.`,
    );
    const shots = r.events.filter(
      (e) =>
        e.type === "SCREENSHOT" &&
        /^screenshots\/[a-zA-Z0-9-]+\/obs-\d+\.png$/.test(e.data.path),
    );
    const act = r.events.find((e) => e.type === "ACT_INTENT");
    const lastBefore = act
      ? shots.filter((e) => e.seq < act.seq).at(-1)
      : undefined;
    const chosen = [
      ...new Set(
        [shots[0], lastBefore, shots.at(-1)].filter((x) => x !== undefined),
      ),
    ];
    if (!chosen.length)
      paragraph(
        "Screenshot tidak tersedia pada attempt ini. Observasi Accessibility Tree tetap ada di event trace.",
      );
    for (const shot of chosen) {
      const caption = `${experiment.demo ? "DEMO — " : ""}${r.cell.base}, ${r.cell.policy}, ${shot.data.observation}, probe ${shot.data.step}, ${shot.data.url}`;
      parts.push(`![${md(caption)}](${shot.data.path})\n\n${md(caption)}\n\n`);
      html.push(
        `<figure><img loading="lazy" src="${esc(shot.data.path)}" alt="${esc(caption)}"><figcaption>${esc(caption)}</figcaption></figure>`,
      );
    }
    const pre = r.events.find((e) => e.type === "PRE_ACT_EVIDENCE");
    if (pre)
      table(
        "Evidence sesaat sebelum ACT",
        ["Constraint", "Status yang dicatat agent"],
        Object.entries(pre.data.ledger).map(([k, v]) => [
          k,
          (v as { state: string }).state,
        ]),
      );
    table(
      "Urutan probe",
      ["Nomor", "Kandidat", "Kontrol UI"],
      r.events
        .filter((e) => e.type === "PROBE_SELECTION")
        .map((e, i) => [
          i + 1,
          e.data.selected.candidate,
          e.data.selected.name,
        ]),
    );
  }
  paragraph(
    "Interpretasi dibatasi pada task terkontrol, model dan konfigurasi yang digunakan. Laporkan hasil nol/negatif serta pasangan yang tidak tersedia. Report ini menyediakan tabel dan bukti implementasi; pembahasan Bab 4 harus mengacu pada data main yang valid.",
  );
  return {
    markdown: parts.join(""),
    html: `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Laporan CUA</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#17212b;max-width:1100px;margin:40px auto;padding:0 24px}h1,h2{line-height:1.25}.banner{padding:16px;border:2px solid #976100;background:#fff4db;font-weight:700}.table{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px;margin:20px 0}td,th{text-align:left;padding:8px;border:1px solid #ccd3d9}th{background:#eef2f5}figure{margin:28px 0}img{max-width:100%;border:1px solid #ccd3d9}figcaption{font-size:13px;color:#465665}@media print{body{margin:0;font-size:11pt}.table{overflow:visible}figure{break-inside:avoid}h2{break-after:avoid}thead{display:table-header-group}}</style></head><body>${html.join("\n")}</body></html>`,
  };
}
export function writeReport(out: string) {
  const metrics = exportResults(out),
    experiment = readJson<Experiment>(join(out, "experiment.json")),
    rows = readLines<Row>(join(out, "episodes.jsonl"));
  const report = renderReport(experiment, rows, metrics);
  writeFileSync(join(out, "report.md"), report.markdown);
  writeFileSync(join(out, "report.html"), report.html);
  return { html: join(out, "report.html"), markdown: join(out, "report.md") };
}
