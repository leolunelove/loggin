import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cartCapacity,advanceHaul,connected,contributeLocal,figuredTree,hireHauler,noteFreight,packedLunch,PROJECT,recoveryAge,strokePower,useSpecialty} from '../src/woodland.js';
import {freshState,depositWood,sanitize} from '../src/economy.js';
import {Player} from '../src/figure/player.js';
import {readSave,writeSave,reviewStorage} from '../src/save.js';
import {Lumberjack} from '../src/game.js';
import {buildTrail} from '../src/world/trail.js';
import {createFieldwork} from '../src/world/fieldwork.js';
import {commitPickup} from '../src/world/gather.js';
import {woodcraft} from '../src/world/woodcraft.js';
import {dabGeometry,dabMesh} from '../src/oilpaint/dabs.js';
import {nearTile,tileDabs,VIEW_RANGE} from '../src/world/forest-distance.js';

const restored = {found:true,wood:24,planks:8,trail:40};
function fullCamp(){
  const s=Object.assign(freshState(),{wood:240,hardwood:31,planks:70,shed:40,axe:2,seed:582});
  s.places.forEach(p=>Object.assign(p,restored));return s;
}
test('old camps retain balances and gain initial woodland, clothes and collection records',()=>{
  const old=sanitize({wood:87,hardwood:32,planks:13,seed:587,appearance:{hat:2,skin:1}});
  assert.deepEqual([old.wood,old.hardwood,old.planks,old.seed],[87,32,13,587]);
  assert.equal(old.appearance.hat,2);assert.equal(old.appearance.headwear,0);
  assert.deepEqual(old.woodland.sections,[0,0,0,0,0]);assert.deepEqual(old.woodland.looseSections,[0,0,0,0,0]);assert.equal(old.woodland.cart.built,false);
  const w=old.woodland;Object.assign(w,{reserved:[2,2,13,-2],finds:['kiln','bad'],sections:[1,2,27],edge:true});
  Object.assign(w.cart,{built:true,hired:true,running:true,route:2,progress:.34,x:2,z:15,load:82});
  old.appearance.workwear=2;const saved=sanitize(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(saved.woodland.reserved,[2,13]);assert.deepEqual(saved.woodland.finds,['kiln']);
  assert.deepEqual(saved.woodland.sections,[1,2,3,0,0]);assert.deepEqual(saved.woodland.cart,w.cart);
  assert.equal(saved.appearance.workwear,2);
});
test('running the development review cannot spend a player’s existing stock',()=>{
  const map=new Map(),store={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const s=fullCamp();writeSave(store,s);
  const review=reviewStorage(store);assert.equal(readSave(review).status,'new');
  s.wood=2;writeSave(review,s);assert.equal(readSave(review).state.wood,2);assert.equal(readSave(store).state.wood,240);
});
test('the first cart needs a completed connection and spends eight planks only once',()=>{
  const s=fullCamp();s.places[1].trail=39;
  assert.equal(connected(s.places[1]),false);assert.equal(useSpecialty(s,1,'cart'),false);
  assert.ok(useSpecialty(s,0,'cart'));assert.equal(useSpecialty(s,2,'cart'),false);
  assert.equal(cartCapacity(s),192);assert.equal(s.planks,62);
  assert.ok(hireHauler(s));assert.equal(hireHauler(s),false);assert.equal(s.wood,224);
  assert.ok(useSpecialty(s,2,'axle'));assert.equal(useSpecialty(s,2,'axle'),false);
  assert.equal(cartCapacity(s),288);assert.equal(s.planks,56);assert.equal(s.hardwood,31);
});
test('loads credit the common stock on deposit and can travel repeatedly without a second credit',()=>{
  let s=fullCamp();useSpecialty(s,0,'cart');hireHauler(s);
  Object.assign(s,{carried:210,carriedHardwood:11});noteFreight(s,1,depositWood(s));
  const balance=s.wood,hard=s.hardwood,c=s.woodland.cart;
  Object.assign(c,{running:true,returning:true,progress:.005,wait:0});
  const lengths=[80,100,120];
  assert.ok(advanceHaul(s,1,lengths));assert.equal(c.route,1);assert.equal(c.progress,0);
  assert.equal(advanceHaul(s,0,lengths),false);assert.equal(c.wait,3);
  advanceHaul(s,3,lengths);assert.ok(advanceHaul(s,70,lengths));
  assert.equal(c.load,192);assert.equal(s.woodland.freight[1],18);
  s=sanitize(JSON.parse(JSON.stringify(s)));advanceHaul(s,3,lengths);assert.ok(advanceHaul(s,70,lengths));
  assert.equal(s.woodland.cart.load,0);assert.equal(s.woodland.cart.route,1);
  advanceHaul(s,3,lengths);assert.ok(advanceHaul(s,70,lengths));assert.equal(s.woodland.cart.load,18);
  assert.deepEqual([s.wood,s.hardwood,s.woodland.freight[1]],[balance,hard,0]);
});
test('Orchard lunch uses camp time, survives midnight and only changes sprint speed',()=>{
  const s=fullCamp();s.hour=23;assert.equal(useSpecialty(s,1,'meal'),false);
  assert.ok(useSpecialty(s,0,'meal'));assert.equal(useSpecialty(s,0,'meal'),false);
  s.day++;s.hour=1.99;assert.ok(packedLunch(sanitize(s)));s.hour=2;assert.equal(packedLunch(s),false);
  const p=Object.create(Player.prototype);p.anim={setup:{speeds:{walk:1.45,run:5.3,sprint:7}}};
  const base={move:{x:0,y:1},device:'keyboard',strafe:true,trailBoost:true,provisioned:true};
  assert.equal(p.intent(base,0).speed,5.3*1.25);
  assert.ok(Math.abs(p.intent({...base,sprint:true},0).speed-7*1.25*1.16)<1e-8);
  assert.equal(p.intent({...base,cartSpeed:1.18,sprint:true},0).speed,1.18);
  assert.ok(useSpecialty(s,0,'meal'));
});
test('local plans, sites and stage costs are enforced through completion',()=>{
  for(const [key,p] of Object.entries(PROJECT)){
    const s=fullCamp();assert.equal(contributeLocal(s,(p.place+1)%3,key),false);
    if(p.clue){assert.equal(contributeLocal(s,p.place,key),false);s.woodland.finds.push(p.clue);}
    s.places[p.place].planks=7;assert.equal(contributeLocal(s,p.place,key),false);s.places[p.place].planks=8;
    const before=[s.wood,s.planks];
    for(let i=0;i<p.stages;i++)assert.ok(contributeLocal(s,p.place,key));
    assert.equal(contributeLocal(s,p.place,key),false);assert.equal(s.woodland.projects[key],p.stages);
    assert.deepEqual([s.wood,s.planks,s.hardwood],[before[0]-p.logs*p.stages,before[1]-p.planks*p.stages,31]);
  }
});
test('edge dressing and heavy strokes distinguish hardwood and fallen sections',()=>{
  const s=fullCamp(),oak={type:2,hero:true},wood={type:0},trunk={type:0,windthrow:true};
  assert.equal(useSpecialty(s,0,'edge'),false);assert.ok(useSpecialty(s,2,'edge'));assert.equal(useSpecialty(s,2,'edge'),false);
  assert.deepEqual([s.wood,s.hardwood,s.planks],[232,23,66]);
  assert.equal(strokePower(s,wood,2,true),2);assert.equal(strokePower(s,trunk,2,true),3.3);
  assert.equal(strokePower(s,oak,2,true),2*1.35*1.65);assert.equal(figuredTree(oak),true);assert.equal(figuredTree(wood),false);
  assert.equal(recoveryAge(90,45,90),.5);assert.equal(recoveryAge(90,100,90),1);
});
test('fire and a nearby keeper tree can each be selected at the starter clearing',()=>{
  const g=Object.create(Lumberjack.prototype),tree={x:0,z:1,r:.20,id:0,type:1};
  Object.assign(g,{player:{feet:{x:0,y:0,z:0}},home:{nearFire:()=>true,fire:{position:{x:1,z:.4}}},follow:{yaw:0},
    nearest:()=>({tree,distance:.8}),field:{canReserve:()=>true,sync(){}},state:fullCamp(),save(){},toast(){}});
  assert.equal(g.fireTakesFocus(),false);assert.equal(g.fieldKeyLabel(),'Reserve tree');
  assert.ok(g.useFieldKey());assert.equal(g.workAllowed(tree),false);assert.equal(g.fieldKeyLabel(),'Release tree');
  assert.ok(g.useFieldKey());assert.ok(g.workAllowed(tree));
  g.follow.yaw=Math.atan2(1,.4);assert.ok(g.fireTakesFocus());
});
test('the physical bridge, racks, remaining windthrow sections and trail surface match progression',()=>{
  const scene=new THREE.Scene(),home=new THREE.Group(),pos=[[ -30,35],[12,5],[-30,-40]],spec={w:6,d:5,h:3};
  home.position.set(0,0,80);const heightAt=(x,z)=>x*.016+z*.012;
  const sites=pos.map(([x,z])=>{const group=new THREE.Group();group.position.set(x,heightAt(x,z),z);return {group,spec};});
  const routes=sites.map(h=>buildTrail(home.position,h.group.position,spec,heightAt,new THREE.MeshBasicMaterial(),{}));
  const bodies=new Set(),collider=()=>({setTranslation(){return this;},setRotation(){return this;}});
  const g={scene,shared:{},state:fullCamp(),heightAt,forest:{trees:[]},home:{group:home},exploration:{sites,routes,clearAt(){}},
    RAPIER:{ColliderDesc:{cuboid:collider,cylinder:collider}},physics:{createCollider(d){bodies.add(d);return d;},removeCollider(d){bodies.delete(d);}}};
  const field=createFieldwork(g,woodcraft({}));field.sync();
  assert.equal(field.windthrows().length,5);assert.equal(bodies.size,15);
  const first=field.windthrows()[0];g.state.woodland.sections[0]=1;field.sync();
  assert.equal(first.g.visible,false);assert.equal(field.windthrows()[0].section,1);assert.equal(bodies.size,14);
  // A newly cut section stays at the site even after the next section becomes workable.
  g.state.woodland.looseSections[0]=1;g.state=sanitize(JSON.parse(JSON.stringify(g.state)));field.sync();
  assert.ok(first.ready&&first.g.visible);assert.equal(first.ring.visible,false);assert.ok(first.body);
  assert.ok(Math.hypot(first.g.position.x-first.x,first.g.position.z-first.z)>.22);
  assert.equal(field.windthrows()[0].section,1);assert.equal(bodies.size,15);
  const target={field:first,amount:5,hard:false};Object.assign(g,{field,shade:{refresh(){}},renderHud(){},save(){}});
  g.state.carried=62;assert.equal(commitPickup(g,target),null);assert.ok(first.ready);
  g.state.carried=0;assert.ok(commitPickup(g,target));assert.equal(g.state.carried,5);
  assert.equal(commitPickup(g,target),null);assert.equal(g.state.total,5);assert.equal(bodies.size,14);
  assert.equal(first.g.visible,false);assert.equal(g.state.woodland.looseSections[0],0);
  for(let n=1;n<=4;n++){
    assert.ok(contributeLocal(g.state,1,'bridge'));field.sync();field.sync();
    assert.equal(field.stageParts.filter(s=>s.key==='bridge'&&s.g.visible).length,n);assert.equal(bodies.size,14+6*n);
  }
  assert.equal(field.fieldAction(field.racks[0].g.position,g.state).type,'rack');
  const route=routes[1],clears=[];route.build(16,p=>clears.push(p));const count=clears.length;
  route.build(16,p=>clears.push(p));assert.equal(clears.length,count);route.build(40,p=>clears.push(p));
  assert.equal(clears.length,route.points.length);
  for(const f of [0,.25,.58,1]){const n=route.nearest(route.sample(f));assert.ok(n.distance<1e-7);assert.ok(Math.abs(n.progress-f)<1e-6);}
});
test('the canopy switches to painted distance tiles and tree changes patch the original tile',()=>{
  const source=dabMesh(dabGeometry(3,{aPos:[new Float32Array([0,2,0,3,4,1,95,2,0]),3],aMask:[new Float32Array([1,1,1]),1]}),new THREE.MeshBasicMaterial());
  const b=tileDabs(source);assert.equal(b.tiles.length,2);
  assert.ok(nearTile(b.tiles[0],{x:0,z:0},VIEW_RANGE.detailEnd));assert.equal(nearTile(b.tiles[0],{x:160,z:0},VIEW_RANGE.detailEnd),false);
  source.geometry.attributes.aMask.setX(1,0);b.sync(1,2);
  assert.deepEqual([...b.tiles[0].mesh.geometry.attributes.aMask.array],[1,0]);
  assert.deepEqual([...b.tiles[1].mesh.geometry.attributes.aMask.array],[1]);
});
