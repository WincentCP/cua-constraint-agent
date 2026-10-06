import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canonicalJson,
  makeFreeze,
  sha256,
  verifyFreeze,
} from "../src/experiment/freeze.ts";

test("research identity hashing is stable across object key order", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  assert.equal(sha256({ b: 2, a: 1 }), sha256({ a: 1, b: 2 }));
});

test("freeze rejects changed research identity", () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-freeze-"));
  try {
    const path = join(dir, "freeze.json");
    makeFreeze(path, { tasks: [284], models: ["a", "b", "c", "d"] });
    assert.doesNotThrow(() =>
      verifyFreeze(path, {
        models: ["a", "b", "c", "d"],
        tasks: [284],
      }),
    );
    assert.throws(
      () =>
        verifyFreeze(path, {
          tasks: [323],
          models: ["a", "b", "c", "d"],
        }),
      /differs/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
