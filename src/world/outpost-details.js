import * as THREE from 'three';
import {COMMON} from '../oilpaint/common.js';

// Each household earns its living differently. All small fittings share a few
// material batches; the doorway and the strip of floor beside the table stay clear.
export function dressOutpost(parent,craft,spec,index,doorX,tableX,beds) {
  const {group,box,pole,stone,join}=craft,X=spec.w/2,Z=spec.d/2;
  const room=group(parent),porch=group(parent);
  const accent=['cloth','blue','moss'][index];
  const floorMat=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms:craft.mats.cut.uniforms,
    vertexShader:`out vec3 world;out vec2 board;void main(){world=(modelMatrix*vec4(position,1.)).xyz;board=position.xz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
    fragmentShader:`${COMMON}
    in vec3 world;in vec2 board;layout(location=0) out vec4 color;
    void main(){
      float row=floor(board.y/.32),along=board.x/2.43+fract(sin(row*13.17)*437.41);
      vec2 joint=abs(fract(vec2(along,board.y/.32)+.5)-.5)*vec2(2.43,.32);
      float seam=smoothstep(0.,.012+fwidth(board.y)*.28,min(joint.x,joint.y));
      float tint=fract(sin(dot(vec2(floor(along),row),vec2(19.7,41.3)))*347.7);
      float fibres=texture(tNoise,vec2(board.x*.23,board.y*5.1+row*.71)).g;
      float light=woodSunAt(world+vec3(0.,.18,0.));
      vec3 c=mix(vec3(.49,.344,.224),vec3(.66,.49,.325),.20+.40*tint+.27*fibres);
      c*=mix(.73,1.,seam)*(.78+.24*light);
      color=vec4(hazed(c,world),1.);
    }`});
  const floor=new THREE.Mesh(new THREE.BoxGeometry(spec.w-.14,.012,spec.d-.14),floorMat);
  floor.position.y=.092;parent.add(floor);floor.visible=false;
  const rugZ=Z-1.03;
  box(room,accent,doorX,.102,rugZ,.98,.018,1.4);
  for(const dz of [-.53,-.44,.44,.53])box(room,'chalk',doorX,.114,rugZ+dz,.93,.006,.028);
  for(let i=0;i<9;i++)for(const side of [-1,1])pole(room,'cut',[doorX-.43+i*.105,.11,rugZ+side*.67],[doorX-.43+i*.105,.11,rugZ+side*.76],.009);
  // Porch lamp with a shaded eave, brass handle and warm glass.
  const lx=doorX+.96,lz=Z+.29;
  box(porch,'iron',lx,1.87,lz,.23,.055,.24);
  box(porch,'iron',lx,2.13,lz,.27,.05,.25);
  box(porch,'cut',lx,2.01,lz,.14,.23,.14);
  for(const dx of [-.09,.09])pole(porch,'iron',[lx+dx,1.9,lz+.08],[lx+dx,2.12,lz+.08],.014);
  pole(porch,'iron',[lx,2.15,lz],[lx,2.23,Z+.08],.022);
  function ring(g,x,y,z,r,thickness,mat){
    const m=new THREE.Mesh(new THREE.TorusGeometry(r,thickness,5,20),craft.mats[mat]);
    m.rotation.x=Math.PI/2;m.position.set(x,y,z);g.add(m);
  }
  if(index===0){
    // A preserving table, fruit bowl and checked tea towel.
    box(room,'chalk',tableX+.35,.935,-.18,.38,.02,.77);
    for(let j=0;j<4;j++)box(room,'cloth',tableX+.20+j*.095,.948,-.18,.023,.008,.74);
    for(let j=0;j<6;j++)box(room,'cloth',tableX+.345,.952,-.50+j*.12,.36,.006,.015);
    pole(room,'bark',[tableX-.29,.93,-.18],[tableX-.29,1.00,-.18],.205);
    for(let j=0;j<5;j++){const a=j*2.4;stone(room,j%3?'cloth':'leaf',tableX-.30+Math.cos(a)*.11,1.056+(j===4?.06:0),-.18+Math.sin(a)*.1,.085,.078,.085);}
    for(let j=0;j<3;j++){
      const x=X-.32,z=-Z+.69+j*.49;
      pole(room,j%2?'cloth':'leaf',[x,1.21,z],[x,1.43,z],.11);
      pole(room,'chalk',[x,1.42,z],[x,1.47,z],.117);
    }
    for(let j=0;j<4;j++){
      const x=X-1.0+j*.19,z=Z+.30;
      pole(porch,'moss',[x,.99,z],[x+.03,1.23+(j%2)*.12,z],.02);
      stone(porch,j%2?'leaf':'cloth',x+.04,1.27+(j%2)*.12,z,.083,.09,.065);
    }
  }else if(index===1){
    // A hand-drawn soundings chart, coiled mooring rope and two drying oars.
    box(room,'chalk',tableX-.13,.934,-.19,.68,.019,.53);
    for(let j=0;j<5;j++){const x=tableX-.40+j*.12,z=-.18+Math.sin(j)*.075;pole(room,'blue',[x,.95,z],[x+.12,.95,-.18+Math.sin(j+1)*.075],.014);}
    for(let j=0;j<4;j++)ring(room,tableX+.48,.96+j*.023,-.12,.14-j*.012,.023,'cut');
    for(let j=0;j<2;j++){
      const x=.6+j*.38,z=-Z+.17;
      pole(room,'cut',[x-.18,.38,z],[x+.12,1.83,z],.032);
      const blade=stone(room,j?'moss':'blue',x+.17,1.91,z,.11,.32,.042);blade.rotation.z=-.22;
    }
    const coilX=-X+.64,coilZ=Z+1.45;
    for(let j=0;j<4;j++)ring(porch,coilX,.17+j*.034,coilZ,.30-j*.018,.034,'cut');
  }else{
    // The joiner's bench, saw teeth, tool board and a little cast-iron stove.
    box(room,'cut',tableX-.22,.957,-.18,.72,.045,.23);
    box(room,'iron',tableX+.16,.99,-.15,.28,.085,.12);box(room,'bark',tableX+.20,1.055,-.15,.1,.085,.10);
    const x=.1,z=-Z+.17;box(room,'cut',x,1.63,z,1.63,.74,.07);
    for(let j=0;j<3;j++){
      pole(room,'bark',[x-.57+j*.18,1.38,z+.07],[x-.57+j*.18,1.73,z+.07],.027);
      box(room,'iron',x-.56+j*.18,1.74,z+.07,.12,.06,.06);
    }
    box(room,'iron',x+.42,1.67,z+.07,.57,.11,.034);
    for(let j=0;j<6;j++){const tooth=box(room,'iron',x+.18+j*.086,1.6,z+.07,.04,.04,.035);tooth.rotation.z=.75;}
    const sx=-X+.55,sz=Z-.66;
    box(room,'iron',sx,.51,sz,.49,.61,.44);box(room,'dark',sx,.53,sz+.229,.32,.30,.022);
    pole(room,'iron',[sx,.79,sz],[sx,2.2,sz],.074);
    box(porch,'bark',X-.58,.23,Z+.71,.77,.17,.50);
    for(let j=0;j<4;j++)pole(porch,'cut',[X-.8+(j%2)*.27,.38+Math.floor(j/2)*.16,Z+.51],[X-.8+(j%2)*.27,.38+Math.floor(j/2)*.16,Z+.94],.092);
  }
  const core=new THREE.Mesh(new THREE.BoxGeometry(.145,.216,.147),new THREE.MeshBasicMaterial({color:0xffbd70}));
  core.position.set(lx,2.01,lz);parent.add(core);core.visible=false;
  const bedGlass=new THREE.MeshBasicMaterial({color:0xffc67a});
  const bedside=beds.map(bed=>{
    const wall=Math.sign(bed.x),x=wall*(X-.25),z=bed.z-.46;
    box(room,'iron',x+wall*.12,1.32,z,.052,.23,.115);
    pole(room,'iron',[x+wall*.13,1.26,z],[x,1.26,z],.026);
    box(room,'cut',x,1.30,z,.14,.031,.14);
    box(room,bedGlass,x,1.39,z,.087,.144,.089);
    box(room,'iron',x,1.48,z,.14,.035,.14);
    return new THREE.Vector3(x,1.39,z).add(parent.position);
  });
  join(room);join(porch);room.visible=false;
  return {room,porch,core,floor,bedside,bedGlass,lamp:new THREE.Vector3(lx,2.01,lz)};
}
