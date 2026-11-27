import * as THREE from 'three';
import {pinDabs} from '../oilpaint/pins.js';

export function tint(material,palette,lower=palette) {
  for(const [i,key] of ['uL','uM','uS','uOwn'].entries()){
    material.uniforms[key].value.setRGB(...(palette[i]??palette[0]));
    material.uniforms[key+'2'].value.setRGB(...(lower[i]??lower[0]));
  }
}

// Take weights from neighbouring shirt vertices so a sewn panel bends with the same ribs,
// shoulders and hips as the underlying shirt through the full axe stroke.
function garmentWeights(suit){
  const {position,skinIndex,skinWeight}=suit.geometry.attributes,rows=new Map();
  for(let v=0;v<position.count;v++){
    if(Math.abs(position.getX(v))>.36)continue;
    const row=Math.floor(position.getY(v)*16);
    if(!rows.has(row))rows.set(row,[]);rows.get(row).push(v);
  }
  return geometry=>{
    const pos=geometry.attributes.position,ids=[],weights=[];
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),row=Math.floor(y*16),near=[];
      for(let j=row-1;j<=row+1;j++)for(const v of rows.get(j)||[]){
        const d=(x-position.getX(v))**2+(y-position.getY(v))**2+(z-position.getZ(v))**2;
        if(near.length===3&&d>=near[2].d)continue;
        near.push({v,d});near.sort((a,b)=>a.d-b.d);near.length=Math.min(3,near.length);
      }
      const influences=new Map();
      for(const {v,d} of near)for(let k=0;k<4;k++){
        const bone=skinIndex.getComponent(v,k),w=skinWeight.getComponent(v,k);
        if(w)influences.set(bone,(influences.get(bone)||0)+w/Math.max(.00005,d));
      }
      const sorted=[...influences].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=sorted.reduce((s,p)=>s+p[1],0);
      for(let k=0;k<4;k++){ids.push(sorted[k]?.[0]??0);weights.push(sorted[k]?sorted[k][1]/sum:0);}
    }
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));
    geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  };
}

