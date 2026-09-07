// Offline-only: never imported by agent/, browser/, or core/.
import type {World} from '../fixture/world.ts';
import type {Goal} from '../core/types.ts';
import type {AgentOutcome} from '../agent/run.ts';
export function assessOracle(world:World,goal:Goal|null,quiescent:boolean){
 if(!quiescent)return {oracle_success:null,oracle_assessment_reason:'quiescence_unknown',wrong_final_effect:null,feasible_exists:null};
 if(!goal)return {oracle_success:false,oracle_assessment_reason:'goal_unavailable',wrong_final_effect:world.cart.length>0,feasible_exists:null};
 const eq=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase();
 const suitable=world.scenario.products.filter(p=>(!goal.material||eq(p.material,goal.material))&&p.variants.some(v=>eq(v.size,goal.size)&&eq(v.color,goal.color)&&v.available&&v.price<=goal.maxPriceIdr));
 const item=world.cart[0];const product=item&&world.scenario.products.find(p=>p.slug===item.slug);const variant=product?.variants.find(v=>eq(v.size,item.size)&&eq(v.color,item.color));
 const correct=Boolean(world.cart.length===1&&item.quantity===1&&product&&variant&&suitable.includes(product)&&eq(item.size,goal.size)&&eq(item.color,goal.color)&&item.unitPrice===variant.price&&variant.available&&!world.forbiddenEffect);
 return {oracle_success:correct,oracle_assessment_reason:correct?'correct_cart':world.forbiddenEffect?'forbidden_effect':!world.cart.length?'empty_cart':'incorrect_cart',wrong_final_effect:world.cart.length>0&&!correct,feasible_exists:suitable.length>0};
}

const normalizedGoal=(goal:Goal|null)=>goal&&{size:goal.size.trim().toLocaleLowerCase('id'),color:goal.color.trim().toLocaleLowerCase('id'),maxPriceIdr:goal.maxPriceIdr,material:goal.material?.trim().toLocaleLowerCase('id')??null,quantity:goal.quantity};
export const goalsMatch=(parsed:Goal|null,reference:Goal)=>JSON.stringify(normalizedGoal(parsed))===JSON.stringify(normalizedGoal(reference));
export type FailureCategory='goal_parser_failure'|'grounding_binding_failure'|'constraint_evidence_failure'|'probe_budget_exhaustion'|'execution_failure'|'verification_failure'|'infrastructure_failure'|'voice_device_failure'|null;
export function failureCategory(outcome:Pick<AgentOutcome,'agent_termination_reason'|'detail'|'verification_status'>):FailureCategory{
 const {agent_termination_reason:reason,detail,verification_status}=outcome;
 if(['verified_complete','no_feasible_in_scope','insufficient_evidence','skipped','user_stopped'].includes(reason))return null;
 if(reason==='unsupported_goal'||reason==='no_response'||/goal_|parser/.test(detail))return 'goal_parser_failure';
 if(reason==='budget_exhausted')return 'probe_budget_exhaustion';
 if(reason==='infrastructure_failed')return /voice|stt|tts|microphone|audio/.test(detail)?'voice_device_failure':'infrastructure_failure';
 if(/reference|binding|descriptor|grounding|candidate_contract/.test(detail))return 'grounding_binding_failure';
 if(verification_status!=='PASS'&&/verif|postcondition|cart_/.test(detail))return 'verification_failure';
 if(reason==='invalid_plan'||/evidence|constraint|probe_overflow|model_context/.test(detail))return 'constraint_evidence_failure';
 return 'execution_failure';
}
export function evaluateOutcome(world:World,outcome:AgentOutcome,quiescent:boolean,participantMode=false){
 const reference=structuredClone(world.scenario.goal),parsed=outcome.goal?structuredClone(outcome.goal):null,goalMatchesReference=goalsMatch(parsed,reference);const original=assessOracle(world,reference,quiescent);const correction=outcome.goal_history.length>1||!goalMatchesReference;const needsAdjudication=participantMode&&correction;
 const decision=world.scenario.referenceEvidence.decision;let actAbstainCorrect:boolean|null=null;
 if(quiescent){if(decision==='ACT')actAbstainCorrect=original.oracle_success===true;else if(decision==='ABSTAIN_NO_SOLUTION')actAbstainCorrect=world.cart.length===0&&original.feasible_exists===false&&outcome.agent_termination_reason==='no_feasible_in_scope'&&outcome.public_refutations;else actAbstainCorrect=world.cart.length===0&&outcome.agent_termination_reason==='insufficient_evidence';}
 const closure=outcome.counters.evidenceClosureProbe,minimum=world.scenario.referenceEvidence.minimumProbes;
 return {parsed_goal:parsed,oracle_reference_goal:reference,goal_matches_reference:goalMatchesReference,goal_revision_history:structuredClone(outcome.goal_history),reference_goal_status:needsAdjudication?'manual_adjudication_required':'fixed_task_reference',original_task_oracle_success:original.oracle_success,original_task_oracle_assessment_reason:original.oracle_assessment_reason,...(needsAdjudication?{oracle_success:null,oracle_assessment_reason:'participant_goal_requires_manual_annotation',wrong_final_effect:null,feasible_exists:original.feasible_exists}:original),reference_decision:decision,act_abstain_correct:needsAdjudication?null:actAbstainCorrect,reference_minimum_probes:minimum,reference_decisive_constraints:structuredClone(world.scenario.referenceEvidence.decisiveConstraints),reference_evidence_path:structuredClone(world.scenario.referenceEvidence.path),probes_to_evidence_closure:closure,excess_probe_cost:closure===null||minimum===null?null:closure-minimum,failure_category:failureCategory(outcome)};
}
