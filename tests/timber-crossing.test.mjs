import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import R from '../src/figure/rapier/rapier.mjs';
import {Player} from '../src/figure/player.js';
import {advanceCrossing,findCrossing} from '../src/figure/timber-crossing.js';
import {crossingPose,vaultPalm} from '../src/figure/crossing-pose.js';
import {Animator} from '../src/figure/animator.js';
import {ChopAnimation} from '../src/figure/chop.js';
import {character} from './helpers/character.mjs';

await R.init();
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function trail({angle=0,side=1,slope=0,speed=4.15,radius=.28,ground=true}={}){
  const world=new R.World(v(0,-9.81,0));
  const dir=v(Math.sin(angle),0,side*Math.cos(angle)),yaw=Math.atan2(dir.x,dir.z);
  const spawn=dir.clone().multiplyScalar(-1.05);spawn.y=slope*spawn.z;
  const g=new THREE.Group();g.rotation.y=Math.PI/2;
  const rotation=new THREE.Quaternion().setFromAxisAngle(v(0,0,1),Math.PI/2);
  const sections=[-1.08,0,1.08].map(x=>{
    const c=world.createCollider(R.ColliderDesc.cylinder(.55,radius).setTranslation(x,radius,0).setRotation(rotation));
    c.fieldSection={g,r:radius};return c;
  });
  if(ground){
    const q=new THREE.Quaternion().setFromAxisAngle(v(1,0,0),-Math.atan(slope));
    const pos=v(0,-.1,0).applyQuaternion(q);
    world.createCollider(R.ColliderDesc.cuboid(7,.1,7).setTranslation(pos.x,pos.y,pos.z).setRotation(q));
  }
  const player=new Player({RAPIER:R,world,spawn,yaw,animator:{phase:.15}});
  player.actualSpeed=speed;player.crossController=world.createCharacterController(.016);world.step();
  const want={dir,mag:1,speed};
  return {world,player,sections,want,plan:()=>findCrossing(player,want,speed<2)};
}

test('walk, run and sprint cross either way on a slope, including diagonal approaches at different frame rates',()=>{
  for(const hz of [30,60,120])for(const [speed,angle,side,slope] of [[1.48,0,1,.12],[4.15,.76,-1,-.105],[5.7,1.03,1,.05]]){
    const {world,player,want,plan}=trail({speed,angle,side,slope});
    try{
      const a=plan();assert.ok(a);assert.equal(a.kind,speed<2?'step':'vault');
      assert.ok(a.dir.dot(want.dir)>.94,'small alignment correction preserves the approach');
      assert.ok(Math.abs(a.end.y-a.end.z*slope)<.002);
      let result,crest=-Infinity,last=0;
      for(let i=0;i<3*hz&&!result;i++){
        result=advanceCrossing(player,a,1/hz,want,true,true);
        assert.ok(a.phase>=last);last=a.phase;
        if(Math.abs(player.feet.z)<a.radius*.5)crest=Math.max(crest,player.feet.y);
      }
      assert.equal(result,'landed');assert.ok(crest>a.top);
      assert.ok(player.feet.distanceTo(a.end)<.045,'the capsule lands on the sampled far bank');
      assert.deepEqual(player.events.map(e=>e.kind),speed<2?['land']:['timberPalm','land']);
    }finally{world.free();}
  }
});

test('the approach follows the requested gait even when he has just brushed an obstacle',()=>{
  const {world,player,plan}=trail();
  try{
    player.actualSpeed=.63;
    for(const yaw of [-Math.PI/2,0,Math.PI/2]){
      player.yaw=yaw;assert.equal(plan()?.kind,'vault');
    }
    player.yaw=Math.PI;assert.equal(plan(),null,'backing away keeps normal movement');
    player.anim.setup={speeds:{walk:1.45,run:5.3,sprint:7}};
    for(const control of [{device:'pad'},{device:'keyboard',analogMove:true}]){
      player.yaw=0;
      const intent=mag=>player.intent({...control,move:{x:0,y:mag}},0);
      assert.equal(findCrossing(player,intent(.45),false)?.kind,'step');
      assert.equal(findCrossing(player,intent(.95),false)?.kind,'vault');
    }
  }finally{world.free();}
});

test('the normal movement entry point crosses from rest, releases early and leaves manual jumps available',()=>{
  const {world,player}=trail({speed:1.45});
  try{
    const man=character();player.man=man;player.anim=new Animator(man);
    player.speed=player.actualSpeed=0;
    const input={device:'keyboard',move:{x:0,y:1},walk:true,allowTimber:true,playing:true};
    player.update(1/60,input,0);
    assert.equal(player.crossing?.kind,'step');
    for(let i=0;i<25&&player.crossing.phase<.12;i++)player.update(1/60,input,0);
    player.update(1/60,{...input,move:{x:0,y:0}},0);
    assert.equal(player.crossing,null);assert.ok(player.vel.y<=0);
    for(let i=0;i<40;i++)player.update(1/60,{...input,move:{x:0,y:0}},0);
    player.update(1/60,{...input,jump:true},0);
    assert.equal(player.crossing,null);assert.equal(player.mode,'jump');
  }finally{world.free();}
});

