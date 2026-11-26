import * as THREE from 'three';
import {paint} from '../figure/figure.js';
export const FIRE_COST=12;
// Three crossed logs, a stone ring, then a permanent hearth. No upkeep timer.
export function createCampfire(shared,position,{makePaint=paint}={}){
 const group=new THREE.Group();group.name='campfire';group.position.copy(position);
 const stone=makePaint(shared,[[.48,.48,.41],[.26,.28,.27],[.12,.15,.16]]),wood=makePaint(shared,[[.4,.26,.15],[.21,.15,.1],[.09,.08,.07]]);
 const ash=new THREE.Mesh(new THREE.CylinderGeometry(.68,.72,.035,14),makePaint(shared,[[.22,.2,.17],[.12,.12,.11],[.06,.07,.07]]));group.add(ash);
 for(let i=0;i<11;i++){const a=i*Math.PI*2/11,m=new THREE.Mesh(new THREE.DodecahedronGeometry(.18,0),stone);m.position.set(Math.cos(a)*.76,.12,Math.sin(a)*.76);m.scale.set(1.2,.7,1);m.rotation.set(i*.3,i,0);group.add(m);}
 const logs=[];for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,1.12,8),wood);m.rotation.set(Math.PI/2,0,i*Math.PI/3);m.position.set(0,.14+i*.075,0);group.add(m);logs.push(m);}
 const fireTime={value:0},night={value:0};
 const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 const flameMaterial=new THREE.ShaderMaterial({uniforms:{t:fireTime},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,vertexShader:vertex,fragmentShader:`uniform float t;varying vec2 vUv;void main(){vec2 p=vUv;float sway=sin(p.y*8.-t*5.)*.065*p.y+sin(p.y*17.+t*3.)*.025;float width=(1.-p.y)*.43;float edge=abs(p.x-.5+sway);float shape=smoothstep(width,width-.10,edge)*smoothstep(0.,.12,p.y);float tongues=.65+.35*sin(p.y*23.-t*9.+p.x*12.);float a=shape*tongues*(1.-smoothstep(.78,1.,p.y));vec3 c=mix(vec3(1.,.83,.27),vec3(1.,.16,.018),p.y);gl_FragColor=vec4(c,a*.8);}`});
 const flames=[];for(let i=0;i<7;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(.5,.95),flameMaterial);const a=i*2.4;m.position.set(Math.sin(a)*.21,.67+(i%2)*.07,Math.cos(a)*.21);m.rotation.y=a;m.userData.phase=i*1.7;group.add(m);flames.push(m);}
 const smokeMaterial=new THREE.ShaderMaterial({uniforms:{t:fireTime,night,opacity:{value:1}},transparent:true,depthWrite:false,side:THREE.DoubleSide,vertexShader:vertex,fragmentShader:`uniform float t;uniform float night;uniform float opacity;varying vec2 vUv;void main(){vec2 p=vUv*2.-1.;float r=length(p);float w=sin(p.x*9.+t*.6)*sin(p.y*8.-t*.4)*.08;float a=smoothstep(1.,.1,r+w)*.23*opacity;gl_FragColor=vec4(mix(vec3(.36,.35,.31),vec3(.36,.37,.38),night),a);}`});
 const smoke=[];for(let i=0;i<14;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),smokeMaterial.clone());m.material.uniforms.t=fireTime;m.material.uniforms.night=night;group.add(m);smoke.push(m);}
 const emberMaterial=new THREE.MeshBasicMaterial({color:0xffa12c,transparent:true,depthWrite:false});const embers=[];
 for(let i=0;i<12;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.018,4,3),emberMaterial);group.add(m);embers.push(m);}
 let amount=0;
 function setState(value){amount=value;logs.forEach((m,i)=>m.visible=value>i*4);for(const m of [...flames,...smoke,...embers])m.visible=value>=FIRE_COST;}
 setState(0);
 return {group,logs,flames,smoke,position, setState,
  update(time,camera,darkness){fireTime.value=time;night.value=darkness;const burning=amount>=FIRE_COST;
   if(!burning){if(shared.uCampLights?.value[4])shared.uCampLights.value[4].set(position.x,position.y+.5,position.z,0);return;}
   const flicker=.87+.08*Math.sin(time*7.7)+.05*Math.sin(time*17.3);
   flames.forEach((m,i)=>{m.scale.set(1+Math.sin(time*4+i)*.12,flicker+Math.sin(time*6+i*1.7)*.13,1);});
   smoke.forEach((m,i)=>{const age=(time*.15+i/14)%1;m.position.set(Math.sin(age*4+i)*.14+age*.9,.6+age*3.6,Math.cos(age*5+i)*.12+age*.25);m.scale.setScalar(.38+age*1.5);m.material.uniforms.opacity.value=Math.sin(age*Math.PI);if(camera)m.quaternion.copy(camera.quaternion);});
   embers.forEach((m,i)=>{const age=(time*(.22+i*.006)+i/12)%1;m.position.set(Math.sin(time*.9+i)*age*.45,.2+age*1.9,Math.cos(time+i)*age*.45);m.scale.setScalar((1-age)*(.5+.5*Math.sin(i*2+time)**2));});
   shared.uCampLights?.value[4]?.set(position.x,position.y+.65,position.z,(.45+darkness*3.4)*flicker);
  }
 };
}
