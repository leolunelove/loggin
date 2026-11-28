import * as THREE from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
import {axeSolids} from './axe-shape.js';
import {AXE_GROUPS,TRUNK_GROUPS} from '../world/woodland-physics.js';

const v=()=>new THREE.Vector3(),quat=()=>new THREE.Quaternion();
const UP=new THREE.Vector3(0,1,0),ZERO=new THREE.Vector3();
const SKIN=.003, SLOP=.00055;

const frame=(p,q)=>({p:p.clone(),q:q.clone()});
const between=(a,b,t)=>({p:a.p.clone().lerp(b.p,t),q:a.q.clone().slerp(b.q,t)});
const at=(f,local)=>local.clone().applyQuaternion(f.q).add(f.p);
export const isCuttingEdge=name=>name==='bit'||name==='backBit';
export function bitesWood(hit,travel){
  if(!isCuttingEdge(hit.part.name)||travel<.065)return false;
  const inward=-hit.velocity.dot(hit.normal);
  const side=v().set(0,0,1).applyQuaternion(hit.rotation);
  return inward>.26&&Math.abs(side.dot(hit.normal))<.88;
}

const cookedStock=new Map();
function toolHulls(tier){
  if(cookedStock.has(tier))return cookedStock.get(tier);
  const stock=axeSolids(tier).map(({name,centre,vertices})=>{
    // Preserve millimetre-wide bevels. Cooking the tiny head as a generic point cloud
    // can simplify away the thin heel on the splitting axe.
    const unique=new Map();
    for(let i=0;i<vertices.length;i+=3){const p=v().fromArray(vertices,i);unique.set(p.toArray().join(','),p);}
    const hull=new ConvexHull().setFromPoints([...unique.values()]),ids=new Map(),points=[],indices=[];
    for(const face of hull.faces){
      let e=face.edge;
      do{const p=e.head().point;if(!ids.has(p)){ids.set(p,points.length/3);points.push(p.x,p.y,p.z);}indices.push(ids.get(p));e=e.next;}while(e!==face.edge);
    }
    return {name,centre,points:new Float32Array(points),indices:new Uint32Array(indices)};
  });
  cookedStock.set(tier,stock);return stock;
}
function prepareStock(R,world,body,tier){
  return toolHulls(tier).map(({name,centre,points,indices})=>{
    const desc=R.ColliderDesc.convexMesh(points,indices).setTranslation(...centre)
      .setCollisionGroups(AXE_GROUPS).setFriction(.54).setRestitution(.05).setMass(.22);
    const proxy=world.createCollider(desc,body);
    // Retain the cooked hull. Rebuilding the same convex hull for every sweep is expensive.
    const shape=new R.ConvexPolyhedron(points,indices);
    let radius=0;const ext=v();
    for(let i=0;i<points.length;i+=3){
      radius=Math.max(radius,Math.hypot(points[i],points[i+1],points[i+2]));
      ext.max(v().set(Math.abs(points[i]),Math.abs(points[i+1]),Math.abs(points[i+2])));
    }
    return {name,local:new THREE.Vector3(...centre),shape,proxy,points,radius,ext};
  });
}
function surfaceSample(obstacle,part,pos,q,prediction){
  return obstacle.collider?obstacle.collider.contactShape(part.shape,pos,q,prediction):
    obstacle.shape.contactShape(obstacle.p,obstacle.q,part.shape,pos,q,prediction);
}
function minOnPlane(part,f,point,normal,support){
  const centre=at(f,part.local),n=normal.clone().applyQuaternion(f.q.clone().invert()),points=part.points;
  let min=Infinity;
  let index=0;
  for(let i=0;i<points.length;i+=3){const d=points[i]*n.x+points[i+1]*n.y+points[i+2]*n.z;if(d<min){min=d;index=i;}}
  if(support)support.fromArray(points,index).applyQuaternion(f.q).add(centre);
  return centre.sub(point).dot(normal)+min;
}
function deflect(f,hit,hand){
  const {part,point,normal}=hit,support=v();
  if(hand){
    // Torque at the obstacle turns the steel around the hand. A blow near the grip
    // folds the elbow instead, because there is little lever arm available there.
    for(let i=0;i<3;i++){
      const depth=SKIN-minOnPlane(part,f,point,normal,support);if(depth<=SLOP)return;
      const palm=at(f,hand),axis=support.sub(palm).cross(normal),lever=axis.length();
      if(lever<.035)break;
      const angle=Math.min(.16,depth*lever/(lever*lever+.016));
      f.q.premultiply(quat().setFromAxisAngle(axis.divideScalar(lever),angle));
      f.p.copy(palm).sub(hand.clone().applyQuaternion(f.q));
    }
  }
  const gap=minOnPlane(part,f,point,normal);
  if(gap<SKIN)f.p.addScaledVector(normal,SKIN-gap+.0001);
}
function reachError(f,hands){
  let error=0;
  for(const hand of hands||[])error=Math.max(error,at(f,hand.local).distanceTo(hand.centreAt(f.q))-hand.reach);
  return error;
}
function fitReach(f,hands){
  for(let i=0;i<3;i++)for(const hand of hands||[]){
    const delta=at(f,hand.local).sub(hand.centreAt(f.q)),d=delta.length();
    if(d>hand.reach)f.p.addScaledVector(delta,(hand.reach-d)/d);
  }
  return f;
}
function spanAt(part,m,padding=SKIN){
  const e=m.elements,r=part.ext;
  return v().set(Math.abs(e[0])*r.x+Math.abs(e[4])*r.y+Math.abs(e[8])*r.z+padding,
    Math.abs(e[1])*r.x+Math.abs(e[5])*r.y+Math.abs(e[9])*r.z+padding,
    Math.abs(e[2])*r.x+Math.abs(e[6])*r.y+Math.abs(e[10])*r.z+padding);
}
function mayTouch(o,a,b,span){
  if(o.floor!=null)return Math.min(a.y,b.y)-span.y<=o.floor;
  if(!o.bounds)return true;
  const {low,high}=o.bounds;
  return Math.min(a.x,b.x)-span.x<=high.x&&Math.max(a.x,b.x)+span.x>=low.x&&
    Math.min(a.y,b.y)-span.y<=high.y&&Math.max(a.y,b.y)+span.y>=low.y&&
    Math.min(a.z,b.z)-span.z<=high.z&&Math.max(a.z,b.z)+span.z>=low.z;
}

