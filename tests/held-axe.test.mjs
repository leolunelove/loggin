import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import R from '../src/figure/rapier/rapier.mjs';
import {HeldAxe,isCuttingEdge,bitesWood} from '../src/figure/held-axe.js';
import {axeSolids,toolScale,bladePoint} from '../src/figure/axe-shape.js';
import {createAxes} from '../src/figure/axes.js';
import {createForest} from '../src/world/forest.js';
import {plantTrunk,PLAYER_GROUPS,TRUNK_GROUPS} from '../src/world/woodland-physics.js';
import {NearbyBark} from '../src/world/axe-bark.js';
await R.init();
const vector=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const identity=new THREE.Quaternion();
const fixture=()=>{const world=new R.World(vector());return {world,held:new HeldAxe(world,R)};};
function clearance(held,collider){
  const f=held.last;
  return Math.min(...held.parts.map(k=>collider.contactShape(k.shape,k.local.clone().applyQuaternion(f.q).add(f.p),f.q,2)?.distance??2));
}
test('a fast cut stops on the near face of a 12 mm board at 30, 60 and 120 Hz for all five axes',()=>{
  for(const fps of [30,60,120])for(let tier=0;tier<5;tier++){
    const {world,held}=fixture(),wall=world.createCollider(R.ColliderDesc.cuboid(.006,2,2));
    world.step();held.solve(vector(-.8),identity,tier,1/fps);world.step();
    const impact=held.solve(vector(1.3),identity,tier,1/fps).contact;
    assert.equal(impact.collider.handle,wall.handle);assert.equal(impact.part.name,'bit');
    assert.ok(impact.normal.x<-.99&&Math.abs(impact.point.x+.006)<.002);
    for(let i=0;i<4;i++){world.step();held.solve(vector(1.3),identity,tier,1/fps);assert.ok(clearance(held,wall)>=-.001);assert.ok(held.last.p.x<0);}
    const away=held.solve(vector(-.9),identity,tier,1/fps);assert.equal(away.contact,null);assert.ok(Math.abs(away.position.x+.9)<.001);
    world.free();
  }
});
test('the shaft and poll stop on obstructions even when the edge misses; both bits on the forester cut',()=>{
  for(const [tier,y,from,to,expected] of [[0,-.15,-.6,.6,'haft'],[3,.54,.8,-.8,'head'],[4,.54,.8,-.8,'backBit']]){
    const {world,held}=fixture(),rail=world.createCollider(R.ColliderDesc.cuboid(.009,.032,.6).setTranslation(0,y*toolScale(tier),0));
    world.step();held.solve(vector(from),identity,tier,1/30);
    const h=held.solve(vector(to),identity,tier,1/30).contact;
    assert.equal(h.part.name,expected);assert.equal(isCuttingEdge(h.part.name),expected==='backBit');
    assert.equal(h.collider.handle,rail.handle);assert.ok(clearance(held,rail)>=-.001);world.free();
  }
});
test('rotation sweeps the blade through an intermediate angle when both endpoint poses clear a slender post',()=>{
  const {world,held}=fixture(),r=toolScale(4),post=world.createCollider(R.ColliderDesc.cuboid(.013,.033,.013).setTranslation(.145*r,.53*r,0));
  world.step();const q=a=>new THREE.Quaternion().setFromAxisAngle(vector(0,1,0),a);
  held.solve(vector(),q(-1.27),4,1/30);
  const result=held.solve(vector(),q(1.27),4,1/30);
  assert.equal(result.contact?.collider.handle,post.handle);
  assert.ok(clearance(held,post)>=-.001);world.free();
});
test('proxy uses real colliders, ignores its carrier and camera rays, and leaves the world when stowed',()=>{
  const {world,held}=fixture(),tier=3;
  const ownerBody=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
  held.playerCollider=world.createCollider(R.ColliderDesc.capsule(.5,.28).setCollisionGroups(PLAYER_GROUPS),ownerBody);
  world.step();held.solve(vector(1),identity,tier,1/60);world.step();
  assert.equal(held.body.numColliders(),axeSolids(tier).length);
  const ray=new R.Ray(vector(1,.53,-1),vector(0,0,1));
  assert.ok(world.castRay(ray,2,true));
  assert.equal(world.castRay(ray,2,true,undefined,PLAYER_GROUPS,held.playerCollider),null);
  held.stow();world.step();assert.equal(world.castRay(ray,2,true),null);
  held.solve(vector(-2),identity,4,1/60);world.step();assert.equal(held.body.numColliders(),5);
  assert.ok(held.body.translation().x<-1.99);world.free();
});
test('each visible steel vertex fits the physical stock and the bevel ends at the calibrated cutting point',()=>{
  const tool=createAxes({},()=>new THREE.MeshBasicMaterial());
  for(let tier=0;tier<5;tier++){
    const {world,held}=fixture(),scale=toolScale(tier);held.solve(vector(),identity,tier,1/60);world.step();
    const bit=held.parts.find(p=>p.name==='bit'),tip=vector(...bladePoint(tier)).multiplyScalar(scale);
    assert.ok(bit.proxy.projectPoint(tip,false).point.x>=tip.x-.002);
    const steel=tool.models[tier].meshes.filter(m=>['forged','ground','honed'].includes(m.name));
    assert.equal(steel.length,3);
    const hulls=held.parts.map(k=>{
      const vertices=k.proxy.vertices(),indices=k.proxy.indices(),planes=[];
      for(let i=0;i<indices.length;i+=3){
        const [a,b,c]=Array.from(indices.slice(i,i+3),id=>vector().fromArray(vertices,id*3).add(k.local));
        planes.push(new THREE.Plane().setFromCoplanarPoints(a,b,c));
      }
      return planes;
    });
    for(const m of steel){const a=m.geometry.attributes.position;
      for(let i=0;i<a.count;i++){const p=vector().fromBufferAttribute(a,i).multiplyScalar(scale);
        const outside=Math.min(...hulls.map(planes=>Math.max(...planes.map(face=>face.distanceToPoint(p)))));
        assert.ok(outside<.0001,`tier ${tier} stray steel ${outside}`);}
    }
    world.free();
  }
});
test('the reachable bark collider uses the cut in the visible trunk, then retires outside reach',()=>{
  const forest=createForest({}),t=forest.trees.find(t=>t.hero),world=new R.World(vector());
  t.collider=plantTrunk(world,R,t);
  const nearby=new NearbyBark(world,R,{colliders:[t],barkSurface:forest.barkSurface});
  const feet=vector(t.x,t.y,t.z+t.r+1),direction=vector(0,0,-1);
  const ray=new R.Ray(vector(t.x,t.y+1.25,feet.z),direction);
  nearby.update(feet);world.step();
  assert.equal(t.collider.collisionGroups(),TRUNK_GROUPS);
  const before=t.axeBark.castRay(ray,6,false),coarse=t.collider.castRay(ray,6,false);
  const p=ray.pointAt(before),cut=forest.carveTree(t,p,0,1,.88);nearby.recut(t);world.step();
  const after=t.axeBark.castRay(ray,6,false);
  assert.ok(after-before>.09&&after-before<=cut.depth+.012,`hollow deepened by ${after-before}`);
  assert.equal(t.collider.castRay(ray,6,false),coarse);
  nearby.update(feet.clone().add(vector(6)));assert.equal(t.axeBark,null);
  assert.equal(t.collider.collisionGroups(),0xffffffff);world.free();
});
test('only an edge presented to the surface after real travel earns a productive hit',()=>{
  const hit={part:{name:'bit'},rotation:identity,normal:vector(-1),velocity:vector(3,-.4,0)};
  assert.ok(bitesWood(hit,.31));assert.equal(bitesWood(hit,.01),false);
  assert.equal(bitesWood({...hit,part:{name:'haft'}},.31),false);
  assert.equal(bitesWood({...hit,normal:vector(0,0,-1),velocity:vector(0,0,4)},.31),false);
  assert.equal(bitesWood({...hit,velocity:vector(-1)},.31),false);
});

test('a wedged tool limits travel away from the hand and still lets the player move along the obstruction',()=>{
  const {world,held}=fixture();
  held.grasp={outside:vector(1,0,0),room:.025};
  const step=vector(.2,.03,-.17);held.limitTravel(step);
  assert.ok(Math.abs(step.x-.025)<1e-6);assert.equal(step.y,.03);assert.equal(step.z,-.17);
  const release=vector(-.16,0,.10);held.limitTravel(release);
  assert.deepEqual(release.toArray(),[-.16,0,.10]);
  held.stow();held.limitTravel(release);assert.equal(held.grasp,null);world.free();
});
