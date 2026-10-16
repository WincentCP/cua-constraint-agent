import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  generateScreening, inspectScreening, requireApprovedScreening, writeScreeningDraft,
  stageTasks, type ScreeningStage, type ScreeningReview,
} from "../src/experiment/screening.ts";
import { requireMainFreeze } from "../src/experiment/main-freeze.ts";

function runInTemporary<T>(body:(dir:string)=>T) {
  const dir = mkdtempSync(join(tmpdir(), "cua-screening-"));
  try { return body(dir); }
  finally { rmSync(dir, { recursive:true, force:true }); }
}

function syntheticPublicCatalog(stage: ScreeningStage) {
  // Public-task metadata fixture only; no evaluator answers or private data.
  return stageTasks(stage).map((task) => ({
    task_id: task.task_id,
    intent_template_id: task.intent_template_id,
    sites: ["shopping"],
    start_urls: ["http://localhost:7770"],
    intent: task.public_intent,
  }));
}

test("screening drafts are PENDING, stage-exact, and cannot overwrite review work", () => {
  for (const [stage, count] of [["poc",3],["pilot",6],["main",32]] as const) {
    const draft = generateScreening(stage);
    assert.equal(draft.tasks.length,count);
    assert(draft.tasks.every((t) => t.decision === "PENDING"));
    assert(draft.tasks.every((t) => !t.checks.visible_ui_evidence));
    assert(draft.tasks.every((t) => t.evidence_choices.length === 0));
  }
  runInTemporary((dir) => {
    const path = join(dir,"main-review.json");
    writeScreeningDraft("main", path);
    assert.throws(() => writeScreeningDraft("main", path), /refusing to overwrite/);
    assert.equal(JSON.parse(readFileSync(path,"utf8")).tasks.length,32);
  });
});

test("unreviewed candidates cannot pass screening even when public task metadata matches", () =>
  runInTemporary((dir) => {
    const catalog = join(dir,"catalog.json");
    const review = join(dir,"main-review.json");
    writeFileSync(catalog, JSON.stringify(syntheticPublicCatalog("main")));
    writeScreeningDraft("main", review);
    const result = inspectScreening(review, "main", catalog, dir);
    assert.equal(result.approved,false);
    assert.equal(result.failures.length,32);
    assert(result.failures[0].reasons.includes("NOT_APPROVED"));
    assert.throws(() => requireApprovedScreening(review, "main", catalog, dir), /not passed/);
    assert.throws(() => requireMainFreeze(join(dir,"missing-freeze.json"), []), /Missing main research freeze/);
  }));

test("synthetic human reviews require checklists, grounded evidence and matching official metadata", () =>
  runInTemporary((dir) => {
    const catalog = join(dir,"catalog.json");
    const reviewPath = join(dir,"pilot-review.json");
    const proof = join(dir,"proof.txt");
    writeFileSync(proof,"SYNTHETIC FIXTURE: screenshot reviewed against UI. No actual Shopping task was executed.");
    writeFileSync(catalog,JSON.stringify(syntheticPublicCatalog("pilot")));
    const review = generateScreening("pilot");
    for (const item of review.tasks) {
      item.decision="PASS";
      item.public_constraints=["public product identity", "public evidence criterion", "public target outcome"];
      item.evidence_choices=["inspect order history page", "inspect individual order detail"];
      for (const key of Object.keys(item.checks) as Array<keyof typeof item.checks>) {
        item.checks[key]=true;
      }
      item.evidence_files=["proof.txt"];
      item.reviewer="SYNTHETIC_FIXTURE_REVIEWER";
      item.notes="Synthetic test-only approval: verification criteria are met by the fixture.";
    }
    writeFileSync(reviewPath,JSON.stringify(review));
    assert.equal(inspectScreening(reviewPath,"pilot",catalog,dir).approved,true);
    assert.equal(requireApprovedScreening(reviewPath,"pilot",catalog,dir).approved,true);
    review.tasks[0].checks.no_hidden_answer_leak=false;
    writeFileSync(reviewPath,JSON.stringify(review));
    assert.equal(inspectScreening(reviewPath,"pilot",catalog,dir).approved,false);
    review.tasks[0].checks.no_hidden_answer_leak=true;
    review.tasks[0].evidence_files=["../../does-not-exist"];
    writeFileSync(reviewPath,JSON.stringify(review));
    assert(inspectScreening(reviewPath,"pilot",catalog,dir).failures[0].reasons.includes("EVIDENCE_FILE_INVALID"));
    review.tasks[0].evidence_files=["proof.txt"];
    writeFileSync(reviewPath,JSON.stringify(review));
    const mutated = syntheticPublicCatalog("pilot");
    mutated[0].intent += " changed";
    writeFileSync(catalog,JSON.stringify(mutated));
    assert(inspectScreening(reviewPath,"pilot",catalog,dir).failures[0].reasons.includes("OFFICIAL_TASK_MISMATCH"));
  }));

test("rejects duplicated or tampered review IDs regardless of checked booleans", () =>
  runInTemporary((dir) => {
    const catalog=join(dir,"catalog.json"),review=join(dir,"review.json");
    writeFileSync(catalog,JSON.stringify(syntheticPublicCatalog("poc")));
    const draft: ScreeningReview = generateScreening("poc");
    draft.tasks[1].task_id=draft.tasks[0].task_id;
    writeFileSync(review,JSON.stringify(draft));
    assert.throws(() => inspectScreening(review,"poc",catalog,dir), /duplicate/);
  }));
