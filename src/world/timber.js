import * as THREE from 'three';

// Board space is fixed when a piece is sawn. A door can swing or a plank can
// move to the stack without the grain sliding. The end face uses both short axes.
export function dressTimber(geometry,position){
  if(geometry.hasAttribute('aBoard'))return;
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  const extent=geometry.boundingBox.getSize(new THREE.Vector3()).toArray();
  const axes=[0,1,2].sort((a,b)=>extent[b]-extent[a]);
  const [long,wide,thin]=axes,p=geometry.attributes.position,n=geometry.attributes.normal;
  const [x,y,z]=position,seed=THREE.MathUtils.euclideanModulo(x*.417+y*.673+z*.381,1);
  const data=new Float32Array(p.count*4);
  for(let i=0;i<p.count;i++){
    const end=Math.abs(n.getComponent(i,long))>.75;
    const side=Math.abs(n.getComponent(i,wide))>.75?thin:wide;
    data.set([p.getComponent(i,end?wide:side),p.getComponent(i,end?thin:long),end?1:0,seed],i*4);
  }
  geometry.setAttribute('aBoard',new THREE.BufferAttribute(data,4));
}
