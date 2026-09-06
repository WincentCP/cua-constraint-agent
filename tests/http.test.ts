import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {resolve} from 'node:path';import {mkdtempSync,mkdirSync} from 'node:fs';
test('HTTP smoke: loopback API, locked research, tokens, origin policy and consent',async()=>{
 mkdirSync('.runtime/tests',{recursive:true});const dir=mkdtempSync(resolve('.runtime/tests/http-'));const token='synthetic-test-token-not-a-real-credential';
 const child=spawn(process.execPath,['--import','tsx','src/server.ts','--demo'],{cwd:process.cwd(),env:{...process.env,DATA_PATH:`${dir}/test.sqlite`,RESEARCHER_TOKEN:token},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('server_start_timeout')),5000);child.stdout.on('data',chunk=>{if(chunk.toString().includes('Ruang Akses:')){clearTimeout(timeout);resolve();}});child.on('exit',code=>{clearTimeout(timeout);reject(Error(`server exited ${code}`));});child.on('error',reject);});
  const base='http://127.0.0.1:3050';const health=await (await fetch(`${base}/api/readiness`)).json() as any;assert.equal(health.demo,true);assert.equal(health.study_enabled,false);
  assert.equal((await fetch(`${base}/study`)).status,200);
  assert.equal((await fetch(`${base}/api/research/results`)).status,401);
  assert.equal((await fetch(`${base}/api/readiness`,{headers:{Origin:'https://attacker.example'}})).status,403);
  assert.equal((await fetch(`${base}/task/unknown/`)).status,403);
  const created=await fetch(`${base}/api/sessions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'TEST',mode:'demo',slot:0,request_id:crypto.randomUUID()})});assert.equal(created.status,201);const session=await created.json() as any;
  const rejected=await fetch(`${base}/api/consent`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.session_token}`},body:JSON.stringify({accepted:false,adult:true,version:'demo-v1',request_id:crypto.randomUUID()})});assert.equal(rejected.status,200);assert.equal((await rejected.json() as any).state,'CLOSED');
  const records=await (await fetch(`${base}/api/research/results`,{headers:{Authorization:`Bearer ${token}`}})).json() as any;assert.equal(records.sessions.length,1);assert.equal(JSON.parse(records.sessions[0].consent).accepted,false);assert.equal(records.events.filter((e:any)=>e.type==='transcript').length,0);
 }finally{child.kill('SIGTERM');await new Promise<void>(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',()=>resolve());});}
});
