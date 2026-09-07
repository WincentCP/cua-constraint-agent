import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildTaskEvaluation,canonicalEvent,summarizeSession} from '../src/evaluation/recording.ts';

const outcome:any={run_id:'task-1',goal:null,goal_history:[],selected_product:null,agent_claimed_success:false,agent_termination_reason:'no_feasible_in_scope',detail:'',counters:{actions:3},goal_intake_ms:10,task_wall_ms:90,cleanup_ms:5,public_refutations:true,completion_audio_delivered:null,verification_status:'UNKNOWN',final_url:'http://127.0.0.1:3050/task/x/cart',final_state:{view_key:'/task/x/cart',heading:'Keranjang penelitian',observation_id:'o3',accessibility_fingerprint:'abc'}};

test('research events use one canonical vocabulary and retain source metadata',()=>{
 assert.equal(canonicalEvent('action_intent',{attempt_kind:'initial'}).type,'ACTION_ATTEMPT');
 assert.equal(canonicalEvent('action_return',{action_success:false}).type,'ACTION_FAILED');
 const correction=canonicalEvent('transcript',{kind:'correction',text:'ukuran L'});assert.equal(correction.type,'USER_INTERVENTION');assert.equal(correction.payload.source_type,'transcript');assert.equal(correction.payload.schema_version,1);
});

test('automatic task evaluation is oracle-grounded and counts dispatch/recovery events',()=>{
 const events:any[]=[
  {type:'ACTION_ATTEMPT',payload:{attempt_kind:'initial'}},{type:'ACTION_SUCCESS',payload:{}},{type:'ACTION_ATTEMPT',payload:{attempt_kind:'retry'}},{type:'ACTION_FAILED',payload:{}},
  {type:'RECOVERY_ATTEMPT',payload:{}},{type:'RECOVERY_RESULT',payload:{result:'FAILED'}},{type:'CLARIFICATION',payload:{}},{type:'USER_INTERVENTION',payload:{kind:'correction'}},{type:'USER_INTERVENTION',payload:{kind:'researcher',takeover:true,help:true}}
 ];
 const result=buildTaskEvaluation(outcome,{act_abstain_correct:true,failure_category:null},events,1000,1300);
 assert.equal(result.final_task_status,'SUCCESS');assert.equal(result.task_success,true);assert.equal(result.completion_time_ms,300);assert.equal(result.agent_actions,3);assert.equal(result.failed_actions,1);assert.equal(result.retry_attempts,1);assert.equal(result.recovery_attempts,1);assert.equal(result.recovery_outcome,'FAILED');assert.equal(result.clarification_requests,1);assert.equal(result.user_interventions,2);assert.equal(result.user_takeovers,1);assert.equal(result.hints_help,1);assert.equal(result.final_state?.heading,'Keranjang penelitian');
});

test('aborted task remains null instead of becoming an oracle failure',()=>{
 const result=buildTaskEvaluation({...outcome,agent_termination_reason:'user_stopped'},{act_abstain_correct:false,failure_category:null},[],0,100);
 assert.equal(result.final_task_status,'ABORTED');assert.equal(result.task_success,null);
});

test('session summary calculates rates and median without inventing denominators',()=>{
 const metadata={session_id:'session-1'};const summary=summarizeSession('session-1',[
  {metadata,task_id:'a',task_success:true,final_task_status:'SUCCESS',completion_time_ms:100,agent_actions:2,failed_actions:0,recovery_attempts:0,recovery_successes:0,clarification_requests:1,user_interventions:0,user_takeovers:0,hints_help:0,error_type:null},
  {metadata,task_id:'b',task_success:false,final_task_status:'FAILED',completion_time_ms:300,agent_actions:3,failed_actions:1,recovery_attempts:1,recovery_successes:1,clarification_requests:0,user_interventions:1,user_takeovers:0,hints_help:1,error_type:'verification_failure'},
  {metadata:{session_id:'another'},task_id:'ignored',task_success:true,final_task_status:'SUCCESS',completion_time_ms:1,agent_actions:99}
 ],0,500);
 assert.equal(summary.task_success_rate,.5);assert.equal(summary.average_completion_time_ms,200);assert.equal(summary.median_completion_time_ms,200);assert.equal(summary.action_failure_rate,.2);assert.equal(summary.recovery_success_rate,1);assert.equal(summary.total_agent_actions,5);assert.equal(summary.tasks.length,2);assert.equal(summary.recording_status,'COMPLETE');
 const empty=summarizeSession('empty',[]);assert.equal(empty.task_success_rate,null);assert.equal(empty.action_failure_rate,null);assert.equal(empty.recovery_success_rate,null);
});

test('session success denominator retains aborted attempts',()=>{const metadata={session_id:'s'},summary=summarizeSession('s',[{metadata,task_id:'ok',task_success:true,final_task_status:'SUCCESS',completion_time_ms:10,agent_actions:1},{metadata,task_id:'aborted',task_success:null,final_task_status:'ABORTED',completion_time_ms:5,agent_actions:0}]);assert.equal(summary.task_success_rate,.5);assert.equal(summary.assessable_task_success_rate,1);assert.equal(summary.total_tasks,2);});
