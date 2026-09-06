import {existsSync,readFileSync} from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
// Authenticated shutdown targets the live application, never unverified/stale PIDs.
const token=process.env.RESEARCHER_TOKEN||(existsSync('.runtime/researcher-token')?readFileSync('.runtime/researcher-token','utf8').trim():'');
try{const r=await fetch('http://127.0.0.1:3050/api/research/shutdown',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({request_id:crypto.randomUUID()}),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error(`HTTP ${r.status}`);console.log('Penghentian aplikasi diminta. Supervisor menutup Ollama miliknya.');}catch(e){console.error('Tidak ada aplikasi terautentikasi yang dapat dihentikan. Gunakan Ctrl+C pada terminal startup.');process.exitCode=1;}
