import {type EpisodeSpec} from './tasks.ts';

export type TraceEvent={timestamp:string;episode_id:string;type:string;payload:any};
export type Episode={episode_id:string;spec:EpisodeSpec;kind:string;demo:boolean;config_hash:string;status:'completed'|'infrastructure_failed';result:any;events:TraceEvent[]};
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
export function failureType(row:Episode):string|null {
 const r=row.result;
 if(row.status==='infrastructure_failed'||r.agent_termination_reason==='infrastructure_failed')return 'Environment Failure';
 if(r.agent_termination_reason==='invalid_plan')return 'Structured Output Failure';
 if(row.events.some(e=>e.type==='action_intent'&&e.payload.expected?.kind==='ADD_CART')&&row.events.some(e=>e.type==='act_guard_rejected'))return 'Premature ACT';
 if(r.wrong_final_effect)return r.oracle_assessment_reason==='incorrect_cart'?'Constraint Violation':'Wrong Candidate';
 if(r.agent_claimed_success&&r.oracle_success!==true)return 'Verification Failure';
 if(r.agent_termination_reason==='execution_failed')return /verif|postcondition|cart_/.test(r.detail)?'Verification Failure':'Browser Execution Failure';
 if(['budget_exhausted','timeout'].includes(r.agent_termination_reason))return 'Exploration Failure';
 if(['no_feasible_in_scope','insufficient_evidence'].includes(r.agent_termination_reason)&&r.act_abstain_correct!==true)return 'Wrong Abstention';
 return r.act_abstain_correct===true?null:'Environment Failure';
}
export function episodeMetrics(row:Episode){
 const r=row.result,c=r.counters??{};
 return {episode_id:row.episode_id,...row.spec,kind:row.kind,demo:row.demo,status:row.status,
  verified_solvable_success:row.kind==='solvable'?(r.oracle_success??null):null,
  act_abstain_correct:r.act_abstain_correct??null,probes_to_evidence_closure:r.probes_to_evidence_closure??c.evidenceClosureProbe??null,
  informative_probe_rate:c.probes?c.informativeProbes/c.probes:null,probes:c.probes??0,informative_probes:c.informativeProbes??0,
  browser_actions:c.actions??0,llm_calls:c.llmCalls??0,input_tokens:c.inputTokens??0,output_tokens:c.outputTokens??0,
  wall_clock_ms:r.task_wall_ms??null,recoveries:c.recoveries??0,invalid_structured_outputs:row.events.filter(e=>e.type==='invalid_structured_output').length,
  verification_failures:row.events.filter(e=>['verification','final_verification'].includes(e.type)&&e.payload.verification_status!=='PASS').length,
  decision:r.agent_termination_reason==='verified_complete'?'ACT':r.agent_termination_reason==='no_feasible_in_scope'?'ABSTAIN_NO_SOLUTION':r.agent_termination_reason==='insufficient_evidence'?'ABSTAIN_INSUFFICIENT_EVIDENCE':null,
  termination_reason:r.agent_termination_reason,failure_type:failureType(row)};
}
export function calculateMetrics(rows:Episode[],plan:EpisodeSpec[]){
 const ids=rows.map(r=>r.spec.cell_id);
 if(new Set(ids).size!==ids.length)throw Error('Duplicate episode cells; no attempt may be silently selected');
 const identities=new Set(rows.map(r=>`${r.demo}:${r.config_hash}`));
 if(identities.size>1)throw Error('Mixed experiment identities');
 if(ids.some(id=>!plan.some(p=>p.cell_id===id)))throw Error('Episode outside saved manifest');
 const metrics=rows.map(episodeMetrics);
 const groups=(['EARLY','STAGED'] as const).flatMap(presentation=>(['P','B1'] as const).map(policy=>{
  const planned=plan.filter(p=>p.presentation===presentation&&p.policy===policy),all=metrics.filter(r=>r.presentation===presentation&&r.policy===policy),solvable=all.filter(r=>r.kind==='solvable');
  const complete=planned.length>0&&all.length===planned.length;
  const assessed=all.filter(r=>r.act_abstain_correct!==null),assessedSolvable=solvable.filter(r=>r.verified_solvable_success!==null);
  const probes=all.reduce((n,r)=>n+r.probes,0),informative=all.reduce((n,r)=>n+r.informative_probes,0);
  return {presentation,policy,planned:planned.length,attempted:all.length,unattempted:planned.length-all.length,complete,
   infrastructure_failed:all.filter(r=>r.status==='infrastructure_failed').length,oracle_null:all.length-assessed.length,
   solvable_attempted:solvable.length,solvable_successes:solvable.filter(r=>r.verified_solvable_success===true).length,
   verified_solvable_success:complete&&solvable.length&&assessedSolvable.length===solvable.length?solvable.filter(r=>r.verified_solvable_success===true).length/solvable.length:null,
   act_abstain_correctness:complete&&assessed.length===all.length?all.filter(r=>r.act_abstain_correct===true).length/all.length:null,
   mean_probes_to_evidence_closure:mean(all.map(r=>r.probes_to_evidence_closure).filter((n):n is number=>typeof n==='number')),
   evidence_closure_episodes:all.filter(r=>r.probes_to_evidence_closure!==null).length,informative_probe_rate:probes?informative/probes:null};
 }));
 const pairs=plan.filter(s=>s.policy==='P').map(spec=>{
  const p=metrics.find(r=>r.cell_id===spec.cell_id),b=metrics.find(r=>r.task_id===spec.task_id&&r.presentation===spec.presentation&&r.policy==='B1'&&r.repeat===spec.repeat);
  return {task_id:spec.task_id,presentation:spec.presentation,repeat:spec.repeat,complete:Boolean(p&&b),
   success_delta:p?.verified_solvable_success!=null&&b?.verified_solvable_success!=null?Number(p.verified_solvable_success)-Number(b.verified_solvable_success):null,
   correctness_delta:p?.act_abstain_correct!=null&&b?.act_abstain_correct!=null?Number(p.act_abstain_correct)-Number(b.act_abstain_correct):null,
   closure_probe_delta:p?.probes_to_evidence_closure!=null&&b?.probes_to_evidence_closure!=null?p.probes_to_evidence_closure-b.probes_to_evidence_closure:null,
   P:p??null,B1:b??null};
 });
 const paired_by_presentation=(['EARLY','STAGED'] as const).map(presentation=>{
  const subset=pairs.filter(p=>p.presentation===presentation);
  return {presentation,complete_pairs:subset.filter(p=>p.complete).length,mean_success_difference:mean(subset.flatMap(p=>p.success_delta===null?[]:[p.success_delta])),mean_correctness_difference:mean(subset.flatMap(p=>p.correctness_delta===null?[]:[p.correctness_delta])),mean_closure_probe_difference:mean(subset.flatMap(p=>p.closure_probe_delta===null?[]:[p.closure_probe_delta]))};
 });
 return {demo:rows[0]?.demo??null,planned:plan.length,attempted:rows.length,unattempted:plan.length-rows.length,complete:plan.length>0&&rows.length===plan.length,groups,paired_by_presentation,pairs,episodes:metrics};
}

