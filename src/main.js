import {WORLD} from './world/seed.js';
import {characterPalettes} from './appearance.js';
import {createRiver,riverPhase} from './world/river.js';
// A wanderer in an autumn wood, painted in oils. Third person; walk, run, jump; nothing to do yet but be there.
// Shown with ?scene=autumn (src/scenes.js).
//   ?capture       no clock: window.lab.step(dt, n) advances it (for stills and films)
//   ?quality=low   fewer leaves in the air, no sun in the mist
//   ?shafts=0 ?canvas=0 ?impasto=0..2    parts of the finish, for comparing
import * as THREE from 'three';
import { Lumberjack } from './game.js';
import RAPIER from './figure/rapier/rapier.mjs';
import { createShared, WIND } from './oilpaint/common.js';
import { createBrushSheet } from './oilpaint/brush.js';
import { prepareLand, createLand, heightAt, wayDist, noise, way, START } from './world/land.js';
import { createFloor } from './world/floor.js';
import { createForest } from './world/forest.js';
import {plantTrunk} from './world/woodland-physics.js';
import { createSky } from './world/sky.js';
import { createLeaves } from './world/leaves.js';
import { createKick } from './world/kick.js';
import { createShade } from './oilpaint/shade.js';
import { createFrame } from './oilpaint/finish.js';
import { createFigure } from './figure/figure.js';
import { Animator } from './figure/animator.js';
import { Player } from './figure/player.js';
import { Input } from './figure/input.js';
import { Follow } from './figure/camera.js';
import { createShack } from './world/shack.js';
import { startingTree } from './world/home-site.js';

const q = new URLSearchParams(location.search);
const capture = q.has('capture');
// ?quality wins; otherwise Patch's performance mode, where there is one
const lowQuality = () => q.has('quality') ? q.get('quality') === 'low' : game.state.low;

// Patch's page talks to the demo through this. There are no controls yet; it carries loading, ready and hiding.
let shown = true;
let loaded = false;
const block = {
  progress(value, label) {
    document.getElementById('loading-label').textContent = label === 'Fetching the wanderer' ? 'Packing your axe' : label;
    document.getElementById('loading-progress').style.width = `${value*100}%`;
  },
  ready() {},
};
block.progress(0.03, 'Laying the ground');
const timings = {};
let mark = performance.now();
const lap = (name) => { const now = performance.now(); timings[name] = Math.round(now - mark); mark = now; };

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.getElementById('view').appendChild(renderer.domElement);

const shared = createShared();
shared.uRiverPhase={value:riverPhase()};
shared.tBrush.value = createBrushSheet();
if (q.has('impasto')) shared.uImpasto.value = +q.get('impasto');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.2, 2000);
// Listened for from the start, not once loaded: the page may go fullscreen while the world is still being made.
// The frame's target joins in once it exists.
let fitFrame = () => {};
function fitView() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  fitFrame();
}
addEventListener('resize', fitView);
lap('start');
// the wanderer's files are the large ones: they start coming down now, while the wood is made
let told = 0;
const say = (value, label) => { told = Math.max(told, value); block.progress(told, label); };
const figureComing = createFigure(shared, (done) => say(0.05 + 0.55 * done, 'Fetching the wanderer'),characterPalettes(WORLD.state?.appearance),WORLD.state?.appearance);

const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
await prepareLand((done) => { say(0.03 + 0.07 * done, 'Laying the ground'); return turn(); });
const land = createLand(shared);
lap('land');
say(0.1, 'Growing the wood');
await turn();
const forest = createForest(shared);
shared.uHome = {value:new THREE.Vector2(forest.home.x,forest.home.z)};
const home = createShack(shared,forest.home,heightAt);
scene.add(home.group,home.paint.mesh);
forest.shade.add(home.shadow);
lap('forest');
const floor = createFloor(shared);
const sky = createSky(shared);
const river=createRiver(shared,heightAt);
const leaves = createLeaves(shared, 2400);
const shade = createShade(renderer, shared, forest.shade);
lap('shade');
say(0.25, 'Fetching the wanderer');
await turn();
const kick = createKick(shared);
scene.add(river,sky.group, land.mesh, forest.group, floor.group, leaves.mesh, kick.mesh);

