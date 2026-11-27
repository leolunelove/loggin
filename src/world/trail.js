import * as THREE from 'three';
import {COMMON} from '../oilpaint/common.js';
import {riverCenter} from './river.js';
import {segmentDistance} from '../exploration.js';

export function buildTrail(origin,site,spec,heightAt,material,shared) {
  const start=new THREE.Vector3(origin.x-7,0,origin.z+4.2),end=new THREE.Vector3(site.x+(spec.name==='orchard-cottage'?-1.1:0),0,site.z+spec.d/2+3.5);
  const mid=start.clone().lerp(end,.55);mid.x=start.x+(end.x-start.x)*.28;
  const curve=new THREE.CatmullRomCurve3([start,new THREE.Vector3(start.x-.7,0,origin.z-5),mid,end],false,'centripetal');
  const points=curve.getSpacedPoints(Math.max(5,Math.ceil(curve.getLength()/1.35))).map(v=>({x:Math.min(v.x,riverCenter(v.z)-6.8),z:v.z}));
  const group=new THREE.Group(), segments=[],distances=[0],rails=[];
  for(const [i,p] of points.entries()){
    if(i)distances.push(distances[i-1]+Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z));
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],len=Math.hypot(b.x-a.x,b.z-a.z)||1;
    const width=.93+.06*Math.sin(i*1.72),dx=-(b.z-a.z)*width/len,dz=(b.x-a.x)*width/len;
    rails.push([-1,1].map(side=>{const x=p.x+side*dx,z=p.z+side*dz;return [x,heightAt(x,z)+.10,z];}));
  }
  const verts=[],indices=[],coords=[];
  for(const [i,pair] of rails.entries()){verts.push(...pair[0],...pair[1]);coords.push(-1,distances[i],1,distances[i]);}
  for(let i=0;i<points.length-1;i++){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(coords,2));
  const dirt=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms:shared,side:THREE.DoubleSide,
    vertexShader:`${COMMON}\nout vec2 track;out vec3 ground;void main(){track=uv;ground=position;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}`,
    fragmentShader:`${COMMON}\nin vec2 track;in vec3 ground;out vec4 outC;
    void main(){
      float chip=texture(tNoise,ground.xz*1.9).r,rough=texture(tNoise,vec2(track.x*2.9,track.y*.78)).g;
      float edge=abs(track.x)+.22*(rough-.45);
      if(edge>.95||edge>.82&&chip>.71)discard;
      float rut=exp(-pow((abs(track.x)-.58)*9.,2.))*(.3+.7*rough);
      float sun=woodSunAt(ground+vec3(0.,.24,0.));
      vec3 c=mix(vec3(.34,.255,.18),vec3(.64,.49,.32),smoothstep(.29,.73,rough+.18*(chip-.5)));
      c*=.86+.30*sun-.11*rut;
      float litter=smoothstep(.65,.81,chip+smoothstep(.53,.98,edge)*.14);
      c=mix(c,vec3(.66,.44,.23)*(.71+.29*sun),litter*.78);
      outC=vec4(hazed(c,ground),1.);
    }`});
  const ribbon=new THREE.Mesh(geo,dirt);group.add(ribbon);
  for(let i=8;i<points.length;i+=9){
    const [x,y,z]=rails[i][0],post=new THREE.Mesh(new THREE.BoxGeometry(.11,.76,.11),material);
    post.position.set(x,y+.29,z);post.rotation.z=.06;post.userData.segment=i;segments.push(post);group.add(post);
  }
  const length=distances.at(-1);
  function sample(progress){
    const d=THREE.MathUtils.clamp(progress,0,1)*length;
    let lo=0,hi=distances.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(distances[m]<=d)lo=m;else hi=m;}
    const a=points[lo],b=points[lo+1],f=(d-distances[lo])/(distances[lo+1]-distances[lo]||1);
    return {x:THREE.MathUtils.lerp(a.x,b.x,f),z:THREE.MathUtils.lerp(a.z,b.z,f),yaw:Math.atan2(b.x-a.x,b.z-a.z)};
  }
  function nearest(p){
    let distance=Infinity,progress=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],d=segmentDistance(p,a,b);
      if(d<distance){distance=d;const dx=b.x-a.x,dz=b.z-a.z,len=distances[i]-distances[i-1];
        const t=THREE.MathUtils.clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(len*len||1),0,1);
        progress=(distances[i-1]+t*len)/length;}
    }return {distance,progress};
  }
  let cleared=-1;
  function build(paid,clearAt){
    const through=Math.floor((points.length-1)*paid/40);geo.setDrawRange(0,through*6);
    for(const m of segments)m.visible=m.userData.segment<=through;
    if(paid<=0)return;
    for(let k=cleared+1;k<=through;k++)clearAt(points[k],1.24);
    cleared=through;
  }
  return {group,points,length,sample,nearest,build};
}
