import * as THREE from 'three';
import {AXE_PROFILES} from '../figure/axes.js';

export function buildShackRoom({box,part}){
 const goods=[],tools=[],rewards=[],boardParts=[];
 // The centre stays clear: bench at the left, supply shelves at the right.
 box(.72,.12,1.18,0,[-1.3,.82,-.25],40);
 for(const x of [-1.57,-1.03])for(const z of [-.72,.22])box(.08,.76,.09,1,[x,.38,z],12);
 box(.3,.07,.26,4,[-1.3,.91,-.2],10);box(.05,.04,.38,6,[-1.3,.98,-.15],8);
 for(const z of [-.85,.5])box(.09,1.9,.1,1,[1.63,.95,z],20);
 for(const y of [.45,1,1.55])box(.65,.07,1.45,0,[1.38,y,-.17],28);
 for(let i=0;i<9;i++){
  const m=part(new THREE.CylinderGeometry(.07,.08,.47,8),1,[1.36+(i%3-1)*.15,.57+Math.floor(i/3)*.14,-.2],12);m.rotation.x=Math.PI/2;goods.push({mesh:m,key:'ordinary',index:i});m.visible=false;
 }
 for(let i=0;i<6;i++){
  const m=part(new THREE.CylinderGeometry(.07,.08,.43,8),3,[1.36+(i%3-1)*.15,1.12+Math.floor(i/3)*.14,-.2],12);m.rotation.x=Math.PI/2;goods.push({mesh:m,key:'hardwood',index:i});m.visible=false;
 }
 for(let i=0;i<8;i++){const m=box(.42,.035,.23,0,[1.36,1.61+i*.04,-.15],8);goods.push({mesh:m,key:'planks',index:i});m.visible=false;}
 // Every purchased axe stays on the wall, from the hand axe to the forester's tool.
 for(let tier=0;tier<5;tier++){
  const z=-.92+tier*.42,handle=box(.025,.39,.025,1,[-1.68,1.48,z],10);
  const shape=new THREE.Shape();AXE_PROFILES[tier].points.forEach(([x,y],i)=>i?shape.lineTo(x*.48,y*.48):shape.moveTo(x*.48,y*.48));shape.closePath();
  const head=part(new THREE.ExtrudeGeometry(shape,{depth:.03,bevelEnabled:false}),6,[-1.68,1.45,z],12);head.rotation.y=Math.PI/2;
  for(const mesh of [handle,head]){tools.push({mesh,tier});mesh.visible=tier===0;}
 }
 boardParts.push(box(1.4,.78,.055,1,[0,1.55,-1.33],35),box(1.28,.65,.02,3,[0,1.55,-1.29],20));
 // Small building mementos appear alongside their real outdoor counterparts.
 for(const [i,key]of ['shed','sawmill','porch','lodge'].entries()){
  const x=-.48+i*.32,m=box(.18,.15,.14,4,[x,1.06,-1.22],8);rewards.push({mesh:m,key});boardParts.push(m);m.visible=false;
  const roof=box(.23,.045,.19,2,[x,1.16,-1.22],8);rewards.push({mesh:roof,key});boardParts.push(roof);roof.visible=false;
 }
 const rug=box(1.25,.012,1.4,7,[-.22,.125,.16],45);rug.visible=false;
 // The completed rear room can be walked into and gains a bed and a reading shelf.
 const room=[];
 for(const m of [box(.98,.24,1.78,1,[.95,.22,-2.88],35),box(.92,.15,1.7,7,[.95,.4,-2.88],40),box(.91,.05,1.1,3,[.95,.5,-2.58],30),box(.72,.12,.35,7,[.95,.55,-3.48],20),box(.6,.65,.45,0,[-1.25,.33,-3.3],25)]){room.push(m);m.visible=false;}
 // A small lantern gives the room its own warm colour.
 box(.18,.24,.18,5,[1.28,1.83,-.6],15);box(.22,.035,.22,6,[1.28,1.68,-.6],8);box(.22,.035,.22,6,[1.28,1.98,-.6],8);
 let ctx,texture,previous='',expanded=false;
 if(typeof document!=='undefined'&&document.createElement){const canvas=document.createElement('canvas');canvas.width=640;canvas.height=320;ctx=canvas.getContext('2d');if(ctx){texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const label=part(new THREE.PlaneGeometry(1.22,.61),3,[0,1.55,-1.274],0);boardParts.push(label);label.material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});}}
 const show=(mesh,value)=>{if(mesh.userData.shown===value)return false;mesh.userData.shown=value;return true;};
 return {setState(s){
  let changed=false;const complete=s.lodge>=24;if(complete!==expanded){for(const mesh of boardParts)mesh.position.z+=complete?-2.65:2.65;expanded=complete;changed=true;}const quantities={ordinary:Math.max(0,s.wood-s.hardwood),hardwood:s.hardwood||0,planks:s.planks||0};
  for(const {mesh,key,index}of goods)changed=show(mesh,index<Math.ceil(quantities[key]/(key==='planks'?2:8)))||changed;
  for(const {mesh,tier}of tools)changed=show(mesh,tier<=s.axe)||changed;
  for(const {mesh,key}of rewards)changed=show(mesh,s[key]>=(key==='porch'?12:key==='lodge'?24:40))||changed;
  changed=show(rug,s.porch>=12)||changed;for(const mesh of room)changed=show(mesh,s.lodge>=24)||changed;
  const key=[s.wood,s.hardwood,s.planks,s.felled,s.shed,s.sawmill,s.porch,s.lodge].join(':');
  if(ctx&&key!==previous){previous=key;ctx.fillStyle='#253025';ctx.fillRect(0,0,640,320);ctx.fillStyle='#f1dfb8';ctx.textAlign='center';ctx.font='bold 36px Georgia';ctx.fillText('THE AUTUMN CAMP',320,62);ctx.font='26px Georgia';ctx.fillText(`${s.wood} wood · ${s.hardwood||0} hardwood`,320,122);ctx.fillText(`${s.planks||0} planks · ${s.felled} ${s.felled===1?'tree':'trees'} felled`,320,174);ctx.fillStyle='#cfb578';ctx.font='24px Georgia';const built=Number(s.shed>=40)+Number(s.sawmill>=40)+Number(s.porch>=12)+Number(s.lodge>=24);ctx.fillText(`${built} / 4 camp projects complete`,320,245);texture.needsUpdate=true;}
  return changed;
 }};
}
