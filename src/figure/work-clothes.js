import * as THREE from 'three';
import {pinDabs} from '../oilpaint/pins.js';

export function tint(material,palette,lower=palette) {
  for(const [i,key] of ['uL','uM','uS','uOwn'].entries()){
    material.uniforms[key].value.setRGB(...(palette[i]??palette[0]));
    material.uniforms[key+'2'].value.setRGB(...(lower[i]??lower[0]));
  }
}

export function workClothes(shared,man,paint,hatPalette,clothPalette) {
  const leather=[[.63,.43,.24],[.34,.23,.16],[.18,.15,.13]], lining=[[.90,.80,.58],[.64,.52,.34],[.33,.28,.22]];
  const palettes=[hatPalette,clothPalette,leather,lining],materials=palettes.map(p=>paint(shared,p));
  const hats=[[],[],[]],coats=[[],[],[]],parts=[],up=new THREE.Vector3(0,1,0);
  function piece(set,bone,geometry,slot,x,y,z,scale,count=45) {
    const m=new THREE.Mesh(geometry,materials[slot]);m.position.set(x,y,z);m.scale.set(...scale);
    m.layers.enable(1);m.name='work-clothing';m.userData.hatStyle=hats.indexOf(set);m.userData.coatStyle=coats.indexOf(set);m.userData.fabric=slot;man.object.add(m);man.object.updateMatrixWorld(true);bone.attach(m);
    set.push(m);parts.push({mesh:m,count,style:()=>({pal:slot,size:count>120?[.024,.055]:[.012,.031],dir:up})});return m;
  }
  const head=man.bones.Head,chest=man.bones.spine_03,hips=man.bones.pelvis;
  const lathe=points=>new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),24);
  const felt=piece(hats[0],head,lathe([[0,.15],[.09,.135],[.14,.075],[.15,0],[.23,-.035],[.35,-.085],[.37,-.07]]),0,0,1.815,-.012,[.86,.87,.86],140);
  piece(hats[0],head,new THREE.CylinderGeometry(.15,.157,.044,22,1,true),2,0,1.836,-.012,[.86,.87,.86]);
  piece(hats[1],head,lathe([[.148,-.07],[.156,0],[.151,.075],[.119,.138],[.055,.175],[0,.18]]),0,0,1.811,-.006,[.70,.71,.75],85);
  piece(hats[1],head,lathe([[.15,-.068],[.169,-.059],[.167,-.006],[.153,.001]]),0,0,1.811,-.006,[.70,.71,.75],45);
  piece(hats[2],head,lathe([[.14,-.03],[.164,.005],[.18,.065],[.135,.116],[0,.124]]),0,0,1.799,0,[.75,.80,.81],95);
  piece(hats[2],head,new THREE.SphereGeometry(1,18,8),2,0,1.785,.096,[.126,.014,.104],60);
  // Open-front gilet and a separate split leather apron follow the rig's chest and pelvis.
  for(const side of [-1,1]){
    piece(coats[1],chest,new THREE.SphereGeometry(1,14,10),1,side*.132,1.265,.071,[.126,.244,.136],100);
    for(const y of [1.16,1.25,1.34]){
      piece(coats[1],chest,new THREE.SphereGeometry(1,10,7),1,side*.128,y,.089,[.117,.06,.132],38);
    }
    piece(coats[1],chest,new THREE.SphereGeometry(1,12,8),3,side*.12,1.458,.024,[.132,.059,.128],42);
    piece(coats[2],chest,new THREE.BoxGeometry(.057,.42,.032),3,side*.094,1.34,-.127,[1,1,1]).rotateZ(side*.42);
    piece(coats[1],chest,new THREE.BoxGeometry(.10,.075,.02),2,side*.14,1.16,.183,[1,1,1]);
    piece(coats[2],chest,new THREE.BoxGeometry(.045,.32,.026),3,side*.108,1.38,.125,[1,1,1]);
    piece(coats[2],hips,new THREE.BoxGeometry(.196,.35,.047),2,side*.102,.869,.152,[1,1.18,1]);
  }
  piece(coats[1],chest,new THREE.SphereGeometry(1,14,10),1,0,1.27,-.085,[.235,.235,.085],95);
  piece(coats[2],chest,new THREE.BoxGeometry(.34,.35,.046),2,0,1.21,.164,[1,1,1],100);
  piece(coats[2],chest,new THREE.BoxGeometry(.17,.084,.018),3,.05,1.20,.196,[1,1,1]);
  const strokes=pinDabs(shared,palettes,parts);
  return {hat:felt,mesh:strokes.mesh,update:strokes.update,
    set(a,p){tint(materials[0],p.HAT);strokes.setPalette(0,p.HAT);
      const vest=p.SHIRT.map(c=>c.map((v,k)=>Math.min(.94,v*.68+[.10,.07,.035][k])));
      tint(materials[1],vest);strokes.setPalette(1,vest);
      hats.forEach((set,i)=>set.forEach(m=>m.visible=i===a.headwear));
      coats.forEach((set,i)=>set.forEach(m=>m.visible=i===a.workwear));
    }};
}
