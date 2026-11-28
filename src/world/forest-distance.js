import * as THREE from 'three';
import {dabGeometry,dabMesh} from '../oilpaint/dabs.js';
import {COMMON} from '../oilpaint/common.js';

export const VIEW_RANGE={detailStart:68,detailEnd:106,horizon:165,tile:30};
export const RANGE_GLSL=`
float woodDetail(float d){return 1.-smoothstep(68.,106.,d);}
float woodHorizon(){return 165.-min(1.,max(uRain,(uHazeDensity-.012)*19.))*24.;}
`;
const key=(x,z)=>Math.floor(x/VIEW_RANGE.tile)+','+Math.floor(z/VIEW_RANGE.tile);
function bound(x,z){const size=VIEW_RANGE.tile;return {x:(Math.floor(x/size)+.5)*size,z:(Math.floor(z/size)+.5)*size};}
export function nearTile(t,p,reach){const dx=Math.max(0,Math.abs(t.x-p.x)-15),dz=Math.max(0,Math.abs(t.z-p.z)-15);return dx*dx+dz*dz<reach*reach;}

// The source arrays retain their tree-ID ranges for chopping. Only changed ranges are
// mirrored into these spatial batches, which can be skipped before drawing any strokes.
export function tileDabs(source){
  const attrs=source.geometry.attributes,points=attrs.aPos,count=points.count,tiles=[],index=new Map();
  const owner=new Uint16Array(count),local=new Uint32Array(count);
  const names=Object.keys(attrs).filter(n=>attrs[n].isInstancedBufferAttribute);
  for(let i=0;i<count;i++){
    const x=points.getX(i),z=points.getZ(i),k=key(x,z);
    if(!index.has(k)){index.set(k,tiles.length);tiles.push({...bound(x,z),count:0});}
    const j=index.get(k);owner[i]=j;local[i]=tiles[j].count++;
  }
  for(const t of tiles){
    const data={};for(const n of names){const size=attrs[n].itemSize;data[n]=[new Float32Array(t.count*size),size];}
    t.mesh=dabMesh(dabGeometry(t.count,data),source.material,source.renderOrder);
    t.mesh.geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(t.x,11,t.z),53);t.mesh.frustumCulled=true;
  }
  function copy(i,fields=names){const dest=tiles[owner[i]].mesh.geometry.attributes;
    for(const n of fields){const a=attrs[n],size=a.itemSize;
      for(let k=0;k<size;k++)dest[n].array[local[i]*size+k]=a.array[i*size+k];}
  }
  for(let i=0;i<count;i++)copy(i);
  function sync(start,end,fields=names){
    const changed=new Map();
    for(let i=start;i<end;i++){
      copy(i,fields);const tile=owner[i],j=local[i],range=changed.get(tile);
      if(range){range[0]=Math.min(range[0],j);range[1]=Math.max(range[1],j);}else changed.set(tile,[j,j]);
    }
    for(const [tile,[a,b]] of changed)for(const n of fields){
      const attr=tiles[tile].mesh.geometry.attributes[n];attr.addUpdateRange(a*attr.itemSize,(b-a+1)*attr.itemSize);attr.needsUpdate=true;
    }
  }
  return {tiles,sync};
}
export function tileTrunks(source,trees){
  const g=source.geometry,tiles=new Map();
  for(const t of trees){
    const k=key(t.x,t.z);
    if(!tiles.has(k))tiles.set(k,{...bound(t.x,t.z),indices:[]});
    t.woodTile=tiles.get(k);const list=t.woodTile.indices;t.tileIndex=list.length;
    for(let i=t.indexStart;i<t.indexEnd;i++)list.push(g.index.array[i]);
  }
  for(const t of tiles.values()){
    const geom=new THREE.BufferGeometry();for(const [n,a] of Object.entries(g.attributes))geom.setAttribute(n,a);
    geom.setIndex(t.indices);delete t.indices;
    geom.boundingSphere=new THREE.Sphere(new THREE.Vector3(t.x,12,t.z),53);
    t.mesh=new THREE.Mesh(geom,source.material);
  }return [...tiles.values()];
}
export function silhouettes(shared,trees,lobes){
  const data=[],shape=[],active=new Float32Array(trees.length).fill(1);
  for(const t of trees){
    let wide=1,top=t.y+t.h,bottom=top,centerX=0,centerZ=0;const [a,b]=t.ranges.lobes;
    for(let i=a;i<b;i++){centerX+=lobes[i*4];centerZ+=lobes[i*4+2];}
    centerX/=b-a;centerZ/=b-a;
    for(let i=a;i<b;i++){const j=i*4,r=lobes[j+3];wide=Math.max(wide,Math.hypot(lobes[j]-centerX,lobes[j+2]-centerZ)+r);top=Math.max(top,lobes[j+1]+r);bottom=Math.min(bottom,lobes[j+1]-r);}
    data.push(t.x,t.y,t.z,top-t.y);shape.push(wide,Math.max(.24,(bottom-t.y)/(top-t.y)),t.family,t.seed);
    t.impostorIndex=shape.length/4-1;
  }
  const geometry=dabGeometry(trees.length,{aTree:[new Float32Array(data),4],aShape:[new Float32Array(shape),4],aActive:[active,1]});
  const material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms:shared,side:THREE.DoubleSide,
    vertexShader:`${COMMON}\n${RANGE_GLSL}
    in vec4 aTree;in vec4 aShape;in float aActive;out vec2 vCard;out vec4 vShape;out vec3 vWorld;out float vCover;
    void main(){float dist=length(aTree.xz-cameraPosition.xz);float end=woodHorizon();
      vCover=(1.-woodDetail(dist))*(1.-smoothstep(end-17.,end,dist))*aActive;
      if(vCover<.003){gl_Position=vec4(2.,2.,2.,1.);return;}
      vec2 side=normalize(vec2(cameraPosition.z-aTree.z,aTree.x-cameraPosition.x)+vec2(.0001));
      vCard=vec2(position.x,position.y*.5+.5);vShape=aShape;
      vWorld=aTree.xyz+vec3(side.x*position.x*aShape.x,vCard.y*aTree.w,side.y*position.x*aShape.x);
      gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
    fragmentShader:`${COMMON}\nin vec2 vCard;in vec4 vShape;in vec3 vWorld;in float vCover;out vec4 outC;
    float lobe(vec2 uv,vec2 centre,vec2 size){return length((uv-centre)/size);}
    void main(){
      vec2 uv=vCard;float seed=vShape.w;
      vec2 seed2=fract(vec2(seed*.137,seed*.387));
      float y=(uv.y-vShape.y)/max(.001,1.-vShape.y);
      float lean=.10*sin(seed+uv.y*3.);
      vec2 crown=vec2(uv.x-lean,y);
      float bough=lobe(crown,vec2(.04,.56),vec2(.51,.40));
      float sideA=lobe(crown,vec2(-.42,.43+.16*seed2.x),vec2(.34,.28));
      float sideB=lobe(crown,vec2(.43,.39+.20*seed2.y),vec2(.38,.29));
      float crest=lobe(crown,vec2(-.14+.26*seed2.y,.73),vec2(.29,.27));
      float tips=min(min(bough,sideA),min(sideB,crest));
      float grain=texture(tNoise,uv*vec2(3.8,7.4)+seed2).g;
      float fleck=texture(tNoise,uv*vec2(13.,19.)+seed2.yx).r;
      float foliage=tips+.26*(grain-.5)+.16*sin(uv.x*20.+y*13.+seed)+.14*(fleck-.5);
      float trunk=abs(uv.x-lean*uv.y)/max(.006,.031*(1.-uv.y*.79));
      float fork=abs(abs(uv.x-lean*uv.y)-max(0.,uv.y-.46)*.95)/.014;
      bool woody=trunk<1.&&uv.y<vShape.y+.14 || fork<1.&&uv.y>.46&&uv.y<min(.82,vShape.y+.21);
      bool leaves=foliage<1.&&(tips<.70||fleck>.35);
      if(!leaves&&!woody)discard;
      float density=leaves?mix(.64,.95,(1.-smoothstep(.40,1.08,foliage))*(.61+.39*grain)):.92;
      float dither=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715)))+seed2.x);
      if(dither>vCover*density)discard;
      float light=clamp(.25+.43*y+.29*grain+.15*uv.x,0.,1.);
      vec3 shade=mix(vec3(.32,.33,.30),vec3(.38,.31,.28),seed2.x);
      vec3 sun=mix(vec3(.59,.52,.34),vec3(.68,.47,.31),fract(vShape.z*.37));
      vec3 c=leaves?mix(shade,sun,light):vec3(.33,.32,.30);
      float weather=clamp(uRain+(uHazeDensity-.012)*18.,0.,1.);
      outC=vec4(hazeAt(c,vWorld,mix(.43,.87,weather)),1.);
    }`});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
  return {mesh,set(t,shown){const a=geometry.attributes.aActive,i=t.impostorIndex;if(a.getX(i)!==Number(shown)){a.setX(i,Number(shown));a.needsUpdate=true;}}};
}
