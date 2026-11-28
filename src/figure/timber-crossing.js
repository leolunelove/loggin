import * as THREE from 'three';
import {PLAYER_GROUPS} from '../world/woodland-physics.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const up=V(0,1,0),down=V(0,-1,0),identity=new THREE.Quaternion();
const clamp=THREE.MathUtils.clamp,ease=THREE.MathUtils.smootherstep,mix=THREE.MathUtils.lerp;
export const TIMBER_COMMIT_PHASE=.19;

// A felled bole keeps its bend and taper. Sample the station we are actually
// approaching rather than aiming the player at the middle of a tree.
function timberAt(c,hit){
  if(c.fieldSection){
    const t=c.fieldSection;if(t.ready||!t.g.visible)return null;
    const tangent=V(0,0,1).applyQuaternion(t.g.quaternion);
    const middle=V().copy(c.translation()),at=clamp(hit.clone().sub(middle).dot(tangent),-.55,.55);
    return {centre:middle.addScaledVector(tangent,at),tangent,radius:t.r,skin:c};
  }
  const part=c.fallenPart;
  if(!part||part.trunk!==c||part.inFlight||part.length<.90||!part.body.isDynamic()||part.owner.available(part)!==null)return null;
  const body=part.body;
  if(!body.isSleeping()&&(V().copy(body.linvel()).lengthSq()>.105||V().copy(body.angvel()).lengthSq()>.09))return null;
  const owner=part.owner,wood=owner.wood,at=clamp(owner.local(part,hit).y,part.lo,part.hi);
  const tangent=wood.centre(Math.min(part.hi,at+.25)).sub(wood.centre(Math.max(part.lo,at-.25))).applyQuaternion(body.rotation()).normalize();
  return {centre:owner.worldPoint(part,wood.centre(at)),tangent,radius:wood.radius(at),skin:part.skin};
}

function landing(player,at,from){
  const ray=new player.R.Ray(V(at.x,from,at.z),down);
  const flags=player.R.QueryFilterFlags.ONLY_FIXED|player.R.QueryFilterFlags.EXCLUDE_SENSORS;
  const hit=player.world.castRayAndGetNormal(ray,1.68,true,flags,PLAYER_GROUPS,player.collider);
  if(!hit||hit.collider.fieldSection||hit.normal.y<.70)return null;
  return from-hit.timeOfImpact;
}

