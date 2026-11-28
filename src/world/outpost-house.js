import * as THREE from 'three';
import {dressTimber} from './timber.js';
import {dressOutpost} from './outpost-details.js';
import {woodcraft} from './woodcraft.js';
import {paint} from '../figure/figure.js';import {pinDabs} from '../oilpaint/pins.js';
export const HOUSE_TYPES=[
 {name:'orchard-cottage',w:6.4,d:5.2,h:2.65,roof:'gable',wall:[[.79,.65,.42],[.48,.38,.25],[.24,.23,.18]]},
 {name:'riverside-cabin',w:4.8,d:8.2,h:2.6,roof:'shed',wall:[[.53,.64,.6],[.29,.4,.38],[.15,.24,.24]]},
 {name:'logging-lodge',w:8,d:6.6,h:3.1,roof:'double',wall:[[.63,.39,.25],[.37,.24,.18],[.19,.17,.15]]},
];
export function houseCollider(R,c) {
  const shape=c.vertices?R.ColliderDesc.convexHull(c.vertices):R.ColliderDesc.cuboid(c.hx,c.hy,c.hz);
  return shape.setTranslation(c.x,c.y,c.z);
}
export function createOutpostHouse(shared,site,heightAt,index,{makePaint=paint,craft=woodcraft(shared)}={}){
 const spec=HOUSE_TYPES[index],{w,d,h}=spec,X=w/2,Z=d/2;
 const y=Math.max(...[-X,X].flatMap(x=>[-Z,Z].map(z=>heightAt(site.x+x,site.z+z))));
 const group=new THREE.Group();group.name=spec.name;group.position.set(site.x,y,site.z);
 const palettes=[spec.wall,[[.55,.38,.23],[.28,.22,.16],[.13,.14,.12]],[[.47,.53,.43],[.25,.32,.29],[.12,.2,.2]],[[.7,.69,.59],[.4,.43,.39],[.22,.27,.27]],[[.98,.79,.45],[.6,.45,.25],[.26,.25,.19]],[[.85,.81,.65],[.51,.56,.46],[.24,.3,.26]]],mats=palettes.map((p,i)=>makePaint(shared,p,{board:i<2})),parts=[],colliders=[];
 for(const m of mats)if(m.uniforms?.uDistanceHaze)m.uniforms.uDistanceHaze.value=.81;
 const box=(a,b,c,x,dy,z,pal=0,shell=null)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),mats[pal]);mesh.position.set(x,dy,z);mesh.userData.shell=shell;group.add(mesh);parts.push({mesh,count:Math.max(12,Math.min(150,Math.ceil(a*b*c*25+20))),style:()=>({pal,size:[.09,.26],dir:new THREE.Vector3(0,1,0)})});return mesh;};
 const collision=(x,dy,z,hx,hy,hz)=>colliders.push({x:site.x+x,y:y+dy,z:site.z+z,hx,hy,hz});
 box(w+.2,.22,d+.2,0,-.02,0,3);collision(0,-.02,0,X+.1,.11,Z+.1);
 const doorX=index===0?-1.1:0,doorW=1.45,porchDepth=index===1?2.3:1.5;
 // Door remains human scale. Extra floor area comes from new wall bays, not stretched models.
 for(const z of [-Z,Z]){const front=z>0;for(let x=-X+.16;x<X;x+=.32){if(front&&Math.abs(x-doorX)<doorW/2+.15)continue;box(.31,h,.14,x,h/2+.1,z,0,front?'front':'back');}}
 for(const x of [-X,X])for(let z=-Z+.16;z<Z;z+=.32)box(.14,h,.31,x,h/2+.1,z,0,x<0?'left':'right');
 collision(0,h/2,-Z,X,h/2,.08);for(const x of [-X,X])collision(x,h/2,0,.08,h/2,Z);
 const left=doorX-doorW/2,right=doorX+doorW/2;collision((-X+left)/2,h/2,Z,(left+X)/2,h/2,.08);collision((right+X)/2,h/2,Z,(X-right)/2,h/2,.08);
 box(doorW+.2,.16,.22,doorX,2.38,Z,1,'front');
 // Fixed-height door and threshold; roof and windows have their own proportions.
 const hinge=new THREE.Group();hinge.position.set(left,0,Z+.1);group.add(hinge);const door=box(doorW,2.22,.09,doorX,1.21,Z+.1,1,'front');group.updateMatrixWorld(true);hinge.attach(door);
 for(const x of [left-.08,right+.08])box(.14,2.35,.21,x,1.23,Z,1,'front');
 // Bury the foot of the ramp in the ground. One walkable face spans the
 // visible treads, including their join to the deck, on each generated slope.
 const near=Z+porchDepth-.18,deck=.12;
 let run=1.9,farY=0;
 for(let n=0;n<8;n++){
   farY=heightAt(site.x+doorX,site.z+near+run)-y-.055;
   if(Math.abs(deck-farY)/run<.32)break;
   run+=.4;
 }
 const count=Math.ceil(run/.36),stride=run/count,bottom=Math.min(deck,farY)-.34;
 for(let k=0;k<count;k++){
   const z=near+(k+.5)*stride,top=deck+(farY-deck)*(k+.5)/count;
   box(1.76,top-bottom,stride+.008,doorX,(top+bottom)/2,z,3);
 }
 const verts=[];
 for(const x of [-.91,.91])verts.push(x,deck,0,x,bottom,0,x,farY,run,x,bottom,run);
 colliders.push({x:site.x+doorX,y,z:site.z+near,vertices:new Float32Array(verts)});
 for(const x of [-X+.14,X-.14])for(const z of [-Z,Z])box(.22,h+.2,.22,x,h/2+.1,z,1);
 function window(x,z,width=1.3){box(width+.2,1.23,.17,x,1.57,z,1,z>0?'front':'back');box(width,1.04,.19,x,1.57,z+.025,4,z>0?'front':'back');for(const dx of [-width/2,0,width/2])box(.065,1.2,.23,x+dx,1.57,z+.08,1,z>0?'front':'back');box(width+.12,.065,.23,x,1.57,z+.08,1,z>0?'front':'back');}
 if(index===0){window(1.3,Z,1.45);box(1.6,.18,.4,1.3,.93,Z+.25,1,'front');}
 if(index===1){window(-1.4,Z,.8);window(1.4,Z,.8);}
 if(index===2){window(-2.5,Z,1.65);window(2.5,Z,1.65);window(0,-Z,2.1);}
 function gable(cx,half,depth,base,rise){for(const sign of [-1,1]){const slope=Math.hypot(half+.35,rise),roof=box(slope,.15,depth+.8,cx+sign*(half+.35)/2,base+rise/2,0,2,'roof');roof.rotation.z=-sign*Math.atan2(rise,half+.35);for(let row=0;row<6;row++){const x=sign*(row+.5)*(half+.35)/6;const strip=box((half+.35)/6+.09,.045,depth+.85,cx+x,base+rise*(1-Math.abs(x)/(half+.35))+.08,0,2,'roof');strip.rotation.z=roof.rotation.z;}}const shape=new THREE.Shape();shape.moveTo(-half,0);shape.lineTo(half,0);shape.lineTo(0,rise);shape.closePath();for(const z of [-depth/2,depth/2]){const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false}),mats[0]);mesh.position.set(cx,base,z);mesh.userData.shell='roof';group.add(mesh);parts.push({mesh,count:100,style:()=>({pal:0,size:[.1,.25],dir:new THREE.Vector3(0,1,0)})});}}
 if(spec.roof==='gable')gable(0,X,d,h+.12,1.5);
 if(spec.roof==='double'){gable(-2,2,d,h+.12,1.45);gable(2,2,d,h+.12,1.45);box(.6,2,.65,-2.6,h+.7,-1.6,3,'roof');box(.85,.16,.9,-2.6,h+1.75,-1.6,1,'roof');}
 if(spec.roof==='shed'){for(const z of [-Z,Z]){const fill=.65-z*.13;box(w,fill,.14,0,h+.1+fill/2,z,0,'roof');}const cap=new THREE.Shape();cap.moveTo(-Z,0);cap.lineTo(Z,0);cap.lineTo(Z,.65+Z*.13);cap.lineTo(-Z,.65-Z*.13);cap.closePath();for(const x of [-X,X]){const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(cap,{depth:.14,bevelEnabled:false}),mats[0]);mesh.rotation.y=Math.PI/2;mesh.position.set(x,h+.1,0);mesh.userData.shell='roof';group.add(mesh);parts.push({mesh,count:80,style:()=>({pal:0,size:[.09,.23],dir:new THREE.Vector3(0,1,0)})});}const roof=box(w+.9,.18,d+1.1,0,h+.65,0,2,'roof');roof.rotation.x=.13;for(let k=0;k<12;k++){const z=-Z-.4+k*(d+.8)/11;const strip=box(w+1,.045,.09,0,h+.76-z*.13,z,1,'roof');strip.rotation.x=.13;}}
 // Different covered outdoor spaces: cottage veranda, long cabin deck, lodge front hall.
 box(w+.35,.16,porchDepth,0,.04,Z+porchDepth/2,1,'porch');collision(0,.04,Z+porchDepth/2,X+.175,.08,porchDepth/2);
 for(const x of [-X,X])box(.17,h,.17,x,h/2,Z+porchDepth,1,'porch');
 const porchRoof=box(w+.7,.14,porchDepth+.35,0,h-.18,Z+porchDepth/2,2,'roof');porchRoof.rotation.x=.08;
 // Furnish the larger interiors: full-size beds, storage walls, a worktable and seating.
 const obstacles=[];
 const obstacle=(x,dy,z,hx,hy,hz)=>{collision(x,dy,z,hx,hy,hz);obstacles.push(colliders.at(-1));};
 const furniture=(a,b,c,x,dy,z,pal=1)=>{box(a,b,c,x,dy,z,pal);obstacle(x,dy,z,a/2,b/2,c/2);};
 const bedPlaces=[];
 const beds=index===2?4:index===1?2:1;for(let i=0;i<beds;i++){const x=i%2===0?-X+.7:X-.7,z=-Z+1.2+Math.floor(i/2)*2.05;bedPlaces.push({x,z,top:.685,side:x<0?1:-1});furniture(1.05,.35,1.9,x,.29,z);box(.98,.15,1.8,x,.54,z,5);box(.85,.12,.4,x,.67,z-.58,5);box(.98,.055,1.1,x,.65,z+.24,index===0?4:2);}
 const tableX=index===0?.74:index===1?1.31:1.38;
 furniture(index===2?2.3:1.5,.13,.85,tableX,.86,-.2);for(const dx of [-.55,.55])box(.1,.75,.1,tableX+dx,.46,-.2,1);furniture(1.38,.12,.38,tableX,.48,.65);
 const details=dressOutpost(group,craft,spec,index,doorX,tableX,bedPlaces);
 if(index===2)obstacle(-X+.55,.49,Z-.66,.25,.49,.23);
 const shelfZ=index===0?-Z+1.2:Z-1.19;
 for(const y of [.55,1.15,1.75])box(.45,.09,1.8,X-.34,y,shelfZ,1);for(let i=0;i<7;i++)box(.32,.15,.22,X-.34,.68+(i%3)*.6,shelfZ-.55+Math.floor(i/3)*.45,3);
 if(index===0){box(.9,1.7,.45,-X+.6,.93,Z-.5,5);box(.7,.1,.7,1.5,.8,-Z+.7,1);}
 let ctx,texture;if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;ctx=canvas.getContext('2d');ctx.fillStyle=['#593d29','#43534a','#614332'][index];ctx.fillRect(0,0,512,160);ctx.strokeStyle='#b19264';ctx.lineWidth=4;ctx.strokeRect(8,10,496,140);ctx.fillStyle='#f6dfaa';ctx.textAlign='center';ctx.font='bold 48px Georgia';ctx.fillText(['Orchard Rest','Riverwatch','Pine Hollow'][index],256,98);for(const x of [25,487]){ctx.beginPath();ctx.arc(x,80,5,0,Math.PI*2);ctx.fill();}texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.08,.42),new THREE.MeshBasicMaterial({map:texture}));sign.position.set(doorX,Math.min(h-.13,2.67),Z+.19);sign.userData.shell='front';group.add(sign);}
 for(const {mesh} of parts)if(mesh.material===mats[0]||mesh.material===mats[1])dressTimber(mesh.geometry,mesh.position.toArray());
 group.updateMatrixWorld(true);const painted=pinDabs(shared,palettes,parts);painted.update();const shadow=new THREE.Group(),black=new THREE.MeshBasicMaterial();for(const {mesh}of parts){const m=new THREE.Mesh(mesh.geometry,black);m.matrixAutoUpdate=false;m.matrix.copy(mesh.matrixWorld);shadow.add(m);}
 let mask='',angle=0,inhabited=false,reveal=false;function sync(){group.traverse(m=>{if(m.isMesh&&m.userData.shell)m.visible=!mask.includes(m.userData.shell);});group.updateMatrixWorld(true);parts.forEach(({mesh},i)=>{shadow.children[i].visible=mesh.visible;shadow.children[i].matrix.copy(mesh.matrixWorld);});painted.update();}
 const contains=feet=>Math.abs(feet.x-site.x)<X-.18&&Math.abs(feet.z-site.z)<Z-.18&&Math.abs(feet.y-y)<1.6;
 const nearDoor=feet=>Math.abs(feet.y-y)<1.6&&Math.hypot(feet.x-site.x-doorX,feet.z-site.z-Z)<2.5;
 const lampPosition=details.lamp.clone().add(group.position);
 return {group,paint:painted,shadow,colliders,obstacles,spec,beds:bedPlaces,bedside:details.bedside,door:hinge,lampPosition,dropoff:{x:site.x+doorX,y,z:site.z+Z+1},contains,nearDoor,
  setCamp(state){inhabited=!!state.restored;details.room.visible=inhabited&&reveal;},
  light(night){details.core.visible=night>.08&&!mask.includes('front');details.bedGlass.color.setRGB(.38+.62*night,.29+.33*night,.17+.13*night);},
  setWood(){},
  updateInterior(dt,feet,camera){
    const inside=contains(feet),near=nearDoor(feet),old=angle,front=feet.z-site.z-Z;
    reveal=inside||(near&&Math.abs(feet.x-site.x-doorX)<(reveal?1.03:.82)&&front<(reveal?1.04:.70));
    angle+=((inside||near?-1.5:0)-angle)*(1-Math.exp(-8*dt));hinge.rotation.y=angle;
    const focus=camera.userData?.cabinLook;
    const next=reveal?'roof,'+(inside?((camera.position.z>=(focus?.z??site.z)?'front,':'back,')+(camera.position.x>=(focus?.x??site.x)?'right':'left')):''):'';
    const changed=next!==mask;mask=next;details.room.visible=inhabited&&reveal;details.floor.visible=reveal;
    if(changed||Math.abs(old-angle)>.0001)sync();
    return {inside,reveal,changed,camera:reveal?{center:{x:site.x,y:y+.83,z:site.z},distance:Math.max(w,d)*1.36}:null};
  }};
}
