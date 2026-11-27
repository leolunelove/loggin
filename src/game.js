import {plantTrunk,fallingTrunk,placeSection,sectionBody} from './world/woodland-physics.js';
import {campObjective,chooseBearing} from './camp-guidance.js';
import {woodcraft} from './world/woodcraft.js';
import {createHandcart} from './world/handcart.js';
import {createFieldwork} from './world/fieldwork.js';
import {outpostPage,cartPage,haulStatus} from './woodland-ui.js';
import {PROJECT,FINDS,cartCapacity,useSpecialty,contributeLocal,hireHauler,noteFreight,figuredTree,strokePower,packedLunch,recoveryAge} from './woodland.js';
import {createSettlements} from './world/settlements.js';
import {PLACES,restored,contributePlace} from './exploration.js';
import {weatherAt,shelterAt} from './weather.js';
import {createWeather} from './world/weather.js';
import {seatedPose} from './figure/sit.js';
import {advanceClock,canSleep,sleepUntilMorning,daylightAt,clockLabel,sleepFade} from './daylight.js';
import {contributeFire,contributeMill,beginMilling,advanceMilling,contributePlanks,PROJECTS} from './camp.js';
import {freshState} from './economy.js';
import {WORLD,randomSeed} from './world/seed.js';
import {newCamp,SAVE_KEY} from './save.js';
import * as THREE from 'three';
import { paint } from './figure/figure.js';
import { pinDabs } from './oilpaint/pins.js';
import { AXES, TREES, upgradeCost, purchase, swingDuration, rewardFor, depositWood, bagCapacity, isHardwood, canHarvest, } from './economy.js';
import { atWoodRack,homeDistance } from './world/home-site.js';
const $ = id => document.getElementById(id);
const UP = new THREE.Vector3(0,1,0);
function replaceRows(panel,html,attribute){
  const active=document.activeElement,remembered=panel.contains(active)?active.getAttribute(attribute):null;
  const heading=remembered!=null?active.closest('.project-row,.journal-row,.upgrade-row')?.querySelector('h3')?.textContent:null;
  panel.innerHTML=html;
  if(remembered==null)return;
  const button=Array.from(panel.querySelectorAll('button')).find(b=>!b.disabled&&b.getAttribute(attribute)===remembered);
  if(button){button.focus({preventScroll:true});return;}
  const next=Array.from(panel.querySelectorAll('h3')).find(h=>h.textContent===heading);
  if(next){next.tabIndex=-1;next.focus({preventScroll:true});}
}
import { CHOP_REACH, IMPACT_AT, REGROW_MS, pickTree, chopCount, createTreeFall, treeFallPose, chopContact, chooseSwing, pickAimTree, LOCK_REACH, movingChopContact } from './mechanics.js';
import { readSave, writeSave } from './save.js';
import { ForestAudio } from './audio.js';
import { ChopAnimation } from './figure/chop.js';
import {createAxes,axeIcon} from './figure/axes.js';
import {UnloadAnimation} from './figure/unload.js';
import {beginDelivery,advanceDelivery} from './delivery.js';
const WOOD = [[.94,.73,.4],[.56,.35,.19],[.23,.18,.17]];
const STEEL = [[.87,.92,.89],[.48,.59,.62],[.21,.29,.37]];
const CUT = [[1,.86,.56],[.78,.6,.35],[.4,.3,.21]];
const numbers = [new Intl.NumberFormat('en'), new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1})];
const nice = n => numbers[Number(n>=10000)].format(n);
const dayHaze=new THREE.Color(.6,.6,.67), sunHaze=new THREE.Color(1,.89,.62), dayGlow=new THREE.Color(.1,.08,.02);
const rainHaze=new THREE.Color(.48,.55,.58), rainSun=new THREE.Color(.55,.6,.64), weatherTint=new THREE.Color();
const headings=['S','SE','E','NE','N','NW','W','SW'];

