import * as THREE from 'three';
import { paint } from './figure/figure.js';
import { pinDabs } from './oilpaint/pins.js';
import { AXES, TREES, upgradeCost, purchase, swingDuration, rewardFor, depositWood } from './economy.js';
import { atWoodRack,homeDistance } from './world/home-site.js';
const $ = id => document.getElementById(id);
const UP = new THREE.Vector3(0,1,0);
import { CHOP_REACH, IMPACT_AT, REGROW_MS, pickTree, chopCount, createTreeFall, treeFallPose, chopContact, chooseSwing } from './mechanics.js';
import { readSave, writeSave } from './save.js';
import { ForestAudio } from './audio.js';
import { ChopAnimation } from './figure/chop.js';
import {createAxes,axeIcon} from './figure/axes.js';
import {UnloadAnimation} from './figure/unload.js';
import {beginDelivery,advanceDelivery} from './delivery.js';
const WOOD = [[.94,.73,.4],[.56,.35,.19],[.23,.18,.17]];
const STEEL = [[.87,.92,.89],[.48,.59,.62],[.21,.29,.37]];
const CUT = [[1,.86,.56],[.78,.6,.35],[.4,.3,.21]];
const nice = n => new Intl.NumberFormat('en',{notation:n>=10000?'compact':'standard',maximumFractionDigits:1}).format(n);

