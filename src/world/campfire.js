import * as THREE from 'three';
import {paint} from '../figure/figure.js';
export const FIRE_COST=12;

const surfaceVertex=`
 varying vec2 vUv;varying float vPhase;
 void main(){
   vUv=uv;vPhase=dot(modelMatrix[3].xz,vec2(3.17,5.21));
   gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
 }`;
const flameFragment=`
 uniform float t;uniform float rain;varying vec2 vUv;varying float vPhase;
 void main(){
   float y=vUv.y,x=vUv.x-.5;
   float curl=.079*sin(y*7.-t*4.4+vPhase)+.038*sin(y*13.-t*5.8-vPhase);
   float edge=abs(x+y*curl);
   float width=(.38+.056*sin(y*12.-t*4.8+vPhase))*pow(max(0.,1.-y),.73);
   float shape=(1.-smoothstep(width*.58,width+.045,edge))*smoothstep(0.,.13,y);
   float core=(1.-smoothstep(width*.14,width*.68,edge))*(1.-smoothstep(.20,.74,y));
   vec3 colour=mix(vec3(.94,.275,.060),vec3(1.,.68,.20),1.-y);
   colour=mix(colour,vec3(1.,.88,.48),core);
   gl_FragColor=vec4(colour,shape*(.71+.20*core)*(1.-smoothstep(.80,1.,y))*(1.-rain*.13));
 }`;

// All fourteen puffs travel in one draw call. Each keeps its own life and
// rotation while the same wind that moves the rain carries it across the camp.
function paintedSmoke(uniforms){
 const plane=new THREE.PlaneGeometry(1,1),g=new THREE.InstancedBufferGeometry();
 g.index=plane.index;g.setAttribute('position',plane.attributes.position);g.setAttribute('uv',plane.attributes.uv);
 g.setAttribute('aPuff',new THREE.InstancedBufferAttribute(Float32Array.from({length:14},(_,i)=>i),1));g.instanceCount=14;
 g.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,2.4,0),4.7);
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
   vertexShader:`uniform float t,rain;uniform vec3 wind;attribute float aPuff;varying vec2 vPaint;varying float vOpacity,vAge;
   void main(){
     float age=fract(t*(.145+.002*mod(aPuff,3.))+aPuff/14.);vAge=age;
     vec2 drift=wind.xy*(.42+.89*wind.z+.37*rain)*age*age;
     vec2 eddy=vec2(sin(4.*age+aPuff),cos(5.*age+aPuff*.8))*(.05+.14*age);
     vec2 ground=drift+eddy;
     vec3 centre=vec3(ground.x,.56+age*(3.30-.54*rain),ground.y);
     vec4 eye=modelViewMatrix*vec4(centre,1.);
     float a=aPuff*2.41+age*.58;mat2 spin=mat2(cos(a),-sin(a),sin(a),cos(a));
     eye.xy+=spin*position.xy*(.38+age*1.36);
     vPaint=uv*2.-1.;vOpacity=sin(age*3.14159)*(.19+.05*rain);
     gl_Position=projectionMatrix*eye;
   }`,
   fragmentShader:`uniform sampler2D noise;uniform float night;varying vec2 vPaint;varying float vOpacity,vAge;
   void main(){
     float warp=texture2D(noise,vPaint*.175+vec2(vAge*.13,.37)).r;
     float alpha=(1.-smoothstep(.20,.98,length(vPaint)+(warp-.5)*.48))*vOpacity;
     vec3 tint=mix(vec3(.41,.40,.35),mix(vec3(.44,.38,.33),vec3(.25,.29,.34),vAge),night);
     gl_FragColor=vec4(tint*(.87+.20*warp),alpha);
   }`});
 return new THREE.Mesh(g,material);
}
function flyingSparks(uniforms){
 const g=new THREE.BufferGeometry(),data=new Float32Array(36);
 for(let i=0;i<12;i++){data[i*3]=i/12;data[i*3+1]=(i*.6180339)%1;data[i*3+2]=(i*.38197+.16)%1;}
 g.setAttribute('position',new THREE.BufferAttribute(data,3));g.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,1.35,0),2.4);
 return new THREE.Points(g,new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
   vertexShader:`uniform float t,rain;uniform vec3 wind;varying float vHeat;
   void main(){
     float age=fract(t*(.19+.14*position.y)+position.x),rise=age*(1.45+position.z*1.02)*(1.-.35*rain);
     vec2 drift=wind.xy*age*age*(.42+.49*wind.z);
     vec2 pos=drift+vec2(sin(6.*age+position.x*29.),cos(4.*age+position.z*31.))*(.055+.22*age);
     vec4 eye=modelViewMatrix*vec4(pos.x,.31+rise,pos.y,1.);
     gl_PointSize=clamp((2.+position.y*3.)*(1.-.55*age)*3./max(1.,-eye.z),1.,6.);
     vHeat=(1.-age)*(1.-.62*rain)*smoothstep(0.,.08,age);gl_Position=projectionMatrix*eye;
   }`,
   fragmentShader:`varying float vHeat;void main(){
     float alpha=1.-smoothstep(.25,.50,length(gl_PointCoord-.5));
     gl_FragColor=vec4(mix(vec3(.91,.26,.055),vec3(1.,.77,.34),vHeat),alpha*vHeat);
   }`}));
}

