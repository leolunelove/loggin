import * as THREE from 'three';
import { pinDabs } from '../oilpaint/pins.js';
const UP=new THREE.Vector3(0,1,0),ACROSS=new THREE.Vector3(1,0,0);
const LEATHER=[[.6,.38,.2],[.32,.19,.12],[.13,.1,.1]];
const BARK=[[.65,.44,.24],[.35,.24,.16],[.16,.13,.13]];
const CUT=[[.99,.83,.53],[.73,.53,.3],[.38,.29,.21]];
const BRASS=[[.85,.69,.34],[.5,.37,.17],[.23,.18,.12]];
export const PACK_LOGS=9;
// A compact representation of the balance; the exact quantity remains in the wood counter.
export const visibleWoodCount=wood=>Math.min(PACK_LOGS,Math.max(0,Math.ceil((Number(wood)||0)/6)));

function strapGeometry(sign){
 const points=[[.18,.14,.16],[.24,.6,.12],[.23,.7,.3],[.2,.44,.46],[.16,.18,.44]].map(([x,y,z])=>new THREE.Vector3(x*sign,y,z));
 const curve=new THREE.CatmullRomCurve3(points),pos=[],uv=[],indices=[];
 for(let i=0;i<=20;i++){
  const p=curve.getPoint(i/20);
  for(const s of [-1,1]){pos.push(p.x+s*.03,p.y,p.z);uv.push((s+1)/2,i/20);}
  if(i<20){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function createWoodPack(shared,man,{paint,canvasPalette}){
 const group=new THREE.Group();group.name='wood-carrying-pack';
 group.position.set(0,.86,-.29);
 const palettes=[canvasPalette,LEATHER,BARK,CUT,BRASS];
 const materials=palettes.map(p=>paint(shared,p,{grain:4}));
 const parts=[];
 function part(geometry,palette,position,count=50,style=null){
  const mesh=new THREE.Mesh(geometry,materials[palette]);mesh.position.set(...position);mesh.layers.enable(1);group.add(mesh);
  parts.push({mesh,count,style:style||(()=>({pal:palette,size:[.045,.12],dir:UP}))});return mesh;
 }
 // A rounded, open sack: the top is a rim, never a lid hiding the collected wood.
 const profile=[[0,0],[.2,0],[.26,.04],[.29,.17],[.285,.42],[.3,.56]].map(([r,y])=>new THREE.Vector2(r,y));
 const sack=part(new THREE.LatheGeometry(profile,18),0,[0,0,0],340);sack.scale.set(.95,1,.68);
 const rim=part(new THREE.TorusGeometry(.3,.017,5,20),1,[0,.56,0],70);rim.rotation.x=Math.PI/2;rim.scale.y=.68;
 // A small back pocket and two narrow wooden stays make the silhouette read as a working pack.
 const pocket=part(new THREE.SphereGeometry(1,12,8),0,[0,.2,-.175],80);pocket.scale.set(.19,.13,.055);
 part(new THREE.BoxGeometry(.037,.2,.012),1,[0,.24,-.233],20);
 const buckle=part(new THREE.TorusGeometry(.029,.006,4,8),4,[0,.22,-.245],12);buckle.scale.y=1.2;
 for(const sign of [-1,1]){
  part(strapGeometry(sign),1,[0,0,0],65);
  part(new THREE.CylinderGeometry(.018,.022,.7,6),2,[sign*.23,.32,.12],45);
 }
 const logs=[];
 const lengths=[.67,.75,.65,.71,.62,.78,.69,.74,.64];
 for(let i=0;i<PACK_LOGS;i++){
  const row=Math.floor(i/3),col=i%3,length=lengths[i],radius=.052+(i%3)*.004;
  const mesh=part(new THREE.CylinderGeometry(radius*.88,radius,length,9,2),2,[(col-1)*.132,.08+length/2,(row-1)*.12],75,(p,n)=>({pal:Math.abs(n.y)>.65?3:2,size:Math.abs(n.y)>.65?[.022,.045]:[.032,.11],dir:Math.abs(n.y)>.65?ACROSS:UP}));
  mesh.material=[materials[2],materials[3],materials[3]];
  mesh.rotation.set((row-1)*.075,-.1+i*.23,(col-1)*.07);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(radius*.5,.0025,3,12),materials[2]);ring.rotation.x=Math.PI/2;ring.position.y=length/2+.001;mesh.add(ring);
  logs.push({mesh,rest:mesh.position.clone(),amount:0});mesh.visible=false;
 }
 man.object.add(group);man.object.updateMatrixWorld(true);
 // Attach in the bind pose so both straps and bag stay on the torso during walks and axe swings.
 man.bones.spine_03.attach(group);man.object.updateMatrixWorld(true);
 const painted=pinDabs(shared,palettes,parts);
 let count=0,initialized=false;
 return {
  group,paint:painted,logs,
  setWood(wood){
   count=visibleWoodCount(wood);
   if(!initialized){initialized=true;logs.forEach((log,i)=>{log.amount=i<count?1:0;log.mesh.visible=i<count;log.mesh.scale.setScalar(i<count?1:.001);});}
  },
  update(dt){
   logs.forEach((log,i)=>{
    const target=i<count?1:0;
    log.amount=target+(log.amount-target)*Math.exp(-14*dt);
    if(Math.abs(log.amount-target)<.005)log.amount=target;
    log.mesh.visible=log.amount>0;
    log.mesh.scale.setScalar(Math.max(.001,log.amount));
    log.mesh.position.copy(log.rest);log.mesh.position.y+=(1-log.amount)*.09;
   });
   group.updateMatrixWorld(true);painted.update();
  },
 };
}
