import {constraints,type Condition,type Constraint,type Goal} from '../core/types.ts';
import {createHash} from 'node:crypto';
export type Variant={size:string;color:string;price:number;available:boolean;exposePrice:boolean;exposeStock:boolean};
export type Product={slug:string;title:string;material:string;variants:Variant[]};
export type ReferenceEvidence={decision:'ACT'|'ABSTAIN_NO_SOLUTION'|'ABSTAIN_INSUFFICIENT_EVIDENCE';minimumProbes:number|null;decisiveConstraints:Constraint[];path:string[]};
export type Scenario={base:string;split:'development'|'main'|'study';kind:'solvable'|'no-solution'|'unavailable-evidence';presentation:'EARLY'|'STAGED';template:number;goal:Goal;instruction:string;products:Product[];counterfactualGroup?:string;referenceEvidence:ReferenceEvidence};
const opaque=(value:string)=>createHash('sha256').update(`cua-public-v2:${value}`).digest('hex').slice(0,10);
const names=['Senja Pesisir','Rimba Awan','Bumi Aruna','Embun Langit','Nusa Teduh','Pagi Lembayung','Telaga Sore','Bayu Selatan','Bukit Hening','Laut Utara','Taman Purnama','Ruang Jingga','Hujan Rintik','Kebun Damai','Fajar Timur','Akar Wangi','Batu Karang','Daun Muda','Pasir Halus','Kabut Tipis'];
const feasiblePosition={development:[2,1,0,1,2,0],main:[1,0,2,2,0,1,1,2,0,2,1,0,0,1,2,1],study:[1,2,0,1]} as const;
const presentationOrder={development:[[1,2,0],[2,0,1],[0,2,1],[2,1,0],[1,0,2],[0,1,2]],main:[[2,0,1],[1,2,0],[0,1,2],[2,1,0],[1,0,2],[0,2,1],[2,0,1],[1,2,0],[0,1,2],[2,1,0],[1,0,2],[0,2,1],[2,0,1],[1,2,0],[0,1,2],[2,1,0]],study:[[2,0,1],[1,2,0],[0,2,1],[1,0,2]]} as const;
export function makeScenario(index:number,split:Scenario['split']='development',presentation:Scenario['presentation']='STAGED'):Scenario{
 if(split==='main'&&index>=12){
  const sourceIndex=index%2===0?0:2;const source=makeScenario(sourceIndex,'main',presentation);const kind=index<14?'no-solution':'unavailable-evidence';const products=structuredClone(source.products);
  if(kind==='no-solution'){for(const p of products)p.material=source.goal.material!;products[0].material='poliester';for(const p of products.slice(1)){const v=p.variants.find(v=>v.size===source.goal.size&&v.color===source.goal.color);if(v){v.available=false;v.exposePrice=true;v.exposeStock=true;}}}
  else for(const p of products){p.material=source.goal.material!;const v=p.variants.find(v=>v.size===source.goal.size&&v.color===source.goal.color);if(v)v.exposePrice=false;}
  const referenceEvidence:ReferenceEvidence=kind==='no-solution'
   ?{decision:'ABSTAIN_NO_SOLUTION',minimumProbes:presentation==='EARLY'?0:4,decisiveConstraints:['requested_material','requested_variant_available'],path:presentation==='EARLY'?[]:['open detail candidate 2','inspect stock candidate 2','open detail candidate 3','inspect stock candidate 3']}
   :{decision:'ABSTAIN_INSUFFICIENT_EVIDENCE',minimumProbes:3,decisiveConstraints:['requested_variant_price'],path:['open each of the three product details to establish that decisive price evidence is unavailable']};
  return {...source,base:`main-${String(index+1).padStart(2,'0')}`,kind,products,counterfactualGroup:`main-matched-${String(sourceIndex+1).padStart(2,'0')}`,referenceEvidence};
 }
 const offset=split==='main'?100:split==='study'?200:0;
 const colors=['biru','merah','hitam','hijau'];const size=['M','L','S','XL'][index%4];const color=colors[(index+1)%4];
 const maxPriceIdr=130000+(index%5)*10000+offset*100;
 const material=index%2===0?'katun':undefined;
 const goal:Goal={revision:1,size,color,maxPriceIdr,material,quantity:1};
 const kind='solvable' as const;
 const targetPosition=feasiblePosition[split][index]??0;const order=presentationOrder[split][index]??[0,1,2];const feasibleInternal=order[targetPosition];
 const products:Product[]=Array.from({length:3},(_,j)=>{const primary=j===feasibleInternal;const secondFeasible=kind==='solvable'&&index%4===3&&j===order[(targetPosition+2)%3];const suitable=primary||secondFeasible;return {slug:`produk-${opaque(`${split}:${index}:${j}`)}`,title:`Kaos ${names[(offset+index*3+j)%names.length]}`,material:material&&!suitable&&j===order[(targetPosition+1)%3]?'poliester':'katun',variants:[
   {size,color,price:suitable?maxPriceIdr-10000-j*1000:maxPriceIdr+(j%2===0?25000:-5000),available:suitable||j!==order[(targetPosition+2)%3],exposePrice:true,exposeStock:true},
   {size:'XXL',color:'putih',price:79000+index*1000,available:true,exposePrice:true,exposeStock:true}
 ]};});
 // Public order is frozen independently from target position and private predicates.
 const ordered=order.map(j=>products[j]);
 const referenceEvidence:ReferenceEvidence={decision:'ACT',minimumProbes:presentation==='EARLY'?0:2,decisiveConstraints:constraints(goal),path:presentation==='EARLY'?[]:['open a product detail','inspect stock and variant price']};
 return {base:`${split}-${String(index+1).padStart(2,'0')}`,split,kind,presentation,template:split==='development'?index%2:index%4,goal,instruction:`Cari salah satu kaos ${color} ukuran ${size}, maksimal ${maxPriceIdr} rupiah${material?`, berbahan ${material}`:''}, yang tersedia. Masukkan satu ke keranjang.`,products:ordered,...(split==='main'&&(index===0||index===2)?{counterfactualGroup:`main-matched-${String(index+1).padStart(2,'0')}`}:{ }),referenceEvidence};
}
export const development=Array.from({length:6},(_,i)=>makeScenario(i));
export const main=Array.from({length:16},(_,i)=>['EARLY','STAGED'].map(p=>makeScenario(i,'main',p as Scenario['presentation']))).flat();
export const study=Array.from({length:4},(_,i)=>makeScenario(i,'study'));
export function benchmarkManifest(){let state=731;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};const pairs=[...main];for(let i=pairs.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pairs[i],pairs[j]]=[pairs[j],pairs[i]];}return pairs.flatMap(s=>(random()<.5?['P','B1']:['B1','P']).map(condition=>({base:s.base,presentation:s.presentation,condition:condition as Condition,template:s.template,kind:s.kind})));}
export function studyOrder(participantSlot:number){
 const conditions:Condition[]=participantSlot<2?['P','B1','B1','P']:['B1','P','P','B1'];
 return conditions.map((condition,i)=>({condition,scenario:study[(i+participantSlot%2)%4]}));
}
