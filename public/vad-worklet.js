class LocalVAD extends AudioWorkletProcessor {
 constructor(){super();this.enabled=false;this.ring=new Int16Array(8000);this.buffer=new Int16Array(320000);this.reset();this.port.onmessage=e=>{if(e.data.type==='listen'){this.enabled=!!e.data.enabled;this.reset();}};}
 reset(){this.ring.fill(0);this.buffer.fill(0);this.ringAt=0;this.ringCount=0;this.length=0;this.speaking=false;this.quiet=0;this.onsets=0;this.acc=0;this.accN=0;this.clock=0;}
 sample(v){const value=Math.max(-32768,Math.min(32767,Math.round(v*32767)));if(!this.speaking){this.ring[this.ringAt]=value;this.ringAt=(this.ringAt+1)%this.ring.length;this.ringCount=Math.min(this.ringCount+1,this.ring.length);}else if(this.length<this.buffer.length)this.buffer[this.length++]=value;}
 process(inputs,outputs){const channel=inputs[0]?.[0];if(!this.enabled||!channel)return true;let energy=0;for(const v of channel)energy+=v*v;const speech=Math.sqrt(energy/channel.length)>0.015;
  if(!this.speaking){this.onsets=speech?this.onsets+1:0;if(this.onsets>=3){this.speaking=true;this.length=this.ringCount;for(let i=0;i<this.ringCount;i++)this.buffer[i]=this.ring[(this.ringAt-this.ringCount+i+this.ring.length)%this.ring.length];this.port.postMessage({type:'onset'});}}
  for(const v of channel){this.acc+=v;this.accN++;this.clock+=16000;if(this.clock>=sampleRate){this.sample(this.acc/this.accN);this.clock-=sampleRate;this.acc=0;this.accN=0;}}
  if(this.speaking){this.quiet=speech?0:this.quiet+channel.length/sampleRate;if(this.quiet>=1.2||this.length>=this.buffer.length){const pcm=this.buffer.slice(0,this.length);this.port.postMessage({type:'utterance',pcm,truncated:this.length>=this.buffer.length},[pcm.buffer]);this.enabled=false;this.reset();}}
  return true;
 }
}
registerProcessor('local-vad',LocalVAD);
