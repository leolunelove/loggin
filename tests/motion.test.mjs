import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Follow} from '../src/figure/camera.js';
import {Player} from '../src/figure/player.js';
import {workClothes} from '../src/figure/work-clothes.js';
import {paint} from '../src/figure/figure.js';
import {characterPalettes,defaultAppearance} from '../src/appearance.js';
import {Animator} from '../src/figure/animator.js';
import {ChopAnimation,AXE_BLADE,LOWER_GRIP} from '../src/figure/chop.js';
import {chopContact,swingPose,CHOP_REACH,IMPACT_AT,SWING_VARIANTS,chooseSwing} from '../src/mechanics.js';
import {Lumberjack} from '../src/game.js';
import {createHandcart} from '../src/world/handcart.js';
import {woodcraft} from '../src/world/woodcraft.js';
import {buildTrail} from '../src/world/trail.js';
import {freshState,swingDuration} from '../src/economy.js';

const parse=async name=>{const b=await fs.readFile(new URL('../public/figure/'+name,import.meta.url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
async function character(){
 const [m,c,hands]=await Promise.all([parse('starter-man.glb'),parse('starter-man-clips.glb'),fs.readFile(new URL('../src/figure/hands-anymove.json',import.meta.url),'utf8').then(JSON.parse)]);
 const man={object:m.scene,bones:{},raw:{},clips:{},motion:{},hands};man.object.traverse(o=>{if(o.isBone)man.bones[o.name]=o;});
 for(const clip of c.animations){man.raw[clip.name]=clip;man.clips[clip.name]=new THREE.AnimationClip(clip.name,clip.duration,clip.tracks.filter(t=>!t.name.startsWith('root.')));man.motion[clip.name]={speed:1,velocity:new THREE.Vector3(),yaw:0,duration:clip.duration};}
 return man;
}
const angleError=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));

test('mouse look settles quickly without overshoot and gives the same turn at 30/60/120 fps',()=>{
 const results=[];
 for(const fps of [30,60,120]){
  const follow=new Follow(new THREE.PerspectiveCamera());follow.yaw=Math.PI;
  follow.look({x:.9,y:.3},1/fps);assert.ok(follow.yaw<Math.PI&&follow.yaw>Math.PI-.9);
  for(let i=1;i<fps/5;i++)follow.look({x:0,y:0},1/fps);
  results.push([follow.yaw,follow.pitch]);assert.ok(Math.abs(follow.yaw-(Math.PI-.9))<.002);
  follow.yaw=0;follow.look({x:0,y:0},1/fps);assert.equal(follow.yaw,0,'respawn/external heading resets do not spring back');
 }
 for(const r of results)assert.ok(Math.abs(r[0]-results[0][0])<1e-9);
});

test('all nine workwear and hat pairings stay on the correct bones and repaint in place',async()=>{
 const man=await character(),a=defaultAppearance(),p=characterPalettes(a);
 const wardrobe=workClothes({},man,paint,p.HAT,p.SHIRT),parts=[];
 man.object.traverse(o=>{if(o.name==='work-clothing')parts.push(o);});
 for(let headwear=0;headwear<3;headwear++)for(let workwear=0;workwear<3;workwear++){
   wardrobe.set({...a,headwear,workwear},p);wardrobe.update();
   const hats=parts.filter(m=>m.visible&&m.userData.hatStyle>=0);
   const clothes=parts.filter(m=>m.visible&&m.userData.coatStyle>=0);
   assert.ok(hats.length>=2);assert.ok(hats.every(m=>m.userData.hatStyle===headwear&&m.parent===man.bones.Head));
   assert.equal(clothes.length>0,workwear>0);assert.ok(clothes.every(m=>m.userData.coatStyle===workwear));
   const bounds=new THREE.Box3();for(const hat of hats)bounds.expandByObject(hat);
   assert.ok(bounds.min.y>1.65&&bounds.max.y<2.03&&bounds.getSize(new THREE.Vector3()).x>.18);
 }
 const other=characterPalettes({...a,hat:3});wardrobe.set({...a,hat:3},other);
 assert.deepEqual(wardrobe.hat.material.uniforms.uM.value.toArray(),other.HAT[1]);
 const marks=wardrobe.mesh.material.uniforms.FIG_M.value[0];assert.deepEqual(marks.toArray(),other.HAT[1]);
});

test('a parked cart credits only the load that fits and a separate animated worker takes the handles',async()=>{
 const state=Object.assign(freshState(),{wood:200,carried:39,carriedHardwood:8}),man=await character();
 Object.assign(state.places[0],{found:true,wood:24,planks:8,trail:40});
 const c=state.woodland.cart;Object.assign(c,{built:true,hired:true,load:170,route:0,progress:1});
 const route=buildTrail({x:0,z:80},{x:-29,z:55},{d:6},()=>0,new THREE.MeshBasicMaterial(),{});
 const game={state,figure:{man},heightAt:()=>0,scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),shared:{},
   player:{feet:new THREE.Vector3(),yaw:0},exploration:{routes:[route]}};
 const cart=createHandcart(game,woodcraft({}));cart.update(0);
 assert.equal(cart.stow(),0);game.player.feet.copy(cart.axle.position);game.camera.position.copy(game.player.feet);
 assert.equal(cart.stow(),22);assert.equal(cart.stow(),0);assert.equal(state.wood,222);assert.equal(state.carried,17);
 assert.ok(cart.emptyAtDepot());assert.equal(cart.emptyAtDepot(),false);assert.equal(state.woodland.freight[0],192);
 assert.ok(cart.hitch());assert.ok(cart.towing);assert.ok(cart.dispatch());assert.equal(cart.towing,false);
 cart.update(1);cart.update(.1);assert.equal(c.load,192);assert.equal(state.wood,222);
 const hauler=game.scene.getObjectByName('Trail hauler');assert.ok(hauler?.visible);assert.notEqual(hauler,man.object);
 let crewBone,crewSkin;hauler.traverse(o=>{if(o.name==='hand_r')crewBone=o;if(o.isSkinnedMesh&&/generic/.test(o.name))crewSkin=o;});
 assert.notEqual(crewBone,man.bones.hand_r);assert.ok(crewSkin.material.uniforms.uCloth.value);
});