// --- the ground and the trunks, for his feet ---
await RAPIER.init();
const physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
{
  const f = land.heightField();
  physics.createCollider(RAPIER.ColliderDesc.heightfield(f.cells, f.cells, f.heights, { x: 2 * f.half, y: 1, z: 2 * f.half }));
  for (const tree of forest.colliders) tree.collider=plantTrunk(physics,RAPIER,tree);
  for (const c of home.colliders) physics.createCollider(RAPIER.ColliderDesc.cuboid(c.hx,c.hy,c.hz).setTranslation(c.x,c.y,c.z));
}
lap('physics');

const figure = await figureComing;
const { man } = figure;
scene.add(man.object, figure.dabs);
const animator = new Animator(man);
// Start beside a small tree, with a good first swing within reach.
const starter = startingTree(forest.trees);
const startX = starter.x, startZ = starter.z + starter.r + 1.25;
const spawn = new THREE.Vector3(startX, heightAt(startX, startZ), startZ);
const player = new Player({ RAPIER, world: physics, man, animator, spawn, yaw: Math.PI });
const follow = new Follow(camera);
follow.yaw = Math.PI;
const input = new Input(renderer.domElement, { pads: !capture && !q.has('nopad') });
const game = new Lumberjack({scene,camera,renderer,shared,forest,player,input,figure,animator,physics,RAPIER,shade,heightAt,follow,home});
physics.step();
lap('figure');

const frame = createFrame(renderer, shared);
game.frame = frame; game.leaves = leaves;game.leafKick=kick; game.applyQuality();
fitFrame = () => frame.resize();
frame.uniforms.uCanvas.value = q.has('canvas') ? +q.get('canvas') : 1;
/** Low quality drops the sun in the mist and most of the falling leaves. */
function applyQuality() {
  const low = lowQuality();
  frame.uniforms.uShafts.value = q.has('shafts') ? +q.get('shafts') : low ? 0 : 1;
  leaves.mesh.geometry.instanceCount = low ? 900 : 2400;
}
applyQuality();
window.patch?.addEventListener?.('qualitychange', applyQuality);

// the wind as the cloak feels it: the same bands the leaves move in
const wind = { x: WIND.x, z: WIND.y };
let time = 0;
function air(x, y, z, out) {
  const along = x * wind.x + z * wind.z, across = -x * wind.z + z * wind.x;
  const gust = THREE.MathUtils.clamp(0.5 + 0.8 * noise((along - time * 4) / 40, across / 90) + 0.3 * noise((along - time * 6.5) / 11, across / 17), 0, 1);
  const speed = 0.4 + 3.2 * gust * gust;
  return out.set(wind.x * speed, 0.25 * Math.sin(time * 2.3 + x) * gust, wind.z * speed);
}

function respawn() {
  player.crossing=null;player.crossCheck=0;player.crossSettle=0;
  const half = player.halfHeight();
  player.body.setTranslation({ x: spawn.x, y: spawn.y + player.t.radius + half + 0.05, z: spawn.z }, true);
  physics.propagateModifiedBodyPositionsToColliders();
  player.vel.set(0, 0, 0); player.speed = 0; player.mode = 'move';
  player.feet.copy(spawn); player.prevFeet.copy(spawn); player.visualY = spawn.y; player.grounded = true;
  animator.lock = null; animator.lockOff = null;
  animator.enter(animator.locoState({ strafe: false }), 0.1);
}

