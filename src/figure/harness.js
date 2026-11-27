import * as THREE from 'three';

// The fixings belong to the sack. The middle of each strap follows the actual shirt
// over the shoulder, down the chest and under the arm. Both ends stay sewn in.
const PATH=[[.203,.125,.074],[.207,.441,.127],[.170,.610,.177],[.144,.675,.218],
 [.136,.699,.278],[.135,.675,.337],[.137,.581,.395],[.146,.461,.427],
 [.162,.33,.424],[.190,.243,.381],[.217,.199,.275],[.223,.151,.164],[.214,.126,.094]];
const RINGS=28,SIDES=6;
const circle=Array.from({length:SIDES},(_,j)=>[Math.cos(j*2*Math.PI/SIDES),Math.sin(j*2*Math.PI/SIDES)]);

export function createHarnessStrap(sign,packPosition,suit,material) {
 const rest=PATH.map(([x,y,z])=>new THREE.Vector3(sign*x,y,z));
 const curve=new THREE.CatmullRomCurve3(rest.map(p=>p.clone()));
 const pos=new THREE.Float32BufferAttribute(new Float32Array((RINGS+1)*SIDES*3),3).setUsage(THREE.DynamicDrawUsage);
 const nrm=new THREE.Float32BufferAttribute(new Float32Array(pos.count*3),3).setUsage(THREE.DynamicDrawUsage);
 const g=new THREE.BufferGeometry(),indices=[];
 for(let i=0;i<RINGS;i++)for(let j=0;j<SIDES;j++){
   const a=i*SIDES+j,b=i*SIDES+(j+1)%SIDES;indices.push(a,b,a+SIDES,b,b+SIDES,a+SIDES);
 }
 g.setAttribute('position',pos);g.setAttribute('normal',nrm);g.setIndex(indices);
 const mesh=new THREE.Mesh(g,material);mesh.name='leather shoulder strap';mesh.layers.enable(1);mesh.frustumCulled=false;
 const p=new THREE.Vector3(),q=new THREE.Vector3(),tangent=new THREE.Vector3(),widthAxis=new THREE.Vector3(),thickAxis=new THREE.Vector3(),local=new THREE.Matrix4();
 const anchors=rest.map((r,i)=>{
   if(!suit||i<2||i>10)return null;
   const {position,normal}=suit.geometry.attributes,target=r.clone().add(packPosition);
   let best=Infinity,v=0;
   for(let j=0;j<position.count;j++){
     const d=p.fromBufferAttribute(position,j).distanceToSquared(target);
     if(d<best){v=j;best=d;}
   }
   return {v,point:new THREE.Vector3().fromBufferAttribute(position,v),normal:new THREE.Vector3().fromBufferAttribute(normal,v)};
 });
 function update(resting=0,outerLayer=0) {
   if(suit)local.copy(mesh.matrixWorld).invert().multiply(suit.matrixWorld);
   for(let j=0;j<rest.length;j++){
     const anchor=anchors[j],target=curve.points[j];
     target.copy(rest[j]);
     if(anchor&&resting<1){
       // A little ease over the quilt or apron keeps the edge out of the fabric.
       p.copy(anchor.point).addScaledVector(anchor.normal,.011+outerLayer);
       suit.applyBoneTransform(anchor.v,p).applyMatrix4(local);
       target.lerp(p,(1-resting)*(j===2||j===10?.75:1));
     }
     if(resting){target.y*=1.-.26*resting;target.z=target.z*(1.-.60*resting)+.062*resting;}
   }
   for(let i=0;i<=RINGS;i++){
     const t=i/RINGS,width=.013+.012*Math.sin(Math.PI*t);
     curve.getPoint(t,p);curve.getTangent(t,tangent);
     widthAxis.set(sign,0,0).addScaledVector(tangent,-sign*tangent.x).normalize();
     thickAxis.crossVectors(tangent,widthAxis).normalize();
     for(let j=0;j<SIDES;j++){
       const [a,b]=circle[j],v=i*SIDES+j;
       q.copy(p).addScaledVector(widthAxis,a*width).addScaledVector(thickAxis,b*.004);pos.setXYZ(v,q.x,q.y,q.z);
       q.copy(widthAxis).multiplyScalar(a/width).addScaledVector(thickAxis,b/.004).normalize();nrm.setXYZ(v,q.x,q.y,q.z);
     }
   }
   pos.needsUpdate=true;nrm.needsUpdate=true;
 }
 update(1);
 return {mesh,update};
}