test('character turning follows the shortest arc and eases into its final heading',()=>{
 const p=Object.create(Player.prototype);let yaw=Math.PI-.02,previous=0;
 for(let i=0;i<60;i++){const next=p.turnToward(yaw,-Math.PI+.6,6,1/60);const step=angleError(next,yaw);assert.ok(step<=.100001);if(i>8)assert.ok(step<=previous+1e-9);previous=step;yaw=next;}
 assert.ok(angleError(yaw,-Math.PI+.6)<1e-5);
});

test('a chop requests a gradual facing change and displays contact even at the fastest axe cadence',()=>{
 const g=Object.create(Lumberjack.prototype),t={x:0,y:0,z:-1.4,r:.2,tier:0,type:1};
 Object.assign(g,{time:0,started:true,paused:false,touch:false,held:true,swing:null,state:{...freshState(),speed:4},input:{active:true,keys:new Set(),mouse:{left:false}},camera:{position:{x:0,z:4}},forest:{trees:[t]},follow:{yaw:Math.PI,look(){}},player:{feet:{x:0,y:0,z:0},visualY:0,grounded:true,speed:0,yaw:Math.PI-.8,lastYaw:Math.PI-.8}});
 let impacts=0;g.hit=()=>impacts++;const frame=()=>({move:{x:0,y:0},look:{x:0,y:0},device:'keyboard'});
 const first=frame();g.before(.02,first);assert.equal(g.swing,null);assert.equal(g.player.yaw,Math.PI-.8);assert.equal(first.facingYaw,Math.PI);
 g.player.yaw=Math.PI;g.before(.02,frame());assert.ok(g.swing);
 while(!impacts)g.before(.05,frame());assert.equal(g.swing.poseProgress,IMPACT_AT);assert.equal(impacts,1);
});

