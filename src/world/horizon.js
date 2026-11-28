import * as THREE from 'three';
import {COMMON} from '../oilpaint/common.js';
import {noise,rng} from './noise.js';

const TAU=Math.PI*2;
// Each ridge goes all the way around camp. Slopes, saddles and spurs are shared
// by its light and shadow faces, so the silhouette holds as the player walks.
const ranges=[
  {radius:1250,base:.164,relief:.218,phase:.7,peaks:[.26,2.43,3.21,5.47],day:[.56,.59,.68],dusk:[.70,.46,.47],night:[.125,.161,.240]},
  {radius:940,base:.105,relief:.177,phase:2.1,peaks:[1.06,2.76,4.46,5.78],day:[.45,.52,.59],dusk:[.56,.35,.40],night:[.090,.124,.182]},
  {radius:670,base:.061,relief:.119,phase:3.6,peaks:[.53,1.75,3.34,4.95],day:[.34,.44,.47],dusk:[.43,.295,.325],night:[.065,.100,.138]},
  {radius:445,base:.040,relief:.065,phase:5.1,peaks:[.81,2.48,4.12,5.69],day:[.30,.38,.36],dusk:[.32,.262,.265],night:[.044,.074,.099]}
];
function shape(a,r,offset){
  const x=Math.cos(a),z=Math.sin(a),p=r.phase;
  const shoulder=r.peaks.reduce((v,b,i)=>{
    const d=Math.atan2(Math.sin(a-b-offset),Math.cos(a-b-offset)),w=(d<0?.36:.55)+.07*Math.sin(i*2.7+p);
    return Math.max(v,Math.pow(Math.max(0,1-Math.abs(d)/w),.85));
  },0);
  return r.base+r.relief*(.12+.99*shoulder+.19*noise(x*3.1+p,z*3.1)+.098*noise(x*10+p,z*10)+.038*noise(x*29,z*29+p));
}
function geometry(r,layer,offset,random){
  const count=512,p=[],ink=[],idx=[],heights=[];
  for(let i=0;i<count;i++)heights.push(shape(TAU*i/count,r,offset));
  for(let i=0;i<=count;i++){
    const j=i%count,a=TAU*j/count,x=Math.cos(a),z=Math.sin(a),top=heights[j];
    const change=(heights[(j+3)%count]-heights[(j+count-3)%count])*count/(6*TAU);
    const face=Math.min(1,Math.max(0,.53+1.35*change+.24*noise(x*15+r.phase,z*15)));
    // A broken descending spur on the lit slope of each summit.
    const spur=.052*Math.sin(a*3.0+r.phase)+.023*noise(4*x,4*z);
    for(const [y,shade,bend] of [[top,face,0],[top*.63-.012+.016*noise(11*x,11*z),.27+.30*face,spur],[top*.23-.015,.34,spur*1.45],[-.6,.21,0]]){
      p.push(Math.cos(a+bend)*r.radius,y*r.radius,Math.sin(a+bend)*r.radius);ink.push(shade);
    }
    if(i<count)for(let k=0;k<3;k++){const b=4*i+k;idx.push(b,b+1,b+4,b+4,b+1,b+5);}
  }
  if(layer>=2){
    const n=layer===3?730:460;
    for(let i=0;i<n;i++){
      const a=TAU*(i+random()*.62)/n,h=shape(a,r,offset)-.002;
      const climb=(.005+.016*random()**2)*(layer===3?1:.80),w=climb*(.14+.11*random()),base=p.length/3;
      for(const [delta,v] of [[-w,.02],[-w*.36,.50],[-w*.60,.42],[0,1],[w*.48,.47],[w*.30,.54],[w,0]]){
        p.push(Math.cos(a+delta)*r.radius,(h+v*climb)*r.radius,Math.sin(a+delta)*r.radius);ink.push(.21+v*.17);
      }
      for(const t of [[0,1,6],[1,5,6],[2,3,4],[1,4,5]])idx.push(...t.map(q=>base+q));
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('aPigment',new THREE.Float32BufferAttribute(ink,1));g.setIndex(idx);return g;
}
export function paintedRanges(shared){
  const group=new THREE.Group(),random=rng(5419),offset=(random()-.5)*.8;
  ranges.forEach((r,i)=>{
    const material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,side:THREE.DoubleSide,transparent:true,depthTest:true,depthWrite:false,forceSinglePass:true,
      uniforms:{...shared,day:{value:new THREE.Vector3(...r.day)},dusk:{value:new THREE.Vector3(...r.dusk)},night:{value:new THREE.Vector3(...r.night)},distanceLayer:{value:1-i/3}},
      vertexShader:`in float aPigment;out float vPigment;out vec3 vSite;
      void main(){vPigment=aPigment;vSite=position;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}`,
      fragmentShader:`${COMMON}
      uniform vec3 day,dusk,night;uniform float distanceLayer;in float vPigment;in vec3 vSite;out vec4 frag;
      void main(){
        vec3 dir=normalize(vSite-cameraPosition);
        float brush=texture(tNoise,vec2(vSite.x-vSite.z*.37,vSite.y*2.3)*.0045).g;
        float plane=smoothstep(.35,.68,vPigment+.11*(brush-.5));
        vec3 base=mix(day,dusk,uDusk*.97);
        vec3 pigment=base*(.87+.17*vPigment)+vec3(.098,.073,.044)*plane*(.60+.4*distanceLayer);
        pigment=mix(night*(.83+.27*plane),pigment,uDaylight+.29*uDusk*(1.-uDaylight));
        float mist=clamp((uHazeDensity-.0118)*18.,0.,.72);
        float veil=clamp(.11+.25*distanceLayer+.37*mist+.19*uOvercast,0.,.85);
        // Let the actual sky colour show between the lowest trees and the near
        // foothills. Higher layers keep enough pigment to read against one another.
        float rise=smoothstep(-.015,.19,dir.y);
        float coverage=mix(.07,.81-.13*distanceLayer,rise)*(1.-.49*mist)*(1.-.31*uOvercast);
        frag=vec4(mix(pigment,airColour(dir),veil),mix(coverage,.97,1.-uDaylight));
      }`});
    const mesh=new THREE.Mesh(geometry(r,i,offset,random),material);mesh.renderOrder=-8+i;mesh.frustumCulled=false;group.add(mesh);
  });return group;
}
