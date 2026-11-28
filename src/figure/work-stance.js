import * as THREE from 'three';
import {PLAYER_GROUPS} from '../world/woodland-physics.js';

const V=()=>new THREE.Vector3(),identity=new THREE.Quaternion();
const clamp=THREE.MathUtils.clamp;
const probes=new WeakMap();
function shapes(R){
  if(!probes.has(R))probes.set(R,{tool:new R.Ball(.095),body:new R.Capsule(.48,.265)});
  return probes.get(R);
}
// Plan one short adjustment at the start of a stroke. Both the proposed route
// and the backswing volume are swept against the same solids the player meets.
export function workStance(game,stroke){
  const {player,physics,RAPIER:R}=game;
  if(!player.grounded||!physics||!player.collider)return null;
  const point=stroke.contact,feet=player.feet,yaw=stroke.free?stroke.yaw:Math.atan2(point.x-feet.x,point.z-feet.z);
  const forward=V().set(Math.sin(yaw),0,Math.cos(yaw)),right=V().set(-forward.z,0,forward.x),up=V().set(0,1,0);
  const solid=(from,path,shape)=>{
    const len=path.length();if(len<.001)return 1;
    const hit=physics.castShape(from,identity,path,shape,.006,1,false,R.QueryFilterFlags.EXCLUDE_SENSORS,PLAYER_GROUPS,player.collider);
    return hit?clamp(hit.time_of_impact-.012/len,0,1):1;
  };
  const stock=shapes(R),work=!stroke.free||stroke.sight?.reachable||['section','branch','stump'].includes(stroke.t.kind);
  const target=V().set(point.x,feet.y,point.z);
  const room=spot=>{
    const shoulder=spot.clone().addScaledVector(up,1.38).addScaledVector(right,.15);
    const load=right.clone().multiplyScalar(.32).addScaledVector(forward,-.36).addScaledVector(up,.43);
    return Math.min(solid(shoulder,load,stock.tool),solid(shoulder,up.clone().multiplyScalar(.68).addScaledVector(right,.12),stock.tool));
  };
  const space=room(feet),gap=feet.distanceTo(target),short=work?clamp((.80-gap)/.46,0,1):0;
  if(short<.02&&space>.9)return null;
  const compact=clamp(Math.max(short,1-space),0,1);
  const length=clamp(Math.max(.84-gap,(1-space)*.34),.12,.44);
  const cost=(spot,clear)=>Math.max(0,.84-spot.distanceTo(target))*(work?1.55:0)+(1-clear)*.74;
  let best=cost(feet,space)-.035,goal=null;
  for(const [back,side] of [[1,0],[.77,-.64],[.77,.64],[.22,-.98],[.22,.98]]){
    const d=forward.clone().multiplyScalar(-back*length).addScaledVector(right,side*length);
    const swept=solid(feet.clone().addScaledVector(up,.89),d,stock.body);
    if(swept<.32)continue;
    const spot=feet.clone().addScaledVector(d,swept);
    if(spot.distanceTo(feet)<.08||work&&spot.distanceTo(target)>1.13)continue;
    if(player.ground){
      const floor=player.ground(spot.x,spot.z,feet.y+.40,.72);
      if(!floor||Math.abs(floor.y-feet.y)>.22||floor.normal.y<.72)continue;
    }
    const rank=cost(spot,room(spot))+spot.distanceTo(feet)*.12;
    if(rank<best){best=rank;goal=spot;}
  }
  return {compact,goal,elapsed:0,duration:goal?goal.distanceTo(feet)/1.18+.06:0};
}
export function stepIntoStance(plan,player,input,dt){
  if(!plan?.goal)return false;
  if(!player.grounded||Math.hypot(input.move.x,input.move.y)>.10){
    plan.goal=null;return false;
  }
  const dx=plan.goal.x-player.feet.x,dz=plan.goal.z-player.feet.z,remaining=Math.hypot(dx,dz);
  plan.elapsed+=dt;
  if(remaining<.028||plan.elapsed>plan.duration+.075){plan.goal=null;return false;}
  const speed=Math.min(1.42,remaining*8,3.8*plan.elapsed+.46);
  input.workStep={x:dx/remaining*speed,z:dz/remaining*speed};input.strafe=true;
  return true;
}
