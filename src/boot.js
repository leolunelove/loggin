import {readSave,writeSave,RESET_BACKUP_KEY,undoReset} from './save.js';
import {OUTFITS,sanitizeAppearance} from './appearance.js';
import {WORLD,randomSeed} from './world/seed.js';
document.documentElement.dataset.scene='autumn';
const $=id=>document.getElementById(id);
let storage;try{storage=localStorage;}catch{storage=null;}
const saved=readSave(storage),state=saved.state;let appearance=sanitizeAppearance(state.appearance),disposePreview,growing=false;
async function grow(){
 growing=true;$('grow-world').disabled=true;$('grow-world').textContent='Packing your kit…';
 state.appearance=appearance;if(saved.status==='new'||saved.status==='damaged')state.seed=randomSeed();
 WORLD.seed=state.seed;WORLD.state=state;
 if(!new URLSearchParams(location.search).has('capture'))writeSave(storage,state);
 disposePreview?.();$('outfitter').hidden=true;$('loading').hidden=false;
 try{await import('./main.js');}catch(error){console.error(error);$('loading-label').textContent='The forest could not load.';const retry=$('reload-forest');retry.hidden=false;retry.onclick=()=>location.reload();}
}
if(new URLSearchParams(location.search).has('capture')){WORLD.seed=state.seed;WORLD.state=state;grow();}
else{
 $('loading').hidden=true;$('outfitter').hidden=false;
 $('grow-world').textContent=saved.status==='new'?'Grow my forest':'Return to my camp';
 $('lobby-note').textContent=saved.status==='new'?'A fresh forest. A little shack. Make it yours.':`Your camp is waiting · ${state.felled} trees felled · World ${state.seed||'original'}`;
 for(const [key,options] of Object.entries(OUTFITS)){
  const select=$(key+'-choice');select.innerHTML=options.map(([name],i)=>`<option value="${i}">${name}</option>`).join('');select.value=appearance[key];select.onchange=()=>{appearance[key]=+select.value;};
 }
 $('grow-world').onclick=grow;
 try{if(storage?.getItem(RESET_BACKUP_KEY)){$('undo-reset').hidden=false;$('undo-reset').onclick=()=>{if(undoReset(storage))location.reload();};}}catch{}
 import('./lobby-preview.js').then(async m=>{disposePreview=await m.createLobbyPreview($('character-preview'),()=>appearance);if(growing)disposePreview();$('preview-note').hidden=true;}).catch(()=>{$('preview-note').textContent='Your outfit will appear when you enter the woods.';});
}
