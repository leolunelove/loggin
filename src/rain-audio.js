// Broad rain wash plus short, resonant wooden-roof droplets; both loop seamlessly.
export function rainSamples(rate,roof=false,seconds=17,random=Math.random){
 const n=Math.floor(rate*seconds),channels=[new Float32Array(n),new Float32Array(n)];
 for(const data of channels){let low=0;for(let i=0;i<n;i++){const noise=random()*2-1;low+=(noise-low)*.07;data[i]=(noise*.055+low*.18)*(roof?.28:1);}
  if(roof)for(let k=0;k<seconds*70;k++){const start=Math.floor(random()*n),duration=.012+random()*.038,size=Math.floor(rate*duration),gain=.025+random()**2*.2,freq=350+random()*1500;let low=0;for(let j=0;j<size;j++){low+=((random()*2-1)-low)*.3;const t=j/rate;data[(start+j)%n]+=(low*.7+Math.sin(t*freq*6.283)*.3)*Math.exp(-j/(size*.2))*gain;}}
 }
 return channels;
}
