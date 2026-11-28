import * as THREE from 'three';
import {COMMON} from '../oilpaint/common.js';
import {paintedRanges} from './horizon.js';

export function createSky(shared){
  const group=new THREE.Group();
  const dome=new THREE.Mesh(new THREE.SphereGeometry(900,40,24),new THREE.ShaderMaterial({
    glslVersion:THREE.GLSL3,uniforms:shared,side:THREE.BackSide,depthTest:false,depthWrite:false,
    vertexShader:`out vec3 vDir;
      void main(){vDir=position;gl_Position=projectionMatrix*viewMatrix*vec4(position+cameraPosition,1.);}`,
    fragmentShader:`${COMMON}
      in vec3 vDir;out vec4 outC;
      float starField(vec2 chart,float cells,float chance){
        vec2 uv=chart*cells,tile=floor(uv);
        vec4 seed=hash4(dot(tile,vec2(17.17,401.43)));
        vec2 local=fract(uv)-(.16+.68*seed.yz);
        float width=max(.014,fwidth(uv.x)+fwidth(uv.y))*.48;
        float radius=.030+.119*pow(seed.w,5.);
        return step(chance,seed.x)*(1.-smoothstep(max(0.,radius-width),radius+width,length(local)))*(.42+.58*seed.w);
      }
      void main(){
        vec3 v=normalize(vDir);float h=max(v.y,0.);
        vec2 chart=v.xz/(1.+h);
        vec2 drift=uTime*.00040*vec2(.34,-.14);
        vec2 cloudUV=v.xz/(.38+h)*vec2(.89,1.36)+drift;
        float cloud=texture(tNoise,cloudUV*.68).r;
        float edge=texture(tNoise,cloudUV*vec2(1.4,3.7)+vec2(.31,.59)).g;
        float cloudBody=smoothstep(.49-.19*uOvercast,.68-.12*uOvercast,cloud+.15*(edge-.5));
        float sun=max(0.,dot(v,uSkySun));
        vec3 low=mix(airColour(v),vec3(1.0,.645,.432),uDusk*(.65+.29*sun));
        vec3 high=mix(vec3(.40,.57,.735),vec3(.37,.38,.555),uDusk);
        vec3 day=mix(low,high,smoothstep(-.04,.84,v.y));
        day+=vec3(.18,.116,.052)*pow(sun,12.)+vec3(.19,.16,.095)*pow(sun,98.);
        day=mix(day,vec3(.99,.885,.62),smoothstep(.99960,.99978,sun)*.88);
        vec3 cloudLight=mix(vec3(.83,.835,.80),vec3(.97,.66,.48),uDusk);
        vec3 under=mix(vec3(.57,.65,.73),vec3(.54,.43,.52),uDusk);
        vec3 wash=mix(cloudLight,under,smoothstep(.54,.77,cloud));
        day=mix(day,wash,cloudBody*(.46+.28*(1.-h)));
        day=mix(day,vec3(.43,.51,.57)*(1.+.19*(1.-h)),uOvercast*.80);
        vec3 night=mix(vec3(.109,.151,.219),vec3(.029,.043,.11),smoothstep(0.,.91,h));
        float galactic=abs(dot(v,normalize(vec3(-.36,.48,.80))));
        float nebula=texture(tNoise,chart*vec2(2.2,3.3)).g*.63+edge*.37;
        float band=exp(-galactic*galactic*43.)*(.20+.80*smoothstep(.29,.69,nebula))*smoothstep(.02,.38,h);
        night+=vec3(.105,.093,.151)*band;
        float stars=starField(chart,92.,.924)+.50*starField(chart+vec2(.23,.10),173.,.95-.12*band);
        night+=vec3(.91,.92,.83)*stars*smoothstep(.025,.24,h)*(1.-.86*cloudBody)*(1.-uOvercast);
        float moon=max(0.,dot(v,uMoonDir));float disc=smoothstep(.99955,.99966,moon);
        vec3 east=normalize(cross(vec3(0.,1.,0.),uMoonDir));vec3 north=cross(uMoonDir,east);
        vec2 face=vec2(dot(v,east),dot(v,north))*35.;
        float phase=smoothstep(.06,.24,length(face+vec2(.90,.14))-.18);
        float mare=texture(tNoise,face*.68+vec2(.12,.40)).r;
        night+=vec3(.145,.175,.19)*pow(moon,123.)*(1.-.79*cloudBody);
        night=mix(night,vec3(.80,.84,.76)*(.86+.18*mare)*(.64+.36*phase),disc);
        night=mix(night,vec3(.089,.111,.165)*(.84+.28*edge),cloudBody*(.56+.40*uOvercast));
        night=mix(night,vec3(.071,.094,.132),uOvercast*.66);
        outC=vec4(mix(night,day,uDaylight+.29*uDusk*(1.-uDaylight)),1.);
      }`
  }));
  dome.frustumCulled=false;dome.renderOrder=-10;group.add(dome,paintedRanges(shared));return {group};
}