// The actual player capsule encloses both arms. These smaller anatomical volumes leave
// the hand free to grasp the handle while keeping steel outside the body and the log bag.
export class AxeOwner {
  constructor(R){this.R=R;this.shapes=new Map();this.brim=new R.Cylinder(.033,.246);this.crown=new R.Capsule(.026,.100);this.peak=new R.RoundCuboid(.079,.004,.059,.014);this.bag=new R.RoundCuboid(.198,.18,.102,.07);}
  guards(man,pack,headwear){
    const bones=man.bones,guards=[];
    const bone=name=>bones[name].getWorldPosition(v());
    const capsule=(a,b,r,name)=>{
      const line=b.clone().sub(a),half=Math.round(line.length()*50)/100,key=half+'/'+r;
      if(!this.shapes.has(key))this.shapes.set(key,half?new this.R.Capsule(half,r):new this.R.Ball(r));
      const p=a.clone().lerp(b,.5),q=half?quat().setFromUnitVectors(UP,line.normalize()):quat();
      const bounds={low:a.clone().min(b).addScalar(-r-.006),high:a.clone().max(b).addScalar(r+.006)};
      guards.push({name,p,q,shape:this.shapes.get(key),bounds});
    };
    capsule(bone('pelvis'),bone('spine_03'),.139,'chest');
    const skull=bone('Head').addScaledVector(UP,.063);capsule(skull,skull,.112,'head');
    for(const side of ['r','l'])capsule(bone('thigh_'+side),bone('calf_'+side),.075,'thigh '+side);
    const mounted=(object,local,ext,shape,name)=>{
      const p=object.localToWorld(local),q=object.getWorldQuaternion(quat());
      const span=spanAt({ext},new THREE.Matrix4().makeRotationFromQuaternion(q));
      guards.push({name,p,q,shape,bounds:{low:p.clone().sub(span),high:p.clone().add(span)}});
    };
    const hats=Array.isArray(headwear)?headwear:[headwear],style=hats.findIndex(hat=>hat?.visible);
    const hat=hats[style];
    if(hat){
      mounted(hat,v().set(0,.067,0),v().set(.104,.13,.104),this.crown,'hat crown');
      if(style===0)mounted(hat,v().set(0,-.041,0),v().set(.246,.033,.246),this.brim,'hat brim');
      if(style===2)mounted(hat,v().set(0,-.021,.163),v().set(.096,.018,.074),this.peak,'cap peak');
    }
    if(pack?.group.visible){
      mounted(pack.group,v().set(0,.28,-.010),v().set(.268,.25,.172),this.bag,'pack');
      for(const log of pack.logs||[]){
        if(!log.mesh.visible||log.amount<.15)continue;
        const {height,radiusBottom}=log.mesh.geometry.parameters;
        const a=log.mesh.localToWorld(v().set(0,-height*.43,0)),b=log.mesh.localToWorld(v().set(0,height*.43,0));
        capsule(a,b,radiusBottom*log.mesh.scale.x,'packed log');
      }
    }
    return guards;
  }
}

