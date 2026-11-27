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
  const bark=paint(shared,[[.54,.40,.27],[.34,.24,.18],[.22,.16,.13]]);
  const end=paint(shared,[[.84,.67,.42],[.59,.43,.26],[.33,.27,.18]]);
  const block=new THREE.Mesh(new THREE.CylinderGeometry(.77,.85,.19,28),[bark,end,bark]);block.position.y=-.10;scene.add(block);
  for(const radius of [.30,.47,.63]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.005,3,48),bark);ring.rotation.x=Math.PI/2;ring.scale.y=.91;ring.position.set(.035,0,0);scene.add(ring);}
  let disposed=false;
  const landscape=new THREE.TextureLoader().load('./changelog/morning-mist.webp',texture=>{
    if(disposed)return;
    const src=texture.image,painted=document.createElement('canvas');painted.width=768;painted.height=Math.round(768*src.height/src.width);
    const ctx=painted.getContext('2d');ctx.filter='blur(2px) saturate(.69)';ctx.drawImage(src,-3,-3,painted.width+6,painted.height+6);
    ctx.filter='none';ctx.fillStyle='rgba(44,47,35,.38)';ctx.fillRect(0,0,painted.width,painted.height);
    texture.image=painted;texture.needsUpdate=true;resize();
  });
  // This backdrop is an already finished painting, in the same display palette as the figure.
  landscape.colorSpace=THREE.NoColorSpace;scene.background=landscape;
  const size=new THREE.Vector2();
  let detail=false,zoom=0,wideDistance=5.55;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function frameFigure(){
    camera.position.set(0,1.22+.46*zoom,THREE.MathUtils.lerp(wideDistance,Math.max(1.95,1.38/camera.aspect),zoom));
    camera.lookAt(0,.94+.61*zoom,0);
  }
  function resize(){
    const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;
    renderer.setSize(w,h,false);frame.resize();camera.aspect=w/h;
    const aspect=landscape.image?landscape.image.width/landscape.image.height:1.5;
    landscape.repeat.set(Math.min(1,camera.aspect/aspect),Math.min(1,aspect/camera.aspect));
    landscape.offset.set((1-landscape.repeat.x)*.62,(1-landscape.repeat.y)*.52);
    wideDistance=Math.max(5.55,4.65/camera.aspect);frameFigure();camera.updateProjectionMatrix();
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
  next.onclick=forward;previous.onclick=back;element.addEventListener('keydown',key);
  renderer.setAnimationLoop(time=>{
    if(document.hidden||element.clientWidth===0)return;
    const dt=Math.min(.05,(time-last)/1000);last=time;
    const a=getAppearance(),key=JSON.stringify(a);if(key!==selection){figure.setAppearance(a);selection=key;}
    zoom=reduced.matches?Number(detail):THREE.MathUtils.damp(zoom,Number(detail),9,dt);frameFigure();
    man.object.rotation.y=reduced.matches?angle:THREE.MathUtils.damp(man.object.rotation.y,angle,8,dt);
    animator.update(dt,{speed:0,moveAngle:0,grounded:true});animator.relaxHands(0);
    animator.uprightTrunk(dt,0,1);animator.armClearance(dt);
    man.object.updateMatrixWorld(true);carry.update(dt,null,camp.axe);axes.paint.update();figure.update(dt);shared.uTime.value+=dt;
    shade.update(scene,man.object.position);frame.render(scene,camera);
  });
  return ()=>{disposed=true;renderer.setAnimationLoop(null);observer.disconnect();animator.mixer.stopAllAction();
    element.removeEventListener('keydown',key);if(next.onclick===forward)next.onclick=null;if(previous.onclick===back)previous.onclick=null;
    const geometry=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)for(const m of [].concat(o.material))materials.add(m);});
    if(framing.onclick===toggleFrame)framing.onclick=null;
    geometry.forEach(g=>{if(!man.geometry.has(g))g.dispose();});materials.forEach(m=>{if(!man.materials.has(m))m.dispose();});figure.pack.disposePatches();
    man.meshes.forEach(m=>m.skeleton.dispose());landscape.dispose();shade.dispose();frame.dispose();
    for(const key of ['tHeight','tLand','tNoise','tBrush'])shared[key].value.dispose();
    renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
}
