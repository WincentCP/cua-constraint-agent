import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { panelNames, publicLine, visibleFields, type Task } from "./dataset.ts";
import {
  description,
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
  `<p class="fact${line.endsWith("belum dipublikasikan") ? " missing" : ""}">${esc(line)}</p>`;
export function render(world: World, url: string, fault?: Fault) {
  const u = new URL(url, "http://fixture"),
    t = world.task;
  let body = "",
    title = "Daftar produk";
  if (u.pathname === "/") {
    body = t.products
      .map(
        (p) =>
          `<section class="product-card" role="group" aria-label="${esc(p.name)}">${productVisual()}<p class="eyebrow">SNKRS / Pakaian</p><h2>${esc(p.name)}</h2><p class="description">${description}</p>${t.initial.length ? `<div class="facts">${t.initial.map((k) => fact(publicLine(p, k))).join("")}</div>` : ""}<a class="inspect-link" href="/product/${p.id}">Varian dan bahan ${esc(p.name)}</a></section>`,
      )
      .join("");
    body = `${hero()}<section id="koleksi" class="collection"><div class="collection-head"><h1>${title}</h1><p>3 pilihan dalam koleksi ini</p></div><div class="product-grid">${body}</div></section>`;
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
    body =
      `<div class="page cart-page"><h1>Keranjang</h1><p class="cart-count">Jumlah barang: ${cart.length}</p><div class="cart-layout"><div>` +
      cart
        .map(
          (item) =>
            `<section class="cart-item" role="group" aria-label="${esc(t.products.find((p) => p.id === item.product)!.name)}">${productVisual()}<div><p class="eyebrow">SNKRS / Pakaian</p><h2>${esc(t.products.find((p) => p.id === item.product)!.name)}</h2><p>Varian: ${esc(item.size)} / ${esc(item.color)}</p><p>Harga satuan: Rp${item.price.toLocaleString("id-ID")}</p><p>Jumlah: ${item.quantity}</p><a href="/product/${item.product}">Produk</a></div></section>`,
        )
        .join("") +
      (cart.length
        ? `</div><aside class="cart-summary" aria-label="Ringkasan keranjang"><h2>Ringkasan keranjang</h2><div class="summary-total"><span>Total</span><strong>Rp${cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString("id-ID")}</strong></div></aside></div></div>`
        : `<div class="empty-cart"><h2>Belum ada pilihanmu.</h2><p>Jelajahi koleksi dan buka rincian produk untuk menemukan pilihanmu.</p></div></div></div></div>`);
  } else {
    const p = t.products.find((p) => u.pathname === `/product/${p.id}`);
    if (!p) return null;
    const panel = u.searchParams.get("panel") ?? "detail";
    if (!(panel in panelNames)) return null;
    title = p.name;
    body = `<div class="page"><section class="product-layout" role="group" aria-label="${esc(p.name)}">${productVisual()}<div class="detail-copy"><p class="eyebrow">SNKRS / Pakaian</p><h1>${esc(p.name)}</h1><p class="description">${description}</p><div class="facts">${visibleFields(
      t,
      p,
      url,
    )
      .map((k) => fact(publicLine(p, k)))
      .join(
        "",
      )}</div><h2 class="panel-title">${esc(panelNames[panel])}</h2><nav class="panel-nav" aria-label="Informasi produk">${Object.entries(
      panelNames,
    )
      .filter(([key]) => key !== "detail")
      .map(
        ([key, label]) =>
          `<a href="/product/${p.id}?panel=${key}" ${key === panel ? 'aria-current="page"' : ""}>${label}</a>`,
      )
      .join(
        "",
      )}</nav><form class="add-form" method="post" action="/add/${p.id}"><button class="button">Tambah satu ke keranjang</button></form></div></section></div>`;
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
      res.writeHead(500).end("Environment error");
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
