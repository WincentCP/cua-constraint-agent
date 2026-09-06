import {hash,LIMITS} from '../core/config.ts';
import {refuted} from '../core/evidence.ts';
import {same,RunError,type Control,type Goal,type Matrix,type Observation,type Probe,type RouteStep} from '../core/types.ts';
export class Routes {
 history=new Map<string,Control>();visited=new Set<string>();
 key(c:Pick<Control,'ownerKey'|'exactName'|'role'>,g:Goal){return hash([c.ownerKey,c.role,c.exactName,c.role==='combobox'?[g.size,g.color]:null]);}
 remember(o:Observation){for(const c of o.controls)if(['OPEN_DETAIL','OPEN_INFO','SET_VARIANT'].includes(c.kind))this.history.set(hash([c.ownerKey,c.role,c.exactName]),c);}
 mark(c:Control,g:Goal){this.visited.add(this.key(c,g));}
 route(target:Control,o:Observation,goal:Goal):RouteStep[]|null{
  const optionLabel=target.kind==='SET_VARIANT'?target.options.find(v=>{const [size,color]=v.split(' / ');return color&&same(size,goal.size)&&same(color,goal.color);}):undefined;
  if(target.kind==='SET_VARIANT'&&!optionLabel)return null;
  const end:RouteStep={target,kind:target.kind,optionLabel};
  if(o.controls.some(c=>c.ownerKey===target.ownerKey&&c.role===target.role&&c.exactName===target.exactName))return [end];
  const candidate=o.candidates.find(c=>c.key===target.ownerKey);if(!candidate)return null;
  const back=o.controls.find(c=>c.kind==='RETURN');
  const route:RouteStep[]=[];if(o.heading!=='Daftar produk'){if(!back)return null;route.push({target:back,kind:'RETURN'});}
  if(target.kind!=='OPEN_DETAIL')route.push({target:candidate.detail,kind:'OPEN_DETAIL'});
  route.push(end);return route;
 }
 enumerate(o:Observation,g:Goal,m:Matrix,remaining:{probes:number;actions:number}){
  const all:Probe[]=[];let initialOrder=0;
  for(const c of this.history.values()){
   const order=initialOrder++;if(c.disabled||refuted(m,c.ownerKey,g)||this.visited.has(this.key(c,g)))continue;
   const route=this.route(c,o,g);if(!route)continue;const forwardCost=route.filter(s=>s.kind!=='RETURN').length;
   all.push({probeId:this.key(c,g),ownerKey:c.ownerKey,sourceViewKey:o.viewKey,controlDescriptor:c,route,forwardCost,totalActionCost:route.length,depth:c.kind==='OPEN_DETAIL'?1:2,initialOrder:order});
  }
  if(all.length>LIMITS.maxProbes)throw new RunError('execution_failed','probe_overflow');
  return {all,eligible:all.filter(p=>p.forwardCost<=remaining.probes&&p.totalActionCost<=remaining.actions)};
 }
}
