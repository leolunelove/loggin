import * as THREE from 'three';
import {createHarnessStrap} from './harness.js';
import { pinDabs } from '../oilpaint/pins.js';
import {PATCH_FILES} from '../exploration.js';
const UP=new THREE.Vector3(0,1,0),ACROSS=new THREE.Vector3(1,0,0);
const LEATHER=[[.6,.38,.2],[.32,.19,.12],[.13,.1,.1]];
const BARK=[[.65,.44,.24],[.35,.24,.16],[.16,.13,.13]];
const CUT=[[.99,.83,.53],[.73,.53,.3],[.38,.29,.21]];
const BRASS=[[.85,.69,.34],[.5,.37,.17],[.23,.18,.12]];
export const PACK_LOGS=9;
// A compact representation of the balance; the exact quantity remains in the wood counter.
export const visibleWoodCount=wood=>Math.min(PACK_LOGS,Math.max(0,Math.ceil((Number(wood)||0)/6)));

const canvasRings=[[0,.013],[.149,.014],[.213,.027],[.248,.062],[.276,.122],[.288,.213],
 [.290,.302],[.281,.392],[.272,.469],[.283,.524],[.288,.551],[.284,.559],[.271,.551],[.263,.512],[.248,.421],[.18,.160],[0,.115]];

