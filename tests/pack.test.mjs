import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWoodPack,visibleWoodCount,PACK_LOGS} from '../src/figure/pack.js';
const palette=[[.3,.5,.7],[.2,.3,.5],[.1,.15,.2]];
function pack(){
 const object=new THREE.Group(),spine=new THREE.Bone();spine.position.y=1.3;object.add(spine);object.updateMatrixWorld(true);
 return {spine,object,p:createWoodPack({}, {object,bones:{spine_03:spine}}, {paint:()=>new THREE.MeshBasicMaterial(),canvasPalette:palette})};
}
test('pack load restores the current wood balance and tracks collecting and spending',()=>{
 const {p}=pack();p.setWood(0);p.update(.016);assert.equal(p.logs.filter(l=>l.mesh.visible).length,0);
 assert.ok([...p.paint.mesh.geometry.attributes.aVisible.array].some(v=>v===0),'empty logs must not leave floating paint');
 p.setWood(18);p.update(1);assert.equal(p.logs.filter(l=>l.mesh.visible).length,3);
 p.setWood(6);p.update(1);assert.equal(p.logs.filter(l=>l.mesh.visible).length,1);
 assert.equal(visibleWoodCount(100000),PACK_LOGS);assert.equal(visibleWoodCount(-10),0);
});
test('a seated pack rests on the bench with its cargo and returns to the same shoulder loops',()=>{
 const {p,object,spine}=pack();p.setWood(24);
 object.position.set(3,.3,4);object.rotation.y=.83;spine.rotation.z=.13;object.updateMatrixWorld(true);
 const before=p.axeLoop.getWorldPosition(new THREE.Vector3()),seat={position:new THREE.Vector3(3,.3,4),yaw:Math.PI};
 p.restAtBench(seat,1);p.update(1);
 const rested=p.group.getWorldPosition(new THREE.Vector3());assert.ok(Math.abs(rested.y-seat.position.y-.565)<.001);
 assert.ok(rested.x>seat.position.x+.55);assert.equal(p.logs.filter(l=>l.mesh.visible).length,4);
 spine.rotation.x=.16;object.updateMatrixWorld(true);p.restAtBench(seat,1);
 assert.ok(p.group.getWorldPosition(new THREE.Vector3()).distanceTo(rested)<.00001);
 spine.rotation.x=0;object.updateMatrixWorld(true);p.restAtBench(null,0);
 assert.ok(p.axeLoop.getWorldPosition(new THREE.Vector3()).distanceTo(before)<.00001);
});

test('pack stays attached to the upper body while its paint and shadow geometry follow',()=>{
 const {p,spine,object}=pack();p.setWood(24);p.update(.016);
 assert.equal(p.group.parent,spine);const before=p.logs[0].mesh.getWorldPosition(new THREE.Vector3());
 object.position.set(7,0,8);spine.rotation.x=.15;object.updateMatrixWorld(true);p.update(.016);
 const after=p.logs[0].mesh.getWorldPosition(new THREE.Vector3());assert.ok(after.distanceTo(before)>8);
 assert.ok([...p.paint.mesh.geometry.attributes.aPos.array].every(Number.isFinite));
 assert.ok(p.logs[0].mesh.layers.mask&2,'wood contributes to the character shadow');
});
