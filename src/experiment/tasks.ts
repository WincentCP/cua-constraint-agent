import {GoalSchema, type Condition} from '../core/types.ts';
import {benchmarkManifest, development, main, type Scenario} from '../fixture/dataset.ts';

export type EpisodeSpec = {cell_id:string;task_id:string;presentation:'EARLY'|'STAGED';policy:Condition;repeat:number};
export type Workflow = 'episode'|'development'|'repeatability'|'main';
export function loadTask(id:string, presentation:EpisodeSpec['presentation']):Scenario {
 const task=[...development,...main].find(s=>s.base===id);
 if(!task)throw Error(`Unknown task: ${id}`);
 const variant=main.find(s=>s.base===id&&s.presentation===presentation);
 return structuredClone(variant??{...task,presentation,referenceEvidence:{...task.referenceEvidence,minimumProbes:presentation==='EARLY'?0:2,path:presentation==='EARLY'?[]:task.referenceEvidence.path}});
}
export function manifest(workflow:Workflow, options:{task?:string;presentation?:EpisodeSpec['presentation'];policy?:Condition}={}):EpisodeSpec[]{
 const cell=(task_id:string,presentation:EpisodeSpec['presentation'],policy:Condition,repeat=1):EpisodeSpec=>({cell_id:`${task_id}:${presentation}:${policy}:${repeat}`,task_id,presentation,policy,repeat});
 if(workflow==='episode')return [cell(options.task??'development-01',options.presentation??'STAGED',options.policy??'P')];
 if(workflow==='main')return benchmarkManifest().filter(s=>!options.policy||s.condition===options.policy).map(s=>cell(s.base,s.presentation,s.condition));
 const tasks=workflow==='repeatability'?development.slice(0,4):development;
 return Array.from({length:workflow==='repeatability'?3:1},(_,i)=>tasks.flatMap(s=>(['P','B1'] as const).filter(p=>!options.policy||p===options.policy).map(p=>cell(s.base,'STAGED',p,i+1)))).flat();
}

// This validator is evaluator-side; no private truth or path reaches AgentRun.
export function validateDataset(scenarios:Scenario[]=[...development,...main]){
 const errors:string[]=[];
 for(const s of scenarios){
  const fail=(reason:string)=>errors.push(`${s.base}/${s.presentation}: ${reason}`);
  if(!GoalSchema.safeParse(s.goal).success)fail('invalid canonical goal');
  if(s.products.length!==3||new Set(s.products.map(p=>p.slug)).size!==3)fail('three unique candidates required');
  const suitable=s.products.filter(p=>(!s.goal.material||p.material===s.goal.material)&&p.variants.some(v=>v.size===s.goal.size&&v.color===s.goal.color&&v.available&&v.price<=s.goal.maxPriceIdr));
  const observable=suitable.filter(p=>p.variants.some(v=>v.size===s.goal.size&&v.color===s.goal.color&&v.available&&v.price<=s.goal.maxPriceIdr&&v.exposePrice&&v.exposeStock));
  if(s.kind==='solvable'&&!observable.length)fail('solvable task lacks a publicly provable solution');
  if(s.kind==='no-solution'&&suitable.length)fail('no-solution has a solution');
  if(s.kind==='unavailable-evidence'&&(!suitable.length||observable.length))fail('unavailable evidence must hide decisive evidence of every solution');
  const expected={solvable:'ACT','no-solution':'ABSTAIN_NO_SOLUTION','unavailable-evidence':'ABSTAIN_INSUFFICIENT_EVIDENCE'}[s.kind];
  if(s.referenceEvidence.decision!==expected)fail('reference decision mismatch');
  const peer=scenarios.find(x=>x.base===s.base&&x.presentation!==s.presentation);
  if(peer&&JSON.stringify([peer.goal,peer.products,peer.kind])!==JSON.stringify([s.goal,s.products,s.kind]))fail('EARLY/STAGED truth mismatch');
 }
 return {passed:errors.length===0,scenario_count:scenarios.length,main_episodes:benchmarkManifest().length,errors};
}
