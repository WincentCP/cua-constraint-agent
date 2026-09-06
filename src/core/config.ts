import { createHash } from 'node:crypto';
export const LIMITS = Object.freeze({candidates:3,depth:2,probes:4,actions:18,llmCalls:18,recoveries:2,taskMs:180000,intakeMs:60000,llmMs:60000,actionMs:5000,verifyMs:3000,pollMs:250,approvalMs:30000,answerMs:8000,reprompts:2,utteranceMs:20000,silenceMs:1200,ringMs:500,sttMs:20000,ttsMs:10000,heartbeatMs:1000,disconnectMs:3000,cleanupMs:5000,sessionMs:1200000,snapshotNodes:160,snapshotChars:12000,maxProbes:12,context:8192,outputTokens:1024});
export const MODEL = Object.freeze({name:'qwen2.5:7b',temperature:0,seed:42,num_ctx:LIMITS.context,num_predict:LIMITS.outputTokens});
export const hash = (v:unknown) => createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export const CONFIG_HASH = hash({version:4,limits:LIMITS,model:MODEL});
export const ORIGIN='http://localhost:3050';
