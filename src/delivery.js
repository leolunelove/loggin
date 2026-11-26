export const DELIVERY_SECONDS=1.45,DELIVERY_LAND=.78;
export function beginDelivery(carried){
 if(carried<=0)return null;
 const count=Math.min(3,Math.ceil(carried/18)),parts=[];let remaining=carried;
 for(let i=0;i<count;i++){const amount=Math.ceil(remaining/(count-i));parts.push(amount);remaining-=amount;}
 return {parts,elapsed:0,committed:0,progress:0,batch:0};
}
export function advanceDelivery(delivery,dt){
 delivery.elapsed+=Math.max(0,dt);let amount=0;
 while(delivery.committed<delivery.parts.length&&delivery.elapsed>=(delivery.committed+DELIVERY_LAND)*DELIVERY_SECONDS)amount+=delivery.parts[delivery.committed++];
 delivery.batch=Math.min(delivery.parts.length-1,Math.floor(delivery.elapsed/DELIVERY_SECONDS));
 delivery.progress=Math.min(1,delivery.elapsed/DELIVERY_SECONDS-delivery.batch);
 return {amount,done:delivery.elapsed>=delivery.parts.length*DELIVERY_SECONDS};
}
