import {insideShack,atShackDoor,cabinColliders,DOOR} from './shack-layout.js';
import {buildShackRoom} from './shack-room.js';
import * as THREE from 'three';
import { paint } from '../figure/figure.js';
import { pinDabs } from '../oilpaint/pins.js';
const UP=new THREE.Vector3(0,1,0),ACROSS=new THREE.Vector3(1,0,0);
const PLANK=[[.76,.56,.32],[.42,.31,.21],[.2,.18,.16]];
const TIMBER=[[.58,.4,.24],[.3,.23,.18],[.13,.13,.13]];
const ROOF=[[.57,.57,.4],[.29,.34,.29],[.14,.19,.19]];
const DARK=[[.22,.24,.2],[.12,.15,.14],[.065,.09,.09]];
const CUT=[[.96,.78,.46],[.68,.48,.27],[.32,.25,.18]];
const WINDOW=[[.97,.79,.42],[.65,.48,.25],[.3,.27,.19]];

export function createShack(shared,site,heightAt,{makePaint=paint}={}) {
 const group=new THREE.Group();group.name='starting-shack';
 // A level foundation, planted into the same terrain as the player's feet.
 const y=Math.max(...[-1.8,1.8].flatMap(x=>[-1.5,1.5].map(z=>heightAt(site.x+x,site.z+z))));
 group.position.set(site.x,y,site.z);
 const palettes=[PLANK,TIMBER,ROOF,DARK,CUT,WINDOW,[[.85,.88,.80],[.45,.52,.48],[.17,.22,.22]],[[.89,.86,.72],[.57,.59,.46],[.23,.28,.25]]],materials=palettes.map(p=>makePaint(shared,p,{grain:4})),parts=[];
 const colliders=[];let shell=null;const rearDoorParts=[];
 function part(geometry,pal,position,count=35,size=[.1,.32],dir=UP){
  const m=new THREE.Mesh(geometry,materials[pal]);m.position.set(...position);if(shell)m.userData.shell=shell;group.add(m);
  parts.push({mesh:m,count,style:()=>({pal,size,dir})});return m;
 }
 const box=(w,h,d,pal,p,count=35,size,dir)=>part(new THREE.BoxGeometry(w,h,d),pal,p,count,size,dir);
 // Weathered upright planks, with timber corners and a low stone-coloured sill.
 box(3.65,.38,3.1,1,[0,-.08,0],90,[.15,.3]);
 for(let i=0;i<13;i++){
  const x=-1.66+i*.277;
  shell='back';const back=box(.267,2.2,.13,0,[x,1.16,-1.45],24);rearDoorParts.push(back);
  shell='front';if(x+.134<=DOOR.left||x-.134>=DOOR.right)box(.267,2.2,.13,0,[x,1.16,1.45],24);
 }
 for(const sign of [-1,1]){
  shell=sign<0?'left':'right';
  for(let i=0;i<11;i++)box(.13,2.2,.263,0,[sign*1.8,1.16,-1.32+i*.264],22);
  for(const z of [-1.49,1.49])box(.15,2.4,.15,1,[sign*1.8,1.2,z],28);
 }
 // Gables close the roof ends; a pair of wide overhanging shingled slopes.
 shell='roof';
 const triangle=new THREE.Shape();triangle.moveTo(-1.8,0);triangle.lineTo(1.8,0);triangle.lineTo(0,1.08);triangle.closePath();
 for(const z of [-1.52,1.4])part(new THREE.ExtrudeGeometry(triangle,{depth:.12,bevelEnabled:false}),0,[0,2.26,z],95,[.12,.25]);
 const angle=Math.atan2(1.24,2.18),slope=Math.hypot(2.18,1.24);
 for(const sign of [-1,1]){
  const roof=box(slope,.13,3.85,2,[sign*1.09,2.89,0],150,[.14,.34],new THREE.Vector3(0,0,1));roof.rotation.z=-sign*angle;
  // Broad, irregular shingle rows rather than a flat geometric roof.
  for(let row=0;row<5;row++){
   const x=sign*(.22+row*.43),h=3.51-Math.abs(x)*Math.tan(angle);
   for(let col=0;col<9;col++){
    const shingle=box(.48,.045,.42,2,[x,h+.06,-1.7+col*.42+(row%2)*.05],4,[.12,.23],new THREE.Vector3(0,0,1));shingle.rotation.z=-sign*angle;
   }
  }
  const trim=box(slope+.08,.12,.12,1,[sign*1.09,2.88,1.94],32,[.08,.3],ACROSS);trim.rotation.z=-sign*angle;
 }
 box(.22,.16,3.98,1,[0,3.54,0],55,[.12,.25],new THREE.Vector3(0,0,1));
 // A real opening, with a hinged door that swings outward as you approach.
 shell='front';
 box(1.4,.12,.13,0,[DOOR.x,2.32,1.45],30);
 const door=box(1.22,2.15,.09,3,[DOOR.x,1.16,1.54],95,[.08,.2]);
 const latch=box(.1,.035,.06,4,[.02,1,1.61],5,[.03,.05]);
 for(const x of [DOOR.left-.06,DOOR.right+.06])box(.1,2.22,.12,1,[x,1.18,1.59],25);
 box(1.47,.12,.12,1,[DOOR.x,2.3,1.59],24,[.1,.25],ACROSS);
 const doorHinge=new THREE.Group();doorHinge.position.set(DOOR.left,0,1.54);group.add(doorHinge);group.updateMatrixWorld(true);doorHinge.attach(door);doorHinge.attach(latch);
 box(.85,.76,.08,3,[.97,1.48,1.55],12);
 box(.65,.56,.08,5,[.97,1.48,1.6],16,[.09,.14]);
 for(const x of [.57,.97,1.37])box(.065,.79,.1,1,[x,1.48,1.67],10,[.035,.15]);
 for(const h of [1.08,1.48,1.88])box(.86,.065,.1,1,[.97,h,1.67],10,[.035,.15],ACROSS);
 box(1.35,.18,.6,1,[-.48,.02,1.83],40,[.12,.25],ACROSS);
 shell='roof';
 box(.36,.82,.4,1,[.82,3.28,-.58],35,[.08,.16]);box(.48,.1,.52,3,[.82,3.71,-.58],15);
 shell=null;
 // Open outdoor rack at the right of the shack, with every cut end facing the clearing.
 const rack={x:2.86,z:1.05};
 for(const x of [rack.x-1.08,rack.x+1.08]){
  box(.11,1.55,.12,1,[x,.65,rack.z-.38],30,[.07,.24]);
  box(.11,.62,.12,1,[x,.22,rack.z+.48],14);
 }
 for(const z of [rack.z-.38,rack.z+.48])box(2.26,.12,.13,1,[rack.x,.13,z],35,[.08,.25],ACROSS);
 const rackRoof=box(2.53,.12,1.38,2,[rack.x,1.52,rack.z],80,[.12,.26],new THREE.Vector3(0,0,1));rackRoof.rotation.x=.12;
 const logs=[];
 for(let row=0;row<4;row++)for(let col=0;col<7-row;col++){
  const radius=.135,log=part(new THREE.CylinderGeometry(radius*.92,radius,1.02,10,1),1,[rack.x+(col-(6-row)/2)*.29,.34+row*.245,rack.z],28,[.07,.19]);
  log.rotation.x=Math.PI/2;log.material=[materials[1],materials[4],materials[4]];
  // Pins on end caps use the pale cut palette as well.
  parts[parts.length-1].style=(p,n)=>({pal:Math.abs(n.y)>.7?4:1,size:Math.abs(n.y)>.7?[.07,.09]:[.07,.19],dir:UP});
  logs.push(log);log.visible=false;
 }
 const projectParts=[];
 function projectBox(w,h,d,pal,p,stage){const mesh=box(w,h,d,pal,p,35);mesh.userData.projectStage=stage;projectParts.push(mesh);return mesh;}
 // Stakes and foundation first, then upright framing, plank walls and finally a roof.
 for(const x of [-4.8,-2.6])for(const z of [-1.2,1.2])projectBox(.16,.35,.16,1,[x,.1,z],0);
 for(const z of [-1.2,1.2])projectBox(2.5,.18,.18,1,[-3.7,.18,z],8);
 for(const x of [-4.8,-2.6])for(const z of [-1.2,1.2])projectBox(.16,2.3,.16,1,[x,1.25,z],16);
 for(const z of [-1.2,1.2])projectBox(2.5,.16,.16,1,[-3.7,2.35,z],24);
 for(let i=0;i<10;i++)projectBox(.23,1.9,.12,0,[-4.78+i*.24,1.25,-1.2],32);
 for(const x of [-4.85,-2.55])for(let i=0;i<7;i++)projectBox(.12,1.3,.25,0,[x,.95,-1.05+i*.32],32);
 const shedRoof=projectBox(2.8,.16,2.95,2,[-3.7,2.5,0],40);shedRoof.rotation.x=.12;
 for(let i=0;i<9;i++){const log=part(new THREE.CylinderGeometry(.14,.16,1.7,8),1,[-4.35+(i%3)*.5,.45+Math.floor(i/3)*.3,0],25);log.rotation.x=Math.PI/2;log.userData.projectStage=40;projectParts.push(log);}
 projectParts.forEach(m=>m.visible=m.userData.projectStage===0);
 const campParts=[],plankStack=[],campColliders=[];
 const campBox=(key,stage,w,h,d,pal,position)=>{const mesh=box(w,h,d,pal,position,32);campParts.push({mesh,key,stage});mesh.visible=false;return mesh;};
 // The hardwood sawmill grows from a staked plot to a timber frame, a work bed and a covered cutting station.
 const mx=6.4,mz=-4.6;
 for(const dx of [-1.6,1.6])for(const dz of [-1.2,1.2]){
  campBox('sawmill',0,.14,.3,.14,1,[mx+dx,.1,mz+dz]);
  campBox('sawmill',8,.22,.25,.3,1,[mx+dx,.1,mz+dz]);
  campBox('sawmill',16,.16,2.3,.16,1,[mx+dx,1.15,mz+dz]);
  campColliders.push({key:'sawmill',stage:16,x:site.x+mx+dx,y:y+1.15,z:site.z+mz+dz,hx:.12,hy:1.2,hz:.12});
 }
 for(const z of [mz-1.2,mz+1.2])campBox('sawmill',24,3.6,.18,.2,1,[mx,2.3,z]);
 for(const x of [mx-1,mx+1])campBox('sawmill',24,.22,.9,.7,1,[x,.5,mz]);
 campBox('sawmill',32,3.5,.2,1,0,[mx,1,mz]);
 campColliders.push({key:'sawmill',stage:32,x:site.x+mx,y:y+.6,z:site.z+mz,hx:1.75,hy:.55,hz:.55});
 for(let i=0;i<4;i++)campBox('sawmill',32,.15,.8,.1,0,[mx-1.5+i,1.5,mz-1.2]);
 const millRoof=campBox('sawmill',40,3.9,.15,3.1,2,[mx,2.5,mz]);millRoof.rotation.x=.08;
 const blade=part(new THREE.CylinderGeometry(.49,.49,.06,32),6,[mx,1.42,mz],65,[.05,.13]);blade.rotation.x=Math.PI/2;blade.visible=false;campParts.push({mesh:blade,key:'sawmill',stage:40});
 for(let i=0;i<16;i++){const tooth=part(new THREE.BoxGeometry(.10,.12,.07),6,[mx+Math.sin(i*Math.PI/8)*.49,1.42+Math.cos(i*Math.PI/8)*.49,mz],4);tooth.rotation.z=-i*Math.PI/8;campParts.push({mesh:tooth,key:'sawmill',stage:40});tooth.visible=false;}
 const feed=part(new THREE.CylinderGeometry(.17,.19,2.1,10),1,[mx+.8,1.22,mz],40);feed.rotation.z=Math.PI/2;feed.visible=false;campParts.push({mesh:feed,key:'sawmill',stage:40});
 for(let i=0;i<12;i++){const mesh=campBox('planks',i+1,1.4,.08,.25,0,[mx-1+(i%3)*.32,.2+Math.floor(i/3)*.10,mz+1.8]);plankStack.push(mesh);}
 // A broad porch and rear cabin room are paid for in planks, and appear piece by piece.
 for(let i=0;i<3;i++)campBox('porch',(i+1)*4,1.22,.18,1.35,0,[-1.22+i*1.22,.09,2.4]);
 for(const x of [-1.8,1.8]){campBox('porch',12,.12,1,.12,1,[x,.6,2.95]);campBox('porch',12,.12,.12,1.35,1,[x,1.1,2.4]);}
 campBox('porch',12,1.3,.12,.4,1,[0,-.04,3.22]);
 for(let i=0;i<6;i++)campBox('lodge',(i+1)*4,.6,.25,2.6,1,[-1.5+i*.6,.06,-2.85]);
 for(let i=0;i<6;i++){const m=campBox('lodge',(i+1)*4,.58,2,.14,0,[-1.5+i*.6,1.15,-4.1]);m.userData.shell='back';}
 for(const x of [-1.8,1.8])for(let i=0;i<3;i++){const m=campBox('lodge',(i+1)*8,.14,2,.84,0,[x,1.15,-1.95-i*.84]);m.userData.shell=x<0?'left':'right';}
 const lodgeRoof=campBox('lodge',24,4.1,.16,3,2,[0,2.35,-2.9]);lodgeRoof.rotation.x=-.10;lodgeRoof.userData.shell='roof';
 campColliders.push({key:'lodge',stage:24,until:true,x:site.x+.05,y:y+.3,z:site.z-.94,hx:.73,hy:.22,hz:.32});
 const room=buildShackRoom({box,part});
 campColliders.push({key:'lodge',stage:24,until:true,x:site.x-1.45,y:y+1.16,z:site.z-1.45,hx:.35,hy:1.1,hz:.08},{key:'lodge',stage:24,until:true,x:site.x+.975,y:y+1.16,z:site.z-1.45,hx:.825,hy:1.1,hz:.08});
 campColliders.push({key:'lodge',stage:24,until:true,x:site.x+DOOR.x,y:y+1.15,z:site.z-1.45,hx:.625,hy:1.1,hz:.08});
 campColliders.push({key:'lodge',stage:24,x:site.x,y:y+.06,z:site.z-2.85,hx:1.8,hy:.125,hz:1.3});
 campColliders.push({key:'lodge',stage:24,x:site.x,y:y+1.15,z:site.z-4.1,hx:1.8,hy:1,hz:.08});
 for(const x of [-1.8,1.8])campColliders.push({key:'lodge',stage:24,x:site.x+x,y:y+1.15,z:site.z-2.85,hx:.08,hy:1,hz:1.3});
 campColliders.push({key:'lodge',stage:24,x:site.x+.95,y:y+.32,z:site.z-2.88,hx:.5,hy:.25,hz:.9});
 parts.forEach(({mesh})=>mesh.userData.shown=mesh.visible);
 group.updateMatrixWorld(true);
 const painted=pinDabs(shared,palettes,parts);painted.update();
 // Separate static shadow meshes share geometry, avoiding self-shadowing the paint dabs.
 const shadow=new THREE.Group(),black=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 for(const {mesh} of parts){const m=new THREE.Mesh(mesh.geometry,black);m.matrixAutoUpdate=false;m.matrix.copy(mesh.matrixWorld);m.visible=mesh.visible;shadow.add(m);}
 const dropoff={x:site.x+rack.x,y:heightAt(site.x+rack.x,site.z+rack.z+1.05),z:site.z+rack.z+1.05};
 colliders.push(...cabinColliders(site,y));
 colliders.push({x:site.x-1.3,y:y+.43,z:site.z-.25,hx:.36,hy:.43,hz:.59});
 colliders.push({x:site.x+1.4,y:y+.95,z:site.z-.17,hx:.33,hy:.95,hz:.76});
 colliders.push({x:site.x+rack.x,y:y+.65,z:site.z+rack.z,hx:1.16,hy:.84,hz:.53});
 let previous=-1,cutaway=false,cutMask='',doorAngle=0;
 function syncVisuals(){
  for(const {mesh}of parts){mesh.visible=(mesh.userData.shown??true)&&!(cutaway&&cutMask.includes(mesh.userData.shell||'!'));}
  group.updateMatrixWorld(true);
  parts.forEach(({mesh},i)=>{shadow.children[i].visible=mesh.visible;shadow.children[i].matrix.copy(mesh.matrixWorld);});painted.update();
 }

 const lamps=[];
 const lampPositions=[[1.28,1.83,-.6],[-1.35,1.85,1.7],[3.4,1.5,2.1],[mx,2,mz]];
 let haloTexture;
 if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');if(ctx){const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,193,92,.65)');gradient.addColorStop(.2,'rgba(255,156,48,.22)');gradient.addColorStop(1,'rgba(255,138,30,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);haloTexture=new THREE.CanvasTexture(c);}}
 const glowMaterial=new THREE.MeshBasicMaterial({color:0xffb95d});
 for(const [i,p]of lampPositions.entries()){
  const core=new THREE.Mesh(new THREE.BoxGeometry(.12,.19,.12),glowMaterial);core.position.set(...p);group.add(core);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(.23,.035,.23),materials[6]);frame.position.set(p[0],p[1]+.12,p[2]);group.add(frame);
  let halo;if(haloTexture){halo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));halo.position.copy(core.position);halo.scale.set(1.3,1.3,1);group.add(halo);}lamps.push({core,frame,halo,i});
 }
 return {group,paint:painted,shadow,dropoff,colliders,campColliders,door:doorHinge,
  updateLighting(night,time,state){
   const strength=night*(.97+.03*Math.sin(time*3.1));
   lampPositions.forEach((p,i)=>{const on=i!==3||state.sawmill>=40;shared.uCampLights.value[i].set(site.x+p[0],y+p[1],site.z+p[2],on?strength*(i===0?2.1:1.7):0);lamps[i].core.visible=on&&night>.05;lamps[i].frame.visible=on;if(lamps[i].halo)lamps[i].halo.material.opacity=on?night:0;});
   shared.uLamp.value.set(site.x+1.28,y+1.83,site.z-.6,night*.6);
  },
  nearDoor(feet){return atShackDoor(group.position,feet);},
  contains(feet,state){return insideShack(group.position,feet,state);},
  updateInterior(dt,feet,camera,state){
   const inside=insideShack(group.position,feet,state),nearDoor=atShackDoor(group.position,feet);
   const reveal=inside||(nearDoor&&feet.z<site.z+2.25);
   const dx=camera.position.x-site.x,dz=camera.position.z-site.z;
   const mask='roof,'+(inside?((dz>=0?'front,':'back,')+(dx>=0?'right':'left')):'');
   const changed=reveal!==cutaway||(reveal&&mask!==cutMask);cutaway=reveal;cutMask=mask;
   const wanted=inside||nearDoor?-Math.PI*.49:0,old=doorAngle;doorAngle=wanted+(doorAngle-wanted)*Math.exp(-9*dt);doorHinge.rotation.y=doorAngle;
   if(changed||Math.abs(old-doorAngle)>.0001)syncVisuals();

   return {inside,reveal,changed:changed||(Math.abs(old-wanted)>.01&&Math.abs(doorAngle-wanted)<=.01),camera:reveal?{center:{x:site.x,y:y+.8,z:site.z-(state.lodge>=24?1.1:0)},distance:state.lodge>=24?7.5:6}:null};
  },
  setProject(amount){let changed=false;for(const mesh of projectParts){const visible=amount>=mesh.userData.projectStage;if(mesh.userData.shown!==visible){mesh.userData.shown=visible;changed=true;}}if(changed)syncVisuals();},
  setCamp(state){let changed=room.setState(state);for(const mesh of rearDoorParts){const visible=state.lodge<24;if(mesh.userData.shown!==visible){mesh.userData.shown=visible;changed=true;}}for(const {mesh,key,stage} of campParts){const unlocked=key==='sawmill'?state.shed>=40:key==='lodge'?state.porch>=12:state.sawmill>=40;const value=key==='planks'?Math.min(12,state.planks):state[key];const visible=unlocked&&value>=stage;if(mesh.userData.shown!==visible){mesh.userData.shown=visible;changed=true;}}if(changed)syncVisuals();},
  updateMill(dt,active){if(active){blade.rotation.y+=dt*9;group.updateMatrixWorld(true);painted.update();}},
  logTarget(wood){const index=Math.min(logs.length-1,Math.max(0,Math.ceil(wood/6)));return logs[index].getWorldPosition(new THREE.Vector3());},
  setWood(wood){
   const count=wood>0?Math.min(logs.length,Math.ceil(wood/6)):0;
   if(count===previous)return;previous=count;
   logs.forEach((log,i)=>log.userData.shown=i<count);syncVisuals();
  },
 };
}
