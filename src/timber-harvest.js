// A worked stand keeps its stock until the last recoverable timber is carried away.
export const AWAITING_COLLECTION=-1;
export const CARRY_LENGTH=2.4;
export const HINGE=.38;

export function readHarvest(raw){
  if(!Number.isInteger(raw?.yield)||raw.yield<1||raw.yield>200)return null;
  const limbed=[...new Set((Array.isArray(raw.limbed)?raw.limbed:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<32))];
  const taken=[];
  for(const span of Array.isArray(raw.taken)?raw.taken.slice(0,128):[]){
    if(!Array.isArray(span)||span.length!==2)continue;
    const [lo,hi]=span;
    if(Number.isFinite(lo)&&Number.isFinite(hi)&&lo>=HINGE-.001&&hi>lo&&hi<=100&&!taken.some(([a,b])=>lo<b-.001&&hi>a+.001))taken.push([lo,hi]);
  }
  return {yield:raw.yield,limbed,taken};
}

// Differences of the cumulative yield conserve wood for any sequence of cuts.
// Tiny chips between two close cuts may be brushwood; they cannot mint more timber.
export function timberAmount(harvest,top,lo,hi){
  const totalAt=at=>Math.round(harvest.yield*Math.max(0,Math.min(1,(at-HINGE)/(top-HINGE))));
  return totalAt(hi)-totalAt(lo);
}
export function timberLeft(harvest,top){
  return harvest.yield-harvest.taken.reduce((n,[lo,hi])=>n+timberAmount(harvest,top,lo,hi),0);
}
export function hasTaken(harvest,lo,hi){
  return harvest?.taken.some(([a,b])=>a<=lo+.001&&b>=hi-.001)??false;
}
export function layoutCuts(lo,hi){
  const count=hi-lo<=CARRY_LENGTH+.001?1:Math.ceil((hi-lo)/(CARRY_LENGTH-.28)),out=[];
  for(let i=1;i<count;i++)out.push(lo+(hi-lo)*i/count);
  return out;
}
