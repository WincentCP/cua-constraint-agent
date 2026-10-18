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


test("OpenApps nonmodal dialog[open] blocks background, even without showModal()", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-nonmodal-"));
  const session = await openInspectionSession({ harPath: join(dir, "network.har") });
  try {
    await session.page.setContent([
      '<button>Return to List of Apps</button>',
      '<dialog open class="ob-dialog" aria-label="Open account">',
      '  <p>Bank contact information</p>',
      '  <button onclick="document.querySelector(\'dialog\').close()">Close</button>',
      '</dialog>',
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
    assert(!controls.some(c => c.name === "Return to List of Apps"));
    const close = probesFromControls(controls, []).find(p => p.label === "Close");
    assert(close);
    await performProbe(session.page, close, undefined, surface.locator);
    assert.equal(await session.page.locator("dialog[open]").count(), 0);
    assert.equal((await observeInteractiveSurface(session.page)).scope, "page");
  } finally {
    await session.close();
    rmSync(dir, {recursive:true,force:true});
  }
});

test("agent reobserves if modal appears during model planning rather than clicking background", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-modal-race-"));
  const session = await openInspectionSession({ harPath: join(dir, "network.har") });
  try {
    await session.page.setContent([
      '<button>Return to List of Apps</button>',
      '<dialog class="ob-dialog" aria-label="Open account">',
      '  <button onclick="document.querySelector(\'dialog\').close()">Close</button>',
      '</dialog>',
    ].join(""));
    const { runDevelopmentLoop } = await import("../../src/openapps/runner.ts");
    const events: Record<string, unknown>[] = [];
    const model = {
      async complete(_system: string, user: string) {
        const input = JSON.parse(user) as {candidate_probes: Array<{id:string;label:string}>};
        const response = (id: string | null, finish: boolean) => JSON.stringify({
          progress_scores: id ? { [id]: 10 } : {}, input_text_by_probe: {},
          evidence: [], finish, rationale: "Synthetic modal-race test only",
        });
        if (events.filter(e => e.event === "SURFACE_CHANGED").length === 0) {
          await session.page.locator("dialog").evaluate(el => el.setAttribute("open", ""));
          return response(input.candidate_probes.find(p=>p.label==="Return to List of Apps")?.id ?? null, false);
        }
        const close = input.candidate_probes.find(p=>p.label==="Close");
        return response(close?.id ?? null, !close);
      },
    };
    const stats = await runDevelopmentLoop({
      page: session.page, model, policy: "Baseline", goal: "Close the dialog",
      constraints: [], budget: 4,
      record: e => events.push(e), saveSnapshot() {},
    });
    assert.equal(stats.actions, 1);
    assert.equal(stats.modelFinished, true);
    assert(events.some(e => e.event === "SURFACE_CHANGED"));
    assert.equal(await session.page.locator("dialog[open]").count(), 0);
    assert(!events.some(e => e.event === "ACTION_ERROR"));
  } finally {
    await session.close();
    rmSync(dir, {recursive:true,force:true});
  }
});


