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


test("OpenApps-style native dialog hides background controls from both policies", async () => {
  const session = await openInspectionSession({
    harPath: join(mkdtempSync(join(tmpdir(), "cua-modal-")), "network.har"),
    headless: true,
  });
  try {
    await session.page.setContent([
      '<button id="back">Return to List of Apps</button>',
      '<dialog aria-label="Open account">',
      '  <p>Contact the bank</p>',
      '  <button onclick="document.querySelector(\'dialog\').close()">Close</button>',
      '</dialog>',
      '<script>document.querySelector("dialog").showModal()</script>',
    ].join(""));
    const { observeInteractiveSurface, performProbe } = await import(
      "../../src/openapps/runner.ts"
    );
    const { extractControls, probesFromControls } = await import(
      "../../src/browser/accessibility.ts"
    );
    const surface = await observeInteractiveSurface(session.page);
    assert.equal(surface.scope, "dialog");
    const controls = extractControls(surface.snapshot);
    assert(controls.some(c => c.role === "button" && c.name === "Close"));
    assert(!controls.some(c => c.name === "Return to List of Apps"));
    const probes = probesFromControls(controls, []);
    const close = probes.find(p => p.label === "Close");
    assert(close);
    await performProbe(session.page, close, undefined, surface.locator);
    assert.equal(await session.page.getByRole("dialog").count(), 0);
    const next = await observeInteractiveSurface(session.page);
    assert.equal(next.scope, "page");
    assert(extractControls(next.snapshot).some(c => c.name === "Return to List of Apps"));
  } finally {
    await session.close();
  }
});
