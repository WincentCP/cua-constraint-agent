import {createServer} from 'node:http';
import {FixtureStore,renderWorld,mutateWorld} from './world.ts';
import {ORIGIN} from '../core/config.ts';
// Synthetic integration/preflight harness. It cannot expose research storage.
export async function fixtureHarness(){
 const fixtures=new FixtureStore();const server=createServer(async(req,res)=>{try{
  if(req.headers.host!=='localhost:3050'&&req.headers.host!=='127.0.0.1:3050'){res.writeHead(403).end();return;}
  const u=new URL(req.url??'/',ORIGIN),m=/^\/task\/([^/]+)(\/.*)$/.exec(u.pathname),w=m&&fixtures.worlds.get(m[1]);
  if(!w||w.closed||!req.headers.cookie?.split(';').map(s=>s.trim()).includes(`fixture_access=${w.secret}`)){res.writeHead(403).end();return;}
  if(req.method==='POST'){let text='';for await(const chunk of req){text+=chunk;if(text.length>4096)throw Error('body_limit');}res.writeHead(303,{Location:mutateWorld(w,m![2],new URLSearchParams(text))}).end();return;}
  const html=renderWorld(w,m![2],u.searchParams);res.writeHead(html?200:404,{'Content-Type':'text/html; charset=utf-8'}).end(html??'Not found');
 }catch{res.writeHead(400).end('Fixture request rejected');}});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(3050,'127.0.0.1',resolve);});
 return {fixtures,close:()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
