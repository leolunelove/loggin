import {cappedPower} from './woodcutting.js';
import { restored } from './exploration.js';

// Freight is a record of loads already credited to the common woodpile.
const integer = (n, max) => Math.max(0, Math.min(max, Math.floor(Number(n) || 0)));
const clamp = (n, max) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
export const campHour = s => (s.day - 1) * 24 + s.hour;
export const connected = p => !!p && p.found && restored(p) && p.trail === 40;
export const cartCapacity = s => s.woodland.axle ? 288 : 192;
export const packedLunch = s => (s.woodland?.fedUntil || 0) > campHour(s);
export const PROJECT = {
  lamps: { place: 0, name: 'Orchard trail lanterns', benefit: 'Three amber lights mark the way home at dusk.', logs: 2, planks: 1, stages: 3, clue: 'carving' },
  bridge: { place: 1, name: 'East-bank footbridge', benefit: 'Cross from Riverwatch to the expedition rack.', logs: 4, planks: 2, stages: 4 },
  steps: { place: 2, name: 'Timber steps', benefit: 'A sure-footed shortcut up the ridge.', logs: 3, planks: 1, stages: 3 },
  shelter: { place: 2, name: 'Woodcutters’ shelter', benefit: 'A roof and a dry stacking rack halfway along the trail.', logs: 4, planks: 2, stages: 3, clue: 'kiln' },
};
export const FINDS = {
  carving: { name: 'The blazed post', story: 'Three diamonds cut into the grain. The lowest still holds a hook for a lantern.', reward: 'Lantern pattern for Orchard Rest' },
  tools: { name: 'The ferryman’s tools', story: 'A drawknife, a coil of rope and a faded blue pennant. Someone took care to wrap them before leaving.', reward: 'A ferryman’s pennant for the Riverwatch landing' },
  kiln: { name: 'The charcoal kiln', story: 'A ring of blackened stone and two surviving rafters show how the burners kept the drizzle off their stacks.', reward: 'Shelter plan for Pine Hollow' },
};
export function readWoodland(value = {}) {
  const w = value || {}, c = w.cart || {};
  const tags = (v, max) => [...new Set((Array.isArray(v) ? v : []).filter(n => Number.isInteger(n) && n >= 0 && n <= max))];
  const hasPosition = Number.isFinite(c.x) && Math.abs(c.x) <= 512 && Number.isFinite(c.z) && Math.abs(c.z) <= 512;
  return {
    lastMeal: integer(w.lastMeal, 1e6), fedUntil: clamp(w.fedUntil, 24e6),
    axle: w.axle === true, edge: w.edge === true,
    projects: Object.fromEntries(Object.entries(PROJECT).map(([k,p]) => [k,integer(w.projects?.[k],p.stages)])),
    finds: Object.keys(FINDS).filter(k => Array.isArray(w.finds) && w.finds.includes(k)),
    reserved: tags(w.reserved, 99999), sections: Array.from({length: 5}, (_,i) => integer(w.sections?.[i],3)),
    freight: Array.from({length: 3}, (_,i) => integer(w.freight?.[i],1e12)),
    cart: { built: c.built === true, hired: c.built === true && c.hired === true, running: c.built === true && c.hired === true && c.running === true,
      route: integer(c.route,2), progress: clamp(c.progress,1), returning: c.returning === true,
      wait: clamp(c.wait,4), load: integer(c.load,w.axle === true ? 288 : 192),
      x: hasPosition ? c.x : null, z: hasPosition ? c.z : null, yaw: Number.isFinite(c.yaw) ? c.yaw : 0 },
  };
}
export function available(s,logs,planks) {
  return s.wood - s.hardwood >= logs && s.planks >= planks;
}
function spend(s,logs,planks) {
  if (!available(s,logs,planks)) return false;
  s.wood -= logs; s.planks -= planks; return true;
}
export function projectReady(s,k) {
  const p=PROJECT[k], w=s.woodland;
  return !!p && s.places[p.place]?.found && restored(s.places[p.place]) && (!p.clue || w.finds.includes(p.clue)) && w.projects[k] < p.stages;
}
export function contributeLocal(s,i,k) {
  const p=PROJECT[k];
  if (!p || p.place !== i || !projectReady(s,k) || !spend(s,p.logs,p.planks)) return false;
  s.woodland.projects[k]++; return true;
}
export function useSpecialty(s,i,action) {
  if (!s.places[i]?.found || !restored(s.places[i])) return false;
  const w=s.woodland;
  if (action==='meal' && i===0 && w.lastMeal < s.day) {
    w.lastMeal=s.day; w.fedUntil=campHour(s)+3; return true;
  }
  if (action==='edge' && i===2 && !w.edge && s.hardwood>=8 && s.planks>=4) {
    s.wood-=8; s.hardwood-=8; s.planks-=4; w.edge=true; return true;
  }
  if (action==='axle' && i===2 && w.cart.built && !w.axle && spend(s,0,6)) { w.axle=true; return true; }
  if (action==='cart' && connected(s.places[i]) && !w.cart.built && spend(s,0,8)) {
    Object.assign(w.cart,{built:true,route:i,progress:1,returning:true,wait:3}); return true;
  }
  return false;
}
export function hireHauler(s) {
  const c=s.woodland.cart;
  if (!c.built || c.hired || !s.places.some(connected) || !spend(s,16,0)) return false;
  c.hired=true; return true;
}
export function noteFreight(s,i,amount) {
  if (i>=0 && i<3 && amount>0) s.woodland.freight[i]=Math.min(1e12,s.woodland.freight[i]+amount);
}
// Each endpoint exchanges its manifest exactly once. Cargo never mutates the balance.
export function advanceHaul(s,dt,lengths) {
  const w=s.woodland,c=w.cart;
  if (!c.running || !c.hired || !connected(s.places[c.route]) || dt<=0) return false;
  if (c.wait>0) { c.wait=Math.max(0,c.wait-dt); return false; }
  const advance=dt*(w.axle?2.2:1.65)/Math.max(1,lengths[c.route]);
  c.progress=clamp(c.progress+(c.returning?-advance:advance),1);
  if (c.returning && c.progress===0) {
    c.load=0;
    const options=[1,2,3].map(n=>(c.route+n)%3).filter(i=>connected(s.places[i]));
    c.route=options.find(i=>w.freight[i]>0)??options[0]; c.returning=false;
  } else if (!c.returning && c.progress===1) {
    const take=Math.min(w.freight[c.route],cartCapacity(s)-c.load);
    w.freight[c.route]-=take; c.load+=take; c.returning=true;
  } else return false;
  c.wait=3; return true;
}
export function figuredTree(t) { return (t.type===2||t.type===3) && (t.hero || (Math.floor(t.seed*23)>>>0)%7===0); }
export function strokePower(s,t,base,heavy=false) {
  const hard=t.type===2||t.type===3;
  return cappedPower(t,base*(hard&&s.woodland?.edge?1.35:1)*(heavy&&(hard||t.windthrow)?1.65:1),heavy);
}
export function recoveryAge(deadline,now,duration) {
  return Math.max(0,Math.min(1,1-(deadline-now)/duration));
}
