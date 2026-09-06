import {existsSync,readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';import {execFileSync} from 'node:child_process';
import {hash,CONFIG_HASH,MODEL} from '../src/core/config.ts';import {PROMPT_HASH} from '../src/agent/planner.ts';import {main,benchmarkManifest,studyOrder} from '../src/fixture/dataset.ts';
if(!process.argv.includes('--pilot-approved'))throw Error('Jalankan hanya setelah pilot layak dan protokol disetujui: npm run freeze -- --pilot-approved');
if(existsSync('config/freeze.json'))throw Error('Freeze sudah ada. Jangan menimpa main; buat revisi protokol eksplisit.');
const report=JSON.parse(readFileSync('data/preflight.json','utf8'));if(!report.passed||!report.model_digest||report.config_hash!==CONFIG_HASH)throw Error('Preflight engine nyata belum lulus/config berubah.');
const status=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();if(status)throw Error('Commit seluruh perubahan kode sebelum freeze.');
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
function files(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${dir}/${e.name}`):[`${dir}/${e.name}`]);}
const fileHashes=Object.fromEntries(['src','web','workers','scripts'].flatMap(files).filter(p=>!p.includes('__pycache__')).sort().map(p=>[p,hash(readFileSync(p,'utf8'))]));
mkdirSync('config',{recursive:true});writeFileSync('config/freeze.json',JSON.stringify({version:4,frozen_at:new Date().toISOString(),base_commit:commit,pilot_approved_by_researcher:true,config_hash:CONFIG_HASH,prompt_hash:PROMPT_HASH,model:MODEL,model_digest:report.model_digest,dataset_hash:hash(main),manifest:benchmarkManifest(),study_order:[0,1,2,3].map(studyOrder),file_hashes:fileHashes,lockfile_hash:hash(readFileSync('package-lock.json','utf8')),hardware:report.hardware},null,2));console.log('Freeze tersimpan. Commit config/freeze.json tanpa mengubah kode/model.');
