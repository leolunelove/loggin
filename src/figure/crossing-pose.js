import * as THREE from 'three';
import {palmOn} from './hand-contact.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const UP=V(0,1,0),ease=THREE.MathUtils.smootherstep,mix=THREE.MathUtils.lerp;
const point=bone=>bone.getWorldPosition(V());
const window=(p,a,b,c,d)=>ease(p,a,b)*(1-ease(p,c,d));

function placeBoot(a,man,anim,side,weight){
  const p=a.phase,vault=a.kind==='vault',foot=man.bones['foot_'+side],current=point(foot);
  const leading=a.lead===side,sign=side==='l'?1:-1;
  const from=a.boots[side],along=from.clone().sub(a.start).dot(a.dir);
  const bank=(a.radius+.19)/a.across,near=a.station-bank,far=a.station+bank;
  let distance;
  if(leading){
    distance=mix(along,far+(vault?.12:.04),ease(p,.055,vault?.72:.66));
  }else{
    const push=mix(along,near-.02,ease(p,.015,.26));
    distance=mix(push,far+(vault?.28:.35),ease(p,vault?.31:.38,vault?.82:.93));
  }
  const fraction=THREE.MathUtils.clamp(distance/a.length,0,1);
  const floor=mix(a.start.y,a.end.y,fraction),offset=(distance-a.station)*a.across;
  const lift=window(offset,-a.radius-.34,-a.radius*.82,a.radius*.78,a.radius+.27);
  const lateral=from.clone().sub(a.start).dot(a.left);
  const sweep=vault?window(p,leading?.10:.25,.49,.60,leading?.80:.88):0;
  const goal=a.start.clone().addScaledVector(a.dir,distance).addScaledVector(a.left,
    mix(lateral,sign*.115,ease(p,0,.30))-(leading?.19:.25)*sweep);
  goal.y=floor+.105+lift*Math.max(.12,a.top-floor+(vault?.14:.10))+.085*sweep;
  // Return each boot to the live gait on its own side of the landing.
  const blend=weight*(1-ease(p,leading?.78:.90,1));
  const knee=a.dir.clone().addScaledVector(a.left,sign*.17-(vault?.47*sweep:0));
  anim.legIK(side,goal.sub(current).multiplyScalar(blend),knee);
  const toe=(leading?1:.85)*lift*blend;
  if(toe>.002)anim.rotateWorld(foot,a.left,-.19*toe);
}

export function crossingPose(a,man,anim){
  const p=a.phase,b=man.bones,vault=a.kind==='vault';
  const weight=window(p,0,.12,.94,1),load=window(p,.09,.37,.62,.93);
  if(!a.boots)a.boots={l:point(b.foot_l),r:point(b.foot_r)};
  if(!weight)return;
  const body=man.object,pelvis=point(b.pelvis),floor=mix(a.start.y,a.end.y,a.distance/a.length);
  const arch=Math.sin(Math.PI*Math.min(1,p));
  if(vault){
    // The hips pass to the axe side. The left shoulder goes low over the
    // planted palm while both knees tuck to the right of the supporting arm.
    pelvis.addScaledVector(a.left,-.17*load).addScaledVector(a.dir,-.055*load);
    pelvis.y=mix(pelvis.y,a.top+.27+.045*window(p,.35,.53,.61,.75),load)-.08*(window(p,.02,.10,.13,.27)+window(p,.70,.82,.84,.96));
    anim.rotateWorld(b.pelvis,a.left,.48*load);
    anim.rotateWorld(b.pelvis,a.dir,-.54*load);
    for(const [bone,part] of [['spine_01',.44],['spine_02',.35],['spine_03',.21]]){
      anim.rotateWorld(b[bone],a.left,.45*part*load);
      anim.rotateWorld(b[bone],a.dir,-.35*part*load);
    }
    anim.rotateWorld(b.neck_01,a.left,-.50*load);anim.rotateWorld(b.Head,a.dir,.32*load);
  }else{
    pelvis.y=mix(pelvis.y,floor+.91+.11*arch,weight);
    pelvis.addScaledVector(a.left,(a.lead==='l'?-1:1)*.048*Math.sin(p*2*Math.PI)*weight);
    anim.rotateWorld(b.spine_01,a.left,.18*load);anim.rotateWorld(b.neck_01,a.left,.12*load);
  }
  b.pelvis.position.copy(b.pelvis.parent.worldToLocal(pelvis));b.pelvis.updateMatrixWorld(true);
  for(const side of ['l','r'])placeBoot(a,man,anim,side,weight);
  body.updateMatrixWorld(true);
}

// Called after the axe has solved its right-hand grip and cleared the bark.
export function vaultPalm(a,man,anim){
  if(a.kind!=='vault')return;
  const p=a.phase,w=window(p,.09,.32,.60,.82);
  if(!w)return;
  const elbow=point(man.bones.upperarm_l).addScaledVector(a.left,.12).addScaledVector(a.dir,-.23);
  elbow.y+=.035;
  palmOn(man,anim,'l',a.palm.clone().addScaledVector(UP,.016),Math.atan2(a.dir.x,a.dir.z),.13,w,0,elbow);
}
