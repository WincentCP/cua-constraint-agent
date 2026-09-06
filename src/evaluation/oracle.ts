// Offline-only: never imported by agent/, browser/, or core/.
import type {World} from '../fixture/world.ts';
import type {Goal} from '../core/types.ts';
export function assessOracle(world:World,goal:Goal|null,quiescent:boolean){
 if(!quiescent)return {oracle_success:null,oracle_assessment_reason:'quiescence_unknown',wrong_final_effect:null,feasible_exists:null};
 if(!goal)return {oracle_success:false,oracle_assessment_reason:'goal_unavailable',wrong_final_effect:world.cart.length>0,feasible_exists:null};
 const eq=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase();
 const suitable=world.scenario.products.filter(p=>(!goal.material||eq(p.material,goal.material))&&p.variants.some(v=>eq(v.size,goal.size)&&eq(v.color,goal.color)&&v.available&&v.price<=goal.maxPriceIdr));
 const item=world.cart[0];const product=item&&world.scenario.products.find(p=>p.slug===item.slug);const variant=product?.variants.find(v=>eq(v.size,item.size)&&eq(v.color,item.color));
 const correct=Boolean(world.cart.length===1&&item.quantity===1&&product&&variant&&suitable.includes(product)&&eq(item.size,goal.size)&&eq(item.color,goal.color)&&item.unitPrice===variant.price&&variant.available&&!world.forbiddenEffect);
 return {oracle_success:correct,oracle_assessment_reason:correct?'correct_cart':world.forbiddenEffect?'forbidden_effect':!world.cart.length?'empty_cart':'incorrect_cart',wrong_final_effect:world.cart.length>0&&!correct,feasible_exists:suitable.length>0};
}
