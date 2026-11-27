export const PATCH_FILES=['orchard','river','hollow'];
export const PLACES=[{name:'Orchard Rest',story:'Someone planted apples here, then left before the harvest.',kind:'garden'},{name:'Riverwatch',story:'A ferryman once kept a light burning for late travellers.',kind:'river'},{name:'Pine Hollow',story:'The old timber crew left their cart and a place at the table.',kind:'logging'}];
export const freshPlaces=()=>PLACES.map(()=>({found:false,wood:0,planks:0,trail:0}));
export const restored=p=>p.wood>=24&&p.planks>=8;
export function contributePlace(s,i,kind){const p=s.places[i];if(!p?.found)return 0;let amount=0;if(kind==='wood'){amount=Math.min(6,24-p.wood,Math.max(0,s.wood-s.hardwood));s.wood-=amount;}else if(kind==='planks'&&p.wood>=24){amount=Math.min(2,8-p.planks,s.planks);s.planks-=amount;}else if(kind==='trail'&&restored(p)){amount=Math.min(8,40-p.trail,Math.max(0,s.wood-s.hardwood));s.wood-=amount;}if(amount>0)p[kind]+=amount;return amount;}
export function segmentDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);}
