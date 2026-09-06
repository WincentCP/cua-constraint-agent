import { randomUUID } from 'node:crypto';
import {hash,LIMITS} from './config.ts';
import {RunError,type Goal} from './types.ts';
export type CartEffect={runId:string;goalRevision:number;product:string;size:string;color:string;price:number;quantity:1;effect:'ADD_CART'};
export class Approval {
 proposal?:{id:string;effect:CartEffect}; grant?:{id:string;fingerprint:string;expires:number};
 propose(effect:CartEffect){this.invalidate();return this.proposal={id:randomUUID(),effect};}
 approve(id:string,effect:CartEffect,now=Date.now()){if(!this.proposal||this.proposal.id!==id||hash(effect)!==hash(this.proposal.effect))throw new RunError('execution_failed','approval_mismatch');this.grant={id,fingerprint:hash(effect),expires:now+LIMITS.approvalMs};}
 consume(effect:CartEffect,now=Date.now()){const g=this.grant;this.grant=undefined;if(!g||g.expires<=now||g.fingerprint!==hash(effect))throw new RunError('execution_failed','approval_invalid');}
 invalidate(){this.proposal=undefined;this.grant=undefined;}
}
export function command(text:string):'STOP'|'SKIP'|'REPEAT'|'NEXT'|'YES'|'NO'|'TEXT'|'EMPTY'{
 const t=text.toLocaleLowerCase('id').replace(/[.!?]/g,'').trim();
 if(!t)return 'EMPTY'; if(/^(stop|berhenti|selesai|hentikan)$/.test(t))return 'STOP';
 if(/^(lewati|skip)$/.test(t))return 'SKIP'; if(/^(ulang|ulangi|ulang hasil)$/.test(t))return 'REPEAT';
 if(/^(lanjut|lanjutkan|tugas berikutnya)$/.test(t))return 'NEXT';
 if(/^(ya|iya|setuju|boleh|ya masukkan|masukkan)$/.test(t))return 'YES';
 if(/^(tidak|jangan|tidak jadi|batal)$/.test(t))return 'NO'; return 'TEXT';
}
export function effectFor(runId:string,goal:Goal,product:string,price:number):CartEffect{return {runId,goalRevision:goal.revision,product,size:goal.size,color:goal.color,price,quantity:1,effect:'ADD_CART'};}
