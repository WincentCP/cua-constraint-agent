import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {hash,LIMITS,MODEL} from '../core/config.ts';
import {PROBE_PROMPT} from '../agent/planner.ts';
import {main,development} from '../fixture/dataset.ts';

export const VERSIONS={experiment:'5.0-automated',goal_loader:'canonical-v1',dataset:'synthetic-v2',website:'semantic-v2',probe_generator:'shared-routes-v2',verifier:'fresh-state-v2',oracle:'private-reference-v2',metrics:'four-primary-v1',recovery:'one-shared-recovery-v1'};
// Recording the freeze itself in git must not invalidate unchanged executable files.
export function configurationHash(config:{identity:unknown;runtime:any;model:unknown}){
 const {git_commit,...runtime}=config.runtime;
 return hash({identity:config.identity,runtime,model:config.model});
}
function files(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${dir}/${e.name}`):[`${dir}/${e.name}`]);}
export function implementationIdentity(){
 const paths=[...files('src'),...files('scripts'),'package.json','package-lock.json','config/protocol.json'].sort();
 const file_hashes=Object.fromEntries(paths.map(path=>[path,hash(readFileSync(path,'utf8'))]));
 return {versions:VERSIONS,model:MODEL,limits:LIMITS,prompt_hash:hash(PROBE_PROMPT),dataset_hash:hash({main,development}),file_hashes};
}
export function localEndpoint(value:string){
 const u=new URL(value);
 if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Ollama must use a local HTTP origin');
 return u.origin;
}
export async function modelInfo(endpoint:string){
 const get=async(path:string)=>{const r=await fetch(`${localEndpoint(endpoint)}${path}`,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error(`Ollama ${path}: HTTP ${r.status}`);return r.json() as Promise<any>;};
 const tags=await get('/api/tags'),match=tags.models?.find((m:any)=>m.name===MODEL.name||m.model===MODEL.name);
 if(!match?.digest)throw Error(`Model ${MODEL.name} belum terpasang. Jalankan: ollama pull ${MODEL.name}`);
 return {name:MODEL.name,digest:match.digest,ollama_version:(await get('/api/version')).version};
}
export function runtimeInfo(){
 let commit:string|null=null;try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
 const executable=process.env.CHROMIUM_PATH??chromium.executablePath();
 return {node:process.version,platform:process.platform,architecture:process.arch,git_commit:commit,chromium_path:executable,chromium_sha256:hash(readFileSync(executable).toString('base64'))};
}
