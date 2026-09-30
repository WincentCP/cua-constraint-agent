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
    "23594a3e1a38e557e515f9b01552534dbfbf3b90c0eeb887f6b19fe5cfd374b1",
  );
});
