import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,relative,isAbsolute,extname} from 'node:path';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {z} from 'zod';
import {Store} from './storage.ts';
import {FixtureStore,renderWorld,mutateWorld,type World} from './fixture/world.ts';
import {development,main,study,studyOrder,benchmarkManifest,type Scenario} from './fixture/dataset.ts';
import {AgentRun,type AgentOutcome} from './agent/run.ts';
import {Ollama,PROMPT_HASH} from './agent/planner.ts';
import {DemoModel} from './agent/demo-model.ts';
import {openTask} from './browser/task-browser.ts';
import {evaluateOutcome} from './evaluation/oracle.ts';
import {csv,summarize,pairedAnalysis} from './evaluation/report.ts';
import {buildTaskEvaluation,canonicalEvent,summarizeSession,RECORDING_SCHEMA_VERSION} from './evaluation/recording.ts';
import {Voice} from './voice.ts';
import {command} from './core/policy.ts';
import {CONFIG_HASH,hash,LIMITS,MODEL,ORIGIN} from './core/config.ts';
import type {Condition} from './core/types.ts';
const demo=process.argv.includes('--demo');
if(existsSync('.env'))process.loadEnvFile('.env');
mkdirSync('.runtime',{recursive:true,mode:0o700});
const researcher=process.env.RESEARCHER_TOKEN||(existsSync('.runtime/researcher-token')?readFileSync('.runtime/researcher-token','utf8').trim():randomBytes(32).toString('hex'));
if(!existsSync('.runtime/researcher-token'))writeFileSync('.runtime/researcher-token',researcher,{mode:0o600});
const store=new Store(process.env.DATA_PATH||'data/research.sqlite'),fixtures=new FixtureStore(),voice=new Voice();
const recovered=store.export(),summarizedSessions=new Set(recovered.session_summaries.map((x:any)=>x.session_id));for(const row of recovered.sessions as any[])if(row.ended&&!summarizedSessions.has(row.id))store.sessionSummary(row.id,summarizeSession(row.id,recovered.results));
const equal=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
type State='CONSENT'|'READINESS'|'READY'|'IN_TASK'|'BETWEEN_TASKS'|'FEEDBACK'|'CLOSING'|'CLOSED';
type Turn={id:string;text:string;intent:'ANSWER'|'CONTROL'|'BETWEEN_TASKS'|'END';confirmation?:string;resultRun?:string;ready:boolean};
type AttemptMetadata={role:'original'|'replacement'|'participant_retry';pairId?:string;reason?:string;replacesRunId?:string};
type ScheduleItem={scenario:Scenario;condition:Condition;manifestIndex?:number;attempt?:AttemptMetadata};
type Session={id:string;token:string;code:string;mode:'demo'|'study'|'pilot'|'benchmark';slot:number;index:number;state:State;epoch:number;seq:number;ws?:WebSocket;lastHeartbeat:number;run?:AgentRun;world?:World;retryItem?:ScheduleItem;benchmarkTotal?:number;requests:Set<string>;turn?:Turn;lastPlayed?:Turn;deferredSay?:{text:string;intent:Turn['intent'];confirmation?:string;resultRun?:string};timer?:NodeJS.Timeout;answerTimer?:NodeJS.Timeout;workTimer?:NodeJS.Timeout;reprompts:number;comprehension:boolean;readyHeard:boolean;started?:number;starting:boolean;pendingSpeech?:boolean;inputTurn?:string;recordingStarted:boolean;recordingFailures:number;pendingRecordingFailures:{event_type:string;error:string;timestamp_ms:number}[]};
let session:Session|undefined;let closing=false;
const Consent=z.object({accepted:z.boolean(),adult:z.boolean(),version:z.string().min(1),request_id:z.string().uuid()}).strict();
const consentConfig=()=>({contact:process.env.RESEARCHER_CONTACT??'',version:process.env.CONSENT_VERSION??'',ethics:process.env.ETHICS_PROCEDURE??'',custodian:process.env.DATA_CUSTODIAN??'',deletion:process.env.DELETION_PLAN??''});
function readiness(){let preflight:any=null;try{preflight=JSON.parse(readFileSync('data/preflight.json','utf8'));}catch{}const config=consentConfig();return {demo,config,configured:Object.values(config).every(Boolean),preflight,study_enabled:!demo&&process.env.HUMAN_STUDY_ENABLED==='true'&&Object.values(config).every(Boolean)&&preflight?.passed===true&&preflight?.config_hash===CONFIG_HASH,local_only:true,model:MODEL.name};}
function emit(s:Session,type:string,payload:unknown={}){const e={type,payload,session_id:s.id,run_id:s.run?.terminal?null:s.run?.id??null,epoch:s.epoch,goal_revision:s.run?.goal?.revision??0,run_epoch:s.run?.epoch??0,turn_id:s.turn?.id??null,event_seq:++s.seq};if(s.ws?.readyState===WebSocket.OPEN)s.ws.send(JSON.stringify(e));}
function writeEvent(s:Session,runId:string|null,type:string,payload:unknown,sensitive=false,critical=false){
 const normalized=canonicalEvent(type,payload as Record<string,unknown>);try{
  if(s.pendingRecordingFailures.length&&normalized.type!=='RECORDING_FAILURE'){const failures=s.pendingRecordingFailures.splice(0);store.event(s.id,runId,'RECORDING_FAILURE',{schema_version:RECORDING_SCHEMA_VERSION,session_id:s.id,task_id:runId,result:'DEGRADED',failures},false,s.mode==='demo'||s.mode==='benchmark');}
  return store.event(s.id,runId,normalized.type,{session_id:s.id,task_id:runId,...normalized.payload},sensitive,s.mode==='demo'||s.mode==='benchmark');
 }catch(e){s.recordingFailures++;s.pendingRecordingFailures.push({event_type:normalized.type,error:e instanceof Error?e.name:'storage_error',timestamp_ms:Date.now()});if(critical)throw e;return null;}
}
function event(s:Session,type:string,payload:unknown,sensitive=false){const critical=type==='action_intent'||type==='action_retry_intent';return writeEvent(s,s.run?.id??null,type,{...s.run?.envelope(),...payload as object},sensitive,critical);}
voice.onIncident=(type,payload)=>{if(session)event(session,type,payload);};
function state(s:Session,value:State){s.state=value;emit(s,'STATE',{state:value});}
function clearTurn(s:Session){clearTimeout(s.answerTimer);s.turn=undefined;s.pendingSpeech=false;}
function stopWorking(s:Session){clearTimeout(s.workTimer);s.workTimer=undefined;}
function scheduleWorking(s:Session,delay:number=LIMITS.workFirstMs){stopWorking(s);if(s.mode==='benchmark'||s.state!=='IN_TASK'||s.run?.terminal||s.run?.held||s.turn)return;s.workTimer=setTimeout(()=>{if(s.state==='IN_TASK'&&!s.run?.terminal&&!s.run?.held&&!s.turn){emit(s,'WORKING',{});scheduleWorking(s,LIMITS.workRepeatMs);}},delay);}
function say(s:Session,text:string,intent:Turn['intent']='ANSWER',confirmation?:string,resultRun?:string){
 if(s.state==='CLOSED'||s.state==='CLOSING')return;if(s.pendingSpeech){s.deferredSay={text,intent,confirmation,resultRun};return;}stopWorking(s);if(s.turn)emit(s,'TURN_CANCELLED',{turn_id:s.turn.id,reason:'superseded'});clearTurn(s);const turn:Turn={id:randomUUID(),text,intent,confirmation,resultRun,ready:false};s.turn=turn;emit(s,'PREPARE_PLAY',turn);
}
function flushDeferred(s:Session){const pending=s.deferredSay;if(!pending)return;if(s.turn){s.deferredSay=undefined;return;}if(!s.pendingSpeech){s.deferredSay=undefined;say(s,pending.text,pending.intent,pending.confirmation,pending.resultRun);}}
async function playReady(s:Session,id:string){const t=s.turn;if(!t||t.id!==id||t.ready)return;t.ready=true;const epoch=s.epoch;
 if(demo){emit(s,'DEMO_TEXT',t);return;}
 try{const audio=await voice.request('tts',{text:t.text});if(session!==s||s.epoch!==epoch||s.turn?.id!==id)return;emit(s,'PLAY',{...t,audio:audio.audio,mime:audio.mime});}
 catch{if(s.epoch!==epoch)return;emit(s,'AUDIO_ERROR',{text:'Suara tidak tersedia. Tekan Escape untuk berhenti; minta peneliti memeriksa perangkat.'});event(s,'voice_failure',{engine:'tts'});await s.run?.finish('infrastructure_failed','tts_unavailable');}
}
function answerDeadline(s:Session){clearTimeout(s.answerTimer);s.answerTimer=setTimeout(()=>{if(s.pendingSpeech)return;if(s.reprompts++<LIMITS.reprompts&&s.lastPlayed){event(s,'help_provided',{kind:'answer_reprompt',result:'DELIVERED'});say(s,'Silakan jawab. Kamu juga bisa mengatakan ulang, lewati, atau selesai.','ANSWER',s.lastPlayed.confirmation);}else if(s.run&&!s.run.terminal)void s.run.finish('no_response','answer_silence');else void closeSession(s);},LIMITS.answerMs);}
function played(s:Session,id:string){const t=s.turn;if(!t||id!==t.id)return;s.lastPlayed={...t};s.turn=undefined;if(t.resultRun)store.delivery(t.resultRun,true);event(s,'playback_completed',{turn_id:id,intent:t.intent});emit(s,'LISTEN',{intent:t.intent,confirmation:t.confirmation});if(s.state==='READINESS')s.readyHeard=true;if(t.intent==='ANSWER')answerDeadline(s);if(s.run?.goal&&!s.run.terminal&&s.run.phase!=='AWAITING_APPROVAL'){s.run.resume();scheduleWorking(s);}if(t.intent==='END')void closeSession(s);}
const narratives:Record<string,string>={verified_complete:'Satu barang yang memenuhi syarat sudah masuk ke keranjang penelitian.',no_feasible_in_scope:'Ketiga produk yang tersedia dalam tugas ini terbukti tidak memenuhi semua syarat.',insufficient_evidence:'Bukti yang tersedia belum cukup untuk memastikan pilihan yang sesuai.',budget_exhausted:'Batas pemeriksaan sudah tercapai. Saya belum dapat memastikan pilihan yang sesuai.',skipped:'Tugas dilewati.',user_stopped:'Sesi dihentikan.',execution_failed:'Hasil tugas belum dapat diverifikasi.',infrastructure_failed:'Tugas berhenti karena kendala perangkat atau layanan lokal.',timeout:'Batas waktu tugas tercapai.',no_response:'Tugas dihentikan karena belum ada jawaban.',unsupported_goal:'Tujuan ini belum dapat diproses dalam lingkup tugas.',invalid_plan:'Tugas dihentikan karena keluaran perencana tidak valid.'};
async function startRun(s:Session,scenario:Scenario,condition:Condition,auto=false,manifestIndex?:number,attempt:AttemptMetadata={role:'original'}){
 if(s.starting||s.run&&!s.run.terminal||s.state==='CLOSED'||s.state==='CLOSING')throw Error('session_busy');s.starting=true;
 try{if(s.run)await s.run.done;if(session!==s||(['CLOSED','CLOSING'] as State[]).includes(s.state))return;
  const attemptId=randomUUID(),epoch=s.epoch;let world:World|undefined,run:AgentRun|undefined,task:Awaited<ReturnType<typeof openTask>>;
   const dataset=scenario.split==='main'?main:scenario.split==='development'?development:study;const metadataBase={session_id:s.id,condition,base:scenario.base,split:scenario.split,session_mode:s.mode,presentation:scenario.presentation,kind:scenario.kind,template:scenario.template,counterfactual_group:scenario.counterfactualGroup??null,public_task_instruction:scenario.instruction,oracle_reference_goal:structuredClone(scenario.goal),manifest_index:manifestIndex??null,attempt_role:attempt.role,replacement_pair_id:attempt.pairId??null,replacement_reason:attempt.reason??null,replaces_run_id:attempt.replacesRunId??null,config_hash:CONFIG_HASH,prompt_hash:PROMPT_HASH,dataset_hash:hash(dataset),scenario_hash:hash(scenario),demo,model:MODEL,node:process.version,freeze:existsSync('config/freeze.json')?JSON.parse(readFileSync('config/freeze.json','utf8')):null};
   store.run(attemptId,s.id,{...metadataBase,chromium:null});
   if(!s.recordingStarted){s.recordingStarted=true;writeEvent(s,null,'SESSION_RECORDING_STARTED',{started_at_ms:Date.now(),media_recording:false,raw_audio_recording:false,result:'STARTED'});}
   writeEvent(s,attemptId,'TASK_START',{task_id:attemptId,base:scenario.base,presentation:scenario.presentation,condition,attempt_role:attempt.role,result:'STARTED'});
  try{world=fixtures.create(scenario);s.world=world;task=await openTask(world.id,world.secret,()=>{void run?.finish('execution_failed','egress_or_popup_blocked');},process.env.CHROMIUM_PATH);}catch(error){
   const detail=error instanceof Error?error.message:'browser_start_failed',metadata={...metadataBase,chromium:null};if(world){world.closed=true;fixtures.remove(world.id);}s.world=undefined;s.run=undefined;
    writeEvent(s,attemptId,'run_start_failure',{epoch:s.epoch,goal_revision:0,reason:'infrastructure_failed',detail,result:'FAILED'});const endedAt=Date.now(),timing=store.runTiming(attemptId)!;const startupResult={run_id:attemptId,task_id:attemptId,goal:null,goal_history:[],parsed_goal:null,oracle_reference_goal:structuredClone(scenario.goal),goal_matches_reference:false,reference_goal_status:'fixed_task_reference',selected_product:null,agent_claimed_success:false,agent_termination_reason:'infrastructure_failed',detail,counters:{probes:0,actions:0,observations:0,llmCalls:0,inputTokens:0,outputTokens:0,recoveries:0,informativeProbes:0,evidenceAcquired:0,firstFeasibleProbe:null,evidenceClosureProbe:null,routerComparisons:0,routerDisagreements:0},goal_intake_ms:0,task_wall_ms:0,cleanup_ms:0,public_refutations:false,completion_audio_delivered:null,verification_status:'UNKNOWN',final_url:null,final_state:null,metadata,oracle_success:null,oracle_assessment_reason:'browser_never_started',wrong_final_effect:null,feasible_exists:null,reference_decision:scenario.referenceEvidence.decision,reference_minimum_probes:scenario.referenceEvidence.minimumProbes,reference_decisive_constraints:scenario.referenceEvidence.decisiveConstraints,reference_evidence_path:scenario.referenceEvidence.path,probes_to_evidence_closure:null,excess_probe_cost:null,act_abstain_correct:null,failure_category:'infrastructure_failure',task_started_at_ms:timing.started,task_ended_at_ms:endedAt,completion_time_ms:endedAt-timing.started,final_task_status:'ABORTED',task_success:null,agent_actions:0,failed_actions:0,retry_attempts:0,recovery_attempts:0,recovery_successes:0,recovery_failures:0,recovery_outcome:null,clarification_requests:0,user_interventions:0,user_takeovers:0,hints_help:0,error_type:'infrastructure_failure',recording_schema_version:RECORDING_SCHEMA_VERSION};
    writeEvent(s,attemptId,'ORACLE_CHECK',{task_success:null,oracle_success:null,assessment_reason:'browser_never_started',result:'UNASSESSABLE'});writeEvent(s,attemptId,'TASK_END',{final_task_status:'ABORTED',task_success:null,error_type:'infrastructure_failure',result:'ABORTED'});store.result(attemptId,startupResult);
   if(s.mode!=='benchmark')s.retryItem={scenario,condition,manifestIndex,attempt:{role:'participant_retry',reason:'browser_start_failure',replacesRunId:attemptId}};state(s,'BETWEEN_TASKS');
   say(s,'Tugas belum bisa dimulai karena browser lokal belum siap. Ucapkan lanjut untuk mencoba lagi, atau selesai untuk menutup sesi.','BETWEEN_TASKS');return;
  }
  if(s.epoch!==epoch){await task.server.kill();fixtures.remove(world!.id);return;}
  const metadata={...metadataBase,chromium:task.browser.version()};store.updateRunMetadata(attemptId,metadata);
  run=new AgentRun(task.page,task.browser,task.server,condition,demo?new DemoModel():new Ollama(),{
   log:(type,payload,sensitive)=>event(s,type,payload,sensitive),
   status:(phase,text)=>{emit(s,'PROGRESS',{phase,text});if(phase==='EXPLORING')scheduleWorking(s);else stopWorking(s);},
   ask:(text,confirmation)=>say(s,text,'ANSWER',confirmation),
   ack:(text)=>{if(auto)run?.resume();else say(s,text,'CONTROL');},
    finished:async(outcome:AgentOutcome,quiescent:boolean)=>{
     world.closed=true;const oracle=evaluateOutcome(world,outcome,quiescent,s.mode==='study'||s.mode==='pilot');writeEvent(s,outcome.run_id,'ORACLE_CHECK',{oracle_success:oracle.oracle_success,task_success:oracle.act_abstain_correct,assessment_reason:oracle.oracle_assessment_reason,reference_decision:oracle.reference_decision,result:oracle.act_abstain_correct===true?'PASS':oracle.act_abstain_correct===false?'FAIL':'UNASSESSABLE'});const endedAt=Date.now(),timing=store.runTiming(outcome.run_id)!;const automatic=buildTaskEvaluation(outcome,oracle,store.runEvents(outcome.run_id),timing.started,endedAt);const result={...outcome,metadata,...oracle,...automatic};
     writeEvent(s,outcome.run_id,'TASK_END',{final_task_status:automatic.final_task_status,task_success:automatic.task_success,error_type:automatic.error_type,completion_time_ms:automatic.completion_time_ms,result:automatic.final_task_status});store.result(outcome.run_id,result);fixtures.remove(world.id);s.world=undefined;s.epoch++;clearTurn(s);
    emit(s,'RESULT',{outcome,summary:narratives[outcome.agent_termination_reason]});
    if(s.state==='CLOSING'||s.state==='CLOSED'||s.mode==='benchmark')return;
    if(!quiescent){await closeSession(s);return;}
    state(s,'BETWEEN_TASKS');s.comprehension=s.mode==='study'||s.mode==='pilot';
    const selected=outcome.goal?`${outcome.selected_product?' '+outcome.selected_product.title+'.':''} Ukuran ${outcome.goal.size}, warna ${outcome.goal.color}, batas harga ${outcome.goal.maxPriceIdr.toLocaleString('id-ID')} rupiah.`:'';
    say(s,narratives[outcome.agent_termination_reason]+selected+(s.comprehension?' Menurutmu, barang apa yang dipilih dan syarat apa yang sudah atau belum terpenuhi?':' Ucapkan lanjut untuk tugas berikutnya, ulang hasil, atau selesai.'),s.comprehension?'ANSWER':'BETWEEN_TASKS',undefined,outcome.run_id);
   }
  },auto,scenario.instruction,attemptId);s.run=run;state(s,'IN_TASK');emit(s,'TASK',{instruction:scenario.instruction,index:s.index+1,total:s.mode==='study'?4:6});
  if(auto)await run.input(scenario.instruction);else say(s,scenario.instruction+' Jika sudah benar, ucapkan mulai. Kamu juga bisa langsung menyampaikan koreksi singkat.','ANSWER');
 }finally{s.starting=false;}
}
async function next(s:Session){if(s.starting)return;if(s.state!=='READY'&&s.state!=='BETWEEN_TASKS')return;if(s.comprehension){say(s,'Ceritakan singkat hasil yang kamu pahami, atau katakan lewati.');return;}
 const retry=s.retryItem;if(retry)s.retryItem=undefined;else if(s.state==='BETWEEN_TASKS')s.index++;const schedule=s.mode==='study'?studyOrder(s.slot):development.map(scenario=>({scenario,condition:'P' as Condition}));if(!retry&&s.index>=schedule.length){state(s,'FEEDBACK');say(s,'Bagian apa yang mudah atau sulit diikuti? Silakan beri masukan singkat.');return;}const item=retry??schedule[s.index];await startRun(s,item.scenario,item.condition,false,retry?.manifestIndex,retry?.attempt);}
