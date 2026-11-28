import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Animator} from '../src/figure/animator.js';
import {cabinPose} from '../src/figure/cabin-pose.js';
import {cabinActivity,guideCabinWalk,advanceCabin,nearestGuestBed} from '../src/world/cabin-activity.js';
import {createCabinQuilt} from '../src/world/cabin-quilt.js';
import {Follow} from '../src/figure/camera.js';
import {furnishingSamples} from '../src/timber-audio.js';

const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const house={group:{position:v(13,2.5,-24)}};
const action=(kind,lodge=0)=>cabinActivity(kind,house,{lodge},house.group.position);
const model=await readFile(new URL('../public/figure/starter-man.glb',import.meta.url));
async function pose(a,p){
  const {scene:object}=await new GLTFLoader().parseAsync(model.buffer.slice(model.byteOffset,model.byteOffset+model.byteLength),'');
  const bones={};object.traverse(node=>{if(node.isBone)bones[node.name]=node;});
  object.position.copy(a.stand);object.rotation.y=a.yaw;object.updateMatrixWorld(true);
  const anim=Object.assign(Object.create(Animator.prototype),{object,bones});
  const joints=['clavicle_l','clavicle_r','upperarm_l','upperarm_r','thigh_l','thigh_r'];
  const offsets=joints.map(n=>bones[n].position.clone());
  a.progress=p;cabinPose(a,{object,bones},anim);
  for(const [i,n] of joints.entries())assert.ok(bones[n].position.distanceTo(offsets[i])<1e-6,'A held pose must preserve the rig attachment '+n);
  const point=name=>bones[name].getWorldPosition(v());
  const palm=side=>bones['hand_'+side].localToWorld(v(0,.075,.015));
  return {point,palm,bones};
}
test('the bracing palm stays planted and the working hand follows the plane through its stroke',async()=>{
  const a=action('bench');
  const rest=await pose(a,1);
  a.stroke=1;const pushed=await pose(a,1);
  assert.ok(rest.palm('l').distanceTo(a.left)<.035);
  assert.ok(pushed.palm('l').distanceTo(a.left)<.035);
  assert.ok(rest.palm('r').distanceTo(a.right)<.025);
  assert.ok(Math.abs(rest.palm('r').x-pushed.palm('r').x-.135)<.028);
  assert.ok(rest.point('Head').x<a.hips.x-.25);
});
test('the ledger stool supports the pelvis and feet stay planted below the desk',async()=>{
  const a=action('ledger');const {point,palm}=await pose(a,1);
  assert.ok(point('pelvis').distanceTo(a.hips)<.001);
  assert.ok(palm('l').distanceTo(a.left)<.035);
  assert.ok(Math.abs(palm('r').y-a.right.y)<.055);
  for(const side of ['l','r']){
    assert.ok(Math.abs(point('foot_'+side).y-a.stand.y-.103)<.015);
    assert.ok(point('calf_'+side).x>point('thigh_'+side).x+.25);
  }
});
test('both beds take the weight in stages, with the head on the pillow and soles above the mattress',async()=>{
  for(const lodge of [0,24]){
    const a=action('bed',lodge),axis=v(Math.sin(a.bedYaw),0,Math.cos(a.bedYaw));
    const seated=await pose(a,.45),asleep=await pose(a,1);
    assert.ok(seated.point('Head').y>asleep.point('Head').y+.35);
    assert.ok(asleep.point('pelvis').distanceTo(a.mid)<.003);
    assert.ok(asleep.point('Head').clone().sub(a.mid).dot(axis)<-.60);
    for(const side of ['l','r']){
      const ankle=asleep.point('foot_'+side),knee=asleep.point('calf_'+side);
      assert.ok(ankle.clone().sub(a.mid).dot(axis)>.78);
      assert.ok(Math.abs(ankle.y-a.top-.10)<.02);
      assert.ok(knee.y<a.top+.36);
    }
    const quilt=createCabinQuilt({});quilt.update(a,asleep.bones);
    assert.equal(quilt.mesh.visible,true);
    const leftKnee=asleep.point('calf_l'),clothKnee=quilt.mesh.localToWorld(quilt.mesh.material.uniforms.joints.value[1].clone());
    assert.ok(leftKnee.distanceTo(clothKnee)<.0001);
    a.progress=.3;quilt.update(a,asleep.bones);assert.equal(quilt.mesh.visible,false);
  }
});
test('furniture reaches its action once after approach and can be left before activation',()=>{
  for(const fps of [30,60,144])for(const kind of ['bench','ledger','bed']){
    const a=action(kind),dt=1/fps;while(a.stage==='walk')guideCabinWalk(a,a.points[a.leg],dt);
    let time=0,count=0;
    for(let i=0;i<fps*4;i++){time+=dt;if(advanceCabin(a,dt)==='ready'){count++;assert.ok(Math.abs(time-a.seconds)<=dt+.00001);}}
    assert.equal(count,1);assert.equal(a.stage,'using');
    const interrupted=action(kind);interrupted.stage='settle';
    for(let i=0;i<fps/3;i++)assert.equal(advanceCabin(interrupted,dt),null);
    interrupted.stage='rise';let event;while(interrupted.progress>0)event=advanceCabin(interrupted,dt);
    assert.equal(event,'done');
  }
  const blocked=action('bench'),feet=blocked.stand.clone().add(v(1,0,0));
  blocked.points=[blocked.stand];for(let i=0;i<100;i++)guideCabinWalk(blocked,feet,1/60);
  assert.equal(blocked.stage,'blocked');
});
test('the route to the right Riverwatch bed clears the bench and table through the centre aisle',()=>{
  const h={group:{position:v()},spec:{w:4.8,d:8.2},dropoff:{x:0},contains:()=>true,
    beds:[{x:-1.7,z:-2.9,top:.685,side:1},{x:1.7,z:-2.9,top:.685,side:-1}],
    obstacles:[{x:1.31,z:-.2,hx:.75,hz:.425},{x:1.31,z:.65,hx:.69,hz:.19}]};
  const feet=v(.03,.09,3.65),bed=nearestGuestBed(h,feet);
  assert.equal(bed,h.beds[1]);const a=cabinActivity('bed',h,{},feet,bed);
  assert.ok(a.points.length>1);
  let prev=feet.clone();
  for(const point of a.points){
    for(let i=0;i<=50;i++){const pos=v().lerpVectors(prev,point,i/50);
      for(const b of h.obstacles)assert.ok(Math.abs(pos.x-b.x)>b.hx+.28||Math.abs(pos.z-b.z)>b.hz+.28);
    }
    prev=point;
  }
  assert.equal(a.points.at(-1),a.stand);
});
test('the close camera leaves room for the sheet and returns to the selected room zoom',()=>{
  for(const aspect of [1.8,.53]){
    const cam=new THREE.PerspectiveCamera(48,aspect,.05,180),f=new Follow(cam),a=action('ledger');
    f.roomZoom=.87;f.interior={center:a.focus,distance:6};cam.position.copy(a.focus).add(v(0,4,3));
    const step=()=>f.update(1/60,a.stand,{x:0,y:0},0,()=>null,()=>0);
    for(let i=0;i<180;i++)step();
    const start=cam.position.clone();
    f.cabinShot={eye:a.eye,focus:a.focus,weight:1,panel:true};step();
    assert.ok(cam.position.distanceTo(start)<.48);
    for(let i=0;i<160;i++)step();
    cam.updateMatrixWorld();const screen=a.focus.clone().project(cam);
    if(aspect>1)assert.ok(screen.x<-.15);else assert.ok(screen.y>.16);
    const close=cam.position.clone();f.cabinShot=null;step();
    assert.ok(cam.position.distanceTo(close)<.48);
    for(let i=0;i<200;i++)step();
    assert.ok(cam.position.distanceTo(start)<.001);assert.equal(f.roomZoom,.87);
  }
});
test('page and hand-plane sounds are bounded one-shots with different lengths',()=>{
  const rate=22050,plane=furnishingSamples(rate,'plane'),page=furnishingSamples(rate,'page');
  for(const f of [plane,page]){
    assert.ok(f.every(x=>Number.isFinite(x)&&Math.abs(x)<=1));
    assert.ok(f.some(x=>Math.abs(x)>.12));
    assert.ok(Math.abs(f[0])<.01&&Math.abs(f.at(-1))<.01);
  }
  assert.ok(page.length<plane.length*.65);
});
