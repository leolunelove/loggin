import * as THREE from 'three';
import {HINGE,CARRY_LENGTH,hasTaken,timberAmount,layoutCuts} from '../timber-harvest.js';
import {BARK_GROUPS,TRUNK_GROUPS} from './woodland-physics.js';

const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion(),UP=new THREE.Vector3(0,1,0);
const MIN_END=.45, CUT_EPSILON=.0001;
function disposeShadow(shadow){
  shadow.removeFromParent();
  for(const m of shadow.children)if(m.isInstancedMesh){m.geometry.dispose();m.dispose();}
}
export function disposeWoodMesh(mesh){
  mesh.removeFromParent();mesh.traverse(m=>m.geometry?.dispose());
}
function disposePart(part,world){
  world.removeRigidBody(part.body);disposeShadow(part.shadow);disposeWoodMesh(part.mesh);
}
function attachBough(world,R,body,limb,rest,groups){
  const colliders=[];
  for(let j=0;j<limb.joints.length-1;j+=2){
    const start=limb.joints[j],end=limb.joints[Math.min(j+2,limb.joints.length-1)],radius=(start[3]+end[3])*.46;
    if(radius<.032)continue;
    const a=V().fromArray(start),b=V().fromArray(end),axis=b.clone().sub(a),mid=a.lerp(b,.5).sub(rest);
    const shape=R.ColliderDesc.capsule(axis.length()*.5,radius).setRotation(Q().setFromUnitVectors(UP,axis.normalize()))
      .setTranslation(mid.x,mid.y,mid.z).setCollisionGroups(groups).setDensity(310).setFriction(.88);
    colliders.push(world.createCollider(shape,body));
  }
  return colliders;
}
function place(part,p,q){
  part.mesh.position.copy(p);part.mesh.quaternion.copy(q);
  part.shadow.position.copy(p);part.shadow.quaternion.copy(q);
}
export class FallenTree{
  constructor(game,tree,wood,record){
    Object.assign(this,{game,tree,wood,record});this.parts=[];this.brush=[];
    // Older camps recorded three woodpile jobs. Preserve their scores on the
    // corresponding lengths of the actual tree when loading one of those camps.
    record.kerfs??=Array.from({length:3},(_,i)=>({at:HINGE+(wood.top-HINGE)*(i+.5)/3,
      hits:record.mask&(1<<i)?3:record.scores?.[i]||0,azimuth:0})).filter(k=>k.hits);
    this.tree.sections=this.parts;
  }
  create(lo,hi,p,q,hinged=false){
    const {game,wood,tree}=this,R=game.RAPIER,part=wood.piece(lo,hi,game.cutPaint,game.forest.shadeMaterial,this.record.harvest?.limbed);
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
    part.limbs=new Map();
    for(const limb of wood.limbs){
      if(limb.at<lo||limb.at>=hi||this.record.harvest?.limbed.includes(limb.id))continue;
      const colliders=attachBough(game.physics,R,part.body,limb,part.rest,TRUNK_GROUPS);
      for(const c of colliders)c.fallenPart=part;
      part.limbs.set(limb,colliders);
    }
    part.tree=tree;part.owner=this;this.skin(part);
    place(part,p,q);game.scene.add(part.mesh);game.forest.shade.add(part.shadow);
    part.readyAt=game.time==null?0:game.time+.28;
    this.parts.push(part);this.updateMarks(part);return part;
  }
  skin(part){
    const {physics,RAPIER:R}=this.game,geo=part.mesh.children[0].geometry;
    const skin=physics.createCollider(R.ColliderDesc.trimesh(geo.attributes.position.array,new Uint32Array(geo.index.array),R.TriMeshFlags.FIX_INTERNAL_EDGES)
      .setCollisionGroups(BARK_GROUPS).setMass(0),part.body);
    geo.computeBoundingBox();skin.toolBounds=geo.boundingBox;skin.fallenPart=part;part.skin=skin;
  }
  worldPoint(part,p){return p.clone().sub(part.rest).applyQuaternion(part.body.rotation()).add(part.body.translation());}
  branchNear(part,local){
    if(!this.record.harvest||!part.limbs.size)return null;
    let nearest=null,best=Infinity;
    for(const limb of part.limbs.keys()){
      for(let i=1;i<limb.path.length;i++){
        const line=new THREE.Line3(limb.path[i-1],limb.path[i]),point=line.closestPointToPoint(local,true,V());
        const radius=THREE.MathUtils.lerp(limb.radius,.035,(i-.5)/(limb.path.length-1));
        const distance=point.distanceTo(local)-radius;
        if(distance<best){best=distance;nearest={limb,point,radius,distance,tangent:line.delta(V()).normalize()};}
      }
    }
    return nearest;
  }
  cutBranch(part,limb,blow){
    if(!this.record.harvest||!part.limbs?.has(limb)||!part.body.isDynamic())return false;
    const {game,wood}=this,R=game.RAPIER,body=part.body,q=Q().copy(body.rotation());
    const branch=wood.piece(part.lo,part.hi,game.cutPaint,game.forest.shadeMaterial,[],limb);
    const pos=this.worldPoint(part,branch.rest);
    branch.body=game.physics.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setRotation(q)
      .setLinearDamping(1.35).setAngularDamping(1.6));
    attachBough(game.physics,R,branch.body,limb,branch.rest,(16<<16)|1);
    const kick=(blow?.clone()||limb.axis.clone().applyQuaternion(q)).normalize().multiplyScalar(.65);
    kick.y=Math.max(.16,kick.y);branch.body.setLinvel(kick.add(body.linvel()),true);
    branch.body.setAngvel(V().crossVectors(limb.axis.clone().applyQuaternion(q),kick).multiplyScalar(.64),true);
    branch.expires=(game.time||0)+7;place(branch,pos,q);game.scene.add(branch.mesh);game.forest.shade.add(branch.shadow);this.brush.push(branch);
    this.record.harvest.limbed.push(limb.id);
    for(const c of part.limbs.get(limb))game.physics.removeCollider(c,true);
    part.limbs.delete(limb);game.physics.removeCollider(part.skin,true);
    disposeShadow(part.shadow);disposeWoodMesh(part.mesh);
    const next=wood.piece(part.lo,part.hi,game.cutPaint,game.forest.shadeMaterial,this.record.harvest.limbed);
    part.mesh=next.mesh;part.shadow=next.shadow;part.marks=[];part.guides=null;
    this.skin(part);place(part,body.translation(),q);game.scene.add(part.mesh);game.forest.shade.add(part.shadow);
    part.readyAt=game.time==null?0:game.time+.28;this.updateMarks(part);body.wakeUp();part.atRest=false;return true;
  }
  available(part){
    const h=this.record.harvest;
    return h&&this.parts.includes(part)&&part.body.isDynamic()&&part.length<=CARRY_LENGTH+.001&&!part.limbs.size
      ?timberAmount(h,this.wood.top,part.lo,part.hi):null;
  }
  take(part){
    if(this.available(part)===null)return null;
    this.record.harvest.taken.push([part.lo,part.hi]);
    this.parts.splice(this.parts.indexOf(part),1);
    place(part,part.body.translation(),part.body.rotation());
    this.game.physics.removeRigidBody(part.body);disposeShadow(part.shadow);
    return part.mesh;
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
      if(k.hits===3&&k.at-ends.at(-1)>CUT_EPSILON&&wood.top-k.at>CUT_EPSILON)ends.push(k.at);
    ends.push(wood.top);
    for(let i=1;i<ends.length;i++){
      const lo=ends[i-1],hi=ends[i],saved=record.pieces?.find(row=>Math.abs(row[0]-lo)<.001&&Math.abs(row[1]-hi)<.001);
      if(hasTaken(record.harvest,lo,hi))continue;
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
    for(let i=this.brush.length-1;i>=0;i--){
      const b=this.brush[i],left=b.expires-(this.game.time||0);
      if(left<=0){disposePart(b,this.game.physics);this.brush.splice(i,1);settled=true;continue;}
      const pos=V().copy(b.body.translation());pos.y-=Math.max(0,1-left)*1.8;
      place(b,pos,b.body.rotation());
    }
    for(const p of this.parts){
      if(p.inFlight||!p.body.isDynamic())continue;
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
    if(this.record.harvest&&!part.guides){
      part.guides=new THREE.Group();part.mesh.add(part.guides);
      for(const at of layoutCuts(part.lo,part.hi)){
        const mark=new THREE.Mesh(this.wood.band(at),this.game.chalkPaint||this.game.cutPaint);
        mark.position.copy(part.rest).negate();part.guides.add(mark);
      }
      for(const id of this.record.harvest.limbed){
        const l=this.wood.limbs[id];if(!l||l.at<part.lo||l.at>=part.hi)continue;
        const face=new THREE.Mesh(new THREE.CircleGeometry(l.radius*.87,8),this.game.cutPaint);
        face.position.copy(l.collar).sub(part.rest).addScaledVector(l.axis,.03);
        face.quaternion.setFromUnitVectors(V().set(0,0,1),l.axis);part.guides.add(face);
      }
    }
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
    if(part.inFlight||!part.body.isDynamic()||part.length<2*MIN_END+.02)return null;
    if(this.record.harvest&&part.length<=CARRY_LENGTH+.001)return null;
    const at=this.local(part,p),station=THREE.MathUtils.clamp(at.y,part.lo+MIN_END,part.hi-MIN_END);
    const centre=this.wood.centre(station),radius=this.wood.radius(station);
    if(Math.hypot(at.x-centre.x,at.z-centre.z)>radius+.18)return null;
    let k=this.record.kerfs.find(k=>k.hits<3&&k.at>=part.lo+MIN_END-CUT_EPSILON&&k.at<=part.hi-MIN_END+CUT_EPSILON&&Math.abs(k.at-station)<.26);
    if(!k){
      k={at:station,hits:0,azimuth:Math.atan2(at.z-centre.z,at.x-centre.x)};this.record.kerfs.push(k);
    }
    const before=k.hits;k.hits=Math.min(3,k.hits+strength);
    const work={length:part.length,before,hits:k.hits,sourceIndex:Math.min(2,Math.floor((k.at-HINGE)/(this.wood.top-HINGE)*3))};
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
  dispose(){for(const p of [...this.parts,...this.brush])disposePart(p,this.game.physics);this.parts.length=0;this.brush.length=0;}
}
