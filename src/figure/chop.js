import * as THREE from 'three';
import { swingPose,IMPACT_AT,SWING_VARIANTS } from '../mechanics.js';
const UP=new THREE.Vector3(0,1,0),PALM=new THREE.Vector3(0,.075,.015);
export const AXE_BLADE=new THREE.Vector3(.315,.525,0);
export const LOWER_GRIP=-.27;
const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const point=bone=>bone.getWorldPosition(new THREE.Vector3());

function rotateWorld(bone,rotation){
 const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());
 const world=bone.getWorldQuaternion(new THREE.Quaternion());
 bone.quaternion.copy(parent.invert().multiply(rotation.clone().multiply(world)));bone.updateMatrixWorld(true);
}
export function setWorldRotation(bone,world,weight=1){
 const local=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world);
 bone.quaternion.slerp(local,weight);bone.updateMatrixWorld(true);
}

// Analytic two-bone arm solve. The lengths remain fixed, and a stable outward elbow pole
// prevents the arm flipping as the hands pass over the shoulder.
export function solveArm(upper,lower,hand,target,pole,handRotation,weight=1){
 const H=point(upper),E=point(lower),W=point(hand),l1=H.distanceTo(E),l2=E.distanceTo(W);
 const requested=target.clone().sub(H),distance=THREE.MathUtils.clamp(requested.length(),Math.abs(l1-l2)+.001,l1+l2-.001);
 const axis=requested.normalize(),T=H.clone().addScaledVector(axis,distance);
 const bend=pole.clone().sub(H);bend.addScaledVector(axis,-bend.dot(axis));
 if(bend.lengthSq()<1e-8)bend.set(0,0,1).addScaledVector(axis,-axis.z);
 bend.normalize();
 const along=(l1*l1+distance*distance-l2*l2)/(2*distance);
 const wantedElbow=H.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
 const q1=new THREE.Quaternion().setFromUnitVectors(E.clone().sub(H).normalize(),wantedElbow.clone().sub(H).normalize());
 rotateWorld(upper,new THREE.Quaternion().slerp(q1,weight));
 const E2=point(lower),W2=point(hand),goal=W.clone().lerp(T,weight);
 rotateWorld(lower,new THREE.Quaternion().setFromUnitVectors(W2.sub(E2).normalize(),goal.sub(E2).normalize()));
 setWorldRotation(hand,handRotation,weight);
 return point(hand).distanceTo(target);
}

function axeRotation(forward,angle,roll=0){
 const shaft=UP.clone().multiplyScalar(Math.cos(angle)).addScaledVector(forward,Math.sin(angle));
 const blade=UP.clone().multiplyScalar(-Math.sin(angle)).addScaledVector(forward,Math.cos(angle));
 return new THREE.Quaternion().setFromAxisAngle(forward,roll).multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(blade,shaft,blade.clone().cross(shaft))));
}
function handRotation(axeQ){
 const shaft=new THREE.Vector3(0,1,0).applyQuaternion(axeQ);
 const fingers=new THREE.Vector3(1,0,0).applyQuaternion(axeQ);
 const normal=fingers.clone().cross(shaft);
 return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(normal,fingers,shaft));
}

