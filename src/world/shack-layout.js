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
