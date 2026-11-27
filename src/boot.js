import {readSave,writeSave,SAVE_KEY,RESET_BACKUP_KEY,undoReset,reviewStorage} from './save.js';
import {CUTS,OUTFITS,sanitizeAppearance} from './appearance.js';
import {WORLD,randomSeed} from './world/seed.js';
document.documentElement.dataset.scene='autumn';
const $=id=>document.getElementById(id);
const campAge=s=>`Day ${s.day} · ${s.felled} ${s.felled===1?'tree':'trees'} felled`;
let storage;try{storage=localStorage;}catch{storage=null;}
if(storage&&new URLSearchParams(location.search).has('woodlandReview'))storage=reviewStorage(storage);
WORLD.storage=storage;
const saved=readSave(storage),state=saved.state;let appearance=sanitizeAppearance(state.appearance),disposePreview,growing=false,editedLook=false,previewTicket=0;
let startSnapshot;try{startSnapshot=storage?.getItem(SAVE_KEY);}catch{}
function closePreview(){previewTicket++;disposePreview?.();disposePreview=null;$('outfitter').hidden=true;}
async function showPreview(camp){
 const ticket=++previewTicket;$('preview-note').hidden=false;$('preview-note').textContent='Opening the outfitter…';
 try{const {createLobbyPreview}=await import('./lobby-preview.js');if(ticket!==previewTicket)return;
  const stop=await createLobbyPreview($('character-preview'),()=>appearance,camp);
  if(ticket!==previewTicket){stop();return;}disposePreview=stop;$('preview-note').hidden=true;
 }catch(error){if(ticket===previewTicket){console.warn('Outfitter preview',error);$('preview-note').textContent='The preview could not load. You can still choose an outfit.';}}
}
async function grow(){
 if(growing)return;growing=true;$('grow-world').disabled=true;$('grow-world').textContent='Packing your kit…';
 let status=saved.status;
 try{if(storage&&startSnapshot!==storage.getItem(SAVE_KEY)){const current=readSave(storage);Object.assign(state,current.state);status=current.status;}}catch{}
 if(editedLook||status==='new'||status==='damaged')state.appearance={...appearance};
 if(status==='new'||status==='damaged')state.seed=randomSeed();
 WORLD.seed=state.seed;WORLD.state=state;
 if(!new URLSearchParams(location.search).has('capture'))writeSave(storage,state);
 closePreview();$('welcome').hidden=true;document.body.classList.remove('at-title');$('loading').hidden=false;
 try{await import('./main.js');}catch(error){console.error(error);$('loading-label').textContent=/WebGL context/i.test(error.message)?'3D graphics are unavailable. Reopen the camp or reload to try again.':'The forest could not load.';const retry=$('reload-forest');retry.hidden=false;retry.onclick=()=>location.reload();}
}
if(new URLSearchParams(location.search).has('capture')){$('welcome').hidden=true;WORLD.seed=state.seed;WORLD.state=state;grow();}
else{
 $('loading').hidden=true;
 const welcome=$('welcome'),play=$('welcome-play'),outfit=$('welcome-outfit'),settings=$('settings');
 const fresh=saved.status==='new'||saved.status==='damaged';
 document.body.classList.add('at-title');play.textContent=fresh?'Start a camp':'Return to camp';
 function openOutfitter(){
   welcome.hidden=true;$('outfitter').hidden=false;
   $('cancel-outfit').hidden=false;$('cancel-outfit').textContent='Back to camp menu';
   showPreview(state);$('grow-world').focus({preventScroll:true});
 }
 function backToTitle(){
   closePreview();welcome.hidden=false;play.focus({preventScroll:true});
 }
 play.onclick=fresh?openOutfitter:grow;outfit.onclick=openOutfitter;
 $('cancel-outfit').onclick=backToTitle;
 document.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&!growing&&!$('outfitter').hidden){e.preventDefault();backToTitle();}
 });
 const savePreference=key=>{
   if(fresh)return;
   const current=readSave(storage);
   if(current.status==='new'||current.status==='damaged')return;
   current.state[key]=state[key];writeSave(storage,current.state);
 };
 $('welcome-settings').onclick=()=>{
   $('sensitivity').value=state.sensitivity;$('sensitivity-value').textContent=state.sensitivity.toFixed(2)+'×';
   $('sound').textContent=state.sound?'On':'Off';$('sound').setAttribute('aria-pressed',String(state.sound));
   $('quality').textContent=state.low?'Low':'High';settings.showModal();
 };
 settings.querySelector('.close').onclick=()=>settings.close();
 $('sound').onclick=()=>{state.sound=!state.sound;$('sound').textContent=state.sound?'On':'Off';$('sound').setAttribute('aria-pressed',String(state.sound));savePreference('sound');};
 $('quality').onclick=()=>{state.low=!state.low;$('quality').textContent=state.low?'Low':'High';savePreference('low');};
 $('sensitivity').oninput=e=>{state.sensitivity=Number(e.target.value);$('sensitivity-value').textContent=state.sensitivity.toFixed(2)+'×';};$('sensitivity').onchange=()=>savePreference('sensitivity');
 $('changelog-open').onclick=()=>{settings.close();$('changelog').showModal();};
 $('changelog').querySelector('.close').onclick=()=>$('changelog').close();
 $('grow-world').textContent=saved.status==='new'?'Grow my forest':'Return to my camp';
 $('lobby-note').textContent=saved.status==='new'?'New camp · Random woodland':campAge(state);
 const labels={workwear:'Workwear',headwear:'Headwear',shirt:'Shirt',hat:'Hat',pack:'Bag',skin:'Skin tone',hair:'Hair'};
 for(const [key,label] of Object.entries(labels)){
   const swatches=OUTFITS[key],options=swatches||CUTS[key].map(name=>[name]);
   const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=label;field.append(legend);
   const choices=document.createElement('div');choices.className=swatches?'swatches':'kit-options';field.append(choices);
   const selected=document.createElement('output');selected.textContent=options[appearance[key]][0];
   for(const [i,[name,colour]] of options.entries()){
     const l=document.createElement('label'),radio=document.createElement('input'),mark=document.createElement('span');
     radio.type='radio';radio.name=key;radio.value=i;radio.checked=appearance[key]===i;radio.setAttribute('aria-label',name);
     if(colour){mark.style.setProperty('--swatch','rgb('+colour.map(v=>Math.round(v*255)).join(',')+')');l.title=name;}
     else mark.textContent=name;
     radio.onchange=()=>{editedLook=true;appearance[key]=i;selected.textContent=name;};l.append(radio,mark);choices.append(l);
   }
   if(swatches)field.append(selected);$(swatches?'colour-fields':'kit-fields').append(field);
 }
 for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{
   for(const tab of document.querySelectorAll('[data-tab]')){const active=b===tab;tab.setAttribute('aria-pressed',String(active));$(tab.dataset.tab+'-fields').hidden=!active;}
 };
 $('grow-world').onclick=grow;
 try{if(storage?.getItem(RESET_BACKUP_KEY)){$('undo-reset').hidden=false;$('undo-reset').onclick=()=>{if(undoReset(storage))location.reload();};}}catch{}
 addEventListener('loggin:outfitter',e=>{
  const game=e.detail;if(game.editingClothes||game.externalSaveChange)return;
  game.editingClothes=true;game.paused=true;game.input.lockable=false;game.input.release();
  appearance={...game.state.appearance};$('cancel-outfit').textContent='Keep current outfit';
  for(const radio of document.querySelectorAll('.outfit-fields input')){
    radio.checked=appearance[radio.name]===Number(radio.value);
    const out=radio.closest('fieldset').querySelector('output');
    if(radio.checked&&out)out.textContent=radio.getAttribute('aria-label');
  }
  const exitOnEscape=event=>{if(event.key==='Escape'){event.preventDefault();finish(false,false);}};
  const finish=(apply,recapture=true)=>{
    document.removeEventListener('keydown',exitOnEscape);
    if(apply&&!game.externalSaveChange){game.state.appearance={...appearance};game.figure.setAppearance(appearance);game.save();}
    closePreview();game.editingClothes=false;game.paused=!!game.externalSaveChange;game.input.lockable=!game.touch&&!game.paused;game.input.clear();game.syncCapture();
    if(recapture&&game.input.lockable)game.input.capture();
  };
  $('grow-world').disabled=false;$('grow-world').textContent='Wear this outfit';$('grow-world').onclick=()=>finish(true);
  document.addEventListener('keydown',exitOnEscape);
  $('cancel-outfit').hidden=false;$('cancel-outfit').onclick=()=>finish(false);$('undo-reset').hidden=true;
  $('lobby-note').textContent=campAge(game.state);
  $('outfitter').hidden=false;showPreview(game.state);$('grow-world').focus({preventScroll:true});
 });
}
