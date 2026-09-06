import {spawn,spawnSync,type ChildProcess} from 'node:child_process';import {existsSync,mkdirSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import net from 'node:net';import {randomUUID} from 'node:crypto';
import {CONFIG_HASH,MODEL} from '../src/core/config.ts';import {PROMPT_HASH} from '../src/agent/planner.ts';
if(Number(process.versions.node.split('.')[0])<24)throw Error(`Node.js 24+ diperlukan; yang aktif ${process.version}. Aktifkan Node 24 lalu jalankan npm start lagi.`);
if(existsSync('.env'))process.loadEnvFile('.env');mkdirSync('.runtime',{recursive:true,mode:0o700});
const portFree=(port:number)=>new Promise<void>((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(Error(`Port ${port} sudah dipakai. Tidak menghentikan proses lain.`)));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve()));});
await portFree(3050);await portFree(11435);
const build=spawnSync('npm',['run','build'],{stdio:'inherit',shell:process.platform==='win32'});if(build.status!==0)process.exit(1);
const owned:ChildProcess[]=[];const ownerToken=randomUUID();let stopping=false;
function stop(){if(stopping)return;stopping=true;for(const p of [...owned].reverse())p.kill('SIGTERM');if(existsSync('.runtime/owned.json'))unlinkSync('.runtime/owned.json');}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
const ollama=spawn('ollama',['serve'],{stdio:['ignore','ignore','inherit'],env:{...process.env,OLLAMA_HOST:'127.0.0.1:11435',OLLAMA_NO_CLOUD:'1'}});owned.push(ollama);ollama.on('error',e=>{console.error('Ollama tidak dapat dijalankan:',e.message);stop();});
let ready=false;for(let i=0;i<20&&!stopping;i++){try{const r=await fetch('http://127.0.0.1:11435/api/tags',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
if(ready){let tags:any;try{tags=await (await fetch('http://127.0.0.1:11435/api/tags',{signal:AbortSignal.timeout(5000)})).json();}catch{}const digest=tags?.models?.find((m:any)=>m.name===MODEL.name)?.digest;let cached:any;try{cached=JSON.parse(readFileSync('data/preflight.json','utf8'));}catch{}const cacheValid=!process.argv.includes('--full-preflight')&&cached?.passed===true&&cached?.config_hash===CONFIG_HASH&&cached?.prompt_hash===PROMPT_HASH&&cached?.model_digest===digest;
 if(cacheValid)console.log(`Preflight tersimpan masih valid (${cached.created}). Gunakan npm run start:full untuk pemeriksaan penuh.`);else{const preflight=spawnSync(process.execPath,['--import','tsx','scripts/preflight.ts'],{stdio:'inherit',env:{...process.env,OLLAMA_HOST:'127.0.0.1:11435',OLLAMA_NO_CLOUD:'1'}});if(preflight.status!==0){ready=false;console.error('Preflight belum lulus. Lihat data/preflight.json dan docs/SETUP.md.');}}}
if(!ready){console.error('Layanan lokal belum siap; startup dihentikan.');stop();process.exitCode=1;}else{
 const backend=spawn(process.execPath,['--import','tsx','src/server.ts'],{stdio:'inherit',env:{...process.env,OLLAMA_HOST:'127.0.0.1:11435',OLLAMA_NO_CLOUD:'1'}});owned.push(backend);
 writeFileSync('.runtime/owned.json',JSON.stringify({supervisor:process.pid,owned:owned.map(p=>p.pid),owner_token:ownerToken,created:new Date().toISOString()}),{mode:0o600});
 backend.on('exit',()=>stop());console.log('Buka http://localhost:3050/study dan http://localhost:3050/research. npm run stop menutup proses milik aplikasi ini.');
 const browserCommand=process.platform==='darwin'?'open':process.platform==='win32'?'cmd':'xdg-open';const browserArgs=process.platform==='win32'?['/c','start','','http://localhost:3050/study']:['http://localhost:3050/study'];const opener=spawn(browserCommand,browserArgs,{stdio:'ignore'});opener.on('error',()=>{});
}
