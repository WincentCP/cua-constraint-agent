import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
export class Store {
 db:DatabaseSync;
 constructor(path:string){mkdirSync(dirname(path),{recursive:true,mode:0o700});this.db=new DatabaseSync(path);chmodSync(path,0o600);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;
 CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,code TEXT,mode TEXT,created INTEGER,ended INTEGER,consent TEXT);
 CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,metadata TEXT,started INTEGER,ended INTEGER);
 CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,run_id TEXT,created INTEGER,retention TEXT,type TEXT,payload TEXT);
 CREATE TABLE IF NOT EXISTS run_results(run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,result TEXT);
 `);this.recover();this.purge();}
 recover(){const now=Date.now();for(const r of this.db.prepare('SELECT id FROM runs WHERE ended IS NULL').all() as any[]){this.db.prepare('INSERT OR REPLACE INTO run_results VALUES (?,?)').run(r.id,JSON.stringify({run_id:r.id,agent_termination_reason:'infrastructure_failed',detail:'process_interrupted',agent_claimed_success:false,oracle_success:null,oracle_assessment_reason:'quiescence_unknown',completion_audio_delivered:null}));this.db.prepare('UPDATE runs SET ended=? WHERE id=?').run(now,r.id);}this.db.prepare('UPDATE sessions SET ended=? WHERE ended IS NULL').run(now);}
 session(id:string,code:string,mode:string){this.db.prepare('INSERT INTO sessions(id,code,mode,created) VALUES (?,?,?,?)').run(id,code,mode,Date.now());}
 consent(id:string,value:unknown){this.db.prepare('UPDATE sessions SET consent=? WHERE id=?').run(JSON.stringify(value),id);}
 close(id:string){this.db.prepare('UPDATE sessions SET ended=? WHERE id=?').run(Date.now(),id);}
 run(id:string,session:string,metadata:unknown){this.db.prepare('INSERT INTO runs(id,session_id,metadata,started) VALUES (?,?,?,?)').run(id,session,JSON.stringify(metadata),Date.now());}
 event(session:string,run:string|null,type:string,payload:unknown,sensitive=false,synthetic=false){const r=this.db.prepare('INSERT INTO events(session_id,run_id,created,retention,type,payload) VALUES (?,?,?,?,?,?)').run(session,run,Date.now(),synthetic?'synthetic':sensitive?'verbatim':'semantic',type,JSON.stringify(payload));return Number(r.lastInsertRowid);}
 result(run:string,value:unknown){this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('INSERT INTO run_results VALUES (?,?)').run(run,JSON.stringify(value));this.db.prepare('UPDATE runs SET ended=? WHERE id=?').run(Date.now(),run);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}}
 delivery(run:string,delivered:boolean){const row=this.db.prepare('SELECT result FROM run_results WHERE run_id=?').get(run) as any;if(row){const r=JSON.parse(row.result);r.completion_audio_delivered=delivered;this.db.prepare('UPDATE run_results SET result=? WHERE run_id=?').run(JSON.stringify(r),run);}}
 purge(now=Date.now()){
  const day=86400000;this.db.prepare(`DELETE FROM events WHERE retention='verbatim' AND session_id IN (SELECT id FROM sessions WHERE COALESCE(ended,created)<?)`).run(now-30*day);
  this.db.prepare(`DELETE FROM sessions WHERE mode IN ('study','pilot') AND COALESCE(ended,created)<?`).run(now-90*day);
 }
 deleteSession(id:string){this.db.prepare('DELETE FROM sessions WHERE id=?').run(id);this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');return {deleted_session:id,at:new Date().toISOString(),managed_exports:'no persistent export copies'};}
 export(id?:string){this.purge();const where=id?' WHERE session_id=?':'';const params=id?[id]:[];return {sessions:this.db.prepare(`SELECT * FROM sessions${id?' WHERE id=?':''}`).all(...params),runs:this.db.prepare(`SELECT * FROM runs${where}`).all(...params),events:this.db.prepare(`SELECT * FROM events${where} ORDER BY seq`).all(...params).map((x:any)=>({...x,payload:JSON.parse(x.payload)})),results:this.db.prepare(`SELECT result FROM run_results WHERE run_id IN (SELECT id FROM runs${where})`).all(...params).map((r:any)=>JSON.parse(r.result))};}
}
