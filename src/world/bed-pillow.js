import * as THREE from 'three';

// A stitched edge around a softly crowned linen pillow. Keep the underside
// against the mattress as the filling compresses under the sleeper's cheek.
export function linenPillow(width,height,depth){
  const geo=new THREE.SphereGeometry(1,28,18),pos=geo.attributes.position;
  const round=(n,exp)=>Math.sign(n)*Math.abs(n)**exp;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const seam=1-.038*Math.exp(-((y/.095)**2));
    pos.setXYZ(i,round(x,.60)*width*.5*seam,round(y,.78)*height*.5,round(z,.60)*depth*.5*seam);
  }
  geo.userData.height=height;geo.computeVertexNormals();return geo;
}
export function pressPillow(mesh,weight){
  if(!mesh)return;
  const rest=mesh.userData.cushion??={y:mesh.position.y,height:mesh.geometry.userData.height};
  mesh.scale.set(1+weight*.034,1-weight*.31,1+weight*.019);
  mesh.position.y=rest.y-.5*rest.height*.31*weight;
}
