import {GOAL_PROMPT,type LocalModel} from './planner.ts';
// ONLY software testing/demo. Results are marked demo and excluded from research.
export class DemoModel implements LocalModel {
 readonly demo=true;
 async complete(system:string,input:any,signal:AbortSignal){
  signal.throwIfAborted();const c=input.context??input;let value:unknown;
  if(system===GOAL_PROMPT){const t=String(c.transcript).toLowerCase();const prev=c.previous_goal??{};const size=/ukuran\s+(xxl|xl|s|m|l)\b/i.exec(t)?.[1].toUpperCase()??prev.size;const color=/\b(biru|merah|hitam|hijau|putih)\b/.exec(t)?.[1]??prev.color;const number=/maksimal\s+([\d.]+)/.exec(t)?.[1];const maxPriceIdr=number?Number(number.replaceAll('.','')):prev.maxPriceIdr;const material=/\b(katun|linen|poliester|wol)\b/.exec(t)?.[1]??prev.material;
   const missing=!size?'size':!color?'color':!maxPriceIdr?'maxPriceIdr':null;
   value=missing?{type:'ASK_CLARIFICATION',field:missing,question:missing==='size'?'Ukuran berapa?':missing==='color'?'Warna apa?':'Maksimal berapa rupiah?'}:{type:'READY',goal:{revision:c.required_revision,size,color,maxPriceIdr,quantity:1,...(material?{material}:{})}};
  }else value={probe_annotations:c.eligible_probes.map((p:any)=>{const n=p.controlDescriptor.exactName.toLowerCase();return {probe_id:p.probeId,may_answer:/bahan|kain|material/.test(n)?(c.goal.material?['requested_material']:[]):['requested_variant_available','requested_variant_price'],generic_progress_score:/stok|persediaan|ketersediaan|varian|ukuran/.test(n)?90:60};})};
  return {text:JSON.stringify(value),inputTokens:0,outputTokens:0};
 }
}
