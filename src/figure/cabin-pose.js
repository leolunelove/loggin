import * as THREE from 'three';
import {solveArm} from './chop.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const Q=()=>new THREE.Quaternion();
const UP=V(0,1,0);
const PALM=V(0,.075,.015);
const ease=(p,lo,hi)=>THREE.MathUtils.smootherstep(p,lo,hi);
const yawMix=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
const world=bone=>bone.getWorldPosition(V());

function palmOn(man,anim,side,palm,yaw,curl,weight,tilt=0){
  const b=man.bones,forward=V(Math.sin(yaw),0,Math.cos(yaw));
  forward.applyAxisAngle(V(Math.cos(yaw),0,-Math.sin(yaw)),tilt);
  const across=V(Math.cos(yaw),0,-Math.sin(yaw));
  // Both palms face the surface. Local finger and thumb axes mirror on the rig.
  const thumb=across.clone().multiplyScalar(side==='l'?-1:1);
  const wristQ=Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward.clone().cross(thumb),forward,thumb));
  const wrist=palm.clone().sub(PALM.clone().applyQuaternion(wristQ));
  const elbow=world(b[`upperarm_${side}`]).addScaledVector(across,side==='l'?.37:-.37).addScaledVector(forward,-.23);
  elbow.y-=.37;
  solveArm(b['upperarm_'+side],b['lowerarm_'+side],b['hand_'+side],wrist,elbow,wristQ,weight);
  for(const f of anim.fingerPoses||[])if(f.bone.name.endsWith('_'+side)){
    f.bone.quaternion.slerp(Q().slerpQuaternions(f.flat,f.fist,f.thumb?curl*.73:curl),weight);
  }
}

// The same hat worn outside stays in his hand as he takes it off and lays it across his chest.
function holdHat(action,hat){
  if(!hat)return null;
  const {mount,position,rotation}=hat;
  mount.position.copy(position);mount.quaternion.copy(rotation);mount.updateWorldMatrix(true,false);
  const w=ease(action.progress,.49,.81),centre=mount.getWorldPosition(V());
  if(w>0){
    const axis=V(Math.sin(action.bedYaw),0,Math.cos(action.bedYaw));
    const resting=action.mid.clone().addScaledVector(axis,-.34);
    resting.y=action.top+.34+.007*Math.sin(action.age*1.8);
    centre.lerp(resting,w).y+=.125*Math.sin(Math.PI*w);
    const level=Q().setFromEuler(new THREE.Euler(.12,action.bedYaw-.19,.055,'YXZ'));
    const worldQ=mount.getWorldQuaternion(Q()).slerp(level,w);
    mount.position.copy(mount.parent.worldToLocal(centre.clone()));
    mount.quaternion.copy(mount.parent.getWorldQuaternion(Q()).invert().multiply(worldQ));
    mount.updateMatrixWorld(true);
  }
  return centre;
}

