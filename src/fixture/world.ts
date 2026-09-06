import {randomUUID} from 'node:crypto';
import type {Scenario,Product,Variant} from './dataset.ts';
export type CartItem={slug:string;size:string;color:string;quantity:number;unitPrice:number};
export type World={id:string;secret:string;scenario:Scenario;cart:CartItem[];selected:Map<string,string>;forbiddenEffect:boolean;closed:boolean;fault?:'false-toast'|'fake-cart'|'wrong-price'};
export class FixtureStore {
 worlds=new Map<string,World>();
 create(scenario:Scenario,fault?:World['fault']){const w:World={id:randomUUID(),secret:randomUUID(),scenario:structuredClone(scenario),cart:[],selected:new Map(),forbiddenEffect:false,closed:false,fault};this.worlds.set(w.id,w);return w;}
 remove(id:string){this.worlds.delete(id);}
}
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const rupiah=(n:number)=>`Rp${n.toLocaleString('id-ID')}`;
const vlabel=(v:Variant)=>`${v.size} / ${v.color}`;
const labels=[['Lihat rincian','Informasi bahan','Stok dan harga','Pilih varian'],['Buka produk','Komposisi kain','Ketersediaan varian','Ukuran dan warna'],['Detail produk','Bahan pakaian','Harga dan persediaan','Varian produk'],['Periksa produk','Informasi material','Pilihan stok','Pilihan ukuran dan warna']];
function facts(v:Variant){return `<section role="group" aria-label="Varian ${esc(vlabel(v))}">${v.exposePrice?`<p>Harga varian: ${rupiah(v.price)}</p>`:'<p>Harga varian belum diinformasikan.</p>'}${v.exposeStock?`<p>Stok: ${v.available?'tersedia':'tidak tersedia'}</p>`:'<p>Stok belum diinformasikan.</p>'}</section>`;}
function productGroup(p:Product,body:string){return `<section role="group" aria-label="${esc(p.title)}"><h2>${esc(p.title)}</h2>${body}</section>`;}
export function renderWorld(w:World,path:string,query:URLSearchParams){
 const root=`/task/${w.id}`;const s=w.scenario;const l=labels[s.template];
 let title='Daftar produk',body='';
 if(path===''||path==='/'){
   body='<p>Pilih satu produk untuk melihat rincian. Semua harga adalah harga satuan rupiah.</p>'+s.products.map(p=>productGroup(p,`<p>Mulai dari ${rupiah(Math.min(...p.variants.map(v=>v.price)))}</p>${s.presentation==='EARLY'?`<p>Bahan: ${p.material}</p>${p.variants.map(facts).join('')}`:''}<a href="${root}/product/${p.slug}">${l[0]} ${esc(p.title)}</a>`)).join('');
 }else if(path==='/cart'){
   title='Keranjang penelitian';let cart=w.cart;
   if(w.fault==='fake-cart'&&cart.length===0&&w.selected.size){const [slug,label]=[...w.selected.entries()][0];const p=s.products.find(x=>x.slug===slug)!;const v=p.variants.find(x=>vlabel(x)===label)!;cart=[{slug,size:v.size,color:v.color,unitPrice:v.price,quantity:1}];}
   body=`<p>Jumlah jenis barang: ${cart.length}</p>`+cart.map(item=>{const p=s.products.find(x=>x.slug===item.slug)!;return productGroup(p,`<a href="${root}/product/${p.slug}">Produk ${esc(p.title)}</a><section role="group" aria-label="Varian ${esc(item.size)} / ${esc(item.color)}"><p>Harga satuan: ${rupiah(item.unitPrice)}</p><p>Jumlah: ${item.quantity}</p></section>`);}).join('');
 }else{
   const p=s.products.find(x=>path===`/product/${x.slug}`);if(!p)return null;title=p.title;
   const selected=w.selected.get(p.slug);const v=p.variants.find(x=>vlabel(x)===selected);const info=query.get('info');
   body=productGroup(p,`<a href="${root}/product/${p.slug}">Produk ${esc(p.title)}</a><p>Bahan: ${p.material}</p><p>Mulai dari ${rupiah(Math.min(...p.variants.map(x=>x.price)))}</p><nav aria-label="Rincian produk"><a role="tab" aria-selected="${info==='material'}" href="?info=material">${l[1]}</a><a role="tab" aria-selected="${info==='stock'}" href="?info=stock">${l[2]}</a></nav>${info==='material'?`<section role="region" aria-label="${l[1]}"><p>Bahan: ${p.material}</p><p>Petunjuk perawatan: cuci dengan lembut.</p></section>`:''}${info==='stock'?`<section role="region" aria-label="${l[2]}">${p.variants.map(facts).join('')}</section>`:''}<form method="post" action="${root}/select"><input type="hidden" name="product" value="${p.slug}"/><label>${l[3]}<select name="variant" aria-label="${l[3]}" onchange="this.form.submit()"><option value="">Pilih ukuran dan warna</option>${p.variants.map(x=>`<option${selected===vlabel(x)?' selected':''}>${esc(vlabel(x))}</option>`).join('')}</select></label></form>${v?`<p>Varian dipilih: ${esc(vlabel(v))}</p>${facts(v)}`:''}<form method="post" action="${root}/add"><input type="hidden" name="product" value="${p.slug}"/><button ${!v||!v.available?'disabled':''}>Tambah ke keranjang</button></form>${query.has('added')?'<p role="status">Barang ditambahkan.</p>':''}`);
 }
 return `<!doctype html><html lang="id"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>body{font:18px system-ui;max-width:1000px;margin:40px auto;padding:20px;background:#fafaf5;color:#152c2b}section[role=group]{padding:18px;border:1px solid #aaa;margin:16px 0}a,button,select{margin:8px;padding:10px;display:inline-block}a:focus,button:focus,select:focus{outline:4px solid #008676}nav{display:flex;gap:12px}</style></head><body><main><h1>${esc(title)}</h1>${title!=='Daftar produk'?`<a href="${root}/">Kembali ke daftar</a>`:''}${title!=='Keranjang penelitian'?`<a href="${root}/cart">Buka keranjang</a>`:''}${body}</main></body></html>`;
}
export function mutateWorld(w:World,path:string,data:URLSearchParams){
 if(w.closed)throw Error('world_closed');const p=w.scenario.products.find(x=>x.slug===data.get('product'));if(!p)throw Error('unknown_product');
 if(path==='/select'){const v=p.variants.find(x=>vlabel(x)===data.get('variant'));if(!v)throw Error('unknown_variant');w.selected.set(p.slug,vlabel(v));}
 else if(path==='/add'){const v=p.variants.find(x=>vlabel(x)===w.selected.get(p.slug));if(!v?.available)throw Error('variant_unavailable');if(w.cart.length)throw Error('cart_not_empty');if(w.fault!=='false-toast'&&w.fault!=='fake-cart')w.cart.push({slug:p.slug,size:v.size,color:v.color,quantity:1,unitPrice:v.price+(w.fault==='wrong-price'?10000:0)});}
 else throw Error('unknown_effect');
 return `/task/${w.id}/product/${p.slug}${path==='/add'?'?added=1':''}`;
}
