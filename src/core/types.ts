import { z } from 'zod';
export const GoalSchema = z.object({revision:z.number().int().positive(),size:z.string().min(1).max(12),color:z.string().min(1).max(30),maxPriceIdr:z.number().int().positive(),material:z.string().min(1).max(30).optional(),quantity:z.literal(1)}).strict();
export type Goal = z.infer<typeof GoalSchema>;
export const ConstraintSchema = z.enum(['requested_variant_available','requested_variant_price','requested_material']);
export type Constraint = z.infer<typeof ConstraintSchema>;
export type Status = 'SATISFIED'|'REFUTED'|'UNKNOWN';
export type Check = 'PASS'|'FAIL'|'UNKNOWN';
export type Condition = 'P'|'B1';
export type Reason = 'verified_complete'|'no_feasible_in_scope'|'insufficient_evidence'|'budget_exhausted'|'execution_failed'|'invalid_plan'|'infrastructure_failed'|'skipped'|'user_stopped'|'no_response'|'unsupported_goal'|'timeout';
export type Phase = 'STARTING'|'EXPLORING'|'COMMIT_PREPARE'|'AWAITING_APPROVAL'|'COMMITTING'|'VERIFYING'|'TERMINAL'|'CLEANUP';
export type Envelope = {session_id:string;run_id:string|null;epoch:number;goal_revision:number};
export type Fact = {candidateKey:string;field:'availability'|'variantPrice'|'material';value:boolean|number|string;variantScope?:{size:string;color:string};observationId:string;sourceRefs:string[];sourceText:string};
export type Descriptor = {role:'link'|'button'|'tab'|'combobox';exactName:string;ownerKey:string;scopeHeading:string;publicUrl?:string};
export type Effect = 'RETURN'|'OPEN_DETAIL'|'OPEN_INFO'|'SET_VARIANT'|'ADD_CART'|'OPEN_CART';
export type RouteStep = {target:Descriptor;kind:Effect;optionLabel?:string};
export type Control = Descriptor & {ref:string;kind:Effect;options:string[];selected?:string;disabled:boolean;expanded?:boolean};
export type Candidate = {key:string;title:string;initialOrder:number;detail:Descriptor};
export type Probe = {probeId:string;ownerKey:string;sourceViewKey:string;controlDescriptor:Descriptor;route:RouteStep[];forwardCost:number;totalActionCost:number;depth:1|2;initialOrder:number};
export type Annotation = {probe_id:string;may_answer:Constraint[];generic_progress_score:number};
export type Matrix = Record<string,Record<Constraint,Status>>;
export type AXNode = {ref:string;role:string;name:string;text:string;states:string;children:AXNode[];url?:string};
export type Observation = {id:string;viewKey:string;heading:string;tree:AXNode[];snapshot:string;controls:Control[];candidates:Candidate[];facts:Fact[];fingerprint:string};
export type Counters = {probes:number;actions:number;observations:number;llmCalls:number;inputTokens:number;outputTokens:number;recoveries:number;informativeProbes:number;evidenceAcquired:number;firstFeasibleProbe:number|null};
export class RunError extends Error { constructor(public reason:Reason,public detail:string){super(detail);} }
export class StaleWork extends Error {}
export const constraints = (g:Goal):Constraint[] => ['requested_variant_available','requested_variant_price',...(g.material?['requested_material']:[])] as Constraint[];
export const same = (a:string,b:string) => a.trim().toLocaleLowerCase('id')===b.trim().toLocaleLowerCase('id');
