import * as THREE from 'three';
import {pinDabs} from '../oilpaint/pins.js';
import {solveArm} from './chop.js';
const PALM=new THREE.Vector3(0,.075,.015),UP=new THREE.Vector3(0,1,0);
const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const BARK=[[.65,.44,.24],[.35,.24,.16],[.16,.13,.13]],CUT=[[.99,.83,.53],[.73,.53,.3],[.38,.29,.21]];

export class UnloadAnimation {
 constructor({scene,shared,figure,animator,home,paint}){
  Object.assign(this,{figure,animator,home});this.weight=0;this.last=null;
  this.bundle=new THREE.Group();this.bundle.name='unloading-logs';const parts=[],materials=[paint(shared,BARK,{material:'bark'}),paint(shared,CUT,{material:'endgrain'})];
  for(let i=0;i<3;i++){
   const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.057,.064,.63+i*.045,9),[materials[0],materials[1],materials[1]]);
   mesh.position.set((i-1)*.10,(i%2)*.025,0);mesh.layers.enable(1);this.bundle.add(mesh);
   parts.push({mesh,count:65,style:(p,n)=>({pal:Math.abs(n.y)>.7?1:0,size:Math.abs(n.y)>.7?[.035,.05]:[.045,.12],dir:UP})});
  }
  this.parts=parts;scene.add(this.bundle);this.bundle.updateMatrixWorld(true);
  this.painted=pinDabs(shared,[BARK,CUT],parts);scene.add(this.painted.mesh);this.hide();
 }
 hide(){this.bundle.visible=false;this.parts.forEach(p=>p.mesh.visible=false);this.painted.mesh.visible=false;}
 update(dt,delivery,state){
  const body=this.figure.man.object,b=this.figure.man.bones,animator=this.animator;
  const wq=body.getWorldQuaternion(new THREE.Quaternion());
  this.weight=delivery?1:Math.max(0,this.weight-dt/.14);
  if(!delivery){
   this.hide();this.figure.pack.setWood(state.carried);
   if(this.weight>0&&this.last){
    for(const side of ['r','l'])this.arm(side,this.last[side].clone().applyMatrix4(body.matrixWorld),this.weight);
   }
   return;
  }
  const p=delivery.progress,local=(x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(body.matrixWorld);
  const gather=smooth((p-.13)/.2),lift=smooth((p-.33)/.2),throwing=smooth((p-.58)/.2),release=1-smooth((p-.79)/.21);
  const rightIdle=b.hand_r.getWorldPosition(new THREE.Vector3()).add(PALM.clone().applyQuaternion(b.hand_r.getWorldQuaternion(new THREE.Quaternion())));
  const leftIdle=b.hand_l.getWorldPosition(new THREE.Vector3()).add(PALM.clone().applyQuaternion(b.hand_l.getWorldQuaternion(new THREE.Quaternion())));
  const pickup=local(-.3,1.65,-.25),cradle=local(0,1.18,.4),place=local(0,1.29,.57);
  let center=pickup.clone().lerp(cradle,lift),r=center.clone(),l=cradle.clone();
  const across=new THREE.Vector3(.2,0,0).applyQuaternion(wq);
  r.addScaledVector(across,-lift);l.add(across);
  r.lerp(place.clone().addScaledVector(across,-1),throwing*.55);
  l.lerp(place.clone().add(across),throwing*.55);
  r.lerp(rightIdle,1-gather*release);l.lerp(leftIdle,1-lift*release);
  this.arm('r',r,gather*release);this.arm('l',l,lift*release);
  this.last={r:body.worldToLocal(r.clone()),l:body.worldToLocal(l.clone())};
  const visible=p>=.29&&p<.78;this.bundle.visible=visible;this.parts.forEach(part=>part.mesh.visible=visible);this.painted.mesh.visible=visible;
  this.figure.pack.setWood(Math.max(0,state.carried-(p>=.32&&p<.78?(delivery.parts[delivery.batch]||0):0)));
  if(visible){
   const target=this.home.logTarget(state.wood),flight=smooth((p-.58)/.2);
   const launch=cradle.clone().lerp(place,.35);
   this.bundle.position.copy(center);
   const horizontal=wq.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2));
   this.bundle.quaternion.copy(wq).slerp(horizontal,lift);
   if(p>=.58){
    this.bundle.position.copy(launch).lerp(target,flight);this.bundle.position.y+=Math.sin(flight*Math.PI)*.2;
    this.bundle.quaternion.copy(horizontal).slerp(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2),flight);
   }
   this.bundle.updateMatrixWorld(true);this.painted.update();
  }
 }
 arm(side,palm,weight){
  if(weight<.001)return;
  const body=this.figure.man.object,b=this.figure.man.bones,q=body.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0))));
  const wrist=palm.clone().sub(PALM.clone().applyQuaternion(q)),pole=body.localToWorld(new THREE.Vector3(side==='r'?-.8:.8,1.1,.1));
  solveArm(b[`upperarm_${side}`],b[`lowerarm_${side}`],b[`hand_${side}`],wrist,pole,q,weight);
  for(const f of this.animator.fingerPoses||[])if(f.bone.name.endsWith('_'+side))f.bone.quaternion.slerp(f.fist,.8*weight);
 }
}
