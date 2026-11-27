import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import R from '../src/figure/rapier/rapier.mjs';
import {AXES,TREES,freshState,sanitize} from '../src/economy.js';
import {WINDTHROW_HEALTH,awardWork,logCut,ensureOrder,orderInfo,skillProgress,xpAt} from '../src/woodcutting.js';
import {strokePower} from '../src/woodland.js';
import {Endurance} from '../src/effort.js';
import {HeldAxe} from '../src/figure/held-axe.js';
import {facesWork,looseAim,openAim,waterContact,nudgeSection} from '../src/world/axe-contact.js';
import {riverCenter} from '../src/world/river.js';
import {sectionBody,placeSection} from '../src/world/woodland-physics.js';
import {brushContacts} from '../src/world/brush-contact.js';

function fell(s,type,heavy=false){
  const maximum=TREES[type].health,power=strokePower(s,{type},AXES[s.axe].power,heavy);
  let hits=0,hp=maximum,earned=0;
  while(hp>0){
    const after=hp<=power+.0001?0:hp-power;
    const event=awardWork(s,{type,maximum,before:hp,after});
    earned+=event.xp;hits++;hp=after;
  }
  return {hits,earned};
}
test('full equipment leaves multiple useful cuts on every species and a real advantage on tough wood',()=>{
  const novice=freshState(),master=freshState();master.axe=4;master.woodland.edge=true;
  assert.deepEqual(fell(novice,1),{hits:5,earned:42});
  for(const [type,hits] of [[1,3],[0,4],[3,5],[2,7]])assert.deepEqual(fell(master,type),{hits,earned:TREES[type].xp});
  assert.equal(fell(master,2,true).hits,6);
  assert.equal(Math.ceil(WINDTHROW_HEALTH/strokePower(master,{windthrow:true},4.8,true)),3);
});
test('levels, precision bonuses, figure bonuses and a repeatable order each use real work',()=>{
  const s=freshState(),book=s.woodcutting;
  assert.equal(skillProgress(91).level,1);assert.equal(skillProgress(92).level,2);
  assert.equal(xpAt(99),890291);assert.equal(skillProgress(xpAt(99)+85).fraction,1);
  assert.equal(awardWork(s,{type:1,maximum:9,before:4,after:4}),null);
  book.xp=xpAt(5);ensureOrder(s);
  assert.equal(book.order.key,'birch');const order=orderInfo(book.order);
  for(let i=0;i<order.goal;i++)fell(s,1);
  assert.equal(book.orders,1);assert.equal(book.xp,xpAt(5)+order.goal*42+order.reward);assert.equal(book.order.key,'lengths');
  assert.equal(book.species[1],4);assert.equal(book.strokes,20);
  const count=book.strokes;
  for(let i=0;i<3;i++)awardWork(s,{type:1,split:true});
  assert.equal(book.bucked,3);assert.equal(book.strokes,count+3);assert.equal(book.orders,2);
  book.xp=xpAt(35);const a=awardWork(s,{type:2,maximum:36,before:4,after:0,precise:true,figured:true});
  const b=awardWork(s,{type:2,maximum:36,before:4,after:0});
  assert.equal(a.xp-b.xp,63);
});
test('a legacy camp is credited once and split lengths, active notches and the order survive a save',()=>{
  const s=sanitize({felled:11,axe:4,wood:300});assert.equal(s.woodcutting.xp,286);
  const book=s.woodcutting;book.xp=xpAt(20);ensureOrder(s);book.order.done=2;
  book.cuts[7]={hp:4.5,x:9,y:1.3,z:6,nx:0,nz:1};
  book.splits[9]={until:Date.now()+60000,mask:5};
  const loaded=sanitize(JSON.parse(JSON.stringify(s)));assert.deepEqual(loaded.woodcutting,book);
  assert.equal(loaded.wood,300);assert.equal(loaded.axe,4);
});
test('loose timber awards each increment once and restores partly cut work across reloads',()=>{
  let s=freshState();const tree={id:14,type:0,regrow:Date.now()+85000},part={length:1.7,sourceIndex:1,hits:1};
  assert.equal(logCut(s,tree,part).xp,6);assert.equal(logCut(s,tree,part),null);
  s=sanitize(JSON.parse(JSON.stringify(s)));part.hits=3;
  assert.equal(logCut(s,tree,part).xp,12);assert.equal(s.woodcutting.bucked,1);
  assert.equal(s.woodcutting.strokes,2);assert.equal(logCut(s,tree,part),null);
  assert.equal(logCut(s,tree,{...part,sourceIndex:null}),null);assert.equal(s.woodcutting.xp,18);
});
test('the edge hits the nearest solid, excludes the player and can turn the end of a loose log',async()=>{
  await R.init();const world=new R.World({x:0,y:-9.81,z:0});
  try{
    const own=world.createCollider(R.ColliderDesc.ball(.20).setTranslation(0,1,0));
    const post=world.createCollider(R.ColliderDesc.cuboid(.16,.3,.08).setTranslation(0,1,.5));
    world.createCollider(R.ColliderDesc.cylinder(.65,.24).setTranslation(0,1,1.10));world.step();
    const a=new THREE.Vector3(0,1,0),b=new THREE.Vector3(0,1,1.3);
    const tool=new HeldAxe(world,R,own),q=new THREE.Quaternion();
    tool.solve(a,q,0,1/60);assert.equal(tool.solve(b,q,0,1/60).contact.collider.handle,post.handle);
    assert.equal(tool.solve(new THREE.Vector3(0,1,-1),q,0,1/60).contact,null);
    const mesh=new THREE.Mesh(),length=1.7,radius=.22;
    placeSection(mesh,5,2,1,0,length,radius,()=>0,false);
    const body=sectionBody(world,R,mesh,radius,length,0,0,false),part={mesh,body,length,radius};
    const feet={x:5.65,y:0,z:1.04},timber=looseAim([{type:1,sections:[part]}],feet,0,.6);
    assert.equal(timber.part,part);nudgeSection(part,timber.point,0,true,3);
    assert.ok(body.linvel().z>.1);assert.ok(Math.abs(body.angvel().y)>.1);
    assert.equal(facesWork({x:feet.x,z:0},feet,0,0),false);assert.equal(openAim(feet,0,.90).y<.05,true);
    const stem={x:0,y:0,z:.7,radius:.35,height:1.7};const scrub=brushContacts([stem],()=>{});
    assert.equal(scrub.strike(a,b).plant,stem);scrub.update(1/30,null,{x:0,z:0});assert.ok(stem.bendZ>.01);
    const x=riverCenter(0),surface=waterContact(new THREE.Vector3(x,1.2,0),new THREE.Vector3(x,.03,0),()=>0);
    assert.ok(Math.abs(surface.y-.74)<1e-8);
  }finally{world.free();}
});
test('pack weight changes the cost of jumping and sprinting, with recovery and an exhaustion threshold',()=>{
  const fresh=new Endurance(),loaded=new Endurance();
  assert.ok(fresh.takeOff(0)&&loaded.takeOff(1));assert.equal(fresh.value,87);assert.equal(loaded.value,82);
  fresh.update(.5);assert.equal(fresh.value,87);
  loaded.update(15,{sprinting:true,moving:true,load:1});assert.equal(loaded.value,0);assert.equal(loaded.takeOff(0),false);
  loaded.update(1.5,{resting:true});assert.ok(loaded.value>0&&loaded.exhausted);
  loaded.update(1,{resting:true});assert.ok(!loaded.exhausted&&loaded.takeOff(0));loaded.replenish();assert.equal(loaded.value,100);
});
