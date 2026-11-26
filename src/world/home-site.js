import { START } from './land.js';

// Keep the original tree order: saved felled-tree IDs must stay stable.
export function startingTree(trees) {
 if(trees.some(t=>t.tutorial))return trees.find(t=>t.tutorial);
 const candidates=trees.filter(t=>t.tier===0&&t.type===1).sort((a,b)=>Math.hypot(a.x-START.x,a.z-START.z)-Math.hypot(b.x-START.x,b.z-START.z));
 return candidates.slice(0,30).find(t=>{
  const x=t.x+.95,z=t.z+t.r+1.25+6.4;
  return trees.every(other=>other===t||Math.hypot(other.x-x,other.z-z)-other.r>3);
 })||candidates[0];
}
export function homeSite(trees) {
 const t=startingTree(trees);
 return {x:t.x+4,z:t.z-2};
}
export const UNLOAD_REACH=2.05;
export const homeDistance=(home,feet)=>Math.hypot(home.dropoff.x-feet.x,home.dropoff.z-feet.z);
export const atWoodRack=(home,feet)=>homeDistance(home,feet)<=UNLOAD_REACH&&Math.abs(home.dropoff.y-feet.y)<1.3;