function persistSessionEnd(s:Session){if(s.recordingStarted)writeEvent(s,null,'SESSION_RECORDING_ENDED',{ended_at_ms:Date.now(),result:s.recordingFailures?'DEGRADED':'COMPLETE'});store.close(s.id);try{store.sessionSummary(s.id,summarizeSession(s.id,store.sessionResults(s.id),s.recordingFailures));}catch{s.recordingFailures++;}}
async function closeSession(s:Session){if(s.state==='CLOSED'||s.state==='CLOSING')return;state(s,'CLOSING');s.epoch++;stopWorking(s);clearTurn(s);clearTimeout(s.timer);voice.close();await s.run?.finish('user_stopped');persistSessionEnd(s);state(s,'CLOSED');s.ws?.close();if(session===s)session=undefined;}
async function textInput(s:Session,text:string,confirmation?:string){
 const cmd=command(text);s.pendingSpeech=false;s.inputTurn=undefined;s.reprompts=0;clearTimeout(s.answerTimer);
 try{
  if(cmd==='STOP'){event(s,'user_intervention',{kind:'stop',takeover:false,result:'REQUESTED'});await closeSession(s);return;}if(cmd==='SKIP'){event(s,'user_intervention',{kind:'skip',takeover:false,result:'REQUESTED'});if(s.comprehension){s.comprehension=false;say(s,'Ucapkan lanjut untuk tugas berikutnya, ulang hasil, atau selesai.','BETWEEN_TASKS');}else await s.run?.finish('skipped');return;}
 if(cmd==='REPEAT'){if(s.lastPlayed)say(s,s.lastPlayed.text,s.lastPlayed.intent,s.lastPlayed.confirmation);return;}
 if(s.state==='READINESS'){if(/\bsiap\b/i.test(text)&&s.readyHeard){state(s,'READY');s.started=Date.now();s.timer=setTimeout(()=>void closeSession(s),LIMITS.sessionMs);say(s,'Pemeriksaan selesai. Saat saya berbicara, mikrofon ditutup. Tekan Escape kapan saja untuk berhenti. Ucapkan lanjut untuk mulai.','BETWEEN_TASKS');}else say(s,'Setelah mendengar contoh ini, ucapkan siap.');return;}
 if(s.state==='FEEDBACK'){event(s,'feedback',{text},true);say(s,'Terima kasih. Sesi penelitian selesai.','END');return;}
 if(s.comprehension&&cmd!=='NEXT'&&cmd!=='EMPTY'){event(s,'comprehension',{text},true);s.comprehension=false;say(s,'Ucapkan lanjut untuk tugas berikutnya, ulang hasil, atau selesai.','BETWEEN_TASKS');return;}
 if(cmd==='NEXT'){await next(s);return;}
 const run=s.run;if(!run||run.terminal)return;
 if(cmd==='EMPTY'){if(run.phase==='AWAITING_APPROVAL'||!run.goal){say(s,'Saya belum mendengar jawaban yang jelas. Silakan ulangi.','ANSWER',run.spokenConfirmation);}else {run.resume();emit(s,'LISTEN',{intent:'CONTROL'});}return;}
 if((cmd==='NO'||/\bbukan\s+(?:yang\s+)?(?:itu|tadi)\b/i.test(text))&&run.phase==='AWAITING_APPROVAL'){if(!run.rejectProposal())say(s,'Baik, tidak ada perubahan yang dilakukan.','CONTROL');return;}
 if(cmd==='YES'&&run.phase==='AWAITING_APPROVAL'){await run.approve(confirmation??run.spokenConfirmation??'');emit(s,'LISTEN',{intent:'CONTROL'});return;}
 emit(s,'PROCESSING',{});await run.input(text);if(!run.terminal&&run.phase!=='AWAITING_APPROVAL'&&!s.turn)emit(s,'LISTEN',{intent:'CONTROL'});
 }finally{flushDeferred(s);}
}
async function body(req:IncomingMessage,max=1_000_000){const chunks:Buffer[]=[];let size=0;for await(const c of req){size+=c.length;if(size>max)throw Error('payload_too_large');chunks.push(c);}return Buffer.concat(chunks);}
function json(res:ServerResponse,status:number,value:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
function researcherAuth(req:IncomingMessage){return equal(req.headers.authorization?.replace(/^Bearer /,'')??'',researcher);}
function auth(req:IncomingMessage){const s=session;if(!s||!equal(req.headers.authorization?.replace(/^Bearer /,'')??'',s.token))throw Error('unauthorized');return s;}
function validRequest(s:Session,id:unknown){if(typeof id!=='string'||!z.string().uuid().safeParse(id).success)throw Error('request_id_required');if(s.requests.has(id))return false;if(s.requests.size>10000)throw Error('request_limit');s.requests.add(id);return true;}
const server=createServer(async(req,res)=>{try{
 const host=req.headers.host;if(!['localhost:3050','127.0.0.1:3050'].includes(host??'')){json(res,403,{error:'host_rejected'});return;}
 const url=new URL(req.url??'/',ORIGIN);const path=url.pathname,origin=req.headers.origin;const taskRequest=path.startsWith('/task/');
 // Browser-generated form submissions can carry the opaque Origin value "null". It is accepted only inside the isolated fixture, whose unguessable HttpOnly SameSite=Strict cookie is still mandatory.
 if(origin&&origin!==ORIGIN&&origin!=='http://127.0.0.1:3050'&&!(taskRequest&&origin==='null')){json(res,403,{error:'origin_rejected'});return;}
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 if(taskRequest){const match=/^\/task\/([^/]+)(\/.*)$/.exec(path);const w=match&&fixtures.worlds.get(match[1]);if(!w||w.closed||!equal((req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('fixture_access='))?.slice(15)??'',w.secret)){json(res,403,{error:'fixture_access_denied'});return;}if(req.method==='POST'){const destination=mutateWorld(w,match![2],new URLSearchParams((await body(req,4096)).toString()));res.writeHead(303,{Location:destination});res.end();return;}const html=renderWorld(w,match![2],url.searchParams);if(!html){json(res,404,{error:'not_found'});return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;}
 if(path==='/api/readiness'&&req.method==='GET'){json(res,200,readiness());return;}
 if(path==='/api/sessions'&&req.method==='POST'){
  if(session){json(res,409,{error:'one_session_only'});return;}const b=z.object({code:z.string().regex(/^[A-Za-z0-9_-]{1,20}$/),mode:z.enum(['demo','study','pilot']),slot:z.number().int().min(0).max(3).default(0),request_id:z.string().uuid()}).parse(JSON.parse((await body(req,4096)).toString()));
  if(demo&&b.mode!=='demo'||!demo&&b.mode==='demo')throw Error('mode_mismatch');if(!demo&&!readiness().study_enabled)throw Error('readiness_required');
   const s:Session={id:randomUUID(),token:randomBytes(32).toString('hex'),code:b.code,mode:b.mode,slot:b.slot,index:0,state:'CONSENT',epoch:0,seq:0,lastHeartbeat:Date.now(),requests:new Set([b.request_id]),reprompts:0,comprehension:false,readyHeard:false,starting:false,recordingStarted:false,recordingFailures:0,pendingRecordingFailures:[]};session=s;store.session(s.id,s.code,s.mode);json(res,201,{session_id:s.id,session_token:s.token,state:s.state,epoch:s.epoch});return;
 }
 if(path==='/api/consent'&&req.method==='POST'){const s=auth(req);const b=Consent.parse(JSON.parse((await body(req,4096)).toString()));if(!validRequest(s,b.request_id)){json(res,200,{duplicate:true});return;}if(s.state!=='CONSENT')throw Error('consent_state');if(b.version!==(demo?'demo-v1':consentConfig().version))throw Error('consent_version_mismatch');store.consent(s.id,{accepted:b.accepted,adult:b.adult,version:b.version,timestamp:new Date().toISOString()});if(!b.accepted||!b.adult)await closeSession(s);else{state(s,'READINESS');say(s,'Ini contoh suara aplikasi. Setelah mikrofon diizinkan, ucapkan siap.');}json(res,200,{state:s.state});return;}
 if(path==='/api/research/results'&&req.method==='GET'){if(!researcherAuth(req))throw Error('unauthorized');const data=store.export();json(res,200,{...data,summary:summarize(data.results),paired:pairedAnalysis(data.results),active:session?{session_id:session.id,code:session.code,state:session.state,run_id:session.run?.id??null,completed:session.index,total:session.benchmarkTotal??(session.mode==='study'?4:undefined)}:null});return;}
 if(path==='/api/research/export'&&req.method==='GET'){if(!researcherAuth(req))throw Error('unauthorized');const data=store.export(url.searchParams.get('session')??undefined);if(url.searchParams.get('format')==='csv'){res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="cua-results.csv"','Cache-Control':'no-store'});res.end(csv(data.results.map((r:any)=>({...r,...r.metadata,...r.counters}))));}else json(res,200,{...data,summary:summarize(data.results),paired:pairedAnalysis(data.results)});return;}
 if(path.startsWith('/api/research/')&&req.method==='POST'){if(!researcherAuth(req))throw Error('unauthorized');const b=JSON.parse((await body(req,8192)).toString());z.string().uuid().parse(b.request_id);
  if(path==='/api/research/shutdown'){json(res,200,{stopping:true});void shutdown();return;}
  if(path==='/api/research/abort'){if(session)await closeSession(session);json(res,200,{stopped:true});return;}
  if(path==='/api/research/benchmark'){
   if(session)throw Error('one_session_only');const request=z.object({request_id:z.string().uuid(),split:z.enum(['development','main']),replacement:z.object({base:z.string(),presentation:z.enum(['EARLY','STAGED']),reason:z.string().min(5).max(500)}).strict().optional()}).strict().parse(b),split=request.split;
   if(demo&&split==='main')throw Error('main_disallows_demo');
   if(!demo&&!readiness().preflight?.passed)throw Error('preflight_required');
   const scenarioFor=(base:string,presentation:string)=>{const matches=main.filter(s=>s.base===base&&s.presentation===presentation);if(matches.length!==1)throw Error('dataset_cell_not_unique');return matches[0];};
   const fullSchedule:ScheduleItem[]=split==='main'?benchmarkManifest().map((e,manifestIndex)=>({condition:e.condition,scenario:scenarioFor(e.base,e.presentation),manifestIndex})):development.flatMap(scenario=>(['P','B1'] as Condition[]).map(condition=>({condition,scenario})));
   if(split==='main'){
    if(!existsSync('config/freeze.json'))throw Error('freeze_required');const frozen=JSON.parse(readFileSync('config/freeze.json','utf8'));
    if(frozen.config_hash!==CONFIG_HASH||frozen.prompt_hash!==PROMPT_HASH||frozen.dataset_hash!==hash(main)||frozen.lockfile_hash!==hash(readFileSync('package-lock.json','utf8')))throw Error('freeze_mismatch');
    for(const [file,digest] of Object.entries(frozen.file_hashes))if(hash(readFileSync(String(file),'utf8'))!==digest)throw Error('source_changed_after_freeze');
    const tags:any=await (await fetch('http://127.0.0.1:11435/api/tags',{signal:AbortSignal.timeout(5000)})).json();if(tags.models?.find((m:any)=>m.name===MODEL.name)?.digest!==frozen.model_digest)throw Error('model_digest_changed');
   }
   const prior=split==='main'?store.export().results.filter((r:any)=>r.metadata?.split==='main'&&!r.metadata?.demo&&r.metadata?.config_hash===CONFIG_HASH&&r.metadata?.prompt_hash===PROMPT_HASH&&r.metadata?.dataset_hash===hash(main)&&(r.metadata?.attempt_role??'original')==='original'):[];const cell=(x:{base:string;presentation:string;condition:string})=>`${x.base}|${x.presentation}|${x.condition}`;const counts=new Map<string,number>(),originalRunIds=new Map<string,string>();for(const row of prior){const key=cell(row.metadata);counts.set(key,(counts.get(key)??0)+1);originalRunIds.set(key,row.run_id);}if([...counts.values()].some(n=>n>1))throw Error('duplicate_original_cell');
   const completed=new Set(prior.map((r:any)=>cell(r.metadata)));let schedule:ScheduleItem[],initialCompleted:number,total:number,replacementPairId:string|undefined;
   if(request.replacement){if(split!=='main')throw Error('replacement_main_only');const scenario=scenarioFor(request.replacement.base,request.replacement.presentation);for(const condition of ['P','B1'] as Condition[])if((counts.get(cell({base:scenario.base,presentation:scenario.presentation,condition}))??0)!==1)throw Error('replacement_requires_original_pair');replacementPairId=randomUUID();schedule=(['P','B1'] as Condition[]).map(condition=>{const originalCell=cell({base:scenario.base,presentation:scenario.presentation,condition});return {scenario,condition,attempt:{role:'replacement',pairId:replacementPairId,reason:request.replacement!.reason,replacesRunId:originalRunIds.get(originalCell)}};});initialCompleted=0;total=2;}
   else{schedule=fullSchedule.filter(item=>!completed.has(cell({base:item.scenario.base,presentation:item.scenario.presentation,condition:item.condition})));initialCompleted=completed.size;total=fullSchedule.length;}
   if(!schedule.length)throw Error(split==='main'?'main_complete':'benchmark_complete');
    const s:Session={id:randomUUID(),token:randomBytes(32).toString('hex'),code:'SYNTHETIC',mode:'benchmark',slot:0,index:initialCompleted,state:'READY',epoch:0,seq:0,lastHeartbeat:Date.now(),requests:new Set([b.request_id]),reprompts:0,comprehension:false,readyHeard:true,starting:false,benchmarkTotal:total,recordingStarted:false,recordingFailures:0,pendingRecordingFailures:[]};session=s;store.session(s.id,s.code,s.mode);
   json(res,202,{session_id:s.id,remaining:schedule.length,completed:initialCompleted,total,split,demo,replacement_pair_id:replacementPairId??null,status:request.replacement?'replacement_started':initialCompleted?'resumed':'started'});
   void(async()=>{try{for(const item of schedule){if(session!==s||s.state==='CLOSING'||s.state==='CLOSED')break;await startRun(s,item.scenario,item.condition,true,item.manifestIndex,item.attempt);await s.run?.done;s.index++;}}catch(e){event(s,'benchmark_failure',{detail:e instanceof Error?e.message:'failed'});}finally{await closeSession(s);}})();return;
  }
  if(path==='/api/research/delete'){const id=z.string().uuid().parse(b.session_id);if(session?.id===id)throw Error('active_session_cannot_delete');json(res,200,store.deleteSession(id));return;}
   if(path==='/api/research/intervention'){if(!session)throw Error('no_session');const intervention=z.object({kind:z.enum(['technical','content']),note:z.string().max(500),takeover:z.boolean().default(false),help:z.boolean().default(false)}).parse(b.intervention);event(session,'researcher_intervention',{...intervention,result:'RECORDED'},true);json(res,200,{recorded:true});return;}
 }
 if(path.startsWith('/api/')){json(res,404,{error:'not_found'});return;}
 const distRoot=resolve('dist');const file=path.startsWith('/assets/')?resolve(distRoot,'.'+path):resolve(distRoot,'index.html');const rel=relative(distRoot,file);if(rel.startsWith('..')||isAbsolute(rel)||!existsSync(file)){res.writeHead(503,{'Content-Type':'text/plain'});res.end('Jalankan npm run build terlebih dahulu.');return;}res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'");res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html'} as any)[extname(file)]??'application/octet-stream'});res.end(readFileSync(file));
 }catch(e){json(res,e instanceof Error&&e.message==='unauthorized'?401:400,{error:e instanceof Error?e.message:'request_failed'});}});
