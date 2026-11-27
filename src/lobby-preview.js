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
  shared.uSunDir.value.set(-.56,.66,.47).normalize();
  const still=new THREE.Scene(), shade=createShade(renderer,shared,still,{sun:shared.uSunDir.value,size:[128,128],box:[4,4],centre:[0,1,0]});
  const frame=createFrame(renderer,shared);frame.uniforms.uShafts.value=0;
  const figure=await createFigure(shared,undefined,characterPalettes(getAppearance()),getAppearance());
  const {man}=figure,animator=new Animator(man),axes=createAxes(shared,paint);
  const carry=new ChopAnimation(man,animator,axes.group);
  scene.add(man.object,figure.dabs,axes.group,axes.paint.mesh);
  figure.pack.setWood(camp.carried);axes.equip(camp.axe);
  const bark=paint(shared,[[.54,.40,.27],[.34,.24,.18],[.22,.16,.13]]);
  const end=paint(shared,[[.84,.67,.42],[.59,.43,.26],[.33,.27,.18]]);
  const block=new THREE.Mesh(new THREE.CylinderGeometry(.77,.85,.19,28),[bark,end,bark]);block.position.y=-.10;scene.add(block);
  for(const radius of [.30,.47,.63]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.005,3,48),bark);ring.rotation.x=Math.PI/2;ring.scale.y=.91;ring.position.set(.035,0,0);scene.add(ring);}
  let disposed=false;
  const landscape=new THREE.TextureLoader().load('./changelog/morning-mist.webp',texture=>{
    if(disposed)return;
    const src=texture.image,painted=document.createElement('canvas');painted.width=768;painted.height=Math.round(768*src.height/src.width);
    const ctx=painted.getContext('2d');ctx.filter='blur(2px) saturate(.69)';ctx.drawImage(src,-3,-3,painted.width+6,painted.height+6);
    ctx.filter='none';ctx.fillStyle='rgba(50,53,38,.22)';ctx.fillRect(0,0,painted.width,painted.height);
    texture.image=painted;texture.needsUpdate=true;resize();
  });
  landscape.colorSpace=THREE.SRGBColorSpace;scene.background=landscape;
  const size=new THREE.Vector2();
  function resize(){
    const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;
    renderer.setSize(w,h,false);frame.resize();camera.aspect=w/h;
    const aspect=landscape.image?landscape.image.width/landscape.image.height:1.5;
    landscape.repeat.set(Math.min(1,camera.aspect/aspect),Math.min(1,aspect/camera.aspect));
    landscape.offset.set((1-landscape.repeat.x)*.62,(1-landscape.repeat.y)*.52);
    camera.position.set(0,1.22,Math.max(5.55,2.45/camera.aspect));
    camera.lookAt(0,.94,0);camera.updateProjectionMatrix();
    shared.uPixel.value=2*Math.tan(Math.PI/12)/renderer.getDrawingBufferSize(size).y;
  }
  element.append(renderer.domElement);const observer=new ResizeObserver(resize);observer.observe(element);resize();
  let angle=.40,last=0,selection='';
  const turn=(dir)=>angle+=dir*Math.PI/3;
  document.getElementById('turn-character').onclick=()=>turn(1);
  document.getElementById('turn-back').onclick=()=>turn(-1);
  renderer.setAnimationLoop(time=>{
    if(document.hidden||element.clientWidth===0)return;
    const dt=Math.min(.05,(time-last)/1000);last=time;
    const a=getAppearance(),key=JSON.stringify(a);if(key!==selection){figure.setAppearance(a);selection=key;}
    man.object.rotation.y=THREE.MathUtils.damp(man.object.rotation.y,angle,8,dt);
    animator.update(dt,{speed:0,moveAngle:0,grounded:true});animator.relaxHands(0);
    animator.uprightTrunk(dt,0,1);animator.armClearance(dt);
    man.object.updateMatrixWorld(true);carry.update(dt,null,camp.axe);axes.paint.update();figure.update(dt);shared.uTime.value+=dt;
    shade.update(scene,man.object.position);frame.render(scene,camera);
  });
  return ()=>{disposed=true;renderer.setAnimationLoop(null);observer.disconnect();animator.mixer.stopAllAction();
    if(element.contains(renderer.domElement)){document.getElementById('turn-character').onclick=null;document.getElementById('turn-back').onclick=null;}
    const geometry=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)for(const m of [].concat(o.material))materials.add(m);});
    geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());landscape.dispose();shade.dispose();frame.dispose();
    for(const key of ['tHeight','tLand','tNoise','tBrush'])shared[key].value.dispose();
    renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
}
