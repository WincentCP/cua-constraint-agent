import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { developmentTasks, mainTasks } from "../src/environment/dataset.ts";

test("LEUCO branding preserves the pre-revision research fixtures except names", () => {
  const tasks = [...developmentTasks, ...mainTasks].map((t) => ({
    ...t,
    products: t.products.map(({ name: _name, ...product }) => product),
  }));
  // Captured from the clean 1b1ba57 fixtures before the storefront revision.
  assert.equal(
    createHash("sha256").update(JSON.stringify(tasks)).digest("hex"),
    "de54e9d7c0d39baace93dbe428fb4dace1b3d04dcb4aee156923b433de13e20e",
  );
});