export class Lumberjack {
 constructor({scene,camera,renderer,shared,forest,player,input,figure,animator,physics,RAPIER,shade,heightAt,follow,home}) {
  Object.assign(this,{scene,camera,renderer,shared,forest,player,input,figure,animator,physics,RAPIER,shade,heightAt,follow,home});
  try{this.storage=WORLD.storage===undefined?window.localStorage:WORLD.storage;}catch{this.storage=null;}
  const saved=readSave(this.storage);if(WORLD.state)saved.state=WORLD.state;
  this.state=saved.state;this.saveStatus=saved.status;this.input.sensitivity=.0022*this.state.sensitivity;this.audio=new ForestAudio();this.started=false;this.paused=false;this.held=false;this.swing=null;this.target=null;this.chips=[];this.falling=[];this.time=0;this.uiClock=0;
  this.woodPaint=paint(shared,WOOD);this.cutPaint=paint(shared,CUT);this.steelPaint=paint(shared,STEEL);
  this.chipGeometry=new THREE.BoxGeometry(.035,.025,.13);
  this.looseTimber=new Set();
  this.makeAxe();
  this.playTime=0;
  this.chopAnimation=new ChopAnimation(figure.man,animator,this.axe);
  this.unloadAnimation=new UnloadAnimation({scene,shared,figure,animator,home,axe:this.axe,axePaint:this.axePaint,paint});
  forest.trees.forEach((t,i)=>{t.id=i;t.hp=TREES[t.type].health;if(this.state.down[i]){t.down=true;t.regrow=this.state.down[i];forest.poseTree(t,0,0,1,true);if(t.collider){physics.removeCollider(t.collider,true);t.collider=null;}this.makeStump(t);this.makeLogs(t,Math.sin(t.seed),Math.cos(t.seed));}});
  if(Object.keys(this.state.down).length)shade.refresh();
  this.weatherFX=createWeather(shared,home,heightAt);scene.add(this.weatherFX.group);
  const craft=woodcraft(shared);
  this.exploration=createSettlements(this,craft);this.exploration.sync(this.state);
  this.field=createFieldwork(this,craft);this.field.sync();
  this.cart=createHandcart(this,craft);this.cart.update(0);shade.refresh();
  this.bind();this.renderHud();this.updateSaveNote();this.applyQuality();
 }
 save(){
  if(this.resetting||this.externalSaveChange)return;
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
    $('mouse-capture').hidden=!this.started||this.touch||this.paused||captured||!!this.seat;
    $('chop-key').textContent=this.touch?'E':captured?'LMB':'E';
    this.held=false;if(!captured){this.swing=null;this.queuedStroke=null;this.lockedTree=null;}
  };
  this.syncCapture=syncCapture;
  document.addEventListener('pointerlockchange',syncCapture);
  document.addEventListener('woodsmoke:mousecapturechange',syncCapture);
  const start=()=>{
    if(this.started)return;
    this.started=true;$('project-status').hidden=false;$('intro').hidden=true;$('hud').hidden=false;$('controls').hidden=false;$('action').hidden=false;$('touch-controls').hidden=!this.touch;
    this.input.lockable=!this.touch;this.input.clear();this.audio.start(this.state.sound)?.then(()=>{if(this.state.sound&&this.audio.loadError)this.toast('Sound could not load. Reload to retry.');});
    if(['recovered','damaged','unavailable'].includes(this.saveStatus))this.toast(document.querySelector('.panel-note').textContent);
    syncCapture();if(!this.touch)this.input.capture();
  };
  $('start').onclick=start;
  $('ledger-workbench').onclick=()=>{$('ledger').addEventListener('close',()=>this.open('upgrades'),{once:true});$('ledger').close();};
  $('sleep').onclick=()=>{if(!this.insideShack||!canSleep(this.state))return;$('ledger').addEventListener('close',()=>this.beginSleep(),{once:true});$('ledger').close();};
  $('outpost-project').onclick=e=>this.networkAction(e);
  $('cart-project').onclick=e=>this.networkAction(e);
  $('field-action').onclick=()=>{if(this.started&&!this.paused)this.useFieldKey();};
  $('change-outfit').onclick=()=>{$('settings').addEventListener('close',()=>window.dispatchEvent(new CustomEvent('loggin:outfitter',{detail:this})),{once:true});$('settings').close();};
  $('bench-tabs').onclick=e=>{const selected=e.target.closest('[data-bench]');if(!selected)return;
    for(const tab of $('bench-tabs').querySelectorAll('button')){const active=tab===selected;tab.setAttribute('aria-pressed',String(active));$(tab.dataset.bench).hidden=!active;}};
  $('woodland-notes').onclick=e=>{
    const mark=e.target.closest('[data-bearing]');if(!mark)return;
    const id=mark.dataset.bearing,destination=id==='auto'?null:id==='home'?id:Number(id);
    if(typeof destination==='number'&&!this.state.places[destination]?.found)return;
    this.state.destination=destination;this.lastBearing=null;this.save();this.renderUpgrades();
    $('woodland-notes').querySelector('[data-bearing="'+id+'"]')?.focus();
  };
  $('reload-save').onclick=()=>location.reload();
  addEventListener('storage',event=>{if(event.key!==(this.storage?.eventKey||SAVE_KEY)||this.resetting||!event.newValue)return;this.externalSaveChange=true;this.paused=true;this.held=false;this.swing=null;this.input.lockable=false;this.input.release();$('save-conflict').hidden=false;});
  $('changelog-open').onclick=()=>{$('settings').addEventListener('close',()=>this.open('changelog'),{once:true});$('settings').close();};
  $('reset-open').onclick=()=>{$('settings').addEventListener('close',()=>this.open('reset-dialog'),{once:true});$('settings').close();};
  $('reset-confirm').onclick=()=>{this.save();const next=freshState();next.seed=randomSeed();next.appearance={...this.state.appearance};next.low=this.state.low;next.sound=this.state.sound;this.resetting=true;if(newCamp(this.storage,next))location.reload();else{this.resetting=false;this.toast('The camp could not reset. Browser storage is unavailable.');}};
  $('camp-projects').onclick=e=>{
   const button=e.target.closest('[data-camp]');if(!button)return;
   if(homeDistance(this.home,this.player.feet)>14){this.toast('Return to camp to build and use the sawmill.');return;}
   const kind=button.dataset.camp;
   const success=kind==='fire'?contributeFire(this.state):kind==='sawmill'?contributeMill(this.state):kind==='mill'?beginMilling(this.state):contributePlanks(this.state,kind);
   if(success){this.renderHud();this.renderUpgrades();this.save();this.shade.refresh();this.audio.unload(this.home.dropoff);}
  };
  $('resume-mouse').onclick=()=>this.input.capture();
  $('upgrade-open').onclick=()=>this.open('upgrades');$('settings-open').onclick=()=>this.open('settings');
  for(const d of document.querySelectorAll('dialog')){
    d.querySelector('.close').onclick=()=>this.closeToForest(d);
    // Native Escape and transitions to another dialog leave the cursor available.
    d.addEventListener('close',()=>{if(this.paused&&!document.querySelector('dialog[open]'))this.resumeForest(false);});
    d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
  }
  $('sensitivity').oninput=e=>{this.state.sensitivity=Number(e.target.value);this.input.sensitivity=.0022*this.state.sensitivity;$('sensitivity-value').textContent=this.state.sensitivity.toFixed(2)+'×';};
  $('sensitivity').onchange=()=>this.save();
  $('sound').onclick=()=>{this.state.sound=!this.state.sound;this.audio.start(this.state.sound);this.save();this.renderSettings();};
  $('quality').onclick=()=>{this.state.low=!this.state.low;this.applyQuality();this.save();this.renderSettings();};
  $('upgrade-list').onclick=e=>{const b=e.target.closest('[data-buy]');if(!b)return;if(purchase(this.state,b.dataset.buy)){this.audio.upgrade();this.save();this.renderHud();this.renderUpgrades();this.toast(b.dataset.buy==='axe'?AXES[this.state.axe].name+' equipped.':b.dataset.buy==='speed'?'Swing speed upgraded.':'Wood yield upgraded.');}};
  addEventListener('keydown',e=>{
    if(!this.started){if(e.code==='Enter'&&!$('intro').hidden){e.preventDefault();start();}return;}
    if(e.code==='KeyU'&&!e.repeat&&!this.editingClothes&&!this.externalSaveChange){
      if($('upgrades').open){e.preventDefault();this.closeToForest($('upgrades'));}
      else if(!this.paused){e.preventDefault();this.open('upgrades');}
    }
    if(!this.paused&&this.input.active&&['KeyE','Space'].includes(e.code))e.preventDefault();
  });
  addEventListener('blur',()=>{this.held=false;this.swing=null;this.input.release();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.held=false;this.swing=null;this.input.release();this.save();this.audio.context?.suspend();}else if(this.started)this.audio.context?.resume();});
  const chop=$('chop');chop.addEventListener('pointerdown',e=>{e.preventDefault();this.input.pressed.add('Interact');this.held=true;chop.setPointerCapture(e.pointerId);this.audio.start(this.state.sound);});
  chop.addEventListener('click',e=>{if(e.detail===0&&!chop.disabled)this.input.pressed.add('Interact');});
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
 ready(){
  const objective=campObjective(this.state),returning=this.state.felled>0||this.state.shed>0||this.state.wood>0;
  if(returning){$('start').textContent='Back to the woods';document.querySelector('.intro-loop').textContent=objective.title+' · '+objective.detail;}
  $('intro').hidden=false;
 }
 resumeForest(capture){
  if(this.sleeping||this.editingClothes||this.externalSaveChange||this.resetting)return;
  this.paused=false;this.held=false;this.input.clear();this.input.lockable=this.started&&!this.touch;
  this.syncCapture();
  if(capture&&this.input.lockable&&!document.hidden)this.input.capture();
 }
 closeToForest(dialog){
  dialog.close();this.resumeForest(true);
 }
 open(id){if(this.paused||this.sleeping||!this.started)return;this.paused=true;this.held=false;this.input.lockable=false;this.input.release();this.syncCapture();if(id==='field-note'){const f=FINDS[this.findKey];$('find-title').textContent=f.name;$('find-story').textContent=f.story;$('find-reward').textContent=f.reward;}else if(id==='outpost')this.renderOutpost();else if(id==='cart-panel')$('cart-project').innerHTML=cartPage(this);else if(id==='upgrades')this.renderUpgrades();else if(id==='ledger')this.renderLedger();else this.renderSettings();$(id).showModal();}
 applyQuality(){
  const low=this.state.low;
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:1.5));this.renderer.setSize(innerWidth,innerHeight);
  if(this.frame){this.frame.uniforms.uShafts.value=low?0:1;this.frame.resize();}
  if(this.leaves)this.leaves.mesh.geometry.instanceCount=low?900:2400;
 }
 renderOutpost(){
  const i=this.placeIndex;$('outpost-title').textContent=PLACES[i].name;$('outpost-story').textContent=PLACES[i].story;
  replaceRows($('outpost-project'),outpostPage(this.state,i,this.placeTab||'home'),'data-outpost');
 }
 networkAction(e){
  const button=e.target.closest('[data-outpost]');if(!button||button.disabled)return;
  const action=button.dataset.outpost,s=this.state,w=s.woodland,i=this.placeIndex,p=s.places[i],atCart=$('cart-panel').open;
  if(action.startsWith('tab-')){this.placeTab=action.slice(4);this.renderOutpost();$('outpost-project').querySelector('[data-outpost="'+action+'"]')?.focus();return;}
  if(!atCart&&(!p||this.exploration.nearest(this.player.feet)!==i))return;
  if(atCart&&!this.cart.near(this.player.feet))return;
  const bagBefore=s.carried,loadBefore=w.cart.load;
  let changed=false,structure=false;
  if(action==='sleep'&&!atCart&&restored(p)&&canSleep(s)){
    $('outpost').addEventListener('close',()=>this.beginSleep(true),{once:true});$('outpost').close();return;
  }
  if(action==='unload'&&!atCart&&restored(p)){const n=depositWood(s);noteFreight(s,i,n);changed=n>0;}
  else if(action==='hire'&&(atCart||p?.trail===40)){changed=hireHauler(s);if(changed)this.cart.dispatch();}
  else if(atCart){
    if(action==='stow')changed=this.cart.stow()>0;
    if(action==='tip')changed=this.cart.emptyAtDepot();
    if(action==='hitch')changed=this.cart.hitch();
    if(action==='dispatch')changed=this.cart.dispatch();
  } else if(['wood','planks','trail'].includes(action)){changed=contributePlace(s,i,action)>0;structure=changed;}
  else if(Object.hasOwn(PROJECT,action)){changed=contributeLocal(s,i,action);if(changed)this.field.sync();}
  else changed=useSpecialty(s,i,action);
  if(!changed)return;
  if(structure){this.exploration.sync(s);this.field.sync();this.shade.refresh();}
  this.cart.update(0);this.field.syncSupplies();this.campUiKey=null;this.renderHud();this.save();
  if(atCart){replaceRows($('cart-project'),cartPage(this),'data-outpost');if(action==='hitch'||action==='dispatch')this.closeToForest($('cart-panel'));}
  else this.renderOutpost();
  if(action==='meal')this.toast('Orchard lunch · Brisker sprint for three camp hours');
  if(action==='cart')this.toast('Handcart built · Find it at the trail end outside');
  if(action==='hire')this.toast(w.cart.running?'Hauler hired · First round underway':'Hauler hired · Send the cart from a connected trail');
  if(['unload','stow','tip'].includes(action))this.audio.stack(this.player.feet,action==='tip'?loadBefore:bagBefore-s.carried);
  else if(['wood','planks','trail'].includes(action)||Object.hasOwn(PROJECT,action))this.audio.unload(this.player.feet);
 }
 fireTakesFocus(){
  const feet=this.player.feet;if(!this.home?.nearFire?.(feet)||(this.home.dropoff&&atWoodRack(this.home,feet)))return false;
  const hit=this.nearest();if(!hit.tree||hit.distance>CHOP_REACH)return true;
  const fire=this.home.fire.position,tree=hit.tree;
  const forwardX=Math.sin(this.follow.yaw),forwardZ=Math.cos(this.follow.yaw);
  const alignment=p=>{const dx=p.x-feet.x,dz=p.z-feet.z;return (dx*forwardX+dz*forwardZ)/(Math.hypot(dx,dz)||1);};
  const fireAim=alignment(fire),treeAim=alignment(tree);
  if(fireAim<.72||fireAim<treeAim-.035)return false;
  return fireAim>treeAim+.035||Math.hypot(fire.x-feet.x,fire.z-feet.z)<hit.distance;
 }
 workReward(t){return t.windthrow?5+t.section:rewardFor(this.state,t.type)+(figuredTree(t)?6:0);}
 workFits(t){return this.state.carried+this.workReward(t)<=bagCapacity(this.state);}
 workAllowed(t){return !this.state.woodland?.reserved.includes(t.id)&&canHarvest(this.state,t.type);}
 workContact(t,moving){
  const p=this.player.feet,y=this.player.visualY??p.y;
  if(t.windthrow)return {x:t.x-.19*Math.sin(t.g.rotation.y),y:t.y+t.r*1.97,z:t.z-.19*Math.cos(t.g.rotation.y)};
  return (moving?movingChopContact:chopContact)(t,p,y);
 }
 fieldKeyLabel(){
  if(this.cart?.towing||this.cart?.near(this.player.feet))return 'Handcart';
  if(!this.field)return '';const hit=this.nearest(),t=hit.tree;if(t&&hit.distance<=CHOP_REACH+.35&&this.field?.canReserve(t,this.state))return this.state.woodland.reserved.includes(t.id)?'Release tree':'Reserve tree';
  return '';
 }
 useFieldKey(){
  const label=this.fieldKeyLabel();if(!label)return false;
  if(label==='Handcart'){this.open('cart-panel');return true;}
  const ids=this.state.woodland.reserved,id=this.nearest().tree.id,k=ids.indexOf(id);
  if(k>=0)ids.splice(k,1);else ids.push(id);
  this.swing=null;this.field.sync();this.save();this.toast(k>=0?'Tree released for felling':'Tree reserved · A white blaze marks it');return true;
 }
 interactLocal(local){
  const w=this.state.woodland;
  if(local.type==='find'){if(w.finds.includes(local.item.key))return;w.finds.push(local.item.key);this.field.sync();this.findKey=local.item.key;this.open('field-note');}
  else if(local.type==='meal'){if(!useSpecialty(this.state,0,'meal'))return;this.toast('Orchard lunch · Brisker sprint for three camp hours');}
  else {const n=depositWood(this.state);if(!n)return;noteFreight(this.state,local.item.i,n);this.audio.stack(this.player.feet,n);this.toast(n+' logs stacked · Available at every home');}
  this.field.syncSupplies();this.renderHud();this.save();
 }
 renderSettings(){ $('sensitivity').value=this.state.sensitivity;$('sensitivity-value').textContent=this.state.sensitivity.toFixed(2)+'×';$('sound').textContent=this.state.sound?'On':'Off';$('sound').setAttribute('aria-pressed',String(this.state.sound));$('quality').textContent=this.state.low?'Low':'High';$('lifetime').textContent=`${nice(this.state.felled)} trees felled · ${nice(this.state.total)} wood gathered`; }
 renderHud(){ this.tools.equip(this.state.axe);this.figure.pack.setWood(this.state.carried);this.home.setWood(this.state.wood);this.home.setProject(this.state.shed||0);this.home.setCamp?.(this.state);this.syncCampColliders();$('wood').textContent=nice(this.state.carried)+' / '+bagCapacity(this.state);const objective=campObjective(this.state);$('project-status').textContent=objective.title;$('project-status').title=objective.detail; $('stored-wood').textContent=nice(this.state.wood);$('axe-name').textContent=AXES[this.state.axe].name;if($('ledger').open)this.renderLedger();if($('upgrades').open)this.renderStockBalance(); }
 renderStockBalance(){
  const s=this.state;$('panel-wood').textContent=nice(s.wood)+' timber';
  $('stock-breakdown').textContent=nice(s.wood-s.hardwood)+' ordinary · '+nice(s.hardwood)+' hardwood · '+nice(s.planks)+' planks';
  $('carried-note').textContent=s.carried?`${nice(s.carried)} in your bag to stack.`:'';
 }
 renderUpgrades(){
  const s=this.state,next=AXES[s.axe+1];this.renderStockBalance();
  const rows=[
    ['axe',next?.name||AXES[s.axe].name,next?`${chopCount(TREES[0].health,AXES[s.axe].power)} → ${chopCount(TREES[0].health,next.power)} per beech`:'Maximum axe strength.',`AXE ${s.axe+1} / 5`],
    ['speed','Swing speed',s.speed<4?`${Math.round(60/swingDuration(s))} → ${Math.round(60/swingDuration({...s,speed:s.speed+1}))} swings a minute`:'Maximum swing speed.',`SPEED ${s.speed} / 4`],
    ['yield','Wood yield',s.yield<4?`+${Math.round(s.yield*30)}% → +${Math.round((s.yield+1)*30)}% wood per tree`:'Maximum wood yield.',`YIELD ${s.yield} / 4`]
  ];
  const toolsHtml=rows.map(([kind,name,desc,level])=>{
    const cost=upgradeCost(s,kind), needsHard=cost!==null&&kind==='axe'&&s.axe>=1;
    const hardShort=needsHard?Math.max(0,8-s.hardwood):0, short=cost===null?0:Math.max(0,cost-s.wood);
    const costText=cost===null?'Complete':nice(cost)+' timber';
    const shortage=[short&&nice(short)+' timber',hardShort&&nice(hardShort)+' hardwood'].filter(Boolean).join(' · ');
    const terms=needsHard?'Includes 8 hardwood':'';
    return `<div class="upgrade-row">${kind==='axe'?axeIcon(Math.min(4,s.axe+1)):''}<div class="upgrade-description"><h3>${name}</h3><p>${desc}</p><small>${level}</small></div><div class="buy-wrap"><button class="buy" data-buy="${kind}" ${cost===null||short||hardShort?'disabled':''} aria-label="${cost===null?'Fully upgraded':`Buy ${name} for ${cost} timber${needsHard?', including 8 hardwood':''}`}">${costText}</button>${terms?`<span class="price-note">${terms}</span>`:''}${shortage?`<span class="shortfall">Need ${shortage}</span>`:''}</div></div>`;
  }).join('');
  replaceRows($('upgrade-list'),toolsHtml,'data-buy');
  const w=s.woodland;
  const pin=(id,label)=>`<button class="journal-button bearing-choice" data-bearing="${id??'auto'}" aria-pressed="${s.destination===id}">${label}</button>`;
  $('woodland-notes').innerHTML='<section class="journal-row"><h3>Compass bearing</h3><p>With timber in your bag, follow the nearest open drop. Mark a home to keep it in sight.</p>'+pin(null,'Automatic')+pin('home','My shack')+'</section>'+PLACES.map((place,i)=>{
    const p=s.places[i],body=p.found?(restored(p)?['Apple kitchen · Lunch each morning','East-bank expedition rack','Axes and cart fittings'][i]:'Repair the home with 24 logs and 8 planks'):['Look west for three apple trees.','Follow the river north to the landing.','Find the ridge beyond the orchard.'][i];
    return '<section class="journal-row"><h3>'+(p.found?place.name:['Orchard','River stop','Logging lodge'][i])+'</h3><p>'+body+'</p>'+(p.found?'<p>'+p.trail+' / 40 trail logs</p>'+pin(i,s.destination===i?'Marked on compass':'Mark on compass'):'')+'</section>';
  }).join('')+'<section class="journal-row"><h3>Field notes</h3><p>'+w.reserved.length+' reserved trees · '+w.finds.length+' / 3 discoveries</p>'+w.finds.map(k=>'<p>'+FINDS[k].name+' · '+FINDS[k].reward+'</p>').join('')+(w.cart.built?'<p>'+haulStatus(s)+'</p>':'')+'</section>';
  this.renderCamp();this.updateSaveNote();
 }
 syncCampColliders(){
  if(!this.physics||!this.RAPIER)return;
  this.campBodies??=new Map();
  for(const c of this.home.campColliders||[]){const exists=this.campBodies.get(c),wanted=c.until?this.state[c.key]<c.stage:this.state[c.key]>=c.stage;
   if(wanted&&!exists)this.campBodies.set(c,this.physics.createCollider(this.RAPIER.ColliderDesc.cuboid(c.hx,c.hy,c.hz).setTranslation(c.x,c.y,c.z)));
   if(!wanted&&exists){this.physics.removeCollider(exists,true);this.campBodies.delete(c);}
  }
 }
 renderLedger(){
  const s=this.state;
  $('sleep').disabled=!this.insideShack||!canSleep(s);$('sleep-note').textContent=canSleep(s)?'Rest until 06:30. Your bag and supplies stay safe.':'Come back after 18:00 to turn in for the night.';
  $('ledger-supplies').innerHTML=[['Ordinary logs',Math.max(0,s.wood-s.hardwood)],['Hardwood',s.hardwood||0],['Planks',s.planks||0],['In your bag',`${s.carried} / ${bagCapacity(s)}`]].map(([label,value])=>`<div><span>${label}</span><strong>${typeof value==='number'?nice(value):value}</strong></div>`).join('');
  $('ledger-network').textContent=(s.woodland.cart.built?haulStatus(s)+' · ':'')+s.woodland.reserved.length+' reserved trees · '+s.woodland.finds.length+' / 3 woodland finds';
  $('ledger-history').textContent=this.state.places.filter(p=>p.found).length+' / 3 woodland shacks discovered · '+`${nice(s.felled)} ${s.felled===1?'tree':'trees'} felled · ${nice(s.total)} timber gathered · ${AXES[s.axe].name} equipped`;
  const projects=[['Campfire','fire',12,'A warm hearth, crackling logs and a welcoming glow'],['Woodshed','shed',40,'A bigger bag and hardwood access'],['Sawmill','sawmill',40,'Cut logs into planks'],['Camp porch','porch',12,'Faster milling'],['Cabin extension','lodge',24,'A furnished rear room and more bag space']];
  $('ledger-projects').innerHTML=projects.map(([name,key,max,benefit])=>`<div class="ledger-project"><div><h3>${name}</h3><span>${s[key]>=max?'Built':`${s[key]||0} / ${max} ${key==='shed'||key==='fire'?'timber':key==='sawmill'?'hardwood':'planks'}`}</span></div><progress max="${max}" value="${s[key]||0}"></progress><p>${benefit}</p></div>`).join('');
 }
 renderCamp(){
  const s=this.state,near=homeDistance(this.home,this.player.feet)<=14,working=!!s.millJob;
  const key=[s.fire,s.shed,s.sawmill,s.planks,s.porch,s.lodge,s.wood,s.hardwood,near,working,Math.ceil(s.millJob?.remaining||0)].join(':');if(key===this.campUiKey)return;this.campUiKey=key;
  const button=(kind,text,enabled)=>`<button class="buy" data-camp="${kind}" ${enabled&&near?'':'disabled'}>${text}</button>`;
  const buildings=`<p>${near?'Build with supplies stored at camp.':'Return to camp to build and cut planks.'}</p>`+
   `<div class="project-row"><h3>Campfire</h3><progress max="12" value="${s.fire||0}"></progress><p>${s.fire||0} / 12 ordinary logs · A stone hearth, stacked logs, then a roaring fire.</p>${s.fire>=12?'<p>Lit · A warm welcome, day and night.</p>':button('fire','Add up to 4 logs',s.wood-s.hardwood>0)}</div>`+
   (s.shed<40?'<p>First, deliver 40 timber to finish your woodshed.</p>':`<div class="project-row"><h3>Sawmill</h3><progress max="40" value="${s.sawmill}"></progress><p>${s.sawmill} / 40 hardwood · Foundations → frame → cutting bed → roof.</p>${s.sawmill<40?button('sawmill','Build · up to 8 hardwood',s.hardwood>0):`<p>${s.planks} planks stacked · ${Math.max(0,s.wood-s.hardwood)} ordinary logs available.</p>`+button('mill',working?`Sawing… ${Math.ceil(s.millJob.remaining)}s`:'Saw 8 logs → 2 planks',!working&&s.wood-s.hardwood>=8)}</div>`+
   (s.sawmill<40?'':Object.entries(PROJECTS).map(([kind,p])=>`<div class="project-row"><h3>${p.name}</h3><progress max="${p.cost}" value="${s[kind]}"></progress><p>${s[kind]} / ${p.cost} planks · ${kind==='porch'?'A sheltered place to work. Milling speeds up to 2 seconds.':'A larger home and 32 more bag capacity.'}</p>${s[kind]>=p.cost?'<p>Complete</p>':kind==='lodge'&&s.porch<12?'<p>Finish the porch first.</p>':button(kind,'Build · up to 4 planks',s.planks>0)}</div>`).join('')));
  replaceRows($('camp-projects'),buildings,'data-camp');
 }
 toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
 treeVisible(t){
  if(!this.player.castRay)return true;
  const eye=this.camera.position,dir=new THREE.Vector3(t.x-eye.x,(t.y+1.25)-eye.y,t.z-eye.z),length=dir.length();
  if(length<.1)return true;
  const hit=this.player.castRay(eye,dir.multiplyScalar(1/length),length);
  return hit==null||hit>=length-t.r*1.5-.18;
 }
 nearest(){
  const t=this.lockedTree;if(t){const distance=Math.max(0,Math.hypot(t.x-this.player.feet.x,t.z-this.player.feet.z)-t.r);if(!t.down&&distance<=LOCK_REACH)return {tree:t,distance};this.lockedTree=null;}
  const base=pickTree(this.forest.trees,this.player.feet,this.follow.yaw,this.camera.position);
  if(!this.field)return base;
  const fallen=pickTree(this.field.windthrows(),this.player.feet,this.follow.yaw,this.camera.position);
  return fallen.tree&&fallen.distance<base.distance?fallen:base;
 }
 unload(){
  if(this.delivery||!this.home||!atWoodRack(this.home,this.player.feet))return 0;
  this.delivery=beginDelivery(Math.min(this.state.carried,1e12-this.state.wood));
  if(!this.delivery)return 0;
  this.swing=null;return this.state.carried;
 }
 cancelDelivery(){this.delivery=null;this.figure?.pack.setWood(this.state.carried);}
 updateDelivery(dt){
  const result=advanceDelivery(this.delivery,dt);
  if(result.amount){const beforeShed=this.state.shed||0;depositWood(this.state,result.amount);this.renderHud();this.save();this.audio.stack(this.home.dropoff,result.amount);this.shade.refresh();if(beforeShed<40&&this.state.shed>=40){this.delivery.builtShed=true;this.toast('Woodshed built · Bag expanded to 64');}}
  if(result.done){const d=this.delivery;this.delivery=null;
    if(!d.builtShed)this.toast(d.parts.reduce((sum,n)=>sum+n,0)+' timber stacked · '+(this.state.carried?'Shared stock updated':'Bag empty'));
  }
 }
 before(dt,inp){
  this.time+=dt;
  if(this.exploration){
    inp.trailBoost=this.onTrail=this.exploration.onTrail(this.player.feet,this.state)||this.field?.onSteps(this.player.feet);
    inp.provisioned=packedLunch(this.state);
    const i=this.exploration.nearest(this.player.feet),active=this.started&&!this.paused&&!this.sleeping;
    this.indoorPlace=i>=0&&this.exploration.sites[i].contains(this.player.feet)?i:-1;
    if(active&&i>=0&&!this.state.places[i].found){this.state.places[i].found=true;this.campUiKey=null;this.renderHud();this.toast('Discovered '+PLACES[i].name);this.save();}
    if(active&&i>=0&&!this.field?.fieldAction(this.player.feet,this.state)&&(inp.interactPressed||(this.held&&!this.outpostHeld))){this.placeIndex=i;this.placeTab='home';this.open('outpost');}
    this.outpostHeld=this.held;
  }

  if(this.seat){
   if(this.seated&&!this.paused&&(inp.interactPressed||(this.held&&!this.seatActionHeld)||Math.hypot(inp.move.x,inp.move.y)>.15))this.standFromBench();
   this.seatActionHeld=this.held;
   if(this.seated&&!this.paused){this.seat.orbit=THREE.MathUtils.clamp((this.seat.orbit||0)-inp.look.x,-.55,.55);this.seat.tilt=THREE.MathUtils.clamp((this.seat.tilt||0)+inp.look.y,-.5,.65);}
   this.follow.rest=this.seated?{...this.seat.camera,orbit:this.seat.orbit,tilt:this.seat.tilt}:null;
   inp.move={x:0,y:0};inp.look={x:0,y:0};inp.zoom=0;inp.sprint=false;inp.jump=false;this.held=false;this.swing=null;this.lockedTree=null;return;
  }
  const inactive=!this.started||this.paused||this.sleeping||(!this.touch&&!this.input.active&&inp.device!=='pad');
  if(inactive){inp.move={x:0,y:0};inp.look={x:0,y:0};inp.zoom=0;inp.sprint=false;inp.strafe=false;inp.jump=false;this.held=false;this.swing=null;this.lockedTree=null;}
  inp.jump=false;
  this.insideShack=!!this.home?.contains?.(this.player.feet,this.state);
  if(this.insideShack||this.indoorPlace>=0){
   this.swing=null;this.lockedTree=null;if(this.delivery)this.cancelDelivery();inp.walk=true;inp.sprint=false;
   this.follow.look(inp.look,dt);inp.look={x:0,y:0};
   if(this.insideShack&&!inactive&&(inp.interactPressed||(this.held&&!this.indoorActionHeld)))this.open('ledger');
   this.indoorActionHeld=this.held;return;
  }
  this.indoorActionHeld=false;
  if(!inactive&&inp.fieldPressed&&this.useFieldKey())return;
  if(this.cart?.towing){
    this.lockedTree=null;this.swing=null;inp.cartSpeed=this.onTrail?3.5:1.18;inp.strafe=false;inp.sprint=false;
    this.follow.look(inp.look,dt);inp.look={x:0,y:0};return;
  }
  const local=this.field?.fieldAction(this.player.feet,this.state);
  if(local&&!inactive&&(inp.interactPressed||(this.held&&!this.fieldHeld))){
    this.fieldHeld=true;this.swing=null;this.interactLocal(local);return;
  }
  this.fieldHeld=this.held;if(local){this.swing=null;this.follow.look(inp.look,dt);inp.look={x:0,y:0};return;}
  if(this.home?.nearBench?.(this.player.feet,this.state)&&!inactive&&(inp.interactPressed||(this.held&&!this.benchActionHeld))){this.sitOnBench();inp.move={x:0,y:0};inp.jump=false;return;}
  this.benchActionHeld=this.held;
  if(this.fireTakesFocus()&&this.state.fire<12){
   this.swing=null;this.lockedTree=null;this.follow.look(inp.look,dt);inp.look={x:0,y:0};
   const pressed=inp.interactPressed||(this.held&&!this.fireActionHeld);this.fireActionHeld=this.held;
   if(!inactive&&pressed){if(contributeFire(this.state)){this.renderHud();this.save();this.audio.unload(this.home.fire.position);this.toast(this.state.fire>=12?'Campfire lit · Make yourself at home.':`Campfire · ${this.state.fire} / 12 logs`);}else this.toast('Bring ordinary logs home and empty your bag at the wood rack first.');}return;
  }
  this.fireActionHeld=false;
  if(!inactive&&inp.aimPressed){
   if(this.lockedTree)this.lockedTree=null;
   else{const t=pickAimTree(this.field?[...this.forest.trees,...this.field.windthrows()]:this.forest.trees,this.player.feet,this.follow.yaw,this.camera.position);this.lockedTree=t&&this.treeVisible(t)?t:null;}
  }
  if(this.lockedTree)this.nearest();
  if(this.lockedTree){
   const t=this.lockedTree,desired=Math.atan2(t.x-this.player.feet.x,t.z-this.player.feet.z),current=this.follow.aimYaw??this.follow.yaw;
   this.follow.aimYaw=current+Math.atan2(Math.sin(desired-current),Math.cos(desired-current));
   inp.look.x=0;inp.facingYaw=desired;inp.strafe=true;
  }
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
  // A committed stroke follows through while the feet remain free. Reach is checked at impact.
  const held=this.held||padHeld||this.input.keys.has('KeyE')||this.input.keys.has('Space')||(this.input.active&&this.input.mouse.left);
  const unloading=this.home&&atWoodRack(this.home,this.player.feet);
  if(unloading){this.swing=null;if(!inactive&&(inp.interactPressed||held)&&!moving&&this.player.grounded)this.unload();return;}
  if(inp.chopPressed&&!inactive&&!this.swing&&this.target)this.queuedStroke={tree:this.target,until:this.time+.45};
  if(this.queuedStroke&&(inactive||this.time>this.queuedStroke.until||this.target!==this.queuedStroke.tree))this.queuedStroke=null;
  if(!inactive&&(held||this.queuedStroke)&&!this.swing&&(!moving||this.lockedTree)&&this.target&&this.workAllowed(this.target)&&this.workFits(this.target)&&near.distance<=(this.target.windthrow?.94:CHOP_REACH)&&this.player.grounded&&(this.player.speed<.4||this.lockedTree)){
    const t=this.target,yaw=Math.atan2(t.x-this.player.feet.x,t.z-this.player.feet.z);
    inp.facingYaw=yaw;
    const off=Math.atan2(Math.sin(yaw-this.player.yaw),Math.cos(yaw-this.player.yaw));
    // Turn toward the trunk before lifting the tool, rather than snapping the whole body.
    if(Math.abs(off)<.2){
     const heavy=!!inp.sprint&&(t.windthrow||isHardwood(t.type)),variant=heavy?0:t.windthrow?2:chooseSwing(this.lastSwingVariant,t);this.lastSwingVariant=variant;
     this.queuedStroke=null;
     this.swing={t,variant,heavy,finishing:t.hp<=strokePower(this.state,t,AXES[this.state.axe].power,heavy),age:0,duration:swingDuration(this.state)*(heavy?1.28:1),hit:false,contact:this.workContact(t,false)};
    }
  }
  if(this.swing){
    const s=this.swing;inp.walk=true;inp.sprint=false;s.age+=dt;s.poseProgress=Math.min(1,s.age/s.duration);
    inp.facingYaw=Math.atan2(s.t.x-this.player.feet.x,s.t.z-this.player.feet.z);
    if(s.age>=s.duration*IMPACT_AT&&!s.hit){s.hit=true;s.poseProgress=IMPACT_AT;s.missed=s.t.down||Math.hypot(s.t.x-this.player.feet.x,s.t.z-this.player.feet.z)-s.t.r>CHOP_REACH+.12;if(!s.missed)this.hit(s.t);}
    if(s.age>=s.duration)this.swing=null;
  }
 }
 sitOnBench(){
  if(this.seat||this.state.fire<12||!this.home.nearBench(this.player.feet,this.state))return;
  this.seat=this.home.bench;this.seat.orbit=0;this.seat.tilt=0;this.seated=true;this.seatWeight=0;this.seatActionHeld=this.held;this.swing=null;this.lockedTree=null;this.cancelDelivery();this.follow.rest={...this.seat.camera};this.syncCapture();
 }
 standFromBench(){this.seated=false;this.follow.rest=null;this.input.clear();this.held=false;}
 pose(dt=1/60){
  if(this.swing)this.swing.contact=this.workContact(this.swing.t,true);
  this.chopAnimation.update(dt,this.swing,this.state.axe);this.axePaint.update();this.unloadAnimation.update(dt,this.delivery,this.state);this.seatWeight=THREE.MathUtils.clamp((this.seatWeight||0)+(this.seated?dt/.65:-dt/.5),0,1);
  if(this.seat)seatedPose(this.figure.man,this.animator,this.unloadAnimation,this.seat,this.seatWeight*this.seatWeight*(3-2*this.seatWeight));
  this.cart?.pose();this.axe.visible=!this.insideShack&&!this.seat&&!this.cart?.towing;this.axePaint.mesh.visible=this.axe.visible;
  this.figure.pack.group.visible=!this.seat;this.figure.pack.paint.mesh.visible=!this.seat;
  if(this.seat&&!this.seated&&this.seatWeight===0){this.seat=null;this.syncCapture();}
 }
 makeStump(t){
  if(t.stump)return;const g=new THREE.CylinderGeometry(t.r*.92,t.r*1.25,.44,10);const m=new THREE.Mesh(g,[this.woodPaint,this.cutPaint,this.woodPaint]);m.position.set(t.x,t.y+.18,t.z);this.scene.add(m);t.stump=m;
  t.stumpCollider=this.physics.createCollider(this.RAPIER.ColliderDesc.cylinder(.21,t.r*1.08).setTranslation(t.x,t.y+.18,t.z));
 }
 makeLogs(t,dx,dz,live=false){
  if(t.logs)return;
  t.logs=new THREE.Group();const parts=[];t.sections=[];
  for(let i=0;i<3;i++){
    const r=Math.max(.09,t.r*(.75-i*.07)),length=1.4+i*.22;
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r*.88,r,length,9),[this.woodPaint,this.cutPaint,this.cutPaint]);
    const x=t.x+dx*(1.2+i*1.5)+dz*(i-1)*.3,z=t.z+dz*(1.2+i*1.5)-dx*(i-1)*.3;
    placeSection(m,x,z,dx,dz,length,r,this.heightAt,live);
    t.sections.push({mesh:m,body:sectionBody(this.physics,this.RAPIER,m,r,length,dx,dz,live)});
    t.logs.add(m);parts.push({mesh:m,count:70,style:()=>({pal:0,size:[.06,.18],dir:UP})});
  }
  this.looseTimber.add(t);this.scene.add(t.logs);t.logs.updateMatrixWorld(true);
  t.logPaint=pinDabs(this.shared,[WOOD],parts);t.logPaint.update();this.scene.add(t.logPaint.mesh);
 }
 updateTimber(){
  for(const tree of this.looseTimber){
    let moved=false;
    for(const part of tree.sections){
      const {mesh,body}=part,sleeping=body.isSleeping();if(sleeping&&part.atRest)continue;
      part.atRest=sleeping;
      const p=body.translation(),q=body.rotation();
      mesh.position.copy(p);mesh.quaternion.copy(q);moved=true;
    }
    if(moved){tree.logs.updateMatrixWorld(true);tree.logPaint.update();}
  }
 }
 clearRemains(t){
  if(t.fallBody){this.physics.removeRigidBody(t.fallBody);t.fallBody=null;}
  if(t.stumpCollider){this.physics.removeCollider(t.stumpCollider,true);t.stumpCollider=null;}
  if(t.sections){for(const {body} of t.sections)this.physics.removeRigidBody(body);this.looseTimber.delete(t);t.sections=null;}
  this.field?.clearGrowth(t);this.forest.resetCut(t);
  for(const m of [t.stump,t.notch,t.logs,t.logPaint?.mesh])if(m){this.scene.remove(m);m.traverse(o=>o.geometry?.dispose());}
  t.stump=t.notch=t.logs=t.logPaint=null;
 }
 markCut(t,x,y,z,dx,dz){
  const damage=1-t.hp/TREES[t.type].health;
  this.forest.carveTree(t,{x,y,z},-dx,-dz,damage);
 }
 hit(t){
  if(!this.workAllowed(t)||!this.workFits(t)||t.down||Math.hypot(this.player.feet.x-t.x,this.player.feet.z-t.z)-t.r>CHOP_REACH+.12)return;
  t.hp=Math.max(0,t.hp-strokePower(this.state,t,AXES[this.state.axe].power,this.swing?.heavy));this.audio.hit(t.type,this.state.axe,t,t.hp<=0);t.shake=this.time;this.impactUntil=this.time+.14;
  const dx=t.x-this.player.feet.x,dz=t.z-this.player.feet.z,len=Math.hypot(dx,dz)||1;
  const {x,y,z}=this.swing?.contact??chopContact(t,this.player.feet,this.player.visualY??this.player.feet.y);
  if(!t.windthrow)this.markCut(t,x,y,z,dx/len,dz/len);
  const finishing=t.hp<=0,count=finishing?14:7+(this.swing?.variant??0);
  const scatter=this.swing?.variant===1?.7:.35;
  for(let i=0;i<count;i++){
    const mesh=new THREE.Mesh(this.chipGeometry,this.cutPaint),side=(Math.random()-.5)*(finishing?2.2:1.5)+scatter;
    mesh.position.set(x,y,z);mesh.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);
    mesh.scale.setScalar((finishing?.9:.55)+Math.random()*(finishing?1.4:.9));this.scene.add(mesh);
    const push=.9+Math.random()*(finishing?2.7:1.8);
    this.chips.push({mesh,life:.6+Math.random()*.5,v:new THREE.Vector3(-dx/len*push+dz/len*side,.8+Math.random()*(finishing?2.4:1.7),-dz/len*push-dx/len*side)});
  }
  if(t.windthrow){
    if(t.hp<=0){const amount=this.workReward(t);this.state.woodland.sections[t.job]++;this.state.carried+=amount;this.state.total+=amount;t.down=true;
      this.field.sync();if(this.lockedTree===t)this.lockedTree=null;this.renderHud();this.save();this.toast('Section bucked · +'+amount+' logs');}
    return;
  }
  if(t.hp<=0){
    t.down=true;t.regrow=Date.now()+REGROW_MS;this.state.down[t.id]=t.regrow;this.state.felled++;
    const reward=this.workReward(t);this.state.carried+=reward;if(isHardwood(t.type))this.state.carriedHardwood=(this.state.carriedHardwood||0)+reward;this.state.total+=reward;
    if(t.collider){this.physics.removeCollider(t.collider,true);t.collider=null;}
    if(t.notch){this.scene.remove(t.notch);t.notch.geometry.dispose();t.notch=null;}
    this.makeStump(t);t.fallBody=fallingTrunk(this.physics,this.RAPIER,t);this.falling.push({t,age:0,dx:dx/len,dz:dz/len,plan:createTreeFall(t,dx/len,dz/len,this.heightAt),sound:this.audio.beginFall(t)});
    const p=new THREE.Vector3(t.x,t.y+2,t.z).project(this.camera),el=document.createElement('div');el.className='reward';el.textContent=`+${reward} ${isHardwood(t.type)?'hardwood':'wood'}`;el.style.left=(p.x*.5+.5)*innerWidth+'px';el.style.top=(-p.y*.5+.5)*innerHeight+'px';document.body.appendChild(el);setTimeout(()=>el.remove(),1600);
    this.renderHud();this.save();if(!this.hinted){this.hinted=true;this.toast(this.state.destination==null?'Follow the bearing to stack your timber.':'Stack the timber at a wood rack or a restored home.');}
  }
 }
 beginSleep(outpost=false){
  if(!outpost&&!this.insideShack||!canSleep(this.state))return;
  this.sleeping=true;this.sleepAge=0;this.sleepApplied=false;this.paused=true;this.held=false;this.swing=null;this.input.lockable=false;this.input.release();this.input.clear();this.syncCapture();$('sleep-fade').hidden=false;
 }
 updateDaylight(dt){
  if(this.sleeping){this.sleepAge+=dt;$('sleep-fade').style.opacity=sleepFade(this.sleepAge);
   if(this.sleepAge>=.7&&!this.sleepApplied){this.sleepApplied=true;sleepUntilMorning(this.state);this.save();$('sleep-message').textContent=`Morning · Day ${this.state.day}`;}
   if(this.sleepAge>=2){this.sleeping=false;this.paused=false;this.input.lockable=!this.touch;this.input.clear();$('sleep-fade').hidden=true;$('sleep-message').textContent='Resting at camp…';this.syncCapture();this.toast('A fresh morning in the woods.');}
  }else if(this.started&&!this.paused&&!document.hidden){advanceClock(this.state,dt);this.clockSave=(this.clockSave||0)+dt;if(this.clockSave>=30){this.clockSave=0;this.save();}}
  const light=daylightAt(this.state.hour),u=this.shared;
  u.uDaylight.value=light.daylight;u.uNight.value=light.night;u.uDusk.value=light.dusk;this.audio.daylight=light.daylight;
  u.uHaze.value.setRGB(.035,.055,.1).lerp(dayHaze,light.daylight);
  u.uHazeSun.value.setRGB(.075,.1,.16).lerp(sunHaze,light.daylight);
  u.uHazeGlow.value.setRGB(.005,.008,.015).lerp(dayGlow,light.daylight);
  this.home.updateLighting?.(light.night,this.time,this.state);
  this.dayPhase=light.phase;
 }
 update(dt){
  this.updateDaylight(dt);
  const forecast=this.weatherOverride||weatherAt(this.state);this.weather=forecast;
  const nearPlace=this.exploration.nearest(this.player.feet),weatherHome=nearPlace>=0?this.exploration.sites[nearPlace]:this.home,weatherState=nearPlace>=0?{lodge:0,porch:0,sawmill:0,houseSpec:weatherHome.spec}:this.state;
  const u=this.shared;u.uRain.value=forecast.rain;u.uOvercast.value=forecast.overcast;
  u.uHazeDensity.value=.0118+forecast.rain*.0105+forecast.mist*.038;
  this.forest.updateDistance(this.camera.position);this.field.updateLights(u.uNight.value);
  const active=this.started&&!this.paused&&!document.hidden;
  if(active&&(this.input.active||this.touch||this.seat))this.playTime+=dt;
  if(this.lastSupplyDay!==this.state.day){this.lastSupplyDay=this.state.day;this.field.syncSupplies();}
  const freightBefore=this.state.woodland.cart.load;
  if(this.cart.update(active?dt:0)){
    this.field.syncSupplies();this.save();
    const moved=Math.abs(this.state.woodland.cart.load-freightBefore);
    if(moved)this.audio.stack(this.cart.axle.position,moved);
  }
  u.uHaze.value.lerp(weatherTint.copy(rainHaze).multiplyScalar(.2+.8*u.uDaylight.value),forecast.mist*.55+forecast.rain*.25);
  u.uHazeSun.value.lerp(weatherTint.copy(rainSun).multiplyScalar(.15+.85*u.uDaylight.value),forecast.overcast*.9);u.uHazeGlow.value.multiplyScalar(1-forecast.overcast*.9);
  this.audio.daylight=u.uDaylight.value*(1-forecast.rain);
  this.weatherFX.update(document.hidden?0:dt,this.camera,this.state,forecast,this.state.low,weatherHome.contains(this.player.feet,weatherState),weatherHome,this.state.woodland.projects.shelter===3?this.field.shelter.position:null);

  const room=this.home.updateInterior?.(dt,this.player.feet,this.camera,this.state);
  if(room){this.insideShack=room.inside;this.follow.interior=room.camera;if(room.changed)this.shade.refresh();}
  const away=this.exploration?.update(dt,this.player.feet,this.camera,this.state);if(away){if(away.camera){this.follow.interior=away.camera;this.swing=null;}if(away.changed)this.shade.refresh();}
  this.home.updateMill?.(dt,!!this.state.millJob&&this.started);
  if(this.started&&!this.externalSaveChange&&!document.hidden&&advanceMilling(this.state,dt)){this.renderHud();if($('outpost').open)this.renderOutpost();if($('cart-panel').open)replaceRows($('cart-project'),cartPage(this),'data-outpost');this.save();this.toast('Two planks cut and stacked at the sawmill.');this.audio.unload(this.home.dropoff);}
  if($('upgrades').open&&!$('camp-projects').hidden)this.renderCamp();
  this.audio.listener={x:this.player.feet.x,z:this.player.feet.z,yaw:this.follow.yaw};
  if(this.started)this.audio.updateRain(forecast.rain,Math.max(this.field.dry(this.player.feet)?.82:0,shelterAt(weatherHome.group.position,weatherState,this.player.feet)),!document.hidden);
  this.home.fire?.update(this.time,this.camera,1-this.shared.uDaylight.value);
  if(this.started&&this.home.fire)this.audio.updateFire(this.home.fire.position,this.state.fire>=12&&!document.hidden,this.insideShack);
  for(let i=this.chips.length-1;i>=0;i--){const c=this.chips[i];c.life-=dt;c.v.y-=9*dt;c.mesh.position.addScaledVector(c.v,dt);c.mesh.rotation.x+=dt*6;if(c.life<.2)c.mesh.scale.multiplyScalar(Math.max(0,1-dt*8));if(c.life<=0){this.scene.remove(c.mesh);this.chips.splice(i,1);}}
  this.updateTimber();
  for(let i=this.falling.length-1;i>=0;i--){
    const f=this.falling[i];if(f.t.routeCleared){this.audio.updateFall(f.sound,1);this.falling.splice(i,1);continue;}f.age+=dt;const pose=treeFallPose(f.plan,f.age);
    this.forest.poseTree(f.t,pose.angle,f.dx,f.dz,pose.hidden,pose.sink);
    if(f.t.fallBody){
      const s=Math.sin(pose.angle/2);
      f.t.fallBody.setNextKinematicRotation({x:f.dz*s,y:0,z:-f.dx*s,w:Math.cos(pose.angle/2)});
      if(pose.landed){this.physics.removeRigidBody(f.t.fallBody);f.t.fallBody=null;}
    }
    this.audio.updateFall(f.sound,pose.progress);
    if(pose.landed&&!f.thud){
      f.thud=true;this.makeLogs(f.t,f.dx,f.dz,true);this.audio.land(f.sound);this.shade.refresh();
      const x=f.t.x+f.dx*f.t.h*.66,z=f.t.z+f.dz*f.t.h*.66;
      this.leafKick?.scatter(x,this.heightAt(x,z)+.65,z,{x:f.dx*4,z:f.dz*4},16);
    }
    if(pose.hidden){this.shade.refresh();this.falling.splice(i,1);}
  }
  for(const t of this.forest.trees){
    if(t.shake&&!t.down){const age=this.time-t.shake;if(age<.3)this.forest.poseTree(t,Math.sin(age*40)*.004*(1-age/.3),1,0);else{this.forest.poseTree(t,0,1,0);t.shake=0;}}
  }
  this.uiClock+=dt;
  if(this.uiClock>.1){this.uiClock=0;this.updatePrompt();}
  if(this.time>(this.nextRegrow||0)){this.nextRegrow=this.time+2;let changed=false;const now=Date.now();for(const t of this.forest.trees)if(t.down&&!t.routeCleared&&Number.isFinite(t.regrow)){if(now<t.regrow){const age=recoveryAge(t.regrow,now,REGROW_MS);this.field.restoreGrowth(t,age);
      if(age>.70){if(!t.growingBack){this.forest.resetCut(t);t.growingBack=true;}this.forest.poseTree(t,0,0,1,false,0,.11+.89*THREE.MathUtils.smoothstep(age,.70,1));}
      continue;}t.growingBack=false;t.down=false;t.hp=TREES[t.type].health;t.shake=0;delete this.state.down[t.id];this.forest.poseTree(t,0,0,1);this.clearRemains(t);t.collider=plantTrunk(this.physics,this.RAPIER,t);changed=true;}if(changed){this.shade.refresh();this.save();}}
 }
 updateBearing(){
  const feet=this.player.feet,s=this.state,points=[{id:'home',label:s.carried?'Shack rack':'Shack',position:this.home.dropoff,delivery:true}];
  $('home-marker').hidden=!this.started||this.paused||this.insideShack||!!this.seat;
  if($('home-marker').hidden)return;
  this.exploration?.sites.forEach((site,i)=>{
    if(s.places[i].found)points.push({id:i,label:PLACES[i].name,position:site.dropoff,delivery:restored(s.places[i])});
  });
  for(const rack of this.field?.racks||[])if(rack.built(s))points.push({id:rack.title,label:rack.title,position:rack.g.position,delivery:true});
  const c=s.woodland.cart;
  if(c.built&&!c.running&&!this.cart.towing&&cartCapacity(s)-c.load>=s.carried)
    points.push({id:'cart',label:'Handcart',position:this.cart.axle.position,delivery:true});
  const point=chooseBearing(points,feet,s.carried,s.destination,this.lastBearing);
  this.lastBearing=point.id;
  const dx=point.position.x-feet.x,dz=point.position.z-feet.z;
  $('home-distance').textContent=point.label+' · '+Math.ceil(Math.hypot(dx,dz))+' m'+(this.onTrail?' · Trail +25%':'');
  $('home-bearing').style.transform=`rotate(${this.follow.yaw-Math.atan2(dx,dz)}rad)`;
 }
 updatePrompt(){
  document.body.classList.toggle('rambling',this.started&&!this.paused&&this.playTime>32&&homeDistance(this.home,this.player.feet)>16&&this.state.carried<bagCapacity(this.state));
  const heading=headings[((Math.round(this.follow.yaw/(Math.PI/4))%8)+8)%8];
  const clock='Day '+this.state.day+' · '+clockLabel(this.state)+(this.dayPhase&&this.dayPhase!=='Day'?' · '+this.dayPhase:'')+(packedLunch(this.state)?' · Orchard lunch':'')+' · '+(this.weather?.label||'Clear')+' · '+heading;
  if(this.clockText!==clock){this.clockText=clock;$('camp-clock').textContent=clock;}
  if(this.home)this.updateBearing();
  const fieldLabel=this.fieldKeyLabel();$('field-action').hidden=!this.started||this.paused||!fieldLabel||this.insideShack||!!this.seat;$('field-label').textContent=fieldLabel||'';
  $('aim-crosshair').hidden=!this.started||this.paused||!!this.lockedTree||this.insideShack||!!this.seat;
  $('aim-status').hidden=!this.started||this.paused||this.insideShack||!!this.seat;$('aim-status').textContent=this.lockedTree?'Tree locked · RMB / Q to release':'';
  if(this.seat&&this.started&&!this.paused){$('home-marker').hidden=true;$('target').hidden=true;$('action').hidden=false;$('chop').disabled=!this.seated;$('chop-key').textContent='E / LMB';$('action-text').textContent=this.seated?'Stand up':'Standing up…';$('context').textContent='Take your time · Mouse to look · WASD to stand';return;}
  const local=this.field?.fieldAction(this.player.feet,this.state);
  if(local&&this.started&&!this.paused){$('target').hidden=true;$('action').hidden=false;$('chop').disabled=local.type==='rack'&&!this.state.carried;$('chop-key').textContent='E';$('action-text').textContent=local.title;$('context').textContent=local.note;return;}
  if(this.cart?.towing&&this.started&&!this.paused){$('target').hidden=true;$('action').hidden=true;return;}
  const place=this.exploration?.nearest(this.player.feet)??-1;if(place>=0&&this.started&&!this.paused){$('target').hidden=true;$('action').hidden=false;$('chop').disabled=false;$('chop-key').textContent='E / LMB';$('action-text').textContent=PLACES[place].name;$('context').textContent=restored(this.state.places[place])?'Open the home ledger':'Examine the abandoned home';return;}
  if(this.home?.nearBench?.(this.player.feet,this.state)&&this.started&&!this.paused){$('target').hidden=true;$('action').hidden=false;$('chop').disabled=false;$('chop-key').textContent='E / LMB';$('action-text').textContent='Sit by the fire';$('context').textContent='A quiet moment at camp';return;}
  if(this.insideShack&&this.started&&!this.paused){
   $('home-marker').hidden=true;$('target').hidden=true;$('action').hidden=false;$('chop').disabled=false;$('chop-key').textContent='E / LMB';$('action-text').textContent='Camp ledger & rest';$('context').textContent='Your supplies, tools and building progress';return;
  }
  if(this.home){
   if(this.started&&!this.paused&&atWoodRack(this.home,this.player.feet)){
    $('target').hidden=true;$('action').hidden=false;$('chop').disabled=!!this.delivery||!this.state.carried;
    $('chop-key').textContent=this.touch?'E':'E / LMB';$('action-text').textContent=this.delivery?'Stacking logs…':this.state.carried?'Empty bag':'Bag empty';
    $('context').textContent=this.delivery?'Move to cancel':`${nice(this.state.wood)} timber in shared stock`;return;
   }
  }
  if(this.fireTakesFocus()&&this.started&&!this.paused){$('target').hidden=true;$('action').hidden=false;$('chop').disabled=this.state.fire>=12;$('chop-key').textContent='E / LMB';$('action-text').textContent=this.state.fire>=12?'Campfire burning':'Build campfire';$('context').textContent=this.state.fire>=12?'A warm place to linger':`${this.state.fire||0} / 12 ordinary logs · Uses wood stored at camp`;return;}
  if(this.home?.nearDoor?.(this.player.feet)&&this.started&&!this.paused){$('target').hidden=true;$('action').hidden=false;$('chop').disabled=true;$('chop-key').textContent='WASD';$('action-text').textContent='Walk inside';$('context').textContent='The door opens as you approach';return;}
  $('chop').disabled=false;$('chop-key').textContent=this.touch?'E':this.input.active?'LMB':'E';
  const t=this.target,visible=this.started&&!this.paused&&t&&!t.down;$('target').hidden=!visible;
  $('target').classList.toggle('locked',!!this.lockedTree);
  $('target').classList.toggle('impact',this.time<(this.impactUntil||0));
  if(!this.started)return;
  if(!visible){$('action').hidden=!this.touch;$('action-text').textContent=this.touch?'Chop':'Hold to chop';$('context').textContent='';return;}
  $('action').hidden=this.paused||(this.distance>CHOP_REACH&&!this.touch);
  const spec=TREES[t.type],near=this.distance<=(t.windthrow?.94:CHOP_REACH),p=new THREE.Vector3(t.x,t.y+2,t.z).project(this.camera);
  $('target').hidden=p.z>1||p.z<0||Math.abs(p.x)>1||Math.abs(p.y)>1;
  $('target').style.left=`${THREE.MathUtils.clamp((p.x*.5+.5)*innerWidth,70,innerWidth-70)}px`;$('target').style.top=`${THREE.MathUtils.clamp((-p.y*.5+.5)*innerHeight,130,innerHeight-120)}px`;
  $('tree-name').textContent=(t.windthrow?'Fallen trunk':figuredTree(t)?(t.type===3?'Curly maple':'Figured oak'):spec.name)+(this.lockedTree?' · Locked':'');$('tree-health').style.width=`${t.hp/(t.maxHp||spec.health)*100}%`;
  $('tree-meta').textContent=near?`${chopCount(t.hp,strokePower(this.state,t,AXES[this.state.axe].power))} · ${this.workReward(t)} wood`:`${Math.ceil(this.distance)} m away`;
  const locked=!canHarvest(this.state,t.type),full=!this.workFits(t),reserved=this.state.woodland.reserved.includes(t.id);if(reserved){$('chop').disabled=true;$('action-text').textContent='Reserved tree';$('context').textContent='A keeper for this clearing';return;}$('chop').disabled=locked||full;$('action-text').textContent=locked?'Hardwood locked':full?'Return to camp':this.touch?'Chop':near?'Hold to chop':'Walk closer';$('context').textContent=locked?'Build the woodshed and equip the felling axe':full?'This tree’s full yield will not fit. Empty your bag first.':t.windthrow?'Cut along the chalk ring · Hold Shift for a heavy stroke':isHardwood(t.type)?(figuredTree(t)?'Figured grain · Extra hardwood · ':'Hardwood · ')+'Shift + chop for a heavy stroke':'';
 }
}
