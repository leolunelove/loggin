import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {dressTimber} from './timber.js';

// Small furnishings share batches by material and building stage. The room can
// disappear behind its roof without drawing every jar, nail and book separately.
export function furnishCabin(part){
  const batches=new Map(),stages={always:[],cot:[],porch:[],lodge:[]};
  let stage='always';
  function place(geo,ink,x,y,z,rotation=[0,0,0]){
    if(ink<2)dressTimber(geo,[x,y,z]);
    geo.rotateX(rotation[0]);geo.rotateY(rotation[1]);geo.rotateZ(rotation[2]);geo.translate(x,y,z);
    const key=stage+'/'+ink;if(!batches.has(key))batches.set(key,[]);
    batches.get(key).push(geo.index?geo.toNonIndexed():geo);
  }
  const box=(ink,w,h,d,x,y,z,rot)=>place(new THREE.BoxGeometry(w,h,d),ink,x,y,z,rot);
  const pot=(ink,top,bottom,height,x,y,z)=>place(new THREE.CylinderGeometry(top,bottom,height,12),ink,x,y,z);
  function thread(ink,points,r){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    place(new THREE.TubeGeometry(curve,Math.max(5,points.length*3),r,5,false),ink,0,0,0);
  }
  function book(ink,x,y,z,w,d,h){
    box(ink,w+.014,.014,d+.018,x,y,z);box(7,w,h,d,x,y+h*.5+.007,z);
    box(ink,w+.014,.014,d+.018,x,y+h+.012,z);box(ink,.018,h+.016,d+.01,x-w/2,y+h*.5+.008,z);
  }
  // Floorboards have staggered joints and paired square nails at the joists.
  function boards(back,front,top){
    for(let i=0;i<10;i++){
      const x=-1.58+.35*i,joint=back+(front-back)*(.29+.37*((i*3)%7)/6);
      for(const [z0,z1] of [[back,joint],[joint,front]]){
        box(i%4===1?1:0,.344,.012,z1-z0-.012,x,top-.006,(z0+z1)/2);
        for(const dx of [-.11,.11])box(3,.014,.003,.023,x+dx,top+.002,z0+.048);
      }
    }
  }
  function sash(x,z){
    box(1,.62,.67,.032,x,1.62,z);box(7,.53,.575,.018,x,1.62,z+.022);
    for(const sx of [-1,1])for(const sy of [-1,1])box(10,.225,.246,.012,x+sx*.126,1.625+sy*.134,z+.039);
    box(0,.68,.055,.14,x,1.302,z+.040);
    for(const sx of [-1,1])box(9,.070,.525,.046,x+sx*.268,1.62,z+.06);
  }
  boards(-1.32,1.43,.119);
  // Bunches of drying herbs tied above the tools, clear of the player's head.
  for(let k=0;k<3;k++){
    const z=.12+k*.19;thread(4,[[-1.58,1.90,z],[-1.57,1.80,z+.01],[-1.54,1.69,z]],.005);
    for(let i=0;i<4;i++)place(new THREE.IcosahedronGeometry(1,0).scale(.018,.048,.021),9,-1.54,1.66+.018*(i%2),z+(i-1.5)*.020,[0,0,(i-1.5)*.21]);
  }
  // Desk just inside the door: splayed legs, an open stitched ledger, ink and a pencil.
  box(0,.78,.075,.48,1.22,.88,.91);
  for(const x of [.94,1.5])for(const z of [.75,1.075])box(1,.065,.76,.065,x,.48,z);
  box(1,.61,.063,.052,1.22,.32,1.06);box(1,.65,.11,.05,1.22,.80,1.08);
  box(8,.42,.024,.285,1.14,.932,.89);
  for(const s of [-1,1]){
    box(7,.191,.028,.254,1.14+s*.098,.955,.89,[0,0,-s*.045]);
    for(let k=0;k<5;k++)box(3,.10+.026*Math.cos(k),.002,.004,1.14+s*.104,.973,.82+k*.028,[0,0,-s*.04]);
  }
  box(8,.014,.005,.20,1.17,.974,.97);pot(3,.033,.044,.062,1.49,.95,.93);pot(4,.031,.034,.014,1.49,.987,.93);
  box(4,.14,.012,.012,1.39,.932,.79,[0,.55,0]);
  // A vice and plane share the workbench with a sharpened wedge and two curls of wood.
  box(6,.13,.18,.11,-1.00,.80,-.44);box(1,.16,.055,.052,-.945,.84,-.44);
  box(1,.175,.052,.079,-1.39,.909,-.34);box(6,.045,.061,.063,-1.40,.944,-.34,[0,0,.31]);
  thread(1,[[-1.458,.94,-.34],[-1.452,1.004,-.34],[-1.415,.983,-.34]],.012);
  for(const [x,z] of [[-1.15,-.52],[-1.24,-.41]])thread(4,[[x,.887,z],[x+.032,.918,z+.010],[x+.010,.932,z+.023],[x-.015,.909,z+.019]],.005);
  thread(9,[[-1.485,.902,-.67],[-1.436,.905,-.62],[-1.41,.907,-.64],[-1.36,.906,-.58],[-1.28,.904,-.55]],.004);
  // Tool rail with individual pegs, a hanging bow saw, oil cans and a coil of line.
  box(1,.047,.095,1.72,-1.68,1.80,-.1);
  for(let i=0;i<6;i++)box(4,.102,.027,.029,-1.62,1.83,-.75+i*.254);
  const blade=[[-1.60,1.76,.54],[-1.60,1.47,.74],[-1.60,1.46,.25],[-1.60,1.77,.37]];
  thread(1,blade,.019);thread(6,[blade[1],blade[2]],.011);
  for(let j=0;j<3;j++)place(new THREE.TorusGeometry(.081+.013*j,.011,5,18),4,-1.59,1.65,.04,[0,Math.PI/2,0]);
  for(const [i,ink] of [9,8,7].entries()){
    const x=1.22+i*.15;pot(ink,.056,.047,.15,x,1.112,.29);pot(1,.059,.059,.022,x,1.197,.29);
  }
  // A banded kindling pail tucked under the end of the shelf.
  pot(1,.149,.118,.32,1.33,.31,.56);
  for(const y of [.215,.415])pot(6,.142,.141,.019,1.33,y,.56);
  for(let i=0;i<6;i++)box(i%2?4:0,.045,.30+i%3*.06,.042,1.24+.033*i,.50,.53+.063*(i%2),[.11*i,0,(i-2)*.11]);
  // The short woven doormat sits flush below the threshold.
  box(9,.93,.015,.44,-.475,.125,1.12);
  for(const z of [.956,.986,1.255,1.285])box(7,.89,.003,.013,-.475,.135,z);
  for(let i=0;i<6;i++)box(4,.069,.004,.069,-.81+i*.138,.136,1.12,[0,Math.PI/4,0]);
  // A blue enamel tea pot sits on the top shelf, with its arched handle and lid knob.
  pot(9,.093,.115,.17,1.37,1.675,.36);pot(7,.090,.105,.018,1.37,1.766,.36);
  pot(1,.021,.028,.025,1.37,1.787,.36);
  thread(6,[[1.27,1.69,.36],[1.25,1.83,.36],[1.34,1.88,.36],[1.45,1.84,.36],[1.47,1.69,.36]],.010);
  thread(9,[[1.39,1.65,.46],[1.39,1.67,.50],[1.39,1.73,.51],[1.39,1.75,.54]],.023);
  pot(7,.042,.033,.068,1.55,1.617,.38);pot(1,.036,.036,.003,1.55,1.652,.38);
  pot(1,.069,.069,.004,-1.39,1.014,.12);
  // A handwoven porch rug. The two rows of broken chevrons follow the floorboards.
  stage='porch';
  box(8,1.205,.006,1.35,-.22,.135,.16);
  for(const x of [-.775,.335])box(4,.018,.004,1.27,x,.141,.16);
  for(const end of [-1,1]){
    for(const [offset,width,ink] of [[.535,.084,9],[.595,.023,7],[.483,.017,4]])
      box(ink,1.10,.005,width,-.22,.141,.16+end*offset);
    for(let k=0;k<12;k++)box(7,.033,.006,.052,-.735+k*.094,.135,.16+end*.691);
  }
  for(let row=-1;row<=1;row++)for(let i=0;i<5;i++){
    const x=-.64+i*.21,z=.16+row*.267;
    for(const sign of [-1,1])box(row===0?7:4,.087,.005,.026,x+sign*.039,.144,z,[0,sign*.62,0]);
    if(row===0)box(9,.062,.006,.062,x,.145,z+.072,[0,Math.PI/4,0]);
  }
  stage='cot';sash(-1.23,-1.321);
  for(let k=0;k<6;k++)box(k%2?8:9,.128,.008,.58,-.095+k*.142,.447,-.94);
  for(const z of [-1.154,-1.12,-.758,-.725])box(4,.91,.006,.011,.25,.453,z);
  for(let k=0;k<6;k++)box(7,.039,.006,.039,-.09+k*.14,.454,-.94,[0,Math.PI/4,0]);
  for(const x of [.035,.09,.38,.435])box(9,.025,.006,.55,x,.446,-.94);
  for(let i=0;i<9;i++)box(7,.057,.009,.024,.69,.439,-1.18+i*.062,[0,0,-.14]);
  stage='lodge';boards(-3.98,-1.34,.193);sash(.99,-4.010);
  for(let r=0;r<5;r++)for(let c=0;c<4;c++){
    const x=.62+c*.219,z=-2.98+r*.205;
    box([8,9,7,9,8][(c+r*2)%5],.212,.007,.198,x,.53,z);
    if((r+c)%2===0)box(4,.056,.004,.056,x,.536,z,[0,Math.PI/4,0]);
  }
  for(const z of [-2.22,-2.28,-2.84,-2.91])box(9,.87,.008,.023,.95,.529,z);
  for(let i=0;i<8;i++)box(7,.028,.009,.075,.59+i*.1,.522,-2.05,[.16,0,0]);
  box(0,.73,.06,.32,-1.25,1.10,-3.71);box(0,.73,.06,.32,-1.25,1.52,-3.71);
  for(let i=0;i<7;i++){
    const ht=.19+.07*Math.abs(Math.sin(i*2.2)),x=-1.53+i*.08;
    box([8,9,1,7][i%4],.062,ht,.18,x,1.13+ht/2,-3.70,[0,0,.025*Math.cos(i)]);
    box(4,.048,.009,.007,x,1.19,-3.606);
  }
  // A small brass reading lamp lights the quilt and shelves when the back room opens.
  pot(6,.085,.105,.041,-1.12,.682,-3.44);pot(4,.074,.088,.097,-1.12,.745,-3.44);
  pot(6,.042,.058,.035,-1.12,.809,-3.44);pot(5,.030,.046,.123,-1.12,.88,-3.44);
  book(9,-1.26,.67,-3.29,.35,.25,.047);book(8,-1.23,.74,-3.26,.30,.21,.039);
  pot(7,.049,.069,.18,-1.42,1.64,-3.70);
  thread(1,[[-1.42,1.72,-3.70],[-1.44,1.82,-3.69],[-1.51,1.90,-3.70]],.008);
  for(const [key,geos] of batches){
    const [stageName,ink]=key.split('/'),g=mergeGeometries(geos);
    const mesh=part(g,Number(ink),[0,0,0],Math.min(32,geos.length*3),[.012,.035]);
    mesh.name='Shack furnishings · '+stageName;mesh.userData.roomDetail=true;mesh.userData.glass=Number(ink)===10;stages[stageName].push(mesh);
    if(stageName==='lodge')mesh.visible=false;
    geos.forEach(geo=>geo.dispose());
  }
  return stages;
}
