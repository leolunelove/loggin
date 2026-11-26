import * as THREE from 'three';
import {loadMan} from './figure/man.js';
import {Animator} from './figure/animator.js';
import {OUTFITS,sanitizeAppearance} from './appearance.js';
export async function createLobbyPreview(element,getAppearance){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));element.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.1,30);camera.position.set(2,1.6,4.5);camera.lookAt(0,1,0);
 scene.add(new THREE.HemisphereLight(0xffebc3,0x283a32,2.5));const sun=new THREE.DirectionalLight(0xffefd0,3);sun.position.set(3,5,4);scene.add(sun);
 const man=await loadMan({base:'./figure/'}),animator=new Animator(man);scene.add(man.object);
 const hat=new THREE.Mesh(new THREE.CylinderGeometry(.14,.18,.18,18),new THREE.MeshStandardMaterial());hat.position.set(0,1.87,0);
 const brim=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.025,24),hat.material);brim.position.y=-.1;hat.add(brim);man.object.add(hat);man.object.updateMatrixWorld(true);man.bones.Head.attach(hat);
 const pack=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshStandardMaterial());pack.scale.set(.28,.37,.19);pack.position.set(0,1.08,-.3);man.object.add(pack);man.object.updateMatrixWorld(true);man.bones.spine_03.attach(pack);
 const cloth=new THREE.MeshStandardMaterial({roughness:1}),skin=new THREE.MeshStandardMaterial({roughness:1}),hair=new THREE.MeshStandardMaterial({roughness:1}),boot=new THREE.MeshStandardMaterial({color:0x38281e,roughness:1});
 cloth.onBeforeCompile=shader=>{shader.vertexShader='varying float vOutfitY;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOutfitY=position.y;');shader.fragmentShader='varying float vOutfitY;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(vOutfitY<.98)diffuseColor.rgb=vec3(.36,.25,.20);');};
 man.meshes.forEach(m=>{const n=m.name+' '+m.material?.name;if(/eyebrow|eyelash/.test(n)){m.visible=false;return;}m.material=/casualsuit/.test(n)?cloth:/short01/.test(n)?hair:/shoes/.test(n)?boot:skin;});
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(.65,32),new THREE.MeshBasicMaterial({color:0x141d17,transparent:true,opacity:.4}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.005;scene.add(shadow);
 let angle=.1,last=performance.now();
 const resize=()=>{const w=element.clientWidth,h=element.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};resize();const observer=new ResizeObserver(resize);observer.observe(element);
 function recolor(){const a=sanitizeAppearance(getAppearance());for(const [key,material] of [['shirt',cloth],['skin',skin],['hair',hair],['hat',hat.material],['pack',pack.material]])material.color.setRGB(...OUTFITS[key][a[key]][1]);}
 const rotate=document.getElementById('turn-character');rotate.onclick=()=>angle+=Math.PI/2;
 renderer.setAnimationLoop(()=>{const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;recolor();animator.update(dt,{speed:0,moveAngle:0,grounded:true});animator.relaxHands(0);man.object.rotation.y+=(angle-man.object.rotation.y)*Math.min(1,dt*8);renderer.render(scene,camera);});
 return ()=>{renderer.setAnimationLoop(null);observer.disconnect();renderer.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material?.dispose)o.material.dispose();});renderer.domElement.remove();};
}
