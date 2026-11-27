import * as THREE from 'three';
import {createFigure,paint} from './figure/figure.js';
import {Animator} from './figure/animator.js';
import {ChopAnimation} from './figure/chop.js';
import {createAxes} from './figure/axes.js';
import {characterPalettes} from './appearance.js';
import {createBrushSheet,createFrame,createShade,createShared} from './oilpaint/index.js';

export async function createLobbyPreview(element,getAppearance,camp) {
  const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'low-power'});
  renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(30,1,.05,35);
  const shared=createShared();shared.tBrush.value.dispose();shared.tBrush.value=createBrushSheet();
  shared.uSunDir.value.set(-.78,.76,.20).normalize();
  shared.uOvercast.value=.16;shared.uHazeDensity.value=.002;shared.uBounce.value.setRGB(.05,.04,.025);
  const still=new THREE.Scene(), shade=createShade(renderer,shared,still,{sun:shared.uSunDir.value,size:[128,128],box:[4,4],centre:[0,1,0]});
  const frame=createFrame(renderer,shared);frame.uniforms.uShafts.value=0;
  const figure=await createFigure(shared,undefined,characterPalettes(getAppearance()),getAppearance());
  const {man}=figure,animator=new Animator(man),axes=createAxes(shared,paint);
  const carry=new ChopAnimation(man,animator,axes.group);
  scene.add(man.object,figure.dabs,axes.group,axes.paint.mesh);
  figure.pack.setWood(camp.carried);figure.pack.setPatches(camp.places);axes.equip(camp.axe);
  const bark=paint(shared,[[.54,.40,.27],[.34,.24,.18],[.22,.16,.13]],{material:'bark'});
  const end=paint(shared,[[.80,.64,.43],[.56,.43,.30],[.33,.27,.21]],{material:'endgrain'});
  const stock=new THREE.CylinderGeometry(.68,.74,.16,32,2),p=stock.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x),k=1.+.023*Math.sin(3*a)+.013*Math.cos(7*a+.3);
    p.setXYZ(i,x*k,p.getY(i),z*k*.91);
  }
  stock.computeVertexNormals();
  const block=new THREE.Mesh(stock,[bark,end,bark]);block.position.y=-.082;scene.add(block);
  let disposed=false,firelight=false,detail=false,focus='cloth',zoom=0,wideDistance=5.1;
  const size=new THREE.Vector2(),loader=new THREE.TextureLoader();
  // Real, empty views across the same clearing at two hours of the day.
  const landscapes=['day','night'].map(name=>loader.load('./pennant/outfitter-'+name+'.webp',()=>{if(!disposed)resize();}));
  scene.background=landscapes[0];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function frameFigure(){
    const face=focus==='face',bag=focus==='pack';
    const near=Math.max(face?1.43:bag?2.08:2.25,(face?.67:1.10)/camera.aspect);
    camera.position.set(0,THREE.MathUtils.lerp(1.23,face?1.72:1.54,zoom),THREE.MathUtils.lerp(wideDistance,near,zoom));
    camera.lookAt(0,THREE.MathUtils.lerp(.94,face?1.67:bag?1.24:1.40,zoom),0);
  }
  function resize(){
    const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;
    renderer.setSize(w,h,false);frame.resize();camera.aspect=w/h;
    for(const landscape of landscapes){
      const aspect=landscape.image?landscape.image.width/landscape.image.height:2.07;
      landscape.repeat.set(Math.min(1,camera.aspect/aspect),Math.min(1,aspect/camera.aspect));
      landscape.offset.set((1-landscape.repeat.x)*.57,(1-landscape.repeat.y)*.52);
    }
    wideDistance=Math.max(5.10,3.75/camera.aspect);frameFigure();camera.updateProjectionMatrix();
    shared.uPixel.value=2*Math.tan(Math.PI/12)/renderer.getDrawingBufferSize(size).y;
  }
  element.append(renderer.domElement);const observer=new ResizeObserver(resize);observer.observe(element);resize();
  let angle=-.62,last=0,selection='';
  const turn=(dir)=>angle+=dir*Math.PI/3;
  const forward=()=>turn(1),back=()=>turn(-1);
  const key=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();turn(e.key==='ArrowRight'?1:-1);}};
  const next=document.getElementById('turn-character'),previous=document.getElementById('turn-back');
  const framing=document.getElementById('preview-framing');
  const setFrame=()=>{framing.setAttribute('aria-pressed',String(detail));};
  const toggleFrame=()=>{detail=!detail;setFrame();};framing.onclick=toggleFrame;setFrame();
  const lamp=document.getElementById('preview-light'),outfitter=document.getElementById('outfitter');
  function useLight(){
    lamp.setAttribute('aria-pressed',String(firelight));scene.background=landscapes[Number(firelight)];
    shared.uDaylight.value=firelight?0:1;shared.uNight.value=firelight?1:0;shared.uOvercast.value=firelight?.06:.12;
    shared.uHaze.value.setRGB(...(firelight?[.035,.055,.10]:[.61,.58,.58]));
  }
  const toggleLight=()=>{firelight=!firelight;useLight();
    if(!reduced.matches)element.animate([{opacity:.76},{opacity:1}],{duration:180});};
  lamp.onclick=toggleLight;useLight();
  function frameChoice(which){
    if(['face','beard','skin','hair','hat','headwear'].includes(which)){focus='face';detail=true;angle=-.27;}
    else if(which==='pack'){focus='pack';detail=true;angle=Math.PI-.45;}
    else if(which==='kit'||which==='colour'||which==='workwear'||which==='shirt'){focus='cloth';detail=false;angle=-.48;}
    setFrame();
  }
  const chooseDye=e=>{if(e.target.matches('input[type=radio]'))frameChoice(e.target.name);};
  const chooseTab=e=>{const b=e.target.closest('[data-tab]');if(b)frameChoice(b.dataset.tab);};
  outfitter.addEventListener('change',chooseDye);outfitter.addEventListener('click',chooseTab);
  frameChoice(outfitter.querySelector('[data-tab][aria-pressed=true]')?.dataset.tab);
  next.onclick=forward;previous.onclick=back;element.addEventListener('keydown',key);
  renderer.setAnimationLoop(time=>{
    if(document.hidden||element.clientWidth===0)return;
    const dt=Math.min(.05,(time-last)/1000);last=time;
    const a=getAppearance(),key=JSON.stringify(a);if(key!==selection){figure.setAppearance(a);selection=key;}
    zoom=reduced.matches?Number(detail):THREE.MathUtils.damp(zoom,Number(detail),9,dt);frameFigure();
    const yaw=man.object.rotation.y,turn=Math.atan2(Math.sin(angle-yaw),Math.cos(angle-yaw));
    man.object.rotation.y=reduced.matches?angle:yaw+turn*(1.-Math.exp(-8*dt));
    const t=shared.uTime.value,fire=firelight?3.55*(.87+.08*Math.sin(t*7.7)+.05*Math.sin(t*17.3)):0;
    shared.uCampLights.value[4].set(1.53,.68,1.20,fire);
    animator.update(dt,{speed:0,moveAngle:0,grounded:true});animator.relaxHands(0);
    animator.uprightTrunk(dt,0,1);animator.armClearance(dt);
    man.object.updateMatrixWorld(true);carry.update(dt,null,camp.axe,null,[],{weight:camp.axeStowed?1:0,loop:figure.pack.axeLoop});axes.paint.update();figure.update(dt);shared.uTime.value+=dt;
    shade.update(scene,man.object.position);frame.render(scene,camera);
  });
  return ()=>{disposed=true;renderer.setAnimationLoop(null);observer.disconnect();animator.mixer.stopAllAction();
    element.removeEventListener('keydown',key);if(next.onclick===forward)next.onclick=null;if(previous.onclick===back)previous.onclick=null;
    const geometry=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)for(const m of [].concat(o.material))materials.add(m);});
    outfitter.removeEventListener('change',chooseDye);outfitter.removeEventListener('click',chooseTab);
    if(framing.onclick===toggleFrame)framing.onclick=null;if(lamp.onclick===toggleLight)lamp.onclick=null;
    geometry.forEach(g=>{if(!man.geometry.has(g))g.dispose();});materials.forEach(m=>{if(!man.materials.has(m))m.dispose();});figure.pack.disposePatches();
    new Set(man.meshes.map(m=>m.skeleton)).forEach(s=>s.dispose());landscapes.forEach(t=>t.dispose());shade.dispose();frame.dispose();
    for(const key of ['tHeight','tLand','tNoise','tBrush'])shared[key].value.dispose();
    renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
}
