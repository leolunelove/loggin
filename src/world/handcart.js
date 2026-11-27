import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {paint} from '../figure/figure.js';
import {pinDabs} from '../oilpaint/pins.js';
import {solveArm} from '../figure/chop.js';
import {advanceHaul,cartCapacity,connected,noteFreight} from '../woodland.js';
import {depositWood} from '../economy.js';

const shaftEnd=1.56;
export function createHandcart(game,craft) {
  const {group,box,pole,join,mats}=craft,{routes}=game.exploration;
  const crew=group(game.scene),axle=group(crew),body=group(axle),wheels=[],load=[],hardware=group(body);
  axle.name='Trail handcart';axle.visible=false;
  for(let i=-2;i<=2;i++)box(body,'cut',i*.19,.61,0,.18,.09,1.46);
  for(const side of [-1,1]){
    const x=side*.50;
    for(const z of [-.58,.58])box(body,'dark',x,.81,z,.075,.52,.08);
    for(const y of [.72,.90])box(body,'bark',x,y,0,.08,.10,1.48);
    pole(body,'bark',[side*.42,.56,-.58],[side*.32,.86,shaftEnd],.044);
    pole(body,'dark',[side*.333,.84,shaftEnd-.18],[side*.32,.86,shaftEnd+.03],.049);
    const wheel=group(axle,side*.61,.45,0);wheels.push(wheel);
    for(const [r,thickness,m] of [[.411,.041,'bark'],[.45,.018,'iron']]){
      const rim=new THREE.Mesh(new THREE.TorusGeometry(r,thickness,6,20),mats[m]);rim.rotation.y=Math.PI/2;wheel.add(rim);}
    for(let n=0;n<8;n++){const a=n*Math.PI/4;pole(wheel,'cut',[0,0,0],[0,Math.cos(a)*.4,Math.sin(a)*.4],.025);}
    pole(wheel,'iron',[-.085,0,0],[.085,0,0],.083);join(wheel);
    for(const z of [-.55,.55])box(hardware,'iron',side*.52,.82,z,.034,.43,.115);
  }
  for(let i=0;i<15;i++){
    const row=i<6?0:i<11?1:2,col=i-(row===0?0:row===1?6:11),x=(col-(5-row)/2)*.153;
    const g=group(body,x,.72+row*.145,Math.sin(i*3.7)*.05),r=.078+Math.abs(Math.sin(i))*.012,len=.61+(i%3)*.045;
    pole(g,'bark',[0,0,-len],[0,0,len],r);
    for(const z of [-len,len])pole(g,'cut',[0,0,z-.004],[0,0,z+.004],r*.94);
    join(g);load.push(g);
  }
  for(const side of [-1,1])for(let i=0;i<4;i++)pole(body,'cut',[side*.32,.86,1.42+i*.033],[side*.32,.86,1.435+i*.033],.054);
  join(body);join(hardware);
  let worker=null,towing=false,initialized=false,axleTravel=0;const workerFoot=new THREE.Vector3();const loadLevels=load.map(()=>0);
  const lengths=routes.map(r=>r.length),v=new THREE.Vector3(),left=new THREE.Vector3(),right=new THREE.Vector3();
  function createWorker(){
    const source=game.figure.man,object=clone(source.object),bones={};object.name='Trail hauler';
    object.position.set(0,0,0);object.rotation.set(0,0,0);
    const jacket=[[.54,.68,.66],[.31,.43,.43],[.17,.27,.28]],trousers=[[.39,.43,.39],[.23,.28,.26],[.15,.17,.19]];
    const skin=[[.84,.64,.46],[.57,.38,.25],[.31,.21,.16]],cap=[[.86,.55,.35],[.57,.32,.22],[.30,.20,.17]];
    const leather=[[.57,.47,.35],[.36,.29,.22],[.22,.19,.16]],linen=[[.85,.73,.51],[.63,.54,.35],[.37,.32,.24]];
    const cloth=[cap,leather,linen];
    const fabrics=cloth.map(p=>{const m=paint(game.shared,p);m.uniforms.uCloth.value=.85;return m;});
    const fitted=cloth.map(p=>paint(game.shared,p,{skinned:true}));
    const pins=[],up=new THREE.Vector3(0,1,0);
    object.traverse(o=>{if(o.isBone)bones[o.name]=o;
      if(o.name==='wood-carrying-pack')o.visible=false;
      if(o.name==='work-clothing'){
        o.visible=o.userData.hatStyle===1||o.userData.coatStyle===2;
        if(o.visible){
          const fabric=o.userData.hatStyle===1?0:o.userData.fabric===3?2:1;
          o.material=(o.isSkinnedMesh?fitted:fabrics)[fabric];pins.push({mesh:o,count:fabric===0?25:12,style:()=>({pal:3+fabric,size:[.016,.047],dir:up})});
        }
      }
      if(o.isSkinnedMesh&&/casualsuit/.test(o.name)){
        o.material=paint(game.shared,jacket,{skinned:true,lower:trousers,split:.98,grain:2.6});
        pins.push({mesh:o,count:135,style:p=>({pal:p.y<.98?1:0,size:[.024,.06],dir:up})});
      }else if(o.isSkinnedMesh&&/generic/.test(o.name)){
        o.material=paint(game.shared,skin,{skinned:true});
        pins.push({mesh:o,count:40,accept:p=>Math.abs(p.x)>.37||p.y>1.56&&p.z<.055,style:()=>({pal:2,size:[.017,.041],dir:up})});
      }
    });
    const mixer=new THREE.AnimationMixer(object),walk=mixer.clipAction(source.clips.Walk).play(),idle=mixer.clipAction(source.clips.Idle).play();
    const strokes=pinDabs(game.shared,[jacket,trousers,skin,cap,leather,linen],pins,{surface:true});
    crew.add(object,strokes.mesh);worker={object,bones,mixer,walk,idle,strokes};
  }
  function nearestRoute(){
    const c=game.state.woodland.cart;let best=null;
    routes.forEach((route,i)=>{if(!connected(game.state.places[i]))return;const n=route.nearest(axle.position);if(!best||n.distance<best.distance)best={...n,i};});return best;
  }
  function dispatch(){
    const s=game.state,c=s.woodland.cart,n=nearestRoute();if(!c.hired||!n||n.distance>2.5)return false;
    c.route=n.i;c.progress=n.progress;c.returning=c.load>0||c.progress>.98;c.running=true;c.wait=.55;
    if(c.progress>.98 && c.load===0){c.progress=1;c.returning=false;}
    towing=false;return true;
  }
  function stow(){
    const s=game.state,c=s.woodland.cart;
    if(!c.built||!near(game.player.feet))return 0;
    const n=depositWood(s,Math.min(s.carried,cartCapacity(s)-c.load));c.load+=n;return n;
  }
  function near(p){return axle.visible && Math.hypot(p.x-axle.position.x,p.z-axle.position.z)<2.7 && Math.abs(p.y-axle.position.y)<2.3;}
  function hitch(){if(!near(game.player.feet))return false;towing=!towing;game.state.woodland.cart.running=false;return true;}
  function grip(man,weight=1){
    const hand=(side,sign)=>{
      const bones=man.bones,target=new THREE.Vector3(sign*.32,.86,shaftEnd).applyMatrix4(axle.matrixWorld);
      const wrist=bones['hand_'+side];const pole=man.object.localToWorld(new THREE.Vector3(sign*.65,1.11,-.25));
      solveArm(bones['upperarm_'+side],bones['lowerarm_'+side],wrist,target,pole,wrist.getWorldQuaternion(new THREE.Quaternion()),weight);
    };hand('l',1);hand('r',-1);
  }
  function update(dt){
    const s=game.state,w=s.woodland,c=w.cart;
    axle.visible=c.built;if(!c.built)return false;
    let changed=false,x,z,yaw;
    if(c.running||c.x===null){
      if(c.running)changed=advanceHaul(s,dt,lengths);
      const p=routes[c.route].sample(c.progress);x=p.x;z=p.z;yaw=p.yaw+(c.returning?Math.PI:0);
    } else {x=c.x;z=c.z;yaw=c.yaw;}
    if(towing){
      const p=game.player.feet,dx=p.x-x,dz=p.z-z,d=Math.hypot(dx,dz);
      if(d>4.5){towing=false;}else{
        const desired=game.player.yaw,blend=1-Math.exp(-8*dt);
        yaw+=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw))*blend;
        x=THREE.MathUtils.lerp(x,p.x-Math.sin(yaw)*1.65,blend);z=THREE.MathUtils.lerp(z,p.z-Math.cos(yaw)*1.65,blend);
      }
    }
    const dist=c.x===null?0:Math.hypot(x-c.x,z-c.z),speed=dt?Math.min(3.4,dist/dt):0;
    const oldYaw=c.x===null?yaw:c.yaw;
    let turn=Math.atan2(Math.sin(yaw-oldYaw),Math.cos(yaw-oldYaw));
    if(c.running&&c.x!==null){
      turn=THREE.MathUtils.clamp(turn*(1-Math.exp(-6*dt)),-2.55*dt,2.55*dt);
      yaw=oldYaw+turn;
    }
    const midYaw=oldYaw+turn/2;
    const travel=c.x===null?0:(x-c.x)*Math.sin(midYaw)+(z-c.z)*Math.cos(midYaw);
    c.x=x;c.z=z;c.yaw=yaw;
    left.set(x+Math.cos(yaw)*.60,0,z-Math.sin(yaw)*.60);right.set(2*x-left.x,0,2*z-left.z);
    left.y=game.heightAt(left.x,left.z);right.y=game.heightAt(right.x,right.z);
    const h=(left.y+right.y)/2;
    axle.position.set(x,h+(c.running?.114:.044),z);axle.rotation.order='YXZ';axle.rotation.y=yaw;
    axle.rotation.z=THREE.MathUtils.clamp(Math.atan2(left.y-right.y,1.2),-.20,.20);
    const rise=game.heightAt(x+Math.sin(yaw),z+Math.cos(yaw))-h;axle.rotation.x=-Math.atan(rise);
    for(const wheel of wheels)wheel.rotation.x+=(travel-wheel.position.x*turn)/.45;
    body.rotation.x=Math.sin(wheels[0].rotation.x*2)*Math.min(.012,speed*.005);hardware.visible=w.axle;
    axleTravel+=Math.abs(travel)+.30*Math.abs(turn);
    const fullness=c.load/cartCapacity(s),spacing=(w.axle?3.2:2.55)-.48*fullness;
    if(axleTravel>=spacing){axleTravel%=spacing;if(dt>0)game.audio.cartRoll(axle.position,fullness);}
    const count=Math.ceil(Math.sqrt(c.load/cartCapacity(s))*load.length);
    load.forEach((part,i)=>{const goal=i<count?1:0;loadLevels[i]=initialized?THREE.MathUtils.damp(loadLevels[i],goal,6+i*.35,dt):goal;
      part.visible=loadLevels[i]>.008;part.scale.setScalar(Math.max(.001,loadLevels[i]));part.position.y=.72+(i<6?0:i<11?1:2)*.145+(1-loadLevels[i])*.18;});initialized=true;
    axle.updateMatrixWorld(true);
    if(c.running && !worker)createWorker();
    if(worker){const wasWalking=worker.object.visible;worker.object.visible=c.running;worker.strokes.mesh.visible=false;
      if(c.running){
        const p=v.set(0,0,1.66).applyMatrix4(axle.matrixWorld);worker.object.position.set(p.x,game.heightAt(p.x,p.z)+.085,p.z);worker.object.rotation.y=yaw;
        const stride=wasWalking&&dt>0&&workerFoot.lengthSq()>0?Math.min(3.1,workerFoot.distanceTo(worker.object.position)/dt):speed;
        workerFoot.copy(worker.object.position);
        const weight=THREE.MathUtils.clamp(stride/.85,0,1);
        worker.walk.setEffectiveWeight(weight);worker.idle.setEffectiveWeight(1-weight);worker.walk.timeScale=stride/1.45;worker.mixer.update(dt);
        worker.object.updateMatrixWorld(true);const distance=game.camera.position.distanceToSquared(worker.object.position);
        if(distance<45*45)grip(worker);
        if(distance<32*32){worker.strokes.mesh.visible=true;worker.strokes.update();}
      }
    }
    return changed;
  }
  function emptyAtDepot(){
    const c=game.state.woodland.cart,n=nearestRoute();if(!n||n.distance>3.1||Math.min(n.progress,1-n.progress)*lengths[n.i]>3)return false;
    if(!c.load)return false;
    if(n.progress>.5)noteFreight(game.state,n.i,c.load);
    c.load=0;return true;
  }
  return {group:crew,axle,update,near,hitch,dispatch,stow,emptyAtDepot,nearestRoute,pose:()=>{if(towing)grip(game.figure.man);},get towing(){return towing;},park(){towing=false;}};
}
