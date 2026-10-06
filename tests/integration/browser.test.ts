import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openInspectionSession } from "../../src/browser/session.ts";

test("Playwright inspection captures an accessibility snapshot and flushes HAR", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-browser-"));
  const harPath = join(dir, "network.har");
  const session = await openInspectionSession({ harPath, headless: true });
  try {
    await session.goto(
      "data:text/html,<main><a href='https://example.invalid/x'>Shoe storage</a><button>Sort by price</button></main>",
    );
    const snapshot = await session.capture();
    assert(snapshot.accessibility.includes("Shoe storage"));
    assert(snapshot.controls.some((control) => control.role === "link"));
    assert(snapshot.controls.some((control) => control.role === "button"));
  } finally {
    await session.close();
  }
  assert(existsSync(harPath));
  assert(statSync(harPath).size > 0);
  rmSync(dir, { recursive: true, force: true });
});
