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
  for(const mat of materials)mat.uniforms.uCloth.value=.85;
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
  // Sew the vest and apron around the actual width of the character's chest and hips.
  function panel(rows,columns,point){
    const vertices=[],uvs=[],indices=[];
    for(let j=0;j<rows;j++)for(let i=0;i<=columns;i++){
      const u=i/columns;vertices.push(...point(j,u));uvs.push(u,j/(rows-1));
      if(j<rows-1&&i<columns){const n=j*(columns+1)+i;indices.push(n,n+1,n+columns+1,n+1,n+columns+2,n+columns+1);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  const sew=(set,bone,geo,slot,count)=>piece(set,bone,geo,slot,0,0,0,[1,1,1],count);
  const rounded=n=>Math.sign(n)*Math.abs(n)**.82;
  const waist=[1.036,.206,.032,.160],rib=(y,w,z,d)=>[[y-.009,w-.004,z,d-.005],[y,w,z,d],[y+.045,w+.008,z,d+.010]];
  const vestRows=[waist,...rib(1.09,.199,.032,.157),...rib(1.19,.192,.032,.158),...rib(1.29,.202,.031,.160),
    [1.37,.219,.023,.161],[1.44,.229,.015,.151],[1.486,.164,.010,.115],[1.513,.109,.012,.090]];
  function vestPoint(row,u){
    const [y,w,z,d]=vestRows[row],top=THREE.MathUtils.smoothstep(y,1.32,1.51);
    const slit=.096+top*.55,angle=slit+u*(Math.PI*2-2*slit),side=Math.sin(angle),front=Math.cos(angle);
    const armhole=Math.exp(-((y-1.437)**2)/.00095)*Math.abs(side)**5*.072;
    return [w*rounded(side),y-armhole-Math.max(0,front)**3*top*.039,z+d*rounded(front)];
  }
  sew(coats[1],chest,panel(vestRows.length,32,vestPoint),1,240);
  // A lined stand collar stays visible above the loaded pack.
  sew(coats[1],chest,panel(3,24,(j,u)=>{
    const a=.66+u*(Math.PI*2-1.32),r=[.116,.128,.125][j];
    return [r*Math.sin(a),[1.477,1.539,1.548][j]-.025*Math.cos(a),.01+r*.84*Math.cos(a)];
  }),3,38);
  for(const side of [-1,1]){
    const shoulder=[[1.442,.147],[1.494,.114],[1.531,.012],[1.499,-.097],[1.448,-.131]];
    sew(coats[1],chest,panel(shoulder.length,5,(j,u)=>{
      const across=side<0?1-u:u;
      return [side*(.084+.122*across),shoulder[j][0]-.035*across,shoulder[j][1]*(1-.19*across)];
    }),2,23);
    const pocket=piece(coats[1],chest,new THREE.BoxGeometry(.073,.025,.014),2,side*.113,1.127,.178,[1,1,1],8);
    pocket.rotation.z=side*.19;
  }

  // The leather bib curves around the ribs. Each skirt panel leaves a working split
  // at the knees and wraps far enough round the hips to show in the walking view.
  sew(coats[2],chest,panel(3,12,(j,u)=>{
    const x=u*2-1;return [x*[.183,.164,.122][j],[.97,1.22,1.416][j]+.013*(1-x*x),.202-.054*x*x];
  }),2,95);
  for(const side of [-1,1]){
    const strap=[[side*.095,1.407,.172],[side*.125,1.486,.102],[side*.123,1.513,.012],
      [side*.118,1.482,-.083],[side*.090,1.40,-.129],[-side*.122,1.056,-.130]];
    sew(coats[2],chest,panel(strap.length,1,(j,u)=>[strap[j][0]+(u-.5)*.038,strap[j][1],strap[j][2]]),3,22);
    const skirt=(j,u)=>{
      const a=side*((j===0?.11:.036)+u*2.38),low=j===0;
      return [(low?.239:.209)*rounded(Math.sin(a)),[.666,.855,1.047][j]+(low?.058*Math.abs(Math.sin(a)):0),
        .026+(low?.159:.170)*rounded(Math.cos(a))];
    };
    sew(coats[2],hips,panel(3,18,(j,u)=>skirt(j,side===1?u:1-u)),2,95);
    piece(coats[2],chest,new THREE.SphereGeometry(1,8,6),3,side*.093,1.392,.188,[.012,.012,.008],4);
  }
  sew(coats[2],hips,panel(2,28,(j,u)=>{
    const a=u*Math.PI*2;return [.221*rounded(Math.sin(a)),1.007+j*.058,.031+.184*rounded(Math.cos(a))];
  }),1,33);
  const tie=piece(coats[2],hips,new THREE.BoxGeometry(.035,.18,.018),3,-.209,.965,-.025,[1,1,1],10);tie.rotation.z=-.21;
  sew(coats[2],chest,panel(3,6,(j,u)=>[(u-.5)*[.098,.142,.144][j]+.030,[1.129,1.145,1.231][j],.212-.019*(u-.25)**2]),2,20);
  sew(coats[2],chest,panel(2,6,(j,u)=>[(u-.5)*.145+.030,1.223+j*.010,.214-.019*(u-.25)**2]),3,6);
  const strokes=pinDabs(shared,palettes,parts);
  return {hat:felt,mesh:strokes.mesh,update:strokes.update,
    set(a,p){tint(materials[0],p.HAT);strokes.setPalette(0,p.HAT);
      const waxed=[[.79,.66,.45],[.50,.385,.24],[.25,.205,.16]];
      const vest=p.SHIRT.map((c,i)=>c.map((v,k)=>waxed[i][k]*.70+v*.30));
      tint(materials[1],vest);strokes.setPalette(1,vest);
      hats.forEach((set,i)=>set.forEach(m=>m.visible=i===a.headwear));
      coats.forEach((set,i)=>set.forEach(m=>m.visible=i===a.workwear));
    }};
}
