import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {freshState,sanitize,purchase,depositWood} from '../src/economy.js';
import {SAVE_KEY,readSave,writeSave} from '../src/save.js';
import {atWoodRack,homeDistance,UNLOAD_REACH,startingTree} from '../src/world/home-site.js';
import {createShack} from '../src/world/shack.js';
import {createForest} from '../src/world/forest.js';
import {Lumberjack} from '../src/game.js';

test('legacy wood is stored; carried wood survives reload and cannot buy upgrades before unloading',()=>{
 const legacy=sanitize({version:1,wood:45,axe:2});assert.equal(legacy.wood,45);assert.equal(legacy.carried,0);assert.equal(legacy.axe,2);
 const s=freshState();s.carried=22;s.total=22;assert.equal(purchase(s,'axe'),false);assert.equal(s.carried,22);
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 writeSave(storage,s);const restored=readSave(storage).state;assert.equal(restored.carried,22);assert.equal(restored.wood,0);
 assert.equal(depositWood(restored),22);assert.equal(restored.carried,0);assert.equal(restored.wood,22);assert.equal(restored.total,22);
 assert.equal(depositWood(restored),0);assert.equal(restored.wood,22);
 assert.equal(purchase(restored,'axe'),true);assert.equal(restored.wood,10);assert.equal(restored.carried,0);
 writeSave(storage,restored);assert.equal(readSave(storage).state.wood,10);assert.equal(readSave(storage).state.carried,0);assert.ok(map.has(SAVE_KEY));
});

test('unloading requires reaching the outdoor rack and transfers exactly once',()=>{
 const g=Object.create(Lumberjack.prototype),s=freshState();s.carried=8;
 let feedback=0;Object.assign(g,{state:s,home:{dropoff:{x:3,y:0,z:4}},player:{feet:{x:0,y:0,z:0}},renderHud(){},save(){},audio:{unload(){feedback++;}},shade:{refresh(){}},toast(){}});
 assert.equal(g.unload(),0);assert.equal(s.carried,8);g.player.feet={x:3,y:0,z:5};
 assert.equal(g.unload(),8);assert.equal(s.wood,0);assert.equal(s.carried,8);assert.equal(g.unload(),0);g.updateDelivery(1.14);assert.equal(s.wood,8);assert.equal(s.carried,0);assert.equal(feedback,1);g.updateDelivery(.4);assert.equal(g.delivery,null);
 assert.equal(atWoodRack(g.home,{x:3,y:3,z:4}),false);assert.equal(homeDistance(g.home,{x:3,z:4+UNLOAD_REACH+.01})>UNLOAD_REACH,true);
});

test('a rack action takes precedence over chopping nearby trees',()=>{
 const g=Object.create(Lumberjack.prototype),t={x:0,z:-1,r:.2,type:1,tier:0};let unloads=0;
 Object.assign(g,{state:freshState(),time:0,started:true,paused:false,touch:false,held:false,swing:{t},input:{active:true,keys:new Set(['KeyE']),mouse:{left:false}},player:{feet:{x:0,y:0,z:0},grounded:true,speed:0},home:{dropoff:{x:0,y:0,z:0}},camera:{position:{x:0,z:4}},follow:{yaw:Math.PI,look(){}},forest:{trees:[t]},unload(){unloads++;}});
 g.before(.1,{move:{x:0,y:0},look:{x:0,y:0},device:'keyboard'});assert.equal(g.swing,null);assert.equal(unloads,1);
});

test('shack fits between original trees, casts shadows and updates a painted stored woodpile',()=>{
 const forest=createForest({}),original=forest.trees.map(t=>[t.x,t.z]);
 const home=createShack({},forest.home,()=>0,{makePaint:()=>new THREE.MeshBasicMaterial()});
 const starter=startingTree(forest.trees);assert.ok(Math.hypot(home.dropoff.x-starter.x,home.dropoff.z-starter.z)<9);
 for(const t of forest.trees){
  const dx=Math.max(0,Math.abs(t.x-forest.home.x)-1.85),dz=Math.max(0,Math.abs(t.z-forest.home.z)-1.56);
  assert.ok(Math.hypot(dx,dz)>t.r,'no tree inside the shack');
 }
 home.setWood(0);const empty=[...home.paint.mesh.geometry.attributes.aVisible.array].filter(Boolean).length;
 home.setWood(22);const filled=[...home.paint.mesh.geometry.attributes.aVisible.array].filter(Boolean).length;assert.ok(filled>empty);
 home.setWood(0);assert.equal([...home.paint.mesh.geometry.attributes.aVisible.array].filter(Boolean).length,empty);
 assert.ok([...home.paint.mesh.geometry.attributes.aPos.array].every(Number.isFinite));assert.ok(home.shadow.children.length>100);assert.equal(home.colliders.length,2);
 assert.deepEqual(forest.trees.map(t=>[t.x,t.z]),original);
});
