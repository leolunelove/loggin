import * as THREE from 'three';
import {commitPickup,pickupPoint,withinPickupReach} from '../world/gather.js';
import {disposeWoodMesh} from '../world/fallen-tree.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),Q=()=>new THREE.Quaternion();
const smooth=(t,a,b)=>THREE.MathUtils.smoothstep(t,a,b);
const world=o=>o.getWorldPosition(V());
export function finishLift(game){
  const lift=game.lift;if(!lift)return;
  if(lift.mesh){
    if(lift.target.part)disposeWoodMesh(lift.mesh);
    else lift.mesh.removeFromParent(); // fieldwork owns the shared wood geometry
  }
  game.lift=null;game.figure.pack.setWood(game.state.carried);
}
export function poseLift(game,dt){
  const lift=game.lift;if(!lift)return;
  const t=lift.age=Math.min(1,lift.age+dt/.99),{figure,animator}=game,body=figure.man.object,b=figure.man.bones;
  const local=(x,y,z)=>body.localToWorld(V(x,y,z));
  if(!lift.mesh){
    if(!withinPickupReach(game,lift.target)){finishLift(game);return;}
    lift.point.copy(pickupPoint(lift.target));
    if(t>=.46){
      const mesh=commitPickup(game,lift.target);if(!mesh){finishLift(game);return;}
      lift.mesh=mesh;lift.start=mesh.position.clone();lift.rotation=mesh.quaternion.clone();
    }
  }
  const grip=smooth(t,.25,.46)*(1-smooth(t,.86,.99));
  const bend=smooth(t,.19,.45)*(1-smooth(t,.49,.77));
  if(bend&&animator.legIK){
    const feet=['l','r'].map(s=>world(b['foot_'+s]));
    const depth=THREE.MathUtils.clamp((body.position.y+1.09-lift.point.y)*.42,.03,.34);
    const pelvis=world(b.pelvis);pelvis.y-=depth*bend;
    b.pelvis.position.copy(b.pelvis.parent.worldToLocal(pelvis));b.pelvis.updateMatrixWorld(true);
    const right=V(-1,0,0).applyQuaternion(body.quaternion);
    for(const bone of ['spine_01','spine_02','spine_03'])animator.rotateWorld(b[bone],right,-.18*bend);
    for(const [i,side] of ['l','r'].entries())animator.legIK(side,feet[i].sub(world(b['foot_'+side])));
  }
  const center=lift.point.clone(),side=V(1,0,0).applyQuaternion(body.quaternion);
  const axis=lift.target.field?V(0,0,1):V(0,1,0);
  if(!lift.mesh)axis.applyQuaternion(lift.target.part?lift.target.part.body.rotation():lift.target.field.g.getWorldQuaternion(Q()));
  if(lift.mesh){
    const pack=figure.pack.group,cradle=local(.10,1.14,.36),rim=pack.localToWorld(V(.04,.49,0));
    const up=smooth(t,.46,.68),over=smooth(t,.68,.94);
    center.copy(lift.start).lerp(cradle,up);
    if(over){
      const curve=new THREE.QuadraticBezierCurve3(cradle,local(.51,2.17,.08),rim);
      center.copy(curve.getPoint(over));
    }
    const across=body.quaternion.clone().multiply(Q().setFromAxisAngle(V(0,0,1),-Math.PI*.47));
    const upright=pack.getWorldQuaternion(Q());
    if(lift.target.field){const turn=Q().setFromAxisAngle(V(1,0,0),-Math.PI/2);across.multiply(turn);upright.multiply(turn);}
    lift.mesh.position.copy(center);lift.mesh.quaternion.copy(lift.rotation).slerp(across,up).slerp(upright,over);
    const carryScale=Math.min(1,.80/(lift.target.part?.length||1.1),.23/(lift.target.part?.radius||lift.target.field?.r||.15));
    lift.mesh.scale.setScalar(THREE.MathUtils.lerp(1,carryScale,up*.55+over*.45)*(1-smooth(t,.84,.96)));
    lift.mesh.visible=t<.96;lift.mesh.updateMatrixWorld(true);
    axis.copy(lift.target.field?V(0,0,1):V(0,1,0)).applyQuaternion(lift.mesh.quaternion);
    figure.pack.setWood(game.state.carried-(t<.89?lift.target.amount:0));
    if(t>=.88&&!lift.sounded){
      lift.sounded=true;game.audio.stack(rim,Math.max(1,lift.target.amount));
      game.toast(lift.target.amount?'Packed '+lift.target.amount+(lift.target.hard?' hardwood':' timber'):'Cleared a brushwood offcut');
    }
  }
  if(grip){
    if(axis.dot(side)<0)axis.negate();
    const radius=(lift.target.part?.radius||lift.target.field?.r||.15)*(lift.mesh?.scale.x??1);
    const under=local(0,.83,0).sub(center).projectOnPlane(axis).add(V(0,-.28,0)).projectOnPlane(axis).normalize();
    const palms=center.clone().addScaledVector(under,radius*.96);
    const width=Math.min(.235,(lift.target.part?.length||1.1)*.29)*(1-smooth(t,.77,.94));
    game.unloadAnimation.arm('l',palms.clone().addScaledVector(axis,width),grip);
    game.unloadAnimation.arm('r',palms.clone().addScaledVector(axis,-width),grip);
    if(game.stowWeight>.76){
      figure.pack.axeLoop.getWorldPosition(game.axe.position);figure.pack.axeLoop.getWorldQuaternion(game.axe.quaternion);game.axe.updateMatrixWorld(true);
    }
  }
  if(t>=1)finishLift(game);
}
