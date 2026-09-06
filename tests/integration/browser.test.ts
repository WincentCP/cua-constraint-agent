import {test} from 'node:test';import assert from 'node:assert/strict';
import {fixtureHarness} from '../../src/fixture/harness.ts';import {makeScenario} from '../../src/fixture/dataset.ts';
import {openTask} from '../../src/browser/task-browser.ts';import {Observer} from '../../src/browser/observer.ts';
import {AgentRun} from '../../src/agent/run.ts';import {DemoModel} from '../../src/agent/demo-model.ts';
import {assessOracle} from '../../src/evaluation/oracle.ts';
test('real browser integration, with explicitly synthetic planner',async t=>{
 const h=await fixtureHarness();try{
  for(const presentation of ['EARLY','STAGED'] as const)for(const condition of ['P','B1'] as const)await t.test(`${condition}/${presentation} executes browser and verifies stored cart`,async()=>{
   const w=h.fixtures.create(makeScenario(0,'development',presentation));const task=await openTask(w.id,w.secret,()=>assert.fail('egress'),process.env.CHROMIUM_PATH);let result:any;const events:any[]=[];
   const run=new AgentRun(task.page,task.browser,task.server,condition,new DemoModel(),{log:(type,payload)=>events.push({type,payload}),status:()=>{},ask:()=>{},finished:async(outcome,quiescent)=>{w.closed=true;result={...outcome,...assessOracle(w,outcome.goal,quiescent)};}},true);
   await run.input(w.scenario.instruction);await run.done;assert.equal(result.agent_termination_reason,'verified_complete',JSON.stringify(result));assert.equal(result.oracle_success,true);assert.equal(w.cart.length,1);assert.ok(result.counters.probes<=4);if(presentation==='EARLY')assert.equal(result.counters.probes,0);assert.equal(events.filter(e=>e.type==='action_intent'&&e.payload.expected.kind==='ADD_CART').length,1);
  });
  await t.test('AC-10: replaced element never inherits old snapshot binding',async()=>{const w=h.fixtures.create(makeScenario(1));const task=await openTask(w.id,w.secret,()=>{},process.env.CHROMIUM_PATH);try{const observer=new Observer(task.page);const o=await observer.observe();const control=o.controls.find(c=>c.kind==='OPEN_DETAIL')!;await task.page.getByRole('link',{name:control.exactName,exact:true}).evaluate(el=>el.replaceWith(el.cloneNode(true)));await assert.rejects(()=>observer.validate(control));}finally{await task.browser.close();await task.server.close();}});
  await t.test('AC-09: planner-visible snapshot does not expose closed panels',async()=>{const w=h.fixtures.create(makeScenario(1));const task=await openTask(w.id,w.secret,()=>{},process.env.CHROMIUM_PATH);try{const o=await new Observer(task.page).observe();assert.equal(o.facts.length,0);assert.ok(!o.snapshot.includes('Stok:'));assert.ok(!o.snapshot.includes(w.scenario.base));}finally{await task.browser.close();await task.server.close();}});
 }finally{await h.close();}
});