// The capsule clears the near shoulder of the wood before its centre crosses.
// His boots and torso have separate, planted paths around that swept volume.
export function crossingPosition(plan,distance){
  const {start,end,dir,station,radius,across,length,top}=plan;
  const offset=(distance-station)*across,near=station*across,far=(length-station)*across;
  const edge=radius+.10;
  const lift=offset<0?ease(near+offset,0,Math.max(.025,near-edge)):
    1-ease(offset,edge,far);
  const floor=mix(start.y,end.y,distance/length);
  return start.clone().addScaledVector(dir,distance).setY(mix(floor,top+.072,lift));
}
function clearArc(player,plan){
  const R=player.R,r=player.t.radius,half=player.halfHeight(),height=half+r+.086;
  const probe=player.crossProbe??=new R.Capsule(half-.048,r-.022);
  let last=plan.start.clone();last.y+=height;
  for(let i=1;i<=8;i++){
    const next=crossingPosition(plan,plan.length*i/8);next.y+=height;
    const delta=next.clone().sub(last);
    if(player.world.castShape(last,identity,delta,probe,.005,1,false,R.QueryFilterFlags.EXCLUDE_SENSORS,PLAYER_GROUPS,player.collider))return false;
    last=next;
  }
  return true;
}
function topOn(c,at,radius,R){
  // The palm touches the painted bark. The capsule clears the solid hull.
  const rayOrigin=at.clone();rayOrigin.y+=radius+.45;
  const ray=new R.Ray(rayOrigin,down),hit=c.castRayAndGetNormal(ray,2*radius+.55,true);if(!hit||hit.normal.y<.20)return null;
  return rayOrigin.addScaledVector(down,hit.timeOfImpact);
}
function makePlan(player,want,c,hit,running){
  const wood=timberAt(c,hit);if(!wood||Math.abs(wood.tangent.y)>.52)return null;
  const {radius,centre,skin}=wood,tangent=wood.tangent.clone().setY(0).normalize();
  const normal=V(-tangent.z,0,tangent.x);
  if(normal.dot(want.dir)<0)normal.negate();
  const alignment=normal.dot(want.dir);if(alignment<.39)return null;
  const feet=player.feet,near=centre.clone().sub(feet).dot(normal);
  if(near<radius+.12||near>radius+(running?1.18:.96))return null;
  const dir=want.dir.clone().lerp(normal,.34*(1-ease(alignment,.43,.98))).normalize();
  const across=dir.dot(normal),station=near/across,at=feet.clone().addScaledVector(dir,station);
  at.y=centre.y+at.clone().sub(centre).dot(tangent)*wood.tangent.y/Math.max(.5,Math.hypot(wood.tangent.x,wood.tangent.z));
  const trunkTop=topOn(c,at,radius,player.R);if(!trunkTop)return null;
  const height=trunkTop.y-feet.y;
  if(height<.19||height>(running?1.08:.86)||radius>(running?.55:.46))return null;
  const length=station+(radius+(running?.83:.69))/across,end=feet.clone().addScaledVector(dir,length);
  const floor=landing(player,end,feet.y+.98);
  if(floor==null||floor-feet.y>.40||floor-feet.y<-.46||trunkTop.y-floor>(running?1.16:.97))return null;
  end.y=floor;
  const left=V(dir.z,0,-dir.x),along=tangent.dot(left)>0?1:-1;
  for(const side of [-1,1]){
    const underBoot=landing(player,end.clone().addScaledVector(left,.14*side),feet.y+.98);
    if(underBoot==null||Math.abs(underBoot-floor)>.26)return null;
  }
  let palm=null;
  if(running){
    for(const offset of [.24,.13,0]){
      const h=at.clone().addScaledVector(tangent,along*offset);
      palm=topOn(skin,h,radius,player.R);if(palm)break;
    }
    if(!palm)return null;
  }
  const orientation=new THREE.Quaternion().copy(c.rotation());
  const localPalm=palm?.clone().sub(c.translation()).applyQuaternion(orientation.clone().invert());
  const plan={kind:running?'vault':'step',collider:c,source:V().copy(c.translation()),start:feet.clone(),end,dir,left,
    station,across,length,radius,top:trunkTop.y,height,palm,localPalm,orientation,distance:0,phase:0,stalled:0,
    speed:Math.max(.68,player.actualSpeed),pace:clamp(want.speed,running?2.75:.78,running?4.8:1.88),
    lead:(player.anim.phase||0)<.5?'l':'r'};
  return clearArc(player,plan)?plan:null;
}
export function findCrossing(player,want,walk){
  // Side-on travel can turn into the plant. Backpedalling stays under direct control.
  if(want.mag<.12||player.facing().dot(want.dir)<-.18)return null;
  const running=!walk&&want.speed>2,reach=running?1.29:1.06;
  const ray=new player.R.Ray(V(),want.dir),left=V(want.dir.z,0,-want.dir.x);
  const seen=new Set();
  for(const side of [0,.15,-.15])for(const height of [.24,.49,.74,.17]){
    const origin=player.feet.clone().addScaledVector(left,side);origin.y+=height;ray.origin=origin;
    const hit=player.world.castRay(ray,reach,true,player.R.QueryFilterFlags.EXCLUDE_SENSORS,PLAYER_GROUPS,player.collider);
    if(!hit||seen.has(hit.collider.handle)||!(hit.collider.fieldSection||hit.collider.fallenPart?.trunk===hit.collider))continue;
    seen.add(hit.collider.handle);
    const plan=makePlan(player,want,hit.collider,origin.addScaledVector(want.dir,hit.timeOfImpact),running);
    if(plan)return plan;
  }
  return null;
}

export function advanceCrossing(player,a,dt,want,active,permitted){
  if(!active){
    player.moveCapsule(dt,V(),player.crossController);player.speed=0;player.vel.set(0,0,0);
    return;
  }
  const cancel=a.phase<TIMBER_COMMIT_PHASE&&(!permitted||want.mag<.10||want.dir.dot(a.dir)<.25);
  if(cancel||!a.collider.isValid())return 'cancel';
  const position=a.collider.translation(),rotation=new THREE.Quaternion().copy(a.collider.rotation());
  if(a.source.distanceTo(position)>.22||a.orientation.angleTo(rotation)>.23)return 'cancel';
  if(a.localPalm)a.palm.copy(a.localPalm).applyQuaternion(rotation).add(position);
  a.speed=THREE.MathUtils.damp(a.speed,a.pace,8,dt);
  const next=Math.min(a.length,a.distance+a.speed*dt),expected=next-a.distance,goal=crossingPosition(a,next);
  const move=goal.sub(player.feet),mv=player.moveCapsule(dt,move,player.crossController);
  const travelled=Math.max(0,mv.x*a.dir.x+mv.z*a.dir.z);
  a.distance=Math.min(next,a.distance+travelled);
  a.stalled=travelled<.23*expected?a.stalled+dt:0;
  a.phase=a.distance<a.station ? .5*a.distance/a.station : .5+.5*(a.distance-a.station)/(a.length-a.station);
  player.yaw=player.turnToward(player.yaw,Math.atan2(a.dir.x,a.dir.z),8,dt);
  player.speed=player.actualSpeed;player.vel.set(mv.x/dt,mv.y/dt,mv.z/dt);
  player.grounded=a.phase<.05||a.phase>.95;player.airTime=0;player.moveAngle=0;
  if(a.stalled>.14)return 'blocked';
  if(a.phase>=.33&&a.kind==='vault'&&!a.touched){a.touched=true;player.events.push({kind:'timberPalm',point:a.palm});}
  if(a.length-a.distance<.012){
    player.events.push({kind:'land',impact:a.kind==='vault'?.30:.12});return 'landed';
  }
}
