import * as THREE from 'three';
import { swingPose,IMPACT_AT,SWING_VARIANTS } from '../mechanics.js';
import {LOWER_GRIP,haftAt,toolScale,bladePoint,AXE_PROFILES,headPoint} from './axe-shape.js';
export {LOWER_GRIP} from './axe-shape.js';
const UP=new THREE.Vector3(0,1,0),PALM=new THREE.Vector3(0,.075,.015);
export const axeBlade=tier=>new THREE.Vector3(...bladePoint(tier));
const CARRY_GRIP=.105;
const steelOutlines=AXE_PROFILES.map(({points},tier)=>points.map(([x,y])=>new THREE.Vector3(...headPoint(tier,x,y),0)));
const bevelOutlines=AXE_PROFILES.map(({points},tier)=>points.filter(([x])=>x>=.232).map(([x,y])=>new THREE.Vector3(...headPoint(tier,x,y),0)));
export function workingEdge(tier,q,inward){
 const n=inward.clone().applyQuaternion(q.clone().invert());
 return bevelOutlines[tier].reduce((best,p)=>p.dot(n)>best.dot(n)?p:best).clone();
}
const gripAt=y=>new THREE.Vector3(haftAt(y)[0],y,0);
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

// A pinned handle can draw the shoulder blade forward before the elbow straightens.
function reachWithShoulder(collar,upper,lower,hand,target,weight){
 if(!collar||weight<.85)return;
 const origin=point(collar),shoulder=point(upper),elbow=point(lower);
 const toward=target.clone().sub(shoulder),length=toward.length(),reach=shoulder.distanceTo(elbow)+elbow.distanceTo(point(hand));
 if(length<=reach-.002)return;
 const arm=shoulder.clone().sub(origin),wished=arm.clone().addScaledVector(toward,Math.min(.12,length-reach+.006)/length);
 const turn=new THREE.Quaternion().setFromUnitVectors(arm.normalize(),wished.normalize());
 rotateWorld(collar,new THREE.Quaternion().rotateTowards(turn,.48*weight));
 const remaining=target.clone().sub(point(upper)),extra=remaining.length()-reach+.001;
 if(extra<=.0005)return;
 // The scapula also glides across the ribcage. Cap that travel and release it on the next pose.
 const base=collar.position.clone(),offset=remaining.normalize().multiplyScalar(Math.min(.055,extra)*weight);
 collar.position.copy(collar.parent.worldToLocal(point(collar).add(offset)));collar.updateMatrixWorld(true);
 return {bone:collar,base,applied:collar.position.clone()};
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
 constructor(man,animator,axe){Object.assign(this,{man,animator,axe});this.release=1;this.last=null;this.metrics={};this.brace=0;this.sightHold=0;this.shoulderOffsets=[];}
 update(dt,swing,tier,held=null,guards=[],stow=null,sight=null){
  const {man,animator,axe}=this,body=man.object,b=man.bones,scale=toolScale(tier);
  for(const s of this.shoulderOffsets)if(s.bone.position.distanceToSquared(s.applied)<1e-12){s.bone.position.copy(s.base);s.bone.updateMatrixWorld(true);}
  this.shoulderOffsets.length=0;
  const variant=SWING_VARIANTS[swing?.variant]||SWING_VARIANTS[0];
  const p=swing?(swing.poseProgress??swing.age/swing.duration):0,pose=swing?swingPose(p,swing.variant,swing.finishing):null;
  const low=pose?THREE.MathUtils.clamp((body.position.y+1.05-swing.contact.y)/.86,0,1):0;
  if(pose){
   pose.angle+=low*1.04*smooth((p-.30)/.20)*(1-smooth((p-.58)/.38));
   const crouch=smooth(p/.35)*(1-smooth((p-.59)/.41))*low;
   pose.sink+=.34*crouch;pose.lean+=.49*crouch;
  }
  if(swing)this.release=0;else this.release=Math.min(1,this.release+dt/.14);
  const releaseWeight=1-smooth(this.release),lean=pose?.lean??(this.last?.lean||0)*releaseWeight,twist=pose?.twist??(this.last?.twist||0)*releaseWeight;
  const bodyQ=body.getWorldQuaternion(new THREE.Quaternion()),forward=new THREE.Vector3(0,0,1).applyQuaternion(bodyQ),right=new THREE.Vector3(-1,0,0).applyQuaternion(bodyQ);
  const sink=pose?.sink??(this.last?.sink||0)*releaseWeight;
  // Settle the hips and bend the knees while preserving the feet already placed on the terrain.
  if(sink>0&&animator.legIK){
   const feet=['l','r'].map(side=>point(b[`foot_${side}`]));
   const distance=swing?Math.hypot(swing.contact.x-body.position.x,swing.contact.z-body.position.z):0;
   const reachShift=Math.min(.25,Math.max(0,distance-.93)*.70)*smooth((p-.29)/.20)*(1-smooth((p-.57)/.30));
   const shift=forward.clone().multiplyScalar(lean*.06+reachShift).addScaledVector(UP,-sink);
   for(const [i,side] of ['l','r'].entries()){
    const hip=point(b['thigh_'+side]),knee=point(b['calf_'+side]),foot=feet[i];
    const length=hip.distanceTo(knee)+knee.distanceTo(foot)-.002;
    const horizontal=(hip.x+shift.x-foot.x)**2+(hip.z+shift.z-foot.z)**2;
    shift.y=Math.min(shift.y,foot.y+Math.sqrt(Math.max(0,length*length-horizontal))-hip.y);
   }
   const hips=point(b.pelvis).add(shift);
   b.pelvis.position.copy(b.pelvis.parent.worldToLocal(hips));b.pelvis.updateMatrixWorld(true);
   for(const [i,side]of ['l','r'].entries())animator.legIK(side,feet[i].sub(point(b[`foot_${side}`])));
  }
  for(const n of ['spine_01','spine_02','spine_03']){
   animator.rotateWorld(b[n],right,-lean*.4);animator.rotateWorld(b[n],UP,twist/3);
  }
  body.updateMatrixWorld(true);
  const palm=PALM.clone().applyMatrix4(b.hand_r.matrixWorld),handQ=b.hand_r.getWorldQuaternion(new THREE.Quaternion());
  const gait=THREE.MathUtils.clamp(palm.clone().sub(body.position).dot(forward),-.23,.28);
  const carryQ=axeRotation(forward,2.13+gait*.60,-.16);
  const brushing=held?.last&&held.contact?.collider&&!swing&&!(stow?.weight>.04);
  if(!held?.last)this.brace=0;
  this.brace=THREE.MathUtils.damp(this.brace,brushing?1:0,brushing?13:4,dt);
  const carryPalm=palm.clone();
  if(this.brace>.01){
   // Gather the tool upright, in front of the shoulder, when walking it into a post.
   carryQ.slerp(axeRotation(forward,.20,.13),this.brace);
   carryPalm.lerp(body.localToWorld(new THREE.Vector3(-.27,1.16,.24)),this.brace);
  }
  this.sightHold=THREE.MathUtils.damp(this.sightHold,(sight||swing?.sight)&&!(stow?.weight>.04)?1:0,12,dt);
  if(this.sightHold<.001)this.sightHold=0;
  const ready=this.sightHold,carryGrip=THREE.MathUtils.lerp(CARRY_GRIP,-.19,ready);
  if(ready){
   carryQ.slerp(axeRotation(forward,.38,.24),ready);
   carryPalm.lerp(body.localToWorld(new THREE.Vector3(-.245,1.08,.33)),ready);
  }
  const carryPosition=carryPalm.clone().addScaledVector(gripAt(carryGrip).applyQuaternion(carryQ),-scale);
  let position=carryPosition.clone(),rotation=carryQ.clone(),leftWeight=ready,slide=.08+.09*ready,gripY=carryGrip,workingGrip=ready,contactEdge=axeBlade(tier);
  if(swing){
   const mark=swing.sight?swing.contact:swing.t;
   const aim=swing.free?new THREE.Vector3(Math.sin(swing.yaw),0,Math.cos(swing.yaw)):new THREE.Vector3(mark.x-body.position.x,0,mark.z-body.position.z).normalize();
   rotation=axeRotation(aim,pose.angle,pose.roll);
   rotation.slerpQuaternions(carryQ,rotation.clone(),smooth(p/.16));
   const contact=new THREE.Vector3(swing.contact.x,swing.contact.y,swing.contact.z);
   const contactPose=swingPose(IMPACT_AT,swing.variant,swing.finishing),contactQ=axeRotation(aim,contactPose.angle+low*1.04,contactPose.roll);
   const lowWork=swing.sight?.reachable&&swing.contact.y-body.position.y<.63||swing.t.windthrow||['section','stump'].includes(swing.t.kind)||swing.free&&swing.pitch>.70;
   if(!swing.free||swing.sight?.reachable||lowWork)contactEdge=workingEdge(tier,contactQ,lowWork?new THREE.Vector3(0,-1,0):aim);
   const contactPalm=contact.clone().sub(contactEdge.clone().sub(gripAt(LOWER_GRIP)).applyQuaternion(contactQ).multiplyScalar(scale));
   const local=(x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(body.matrixWorld);
   const soft=swing.missed||swing.material==='water',through=contactPalm.clone();
   if(soft)through.addScaledVector(right,variant.name==='Backhand'?-.16:.16).addScaledVector(UP,-.13);
   const recoil=through.clone().addScaledVector(aim,-variant.pull*(swing.finishing?1.22:1)).addScaledVector(UP,soft?-.04:.035);
   const keys=[[0,carryPalm],[.16,local(...variant.ready)],[.34,local(...variant.load)],[.5,contactPalm],[.55,through],[.73,recoil],[1,carryPalm]];
   let a=keys[0],c=keys[1];for(let i=1;i<keys.length;i++){c=keys[i];if(p<=c[0])break;a=c;}
   let k=smooth((p-a[0])/(c[0]-a[0]||1));if(a[0]===.34)k=((p-.34)/.16)**2;
   // Match the walking carry orientation exactly at the end of recovery.
   rotation.slerp(carryQ,smooth((p-.73)/.27));
   const strokeGrip=smooth(p/.16)*(1-smooth((p-.78)/.22));
   workingGrip=ready+(1-ready)*strokeGrip;
   gripY=THREE.MathUtils.lerp(carryGrip,LOWER_GRIP,strokeGrip);
   position=a[1].clone().lerp(c[1],k).addScaledVector(gripAt(gripY).applyQuaternion(rotation),-scale);
   if(!swing.free&&!swing.t.windthrow&&p>.15&&p<.5){
    // Approach the chosen notch along its face. A high arc otherwise brushes the bark
    // above the cut before the hands have even finished the downstroke.
    const localAim=aim.clone().applyQuaternion(rotation.clone().invert());
    const reach=Math.max(...steelOutlines[tier].map(vertex=>vertex.dot(localAim)))*scale;
    const ahead=position.clone().sub(contact).dot(aim)+reach;
    const clearance=.25*(1-smooth((p-.34)/.16));
    position.addScaledVector(aim,-Math.max(0,ahead+clearance)*smooth((p-.15)/.15));
   }
   if(held&&(!swing.free||swing.sight?.reachable)&&!swing.hit){
    const followThrough=smooth((p-.445)/.055)*(1-smooth((p-.565)/.10));
    position.addScaledVector(lowWork?new THREE.Vector3(0,-1,0):aim,.027*followThrough);
   }
   if(swing.sight?.reachable&&!swing.hit&&p>.23){
    // Set the edge opposite the selected patch before driving it through the final
    // handspan. A high or diagonal wind-up can then finish on the same pencil mark.
    const normal=swing.sight.normal,settle=smooth((p-.23)/.15),drive=smooth((p-.385)/.122);
    rotation.slerp(contactQ,settle);
    const edge=workingEdge(tier,rotation,normal.clone().negate());
    const goal=contact.clone().addScaledVector(normal,.265-.303*drive)
      .addScaledVector(UP,.027*(1-drive)).sub(edge.applyQuaternion(rotation).multiplyScalar(scale));
    position.lerp(goal,settle);
   }
   slide=THREE.MathUtils.lerp(.17,pose.slide,1-ready*(1-strokeGrip));leftWeight=ready+(1-ready)*smooth(p/.16)*(1-smooth((p-.78)/.2));
  }else if(this.last&&this.release<1){
   position.copy(this.last.position).applyMatrix4(body.matrixWorld).lerp(carryPosition,smooth(this.release));
   rotation.copy(bodyQ).multiply(this.last.rotation).slerp(carryQ,smooth(this.release));
   leftWeight=THREE.MathUtils.lerp(ready,this.last.leftWeight,releaseWeight);slide=THREE.MathUtils.lerp(.08+.09*ready,this.last.slide,releaseWeight);
   workingGrip=THREE.MathUtils.lerp(ready,this.last.workingGrip,releaseWeight);gripY=THREE.MathUtils.lerp(carryGrip,this.last.gripY,releaseWeight);
  }
  axe.position.copy(position);axe.quaternion.copy(rotation);axe.scale.setScalar(scale);axe.updateMatrixWorld(true);
  // Fit the free backswing to both arms. Camera-driven shoulder posture can change their
  // remaining reach by a few centimetres; the impact itself stays fixed on the bark.
  const fit=swing?smooth((p-.1)/.06)*(1-smooth((p-.42)/.06)):0;
  if(fit>0){
   const correction=new THREE.Vector3(),q=handRotation(rotation);
   for(let pass=0;pass<3;pass++)for(const [side,y]of [['l',gripY+slide],['r',gripY]]){
    const upper=point(b[`upperarm_${side}`]),elbow=point(b[`lowerarm_${side}`]),hand=point(b[`hand_${side}`]);
    const wrist=gripAt(y).applyMatrix4(axe.matrixWorld).sub(PALM.clone().applyQuaternion(q));
    const delta=wrist.sub(upper),length=delta.length(),reach=upper.distanceTo(elbow)+elbow.distanceTo(hand)-.003;
    if(length>reach){const step=delta.multiplyScalar(-(length-reach)/length);axe.position.add(step);correction.add(step);axe.updateMatrixWorld(true);}
   }
   axe.position.addScaledVector(correction,fit-1);axe.updateMatrixWorld(true);
   position.copy(axe.position);
  }
  if(swing?.bite){
   const bite=swing.bite,elapsed=swing.age-bite.at;
   const weight=(1-smooth((elapsed-bite.hold)/.095))*(1-smooth((body.position.distanceTo(bite.feet)-.065)/.22));
   const anchor=bite.position.clone();
   if(bite.follows?.body.isValid()){
    const {body:log,local}=bite.follows;
    const drift=local.clone().applyQuaternion(log.rotation()).add(log.translation()).sub(bite.point).clampLength(0,.065);
    anchor.add(drift);
   }
   position.lerp(anchor,weight);rotation.slerp(bite.rotation,weight);
   // Wood takes the edge for a moment. A hard glance sends it back immediately.
   const spring=Math.max(0,elapsed-bite.hold),rebound=Math.sin(Math.min(1,spring/.095)*Math.PI);
   position.addScaledVector(bite.normal,rebound*(bite.wood?.016:.046)*(swing.energy||.5));
  }
  const tucked=stow?smooth(stow.weight/.74):0;
  let rightWeight=stow?1-smooth((stow.weight-.75)/.25):1;
  if(tucked){
   const socket=stow.loop,arc=Math.sin(Math.PI*tucked);
   position.lerp(socket.getWorldPosition(new THREE.Vector3()),tucked).addScaledVector(UP,arc*.115).addScaledVector(right,arc*.095);
   rotation.slerp(socket.getWorldQuaternion(new THREE.Quaternion()),tucked);
  }
  let resolved=null;
  if(held){
   const grip=gripAt(gripY).multiplyScalar(scale),hands=[];
   for(const [side,y] of [['r',gripY],['l',gripY+slide]]){
    if((side==='l'?leftWeight:rightWeight)<.85)continue;
    const upper=point(b['upperarm_'+side]),elbow=point(b['lowerarm_'+side]),hand=point(b['hand_'+side]);
    const centreAt=rotation=>{
      const q=handRotation(rotation);if(side==='r')q.slerp(handQ,1-workingGrip);
      return upper.clone().add(PALM.clone().applyQuaternion(q));
    };
    hands.push({local:gripAt(y).multiplyScalar(scale),centreAt,reach:upper.distanceTo(elbow)+elbow.distanceTo(hand)-.004});
   }
   const folds=[axeRotation(forward,2.88,-.1),axeRotation(forward,.18,.19),axeRotation(right,2.82,0)];
   const tucks=[{p:body.localToWorld(new THREE.Vector3(-.20,1.12,.30)),q:folds[0]},
    {p:body.localToWorld(new THREE.Vector3(-.35,1.19,.07)),q:folds[1]}];
   resolved=held.solve(position,rotation,tier,dt,typeof guards==='function'?guards():guards,{grip,hands,folds,tucks,working:!!swing||tucked>0&&tucked<1,driving:swing&&!swing.hit&&p>=.34&&p<=.59});
  }
  if(resolved){
   position.copy(resolved.position);rotation.copy(resolved.rotation);
   axe.position.copy(position);axe.quaternion.copy(rotation);axe.updateMatrixWorld(true);
  }
  let docked=false;
  if(tucked===1){
   const gap=position.distanceTo(stow.loop.getWorldPosition(new THREE.Vector3()));
   const angle=rotation.angleTo(stow.loop.getWorldQuaternion(new THREE.Quaternion()));
   docked=gap<.018&&angle<.09;
   // Hold on to the handle while an obstacle is keeping it out of the tool loops.
   rightWeight=Math.max(rightWeight,smooth((gap-.009)/.055),smooth((angle-.055)/.34));
  }
  this.metrics={contact:resolved?.contact,displaced:!!resolved?.displaced,rightWeight,leftWeight,docked};
  {
   for(const [side,y,weight] of [['r',gripY,rightWeight],['l',gripY+slide,leftWeight]]){
    if(weight<.001)continue;
    const q=handRotation(rotation);
    if(side==='r')q.slerp(handQ,1-workingGrip);
    const grip=gripAt(y).applyMatrix4(axe.matrixWorld);
    const wrist=grip.clone().sub(PALM.clone().applyQuaternion(q));
    if(resolved?.displaced){
     const slide=reachWithShoulder(b[`clavicle_${side}`],b[`upperarm_${side}`],b[`lowerarm_${side}`],b[`hand_${side}`],wrist,weight);
     if(slide)this.shoulderOffsets.push(slide);
    }
    const pole=body.position.clone().addScaledVector(right,side==='r'?.8:-.8).addScaledVector(forward,.12);pole.y+=1.05;
    this.metrics[side]=solveArm(b[`upperarm_${side}`],b[`lowerarm_${side}`],b[`hand_${side}`],wrist,pole,q,weight);
    for(const f of animator.fingerPoses||[])if(f.bone.name.endsWith('_'+side))f.bone.quaternion.slerp(f.fist,.9*weight);
   }
   body.updateMatrixWorld(true);
   this.metrics.blade=contactEdge.applyMatrix4(axe.matrixWorld);
   this.metrics.grip=gripAt(gripY).applyMatrix4(axe.matrixWorld);
  }
  if(swing)this.last={position:body.worldToLocal(position.clone()),rotation:bodyQ.clone().invert().multiply(rotation),lean,twist,sink,leftWeight,slide,gripY,workingGrip};
 }
}
