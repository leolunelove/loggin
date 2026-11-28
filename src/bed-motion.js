import * as THREE from 'three';

const ease=THREE.MathUtils.smootherstep;
const mix=THREE.MathUtils.lerp;

// Entry and getting up have different rhythms. An interrupted entry retraces
// its own contacts, including a hat or quilt still in the hand.
export function bedBeats(action){
  const p=action.progress,up=1-p,wake=action.stage==='rise'&&action.waking;
  const phase=(start,end,wakeStart,wakeEnd)=>wake?1-ease(up,wakeStart,wakeEnd):ease(p,start,end);
  return {
    turn:phase(0,.18,.78,1),
    pack:phase(.035,.245,.74,.97),
    plant:phase(.005,.10,.91,1),
    seat:phase(.105,.35,.66,.93),
    pivot:phase(.37,.70,.26,.61),
    slide:phase(.40,.74,.26,.60),
    recline:phase(.46,.81,.15,.55),
    head:phase(.63,.865,.075,.45),
    lead:phase(.395,.66,.38,.65),
    trail:phase(.51,.765,.29,.57),
    hat:phase(.29,.485,.55,.76),
    cover:phase(.795,.945,.035,.235),
    grasp:phase(.686,.811,.17,.30),
    release:phase(.95,.99,.008,.043),
    pillow:phase(.775,.90,.09,.24),
    eyes:phase(.935,.998,.008,.13),
    waking:!!wake
  };
}

export function bedPoint(a,length,outward,height){
  return a.mid.clone().addScaledVector(a.axis,length).addScaledVector(a.outward,outward).setY(a.top+height);
}

export function quiltGrip(a,m){
  const along=mix(.15,-.355,m.cover),lift=Math.sin(m.cover*Math.PI);
  return bedPoint(a,along,a.width*.35-.034*m.cover,.20+.113*m.cover+.086*lift);
}
