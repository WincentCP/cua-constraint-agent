import type {AgentOutcome} from '../agent/run.ts';

export const RECORDING_SCHEMA_VERSION=1;

type StoredEvent={type:string;created?:number;timestamp_ms?:number;payload?:Record<string,unknown>};

const EVENT_NAMES:Record<string,string>={
 transcript:'PARTICIPANT_INPUT',goal_accepted:'GOAL_UPDATE',candidate_declined:'USER_INTERVENTION',user_intervention:'USER_INTERVENTION',researcher_intervention:'USER_INTERVENTION',
 observation:'OBSERVATION',action_intent:'ACTION_ATTEMPT',action_retry_intent:'ACTION_ATTEMPT',action_return:'ACTION_RESULT',action_retry:'ACTION_RESULT',
 verification:'VERIFICATION',final_verification:'VERIFICATION',recovery:'RECOVERY_ATTEMPT',recovery_result:'RECOVERY_RESULT',clarification:'CLARIFICATION',
 probe_evidence:'EVIDENCE_UPDATE',planner_proposal:'PROBE_SELECTION',agent_outcome_frozen:'AGENT_OUTCOME_FROZEN',model_io:'MODEL_CALL',model_validation_failed:'MODEL_VALIDATION_FAILED',
 run_start_failure:'INFRASTRUCTURE_FAILURE',voice_failure:'VOICE_DEVICE_FAILURE',voice_worker_restart:'VOICE_WORKER_RESTART',delivery_incident:'VOICE_DEVICE_FAILURE',
 playback_completed:'PLAYBACK_COMPLETED',feedback:'SESSION_FEEDBACK',comprehension:'COMPREHENSION_RESPONSE',benchmark_failure:'INFRASTRUCTURE_FAILURE',help_provided:'HELP_PROVIDED'
};

export function canonicalEvent(type:string,payload:Record<string,unknown>={}){
 let eventType=EVENT_NAMES[type]??type.toUpperCase();
 if(type==='transcript'&&(payload.kind==='correction'||payload.kind==='initial_correction'))eventType='USER_INTERVENTION';
 if(type==='action_return'||type==='action_retry')eventType=payload.action_success===true?'ACTION_SUCCESS':'ACTION_FAILED';
 const defaults:Record<string,unknown>={PARTICIPANT_INPUT:'RECEIVED',USER_INTERVENTION:'RECORDED',GOAL_UPDATE:'ACCEPTED',OBSERVATION:'CAPTURED',PROBE_SELECTION:'SELECTED',EVIDENCE_UPDATE:Number(payload.new_constraint_evidence)>0?'ACQUIRED':'NO_NEW_EVIDENCE',VERIFICATION:payload.verification_status??'UNKNOWN',MODEL_CALL:'COMPLETED',MODEL_VALIDATION_FAILED:'FAILED',AGENT_OUTCOME_FROZEN:'FROZEN',PLAYBACK_COMPLETED:'DELIVERED',VOICE_WORKER_RESTART:'RESTARTED'};
 return {type:eventType,payload:{...payload,schema_version:RECORDING_SCHEMA_VERSION,source_type:type,result:payload.result??defaults[eventType]??'RECORDED'}};
}

const eventCount=(events:StoredEvent[],type:string,predicate:(payload:Record<string,unknown>)=>boolean=()=>true)=>events.filter(e=>e.type===type&&predicate(e.payload??{})).length;
const abortedReasons=new Set(['skipped','user_stopped','infrastructure_failed']);