export class Lumberjack {
 constructor({scene,camera,renderer,shared,forest,player,input,figure,animator,physics,RAPIER,shade,heightAt,follow,home}) {
  Object.assign(this,{scene,camera,renderer,shared,forest,player,input,figure,animator,physics,RAPIER,shade,heightAt,follow,home});
  try{this.storage=window.localStorage;}catch{this.storage=null;}
  const saved=readSave(this.storage);
  this.state=saved.state;this.saveStatus=saved.status;this.input.sensitivity=.0022*this.state.sensitivity;this.audio=new ForestAudio();this.started=false;this.paused=false;this.held=false;this.swing=null;this.target=null;this.chips=[];this.falling=[];this.time=0;this.uiClock=0;
  this.woodPaint=paint(shared,WOOD);this.cutPaint=paint(shared,CUT);this.steelPaint=paint(shared,STEEL);
  this.chipGeometry=new THREE.BoxGeometry(.035,.025,.13);
  this.makeAxe();
  this.chopAnimation=new ChopAnimation(figure.man,animator,this.axe);
  this.unloadAnimation=new UnloadAnimation({scene,shared,figure,animator,home,axe:this.axe,axePaint:this.axePaint,paint});
  forest.trees.forEach((t,i)=>{t.id=i;t.hp=TREES[t.type].health;if(this.state.down[i]){t.down=true;t.regrow=this.state.down[i];forest.poseTree(t,0,0,1,true);if(t.collider){physics.removeCollider(t.collider,true);t.collider=null;}this.makeStump(t);this.makeLogs(t,Math.sin(t.seed),Math.cos(t.seed));}});
  if(Object.keys(this.state.down).length)shade.refresh();
  this.bind();this.renderHud();this.updateSaveNote();this.applyQuality();
 }
 save(){
  const ok=writeSave(this.storage,this.state);this.saveStatus=ok?'saved':'unavailable';
  this.updateSaveNote();
  if(!ok&&!this.saveWarned){this.toast('Progress cannot be saved in this browser.');this.saveWarned=true;}
 }
 updateSaveNote(){
  const text=this.saveStatus==='unavailable'?'Progress lasts while this tab stays open.':this.saveStatus==='recovered'?'Recovered your previous save.':this.saveStatus==='damaged'?'Your save was unreadable. Starting a new woodpile.':'Saved on this device.';
  document.querySelector('.panel-note').textContent=text;
 }
 makeAxe(){
  this.tools=createAxes(this.shared,paint);this.axe=this.tools.group;this.axePaint=this.tools.paint;
  this.scene.add(this.axe,this.axePaint.mesh);this.tools.equip(this.state.axe);
 }
 bind(){
  this.touch=matchMedia('(pointer:coarse)').matches;
  document.body.classList.toggle('touch',this.touch);
  if(this.touch)document.querySelector('.intro-foot').textContent='Joystick to move · Drag to look · Hold Chop';
  const syncCapture = () => {
    const captured=this.input.active;
    document.body.classList.toggle('mouse-captured',captured);
    $('mouse-capture').hidden=!this.started||this.touch||this.paused||captured;
    $('chop-key').textContent=this.touch?'E':captured?'LMB':'E';
    this.held=false;if(!captured)this.swing=null;
  };
  this.syncCapture=syncCapture;
  document.addEventListener('pointerlockchange',syncCapture);
  document.addEventListener('woodsmoke:mousecapturechange',syncCapture);
  const start=()=>{
    if(this.started)return;
    this.started=true;$('intro').hidden=true;$('hud').hidden=false;$('controls').hidden=false;$('action').hidden=false;$('touch-controls').hidden=!this.touch;
    this.input.lockable=!this.touch;this.input.clear();this.audio.start(this.state.sound)?.then(()=>{if(this.state.sound&&this.audio.loadError)this.toast('Sound could not load. Reload to retry.');});
    if(['recovered','damaged','unavailable'].includes(this.saveStatus))this.toast(document.querySelector('.panel-note').textContent);
    syncCapture();if(!this.touch)this.input.capture();
  };
  $('start').onclick=start;
  $('resume-mouse').onclick=()=>this.input.capture();
  $('upgrade-open').onclick=()=>this.open('upgrades');$('settings-open').onclick=()=>this.open('settings');
  for(const d of document.querySelectorAll('dialog')){
    d.querySelector('.close').onclick=()=>d.close();d.addEventListener('close',()=>{this.paused=false;this.input.lockable=!this.touch;this.input.clear();this.held=false;syncCapture();});
    d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
  }
  $('sensitivity').oninput=e=>{this.state.sensitivity=Number(e.target.value);this.input.sensitivity=.0022*this.state.sensitivity;$('sensitivity-value').textContent=this.state.sensitivity.toFixed(2)+'×';};
  $('sensitivity').onchange=()=>this.save();
  $('sound').onclick=()=>{this.state.sound=!this.state.sound;this.audio.start(this.state.sound);this.save();this.renderSettings();};
  $('quality').onclick=()=>{this.state.low=!this.state.low;this.applyQuality();this.save();this.renderSettings();};
  $('upgrade-list').onclick=e=>{const b=e.target.closest('[data-buy]');if(!b)return;if(purchase(this.state,b.dataset.buy)){this.audio.upgrade();this.save();this.renderHud();this.renderUpgrades();this.toast(b.dataset.buy==='axe'?AXES[this.state.axe].name+' equipped.':b.dataset.buy==='speed'?'Swing speed upgraded.':'Wood yield upgraded.');}};
  addEventListener('keydown',e=>{
    if(e.code==='Enter'&&!this.started){start();return;}
    if(!this.started)return;
    if(['KeyE','Space','KeyU'].includes(e.code))e.preventDefault();
    if(e.code==='KeyU'&&!e.repeat){if($('upgrades').open)$('upgrades').close();else if(!this.paused)this.open('upgrades');}
  });
  addEventListener('blur',()=>{this.held=false;this.swing=null;this.input.release();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.held=false;this.swing=null;this.input.release();this.save();this.audio.context?.suspend();}else if(this.started)this.audio.context?.resume();});
  const chop=$('chop');chop.addEventListener('pointerdown',e=>{e.preventDefault();this.held=true;chop.setPointerCapture(e.pointerId);this.audio.start(this.state.sound);});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])chop.addEventListener(ev,()=>this.held=false);
  let drag=null;
  this.renderer.domElement.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||!this.started||this.paused)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.renderer.domElement.setPointerCapture(e.pointerId);});
  this.renderer.domElement.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;this.input.touchLook.x+=(e.clientX-drag.x)*.003;this.input.touchLook.y+=(e.clientY-drag.y)*.003;drag.x=e.clientX;drag.y=e.clientY;});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])this.renderer.domElement.addEventListener(ev,()=>{drag=null;});
  const stick=$('stick'),knob=stick.querySelector('i');let stickId=null;
  const move=e=>{const r=stick.getBoundingClientRect();let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const len=Math.hypot(x,y);if(len>35){x*=35/len;y*=35/len;}this.input.touchMove={x:x/35,y:-y/35};knob.style.transform=`translate(${x}px,${y}px)`;};
  stick.onpointerdown=e=>{stickId=e.pointerId;stick.setPointerCapture(e.pointerId);move(e);};stick.onpointermove=e=>{if(e.pointerId===stickId)move(e);};
  const stop=()=>{stickId=null;this.input.touchMove={x:0,y:0};knob.style.transform='';};stick.onpointerup=stop;stick.onpointercancel=stop;stick.onlostpointercapture=stop;
 }
 ready(){ $('intro').hidden=false; }
 open(id){if(this.paused||!this.started)return;this.paused=true;this.held=false;this.input.lockable=false;this.input.release();this.syncCapture();if(id==='upgrades')this.renderUpgrades();else this.renderSettings();$(id).showModal();}
 applyQuality(){
  const low=this.state.low;
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:1.5));this.renderer.setSize(innerWidth,innerHeight);
  if(this.frame){this.frame.uniforms.uShafts.value=low?0:1;this.frame.resize();}
  if(this.leaves)this.leaves.mesh.geometry.instanceCount=low?900:2400;
 }
 renderSettings(){ $('sensitivity').value=this.state.sensitivity;$('sensitivity-value').textContent=this.state.sensitivity.toFixed(2)+'×';$('sound').textContent=this.state.sound?'On':'Off';$('sound').setAttribute('aria-pressed',String(this.state.sound));$('quality').textContent=this.state.low?'Low':'High';$('lifetime').textContent=`${nice(this.state.felled)} trees felled · ${nice(this.state.total)} wood gathered`; }
 renderHud(){ this.tools.equip(this.state.axe);this.figure.pack.setWood(this.state.carried);this.home.setWood(this.state.wood);$('wood').textContent=nice(this.state.carried);$('stored-wood').textContent=nice(this.state.wood);$('axe-name').textContent=AXES[this.state.axe].name; }
 renderUpgrades(){
  const s=this.state,next=AXES[s.axe+1];$('panel-wood').textContent=nice(s.wood)+' wood';$('carried-note').textContent=s.carried?`${nice(s.carried)} in your bag. Return to the shack to store it.`:'';
  const rows=[
    ['axe',next?.name||AXES[s.axe].name,next?`${chopCount(TREES[0].health,AXES[s.axe].power)} → ${chopCount(TREES[0].health,next.power)} per beech`:'Maximum axe strength.',`AXE ${s.axe+1} / 5`],
    ['speed','Swing speed',s.speed<4?`${Math.round(60/swingDuration(s))} → ${Math.round(60/swingDuration({...s,speed:s.speed+1}))} swings a minute`:'Maximum swing speed.',`SPEED ${s.speed} / 4`],
    ['yield','Wood yield',s.yield<4?`+${Math.round(s.yield*30)}% → +${Math.round((s.yield+1)*30)}% wood per tree`:'Maximum wood yield.',`YIELD ${s.yield} / 4`]
  ];
  $('upgrade-list').innerHTML=rows.map(([kind,name,desc,level])=>{
    const cost=upgradeCost(s,kind),short=cost===null?0:Math.max(0,cost-s.wood);
    return `<div class="upgrade-row">${kind==='axe'?axeIcon(Math.min(4,s.axe+1)):''}<div class="upgrade-description"><h3>${name}</h3><p>${desc}</p><small>${level}</small></div><div class="buy-wrap"><button class="buy" data-buy="${kind}" ${cost===null||short?'disabled':''} aria-label="${cost===null?'Fully upgraded':`Buy ${name} for ${cost} wood`}">${cost===null?'Complete':nice(cost)+' wood'}</button>${short?`<span class="shortfall">${nice(short)} more needed</span>`:''}</div></div>`;
  }).join('');
  this.updateSaveNote();
 }
 toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
 nearest(){return pickTree(this.forest.trees,this.player.feet,this.follow.yaw,this.camera.position);}
 unload(){
  if(this.delivery||!this.home||!atWoodRack(this.home,this.player.feet))return 0;
  this.delivery=beginDelivery(Math.min(this.state.carried,1e12-this.state.wood));
  if(!this.delivery)return 0;
  this.swing=null;return this.state.carried;
 }
 cancelDelivery(){this.delivery=null;this.figure?.pack.setWood(this.state.carried);}
 updateDelivery(dt){
  const result=advanceDelivery(this.delivery,dt);
  if(result.amount){depositWood(this.state,result.amount);this.renderHud();this.save();this.audio.unload(this.home.dropoff);this.shade.refresh();}
  if(result.done){this.delivery=null;this.toast(this.state.carried?'Wood stacked.':'Wood stacked · Bag empty');}
 }
 before(dt,inp){
  this.time+=dt;
  const inactive=!this.started||this.paused||(!this.touch&&!this.input.active&&inp.device!=='pad');
  if(inactive){inp.move={x:0,y:0};inp.look={x:0,y:0};inp.zoom=0;inp.sprint=false;inp.strafe=false;inp.jump=false;this.held=false;this.swing=null;}
  inp.jump=false;
  this.follow.look(inp.look,dt);inp.look={x:0,y:0};
  const pad=[...(navigator.getGamepads?.()||[])].find(p=>p?.connected);
  const padHeld=pad&&this.started&&!this.paused&&(pad.buttons[7]?.value>.3||pad.buttons[2]?.pressed);
  const near=this.nearest();this.target=near.tree;this.distance=near.distance;
  const moving=Math.hypot(inp.move.x,inp.move.y)>.1;
  if(this.delivery){
    if(inactive||moving||!atWoodRack(this.home,this.player.feet))this.cancelDelivery();
    else{
      const h=this.home.dropoff,yaw=Math.atan2(h.x-this.player.feet.x,h.z-this.player.feet.z);inp.facingYaw=yaw;
      const off=Math.atan2(Math.sin(yaw-this.player.yaw),Math.cos(yaw-this.player.yaw));
      if(Math.abs(off)<.2)this.updateDelivery(dt);
      return;
    }
  }
  // Movement always interrupts. Once contact is committed, let the recovery finish even if the tree falls.
  if(this.swing&&(moving||(!this.swing.hit&&(this.target!==this.swing.t||near.distance>CHOP_REACH))))this.swing=null;
  const held=this.held||padHeld||this.input.keys.has('KeyE')||this.input.keys.has('Space')||(this.input.active&&this.input.mouse.left);
  const unloading=this.home&&atWoodRack(this.home,this.player.feet);
  if(unloading){this.swing=null;if(!inactive&&held&&!moving&&this.player.grounded)this.unload();return;}
  if(!inactive&&held&&!this.swing&&!moving&&this.target&&near.distance<=CHOP_REACH&&this.player.grounded&&this.player.speed<.4){
    const t=this.target,yaw=Math.atan2(t.x-this.player.feet.x,t.z-this.player.feet.z);
    inp.facingYaw=yaw;
    const off=Math.atan2(Math.sin(yaw-this.player.yaw),Math.cos(yaw-this.player.yaw));
    // Turn toward the trunk before lifting the tool, rather than snapping the whole body.
    if(Math.abs(off)<.2){
     const variant=chooseSwing(this.lastSwingVariant,t);this.lastSwingVariant=variant;
     this.swing={t,variant,finishing:t.hp<=AXES[this.state.axe].power,age:0,duration:swingDuration(this.state),hit:false,contact:chopContact(t,this.player.feet,this.player.visualY??this.player.feet.y)};
    }
  }
  if(this.swing){
    const s=this.swing;s.age+=dt;s.poseProgress=Math.min(1,s.age/s.duration);
    inp.facingYaw=Math.atan2(s.t.x-this.player.feet.x,s.t.z-this.player.feet.z);
    if(s.age>=s.duration*IMPACT_AT&&!s.hit){s.hit=true;s.poseProgress=IMPACT_AT;this.hit(s.t);}
    if(s.age>=s.duration)this.swing=null;
  }
 }
 pose(dt=1/60){
  this.chopAnimation.update(dt,this.swing,this.state.axe);this.axePaint.update();this.unloadAnimation.update(dt,this.delivery,this.state);
 }
 makeStump(t){
  if(t.stump)return;const g=new THREE.CylinderGeometry(t.r*.92,t.r*1.25,.44,10);const m=new THREE.Mesh(g,[this.woodPaint,this.cutPaint,this.woodPaint]);m.position.set(t.x,t.y+.18,t.z);this.scene.add(m);t.stump=m;
 }
 makeLogs(t,dx,dz){
  if(t.logs)return;
  t.logs=new THREE.Group();const parts=[];
  for(let i=0;i<3;i++){
    const r=Math.max(.09,t.r*(.75-i*.07)),length=1.4+i*.22;
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r*.88,r,length,9),[this.woodPaint,this.cutPaint,this.cutPaint]);
    const x=t.x+dx*(1.2+i*1.5)+dz*(i-1)*.3,z=t.z+dz*(1.2+i*1.5)-dx*(i-1)*.3;
    m.position.set(x,this.heightAt(x,z)+r,z);
    m.quaternion.setFromUnitVectors(UP,new THREE.Vector3(dx,.02,dz).normalize());
    t.logs.add(m);parts.push({mesh:m,count:70,style:()=>({pal:0,size:[.06,.18],dir:UP})});
  }
  this.scene.add(t.logs);t.logs.updateMatrixWorld(true);
  t.logPaint=pinDabs(this.shared,[WOOD],parts);t.logPaint.update();this.scene.add(t.logPaint.mesh);
 }
 clearRemains(t){
  this.forest.resetCut(t);
  for(const m of [t.stump,t.notch,t.logs,t.logPaint?.mesh])if(m){this.scene.remove(m);m.traverse(o=>o.geometry?.dispose());}
  t.stump=t.notch=t.logs=t.logPaint=null;
 }
 markCut(t,x,y,z,dx,dz){
  const damage=1-t.hp/TREES[t.type].health;
  this.forest.carveTree(t,{x,y,z},-dx,-dz,damage);
 }
 hit(t){
  if(t.down||Math.hypot(this.player.feet.x-t.x,this.player.feet.z-t.z)-t.r>CHOP_REACH+.12)return;
  t.hp=Math.max(0,t.hp-AXES[this.state.axe].power);this.audio.hit(t.type,this.state.axe,t,t.hp<=0);t.shake=this.time;this.impactUntil=this.time+.14;
  const dx=t.x-this.player.feet.x,dz=t.z-this.player.feet.z,len=Math.hypot(dx,dz)||1;
  const {x,y,z}=this.swing?.contact??chopContact(t,this.player.feet,this.player.visualY??this.player.feet.y);
  this.markCut(t,x,y,z,dx/len,dz/len);
  const finishing=t.hp<=0,count=finishing?14:7+(this.swing?.variant??0);
  const scatter=this.swing?.variant===1?.7:.35;
  for(let i=0;i<count;i++){
    const mesh=new THREE.Mesh(this.chipGeometry,this.cutPaint),side=(Math.random()-.5)*(finishing?2.2:1.5)+scatter;
    mesh.position.set(x,y,z);mesh.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);
    mesh.scale.setScalar((finishing?.9:.55)+Math.random()*(finishing?1.4:.9));this.scene.add(mesh);
    const push=.9+Math.random()*(finishing?2.7:1.8);
    this.chips.push({mesh,life:.6+Math.random()*.5,v:new THREE.Vector3(-dx/len*push+dz/len*side,.8+Math.random()*(finishing?2.4:1.7),-dz/len*push-dx/len*side)});
  }
  if(t.hp<=0){
    t.down=true;t.regrow=Date.now()+REGROW_MS;this.state.down[t.id]=t.regrow;this.state.felled++;
    const reward=rewardFor(this.state,t.type);this.state.carried+=reward;this.state.total+=reward;
    if(t.collider){this.physics.removeCollider(t.collider,true);t.collider=null;}
    if(t.notch){this.scene.remove(t.notch);t.notch.geometry.dispose();t.notch=null;}
    this.makeStump(t);this.falling.push({t,age:0,dx:dx/len,dz:dz/len,plan:createTreeFall(t,dx/len,dz/len,this.heightAt),sound:this.audio.beginFall(t)});
    const p=new THREE.Vector3(t.x,t.y+2,t.z).project(this.camera),el=document.createElement('div');el.className='reward';el.textContent=`+${reward} wood`;el.style.left=(p.x*.5+.5)*innerWidth+'px';el.style.top=(-p.y*.5+.5)*innerHeight+'px';document.body.appendChild(el);setTimeout(()=>el.remove(),1600);
    this.renderHud();this.save();if(!this.hinted){this.hinted=true;this.toast('Return to the shack to empty your bag.');}
  }
 }
 update(dt){
  this.audio.listener={x:this.player.feet.x,z:this.player.feet.z,yaw:this.follow.yaw};
  for(let i=this.chips.length-1;i>=0;i--){const c=this.chips[i];c.life-=dt;c.v.y-=9*dt;c.mesh.position.addScaledVector(c.v,dt);c.mesh.rotation.x+=dt*6;if(c.life<.2)c.mesh.scale.multiplyScalar(Math.max(0,1-dt*8));if(c.life<=0){this.scene.remove(c.mesh);this.chips.splice(i,1);}}
  for(let i=this.falling.length-1;i>=0;i--){
    const f=this.falling[i];f.age+=dt;const pose=treeFallPose(f.plan,f.age);
    this.forest.poseTree(f.t,pose.angle,f.dx,f.dz,pose.hidden,pose.sink);
    this.audio.updateFall(f.sound,pose.progress);
    if(pose.landed&&!f.thud){f.thud=true;this.makeLogs(f.t,f.dx,f.dz);this.audio.land(f.sound);this.shade.refresh();}
    if(pose.hidden){this.shade.refresh();this.falling.splice(i,1);}
  }
  for(const t of this.forest.trees){
    if(t.shake&&!t.down){const age=this.time-t.shake;if(age<.3)this.forest.poseTree(t,Math.sin(age*40)*.004*(1-age/.3),1,0);else{this.forest.poseTree(t,0,1,0);t.shake=0;}}
  }
  this.uiClock+=dt;
  if(this.uiClock>.1){this.uiClock=0;this.updatePrompt();}
  if(this.time>(this.nextRegrow||0)){this.nextRegrow=this.time+2;let changed=false;for(const t of this.forest.trees)if(t.down&&Date.now()>=t.regrow){t.down=false;t.hp=TREES[t.type].health;t.shake=0;delete this.state.down[t.id];this.forest.poseTree(t,0,0,1);this.clearRemains(t);t.collider=this.physics.createCollider(this.RAPIER.ColliderDesc.cylinder(5,t.r*1.15).setTranslation(t.x,t.y+4.5,t.z));changed=true;}if(changed){this.shade.refresh();this.save();}}
 }
 updatePrompt(){
  if(this.home){
   const h=this.home.dropoff,dx=h.x-this.player.feet.x,dz=h.z-this.player.feet.z,d=homeDistance(this.home,this.player.feet);
   $('home-marker').hidden=!this.started||this.paused;
   $('home-distance').textContent=`Shack · ${Math.ceil(d)} m`;
   // A compass bearing, relative to the current mouse heading, keeps home easy to find.
   $('home-bearing').style.transform=`rotate(${this.follow.yaw-Math.atan2(dx,dz)}rad)`;
   if(this.started&&!this.paused&&atWoodRack(this.home,this.player.feet)){
    $('target').hidden=true;$('action').hidden=false;$('chop').disabled=!!this.delivery||!this.state.carried;
    $('chop-key').textContent=this.touch?'E':'E / LMB';$('action-text').textContent=this.delivery?'Stacking logs…':this.state.carried?'Empty bag':'Bag empty';
    $('context').textContent=this.delivery?'Move to cancel':`${nice(this.state.wood)} wood stored at the shack`;return;
   }
  }
  $('chop').disabled=false;$('chop-key').textContent=this.touch?'E':this.input.active?'LMB':'E';
  const t=this.target,visible=this.started&&!this.paused&&t&&!t.down;$('target').hidden=!visible;
  $('target').classList.toggle('impact',this.time<(this.impactUntil||0));
  if(!this.started)return;
  if(!visible){$('action').hidden=!this.touch;$('action-text').textContent=this.touch?'Chop':'Hold to chop';$('context').textContent='';return;}
  $('action').hidden=this.paused||(this.distance>CHOP_REACH&&!this.touch);
  const spec=TREES[t.type],near=this.distance<=CHOP_REACH,p=new THREE.Vector3(t.x,t.y+2,t.z).project(this.camera);
  $('target').hidden=p.z>1||p.z<0||Math.abs(p.x)>1||Math.abs(p.y)>1;
  $('target').style.left=`${THREE.MathUtils.clamp((p.x*.5+.5)*innerWidth,70,innerWidth-70)}px`;$('target').style.top=`${THREE.MathUtils.clamp((-p.y*.5+.5)*innerHeight,130,innerHeight-120)}px`;
  $('tree-name').textContent=spec.name;$('tree-health').style.width=`${t.hp/spec.health*100}%`;
  $('tree-meta').textContent=near?`${chopCount(t.hp,AXES[this.state.axe].power)} · ${rewardFor(this.state,t.type)} wood`:`${Math.ceil(this.distance)} m away`;
  $('action-text').textContent=this.touch?'Chop':near?'Hold to chop':'Walk closer';$('context').textContent='';
 }
}
