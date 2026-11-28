// Small, engine-independent rules shared by gameplay and regression checks.
export const CHOP_REACH = 1.3;
export const IMPACT_AT = .5;
export const REGROW_MS = 90000;
const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { n=clamp(n); return n*n*(3-2*n); };
const mix = (a,b,t) => t<=0?a:t>=1?b:a+(b-a)*t;

export const SWING_VARIANTS=Object.freeze([
  {name:'Overhead',ready:[-.11,1.31,.29],load:[-.23,1.62,.18],angle:-1.05,roll:0,contactRoll:0,twist:.2,pull:.17},
  {name:'Diagonal',ready:[-.14,1.3,.28],load:[-.29,1.56,.23],angle:-.83,roll:.32,contactRoll:.1,twist:.27,pull:.19},
  {name:'Compact',ready:[-.09,1.28,.31],load:[-.15,1.45,.38],angle:-.15,roll:-.13,contactRoll:-.055,twist:.12,pull:.14},
  {name:'Backhand',ready:[.08,1.30,.26],load:[.26,1.52,.28],angle:-.62,roll:-.42,contactRoll:-.19,twist:-.22,pull:.22},
  {name:'Low hew',ready:[-.14,1.23,.25],load:[-.33,1.46,.15],angle:-.94,roll:.48,contactRoll:.21,twist:.29,pull:.24},
]);
export function chooseSwing(previous,tree,random=Math.random){
  // A weighted choice avoids both adjacent repeats and a rigid three-stroke loop.
  const low=tree.windthrow||tree.kind==='section'||tree.kind==='stump';
  const weights=[low?1.5:1,tree.r>.4?1.6:1,tree.type===1?1.6:.85,low?.55:1.05,low?2.7:.55];
  const total=weights.reduce((sum,w,i)=>sum+(i===previous?0:w),0);
  let pick=Math.max(0,Math.min(.999999,random()))*total;
  for(let i=0;i<weights.length;i++)if(i!==previous){pick-=weights[i];if(pick<0)return i;}
  return previous===0?1:0;
}

export function swingPose(progress,variant=0,finishing=false) {
  const p=clamp(progress);
  const v=SWING_VARIANTS[variant]||SWING_VARIANTS[0],drive=finishing?1.08:1,handSpread=variant===1?.75:variant===2?.65:1;
  // Raise together, load behind the shoulder, accelerate into the cut, then pull out and lower.
  const keys=[
    [0,0,1.3,0,0,0,0,0],
    [.16,.48,.05,-.025,.08,.22,v.roll*.4,.008],
    [.34,1,v.angle,-.06,v.twist,.24*handSpread,v.roll,.017],
    [.5,.08,1.137,.3*drive,-.18,.09,v.contactRoll,.025*drive],
    [.55,.08,1.137,.315*drive,-.18,.09,v.contactRoll,.034*drive],
    [.73,.12,finishing?1.62:1.5,.09,-.025,.1,v.roll*.2,.012],
    [1,0,1.3,0,0,0,0,0],
  ];
  let a=keys[0],b=keys[1];for(let i=1;i<keys.length;i++){b=keys[i];if(p<=b[0])break;a=b;}
  let k=smooth((p-a[0])/(b[0]-a[0]||1));
  // The short striking phase builds speed right up to the deliberately held contact pose.
  if(a[0]===.34)k=clamp(((p-.34)/.16)**2);
  return {lift:mix(a[1],b[1],k),angle:p>=.5&&p<=.55?1.137:mix(a[2],b[2],k),lean:mix(a[3],b[3],k),twist:mix(a[4],b[4],k),slide:mix(a[5],b[5],k),roll:p>=.5&&p<=.55?v.contactRoll:mix(a[6],b[6],k),sink:mix(a[7],b[7],k)};
}

export function chopContact(tree,feet,rootY=feet.y||0) {
  const dx=tree.x-feet.x,dz=tree.z-feet.z,d=Math.hypot(dx,dz)||1;
  return {x:tree.x-dx/d*tree.r*.96,y:Math.max(tree.y+.7,Math.min(tree.y+1.65,rootY+1.23)),z:tree.z-dz/d*tree.r*.96};
}