export function workClothes(shared,man,paint,hatPalette,clothPalette) {
  const leather=[[.63,.43,.24],[.34,.23,.16],[.18,.15,.13]], lining=[[.90,.80,.58],[.64,.52,.34],[.33,.28,.22]];
  const palettes=[hatPalette,clothPalette,leather,lining,clothPalette,clothPalette];
  const finishes=['felt','cloth','leather','cloth','cloth','cloth'];
  const materials=palettes.map((p,i)=>paint(shared,p,{material:finishes[i]}));
  for(const mat of materials)mat.uniforms.uCloth.value=.85;
  const hats=[[],[],[]],coats=[[],[],[]],parts=[],up=new THREE.Vector3(0,1,0);
  let suit;man.object.traverse(o=>{if(o.isSkinnedMesh&&o.name.includes('casualsuit'))suit=o;});
  const fit=garmentWeights(suit),fabrics=palettes.map((p,i)=>paint(shared,p,{skinned:true,material:finishes[i]}));
  function piece(set,bone,geometry,slot,x,y,z,scale,count=45,tilt=0) {
    const coat=coats.indexOf(set);let m;
    if(coat>=0){
      geometry.scale(...scale);geometry.rotateZ(tilt);geometry.translate(x,y,z);fit(geometry);
      m=new THREE.SkinnedMesh(geometry,fabrics[slot]);suit.parent.add(m);m.bind(suit.skeleton,suit.bindMatrix);m.frustumCulled=false;
    }else{
      m=new THREE.Mesh(geometry,materials[slot]);m.position.set(x,y,z);m.scale.set(...scale);
      man.object.add(m);man.object.updateMatrixWorld(true);bone.attach(m);
    }
    m.layers.enable(1);m.name='work-clothing';m.userData.hatStyle=hats.indexOf(set);m.userData.coatStyle=coat;m.userData.fabric=slot;
    set.push(m);parts.push({mesh:m,count,style:()=>({pal:slot,size:count>120?[.019,.043]:[.009,.023],dir:up})});return m;
  }
  const head=man.bones.Head,chest=man.bones.spine_03,hips=man.bones.pelvis;
  const lathe=(points,ribs=0)=>{
    const g=new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),ribs?96:24);
    if(ribs){
      const p=g.attributes.position;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),z=p.getZ(i),k=1+.021*Math.cos(ribs*Math.atan2(x,z));
        p.setXYZ(i,x*k,p.getY(i),z*k);
      }
      g.computeVertexNormals();
    }
    return g;
  };
  // A rolled edge gives the brim an upper and a lower surface. Lift the front
  // off the eyes, turn up one corner and press the centre crease into the crown.
  const brim=lathe([[.146,-.005],[.208,-.022],[.305,-.052],[.340,-.060],[.350,-.055],
    [.348,-.047],[.331,-.044],[.300,-.040],[.219,-.014],[.163,.008],
    [.154,.041],[.150,.101],[.133,.143],[.104,.155],[.063,.146],[0,.127]]);
  const brimPos=brim.attributes.position;
  for(let i=0;i<brimPos.count;i++){
    const x=brimPos.getX(i),y=brimPos.getY(i),z=brimPos.getZ(i),r=Math.hypot(x,z),angle=Math.atan2(x,z);
    const edge=THREE.MathUtils.smoothstep(r,.16,.35),crown=THREE.MathUtils.smoothstep(y,.065,.15);
    const roll=edge*(.031*Math.sin(angle+.54)+.016*Math.cos(2*angle-.6)+.021*Math.cos(angle));
    const pinch=crown*Math.max(0,z/.16);
    brimPos.setXYZ(i,x*(1.-.105*pinch),y+roll-.019*crown*Math.exp(-((x/.041)**2)),z*(1.045-.09*edge)+.004*crown);
  }
  brim.computeVertexNormals();
  const felt=piece(hats[0],head,brim,0,0,1.815,-.012,[.68,.74,.73],102);
  piece(hats[0],head,lathe([[.158,.002],[.160,.006],[.155,.039],[.152,.042]]),2,0,1.819,-.011,[.68,.74,.76],18);
  piece(hats[0],head,new THREE.BoxGeometry(.014,.030,.040),3,-.104,1.837,-.027,[.84,.80,.84],2);
  piece(hats[1],head,lathe([[.148,-.07],[.156,0],[.151,.075],[.119,.138],[.055,.175],[0,.18]]),0,0,1.805,-.006,[.575,.54,.66],68);
  piece(hats[1],head,lathe([[.15,-.068],[.169,-.059],[.167,-.006],[.153,.001]],24),0,0,1.805,-.006,[.575,.54,.66],28);
  const rail=lathe([[.141,-.032],[.151,-.024],[.154,.001],[.173,.031],[.170,.064],[.142,.096],[.081,.122],[0,.128]]);
  const crown=rail.attributes.position;
  for(let i=0;i<crown.count;i++){
    const x=crown.getX(i),y=crown.getY(i),z=crown.getZ(i),lift=THREE.MathUtils.smoothstep(y,-.013,.12);
    crown.setXYZ(i,x*(1.+.020*Math.sin(5*Math.atan2(x,z))*lift),y-.16*z*lift,z+.024*lift);
  }
  rail.computeVertexNormals();
  piece(hats[2],head,rail,0,0,1.799,-.005,[.596,.59,.68],66);
  const peak=new THREE.SphereGeometry(1,20,8),peakPos=peak.attributes.position;
  for(let i=0;i<peakPos.count;i++){
    const x=peakPos.getX(i),y=peakPos.getY(i),z=peakPos.getZ(i);
    peakPos.setXYZ(i,x*(1.-.16*Math.max(z,0)),y*.58-.43*x*x-.34*z,z);
  }
  peak.computeVertexNormals();
  piece(hats[2],head,peak,2,0,1.787,.087,[.102,.015,.092],24);
  piece(hats[2],head,new THREE.SphereGeometry(1,10,5),0,0,1.876,.009,[.010,.006,.010],1);
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

  // Fit the collar, pocket and placket to the actual front of the shirt. Their
  // flat pattern is expressed in metres across and up the original garment.
  const body=suit.geometry.attributes.position,idx=suit.geometry.index,frontFaces=[];
  const vertex=i=>new THREE.Vector3().fromBufferAttribute(body,idx?idx.getX(i):i);
  for(let i=0;i<(idx?.count??body.count);i+=3){
    const a=vertex(i),b=vertex(i+1),c=vertex(i+2);
    if(Math.max(a.y,b.y,c.y)<1.02||Math.min(a.y,b.y,c.y)>1.59||Math.max(a.z,b.z,c.z)<.03)continue;
    const ab=b.sub(a),ac=c.sub(a),det=ab.x*ac.y-ab.y*ac.x;
    if(Math.abs(det)>.0000001)frontFaces.push({a,ab,ac,det});
  }
  function shirtFront(x,y){
    let z=.035;
    for(const {a,ab,ac,det} of frontFaces){
      const dx=x-a.x,dy=y-a.y,v=(dx*ac.y-dy*ac.x)/det,w=(ab.x*dy-ab.y*dx)/det;
      if(v>=-.0001&&w>=-.0001&&v+w<=1.0001)z=Math.max(z,a.z+v*ab.z+w*ac.z);
    }
    return z;
  }
  const shirt=(rows,cols,pattern,slot,count)=>sew(coats[0],chest,panel(rows,cols,(j,u)=>{
    const [x,y,lift]=pattern(j,u);return [x,y,shirtFront(x,y)+lift];
  }),slot,count);
  // Make the two pointed collar leaves and a folded button stand.
  for(const s of [-1,1]){
    const rows=[[.013,1.495,.034,1.468],[.031,1.529,.111,1.491],[.046,1.552,.102,1.536]];
    shirt(3,5,(j,u)=>{const [xi,yi,xo,yo]=rows[j],t=s>0?u:1-u;
      return [s*THREE.MathUtils.lerp(xi,xo,t),THREE.MathUtils.lerp(yi,yo,t),.010+.007*Math.sin(t*Math.PI)];
    },4,12);
  }
  shirt(13,2,(j,u)=>[(u-.5)*.021,1.038+j*.038,.005+.003*u],4,11);
  for(const y of [1.12,1.242,1.367,1.466]){
    piece(coats[0],chest,new THREE.SphereGeometry(1,8,5),2,0,y,shirtFront(0,y)+.011,[.008,.008,.0034],0);
  }
  shirt(3,8,(j,u)=>[.090+(u-.5)*[.071,.096,.100][j],[1.294,1.312,1.379][j]+.003*u,.008],4,14);
  shirt(2,8,(j,u)=>[.090+(u-.5)*.102,1.368+j*.014+.003*u,.012],5,4);
  // Cut the vest from the shirt's own rigged surface, with a little loft between the quilt lines.
  const vestGeo=suit.geometry.clone(),vp=vestGeo.attributes.position,vn=vestGeo.attributes.normal;
  const sourceIndex=vestGeo.index,indices=[];
  for(let i=0;i<(sourceIndex?.count??vp.count);i+=3){
    const face=[0,1,2].map(k=>sourceIndex?sourceIndex.getX(i+k):i+k);
    if(face.some(v=>vp.getY(v)>.975&&vp.getY(v)<1.61&&Math.abs(vp.getX(v))<.28))indices.push(...face);
  }
  vestGeo.setIndex(indices);
  for(let i=0;i<vp.count;i++){
    const y=vp.getY(i),loft=.012+.010*(.5-.5*Math.cos((y-1.041)*Math.PI*24));
    vp.setXYZ(i,vp.getX(i)+loft*vn.getX(i),y+loft*vn.getY(i),vp.getZ(i)+loft*vn.getZ(i));
  }
  const quilt=paint(shared,clothPalette,{skinned:true,quilted:true,material:'cloth'}),vest=new THREE.SkinnedMesh(vestGeo,quilt);
  suit.parent.add(vest);vest.bind(suit.skeleton,suit.bindMatrix);vest.frustumCulled=false;vest.layers.enable(1);
  vest.name='work-clothing';Object.assign(vest.userData,{hatStyle:-1,coatStyle:1,fabric:1});coats[1].push(vest);
  // A lined stand collar stays visible above the loaded pack.
  sew(coats[1],chest,panel(3,24,(j,u)=>{
    const a=.66+u*(Math.PI*2-1.32),r=[.116,.128,.125][j];
    return [r*Math.sin(a),[1.477,1.539,1.548][j]-.025*Math.cos(a),.01+r*.84*Math.cos(a)];
  }),3,38);
  for(const side of [-1,1]){
    piece(coats[1],chest,new THREE.BoxGeometry(.073,.025,.014),2,side*.113,1.127,.178,[1,1,1],8,side*.19);
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
  piece(coats[2],hips,new THREE.BoxGeometry(.035,.18,.018),3,-.209,.965,-.025,[1,1,1],10,-.21);
  sew(coats[2],chest,panel(3,6,(j,u)=>[(u-.5)*[.098,.142,.144][j]+.030,[1.129,1.145,1.231][j],.212-.019*(u-.25)**2]),2,20);
  sew(coats[2],chest,panel(2,6,(j,u)=>[(u-.5)*.145+.030,1.223+j*.010,.214-.019*(u-.25)**2]),3,6);
  const strokes=pinDabs(shared,palettes,parts,{surface:true});
  return {hat:felt,headwear:hats.map(set=>set[0]),mesh:strokes.mesh,update:strokes.update,
    set(a,p){tint(materials[0],p.HAT);strokes.setPalette(0,p.HAT);
      const waxed=[[.79,.66,.45],[.50,.385,.24],[.25,.205,.16]];
      const vest=p.SHIRT.map((c,i)=>c.map((v,k)=>waxed[i][k]*.70+v*.30));
      const shirtShade=p.SHIRT.map(c=>c.map((v,k)=>v*[.87,.88,.90][k]));
      const shirtEdge=p.SHIRT.map(c=>c.map((v,k)=>v*.91+[.077,.063,.039][k]));
      tint(fabrics[4],shirtShade);tint(fabrics[5],shirtEdge);
      strokes.setPalette(4,shirtShade);strokes.setPalette(5,shirtEdge);
      tint(fabrics[1],vest);tint(quilt,vest);strokes.setPalette(1,vest);
      hats.forEach((set,i)=>set.forEach(m=>m.visible=i===a.headwear));
      coats.forEach((set,i)=>set.forEach(m=>m.visible=i===a.workwear));
    }};
}
