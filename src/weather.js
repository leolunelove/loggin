const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const roll=(seed,index)=>{let n=(seed^Math.imul(index+127,0x45d9f3b))>>>0;n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;};
// Forecast follows saved camp time; reloading or opening menus cannot reroll it.
export function weatherAt({seed=0,day=1,hour=9}){
 const time=(day-1)*24+hour,slot=Math.floor(time/3),phase=time/3-slot;
 const rainfall=i=>{if(i<4)return 0;const r=roll(seed,i);return r<.38?.45+roll(seed,i+800)*.55:0;};
 const blend=smooth(0,.18,phase),rain=rainfall(slot-1)*(1-blend)+rainfall(slot)*blend;
 const mist=roll(seed,day+17000)<.32?smooth(4.5,6,hour)*(1-smooth(8,10.5,hour))*(1-rain*.65):0;
 return {rain,mist,overcast:Math.max(rain*.85,mist*.35),label:rain>.12?'Rain':mist>.18?'Morning mist':'Clear'};
}
export function shelterAt(origin,state,feet){
 const x=feet.x-origin.x,z=feet.z-origin.z;
 if(Math.abs(feet.y-origin.y)>2)return 0;
 if(Math.abs(x)<1.8&&z<1.5&&z>(state.lodge>=24?-4.1:-1.5))return 1;
 if(state.porch>=12&&Math.abs(x)<1.9&&z>=1.5&&z<3.1)return .7;
 if(state.sawmill>=40&&Math.abs(x-6.4)<1.9&&Math.abs(z+4.6)<1.45)return .65;
 return 0;
}
export function rainMix(intensity,shelter){return {woods:intensity*(.34-.24*shelter),roof:intensity*shelter*.65,cutoff:6500-4800*shelter};}
