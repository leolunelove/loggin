import {wayDist} from './land.js';
import {riverCenter} from './river.js';

export const HOME_SPACING = 78;

// The orchard sits in the western wood, Riverwatch on the west bank, and the
// lodge beyond the high clearing. Choose level building plots within those areas.
export function settlementSites(origin, seed, specs, heightAt) {
  const candidates = [];
  let state = (seed ^ 0xc8013ea4) >>> 0;
  const jitter = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 4294967296 - .5) * 9;
  };
  for (const [i, spec] of specs.entries()) {
    const targetZ = [origin.z-76, origin.z-142, Math.max(-139,origin.z-213)][i] + jitter();
    const targetX = [origin.x-53, riverCenter(targetZ)-13, -30][i] + jitter();
    const plots=[];
    for (let dz=-16; dz<=16; dz+=4) for (let dx=-16; dx<=16; dx+=4) {
      const z=targetZ+dz, x=i===1?riverCenter(z)-13+dx*.35:targetX+dx;
      if (wayDist(x,z)>64 || Math.hypot(x-origin.x,z-origin.z)<HOME_SPACING) continue;
      const corners=[[-spec.w/2,-spec.d/2],[spec.w/2,-spec.d/2],[-spec.w/2,spec.d/2+2],[spec.w/2,spec.d/2+2],[0,spec.d/2+4]];
      if (corners.some(([ox,oz])=>x+ox>riverCenter(z+oz)-6.5)) continue;
      const levels=corners.map(([ox,oz])=>heightAt(x+ox,z+oz));
      const score=(Math.max(...levels)-Math.min(...levels))*4 + Math.hypot(dx,dz)*.037;
      plots.push({x,z,score});
    }
    candidates.push(plots.sort((a,b)=>a.score-b.score));
  }
  // A particularly level riverbank can lie too far north for the lodge. Try the
  // next bank before committing either house or clearing any trees.
  for(const orchard of candidates[0]) for(const river of candidates[1]){
    if(Math.hypot(orchard.x-river.x,orchard.z-river.z)<HOME_SPACING)continue;
    const lodge=candidates[2].find(p=>[orchard,river].every(h=>Math.hypot(p.x-h.x,p.z-h.z)>=HOME_SPACING));
    if(lodge)return [orchard,river,lodge].map(({x,z})=>({x,z}));
  }
  throw new Error('No connected woodland layout');
}
