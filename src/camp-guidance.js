import {PLACES,restored} from './exploration.js';
import {PROJECT} from './woodland.js';

export function campObjective(s) {
  if (s.shed < 40) return {
    title: `Woodshed · ${s.shed} / 40 timber delivered`,
    detail: s.carried ? 'Follow the bearing to stack your bag.' : s.felled ? 'Birch and beech build the woodshed.' : 'Fell a birch. Bring your first load to the shack.'
  };
  if (s.axe === 0) return {title:'Equip a felling axe', detail:'Spend 12 timber at the workbench to cut hardwood.'};
  if (s.sawmill < 40) return {title:`Sawmill · ${s.sawmill} / 40 hardwood`,
    detail:s.hardwood ? `${s.hardwood} hardwood stored · Workbench → Camp` : 'Oak and maple supply the cutting bed.'};
  for (const [key,name,cost] of [['porch','Camp porch',12],['lodge','Cabin extension',24]]) {
    if (s[key] < cost) return {title:`${name} · ${s[key]} / ${cost} planks`,
      detail:s.planks ? `${s.planks} planks stacked · Workbench → Camp` : 'Saw 8 ordinary logs into 2 planks at camp.'};
  }
  const found=s.places.filter(p=>p.found).length, homes=s.places.filter(restored).length, trails=s.places.filter(p=>p.trail===40).length;
  if (found < PLACES.length) return {title:`Woodland homes · ${found} / ${PLACES.length} found`,detail:'Read the fingerpost or check the woodland notes.'};
  if (homes < PLACES.length) return {title:`Woodland homes · ${homes} / ${PLACES.length} restored`,detail:'Take timber and planks to a discovered home.'};
  if (trails < PLACES.length) return {title:`Connected trails · ${trails} / ${PLACES.length}`,detail:'Lay a trail from a restored home.'};
  if (!s.woodland.cart.built) return {title:'Build a handcart',detail:'Spend 8 planks at a connected home.'};
  const built=Object.entries(PROJECT).filter(([key,p])=>s.woodland.projects[key]===p.stages).length;
  if (built < Object.keys(PROJECT).length) return {title:`Local projects · ${built} / ${Object.keys(PROJECT).length}`,detail:'Visit a home ledger for its building plans.'};
  return {title:'Connected woodland',detail:'All homes and trail projects complete.'};
}

// A marked home wins. With a load, favour the closest place that can actually take it.
// Keep the previous bearing near a boundary so it stays legible as the player walks.
export function chooseBearing(points, feet, carried, destination, previous) {
  const home=points[0];
  const marked=destination!=null && points.find(p=>p.id===destination);
  if (marked) return marked;
  if (!carried) return home;
  const distance=p=>Math.hypot(p.position.x-feet.x,p.position.z-feet.z);
  let best=home, current, nearest=distance(home);
  for (const p of points) {
    if (!p.delivery) continue;
    const d=distance(p);
    if (p.id===previous) current=p;
    if (d < nearest) {best=p; nearest=d;}
  }
  return current && nearest>2 && distance(current)<=nearest+2 ? current : best;
}