function canvasPoint(angle,radius,height) {
 const x=Math.sin(angle),z=Math.cos(angle),t=height/.56;
 const fold=(.016+.023*t)*Math.cos(angle*7+.65*Math.sin(t*4.1))+.013*Math.cos(angle*3+t*5.3);
 const edge=THREE.MathUtils.smoothstep(height,.36,.55);
 return new THREE.Vector3(.94*radius*Math.sign(x)*Math.abs(x)**.88*(1+fold),
   height+edge*(.015*Math.cos(2*angle-2.6)+.008*Math.sin(3*angle+.4)),
   .67*radius*Math.sign(z)*Math.abs(z)**.88*(1+fold));
}
function canvasGeometry() {
 const segments=40,g=new THREE.LatheGeometry(canvasRings.map(([r,y])=>new THREE.Vector2(r,y)),segments),p=g.attributes.position;
 for(let i=0;i<=segments;i++)for(let j=0;j<canvasRings.length;j++){
  const v=canvasPoint(i*2*Math.PI/segments,...canvasRings[j]);p.setXYZ(i*canvasRings.length+j,v.x,v.y,v.z);
 }
 g.computeVertexNormals();
 const n=g.attributes.normal;
 for(let j=0;j<canvasRings.length;j++){
  const end=segments*canvasRings.length+j,v=new THREE.Vector3().fromBufferAttribute(n,j).add(new THREE.Vector3().fromBufferAttribute(n,end)).normalize();
  n.setXYZ(j,v.x,v.y,v.z);n.setXYZ(end,v.x,v.y,v.z);
 }
 return g;
}
function piping(points,radius,closed=false){
 return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,closed),closed?50:18,radius,5,closed);
}
function pouchGeometry(){
 const p=[],uv=[],idx=[],rows=[[.106,.069],[.148,.100],[.162,.167],[.156,.227],[.143,.251]];
 for(let j=0;j<rows.length;j++)for(let i=0;i<=12;i++){
  const t=i/6-1,[rx,y]=rows[j],x=t*rx;
  p.push(x,y-.014*(1.-t*t),-.169-.062*(1.-t*t)*Math.sin(.37+.58*j)-.014*(1.-t*t));
  uv.push(i/12,j/(rows.length-1));const a=j*13+i;
  if(j<rows.length-1&&i<12)idx.push(a,a+13,a+1,a+1,a+13,a+14);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

export function createWoodPack(shared,man,{paint,canvasPalette}){
 const group=new THREE.Group();group.name='wood-carrying-pack';
 group.position.set(0,.86,-.29);
 const palettes=[canvasPalette,LEATHER,BARK,CUT,BRASS];
 const finishes=['canvas','leather','bark','endgrain',null];
 const materials=palettes.map((p,i)=>paint(shared,p,{grain:4,material:finishes[i]}));
 const canvas=new THREE.Group();canvas.name='sewn canvas';group.add(canvas);
 const parts=[],straps=[];
 const shirt=man.meshes?.find(mesh=>mesh.name.includes('casualsuit'));
 let benchWeight=0,outerLayer=0;
 function part(geometry,palette,position,count=50,style=null){
  const mesh=new THREE.Mesh(geometry,materials[palette]);mesh.position.set(...position);mesh.layers.enable(1);group.add(mesh);
  parts.push({mesh,count,style:style||(()=>({pal:palette,size:[.045,.12],dir:UP}))});return mesh;
 }
 // A rounded, open sack: the top is a rim, never a lid hiding the collected wood.
 const sack=part(canvasGeometry(),0,[0,0,0],218,(p,n)=>({pal:0,size:[.026,.064],dir:new THREE.Vector3(-.18*n.z,1,.12*n.x)}));
 canvas.add(sack);
 const rimPoints=Array.from({length:40},(_,i)=>canvasPoint(i*Math.PI/20,.284,.554));
 canvas.add(part(piping(rimPoints,.011,true),1,[0,0,0],44,()=>({pal:1,size:[.007,.014],dir:ACROSS})));
 for(const side of [-1,1]){
  const points=canvasRings.slice(2,11).map(([r,y])=>canvasPoint(side*(2.34+.065*Math.sin(5*y)),r+.002,y));
  canvas.add(part(piping(points,.0034),1,[0,0,0],0));
 }
 const axeLoop=new THREE.Group();axeLoop.name='Axe loops';axeLoop.position.set(-.306,.20,-.055);
 axeLoop.rotation.set(-.065,Math.PI*.51,-.045,'YXZ');group.add(axeLoop);
 for(const y of [.13,.36]){
  const strap=part(new THREE.TorusGeometry(.042,.008,5,12),1,[-.306,y,-.054],8,()=>({pal:1,size:[.005,.012],dir:UP}));
  strap.rotation.x=Math.PI/2;strap.scale.y=.84;
  part(new THREE.BoxGeometry(.064,.033,.018),1,[-.277,y,-.058],5);
 }
 // A small back pocket and two narrow wooden stays make the silhouette read as a working pack.
 canvas.add(part(pouchGeometry(),0,[0,0,0],38,()=>({pal:0,size:[.020,.048],dir:ACROSS})));
 const flapCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.132,.249,-.186),new THREE.Vector3(-.076,.245,-.213),new THREE.Vector3(0,.239,-.219),new THREE.Vector3(.086,.246,-.211),new THREE.Vector3(.138,.249,-.183)]);
 canvas.add(part(new THREE.TubeGeometry(flapCurve,18,.007,5),1,[0,0,0],0));
 const tab=part(new THREE.BoxGeometry(.031,.107,.011),1,[0,.203,-.235],5,()=>({pal:1,size:[.007,.018],dir:UP}));
 tab.rotation.x=-.15;canvas.add(tab);
 const buckle=part(new THREE.TorusGeometry(.020,.0038,5,8),4,[0,.200,-.243],2,()=>({pal:4,size:[.004,.007],dir:UP}));buckle.scale.y=.78;canvas.add(buckle);
 for(const sign of [-1,1]){
  const strap=createHarnessStrap(sign,group.position,shirt,materials[1]);group.add(strap.mesh);straps.push(strap);
  part(new THREE.CylinderGeometry(.013,.017,.597,7),2,[sign*.215,.305,.11],13);
 }
 const logs=[];
 const lengths=[.67,.75,.65,.71,.62,.78,.69,.74,.64];
 for(let i=0;i<PACK_LOGS;i++){
  const row=Math.floor(i/3),col=i%3,length=lengths[i],radius=.052+(i%3)*.004;
  const mesh=part(new THREE.CylinderGeometry(radius*.88,radius,length,9,2),2,[(col-1)*.132,.08+length/2,(row-1)*.12],75,(p,n)=>({pal:Math.abs(n.y)>.65?3:2,size:Math.abs(n.y)>.65?[.022,.045]:[.032,.11],dir:Math.abs(n.y)>.65?ACROSS:UP}));
  mesh.material=[materials[2],materials[3],materials[3]];
  mesh.rotation.set((row-1)*.075,-.1+i*.23,(col-1)*.07);
  logs.push({mesh,rest:mesh.position.clone(),amount:0});mesh.visible=false;
 }
 man.object.add(group);man.object.updateMatrixWorld(true);
 // Attach in the bind pose so both straps and bag stay on the torso during walks and axe swings.
 man.bones.spine_03.attach(group);man.object.updateMatrixWorld(true);
 const homePosition=group.position.clone(),homeRotation=group.quaternion.clone();
 const restPoint=new THREE.Vector3(),restRotation=new THREE.Quaternion(),parentRotation=new THREE.Quaternion();
 const restEuler=new THREE.Euler(0,0,0,'YXZ');
 function restAtBench(seat,weight){
   if(!weight&&!benchWeight)return;
   benchWeight=weight;
   group.position.copy(homePosition);group.quaternion.copy(homeRotation);
   if(seat&&weight>0){
     const yaw=seat.yaw;
     restPoint.set(-.62*Math.cos(yaw)-.039*Math.sin(yaw),.565,.62*Math.sin(yaw)-.039*Math.cos(yaw)).add(seat.position);
     group.parent.worldToLocal(restPoint);
     restRotation.setFromEuler(restEuler.set(-.045,yaw+.43,-.045,'YXZ'));
     group.parent.getWorldQuaternion(parentRotation).invert();
     group.position.lerp(restPoint,weight);
     // The lift clears the bench edge while the straps slide off the shoulders.
     group.position.y+=.10*Math.sin(weight*Math.PI);
     group.quaternion.slerp(restRotation.premultiply(parentRotation),weight);
   }
   group.updateWorldMatrix(false,true);
 }
 const painted=pinDabs(shared,palettes,parts,{surface:true});
 const patches=[];
 function setPatches(places){
   for(const [i,slug] of PATCH_FILES.entries()){
     const found=!!places?.[i]?.found;
     if(found&&!patches[i]){
       const texture=new THREE.TextureLoader().load('./pennant/'+slug+'.webp',()=>{patch.userData.loaded=true;patch.visible=patch.userData.found;});
       const mat=paint(shared,canvasPalette,{material:'canvas',patch:texture});
       mat.polygonOffset=true;mat.polygonOffsetFactor=-2;mat.polygonOffsetUnits=-1;
       const patch=new THREE.Mesh(new THREE.PlaneGeometry(.114,.114),mat),side=i-1;
       patch.name=slug+' discovery patch';patch.rotation.y=Math.PI-side*.42;
       patch.position.set(side*.139,side?.345:.411,side?-.182:-.195);
       patch.userData.texture=texture;patch.userData.loaded=false;
       canvas.add(patch);patches[i]=patch;
     }
     if(patches[i]){patches[i].userData.found=found;patches[i].visible=found&&patches[i].userData.loaded;}
   }
 }
 let count=0,initialized=false,fullness=0,catchAge=1,lastYaw=man.object.rotation.y;
 const lastPosition=man.object.position.clone();
 return {
  group,axeLoop,paint:painted,logs,setPatches,restAtBench,disposePatches(){for(const p of patches)if(p)p.userData.texture.dispose();},
  setLayer(cut){outerLayer=cut===1?.015:cut===2?.019:0;},
  setCanvas(palette){ painted.setPalette(0,palette); for(const [i,key] of ['uL','uM','uS'].entries())materials[0].uniforms[key].value.setRGB(...palette[i]);materials[0].uniforms.uOwn.value.setRGB(...palette[0]); for(const [i,key] of ['uL2','uM2','uS2'].entries())materials[0].uniforms[key].value.setRGB(...palette[i]);materials[0].uniforms.uOwn2.value.setRGB(...palette[0]); },
  catchWood(){catchAge=0;},
  setWood(wood){
   count=visibleWoodCount(wood);
   if(!initialized){initialized=true;fullness=count/PACK_LOGS;logs.forEach((log,i)=>{log.amount=i<count?1:0;log.mesh.visible=i<count;log.mesh.scale.setScalar(i<count?1:.001);});}
  },
  update(dt){
   const yaw=man.object.rotation.y,position=man.object.position,dx=position.x-lastPosition.x,dz=position.z-lastPosition.z;
   const turn=Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw));
   const travelling=dt>0&&Math.hypot(dx,dz)<.55;
   const sideways=travelling?(dx*Math.cos(yaw)-dz*Math.sin(yaw))/Math.max(dt,.004):0;
   const targetRoll=THREE.MathUtils.clamp(sideways*.009+turn*.06,-.035,.035);
   fullness=THREE.MathUtils.damp(fullness,count/PACK_LOGS,9,dt);
   canvas.rotation.z=THREE.MathUtils.damp(canvas.rotation.z,targetRoll,8,dt);
   catchAge=Math.min(1,catchAge+dt/.31);const settle=Math.sin(catchAge*Math.PI*2)*Math.pow(1-catchAge,2);
   canvas.scale.set(.967+.037*fullness+.034*settle,1.-.014*fullness-.047*settle,.954+.063*fullness+.031*settle);
   lastYaw=yaw;lastPosition.copy(position);
   logs.forEach((log,i)=>{
    const target=i<count?1:0;
    log.amount=target+(log.amount-target)*Math.exp(-14*dt);
    if(Math.abs(log.amount-target)<.005)log.amount=target;
    log.mesh.visible=log.amount>0;
    log.mesh.scale.setScalar(Math.max(.001,log.amount));
    log.mesh.position.copy(log.rest);log.mesh.position.y+=(1-log.amount)*.09;
   });
   group.updateMatrixWorld(true);
   for(const strap of straps)strap.update(benchWeight,outerLayer);
   painted.update();
  },
 };
}
