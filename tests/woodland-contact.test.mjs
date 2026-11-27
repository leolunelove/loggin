import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import R from '../src/figure/rapier/rapier.mjs';
import {HOUSE_TYPES,createOutpostHouse,houseCollider} from '../src/world/outpost-house.js';
import {settlementSites,HOME_SPACING} from '../src/world/settlement-sites.js';
import {WORLD} from '../src/world/seed.js';
import {wayDist} from '../src/world/land.js';
import {riverCenter} from '../src/world/river.js';
import {brushContacts} from '../src/world/brush-contact.js';
import {trunkHull,plantTrunk,fallingTrunk,placeSection,sectionBody} from '../src/world/woodland-physics.js';
import {Follow} from '../src/figure/camera.js';

test('every home has a distinct, walkable clearing with a dry porch and a long approach',()=>{
  const previous=WORLD.seed,layouts=new Set();
  try{
    for(let i=0;i<42;i++){
      const seed=WORLD.seed=(i*2654435761)>>>0,origin={x:4,z:76};
      const land=(x,z)=>Math.sin(x*.071+i)*1.2+Math.cos(z*.082)*.8;
      const sites=settlementSites(origin,seed,HOUSE_TYPES,land);
      assert.deepEqual(sites,settlementSites(origin,seed,HOUSE_TYPES,land));
      layouts.add(JSON.stringify(sites.map(p=>Math.floor(p.z))));
      sites.forEach((p,j)=>{
        for(const other of [origin,...sites.slice(0,j)])assert.ok(Math.hypot(p.x-other.x,p.z-other.z)>=HOME_SPACING);
        assert.ok(wayDist(p.x,p.z)<65);assert.ok(p.x+HOUSE_TYPES[j].w/2<riverCenter(p.z)-6);
      });
    }
  }finally{WORLD.seed=previous;}
  assert.ok(layouts.size>25);
});

test('brushing a sapling releases litter once, bends gradually and springs back across frame rates',()=>{
  function pass(dt){
    const p={x:0,y:0,z:0,height:1.9,radius:1},poses=[];
    const brush=brushContacts([p],(_,x,z,hidden)=>poses.push([x,z,hidden]));let shed=0;
    for(let i=0;i<Math.round(.4/dt);i++)brush.update(dt,{x:-.5,y:0,z:0},{x:2,z:0},()=>shed++);
    assert.equal(shed,1);const peak=p.bendX;assert.ok(peak>.22);assert.ok(poses[0][0]<peak*.4);
    for(let i=0;i<Math.round(2/dt);i++)brush.update(dt,{x:8,y:0,z:0},{x:0,z:0});
    assert.deepEqual(poses.at(-1),[0,0,false]);brush.clear(0,0,1);const cleared=poses.length;
    brush.update(dt,{x:0,y:0,z:0},{x:2,z:0},()=>shed++);assert.equal(poses.length,cleared);assert.equal(poses.at(-1)[2],true);
    return peak;
  }
  assert.ok(Math.abs(pass(1/30)-pass(1/120))<.035);
});

test('the leaning bole, swinging trunk and loose cut sections have solid Rapier contacts',async()=>{
  await R.init(); const world=new R.World({x:0,y:-9.81,z:0});
  try{
    world.createCollider(R.ColliderDesc.cuboid(15,.12,15).setTranslation(0,-.12,0));
    const tree={x:0,y:0,z:0};
    tree.hull=trunkHull(tree,(h,p)=>{p.set(.08*h,h,0);return .4-.018*h;},9);
    const standing=plantTrunk(world,R,tree);world.step();
    const ray=(x,y,z,dx,dy,dz)=>world.castRay(new R.Ray({x,y,z},{x:dx,y:dy,z:dz}),20,true);
    assert.equal(ray(.66,8,2,0,0,-1).collider.handle,standing.handle);
    world.removeCollider(standing,true);const fall=fallingTrunk(world,R,tree);
    fall.setNextKinematicRotation({x:Math.sin(Math.PI/4),y:0,z:0,w:Math.cos(Math.PI/4)});world.step();
    assert.equal(ray(.4,4,5,0,-1,0).collider.parent().handle,fall.handle);world.removeRigidBody(fall);
    const mesh=new THREE.Mesh(),r=.24;placeSection(mesh,3,1,1,0,1.65,r,()=>0,true);
    const log=sectionBody(world,R,mesh,r,1.65,1,0,true),start=log.translation();
    for(let i=0;i<180;i++)world.step();
    const end=log.translation();assert.ok(end.y>.21&&end.y<.27);assert.ok(Math.hypot(end.x-start.x,end.z-start.z)>.016);
    assert.equal(ray(end.x,2,end.z,0,-1,0).collider.parent().handle,log.handle);
    world.removeRigidBody(log);world.step();assert.equal(ray(end.x,2,end.z,0,-1,0).collider.parent(),null);
  }finally{world.free();}
});

