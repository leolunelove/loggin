import * as THREE from 'three';
import { CHOP_REACH } from '../mechanics.js';
import {riverCenter,riverDistance} from './river.js';

const up=new THREE.Vector3(0,1,0),reach=CHOP_REACH;
// The assist finds the surface of the cylinder, even when the player is by its end.
export function looseAim(trees,feet,yaw,pitch=0){
  const dx=Math.sin(yaw),dz=Math.cos(yaw);
  const aim=new THREE.Vector3(feet.x+dx*.91,feet.y+.37,feet.z+dz*.91);
  let best=null,score=Infinity;
  function consider(p,kind,tree,part){
    const x=p.x-feet.x,z=p.z-feet.z,d=Math.hypot(x,z),facing=(x*dx+z*dz)/Math.max(.001,d);
    if(d>reach+.06||facing<.56||Math.abs(p.y-feet.y-.55)>1.0||pitch<-.38)return;
    const rank=d+.85*(1-facing);
    if(rank<score){best={kind,tree,part,point:p,x:p.x,y:p.y,z:p.z,r:.12,type:tree.type};score=rank;}
  }
  for(const tree of trees){
    if(tree.stump&&Math.hypot(tree.x-feet.x,tree.z-feet.z)<=reach+tree.r){
      const r=tree.r*.8,offset=new THREE.Vector2(feet.x-tree.x,feet.z-tree.z).clampLength(0,r);
      consider(new THREE.Vector3(tree.x+offset.x,tree.y+.39,tree.z+offset.y),'stump',tree,null);
    }
    for(const part of tree.sections||[]){
      const centre=part.body.translation();if(Math.hypot(centre.x-feet.x,centre.z-feet.z)>reach+part.length*.5+.5)continue;
      const axis=up.clone().applyQuaternion(part.body.rotation()),c=new THREE.Vector3().copy(centre);
      const along=THREE.MathUtils.clamp(aim.clone().sub(c).dot(axis),-part.length*.46,part.length*.46);
      const p=c.addScaledVector(axis,along);p.y+=part.radius*.91;
      consider(p,'section',tree,part);
    }
  }
  return best;
}
export function facesWork(tree,feet,yaw,pitch=0){
  const x=tree.x-feet.x,z=tree.z-feet.z,length=Math.hypot(x,z);
  if(length>.05&&(x*Math.sin(yaw)+z*Math.cos(yaw))/length<.55)return false;
  return tree.windthrow||pitch<.72;
}
export function openAim(feet,yaw,pitch=0){
  const down=THREE.MathUtils.clamp((pitch-.08)/.75,0,1);
  const distance=1.12-.34*down,x=feet.x+Math.sin(yaw)*distance,z=feet.z+Math.cos(yaw)*distance;
  const y=feet.y+THREE.MathUtils.clamp(1.16-pitch*1.53,-.14,1.57);
  return {kind:'air',x,y,z,r:.16,type:0,point:new THREE.Vector3(x,y,z)};
}
export function waterContact(a,b,heightAt){
  if(!heightAt||riverDistance(b.x,b.z)>4.25)return null;
  const y=heightAt(riverCenter(b.z),b.z)+.74;
  if(a.y<y-.08||b.y>y+.04||b.y>=a.y)return null;
  const t=THREE.MathUtils.clamp((a.y-y)/(a.y-b.y),0,1),p=new THREE.Vector3().lerpVectors(a,b,t);
  return riverDistance(p.x,p.z)<4.3?p:null;
}
export function nudgeSection(part,point,yaw,heavy,tier,velocity){
  const mass=part.body.mass(),strength=(heavy?1.1:.72)*(1+tier*.09);
  const impulse=THREE.MathUtils.clamp(mass*.56,5,38)*strength;
  const direction=velocity?.lengthSq()>1e-6?velocity.clone().normalize():new THREE.Vector3(Math.sin(yaw),.24,Math.cos(yaw)).normalize();
  part.body.applyImpulseAtPoint(direction.multiplyScalar(impulse),point,true);
  part.atRest=false;
}
