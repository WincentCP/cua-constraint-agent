import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AgentRun} from '../src/agent/run.ts';
import {Planner} from '../src/agent/planner.ts';
import {manifest,loadTask,validateDataset,type EpisodeSpec} from '../src/experiment/tasks.ts';
import {calculateMetrics,developmentGate,type Episode} from '../src/experiment/metrics.ts';
import {configurationHash,localEndpoint} from '../src/experiment/config.ts';
import {exportResults} from '../src/experiment/runner.ts';

const row=(spec:EpisodeSpec,result:object={},demo=false):Episode=>({episode_id:spec.cell_id,spec,kind:'solvable',demo,config_hash:'frozen',status:'completed',events:[],result:{oracle_success:true,act_abstain_correct:true,agent_termination_reason:'verified_complete',counters:{probes:2,informativeProbes:1,evidenceClosureProbe:2},...result}});
test('automated manifest has 64 unique main cells and 24 balanced development repeats',()=>{
 const main=manifest('main'),repeat=manifest('repeatability');assert.equal(main.length,64);assert.equal(new Set(main.map(s=>s.cell_id)).size,64);assert.equal(manifest('main',{policy:'B1'}).length,32);
 assert.equal(repeat.length,24);assert.equal(new Set(repeat.map(s=>s.cell_id)).size,24);assert.equal(new Set(repeat.map(s=>s.task_id)).size,4);assert.ok(repeat.every(s=>s.presentation==='STAGED'));assert.equal(repeat.filter(s=>s.policy==='B1').length,12);
 assert.throws(()=>loadTask('unknown','EARLY'));assert.equal(validateDataset().passed,true);
});
test('dataset validator rejects unprovable solvable and mismatched paired truth',()=>{
 const a=loadTask('main-01','EARLY'),b=loadTask('main-01','STAGED');
 for(const p of a.products)for(const v of p.variants)v.exposePrice=false;
 const check=validateDataset([a,b]);assert.equal(check.passed,false);assert.ok(check.errors.some(e=>e.includes('publicly provable')));assert.ok(check.errors.some(e=>e.includes('truth mismatch')));
});
test('canonical loading clones and validates the goal without any model call',async()=>{
 let calls=0;const run=new AgentRun({} as any,{close:async()=>{}} as any,undefined,'P',{demo:true,complete:async()=>{calls++;throw Error('parser must not run');}},{log:()=>{},status:()=>{},ask:()=>{},finished:async()=>{}});
 // Keep this focused on intake; browser loop is covered in the integration suite.
 (run as any).kick=()=>{};
 const goal=loadTask('main-01','EARLY').goal;await run.startCanonical(goal);goal.size='changed';
 assert.notEqual(run.goal?.size,'changed');assert.equal(calls,0);assert.equal(run.counters.llmCalls,0);
 await assert.rejects(()=>run.startCanonical(goal));await run.finish('user_stopped');
});
test('one shared structured recovery cannot be reused by later planner calls',async()=>{
 let budget=1,calls=0;const model={demo:true,complete:async()=>{calls++;return {text: calls===1?'invalid':JSON.stringify({type:'READY',goal:loadTask('main-01','EARLY').goal}),inputTokens:1,outputTokens:1};}};
 const planner=new Planner(model,work=>work(new AbortController().signal),()=>{},()=>budget-->0);
 await planner.parseGoal('','');assert.equal(calls,2);
 model.complete=async()=>{calls++;return {text:'invalid',inputTokens:1,outputTokens:1};};
 await assert.rejects(()=>planner.parseGoal('',''));assert.equal(calls,3);
});
test('four primary metrics separate presentations, retain missing and null attempts, and pair by task',()=>{
 const plan=manifest('main').filter(s=>s.task_id==='main-01');const rows=plan.map(s=>row(s));
 const stagedB=rows.find(r=>r.spec.presentation==='STAGED'&&r.spec.policy==='B1')!;
 stagedB.result={oracle_success:false,act_abstain_correct:false,agent_termination_reason:'budget_exhausted',counters:{probes:4,informativeProbes:1,evidenceClosureProbe:null}};
 const report=calculateMetrics(rows,plan);assert.equal(report.complete,true);const staged=report.groups.find(g=>g.presentation==='STAGED'&&g.policy==='B1')!;assert.equal(staged.verified_solvable_success,0);assert.equal(staged.informative_probe_rate,.25);assert.equal(staged.mean_probes_to_evidence_closure,null);assert.equal(report.pairs.find(p=>p.presentation==='STAGED')?.success_delta,1);
 const partial=calculateMetrics(rows.slice(1),plan);assert.equal(partial.complete,false);assert.equal(partial.unattempted,1);
 stagedB.status='infrastructure_failed';stagedB.result.oracle_success=null;stagedB.result.act_abstain_correct=null;
 assert.equal(calculateMetrics(rows,plan).groups.find(g=>g.presentation==='STAGED'&&g.policy==='B1')?.verified_solvable_success,null);
 assert.throws(()=>calculateMetrics([...rows,rows[0]],plan),/Duplicate/);assert.throws(()=>calculateMetrics([{...rows[0],demo:true},rows[1]],plan),/Mixed/);
});
test('repeatability gate requires real, complete, stable episodes and two competent B1 tasks',()=>{
 const plan=manifest('repeatability'),rows=plan.map(s=>row(s));assert.equal(developmentGate(rows,plan).passed,true);
 assert.equal(developmentGate(rows.map(r=>({...r,demo:true})),plan).passed,false);
 assert.equal(developmentGate(rows.slice(1),plan).passed,false);
 rows[0].result.counters.probes=3;assert.equal(developmentGate(rows,plan).passed,false);
});
test('export recovers interrupted attempts exactly once and never drops planned cells',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cua-experiment-')),plan=manifest('development');
 writeFileSync(join(dir,'experiment-config.json'),JSON.stringify({manifest:plan,demo:true,config_hash:'c'}));
 writeFileSync(join(dir,'episodes.jsonl'),'');writeFileSync(join(dir,'events.jsonl'),JSON.stringify({timestamp:new Date().toISOString(),episode_id:'interrupted',type:'EPISODE_START',payload:{spec:plan[0],kind:'solvable'}})+'\n');
 const first=exportResults(dir);assert.equal(first.rows.length,1);assert.equal(first.rows[0].status,'infrastructure_failed');assert.equal(first.metrics.unattempted,11);assert.equal(first.rows[0].result.oracle_success,null);
 assert.equal(exportResults(dir).rows.length,1);assert.equal(readFileSync(join(dir,'episodes.jsonl'),'utf8').trim().split('\n').length,1);
 writeFileSync(join(dir,'.running.json'),JSON.stringify({pid:process.pid}));assert.throws(()=>exportResults(dir),/still running/);
});
test('freeze identity ignores a documentation-only commit but detects source and model changes',()=>{
 const a={identity:{files:'v1'},runtime:{node:'v26',git_commit:'before'},model:{digest:'m1'}};
 assert.equal(configurationHash(a),configurationHash({...a,runtime:{...a.runtime,git_commit:'after'}}));
 assert.notEqual(configurationHash(a),configurationHash({...a,model:{digest:'m2'}}));
 assert.notEqual(configurationHash(a),configurationHash({...a,identity:{files:'v2'}}));
 assert.throws(()=>localEndpoint('https://example.com'));assert.equal(localEndpoint('http://127.0.0.1:11434'),'http://127.0.0.1:11434');
});