// Three crossed logs, a stone ring, then a permanent hearth.
export function createCampfire(shared,position,{makePaint=paint}={}){
 const group=new THREE.Group();group.name='campfire';group.position.copy(position);
 const stone=makePaint(shared,[[.48,.48,.41],[.26,.28,.27],[.12,.15,.16]]);
 const wood=makePaint(shared,[[.40,.26,.15],[.21,.15,.10],[.09,.08,.07]],{material:'bark'});
 const cut=makePaint(shared,[[.61,.42,.23],[.35,.25,.16],[.15,.13,.10]],{material:'endgrain'});
 const ash=new THREE.Mesh(new THREE.CylinderGeometry(.68,.72,.035,14),makePaint(shared,[[.22,.2,.17],[.12,.12,.11],[.06,.07,.07]]));group.add(ash);
 const rock=new THREE.DodecahedronGeometry(.18,0);
 for(let i=0;i<11;i++){
   const a=i*Math.PI*2/11,m=new THREE.Mesh(rock,stone);m.position.set(Math.cos(a)*.76,.12,Math.sin(a)*.76);
   m.scale.set(1.14+.11*Math.sin(i*2.1),.65+.11*Math.cos(i),1);m.rotation.set(i*.3,i,0);group.add(m);
 }
 const logs=[];
 for(let i=0;i<3;i++){
   const m=new THREE.Mesh(new THREE.CylinderGeometry(.10,.13,1.12,9),[wood,cut,cut]);
   m.rotation.set(Math.PI/2,0,i*Math.PI/3);m.position.set(0,.14+i*.075,0);group.add(m);logs.push(m);
 }
 const uniforms={t:{value:0},night:{value:0},rain:shared.uRain??{value:0},wind:shared.uWind??{value:new THREE.Vector3(.8,.6,1)},noise:shared.tNoise??{value:null}};
 const coals=new THREE.Mesh(new THREE.PlaneGeometry(1.20,1.15),new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,vertexShader:surfaceVertex,
   fragmentShader:`uniform sampler2D noise;uniform float t,night;varying vec2 vUv;
   void main(){
     vec2 p=(vUv-.5)*2.;float edge=1.-smoothstep(.68,.97,length(p));
     float grain=texture2D(noise,p*.38+vec2(.29,.53)).r;
     float vein=(1.-smoothstep(.017,.095,abs(grain-.45)))*edge;
     float glow=(.73+.19*sin(2.1*t+grain*17.)+.08*cos(t*4.2+p.y*3.))*vein;
     vec3 ash=mix(vec3(.10,.075,.065),vec3(.25,.19,.145),grain);
     gl_FragColor=vec4(mix(ash,vec3(.99,.32,.072),glow*(.64+.29*night)),edge*.94);
   }`}));
 coals.rotation.x=-Math.PI/2;coals.position.y=.049;group.add(coals);
 const flameMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,vertexShader:surfaceVertex,fragmentShader:flameFragment});
 const flames=[],sheet=new THREE.PlaneGeometry(.49,.88);
 for(let i=0;i<7;i++){
   const a=i*2.4,m=new THREE.Mesh(sheet,flameMaterial);m.position.set(Math.sin(a)*.22,.59+(i%3)*.045,Math.cos(a)*.19);
   m.rotation.y=a;group.add(m);flames.push(m);
 }
 const smoke=[paintedSmoke(uniforms)],sparks=flyingSparks(uniforms);group.add(smoke[0],sparks);
 const effects=[coals,...flames,...smoke,sparks];let amount=0;
 function setState(value){
   amount=value;logs.forEach((m,i)=>m.visible=value>i*4);
   for(const m of effects)m.visible=value>=FIRE_COST;
 }
 setState(0);
 return {group,logs,flames,smoke,position,setState,update(time,camera,darkness){
   uniforms.t.value=time;uniforms.night.value=darkness;
   if(amount<FIRE_COST){shared.uCampLights?.value[4]?.set(position.x,position.y+.5,position.z,0);return;}
   const flicker=.87+.08*Math.sin(time*7.7)+.05*Math.sin(time*17.3),rain=uniforms.rain.value;
   flames.forEach((m,i)=>m.scale.set(.96+Math.sin(time*4+i)*.12,(flicker+Math.sin(time*5+i*1.7)*.14)*(1.-.16*rain),1));
   shared.uCampLights?.value[4]?.set(position.x,position.y+.65,position.z,(.45+darkness*3.4)*flicker);
 }};
}
