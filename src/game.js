import {AWAITING_COLLECTION,CARRY_LENGTH} from './timber-harvest.js';
import {pickupTarget,pickupPoint} from './world/gather.js';
import {poseLift,finishLift} from './figure/timber-lift.js';
import {awardWork,awardBranch,logCut,skillProgress,ensureOrder} from './woodcutting.js';
import {skillsPage} from './woodcutting-ui.js';
import {facesWork,looseAim,openAim,waterContact,nudgeSection,shoulderSight} from './world/axe-contact.js';
import {Endurance} from './effort.js';
import {PATCH_FILES} from './exploration.js';
import {plantTrunk} from './world/woodland-physics.js';
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
import {FallenTree} from './world/fallen-tree.js';
import {workStance,stepIntoStance} from './figure/work-stance.js';
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
import {AxeOwner,HeldAxe,bitesWood} from './figure/held-axe.js';
import {recordBarkStrike} from './world/bark-cut.js';
import {setCutPlane} from './figure/cut-plane.js';
import {NearbyBark} from './world/axe-bark.js';
import {woodChip,throwChips,stepChips} from './figure/wood-chips.js';
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
  this.woodPaint=paint(shared,WOOD,{material:'bark'});this.cutPaint=paint(shared,CUT,{material:'endgrain'});this.steelPaint=paint(shared,STEEL);
  this.chalkPaint=new THREE.MeshBasicMaterial({color:0xe6d6ae,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
  this.chipGeometry=woodChip();
  this.looseTimber=new Set();ensureOrder(this.state);this.player.endurance=new Endurance(this.state.stamina);
  this.makeAxe();
  this.playTime=0;
  this.chopAnimation=new ChopAnimation(figure.man,animator,this.axe);
  this.heldAxe=new HeldAxe(physics,RAPIER,player.collider,heightAt);player.heldAxe=this.heldAxe;
  this.axeOwner=new AxeOwner(RAPIER);this.stowWeight=this.state.axeStowed?1:0;
  this.nearbyBark=new NearbyBark(physics,RAPIER,forest);
  this.unloadAnimation=new UnloadAnimation({scene,shared,figure,animator,home,paint});
  forest.trees.forEach((t,i)=>{
    t.id=i;t.hp=TREES[t.type].health;
    if(this.state.down[i]){
      t.down=true;t.regrow=this.state.down[i];forest.poseTree(t,0,0,1,true);
      if(t.collider){physics.removeCollider(t.collider,true);t.collider=null;}
      this.makeStump(t);this.makeFallenTree(t,t.seed,false);
    }else{
      const cut=this.state.woodcutting.cuts[i];
      if(cut&&cut.hp<t.hp){
        t.hp=cut.hp;
        forest.carveTree(t,cut,cut.nx,cut.nz,1-t.hp/TREES[t.type].health);
      }
    }
  });
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
  if(this.player?.endurance)this.state.stamina=this.player.endurance.value;
  for(const t of this.looseTimber||[])t.fallen?.snapshot();
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
  this.showBenchSection=section=>{
    $('upgrade-title').textContent=section==='skills-page'?'Field book':'Upgrades';
    for(const tab of $('bench-tabs').querySelectorAll('button')){
      const active=tab.dataset.bench===section;tab.setAttribute('aria-pressed',String(active));$(tab.dataset.bench).hidden=!active;
    }
  };
  $('bench-tabs').onclick=e=>{const tab=e.target.closest('[data-bench]');if(tab)this.showBenchSection(tab.dataset.bench);};
  $('skill-hud').onclick=()=>this.openSkills();
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
  $('touch-jump').onclick=()=>{if(this.started&&!this.paused)this.input.pressed.add('Jump');};
  $('resume-mouse').onclick=()=>this.input.capture();
  $('upgrade-open').onclick=()=>{this.showBenchSection('upgrade-list');this.open('upgrades');};$('settings-open').onclick=()=>this.open('settings');
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
    if(e.code==='KeyX'&&!e.repeat&&!this.paused&&this.input.active){
      this.toggleAxe();e.preventDefault();return;
    }
    if(e.code==='KeyK'&&!e.repeat&&this.started&&!this.editingClothes&&!this.externalSaveChange){
      e.preventDefault();
      if($('upgrades').open&&!$('skills-page').hidden)this.closeToForest($('upgrades'));
      else this.openSkills();
      return;
    }
    if(e.code==='KeyU'&&!e.repeat&&!this.editingClothes&&!this.externalSaveChange){
      if($('upgrades').open){e.preventDefault();this.closeToForest($('upgrades'));}
      else if(!this.paused){e.preventDefault();this.open('upgrades');}
    }
    if(!this.paused&&this.input.active&&['KeyE','Space'].includes(e.code))e.preventDefault();
  });
  addEventListener('blur',()=>{this.held=false;this.swing=null;this.input.release();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.held=false;this.swing=null;this.input.release();this.save();this.audio.context?.suspend();}else if(this.started)this.audio.context?.resume();});
  const chop=$('chop');chop.addEventListener('pointerdown',e=>{e.preventDefault();const gather=chop.dataset.action==='gather';this.input.pressed.add(gather?'Gather':'Interact');this.held=!gather;chop.setPointerCapture(e.pointerId);this.audio.start(this.state.sound);});
  chop.addEventListener('click',e=>{if(e.detail===0&&!chop.disabled)this.input.pressed.add(chop.dataset.action==='gather'?'Gather':'Interact');});
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
  const i=this.placeIndex;$('outpost-badge').src='./pennant/'+PATCH_FILES[i]+'.webp';$('outpost-title').textContent=PLACES[i].name;$('outpost-story').textContent=PLACES[i].story;
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
 openSkills(){
  if(!this.started||this.sleeping||(this.paused&&!$('upgrades').open))return;
  this.showBenchSection('skills-page');if(!$('upgrades').open)this.open('upgrades');
 }
 updateSkill(result){
  const p=skillProgress(this.state.woodcutting.xp);
  if(this.displayedXP!==this.state.woodcutting.xp){
    this.displayedXP=this.state.woodcutting.xp;$('skill-level').textContent='Lv '+p.level;
    $('skill-meter').value=p.fraction*100;$('skill-hud').title=p.left?nice(p.left)+' XP to level '+(p.level+1):'Master woodcutter';
  }
  if(!result)return;
  const tag=$('xp-drop'),levelUp=result.level>result.old;
  tag.textContent=levelUp?'Woodcutting level '+result.level:result.bonus?'Order filled · +'+nice(result.xp+result.bonus)+' XP':'+'+result.xp+' Woodcutting XP';
  tag.classList.toggle('level-up',levelUp||!!result.bonus);tag.hidden=false;clearTimeout(this.xpTimer);
  this.xpTimer=setTimeout(()=>{tag.hidden=true;},levelUp||result.bonus?4600:1450);
  if(levelUp){this.toast('Woodcutting level '+p.level+' · Open Skills with K');this.audio.upgrade();}
 }
 renderSettings(){ $('sensitivity').value=this.state.sensitivity;$('sensitivity-value').textContent=this.state.sensitivity.toFixed(2)+'×';$('sound').textContent=this.state.sound?'On':'Off';$('sound').setAttribute('aria-pressed',String(this.state.sound));$('quality').textContent=this.state.low?'Low':'High';$('lifetime').textContent=`${nice(this.state.felled)} trees felled · ${nice(this.state.total)} wood gathered`; }
 renderHud(){ this.updateSkill();this.tools.equip(this.state.axe);this.figure.pack.setWood(this.state.carried);this.figure.pack.setPatches?.(this.state.places);this.home.setWood(this.state.wood);this.home.setProject(this.state.shed||0);this.home.setCamp?.(this.state);this.syncCampColliders();$('wood').textContent=nice(this.state.carried)+' / '+bagCapacity(this.state);const objective=campObjective(this.state);$('project-status').textContent=objective.title;$('project-status').title=objective.detail; $('stored-wood').textContent=nice(this.state.wood);$('axe-name').textContent=AXES[this.state.axe].name;if($('ledger').open)this.renderLedger();if($('upgrades').open)this.renderStockBalance(); }
 renderStockBalance(){
  const s=this.state;$('panel-wood').textContent=nice(s.wood)+' timber';
  $('stock-breakdown').textContent=nice(s.wood-s.hardwood)+' ordinary · '+nice(s.hardwood)+' hardwood · '+nice(s.planks)+' planks';
  $('carried-note').textContent=s.carried?`${nice(s.carried)} in your bag to stack.`:'';
 }
 renderUpgrades(){
  const s=this.state,next=AXES[s.axe+1];this.renderStockBalance();
  const rows=[
    ['axe',next?.name||AXES[s.axe].name,next?`${chopCount(TREES[0].health,strokePower(s,{type:0},AXES[s.axe].power))} → ${chopCount(TREES[0].health,strokePower(s,{type:0},next.power))} per beech`:'Maximum axe strength.',`AXE ${s.axe+1} / 5`],
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
    return '<section class="journal-row patch-row">'+(p.found?'<img src="./pennant/'+PATCH_FILES[i]+'.webp" alt="Earned discovery patch">':'<span class="unknown" aria-hidden="true"></span>')+'<div><h3>'+(p.found?place.name:['Orchard','River stop','Logging lodge'][i])+'</h3><p>'+body+'</p>'+(p.found?'<p>'+p.trail+' / 40 trail logs</p>'+pin(i,s.destination===i?'Marked on compass':'Mark on compass'):'')+'</div></section>';
  }).join('')+'<section class="journal-row"><h3>Field notes</h3><p>'+w.reserved.length+' reserved trees · '+w.finds.length+' / 3 discoveries</p>'+w.finds.map(k=>'<p>'+FINDS[k].name+' · '+FINDS[k].reward+'</p>').join('')+(w.cart.built?'<p>'+haulStatus(s)+'</p>':'')+'</section>';
  ensureOrder(s);$('skills-page').innerHTML=skillsPage(s);this.renderCamp();this.updateSaveNote();
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
  const shed=s.shed||0;
  const shedCard=`<section class="project-card sewn"><img src="./pennant/camp.webp" alt=""><span class="project-kicker">Camp project</span><h3>The woodshed</h3><strong>${shed} / 40</strong><p>${shed===40?'Built · Room for 64 timber.':(40-shed)+' more '+(shed===39?'log':'logs')+' to finish the roof.'}</p><progress aria-label="Woodshed progress" max="40" value="${shed}"></progress></section>`;
  const buildings=shedCard+`<p>${near?'Build with supplies stored at camp.':'Return to camp to build and cut planks.'}</p>`+
   `<div class="project-row"><h3>Campfire</h3><progress max="12" value="${s.fire||0}"></progress><p>${s.fire||0} / 12 ordinary logs · A stone hearth, stacked logs, then a roaring fire.</p>${s.fire>=12?'<p>Lit · A warm welcome, day and night.</p>':button('fire','Add up to 4 logs',s.wood-s.hardwood>0)}</div>`+
   (s.shed<40?'':`<div class="project-row"><h3>Sawmill</h3><progress max="40" value="${s.sawmill}"></progress><p>${s.sawmill} / 40 hardwood · Foundations → frame → cutting bed → roof.</p>${s.sawmill<40?button('sawmill','Build · up to 8 hardwood',s.hardwood>0):`<p>${s.planks} planks stacked · ${Math.max(0,s.wood-s.hardwood)} ordinary logs available.</p>`+button('mill',working?`Sawing… ${Math.ceil(s.millJob.remaining)}s`:'Saw 8 logs → 2 planks',!working&&s.wood-s.hardwood>=8)}</div>`+
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
  this.nearbyBark?.update(this.player.feet);
  this.time+=dt;this.lastDevice=inp.device;
  inp.playing=this.started&&!this.paused&&!this.sleeping&&!(typeof document!=='undefined'&&document.hidden)&&(!!this.seat||this.touch||this.input.active||inp.device==='pad');
  inp.resting=!!this.seated;inp.packLoad=this.state?Math.min(1,this.state.carried/bagCapacity(this.state)):0;
  inp.blockJump=!inp.playing||!!this.seat||!!this.cart?.towing||!!this.delivery||!!this.swing;
  this.follow.shoulder=false;this.sight=null;
  if(this.lift){
    if(!inp.playing||(!this.lift.mesh&&(inp.jump||Math.hypot(inp.move.x,inp.move.y)>.2)))finishLift(this);
    else{
      const p=this.lift.point;inp.facingYaw=Math.atan2(p.x-this.player.feet.x,p.z-this.player.feet.z);
      inp.walk=true;inp.sprint=false;inp.blockJump=true;
      if(!this.lift.mesh)inp.move={x:0,y:0};
      this.follow.look(inp.look,dt);inp.look={x:0,y:0};return;
    }
  }
  const aimedClick=Number.isFinite(inp.clickAngle);
  const toolOnly=inp.aimHeld||aimedClick||inp.sprint&&(inp.swingPressed||this.held||this.input.mouse?.left);
  if(this.exploration){
    inp.trailBoost=this.onTrail=this.exploration.onTrail(this.player.feet,this.state)||this.field?.onSteps(this.player.feet);
    inp.provisioned=packedLunch(this.state);
    const i=this.exploration.nearest(this.player.feet),active=this.started&&!this.paused&&!this.sleeping;
    this.indoorPlace=i>=0&&this.exploration.sites[i].contains(this.player.feet)?i:-1;
    if(active&&i>=0&&!this.state.places[i].found){this.state.places[i].found=true;this.campUiKey=null;this.renderHud();this.toast(PLACES[i].name+' · New bag patch');this.save();}
    if(active&&!toolOnly&&!this.swing&&i>=0&&!this.field?.fieldAction(this.player.feet,this.state)&&(inp.interactPressed||(this.held&&!this.outpostHeld))){this.placeIndex=i;this.placeTab='home';this.open('outpost');}
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
  if(local&&!toolOnly&&!this.swing&&!inactive&&(inp.interactPressed||(this.held&&!this.fieldHeld))){
    this.fieldHeld=true;this.swing=null;this.interactLocal(local);return;
  }
  this.fieldHeld=this.held;
  if(this.home?.nearBench?.(this.player.feet,this.state)&&!toolOnly&&!this.swing&&!inactive&&(inp.interactPressed||(this.held&&!this.benchActionHeld))){this.sitOnBench();inp.move={x:0,y:0};inp.jump=false;return;}
  this.benchActionHeld=this.held;
  if(this.fireTakesFocus()&&this.state.fire<12&&!this.swing&&!toolOnly){
   this.swing=null;this.lockedTree=null;this.follow.look(inp.look,dt);inp.look={x:0,y:0};
   const pressed=inp.interactPressed||(this.held&&!this.fireActionHeld);this.fireActionHeld=this.held;
   if(!inactive&&pressed){if(contributeFire(this.state)){this.renderHud();this.save();this.audio.unload(this.home.fire.position);this.toast(this.state.fire>=12?'Campfire lit · Make yourself at home.':`Campfire · ${this.state.fire} / 12 logs`);}else this.toast('Bring ordinary logs home and empty your bag at the wood rack first.');}return;
  }
  this.fireActionHeld=false;
  this.follow.shoulder=!!(inp.aimHeld&&!inactive&&!this.delivery);
  let clickSight=null;
  if((this.follow.shoulder||aimedClick)&&!inactive&&!this.delivery){
    const surface=shoulderSight(this);
    if(aimedClick)clickSight=setCutPlane({...surface},this.camera,inp.clickAngle);
    if(this.follow.shoulder){
      this.sight=setCutPlane(surface,this.camera,inp.cutAngle??0);inp.strafe=true;
    }
  }
  if(!inactive&&inp.aimPressed){
   if(this.lockedTree)this.lockedTree=null;
   else{const t=this.sight?this.sight.tree:pickAimTree(this.field?[...this.forest.trees,...this.field.windthrows()]:this.forest.trees,this.player.feet,this.follow.yaw,this.camera.position);this.lockedTree=t&&this.treeVisible(t)?t:null;}
  }
  if(this.lockedTree)this.nearest();
  if(this.lockedTree&&!this.follow.shoulder){
   const t=this.lockedTree,desired=Math.atan2(t.x-this.player.feet.x,t.z-this.player.feet.z),current=this.follow.aimYaw??this.follow.yaw;
   this.follow.aimYaw=current+Math.atan2(Math.sin(desired-current),Math.cos(desired-current));
   inp.look.x=0;inp.facingYaw=desired;inp.strafe=true;
  }
  this.follow.look(inp.look,dt);inp.look={x:0,y:0};
  const pad=[...(navigator.getGamepads?.()||[])].find(p=>p?.connected);
  const padHeld=pad&&this.started&&!this.paused&&(pad.buttons[7]?.value>.3||pad.buttons[2]?.pressed);
  if(this.drawStroke&&(inactive||this.time>this.drawStroke.until))this.drawStroke=null;
  const sight=this.drawStroke?.sight||this.queuedStroke?.sight||clickSight||this.sight;
  const near=sight?{tree:sight.tree,distance:sight.distance??Infinity}:this.nearest();this.target=near.tree;this.distance=near.distance;
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
  const held=this.held||padHeld||this.input.keys.has('KeyE')||(this.input.active&&this.input.mouse.left)||!!this.drawStroke;
  const freeSwing=!!(inp.swingPressed||this.held||padHeld||(this.input.active&&this.input.mouse.left)||this.drawStroke?.primary);
  const loose=sight?sight.timber:freeSwing&&!this.swing&&!this.lockedTree?looseAim(this.looseTimber||[],this.player.feet,this.follow.yaw,this.follow.pitch||0):null;
  const aimed=this.target&&(sight||this.lockedTree||facesWork(this.target,this.player.feet,this.follow.yaw,this.follow.pitch));
  const looseFirst=loose&&((this.follow.pitch||0)>.30||!aimed||Math.hypot(loose.x-this.player.feet.x,loose.z-this.player.feet.z)<near.distance);
  const inReach=this.target&&(sight?sight.reachable:near.distance<=(this.target.windthrow?.94:CHOP_REACH));
  const primary=freeSwing||this.queuedStroke?.primary;
  const aimAtTree=inReach&&(!primary||aimed);
  const unloading=this.home&&atWoodRack(this.home,this.player.feet);
  if(unloading&&!toolOnly&&(!freeSwing||this.state.carried)){this.swing=null;if(!inactive&&(inp.interactPressed||held)&&!moving&&this.player.grounded)this.unload();return;}
  if(!inactive&&!this.swing&&this.player.grounded&&(inp.gatherPressed||this.input.keys.has('KeyE')&&!freeSwing)){
    const target=pickupTarget(this,sight);
    if(target){
      if(inp.gatherPressed){
        const free=Math.max(0,bagCapacity(this.state)-this.state.carried);
        if(target.amount>free)this.toast('This log needs '+target.amount+(target.amount===1?' space':' spaces')+' · '+free+' free');
        else{
          this.drawStroke=this.queuedStroke=this.lockedTree=null;this.lift={target,point:pickupPoint(target),age:0,mesh:null};
          inp.facingYaw=Math.atan2(this.lift.point.x-this.player.feet.x,this.lift.point.z-this.player.feet.z);inp.blockJump=true;
        }
      }
      return;
    }
  }
  if(!inactive&&!this.swing&&(held||inp.chopPressed)&&(this.state.axeStowed||this.stowWeight>.035)){
    if(this.state.axeStowed){this.state.axeStowed=false;this.save();}
    this.drawStroke={primary:freeSwing,sight,until:this.time+.55};return;
  }
  if((inp.chopPressed||this.drawStroke)&&!inactive&&!this.swing&&aimAtTree&&!looseFirst)this.queuedStroke={tree:this.target,primary:freeSwing,sight,until:this.time+.45};
  if(this.queuedStroke&&(inactive||this.time>this.queuedStroke.until||this.target!==this.queuedStroke.tree))this.queuedStroke=null;
  if(!inactive&&!looseFirst&&!inp.jump&&(held||this.queuedStroke)&&!this.swing&&aimAtTree&&(primary||this.workAllowed(this.target))&&this.player.grounded){
    const t=this.target,aim=sight?.point||t,yaw=Math.atan2(aim.x-this.player.feet.x,aim.z-this.player.feet.z);
    inp.facingYaw=yaw;
    const off=Math.atan2(Math.sin(yaw-this.player.yaw),Math.cos(yaw-this.player.yaw));
    // Turn toward the trunk before lifting the tool, rather than snapping the whole body.
    if(Math.abs(off)<.44){
     const heavy=!!inp.sprint,variant=chooseSwing(this.lastSwingVariant,t);this.lastSwingVariant=variant;
     this.queuedStroke=null;
     this.swing={t,variant,heavy,finishing:t.hp<=strokePower(this.state,t,AXES[this.state.axe].power,heavy),age:0,duration:swingDuration(this.state)*(heavy?1.28:1),hit:false,contact:sight?.point.clone()||this.workContact(t,false),sight};
    }
  }
  if(freeSwing&&!inactive&&!inp.jump&&!this.swing){
    const feet=this.player.feet,pitch=this.follow.pitch||0;
    const mark=sight&&(sight.reachable?sight.point:sight.freePoint);
    const yaw=mark?Math.atan2(mark.x-feet.x,mark.z-feet.z):this.follow.yaw;
    const t=loose||openAim(feet,yaw,pitch);
    const aligning=this.player.grounded&&!looseFirst&&aimAtTree;
    if(!aligning){
      const variant=chooseSwing(this.lastSwingVariant,t);this.lastSwingVariant=variant;this.queuedStroke=null;
      this.swing={t,free:true,yaw,pitch,heavy:!!inp.sprint,variant,age:0,duration:swingDuration(this.state)*(inp.sprint?1.15:.92),hit:false,contact:(mark||t.point).clone(),sight};
    }
  }
  if(this.swing){
    this.drawStroke=null;
    const s=this.swing;inp.blockJump=true;inp.walk=true;inp.sprint=false;
    if(s.stance===undefined)s.stance=workStance(this,s);
    const stepping=stepIntoStance(s.stance,this.player,inp,dt);
    s.age=stepping?Math.min(s.age+dt,.075*s.duration):s.age+dt;s.poseProgress=Math.min(1,s.age/s.duration);
    const work=s.sight?.point||s.t;
    inp.facingYaw=s.free?s.yaw:Math.atan2(work.x-this.player.feet.x,work.z-this.player.feet.z);
    if(s.age>=s.duration*.33&&!s.swished){s.swished=true;this.audio?.brushSound?.('air',this.player.feet,s.heavy?.46:.32);}
    if(s.age>=s.duration)this.swing=null;
  }
 }
 sitOnBench(){
  if(this.seat||this.state.fire<12||!this.home.nearBench(this.player.feet,this.state))return;
  this.seat=this.home.bench;this.seat.orbit=0;this.seat.tilt=0;this.seated=true;this.seatWeight=0;this.seatActionHeld=this.held;this.swing=null;this.lockedTree=null;this.cancelDelivery();this.follow.rest={...this.seat.camera};this.syncCapture();
 }
 standFromBench(){this.seated=false;this.follow.rest=null;this.input.clear();this.held=false;}
 toggleAxe(){
  if(this.seat||this.delivery||this.cart?.towing||this.insideShack||this.indoorPlace>=0)return;
  this.drawStroke=null;this.state.axeStowed=!this.state.axeStowed;this.save();
 }
 swingPoint(s){
  const feet=this.player.feet;
  if(s.sight){
    const mark=s.sight;
    if(mark.body?.isValid())return mark.local.clone().applyQuaternion(mark.body.rotation()).add(mark.body.translation());
    return (mark.reachable?mark.point:mark.freePoint).clone();
  }
  if(!s.free){
    const p=this.workContact(s.t,true);
    if(s.t.windthrow)return p;
    const bias=[.025,.105,-.075,.035,-.115][s.variant]||0;
    p.y+=bias-THREE.MathUtils.clamp(this.follow.pitch||0,-.3,.7)*.34;
    const cut=s.t.cut;
    if(cut&&Math.abs(p.y-cut.y)<.36&&cut.nx*(feet.x-s.t.x)+cut.nz*(feet.z-s.t.z)>0)p.y=THREE.MathUtils.lerp(p.y,cut.y,.62);
    if(s.t.collider){
      const length=Math.hypot(s.t.x-feet.x,s.t.z-feet.z)||1;
      const origin={x:feet.x,y:p.y,z:feet.z},dir={x:(s.t.x-feet.x)/length,y:0,z:(s.t.z-feet.z)/length};
      const depth=s.t.axeBark?.castRay(new this.RAPIER.Ray(origin,dir),length+s.t.r,false);
      const bark=depth!=null&&depth>=0?{x:feet.x+dir.x*depth,y:p.y,z:feet.z+dir.z*depth}:s.t.collider.projectPoint(origin,false).point;
      if(Math.hypot(bark.x-feet.x,bark.z-feet.z)<=CHOP_REACH+.035)return bark;
    }
    return p;
  }
  if(s.t.kind==='air')return openAim(feet,s.yaw,s.pitch).point;
  const body=s.t.part?.body;
  const p=s.t.local&&body?.isValid()?s.t.local.clone().applyQuaternion(body.rotation()).add(body.translation()):s.t.point.clone();
  const dx=p.x-feet.x,dz=p.z-feet.z,d=Math.hypot(dx,dz);
  if(d>CHOP_REACH){p.x=feet.x+dx/d*CHOP_REACH;p.z=feet.z+dz/d*CHOP_REACH;}
  return p;
 }
 brushAlongStroke(s,start,end){
  const yaw=s.free?s.yaw:this.player.yaw;
  const water=!s.splashed&&waterContact(start,end,this.heightAt);
  const spray=!s.brushed&&this.forest.strikeBrush?.(start,water||end);
  if(spray){s.brushed=true;this.leafKick?.scatter(spray.x,spray.y,spray.z,{x:Math.sin(yaw)*4,z:Math.cos(yaw)*4},8);this.audio.brushSound('leaves',spray,.65);}
  if(water){s.splashed=true;this.splash(water);this.audio.brushSound('water',water,.84);}
 }
 axeTouch(hit,driven){
  const speed=-hit.velocity.dot(hit.normal),handle=hit.collider.handle;
  if(speed<(driven?.22:.85)||this.lastTouch?.handle===handle&&this.time-this.lastTouch.time<.28)return;
  this.lastTouch={handle,time:this.time};
  const body=hit.collider.parent();
  if(body?.isDynamic()){
    const strength=Math.min(body.mass()*.3,4.5)*Math.min(1,speed/3);
    body.applyImpulseAtPoint(hit.velocity.clone().normalize().multiplyScalar(strength),hit.point,true);
  }
  this.audio.axeTouch(hit.point,speed,hit.part.name==='haft'||hit.part.name==='neck');
 }
 strikeWorld(s,hit){
  const yaw=s.free?s.yaw:this.player.yaw,handle=hit.collider.handle,p=hit.point;
  s.faceNormal=hit.normal;
  s.contact=p;
  const standing=hit.collider.standingTree||this.forest.trees.find(tr=>tr.collider?.handle===handle);
  const windthrow=this.field?.windthrows().find(tr=>tr.body?.handle===handle);
  if(standing||windthrow){
    const tree=standing||windthrow;this.impactUntil=this.time+.14;s.material='bark';
    if(this.workAllowed(tree)&&!tree.down){this.hit(tree);return;}
    this.audio.hit(tree.type,this.state.axe,p,false,s.heavy,s.energy);
    if(!tree.down)tree.shake=this.time;
    this.edgeChips(p,yaw,3);return;
  }
  for(const tree of this.looseTimber){
    if(tree.stumpCollider?.handle===handle){
      s.material='stump';this.audio.stack(p,7);this.edgeChips(p,yaw,5);this.impactUntil=this.time+.14;return;
    }
    const part=hit.collider.fallenPart;if(!part||part.tree!==tree)continue;
    s.material='section';this.impactUntil=this.time+.14;this.audio.hit(tree.type,this.state.axe,p,false,s.heavy,s.energy);
    this.edgeChips(p,yaw,s.heavy?9:6);if(!part.body.isDynamic())return;
    nudgeSection(part,p,yaw,s.heavy,this.state.axe,hit.velocity);
    const owner=tree.fallen,branch=owner.branchNear(part,owner.local(part,p));
    if(branch&&branch.distance<.095&&owner.cutBranch(part,branch.limb,hit.velocity)){
      this.leafKick?.scatter(p.x,p.y,p.z,{x:Math.sin(yaw)*2,z:Math.cos(yaw)*2},8);
      this.audio.brushSound('leaves',p,.88);this.updateSkill(awardBranch(this.state));this.shade.refresh();this.save();
      this.toast(part.limbs.size?'Branch trimmed · '+part.limbs.size+' left on this length':'Last branch trimmed');return;
    }
    const cut=owner.cut(part,p,s.heavy||this.state.axe>=2?2:1);
    if(cut){
      const work=logCut(this.state,tree,cut);if(work)this.updateSkill(work);
      if(tree.regrow!==AWAITING_COLLECTION){
        tree.regrow=Math.max(tree.regrow,Date.now()+30000);owner.record.until=this.state.down[tree.id]=tree.regrow;
      }
      if(cut.hits===3&&owner.record.harvest)this.toast('Trunk parted · Pick up short, clean logs with E');
      this.shade.refresh();this.save();
    }
    return;
  }
  const cartMaterial=this.cart?.strike?.(hit.collider,p,s.heavy);
  if(cartMaterial){s.material=cartMaterial;if(cartMaterial==='iron')this.audio.brushSound('iron',p,1);else this.audio.stack(p,6);return;}
  const soil=hit.normal.y>.45&&Math.abs(this.heightAt(p.x,p.z)-p.y)<.20;
  s.material=soil?'ground':'wood';
  if(soil){this.leafKick?.scatter(p.x,p.y+.035,p.z,{x:Math.sin(yaw)*2,z:Math.cos(yaw)*2},7);this.audio.brushSound('ground',p,.8);}
  else{this.audio.stack(p,5);this.edgeChips(p,yaw,3);}
 }
 edgeChips(p,yaw,count){throwChips(this,p,-Math.sin(yaw),-Math.cos(yaw),count);}
 splash(p){
  const ring=new THREE.Mesh(new THREE.RingGeometry(.83,1,28),new THREE.MeshBasicMaterial({color:0xc5e2d4,transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.copy(p);ring.position.y+=.025;ring.scale.setScalar(.045);
  this.scene.add(ring);(this.ripples??=[]).push({ring,age:0});
 }
 pose(dt=1/60){
  const s=this.swing;
  if(s&&!s.hit)s.contact=this.swingPoint(s);
  const seated=!!this.seat;
  const previousSeat=this.seatWeight||0;
  this.seatWeight=THREE.MathUtils.clamp(previousSeat+(this.seated?dt/.65:-dt/.5),0,1);
  const onBench=THREE.MathUtils.smoothstep(this.seatWeight,.24,.97);
  if(seated)this.figure.pack.restAtBench(this.seat,onBench);
  const packed=!s&&(this.lift||this.state.axeStowed||this.insideShack||this.indoorPlace>=0||this.delivery||this.cart?.towing||this.seat);
  this.stowWeight=THREE.MathUtils.clamp(this.stowWeight+(packed?dt/.38:-dt/.29),0,1);
  const guards=()=>this.axeOwner.guards(this.figure.man,this.figure.pack,this.figure.headwear??this.figure.hat);
  if(seated)this.heldAxe.stow();
  this.chopAnimation.update(dt,s,this.state.axe,seated?null:this.heldAxe,guards,{weight:this.stowWeight,loop:this.figure.pack.axeLoop},this.sight,this.player);
  const {contact,blade}=this.chopAnimation.metrics;
  const driving=s&&!s.hit&&s.poseProgress>=.34&&s.poseProgress<=.59;
  if(driving&&s.lastEdge){
    s.travel=(s.travel||0)+s.lastEdge.distanceTo(blade);
    this.brushAlongStroke(s,s.lastEdge,contact?.point||blade);
  }
  if(driving&&contact){
    s.hit=true;s.energy=THREE.MathUtils.clamp(-contact.velocity.dot(contact.normal)/5,.25,1);
    const body=contact.collider.parent();
    const follows=body?.isDynamic()?{body,local:contact.point.clone().sub(body.translation()).applyQuaternion(new THREE.Quaternion().copy(body.rotation()).invert())}:null;
    if(bitesWood(contact,s.travel||0))this.strikeWorld(s,contact);
    else{
      s.material=['haft','neck'].includes(contact.part.name)?'haft':contact.part.name==='head'?'poll':'glance';
      s.missed=true;this.axeTouch(contact,true);
    }
    s.age=Math.max(s.age,s.duration*IMPACT_AT);s.poseProgress=s.age/s.duration;
    const wood=s.material==='bark'||s.material==='section';
    s.bite={at:s.age,hold:wood?(s.heavy?.074:.052):.018,normal:contact.normal,point:contact.point,wood,follows,
      position:this.axe.position.clone(),rotation:this.axe.quaternion.clone(),feet:this.player.feet.clone()};
  }else if(contact&&!s?.hit)this.axeTouch(contact,false);
  if(s&&!s.hit&&s.poseProgress>=.55){s.hit=true;s.missed=true;s.material=s.splashed?'water':s.brushed?'leaves':'air';}
  if(s)s.lastEdge=blade;
  this.unloadAnimation.update(dt,this.delivery,this.state);
  if(this.lift)poseLift(this,dt);
  if(seated){
    seatedPose(this.figure.man,this.animator,this.unloadAnimation,this.seat,this.seatWeight*this.seatWeight*(3-2*this.seatWeight));
    const pack=this.figure.pack;pack.restAtBench(this.seat,onBench);
    if(this.stowWeight>=.74){
      pack.axeLoop.getWorldPosition(this.axe.position);pack.axeLoop.getWorldQuaternion(this.axe.quaternion);this.axe.updateMatrixWorld(true);
    }
    if(previousSeat<.94&&this.seatWeight>=.94&&this.state.carried>0)this.audio.axeTouch(pack.group.getWorldPosition(new THREE.Vector3()),.7,true);
  }
  this.cart?.pose();this.axePaint.update();
  if(this.seat&&!this.seated&&this.seatWeight===0){this.seat=null;this.syncCapture();}
 }
 makeStump(t){
  if(t.stump)return;const g=new THREE.CylinderGeometry(t.r*.92,t.r*1.25,.44,10);const m=new THREE.Mesh(g,[this.woodPaint,this.cutPaint,this.woodPaint]);m.position.set(t.x,t.y+.18,t.z);this.scene.add(m);t.stump=m;
  t.stumpCollider=this.physics.createCollider(this.RAPIER.ColliderDesc.cylinder(.21,t.r*1.08).setTranslation(t.x,t.y+.18,t.z));
 }
 makeFallenTree(t,bearing,live,notches){
  const splits=this.state.woodcutting.splits,record=splits[t.id]?.until===t.regrow?splits[t.id]:(splits[t.id]={until:t.regrow,mask:0});
  record.bearing??=bearing;
  if(live)record.harvest={yield:this.workReward(t),limbed:[],taken:[]};
  if(notches?.length)record.notches=notches;
  if(!t.cut&&record.notches?.length){
    const mark=record.notches.at(-1);this.forest.carveTree(t,{...mark,notches:record.notches},mark.nx,mark.nz,1);
  }
  const source=this.forest.fallenWood(t);
  this.forest.poseTree(t,0,1,0,true);
  const direction=record.bearing,dx=Math.sin(direction),dz=Math.cos(direction);
  const plan=createTreeFall(t,dx,dz,this.heightAt);
  t.fallen=new FallenTree(this,t,source,record);t.fallen.begin(live?0:plan.contactAngle,live);
  this.looseTimber.add(t);
  if(live)this.falling.push({t,age:0,dx,dz,plan,sound:this.audio.beginFall(t)});
 }
 updateTimber(){
  let settled=false;
  for(const tree of this.looseTimber)if(tree.fallen.sync())settled=true;
  if(settled){this.shade.refresh();this.save();}
 }
 clearRemains(t){
  if(t.fallen){t.fallen.dispose();t.fallen=null;t.sections=null;this.looseTimber.delete(t);}
  if(t.stumpCollider){this.physics.removeCollider(t.stumpCollider,true);t.stumpCollider=null;}
  delete this.state.woodcutting.splits[t.id];this.field?.clearGrowth(t);this.forest.resetCut(t);
  for(const m of [t.stump,t.notch])if(m){this.scene.remove(m);m.traverse(o=>o.geometry?.dispose());}
  t.stump=t.notch=null;
 }
 hit(t){
  if(!this.workAllowed(t)||t.down||Math.hypot(this.player.feet.x-t.x,this.player.feet.z-t.z)-t.r>CHOP_REACH+.12)return;
  const before=t.hp,power=strokePower(this.state,t,AXES[this.state.axe].power,this.swing?.heavy);
  t.hp=before<=power+.0001?0:before-power;this.audio.hit(t.type,this.state.axe,this.swing?.contact??t,t.hp<=0,this.swing?.heavy,this.swing?.energy);t.shake=this.time;this.impactUntil=this.time+.14;
  const dx=t.x-this.player.feet.x,dz=t.z-this.player.feet.z,len=Math.hypot(dx,dz)||1;
  const {x,y,z}=this.swing?.contact??chopContact(t,this.player.feet,this.player.visualY??this.player.feet.y);
  const point=new THREE.Vector3(x,y,z);
  const face=(!t.windthrow&&this.forest.uncutNormal?.(t,point))||this.swing?.faceNormal,n=Math.hypot(face?.x||0,face?.z||0);
  const nx=n>.5?face.x/n:-dx/len,nz=n>.5?face.z/n:-dz/len;
  const book=this.state.woodcutting,previous=book.cuts[t.id];
  const maximum=t.maxHp||TREES[t.type].health;
  let record={x,y,z,nx,nz},precise=!!previous&&Math.abs(previous.y-y)<.17&&previous.nx*nx+previous.nz*nz>.90;
  if(!t.windthrow){
    const sight=this.swing?.sight;
    const notch=recordBarkStrike(t,point,nx,nz,sight?.cutLine,(before-t.hp)/maximum,sight?.screenPlaneNormal);
    const last=notch.records.at(-1);
    record={x:last.x,y:last.y,z:last.z,nx:last.nx,nz:last.nz,notches:notch.records};
    precise=notch.precise;
    this.forest.carveTree(t,record,last.nx,last.nz,1-t.hp/maximum);this.nearbyBark?.recut(t);
  }
  if(t.hp>0)book.cuts[t.id]={hp:t.hp,...record};else delete book.cuts[t.id];
  const experience=awardWork(this.state,{type:t.type,windthrow:!!t.windthrow,maximum:t.maxHp||TREES[t.type].health,
    before,after:t.hp,precise,figured:figuredTree(t)});
  this.updateSkill(experience);
  if(t.hp>0)this.save();
  const finishing=t.hp<=0;throwChips(this,{x,y,z},nx,nz,finishing?14:7+(this.swing?.variant??0),finishing);
  if(t.windthrow){
    if(t.hp<=0){
      const w=this.state.woodland;w.sections[t.job]++;w.looseSections[t.job]|=1<<t.section;t.down=true;
      this.field.sync();if(this.lockedTree===t)this.lockedTree=null;this.renderHud();this.save();this.toast('Section bucked · E to pack it');
    }
    return;
  }
  if(t.hp<=0){
    t.down=true;t.regrow=AWAITING_COLLECTION;this.state.down[t.id]=t.regrow;this.state.felled++;
    this.nearbyBark?.remove(t);
    if(t.collider){this.physics.removeCollider(t.collider,true);t.collider=null;}
    if(t.notch){this.scene.remove(t.notch);t.notch.geometry.dispose();t.notch=null;}
    this.makeStump(t);this.makeFallenTree(t,Math.atan2(dx,dz),true,record.notches);
    this.renderHud();this.save();this.toast('Tree felled · Trim the branches and buck the trunk at the pale bands');
  }
 }
 beginSleep(outpost=false){
  if(!outpost&&!this.insideShack||!canSleep(this.state))return;
  this.sleeping=true;this.sleepAge=0;this.sleepApplied=false;this.paused=true;this.held=false;this.swing=null;this.input.lockable=false;this.input.release();this.input.clear();this.syncCapture();$('sleep-fade').hidden=false;
 }
 updateDaylight(dt){
  if(this.sleeping){this.sleepAge+=dt;$('sleep-fade').style.opacity=sleepFade(this.sleepAge);
   if(this.sleepAge>=.7&&!this.sleepApplied){this.sleepApplied=true;sleepUntilMorning(this.state);this.player.endurance?.replenish();this.save();$('sleep-message').textContent=`Morning · Day ${this.state.day}`;}
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
  const selected=this.swing?.sight||this.sight;
  this.forest.guideCut?.(this.sight&&!this.swing?.hit?selected:null);
  if(this.sight&&this.reticleAngle!==selected?.screenAngle){
    this.reticleAngle=selected.screenAngle;$('aim-crosshair').style.setProperty('--cut-turn',-this.reticleAngle+'rad');
  }
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
  const cover=Math.max(this.field.dry(this.player.feet)?.82:0,shelterAt(weatherHome.group.position,weatherState,this.player.feet));
  const hearth=this.home.fire?.position,feet=this.player.feet;
  const heat=this.state.fire>=12&&hearth?Math.max(0,1-Math.hypot(feet.x-hearth.x,feet.z-hearth.z)/4.6):0;
  this.figure.weather(dt,forecast.rain,cover>0?1:0,heat);
  if(this.started)this.audio.updateRain(forecast.rain,cover,!document.hidden);
  this.home.fire?.update(this.time,this.camera,1-this.shared.uDaylight.value);
  if(this.started&&this.home.fire)this.audio.updateFire(this.home.fire.position,this.state.fire>=12&&!document.hidden,this.insideShack);
  stepChips(this,dt);
  for(const event of this.player.events.splice(0)){
    if(event.kind!=='land'||event.impact<.1||!this.started)continue;
    this.audio.brushSound('ground',this.player.feet,.25+.5*event.impact);
    if(!this.insideShack&&this.indoorPlace<0)this.leafKick?.scatter(this.player.feet.x,this.player.feet.y+.05,this.player.feet.z,this.player.vel,Math.round(4+event.impact*6));
  }
  for(let i=(this.ripples?.length||0)-1;i>=0;i--){const r=this.ripples[i];r.age+=dt;r.ring.scale.setScalar(.045+r.age*.83);r.ring.material.opacity=Math.max(0,.7-r.age);if(r.age>=.7){this.scene.remove(r.ring);r.ring.geometry.dispose();r.ring.material.dispose();this.ripples.splice(i,1);}}
  this.updateTimber();
  for(let i=this.falling.length-1;i>=0;i--){
    const f=this.falling[i];if(!f.t.fallen){this.audio.updateFall(f.sound,1);this.falling.splice(i,1);continue;}f.age+=dt;const pose=treeFallPose(f.plan,f.age);
    f.t.fallen.fall(pose.angle,pose.landed);
    this.audio.updateFall(f.sound,pose.progress);
    if(pose.landed){
      this.audio.land(f.sound);this.shade.refresh();
      const x=f.t.x+f.dx*f.t.h*.66,z=f.t.z+f.dz*f.t.h*.66;
      this.leafKick?.scatter(x,this.heightAt(x,z)+.65,z,{x:f.dx*4,z:f.dz*4},16);
      this.falling.splice(i,1);
    }
  }
  for(const t of this.forest.trees){
    if(t.shake&&!t.down){const age=this.time-t.shake;if(age<.3)this.forest.poseTree(t,Math.sin(age*40)*.004*(1-age/.3),1,0);else{this.forest.poseTree(t,0,1,0);t.shake=0;}}
  }
  this.uiClock+=dt;
  if(this.uiClock>.1){this.uiClock=0;this.updatePrompt();}
  if(this.time>(this.nextRegrow||0)){this.nextRegrow=this.time+2;let changed=false;const now=Date.now();for(const t of this.forest.trees)if(t.down&&Number.isFinite(t.regrow)&&t.regrow!==AWAITING_COLLECTION){
      if(t.routeCleared){
        if(t.fallen&&now>=t.regrow){delete this.state.down[t.id];this.clearRemains(t);this.forest.poseTree(t,0,0,1,true);changed=true;}continue;
      }
      if(now<t.regrow){const age=recoveryAge(t.regrow,now,REGROW_MS);this.field.restoreGrowth(t,age);
      if(age>.70){if(!t.growingBack){this.forest.resetCut(t);t.growingBack=true;}this.forest.poseTree(t,0,0,1,false,0,.11+.89*THREE.MathUtils.smoothstep(age,.70,1));}
      continue;}t.growingBack=false;t.down=false;t.hp=TREES[t.type].health;t.shake=0;delete this.state.down[t.id];this.forest.poseTree(t,0,0,1);this.clearRemains(t);t.collider=plantTrunk(this.physics,this.RAPIER,t);changed=true;}if(changed){if(this.nearbyBark)this.nearbyBark.last=null;this.shade.refresh();this.save();}}
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
  $('chop').dataset.action='';
  document.body.classList.toggle('rambling',this.started&&!this.paused&&this.playTime>32&&homeDistance(this.home,this.player.feet)>16&&this.state.carried<bagCapacity(this.state));
  const heading=headings[((Math.round(this.follow.yaw/(Math.PI/4))%8)+8)%8];
  const clock='Day '+this.state.day+' · '+clockLabel(this.state)+(this.dayPhase&&this.dayPhase!=='Day'?' · '+this.dayPhase:'')+(packedLunch(this.state)?' · Orchard lunch':'')+' · '+(this.weather?.label||'Clear')+' · '+heading;
  if(this.clockText!==clock){
    this.clockText=clock;$('clock-time').textContent='Day '+this.state.day+' / '+clockLabel(this.state);
    $('clock-sky').textContent=[this.weather?.label||'Clear',heading,this.dayPhase!=='Day'?this.dayPhase:null,packedLunch(this.state)?'Orchard lunch':null].filter(Boolean).join(' · ');
    $('clock-symbol').textContent=this.dayPhase==='Night'?'☾':this.weather?.rain>.45?'☂':'☀';
  }
  const effort=Math.round(this.player.endurance?.value??100);
  if(this.hudEffort!==effort){this.hudEffort=effort;$('stamina').value=effort;$('stamina').textContent=effort+'%';$('stamina-tag').dataset.low=String(effort<24);}
  if(this.home)this.updateBearing();
  const fieldLabel=this.fieldKeyLabel();$('field-action').hidden=!this.started||this.paused||!fieldLabel||this.insideShack||!!this.seat;$('field-label').textContent=fieldLabel||'';
  const reticle=$('aim-crosshair');
  reticle.hidden=!this.started||this.paused||(!this.sight&&!!this.lockedTree)||this.insideShack||this.indoorPlace>=0||!!this.seat;
  reticle.classList.toggle('shoulder',!!this.sight);reticle.classList.toggle('in-reach',!!this.sight?.reachable);
  document.body.classList.toggle('shoulder-view',!!this.sight);
  const aimStatus=$('aim-status');
  aimStatus.hidden=!this.started||this.paused||this.insideShack||!!this.seat;
  if(this.sight){
    const degrees=Math.round(THREE.MathUtils.radToDeg(this.swing?.sight?.screenAngle??this.sight.screenAngle??0))%180;
    const controls=this.lastDevice==='pad'?'D-pad ← →':'Wheel or Z / C';
    aimStatus.textContent=degrees+'°  ·  '+controls+' to turn';
  }else aimStatus.textContent=this.lockedTree?'Tree locked · Q to release':'';
  if(this.seat&&this.started&&!this.paused){$('home-marker').hidden=true;$('target').hidden=true;$('action').hidden=false;$('chop').disabled=!this.seated;$('chop-key').textContent='E / LMB';$('action-text').textContent=this.seated?'Stand up':'Standing up…';$('context').textContent='Take your time · Mouse to look · WASD to stand';return;}
  const local=this.field?.fieldAction(this.player.feet,this.state);
  if(!this.sight&&local&&this.started&&!this.paused){$('target').hidden=true;$('action').hidden=false;$('chop').disabled=local.type==='rack'&&!this.state.carried;$('chop-key').textContent='E';$('action-text').textContent=local.title;$('context').textContent=local.note;return;}
  if(this.cart?.towing&&this.started&&!this.paused){$('target').hidden=true;$('action').hidden=true;return;}
  const place=this.exploration?.nearest(this.player.feet)??-1;if(place>=0&&this.started&&!this.paused){$('target').hidden=true;$('action').hidden=false;$('chop').disabled=false;$('chop-key').textContent='E / LMB';$('action-text').textContent=PLACES[place].name;$('context').textContent=restored(this.state.places[place])?'Open the home ledger':'Examine the abandoned home';return;}
  if(!this.sight&&this.home?.nearBench?.(this.player.feet,this.state)&&this.started&&!this.paused){$('target').hidden=true;$('action').hidden=false;$('chop').disabled=false;$('chop-key').textContent='E / LMB';$('action-text').textContent='Sit by the fire';$('context').textContent='A quiet moment at camp';return;}
  if(this.insideShack&&this.started&&!this.paused){
   $('home-marker').hidden=true;$('target').hidden=true;$('action').hidden=false;$('chop').disabled=false;$('chop-key').textContent='E / LMB';$('action-text').textContent='Camp ledger & rest';$('context').textContent='Your supplies, tools and building progress';return;
  }
  if(this.home){
   if(!this.sight&&this.started&&!this.paused&&atWoodRack(this.home,this.player.feet)){
    $('target').hidden=true;$('action').hidden=false;$('chop').disabled=!!this.delivery||!this.state.carried;
    $('chop-key').textContent=this.touch?'E':'E / LMB';$('action-text').textContent=this.delivery?'Stacking logs…':this.state.carried?'Empty bag':'Bag empty';
    $('context').textContent=this.delivery?'Move to cancel':`${nice(this.state.wood)} timber in shared stock`;return;
   }
  }
  if(!this.sight&&this.fireTakesFocus()&&this.started&&!this.paused){$('target').hidden=true;$('action').hidden=false;$('chop').disabled=this.state.fire>=12;$('chop-key').textContent='E / LMB';$('action-text').textContent=this.state.fire>=12?'Campfire burning':'Build campfire';$('context').textContent=this.state.fire>=12?'A warm place to linger':`${this.state.fire||0} / 12 ordinary logs · Uses wood stored at camp`;return;}
  if(!this.sight&&this.home?.nearDoor?.(this.player.feet)&&this.started&&!this.paused){$('target').hidden=true;$('action').hidden=false;$('chop').disabled=true;$('chop-key').textContent='WASD';$('action-text').textContent='Walk inside';$('context').textContent='The door opens as you approach';return;}
  $('chop').disabled=false;$('chop-key').textContent=this.touch?'Tap':'LMB';
  if(this.lift){$('target').hidden=true;$('action').hidden=false;$('chop').disabled=true;$('action-text').textContent='Packing log…';$('chop-key').textContent='';$('context').textContent='';return;}
  const gather=this.started&&!this.paused&&!this.swing?pickupTarget(this,this.sight):null;
  if(gather){
    const free=Math.max(0,bagCapacity(this.state)-this.state.carried);
    $('target').hidden=true;$('action').hidden=false;$('chop').dataset.action='gather';
    $('chop-key').textContent=this.touch?'Tap':this.lastDevice==='pad'?'Y':'E';
    $('action-text').textContent=gather.amount?(gather.hard?'Pick up hardwood log':'Pick up log'):'Clear brushwood';
    $('context').textContent=gather.amount>free?`Needs ${gather.amount} bag ${gather.amount===1?'space':'spaces'} · ${free} free`:
      gather.amount?`${gather.amount} ${gather.hard?'hardwood':'timber'} · ${free} bag spaces free`:'A small offcut';
    return;
  }
  const t=this.target,aimed=t&&(this.sight||this.lockedTree||facesWork(t,this.player.feet,this.follow.yaw,this.follow.pitch));
  const timber=this.sight?this.sight.timber:!this.lockedTree&&this.started&&!this.paused?looseAim(this.looseTimber||[],this.player.feet,this.follow.yaw,this.follow.pitch):null;
  if(timber&&(!aimed||this.follow.pitch>.30||Math.hypot(timber.x-this.player.feet.x,timber.z-this.player.feet.z)<this.distance)){
    $('target').hidden=true;$('action').hidden=false;$('chop-key').textContent=this.touch?'Tap':'LMB';
    const part=timber.part,branches=part?.limbs?.size||0;
    const short=part?.owner?.record.harvest&&part.length<=CARRY_LENGTH+.001;
    if(timber.kind==='stump'){
      $('action-text').textContent='Strike stump';$('context').textContent='Old end grain';
    }else if(timber.kind==='branch'||short){
      $('action-text').textContent=timber.kind==='branch'?'Chop branch':branches?'Trim branches':'Step closer to pick up';
      $('context').textContent=branches?`${branches} ${branches===1?'branch':'branches'} on this length`:'Stand beside the middle of the log';
    }else{
      $('action-text').textContent=part.length>=.92?'Buck fallen trunk':'Nudge log';
      $('context').textContent=!part.owner?.record.harvest?'Wood already gathered':part.hits?'Strike the same notch again':'Cut near a pale band · Three clean hand-axe hits';
    }
    return;
  }
  const visible=this.started&&!this.paused&&aimed&&!t.down;$('target').hidden=!visible;
  $('target').classList.toggle('locked',this.lockedTree===t&&!!t);
  $('target').classList.toggle('impact',this.time<(this.impactUntil||0));
  if(!this.started)return;
  if(!visible){$('action').hidden=this.paused;$('chop').disabled=false;$('action-text').textContent='Swing axe';$('context').textContent='';return;}
  $('action').hidden=this.paused;
  const spec=TREES[t.type],near=this.sight?this.sight.reachable:this.distance<=(t.windthrow?.94:CHOP_REACH),p=new THREE.Vector3(t.x,t.y+2,t.z).project(this.camera);
  $('target').hidden=p.z>1||p.z<0||Math.abs(p.x)>1||Math.abs(p.y)>1;
  $('target').style.left=`${THREE.MathUtils.clamp((p.x*.5+.5)*innerWidth,70,innerWidth-70)}px`;$('target').style.top=`${THREE.MathUtils.clamp((-p.y*.5+.5)*innerHeight,130,innerHeight-120)}px`;
  $('tree-name').textContent=(t.windthrow?'Fallen trunk':figuredTree(t)?(t.type===3?'Curly maple':'Figured oak'):spec.name)+(this.lockedTree===t?' · Locked':'');$('tree-health').style.width=`${t.hp/(t.maxHp||spec.health)*100}%`;
  $('tree-meta').textContent=near?`${chopCount(t.hp,strokePower(this.state,t,AXES[this.state.axe].power))} · ${this.workReward(t)} wood`:this.sight?.angled?'Face the cut':`${Math.ceil(this.distance)} m away`;
  const locked=!canHarvest(this.state,t.type),reserved=this.state.woodland.reserved.includes(t.id);if(reserved){$('chop').disabled=false;$('action-text').textContent='Reserved tree';$('context').textContent='A keeper for this clearing';return;}$('chop').disabled=false;$('action-text').textContent=locked?'Hardwood locked':near?(t.windthrow?'Buck fallen trunk':'Chop tree'):'Swing axe';$('context').textContent=locked?'Build the woodshed and equip the felling axe':this.sight?.angled?'Aim at the near side or step around the trunk':t.windthrow?'Cut along the chalk ring · Hold Shift for a heavy stroke':isHardwood(t.type)?(figuredTree(t)?'Figured grain · Extra hardwood · ':'Hardwood · ')+'Shift + chop for a heavy stroke':'';
 }
}
