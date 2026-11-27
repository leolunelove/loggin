import * as THREE from 'three';
import {COMMON} from '../oilpaint/common.js';
import {PLACES} from '../exploration.js';

function inscription(shared,text) {
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=96;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#efe2bf';ctx.font='bold 62px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(text,256,49,490);
  const ink=new THREE.CanvasTexture(canvas);
  return new THREE.ShaderMaterial({
    glslVersion:THREE.GLSL3,uniforms:{...shared,ink:{value:ink}},
    vertexShader:`out vec2 letter;out vec3 ground;
      void main(){letter=uv;ground=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(ground,1.);}`,
    fragmentShader:`${COMMON}
      uniform sampler2D ink;in vec2 letter;in vec3 ground;out vec4 outC;
      void main(){float a=texture(ink,letter).a;if(a<.39)discard;
        vec3 ochre=mix(vec3(.68,.58,.41),vec3(.92,.83,.64),woodSunAt(ground));
        outC=vec4(hazed(ochre,ground),1.);}`
  });
}

export function createFingerpost(shared,origin,sites,heightAt,wood,iron) {
  const post=new THREE.Group();
  const x=origin.x+2.5,z=origin.z+3.6;
  post.position.set(x,heightAt(x,z),z);
  const timber=(parent,w,h,d,x,y,z,mat)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  timber(post,.16,2.24,.16,0,1.09,0,wood).rotation.y=.08;
  for(const y of [.33,2.10])timber(post,.176,.045,.176,0,y,0,iron);
  const shape=new THREE.Shape();
  shape.moveTo(-.16,-.13);shape.lineTo(1.22,-.13);shape.lineTo(1.42,.012);shape.lineTo(1.21,.14);shape.lineTo(-.16,.13);shape.closePath();
  const plank=new THREE.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:true,bevelSegments:1,bevelSize:.012,bevelThickness:.009});
  const face=new THREE.PlaneGeometry(1.12,.215);
  for(const [i,site] of sites.entries()){
    const arm=new THREE.Group(),p=site.dropoff;
    arm.rotation.y=-Math.atan2(p.z-z,p.x-x);arm.position.y=1.92-i*.33;
    post.add(arm);const board=new THREE.Mesh(plank,wood);board.position.z=-.0375;arm.add(board);
    const ink=typeof document==='undefined'?null:inscription(shared,PLACES[i].name);
    for(const side of [-1,1]){
      timber(arm,.043,.043,.018,0,0,side*.052,iron);
      if(ink){const words=new THREE.Mesh(face,ink);words.rotation.y=side===1?0:Math.PI;words.position.set(.60,0,side*.05);arm.add(words);}
    }
  }
  return post;
}
