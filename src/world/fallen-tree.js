import * as THREE from 'three';
import {HINGE} from './fallen-wood.js';
import {BARK_GROUPS,TRUNK_GROUPS} from './woodland-physics.js';

const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion(),UP=new THREE.Vector3(0,1,0);
const MIN_END=.45;
function disposePart(part,world){
  world.removeRigidBody(part.body);
  part.mesh.removeFromParent();part.shadow.removeFromParent();
  part.mesh.traverse(m=>m.geometry?.dispose());
  // The wood shadow shares its geometry with the tree. Only the crown has its own.
  for(const m of part.shadow.children)if(m.isInstancedMesh){m.geometry.dispose();m.dispose();}
}
function place(part,p,q){
  part.mesh.position.copy(p);part.mesh.quaternion.copy(q);
  part.shadow.position.copy(p);part.shadow.quaternion.copy(q);
}
export class FallenTree{
  constructor(game,tree,wood,record){
    Object.assign(this,{game,tree,wood,record});this.parts=[];
    // Older camps recorded three woodpile jobs. Preserve their scores on the
    // corresponding lengths of the actual tree when loading one of those camps.
    record.kerfs??=Array.from({length:3},(_,i)=>({at:HINGE+(wood.top-HINGE)*(i+.5)/3,
      hits:record.mask&(1<<i)?3:record.scores?.[i]||0,azimuth:0})).filter(k=>k.hits);
    this.tree.sections=this.parts;
  }
  create(lo,hi,p,q,hinged=false){
    const {game,wood,tree}=this,R=game.RAPIER,part=wood.piece(lo,hi,game.cutPaint,game.forest.shadeMaterial);
    const desc=hinged?R.RigidBodyDesc.kinematicPositionBased():R.RigidBodyDesc.dynamic();
    part.body=game.physics.createRigidBody(desc.setTranslation(p.x,p.y,p.z).setRotation(q)
      .setLinearDamping(1.45).setAngularDamping(2.05).setCcdEnabled(true));
    const hull=[];
    for(let k=0;k<5;k++){
      const at=lo+(hi-lo)*k/4,centre=wood.centre(at).sub(part.rest),radius=wood.radius(at);
      for(let j=0;j<10;j++){const a=j*Math.PI/5;hull.push(centre.x+radius*Math.cos(a),centre.y,centre.z+radius*Math.sin(a));}
    }
    const attach=desc=>{const c=game.physics.createCollider(desc,part.body);c.fallenPart=part;return c;};
    attach(R.ColliderDesc.convexHull(new Float32Array(hull)).setCollisionGroups(TRUNK_GROUPS)
      .setFriction(.86).setRestitution(.065).setDensity(430));
    for(const limb of wood.limbs){
      if(limb.at<lo||limb.at>=hi)continue;
      for(let j=0;j<limb.joints.length-1;j+=2){
        const start=limb.joints[j],end=limb.joints[Math.min(j+2,limb.joints.length-1)],radius=(start[3]+end[3])*.46;
        if(radius<.035)continue;
        const a=V().fromArray(start),b=V().fromArray(end),axis=b.clone().sub(a),mid=a.lerp(b,.5).sub(part.rest);
        attach(R.ColliderDesc.capsule(axis.length()*.5,radius).setRotation(Q().setFromUnitVectors(UP,axis.normalize()))
          .setTranslation(mid.x,mid.y,mid.z).setCollisionGroups(TRUNK_GROUPS).setDensity(310).setFriction(.88));
      }
    }
    const geo=part.mesh.children[0].geometry;
    const skin=attach(R.ColliderDesc.trimesh(geo.attributes.position.array,new Uint32Array(geo.index.array),R.TriMeshFlags.FIX_INTERNAL_EDGES)
      .setCollisionGroups(BARK_GROUPS).setMass(0));
    geo.computeBoundingBox();skin.toolBounds=geo.boundingBox;
    part.tree=tree;part.owner=this;
    place(part,p,q);game.scene.add(part.mesh);game.forest.shade.add(part.shadow);
    this.parts.push(part);this.updateMarks(part);return part;
  }
  local(part,p){
    return V().copy(p).sub(part.body.translation()).applyQuaternion(Q().copy(part.body.rotation()).invert()).add(part.rest);
  }
  poseAt(rest,angle){
    const dx=Math.sin(this.record.bearing),dz=Math.cos(this.record.bearing);
    const q=Q().setFromAxisAngle(V().set(dz,0,-dx),angle);
    const p=rest.clone().sub(V().set(0,HINGE,0)).applyQuaternion(q)
      .add(V().set(this.tree.x,this.tree.y+HINGE,this.tree.z));
    return {p,q};
  }
  begin(angle,hinged){
    const {wood,record}=this,ends=[HINGE];
    for(const k of [...record.kerfs].sort((a,b)=>a.at-b.at))
      if(k.hits===3&&k.at-ends.at(-1)>=MIN_END&&wood.top-k.at>=MIN_END)ends.push(k.at);
    ends.push(wood.top);
    for(let i=1;i<ends.length;i++){
      const lo=ends[i-1],hi=ends[i],saved=record.pieces?.find(row=>Math.abs(row[0]-lo)<.001&&Math.abs(row[1]-hi)<.001);
      const pose=this.poseAt(wood.centre((hi+lo)/2),angle);
      if(saved&&!hinged){pose.p.fromArray(saved,2);pose.q.fromArray(saved,5).normalize();}
      const part=this.create(lo,hi,pose.p,pose.q,hinged);
      if(!hinged&&saved){
        if(saved.length===15){
          part.body.setLinvel(V().fromArray(saved,9),true);
          part.body.setAngvel(V().fromArray(saved,12),true);
        }else part.body.sleep();
      }
    }
  }
  fall(angle,landed){
    const part=this.parts[0],{p,q}=this.poseAt(part.rest,angle);
    if(landed){
      part.body.setTranslation(p,true);part.body.setRotation(q,true);
      part.body.setBodyType(this.game.RAPIER.RigidBodyType.Dynamic,true);
      const bearing=this.record.bearing;
      part.body.setLinvel({x:Math.sin(bearing)*.16,y:-.26,z:Math.cos(bearing)*.16},true);
      part.body.setAngvel({x:Math.cos(bearing)*.20,y:0,z:-Math.sin(bearing)*.20},true);
    }else{part.body.setNextKinematicTranslation(p);part.body.setNextKinematicRotation(q);}
    place(part,p,q);
  }
  sync(){
    let settled=false;
    for(const p of this.parts){
      if(!p.body.isDynamic())continue;
      const asleep=p.body.isSleeping();if(asleep&&p.atRest)continue;
      place(p,p.body.translation(),p.body.rotation());
      if(asleep)settled=true;p.atRest=asleep;
    }
    return settled;
  }
  snapshot(){
    if(!this.parts.every(p=>p.body.isDynamic()))return;
    this.record.pieces=this.parts.map(part=>{
      const p=part.body.translation(),q=part.body.rotation(),row=[part.lo,part.hi,p.x,p.y,p.z,q.x,q.y,q.z,q.w];
      if(!part.body.isSleeping()){
        const v=part.body.linvel(),w=part.body.angvel();row.push(v.x,v.y,v.z,w.x,w.y,w.z);
      }
      return row;
    });
  }
  updateMarks(part){
    for(const m of part.marks){part.mesh.remove(m);m.geometry.dispose();}part.marks=[];
    for(const k of this.record.kerfs){
      if(k.hits>=3||k.at<=part.lo||k.at>=part.hi)continue;
      const radius=this.wood.radius(k.at),arc=.92+.82*k.hits;
      const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius+.002,.008+.004*k.hits,4,16,arc),this.game.cutPaint);
      mesh.position.copy(this.wood.centre(k.at)).sub(part.rest);
      mesh.rotation.set(-Math.PI/2,0,-k.azimuth-arc*.5);
      part.mesh.add(mesh);part.marks.push(mesh);
    }
    part.hits=this.record.kerfs.reduce((n,k)=>k.at>part.lo&&k.at<part.hi&&k.hits<3?Math.max(n,k.hits):n,0);
  }
  cut(part,p,strength){
    if(!part.body.isDynamic()||part.length<2*MIN_END+.02)return null;
    const at=this.local(part,p),station=THREE.MathUtils.clamp(at.y,part.lo+MIN_END,part.hi-MIN_END);
    const centre=this.wood.centre(station),radius=this.wood.radius(station);
    if(Math.hypot(at.x-centre.x,at.z-centre.z)>radius+.18)return null;
    let k=this.record.kerfs.find(k=>k.hits<3&&k.at>part.lo&&k.at<part.hi&&Math.abs(k.at-station)<.26);
    if(!k){
      k={at:station,hits:0,azimuth:Math.atan2(at.z-centre.z,at.x-centre.x)};this.record.kerfs.push(k);
    }
    k.hits=Math.min(3,k.hits+strength);
    const work={length:part.length,hits:k.hits,sourceIndex:Math.min(2,Math.floor((k.at-HINGE)/(this.wood.top-HINGE)*3))};
    if(k.hits===3)this.divide(part,k.at);else this.updateMarks(part);
    return work;
  }
  divide(part,at){
    const q=Q().copy(part.body.rotation()),p=V().copy(part.body.translation()),v=V().copy(part.body.linvel()),omega=V().copy(part.body.angvel());
    const axis=UP.clone().applyQuaternion(q);
    this.parts.splice(this.parts.indexOf(part),1);disposePart(part,this.game.physics);
    for(const [lo,hi,sign] of [[part.lo,at,-1],[at,part.hi,1]]){
      const offset=this.wood.centre((lo+hi)/2).sub(part.rest).applyQuaternion(q);
      const child=this.create(lo,hi,p.clone().add(offset),q);
      const velocity=v.clone().add(omega.clone().cross(offset)).addScaledVector(axis,sign*.075);
      child.body.setLinvel(velocity,true);child.body.setAngvel(omega,true);
    }
  }
  dispose(){for(const p of this.parts)disposePart(p,this.game.physics);this.parts.length=0;}
}
