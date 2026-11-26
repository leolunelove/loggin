import { freshState, sanitize } from './economy.js';
export const SAVE_KEY='woodsmoke-save-v1';
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
