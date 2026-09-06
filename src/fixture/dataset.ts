import type {Condition,Goal} from '../core/types.ts';
import {createHash} from 'node:crypto';
export type Variant={size:string;color:string;price:number;available:boolean;exposePrice:boolean;exposeStock:boolean};
export type Product={slug:string;title:string;material:string;variants:Variant[]};
export type Scenario={base:string;split:'development'|'main'|'study';kind:'solvable'|'no-solution'|'unavailable-evidence';presentation:'EARLY'|'STAGED';template:number;goal:Goal;instruction:string;products:Product[]};
const opaque=(value:string)=>createHash('sha256').update(`cua-public-v2:${value}`).digest('hex').slice(0,10);
const names=['Senja Pesisir','Rimba Awan','Bumi Aruna','Embun Langit','Nusa Teduh','Pagi Lembayung','Telaga Sore','Bayu Selatan','Bukit Hening','Laut Utara','Taman Purnama','Ruang Jingga','Hujan Rintik','Kebun Damai','Fajar Timur','Akar Wangi','Batu Karang','Daun Muda','Pasir Halus','Kabut Tipis'];
const feasiblePosition={development:[2,1,0,1,2,0],main:[1,0,2,2,0,1,1,2,0,2,1,0,0,1,2,1],study:[1,2,0,1]} as const;
const presentationOrder={development:[[1,2,0],[2,0,1],[0,2,1],[2,1,0],[1,0,2],[0,1,2]],main:[[2,0,1],[1,2,0],[0,1,2],[2,1,0],[1,0,2],[0,2,1],[2,0,1],[1,2,0],[0,1,2],[2,1,0],[1,0,2],[0,2,1],[2,0,1],[1,2,0],[0,1,2],[2,1,0]],study:[[2,0,1],[1,2,0],[0,2,1],[1,0,2]]} as const;
export function makeScenario(index:number,split:Scenario['split']='development',presentation:Scenario['presentation']='STAGED'):Scenario{
 const offset=split==='main'?100:split==='study'?200:0;
 const colors=['biru','merah','hitam','hijau'];const size=['M','L','S','XL'][index%4];const color=colors[(index+1)%4];
 const maxPriceIdr=130000+(index%5)*10000+offset*100;
 const material=index%2===0?'katun':undefined;
 const goal:Goal={revision:1,size,color,maxPriceIdr,material,quantity:1};
 const kind=split==='main'&&index>=12?(index<14?'no-solution':'unavailable-evidence'):'solvable';
 const targetPosition=feasiblePosition[split][index]??0;const order=presentationOrder[split][index]??[0,1,2];const feasibleInternal=order[targetPosition];
 const products:Product[]=Array.from({length:3},(_,j)=>{const primary=j===feasibleInternal;const secondFeasible=kind==='solvable'&&index%4===3&&j===order[(targetPosition+2)%3];const suitable=primary||secondFeasible;return {slug:`produk-${opaque(`${split}:${index}:${j}`)}`,title:`Kaos ${names[(offset+index*3+j)%names.length]}`,material:material&&!suitable&&j===order[(targetPosition+1)%3]?'poliester':'katun',variants:[
   {size,color,price:suitable?maxPriceIdr-10000-j*1000:maxPriceIdr+(j%2===0?25000:-5000),available:kind==='no-solution'?false:suitable||j!==order[(targetPosition+2)%3],exposePrice:kind!=='unavailable-evidence',exposeStock:true},
   {size:'XXL',color:'putih',price:79000+index*1000,available:true,exposePrice:true,exposeStock:true}
 ]};});
 // Public order is frozen independently from target position and private predicates.
 const ordered=order.map(j=>products[j]);
 return {base:`${split}-${String(index+1).padStart(2,'0')}`,split,kind,presentation,template:split==='development'?index%2:index%4,goal,instruction:`Cari salah satu kaos ${color} ukuran ${size}, maksimal ${maxPriceIdr} rupiah${material?`, berbahan ${material}`:''}, yang tersedia. Masukkan satu ke keranjang.`,products:ordered};
}
export const development=Array.from({length:6},(_,i)=>makeScenario(i));
export const main=Array.from({length:16},(_,i)=>['EARLY','STAGED'].map(p=>makeScenario(i,'main',p as Scenario['presentation']))).flat();
export const study=Array.from({length:4},(_,i)=>makeScenario(i,'study'));
export function benchmarkManifest(){let state=731;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};const pairs=[...main];for(let i=pairs.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pairs[i],pairs[j]]=[pairs[j],pairs[i]];}return pairs.flatMap(s=>(random()<.5?['P','B1']:['B1','P']).map(condition=>({base:s.base,presentation:s.presentation,condition:condition as Condition,template:s.template,kind:s.kind})));}
export function studyOrder(participantSlot:number){
 const conditions:Condition[]=participantSlot<2?['P','B1','B1','P']:['B1','P','P','B1'];
 return conditions.map((condition,i)=>({condition,scenario:study[(i+participantSlot%2)%4]}));
}
