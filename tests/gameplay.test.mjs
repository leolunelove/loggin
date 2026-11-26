import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Follow} from '../src/figure/camera.js';
import {Lumberjack} from '../src/game.js';
import {CHOP_REACH,IMPACT_AT,swingPose,pickTree,chopCount} from '../src/mechanics.js';
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
test('moving during windup cancels immediately without damaging a tree',()=>{
  const g=rig();g.input.mouse.left=true;g.before(.15,frame());assert.ok(g.swing);
  const next=frame(1);g.before(.02,next);assert.equal(g.swing,null);assert.equal(next.move.x,1);
  assert.equal(g.hits.length,0);
});
test('looking away or opening a menu cancels an uncommitted swing',()=>{
  for(const action of ['look','pause']){const g=rig();g.input.mouse.left=true;g.before(.2,frame());
    if(action==='look')g.follow.yaw=0;else g.paused=true;
    g.before(.3,frame());assert.equal(g.hits.length,0);assert.equal(g.swing,null);}
});
test('keyboard chop remains held when one of two chop keys is released',()=>{
  const g=rig();g.input.keys.add('KeyE');g.input.keys.add('Space');g.input.keys.delete('KeyE');g.before(.02,frame());assert.ok(g.swing);
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
 g.before(.02,frame(1));assert.equal(g.swing,null,'movement still interrupts recovery immediately');
});
