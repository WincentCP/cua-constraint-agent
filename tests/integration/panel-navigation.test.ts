import test from "node:test";
import assert from "node:assert/strict";
import { openWorld } from "../../src/environment/world.ts";
import { openBrowser } from "../../src/browser/session.ts";
import {
  developmentTasks,
  visibleFields,
  publicLine,
} from "../../src/environment/dataset.ts";

test("Panel navigation commits public evidence and URL together; history, rapid clicks and fallback work", async () => {
  const task = developmentTasks.find((t) => t.unknown === 4)!;
  const product = task.products[0];
  const world = await openWorld(task);
  const driver = await openBrowser(
    world.origin,
    world.secret,
    () => {},
    () => assert.fail("external request"),
  );
  const page = driver.page,
    detail = `/product/${product.id}`;
  const settled = () =>
    page
      .locator('#product-information[aria-busy="true"]')
      .waitFor({ state: "detached" });
  const evidence = async (path: string) => {
    await settled();
    const observation = await driver.observe(0);
    assert.equal(observation.url, path);
    assert.deepEqual(
      observation.facts.map((f) => f.source).sort(),
      visibleFields(task, product, path)
        .map((k) => publicLine(product, k))
        .sort(),
    );
    assert.equal(
      observation.controls.filter((c) => c.kind === "probe").length,
      4,
    );
    assert.equal(await page.locator(".panel-nav [aria-current]").count(), 1);
  };
  let release = () => {};
  try {
    await page.goto(world.origin + detail);
    const originTime = await page.evaluate(() => performance.timeOrigin);
    assert.equal(
      world.world.requests.filter((p) => p.includes("?panel=")).length,
      0,
      "no prefetch",
    );
    await evidence(detail);
    let requested = () => {};
    const started = new Promise<void>((resolve) => {
      requested = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/*?panel=offer", async (route) => {
      requested();
      await hold;
      await route.continue().catch(() => {});
    });
    await page.getByRole("link", { name: "Harga & stok", exact: true }).click();
    await started;
    assert.equal(new URL(page.url()).search, "");
    assert.equal(
      await page.locator(".panel-content").isVisible(),
      false,
      "stale facts hidden while busy",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Tambah satu ke keranjang", exact: true })
        .isEnabled(),
      false,
    );
    // The later choice wins even if the first request finishes last.
    await page.getByRole("link", { name: "Stok", exact: true }).click();
    await evidence(detail + "?panel=stock");
    release();
    await page.unroute("**/*?panel=offer");
    assert.equal(await page.evaluate(() => performance.timeOrigin), originTime);
    await page.goBack();
    await evidence(detail);
    await page.goForward();
    await evidence(detail + "?panel=stock");
    assert.equal(await page.evaluate(() => performance.timeOrigin), originTime);
    assert.equal(
      await page
        .getByRole("button", { name: "Tambah satu ke keranjang", exact: true })
        .isEnabled(),
      true,
    );
    // The executor also waits for an asynchronous public panel transition.
    const observation = await driver.observe(1);
    await driver.click(
      observation.controls.find((c) => c.url === detail + "?panel=price")!,
      10000,
    );
    await evidence(detail + "?panel=price");
    await page.reload();
    await evidence(detail + "?panel=price");
    // A failed partial request falls back to a normal server-rendered document.
    await page.route("**/*?panel=offer", (route) =>
      route.request().resourceType() === "fetch"
        ? route.fulfill({ status: 503, body: "temporarily unavailable" })
        : route.continue(),
    );
    await page.getByRole("link", { name: "Harga & stok", exact: true }).click();
    await page.waitForURL(world.origin + detail + "?panel=offer");
    await page.waitForLoadState("load");
    await evidence(detail + "?panel=offer");
    await page.unroute("**/*?panel=offer");
    // Script unavailable: the same links still work as direct navigation.
    await page.route("**/assets/storefront.js", (route) => route.abort());
    await page.reload();
    await page.getByRole("link", { name: "Bahan", exact: true }).click();
    await evidence(detail + "?panel=material");
  } finally {
    release();
    await page.context().unrouteAll({ behavior: "ignoreErrors" });
    await driver.close();
    await world.close();
  }
});