test("OpenBanking account rows with hx-get become publicly visible clickable probes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-bank-rows-"));
  const session = await openInspectionSession({ harPath: join(dir, "network.har") });
  try {
    await session.page.setContent([
      '<div id="bank">',
      '  <button>Open an account</button>',
      '  <div id="account-1" hx-get="/openbanking/accounts/1" ',
      '       onclick="document.getElementById(\'detail\').textContent=\'Transactions for BUS COMPLETE CHK\'">',
      '    <div>BUS COMPLETE CHK (...5555)</div>',
      '    <div>Acme Industries, Inc</div>',
      '    <div>$6,102.80 Available balance</div>',
      '  </div>',
      '  <div id="account-2" hx-get="/openbanking/accounts/2">BUS SELECT SAVINGS (...8891)</div>',
      '  <div hx-get="/invisible" style="display:none">Hidden account</div>',
      '  <div id="detail"></div>',
      '</div>',
    ].join(""));
    const { extractVisibleClickables, extractControls, probesFromControls } = await import(
      "../../src/browser/accessibility.ts"
    );
    const { observeInteractiveSurface, performProbe } = await import(
      "../../src/openapps/runner.ts"
    );
    const surface = await observeInteractiveSurface(session.page);
    const semantic = extractControls(surface.snapshot);
    const appended = await extractVisibleClickables(surface.locator);
    assert.equal(appended.length, 2);
    assert(!appended.some(c => c.name.includes("Hidden account")));
    assert(appended.some(c => c.role === "clickable" &&
      c.name.includes("BUS COMPLETE CHK")));
    const probes = probesFromControls([...semantic, ...appended], [{
      id:"account",description:"Inspect business checking account",
      hints:["chk"],required:true,
    }]);
    const bank = probes.find(p=>p.control.role === "clickable" &&
      p.label.includes("BUS COMPLETE CHK"));
    assert(bank);
    assert(bank.may_answer.includes("account"));
    await performProbe(session.page, bank, undefined, surface.locator);
    assert.match(await session.page.locator("#detail").innerText(), /Transactions for BUS COMPLETE CHK/);
  } finally {
    await session.close();
    rmSync(dir, {recursive:true,force:true});
  }
});


test("self-reported completion without a todo submission is blocked for both methods", async () => {
  const { runDevelopmentLoop } = await import("../../src/openapps/runner.ts");
  const { requirePocTask } = await import("../../src/openapps/manifest.ts");
  for (const policy of ["Baseline", "Proposed"] as const) {
    const dir = mkdtempSync(join(tmpdir(), "cua-finish-guard-"));
    const session = await openInspectionSession({harPath:join(dir,"network.har")});
    try {
      await session.page.setContent('<main><p>Account: BUS COMPLETE CHK. Card charge 1078.81</p><button>Continue</button></main>');
      const events: Record<string,unknown>[]=[];
      const model={async complete(_system:string, _user:string) {
        return JSON.stringify({progress_scores:{},input_text_by_probe:{},
          evidence:[],finish:true,rationale:"I created the todo"});
      }};
      const stats=await runDevelopmentLoop({
        page:session.page,model,policy,goal:"Create a todo from a bank charge",
        constraints:requirePocTask("add_todo_to_review_largest_card_charge").constraints,
        budget:2, record:e=>events.push(e),saveSnapshot() {},
      });
      assert.equal(stats.actions,0);
      assert.equal(stats.modelFinished,false);
      assert.equal(events.filter(e=>e.event==="MODEL_FINISH_BLOCKED").length,2);
      assert(!events.some(e=>e.event==="MODEL_FINISH"));
    } finally {
      await session.close();
      rmSync(dir,{recursive:true,force:true});
    }
  }
});


test("HTMX churn during nonsemantic click discovery never waits on stale nth locators", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-htmx-churn-"));
  const session = await openInspectionSession({harPath:join(dir,"network.har")});
  try {
    await session.page.setContent([
      '<div id="mount">',
      '<div hx-get="/openbanking/accounts/1">BUS COMPLETE CHK (...5555)</div>',
      '</div>',
      '<script>',
      'let flip = false;',
      'setInterval(() => {',
      '  flip = !flip;',
      '  document.getElementById("mount").innerHTML = flip',
      '   ? \'<div hx-get="/openbanking/accounts/2">BUS SELECT SAVINGS (...8891)</div>\'',
      '   : \'<div hx-get="/openbanking/accounts/1">BUS COMPLETE CHK (...5555)</div>\';',
      '}, 4);',
      '</script>',
    ].join(""));
    const { extractVisibleClickables } = await import("../../src/browser/accessibility.ts");
    const start = Date.now();
    for (let i = 0; i < 15; i++) {
      const controls = await extractVisibleClickables(session.page.locator("body"));
      assert(controls.length <= 1);
      for (const control of controls) {
        assert(control.name.includes("BUS COMPLETE CHK") ||
          control.name.includes("BUS SELECT SAVINGS"));
        assert.equal(control.domIndex, 0);
      }
    }
    assert(Date.now() - start < 2000,
      "Atomic visible-control sampling must not stall on replaced HTMX rows");
  } finally {
    await session.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
