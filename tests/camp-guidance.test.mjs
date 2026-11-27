import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {campObjective,chooseBearing} from '../src/camp-guidance.js';
import {freshState,sanitize} from '../src/economy.js';
import {createShared} from '../src/oilpaint/common.js';
import {createFingerpost} from '../src/world/fingerpost.js';

test('a load guides to an open drop, with stable bearings near a boundary and explicit marks taking priority',()=>{
  const site=(id,x,delivery=true)=>({id,position:{x,z:0},delivery});
  const points=[site('home',0),site(0,10),site(1,22,false),site('rack',32)],feet={x:20,z:0};
  assert.equal(chooseBearing(points,feet,0,null,null).id,'home');
  assert.equal(chooseBearing(points,feet,8,null,null).id,0);
  assert.equal(chooseBearing(points,feet,8,1,null).id,1);
  assert.equal(chooseBearing(points,{x:5.3,z:0},8,null,'home').id,'home');
  assert.equal(chooseBearing(points,{x:6.2,z:0},8,null,'home').id,0);
  assert.equal(chooseBearing(points,{x:31,z:0},8,null,'bogus').id,'rack');
});
test('a saved bearing is valid for a discovered home, the shack or automatic guidance',()=>{
  const s=freshState();s.places[0].found=true;
  for(const [input,expect] of [['home','home'],[0,0],[2,null],['bogus',null],[null,null]])assert.equal(sanitize({...s,destination:input}).destination,expect);
});
test('camp objectives follow actual tool, shed, mill, building and woodland progress',()=>{
  const s=freshState();assert.match(campObjective(s).detail,/birch/);
  s.carried=8;assert.match(campObjective(s).detail,/bearing/);s.shed=40;assert.match(campObjective(s).title,/felling axe/);
  s.axe=1;assert.match(campObjective(s).title,/Sawmill/);s.sawmill=40;assert.match(campObjective(s).title,/porch/);
  s.porch=12;assert.match(campObjective(s).title,/extension/);s.lodge=24;assert.match(campObjective(s).title,/homes/);
  for(const p of s.places)Object.assign(p,{found:true,wood:24,planks:8,trail:40});
  assert.match(campObjective(s).title,/handcart/);
});
test('unused lamp slots start dark and the camp fingerpost actually points to each seeded home',()=>{
  assert.ok(createShared().uCampLights.value.every(v=>v.w===0));
  const origin={x:7,z:-4},sites=[{dropoff:{x:-30,z:4}},{dropoff:{x:48,z:-14}},{dropoff:{x:-9,z:-50}}];
  const post=createFingerpost({},origin,sites,()=>1,new THREE.MeshBasicMaterial(),new THREE.MeshBasicMaterial());
  const arms=post.children.filter(o=>o.isGroup);assert.equal(arms.length,3);
  for(const [i,arm] of arms.entries()){
    const dir=new THREE.Vector3(1,0,0).applyQuaternion(arm.quaternion),p=sites[i].dropoff;
    const wanted=new THREE.Vector3(p.x-post.position.x,0,p.z-post.position.z).normalize();
    assert.ok(dir.dot(wanted)>.999);
  }
});