export function buildTaskEvaluation(outcome:AgentOutcome,oracle:Record<string,unknown>,events:StoredEvent[],startedAt:number,endedAt=Date.now()){
 const taskSuccess=typeof oracle.act_abstain_correct==='boolean'?oracle.act_abstain_correct:null;
 const status=abortedReasons.has(outcome.agent_termination_reason)||taskSuccess===null?'ABORTED':taskSuccess?'SUCCESS':'FAILED';
 const recoveryAttempts=eventCount(events,'RECOVERY_ATTEMPT');
 const recoverySuccesses=eventCount(events,'RECOVERY_RESULT',p=>p.result==='SUCCESS');
 const recoveryFailures=eventCount(events,'RECOVERY_RESULT',p=>p.result==='FAILED');
 const interventions=events.filter(e=>e.type==='USER_INTERVENTION');
 const hints=eventCount(events,'HELP_PROVIDED')+interventions.filter(e=>(e.payload??{}).help===true).length;
 return {
  task_id:outcome.run_id,task_started_at_ms:startedAt,task_ended_at_ms:endedAt,completion_time_ms:Math.max(0,endedAt-startedAt),
  final_task_status:status as 'SUCCESS'|'FAILED'|'ABORTED',task_success:status==='ABORTED'?null:taskSuccess,
  agent_actions:outcome.counters.actions,failed_actions:eventCount(events,'ACTION_FAILED'),retry_attempts:eventCount(events,'ACTION_ATTEMPT',p=>p.attempt_kind==='retry'),
  recovery_attempts:recoveryAttempts,recovery_successes:recoverySuccesses,recovery_failures:recoveryFailures,
  recovery_outcome:recoveryAttempts===0?null:recoveryFailures===0&&recoverySuccesses===recoveryAttempts?'SUCCESS':recoverySuccesses===0?'FAILED':'PARTIAL',
  clarification_requests:eventCount(events,'CLARIFICATION'),user_interventions:interventions.length,user_takeovers:interventions.filter(e=>(e.payload??{}).takeover===true).length,hints_help:hints,
  error_type:oracle.failure_category??null,final_url:outcome.final_url,final_state:outcome.final_state,recording_schema_version:RECORDING_SCHEMA_VERSION
 };
}

const average=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const median=(values:number[])=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};

export function summarizeSession(sessionId:string,results:any[],recordingFailures=0,endedAt=Date.now()){
 const tasks=results.filter(r=>r.metadata?.session_id===sessionId&&r.task_id);
 const assessable=tasks.filter(r=>typeof r.task_success==='boolean'),completed=tasks.filter(r=>r.final_task_status!=='ABORTED'),times=completed.map(r=>r.completion_time_ms).filter((n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n));
 const actions=tasks.reduce((n,r)=>n+Number(r.agent_actions??r.counters?.actions??0),0),failedActions=tasks.reduce((n,r)=>n+Number(r.failed_actions??0),0),recoveries=tasks.reduce((n,r)=>n+Number(r.recovery_attempts??0),0),recoverySuccesses=tasks.reduce((n,r)=>n+Number(r.recovery_successes??0),0);
 const successes=tasks.filter(r=>r.task_success===true).length;
 return {schema_version:RECORDING_SCHEMA_VERSION,session_id:sessionId,generated_at_ms:endedAt,task_success_rate:tasks.length?successes/tasks.length:null,assessable_task_success_rate:assessable.length?successes/assessable.length:null,successful_tasks:successes,assessable_tasks:assessable.length,total_tasks:tasks.length,average_completion_time_ms:average(times),median_completion_time_ms:median(times),action_failure_rate:actions?failedActions/actions:null,recovery_success_rate:recoveries?recoverySuccesses/recoveries:null,total_clarification_requests:tasks.reduce((n,r)=>n+Number(r.clarification_requests??0),0),total_user_interventions:tasks.reduce((n,r)=>n+Number(r.user_interventions??0),0),total_user_takeovers:tasks.reduce((n,r)=>n+Number(r.user_takeovers??0),0),total_hints_help:tasks.reduce((n,r)=>n+Number(r.hints_help??0),0),total_agent_actions:actions,failed_actions:failedActions,recovery_attempts:recoveries,recording_failures:recordingFailures,recording_status:recordingFailures?'DEGRADED':'COMPLETE',tasks:tasks.map(r=>({task_id:r.task_id,status:r.final_task_status,task_success:r.task_success,completion_time_ms:r.completion_time_ms,error_type:r.error_type}))};
}
