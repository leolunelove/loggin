import * as THREE from 'three';
const V=()=>new THREE.Vector3();
export function seatedPose(man,animator,arms,seat,weight){
 if(weight<=0)return;
 const body=man.object,b=man.bones;
 body.position.lerp(seat.position,weight);
 const turn=Math.atan2(Math.sin(seat.yaw-body.rotation.y),Math.cos(seat.yaw-body.rotation.y));body.rotation.y+=turn*weight;body.updateMatrixWorld(true);
 const hip=b.pelvis.getWorldPosition(V()),target=new THREE.Vector3(seat.position.x,seat.position.y+.59,seat.position.z);
 hip.lerp(target,weight);b.pelvis.position.copy(b.pelvis.parent.worldToLocal(hip));b.pelvis.updateMatrixWorld(true);
 for(const side of ['l','r']){
  const sign=side==='l'?1:-1;
  const foot=body.localToWorld(new THREE.Vector3(sign*.17,.11,.52));
  animator.legIK(side,foot.sub(b[`foot_${side}`].getWorldPosition(V())).multiplyScalar(weight));
  const wrist=new THREE.Vector3(sign*.24,.69,.37);
  if(side==='r'){
    const guiding=Math.sin(Math.PI*weight)**2;
    wrist.lerp(new THREE.Vector3(-.50,.98,-.02),guiding*.9);
  }
  arms.arm(side,body.localToWorld(wrist),weight);
 }
 body.updateMatrixWorld(true);
}
