import { readFileSync } from "node:fs";
import { editorial } from "./catalog.ts";

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export function productVisual(name: string, caption = true) {
  const product = editorial(name);
  return `<figure class="product-visual"><img src="/assets/${product.image}" width="1254" height="1254" alt="Ilustrasi desain ${escapeHtml(name)}" />${caption ? "<figcaption>Ilustrasi desain. Warna mengikuti rincian varian produk.</figcaption>" : ""}</figure>`;
}

export function hero() {
  return `<section class="hero" aria-labelledby="campaign-heading">
    <div class="hero-copy"><p class="eyebrow">Koleksi kaos · 2026</p>
      <h1 id="campaign-heading">Gaya harian.<br><span>Pilihan personal.</span></h1>
      <p class="hero-description">Tiga karakter, banyak cara memadukan. Temukan kaos yang terasa paling kamu.</p>
      <a class="button" href="#koleksi">Jelajahi koleksi <span aria-hidden="true">↗</span></a>
    </div>
    <div class="hero-art"><img src="/assets/studio-edition.png" width="1254" height="1254" alt="Ilustrasi kaos Studio Edition dengan grafis tipografi LEUCO" /><span class="campaign-label">LEUCO / Studio Edition</span><span class="art-note">Ilustrasi desain koleksi</span></div>
  </section><div class="brand-strip" aria-hidden="true"><span>LEUCO</span><span>Gaya harian</span><span>Pilihan personal</span><span>LEUCO</span><span>Gaya harian</span><span>Pilihan personal</span></div>`;
}

export function documentPage(title: string, body: string, home: boolean) {
  // Navigation remains in main to preserve the driver's global-control scope.
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} | LEUCO</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/assets/storefront.css"><script src="/assets/storefront.js" defer></script></head><body>
    <a class="skip-link" href="#konten">Lewati navigasi</a><main>
    <header class="site-header"><a class="wordmark" href="/" aria-label="LEUCO, beranda">LEUCO</a><nav aria-label="Navigasi utama"><a href="/" data-collection ${home ? 'aria-current="page"' : ""}>Koleksi kaos</a><a class="cart-link" href="/cart" ${title === "Keranjang" ? 'aria-current="page"' : ""}>Keranjang</a></nav></header>
    <div id="konten">${body}</div></main>
    <footer class="site-footer"><span class="wordmark">LEUCO</span><span>Pilihan personal untuk setiap hari.</span><span>© 2026 LEUCO</span></footer></body></html>`;
}

const assetTypes: Record<string, string> = {
  "storefront.css": "text/css; charset=utf-8",
  "storefront.js": "text/javascript; charset=utf-8",
  "collection.png": "image/png",
  "after-hours.png": "image/png",
  "studio-edition.png": "image/png",
  "display.ttf": "font/ttf",
  "body.ttf": "font/ttf",
  "body-semibold.ttf": "font/ttf",
};
// Assets are public, local and explicitly allowlisted. No fixture data is served.
const assets = new Map(
  Object.entries(assetTypes).map(([name, type]) => [
    `/assets/${name}`,
    { type, body: readFileSync(new URL(`./assets/${name}`, import.meta.url)) },
  ]),
);
export function publicAsset(path: string) {
  return assets.get(path);
}
