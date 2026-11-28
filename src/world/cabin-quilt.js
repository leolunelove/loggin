import * as THREE from 'three';
import {COMMON} from '../oilpaint/common.js';

// A turned-back coverlet. Its foot is fixed while the upper hem travels over the knees.
export function createCabinQuilt(shared){
  const bones=['thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r','spine_02'];
  const joints=bones.map(()=>new THREE.Vector3());
  const uniforms={...shared,cover:{value:0},width:{value:.75},breath:{value:0},joints:{value:joints}};
  const material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,side:THREE.DoubleSide,uniforms,
    vertexShader:`uniform float cover,width,breath;uniform vec3 joints[7];out vec2 cloth;out vec3 site;
      float drape(vec2 at,vec3 a,vec3 b,float radius){
        vec2 ab=b.xz-a.xz;float t=clamp(dot(at-a.xz,ab)/max(.0001,dot(ab,ab)),0.,1.);
        vec3 p=mix(a,b,t);float d=length(at-p.xz);
        return p.y+radius-.78*d-.78*max(0.,d-radius);
      }
      void main(){
        cloth=uv;float t=uv.y,s=2.*abs(uv.x-.5),lengthwise=mix(.915,mix(.65,-.34,cover),t);
        float body=1.-smoothstep(.30,1.,s);
        float loft=.045+body*(.09+.15*t+breath*.008*t);
        float fold=.015*cos(uv.x*27.+t*3.)*(.35+.65*s)+.018*sin(t*11.)*s;
        float hem=.025*sin(smoothstep(.82,1.,t)*3.14159);
        vec2 at=vec2((uv.x-.5)*width,lengthwise);
        float skin=max(drape(at,joints[0],joints[1],.136),drape(at,joints[1],joints[2],.110));
        skin=max(skin,max(drape(at,joints[3],joints[4],.136),drape(at,joints[4],joints[5],.110)));
        skin=max(skin,drape(at,(joints[0]+joints[3])*.5,joints[6],.167));
        float surface=max(loft,skin+.011);
        vec3 p=vec3(at.x,.012+cover*(surface+fold+hem),at.y);
        site=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(site,1.);
      }`,
    fragmentShader:`${COMMON}
      in vec2 cloth;in vec3 site;out vec4 ink;
      void main(){
        vec2 tile=cloth*vec2(4.,6.);float alternate=mod(floor(tile.x)+floor(tile.y),2.);
        vec3 fabric=mix(vec3(.48,.26,.20),vec3(.31,.43,.38),alternate);
        vec2 centre=abs(fract(tile)-.5);
        float diamond=1.-smoothstep(.16,.19,centre.x+centre.y);
        fabric=mix(fabric,vec3(.70,.57,.37),diamond*.76);
        float thread=texture(tNoise,cloth*vec2(11.,17.)).g;
        float hem=smoothstep(.90,.91,cloth.y);fabric=mix(fabric,vec3(.76,.67,.49),hem*.9);
        float seam=max(1.-smoothstep(.009,.026,.5-centre.x),1.-smoothstep(.012,.032,.5-centre.y));
        vec3 n=normalize(cross(dFdx(site),dFdy(site)));if(n.y<0.)n=-n;
        fabric*=.81+.16*thread+.14*max(0.,n.y)-.18*seam;
        ink=vec4(hazeFacing(fabric,site,.82,n,.75),1.);
      }`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1,20,24),material);
  mesh.name='Turned-back coverlet';mesh.frustumCulled=false;mesh.visible=false;
  return {mesh,update(action,rig){
    const cover=action?.kind==='bed'?THREE.MathUtils.smootherstep(action.progress,.66,.97):0;
    mesh.visible=cover>.002;if(!mesh.visible)return;
    mesh.position.set(action.mid.x,action.top+.004,action.mid.z);mesh.rotation.y=action.bedYaw;
    mesh.updateWorldMatrix(true,false);
    for(let i=0;i<bones.length;i++)mesh.worldToLocal(rig[bones[i]].getWorldPosition(joints[i]));
    uniforms.width.value=action.sideBed ? .92 : .65;uniforms.cover.value=cover;
    uniforms.breath.value=Math.sin(action.age*1.74);
  }};
}
