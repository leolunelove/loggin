// Only nearby stems and those still springing back need CPU work.
const cell=4;
const key=(x,z)=>Math.floor(x/cell)+','+Math.floor(z/cell);

export function brushContacts(plants, pose) {
  const grid=new Map(),awake=new Set();
  for(const p of plants){
    p.bendX=p.bendZ=p.velocityX=p.velocityZ=0;
    const id=key(p.x,p.z);
    if(!grid.has(id))grid.set(id,[]);
    grid.get(id).push(p);
  }
  function query(x,z,r,visit){
    for(let j=Math.floor((z-r)/cell);j<=Math.floor((z+r)/cell);j++)
      for(let i=Math.floor((x-r)/cell);i<=Math.floor((x+r)/cell);i++)
        for(const p of grid.get(i+','+j)||[])if(!p.cleared)visit(p);
  }
  function clear(x,z,r){
    query(x,z,r+2,p=>{
      if(Math.hypot(p.x-x,p.z-z)>r+p.radius*.42)return;
      p.cleared=true;awake.delete(p);pose(p,0,0,true);
    });
  }
  function update(dt,feet,velocity,scatter){
    if(!(dt>0))return;
    for(const p of awake){p.targetX=0;p.targetZ=0;}
    const speed=Math.hypot(velocity.x,velocity.z);
    if(feet)query(feet.x,feet.z,3,p=>{
      const dx=p.x-feet.x,dz=p.z-feet.z,dist=Math.hypot(dx,dz);
      const reach=p.radius+.32;
      if(dist>=reach || feet.y>p.y+p.height+.12 || feet.y+1.72<p.y)return;
      const depth=1-dist/reach, bend=Math.min(.82,.28+p.height*.17)*Math.sqrt(depth);
      const mx=speed>.03?velocity.x/speed:0,mz=speed>.03?velocity.z/speed:0;
      const x=dx/Math.max(.08,dist)+mx*.64,z=dz/Math.max(.08,dist)+mz*.64;
      const normal=Math.hypot(x,z)||1;
      p.targetX=bend*x/normal;p.targetZ=bend*z/normal;
      if(!awake.has(p)&&speed>.65)scatter?.(p,velocity);
      awake.add(p);
    });
    const steps=Math.max(1,Math.ceil(dt*90)),h=dt/steps;
    for(const p of awake){
      for(let i=0;i<steps;i++){
        p.velocityX+=((p.targetX-p.bendX)*106-13*p.velocityX)*h;
        p.velocityZ+=((p.targetZ-p.bendZ)*106-13*p.velocityZ)*h;
        p.bendX+=p.velocityX*h;p.bendZ+=p.velocityZ*h;
      }
      if(!p.targetX&&!p.targetZ&&Math.abs(p.bendX)+Math.abs(p.bendZ)+Math.abs(p.velocityX)+Math.abs(p.velocityZ)<.006){
        p.bendX=p.bendZ=p.velocityX=p.velocityZ=0;awake.delete(p);
      }
      pose(p,p.bendX,p.bendZ,false);
    }
  }
  function strike(from,to){
    const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,length=dx*dx+dz*dz;
    let first=null,tFirst=Infinity;
    query(to.x,to.z,3,p=>{
      const t=length?Math.max(0,Math.min(1,((p.x-from.x)*dx+(p.z-from.z)*dz)/length)):0;
      const x=from.x+t*dx,y=from.y+t*dy,z=from.z+t*dz;
      if(t>=tFirst||y<p.y+.12||y>p.y+p.height+.12||Math.hypot(x-p.x,z-p.z)>p.radius*.86+.065)return;
      first={plant:p,x,y,z};tFirst=t;
    });
    if(first){
      const p=first.plant,s=Math.max(.12,Math.hypot(dx,dz));
      p.velocityX+=dx/s*3.4;p.velocityZ+=dz/s*3.4;p.targetX=p.targetZ=0;awake.add(p);
    }
    return first;
  }
  return {clear,update,strike};
}
