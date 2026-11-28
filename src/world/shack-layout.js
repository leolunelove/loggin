export const DOOR={x:-.475,z:1.5,left:-1.1,right:.15};
export function insideShack(origin,feet,state={}){
 const x=feet.x-origin.x,z=feet.z-origin.z;
 return Math.abs(x)<1.67&&z<1.42&&z>(state.lodge>=24?-4:-1.36)&&Math.abs((feet.y??origin.y)-origin.y)<1.4;
}
export function atShackDoor(origin,feet){return Math.hypot(feet.x-origin.x-DOOR.x,feet.z-origin.z-DOOR.z)<2.2&&Math.abs((feet.y??origin.y)-origin.y)<1.4;}
export function cabinColliders(site,y){
 const box=(x,h,z,hx,hy,hz)=>({x:site.x+x,y:y+h,z:site.z+z,hx,hy,hz});
 return [
  box(0,-.08,0,1.825,.19,1.55),
  box(-1.8,1.16,0,.08,1.1,1.5),box(1.8,1.16,0,.08,1.1,1.5),
  box(-1.45,1.16,1.45,.35,1.1,.08),box(.975,1.16,1.45,.825,1.1,.08),
  box(DOOR.x,2.4,1.45,.625,.13,.08),
  box(DOOR.x,2.4,-1.45,.625,.13,.08),
 ];
}


const fittings=[
 {key:'bench',label:'Use the workbench',x:-1.21,y:1.01,z:-.17,reach:.97},
 {key:'ledger',label:'Read the camp ledger',x:1.12,y:1.00,z:.91,reach:.94},
 {key:'stores',label:'Check the supply shelves',x:1.27,y:1.66,z:-.50,reach:.96},
 {key:'bed',label:'Rest at the cot',x:.06,y:.52,z:-.90,reach:1}
];
const bedroom={...fittings[3],x:.79,y:.63,z:-2.80};
export function shackStation(origin,feet,yaw,state,previous){
 if(!insideShack(origin,feet,state))return null;
 const x=feet.x-origin.x,z=feet.z-origin.z;
 let best=null,score=Infinity;
 for(const fitting of fittings){
  const item=fitting.key==='bed'&&state.lodge>=24?bedroom:fitting;
  const dx=item.x-x,dz=item.z-z,d=Math.hypot(dx,dz);
  const facing=(dx*Math.sin(yaw)+dz*Math.cos(yaw))/Math.max(.001,d);
  const hold=item.key===previous ? .09 : 0;
  if(d>item.reach+hold||(d>.67&&facing<-.24))continue;
  const rank=d-.19*facing-hold;
  if(rank<score){best=item;score=rank;}
 }
 return best;
}
