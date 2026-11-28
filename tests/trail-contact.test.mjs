import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import R from '../src/figure/rapier/rapier.mjs';
import {Player} from '../src/figure/player.js';
import {TrailContact} from '../src/figure/trail-contact.js';
import {Animator} from '../src/figure/animator.js';
import {brushContacts} from '../src/world/brush-contact.js';
import {character} from './helpers/character.mjs';
import {BARK_GROUPS,TRUNK_GROUPS} from '../src/world/woodland-physics.js';

await R.init();
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function scene(){
  const world=new R.World(v()),player=new Player({world,RAPIER:R,spawn:v()});
  world.createCollider(R.ColliderDesc.cuboid(6,.10,6).setTranslation(0,-.10,0));
  return {world,player};
}
test('a palm probe reaches the actual bark through its coarse trunk collider, sensors and moving timber',()=>{
  const {world,player}=scene();
  try{
    const post=x=>R.ColliderDesc.cuboid(.025,1,.8).setTranslation(x,1,0);
    const jamb=world.createCollider(post(.53).setCollisionGroups(BARK_GROUPS));
    world.createCollider(post(.41).setCollisionGroups(TRUNK_GROUPS));
    world.createCollider(post(.33).setSensor(true));
    world.createCollider(post(.39),world.createRigidBody(R.RigidBodyDesc.dynamic()));
    world.createCollider(post(.44),world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()));
    world.step();
    const h=player.handSurface(v(0,1.16,0),v(1),.64);
    assert.equal(h.id,jamb.handle);assert.ok(Math.abs(h.point.x-.505)<.001);
    assert.ok(h.normal.x<-.99);assert.equal(player.handSurface(v(0,1.16,0),v(1),.42),null);
  }finally{world.free();}
});

test('both hands meet the correct wall at walking pace, protect an occupied grip and release on command',()=>{
  for(const sign of [-1,1])for(const hz of [30,60,120]){
    const {player,world}=scene(),man=character(),contact=new TrailContact(),side=sign>0?'l':'r';
    const anim=Object.assign(Object.create(Animator.prototype),{object:man.object,bones:man.bones});
    const rest=Object.values(man.bones).map(b=>[b,b.quaternion.clone()]);
    world.createCollider(R.ColliderDesc.cuboid(.05,1,3).setTranslation(sign*.49,1,0));world.step();
    const dt=1/hz;let gap=1,first,held=0;
    try{
      for(let i=0;i<hz;i++){
        player.prevFeet.copy(player.feet);player.feet.z+=.8*dt;player.actualSpeed=.8;
        man.object.position.copy(player.feet);
        for(const [bone,q] of rest)bone.quaternion.copy(q);
        man.object.updateMatrixWorld(true);
        contact.sense(dt,player,{},false,true,true);
        contact.posture(man,anim);
        const tool={leftWeight:0,rightWeight:0};
        if(i<hz/4)tool[side==='l'?'leftWeight':'rightWeight']=1;
        contact.hand(dt,man,anim,tool);
        if(i<hz/4)assert.equal(contact.plant,null);
        if(contact.plant&&!contact.plant.leaving){
          if(!first)first=contact.plant.point.clone();
          if(contact.plant.point.equals(first))held+=dt;
          if(contact.palmWeight>.8){
            const hand=man.bones['hand_'+side].localToWorld(v(0,.075,.015));
            gap=Math.min(gap,hand.distanceTo(contact.plant.point));
          }
        }
      }
      assert.equal(contact.pick.side,side);assert.ok(gap<.055,`palm gap ${gap} at ${hz} Hz`);
      assert.ok(held>.27,'the hand stays on one spot as the body passes');
      assert.ok(man.object.position.distanceTo(player.feet)<.00001);
      contact.sense(dt,player,{},false,false,true);assert.equal(contact.plant,null);assert.equal(contact.weight,0);
    }finally{world.free();}
  }
});

test('the head responds to a leaf cluster in its path and settles when it is cleared or left indoors',()=>{
  const {player,world}=scene(),contact=new TrailContact(),forward=player.facing();
  const plant={x:.25,y:0,z:.37,radius:1,height:2,crowns:[{x:.25,y:1.58,z:.37,r:.5}]};
  const brush=brushContacts([plant],()=>{});world.step();
  try{
    assert.equal(brush.nearCrown(player.feet,forward).plant,plant);
    for(let i=0;i<30;i++)contact.sense(1/60,player,brush,false,true,true);
    assert.equal(contact.pick.kind,'leaves');assert.ok(contact.weight>.98);
    assert.equal(contact.scan(player,brush,true),null);
    plant.crowns[0].y=2.65;assert.equal(brush.nearCrown(player.feet,forward),null);
    plant.crowns[0].y=1.58;brush.clear(.25,.37,.5);
    for(let i=0;i<60;i++)contact.sense(1/60,player,brush,false,true,true);
    assert.equal(contact.pick,null);assert.equal(contact.weight,0);
  }finally{world.free();}
});

test('a walkable step raises only the swinging foot and tilts the torso ahead without moving the player',()=>{
  const {world,player}=scene(),contact=new TrailContact();
  world.createCollider(R.ColliderDesc.cuboid(.66,.112,.4).setTranslation(0,.112,.67));world.step();
  try{
    for(let i=0;i<35;i++)contact.sense(1/60,player,{},false,true,true);
    assert.ok(contact.grade>.20&&contact.grade<.23);assert.equal(contact.pick,null);
    const lifts=[],bends=[];
    contact.posture({bones:{},object:new THREE.Group()},{feetInfo:{l:{pinned:true,lift:.12},r:{pinned:false,lift:.21}},
      legIK:(side,delta)=>lifts.push([side,delta.y]),rotateWorld:(b,axis,a)=>bends.push(a)});
    assert.equal(lifts.length,1);assert.equal(lifts[0][0],'r');assert.ok(lifts[0][1]>.06&&lifts[0][1]<.11);
    assert.ok(bends[0]>.10);assert.deepEqual(player.feet.toArray(),[0,0,0]);
    for(let i=0;i<60;i++)contact.sense(1/60,player,{},false,true,false);
    assert.ok(contact.grade<.001);
  }finally{world.free();}
});
