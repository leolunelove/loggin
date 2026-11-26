import {fireSamples,fireMix} from './fire-audio.js';
// Local, preloaded field recordings. No runtime service, requests or generated impact tones.
const FILES=['axe-1','axe-2','axe-3','axe-4','trunk-crack','fall-rush','tree-land'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class ForestAudio {
  constructor({fetcher=globalThis.fetch,contextFactory=()=>new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'}),random=Math.random}={}){
    this.contextFactory=contextFactory;this.random=random;this.context=null;this.on=true;this.buffers=new Map();this.voices=new Set();this.lastHit=-1;this.listener={x:0,z:0,yaw:0};
    this.dataReady=Promise.all(FILES.map(async name=>{const r=await fetcher(new URL(`audio/${name}.wav`,globalThis.document?.baseURI||'http://localhost/'));if(!r.ok)throw new Error(`Missing sound: ${name}`);return [name,await r.arrayBuffer()];})).catch(error=>{this.loadError=true;console.warn('Forest sound preload failed',error);return [];});
  }
  preload(){return this.dataReady;}
  start(on=true){
    this.on=on;
    if(!this.context){
      try{
        const c=this.context=this.contextFactory();
        this.master=c.createGain();this.master.gain.value=on?.85:0;
        // Headroom for a final axe hit, the trunk split and a nearby landing overlapping.
        const safety=c.createDynamicsCompressor();safety.threshold.value=-10;safety.knee.value=8;safety.ratio.value=4;safety.attack.value=.002;safety.release.value=.14;
        this.master.connect(safety).connect(c.destination);
        this.ready=this.dataReady.then(async files=>{await Promise.all(files.map(async([name,data])=>{this.buffers.set(name,await c.decodeAudioData(data));}));}).catch(error=>{this.loadError=true;console.warn('Forest sound decoding failed',error);});
        this.ambience();
      }catch(error){this.context=null;this.loadError=true;console.warn('Forest audio unavailable',error);return Promise.resolve();}
    }
    const c=this.context;c.resume().catch(()=>{});this.master.gain.setTargetAtTime(on?.85:0,c.currentTime,.015);
    return this.ready;
  }
  ambience(){
    const c=this.context,b=c.createBuffer(1,c.sampleRate*4,c.sampleRate),d=b.getChannelData(0);let v=0;
    for(let i=0;i<d.length;i++){v=(v+this.random()*.04-.02)*.98;d[i]=v;}
    const source=c.createBufferSource();source.buffer=b;source.loop=true;
    const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;
    const gain=c.createGain();gain.gain.value=.035;source.connect(filter).connect(gain).connect(this.master);source.start();
    this.birds=setInterval(()=>{if(!document.hidden&&this.on&&(this.daylight??1)>.25&&this.random()<.6)this.bird();},4200);
    this.birds.unref?.();
  }
  updateFire(position,burning,inside=false){
    const c=this.context;if(!c)return;
    if(burning&&!this.fire){const channels=fireSamples(c.sampleRate),buffer=c.createBuffer(2,channels[0].length,c.sampleRate);channels.forEach((data,i)=>buffer.getChannelData(i).set(data));const source=c.createBufferSource(),level=c.createGain(),pan=c.createStereoPanner(),filter=c.createBiquadFilter();source.buffer=buffer;source.loop=true;level.gain.value=0;filter.type='lowpass';source.connect(filter).connect(level).connect(pan).connect(this.master);source.start();this.fire={source,level,pan,filter};}
    if(!this.fire)return;
    const mix=fireMix(this.listener,position,inside);this.fire.level.gain.setTargetAtTime(burning&&this.on?mix.gain:0,c.currentTime,.2);this.fire.pan.pan.setTargetAtTime(mix.pan,c.currentTime,.1);this.fire.filter.frequency.setTargetAtTime(mix.cutoff,c.currentTime,.2);
  }
  bird(){
    const c=this.context;if(!c||!this.on)return;
    const o=c.createOscillator(),g=c.createGain(),t=c.currentTime;
    o.type='sine';o.frequency.setValueAtTime(2100+this.random()*1000,t);o.frequency.exponentialRampToValueAtTime(3200,t+.09);o.frequency.exponentialRampToValueAtTime(1800,t+.22);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.012,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+.25);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.3);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  sample(name,{gain=1,rate=1,position=null,loop=false}={}){
    const c=this.context,buffer=this.buffers.get(name);if(!c||!this.on||!buffer)return null;
    if(this.voices.size>=20)this.stop(this.voices.values().next().value,.01);
    const source=c.createBufferSource(),level=c.createGain(),pan=c.createStereoPanner();
    source.buffer=buffer;source.playbackRate.value=rate;source.loop=loop;
    const dx=(position?.x??this.listener.x)-this.listener.x,dz=(position?.z??this.listener.z)-this.listener.z,distance=Math.hypot(dx,dz);
    pan.pan.value=clamp((-Math.cos(this.listener.yaw)*dx+Math.sin(this.listener.yaw)*dz)/12,-.6,.6);
    const attenuation=1/(1+Math.max(0,distance-2)*.055);
    level.gain.value=gain*attenuation;source.connect(level).connect(pan).connect(this.master);
    const voice={source,level,pan,attenuation,done:false};this.voices.add(voice);
    source.onended=()=>{this.voices.delete(voice);source.disconnect();level.disconnect();pan.disconnect();};
    // Trimmed attacks and decoded buffers put the contact transient on this frame, not a later timeout.
    source.start(c.currentTime);return voice;
  }
  stop(voice,fade=.04){
    if(!voice||voice.done||!this.context)return;voice.done=true;
    const t=this.context.currentTime;voice.level.gain.cancelScheduledValues(t);voice.level.gain.setValueAtTime(voice.level.gain.value,t);voice.level.gain.linearRampToValueAtTime(0,t+fade);voice.source.stop(t+fade+.005);
  }
  hit(type=0,tier=0,position=null,finishing=false){
    let take=Math.floor(this.random()*3);if(take>=this.lastHit)take++;take%=4;this.lastHit=take;
    const rate=[.98,1.045,.9,1][type]*(.98+this.random()*.04)*(1-tier*.012);
    this.sample(`axe-${take+1}`,{gain:finishing?.98:.88,rate,position});
  }
  beginFall(tree){
    const weight=clamp(.78+tree.r*.28,.8,1.2);
    this.sample('trunk-crack',{gain:.7*weight,rate:tree.type===2?.85:1,position:tree});
    const voice=this.sample('fall-rush',{gain:0,rate:.9+this.random()*.12,position:tree,loop:true});
    return {voice,tree,weight,landed:false};
  }
  updateFall(handle,progress){
    if(!handle||handle.landed||!handle.voice||!this.context)return;
    const gain=.62*handle.weight*Math.pow(clamp(progress,0,1),1.3)*handle.voice.attenuation;
    handle.voice.level.gain.setTargetAtTime(gain,this.context.currentTime,.025);
  }
  land(handle){
    if(!handle||handle.landed)return;handle.landed=true;this.stop(handle.voice,.06);
    this.sample('tree-land',{gain:1.05*handle.weight,rate:handle.tree.type===2?.88:.97+this.random()*.06,position:handle.tree});
  }
  upgrade(){
    if(!this.context||!this.on)return;const c=this.context;
    [440,554,659].forEach((hz,i)=>{const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+i*.09;o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(.035,t);g.gain.exponentialRampToValueAtTime(.001,t+.4);o.connect(g).connect(this.master);o.start(t);o.stop(t+.45);o.onended=()=>{o.disconnect();g.disconnect();};});
  }
  unload(position){
    // A short, low wooden clunk with a second quieter log settling onto the rack.
    this.sample('axe-4',{gain:.46,rate:.72,position});
    this.sample('trunk-crack',{gain:.12,rate:1.35,position});
  }
}