test('the player capsule can climb the porch and return to sloping ground at each outpost',async()=>{
  await R.init();
  for(let i=0;i<3;i++){
    const world=new R.World({x:0,y:-9.81,z:0}),half=15,cells=30,heights=new Float32Array((cells+1)**2);
    const ground=(x,z)=>-.105*z+.025*x+.07*Math.sin(x+z*.4);
    for(let col=0;col<=cells;col++)for(let row=0;row<=cells;row++)heights[row+col*(cells+1)]=ground(col-half,row-half);
    world.createCollider(R.ColliderDesc.heightfield(cells,cells,heights,{x:2*half,y:1,z:2*half}));
    const home=createOutpostHouse({}, {x:0,y:0,z:0},ground,i,{makePaint:()=>new THREE.MeshBasicMaterial()});
    for(const c of home.colliders)world.createCollider(houseCollider(R,c));
    const x=home.dropoff.x,z=home.spec.d/2+7;
    const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x,ground(x,z)+.95,z));
    const capsule=world.createCollider(R.ColliderDesc.capsule(.62,.28),body),walk=world.createCharacterController(.02);
    walk.enableAutostep(.3,.12,false);walk.enableSnapToGround(.45);world.step();
    function reach(dest){
      for(let j=0;j<330;j++){
        const p=body.translation(),dz=Math.max(-.045,Math.min(.045,dest-p.z));
        walk.computeColliderMovement(capsule,{x:0,y:-.025,z:dz});
        const d=walk.computedMovement();body.setNextKinematicTranslation({x:p.x+d.x,y:p.y+d.y,z:p.z+d.z});world.step();
      }return body.translation().z;
    }
    try{assert.ok(reach(home.spec.d/2-.82)<home.spec.d/2-.65,home.spec.name+' crosses the threshold');
      assert.ok(reach(z)>z-.2,home.spec.name+' returns to the trail');}finally{world.free();}
  }
});

test('all three porch cutaways frame before entry, keep a screen-relative walk and blend out',()=>{
  const cam=new THREE.PerspectiveCamera(42,1.6,.1,100),zero=new THREE.Vector3();
  for(let i=0;i<3;i++){
    const home=createOutpostHouse({},zero,()=>0,i,{makePaint:()=>new THREE.MeshBasicMaterial()}),p=home.dropoff;
    const side=home.updateInterior(.016,{x:p.x+1.6,y:.12,z:p.z-.7},cam);assert.equal(side.camera,null);
    const threshold=home.updateInterior(.016,{x:p.x,y:.12,z:p.z-.5},cam);assert.ok(threshold.camera);assert.equal(threshold.inside,false);
    const follow=new Follow(cam);follow.yaw=.2;cam.position.set(-2,1.7,5);cam.lookAt(0,1.5,0);const before=cam.quaternion.clone();
    follow.interior=threshold.camera;follow.update(1/60,zero,{x:0,y:0},0,()=>null,()=>0);
    assert.ok(before.angleTo(cam.quaternion)<.22);
    for(let j=0;j<140;j++)follow.update(1/60,zero,{x:0,y:0},0,()=>null,()=>0);
    assert.ok(cam.position.y>6);assert.ok(Math.cos(follow.movementYaw)<-.92);
    const endRotation=cam.quaternion.clone();follow.interior=null;follow.update(1/60,zero,{x:0,y:0},0,()=>null,()=>0);
    assert.ok(endRotation.angleTo(cam.quaternion)<.27);
  }
});
