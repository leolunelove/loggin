import * as THREE from 'three';
import {bedBeats,bedPoint,quiltGrip} from '../bed-motion.js';
import {palmOn} from './hand-contact.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const Q=()=>new THREE.Quaternion();
const UP=V(0,1,0),PALM=V(0,.075,.015);
const ease=THREE.MathUtils.smootherstep,mix=THREE.MathUtils.lerp;
const point=b=>b.getWorldPosition(V());
const arc=x=>Math.sin(Math.PI*x);
const yawDiff=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

// Lift the actual fitted hat by its brim. On the way down it travels with the
// ribs, so the hand can keep hold as the torso moves from upright to horizontal.
function hatInHand(a,m,figure,bones,breath){
  if(!figure?.hatMount)return null;
  const {mount,position,rotation}=figure.hatMount;
  mount.position.copy(position);mount.quaternion.copy(rotation);mount.updateWorldMatrix(true,false);
  const start=point(mount),worn=mount.getWorldQuaternion(Q());
  const ribs=point(bones.spine_03),hips=point(bones.pelvis);
  const across=point(bones.upperarm_l).sub(point(bones.upperarm_r)).normalize();
  const normal=across.clone().cross(point(bones.neck_01).sub(hips)).normalize();
  const rest=hips.clone().lerp(ribs,.72).addScaledVector(normal,.165+.004*breath);
  const lift=arc(m.hat);
  const centre=start.lerp(rest,m.hat).addScaledVector(normal,.13*lift);
  centre.y+=.09*lift;
  const angle=a.yaw+yawDiff(a.yaw,a.bedYaw)*m.pivot;
  const resting=Q().setFromEuler(new THREE.Euler(.11,angle-.16,.04,'YXZ'));
  const orient=worn.slerp(resting,m.hat);
  mount.position.copy(mount.parent.worldToLocal(centre.clone()));
  mount.quaternion.copy(mount.parent.getWorldQuaternion(Q()).invert().multiply(orient));mount.updateMatrixWorld(true);
  const sign=a.braceSide==='r'?1:-1,style=figure.headwear?.findIndex(h=>h.visible)??0;
  return centre.add(V(sign*([.169,.073,.082][style]??.13),.011,.058).applyQuaternion(orient));
}

