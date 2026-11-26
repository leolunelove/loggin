// A long, seamless stereo noise bed with irregular, layered wood fractures.
// Generated once per audio context, never per frame; no pitched oscillator tones.
export function fireSamples(sampleRate,seconds=19,random=Math.random){
 const length=Math.floor(sampleRate*seconds),channels=[new Float32Array(length),new Float32Array(length)];
 for(const data of channels){let brown=0,slow=0;for(let i=0;i<length;i++){const white=random()*2-1;brown=(brown+white*.025)*.985;slow+=(brown-slow)*.02;data[i]=(brown*.24+slow*.6+white*.006)*(.8+.2*Math.sin(i/sampleRate*.9));}
  for(let i=0;i<seconds*24;i++){const start=Math.floor(random()*length),duration=.004+random()**2*.095,n=Math.floor(duration*sampleRate),strength=.035+random()**3*.36;let low=0;for(let j=0;j<n;j++){const noise=random()*2-1;low+=(noise-low)*.38;const envelope=Math.exp(-j/(n*.18));data[(start+j)%length]+=(noise*.6+low*.4)*envelope*strength;}}
 }
 return channels;
}
export function fireMix(listener,position,inside=false){const dx=position.x-listener.x,dz=position.z-listener.z,d=Math.hypot(dx,dz),fade=Math.max(0,1-d/24);return {gain:fade*fade*(inside?.3:.65),pan:Math.max(-.8,Math.min(.8,(-Math.cos(listener.yaw)*dx+Math.sin(listener.yaw)*dz)/Math.max(3,d))),cutoff:inside?850:Math.max(1200,4800-d*130)};}
