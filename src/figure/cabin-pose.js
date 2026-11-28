import * as THREE from 'three';
import {palmOn} from './hand-contact.js';
import {bedPose} from './bed-pose.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const ease=THREE.MathUtils.smootherstep;
const up=V(0,1,0);

export function cabinPose(action,man,anim,figure){
  const p=action.progress;
  if(!p)return;
  if(action.kind==='bed'){bedPose(action,man,anim,figure);return;}
  const b=man.bones,body=man.object,reading=action.kind==='ledger',yaw=action.yaw;
  const turn=ease(p,0,.37),sit=ease(p,.14,.77),reach=ease(p,.17,.87);
  body.rotation.y+=Math.atan2(Math.sin(yaw-body.rotation.y),Math.cos(yaw-body.rotation.y))*turn;
  body.updateMatrixWorld(true);
  const side=V(Math.cos(yaw),0,-Math.sin(yaw)),front=V(Math.sin(yaw),0,Math.cos(yaw));
  const hip=b.pelvis.getWorldPosition(V()),target=action.hips.clone();
  if(reading)target.addScaledVector(front,.065*Math.sin(Math.PI*sit));
  else target.addScaledVector(front,.085*ease(p,.21,.78)+.025*action.stroke);
  hip.lerp(target,reading?sit:ease(p,.06,.76));
  b.pelvis.position.copy(b.pelvis.parent.worldToLocal(hip));b.pelvis.updateMatrixWorld(true);
  const slope=(reading?.23:.61+.065*action.stroke)*reach;
  for(const [name,k] of [['spine_01',.46],['spine_02',.34],['spine_03',.20]])anim.rotateWorld(b[name],side,slope*k);
  anim.rotateWorld(b.neck_01,side,(reading?.23:.13)*reach);
  anim.rotateWorld(b.Head,side,(reading?.20:.10)*reach);
  if(reading)anim.rotateWorld(b.Head,up,(.045*Math.sin(action.age*1.05)-.07*Math.sin(Math.PI*action.page))*reach);
  for(const which of ['l','r']){
    const sign=which==='l'?1:-1,foot=b['foot_'+which],weight=ease(p,.03,.57);
    const ankle=action.stand.clone().addScaledVector(side,sign*(reading?.145:.17))
      .addScaledVector(front,reading?.48:(which==='l'?.06:-.11));
    ankle.y+=.103;
    anim.legIK(which,ankle.sub(foot.getWorldPosition(V())).multiplyScalar(weight),weight>.04?front.clone().addScaledVector(side,sign*.085):null);
  }
  const right=action.right.clone(),left=action.left.clone();
  if(reading){
    const angle=2.79*action.page,returning=ease(action.age%5.6,2.16,2.92);
    right.x-=.095*(1-Math.cos(angle))*(1-returning);
    right.y+=.095*Math.sin(angle)*(1-returning)+.043*Math.sin(Math.PI*returning);
    right.z-=.022*action.page*(1-returning);
    left.z+=.025*Math.sin(action.age*1.32)*reach;
    const pull=ease(p,.04,.31)*(1-ease(p,.37,.70));
    right.lerp(action.hips.clone().add(V(.12,-.065,.15)),pull);
  }else right.x-=.135*action.stroke;
  const pack=figure?.pack;pack?.restAtBench(action,ease(p,.018,.42));
  const grip=pack?ease(p,.015,.14)*(1-ease(p,.25,.52)):0;
  if(grip)left.lerp(pack.group.localToWorld(V(.18,.47,.11)),grip);
  palmOn(man,anim,'l',left,yaw,reading?.09:.17,Math.max(reach,grip));
  palmOn(man,anim,'r',right,yaw,reading?.17:.62,reading?ease(p,.09,.70):reach);
  body.updateMatrixWorld(true);
}
