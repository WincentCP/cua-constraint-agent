import type {Condition,Goal} from '../core/types.ts';
export type Variant={size:string;color:string;price:number;available:boolean;exposePrice:boolean;exposeStock:boolean};
export type Product={slug:string;title:string;material:string;variants:Variant[]};
export type Scenario={base:string;split:'development'|'main'|'study';kind:'solvable'|'no-solution'|'unavailable-evidence';presentation:'EARLY'|'STAGED';template:number;goal:Goal;instruction:string;products:Product[]};
export function makeScenario(index:number,split:Scenario['split']='development',presentation:Scenario['presentation']='STAGED'):Scenario{
 const offset=split==='main'?100:split==='study'?200:0;
 const colors=['biru','merah','hitam','hijau'];const size=['M','L','S','XL'][index%4];const color=colors[(index+1)%4];
 const maxPriceIdr=130000+(index%5)*10000+offset*100;
 const material=index%2===0?'katun':undefined;
 const goal:Goal={revision:1,size,color,maxPriceIdr,material,quantity:1};
 const kind=split==='main'&&index>=12?(index<14?'no-solution':'unavailable-evidence'):'solvable';
 const words=['Senja','Pesisir','Rimba','Awan','Bumi','Aruna','Embun','Langit'];
 const products:Product[]=Array.from({length:3},(_,j)=>({slug:`kaos-${offset+index+1}-${j+1}`,title:`Kaos ${words[(index+j)%8]} ${offset+index+1}`,material:j===(index+2)%3&&material?'poliester':'katun',variants:[
   {size,color,price:maxPriceIdr+(j===(index+1)%3&&index%4!==3?25000:-10000-j*3000),available:kind==='no-solution'?false:j!==(index+2)%3,exposePrice:kind!=='unavailable-evidence',exposeStock:true},
   {size:'XXL',color:'putih',price:79000+index*1000,available:true,exposePrice:true,exposeStock:true}
 ]}));
 // Rotate initial public order independently of template and avoid a fixed first answer.
 const r=(index*2+1)%3;const ordered=[...products.slice(r),...products.slice(0,r)];
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
