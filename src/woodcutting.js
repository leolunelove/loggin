// Total XP for a completed tree is shared across its useful cuts and final fall.
export const TREES = [
  {name:'Beech',health:14,wood:14,xp:68,minCuts:4},
  {name:'Birch',health:9,wood:8,xp:42,minCuts:3},
  {name:'Old oak',health:36,wood:45,xp:190,minCuts:7},
  {name:'Maple',health:24,wood:22,xp:125,minCuts:5},
];
export const WINDTHROW_HEALTH=10;
export const LEVEL_CAP=99;
const thresholds=[0,0];
for(let level=1;level<LEVEL_CAP;level++){
  const step=Math.round(92*Math.pow(1.068,level-1)+8*(level-1));
  thresholds.push(thresholds[level]+step);
}
const count=n=>Number.isFinite(n)?Math.max(0,Math.min(1e12,Math.floor(n))):0;
export const xpAt=level=>thresholds[Math.max(1,Math.min(LEVEL_CAP,level))];
export function skillProgress(xp){
  let level=1;
  while(level<LEVEL_CAP&&xp>=thresholds[level+1])level++;
  const floor=thresholds[level],next=thresholds[level+1]??floor;
  return {level,floor,next,left:Math.max(0,next-xp),fraction:next===floor?1:(xp-floor)/(next-floor)};
}
export const milestones=[
  [1,'Apprentice','Earn experience with each cut and each finished length of timber.'],
  [5,'Camp orders','Complete repeatable jobs for bonus experience.'],
  [10,'Read the grain','Land another blow in the same notch for extra XP.'],
  [20,'Hardwood orders','Maple and oak join the order book once you can harvest hardwood.'],
  [35,'Figured grain','Finishing figured oak or curly maple earns 60 extra XP.'],
  [50,'Journeyman','Longer camp orders pay a higher XP bonus.'],
  [75,'Veteran','Take the largest camp orders.'],
  [99,'Master woodcutter','Wear the master woodcutter title in your field book.'],
];
const orders={
  birch:{title:'Birch for kindling',verb:'Fell birch',base:4,bonus:22,type:1},
  lengths:{title:'Firewood lengths',verb:'Split fallen logs',base:3,bonus:19},
  beech:{title:'Beech for the woodpile',verb:'Fell beech',base:3,bonus:30,type:0},
  maple:{title:'Maple for the mill',verb:'Fell maple',base:3,bonus:46,type:3},
  oak:{title:'Oak for the rafters',verb:'Fell old oak',base:2,bonus:68,type:2},
};
function readNotches(value){
  if(!Array.isArray(value))return [];
  const notches=[];
  for(const n of value.slice(-40)){
    if(!n||!['x','y','z','nx','nz','damage'].every(k=>Number.isFinite(n[k]))||n.damage<=0)continue;
    const length=Math.hypot(n.nx,n.nz);if(length<.01)continue;
    const record={x:n.x,y:n.y,z:n.z,nx:n.nx/length,nz:n.nz/length,damage:Math.min(1,n.damage)};
    if(Number.isFinite(n.angle))record.angle=n.angle%Math.PI;
    notches.push(record);
  }
  return notches;
}
export function readSkill(data,legacyFelled=0){
  const legacy=count(data?data.legacy:legacyFelled);
  const skill={xp:data?count(data.xp):Math.min(1e12,legacy*26),legacy,strokes:count(data?.strokes),bucked:count(data?.bucked),orders:count(data?.orders),
    species:TREES.map((_,i)=>count(data?.species?.[i])),order:null,cuts:{},splits:{}};
  const o=data?.order;
  if(o&&Object.hasOwn(orders,o.key)){
    const tier=Math.min(2,count(o.tier)),goal=orders[o.key].base*(tier+1);
    skill.order={key:o.key,tier,done:Math.min(goal-1,count(o.done))};
  }
  for(const [id,cut] of Object.entries(data?.cuts||{})){
    if(!/^(?:\d{1,5}|w\d{1,2}-[0-2])$/.test(id)||!cut||!Number.isFinite(cut.hp)||cut.hp<=0)continue;
    if(!['x','y','z','nx','nz'].every(k=>Number.isFinite(cut[k])))continue;
    const saved=skill.cuts[id]={hp:Math.min(36,cut.hp),x:cut.x,y:cut.y,z:cut.z,nx:cut.nx,nz:cut.nz};
    const notches=readNotches(cut.notches);if(notches.length)saved.notches=notches;
  }
  for(const [id,split] of Object.entries(data?.splits||{})){
    if(!/^\d{1,5}$/.test(id)||!Number.isFinite(split?.until)||split.until<=Date.now()||!Number.isInteger(split.mask))continue;
    const record=skill.splits[id]={until:split.until,mask:split.mask&7};
    if(Array.isArray(split.scores))record.scores=[0,1,2].map(i=>Math.min(2,count(split.scores[i])));
    if(Number.isFinite(split.bearing))record.bearing=split.bearing%(Math.PI*2);
    const notches=readNotches(split.notches);if(notches.length)record.notches=notches;
    if(Array.isArray(split.kerfs))record.kerfs=split.kerfs.slice(0,128).filter(k=>k&&Number.isFinite(k.at)&&k.at>.38&&k.at<100&&Number.isFinite(k.azimuth)&&[1,2,3].includes(k.hits))
      .map(({at,hits,azimuth})=>({at,hits,azimuth}));
    if(Array.isArray(split.pieces))record.pieces=split.pieces.slice(0,128).filter(a=>Array.isArray(a)&&(a.length===9||a.length===15)&&a.every(Number.isFinite)
      &&a[0]<a[1]&&Math.hypot(...a.slice(5,9))>.5).map(a=>a.slice());
  }
  return skill;
}
export function ensureOrder(s){
  const skill=s.woodcutting;if(skill.order)return;
  const level=skillProgress(skill.xp).level;if(level<5)return;
  const pool=['birch','lengths','beech'];
  if(level>=20&&s.shed>=40&&s.axe>=1)pool.push('maple','oak');
  skill.order={key:pool[skill.orders%pool.length],tier:level>=75?2:level>=50?1:0,done:0};
}
export function orderInfo(order){
  if(!order)return null;
  const spec=orders[order.key],goal=spec.base*(order.tier+1);
  return {...spec,goal,done:order.done,reward:goal*(spec.bonus+order.tier*8)};
}
export function cappedPower(tree,power,heavy){
  if(tree.windthrow)return Math.min(power,(tree.maxHp||WINDTHROW_HEALTH)/3);
  const species=TREES[tree.type],cuts=species.minCuts-(heavy&&(tree.type===2||tree.type===3)?1:0);
  return Math.min(power,species.health/cuts);
}
export function logCut(s,tree,part){
  const index=part.sourceIndex;
  if(!Number.isInteger(index)||index<0||index>2||part.length<=1.1)return null;
  const entries=s.woodcutting.splits,bit=1<<index;
  const record=entries[tree.id]?.until===tree.regrow?entries[tree.id]:(entries[tree.id]={until:tree.regrow,mask:0});
  if(record.mask&bit)return null;
  const scores=record.scores??=[0,0,0],previous=scores[index],cut=Math.min(3,part.hits);
  if(cut<=previous)return null;
  if(cut===3){record.mask|=bit;scores[index]=0;}else scores[index]=cut;
  return awardWork(s,{type:tree.type,split:true,before:3-previous,after:3-cut});
}
export function awardWork(s,{type,windthrow=false,split=false,maximum,before=split?3:0,after=0,precise=false,figured=false}){
  const skill=s.woodcutting,old=skillProgress(skill.xp).level;
  const finish=after<=0;
  if(before<=after)return null;
  const value=windthrow?54:TREES[type].xp;
  const earnedAt=hp=>Math.floor(value*.70*(1-Math.max(0,hp)/maximum)+1e-7);
  let base=split?6*(before-after):earnedAt(after)-earnedAt(before)+(finish?value-Math.floor(value*.70):0);
  skill.strokes++;
  if(!split){
    if(old>=10&&precise)base+=3;
    if(old>=35&&finish&&figured&&!windthrow)base+=60;
  }
  if(finish){
    if(split||windthrow)skill.bucked++;
    else skill.species[type]++;
  }
  ensureOrder(s);
  let bonus=0;const order=skill.order;
  if(order&&finish){
    const spec=orderInfo(order);
    if(order.key==='lengths'?(windthrow||split):(!windthrow&&!split&&spec.type===type)){
      order.done++;
      if(order.done>=spec.goal){bonus=spec.reward;skill.orders++;skill.order=null;}
    }
  }
  skill.xp=Math.min(1e12,skill.xp+base+bonus);
  ensureOrder(s);
  return {xp:base,bonus,level:skillProgress(skill.xp).level,old};
}