const size = new THREE.Vector2();
function tick(dt,draw=true) {
  dt = Math.min(dt, 1 / 20);
  time += dt;
  const inp = input.read(dt);
  game.before(dt, inp);
  inp.allowTimber=inp.playing&&!inp.roomWalk&&!inp.cartSpeed&&!inp.blockJump&&!inp.aimHeld&&!inp.interactPressed&&
    !game.sight&&!game.lockedTree&&!game.drawStroke&&!game.swing&&!game.delivery&&!game.cabin&&!game.seat;
  player.update(dt, inp, follow.movementYaw);
  // the wood has no wall: far from the way he is turned gently back, and under the world he starts again
  if (player.feet.y < heightAt(player.feet.x, player.feet.z) - 6 || wayDist(player.feet.x, player.feet.z) > 78) respawn();
  const root = player.visualRoot(dt);
  man.object.position.copy(root);
  man.object.rotation.set(0, player.yaw, 0);
  man.object.updateMatrixWorld(true);
  const local = player.vel.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -player.yaw);
  animator.update(dt, { speed: player.mode === 'move' ? player.speed : Math.hypot(local.x, local.z), moveAngle: player.moveAngle, grounded: player.grounded });
  animator.relaxHands(player.speed);
  animator.uprightTrunk(dt, player.speed, player.grounded && player.mode !== 'jump' && player.mode !== 'air' ? 1 : 0.3);
  const lookW = player.mode === 'move' || player.mode === 'idleExtra' ? THREE.MathUtils.clamp(1 - (player.speed - 1.5) / 2, 0, 1) : 0;
  animator.lookToward(dt, camera.getWorldDirection(new THREE.Vector3()), lookW*(1-(game.cabin?.progress||0)));
  animator.armClearance(dt);
  if (player.mode === 'move' && !player.strafe) animator.leanInto(dt, player.turnRate, player.speed, player.accelF);
  else animator.leanInto(dt, 0, 0, 0);
  const onGround = player.grounded && !player.crossing && player.mode !== 'jump' && player.mode !== 'air';
  animator.placeFeet(dt, (x, z, from) => player.ground(x, z, from, 1.4), root.y, onGround ? 1 : 0);
  man.object.updateMatrixWorld(true);
  game.pose(dt,inp);
  figure.update(dt,game.cabin);
  const sheltered=game.insideShack||game.indoorPlace>=0;
  leaves.mesh.visible=!sheltered;
  const step=Math.max(.0001,dt),vx=(player.feet.x-player.prevFeet.x)/step,vz=(player.feet.z-player.prevFeet.z)/step;
  forest.touchBrush(dt,sheltered?null:root,{x:vx,z:vz},(p,v)=>{
    kick.scatter(p.x,p.y+Math.min(1.55,p.height*.68),p.z,v,3+Math.floor(Math.min(4,Math.hypot(v.x,v.z))));
  });
  kick.update(dt,root,{x:Math.sin(player.yaw),z:Math.cos(player.yaw)},player.speed,onGround&&!sheltered,heightAt);

  follow.update(dt, root, inp.look, inp.zoom, (o, d, max) => player.castRay(o, d, max), heightAt);
  camera.updateMatrixWorld(true);
  game.update(dt);
  if(!draw)return;
  renderer.getDrawingBufferSize(size);
  shared.uTime.value = time;
  shared.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / size.y;
  shared.uFocus.value.copy(root);
  floor.follow(camera.position.x, camera.position.z);
  shade.update(scene, root);
  frame.render(scene, camera);
}

window.lab = {
  THREE, player, follow, camera, input, animator, figure, shared, frame, renderer, timings, game, forest, counts: forest.counts, heightAt, respawn, way,
  step(dt = 1 / 60, n = 1, drawEveryFrame = true) { for (let i = 0; i < n; i++) tick(dt,drawEveryFrame||i===n-1); },
  setInput(fn) { input.override = fn; },
  /** Puts him at (x, z) on the ground, facing (fx, fz), with the eye behind him. */
  teleport(x, z, fx, fz) {
    player.crossing=null;player.crossCheck=0;player.crossSettle=0;
    const y = heightAt(x, z), half = player.halfHeight();
    player.body.setTranslation({ x, y: y + player.t.radius + half + 0.05, z }, true);
    physics.propagateModifiedBodyPositionsToColliders();
    player.feet.set(x, y, z); player.prevFeet.copy(player.feet); player.visualY = y;
    player.vel.set(0, 0, 0); player.speed = 0; player.mode = 'move'; player.grounded = true;
    player.yaw = player.lastYaw = Math.atan2(fx - x, fz - z);
    follow.yaw = player.yaw; follow.pivot.set(0, 0, 0);
    animator.lock = null; animator.lockOff = null;
    animator.enter(animator.locoState({ strafe: false }), 0.05);
    tick(1 / 60);
  },
  /** A fixed view for stills: eye and what it looks at. Call with nothing to go back to following him. */
  view(eye, target) { follow.free = eye ? { position: new THREE.Vector3(...eye), target: new THREE.Vector3(...target) } : null; },
};

