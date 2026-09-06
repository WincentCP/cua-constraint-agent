import { constraints, same, type AXNode,type Candidate,type Fact,type Goal,type Matrix,type Constraint } from './types.ts';
const flat=(nodes:AXNode[]):AXNode[]=>nodes.flatMap(n=>[n,...flat(n.children)]);
const content=(nodes:AXNode[])=>flat(nodes).filter(n=>n.role==='text'||n.role==='paragraph').map(n=>n.text||n.name).filter(Boolean);
export function extractFacts(tree:AXNode[], candidates:Candidate[], observationId:string):Fact[]{
  const result:Fact[]=[];
  for(const c of candidates){
    for(const group of flat(tree).filter(n=>n.role==='group'&&n.name===c.title)){
      const lines=content(group.children);
      for(const line of lines){ const m=/^(?:Bahan|Material):\s*(katun|linen|poliester|wol)$/i.exec(line); if(m)result.push({candidateKey:c.key,field:'material',value:m[1].toLowerCase(),observationId,sourceRefs:[group.ref],sourceText:line}); }
      for(const variant of flat(group.children).filter(n=>n.role==='group'&&/^Varian /i.test(n.name))){
        const scope=/^Varian ([^/]+) \/ (.+)$/.exec(variant.name); if(!scope)continue;
        const variantScope={size:scope[1].trim(),color:scope[2].trim()};
        for(const line of content(variant.children)){
          const p=/^(?:Harga varian|Harga satuan):\s*Rp\s*([\d.]+)$/i.exec(line);
          const a=/^(?:Stok|Ketersediaan):\s*(tersedia|tidak tersedia)$/i.exec(line);
          if(p)result.push({candidateKey:c.key,field:'variantPrice',value:Number(p[1].replaceAll('.','')),variantScope,observationId,sourceRefs:[variant.ref],sourceText:line});
          if(a)result.push({candidateKey:c.key,field:'availability',value:same(a[1],'tersedia'),variantScope,observationId,sourceRefs:[variant.ref],sourceText:line});
        }
      }
    }
  } return result;
}
export class EvidenceStore {
  facts:Fact[]=[];
  add(facts:Fact[]){for(const f of facts)if(!this.facts.some(x=>JSON.stringify(x)===JSON.stringify(f)))this.facts.push(f);}
  matrix(candidates:Candidate[],goal:Goal):Matrix {
    return Object.fromEntries(candidates.map(c=>[c.key,Object.fromEntries(constraints(goal).map(k=>[k,this.status(c.key,k,goal)]))])) as Matrix;
  }
  status(key:string,k:Constraint,g:Goal){
    const field=k==='requested_material'?'material':k==='requested_variant_price'?'variantPrice':'availability';
    const f=this.facts.filter(x=>x.candidateKey===key&&x.field===field&&(field==='material'||(x.variantScope&&same(x.variantScope.size,g.size)&&same(x.variantScope.color,g.color))));
    const values=[...new Set(f.map(x=>x.value))]; if(values.length!==1)return 'UNKNOWN' as const;
    const v=values[0]; const pass=field==='material'?typeof v==='string'&&same(v,g.material!):field==='variantPrice'?typeof v==='number'&&v<=g.maxPriceIdr:v===true;
    return pass?'SATISFIED' as const:'REFUTED' as const;
  }
  conflict(key:string,g:Goal){return ['availability','variantPrice','material'].some(field=>new Set(this.facts.filter(f=>f.candidateKey===key&&f.field===field&&(field==='material'||(f.variantScope&&same(f.variantScope.size,g.size)&&same(f.variantScope.color,g.color)))).map(f=>f.value)).size>1);}
}
export const feasible=(m:Matrix,key:string,g:Goal)=>constraints(g).every(k=>m[key]?.[k]==='SATISFIED');
export const refuted=(m:Matrix,key:string,g:Goal)=>constraints(g).some(k=>m[key]?.[k]==='REFUTED');