export function pickTree(trees, feet, yaw, eye=feet) {
  const fx=Math.sin(yaw),fz=Math.cos(yaw);
  let tree=null,distance=16,score=Infinity;
  for(const t of trees){
    if(t.down||(t.tier!==0&&!t.collider))continue;
    const dx=t.x-feet.x,dz=t.z-feet.z,centre=Math.hypot(dx,dz),d=Math.max(0,centre-t.r);
    if(d>16)continue;
    const vx=t.x-eye.x,vz=t.z-eye.z,viewDistance=Math.hypot(vx,vz);
    const facing=viewDistance>.01?(vx*fx+vz*fz)/viewDistance:1;
    if(facing<.42)continue;
    // Reachable trees win; otherwise favour the direction the player is looking.
    const rank=d+(1-facing)*(d<CHOP_REACH?.6:4);
    if(rank<score){score=rank;tree=t;distance=d;}
  }
  return {tree,distance};
}
export const LOCK_REACH=18;
export function pickAimTree(trees,feet,yaw,eye=feet){
 const fx=Math.sin(yaw),fz=Math.cos(yaw);let tree=null,score=Infinity;
 for(const t of trees){
  if(t.down||(t.tier!==0&&!t.collider))continue;
  const d=Math.max(0,Math.hypot(t.x-feet.x,t.z-feet.z)-t.r);if(d>LOCK_REACH)continue;
  const dx=t.x-eye.x,dz=t.z-eye.z,n=Math.hypot(dx,dz)||1,facing=(dx*fx+dz*fz)/n;
  if(facing<.94)continue;
  const rank=(1-facing)*40+d*.025;if(rank<score){score=rank;tree=t;}
 }
 return tree;
}
export function movingChopContact(tree,feet,rootY=feet.y||0){
 const p=chopContact(tree,feet,rootY),dx=p.x-feet.x,dz=p.z-feet.z,d=Math.hypot(dx,dz);
 if(d>CHOP_REACH){p.x=feet.x+dx/d*CHOP_REACH;p.z=feet.z+dz/d*CHOP_REACH;}
 return p;
}
export const chopCount = (health,power) => { const n=Math.max(0,Math.ceil(health/power-1e-6));return `${n} ${n===1?'chop':'chops'}`; };


// Set the landing angle from the ground under the trunk, instead of an arbitrary near-horizontal stop.
export function trunkGroundGap(tree,angle,dx,dz,heightAt){
  const top=tree.h*(tree.type===1?.95:.8)-.38;
  let gap=Infinity;
  for(let i=1;i<=8;i++){
    const length=top*(.1+i*.9/8),radius=tree.r*(1-.6*length/top);
    const x=tree.x+dx*length*Math.sin(angle),z=tree.z+dz*length*Math.sin(angle);
    gap=Math.min(gap,tree.y+.38+length*Math.cos(angle)-radius*Math.sin(angle)-heightAt(x,z));
  }
  // Structural boughs can touch a slope before the tip of the bole does.
  for(const limb of tree.limbs||[])for(let j=0;j<limb.joints.length;j++){
    const [x,y,z,r]=limb.joints[j];if(r<.035)continue;
    const along=x*dx+z*dz,h=y-.38,c=Math.cos(angle),s=Math.sin(angle);
    const advance=along*(c-1)+h*s;
    gap=Math.min(gap,tree.y+.38+h*c-along*s-r-heightAt(tree.x+x+dx*advance,tree.z+z+dz*advance));
  }
  return gap;
}
export function createTreeFall(tree,dx,dz,heightAt){
  let lo=0,hi=Math.PI*.58;
  for(let a=.025;a<=hi;a+=.025){if(trunkGroundGap(tree,a,dx,dz,heightAt)<=0){hi=a;lo=a-.025;break;}}
  for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(trunkGroundGap(tree,mid,dx,dz,heightAt)>0)lo=mid;else hi=mid;}
  return {contactAngle:hi,duration:Math.max(1.35,Math.min(2.15,1.35+(tree.h-15)*.025+tree.r*.2))};
}
export function treeFallPose(plan,age){
  const progress=clamp(age/plan.duration);
  return {progress,angle:plan.contactAngle*progress**2.2,landed:progress>=1};
}