// --- warming up: every shader is built and drawn once, and the GPU has caught up, before anyone is let in ---
say(0.68, 'Mixing paint');
/** Resolves when the GPU has done everything it has been sent: JavaScript finishing isn't the GPU finishing. */
function gpuDone() {
  const gl = renderer.getContext();
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const deadline=performance.now()+1000;
  return new Promise((resolve) => {
    const poll = () => {
      // The first draw is already submitted. Some embedded drivers never signal warmup
      // fences, so keep this optional readiness check from trapping the loading screen.
      if (performance.now()<deadline&&gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) return void setTimeout(poll, 16);
      gl.deleteSync(sync);
      resolve();
    };
    poll();
  });
}
if (!capture) {
  renderer.debug.checkShaderErrors = false;
  const compiling = renderer.compileAsync(scene, camera);
  // Submit compilation work before polling completion; some embedded WebGL drivers
  // otherwise leave newly introduced materials pending until the first real draw.
  renderer.getContext().flush();
  await Promise.race([compiling,new Promise(resolve=>setTimeout(resolve,1500))]);
  lap('shaders');
  say(0.86, 'Mixing paint');
}
for (let i = 0; i < (capture ? 1 : 5); i++) {
  tick(1 / 60);
  if (capture) break;
  await gpuDone();
  say(0.88 + 0.025 * i, 'First strokes');
  await turn();
}
lap('first frame');
// Let the player watch the same real meshes emerge: ground, water, individual tree batches, then camp.
if(!capture){
 const h=home.group.position;
 follow.free={position:new THREE.Vector3(h.x+19,h.y+13,h.z+20),target:new THREE.Vector3(h.x+7,h.y+1,h.z-6)};
 const equipment=new THREE.Group();equipment.add(game.axe,game.axePaint.mesh);scene.add(equipment);
 const meshes=forest.group.children.map(mesh=>({mesh,count:mesh.geometry.index?.count,instances:mesh.geometry.instanceCount}));
 document.body.classList.add('generating');
 for(let i=0;i<=30;i++){
  const p=i/30,trees=THREE.MathUtils.clamp((p-.28)/.55,0,1);
  land.mesh.visible=p>.08;floor.group.visible=p>.15;river.visible=p>.24;sky.group.visible=true;
  game.exploration.group.visible=game.field.group.visible=game.cart.group.visible=p>.82;
  home.group.visible=home.paint.mesh.visible=p>.82;equipment.visible=man.object.visible=figure.dabs.visible=p>.93;leaves.mesh.visible=p>.9;kick.mesh.visible=p>.93;
  for(const {mesh,count,instances} of meshes){if(count)mesh.geometry.setDrawRange(0,Math.floor(count*trees/3)*3);if(Number.isFinite(instances))mesh.geometry.instanceCount=Math.floor(instances*trees);}
  block.progress(p,p<.1?'First light':p<.24?'Laying the land':p<.35?'Finding the river':p<.82?'Growing your forest':p<.94?'Making camp':'Your little life in the woods');
  tick(1/30);await new Promise(resolve=>setTimeout(resolve,65));
 }
 for(const {mesh,count,instances} of meshes){if(count)mesh.geometry.setDrawRange(0,count);if(Number.isFinite(instances))mesh.geometry.instanceCount=instances;}
 follow.free=null;follow.pivot.set(0,0,0);shade.refresh();document.body.classList.remove('generating');
}

// Draws while the page says the demo can be seen, and not at all while it can't.
let running = false;
let graphicsLost = false;
let last = 0;
function run() {
  const want = shown && !capture && !graphicsLost && !document.hidden;
  if (want === running) return;
  running = want;
  last = performance.now();
  renderer.setAnimationLoop(want ? () => { const now = performance.now(); if(!game.editingClothes)tick((now - last) / 1000); last = now; } : null);
}
const loadingPanel=document.getElementById('loading');
document.addEventListener('visibilitychange',run);
renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();graphicsLost=true;run();
  if(game.started&&!game.externalSaveChange&&!game.resetting)game.save();
  input.release();
  document.getElementById('loading-label').textContent='Restoring the forest graphics…';
  const retry=document.getElementById('reload-forest');retry.hidden=false;retry.onclick=()=>location.reload();
  loadingPanel.hidden=false;
});
renderer.domElement.addEventListener('webglcontextrestored',()=>{
  graphicsLost=false;loadingPanel.hidden=true;document.getElementById('reload-forest').hidden=true;
  shade.refresh();fitView();game.syncCapture();run();
});
fitView();
loaded = true;
run();
loadingPanel.hidden=true;
await game.audio.preload();
game.ready();
block.ready();
window.lab.ready = true;
// for the measuring tools
window.__block = { ready: true, block, timings, set() {} };