export class ChopAnimation {
 constructor(man,animator,axe){Object.assign(this,{man,animator,axe});this.release=1;this.last=null;this.metrics={};}
 update(dt,swing,tier){
  const {man,animator,axe}=this,body=man.object,b=man.bones,scale=1+tier*.04;
  const variant=SWING_VARIANTS[swing?.variant]||SWING_VARIANTS[0];
  const p=swing?(swing.poseProgress??swing.age/swing.duration):0,pose=swing?swingPose(p,swing.variant,swing.finishing):null;
  if(pose&&swing.t.windthrow){const crouch=smooth(p/.35)*(1-smooth((p-.59)/.41));pose.sink+=.27*crouch;pose.lean+=.46*crouch;}
  if(swing)this.release=0;else this.release=Math.min(1,this.release+dt/.14);
  const releaseWeight=1-smooth(this.release),lean=pose?.lean??(this.last?.lean||0)*releaseWeight,twist=pose?.twist??(this.last?.twist||0)*releaseWeight;
  const bodyQ=body.getWorldQuaternion(new THREE.Quaternion()),forward=new THREE.Vector3(0,0,1).applyQuaternion(bodyQ),right=new THREE.Vector3(-1,0,0).applyQuaternion(bodyQ);
  const sink=pose?.sink??(this.last?.sink||0)*releaseWeight;
  // Settle the hips and bend the knees while preserving the feet already placed on the terrain.
  if(sink>0&&animator.legIK){
   const feet=['l','r'].map(side=>point(b[`foot_${side}`]));
   const hips=point(b.pelvis).addScaledVector(UP,-sink).addScaledVector(forward,lean*.06);
   b.pelvis.position.copy(b.pelvis.parent.worldToLocal(hips));b.pelvis.updateMatrixWorld(true);
   for(const [i,side]of ['l','r'].entries())animator.legIK(side,feet[i].sub(point(b[`foot_${side}`])));
  }
  for(const n of ['spine_01','spine_02','spine_03']){
   animator.rotateWorld(b[n],right,-lean*.4);animator.rotateWorld(b[n],UP,twist/3);
  }
  body.updateMatrixWorld(true);
  const palm=PALM.clone().applyMatrix4(b.hand_r.matrixWorld),handQ=b.hand_r.getWorldQuaternion(new THREE.Quaternion());
  if(!this.carryOffset)this.carryOffset=handQ.clone().invert().multiply(axeRotation(forward,1.3));
  const carryQ=handQ.clone().multiply(this.carryOffset),carryPosition=palm.clone().addScaledVector(new THREE.Vector3(0,LOWER_GRIP,0).applyQuaternion(carryQ),-scale);
  let position=carryPosition.clone(),rotation=carryQ.clone(),leftWeight=0,slide=.08;
  if(swing){
   const aim=new THREE.Vector3(swing.t.x-body.position.x,0,swing.t.z-body.position.z).normalize();
   rotation=axeRotation(aim,pose.angle,pose.roll);
   rotation.slerpQuaternions(carryQ,rotation.clone(),smooth(p/.16));
   const contact=new THREE.Vector3(swing.contact.x,swing.contact.y,swing.contact.z);
   const contactPose=swingPose(IMPACT_AT,swing.variant,swing.finishing),contactQ=axeRotation(aim,contactPose.angle,contactPose.roll);
   const contactPalm=contact.clone().sub(AXE_BLADE.clone().add(new THREE.Vector3(0,-LOWER_GRIP,0)).applyQuaternion(contactQ).multiplyScalar(scale));
   const local=(x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(body.matrixWorld);
   const keys=[[0,palm],[.16,local(...variant.ready)],[.34,local(...variant.load)],[.5,contactPalm],[.55,contactPalm],[.73,contactPalm.clone().addScaledVector(aim,-variant.pull*(swing.finishing?1.22:1)).addScaledVector(UP,.035)],[1,palm]];
   let a=keys[0],c=keys[1];for(let i=1;i<keys.length;i++){c=keys[i];if(p<=c[0])break;a=c;}
   let k=smooth((p-a[0])/(c[0]-a[0]||1));if(a[0]===.34)k=((p-.34)/.16)**2;
   // Match the walking carry orientation exactly at the end of recovery.
   rotation.slerp(carryQ,smooth((p-.73)/.27));
   position=a[1].clone().lerp(c[1],k).addScaledVector(new THREE.Vector3(0,LOWER_GRIP,0).applyQuaternion(rotation),-scale);
   slide=pose.slide;leftWeight=smooth(p/.16)*(1-smooth((p-.78)/.2));
  }else if(this.last&&this.release<1){
   position.copy(this.last.position).applyMatrix4(body.matrixWorld).lerp(carryPosition,smooth(this.release));
   rotation.copy(bodyQ).multiply(this.last.rotation).slerp(carryQ,smooth(this.release));
   leftWeight=this.last.leftWeight*releaseWeight;slide=this.last.slide;
  }
  axe.position.copy(position);axe.quaternion.copy(rotation);axe.scale.setScalar(scale);axe.updateMatrixWorld(true);
  // Fit the free backswing to both arms. Camera-driven shoulder posture can change their
  // remaining reach by a few centimetres; the impact itself stays fixed on the bark.
  const fit=swing?smooth((p-.1)/.06)*(1-smooth((p-.42)/.06)):0;
  if(fit>0){
   const correction=new THREE.Vector3(),q=handRotation(rotation);
   for(let pass=0;pass<3;pass++)for(const [side,gripY]of [['l',LOWER_GRIP+slide],['r',LOWER_GRIP]]){
    const upper=point(b[`upperarm_${side}`]),elbow=point(b[`lowerarm_${side}`]),hand=point(b[`hand_${side}`]);
    const wrist=new THREE.Vector3(0,gripY,0).applyMatrix4(axe.matrixWorld).sub(PALM.clone().applyQuaternion(q));
    const delta=wrist.sub(upper),length=delta.length(),reach=upper.distanceTo(elbow)+elbow.distanceTo(hand)-.003;
    if(length>reach){const step=delta.multiplyScalar(-(length-reach)/length);axe.position.add(step);correction.add(step);axe.updateMatrixWorld(true);}
   }
   axe.position.addScaledVector(correction,fit-1);axe.updateMatrixWorld(true);
   position.copy(axe.position);
  }
  this.metrics={};
  if(swing||this.release<1){
   const rightWeight=swing?smooth(p/.1)*(1-smooth((p-.82)/.18)):releaseWeight;
   for(const [side,gripY,weight] of [['r',LOWER_GRIP,rightWeight],['l',LOWER_GRIP+slide,leftWeight]]){
    if(weight<.001)continue;
    const q=handRotation(rotation),grip=new THREE.Vector3(0,gripY,0).applyMatrix4(axe.matrixWorld);
    const wrist=grip.clone().sub(PALM.clone().applyQuaternion(q));
    const pole=body.position.clone().addScaledVector(right,side==='r'?.8:-.8).addScaledVector(forward,.12);pole.y+=1.05;
    this.metrics[side]=solveArm(b[`upperarm_${side}`],b[`lowerarm_${side}`],b[`hand_${side}`],wrist,pole,q,weight);
    for(const f of animator.fingerPoses||[])if(f.bone.name.endsWith('_'+side))f.bone.quaternion.slerp(f.fist,.9*weight);
   }
   body.updateMatrixWorld(true);
   this.metrics.blade=AXE_BLADE.clone().applyMatrix4(axe.matrixWorld);
  }
  if(swing)this.last={position:body.worldToLocal(position.clone()),rotation:bodyQ.clone().invert().multiply(rotation),lean,twist,sink,leftWeight,slide};
 }
}
