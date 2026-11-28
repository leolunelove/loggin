import * as THREE from 'three';
import {solveArm} from './chop.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const Q=()=>new THREE.Quaternion();
const PALM=V(0,.075,.015);
const world=bone=>bone.getWorldPosition(V());

export function palmOn(man,anim,side,palm,yaw,curl,weight,tilt=0,pole=null,poleWeight=1){
  const b=man.bones,forward=V(Math.sin(yaw),0,Math.cos(yaw));
  forward.applyAxisAngle(V(Math.cos(yaw),0,-Math.sin(yaw)),tilt);
  const across=V(Math.cos(yaw),0,-Math.sin(yaw));
  // Both palms face the surface. Local finger and thumb axes mirror on the rig.
  const thumb=across.clone().multiplyScalar(side==='l'?-1:1);
  const wristQ=Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward.clone().cross(thumb),forward,thumb));
  const elbow=world(b[`upperarm_${side}`]).addScaledVector(across,side==='l'?.37:-.37).addScaledVector(forward,-.23);
  elbow.y-=.37;if(pole)elbow.lerp(pole,poleWeight);
  placePalm(man,anim,side,palm,wristQ,elbow,curl,weight);
}

export function placePalm(man,anim,side,palm,wristQ,elbow,curl,weight){
  const b=man.bones,wrist=palm.clone().sub(PALM.clone().applyQuaternion(wristQ));
  solveArm(b['upperarm_'+side],b['lowerarm_'+side],b['hand_'+side],wrist,elbow,wristQ,weight);
  for(const f of anim.fingerPoses||[])if(f.bone.name.endsWith('_'+side)){
    f.bone.quaternion.slerp(Q().slerpQuaternions(f.flat,f.fist,f.thumb?curl*.73:curl),weight);
  }
}
