import { freshState, sanitize } from './economy.js';
export const LEGACY_SAVE_KEY='woodsmoke-save-v1';
export const SAVE_KEY='loggin-camp-v2';
export const RESET_BACKUP_KEY=SAVE_KEY+'-before-reset';
// Local development review can exercise real persistence alongside a player's camp.
export function reviewStorage(storage) {
  const key=k=>'loggin-woodland-review/'+k;
  return {eventKey:key(SAVE_KEY),getItem:k=>storage.getItem(key(k)),setItem:(k,v)=>storage.setItem(key(k),v),removeItem:k=>storage.removeItem(key(k))};
}
export function newCamp(storage,state){
 try{
  const previous=storage.getItem(SAVE_KEY)||storage.getItem(SAVE_KEY+'-backup');
  if(parse(previous))storage.setItem(RESET_BACKUP_KEY,previous);
  storage.setItem(SAVE_KEY,JSON.stringify(state));
  storage.removeItem(SAVE_KEY+'-backup');return true;
 }catch{return false;}
}
export function undoReset(storage){
 try{const previous=storage.getItem(RESET_BACKUP_KEY);if(!parse(previous))return false;
 storage.setItem(SAVE_KEY,previous);storage.removeItem(SAVE_KEY+'-backup');storage.removeItem(RESET_BACKUP_KEY);return true;}catch{return false;}
}
function parse(raw){
  if(!raw)return null;
  try{const data=JSON.parse(raw);return data&&typeof data==='object'&&!Array.isArray(data)&&data.version===1?sanitize(data):null;}catch{return null;}
}
export function readSave(storage){
  try{
    const raw=storage.getItem(SAVE_KEY),primary=parse(raw);
    if(primary)return {state:primary,status:'saved'};
    const backup=parse(storage.getItem(SAVE_KEY+'-backup'));
    if(backup)return {state:backup,status:'recovered'};
    // Migrate once into the isolated camp key; older open builds can only change the legacy slot.
    if(!raw){const legacy=parse(storage.getItem(LEGACY_SAVE_KEY))||parse(storage.getItem(LEGACY_SAVE_KEY+'-backup'));if(legacy)return {state:legacy,status:'saved'};}
    return {state:freshState(),status:raw?'damaged':'new'};
  }catch{return {state:freshState(),status:'unavailable'};}
}
export function writeSave(storage,state){
  try{
    const previous=storage.getItem(SAVE_KEY);
    if(parse(previous)){try{storage.setItem(SAVE_KEY+'-backup',previous);}catch{ /* A full backup must not block replacing the primary save. */ }}
    storage.setItem(SAVE_KEY,JSON.stringify(state));return true;
  }catch{return false;}
}
