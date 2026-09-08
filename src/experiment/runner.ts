import {randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readdirSync,readFileSync,writeFileSync,openSync,writeSync,fsyncSync,closeSync,unlinkSync} from 'node:fs';
import {AgentRun,type AgentOutcome} from '../agent/run.ts';
import {type LocalModel} from '../agent/planner.ts';
import {openTask} from '../browser/task-browser.ts';
import {fixtureHarness} from '../fixture/harness.ts';
import {evaluateOutcome} from '../evaluation/oracle.ts';
import {csv as renderCsv} from '../evaluation/report.ts';
import {loadTask,type EpisodeSpec} from './tasks.ts';
import {calculateMetrics,developmentGate,episodeMetrics,type Episode,type TraceEvent} from './metrics.ts';

function append(path:string,value:unknown){const fd=openSync(path,'a');try{writeSync(fd,JSON.stringify(value)+'\n');fsyncSync(fd);}finally{closeSync(fd);}}
function save(path:string,value:unknown){writeFileSync(path,JSON.stringify(value,null,2)+'\n');}
export function readJsonLines<T>(path:string):T[]{return existsSync(path)?readFileSync(path,'utf8').split('\n').filter(s=>s.trim()).map(s=>JSON.parse(s) as T):[];}
export function failureResult(detail:string){return {agent_termination_reason:'infrastructure_failed',detail,oracle_success:null,act_abstain_correct:null,verification_status:'UNKNOWN',counters:{probes:0,actions:0,llmCalls:0,recoveries:0,informativeProbes:0,evidenceClosureProbe:null},task_wall_ms:0};}
export function exportResults(dir:string){
 if(existsSync(`${dir}/.running.json`)){
  const {pid}=JSON.parse(readFileSync(`${dir}/.running.json`,'utf8'));let alive=false;
  try{process.kill(pid,0);alive=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')throw e;}
  if(alive)throw Error('Experiment is still running; export after it finishes');
 }
 const config=JSON.parse(readFileSync(`${dir}/experiment-config.json`,'utf8'));
 const rows=readJsonLines<Episode>(`${dir}/episodes.jsonl`);
 const events=readJsonLines<TraceEvent>(`${dir}/events.jsonl`);
 for(const start of events.filter(e=>e.type==='EPISODE_START'))if(!rows.some(r=>r.episode_id===start.episode_id)){
  const interrupted:Episode={episode_id:start.episode_id,spec:start.payload.spec,kind:start.payload.kind,demo:config.demo,config_hash:config.config_hash,status:'infrastructure_failed',result:failureResult('process_interrupted'),events:events.filter(e=>e.episode_id===start.episode_id)};
  rows.push(interrupted);append(`${dir}/episodes.jsonl`,interrupted);
 }
 // Only missing interrupted attempts are appended; existing outcomes are never replaced.
 const metrics=calculateMetrics(rows,config.manifest);
 save(`${dir}/metrics.json`,metrics);writeFileSync(`${dir}/metrics.csv`,renderCsv(rows.map(episodeMetrics))+'\n');
 save(`${dir}/failures.json`,rows.filter(r=>episodeMetrics(r).failure_type).map(r=>({episode_id:r.episode_id,spec:r.spec,failure_type:episodeMetrics(r).failure_type,detail:r.result.detail,termination_reason:r.result.agent_termination_reason})));
 if(config.workflow==='repeatability')save(`${dir}/development-gate.json`,{...developmentGate(rows,config.manifest),config_hash:config.config_hash});
 return {metrics,rows};
}

export async function runExperiment(options:{directory:string;config:any;model:LocalModel;onProgress?:(row:Episode,index:number,total:number)=>void}){
 const {directory:dir,config,model}=options;
 if(existsSync(dir)&&readdirSync(dir).length)throw Error('Output directory must be empty; previous attempts are never overwritten');
 if(config.demo!==model.demo)throw Error('Model mode does not match experiment configuration');
 mkdirSync(dir,{recursive:true});save(`${dir}/experiment-config.json`,config);
 writeFileSync(`${dir}/episodes.jsonl`,'');writeFileSync(`${dir}/events.jsonl`,'');
 save(`${dir}/.running.json`,{pid:process.pid});
 let harness:Awaited<ReturnType<typeof fixtureHarness>>|undefined;
 let setupError:string|undefined;try{harness=await fixtureHarness();}catch(e){setupError=e instanceof Error?e.message:String(e);}
 let active:AgentRun|undefined,stopped=false;
 const stop=()=>{stopped=true;if(active)void active.finish('infrastructure_failed','process_interrupted');};
 process.on('SIGINT',stop);process.on('SIGTERM',stop);
 try{
  for(const [index,spec] of (config.manifest as EpisodeSpec[]).entries()){
   if(stopped)break;
   const scenario=loadTask(spec.task_id,spec.presentation),id=randomUUID(),events:TraceEvent[]=[];
   const log=(type:string,payload:unknown)=>{const e={timestamp:new Date().toISOString(),episode_id:id,type,payload};append(`${dir}/events.jsonl`,e);events.push(e);};
   // An attempt is durable BEFORE environment creation or browser startup.
   log('EPISODE_START',{spec,kind:scenario.kind,config_hash:config.config_hash});
   let result:any;let world:ReturnType<NonNullable<typeof harness>['fixtures']['create']>|undefined;
   let task:Awaited<ReturnType<typeof openTask>>|undefined;
   try{
    if(!harness)throw Error(setupError??'environment_start_failed');
    world=harness.fixtures.create(scenario);
    const privateWorld=world;
    task=await openTask(world.id,world.secret,()=>{if(active)void active.finish('execution_failed','browser_scope_violation');},process.env.CHROMIUM_PATH);
    if(stopped)throw Error('process_interrupted');
    active=new AgentRun(task.page,task.browser,task.server,spec.policy,model,{
     log,status:phase=>log('PHASE',{phase}),ask:()=>{},finished:async(outcome,quiescent)=>{
      privateWorld.closed=true;
      // Agent outcome is frozen and browser is closed before the evaluator reads private truth.
      const frozen=structuredClone(outcome);log('OUTCOME_FROZEN',{outcome:frozen,quiescent});
      const evaluation=evaluateOutcome(privateWorld,frozen,quiescent);log('ORACLE_CHECK',evaluation);
      result={...frozen,...evaluation};
     }
    },true,scenario.instruction,id);
    await active.startCanonical(structuredClone(scenario.goal));await active.done;
    if(!result)throw Error('missing_terminal_result');
   }catch(e){
    if(active&&!active.terminal)await active.finish('infrastructure_failed',e instanceof Error?e.message:String(e));
    if(!result)result=failureResult(e instanceof Error?e.message:String(e));
   }finally{
    active=undefined;
    if(task)await task.server.kill().catch(()=>{});
    if(world){world.closed=true;harness?.fixtures.worlds.delete(world.id);}
   }
   const row:Episode={episode_id:id,spec,kind:scenario.kind,demo:model.demo,config_hash:config.config_hash,status:result.agent_termination_reason==='infrastructure_failed'?'infrastructure_failed':'completed',result,events};
   log('EPISODE_END',{status:row.status,metrics:episodeMetrics(row)});append(`${dir}/episodes.jsonl`,row);
   options.onProgress?.(row,index+1,config.manifest.length);
  }
 }finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);try{if(harness)await harness.close();}finally{unlinkSync(`${dir}/.running.json`);exportResults(dir);}}
 return exportResults(dir);
}
