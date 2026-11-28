import * as THREE from 'three';
import {bagCapacity} from '../economy.js';
import {clearPickupPath,commitPickup,pickupPoint,pickupTarget} from '../world/gather.js';
import {disposeWoodMesh} from '../world/fallen-tree.js';

const UP=new THREE.Vector3(0,1,0);
function launch(game,target){
  const stock=target.part||target.field,mesh=target.part?stock.mesh:stock.g;
  const start=pickupPoint(target),pivot=new THREE.Group();
  const rest={parent:mesh.parent,position:mesh.position.clone(),rotation:mesh.quaternion.clone(),scale:mesh.scale.clone()};
  pivot.position.copy(start);mesh.getWorldQuaternion(pivot.quaternion);
  game.scene.add(pivot);pivot.attach(mesh);
  stock.inFlight=true;stock.body.setEnabled(false);if(stock.shadow)stock.shadow.visible=false;
  const origin=pivot.quaternion.clone(),pack=game.figure.pack.group;
  const rim=pack.localToWorld(new THREE.Vector3(0,.55,0));
  return {target,stock,mesh,pivot,rest,start,origin,age:0,
    lastFeet:game.player.feet.clone(),duration:.47+.075*Math.min(3,start.distanceTo(rim)),lastRim:rim,
    small:Math.min(.70,.63/(stock.length||1.1),.18/(stock.radius||stock.r||.15))};
}
function ground(drop){
  const {stock,mesh,pivot,rest}=drop;
  rest.parent.add(mesh);mesh.position.copy(rest.position);mesh.quaternion.copy(rest.rotation);mesh.scale.copy(rest.scale);
  mesh.updateMatrixWorld(true);pivot.removeFromParent();stock.inFlight=false;stock.body.setEnabled(true);
  if(stock.shadow)stock.shadow.visible=true;
}
function fly(game,drop,dt){
  const {pivot,target,start,origin}=drop,pack=game.figure.pack.group;
  const rim=pack.localToWorld(new THREE.Vector3(.02,.55,0));
  if(rim.distanceToSquared(drop.lastRim)>9){ground(drop);return true;}
  drop.lastRim.copy(rim);
  if(game.player.feet.distanceToSquared(drop.lastFeet)>.30){
    if(!clearPickupPath(game,pivot.position,target)){ground(drop);return true;}
    drop.lastFeet.copy(game.player.feet);
  }
  const t=Math.min(1,(drop.age+=dt)/drop.duration),pull=THREE.MathUtils.smootherstep(t,.11,1);
  // First the length lifts off the litter, then its long axis turns into the opening.
  pivot.position.lerpVectors(start,rim,pull);
  pivot.position.y+=.86*Math.sin(Math.PI*t)*(1-.30*t);
  const rimRotation=pack.getWorldQuaternion(new THREE.Quaternion());
  if(target.field)rimRotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));
  pivot.quaternion.copy(origin).slerp(rimRotation,THREE.MathUtils.smoothstep(t,.08,.93));
  pivot.rotateOnWorldAxis(UP,.40*Math.sin(Math.PI*t));
  const scale=THREE.MathUtils.lerp(1,drop.small,THREE.MathUtils.smoothstep(t,0,.55));
  pivot.scale.setScalar(scale*(1-.985*THREE.MathUtils.smoothstep(t,.77,1)));
  if(t<1)return false;
  ground(drop);
  const packed=commitPickup(game,target);
  if(packed){
    if(target.part)disposeWoodMesh(packed);
    game.figure.pack.catchWood?.();game.audio.stack(rim,Math.max(1,target.amount));
  }
  return true;
}
export function updateTimberDrops(game,dt,active){
  const drops=game.timberDrops??=[];
  if(!active){
    for(const d of drops)ground(d);
    drops.length=0;return;
  }
  for(let i=drops.length-1;i>=0;i--)if(fly(game,drops[i],dt))drops.splice(i,1);
  game.dropScan=(game.dropScan||0)-dt;if(game.dropScan>0)return;game.dropScan=.10;
  const spare=Math.max(0,bagCapacity(game.state)-game.state.carried-drops.reduce((n,d)=>n+d.target.amount,0));
  const target=pickupTarget(game,spare);
  if(target)drops.push(launch(game,target));
}