test('wood outside reach, blocked landings, low ceilings, drops and pickup pieces keep their usual collisions',()=>{
  for(const obstacle of ['wall','ceiling','drop','parallel','standing','collectible','high']){
    const {world,sections,player,want,plan}=trail({ground:obstacle!=='drop',radius:obstacle==='high'?.63:.28});
    try{
      if(obstacle==='wall')world.createCollider(R.ColliderDesc.cuboid(2,.85,.09).setTranslation(0,.85,.92));
      if(obstacle==='ceiling')world.createCollider(R.ColliderDesc.cuboid(1,.12,.5).setTranslation(0,2.23,0));
      if(obstacle==='parallel'){want.dir.set(1,0,.10).normalize();player.yaw=Math.atan2(want.dir.x,want.dir.z);}
      if(obstacle==='standing')for(const c of sections)delete c.fieldSection;
      if(obstacle==='collectible')for(const c of sections)c.fieldSection.ready=true;
      world.step();assert.equal(plan(),null,obstacle);
    }finally{world.free();}
  }
});

test('a player can turn back before takeoff, pause on the trunk and release movement to land',()=>{
  const {world,player,want,plan}=trail();
  try{
    let a=plan();
    assert.equal(advanceCrossing(player,a,1/60,{...want,dir:want.dir.clone().negate()},true,true),'cancel');
    assert.equal(advanceCrossing(player,a,1/60,{...want,mag:0},true,true),'cancel');
    assert.equal(advanceCrossing(player,a,1/60,want,true,false),'cancel');
    a=plan();
    for(let i=0;i<90&&a.phase<.40;i++)assert.equal(advanceCrossing(player,a,1/60,want,true,true),undefined);
    assert.ok(a.phase>=.40);
    const paused=a.phase,feet=player.feet.clone();
    for(let i=0;i<10;i++)advanceCrossing(player,a,1/60,want,false,false);
    assert.equal(a.phase,paused);assert.ok(feet.distanceTo(player.feet)<.002);
    let result;
    for(let i=0;i<100&&!result;i++)result=advanceCrossing(player,a,1/60,{...want,mag:0},true,false);
    assert.equal(result,'landed');
  }finally{world.free();}
});

test('a shifted handhold follows the bark and disappears safely if the section is removed mid-crossing',()=>{
  const {world,player,want,plan}=trail();
  try{
    const a=plan(),before=a.palm.clone(),pos=a.collider.translation();
    a.collider.setTranslation(v(pos.x+.035,pos.y,pos.z));world.step();
    advanceCrossing(player,a,1/60,want,true,true);
    assert.ok(Math.abs(a.palm.x-before.x-.035)<.001);
    world.removeCollider(a.collider,true);
    assert.equal(advanceCrossing(player,a,1/60,want,true,true),'cancel');
  }finally{world.free();}
});

test('on the playable skeleton the left palm bears weight while the right hand keeps the axe',()=>{
  const {world,player,want,plan}=trail();
  try{
    const a=plan(),man=character(),anim=new Animator(man),axe=new THREE.Group(),chop=new ChopAnimation(man,anim,axe);
    player.crossing=a;let plants=0,leftPeak=0,rightPeak=0;
    for(let i=0;i<90;i++){
      if(advanceCrossing(player,a,1/60,want,true,true)==='landed')break;
      man.object.position.copy(player.visualRoot(1/60));man.object.rotation.y=player.yaw;
      anim.update(1/60,{speed:player.speed,moveAngle:0,grounded:true});anim.relaxHands(0);man.object.updateMatrixWorld(true);
      crossingPose(a,man,anim);chop.update(1/60,null,2,null,[],null,null,player);vaultPalm(a,man,anim);
      const palm=side=>man.bones['hand_'+side].localToWorld(v(0,.075,.015));
      if(a.phase>.35&&a.phase<.60){
        assert.equal(chop.metrics.leftWeight,0);assert.equal(chop.metrics.rightWeight,1);
        assert.ok(palm('r').distanceTo(chop.metrics.grip)<.025);
        if(palm('l').distanceTo(a.palm)<.055)plants++;
      }
      if(a.phase>.15&&a.phase<.80){
        leftPeak=Math.max(leftPeak,man.bones.foot_l.getWorldPosition(v()).y);
        rightPeak=Math.max(rightPeak,man.bones.foot_r.getWorldPosition(v()).y);
      }
    }
    assert.ok(plants>=4,'several consecutive contact frames on the bark');
    assert.ok(Math.min(leftPeak,rightPeak)>a.top+.08,'both boots rise clear of the timber');
  }finally{world.free();}
});
