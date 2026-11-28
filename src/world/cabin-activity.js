import * as THREE from 'three';

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const HALF_PI=Math.PI/2;

// Find a short walk through the actual bed frames, table and bench. A guest can
// ask to sleep from either side of the table or from the front step.
function guestAisle(house,start,goal){
  const clearance=.30,corner=.40,origin=house.group.position;
  const objects=house.obstacles||[];
  function crosses(a,b,box){
    let lo=0,hi=1;
    for(const [key,half] of [['x',box.hx],['z',box.hz]]){
      const d=b[key]-a[key],offset=a[key]-box[key],extent=half+clearance;
      if(Math.abs(d)<1e-6){if(Math.abs(offset)>=extent)return false;continue;}
      const t0=(-extent-offset)/d,t1=(extent-offset)/d;
      lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
      if(lo>=hi)return false;
    }
    return hi-lo>.006;
  }
  const clear=(a,b)=>!objects.some(box=>crosses(a,b,box));
  if(clear(start,goal))return [];
  const nodes=[start,goal];
  for(const box of objects)for(const x of [-1,1])for(const z of [-1,1]){
    const p=V(box.x+x*(box.hx+corner),goal.y,box.z+z*(box.hz+corner));
    if(Math.abs(p.x-origin.x)<house.spec.w/2-.36&&Math.abs(p.z-origin.z)<house.spec.d/2-.36)nodes.push(p);
  }
  const cost=nodes.map(()=>Infinity),via=[],used=new Set();cost[0]=0;
  for(let n=0;n<nodes.length;n++){
    let i=-1;
    for(let j=0;j<nodes.length;j++)if(!used.has(j)&&Number.isFinite(cost[j])&&(i<0||cost[j]<cost[i]))i=j;
    if(i<0||i===1)break;
    used.add(i);
    for(let j=1;j<nodes.length;j++){
      if(used.has(j))continue;
      const next=cost[i]+Math.hypot(nodes[i].x-nodes[j].x,nodes[i].z-nodes[j].z);
      if(next<cost[j]&&clear(nodes[i],nodes[j])){cost[j]=next;via[j]=i;}
    }
  }
  const steps=[];
  for(let i=via[1];i>0;i=via[i])steps.unshift(nodes[i]);
  return steps;
}

// All measurements are relative to the house foundation. The standing mark
// stays in the aisle so the character controller never has to cross a bed or desk.
export function cabinActivity(kind,house,state,feet,guestBed=null){
  const origin=house.group.position;
  const local=(x,y,z)=>V(origin.x+x,origin.y+y,origin.z+z);
  const expanded=state.lodge>=24;
  let set;
  if(kind==='bench'){
    set={stand:local(-.58,.12,-.22),yaw:-HALF_PI,hips:local(-.62,.921,-.22),
      left:local(-1.08,.905,.025),right:local(-1.10,.992,-.46),
      packPosition:local(-.81,.13,.50),packYaw:-.38,
      focus:local(-.92,1.13,-.27),eye:V(-.68,1.05,1.85),seconds:1.15,panel:'upgrades'};
  }else if(kind==='ledger'){
    set={stand:local(.23,.12,.79),yaw:HALF_PI,hips:local(.55,.665,.85),
      left:local(1.015,.984,.755),right:local(1.235,.989,.996),
      packPosition:local(.14,.13,.46),packYaw:.68,
      focus:local(.81,1.08,.86),eye:V(.54,1.06,1.87),seconds:1.40,panel:'ledger'};
  }else{
    const sideBed=expanded||!!guestBed;
    const bed=guestBed||{x:sideBed ? .95 : .02,z:sideBed ? -2.86 : -.94,top:sideBed ? .53 : .45,side:sideBed ? -1 : 1};
    const side=bed.side,seat=sideBed?local(bed.x+side*.34,bed.top+.115,bed.z+.13):local(bed.x+.14,bed.top+.115,bed.z+.21);
    const mid=local(bed.x,bed.top+.115,bed.z);
    const stand=sideBed?local(bed.x+side*.94,guestBed ? .09 : .185,bed.z+.10):local(bed.x+.12,.12,bed.z+.77);
    const yaw=sideBed?side*HALF_PI:0;
    set={stand,yaw,bedYaw:sideBed?0:HALF_PI,hips:seat,mid,top:origin.y+bed.top,
      side:sideBed?side:1,sideBed,focus:mid.clone().add(V(0,.22,0)),
      eye:sideBed?V(side*1.42,1.53,1.57):V(.62,1.56,2.01),seconds:2.40,
      packPosition:sideBed?local(bed.x+side*.70,guestBed ? .10 : .20,bed.z+.64):local(.70,.13,-.37),packYaw:sideBed ? .16 : -.65};
  }
  const points=[],z=feet.z-origin.z;
  if(guestBed){
    const X=house.spec.w/2,Z=house.spec.d/2,door=house.dropoff.x-origin.x;
    if(!house.contains(feet)){
      if(z<Z+.45&&Math.abs(feet.x-origin.x)>X)points.push(local(Math.sign(feet.x-origin.x)*(X+.72),0,Z+1.0));
      if(z>Z+1.2||Math.abs(feet.x-origin.x-door)>.33)points.push(local(door,0,Math.max(Z+.86,z)));
      points.push(local(door,0,Z-.64));
    }
    points.push(...guestAisle(house,points.at(-1)||feet,set.stand));
  }else if(Math.min(z,set.stand.z-origin.z)<-1.38&&Math.max(z,set.stand.z-origin.z)>-1.28){
    points.push(local(-.24,0,-1.29));
  }else if(Math.abs(feet.x-set.stand.x)>.82&&Math.abs(feet.z-set.stand.z)>.53){
    points.push(local(-.18,0,THREE.MathUtils.clamp(z,-.38,.48)));
  }
  points.push(set.stand);
  return {...set,kind,house,points,leg:0,lastDistance:Infinity,stuck:0,stage:'walk',progress:0,age:0,stroke:0,page:0,cancelReady:false};
}

export function guideCabinWalk(action,feet,dt){
  const point=action.points[action.leg],dx=point.x-feet.x,dz=point.z-feet.z,d=Math.hypot(dx,dz);
  if(d<.065){
    action.leg++;
    action.lastDistance=Infinity;action.stuck=0;
    if(action.leg===action.points.length)action.stage='settle';
    return {x:0,z:0};
  }
  if(d<action.lastDistance-.012){action.lastDistance=d;action.stuck=0;}
  else action.stuck+=dt;
  if(action.stuck>1.05){action.stage='blocked';return {x:0,z:0};}
  const speed=Math.min(1.43,d*6.4);
  return {x:speed*dx/d,z:speed*dz/d};
}

export function advanceCabin(action,dt){
  if(action.stage==='settle'){
    action.progress=Math.min(1,action.progress+dt/action.seconds);
    if(action.progress===1){action.stage='using';return 'ready';}
  }else if(action.stage==='using'){
    action.age+=dt;
  }else if(action.stage==='rise'){
    action.progress=Math.max(0,action.progress-dt/(action.kind==='bed'?1.59:action.kind==='ledger'?.94:.62));
    if(!action.progress)return 'done';
  }
  return null;
}

export function nearestGuestBed(house,feet){
  const origin=house.group.position;
  return house.beds.reduce((near,bed)=>{
    const dist=b=>Math.hypot(origin.x+b.x-feet.x,origin.z+b.z-feet.z);
    return !near||dist(bed)<dist(near)?bed:near;
  },null);
}
