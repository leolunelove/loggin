import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import R from '../src/figure/rapier/rapier.mjs';
import {updateTimberDrops} from '../src/figure/timber-lift.js';
import {createForest} from '../src/world/forest.js';
import {FallenTree} from '../src/world/fallen-tree.js';
import {Player} from '../src/figure/player.js';
import {findCrossing} from '../src/figure/timber-crossing.js';
import {HINGE} from '../src/world/fallen-wood.js';
import {readSkill} from '../src/woodcutting.js';
import {freshState,sanitize,depositWood} from '../src/economy.js';
import {AWAITING_COLLECTION,CARRY_LENGTH,timberAmount,timberLeft,layoutCuts} from '../src/timber-harvest.js';
import {commitPickup,pickupTarget,withinPickupReach} from '../src/world/gather.js';

await R.init();
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const forest=createForest({}),tree=forest.trees.find(t=>t.hero);
const mark={x:tree.x,y:tree.y+1.17,z:tree.z+tree.r,nx:0,nz:1,angle:.6,damage:.4};
forest.carveTree(tree,{...mark,notches:[mark]},0,1,.4);
const wood=forest.fallenWood(tree);
function fixture(extra={},treeModel=tree,woodModel=wood){
  const physics=new R.World(V(0,-9.81,0)),scene=new THREE.Scene();
  const game={RAPIER:R,physics,scene,forest,cutPaint:new THREE.MeshBasicMaterial()};
  const record={until:Date.now()+90000,bearing:.32,mask:0,...extra};
  const fallen=new FallenTree(game,treeModel,woodModel,record);
  return {game,record,fallen,close(){fallen.dispose();physics.free();game.cutPaint.dispose();}};
}
function worldPoint(part,at,radial=0){
  return wood.centre(at).add(V(radial,0,0)).sub(part.rest).applyQuaternion(part.body.rotation()).add(part.body.translation());
}
const pigments=p=>p.mesh.children.filter(m=>m.geometry?.isInstancedBufferGeometry).reduce((n,m)=>n+m.geometry.instanceCount,0);

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

