import type {Page,ElementHandle,Locator} from 'playwright';
import {parse} from 'yaml';
import {randomUUID} from 'node:crypto';
import {hash,LIMITS} from '../core/config.ts';
import {extractFacts} from '../core/evidence.ts';
import {RunError,type AXNode,type Candidate,type Control,type Descriptor,type Effect,type Observation} from '../core/types.ts';
export const flatten=(nodes:AXNode[]):AXNode[]=>nodes.flatMap(n=>[n,...flatten(n.children)]);
export function parseAX(snapshot:string):AXNode[]{
 let i=0;
 const visit=(v:unknown):AXNode[]=>Array.isArray(v)?v.flatMap(visit):typeof v==='string'?[node(v,[])]:v&&typeof v==='object'?Object.entries(v).flatMap(([key,value])=>key.startsWith('/')?[]:[node(key,visit(value),value)]):[];
 function node(key:string,children:AXNode[],value?:unknown):AXNode{
   const m=/^(\w+)(?:\s+"((?:[^"\\]|\\.)*)")?(.*)$/.exec(key);let name='';try{name=m?.[2]?JSON.parse(`"${m[2]}"`):'';}catch{name=m?.[2]??'';}
   const text=typeof value==='string'?value:m?.[1]==='text'?key.slice(5):'';
   return {ref:`n${++i}`,role:m?.[1]??'text',name,text,states:m?.[3]??'',children,url:children.find(c=>c.role==='/url')?.text};
 }
 // URLs are explicit public link properties in ARIA YAML, not hidden DOM metadata.
 const build=(v:unknown):AXNode[]=>{const roots=visit(v);const attach=(raw:unknown,nodes:AXNode[])=>{if(!Array.isArray(raw))return;raw.forEach((entry,index)=>{if(typeof entry==='object'&&entry){const child=Object.values(entry)[0];if(Array.isArray(child)){const url=child.find(x=>x&&typeof x==='object'&&'/url'in x);if(url&&nodes[index])nodes[index].url=url['/url'];if(nodes[index])attach(child.filter(x=>!(x&&typeof x==='object'&&Object.keys(x)[0]?.startsWith('/'))),nodes[index].children);}}});};attach(v,roots);return roots;};
 return build(parse(snapshot));
}
function classify(role:string,name:string,url?:string):Effect|undefined{
 if(role==='combobox')return 'SET_VARIANT';
 if(role==='tab')return 'OPEN_INFO';
 if(name==='Kembali ke daftar')return 'RETURN';if(name==='Buka keranjang')return 'OPEN_CART';if(name==='Tambah ke keranjang')return 'ADD_CART';
 if(role==='link'&&url&&/\/product\//.test(url))return 'OPEN_DETAIL';return undefined;
}
export class Observer {
 registry=new Map<string,{handle:ElementHandle;locator:Locator;descriptor:Descriptor;observation:string;fingerprint:string}>();
 known:Candidate[]=[];current?:Observation;
 constructor(public page:Page){}
 async observe():Promise<Observation>{
  for(const b of this.registry.values())await b.handle.dispose().catch(()=>{});this.registry.clear();
  let snapshot='',tree:AXNode[]=[];
  for(let attempt=0;attempt<2;attempt++){snapshot=await this.page.locator('body').ariaSnapshot();tree=parseAX(snapshot);if(snapshot.length<=LIMITS.snapshotChars&&flatten(tree).length<=LIMITS.snapshotNodes)break;if(attempt===1)throw new RunError('execution_failed','representation_overflow');}
  const id=randomUUID(),heading=flatten(tree).find(n=>n.role==='heading'&&n.states.includes('level=1'))?.name??'';
  const groups=flatten(tree).filter(n=>n.role==='group'&&!n.name.startsWith('Varian '));
  for(const g of groups){const link=flatten(g.children).find(n=>n.role==='link'&&n.url?.includes('/product/'));if(!link)continue;const key=new URL(link.url!,this.page.url()).pathname;if(!this.known.some(c=>c.key===key))this.known.push({key,title:g.name,initialOrder:this.known.length,detail:{role:'link',exactName:link.name,ownerKey:key,scopeHeading:g.name,publicUrl:link.url}});}
  if(this.known.length!==3)throw new RunError('execution_failed','candidate_contract');
  const controls:Control[]=[];
  const walk=async(nodes:AXNode[],owner?:Candidate)=>{for(const n of nodes){const scoped=n.role==='group'?this.known.find(c=>c.title===n.name)??owner:owner;const kind=classify(n.role,n.name,n.url);if(kind){
   // Product identity links inside detail/cart are observations, not forward probes.
   if(kind==='OPEN_DETAIL'&&heading!=='Daftar produk'){await walk(n.children,scoped);continue;}
   const descriptor:Descriptor={role:n.role as Descriptor['role'],exactName:n.name,ownerKey:scoped?.key??'',scopeHeading:scoped?.title??heading,publicUrl:n.url};
   const base=scoped?this.page.getByRole('group',{name:scoped.title,exact:true}):this.page.getByRole('main');const locator=base.getByRole(descriptor.role,{name:n.name,exact:true});
   if(await locator.count()!==1)throw new RunError('execution_failed','ambiguous_reference');const handle=await locator.elementHandle();if(!handle)throw new RunError('execution_failed','detached_reference');
   const selected=kind==='SET_VARIANT'?await locator.evaluate((e:Element)=>(e as HTMLSelectElement).selectedOptions[0]?.label):undefined;
   const ref=`${id}:${n.ref}`;const c:Control={...descriptor,ref,kind,options:flatten(n.children).filter(x=>x.role==='option').map(x=>x.name),selected,disabled:n.states.includes('[disabled]'),expanded:n.states.includes('[selected]')||n.states.includes('[expanded]')};
   controls.push(c);this.registry.set(ref,{handle,locator,descriptor,observation:id,fingerprint:hash(await locator.ariaSnapshot())});
  }await walk(n.children,scoped);}};
  await walk(tree);
  const observation:Observation={id,viewKey:new URL(this.page.url()).pathname+new URL(this.page.url()).search,heading,tree,snapshot,controls,candidates:[...this.known],facts:extractFacts(tree,this.known,id),fingerprint:hash(snapshot)};this.current=observation;return observation;
 }
 bind(descriptor:Descriptor){const matches=this.current?.controls.filter(c=>c.role===descriptor.role&&c.exactName===descriptor.exactName&&c.ownerKey===descriptor.ownerKey&&c.scopeHeading===descriptor.scopeHeading)??[];if(matches.length!==1)throw new RunError('execution_failed','stale_descriptor');return matches[0];}
 async validate(control:Control){const b=this.registry.get(control.ref);if(!b||b.observation!==this.current?.id)throw new RunError('execution_failed','stale_reference');if(await b.locator.count()!==1||!await b.handle.evaluate(e=>e.isConnected)||!await b.handle.isVisible()||!await b.handle.isEnabled()||await b.locator.evaluate((e,old)=>e===old,b.handle)!==true||hash(await b.locator.ariaSnapshot())!==b.fingerprint)throw new RunError('execution_failed','stale_reference');return b;}
}