// Animation asks for a grip pose. A swept, compound kinematic tool is allowed to reach
// only poses that fit. Both arms are solved to that result and the same stock enters Rapier.
export class HeldAxe {
  constructor(world,R,playerCollider,heightAt){
    Object.assign(this,{world,R,playerCollider,heightAt});
    this.body=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setCcdEnabled(true));
    this.body.setEnabled(false);this.parts=[];this.tier=-1;this.last=null;this.staticBounds=new WeakMap();
  }
  equip(tier){
    if(this.tier===tier)return;
    for(const part of this.parts)this.world.removeCollider(part.proxy,false);
    this.parts=prepareStock(this.R,this.world,this.body,tier);this.tier=tier;
  }
  stow(){
    if(this.body.isEnabled())this.body.setEnabled(false);
    this.last=null;this.lastOwner=null;this.contact=null;this.grasp=null;
  }
  nearby(a,b,guards){
    const mid=a.p.clone().lerp(b.p,.5),span=a.p.clone().sub(b.p).multiplyScalar(.5);
    span.set(Math.abs(span.x)+.99,Math.abs(span.y)+.99,Math.abs(span.z)+.99);
    const obstacles=[...guards];
    this.world.collidersWithAabbIntersectingAabb(mid,span,c=>{
      if(c.handle===this.playerCollider?.handle||c.parent()?.handle===this.body.handle||c.isSensor()||c.collisionGroups()===TRUNK_GROUPS)return true;
      const obstacle={collider:c};
      if(this.heightAt&&c.shapeType()===this.R.ShapeType.HeightField){
        // The localized height bound avoids constructing convex/heightfield contacts at shoulder height.
        let top=-Infinity;
        for(const dx of [-span.x,0,span.x])for(const dz of [-span.z,0,span.z])top=Math.max(top,this.heightAt(mid.x+dx,mid.z+dz));
        obstacle.floor=top+.20;
      }
      if(c.toolBounds){
        const box=c.toolBounds.clone().applyMatrix4(new THREE.Matrix4().compose(v().copy(c.translation()),quat().copy(c.rotation()),v().setScalar(1)));
        obstacle.bounds={low:box.min,high:box.max};
      }else if(obstacle.floor==null){
        const fixed=!c.parent()||c.parent().isFixed();
        let bounds=fixed&&this.staticBounds.get(c);
        if(!bounds||bounds.cut!==c.standingTree?.cut){
          const type=c.shapeType(),local=new THREE.Box3(),half=v();
          if(type===this.R.ShapeType.Cuboid)half.copy(c.halfExtents());
          else if(type===this.R.ShapeType.Cylinder||type===this.R.ShapeType.Capsule){
            const r=c.radius();half.set(r,c.halfHeight()+(type===this.R.ShapeType.Capsule?r:0),r);
          }else if(type===this.R.ShapeType.ConvexPolyhedron||type===this.R.ShapeType.TriMesh){
            const points=c.vertices();for(let i=0;i<points.length;i+=3)local.expandByPoint(v().fromArray(points,i));
          }
          if(half.lengthSq())local.set(half.clone().negate(),half);
          if(!local.isEmpty()){
            // Rapier rotations are plain {x,y,z,w}. THREE.Matrix4.compose reads quaternion internals.
            local.applyMatrix4(new THREE.Matrix4().compose(v().copy(c.translation()),quat().copy(c.rotation()),v().setScalar(1)));
            bounds={low:local.min,high:local.max,cut:c.standingTree?.cut};if(fixed)this.staticBounds.set(c,bounds);
          }
        }
        obstacle.bounds=bounds;
      }
      obstacles.push(obstacle);return true;
    });
    return obstacles;
  }
  deepest(f,obstacles){
    let deepest=null;const matrix=new THREE.Matrix4().makeRotationFromQuaternion(f.q);
    for(const part of this.parts){
      const pos=at(f,part.local),extent=spanAt(part,matrix);
      for(const o of obstacles){
        if(!mayTouch(o,pos,pos,extent))continue;
        const near=surfaceSample(o,part,pos,f.q,SKIN);
        if(near&&near.distance<SKIN-SLOP&&(!deepest||near.distance<deepest.distance)){
          deepest={distance:near.distance,part,obstacle:o,normal:v().copy(near.normal1),point:v().copy(near.point1)};
        }
      }
    }
    return deepest;
  }
  separate(f,obstacles,grip){
    for(let i=0;i<8;i++){
      const h=this.deepest(f,obstacles);if(!h)break;
      if(h.obstacle.collider)deflect(f,h,grip);
      else f.p.addScaledVector(h.normal,SKIN-h.distance);
    }
    return f;
  }
  sweep(a,b,obstacles,dt){
    const angle=a.q.angleTo(b.q),mid=a.q.clone().slerp(b.q,.5);
    let first=null;const matrix=new THREE.Matrix4().makeRotationFromQuaternion(mid);
    for(const part of this.parts){
      const start=at(a,part.local),end=at(b,part.local),travel=end.clone().sub(start);
      const extent=spanAt(part,matrix,SKIN+angle*part.radius*.51);
      for(const o of obstacles){
        if(!mayTouch(o,start,end,extent))continue;
        let hit=null,t=1,point,normal,witness;
        if(travel.lengthSq()>1e-12){
          hit=o.collider?o.collider.castShape(ZERO,part.shape,start,mid,travel,SKIN,1,false):
            o.shape.castShape(o.p,o.q,ZERO,part.shape,start,mid,travel,SKIN,1,false);
        }
        if(hit){
          t=THREE.MathUtils.clamp(hit.time_of_impact,0,1);
          const q=o.collider?o.collider.rotation():o.q,p=o.collider?o.collider.translation():o.p;
          normal=v().copy(hit.normal1).applyQuaternion(q);point=v().copy(hit.witness1).applyQuaternion(q).add(p);
          witness=v().copy(hit.witness2).add(part.local);
        }
        // A poll or corner can rotate onto a surface even when its centre barely travels.
        if(!hit&&angle>.0001){
          const near=surfaceSample(o,part,end,b.q,SKIN);
          if(near&&near.distance<SKIN-SLOP){
            point=v().copy(near.point1);normal=v().copy(near.normal1);
            witness=v().copy(near.point2).sub(b.p).applyQuaternion(b.q.clone().invert());
            const before=minOnPlane(part,a,point,normal);
            t=THREE.MathUtils.clamp((before-SKIN)/Math.max(.00001,before-near.distance),0,1);
          }
        }
        if(!point)continue;
        const velocity=at(b,witness).sub(at(a,witness)).divideScalar(Math.max(dt,.00001));
        if(velocity.dot(normal)>=-.0005)continue;
        if(!first||t<first.t-.001||(Math.abs(t-first.t)<=.001&&isCuttingEdge(part.name)&&!isCuttingEdge(first.part.name))){
          first={t,point,normal,part,obstacle:o,collider:o.collider,velocity};
        }
      }
    }
    return first;
  }
  trace(start,goal,obstacles,dt,options){
    let current=frame(start.p,start.q);
    const angle=start.q.angleTo(goal.q),steps=Math.max(1,Math.ceil(angle/.098));
    for(let i=1;i<=steps;i++){
      const next=between(start,goal,i/steps),dtStep=dt/steps;
      for(let pass=0;pass<3;pass++){
        const hit=this.sweep(current,next,obstacles,dtStep);
        if(!hit){current=next;break;}
        if(hit.collider&&!this.contact){hit.rotation=current.q.clone().slerp(next.q,hit.t);this.contact=hit;}
        current=between(current,next,Math.max(0,hit.t-.001));
        if(options.driving&&hit.collider)return current;
        deflect(next,hit,options.grip);
      }
    }
    return current;
  }
  clearOwner(current,guards,solids,options,dt){
    let inside=this.deepest(current,guards);
    if(!inside||inside.distance>=-.002)return current;
    const initialContact=this.contact;
    for(let pass=0;pass<4&&inside&&inside.distance<-.002;pass++){
      const start=current,hit=inside,depth=SKIN-hit.distance;
      const rank=f=>Math.max(0,-(this.deepest(f,guards)?.distance??0))*8+reachError(f,options.hands);
      let best=rank(current);
      const tryPose=(goal,from=start)=>{
        const f=solids.length?this.trace(from,goal,solids,dt,{grip:options.grip}):goal;
        if((this.deepest(f,solids)?.distance??0)<-SLOP)return;
        const score=rank(f);
        if(score<best-.0002){current=f;best=score;}
      };
      const pivot=frame(start.p,start.q);
      deflect(pivot,hit,options.grip);tryPose(pivot);
      if(best>.003)tryPose(frame(start.p.clone().addScaledVector(hit.normal,depth+.002),start.q));
      // When the post and the hip press from opposite sides, lift or move the haft along
      // their common surface to give the hands room. Each trial stays on this side of the post.
      if(best>.006){
        const tangent=v().crossVectors(hit.normal,UP);
        if(tangent.lengthSq()<.001)tangent.set(1,0,0);else tangent.normalize();
        const across=v().crossVectors(hit.normal,tangent).normalize(),step=Math.max(.045,Math.min(.14,depth*1.7));
        for(const axis of [across,tangent])for(const sign of [-1,1]){
          const edge=frame(start.p.clone().addScaledVector(axis,sign*step),start.q);
          const side=solids.length?this.trace(start,edge,solids,dt,{grip:options.grip}):edge;
          tryPose(frame(side.p.clone().addScaledVector(hit.normal,depth+.003),side.q),side);
          if(best<.003)break;
        }
      }
      if(current===start)break;
      inside=this.deepest(current,guards);
    }
    this.contact=initialContact;
    return current;
  }
  limitTravel(d){
    if(!this.grasp)return;
    const {outside,room}=this.grasp,stretch=d.x*outside.x+d.z*outside.z;
    if(stretch>room){d.x-=outside.x*(stretch-room);d.z-=outside.z*(stretch-room);}
  }
  solve(position,rotation,tier,dt,guards=[],options={}){
    this.equip(tier);
    const owner=this.playerCollider?.parent()?.translation();
    const teleported=owner&&this.lastOwner&&this.lastOwner.distanceTo(owner)>2.8;
    const goal=frame(position,rotation),snap=!this.last||teleported;
    const stride=owner&&this.lastOwner&&!snap?v().copy(owner).sub(this.lastOwner):ZERO;
    if(owner)(this.lastOwner??=v()).copy(owner);
    let current=snap?frame(position,rotation):frame(this.last.p,this.last.q);
    const obstacles=this.nearby(current,goal,guards);
    this.contact=null;
    fitReach(goal,options.hands);
    if(!snap&&options.grip){
      // Limit motion of the hands relative to the woodcutter. At a sprint
      // the body itself travels farther per step than an arm should swing.
      const desiredPalm=at(goal,options.grip),oldPalm=at(current,options.grip).add(stride);
      const angle=current.q.angleTo(goal.q),turn=(options.driving?58:options.working?24:11)*dt;
      if(angle>turn)goal.q.copy(current.q).slerp(rotation,turn/angle);
      desiredPalm.sub(oldPalm).clampLength(0,(options.driving?16:options.working?9:5)*dt).add(oldPalm);
      goal.p.copy(desiredPalm).sub(options.grip.clone().applyQuaternion(goal.q));
    }
    if(snap)current=frame(goal.p,goal.q);
    const prior=frame(current.p,current.q);
    this.separate(current,obstacles,options.grip);
    if(!snap){
      const start=frame(current.p,current.q);
      current=this.trace(start,goal,obstacles,dt,options);
      this.separate(current,obstacles,options.grip);
      let error=reachError(current,options.hands);
      if(error>.014&&options.grip){
        // In a narrow space first keep the current angle and draw the hand in, then
        // try the compact carry postures. Every alternative still sweeps from the held pose.
        const palm=at(goal,options.grip),directions=[current.q,...(options.folds||[])];
        for(const target of directions){
          const q=current.q.clone().rotateTowards(target,Math.max(.22,dt*12));
          const folded=fitReach(frame(palm.clone().sub(options.grip.clone().applyQuaternion(q)),q),options.hands);
          const candidate=this.trace(start,folded,obstacles,dt,{grip:options.grip});
          this.separate(candidate,obstacles,options.grip);
          const d=reachError(candidate,options.hands);
          if(d<error){error=d;current=candidate;}
          if(error<.008)break;
        }
        if(error>.025){
          // A rail can trap the preferred hand position itself. Bring the grip inward,
          // in front of the chest, or out beside the body as space allows.
          for(const tuck of options.tucks||[]){
            const q=current.q.clone().rotateTowards(tuck.q,Math.max(.25,dt*14));
            const goal=fitReach(frame(tuck.p.clone().sub(options.grip.clone().applyQuaternion(q)),q),options.hands);
            const candidate=this.trace(start,goal,obstacles,dt,{grip:options.grip});
            this.separate(candidate,obstacles,options.grip);
            const cost=reachError(candidate,options.hands);
            if(cost<error){error=cost;current=candidate;}
            if(error<.008)break;
          }
        }
      }
    }
    const solids=obstacles.filter(o=>o.collider);
    // Anatomical separation can ask to pivot around a grip on the wrong side of a thin
    // board. Validate the resulting displacement from the previous safe side as well.
    const corrected=current.p.distanceToSquared(goal.p)>.000144||current.q.angleTo(goal.q)>.060;
    if(!snap&&corrected&&solids.length&&!this.deepest(prior,solids)){
      const originalContact=this.contact;
      current=this.trace(prior,current,solids,dt,{driving:true});
      this.contact=originalContact||this.contact;
      if((this.deepest(current,solids)?.distance??0)<-SLOP)current=prior;
    }else if(this.deepest(current,solids)){
      for(let i=0;i<8;i++){
        const h=this.deepest(current,solids);if(!h)break;
        current.p.addScaledVector(h.normal,SKIN-h.distance);
      }
    }
    if(guards.length)current=this.clearOwner(current,guards,solids,options,dt);
    this.grasp=null;
    if(corrected&&this.contact&&options.hands?.length){
      const hand=options.hands[0],line=hand.centreAt(current.q).sub(at(current,hand.local));
      const room=Math.max(0,hand.reach-line.length()-.018);
      line.y=0;if(line.lengthSq()>.001)this.grasp={outside:line.normalize(),room};
    }
    this.last=current;if(!this.body.isEnabled())this.body.setEnabled(true);
    if(snap){this.body.setTranslation(current.p,true);this.body.setRotation(current.q,true);}
    this.body.setNextKinematicTranslation(current.p);this.body.setNextKinematicRotation(current.q);
    return {position:current.p,rotation:current.q,contact:this.contact,
      displaced:current.p.distanceTo(goal.p)>.004||current.q.angleTo(goal.q)>.015};
  }
}