export function cabinPose(action,man,anim,figure){
  const p=action.progress;
  if(!p)return;
  const b=man.bones,body=man.object,bed=action.kind==='bed',ledger=action.kind==='ledger';
  const turn=ease(p,0,.37),sit=ease(p,bed?.15:.14,bed?.49:.77),roll=bed?ease(p,.45,.97):0;
  const yaw=bed?yawMix(action.yaw,action.bedYaw,roll):action.yaw;
  body.rotation.y=yawMix(body.rotation.y,yaw,turn);body.updateMatrixWorld(true);
  const side=V(Math.cos(yaw),0,-Math.sin(yaw)),front=V(Math.sin(yaw),0,Math.cos(yaw));
  const hip=world(b.pelvis),target=action.hips.clone();
  if(bed)target.lerp(action.mid,roll);
  else if(!ledger)target.addScaledVector(front,.085*ease(p,.21,.78));
  if(ledger||bed)target.addScaledVector(front,.065*Math.sin(Math.PI*sit));
  hip.lerp(target,ledger||bed?sit:ease(p,.06,.76));
  b.pelvis.position.copy(b.pelvis.parent.worldToLocal(hip));b.pelvis.updateMatrixWorld(true);

  const sole=bed?{l:b.foot_l.getWorldQuaternion(Q()),r:b.foot_r.getWorldQuaternion(Q())}:null;
  if(bed)anim.rotateWorld(b.pelvis,side,-1.50*roll);
  const reach=ease(p,.17,.87);
  const slope=bed?.24*Math.sin(Math.PI*sit)+.095*roll:ledger?.23*reach:(.61+.042*action.stroke)*reach;
  for(const [name,k] of [['spine_01',.46],['spine_02',.34],['spine_03',.20]])anim.rotateWorld(b[name],side,slope*k);
  anim.rotateWorld(b.neck_01,side,bed?.15*(sit-roll):ledger?.23*reach:.13*reach);
  anim.rotateWorld(b.Head,side,bed?.09*(sit-roll):ledger?.20*reach:.10*reach);
  if(ledger)anim.rotateWorld(b.Head,UP,.045*Math.sin(action.age*1.05)*reach);

  for(const which of ['l','r']){
    const sign=which==='l'?1:-1;
    let ankle,footWeight,knee=front.clone().addScaledVector(side,sign*.085);
    if(bed){
      const seatFront=V(Math.sin(action.yaw),0,Math.cos(action.yaw)),seatSide=V(seatFront.z,0,-seatFront.x);
      ankle=action.hips.clone().addScaledVector(seatFront,.43).addScaledVector(seatSide,sign*.16);
      ankle.y=action.stand.y+.105;
      const leg=ease(p,which==='l'?.40:.50,which==='l'?.81:.94);
      const axis=V(Math.sin(action.bedYaw),0,Math.cos(action.bedYaw)),across=V(axis.z,0,-axis.x);
      const endpoint=action.mid.clone().addScaledVector(axis,which==='l'?.846:.821).addScaledVector(across,sign*.105);
      endpoint.y=action.top+.10;
      knee.lerp(UP.clone().addScaledVector(across,sign*.09),leg);
      ankle.lerp(endpoint,leg).y+=(which==='l'?.27:.23)*Math.sin(Math.PI*leg);
      footWeight=sit;
    }else{
      ankle=action.stand.clone().addScaledVector(side,sign*(ledger?.145:.17)).addScaledVector(front,ledger?.48:(which==='l'?.06:-.11));
      ankle.y+=.103;footWeight=ease(p,.03,.57);
    }
    const foot=b['foot_'+which];
    anim.legIK(which,ankle.sub(world(foot)).multiplyScalar(footWeight),footWeight>.04?knee:null);
    if(bed&&roll>0){
      const toe=Q().setFromAxisAngle(side,-1.02).multiply(sole[which]);
      const q=foot.getWorldQuaternion(Q()).slerp(toe,roll);
      foot.quaternion.copy(foot.parent.getWorldQuaternion(Q()).invert().multiply(q));foot.updateMatrixWorld(true);
    }
  }

  const shifting=ease(p,.018,.42);
  const pack=figure?.pack;pack?.restAtBench(action,shifting);
  const strap=pack?.group.localToWorld(V(.18,.47,.11));
  const grip=strap?ease(p,.015,.14)*(1-ease(p,.25,.52)):0;
  if(bed){
    const hat=holdHat(action,figure?.hatMount);
    const axis=V(Math.sin(action.bedYaw),0,Math.cos(action.bedYaw)),across=V(axis.z,0,-axis.x);
    for(const [which,sign] of [['r',-1],['l',1]]){
      const brace=action.hips.clone().addScaledVector(side,sign*.25).addScaledVector(front,-.07);
      brace.y=action.top+.036;
      const resting=action.mid.clone().addScaledVector(axis,which==='r'?-.17:-.23).addScaledVector(across,sign*.11);
      const tuck=ease(p,.70,1);resting.y=action.top+.33+.014*Math.sin(action.age*1.8);
      const hand=brace.lerp(resting,tuck);hand.y+=.14*Math.sin(Math.PI*tuck);
      let weight=ease(p,.19,.56);
      if(which==='r'&&hat){
        const brim=hat.addScaledVector(side,-.105).addScaledVector(front,.025);
        brim.y+=.015;hand.lerp(brim,ease(p,.28,.49));
      }else if(which==='l'&&grip){hand.lerp(strap,grip);weight=Math.max(weight,grip);}
      palmOn(man,anim,which,hand,yaw,which==='r'?.35:.22,weight,-.12*roll);
    }
  }else{
    const right=action.right.clone(),left=action.left.clone();
    if(ledger){
      const angle=2.79*action.page,returning=ease(action.age%5.6,2.16,2.92);
      // Follow the same corner as the paper until it lies flat across the binding.
      right.x-=.095*(1-Math.cos(angle))*(1-returning);
      right.y+=.095*Math.sin(angle)*(1-returning)+.043*Math.sin(Math.PI*returning);
      right.z-=.022*action.page*(1-returning);
      const pull=ease(p,.04,.31)*(1.-ease(p,.37,.70));
      right.lerp(action.hips.clone().add(V(.12,-.065,.15)),pull);
    }else right.x-=.135*action.stroke;
    if(grip)left.lerp(strap,grip);
    palmOn(man,anim,'l',left,yaw,ledger?.09:.17,Math.max(reach,grip));
    palmOn(man,anim,'r',right,yaw,ledger?.17:.62,ledger?ease(p,.09,.70):reach);
  }
  body.updateMatrixWorld(true);
}
