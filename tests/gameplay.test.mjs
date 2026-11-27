import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Follow} from '../src/figure/camera.js';
import {Lumberjack} from '../src/game.js';
import {CHOP_REACH,IMPACT_AT,swingPose,pickTree,chopCount,pickAimTree,movingChopContact} from '../src/mechanics.js';
import {freshState,purchase,rewardFor,swingDuration,upgradeCost,sanitize} from '../src/economy.js';
import {SAVE_KEY,readSave,writeSave} from '../src/save.js';
const tree=(x,z,other={})=>({x,z,r:.2,tier:0,type:1,hp:3,...other});
function rig(){
  const g=Object.create(Lumberjack.prototype);
  Object.assign(g,{time:0,camera:{position:{x:0,z:0}},started:true,paused:false,touch:false,held:false,swing:null,state:freshState(),forest:{trees:[tree(0,-1.5)]},input:{active:true,keys:new Set(),mouse:{left:false}},player:{feet:{x:0,z:0},grounded:true,speed:0,yaw:Math.PI,lastYaw:Math.PI},follow:{yaw:Math.PI,look(look){this.yaw-=look.x;}}});
  g.hits=[];g.hit=t=>g.hits.push(t);
  return g;
}
const frame=(x=0,look=0)=>({move:{x,y:0},look:{x:look,y:0},device:'keyboard'});
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),map};};

test('targeting excludes trees behind the camera, down trees and distant trees',()=>{
  const front=tree(0,-4),behind=tree(0,1),down=tree(0,-1,{down:true});
  assert.equal(pickTree([behind,down,front,tree(0,-30)],{x:0,z:0},Math.PI).tree,front);
  assert.equal(pickTree([behind],{x:0,z:0},Math.PI).tree,null);
});
test('a nearby trunk wins over a distant central one',()=>{
  const near=tree(.45,-1),far=tree(0,-8);
  const picked=pickTree([far,near],{x:0,z:0},Math.PI);
  assert.equal(picked.tree,near);assert.ok(picked.distance<CHOP_REACH);
});
test('one click commits one impact, never an extra held swing',()=>{
  const g=rig();g.input.mouse.left=true;g.before(.02,frame());g.input.mouse.left=false;
  for(let i=0;i<55;i++)g.before(.02,frame());
  assert.equal(g.hits.length,1);assert.equal(g.swing,null);
});
test('a tap between frames survives the turn to face a tree, then produces exactly one contact',()=>{
  const g=rig();g.player.yaw=Math.PI-.5;
  g.before(.02,{...frame(),chopPressed:true});assert.equal(g.swing,null);
  g.player.yaw=Math.PI;
  for(let i=0;i<65;i++)g.before(.02,frame());
  assert.equal(g.hits.length,1);assert.equal(g.swing,null);
});
test('movement during windup keeps the stroke and movement input alive',()=>{
 const g=rig();g.input.mouse.left=true;g.before(.15,frame());assert.ok(g.swing);g.input.mouse.left=false;
 const next=frame(1);g.before(.02,next);assert.ok(g.swing);assert.equal(next.move.x,1);assert.equal(next.sprint,false);
 for(let i=0;i<30;i++)g.before(.02,frame(1));assert.equal(g.hits.length,1);
});
test('moving out of reach produces one miss and completes recovery without hitting from afar',()=>{
 const g=rig();g.input.mouse.left=true;g.before(.15,frame());g.input.mouse.left=false;g.player.feet.x=8;
 g.before(.4,frame(1));assert.ok(g.swing);assert.equal(g.swing.missed,true);assert.equal(g.hits.length,0);
 for(let i=0;i<30;i++)g.before(.02,frame(1));assert.equal(g.swing,null);assert.equal(g.hits.length,0);
});
test('looking away keeps a committed stroke but menus cancel it',()=>{
 const g=rig();g.input.mouse.left=true;g.before(.2,frame());g.input.mouse.left=false;g.follow.yaw=0;
 g.before(.3,frame());assert.equal(g.hits.length,1);
 const paused=rig();paused.input.mouse.left=true;paused.before(.2,frame());paused.paused=true;paused.before(.3,frame());assert.equal(paused.hits.length,0);assert.equal(paused.swing,null);
});
test('Space only requests a jump, while E still starts a tree stroke',()=>{
  const g=rig();g.input.keys.add('Space');const hop={...frame(),jump:true};g.before(.02,hop);
  assert.equal(g.swing,null);assert.equal(hop.jump,true);
  g.input.keys.delete('Space');g.input.keys.add('KeyE');g.before(.02,frame());assert.ok(g.swing);
});
test('axe pause is part of its cadence and returns continuously to rest',()=>{
  assert.equal(IMPACT_AT,.5);assert.equal(swingPose(.5).angle,swingPose(.54).angle);assert.ok(swingPose(.54).sink>swingPose(.5).sink,'the body absorbs impact while the tool holds contact');
  assert.ok(Math.abs(swingPose(1).angle-swingPose(0).angle)<1e-9);
  for(const seam of [.33,.5,.55])assert.ok(Math.abs(swingPose(seam-1e-5).angle-swingPose(seam+1e-5).angle)<.002);
  assert.equal(chopCount(1,2),'1 chop');assert.equal(chopCount(6,2),'3 chops');
});
test('first two trees buy a useful axe without changing existing balances',()=>{
  const s=freshState();s.wood=rewardFor(s,1)+rewardFor(s,0);assert.equal(s.wood,22);
  assert.ok(purchase(s,'axe'));assert.equal(s.wood,10);assert.equal(s.axe,1);assert.equal(chopCount(3,2),'2 chops');
  s.wood=1e6;s.hardwood=100;for(const kind of ['axe','speed','yield']){while(purchase(s,kind)){}assert.equal(upgradeCost(s,kind),null);assert.equal(s[kind],4);}
  assert.ok(swingDuration(s)<swingDuration(freshState()));
});
test('a damaged primary save recovers the last valid backup',()=>{
  const st=storage(),s=freshState();s.wood=22;assert.ok(writeSave(st,s));s.wood=10;s.axe=1;assert.ok(writeSave(st,s));
  st.setItem(SAVE_KEY,'{broken');const loaded=readSave(st);assert.equal(loaded.status,'recovered');assert.equal(loaded.state.wood,22);
  assert.ok(writeSave(st,loaded.state));assert.equal(readSave(st).status,'saved');
});
test('unavailable storage is nonfatal and invalid saves cannot bypass upgrade limits',()=>{
  assert.equal(readSave(null).status,'unavailable');assert.equal(writeSave(null,freshState()),false);
  const st=storage();st.setItem(SAVE_KEY,'[]');assert.equal(readSave(st).status,'damaged');
  const s=sanitize({axe:99,wood:-10,sensitivity:99});assert.equal(s.axe,4);assert.equal(s.wood,0);assert.equal(s.sensitivity,2);
});