test('traversal uses the settled bole at the approached station, skips moving or carried wood and survives a reload',()=>{
  const birch=forest.trees.find(t=>t.type===1),birchWood=forest.fallenWood(birch);
  const {fallen,game,record,close}=fixture({},birch,birchWood);
  function approach(f){
    const world=f.game.physics,[part]=f.parts,station=part.lo+.95;
    const centre=f.worldPoint(part,f.wood.centre(station)),radius=f.wood.radius(station);
    world.createCollider(R.ColliderDesc.cuboid(6,.1,6).setTranslation(centre.x,centre.y-radius-.1,centre.z));
    const spawn=centre.clone().add(V(0,-radius,-1.10)),want={dir:V(0,0,1),mag:1,speed:4};
    const player=new Player({RAPIER:R,world,spawn,animator:{phase:.15}});
    world.step();return ()=>findCrossing(player,want,false);
  }
  try{
    fallen.begin(0,true);const [part]=fallen.parts;
    fallen.fall(1.5,true);
    part.body.setRotation(new THREE.Quaternion().setFromAxisAngle(V(0,0,1),-Math.PI/2),true);
    part.body.setLinvel(V(),true);part.body.setAngvel(V(),true);part.body.sleep();
    const plan=approach(fallen),first=plan();assert.equal(first?.kind,'vault');
    assert.equal(first.collider,part.trunk);assert.ok(first.palm.distanceTo(part.skin.projectPoint(first.palm,false).point)<.005);
    part.body.setLinvel(V(.8,0,0),true);assert.equal(plan(),null);
    part.body.setLinvel(V(),true);part.body.sleep();part.inFlight=true;assert.equal(plan(),null);part.inFlight=false;
    fallen.snapshot();
    const restored=fixture(JSON.parse(JSON.stringify(record)),birch,birchWood);
    try{
      restored.fallen.begin(1.5,false);const next=approach(restored.fallen)();
      assert.equal(next?.kind,'vault');assert.ok(next.palm.distanceTo(first.palm)<.008);
    }finally{restored.close();}
    assert.equal(game.physics.getCollider(first.collider.handle),part.trunk);
  }finally{close();}
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

const unpaid=amount=>({until:AWAITING_COLLECTION,harvest:{yield:amount,limbed:[],taken:[]}});

test('one edge hit frees only its branch, paint and shadow while keeping the trunk body and the rest of the crown',()=>{
  const {fallen,game,record,close}=fixture(unpaid(14));
  try{
    fallen.begin(1.48,false);const [part]=fallen.parts,body=part.body,before=pigments(part),beforeColliders=body.numColliders();
    const [branch]=part.limbs.keys(),count=part.limbs.size,casters=part.shadow.children[1].count;
    assert.equal(fallen.branchNear(part,branch.path[1]).limb,branch);
    const expired=part.skin,collars=[...part.limbs.get(branch)];
    assert.equal(fallen.cutBranch(part,branch,V(.7,0,0)),true);
    assert.equal(fallen.cutBranch(part,branch,V(0,1,0)),false);
    assert.equal(fallen.parts[0].body,body);assert.deepEqual(record.harvest.limbed,[branch.id]);
    assert.equal(part.limbs.size,count-1);assert.ok(collars.every(c=>!c.isValid()));assert.ok(!expired.isValid());
    assert.equal(body.numColliders(),beforeColliders-collars.length);
    const b=fallen.brush[0];assert.ok(b.body.isDynamic());assert.equal(pigments(part)+pigments(b),before);
    assert.equal(part.shadow.children[1].count+b.shadow.children[1].count,casters);
    game.time=8;fallen.sync();assert.equal(fallen.brush.length,0);assert.ok(!b.body.isValid());
  }finally{close();}
});

test('a packed span cannot regrow or pay twice, and a short piece with a branch still needs limbing',()=>{
  const {fallen,game,record,close}=fixture(unpaid(22));
  try{
    const id=tree.id=85;tree.fallen=fallen;game.state=freshState();game.state.woodcutting.splits[id]=record;
    game.state.down[id]=tree.regrow=record.until;game.renderHud=()=>{};game.save=()=>{};game.shade={refresh(){}};
    fallen.begin(1.53,false);assert.equal(fallen.available(fallen.parts[0]),null);
    const stations=layoutCuts(HINGE,wood.top);
    for(const at of stations){
      const piece=fallen.parts.find(p=>at>p.lo&&at<p.hi);
      assert.equal(fallen.cut(piece,worldPoint(piece,at,wood.radius(at)),2).hits,2);
      assert.equal(fallen.cut(piece,worldPoint(piece,at,wood.radius(at)),1).hits,3);
    }
    assert.ok(fallen.parts.every(p=>p.length<=CARRY_LENGTH+.001));
    const blocked=fallen.parts.find(p=>p.limbs.size);assert.equal(fallen.available(blocked),null);
    const first=fallen.parts[0],value=fallen.available(first),target={part:first,amount:value,hard:true};assert.ok(value>0);
    game.state.carried=24;assert.equal(commitPickup(game,target),null);assert.equal(fallen.parts[0],first);assert.equal(record.harvest.taken.length,0);
    game.state.carried=0;
    const mesh=commitPickup(game,target);assert.equal(mesh,first.mesh);mesh.removeFromParent();
    assert.equal(commitPickup(game,target),null);assert.equal(game.state.carriedHardwood,value);
    const saved=sanitize(JSON.parse(JSON.stringify(game.state)));
    assert.equal(saved.down[id],AWAITING_COLLECTION);assert.equal(saved.woodcutting.splits[id].until,AWAITING_COLLECTION);
    const copy=fixture(saved.woodcutting.splits[id]);
    try{
      copy.fallen.begin(1.5,false);
      assert.ok(!copy.fallen.parts.some(p=>p.lo===first.lo&&p.hi===first.hi));
      assert.equal(copy.fallen.parts.length,fallen.parts.length);
    }finally{copy.close();}
    for(const part of [...fallen.parts]){
      for(const branch of [...part.limbs.keys()])assert.ok(fallen.cutBranch(part,branch,V(0,1,0)));
      const amount=fallen.available(part);assert.notEqual(amount,null);
      assert.ok(commitPickup(game,{part,amount,hard:true}));
    }
    assert.equal(game.state.carried,22);assert.equal(game.state.total,22);assert.equal(game.state.carriedHardwood,22);
    assert.equal(timberLeft(record.harvest,wood.top),0);assert.ok(tree.regrow>Date.now());
    assert.equal(fallen.parts.length,0);assert.equal(depositWood(game.state),22);assert.equal(game.state.hardwood,22);assert.equal(game.state.shed,0);
  }finally{delete tree.fallen;close();}
});

test('minimum-length cuts and their collected offcuts survive subsequent cuts and a reload',()=>{
  const {fallen,record,close}=fixture(unpaid(8));
  try{
    fallen.begin(1.45,false);
    for(let i=0;i<6;i++){
      const long=fallen.parts.find(p=>p.hi===wood.top);
      assert.equal(fallen.cut(long,worldPoint(long,long.lo+.02),3).hits,3);
      const offcut=fallen.parts.find(p=>p.lo===long.lo);
      assert.ok(Math.abs(offcut.length-.45)<1e-5);
      const mesh=fallen.take(offcut);assert.ok(mesh);mesh.removeFromParent();
    }
    fallen.snapshot();const copy=fixture(readSkill({splits:{1:record}}).splits[1]);
    try{
      copy.fallen.begin(1.49,false);
      assert.deepEqual(copy.fallen.parts.map(p=>[p.lo,p.hi]),fallen.parts.map(p=>[p.lo,p.hi]));
      assert.equal(copy.record.harvest.taken.length,6);
    }finally{copy.close();}
  }finally{close();}
});

test('a log can be lifted from its near side but a wall blocks both targeting and the grasp',()=>{
  const {game,fallen,close}=fixture(unpaid(8));
  try{
    fallen.begin(Math.PI/2,false);const [stock]=fallen.parts;
    fallen.cut(stock,worldPoint(stock,HINGE+1.30),3);
    const butt=fallen.parts[0],origin=V().copy(butt.body.translation());
    const perpendicular=V(0,1,0).applyQuaternion(butt.body.rotation()).cross(V(0,1,0)).normalize();
    const feet=origin.clone().addScaledVector(perpendicular,butt.radius+1.0);feet.y=origin.y-.22;
    game.player={feet};game.follow={yaw:Math.atan2(origin.x-feet.x,origin.z-feet.z)};
    game.looseTimber=[{fallen,sections:fallen.parts,type:0}];game.physics.step();
    const target=pickupTarget(game);assert.ok(target?.part===butt,'the unobstructed butt log should be reachable');assert.ok(withinPickupReach(game,target));
    const mid=origin.clone().addScaledVector(perpendicular,butt.radius+.50);
    game.physics.createCollider(R.ColliderDesc.cuboid(.17,1.4,.17).setTranslation(mid.x,mid.y+.45,mid.z));
    game.physics.step();assert.ok(!pickupTarget(game),'the wall should occlude the wood');assert.equal(withinPickupReach(game,target),false);
  }finally{close();}
});

test('free cuts divide upgraded yields exactly and old paid timber stays ineligible',()=>{
  for(const total of [8,14,22,51,112]){
    const harvest=unpaid(total).harvest,ends=[HINGE,1.27,3.44,4.01,6.03,8.18,8.65,11.22,wood.top];
    const pieces=ends.slice(1).map((hi,i)=>[ends[i],hi]);
    assert.equal(pieces.reduce((sum,[lo,hi])=>sum+timberAmount(harvest,wood.top,lo,hi),0),total);
    harvest.taken=pieces.filter((_,i)=>i%2);
    assert.equal(timberLeft(harvest,wood.top),pieces.filter((_,i)=>!(i%2)).reduce((n,[a,b])=>n+timberAmount(harvest,wood.top,a,b),0));
  }
  const old=fixture({mask:2,scores:[1,0,0]});
  try{old.fallen.begin(1.49,false);assert.ok(old.fallen.parts.every(p=>old.fallen.available(p)===null));}finally{old.close();}
});

test('a finished round follows the moving pack, reserves its space and only pays on arrival',()=>{
  const {game,fallen,record,close}=fixture(unpaid(12));
  try{
    fallen.begin(Math.PI/2,false);const long=fallen.parts[0];
    fallen.cut(long,worldPoint(long,HINGE+1.30),3);
    const part=fallen.parts[0],origin=V().copy(part.body.translation()),mesh=part.mesh,parent=mesh.parent;
    const axis=V(0,1,0).applyQuaternion(part.body.rotation()),near=axis.cross(V(0,1,0)).normalize();
    const feet=origin.clone().addScaledVector(near,part.radius+.94);feet.y=origin.y-.22;
    const pack=new THREE.Group();pack.position.copy(feet).y+=.87;game.scene.add(pack);
    let caught=0,saved=0;
    Object.assign(game,{player:{feet},figure:{pack:{group:pack,catchWood:()=>caught++}},audio:{stack(){}},
      looseTimber:[{fallen,sections:fallen.parts,type:0}],state:freshState(),time:2,save:()=>saved++,renderHud(){},shade:{refresh(){}}});
    game.physics.step();const count=fallen.available(part);assert.ok(count>0);
    game.state.carried=24;const tick=(active=true)=>{game.time+=1/60;updateTimberDrops(game,1/60,active);};
    for(let n=0;n<12;n++)tick();
    assert.equal(game.timberDrops.length,0);assert.equal(mesh.parent,parent);
    game.state.carried=24-count;
    for(let n=0;n<12;n++)tick();
    assert.equal(game.timberDrops[0].mesh,mesh);assert.equal(part.inFlight,true);
    assert.equal(part.body.isEnabled(),false);assert.equal(part.shadow.visible,false);
    assert.equal(game.state.carried,24-count);assert.deepEqual(record.harvest.taken,[]);
    fallen.snapshot();assert.ok(record.pieces.some(row=>row[0]===part.lo&&row[1]===part.hi));
    tick(false);assert.equal(part.inFlight,false);assert.equal(mesh.parent,parent);assert.equal(part.body.isEnabled(),true);
    assert.equal(saved,0);assert.deepEqual(record.harvest.taken,[]);
    for(let n=0;n<14;n++)tick();
    const flight=game.timberDrops[0];pack.position.x+=.25;feet.x+=.25;tick();
    assert.ok(flight.lastRim.distanceTo(pack.localToWorld(V(.02,.55,0)))<.001);
    for(let n=0;n<75;n++)tick();
    assert.equal(caught,1);assert.equal(saved,1);assert.equal(game.state.carried,24);
    assert.deepEqual(record.harvest.taken,[[part.lo,part.hi]]);assert.ok(!fallen.parts.includes(part));
  }finally{close();}
});
