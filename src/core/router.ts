import {constraints,type Annotation,type Candidate,type Condition,type Goal,type Matrix,type Probe} from './types.ts';
// The only policy-dependent branch in the runtime. Filtering is shared upstream.
export function selectProbe(condition:Condition,probes:Probe[],annotations:Annotation[],matrix:Matrix,candidates:Candidate[],goal:Goal):Probe|undefined {
 const byId=new Map(annotations.map(a=>[a.probe_id,a]));
 const order=(p:Probe)=>candidates.find(c=>c.key===p.ownerKey)!.initialOrder;
 const sat=(p:Probe)=>constraints(goal).filter(k=>matrix[p.ownerKey][k]==='SATISFIED').length;
 const info=(p:Probe)=>byId.get(p.probeId)!.may_answer.filter(k=>matrix[p.ownerKey][k]==='UNKNOWN').length;
 return [...probes].sort((a,b)=>{
   if(condition==='P')return sat(b)-sat(a)||info(b)-info(a)||a.forwardCost-b.forwardCost||order(a)-order(b)||a.initialOrder-b.initialOrder;
   return byId.get(b.probeId)!.generic_progress_score-byId.get(a.probeId)!.generic_progress_score||order(a)-order(b)||a.initialOrder-b.initialOrder;
 })[0];
}