export function bedPose(a,man,anim,figure){
  const p=a.progress,m=bedBeats(a),b=man.bones,body=man.object;
  if(!a.firstFoot)a.firstFoot={l:point(b.foot_l),r:point(b.foot_r)};
  const delta=yawDiff(a.yaw,a.bedYaw),yaw=a.yaw+delta*m.pivot;
  body.rotation.y+=yawDiff(body.rotation.y,yaw)*m.turn;body.updateMatrixWorld(true);
  const seatSide=V(Math.cos(a.yaw),0,-Math.sin(a.yaw));
  const cross=V(a.axis.z,0,-a.axis.x),face=V(Math.sin(yaw),0,Math.cos(yaw));
  const sole={l:b.foot_l.getWorldQuaternion(Q()),r:b.foot_r.getWorldQuaternion(Q())};
  const sideSign=Math.sign(cross.dot(a.outward)),breath=Math.sin(a.age*1.68);
  const transfer=arc(m.slide),load=arc(m.seat),onPalm=m.seat*(1-m.recline),seatLength=a.hips.clone().sub(a.mid).dot(a.axis);
  const seatEdge=a.hips.clone().sub(a.mid).dot(a.outward);
  const hip=point(b.pelvis),target=a.hips.clone().lerp(a.mid,m.slide);
  target.addScaledVector(a.outward,.045*load-.018*transfer).addScaledVector(a.axis,-.038*transfer);
  target.y+=.015*transfer-.021*onPalm-.018*arc(ease(m.seat,.69,1))-.015*arc(ease(m.slide,.55,1));
  hip.lerp(target,m.seat);
  b.pelvis.position.copy(b.pelvis.parent.worldToLocal(hip));b.pelvis.updateMatrixWorld(true);

  // Lower sideways onto the supporting arm. The hips turn first, the shoulder
  // follows, then the head uncurls onto the pillow. Keep a little roll toward the aisle.
  const forearm=arc(ease(m.recline,.02,1)),onHip=arc(m.pivot);
  anim.rotateWorld(b.pelvis,seatSide,.25*load+.075*m.seat*(1-m.recline));
  anim.rotateWorld(b.pelvis,cross,-1.55*m.recline-.21*onHip-.34*onPalm);
  anim.rotateWorld(b.pelvis,a.axis,-sideSign*(.20*forearm+.06*m.recline));
  for(const [name,k] of [['spine_01',.46],['spine_02',.34],['spine_03',.20]]){
    anim.rotateWorld(b[name],cross,k*(.21*(m.recline-m.head)-.14*onHip-.12*onPalm+.006*breath*m.pillow));
    anim.rotateWorld(b[name],seatSide,k*(.20*load+.07*m.seat*(1-m.recline)));
  }
  anim.rotateWorld(b.spine_03,UP,-delta*.12*onHip);
  anim.rotateWorld(b.neck_01,cross,.35*(m.recline-m.head)-.045*m.head+.22*onPalm);
  anim.rotateWorld(b.Head,cross,.23*(m.recline-m.head)-.024*m.head);
  anim.rotateWorld(b.Head,a.axis,-sideSign*(.12*forearm+.085*m.head));
  anim.rotateWorld(b.neck_01,seatSide,.16*load);

  for(const side of ['l','r']){
    const sign=side==='l'?1:-1,leading=side!==a.braceSide;
    const t=leading?m.lead:m.trail;
    const length=seatLength+(leading?.145:-.145);
    const floor=bedPoint(a,length,seatEdge+.39,0);
    floor.y=a.stand.y+.103;
    if(!m.waking){
      const shift=leading?ease(p,.012,.125):ease(p,.072,.205),lift=Math.min(.052,a.firstFoot[side].distanceTo(floor)*.25);
      const from=a.firstFoot[side].clone();from.y=floor.y;
      floor.lerp(from,1-shift).y+=lift*arc(shift);
    }
    // Keep the last boot grounded while the first clears the rail. Lift before
    // crossing the edge, then slide each heel out along the bed.
    const bed=bedPoint(a,leading?.827:.795,sideSign*sign*.092,.100);
    const ankle=floor.clone().lerp(bed,ease(t,.12,.98));
    ankle.addScaledVector(a.axis,.086*arc(t));
    ankle.y=mix(floor.y,bed.y,ease(t,0,.54))+(leading?.185:.15)*arc(t);
    const knee=face.clone().addScaledVector(seatSide,sign*.075).lerp(UP.clone().addScaledVector(a.outward,.13),ease(t,.15,.78));
    const foot=b['foot_'+side];
    anim.legIK(side,ankle.sub(point(foot)).multiplyScalar(m.plant),m.plant>.04?knee:null);
    if(t>0){
      const toe=Q().setFromAxisAngle(cross,-1.10+.09*sign).multiply(sole[side]);
      const rotation=foot.getWorldQuaternion(Q()).slerp(toe,ease(t,.14,.96));
      foot.quaternion.copy(foot.parent.getWorldQuaternion(Q()).invert().multiply(rotation));foot.updateMatrixWorld(true);
    }
  }

  const pack=figure?.pack;pack?.restAtBench(a,m.pack);
  const hat=hatInHand(a,m,figure,b,breath),holding=a.braceSide==='l'?'r':'l';
  const brimWeight=ease(m.seat,.29,.91);
  const freeHand=hat||bedPoint(a,-.26,a.width*.11,.32);
  const strap=pack?ease(m.pack,.025,.32)*(1-ease(m.pack,.57,1)):0;
  if(strap)freeHand.lerp(pack.group.localToWorld(V(holding==='l'?.16:-.16,.43,.09)),strap);
  palmOn(man,anim,holding,freeHand,yaw,.38,Math.max(brimWeight,strap),-.12*m.recline);

  const hand=bedPoint(a,-.205,a.width*.5-.050,.023);
  const elbow=bedPoint(a,-.47,a.width*.5-.025,.070+.27*(1-m.recline));
  const hem=quiltGrip(a,m);
  hand.lerp(hem,m.grasp);hand.y+=.055*arc(m.grasp);
  const letGo=m.release,rest=bedPoint(a,-.27,.132,.314+.011*breath);
  hand.lerp(rest,letGo);hand.y+=.025*arc(letGo);
  const reach=ease(m.seat,.075,.82);
  palmOn(man,anim,a.braceSide,hand,yaw,m.grasp>.8?.34:.09,reach,-.14*m.recline,
    elbow,ease(m.recline,.02,.34)*(1-m.grasp));
  a.graspWeight=m.grasp*(1-letGo);
  a.graspPoint??=V();a.graspPoint.copy(b['hand_'+a.braceSide].localToWorld(PALM.clone()));
  body.updateMatrixWorld(true);
}
