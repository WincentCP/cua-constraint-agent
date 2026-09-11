import test from "node:test";
import assert from "node:assert/strict";
import { openWorld, render, type World } from "../../src/environment/world.ts";
import { openBrowser } from "../../src/browser/session.ts";
import {
  developmentTasks,
  panelFields,
  visibleFields,
  publicLine,
} from "../../src/environment/dataset.ts";

test("Brand presentation does not reveal private fields on catalog or information panels", () => {
  for (const task of developmentTasks) {
    const w: World = {
      task: structuredClone(task),
      cart: [],
      forbidden_effect: false,
      closed: false,
      requests: [],
    };
    const p = w.task.products[0];
    for (const url of [
      "/",
      ...Object.keys(panelFields).map((k) => `/product/${p.id}?panel=${k}`),
    ]) {
      const original = render(w, url);
      const allowed = url === "/" ? task.initial : visibleFields(task, p, url);
      const changed = structuredClone(w),
        product = changed.task.products[0];
      if (!allowed.includes("material")) product.material = "PRIVATE_MATERIAL";
      if (!allowed.includes("price")) product.price = 987654321;
      if (!allowed.includes("availability"))
        product.available = !product.available;
      // Offer facts intentionally contain their public variant scope.
      if (
        !allowed.some((k) => ["variant", "price", "availability"].includes(k))
      ) {
        product.size = "PRIVATE_SIZE";
        product.color = "PRIVATE_COLOR";
      }
      assert.equal(render(changed, url), original, `${task.id} ${url}`);
    }
  }
});

test("SNKRS renders offline, exposes exact panel evidence and stays usable at desktop/mobile widths", async () => {
  const task = developmentTasks.find((t) => t.unknown === 4)!;
  const world = await openWorld(task);
  let external = 0;
  const driver = await openBrowser(
    world.origin,
    world.secret,
    () => {},
    () => {
      external++;
    },
  );
  try {
    const page = driver.page;
    const initial = await driver.observe(0);
    assert.equal(initial.candidates.length, 3);
    assert.equal(initial.facts.length, 0);
    assert.equal(await page.locator("html").getAttribute("lang"), "id");
    await page.evaluate(() => document.fonts.ready);
    assert(
      await page.evaluate(() =>
        document.fonts.check('900 20px "SNKRS Display"'),
      ),
    );
    assert(
      await page.evaluate(() =>
        Array.from(document.images).every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      ),
    );
    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    const p = task.products[0];
    for (const key of Object.keys(panelFields)) {
      await page.goto(`${world.origin}/product/${p.id}?panel=${key}`);
      const o = await driver.observe(1);
      assert.deepEqual(
        o.facts.map((f) => f.source).sort(),
        visibleFields(task, p, o.url)
          .map((k) => publicLine(p, k))
          .sort(),
      );
      assert.equal(o.controls.filter((c) => c.kind === "probe").length, 4);
      assert.equal(o.controls.filter((c) => c.kind === "act").length, 1);
      assert.equal(
        await page
          .getByRole("button", {
            name: "Tambah satu ke keranjang",
            exact: true,
          })
          .isEnabled(),
        true,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    await page.goto(`${world.origin}/cart`);
    assert((await driver.observe(2)).snapshot.includes("Jumlah barang: 0"));
    const rejected = await page.request.post(
      `${world.origin}/add/not-a-product`,
    );
    assert.equal(rejected.status(), 409);
    assert((await rejected.text()).includes("Produk belum dapat ditambahkan."));
    const forbiddenAsset = await page.request.get(
      `${world.origin}/assets/dataset.ts`,
    );
    assert.equal(forbiddenAsset.status(), 404);
    assert.equal(external, 0);
  } finally {
    await driver.close();
    await world.close();
  }
});
