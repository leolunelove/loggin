import * as THREE from 'three';
import {deepestCut} from './bark-cut.js';

// Refine only a worked bole near the player. Rows outside the wounds keep the
// original taper. The renderer and the axe use these very same triangles.
export function cutSurface(tree,source,restPositions,restNormals){
  const {sides,count}=tree.toolRings,start=tree.ranges.wood[0],data=source.attributes.aData,ring=source.attributes.aRing;
  const across=THREE.MathUtils.clamp(Math.ceil(2*Math.PI*tree.r/(sides*.016)),1,32);
  const columns=sides*across;
  const heights=Array.from({length:count},(_,i)=>data.getZ(start+i*sides));
  const levels=new Set(heights);
  const baseY=tree.y-.3; // the tube begins 30 cm below the foot
  for(const cut of tree.notches){
    const extent=Math.abs(cut.sine)*cut.width+Math.abs(cut.cosine)*cut.height+.11;
    const centre=cut.y-baseY,lo=Math.max(heights[0],centre-extent),hi=Math.min(heights.at(-1),centre+extent);
    // Use one lattice for overlapping cuts, so crossings do not leave sliver triangles.
    const spacing=.0125;
    for(let row=Math.ceil(lo/spacing);row<=Math.floor(hi/spacing);row++)levels.add(row*spacing);
  }
  const rows=[...levels].sort((a,b)=>a-b).filter((h,i,list)=>!i||h-list[i-1]>.0001);
  const size=columns*rows.length,positions=new Float32Array(size*3),normals=new Float32Array(size*3),pigment=new Float32Array(size);
  const bark=new Float32Array(size*3),rings=new Float32Array(size*2),faces=new Float32Array(size);
  const indices=new Uint32Array((rows.length-1)*columns*6);
  const bilerp=(a,b,c,d,u,v)=>(a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
  let band=0,k=0,index=0;
  for(let j=0;j<rows.length;j++){
    const height=rows[j];while(band<count-2&&heights[band+1]<height)band++;
    const v=(height-heights[band])/(heights[band+1]-heights[band]||1);
    for(let i=0;i<columns;i++,k++){
      const side=Math.floor(i/across),u=(i%across)/across;
      const a=band*sides+side,b=band*sides+(side+1)%sides,c=a+sides,d=b+sides;
      const sample=(buffer,axis)=>bilerp(buffer[a*3+axis],buffer[b*3+axis],buffer[c*3+axis],buffer[d*3+axis],u,v);
      let x=sample(restPositions,0),y=sample(restPositions,1),z=sample(restPositions,2);
      let nx=sample(restNormals,0),ny=sample(restNormals,1),nz=sample(restNormals,2);
      const wound=deepestCut(x,y,z,tree.notches);
      if(wound){
        const cut=wound.cut;x-=cut.nx*wound.depth;z-=cut.nz*wound.depth;
        nx+=cut.nz*wound.sideSlope;ny+=wound.riseSlope;nz-=cut.nx*wound.sideSlope;
        pigment[k]=wound.depth/cut.depth;
        faces[k]=THREE.MathUtils.clamp(-wound.h/.011,-1,1);
      }
      const length=Math.hypot(nx,ny,nz)||1;
      positions.set([x-tree.x,y-tree.y,z-tree.z],k*3);normals.set([nx/length,ny/length,nz/length],k*3);
      bark.set([tree.type,tree.seed,height],k*3);
      rings[k*2]=THREE.MathUtils.lerp(ring.getX(start+a),ring.getX(start+b),u);
      rings[k*2+1]=THREE.MathUtils.lerp(ring.getY(start+a),ring.getY(start+b),u);
      if(j<rows.length-1){
        const next=j*columns+(i+1)%columns;indices.set([k,next,k+columns,next,next+columns,k+columns],index);index+=6;
      }
    }
  }
  const g=new THREE.BufferGeometry();
  for(const [name,buffer,itemSize] of [['position',positions,3],['normal',normals,3],['aData',bark,3],['aRing',rings,2],['aCut',pigment,1],['aCutFace',faces,1]])
    g.setAttribute(name,new THREE.BufferAttribute(buffer,itemSize));
  g.setIndex(new THREE.BufferAttribute(indices,1));g.computeBoundingSphere();
  return g;
}
