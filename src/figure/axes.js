import * as THREE from 'three';
import {pinDabs} from '../oilpaint/pins.js';
import {AXE_PROFILES,HAFT_RINGS,haftAt,headPoint,headStock,ringPoints} from './axe-shape.js';
export {AXE_PROFILES} from './axe-shape.js';

const LEATHER=[[.43,.32,.21],[.24,.17,.13],[.12,.10,.085]];
const BRASS=[[.81,.65,.36],[.48,.35,.18],[.23,.18,.12]];
const HONE=[[.96,.94,.82],[.72,.75,.69],[.45,.50,.49]];
const GRAIN=[[.58,.39,.22],[.33,.23,.15],[.17,.14,.115]];
const up=new THREE.Vector3(0,1,0),across=new THREE.Vector3(1,.12,0);

export function axeIcon(tier){
  const points=(AXE_PROFILES[tier]||AXE_PROFILES[0]).points.map(([x,y])=>headPoint(tier||0,x,y));
  return `<svg viewBox="0 0 74 86" class="tool-art" aria-hidden="true"><g transform="translate(35 55) rotate(27) scale(67 -67)"><path d="M.016 -.31Q-.045 -.08 0 .22L.012 .54" fill="none" stroke="#ad8150" stroke-width=".064" stroke-linecap="round"/><path d="M${points.map(p=>p.join(' ')).join('L')}Z" fill="#a3b0a8" stroke="#dedac0" stroke-width=".012"/><path d="M${headPoint(tier,.277,.442)}Q${headPoint(tier,.34,.53)} ${headPoint(tier,.281,.635)}" fill="none" stroke="#f4e7bd" stroke-width=".015"/></g></svg>`;
}
function triangles(faces){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(faces.flat(2),3));
  geometry.computeVertexNormals();
  return geometry;
}
function ringStock(rings){
  const faces=[],rows=rings.map(ringPoints);
  for(let j=1;j<rows.length;j++)for(let i=0;i<10;i++){
    const k=(i+1)%10,a=rows[j-1],b=rows[j];
    faces.push([a[i],b[i],a[k]],[a[k],b[i],b[k]]);
  }
  for(let i=1;i<9;i++)faces.push([rows[0][0],rows[0][i],rows[0][i+1]],
    [rows.at(-1)[0],rows.at(-1)[i+1],rows.at(-1)[i]]);
  return triangles(faces);
}
function headFaces(tier){
  const finishes={forged:[],ground:[],honed:[]};
  const sides=AXE_PROFILES[tier].points.map(([x,y])=>headPoint(tier,x,y)[0]),low=Math.min(...sides),high=Math.max(...sides);
  for(const {face,back,finish} of headStock(tier)){
    const out=finishes[finish],loop=face.map(([x,y])=>new THREE.Vector2(x,y));
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(loop,[])){
      out.push([face[a],face[b],face[c]],[back[c],back[b],back[a]]);
    }
    for(let i=0;i<face.length;i++){
      const j=(i+1)%face.length;
      // Interior slice boundaries share vertices. Only the ends of the stock need caps.
      if(Math.abs(face[i][0]-face[j][0])<1e-8&&face[i][0]>low+1e-8&&face[i][0]<high-1e-8)continue;
      out.push([face[i],back[i],face[j]],[face[j],back[i],back[j]]);
    }
  }
  return finishes;
}

export function createAxes(shared,makePaint){
  const group=new THREE.Group(),parts=[],palettes=[],models=[];
  group.name='Held axe';
  for(const [tier,profile] of AXE_PROFILES.entries()){
    const model=new THREE.Group(),meshes=[];
    model.name=['hand-axe','felling-axe','steel-axe','splitting-axe','foresters-axe'][tier];group.add(model);
    const base=palettes.length;
    const ground=profile.steel.map((c,i)=>c.map((v,k)=>v*.4+HONE[i][k]*.6));
    const colours=[profile.wood,profile.steel,ground,HONE,LEATHER,BRASS,GRAIN];
    const materials=colours.map((pal,i)=>makePaint(shared,pal,{
      stock:i<4,polish:i>=1&&i<=3?[.08,.58,.94][i-1]:null,grain:i===0?6:11
    }));palettes.push(...colours);
    function part(name,geometry,index,count=0,size=[.01,.025],direction=up){
      const mesh=new THREE.Mesh(geometry,materials[index]);
      mesh.name=name;mesh.layers.enable(1);model.add(mesh);meshes.push(mesh);
      if(count)parts.push({mesh,count,style:()=>({pal:base+index,size,dir:direction})});
      return mesh;
    }
    part('Oiled haft',ringStock(HAFT_RINGS),0,76,[.009,.064]);
    for(const [finish,faces] of Object.entries(headFaces(tier))){
      if(faces.length)part(finish,triangles(faces),{forged:1,ground:2,honed:3}[finish],
        finish==='forged'?42:0,[.009,.026],across);
    }
    // A wood end and a dark driven wedge break through the eye of the steel.
    const crown=.617;
    const cap=part('End grain',new THREE.CylinderGeometry(.029,.032,.013,10),0);
    cap.position.set(0,crown,0);cap.scale.z=.71;
    const wedge=part('Eye wedge',new THREE.BoxGeometry(.041,.006,.007),tier>1?5:6);
    wedge.position.set(.002,crown+.007,0);wedge.rotation.y=.24;
    if(profile.wrap){
      const start=-.250,end=start+profile.wrap,rows=Array.from({length:6},(_,i)=>{
        const y=start+(end-start)*i/5,[x,rx,rz]=haftAt(y);return [y,x,rx+.0025,rz+.0025];
      });
      part('Leather grip',ringStock(rows),4,22,[.009,.018]);
      // One continuous wrap. The seam lies against the oval wood rather than floating in rings.
      const seam=[];
      for(let i=0;i<=64;i++){
        const t=i/64,y=start+(end-start)*t,[x,rx,rz]=haftAt(y),angle=t*Math.PI*2*(3+tier);
        seam.push(new THREE.Vector3(x+Math.cos(angle)*(rx+.003),y,Math.sin(angle)*(rz+.003)));
      }
      part('Wrap seam',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seam),64,.0019,4,false),tier===4?5:6);
    }
    if(tier>=2){
      const start=.418,end=.448,rows=[start,start+.006,end-.006,end].map(y=>{
        const [x,rx,rz]=haftAt(y);return [y,x,rx+.002,rz+.002];
      });
      part('Neck binding',ringStock(rows),tier===4?5:4);
    }
    if(tier>=1)for(const side of [-1,1]){
      const stamp=part('Maker’s diamond',new THREE.BoxGeometry(.020,.020,.0017),tier===4?5:6);
      stamp.position.set(.020,.553,side*(profile.depth*.5+.0003));stamp.rotation.z=Math.PI/4;
    }
    models.push({model,meshes});
  }
  group.updateMatrixWorld(true);
  const painted=pinDabs(shared,palettes,parts,{surface:true});let equipped=-1;
  return {group,paint:painted,models,equip(tier){
    if(equipped===tier)return;equipped=tier;
    models.forEach(({model,meshes},i)=>{model.visible=i===tier;meshes.forEach(m=>m.visible=i===tier);});
    group.updateMatrixWorld(true);painted.update();
  }};
}