const wss=new WebSocketServer({noServer:true,maxPayload:900000});
server.on('upgrade',(req,socket,head)=>{if(!['localhost:3050','127.0.0.1:3050'].includes(req.headers.host??'')||![ORIGIN,'http://127.0.0.1:3050'].includes(req.headers.origin??'')||req.url!=='/events'){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
wss.on('connection',(ws:WebSocket)=>{let bound:Session|undefined;const authTimer=setTimeout(()=>ws.close(),2500);
 ws.on('message',async raw=>{try{const m=JSON.parse(raw.toString());if(!bound){const s=session;if(m.type!=='AUTH'||!s||!equal(m.token??'',s.token)||s.ws)throw Error('unauthorized');bound=s;s.ws=ws;s.lastHeartbeat=Date.now();clearTimeout(authTimer);emit(s,'STATE',{state:s.state});if(s.turn)emit(s,'PREPARE_PLAY',s.turn);return;}
  const s=bound;if(session!==s||s.state==='CLOSED')return;if(m.type==='HEARTBEAT'){s.lastHeartbeat=Date.now();return;}
  if(!validRequest(s,m.request_id))return;
  // STOP is accepted irrespective of stale epochs and fenced synchronously.
  if(m.type==='STOP'){s.epoch++;void closeSession(s);return;}
  if(m.session_id!==s.id||m.epoch!==s.epoch||m.goal_revision!==(s.run?.goal?.revision??0)||m.run_id!==(s.run?.terminal?null:s.run?.id??null)){emit(s,'REJECTED',{reason:'stale_envelope'});return;}
  emit(s,'ACK',{request_id:m.request_id});
  if(m.type==='PLAY_READY'){await playReady(s,m.turn_id);return;}
  if(m.type==='PLAYED'){played(s,m.turn_id);return;}
  if(m.type==='PLAY_FAILED'){event(s,'delivery_incident',{turn_id:m.turn_id});if(s.turn?.resultRun)store.delivery(s.turn.resultRun,false);await s.run?.finish('infrastructure_failed','audio_playback_failed');emit(s,'AUDIO_ERROR',{text:'Audio tidak dapat diputar. Minta bantuan peneliti atau tekan Escape.'});return;}
  if(m.type==='SPEECH_ONSET'){s.inputTurn=z.string().uuid().parse(m.turn_id);if(s.turn?.ready){emit(s,'REJECTED',{reason:'half_duplex_playing'});return;}if(s.turn){const cancelled=s.turn.id;clearTurn(s);emit(s,'TURN_CANCELLED',{turn_id:cancelled,reason:'speech_onset'});s.inputTurn=m.turn_id;}s.pendingSpeech=true;clearTimeout(s.answerTimer);s.run?.hold();emit(s,'INPUT_HOLD');return;}
  if(m.type==='CONTROL'){const cmd=z.enum(['REPEAT','SKIP','NEXT']).parse(m.command);if(cmd==='REPEAT'&&!s.run?.terminal)s.run?.hold();await textInput(s,({REPEAT:'ulang',SKIP:'lewati',NEXT:'lanjut'})[cmd]);return;}
  if(m.type==='TEXT'){if(!demo)throw Error('typed_input_demo_only');await textInput(s,z.string().max(2000).parse(m.text),m.confirmation);return;}
  if(m.type==='PCM'){if(m.turn_id!==s.inputTurn){emit(s,'REJECTED',{reason:'stale_audio_turn'});return;}if(!s.pendingSpeech||m.turn_id!==s.inputTurn||m.truncated){s.pendingSpeech=false;say(s,'Ucapan terpotong. Tolong ulangi dengan singkat.');return;}const pcm=z.string().max(854000).parse(m.pcm);const epoch=s.epoch;const run=s.run;const revision=run?.epoch;try{const result=await voice.request('stt',{pcm});if(s.epoch!==epoch||run&&run.epoch!==revision)return;await textInput(s,result.text,m.confirmation);}catch{if(s.epoch!==epoch)return;event(s,'voice_failure',{engine:'stt'});await run?.finish('infrastructure_failed','stt_unavailable');}return;}
  if(m.type==='MIC_FAILED'){event(s,'researcher_intervention',{kind:'technical',incident:'microphone_permission_failed',takeover:false,help:true,result:'RECORDED'});emit(s,'AUDIO_ERROR',{text:'Izin mikrofon belum tersedia. Gunakan Tab untuk ke tombol berhenti; minta peneliti memeriksa izin Chrome.'});return;}
 }catch(e){ws.send(JSON.stringify({type:'ERROR',payload:{text:e instanceof Error?e.message:'invalid_message'}}));}});
 ws.on('close',()=>{clearTimeout(authTimer);const s=bound;if(s&&s.state!=='CLOSED'&&s.state!=='CLOSING'){s.epoch++;state(s,'CLOSING');clearTurn(s);voice.close();void (async()=>{await s.run?.finish('infrastructure_failed','participant_disconnected');persistSessionEnd(s);s.state='CLOSED';if(session===s)session=undefined;})();}});
});
const heartbeat=setInterval(()=>{const s=session;if(s&&s.ws&&s.mode!=='benchmark'&&Date.now()-s.lastHeartbeat>LIMITS.disconnectMs){s.run?.hold();s.ws.terminate();}},LIMITS.heartbeatMs);
const retention=setInterval(()=>store.purge(),86400000);
server.listen(3050,'127.0.0.1',()=>{console.log(`Ruang Akses: ${ORIGIN}/study · ${demo?'DEMO — bukan hasil penelitian':'engine lokal'}`);});
async function shutdown(){if(closing)return;closing=true;clearInterval(heartbeat);clearInterval(retention);if(session)await closeSession(session);voice.close();wss.close();server.close();store.db.close();}
process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
