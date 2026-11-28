import * as THREE from 'three';
import {dabGeometry,dabMesh} from '../oilpaint/dabs.js';

export {HINGE} from '../timber-harvest.js';
const V=()=>new THREE.Vector3(),fields=[['position',3],['normal',3],['aData',3],['aRing',2],['aCut',1],['aCutFace',1]];
const mix=(a,b,u)=>u===0?a:u===1?b:a.map((x,i)=>x+(b[i]-x)*u);

// Copy the painted stock once, while it is still upright. All subsequent
// lengths are ranges of this stock, including the tree's existing axe cuts.
function vertex(g,index,origin){
  const row=[];
  for(const [name,size] of fields){
    const a=g.attributes[name];
    for(let k=0;k<size;k++)row.push(a.getComponent(index,k));
  }
  row[0]-=origin.x;row[1]-=origin.y;row[2]-=origin.z;
  return row;
}
function rings(g,first,end,sides,origin){
  const rows=[];
  for(let i=first;i<end;i+=sides){
    const points=Array.from({length:sides},(_,j)=>vertex(g,i+j,origin));
    rows.push({at:points[0][8]-.3,points});
  }
  return rows;
}
function ringAt(rows,at){
  let i=1;while(i<rows.length-1&&rows[i].at<at)i++;
  const a=rows[i-1],b=rows[i],u=THREE.MathUtils.clamp((at-a.at)/(b.at-a.at),0,1);
  return a.points.map((v,j)=>mix(v,b.points[j],u));
}
function ringCentre(points){
  const centre=V();for(const v of points){centre.x+=v[0];centre.y+=v[1];centre.z+=v[2];}
  return centre.divideScalar(points.length);
}
function copyPaint(source,first,end,origin,attachment){
  const attrs=Object.entries(source.geometry.attributes).filter(([,a])=>a.isInstancedBufferAttribute);
  const data={},at=[],limbs=[];for(const [name,a] of attrs)data[name]=[a.array.slice(first*a.itemSize,end*a.itemSize),a.itemSize];
  const p=data.aPos[0];
  for(let i=0;i<end-first;i++){
    p[i*3]-=origin.x;p[i*3+1]-=origin.y;p[i*3+2]-=origin.z;
    const owner=attachment(first+i,p[i*3+1]);at.push(owner.at);limbs.push(owner.limb??-1);
  }
  return {data,at,limbs,material:source.material,order:source.renderOrder};
}
const belongs=(at,lo,hi,top)=>at>=lo&&(at<hi||hi===top&&at<=top+.001);

function paintedPiece(paint,include,centre){
  const ids=[];paint.at.forEach((at,i)=>{if(include(at,paint.limbs[i]))ids.push(i);});
  if(!ids.length)return null;
  const attrs={};
  for(const [name,[values,size]] of Object.entries(paint.data)){
    const dst=new Float32Array(ids.length*size);
    ids.forEach((i,j)=>{for(let k=0;k<size;k++)dst[j*size+k]=values[i*size+k];});
    if(name==='aPos')for(let j=0;j<ids.length;j++){dst[j*3]-=centre.x;dst[j*3+1]-=centre.y;dst[j*3+2]-=centre.z;}
    attrs[name]=[dst,size];
  }
  return dabMesh(dabGeometry(ids.length,attrs),paint.material,paint.order);
}

