import * as THREE from 'three';
import {bagCapacity,isHardwood,packTimber} from '../economy.js';
import {AWAITING_COLLECTION,timberLeft} from '../timber-harvest.js';
import {REGROW_MS} from '../mechanics.js';
import {AXE_GROUPS} from './woodland-physics.js';

const V=()=>new THREE.Vector3();
export function pickupPoint(target){
  if(target.part)return V().copy(target.part.body.translation());
  return target.field.g.localToWorld(V().set(0,target.field.r,0));
}
// Work from the near face of a thick round. The centre of an old oak can be
// farther from the player's feet than either hand needs to reach.
function nearFace(game,target,point=pickupPoint(target)){
  const {part,field}=target;
  const axis=part?V().set(0,1,0).applyQuaternion(part.body.rotation()):V().set(0,0,1).applyQuaternion(field.g.getWorldQuaternion(new THREE.Quaternion()));
  const toHand=game.player.feet.clone().sub(point);toHand.y+=.85;
  const along=toHand.dot(axis),span=Math.min(.48,(part?.length||1.1)*.24);
  point.addScaledVector(axis,THREE.MathUtils.clamp(along,-span,span));
  const radial=toHand.addScaledVector(axis,-along).normalize();
  return point.addScaledVector(radial,Math.max(0,(part?.radius||field?.r||0)-.10));
}
function visible(game,point,target){
  const from=game.player.feet.clone();from.y+=1.06;
  const direction=point.clone().sub(from),length=direction.length();if(length<.06)return true;
  const ray=new game.RAPIER.Ray(from,direction.normalize());
  const hit=game.physics.castRay(ray,Math.max(0,length-.045),true,game.RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,AXE_GROUPS,game.player.collider,game.heldAxe?.body);
  return !hit||(target.part?hit.collider.fallenPart===target.part:hit.collider.handle===target.field.body?.handle);
}
export function pickupTarget(game,sight=null){
  const feet=game.player.feet,yaw=game.follow.yaw,lookX=Math.sin(yaw),lookZ=Math.cos(yaw);
  let best=null,score=Infinity;
  function consider(candidate){
    if(sight&&(!sight.reachable||(candidate.part?sight.timber?.part!==candidate.part:sight.collider?.fieldSection!==candidate.field)))return;
    const center=pickupPoint(candidate),radius=candidate.part?.radius||candidate.field?.r||0;
    if(Math.hypot(center.x-feet.x,center.z-feet.z)>2.15+radius)return;
    const p=nearFace(game,candidate,center),x=p.x-feet.x,z=p.z-feet.z,d=Math.hypot(x,z);
    const facing=(x*lookX+z*lookZ)/Math.max(d,.001);
    if(d>1.65||p.y<feet.y-.24||p.y>feet.y+1.52||(d>.68&&facing<.18))return;
    const rank=d+.43*(1-facing);
    if(rank>=score||!visible(game,p,candidate))return;
    best=candidate;score=rank;
  }
  for(const tree of game.looseTimber||[]){
    if(!tree.fallen.record.harvest)continue;
    for(const part of tree.sections){
      const amount=tree.fallen.available(part);if(amount!==null)consider({part,amount,hard:isHardwood(tree.type)});
    }
  }
  for(const row of game.field?.jobs||[])for(const field of row)if(field.ready)consider({field,amount:5+field.section,hard:false});
  return best;
}
export function withinPickupReach(game,target){
  if(target.part?target.part.owner.available(target.part)===null:!target.field.ready)return false;
  const point=nearFace(game,target),feet=game.player.feet;
  return Math.hypot(point.x-feet.x,point.z-feet.z)<=1.72&&point.y<=feet.y+1.58&&point.y>=feet.y-.28&&visible(game,point,target);
}
export function commitPickup(game,target){
  const {state}=game,{part,field,amount,hard}=target;
  if(amount>Math.max(0,bagCapacity(state)-state.carried))return null;
  let mesh;
  if(part){
    const owner=part.owner;
    if(owner.available(part)!==amount)return null;
    mesh=owner.take(part);
    if(owner.record.until===AWAITING_COLLECTION&&timberLeft(owner.record.harvest,owner.wood.top)===0){
      const until=Date.now()+REGROW_MS;
      owner.tree.regrow=owner.record.until=state.down[owner.tree.id]=until;
    }
  }else{
    const w=state.woodland,bit=1<<field.section;
    if(!field.ready||!(w.looseSections[field.job]&bit))return null;
    mesh=new THREE.Group();const wood=field.g.clone(true);
    wood.position.set(0,-field.r,0);wood.quaternion.identity();mesh.add(wood);
    mesh.position.copy(pickupPoint(target));field.g.getWorldQuaternion(mesh.quaternion);
    game.scene.add(mesh);w.looseSections[field.job]&=~bit;game.field.sync();
  }
  packTimber(state,amount,hard);
  game.shade.refresh();game.renderHud();game.save();
  return mesh;
}
