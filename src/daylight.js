export const DAY_SECONDS=1080;
export const MORNING_HOUR=6.5;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export function advanceClock(state,seconds){
 if(!Number.isFinite(seconds)||seconds<=0)return;
 const total=state.hour+seconds*24/DAY_SECONDS;
 state.day+=Math.floor(total/24);state.hour=total%24;
}
export const canSleep=state=>state.hour>=18||state.hour<MORNING_HOUR;
export function sleepUntilMorning(state){
 if(!canSleep(state))return false;
 if(state.hour>=MORNING_HOUR)state.day++;
 state.hour=MORNING_HOUR;return true;
}
export function daylightAt(hour){
 const h=((hour%24)+24)%24;
 const daylight=smooth(4.75,7.5,h)*(1-smooth(17,19.5,h));
 const dusk=Math.max(Math.exp(-(((h-6)/1.25)**2)),Math.exp(-(((h-18)/1.25)**2)))*.85;
 const phase=h<5?'Night':h<7.5?'Dawn':h<16.5?'Day':h<19.5?'Evening':'Night';
 return {daylight,dusk,night:1-daylight,phase};
}
export function clockLabel(state){
 const minutes=Math.floor(state.hour*60+1e-7)%1440;
 return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
}
export function sleepFade(seconds){
 return seconds<.7?smooth(0,.7,seconds):seconds<1.05?1:1-smooth(1.05,2,seconds);
}
