import {randomUUID} from 'node:crypto';
import type {Browser,BrowserServer,Page} from 'playwright';
import {LIMITS} from '../core/config.ts';
import {Approval,effectFor,type CartEffect} from '../core/policy.ts';
import {EvidenceStore,feasible,refuted} from '../core/evidence.ts';
import {constraints,RunError,StaleWork,type Annotation,type Candidate,type Check,type Counters,type Goal,type Observation,type Phase,type Reason,type RouteStep,type Condition} from '../core/types.ts';
import {Observer} from '../browser/observer.ts';
import {expectedBefore,verifyEffect,verifyCart,verifyFreshCandidate} from '../browser/verifier.ts';
import {Planner,type LocalModel} from './planner.ts';
import {Routes} from './routes.ts';
import {selectProbe} from '../core/router.ts';
export type AgentOutcome={run_id:string;goal:Goal|null;goal_history:Goal[];selected_product:{key:string;title:string}|null;agent_claimed_success:boolean;agent_termination_reason:Reason;detail:string;counters:Counters;goal_intake_ms:number;task_wall_ms:number;cleanup_ms:number;public_refutations:boolean;completion_audio_delivered:boolean|null;verification_status:'PASS'|'FAIL'|'UNKNOWN'};
export type RunHooks={log:(type:string,payload:unknown,sensitive?:boolean)=>void;status:(phase:Phase,text?:string)=>void;ask:(text:string,confirmation?:string)=>void;ack?:(text:string)=>void;finished:(outcome:AgentOutcome,quiescent:boolean)=>Promise<void>};
export class AgentRun {
 id:string;epoch=0;phase:Phase='STARTING';goal?:Goal;goalAcceptedAt?:number;intakeAt=Date.now();
 counters:Counters={probes:0,actions:0,observations:0,llmCalls:0,inputTokens:0,outputTokens:0,recoveries:0,informativeProbes:0,evidenceAcquired:0,firstFeasibleProbe:null,evidenceClosureProbe:null,routerComparisons:0,routerDisagreements:0};
 observer:Observer;planner:Planner;evidence=new EvidenceStore();routes=new Routes();approval=new Approval();
 held=false;terminal=false;effectDispatched=false;private lastVerification:Check='UNKNOWN';private aborts=new Set<AbortController>();private waiter?:()=>void;private inputTimer?:NodeJS.Timeout;private deadline?:NodeJS.Timeout;private intakeTimer:NodeJS.Timeout;private loopRunning=false;private clarificationCount=0;private terminalPromise?:Promise<void>;private approvedEffect?:CartEffect;private proposalEffect?:CartEffect;private acquired=new Set<string>();private conflictRead=false;private excluded=new Set<string>();private carried?:Observation;private goalHistory:Goal[]=[];
 done:Promise<void>;private resolveDone!:()=>void;private pendingGoalText='';
 constructor(public page:Page,private browser:Browser,private server:BrowserServer|undefined,private condition:Condition,model:LocalModel,private hooks:RunHooks,private autoApprove=false,private publicInstruction='',id=randomUUID()){
  this.id=id;
  this.observer=new Observer(page);this.planner=new Planner(model,work=>this.llm(work),hooks.log);this.done=new Promise(r=>{this.resolveDone=r;});
  this.intakeTimer=setTimeout(()=>{void this.finish('timeout','goal_intake_timeout');},LIMITS.intakeMs);
 }
 envelope(){return {run_id:this.id,epoch:this.epoch,goal_revision:this.goal?.revision??0};}
 private setPhase(phase:Phase,text?:string){this.phase=phase;this.hooks.status(phase,text);}
 private remaining(){return (this.goalAcceptedAt?this.goalAcceptedAt+LIMITS.taskMs:this.intakeAt+LIMITS.intakeMs)-Date.now();}
 check(ticket?:number){if(this.terminal)throw new StaleWork();if(this.remaining()<=0)throw new RunError('timeout',this.goalAcceptedAt?'task_deadline':'goal_intake_timeout');if(ticket!==undefined&&ticket!==this.epoch)throw new StaleWork();}
 private async checkpoint(){this.check();while(this.held){await new Promise<void>(r=>{this.waiter=r;});this.check();}}
 hold(){if(this.terminal)return;this.held=true;this.epoch++;for(const c of this.aborts)c.abort();this.approval.invalidate();this.approvedEffect=undefined;clearTimeout(this.inputTimer);this.inputTimer=setTimeout(()=>{void this.finish('infrastructure_failed','input_processing_timeout');},LIMITS.sttMs*2+2000);}
 resume(){if(this.terminal)return;this.held=false;clearTimeout(this.inputTimer);this.waiter?.();this.waiter=undefined;this.kick();}
 private async llm<T>(work:(signal:AbortSignal)=>Promise<T>){
  this.check();if(this.counters.llmCalls>=LIMITS.llmCalls)throw new RunError('budget_exhausted','llm_calls');this.counters.llmCalls++;
  const ticket=this.epoch,abort=new AbortController();this.aborts.add(abort);const timer=setTimeout(()=>abort.abort(),Math.min(LIMITS.llmMs,this.remaining()));
  try{const result=await work(abort.signal);this.check(ticket);const r=result as any;this.counters.inputTokens+=r.inputTokens??0;this.counters.outputTokens+=r.outputTokens??0;return result;}
  catch(e){this.check(ticket);if(e instanceof RunError)throw e;throw new RunError('infrastructure_failed',abort.signal.aborted?'model_timeout':'model_unavailable');}
  finally{clearTimeout(timer);this.aborts.delete(abort);}
 }
 async input(text:string){
  if(this.terminal)return;if(this.effectDispatched){await this.finish('execution_failed','correction_after_commit');return;}
  if(!this.held)this.hold();const ticket=this.epoch,previousGoal=this.goal;
  try{this.hooks.log('transcript',{text,kind:previousGoal?'correction':'initial_response',...this.envelope()},true);this.pendingGoalText=this.pendingGoalText?`${this.pendingGoalText}\nKlarifikasi: ${text}`:text;const result=await this.planner.parseGoal(this.publicInstruction,this.pendingGoalText,this.goal);this.check(ticket);
   if(result.type==='UNSUPPORTED'){await this.finish('unsupported_goal','parser_unsupported');return;}
   if(result.type==='ASK_CLARIFICATION'){if(++this.clarificationCount>2){await this.finish('unsupported_goal','goal_clarification_limit');return;}clearTimeout(this.inputTimer);this.hooks.ask(result.question);return;}
   this.goal=result.goal;this.goalHistory.push(structuredClone(this.goal));this.pendingGoalText='';if(!this.goalAcceptedAt){this.goalAcceptedAt=Date.now();clearTimeout(this.intakeTimer);this.deadline=setTimeout(()=>{void this.finish('timeout','task_deadline');},LIMITS.taskMs);}
   this.approval.invalidate();this.proposalEffect=undefined;this.approvedEffect=undefined;this.setPhase('EXPLORING','Saya sedang memeriksa pilihan yang memenuhi syaratmu.');this.hooks.log('goal_accepted',{goal:this.goal,...this.envelope()});
   const summary=previousGoal?this.describeChanges(previousGoal,this.goal):`ukuran ${this.goal.size}, warna ${this.goal.color}, maksimal ${this.goal.maxPriceIdr.toLocaleString('id-ID')} rupiah${this.goal.material?`, bahan ${this.goal.material}`:''}`;
   if(this.hooks.ack)this.hooks.ack(previousGoal?`Baik, ${summary}. Saya lanjut memeriksa.`:`Baik, ${summary}. Saya periksa sekarang.`);else this.resume();
  }catch(e){if(!(e instanceof StaleWork))await this.fail(e);}
 }
 private describeChanges(before:Goal,after:Goal){const changes:string[]=[];if(before.size!==after.size)changes.push(`ukuran menjadi ${after.size}`);if(before.color!==after.color)changes.push(`warna menjadi ${after.color}`);if(before.maxPriceIdr!==after.maxPriceIdr)changes.push(`batas harga menjadi ${after.maxPriceIdr.toLocaleString('id-ID')} rupiah`);if(before.material!==after.material)changes.push(after.material?`bahan menjadi ${after.material}`:'syarat bahan dihapus');return changes.length?changes.join(', '):'tujuannya tetap sama';}
 rejectProposal(){
  if(this.terminal||this.phase!=='AWAITING_APPROVAL'||!this.proposalEffect)return false;this.hold();const product=this.proposalEffect.product;const title=this.observer.known.find(c=>c.key===product)?.title??'pilihan itu';this.excluded.add(product);this.approval.invalidate();this.proposalEffect=undefined;this.approvedEffect=undefined;this.setPhase('EXPLORING','Saya mencari pilihan lain.');this.hooks.log('candidate_declined',{...this.envelope(),candidate_key:product});if(this.hooks.ack)this.hooks.ack(`Baik, ${title} tidak saya masukkan. Saya cari pilihan lain.`);else this.resume();return true;
 }
 async approve(confirmationId:string){
  if(this.terminal||this.phase!=='AWAITING_APPROVAL'||!this.proposalEffect)return;
  const effect=this.proposalEffect;this.approval.propose(effect);const p=this.approval.proposal!;
  // The proposal ID supplied by the UI must match the currently spoken proposal.
  if(confirmationId!==this.spokenConfirmation){await this.finish('execution_failed','confirmation_mismatch');return;}
  this.approval.approve(p.id,effect);this.approvedEffect=effect;this.phase='COMMIT_PREPARE';this.held=false;clearTimeout(this.inputTimer);this.waiter?.();this.waiter=undefined;this.kick();
 }
 spokenConfirmation?:string;
 private kick(){if(this.loopRunning||this.terminal||!this.goal)return;this.loopRunning=true;void this.loop().finally(()=>{this.loopRunning=false;if(!this.terminal&&!this.held&&this.phase!=='AWAITING_APPROVAL')this.kick();});}
 private async observe(){await this.checkpoint();const ticket=this.epoch;const o=await this.observer.observe();this.check(ticket);this.counters.observations++;this.evidence.add(o.facts);this.routes.remember(o);this.hooks.log('observation',{...this.envelope(),observation_id:o.id,snapshot:o.snapshot,facts:o.facts});return o;}
 private async dispatch(step:RouteStep,o:Observation,probe:boolean,grant?:CartEffect){
  await this.checkpoint();const ticket=this.epoch;let control=this.observer.bind(step.target);const binding=await this.observer.validate(control);this.check(ticket);if(this.held)throw new StaleWork();
  if(this.counters.actions>=LIMITS.actions)throw new RunError('budget_exhausted','browser_actions');const forward=probe&&step.kind!=='RETURN';if(forward&&this.counters.probes>=LIMITS.probes)throw new RunError('budget_exhausted','probes');
  if(step.kind==='ADD_CART'){if(!grant||!this.goal||this.phase!=='COMMITTING')throw new RunError('execution_failed','illegal_cart_effect');this.approval.consume(grant);}
  const expected=expectedBefore(step,o);this.hooks.log('action_intent',{...this.envelope(),step_id:randomUUID(),expected,target:control,probe:forward});
  // No await between the final gate, durable intent and dispatch.
  this.check(ticket);if(this.held)throw new StaleWork();this.counters.actions++;if(forward){this.counters.probes++;this.routes.mark(control,this.goal!);}if(step.kind==='ADD_CART')this.effectDispatched=true;
  let actionSuccess=true;
  try{if(step.kind==='SET_VARIANT')await binding.handle.selectOption({label:step.optionLabel!},{timeout:Math.min(LIMITS.actionMs,this.remaining())});else await binding.handle.click({timeout:Math.min(LIMITS.actionMs,this.remaining())});}catch{actionSuccess=false;}
  this.check(ticket);this.hooks.log('action_return',{...this.envelope(),action_success:actionSuccess,kind:step.kind});
  // Never retry a cart effect. Reconciliation is performed by reading the cart.
  if(step.kind==='ADD_CART')return await this.observe();
  let after=await this.observe(),status=verifyEffect(expected,after);
  // One bounded settle read handles delayed rendering without turning verification into an observation loop.
  if(status!=='PASS'){await new Promise(r=>setTimeout(r,Math.min(LIMITS.pollMs,this.remaining())));after=await this.observe();status=verifyEffect(expected,after);}
  // Navigation and selecting the same option are idempotent. Retry them once after rebinding; cart effects are never retried.
  if(status!=='PASS'&&this.counters.recoveries<LIMITS.recoveries&&this.counters.actions<LIMITS.actions&&(!forward||this.counters.probes<LIMITS.probes)){this.counters.recoveries++;this.hooks.log('recovery',{...this.envelope(),kind:step.kind,attempt:1});let retrySuccess=true;try{control=this.observer.bind(step.target);const rebound=await this.observer.validate(control);this.check(ticket);this.hooks.log('action_retry_intent',{...this.envelope(),kind:step.kind,probe:forward});this.counters.actions++;if(forward)this.counters.probes++;if(step.kind==='SET_VARIANT')await rebound.handle.selectOption({label:step.optionLabel!},{timeout:Math.min(LIMITS.actionMs,this.remaining())});else await rebound.handle.click({timeout:Math.min(LIMITS.actionMs,this.remaining())});}catch{retrySuccess=false;}this.hooks.log('action_retry',{...this.envelope(),kind:step.kind,action_success:retrySuccess});after=await this.observe();status=verifyEffect(expected,after);}
  this.hooks.log('verification',{...this.envelope(),kind:step.kind,verification_status:status,action_success:actionSuccess});
  if(status!=='PASS'){this.lastVerification=status;throw new RunError('execution_failed','postcondition_unverified');}
  if(forward){const matrix=this.evidence.matrix(after.candidates,this.goal!);let acquired=0;for(const c of after.candidates)for(const k of constraints(this.goal!)){const key=`${this.goal!.revision}:${c.key}:${k}`;if(matrix[c.key][k]!=='UNKNOWN'&&!this.acquired.has(key)){this.acquired.add(key);acquired++;}}if(acquired){this.counters.informativeProbes++;this.counters.evidenceAcquired+=acquired;}this.hooks.log('probe_evidence',{...this.envelope(),new_constraint_evidence:acquired,verification_status:status});}
  return after;
 }
 private async loop(){
  while(!this.terminal){try{
   await this.checkpoint();if(!this.goal)return;
   if(this.approvedEffect){const effect=this.approvedEffect;this.approvedEffect=undefined;await this.commit(effect);return;}
   if(this.phase==='AWAITING_APPROVAL')return;
   const o=this.carried??await this.observe();this.carried=undefined;const g=this.goal,m=this.evidence.matrix(o.candidates,g);const active=o.candidates.filter(c=>!this.excluded.has(c.key));
   if(this.counters.probes===0)for(const c of o.candidates)for(const k of constraints(g))if(m[c.key][k]!=='UNKNOWN')this.acquired.add(`${g.revision}:${c.key}:${k}`);
   const selected=active.find(c=>feasible(m,c.key,g));
   if(selected){this.counters.firstFeasibleProbe??=this.counters.probes;await this.prepare(selected,o);if((this.phase as Phase)==='AWAITING_APPROVAL')return;continue;}
   if(o.candidates.every(c=>refuted(m,c.key,g))){await this.finish('no_feasible_in_scope');return;}
   if(!active.length||active.every(c=>refuted(m,c.key,g))){await this.finish('skipped','all_remaining_candidates_declined_or_refuted');return;}
   if(!this.conflictRead&&active.some(c=>this.evidence.conflict(c.key,g))){this.conflictRead=true;this.carried=await this.observe();continue;}
   const probes=this.routes.enumerate(o,g,m,{probes:LIMITS.probes-this.counters.probes,actions:LIMITS.actions-this.counters.actions});
   if(this.counters.probes>=LIMITS.probes||this.counters.actions>=LIMITS.actions||this.counters.llmCalls>=LIMITS.llmCalls||(!probes.eligible.length&&probes.all.length)){await this.finish('budget_exhausted',this.counters.probes>=LIMITS.probes?'probes':'route_or_call_budget');return;}
   const eligible=probes.eligible.filter(p=>!this.excluded.has(p.ownerKey));if(!eligible.length){await this.finish('insufficient_evidence','no_eligible_probe');return;}
   let annotations:Annotation[]=[],p=eligible[0];let comparison:{comparable:boolean;P:string|null;B1:string|null;diverged:boolean}={comparable:false,P:null,B1:null,diverged:false};
   if(eligible.length>1){annotations=await this.planner.annotate(g,o,m,eligible,this.counters);await this.checkpoint();p=selectProbe(this.condition,eligible,annotations,m,active,g)!;const pChoice=selectProbe('P',eligible,annotations,m,active,g),bChoice=selectProbe('B1',eligible,annotations,m,active,g);const diverged=pChoice?.probeId!==bChoice?.probeId;this.counters.routerComparisons++;if(diverged)this.counters.routerDisagreements++;comparison={comparable:true,P:pChoice?.probeId??null,B1:bChoice?.probeId??null,diverged};}
   this.hooks.log('planner_proposal',{...this.envelope(),annotations,selected_probe:p,router_comparison:comparison});
   // Restoration is deterministic. Rebind and verify every step, but call the model again only if evidence changes.
   let current=o,beforeFacts=this.evidence.facts.length;for(const step of p.route){current=await this.dispatch(step,current,true);if(this.evidence.facts.length!==beforeFacts&&step!==p.route[p.route.length-1])break;beforeFacts=this.evidence.facts.length;}this.carried=current;
  }catch(e){if(e instanceof StaleWork){if(this.terminal)return;continue;}await this.fail(e);return;}}
 }
 private async prepare(c:Candidate,o:Observation){
  this.setPhase('COMMIT_PREPARE');let current=o;
  if(current.heading!==c.title){if(current.heading!=='Daftar produk'){const back=current.controls.find(x=>x.kind==='RETURN');if(!back)throw new RunError('execution_failed','return_missing');current=await this.dispatch({target:back,kind:'RETURN'},current,false);}current=await this.dispatch({target:c.detail,kind:'OPEN_DETAIL'},current,false);}
  const g=this.goal!;const selector=current.controls.find(x=>x.kind==='SET_VARIANT'&&x.ownerKey===c.key);const option=selector?.options.find(x=>x.toLowerCase()===`${g.size} / ${g.color}`.toLowerCase());if(!selector||!option)throw new RunError('execution_failed','commit_variant_missing');
  if(selector.selected!==option)current=await this.dispatch({target:selector,kind:'SET_VARIANT',optionLabel:option},current,false);
  if(!verifyFreshCandidate(current,c.key,g)){this.approval.invalidate();this.setPhase('EXPLORING');if(this.evidence.conflict(c.key,g))throw new RunError('execution_failed','fresh_evidence_conflict');throw new RunError('execution_failed','fresh_commit_evidence_missing');}
  const price=current.facts.find(f=>f.candidateKey===c.key&&f.field==='variantPrice'&&f.variantScope?.size.toLowerCase()===g.size.toLowerCase()&&f.variantScope?.color.toLowerCase()===g.color.toLowerCase())?.value;
  if(typeof price!=='number')throw new RunError('execution_failed','fresh_price_missing');
  const effect=effectFor(this.id,g,c.key,price);const proposal=this.approval.propose(effect);this.proposalEffect=effect;this.spokenConfirmation=proposal.id;
  this.setPhase('AWAITING_APPROVAL');this.hooks.ask(`${c.title}, warna ${g.color}, ukuran ${g.size}, harga ${price.toLocaleString('id-ID')} rupiah. Masukkan satu barang ke keranjang penelitian?`,proposal.id);
  if(this.autoApprove)await this.approve(proposal.id);
 }
 private async commit(effect:CartEffect){
  let current=await this.observe();const g=this.goal!;
  if(effect.goalRevision!==g.revision||!verifyFreshCandidate(current,effect.product,g))throw new RunError('execution_failed','approval_state_changed');
  const freshPrice=current.facts.find(f=>f.candidateKey===effect.product&&f.field==='variantPrice'&&f.variantScope?.size===g.size&&f.variantScope?.color===g.color)?.value;
  if(freshPrice!==effect.price)throw new RunError('execution_failed','approval_price_changed');
  this.setPhase('COMMITTING');const add=current.controls.find(c=>c.kind==='ADD_CART'&&c.ownerKey===effect.product);if(!add)throw new RunError('execution_failed','add_control_missing');
  current=await this.dispatch({target:add,kind:'ADD_CART'},current,false,effect);this.setPhase('VERIFYING');
  if(current.heading!=='Keranjang penelitian'){const cart=current.controls.find(c=>c.kind==='OPEN_CART');if(!cart)throw new RunError('execution_failed','cart_navigation_missing');current=await this.dispatch({target:cart,kind:'OPEN_CART'},current,false);}
  const status=verifyCart(current,effect.product,g,effect.price,true);this.lastVerification=status;this.hooks.log('final_verification',{...this.envelope(),verification_status:status});
  await this.finish(status==='PASS'?'verified_complete':'execution_failed',status==='PASS'?'':'cart_unverified');
 }
 private fail(e:unknown){return this.finish(e instanceof RunError?e.reason:'infrastructure_failed',e instanceof Error?e.message:'unknown_error');}
 finish(reason:Reason,detail=''):Promise<void>{
  if(this.terminalPromise)return this.terminalPromise;
  this.terminal=true;this.epoch++;this.held=true;for(const a of this.aborts)a.abort();this.waiter?.();clearTimeout(this.deadline);clearTimeout(this.inputTimer);clearTimeout(this.intakeTimer);this.approval.invalidate();
  const terminalAt=Date.now();const matrix=this.goal?this.evidence.matrix(this.observer.known,this.goal):{};
  if(this.goal&&['verified_complete','no_feasible_in_scope','insufficient_evidence'].includes(reason))this.counters.evidenceClosureProbe??=this.counters.probes;
  const outcome:AgentOutcome={run_id:this.id,selected_product:this.proposalEffect?this.observer.known.find(c=>c.key===this.proposalEffect!.product)??null:null,goal:this.goal?structuredClone(this.goal):null,goal_history:structuredClone(this.goalHistory),agent_claimed_success:reason==='verified_complete',agent_termination_reason:reason,detail,counters:structuredClone(this.counters),goal_intake_ms:(this.goalAcceptedAt??terminalAt)-this.intakeAt,task_wall_ms:this.goalAcceptedAt?terminalAt-this.goalAcceptedAt:0,cleanup_ms:0,public_refutations:Boolean(this.goal&&this.observer.known.length===3&&this.observer.known.every(c=>refuted(matrix,c.key,this.goal!))),completion_audio_delivered:null,verification_status:this.lastVerification};
  try{this.hooks.log('agent_outcome_frozen',{...this.envelope(),outcome});this.setPhase('TERMINAL');}catch{/* Gate is already closed if storage failed. */}
  this.terminalPromise=(async()=>{let quiescent=false;let timer:NodeJS.Timeout|undefined;
   try{this.setPhase('CLEANUP');await Promise.race([this.browser.close().then(()=>this.server?.close()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('cleanup_timeout')),LIMITS.cleanupMs);})]);quiescent=true;}catch{if(this.server){await this.server.kill().catch(()=>{});quiescent=this.server.process().exitCode!==null;}}finally{clearTimeout(timer);}
   outcome.cleanup_ms=Date.now()-terminalAt;try{await this.hooks.finished(Object.freeze(outcome),quiescent);}finally{this.resolveDone();}
  })();return this.terminalPromise;
 }
}
