import { readFileSync } from "node:fs";

// Visual adaptation of WincentCP/designskripsi, pinned in docs/FRONTEND-INTEGRATION.md.
// Only public text is passed into these presentation helpers.
export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export const description =
  "Bagian dari koleksi harian SNKRS. Padukan dengan gaya pilihanmu.";
export const productVisual = () =>
  `<figure class="product-visual"><img src="/assets/collection.png" width="1254" height="1254" alt="Ilustrasi koleksi kaos" /><figcaption>Ilustrasi koleksi. Rincian varian ada di informasi produk.</figcaption></figure>`;

export function hero() {
  return `<section class="hero" aria-labelledby="campaign-heading">
    <div class="hero-copy"><p class="eyebrow">Koleksi terbaru · 2026</p>
      <h2 id="campaign-heading">Gaya jalanan.<br><span>Versi kamu.</span></h2>
      <p class="hero-description">Dari sneaker favorit sampai kaos harian. Temukan pilihan untuk melengkapi gayamu.</p>
      <a class="button" href="#koleksi">Jelajahi koleksi</a>
    </div>
    <div class="hero-art"><img src="/assets/hero.jpg" width="900" height="900" alt="Visual kampanye sneaker SNKRS" /><span class="campaign-label">SNKRS / Koleksi 2026</span></div>
  </section><div class="brand-strip" aria-hidden="true"><span>SNKRS</span><span>Gaya harian</span><span>Koleksi 2026</span><span>SNKRS</span><span>Gaya harian</span><span>Koleksi 2026</span></div>`;
}

export function documentPage(title: string, body: string, home: boolean) {
  // Navigation lives in main because the existing driver scopes global controls there.
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} | SNKRS</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/assets/storefront.css"></head><body>
    <a class="skip-link" href="#konten">Lewati navigasi</a><main>
    <header class="site-header"><span class="wordmark">SNKRS</span><nav aria-label="Navigasi utama"><span class="nav-current">Pakaian</span>${!home ? '<a href="/">Kembali ke daftar</a>' : ""}<a class="cart-link" href="/cart">Buka keranjang</a></nav></header>
    <div id="konten">${body}</div></main>
    <footer class="site-footer"><span class="wordmark">SNKRS</span><span>Gaya pilihanmu, setiap hari.</span><span>© 2026 SNKRS</span></footer></body></html>`;
}

const assetTypes: Record<string, string> = {
  "storefront.css": "text/css; charset=utf-8",
  "collection.png": "image/png",
  "campaign.png": "image/png",
  "hero.jpg": "image/jpeg",
  "display.ttf": "font/ttf",
  "body.ttf": "font/ttf",
  "body-semibold.ttf": "font/ttf",
};
// No directory traversal or server-side fixture files can be requested as assets.
const assets = new Map(
  Object.entries(assetTypes).map(([name, type]) => [
    `/assets/${name}`,
    { type, body: readFileSync(new URL(`./assets/${name}`, import.meta.url)) },
  ]),
);
export function publicAsset(path: string) {
  return assets.get(path);
}
