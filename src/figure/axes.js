import * as THREE from 'three';
import {pinDabs} from '../oilpaint/pins.js';
export const AXE_PROFILES=[
 {wood:[[.7,.47,.25],[.38,.25,.16],[.18,.14,.12]],steel:[[.68,.73,.7],[.37,.43,.43],[.16,.22,.24]],depth:.055,points:[[-.045,.48],[.27,.43],[.315,.525],[.29,.64],[-.045,.6]],wrap:0},
 {wood:[[.94,.73,.4],[.56,.35,.19],[.23,.18,.17]],steel:[[.85,.9,.84],[.44,.55,.55],[.2,.28,.3]],depth:.065,points:[[-.065,.48],[.2,.36],[.29,.38],[.315,.525],[.3,.7],[-.065,.63]],wrap:.13},
 {wood:[[.79,.56,.3],[.38,.23,.14],[.16,.13,.11]],steel:[[.97,.98,.9],[.61,.69,.69],[.26,.34,.38]],depth:.078,points:[[-.16,.48],[.02,.44],[.27,.37],[.315,.525],[.29,.71],[.01,.65],[-.16,.62]],wrap:.24},
 {wood:[[.68,.39,.24],[.32,.19,.14],[.14,.12,.12]],steel:[[.82,.86,.83],[.43,.5,.53],[.17,.24,.29]],depth:.15,points:[[-.19,.46],[.18,.39],[.29,.41],[.315,.525],[.29,.67],[.17,.69],[-.19,.64]],wrap:.32},
 {wood:[[.5,.36,.24],[.23,.2,.17],[.1,.12,.12]],steel:[[.98,.97,.87],[.61,.67,.64],[.24,.32,.34]],depth:.09,points:[[-.31,.38],[-.08,.47],[.02,.45],[.28,.36],[.315,.525],[.29,.72],[.02,.65],[-.08,.64],[-.31,.71],[-.35,.525]],wrap:.4},
];
const LEATHER=[[.37,.28,.2],[.2,.16,.13],[.09,.1,.1]],BRASS=[[.89,.71,.35],[.49,.36,.17],[.2,.17,.12]];
export function axeIcon(tier){
 const points=AXE_PROFILES[tier]?.points||AXE_PROFILES[0].points;
 return `<svg viewBox="0 0 74 86" class="tool-art" aria-hidden="true"><g transform="translate(35 55) rotate(27) scale(67 -67)"><path d="M0 -.32V.62" stroke="#a57a4a" stroke-width=".065" stroke-linecap="round"/><path d="M${points.map(p=>p.join(' ')).join('L')}Z" fill="#c9d0c4" stroke="#f4e7bd" stroke-width=".018"/></g></svg>`;
}
export function createAxes(shared,makePaint){
 const group=new THREE.Group(),parts=[],palettes=[],materials=[],models=[];
 for(const [tier,profile]of AXE_PROFILES.entries()){
  const model=new THREE.Group();model.name=['hand-axe','felling-axe','steel-axe','splitting-axe','foresters-axe'][tier];group.add(model);const meshes=[];
  const base=palettes.length;
  for(const pal of [profile.wood,profile.steel,LEATHER,BRASS]){palettes.push(pal);materials.push(makePaint(shared,pal));}
  function part(geometry,pal,position,count=35,size=[.025,.09]){
   const mesh=new THREE.Mesh(geometry,materials[base+pal]);mesh.position.set(...position);mesh.layers.enable(1);model.add(mesh);meshes.push(mesh);
   parts.push({mesh,count,style:()=>({pal:base+pal,size,dir:new THREE.Vector3(0,1,0)})});return mesh;
  }
  part(new THREE.CylinderGeometry(.023,.034,1,9),0,[0,.18,0],95,[.025,.12]);
  const shape=new THREE.Shape();profile.points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  part(new THREE.ExtrudeGeometry(shape,{depth:profile.depth,bevelEnabled:false}),1,[0,0,-profile.depth/2],80,[.035,.065]);
  part(new THREE.CylinderGeometry(.038,.04,.105,8),tier===4?3:2,[0,.48,0],20);
  if(profile.wrap){
   part(new THREE.CylinderGeometry(.034,.04,profile.wrap,9),2,[0,-.25+profile.wrap/2,0],45,[.025,.06]);
   for(let i=0;i<Math.ceil(profile.wrap/.045);i++)part(new THREE.TorusGeometry(.036,.004,3,10),tier===4?3:0,[0,-.25+i*.045,0],3,[.01,.025]).rotation.x=Math.PI/2;
  }
  if(tier>=2)part(new THREE.CylinderGeometry(.036,.038,.035,9),tier===4?3:1,[0,.43,0],12);
  if(tier===3)part(new THREE.BoxGeometry(.13,.085,.19),1,[-.13,.55,0],20,[.03,.06]);
  models.push({model,meshes});
 }
 group.updateMatrixWorld(true);const painted=pinDabs(shared,palettes,parts);let equipped=-1;
 return {group,paint:painted,models,
  equip(tier){if(equipped===tier)return;equipped=tier;models.forEach(({model,meshes},i)=>{model.visible=i===tier;meshes.forEach(m=>m.visible=i===tier);});group.updateMatrixWorld(true);painted.update();},
 };
}
