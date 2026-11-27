import * as THREE from 'three';

// A curved fibre with a torn point, in three cross-sections. Instances share geometry
// and get their own length, spin and outward kick from the actual cut.
export function woodChip(){
  const vertices=[
    [-.009,0,-.052],[.006,.001,-.049],[.003,.005,-.048],
    [-.018,0,-.004],[.016,-.002,.008],[.004,.010,.003],
    [-.003,.010,.055],[.004,.009,.042],[.001,.012,.043],
  ];
  const index=[0,2,1,6,7,8];
  for(let r=0;r<2;r++)for(let i=0;i<3;i++){
    const a=r*3+i,b=r*3+(i+1)%3;index.push(a,b,a+3,b,b+3,a+3);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));
  geometry.setIndex(index);const shape=geometry.toNonIndexed();geometry.dispose();shape.computeVertexNormals();return shape;
}
export function throwChips(game,point,nx,nz,count,finishing=false){
  const energy=game.swing?.energy??.7;
  for(let i=0;i<count;i++){
    const outer=i%4===0,mesh=new THREE.Mesh(game.chipGeometry,outer?game.woodPaint:game.cutPaint);
    const side=(Math.random()-.5)*(finishing?2.1:1.5),kick=.55+energy*(.48+Math.random()*(finishing?2.7:1.5));
    mesh.position.copy(point);mesh.position.x+=nx*.009;mesh.position.z+=nz*.009;
    mesh.rotation.set(Math.random()*3,Math.atan2(nx,nz)+side,Math.random()*2);
    const s=(finishing?.67:.47)+Math.random()*(finishing?1.05:.68);
    mesh.scale.set(s*(outer?1.1:.8),s,s*(.74+Math.random()*.53));game.scene.add(mesh);
    game.chips.push({mesh,spin:3+Math.random()*9,roll:(Math.random()-.5)*6,life:.76+Math.random()*.43,
      v:new THREE.Vector3(nx*kick-nz*side,.65+energy*Math.random()*(finishing?2.6:2),nz*kick+nx*side)});
  }
}
export function stepChips(game,dt){
  for(let i=game.chips.length-1;i>=0;i--){
    const c=game.chips[i],p=c.mesh.position;c.life-=dt;
    if(!c.settled){
      c.v.y-=9.81*dt;p.addScaledVector(c.v,dt);c.mesh.rotation.x+=dt*c.spin;c.mesh.rotation.z+=dt*c.roll;
      const floor=game.heightAt(p.x,p.z)+.012;
      if(p.y<=floor&&c.v.y<0){
        p.y=floor;c.v.multiplyScalar(.38);c.v.y*=-.52;c.spin*=.32;c.roll*=.3;
        if(c.v.y<.37){c.settled=true;c.mesh.rotation.x=0;}
      }
    }
    if(c.life<.20)c.mesh.scale.multiplyScalar(Math.exp(-dt*8));
    if(c.life<=0){game.scene.remove(c.mesh);game.chips.splice(i,1);}
  }
}
