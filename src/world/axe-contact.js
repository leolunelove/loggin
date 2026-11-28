import * as THREE from 'three';
import {notchAt} from './bark-cut.js';
import { CHOP_REACH } from '../mechanics.js';
import {riverCenter,riverDistance} from './river.js';
import {AXE_GROUPS} from './woodland-physics.js';

const up=new THREE.Vector3(0,1,0),reach=CHOP_REACH;
// Find the near working surface of the bole, including its taper and lean.
export function looseAim(trees,feet,yaw,pitch=0){
  const dx=Math.sin(yaw),dz=Math.cos(yaw);
  const aim=new THREE.Vector3(feet.x+dx*.91,feet.y+.37,feet.z+dz*.91);
  let best=null,score=Infinity;
  function consider(p,kind,tree,part,limb=null,normal=null){
    const x=p.x-feet.x,z=p.z-feet.z,d=Math.hypot(x,z),facing=(x*dx+z*dz)/Math.max(.001,d);
    if(d>reach+.06||facing<.56||Math.abs(p.y-feet.y-.55)>1.0||pitch<-.38)return;
    const rank=d+.85*(1-facing);
    if(rank<score){best={kind,tree,part,limb,normal,point:p,x:p.x,y:p.y,z:p.z,r:.12,type:tree.type};score=rank;}
  }
  for(const tree of trees){
    if(tree.stump&&Math.hypot(tree.x-feet.x,tree.z-feet.z)<=reach+tree.r){
      const r=tree.r*.8,offset=new THREE.Vector2(feet.x-tree.x,feet.z-tree.z).clampLength(0,r);
      consider(new THREE.Vector3(tree.x+offset.x,tree.y+.39,tree.z+offset.y),'stump',tree,null);
    }
    for(const part of tree.sections||[]){
      if(part.body.isKinematic?.())continue;
      const centre=part.body.translation(),bounds=part.skin?.toolBounds;
      const span=bounds?Math.max(bounds.min.length(),bounds.max.length()):part.length*.5+.5;
      if(Math.hypot(centre.x-feet.x,centre.z-feet.z)>reach+span)continue;
      if(part.owner){
        const {wood}=part.owner,q=part.body.rotation();
        const local=part.owner.local(part,aim);
        const station=THREE.MathUtils.clamp(local.y,part.lo+.12,part.hi-.12);
        const p=wood.centre(station).sub(part.rest).applyQuaternion(q).add(centre);
        const axis=up.clone().applyQuaternion(q),top=up.clone().projectOnPlane(axis).normalize();
        p.addScaledVector(top,wood.radius(station)*.94);
        consider(p,'section',tree,part,null,top);
        const b=part.owner.branchNear?.(part,local);
        if(b&&b.distance<.88){
          const surface=part.owner.worldPoint(part,b.point),tangent=b.tangent.applyQuaternion(q);
          const normal=feet.clone().addScaledVector(up,1.18).sub(surface).normalize().addScaledVector(up,.85).projectOnPlane(tangent).normalize();
          surface.addScaledVector(normal,b.radius);
          consider(surface,'branch',tree,part,b.limb,normal);
        }
        continue;
      }
      const axis=up.clone().applyQuaternion(part.body.rotation()),c=new THREE.Vector3().copy(centre);
      const along=THREE.MathUtils.clamp(aim.clone().sub(c).dot(axis),-part.length*.46,part.length*.46);
      const p=c.addScaledVector(axis,along);p.y+=part.radius*.91;
      consider(p,'section',tree,part);
    }
  }
  if(best?.part){
    const body=best.part.body;
    best.local=best.point.clone().sub(body.translation()).applyQuaternion(new THREE.Quaternion().copy(body.rotation()).invert());
  }
  return best;
}
// The sight uses the centre of the frame actually shown to the player. Near trees expose
// their cut bark to this query, exactly as they do to the solid axe. A rail wins if it is nearer.
export function shoulderSight(game){
  const {camera,physics,RAPIER:R,player,heldAxe,follow}=game,feet=player.feet;
  const direction=camera.getWorldDirection(new THREE.Vector3());
  const ray=new R.Ray(camera.position,direction),hit=physics.castRayAndGetNormal(ray,22,true,R.QueryFilterFlags.EXCLUDE_SENSORS,AXE_GROUPS,player.collider,heldAxe?.body);
  const point=hit?new THREE.Vector3().copy(ray.pointAt(hit.timeOfImpact)):null;
  const dx=Math.sin(follow.yaw),dz=Math.cos(follow.yaw);
  const depth=(feet.x-camera.position.x)*dx+(feet.z-camera.position.z)*dz+1.12;
  const along=direction.x*dx+direction.z*dz;
  const freePoint=camera.position.clone().addScaledVector(direction,Math.max(0,depth/Math.max(.20,along)));
  const offset=new THREE.Vector2(freePoint.x-feet.x,freePoint.z-feet.z).clampLength(0,1.18);
  freePoint.set(feet.x+offset.x,THREE.MathUtils.clamp(freePoint.y,feet.y-.025,feet.y+1.74),feet.z+offset.y);
  if(!hit)return {point:freePoint,freePoint,reachable:false};
  const distance=Math.hypot(point.x-feet.x,point.z-feet.z),height=point.y-feet.y;
  const reachable=distance<=reach+.015&&height>=-.16&&height<=1.76,collider=hit.collider;
  const tree=collider.standingTree||game.field?.windthrows().find(t=>t.body?.handle===collider.handle);
  const normal=new THREE.Vector3().copy(hit.normal);if(normal.dot(direction)>0)normal.negate();
  const sight={point,normal,freePoint,distance,reachable,collider,tree:tree&&!tree.down?tree:null};
  const inCut=!tree?.windthrow&&notchAt(tree,point);
  if(reachable&&sight.tree&&!tree.windthrow){
    // The camera can see around a bole farther than the player's hands can.
    const face=inCut||{nx:normal.x,nz:normal.z};
    const length=Math.hypot(face.nx,face.nz);
    if(length>.4&&distance>.12){
      const alignment=(face.nx*(feet.x-point.x)+face.nz*(feet.z-point.z))/(length*distance);
      sight.angled=alignment<.55;
      if(sight.angled)sight.reachable=false;
    }
  }
  if(inCut){
    // The lips of a V-notch face up and down. Enter through its mouth from
    // the player's side while keeping the exact place the sight picked.
    const towardFeet=new THREE.Vector3(feet.x-point.x,0,feet.z-point.z).normalize();
    sight.entry=towardFeet;
    sight.mouthNormal=new THREE.Vector3(inCut.nx,0,inCut.nz).normalize();
  }
  if(!reachable||tree)return sight;
  for(const trunk of game.looseTimber||[]){
    const stump=trunk.stumpCollider?.handle===collider.handle;
    const part=!stump&&collider.fallenPart?.tree===trunk?collider.fallenPart:null;
    if(!part&&!stump)continue;
    sight.timber={kind:stump?'stump':'section',tree:trunk,part,point,x:point.x,y:point.y,z:point.z,r:.12,type:trunk.type};
    if(part){
      const b=part.owner?.branchNear(part,part.owner.local(part,point));
      if(b&&b.distance<.09){sight.timber.kind='branch';sight.timber.limb=b.limb;}
      const body=part.body;sight.body=body;sight.local=point.clone().sub(body.translation()).applyQuaternion(new THREE.Quaternion().copy(body.rotation()).invert());}
    break;
  }
  return sight;
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
