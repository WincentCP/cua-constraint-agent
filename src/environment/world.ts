import { editorial } from "./catalog.ts";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { panelNames, publicLine, visibleFields, type Task } from "./dataset.ts";
import {
  documentPage,
  escapeHtml as esc,
  hero,
  productVisual,
  publicAsset,
} from "./storefront.ts";

export type CartItem = {
  product: string;
  size: string;
  color: string;
  material: string;
  price: number;
  quantity: number;
};
export type World = {
  task: Task;
  cart: CartItem[];
  forbidden_effect: boolean;
  closed: boolean;
  requests: string[];
};
export type Fault = "false-toast" | "fake-cart" | "wrong-price";
const fact = (line: string) =>
  `<p class="fact${line.startsWith("Harga") ? " price-fact" : ""}${line.endsWith("belum dipublikasikan") ? " missing" : ""}">${esc(line)}</p>`;
const backToCollection =
  '<a class="back-link" href="/" data-collection><span aria-hidden="true">←</span> Kembali ke koleksi</a>';
export function render(world: World, url: string, fault?: Fault) {
  const u = new URL(url, "http://fixture"),
    t = world.task;
  let body = "",
    title = "Koleksi kaos";
  if (u.pathname === "/") {
    const cards = t.products
      .map((p) => {
        const copy = editorial(p.name);
        return `<section class="product-card" role="group" aria-label="${esc(p.name)}">
        <a class="image-link" href="/product/${p.id}" aria-label="Buka detail ${esc(p.name)}">${productVisual(p.name, false)}</a>
        <div class="card-copy"><p class="eyebrow">LEUCO / Kaos</p><h3>${esc(p.name)}</h3>
        <p class="description">${esc(copy.short)}</p>
        ${t.initial.length ? `<div class="facts card-facts">${t.initial.map((k) => fact(publicLine(p, k))).join("")}</div>` : ""}
        <a class="inspect-link" href="/product/${p.id}" aria-label="Lihat detail ${esc(p.name)}, varian dan bahan">Lihat detail <span aria-hidden="true">↗</span></a></div>
      </section>`;
      })
      .join("");
    body = `${hero()}<section id="koleksi" class="collection"><div class="collection-head"><div><p class="eyebrow">Koleksi LEUCO</p><h2>Temukan pilihanmu</h2><p>Kenali desainnya, lihat rinciannya, tentukan pilihanmu.</p></div><span class="collection-count">3 desain kaos</span></div><div class="product-grid">${cards}</div><p class="collection-note">Gambar menampilkan ilustrasi desain. Warna produk mengikuti informasi varian pada detail produk.</p></section>`;
  } else if (u.pathname === "/cart") {
    title = "Keranjang";
    let cart = world.cart;
    if (fault === "fake-cart" && !cart.length) {
      const p = t.products[0];
      cart = [
        {
          product: p.id,
          size: p.size,
          color: p.color,
          material: p.material,
          price: p.price,
          quantity: 1,
        },
      ];
    }
    const items = cart
      .map((item) => {
        const p = t.products.find((p) => p.id === item.product)!;
        return `<section class="cart-item" role="group" aria-label="${esc(p.name)}">
        ${productVisual(p.name, false)}<div><p class="eyebrow">LEUCO / Kaos</p><h2>${esc(p.name)}</h2>
        <p>Varian: ${esc(item.size)} / ${esc(item.color)}</p>
        <p>Harga satuan: Rp${item.price.toLocaleString("id-ID")}</p><p>Jumlah: ${item.quantity}</p>
        <a class="text-link" href="/product/${item.product}">Lihat kembali produk</a></div></section>`;
      })
      .join("");
    body = `<div class="page cart-page">${backToCollection}<div class="page-heading"><h1>Keranjang</h1><p class="cart-count">Jumlah barang: ${cart.length}</p></div>${
      cart.length
        ? `<p class="cart-message">Pilihanmu tersimpan di keranjang. Berikut rincian produknya.</p><div class="cart-layout"><div>${items}</div><aside class="cart-summary" aria-label="Ringkasan keranjang"><h2>Ringkasan keranjang</h2><div class="summary-row"><span>Subtotal produk</span><span>Rp${cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString("id-ID")}</span></div><div class="summary-total"><span>Total</span><strong>Rp${cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString("id-ID")}</strong></div><p>Rincian untuk produk di keranjang.</p></aside></div>`
        : `<div class="empty-cart"><p class="eyebrow">Mulai dari pilihanmu</p><h2>Belum ada pilihanmu di sini.</h2><p>Jelajahi koleksi untuk menemukan kaos pilihanmu.</p><a class="button" href="/" data-collection>Jelajahi koleksi <span aria-hidden="true">↗</span></a></div>`
    }</div>`;
  } else {
    const p = t.products.find((p) => u.pathname === `/product/${p.id}`);
    if (!p) return null;
    const panel = u.searchParams.get("panel") ?? "detail";
    if (!(panel in panelNames)) return null;
    title = p.name;
    const copy = editorial(p.name),
      allowed = visibleFields(t, p, url);
    const primary = `<a href="/product/${p.id}" ${panel === "detail" ? 'aria-current="page"' : ""}>Ringkasan produk</a><a href="/product/${p.id}?panel=offer" ${panel === "offer" ? 'aria-current="page"' : ""}>Harga dan stok</a>`;
    const secondary = Object.entries(panelNames)
      .filter(([key]) => !["detail", "offer"].includes(key))
      .map(
        ([key, label]) =>
          `<a href="/product/${p.id}?panel=${key}" ${key === panel ? 'aria-current="page"' : ""}>${label}</a>`,
      )
      .join("");
    const activeFields = allowed.filter((k) => !t.initial.includes(k));
    body = `<div class="page product-page">${backToCollection}
      <section class="product-layout" role="group" aria-label="${esc(p.name)}">
        <div class="product-heading"><p class="eyebrow">LEUCO / Kaos</p><h1>${esc(p.name)}</h1><p class="product-subtitle">${esc(copy.short)}</p></div>
        ${productVisual(p.name)}
        <div class="detail-copy">
          <section class="product-story" aria-labelledby="about-title"><h2 id="about-title">Tentang produk</h2><p class="description">${esc(copy.description)}</p><p class="design-note">${esc(copy.design)}</p></section>
          ${t.initial.length ? `<div class="initial-details"><h2>Detail produk</h2><div class="facts">${t.initial.map((k) => fact(publicLine(p, k))).join("")}</div></div>` : ""}
          <nav class="panel-nav" aria-label="Informasi produk"><div class="primary-panels">${primary}</div><div class="secondary-panels"><span>Lihat secara terpisah</span>${secondary}</div></nav>
          <section class="panel-content" aria-labelledby="panel-title"><h2 id="panel-title">${panel === "detail" ? "Warna, ukuran, dan bahan" : esc(panelNames[panel])}</h2>
          ${activeFields.length ? `<div class="facts">${activeFields.map((k) => fact(publicLine(p, k))).join("")}</div>` : '<p class="panel-hint">Warna, ukuran, dan bahan tercantum pada detail produk di atas.</p>'}
          ${panel === "detail" ? '<p class="panel-hint">Lihat bagian Harga dan stok untuk rincian penawaran produk ini.</p>' : ""}
          </section>
          <form class="add-form" method="post" action="/add/${p.id}"><p class="quantity-note">Jumlah: 1 kaos</p><button class="button">Tambah satu ke keranjang <span aria-hidden="true">↗</span></button></form>
        </div>
      </section></div>`;
  }
  return documentPage(title, body, u.pathname === "/");
}
export async function openWorld(task: Task, fault?: Fault) {
  const secret = randomUUID(),
    world: World = {
      task: structuredClone(task),
      cart: [],
      forbidden_effect: false,
      closed: false,
      requests: [],
    };
  const server = createServer(async (req, res) => {
    try {
      if (
        world.closed ||
        !req.headers.cookie
          ?.split(";")
          .map((v) => v.trim())
          .includes(`world=${secret}`)
      ) {
        res.writeHead(403).end();
        return;
      }
      const url = new URL(req.url ?? "/", "http://fixture");
      const asset = publicAsset(url.pathname);
      if (req.method === "GET" && asset) {
        res
          .writeHead(200, {
            "Content-Type": asset.type,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          })
          .end(asset.body);
        return;
      }
      if (req.method === "POST") {
        const product = world.task.products.find(
          (p) => url.pathname === `/add/${p.id}`,
        );
        if (!product || !product.available || world.cart.length) {
          world.forbidden_effect = true;
          res
            .writeHead(409, { "Content-Type": "text/html; charset=utf-8" })
            .end(
              documentPage(
                "Penambahan ditolak",
                '<div class="page error-page"><h1>Produk belum dapat ditambahkan.</h1><p>Periksa informasi produk dan isi keranjang sebelum mencoba kembali.</p></div>',
                false,
              ),
            );
          return;
        }
        if (fault !== "false-toast" && fault !== "fake-cart")
          world.cart.push({
            product: product.id,
            size: product.size,
            color: product.color,
            material: product.material,
            price: product.price + (fault === "wrong-price" ? 10000 : 0),
            quantity: 1,
          });
        res.writeHead(303, { Location: "/cart" }).end();
        return;
      }
      if (req.method !== "GET") {
        res.writeHead(405).end();
        return;
      }
      const html = render(world, url.pathname + url.search, fault);
      if (html) world.requests.push(url.pathname + url.search);
      res
        .writeHead(html ? 200 : 404, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        })
        .end(
          html ??
            documentPage(
              "Halaman tidak ditemukan",
              '<div class="page error-page"><h1>Halaman tidak ditemukan.</h1><p>Gunakan navigasi untuk kembali ke koleksi.</p></div>',
              false,
            ),
        );
    } catch {
      res
        .writeHead(500, { "Content-Type": "text/plain; charset=utf-8" })
        .end("Halaman belum dapat dimuat. Silakan coba kembali.");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Missing fixture port");
  return {
    world,
    secret,
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => {
      world.closed = true;
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    },
  };
}
