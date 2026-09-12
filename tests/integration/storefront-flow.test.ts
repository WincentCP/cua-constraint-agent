import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { openWorld } from "../../src/environment/world.ts";
import { openBrowser, verifyCart } from "../../src/browser/session.ts";
import {
  developmentTasks,
  feasibleProducts,
} from "../../src/environment/dataset.ts";

test("LEUCO shopping flow: card, information, return, cart and rejected second item", async () => {
  const output = join(process.cwd(), "exports", "leuco-ui-review");
  mkdirSync(output, { recursive: true });
  for (const width of [1280, 390]) {
    const task = developmentTasks.find(
      (t) => t.unknown === 4 && t.type === "solvable",
    )!;
    const product = feasibleProducts(task)[0];
    const world = await openWorld(task);
    const driver = await openBrowser(
      world.origin,
      world.secret,
      () => {},
      () => assert.fail("External request"),
    );
    const page = driver.page;
    const capture = async (name: string) => {
      await page.evaluate(() => document.fonts.ready);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.doesNotMatch(
        await page.locator("body").innerText(),
        /SNKRS|sneaker|sepatu|footwear|basketball|air jordan|dunks|yeezy|checkout/i,
      );
      await page.screenshot({
        path: join(output, `${width}-${name}.png`),
        fullPage: true,
      });
    };
    try {
      await page.setViewportSize({ width, height: 900 });
      await driver.observe(0);
      await capture("collection");
      const names = await page.getByRole("group").allTextContents();
      assert.equal(names.length, 3);
      assert.equal(
        new Set(
          await page
            .getByRole("group")
            .getByRole("img")
            .evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src"))),
        ).size,
        3,
      );
      // A click on the photograph reaches the same single, named card link.
      await page
        .getByRole("link", { name: `Buka detail ${product.name}`, exact: true })
        .click();
      assert.equal(new URL(page.url()).pathname, `/product/${product.id}`);
      await page
        .locator('#product-information[aria-busy="true"]')
        .waitFor({ state: "detached" });
      assert.equal(
        await page.getByRole("heading", { level: 1 }).innerText(),
        product.name,
      );
      await capture("detail");
      const documentStarted = await page.evaluate(() => performance.timeOrigin);
      await page
        .getByRole("link", { name: "Harga & stok", exact: true })
        .click();
      await page
        .locator('#product-information[aria-busy="true"]')
        .waitFor({ state: "detached" });
      assert.equal(
        await page
          .getByRole("link", { name: "Harga & stok", exact: true })
          .getAttribute("aria-current"),
        "page",
      );
      assert.equal(
        await page.evaluate(() => performance.timeOrigin),
        documentStarted,
      );
      await capture("offer");
      await page.getByRole("link", { name: "Ringkasan", exact: true }).click();
      await page
        .locator('#product-information[aria-busy="true"]')
        .waitFor({ state: "detached" });
      assert.equal(new URL(page.url()).search, "");
      await page
        .getByRole("link", { name: "Kembali ke koleksi", exact: true })
        .click();
      await page.waitForURL(`${world.origin}/#koleksi`);
      assert(await page.evaluate(() => scrollY > 100));
      await page.getByRole("link", { name: "Keranjang", exact: true }).click();
      assert.match(
        await page.locator("body").innerText(),
        /Belum ada pilihanmu di sini/,
      );
      await capture("empty-cart");
      // Keyboard activation works with the same collection return.
      await page
        .getByRole("link", { name: "Jelajahi koleksi", exact: true })
        .press("Enter");
      await page.waitForURL(`${world.origin}/#koleksi`);
      await page
        .getByRole("link", {
          name: `Lihat detail ${product.name}, varian dan bahan`,
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Tambah satu ke keranjang", exact: true })
        .click();
      assert(
        verifyCart(
          await driver.observe(1),
          product.id,
          product.size,
          product.color,
          product.price,
        ),
      );
      await capture("cart");
      await page.reload();
      assert.equal(
        world.world.cart.length,
        1,
        "GET refresh must not duplicate a cart item",
      );
      await page
        .getByRole("link", { name: "Lihat kembali produk", exact: true })
        .click();
      const response = page.waitForResponse(
        (r) => r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Tambah satu ke keranjang", exact: true })
        .click();
      assert.equal((await response).status(), 409);
      assert.equal(world.world.cart.length, 1);
      await capture("rejected-add");
    } finally {
      await driver.close();
      await world.close();
    }
  }
});
