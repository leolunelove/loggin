import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ForestAudio} from '../src/audio.js';
import {createTreeFall,treeFallPose,trunkGroundGap} from '../src/mechanics.js';

const param=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
function context(){
 const c={currentTime:10,sampleRate:22050,destination:{},sources:[],oscillators:0,resume:()=>Promise.resolve(),decodeAudioData:async()=>({duration:.4}),createBuffer:(_,n)=>({getChannelData:()=>new Float32Array(n)})};
 const node=()=>({gain:param(),pan:param(),frequency:param(),Q:param(),connect(n){return n;},disconnect(){}});
 c.createGain=c.createStereoPanner=c.createBiquadFilter=node;
 c.createDynamicsCompressor=()=>({...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()});
 c.createBufferSource=()=>{const s={...node(),playbackRate:param(),start(at){this.startedAt=at;},stop(at){this.stoppedAt=at;}};c.sources.push(s);return s;};
 c.createOscillator=()=>{c.oscillators++;return {...node(),start(){},stop(){}};};return c;
}
async function engine(){const c=context();const a=new ForestAudio({contextFactory:()=>c,fetcher:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}),random:()=>.4});await a.start();return {a,c};}

test('recorded audio is decoded before play; axe hits use no oscillators or delayed timers',async()=>{
 const {a,c}=await engine();assert.equal(a.buffers.size,7);const count=c.sources.length;
 a.hit(1,0,{x:0,z:0});a.hit(1,0,{x:0,z:0});
 assert.equal(c.sources.length,count+2);assert.equal(c.sources.at(-1).startedAt,10);assert.equal(c.oscillators,0);
 assert.notEqual(c.sources.at(-1).buffer,c.sources.at(-2).buffer,'no immediately repeated take');clearInterval(a.birds);
});
test('a fall has one crack, a growing rush, and exactly one landing at contact',async()=>{
 const {a,c}=await engine();const t={type:1,r:.2,x:0,z:0};const start=c.sources.length;
 const fall=a.beginFall(t);assert.equal(c.sources.length,start+2);a.updateFall(fall,.6);assert.ok(fall.voice.level.gain.value>0);
 a.land(fall);const count=c.sources.length;assert.ok(fall.landed);assert.equal(count,start+3);a.land(fall);assert.equal(c.sources.length,count);
 assert.ok(fall.voice.source.stoppedAt>10);clearInterval(a.birds);
});
test('mute also suppresses newly requested axe and fall sounds',async()=>{
 const {a,c}=await engine();await a.start(false);const start=c.sources.length;a.hit();a.land(a.beginFall({type:0,r:.5,x:0,z:0}));assert.equal(c.sources.length,start);assert.equal(a.master.gain.value,0);clearInterval(a.birds);
});
test('a missing audio file does not reject forest preload',async()=>{
 const warn=console.warn;console.warn=()=>{};try{const a=new ForestAudio({fetcher:async()=>({ok:false})});assert.deepEqual(await a.preload(),[]);}finally{console.warn=warn;}
});
test('landing pose follows sloping ground and precedes its single landing event',()=>{
 for(const slope of [-.12,0,.12]){
  const t={x:0,y:0,z:0,type:1,h:20,r:.2},height=(x,z)=>z*slope;
  const p=createTreeFall(t,0,1,height);
  assert.ok(Math.abs(trunkGroundGap(t,p.contactAngle,0,1,height))<.0001);
  assert.equal(treeFallPose(p,p.duration-.0001).landed,false);assert.equal(treeFallPose(p,p.duration).landed,true);
  assert.equal(treeFallPose(p,p.duration).angle,p.contactAngle);
 }
 const light=createTreeFall({x:0,y:0,z:0,type:1,h:16,r:.2},1,0,()=>0),heavy=createTreeFall({x:0,y:0,z:0,type:2,h:24,r:1.1},1,0,()=>0);
 assert.ok(heavy.duration>light.duration);
});
test('shipped contact clips have immediate attacks, no clipping, and bounded size',()=>{
 let bytes=0;
 for(const name of ['axe-1','axe-2','axe-3','axe-4','trunk-crack','tree-land']){
  const data=fs.readFileSync(new URL(`../public/audio/${name}.wav`,import.meta.url));bytes+=data.length;
  assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.readUInt32LE(24),22050);
  let onset=-1,peak=0;for(let i=44;i<data.length;i+=2){const v=Math.abs(data.readInt16LE(i))/32768;if(v>.03&&onset<0)onset=(i-44)/2;peak=Math.max(peak,v);}
  assert.ok(onset/22050<.002,`${name} attack is delayed`);assert.ok(peak<.96);
 }
 assert.ok(bytes<200000);
});