test('a visible trunk stays selected when the walker reaches its side',()=>{
  const t=tree(.5,.1),feet={x:0,z:0},eye={x:.95,z:6.4};
  assert.equal(pickTree([t],feet,Math.PI,eye).tree,t);
  assert.equal(pickTree([tree(0,8)],feet,Math.PI,eye).tree,null);
});

test('camera keeps its original framing in clear space and retracts its shoulder beside a trunk',()=>{
  const a=new Follow(new THREE.PerspectiveCamera()),b=new Follow(new THREE.PerspectiveCamera());a.yaw=b.yaw=Math.PI;
  const target=new THREE.Vector3(0,0,0),look={x:0,y:0};
  a.update(1/60,target,look,0,()=>null,()=>-100);
  assert.ok(Math.abs(a.camera.position.x-.95)<1e-9);
  let rays=0;b.update(1/60,target,look,0,(o,d)=>{rays++;return d.x>.9?.2:null;},()=>-100);
  assert.ok(Math.abs(b.camera.position.x)<1e-9);assert.equal(rays,6);
});

test('a failed backup write still saves new progress to the primary slot',()=>{
  const st=storage();writeSave(st,freshState());const put=st.setItem;st.setItem=(k,v)=>{if(k.endsWith('-backup'))throw new Error('quota');put(k,v);};
  const s=freshState();s.wood=16;assert.equal(writeSave(st,s),true);assert.equal(readSave(st).state.wood,16);
});


test('a committed finishing stroke keeps its recovery when the tree leaves targeting',()=>{
 const g=rig();g.input.mouse.left=true;g.before(.02,frame());g.swing.hit=true;g.swing.age=g.swing.duration*.55;g.swing.t.down=true;g.input.mouse.left=false;
 g.before(.02,frame());assert.ok(g.swing,'falling must not cut off the follow-through');
 g.before(.02,frame(1));assert.ok(g.swing,'movement preserves the finishing recovery');
});

test('right-click lock selects an aimed tree, persists through strafing, toggles off and releases on felling or range',()=>{
 const g=rig(),t=g.forest.trees[0];const press={...frame(),aimPressed:true};g.before(.02,press);assert.equal(g.lockedTree,t);assert.equal(press.strafe,true);
 g.follow.yaw=0;g.before(.02,frame(1));assert.equal(g.nearest().tree,t);g.before(.02,{...frame(),aimPressed:true});assert.equal(g.lockedTree,null);
 g.follow.yaw=Math.PI;g.before(.02,{...frame(),aimPressed:true});t.down=true;g.before(.02,frame());assert.equal(g.lockedTree,null);
 t.down=false;g.lockedTree=t;g.player.feet.x=25;g.before(.02,frame());assert.equal(g.lockedTree,null);
});
test('aim picks a central visible candidate and ignores down, behind and distant trunks',()=>{
 const center=tree(0,-8),side=tree(3,-7);assert.equal(pickAimTree([side,center,tree(0,1),tree(0,-30)],{x:0,z:0},Math.PI),center);center.down=true;assert.equal(pickAimTree([center,tree(0,2)],{x:0,z:0},Math.PI),null);
});
test('moving swing contact tracks the near side of a tree but stays within arm reach after retreat',()=>{
 const t=tree(0,-1.4,{y:0}),feet={x:0,y:0,z:0};const p=movingChopContact(t,feet);assert.ok(Math.abs(p.z+1.208)<.001);
 feet.x=8;const miss=movingChopContact(t,feet);assert.ok(Math.hypot(miss.x-feet.x,miss.z-feet.z)<=CHOP_REACH+.00001);assert.equal(miss.y,1.23);
});

test('aim cannot lock through a solid obstruction',()=>{const g=rig();g.player.castRay=()=>.2;g.before(.02,{...frame(),aimPressed:true});assert.equal(g.lockedTree,null);g.player.castRay=()=>null;g.before(.02,{...frame(),aimPressed:true});assert.equal(g.lockedTree,g.forest.trees[0]);});
