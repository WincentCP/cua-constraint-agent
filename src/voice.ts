import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {randomUUID} from 'node:crypto';
import {LIMITS} from './core/config.ts';
import {speechText} from './core/indonesian.ts';
export class Voice {
 private child?:ChildProcessWithoutNullStreams;private pending=new Map<string,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:NodeJS.Timeout}>();
 constructor(public onIncident:(type:string,payload:unknown)=>void=()=>{}){}
 private start(){if(this.child)return;const child=spawn(process.env.PYTHON||'.venv/bin/python',['workers/voice.py'],{stdio:'pipe',env:{...process.env,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1'}});this.child=child;let outputBytes=0;
  createInterface({input:child.stdout}).on('line',line=>{outputBytes+=line.length;if(outputBytes>12_000_000){this.close();return;}try{const r=JSON.parse(line);const p=this.pending.get(r.id);if(p){clearTimeout(p.timer);this.pending.delete(r.id);r.ok?p.resolve(r):p.reject(Error(r.error));}}catch{/* No partial result is accepted. */}finally{outputBytes=0;}});
  child.stderr.on('data',()=>{});const failed=()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('voice_worker_unavailable'));}this.pending.clear();if(this.child===child)this.child=undefined;};child.on('error',failed);child.on('exit',failed);
 }
 private once(op:string,input:unknown,ms:number):Promise<any>{this.start();const id=randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error(`${op}_timeout`));this.close();},ms);this.pending.set(id,{resolve,reject,timer});this.child!.stdin.write(JSON.stringify({id,op,...input as object})+'\n',e=>{if(e){clearTimeout(timer);this.pending.delete(id);reject(e);}});});}
 async request(op:'stt'|'tts'|'health',input:unknown){if(op==='tts')input={...input as object,text:speechText((input as {text:string}).text)};let failure:unknown;for(let attempt=0;attempt<2;attempt++){try{return await this.once(op,input,op==='stt'?LIMITS.sttMs:LIMITS.ttsMs);}catch(e){failure=e;if(attempt===0)this.onIncident('voice_worker_restart',{op,reason:e instanceof Error?e.message:'worker_failure'});}}throw failure;}
 close(){const child=this.child;this.child=undefined;child?.kill('SIGKILL');for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('voice_cancelled'));}this.pending.clear();}
}
