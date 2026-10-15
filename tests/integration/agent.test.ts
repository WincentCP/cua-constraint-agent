import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openInspectionSession } from "../../src/browser/session.ts";
import { runAgentLoop } from "../../src/agent/runner.ts";
import type { ModelClient } from "../../src/agent/ollama.ts";
import { RunRecorder, type RunMetadata } from "../../src/experiment/recorder.ts";
import type { WebArenaTask } from "../../src/webarena/schema.ts";

const initial: RunMetadata = {
  schema_version:1,run_id:"11111111-1111-4111-8111-111111111111",stage:"poc",
  task_id:284,model_label:"mock",model_name:"MOCK_NOT_FOR_RESEARCH",method:"Baseline",
  benchmark_version:"1.2.3",git_commit:"test-only",
  started_at:"2026-10-15T01:00:00.000Z",ended_at:null,duration_ms:null,
  max_steps:3,steps_executed:0,actions:0,probes:0,model_calls:0,
  claimed_success:false,execution_state:"RUNNING",error_code:null,
  official_status:null,official_score:null,
};

test("mock model drives a synthetic browser and records screenshots/decision evidence", async () => {
  const dir=mkdtempSync(join(tmpdir(),"cua-agent-test-"));
  const recorder=new RunRecorder(join(dir,"284"),initial);
  const session=await openInspectionSession({harPath:recorder.path("network.har"),headless:true});
  let calls=0;
  const model:ModelClient={
    async complete(){
      calls++;
      if(calls===1) return JSON.stringify({
        finish:false,final_response:null,rationale:"Inspect a shoe storage candidate",
        progress_scores:{"link:0:Shoe storage":10},input_text_by_probe:{},
        evidence:[{constraint_id:"category",state:"SATISFIED",quote:"Shoe storage"}]
      });
      return JSON.stringify({
        finish:true,
        final_response:{task_type:"NAVIGATE",status:"SUCCESS",retrieved_data:null,error_details:null},
        progress_scores:{},input_text_by_probe:{},evidence:[],rationale:"Model asserts navigation complete"
      });
    }
  };
  const task:WebArenaTask={
    task_id:284,intent_template_id:207,sites:["shopping"],
    start_urls:["data:text/html,<main><a href='#target'>Shoe storage</a><section id='target'>12 pairs capacity</section></main>"],
    intent:"Go to the cheapest shoe storage product with capacity of 12 pairs"
  };
  try{
    await session.goto(task.start_urls[0]);
    const result=await runAgentLoop({
      page:session.page,task,model,policy:"Baseline",
      recorder,maxSteps:3,
      constraints:[{id:"category",description:"shoe storage",required:true,hints:["shoe"]}],
    });
    assert.equal(result.stats.model_calls,2);
    assert.equal(result.stats.actions,1);
    assert.equal(result.stats.probes,1);
    assert.equal(result.response.status,"SUCCESS");
    assert(existsSync(recorder.path("screenshots","initial.png")));
    assert(existsSync(recorder.path("screenshots","decision-0001.png")));
    await recorder.screenshot(session.page,"final.png");
    const lines=readFileSync(recorder.path("trace.jsonl"),"utf8").trim().split("\n");
    assert.equal(lines.length,2);
    const first=JSON.parse(lines[0]);
    assert.equal(first.event,"DECISION");
    assert.equal(first.constraints.category,"SATISFIED");
    assert.equal(first.evidence_updates[0].quote,"Shoe storage");
  }finally{
    await session.close();
    assert(existsSync(recorder.path("network.har")));
    rmSync(dir,{recursive:true,force:true});
  }
});
