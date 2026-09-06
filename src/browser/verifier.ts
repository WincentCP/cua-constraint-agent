import {EvidenceStore,feasible} from '../core/evidence.ts';
import {flatten} from './observer.ts';
import {same,type Check,type Control,type Goal,type Observation,type RouteStep} from '../core/types.ts';
export type Expected={kind:RouteStep['kind'];ownerKey:string;title:string;name:string;option?:string};
export function expectedBefore(step:RouteStep,o:Observation):Expected{return {kind:step.kind,ownerKey:step.target.ownerKey,title:o.candidates.find(c=>c.key===step.target.ownerKey)?.title??'',name:step.target.exactName,option:step.optionLabel};}
export function verifyEffect(expected:Expected,o:Observation):Check{
 const e=expected;if(e.kind==='RETURN')return o.heading==='Daftar produk'?'PASS':'FAIL';
 if(e.kind==='OPEN_DETAIL')return o.heading===e.title&&o.viewKey.split('?')[0]===e.ownerKey?'PASS':'FAIL';
 if(e.kind==='OPEN_CART')return o.heading==='Keranjang penelitian'?'PASS':'FAIL';
 if(e.kind==='OPEN_INFO'){const control=o.controls.find(c=>c.exactName===e.name&&c.ownerKey===e.ownerKey);return control?.expanded&&flatten(o.tree).some(n=>n.role==='region'&&n.name===e.name)?'PASS':'UNKNOWN';}
 if(e.kind==='SET_VARIANT')return o.controls.some(c=>c.kind==='SET_VARIANT'&&c.ownerKey===e.ownerKey&&c.selected===e.option)&&o.snapshot.includes(`Varian dipilih: ${e.option}`)?'PASS':'FAIL';
 return 'UNKNOWN';
}
export function verifyFreshCandidate(o:Observation,key:string,g:Goal){const store=new EvidenceStore();store.add(o.facts);return feasible(store.matrix(o.candidates,g),key,g)&&o.controls.some(c=>c.kind==='SET_VARIANT'&&c.ownerKey===key&&c.selected?.split(' / ').every((v,i)=>same(v,i===0?g.size:g.color)));}
export function verifyCart(o:Observation,key:string,g:Goal,price:number,precommitVerified:boolean):Check{
 if(o.heading!=='Keranjang penelitian')return 'UNKNOWN';
 const texts=flatten(o.tree).map(n=>n.text||n.name);const itemGroups=flatten(o.tree).filter(n=>n.role==='group'&&!n.name.startsWith('Varian '));
 if(!texts.includes('Jumlah jenis barang: 1')||itemGroups.length!==1)return 'FAIL';
 const c=o.candidates.find(c=>c.key===key);if(!c||itemGroups[0].name!==c.title||!flatten(itemGroups[0].children).some(n=>n.url&&new URL(n.url,'http://localhost:3050').pathname===key))return 'FAIL';
 const variant=flatten(itemGroups[0].children).find(n=>n.role==='group'&&same(n.name,`Varian ${g.size} / ${g.color}`));if(!variant)return 'FAIL';
 const lines=flatten(variant.children).map(n=>n.text||n.name);
 return precommitVerified&&lines.includes('Jumlah: 1')&&lines.includes(`Harga satuan: Rp${price.toLocaleString('id-ID')}`)&&price<=g.maxPriceIdr?'PASS':'FAIL';
}