export class FallenWood{
  constructor(tree,wood,bark,leaves){
    const {bole,toolRings}=tree,origin=V().set(tree.x,tree.y,tree.z);
    this.tree=tree;this.top=bole.top;this.material=wood.material;
    const start=tree.ranges.wood[0],g=wood.geometry;
    this.stock=rings(g,start,start+bole.rings*bole.sides,bole.sides,origin);
    this.bands=[this.stock];
    if(tree.detailMesh){
      const fine=tree.detailMesh.geometry,heights=fine.attributes.aData,first=heights.getZ(0);
      let sides=1;while(sides<heights.count&&heights.getZ(sides)===first)sides++;
      this.bands=[rings(fine,0,heights.count,sides,V()),this.stock.slice(toolRings.count-1)];
    }
    this.limbs=tree.limbs.map((l,id)=>({...l,id,vertices:Array.from({length:l.end-l.first},(_,i)=>vertex(g,l.first+i,origin))}));
    for(const limb of this.limbs){
      // Start a limb target where the bough emerges from the bole. A hit on the
      // opposite side of the trunk should make a crosscut, even at this height.
      const joints=limb.joints.map(j=>V().fromArray(j));
      let j=1;
      const outside=p=>{const c=this.centre(p.y);return Math.hypot(p.x-c.x,p.z-c.z)>this.radius(p.y);};
      while(j<joints.length-1&&!outside(joints[j]))j++;
      let a=joints[j-1].clone(),b=joints[j].clone();
      for(let n=0;n<8;n++){const mid=a.clone().lerp(b,.5);if(outside(mid))b=mid;else a=mid;}
      limb.collar=b;limb.axis=joints[j].clone().sub(joints[j-1]).normalize();
      limb.path=[b,...joints.slice(j)];limb.radius=limb.joints[Math.max(0,j-1)][3];
    }
    this.bunches=tree.leafBunches.map(b=>{
      let limb=this.limbs.find(l=>l.at===b.at);
      if(!limb&&this.limbs.length){
        const point=V().fromArray(b.lobe);
        let best=Infinity;
        for(const l of this.limbs){
          const distance=point.distanceToSquared(V().fromArray(l.joints.at(-1)));
          if(distance<best){best=distance;limb=l;}
        }
      }
      return {...b,at:limb?.at??b.at,limb:limb?.id??-1};
    });
    this.bark=copyPaint(bark,...tree.ranges.bark,origin,(i,y)=>{
      const l=this.limbs.find(l=>i>=l.firstBark&&i<l.endBark);
      return {at:l?.at??y,limb:l?.id};
    });
    let bunch=0;
    this.leaves=copyPaint(leaves,...tree.ranges.leaf,origin,i=>{
      while(bunch+1<this.bunches.length&&i>=this.bunches[bunch].end)bunch++;
      return this.bunches[bunch]??{at:this.top};
    });
  }
  centre(at){return ringCentre(ringAt(this.stock,at));}
  radius(at){
    const ring=ringAt(this.stock,at),c=ringCentre(ring);
    return ring.reduce((n,v)=>n+Math.hypot(v[0]-c.x,v[2]-c.z),0)/ring.length;
  }
  band(at,width=.039){
    const points=[],indices=[];
    for(const h of [at-width/2,at+width/2]){
      const ring=ringAt(this.stock,h),c=ringCentre(ring);
      for(const v of ring){const p=V().fromArray(v).sub(c).multiplyScalar(1.035).add(c);points.push(...p.toArray());}
    }
    const n=points.length/6;
    for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,n+i,j,n+j,n+i);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);
    geo.computeVertexNormals();return geo;
  }
  // Keep all original vertices and brush marks between the two saw lines.
  // At an actual crosscut, interpolate a new rim on both matching ends.
  piece(lo,hi,endMaterial,shadeMaterial,removed=[],only=null){
    const centre=only?V().fromArray(only.joints[Math.floor(only.joints.length/2)]):this.centre((lo+hi)/2);
    const include=(at,id)=>belongs(at,lo,hi,this.top)&&(only?id===only.id:!removed.includes(id));
    const attrs=fields.map(()=>[]),sides=[],caps=[];
    const append=row=>{
      const index=attrs[0].length/3;let j=0;
      for(let f=0;f<fields.length;f++)for(let k=0;k<fields[f][1];k++,j++)
        attrs[f].push(f===0?row[j]-centre.getComponent(k):row[j]);
      return index;
    };
    const connect=(first,second,n,out)=>{
      for(let j=0;j<n;j++){const k=(j+1)%n;out.push(first+j,first+k,second+j,first+k,second+k,second+j);}
    };
    const cap=(row,sign)=>{
      const c=ringCentre(row);
      const v=row[0].slice();v.splice(0,6,c.x,c.y,c.z,0,sign,0);const mid=append(v);
      const rim=row.map(p=>{const v=p.slice();v.splice(3,3,0,sign,0);return append(v);});
      for(let j=0;j<rim.length;j++){const k=(j+1)%rim.length;caps.push(mid,rim[sign>0?j:k],rim[sign>0?k:j]);}
    };
    for(const band of only?[]:this.bands){
      if(band.length<2)continue;
      const low=Math.max(lo,band[0].at),high=Math.min(hi,band.at(-1).at);if(high-low<.0001)continue;
      const bottom=ringAt(band,low),top=ringAt(band,high);
      const rows=[bottom,...band.filter(row=>row.at>low+.0001&&row.at<high-.0001).map(r=>r.points),top];
      let previous=null;
      for(const row of rows){const first=attrs[0].length/3;for(const v of row)append(v);
        if(previous!==null)connect(previous,first,row.length,sides);previous=first;}
      if(Math.abs(low-lo)<.0001)cap(bottom,-1);
      if(Math.abs(high-hi)<.0001)cap(top,1);
    }
    for(const limb of this.limbs)if(include(limb.at,limb.id)){
      const start=attrs[0].length/3;for(const v of limb.vertices)append(v);
      for(let j=6;j<limb.vertices.length;j+=6)connect(start+j-6,start+j,6,sides);
    }
    const geometry=new THREE.BufferGeometry();
    fields.forEach(([name,size],i)=>geometry.setAttribute(name,new THREE.Float32BufferAttribute(attrs[i],size)));
    geometry.setIndex(sides.concat(caps));geometry.addGroup(0,sides.length,0);geometry.addGroup(sides.length,caps.length,1);geometry.computeBoundingSphere();
    const mesh=new THREE.Group();mesh.add(new THREE.Mesh(geometry,[this.material,endMaterial]));
    for(const p of [this.bark,this.leaves]){const m=paintedPiece(p,include,centre);if(m)mesh.add(m);}
    const shadow=new THREE.Group();shadow.add(new THREE.Mesh(geometry,shadeMaterial));
    const bunches=this.bunches.filter(b=>include(b.at,b.limb));
    if(bunches.length){
      const shade=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),shadeMaterial,bunches.length);
      bunches.forEach(({lobe:[x,y,z,r]},i)=>shade.setMatrixAt(i,new THREE.Matrix4().makeScale(r*.36,r*.29,r*.36).setPosition(x-centre.x,y-centre.y,z-centre.z)));
      shadow.add(shade);
    }
    return {lo,hi,rest:centre,mesh,shadow,length:hi-lo,radius:this.radius((lo+hi)/2),marks:[]};
  }
}
