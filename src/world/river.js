import * as THREE from 'three';
import {WORLD} from './seed.js';
import {COMMON} from '../oilpaint/common.js';
export const riverPhase=()=>((WORLD.seed%10000)/10000)*Math.PI*2;
export const riverCenter=z=>24+Math.sin(z*.035+riverPhase())*5+Math.sin(z*.08+riverPhase())*1.5;
export const riverDistance=(x,z)=>Math.abs(x-riverCenter(z));
export const riverDepth=(x,z)=>1.15*Math.max(0,1-(riverDistance(x,z)/5.5)**2);
export function createRiver(shared,heightAt){
 const positions=[],indices=[],N=240;
 for(let i=0;i<=N;i++){
  const z=-192+i*384/N,x=riverCenter(z),y=heightAt(x,z)+.74;
  for(const side of [-1,1])positions.push(x+side*(4.4+Math.sin(z*.17)*.12),y,z);
  if(i<N){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,side:THREE.DoubleSide,uniforms:shared,
 vertexShader:`${COMMON}\nout vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}`,
 fragmentShader:`${COMMON}\nin vec3 vWorld;layout(location=0) out vec4 outC;void main(){
 float flow=sin(vWorld.z*3.2-uTime*2.4+sin(vWorld.x*3.));
 float brush=sin(floor(vWorld.x*9.)*.7+floor(vWorld.z*5.)*2.3);
 float light=woodSunAt(vWorld+vec3(0.,.2,0.));
 vec3 c=mix(vec3(.13,.26,.25),vec3(.38,.56,.51),light*.7+.15);
 c+=vec3(.13,.16,.12)*smoothstep(.72,.98,flow)*(.6+.4*brush);
 outC=vec4(hazed(c,vWorld),1.);}`});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='winding-river';mesh.frustumCulled=false;return mesh;
}
