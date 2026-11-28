import * as THREE from 'three';
import {placePalm} from './hand-contact.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const UP=V(0,1,0),ease=THREE.MathUtils.smoothstep;
const damp=(x,y,k,dt)=>y+(x-y)*Math.exp(-k*dt);

// A short look ahead gives the shoulders time to turn at a doorjamb or a trunk.
// The capsule and the requested direction of travel remain under player control.
export class TrailContact{
  constructor(){
    this.weight=0;this.pick=null;this.scanIn=0;this.target=null;
    this.palmWeight=0;this.plant=null;this.reachAgain=0;
    this.grade=0;this.rise=0;this.travelling=V(0,0,1);this.pace=0;
  }
  scan(player,forest,inside){
    const feet=player.feet,f=player.facing(),left=V(f.z,0,-f.x),travel=this.travelling;
    const origin=feet.clone().addScaledVector(travel,.22);origin.y+=1.16;
    let winner=null,best=Infinity;
    for(const [side,sign] of [['l',1],['r',-1]]){
      const sideDir=left.clone().multiplyScalar(sign);
      for(const [ahead,across] of [[.04,1],[.77,.67]]){
        const dir=sideDir.clone().multiplyScalar(across).addScaledVector(travel,ahead).normalize();
        const h=player.handSurface(origin,dir,.64);if(!h)continue;
        const lateral=(h.point.x-feet.x)*left.x+(h.point.z-feet.z)*left.z;
        if(sign*lateral<-.04)continue;
        const same=this.pick?.side===side&&this.pick.id===h.id;
        const score=h.distance-(same ? .09 : 0);
        if(score<best){winner={...h,side,kind:'solid'};best=score;}
      }
    }
    if(winner)return winner;
    const crown=!inside&&forest.nearCrown?.(feet,travel);
    if(!crown)return null;
    const stem=V(crown.x-feet.x,0,crown.z-feet.z),side=stem.dot(left)>=0?'l':'r';
    const along=THREE.MathUtils.clamp(stem.dot(f),.14,.39),across=THREE.MathUtils.clamp(Math.abs(stem.dot(left)),.13,.30);
    const point=feet.clone().addScaledVector(f,along).addScaledVector(left,side==='l'?across:-across);
    point.y+=THREE.MathUtils.clamp(crown.y-feet.y,1.38,1.62);
    return {id:crown.plant,point,normal:f.clone().negate(),side,kind:'leaves',behind:stem.dot(f)<-.17};
  }
  sense(dt,player,forest,inside,allowed,moving){
    if(!allowed){
      this.weight=this.palmWeight=this.scanIn=this.reachAgain=this.grade=this.rise=0;
      this.target=this.pick=this.plant=null;return;
    }
    this.scanIn-=dt;this.reachAgain=Math.max(0,this.reachAgain-dt);
    if(!moving){this.target=null;this.rise=0;this.scanIn=0;}
    else if(this.scanIn<=0){
      this.travelling.subVectors(player.feet,player.prevFeet);this.travelling.y=0;
      if(this.travelling.lengthSq()<.000004)this.travelling.copy(player.facing());
      else this.travelling.normalize();
      this.target=this.scan(player,forest,inside);this.scanIn=.068;
      const ahead=player.feet.clone().addScaledVector(this.travelling,.37);
      const floor=player.ground(ahead.x,ahead.z,player.feet.y+player.t.stepHeight+.035,player.t.stepHeight+.42);
      this.rise=floor&&floor.normal.y>.65?THREE.MathUtils.clamp(floor.y-player.feet.y,-.21,.24):0;
    }
    this.grade=damp(this.grade,this.rise,9,dt);this.pace=ease(player.actualSpeed,1.45,4.5);
    const next=this.target,same=next&&this.pick&&next.side===this.pick.side&&next.kind===this.pick.kind&&next.id===this.pick.id;
    if(same)this.pick=next;
    else if(next&&this.weight<.085){this.pick=next;this.plant=null;}
    const held=!!next&&(same||this.pick===next);
    this.weight=damp(this.weight,held?1:0,held?9:13,dt);
    if(!held&&this.weight<.012){this.weight=0;this.pick=null;this.plant=null;}
  }
  posture(man,anim){
    // Look into the next foothold on a bank or step. Keep the stance foot
    // pinned and give only a swinging boot extra clearance over a raised lip.
    if(Math.abs(this.grade)>.018){
      const cross=V(this.travelling.z,0,-this.travelling.x),g=this.grade;
      anim.rotateWorld(man.bones.spine_01,cross,g*.60);
      anim.rotateWorld(man.bones.spine_02,cross,g*.33);
      anim.rotateWorld(man.bones.neck_01,cross,-g*.27+Math.abs(g)*.32);
      if(g>.045)for(const side of ['l','r']){
        const foot=anim.feetInfo?.[side];
        if(foot&&!foot.pinned&&foot.lift>.115){
          const lift=(g-.045)*.48*ease(foot.lift,.115,.205);
          anim.legIK(side,V(0,lift,0));
        }
      }
    }
    if(!this.pick||this.weight<.005)return;
    const sign=this.pick.side==='l'?1:-1,w=this.weight,leaves=this.pick.kind==='leaves';
    const yaw=man.object.rotation.y,f=V(Math.sin(yaw),0,Math.cos(yaw)),side=V(f.z,0,-f.x);
    for(const [n,k] of [['spine_01',.28],['spine_02',.43],['spine_03',.29]]){
      anim.rotateWorld(man.bones[n],UP,-sign*(leaves?.18:.37+.14*this.pace)*w*k);
      anim.rotateWorld(man.bones[n],f,sign*.105*w*k);
      if(leaves)anim.rotateWorld(man.bones[n],side,(.42+.09*this.pace)*w*k);
    }
    anim.rotateWorld(man.bones.neck_01,UP,sign*(leaves?.12:.26)*w);
    anim.rotateWorld(man.bones.Head,side,(leaves?.21:.06)*w);
  }
  hand(dt,man,anim,tool){
    const hit=this.pick;if(!hit||this.weight<.008){this.palmWeight=0;this.plant=null;return;}
    const side=hit.side,occupied=side==='l'?tool.leftWeight:tool.rightWeight;
    if(occupied>.25){this.palmWeight=0;this.plant=null;return;}
    const b=man.bones,shoulder=b['upperarm_'+side].getWorldPosition(V()),leaf=hit.kind==='leaves';
    if(!this.plant&&!this.reachAgain&&this.weight>.20&&!hit.behind){
      this.plant={point:hit.point.clone(),normal:hit.normal.clone(),feet:man.object.position.clone(),leaving:false};
    }
    const plant=this.plant;if(!plant)return;
    if(leaf)plant.point.lerp(hit.point,1-Math.exp(-13*dt));
    if(hit.behind||!this.target||this.target.id!==hit.id||plant.feet.distanceTo(man.object.position)>(leaf?.84:.52)||plant.point.distanceTo(shoulder)>.69)plant.leaving=true;
    this.palmWeight=damp(this.palmWeight,plant.leaving?0:this.weight,plant.leaving?16:17,dt);
    if(plant.leaving&&this.palmWeight<.05){this.plant=null;this.reachAgain=.14;this.palmWeight=0;return;}
    const n=plant.normal,palm=plant.point.clone().addScaledVector(n,.018);
    const yaw=man.object.rotation.y,f=V(Math.sin(yaw),0,Math.cos(yaw)),across=V(f.z,0,-f.x);
    const x=n.clone().multiplyScalar(side==='l'?-1:1),y=UP.clone().addScaledVector(f,leaf?.10:.42);
    y.addScaledVector(x,-y.dot(x)).normalize();
    const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,x.clone().cross(y)));
    const pole=shoulder.clone().addScaledVector(across,side==='l'?.25:-.25).addScaledVector(f,-.27);pole.y-=.28;
    placePalm(man,anim,side,palm,q,pole,.11,this.palmWeight*(1-ease(occupied,0,.25)));
  }
}
