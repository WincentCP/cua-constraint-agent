import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import {DemoModel} from '../src/agent/demo-model.ts';
import {Ollama} from '../src/agent/planner.ts';
import {hash,MODEL} from '../src/core/config.ts';
import {implementationIdentity,localEndpoint,modelInfo,runtimeInfo,configurationHash} from '../src/experiment/config.ts';
import {loadTask,manifest,validateDataset,type Workflow} from '../src/experiment/tasks.ts';
import {exportResults,runExperiment} from '../src/experiment/runner.ts';
import {developmentGate} from '../src/experiment/metrics.ts';

const help=`CUA automated research experiment

npm run experiment -- validate
npm run experiment -- doctor [--ollama http://127.0.0.1:11434]
npm run experiment -- episode --task development-01 --presentation STAGED --policy P [--demo]
npm run experiment -- development [--demo]
npm run experiment -- repeatability [--demo]
npm run experiment -- freeze --gate exports/repeatability-... --out config/experiment-freeze.json
npm run experiment -- main --freeze config/experiment-freeze.json [--policy P|B1]
npm run experiment -- main --demo
npm run experiment -- metrics --input exports/main-...
npm run experiment -- export --input exports/main-...

Run options: --out DIRECTORY, --ollama LOCAL_ORIGIN. Every run uses a new directory.
--demo is a deterministic plumbing check and can never pass the research gate.
Main without --demo requires a real repeatability gate and matching frozen configuration.
No web UI, SQLite, microphone, voice worker or participant study is required.`;

async function main(){
 const {values,...parsed}=parseArgs({allowPositionals:true,options:{help:{type:'boolean'},demo:{type:'boolean'},out:{type:'string'},input:{type:'string'},task:{type:'string'},presentation:{type:'string'},policy:{type:'string'},ollama:{type:'string'},freeze:{type:'string'},gate:{type:'string'}}});
 const command=parsed.positionals[0]??'help';
 if(values.help||command==='help'){console.log(help);return;}
 if(parsed.positionals.length!==1)throw Error('Expected one command. Use --help.');
 // Source hashing and relative data paths always use the repository root.
 const caller=process.cwd(),absolute=(p:string)=>resolve(caller,p);
 process.chdir(fileURLToPath(new URL('..',import.meta.url)));
 if(values.policy&&!['P','B1'].includes(values.policy))throw Error('--policy must be P or B1');
 if(values.presentation&&!['EARLY','STAGED'].includes(values.presentation))throw Error('--presentation must be EARLY or STAGED');
 if(command==='metrics'||command==='export'){
  if(!values.input)throw Error('--input directory required');
  const {metrics}=exportResults(absolute(values.input));console.log(JSON.stringify(metrics.groups,null,2));return;
 }
 const validation=validateDataset();
 if(command==='validate'){console.log(JSON.stringify(validation,null,2));if(!validation.passed)process.exitCode=1;return;}
 if(!validation.passed)throw Error(validation.errors.join('\n'));
 const endpoint=localEndpoint(values.ollama??'http://127.0.0.1:11434');
 if(command==='doctor'){
  const checks:Record<string,unknown>={node:process.version,dataset:validation,ollama_endpoint:endpoint};
  let passed=Number(process.versions.node.split('.')[0])>=24;
  try{checks.model=await modelInfo(endpoint);}catch(e){passed=false;checks.model={error:String(e)};}
  try{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});try{checks.chromium=b.version();}finally{await b.close();}}catch(e){passed=false;checks.chromium={error:String(e)};}
  console.log(JSON.stringify({passed,checks},null,2));if(!passed)process.exitCode=1;return;
 }
 if(!['episode','development','repeatability','main','freeze'].includes(command))throw Error(`Unknown command: ${command}`);
 const identity=implementationIdentity(),runtime=runtimeInfo();
 if(command==='freeze'){
  if(values.demo||!values.gate)throw Error('Freeze requires --gate DIRECTORY with real repeatability results');
  const dir=absolute(values.gate),gateConfig=JSON.parse(readFileSync(`${dir}/experiment-config.json`,'utf8'));
  const {rows}=exportResults(dir),gate=developmentGate(rows,gateConfig.manifest),model=await modelInfo(endpoint);
  const current={identity,runtime,model};
  if(!gate.passed||gateConfig.workflow!=='repeatability')throw Error('Real baseline competence / 24-episode repeatability gate has not passed');
  if(gateConfig.config_hash!==configurationHash(current))throw Error('Implementation, runtime or model changed since the gate; rerun repeatability');
  const path=values.out?absolute(values.out):resolve('config/experiment-freeze.json');
  if(existsSync(path))throw Error('Freeze already exists; use an explicit new version/path');
  mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify({schema_version:1,frozen_at:new Date().toISOString(),...current,config_hash:configurationHash(current),gate_directory:dir,gate_hash:hash(rows),gate,manifest:manifest('main')},null,2),'utf8');console.log(`Frozen configuration: ${path}`);return;
 }
 const workflow=command as Workflow;
 if(workflow==='main'&&(values.task||values.presentation))throw Error('Main uses its saved 64-cell manifest; only --policy may filter it');
 if(workflow==='repeatability'&&values.policy)throw Error('Repeatability requires both policies');
 const specs=manifest(workflow,{task:values.task,presentation:values.presentation as any,policy:values.policy as any});
 for(const spec of specs)loadTask(spec.task_id,spec.presentation);
 const model=values.demo?{name:'DemoModel',digest:'synthetic-demo',ollama_version:null}:await modelInfo(endpoint);
 const current={identity,runtime,model},configHash=configurationHash(current);
 let frozen:any=null;
 if(workflow==='main'&&!values.demo){
  if(!values.freeze)throw Error('Main requires --freeze FILE; use repeatability then freeze first');
  frozen=JSON.parse(readFileSync(absolute(values.freeze),'utf8'));
  if(frozen.config_hash!==configHash||!frozen.gate?.passed||hash(frozen.manifest)!==hash(manifest('main')))throw Error('Frozen implementation/model/runtime/manifest does not match');
 }
 const out=values.out?absolute(values.out):resolve(`exports/${workflow}-${values.demo?'demo-':''}${new Date().toISOString().replace(/[:.]/g,'-')}`);
 const config={schema_version:1,created_at:new Date().toISOString(),workflow,demo:Boolean(values.demo),...current,config_hash:configHash,ollama_endpoint:values.demo?null:endpoint,validation,manifest:specs,frozen,
  scope:'Automated synthetic local e-commerce. No participant study or voice.',main_invalid_after_fundamental_bug:true};
 console.log(`Output: ${out}\nMode: ${values.demo?'DEMO (not research results)':MODEL.name}\nEpisodes: ${specs.length}`);
 const {metrics}=await runExperiment({directory:out,config,model:values.demo?new DemoModel():new Ollama(endpoint),onProgress:(row,i,total)=>console.log(`[${i}/${total}] ${row.spec.cell_id} ${row.result.agent_termination_reason}`)});
 console.log(JSON.stringify({complete:metrics.complete,attempted:metrics.attempted,unattempted:metrics.unattempted,groups:metrics.groups,output:out},null,2));
 if(!metrics.complete||metrics.groups.some(g=>g.infrastructure_failed>0))process.exitCode=1;
 if(workflow==='repeatability'){
  const gate=JSON.parse(readFileSync(`${out}/development-gate.json`,'utf8'));console.log(`Research gate: ${gate.passed?'PASS':values.demo?'DEMO ONLY':'NOT PASSED'}`);if(!values.demo&&!gate.passed)process.exitCode=1;
 }
}
main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;});
