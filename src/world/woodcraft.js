import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {paint} from '../figure/figure.js';

export function woodcraft(shared) {
  const colors={
    bark:[[.62,.44,.27],[.37,.26,.18],[.19,.17,.15]], cut:[[.93,.76,.44],[.67,.49,.29],[.37,.28,.20]],
    dark:[[.43,.34,.25],[.27,.22,.18],[.15,.15,.14]], iron:[[.58,.61,.55],[.32,.37,.34],[.17,.21,.21]],
    moss:[[.63,.66,.39],[.36,.46,.29],[.19,.27,.20]], leaf:[[.85,.73,.36],[.56,.57,.25],[.27,.34,.20]],
    cloth:[[.74,.51,.32],[.49,.30,.23],[.29,.21,.18]], stone:[[.65,.63,.51],[.43,.45,.40],[.23,.27,.26]],
    chalk:[[.96,.89,.68],[.75,.69,.51],[.45,.44,.35]], blue:[[.47,.64,.65],[.27,.43,.48],[.16,.28,.32]]};
  const mats=Object.fromEntries(Object.entries(colors).map(([k,p])=>[k,paint(shared,p)]));
  for(const key of ['bark','cut','dark'])mats[key].uniforms.uTimber.value=1;
  const cube=new THREE.BoxGeometry(1,1,1),tube=new THREE.CylinderGeometry(1,1,1,9),rock=new THREE.IcosahedronGeometry(1,0);
  const up=new THREE.Vector3(0,1,0);
  function group(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
  function mesh(g,geo,m,x,y,z,w,h,d){const o=new THREE.Mesh(geo,mats[m]??m);o.position.set(x,y,z);o.scale.set(w,h,d);g.add(o);return o;}
  const box=(g,m,x,y,z,w,h,d)=>mesh(g,cube,m,x,y,z,w,h,d);
  const stone=(g,m,x,y,z,w,h,d)=>mesh(g,rock,m,x,y,z,w,h,d);
  function pole(g,m,a,b,r){
    const v=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),o=mesh(g,tube,m,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,v.length(),r);
    o.quaternion.setFromUnitVectors(up,v.normalize());return o;
  }
  // Collapse fixed joinery by material. Independent wheels, loads and building stages keep their pivots.
  function join(g){
    g.updateWorldMatrix(true,true);const inv=g.matrixWorld.clone().invert(),sets=new Map();
    for(const m of [...g.children]){
      if(!m.isMesh||Array.isArray(m.material))continue;
      const geom=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();
      geom.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,m.matrixWorld));
      if(!sets.has(m.material))sets.set(m.material,[]);sets.get(m.material).push(geom);g.remove(m);
    }
    for(const [mat,geos] of sets){const geom=mergeGeometries(geos);geos.forEach(o=>o.dispose());g.add(new THREE.Mesh(geom,mat));}
    return g;
  }
  return {mats,group,box,stone,pole,mesh,join};
}
