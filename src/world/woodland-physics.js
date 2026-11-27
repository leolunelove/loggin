import * as THREE from 'three';

const up = new THREE.Vector3(0,1,0);

// Four sections of the rendered bole retain the root flare, lean and taper.
// Vertices are local so a second-generation tree can reuse the same shape.
export function trunkHull(tree, trunkAt, top) {
  const points=[], center=new THREE.Vector3();
  for (const h of [-.18,.45,2.1,top]) {
    const radius=trunkAt(h,center);
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5;
      points.push(center.x-tree.x+Math.cos(a)*radius,h,center.z-tree.z+Math.sin(a)*radius);
    }
  }
  return new Float32Array(points);
}
export function plantTrunk(world,R,tree) {
  if (!tree.hull) return null;
  return world.createCollider(R.ColliderDesc.convexHull(tree.hull).setTranslation(tree.x,tree.y,tree.z));
}

export function fallingTrunk(world,R,tree) {
  if(!tree.hull)return null;
  const body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(tree.x,tree.y+.38,tree.z));
  world.createCollider(R.ColliderDesc.convexHull(tree.hull).setTranslation(0,-.38,0),body);
  return body;
}

export function sectionBody(world,R,mesh,r,length,dx,dz,live) {
  const p=mesh.position,q=mesh.quaternion;
  const desc=R.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z).setRotation(q)
    .setLinearDamping(1.15).setAngularDamping(1.6).setCcdEnabled(true);
  const body=world.createRigidBody(desc);
  const mass=Math.max(5,Math.PI*r*r*length*430);
  world.createCollider(R.ColliderDesc.cylinder(length/2,r*.95).setFriction(.82).setRestitution(.13).setMass(mass),body);
  if(live){
    body.setLinvel({x:dx*.46,y:-.24,z:dz*.46},true);
    body.setAngvel({x:dz*1.25,y:0,z:-dx*1.25},true);
  } else body.sleep();
  return body;
}

export function placeSection(mesh,x,z,dx,dz,length,r,ground,live) {
  const half=length/2, low=ground(x-dx*half,z-dz*half), high=ground(x+dx*half,z+dz*half);
  mesh.position.set(x,Math.max(ground(x,z),(low+high)/2)+r+(live?.12:.015),z);
  mesh.quaternion.setFromUnitVectors(up,new THREE.Vector3(dx,(high-low)/length,dz).normalize());
}
