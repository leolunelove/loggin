import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '../src/figure/rapier/rapier.mjs';
import {createShack} from '../src/world/shack.js';
import {insideShack,atShackDoor,shackStation,DOOR} from '../src/world/shack-layout.js';
import {freshState} from '../src/economy.js';
import {Follow} from '../src/figure/camera.js';
import {Lumberjack} from '../src/game.js';
const home=()=>createShack({}, {x:0,z:0},()=>0,{makePaint:()=>new THREE.MeshBasicMaterial()});
test('the real collision layout admits the player through the doorway, blocks walls and opens the finished rear room',async()=>{
 await RAPIER.init();
 function walk(x,lodge,from,to){
  const world=new RAPIER.World({x:0,y:-9.81,z:0}),h=home(),state={...freshState(),lodge};
  world.createCollider(RAPIER.ColliderDesc.cuboid(20,.25,20).setTranslation(0,-.25,0));
  for(const c of h.colliders)world.createCollider(RAPIER.ColliderDesc.cuboid(c.hx,c.hy,c.hz).setTranslation(c.x,c.y,c.z));
  const g={physics:world,RAPIER,state,home:h};Lumberjack.prototype.syncCampColliders.call(g);
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x,1.03,from));
  const capsule=world.createCollider(RAPIER.ColliderDesc.capsule(.62,.28),body),controller=world.createCharacterController(.02);controller.enableAutostep(.3,.2,true);controller.enableSnapToGround(.3);world.step();
  const direction=Math.sign(to-from);
  for(let i=0;i<100;i++){const p=body.translation(),dz=direction*Math.min(.055,Math.abs(to-p.z));controller.computeColliderMovement(capsule,{x:0,y:-.03,z:dz});const m=controller.computedMovement();body.setNextKinematicTranslation({x:p.x+m.x,y:p.y+m.y,z:p.z+m.z});world.step();}
  const z=body.translation().z;world.free();return z;
 }
 const entered=walk(DOOR.x,0,3,.2);assert.ok(entered<.35,`doorway must allow entry: ${entered}`);
 assert.ok(walk(1,0,3,.2)>1.7,'front wall must stop walking through it');
 assert.ok(walk(DOOR.x,0,.2,3)>2.8,'same doorway must allow exit');
 assert.ok(walk(DOOR.x,0,.2,-3)>-1.2,'unfinished rear wall stays solid');
 assert.ok(walk(DOOR.x,24,.2,-3)<-2.8,'completed cabin opens a usable rear room');
});
test('door, cutaway and supply displays respond to entering, upgrading and leaving without revealing unfinished projects',()=>{
 const h=home(),s=freshState(),camera={position:{x:3,y:5,z:6}};
 assert.equal(h.contains({x:DOOR.x,y:.11,z:0},s),true);assert.equal(atShackDoor(h.group.position,{x:DOOR.x,y:0,z:3}),true);
 const initial=h.group.children.filter(m=>m.userData.shell==='roof'&&m.visible).length;assert.ok(initial>0);
 let r;for(let i=0;i<30;i++)r=h.updateInterior(1/60,{x:DOOR.x,y:.11,z:0},camera,s);
 assert.ok(r.inside&&r.reveal);assert.ok(h.door.rotation.y< -1.4);assert.equal(h.group.children.filter(m=>m.userData.shell==='roof'&&m.visible).length,0);
 const empty=[...h.paint.mesh.geometry.attributes.aVisible.array].filter(Boolean).length;s.wood=80;s.hardwood=24;s.planks=8;s.axe=3;h.setCamp(s);const stocked=[...h.paint.mesh.geometry.attributes.aVisible.array].filter(Boolean).length;assert.ok(stocked>empty);
 assert.equal(insideShack(h.group.position,{x:0,y:0,z:-3},s),false);s.lodge=24;h.setCamp(s);assert.equal(h.contains({x:0,y:.2,z:-3},s),true);
 for(let i=0;i<60;i++)r=h.updateInterior(1/60,{x:0,y:0,z:7},camera,s);assert.equal(r.reveal,false);assert.ok(h.door.rotation.y>-.001);assert.ok(h.group.children.some(m=>m.userData.shell==='roof'&&m.visible));
});
test('interior camera stays above the room while preserving mouse heading and smoothly returns outdoors',()=>{
 const camera=new THREE.PerspectiveCamera(),f=new Follow(camera);camera.position.set(0,2,6);f.yaw=Math.PI;f.interior={center:{x:0,y:.8,z:0},distance:6};
 for(let i=0;i<60;i++)f.update(1/60,new THREE.Vector3(),{x:0,y:0},0,()=>{throw Error('indoor camera must not squeeze against cabin walls');},()=>0);
 assert.ok(camera.position.y>4);f.look({x:.5,y:0});const yaw=f.yaw;f.update(1/60,new THREE.Vector3(),{x:0,y:0},0,()=>null,()=>0);assert.equal(f.yaw,yaw);
 const before=camera.position.clone();f.interior=null;f.update(1/60,new THREE.Vector3(),{x:0,y:0},0,()=>null,()=>0);assert.ok(camera.position.distanceTo(before)<.5,'exit should blend, not snap');
});
test('inside interaction selects the physical ledger and clears outdoor combat input',()=>{
 const g=Object.create(Lumberjack.prototype),s=freshState();let opened;
 Object.assign(g,{state:s,home:{contains:()=>true,station:()=>({key:'ledger'})},player:{feet:{x:0,y:0,z:0}},input:{active:true},follow:{look(){}},time:0,started:true,paused:false,held:false,swing:{},lockedTree:{},useFurniture:id=>opened=id});
 const input={move:{x:1,y:0},look:{x:0,y:0},interactPressed:true,device:'keyboard',sprint:true};g.before(.02,input);assert.equal(opened,'ledger');assert.equal(input.move.x,1);assert.equal(input.sprint,false);assert.equal(g.swing,null);assert.equal(g.lockedTree,null);
});

test('furnishings have separate approach points and the cot moves into the finished bedroom',()=>{
 const origin={x:17,y:3,z:-22};
 const at=(x,z,yaw=0,lodge=0,previous)=>shackStation(origin,{x:origin.x+x,y:3.12,z:origin.z+z},yaw,{lodge},previous)?.key;
 assert.equal(at(-.60,-.18,-Math.PI/2),'bench');
 assert.equal(at(.65,-.49,Math.PI/2),'stores');
 assert.equal(at(.57,.81,Math.PI/2),'ledger');
 assert.equal(at(.04,-.30,Math.PI),'bed');
 assert.equal(at(.04,-.30,Math.PI,24),undefined);
 assert.equal(at(.57,-2.13,Math.PI,24),'bed');
 assert.equal(at(.57,-2.13,Math.PI),undefined);
 assert.equal(at(-.475,1.80,Math.PI),undefined);
 assert.equal(at(-.22,-.18,-Math.PI/2,0,'bench'),'bench');
});
