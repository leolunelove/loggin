import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {pinDabs} from '../src/oilpaint/pins.js';

function triangle(){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0],3));
  g.computeVertexNormals();
  return g;
}
const palette=[[[.8,.6,.3],[.6,.4,.2],[.3,.2,.1]]];
const up=new THREE.Vector3(0,1,0);
const paint=mesh=>pinDabs({},palette,[{mesh,count:96,style:()=>({pal:0,size:[.01,.03],dir:up})}],{surface:true});
const point=(attr,i)=>new THREE.Vector3().fromBufferAttribute(attr,i);

test('paint occupies triangle interiors and follows hidden parent pieces',()=>{
  const mesh=new THREE.Mesh(triangle()),group=new THREE.Group();
  group.add(mesh);group.updateMatrixWorld(true);
  const brush=paint(mesh),attr=brush.mesh.geometry.attributes;
  brush.update();
  const points=Array.from({length:brush.count},(_,i)=>point(attr.aPos,i));
  assert.ok(points.every(p=>p.x>0&&p.y>0&&p.x+p.y<1));
  assert.ok(points.filter(p=>p.x>.15&&p.y>.15&&p.x+p.y<.85).length>20);
  const firstVersion=attr.aPos.version;brush.update();assert.equal(attr.aPos.version,firstVersion);
  group.visible=false;brush.update();assert.ok(attr.aVisible.array.every(v=>!v));
  group.visible=true;mesh.position.x=2;group.updateMatrixWorld(true);brush.update();
  assert.ok(Math.abs(attr.aPos.getX(0)-points[0].x-2)<1e-6);
});
test('a dab between bones stays on the actual animated triangle under non-uniform scale',()=>{
  const geometry=triangle(),root=new THREE.Bone(),tip=new THREE.Bone();
  root.add(tip);root.updateMatrixWorld(true);
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([0,0,0,0, 1,0,0,0, 0,1,0,0],4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0, 1,0,0,0, .3,.7,0,0],4));
  const mesh=new THREE.SkinnedMesh(geometry);mesh.add(root);mesh.bind(new THREE.Skeleton([root,tip]));
  const brush=paint(mesh),attr=brush.mesh.geometry.attributes.aPos;
  mesh.updateMatrixWorld(true);brush.update();
  const bind=Array.from({length:brush.count},(_,i)=>point(attr,i));
  tip.rotation.set(.4,-.2,.8);tip.position.set(.15,.4,-.32);mesh.scale.set(1.5,1,.8);mesh.position.set(2,0,3);mesh.updateMatrixWorld(true);
  const corners=[0,1,2].map(i=>mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
  brush.update();
  for(const [i,p] of bind.entries()){
    const expected=corners[0].clone().multiplyScalar(1-p.x-p.y).addScaledVector(corners[1],p.x).addScaledVector(corners[2],p.y);
    assert.ok(point(attr,i).distanceTo(expected)<.000002);
  }
});