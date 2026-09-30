import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { developmentTasks, mainTasks } from "../src/environment/dataset.ts";

test("Final audited research fixtures stay deterministic apart from public names", () => {
  const tasks = [...developmentTasks, ...mainTasks].map((t) => ({
    ...t,
    products: t.products.map(({ name: _name, ...product }) => product),
  }));
  // Captured after the final 2026-09-30 methodological audit (balanced hidden patterns and diversified missing evidence).
  assert.equal(
    createHash("sha256").update(JSON.stringify(tasks)).digest("hex"),
    "0b7f924afecb1fb270d49f48e60a40d9263abdff56b5219da4a6df367a5c1e0d",
  );
});
