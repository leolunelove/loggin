import * as THREE from 'three';
import {riverCenter} from './river.js';
import {FINDS} from '../woodland.js';
import {restored,segmentDistance} from '../exploration.js';
import {COMMON} from '../oilpaint/common.js';

export function createFieldwork(game,craft) {
  const {heightAt,scene,exploration:net}=game,{box,pole,group,stone,join,mats}=craft;
  const root=group(scene),finds=[],stages=[],lamps=[],jobs=[],racks=[],kept=new Map(),growth=new Map();
  const sites=net.sites.map(h=>h.group.position),routes=net.routes;
  const at=(x,z)=>group(root,x,heightAt(x,z),z);
  const range=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  function stage(key,n,g,colliders=[]){join(g);stages.push({key,n,g,colliders,bodies:[]});}
  function rack(g){
    for(const x of [-.87,.87]){for(const z of [-.36,.36])pole(g,'dark',[x,0,z],[x,.85,z],.065);box(g,'bark',x,.24,0,.14,.17,1);}
    for(const z of [-.26,.26])box(g,'cut',0,.31,z,1.95,.08,.16);
    for(let i=0;i<4;i++){const z=(i-1.5)*.162;pole(g,'bark',[-.74,.45,z],[.68,.45,z],.085);pole(g,'cut',[.68,.45,z],[.696,.45,z],.083);}
  }
  function treeBlaze(g,x,y,z){
    const m=box(g,'chalk',x,y,z,.18,.18,.033);m.rotation.z=Math.PI/4;
  }
  // Across the river the old rack becomes a shared drop point when Riverwatch reopens.
  const bz=sites[1].z+net.sites[1].spec.d/2+6,cx=riverCenter(bz),span=13,board=span/24;
  const bank=x=>heightAt(x,bz),water=bank(cx)+.74,west=bank(cx-span/2),east=bank(cx+span/2);
  const deck=t=>THREE.MathUtils.lerp(west,east,t)+.13+Math.sin(t*Math.PI)*Math.max(.38,water+.4-(west+east)/2);
  for(let n=0;n<4;n++){
    const g=group(root),colliders=[];
    for(let j=0;j<6;j++){
      const i=n*6+j,t=(i+.5)/24,x=cx-span/2+t*span,y=deck(t);
      box(g,i%4===0?'bark':'cut',x,y-.07,bz,board-.014,.14,1.75+Math.sin(i*3.5)*.09);
      colliders.push({x,y:y-.075,z:bz,hx:board/2+.009,hy:.075,hz:.86});
    }
    for(const side of [-1,1]){
      const t=n/4,end=(n+1)/4,a=cx-span/2+t*span,b=a+span/4,z=bz+side*.86;
      pole(g,'dark',[a,deck(t)-.18,z],[b,deck(end)-.18,z],.12);
      pole(g,'bark',[a,bank(a)-.1,z],[a,deck(t)+.87,z],.078);
      pole(g,'cut',[a,deck(t)+.76,z],[b,deck(end)+.76,z],.046);
      if(n===3)pole(g,'bark',[b,bank(b)-.1,z],[b,deck(end)+.87,z],.078);
    }stage('bridge',n+1,g,colliders);
  }
  for(const sign of [-1,1])net.clearAt({x:cx+sign*(span/2+.65),z:bz},1.9);
  const fieldRack=at(cx+span/2+2.7,bz-1);net.clearAt(fieldRack.position,2.3);rack(fieldRack);join(fieldRack);
  racks.push({g:fieldRack,i:1,title:'East-bank expedition rack',built:s=>restored(s.places[1])});
  const rackStack=[];for(let i=0;i<9;i++){
    const part=group(fieldRack,0,0,0),y=.61+Math.floor(i/3)*.15,z=(i%3-1)*.16;
    pole(part,'bark',[-.73,y,z],[.72,y,z],.081);pole(part,'cut',[.72,y,z],[.735,y,z],.079);join(part);rackStack.push(part);
  }
  const basket=at(sites[0].x+net.sites[0].spec.w/2+1.2,sites[0].z+net.sites[0].spec.d/2+2.1);
  for(const x of [-.44,.44])box(basket,'bark',x,.37,0,.065,.43,.64);
  for(const z of [-.3,.3])for(let j=0;j<3;j++)box(basket,'cut',0,.23+j*.14,z,.91,.10,.06);
  box(basket,'bark',0,.17,0,.91,.08,.60);join(basket);const fruit=group(basket);
  for(let i=0;i<11;i++){const x=((i%4)-1.5)*.19,z=(Math.floor(i/4)-1)*.18,y=.54+Math.sin(i*2.16)*.04;
    stone(fruit,i%4?'cloth':'leaf',x,y,z,.111,.101,.105);pole(fruit,'dark',[x,y+.07,z],[x+.012,y+.13,z],.013);}
  join(fruit);
  function syncSupplies(){const s=game.state,w=s.woodland;basket.visible=restored(s.places[0]);fruit.visible=w.lastMeal<s.day;
    const bundles=Math.min(9,Math.ceil(w.freight[1]/8));rackStack.forEach((p,i)=>p.visible=i<bundles);}
  const pennant=at(cx-span/2-1,bz-1.4);pole(pennant,'bark',[0,0,0],[0,2.3,0],.055);
  const flag=new THREE.Shape();flag.moveTo(0,0);flag.lineTo(.85,-.17);flag.lineTo(0,-.39);flag.closePath();
  const cloth=new THREE.Mesh(new THREE.ShapeGeometry(flag),mats.blue);cloth.position.y=2.25;pennant.add(cloth);

  for(const [i,f] of [.23,.54,.83].entries()){
    const p=routes[0].sample(f),x=p.x+Math.cos(p.yaw)*1.28,z=p.z-Math.sin(p.yaw)*1.28,g=at(x,z);
    pole(g,'bark',[0,-.12,0],[0,2.25,0],.084);box(g,'dark',.23,2.18,0,.63,.11,.13);
    pole(g,'dark',[.48,1.85,0],[.48,2.19,0],.026);
    box(g,'iron',.48,1.55,0,.32,.075,.32);box(g,'iron',.48,1.91,0,.36,.08,.36);
    for(const a of [-1,1])for(const b of [-1,1])box(g,'dark',.48+a*.13,1.73,b*.13,.032,.31,.032);
    const glass=new THREE.MeshBasicMaterial({color:0xffd28b});box(g,glass,.48,1.73,0,.235,.28,.235);
    lamps.push({p:new THREE.Vector3(x+.48,g.position.y+1.73,z),glass});stage('lamps',i+1,g);
  }
  const base=routes[2].sample(.79);let climb;
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6,dx=Math.sin(angle),dz=Math.cos(angle),end={x:base.x+dx*7,z:base.z+dz*7};
    if(routes[2].nearest(end).distance<3||range(end,sites[2])<9)continue;
    const rise=heightAt(end.x,end.z)-heightAt(base.x,base.z);
    if(!climb||rise>climb.rise)climb={dx,dz,rise,end,angle};
  }
  if(!climb){const angle=base.yaw+Math.PI/2;climb={angle,dx:Math.sin(angle),dz:Math.cos(angle)};}
  const stepStart={x:base.x+climb.dx*1.2,z:base.z+climb.dz*1.2},stepEnd={x:base.x+climb.dx*7.4,z:base.z+climb.dz*7.4};
  for(let n=0;n<3;n++){
    const g=group(root),colliders=[];
    for(let j=0;j<3;j++){
      const i=n*3+j,x=stepStart.x+climb.dx*i*.72,z=stepStart.z+climb.dz*i*.72,y=heightAt(x,z);
      const m=box(g,'bark',x,y+.065,z,1.45,.15,.77);m.rotation.y=climb.angle;
      const nose=box(g,'cut',x+climb.dx*.33,y+.139,z+climb.dz*.33,1.48,.027,.095);nose.rotation.y=climb.angle;
      colliders.push({x,y:y+.055,z,hx:.735,hy:.079,hz:.385,yaw:climb.angle});
      if(j===1){const px=x+climb.dz*.86,pz=z-climb.dx*.86;pole(g,'dark',[px,y-.05,pz],[px,y+.86,pz],.06);}
    }stage('steps',n+1,g,colliders);
  }
  const stop=routes[2].sample(.49),shelter=at(stop.x+Math.cos(stop.yaw)*3.8,stop.z-Math.sin(stop.yaw)*3.8);
  net.clearAt(shelter.position,2.75);
  for(let n=1;n<=3;n++){
    const g=group(shelter);if(n===1){
      for(const x of [-1.45,1.45])for(const z of [-1,1])pole(g,'bark',[x,-.2,z],[x,2.2-z*.18,z],.098);
      box(g,'cut',0,.08,0,3.3,.12,2.4);
    }else if(n===2){
      for(const x of [-1.45,1.45])pole(g,'dark',[x,2.4,-1.1],[x,2,1.1],.11);
      for(let i=0;i<6;i++)box(g,'bark',0,.29+i*.23,-1,3,.14,.12);
    }else{
      for(let i=0;i<10;i++){const m=box(g,i%4?'moss':'dark',-1.65+i*.367,2.29,0,.388,.11,2.74);m.rotation.x=.18;}
    }const h=shelter.position,colliders=n===1?[-1.45,1.45].flatMap(x=>[-1,1].map(z=>({x:h.x+x,y:h.y+1,z:h.z+z,hx:.085,hy:1.1,hz:.085}))):n===2?[{x:h.x,y:h.y+.75,z:h.z-1,hx:1.5,hy:.76,hz:.075}]:[];
    stage('shelter',n,g,colliders);
  }
  const dryRack=group(shelter,.30,.07,-.52);rack(dryRack);join(dryRack);racks.push({g:shelter,i:2,title:'Shelter rack',built:s=>s.woodland.projects.shelter===3});
  const clues=[['carving',sites[0].x-7,sites[0].z+7],['tools',cx-span/2-2,bz+2.2],['kiln',stepEnd.x+climb.dx*1.4,stepEnd.z+climb.dz*1.4]];
  for(const [key,x,z] of clues){
    const g=at(x,z);net.clearAt(g.position,1.55);
    if(key==='carving'){
      pole(g,'bark',[0,-.1,0],[-.06,2.45,.12],.26);pole(g,'bark',[0,1.25,0],[-.54,1.74,.1],.11);
      for(const dy of [.89,1.23,1.57])treeBlaze(g,0,dy,.28);
      for(let i=0;i<3;i++)stone(g,'moss',Math.sin(i*2)*.32,.13,Math.cos(i*2)*.31,.28,.17,.25);
    }else if(key==='tools'){
      box(g,'bark',0,.21,0,1.20,.38,.53);box(g,'blue',-.24,.425,0,.42,.05,.44);
      for(const x of [-.27,.27])pole(g,'cut',[x,.52,0],[x,.48,.21],.037);
      box(g,'iron',0,.52,0,.54,.036,.083);for(let j=0;j<3;j++){
        const m=new THREE.Mesh(new THREE.TorusGeometry(.17-j*.028,.022,4,16),mats.cut);m.rotation.x=Math.PI/2;m.position.set(.32,.43,.04);g.add(m);}
    }else{
      for(let row=0;row<3;row++)for(let j=0;j<11-row;j++){
        const a=(j+row*.45)*Math.PI*2/11;if(Math.cos(a)>.72&&row>0)continue;
        stone(g,'stone',Math.sin(a)*(1-row*.08),.16+row*.29,Math.cos(a)*(1-row*.08),.36,.25,.34);}
      stone(g,'dark',0,.11,0,.86,.22,.83);pole(g,'dark',[-.87,.29,.49],[.56,.80,-.43],.085);
    }
    join(g);finds.push({key,g,...FINDS[key]});
  }
  stepEnd.x+=climb.dx*.5;stepEnd.z+=climb.dz*.5;
  // Five windthrows. Choose a clear patch beside the trail so the log lies on accessible terrain.
  for(let i=0;i<5;i++){
    const route=routes[i%3],p=route.sample([.39,.64,.68,.83,.35][i]);let best,score=-Infinity;
    for(const side of [-1,1])for(const gap of [3.8,5.3,6.8]){
      const x=p.x+side*Math.cos(p.yaw)*gap,z=p.z-side*Math.sin(p.yaw)*gap;
      const d=Math.min(...net.sites.map(h=>range(h.group.position,{x,z})-Math.max(h.spec.w,h.spec.d)/2),...finds.map(f=>range(f.g.position,{x,z})),range(shelter.position,{x,z}),Math.abs(x-riverCenter(z))-4.8,...routes.map(r=>r.nearest({x,z}).distance));
      if(d>score){score=d;best={x,z};}
    }
    const current=[],dir={x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
    for(let n=0;n<3;n++){
      const x=best.x+dir.x*(n-1)*1.10,z=best.z+dir.z*(n-1)*1.10,r=.28-n*.029,g=at(x,z);
      net.clearAt(g.position,.80);g.rotation.y=p.yaw;
      const pitch=(heightAt(x+dir.x*.5,z+dir.z*.5)-heightAt(x-dir.x*.5,z-dir.z*.5));g.rotation.x=-Math.atan(pitch);
      pole(g,'bark',[0,r,-.55],[0,r,.55],r);pole(g,'cut',[0,r,-.562],[0,r,-.55],r*.96);pole(g,'cut',[0,r,.55],[0,r,.562],r*.96);
      if(n===2)pole(g,'dark',[0,r,-.12],[.38,r+.31,.17],.072);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(r+.002,.012,4,12),mats.chalk);ring.position.set(0,r,-.20);g.add(ring);join(g);
      current.push({g,x,z,y:g.position.y,r,type:0,tier:0,windthrow:true,job:i,section:n,hp:3,maxHp:3,id:'w'+i+'-'+n});
    }jobs.push(current);
  }
  const chimney=sites[2].clone().add(new THREE.Vector3(-2.6,net.sites[2].spec.h+1.86,-1.6));
  const smoke=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({uniforms:game.shared,glslVersion:THREE.GLSL3,transparent:true,depthWrite:false,
    vertexShader:`out vec2 vUv;void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy*vec2(2.6,4.);gl_Position=projectionMatrix*p;}`,
    fragmentShader:`${COMMON}\nin vec2 vUv;out vec4 outC;void main(){float t=vUv.y;float x=(vUv.x-.28-t*.40-.05*sin(9.*t-uTime*1.3))/(.068+.18*t);float w=exp(-x*x*2.)*smoothstep(0.,.11,t)*(1.-smoothstep(.40,1.,t));float n=texture(tNoise,vec2(vUv.x*1.3,t*1.4-uTime*.12)).g;outC=vec4(mix(vec3(.45,.40,.37),uHaze,.45),w*(.18+n*.34));}`}));
  smoke.position.copy(chimney).add(new THREE.Vector3(.28,1.9,0));smoke.frustumCulled=false;root.add(smoke);
  function sync(){
    const s=game.state,w=s.woodland;
    for(const e of stages){
      const shown=w.projects[e.key]>=e.n;e.g.visible=shown;
      if(shown&&!e.bodies.length)for(const c of e.colliders){let d=game.RAPIER.ColliderDesc.cuboid(c.hx,c.hy,c.hz).setTranslation(c.x,c.y,c.z);if(c.yaw)d.setRotation({x:0,y:Math.sin(c.yaw/2),z:0,w:Math.cos(c.yaw/2)});e.bodies.push(game.physics.createCollider(d));}
    }
    syncSupplies();fieldRack.visible=restored(s.places[1]);dryRack.visible=w.projects.shelter===3;pennant.visible=w.finds.includes('tools');smoke.visible=restored(s.places[2]);
    jobs.forEach((list,i)=>list.forEach((t,n)=>{t.down=n!==w.sections[i];t.g.visible=n>=w.sections[i];
      if(t.g.visible&&!t.body){const yaw=t.g.rotation.y;t.body=game.physics.createCollider(game.RAPIER.ColliderDesc.cuboid(t.r,.82*t.r,.54).setTranslation(t.x,t.y+t.r,t.z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}));}
      if(!t.g.visible&&t.body){game.physics.removeCollider(t.body,true);t.body=null;}}));
    for(const t of [...kept.keys()])if(!w.reserved.includes(t.id)){const marker=kept.get(t);root.remove(marker);marker.traverse(o=>o.geometry?.dispose());kept.delete(t);}
    for(const id of w.reserved){const t=game.forest.trees[id];if(!t||kept.has(t)||t.routeCleared)continue;
      const g=at(t.x,t.z),band=new THREE.Mesh(new THREE.CylinderGeometry(t.r*1.15,t.r*1.16,.09,14,1,true),mats.chalk);band.position.y=1.17;g.add(band);
      pole(g,'cut',[t.r+.21,0,.19],[t.r+.18,.88,.19],.055);treeBlaze(g,t.r+.18,.76,.26);join(g);kept.set(t,g);}
  }
  function restoreGrowth(t,age){
    if(age<.12)return;let patch=growth.get(t.id);
    if(!patch){const g=at(t.x+.27,t.z-.16),young=group(g);g.rotation.y=t.seed;
      pole(young,'bark',[0,0,0],[.05,1.5,0],.036);
      for(let i=0;i<7;i++){const a=i*2.39,y=.43+i*.15,r=.30-i*.025,x=Math.sin(a)*r,z=Math.cos(a)*r;
        pole(young,'bark',[.03,y-.15,0],[x,y+.13,z],.018);stone(young,i%3?'moss':'leaf',x,y+.16,z,.23,.23,.17);}
      join(young);const blooms=group(g);for(let i=0;i<8;i++){const x=Math.sin(i*2.4)*(.32+i*.047),z=Math.cos(i*2.4)*(.32+i*.047);pole(blooms,'moss',[x,0,z],[x,.18,z],.012);stone(blooms,i%3?'chalk':'leaf',x,.19,z,.056,.038,.057);}
      join(blooms);patch={g,young,blooms};growth.set(t.id,patch);}
    patch.blooms.scale.setScalar(THREE.MathUtils.smoothstep(age,.12,.36));patch.young.scale.setScalar(THREE.MathUtils.smoothstep(age,.24,.74)*2.65*(1-THREE.MathUtils.smoothstep(age,.76,.90)));
  }
  function clearGrowth(t){const p=growth.get(t.id);if(p){root.remove(p.g);p.g.traverse(o=>o.geometry?.dispose());growth.delete(t.id);}}
  function fieldAction(p,s){
    for(const f of finds)if(!s.woodland.finds.includes(f.key)&&range(p,f.g.position)<2.65)return {type:'find',item:f,title:'Inspect '+f.name.replace(/^The /,'the '),note:'A trace of the people who lived here'};
    if(basket.visible&&s.woodland.lastMeal<s.day&&range(p,basket.position)<1.65)return {type:'meal',title:'Eat orchard apples',note:'A brisker sprint for three camp hours'};
    for(const r of racks)if(r.built(s)&&range(p,r.g.position)<2.05)return {type:'rack',item:r,title:r.title,note:s.carried?'Empty your bag into shared stock':'Your bag is empty'};
    return null;
  }
  function canReserve(t,s){return !!t&&!t.windthrow&&!t.down&&t.tier===0&&
    [game.home.group.position,...sites.filter((_,i)=>restored(s.places[i]))].some(p=>range(p,t)<=17)&&
    routes.every(r=>r.nearest(t).distance>t.r+1.8);}
  function updateLights(night){
    lamps.forEach(({p,glass},i)=>{const lit=game.state.woodland.projects.lamps>i?night:0;
      glass.color.setRGB(.72+lit*.28,.56+lit*.18,.30+lit*.10);
      game.shared.uCampLights.value[8+i].set(p.x,p.y,p.z,lit*2.8);});
  }
  return {group:root,sync,syncSupplies,finds,racks,jobs,stageParts:stages,shelter,fieldAction,canReserve,restoreGrowth,clearGrowth,updateLights,
    windthrows:()=>jobs.flatMap((g,i)=>g[game.state.woodland.sections[i]]||[]),
    dry:p=>game.state.woodland.projects.shelter===3&&Math.abs(p.x-shelter.position.x)<1.63&&Math.abs(p.z-shelter.position.z)<1.19,
    onSteps:p=>game.state.woodland.projects.steps===3&&segmentDistance(p,stepStart,stepEnd)<.78};
}
