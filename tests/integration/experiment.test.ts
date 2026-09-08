import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runExperiment} from '../../src/experiment/runner.ts';
import {manifest} from '../../src/experiment/tasks.ts';
import {DemoModel} from '../../src/agent/demo-model.ts';
import {GOAL_PROMPT} from '../../src/agent/planner.ts';
test('headless runner executes canonical ACT/ABSTAIN, writes all artifacts, and resets each browser',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'cua-headless-'));
 const specs=manifest('main').filter(s=>s.policy==='P'&&(s.task_id==='main-01'||s.task_id==='main-13'||s.task_id==='main-15'));
 const model=new DemoModel(),original=model.complete.bind(model);let parserCalls=0;
 model.complete=async(system,input,signal)=>{if(system===GOAL_PROMPT)parserCalls++;return original(system,input,signal);};
 const output=await runExperiment({directory,config:{manifest:specs,demo:true,config_hash:'test',workflow:'main'},model});
 assert.equal(output.rows.length,6);assert.equal(parserCalls,0);assert.ok(output.rows.every(r=>r.result.act_abstain_correct===true),JSON.stringify(output.metrics.episodes));
 assert.equal(new Set(output.rows.map(r=>r.episode_id)).size,6);
 for(const row of output.rows){const types=row.events.map(e=>e.type);assert.ok(types.indexOf('OUTCOME_FROZEN')<types.indexOf('ORACLE_CHECK'));assert.ok(types.includes('observation'));assert.equal(row.result.goal_matches_reference,true);}
 for(const name of ['episodes.jsonl','metrics.json','metrics.csv','failures.json','experiment-config.json'])assert.ok(existsSync(join(directory,name)),name);
 await assert.rejects(()=>runExperiment({directory,config:{manifest:specs,demo:true},model}),/never overwritten/);
});
test('headless runner retains every browser startup failure and continues the manifest',async()=>{
 const previous=process.env.CHROMIUM_PATH;process.env.CHROMIUM_PATH='Z:/missing/chromium.exe';
 try{
  const directory=mkdtempSync(join(tmpdir(),'cua-startup-')),specs=manifest('development').slice(0,2);
  const output=await runExperiment({directory,config:{manifest:specs,demo:true,config_hash:'failure',workflow:'development'},model:new DemoModel()});
  assert.equal(output.rows.length,2);assert.ok(output.rows.every(r=>r.status==='infrastructure_failed'&&r.result.oracle_success===null));assert.equal(output.metrics.unattempted,0);
 }finally{if(previous===undefined)delete process.env.CHROMIUM_PATH;else process.env.CHROMIUM_PATH=previous;}
});
