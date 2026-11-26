export const MILL_COST=40, MILL_SECONDS=3, MILL_LOGS=8, MILL_PLANKS=2;
export const PROJECTS={porch:{name:'Camp porch',cost:12},lodge:{name:'Cabin extension',cost:24}};
export function contributeMill(s){
 if(s.shed<40||s.sawmill>=MILL_COST)return 0;
 const amount=Math.min(8,MILL_COST-s.sawmill,s.hardwood,s.wood);
 if(amount<=0)return 0;
 s.hardwood-=amount;s.wood-=amount;s.sawmill+=amount;return amount;
}
export function beginMilling(s){
 if(s.sawmill<MILL_COST||s.millJob||s.wood-s.hardwood<MILL_LOGS)return false;
 s.wood-=MILL_LOGS;s.millJob={remaining:s.porch>=12?2:MILL_SECONDS};return true;
}
export function advanceMilling(s,dt){
 if(!s.millJob)return false;
 s.millJob.remaining=Math.max(0,s.millJob.remaining-Math.max(0,dt));
 if(s.millJob.remaining>0)return false;
 s.planks+=MILL_PLANKS;s.millJob=null;return true;
}
export function contributePlanks(s,kind){
 const p=PROJECTS[kind];if(!p||s.sawmill<MILL_COST||(kind==='lodge'&&s.porch<12))return 0;
 const amount=Math.min(4,p.cost-s[kind],s.planks);if(amount<=0)return 0;
 s.planks-=amount;s[kind]+=amount;return amount;
}
