import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import R from '../src/figure/rapier/rapier.mjs';
import {createForest} from '../src/world/forest.js';
import {FallenTree} from '../src/world/fallen-tree.js';
import {HINGE} from '../src/world/fallen-wood.js';
import {readSkill} from '../src/woodcutting.js';

await R.init();
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const forest=createForest({}),tree=forest.trees.find(t=>t.hero);
const mark={x:tree.x,y:tree.y+1.17,z:tree.z+tree.r,nx:0,nz:1,angle:.6,damage:.4};
forest.carveTree(tree,{...mark,notches:[mark]},0,1,.4);
const wood=forest.fallenWood(tree);
function fixture(extra={}){
  const physics=new R.World(V(0,-9.81,0)),scene=new THREE.Scene();
  const game={RAPIER:R,physics,scene,forest,cutPaint:new THREE.MeshBasicMaterial()};
  const record={until:Date.now()+90000,bearing:.32,mask:0,...extra};
  const fallen=new FallenTree(game,tree,wood,record);
  return {game,record,fallen,close(){fallen.dispose();physics.free();game.cutPaint.dispose();}};
}
function worldPoint(part,at,radial=0){
  return wood.centre(at).add(V(radial,0,0)).sub(part.rest).applyQuaternion(part.body.rotation()).add(part.body.translation());
}
const pigments=p=>p.mesh.children.filter(m=>m.geometry.isInstancedBufferGeometry).reduce((n,m)=>n+m.geometry.instanceCount,0);

test('the carved bole, crown, paint, shadows and body survive the hinge and the landing',()=>{
  const {game,fallen,close}=fixture();
  try{
    fallen.begin(0,true);const [part]=fallen.parts,handle=part.body.handle;
    const skin=part.mesh.children[0],boughs=part.shadow.children[1],paint=pigments(part);
    assert.ok(skin.geometry.attributes.aCut.array.some(d=>d>.001));
    assert.ok(boughs.count>0&&paint>100);
    assert.equal(part.shadow.children[0].geometry,skin.geometry);
    assert.ok(worldPoint(part,HINGE).distanceTo(wood.centre(HINGE).add(V(tree.x,tree.y,tree.z)))<.0001);
    fallen.fall(.64,false);game.physics.step();
    fallen.fall(1.46,true);fallen.sync();
    assert.equal(fallen.parts.length,1);assert.equal(fallen.parts[0],part);
    assert.equal(part.body.handle,handle);assert.ok(part.body.isDynamic());
    assert.equal(part.mesh.children[0],skin);assert.equal(part.shadow.children[1],boughs);
    assert.equal(pigments(part),paint);assert.ok(part.mesh.position.distanceTo(part.body.translation())<1e-5);
    assert.ok(part.body.numColliders()>2);assert.equal(part.body.collider(part.body.numColliders()-1).fallenPart,part);
  }finally{close();}
  assert.equal(game.scene.children.length,0);
});

test('bucking follows the marked wood, keeps its crown on the far length and resumes the same motion from a save',()=>{
  const {fallen,record,close}=fixture();
  try{
    fallen.begin(1.48,false);const [whole]=fallen.parts,paint=pigments(whole),station=2.15;
    const near=worldPoint(whole,HINGE+.12),crown=worldPoint(whole,wood.top-.03),hit=worldPoint(whole,station,wood.radius(station));
    whole.body.setLinvel(V(.3,-.5,.12),true);whole.body.setAngvel(V(.12,0,0),true);
    assert.equal(fallen.cut(whole,hit,1).hits,1);
    assert.equal(fallen.cut(whole,hit,1).hits,2);assert.equal(fallen.parts.length,1);assert.equal(whole.marks.length,1);
    assert.equal(fallen.cut(whole,hit,1).hits,3);assert.equal(fallen.parts.length,2);
    const [butt,tip]=fallen.parts;
    assert.ok(Math.abs(butt.hi-station)<.001&&butt.hi===tip.lo);
    assert.ok(Math.abs(butt.length+tip.length-whole.length)<.00001);
    assert.ok(worldPoint(butt,HINGE+.12).distanceTo(near)<.0001&&worldPoint(tip,wood.top-.03).distanceTo(crown)<.0001);
    assert.ok(!whole.body.isValid());assert.equal(pigments(butt)+pigments(tip),paint);
    assert.equal(butt.shadow.children.length,1);assert.ok(tip.shadow.children[1].count>0);
    assert.ok(butt.mesh.children[0].geometry.attributes.aCut.array.some(d=>d>.001));
    for(const p of fallen.parts)assert.ok(p.mesh.children[0].geometry.groups[1].count>0);
    assert.equal(fallen.cut(tip,worldPoint(tip,station+1,wood.radius(station+1)),1).hits,1);
    butt.body.sleep();fallen.snapshot();const saved=readSkill(JSON.parse(JSON.stringify({splits:{5:record}}))).splits[5];
    const copy=fixture(saved);
    try{
      copy.fallen.begin(1.3,false);
      const [a,b]=copy.fallen.parts;
      assert.ok(a.body.isSleeping());assert.ok(!b.body.isSleeping());
      assert.ok(worldPoint(a,HINGE+.12).distanceTo(near)<.0001&&worldPoint(b,wood.top-.03).distanceTo(crown)<.0001);
      assert.ok(V().copy(b.body.linvel()).distanceTo(tip.body.linvel())<1e-6);
      assert.equal(b.marks.length,1);assert.equal(b.hits,1);assert.equal(pigments(a)+pigments(b),paint);
    }finally{copy.close();}
  }finally{close();}
});

test('a camp with old bucking scores restores the completed cut and its unfinished neighbour',()=>{
  const {fallen,record,close}=fixture({mask:1,scores:[0,2,0]});
  try{
    fallen.begin(1.4,false);
    assert.equal(fallen.parts.length,2);assert.equal(record.kerfs.length,2);
    assert.equal(fallen.parts[1].hits,2);assert.equal(record.mask,1);
  }finally{close();}
});
