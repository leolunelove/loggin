import {createFingerpost} from './fingerpost.js';
import {buildTrail} from './trail.js';
import {pinDabs} from '../oilpaint/pins.js';
import * as THREE from 'three';
import {createOutpostHouse,HOUSE_TYPES,houseCollider} from './outpost-house.js';import {paint} from '../figure/figure.js';import {PLACES,restored,segmentDistance} from '../exploration.js';import {settlementSites} from './settlement-sites.js';
// Reusable camp dressing: timber carts, wheel spokes, orchard trees, fences, barrels,
// tool piles, washing lines, garden beds and wayfinding signs share painted palettes.
export function createSettlements(game,craft){
 const {scene,shared,heightAt,home,physics,RAPIER,forest}=game,origin=home.group.position,groups=[],routes=[],sites=[];
 const district=new THREE.Group();scene.add(district);
 const palettes=[[[.64,.45,.26],[.35,.26,.18],[.15,.15,.12]],[[.66,.67,.52],[.36,.4,.33],[.18,.23,.2]],[[.75,.32,.16],[.4,.18,.12],[.18,.12,.09]]],mats=palettes.map(p=>paint(shared,p));
 function box(g,w,h,d,x,y,z,m=0){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats[m]);o.position.set(x,y,z);g.add(o);return o;}
 function clearAt(p,r){forest.clearBrush?.(p.x,p.z,r+1);for(const t of forest.trees)if(!t.routeCleared&&Math.hypot(t.x-p.x,t.z-p.z)<r+t.r){t.routeCleared=true;t.down=true;delete game.state.down[t.id];if(t.collider){physics.removeCollider(t.collider,true);t.collider=null;}game.clearRemains(t);forest.poseTree(t,0,0,1,true);}}
 const plots=settlementSites(origin,game.state.seed,HOUSE_TYPES,heightAt);
 for(const [i,site] of plots.entries()){
  const spec=HOUSE_TYPES[i],deck=i===1?2.3:1.5;
  shared.uCabinBounds?.value[i].set(site.x,site.z+deck/2,spec.w/2+.24,(spec.d+deck)/2+.28);
  const house=createOutpostHouse(shared,site,heightAt,i,{craft});sites.push(house);district.add(house.group,house.paint.mesh);forest.shade.add(house.shadow);clearAt(site,Math.hypot(HOUSE_TYPES[i].w,HOUSE_TYPES[i].d)/2+2);
  for(const c of house.colliders)physics.createCollider(houseCollider(RAPIER,c));
  const g=new THREE.Group();g.position.set(site.x,house.group.position.y,site.z);district.add(g);groups.push(g);
  // Every settlement gets a mailbox, water barrel and hand-built fence fragments.
  box(g,.12,1.3,.12,-2.6,.65,3);box(g,.55,.34,.3,-2.6,1.3,3,2);box(g,.5,.1,.34,-2.6,1.5,3);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.31,.28,.7,10),mats[0]);barrel.position.set(2.4,.35,1.4);g.add(barrel);
  for(const side of [-1,1])for(let j=0;j<4;j++){box(g,.11,.8,.11,side*3.2,.4,-1+j*.7);if(j<3)box(g,.09,.12,.75,side*3.2,.55,-.65+j*.7);}
  const rewards=new THREE.Group();g.add(rewards);
  if(i===0){for(let row=0;row<3;row++){box(g,2,.12,.42,-3,.1,3.6+row*.6,1);for(let k=0;k<5;k++){const m=new THREE.Mesh(new THREE.DodecahedronGeometry(.13),mats[1]);m.position.set(-3.8+k*.4,.27,3.6+row*.6);rewards.add(m);}}for(const dx of [-4,4]){box(g,.2,2,.2,dx,1,-3);for(let k=0;k<5;k++){const m=new THREE.Mesh(new THREE.DodecahedronGeometry(.65),mats[1]);m.position.set(dx+Math.sin(k*2)*.6,2.1+k*.12,-3+Math.cos(k*2)*.6);g.add(m);}for(let k=0;k<7;k++){const apple=new THREE.Mesh(new THREE.SphereGeometry(.09,6,5),mats[2]);apple.position.set(dx+Math.sin(k*3)*.65,2.1+(k%3)*.15,-3+Math.cos(k*3)*.65);rewards.add(apple);}}}
  if(i===1){box(g,2.5,.13,1.3,3,.15,3);for(const dx of [2,4])box(g,.12,1.1,.12,dx,.55,3.4);box(g,2,.06,.07,3,1.1,3.4);for(let k=0;k<3;k++)box(g,.5,.25,.4,-2+k*.55,.2,-3);box(g,2,.05,.04,-2,1.8,-3);for(let k=0;k<3;k++)box(rewards,.35,.55,.04,-2.7+k*.5,1.45,-3,2);}
  if(i===2){box(g,1.3,.15,1.8,-3,.7,3);for(const dx of [-3.75,-2.25]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.43,.07,5,12),mats[0]);wheel.rotation.y=Math.PI/2;wheel.position.set(dx,.43,3);g.add(wheel);for(let k=0;k<4;k++){const spoke=box(g,.06,.8,.06,dx,.43,3);spoke.rotation.x=k*Math.PI/4;}}for(const dx of [-3.6,-2.4])box(g,.08,.08,2.3,dx,.7,4);for(let k=0;k<5;k++){const log=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,1.4,8),mats[0]);log.rotation.x=Math.PI/2;log.position.set(-3+(k%2)*.3,.9+Math.floor(k/2)*.18,3);rewards.add(log);}box(g,1.8,.12,.7,3,.65,3);for(const dx of [2.3,3.7])box(g,.12,.6,.5,dx,.3,3);}
  const repairs=[];for(let j=0;j<4;j++){const plank=box(g,.16,1.8,.13,-1.4+j*.9,.95,1.57);plank.rotation.z=(j%2?1:-1)*.28;repairs.push(plank);}house.group.userData.repairs=repairs;
  house.group.userData.rewards=rewards;
  const extraX=HOUSE_TYPES[i].w/2-1.8,extraZ=HOUSE_TYPES[i].d/2-1.5;for(const child of g.children){if(child===rewards)continue;if(Math.abs(child.position.x)>2)child.position.x+=Math.sign(child.position.x)*extraX;if(child.position.z>1.5)child.position.z+=extraZ;else if(child.position.z< -1.5)child.position.z-=extraZ;}for(const child of rewards.children){if(Math.abs(child.position.x)>2)child.position.x+=Math.sign(child.position.x)*extraX;if(child.position.z>1.5)child.position.z+=extraZ;else if(child.position.z< -1.5)child.position.z-=extraZ;}

  const route=buildTrail(origin,site,HOUSE_TYPES[i],heightAt,mats[0],shared);district.add(route.group);routes.push(route);
 }
 const guide=createFingerpost(shared,origin,sites,heightAt,mats[0],mats[1]);district.add(guide);
 physics.createCollider(RAPIER.ColliderDesc.cuboid(.085,1.10,.085).setTranslation(guide.position.x,guide.position.y+1.10,guide.position.z));
 const parts=[];for(const group of [...groups,guide]){group.updateMatrixWorld(true);group.traverse(mesh=>{const pal=mats.indexOf(mesh.material);if(mesh.isMesh&&pal>=0)parts.push({mesh,count:mesh.geometry.type==='DodecahedronGeometry'?100:25,style:()=>({pal,size:[.05,.18],dir:new THREE.Vector3(0,1,0)})});});}const dressing=pinDabs(shared,palettes,parts);dressing.update();district.add(dressing.mesh);
 return {group:district,guide,sites,routes,groups,clearAt,nearest(feet){return sites.findIndex(h=>h.contains(feet,{lodge:0})||Math.hypot(feet.x-h.dropoff.x,feet.z-h.dropoff.z)<5);},onTrail(feet,state){return routes.some((r,i)=>state.places[i].trail===40&&r.points.some((p,k)=>k&&segmentDistance(feet,r.points[k-1],p)<.85));},sync(state){for(let i=0;i<3;i++){const p=state.places[i],h=sites[i],r=routes[i],built=restored(p);h.setCamp({...state,lodge:0,porch:0,sawmill:0,planks:0,wood:built?state.wood:0,restored:built,hour:state.hour,fire:0});h.group.userData.rewards.visible=built;h.group.userData.rewards.traverse(m=>{if(m.isMesh)m.visible=built;});h.group.userData.repairs.forEach((m,k)=>m.visible=!built&&p.wood<(k+1)*6);r.build(p.trail,clearAt);}for(const g of groups)g.updateMatrixWorld(true);dressing.update();},update(dt,feet,camera,state){let room=null;for(let i=0;i<3;i++){const h=sites[i],r=h.updateInterior(dt,feet,camera),lamp=h.lampPosition,night=shared.uNight?.value??0,built=restored(state.places[i]);
    h.light(built?night:0);const p=r.inside?h.group.position:lamp;
    shared.uCampLights.value[5+i]?.set(p.x,r.inside?p.y+2.35:p.y,p.z,built?(r.inside?.73+night*1.2:night*2.2):0);if(r.camera||r.changed)room=r;}return room;}};
}