test('real character grips remain on the tool and the blade reaches the cut at contact for all axe sizes',async()=>{
 const man=await character(),animator=new Animator(man),axe=new THREE.Group(),chop=new ChopAnimation(man,animator,axe);
 function idle(){animator.update(1/60,{speed:0,moveAngle:0,grounded:true});animator.relaxHands(0);man.object.updateMatrixWorld(true);}
 idle();chop.update(1/60,null,0);
 for(const distance of [.9,1.25,CHOP_REACH])for(const tier of [0,4])for(const yaw of [0,2.6])for(const variant of [0,1,2])for(const finishing of [false,true]){
  const tree={x:Math.sin(yaw)*(distance+.2),y:0,z:Math.cos(yaw)*(distance+.2),r:.2},contact=chopContact(tree,{x:0,y:0,z:0});
  man.object.rotation.y=yaw;idle();chop.update(1/60,{t:tree,contact,age:.5,duration:1,poseProgress:.5,variant,finishing},tier);
  const blade=AXE_BLADE.clone().applyMatrix4(axe.matrixWorld);assert.ok(blade.distanceTo(new THREE.Vector3(contact.x,contact.y,contact.z))<1e-6);
  assert.ok(chop.metrics.r<.03,`right hand ${distance}m tier${tier} variant${variant}: ${chop.metrics.r}`);assert.ok(chop.metrics.l<.03,`left hand ${distance}m tier${tier} variant${variant}: ${chop.metrics.l}`);
 }
 // Both arm segments keep their true length through the windup and strike.
 for(const variant of [0,1,2])for(const p of [.16,.34,.45,.5,.73]){idle();const tree={x:0,y:0,z:1.45,r:.2};man.object.rotation.y=0;man.object.updateMatrixWorld(true);const feet=['l','r'].map(s=>man.bones['foot_'+s].getWorldPosition(new THREE.Vector3()));const lengths=['r','l'].map(s=>[man.bones['upperarm_'+s].getWorldPosition(new THREE.Vector3()).distanceTo(man.bones['lowerarm_'+s].getWorldPosition(new THREE.Vector3())),man.bones['lowerarm_'+s].getWorldPosition(new THREE.Vector3()).distanceTo(man.bones['hand_'+s].getWorldPosition(new THREE.Vector3()))]);chop.update(1/60,{t:tree,contact:chopContact(tree,{x:0,y:0,z:0}),age:p,duration:1,variant},0);assert.ok(chop.metrics.r<.03,`right pose ${p} variant ${variant}: ${chop.metrics.r}`);assert.ok(chop.metrics.l<.03,`left pose ${p} variant ${variant}: ${chop.metrics.l}`);for(const [i,s]of ['l','r'].entries())assert.ok(man.bones['foot_'+s].getWorldPosition(new THREE.Vector3()).distanceTo(feet[i])<1e-5,'weight shifts keep planted feet in place');for(const [i,s]of ['r','l'].entries()){const upper=man.bones['upperarm_'+s].getWorldPosition(new THREE.Vector3()),lower=man.bones['lowerarm_'+s].getWorldPosition(new THREE.Vector3()),hand=man.bones['hand_'+s].getWorldPosition(new THREE.Vector3());assert.ok(Math.abs(upper.distanceTo(lower)-lengths[i][0])<1e-6);assert.ok(Math.abs(lower.distanceTo(hand)-lengths[i][1])<1e-6);}}
 idle();const tree={x:0,y:0,z:1.45,r:.2};chop.update(1/60,{t:tree,contact:chopContact(tree,{x:0,y:0,z:0}),age:.34,duration:1},0);const before=axe.position.clone();idle();chop.update(1/120,null,0);assert.ok(axe.position.distanceTo(before)<.12,'cancelling blends out instead of teleporting the tool');
});


test('swing choice avoids adjacent repeats and all three forms share the same contact timing',()=>{
 let previous=-1;const used=new Set();
 for(let i=0;i<50;i++){const variant=chooseSwing(previous,{r:.3,type:1},()=>((i*37)%97)/97);assert.notEqual(variant,previous);used.add(variant);previous=variant;}
 assert.equal(used.size,3);
 const poses=SWING_VARIANTS.map((v,i)=>swingPose(.34,i));assert.equal(new Set(poses.map(p=>p.angle)).size,3);
 for(let i=0;i<3;i++){assert.equal(swingPose(.5,i).angle,swingPose(.54,i).angle);assert.equal(swingPose(0,i).angle,swingPose(1,i).angle);assert.ok(swingPose(.5,i,true).lean>swingPose(.5,i,false).lean);}
});
