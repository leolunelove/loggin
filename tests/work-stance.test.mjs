import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import R from '../src/figure/rapier/rapier.mjs';
import {HeldAxe} from '../src/figure/held-axe.js';
import {workStance,stepIntoStance} from '../src/figure/work-stance.js';
import {PLAYER_GROUPS} from '../src/world/woodland-physics.js';

await R.init();
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),identity=new THREE.Quaternion();
function fixture(){
  const physics=new R.World(V()),body=physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0,.89,0));
  const collider=physics.createCollider(R.ColliderDesc.capsule(.48,.265).setCollisionGroups(PLAYER_GROUPS),body);
  const player={feet:V(),grounded:true,collider,ground:()=>({y:0,normal:V(0,1,0)})};
  return {physics,player,RAPIER:R};
}
test('a close cut uses a short eased step and gives way to the player at every frame rate',()=>{
  for(const hz of [30,60,120]){
    const g=fixture(),s={contact:V(0,1.1,.42),t:{}};
    g.physics.step();const plan=workStance(g,s);
    assert.ok(plan.goal.z<-.32&&plan.goal.length()<=.44);
    const initial=plan.goal.clone(),start={move:{x:0,y:0}};
    assert.ok(stepIntoStance(plan,g.player,start,1/hz));assert.ok(Math.hypot(start.workStep.x,start.workStep.z)<.62);
    for(let i=0;i<hz;i++){
      const input={move:{x:0,y:0}};if(!stepIntoStance(plan,g.player,input,1/hz))break;
      g.player.feet.add(V(input.workStep.x/hz,0,input.workStep.z/hz));
    }
    assert.ok(g.player.feet.distanceTo(initial)<.07);
    g.player.feet.set(0,0,0);const manual=workStance(g,s),input={move:{x:1,y:0}};
    assert.equal(stepIntoStance(manual,g.player,input,1/hz),false);assert.equal(input.workStep,undefined);
    g.physics.free();
  }
});
test('a boxed-in stroke cannot step through a wall, over a ledge or while airborne',()=>{
  const g=fixture(),wall=(x,z,w,d)=>g.physics.createCollider(R.ColliderDesc.cuboid(w,1,d).setTranslation(x,1,z));
  wall(0,-.31,.9,.03);wall(.31,0,.03,1);wall(-.31,0,.03,1);g.physics.step();
  const stroke={contact:V(0,1,.41),t:{}},boxed=workStance(g,stroke);
  assert.ok(boxed.compact>.7);assert.equal(boxed.goal,null);
  g.player.grounded=false;assert.equal(workStance(g,stroke),null);g.physics.free();
  const cliff=fixture();cliff.player.ground=()=>null;cliff.physics.step();
  assert.equal(workStance(cliff,stroke).goal,null);cliff.physics.free();
});
test('sprinting carries all five axes with the moving hand and still sweeps the blade against a post',()=>{
  for(let tier=0;tier<5;tier++){
    const {physics,player}=fixture(),body=player.collider.parent(),held=new HeldAxe(physics,R,player.collider);
    const grip=V(0,-.15,0),opts={grip},origin=V(-.22,1,.35);
    physics.step();held.solve(origin,identity,tier,1/60,[],opts);
    for(let frame=1;frame<=60;frame++){
      const z=7*frame/60;body.setTranslation(V(0,.89,z),true);physics.step();
      const goal=origin.clone().add(V(0,0,z)),solved=held.solve(goal,identity,tier,1/60,[],opts);
      assert.ok(solved.position.distanceTo(goal)<.002,'sprint moved the handle out of the palm');
    }
    physics.createCollider(R.ColliderDesc.cuboid(1,1,.015).setTranslation(0,1,7.65));
    let caught=false;
    for(let frame=1;frame<=8;frame++){
      const z=7+7*frame/60;body.setTranslation(V(0,.89,z),true);physics.step();
      const r=held.solve(origin.clone().add(V(0,0,z)),identity,tier,1/60,[],opts);
      if(r.contact){caught=true;assert.ok(r.position.z<7.66);break;}
    }
    assert.ok(caught);physics.free();
  }
});
