import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createForest} from '../src/world/forest.js';import {createAxes,AXE_PROFILES} from '../src/figure/axes.js';
import {beginDelivery,advanceDelivery,DELIVERY_SECONDS,DELIVERY_LAND} from '../src/delivery.js';
import {freshState,depositWood} from '../src/economy.js';

test('successive cuts deform the actual trunk, expose wood and reset on regrowth without affecting other trees',()=>{
 const f=createForest({}),t=f.trees.find(t=>t.hero),geometry=f.group.children[0].geometry,p=geometry.attributes.position,c=geometry.attributes.aCut;
 const range=t.ranges.wood,original=p.array.slice(range[0]*3,range[1]*3),other=f.trees[0],otherBefore=p.array.slice(other.ranges.wood[0]*3,other.ranges.wood[1]*3);
 const contact={x:t.x,y:t.y+1.23,z:t.z+t.r};let previous=0;
 for(const damage of [.2,.5,.9]){f.carveTree(t,contact,0,1,damage);let moved=0;for(let i=range[0];i<range[1];i++)moved=Math.max(moved,Math.abs(p.getZ(i)-original[(i-range[0])*3+2]));assert.ok(moved>previous);previous=moved;assert.ok([...c.array.slice(...range)].some(v=>v>0));}
 assert.deepEqual(p.array.slice(other.ranges.wood[0]*3,other.ranges.wood[1]*3),otherBefore);
 f.resetCut(t);assert.deepEqual(p.array.slice(range[0]*3,range[1]*3),original);assert.ok([...c.array.slice(...range)].every(v=>v===0));
});
test('all five axes have distinct silhouettes and only the equipped model leaves visible paint',()=>{
 assert.equal(new Set(AXE_PROFILES.map(p=>JSON.stringify(p.points))).size,5);const a=createAxes({},()=>new THREE.MeshBasicMaterial());
 for(let tier=0;tier<5;tier++){a.equip(tier);a.paint.update();assert.equal(a.models.filter(m=>m.model.visible).length,1);assert.equal(a.models[tier].model.visible,true);const v=a.paint.mesh.geometry.attributes.aVisible.array;assert.ok([...v].some(x=>x===0)&&[...v].some(x=>x===1));assert.ok(AXE_PROFILES[tier].points.some(([x,y])=>x===.315&&y===.525),'every edge preserves blade contact');}
});
test('wood commits on each landing and interrupted unloads preserve all unplaced logs',()=>{
 const s={...freshState(),carried:50,wood:12},d=beginDelivery(s.carried);assert.equal(d.parts.reduce((a,b)=>a+b),50);
 let result=advanceDelivery(d,DELIVERY_SECONDS*DELIVERY_LAND-.01);assert.equal(result.amount,0);assert.equal(s.carried,50);
 result=advanceDelivery(d,.02);depositWood(s,result.amount);assert.equal(s.wood,29);assert.equal(s.carried,33);
 // Cancelling here leaves the remaining 33 in the bag; a fresh sequence transfers it once.
 const retry=beginDelivery(s.carried);result=advanceDelivery(retry,10);depositWood(s,result.amount);assert.equal(s.carried,0);assert.equal(s.wood,62);assert.equal(advanceDelivery(retry,1).amount,0);assert.equal(beginDelivery(0),null);
});