export function developmentGate(rows:Episode[],plan:EpisodeSpec[]){
 const metrics=calculateMetrics(rows,plan);
 const cells=[...new Set(plan.map(p=>`${p.task_id}:${p.policy}`))].map(key=>{
  const attempts=rows.filter(r=>`${r.spec.task_id}:${r.spec.policy}`===key);
  const signatures=attempts.map(r=>JSON.stringify([r.result.agent_termination_reason,r.result.act_abstain_correct,r.result.counters?.probes,r.result.counters?.evidenceClosureProbe]));
  return {cell:key,attempts:attempts.length,stable:attempts.length===3&&new Set(signatures).size===1&&attempts.every(r=>r.status==='completed'&&r.result.act_abstain_correct!==null)};
 });
 const competent=[...new Set(rows.filter(r=>r.spec.policy==='B1'&&r.spec.presentation==='STAGED'&&r.result.oracle_success===true).map(r=>r.spec.task_id))];
 const correctPlan=plan.length===24&&new Set(plan.map(p=>p.task_id)).size===4&&cells.length===8&&plan.every(p=>p.presentation==='STAGED'&&p.task_id.startsWith('development-'));
 return {passed:correctPlan&&metrics.complete&&rows.every(r=>!r.demo)&&competent.length>=2&&cells.every(c=>c.stable),demo:rows.some(r=>r.demo),complete:metrics.complete,baseline_competent_tasks:competent,repeatability:cells,
  definition:'4 development STAGED tasks x 2 policies x 3 repeats. Stable = identical termination, correctness, probe count and evidence closure within each task/policy. B1 succeeds on at least 2 distinct tasks. Demo cannot pass.'};
}
