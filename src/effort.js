// Stamina is spent by takeoffs and by ground actually covered at a sprint.
export class Endurance {
  constructor(value=100) {
    this.value=Math.max(0,Math.min(100,value));
    this.recoverIn=0;
    this.exhausted=this.value===0;
  }
  jumpCost(load){return 13+5*load;}
  takeOff(load){
    const cost=this.jumpCost(load);
    if(this.exhausted||this.value<cost)return false;
    this.value-=cost;this.recoverIn=.95;
    if(this.value<.01)this.exhausted=true;
    return true;
  }
  update(dt,{sprinting=false,moving=false,load=0,lunch=false,resting=false}={}){
    if(sprinting&&!this.exhausted){
      this.value=Math.max(0,this.value-dt*(7.4+3*load)*(lunch?.72:1));
      this.recoverIn=.85;if(this.value===0)this.exhausted=true;return;
    }
    const recover=Math.max(0,dt-this.recoverIn);this.recoverIn=Math.max(0,this.recoverIn-dt);
    this.value=Math.min(100,this.value+recover*(resting?28:moving?9:15)*(lunch?1.2:1));
    if(this.value>=24)this.exhausted=false;
  }
  replenish(){this.value=100;this.recoverIn=0;this.exhausted=false;}
}
