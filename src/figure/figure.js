// The lumberjack: a wide hat, an open canvas wood pack, and brush strokes that follow the body.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { GROOM, WORKWEAR_PAINT } from './workwear-paint.js';
import { loadMan } from './man.js';
import {workClothes,tint} from './work-clothes.js';
import {characterPalettes,sanitizeAppearance} from '../appearance.js';
import {workwearWetness} from '../weather.js';
import { createWoodPack } from './pack.js';
import { pinDabs } from '../oilpaint/pins.js';

const PAINT_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uL; uniform vec3 uM; uniform vec3 uS;
uniform vec3 uL2; uniform vec3 uM2; uniform vec3 uS2;
uniform vec3 uOwn; uniform vec3 uOwn2;
uniform float uSplit;
#ifdef TOOL_STEEL
uniform float uPolish;
#endif
uniform float uGrain;uniform float uWearWet;uniform float uDistanceHaze;uniform float uCloth;uniform float uTimber;
in vec3 vWorld; in vec3 vN; in vec3 vBind;
#ifdef HAIR
  uniform float uHatHem;
#endif
#ifdef EYES
  uniform float uBlink; uniform float uGaze; uniform vec3 uLidL; uniform vec3 uLidM; uniform vec3 uLidS;
#endif
#ifdef SAWN_WOOD
  in vec4 vBoard;
#endif
#ifdef PACK_PATCH
  uniform sampler2D tPatch; in vec2 vPatchUv;
#endif
${GROOM}
layout(location = 0) out vec4 outC;
${WORKWEAR_PAINT}
void main() {
  #ifdef HAIR
    if(vBind.y>uHatHem)discard;
  #endif
  #ifdef QUILTED
    float ax=abs(vBind.x),front=smoothstep(.015,.10,vBind.z);
    float opening=(.008+.095*smoothstep(1.30,1.52,vBind.y))*front;
    float armhole=mix(.242,.174,smoothstep(1.33,1.50,vBind.y));
    float top=1.557-.034*smoothstep(.11,.205,ax);
    if(vBind.y<1.032||vBind.y>top||ax>armhole||(front>.5&&ax<opening))discard;
  #endif
  vec3 Nn = normalize(vN);
  if (!gl_FrontFacing) Nn = -Nn;
  float n = texture(tNoise, vBind.xy * uGrain + vBind.z * 1.7).r;
  float m = texture(tNoise, vBind.yx * uGrain * 0.31 + 0.4).g;
  float lit = sunAt(vWorld + Nn * 0.08) * clamp(dot(Nn, uSunDir) * 0.85 + 0.42, 0.0, 1.0);
  bool lower = vBind.y < uSplit + (n - 0.5) * 0.05;
  vec3 c = lower ? paint3(uL2, uM2, uS2, lit, n) : paint3(uL, uM, uS, lit, n);
  if(uTimber>.01){
    vec2 fibre=vec2(vBind.x*3.7,vBind.y*.29);
    float band=texture(tNoise,fibre*3.7+vec2(.2,m*.17)).r;
    float grainStroke=smoothstep(.51,.72,band);
    c=mix(c,mix(uM,uL,.16+.42*lit),.18*uTimber);
    c*=1.+(grainStroke-.40)*.23*uTimber;
  }
  #ifdef SAWN_WOOD
    float seed=vBoard.w;
    vec2 timber=vBoard.xy+vec2(seed*2.13,seed*.77);
    float growth=texture(tNoise,timber*vec2(1.9,.19)).r;
    float strand=texture(tNoise,timber*vec2(5.2,.32)+vec2(.12*growth,seed)).g;
    float grain=mix(growth,strand,.31);
    if(vBoard.z>.5){
      float rings=length(vBoard.xy+vec2(.045+.031*seed,.023))*55.+.13*growth;
      grain=.55-.23*cos(rings*TAU)/(1.+4.*fwidth(rings));
    }
    c=mix(c,mix(uS,uM,.36+.43*grain),.14*(1.-lit));
    c*=.91+.17*grain+.055*(seed-.5);
  #endif
  #ifdef TOOL_STEEL
    vec3 eye=normalize(cameraPosition-vWorld),halfDir=normalize(eye+uSunDir);
    float sky=clamp(.55+.25*Nn.y+.19*dot(Nn,uSunDir),0.,1.);
    float reflected=smoothstep(.54+.24*uPolish,.97,dot(Nn,halfDir));
    float grind=texture(tNoise,vec2(vBind.x*28.+vBind.y*9.,vBind.y*3.)).g;
    c=mix(c,mix(uS,uL,sky*.61+.11),.20+.18*uPolish);
    c*=.95+.085*grind;
    c+=uL*reflected*(.08+.24*uPolish)*uDaylight*(1.-.65*uOvercast);
  #endif
  #ifdef WORKWEAR
  c=materialPigment(c,lower?uS2:uS,lower?uM2:uM,lower?uL2:uL,vBind,Nn,lit);
  #else
  if(uCloth>.5){
    vec3 low=lower?uS2:uS,mid=lower?uM2:uM,high=lower?uL2:uL;
    float skyFill=clamp(.46+Nn.y*.22+dot(Nn,uSunDir)*.23,0.,1.);
    vec3 modelled=mix(low,mid,.22+.55*skyFill);
    c=mix(c,mix(modelled,high,smoothstep(.29,.94,lit)),.52);
  }
  #endif
  #ifdef PACK_PATCH
    vec4 thread=texture(tPatch,vPatchUv);
    if(thread.a<.49)discard;
    float value=dot(thread.rgb,vec3(.30,.56,.14));
    vec3 dye=mix(vec3(value),thread.rgb,.62)*vec3(.89,.83,.73);
    float weave=texture(tNoise,vPatchUv*vec2(4.3,1.4)).g;
    c=mix(c,dye*(.50+.21*Nn.y+.36*lit)*(.93+.13*weave),.92);
  #endif
  #ifdef QUILTED
    float seam=abs(fract((vBind.y-1.041)*12.)-.5);
    float binding=min(min(armhole-ax,top-vBind.y),vBind.y-1.032);
    if(front>.5)binding=min(binding,ax-opening);
    c*=.97+.045*sin((vBind.y-1.041)*12.*TAU);
    c*=1.-.19*smoothstep(.43,.49,seam);
    c=mix(c,c*.61,1.-smoothstep(.003,.008,binding));
  #endif
  // light thrown up by the ground (warm, off the leaves), cool light from the sky into the shade
  c += uBounce * max(-Nn.y, 0.0) * (1.0 - lit);
  c = mix(c, c * vec3(0.86, 0.92, 1.18), (1.0 - lit) * max(Nn.y, 0.0) * 0.6);
  c *= 0.88 + 0.24 * m;
  if (!gl_FrontFacing) c *= 0.62;
  c += (lower ? uOwn2 : uOwn) * uLampCol * lampAt(vWorld, Nn);
  #ifdef WORKWEAR
    outC=vec4(hazeFacing(c,vWorld,uDistanceHaze,Nn,.87),1.);
  #elif defined(SAWN_WOOD)
    outC=vec4(hazeFacing(c,vWorld,uDistanceHaze,Nn,.59),1.);
  #else
    outC=vec4(hazeAt(c,vWorld,uDistanceHaze),1.);
  #endif
}
`;

// A palette is [light, half-tone, shade] and, where a lamp is carried, the thing's own colour for its light to fall on.
export function paint(shared, [L, M, S, A = L], { skinned = false, lower = null, split = -10, grain = 2.2, quilted = false, stock = false, polish = null, material = null, patch = null, workshirt = false, board = false } = {}) {
  const col = (c) => ({ value: new THREE.Color(...c) });
  const [L2, M2, S2, A2 = L2] = lower ?? [L, M, S, A];
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    defines:{...(board?{SAWN_WOOD:1}:{}),...(workshirt?{WORK_SHIRT:1}:{}),...(patch?{PACK_PATCH:1}:{}),...(material?{WORKWEAR:1,[material.toUpperCase()]:1}:{}),...(quilted?{QUILTED:1}:{}),...(stock?{TOOL_STOCK:1}:{}),...(polish!=null?{TOOL_STEEL:1}:{})},
    side: THREE.DoubleSide,
    uniforms: { ...shared,uWearWet:shared.uWearWet??shared.uRain??{value:0},...(patch?{tPatch:{value:patch}}:{}),...(material==='eyes'?{uBlink:{value:0},uGaze:{value:0},uLidL:col(L),uLidM:col(M),uLidS:col(S)}:{}),...(material==='hair'?{uHatHem:{value:1.805}}:{}),...(material==='skin'?{uBeard:{value:0},uWhisker:col([.25,.18,.13])}:{}),uDistanceHaze:{value:1},uCloth:{value:skinned?1:0},uTimber:{value:stock&&polish==null?1:0},uPolish:{value:polish??0}, uL: col(L), uM: col(M), uS: col(S), uL2: col(L2), uM2: col(M2), uS2: col(S2), uOwn: col(A), uOwn2: col(A2), uSplit: { value: split }, uGrain: { value: grain } },
    vertexShader: skinned ? /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      ${GROOM}
      out vec3 vWorld; out vec3 vN; out vec3 vBind;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #ifdef SKIN
          float beardLength=max(0.,uBeard-1.);
          transformed+=normal*whiskerMask(position)*beardLength*(.004+.011*(1.-smoothstep(1.62,1.69,position.y)));
        #endif
        #include <skinning_vertex>
        vec4 w = modelMatrix * vec4(transformed, 1.0);
        vWorld = w.xyz;
        vN = normalize(transpose(mat3(viewMatrix)) * normalMatrix * objectNormal);
        vBind = position;
        gl_Position = projectionMatrix * viewMatrix * w;
      }` : /* glsl */ `
      #ifdef SAWN_WOOD
        in vec4 aBoard; out vec4 vBoard;
      #endif
      #ifdef PACK_PATCH
        out vec2 vPatchUv;
      #endif
      out vec3 vWorld; out vec3 vN; out vec3 vBind;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        #ifdef SAWN_WOOD
          vBoard=aBoard;
        #endif
        #ifdef PACK_PATCH
          vPatchUv=uv;
        #endif
        vWorld = w.xyz;
        vN = normalize(transpose(mat3(viewMatrix)) * normalMatrix * normal);
        #if defined(WORKWEAR)
          vBind=position*vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),length(modelMatrix[2].xyz));
        #elif defined(TOOL_STOCK)
          vBind=position;
        #else
          vBind=vec3(uv*.6,0.);
        #endif
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: PAINT_FRAG,
  });
}

// the palettes he is painted with by day: light, half-tone, shade
export const DAY = {
  PACK: [[0.24, 0.5, 0.74], [0.11, 0.27, 0.52], [0.07, 0.11, 0.3]],
  HAT: [[1.0, 0.88, 0.52], [0.8, 0.62, 0.32], [0.45, 0.34, 0.27]],
  SHIRT: [[0.97, 0.88, 0.68], [0.64, 0.54, 0.45], [0.29, 0.25, 0.32]],
  TROUSERS: [[0.6, 0.42, 0.27], [0.36, 0.25, 0.2], [0.18, 0.13, 0.18]],
  SKIN: [[1.0, 0.78, 0.58], [0.76, 0.51, 0.39], [0.4, 0.26, 0.28]],
  BOOTS: [[0.48, 0.3, 0.18], [0.25, 0.16, 0.13], [0.12, 0.08, 0.12]],
  HAIR: [[0.42, 0.28, 0.18], [0.2, 0.14, 0.12], [0.09, 0.07, 0.09]],
  EYES: [[0.2, 0.15, 0.14], [0.12, 0.09, 0.1], [0.06, 0.05, 0.07]],
};

/** palettes: any of DAY's to paint him otherwise (another hour, other clothes). */
export async function createFigure(sceneShared, onProgress, palettes = {}, appearance = {}) {
  const shared={...sceneShared,uWearWet:{value:0}};
  const { PACK, HAT, SHIRT, TROUSERS, SKIN, BOOTS, HAIR, EYES } = { ...DAY, ...palettes };
  const man = await loadMan({ base: './figure/', onProgress });
  for (const mesh of man.meshes) {
    const name = mesh.name + ' ' + (mesh.material?.name ?? '');
    if (/eyelash/.test(name)) { mesh.visible = false; continue; }
    mesh.material = /casualsuit/.test(name) ? paint(shared, SHIRT, { skinned: true, material:'cloth', workshirt:true, lower: TROUSERS, split: 0.98, grain: 2.6 })
      : /shoes/.test(name) ? paint(shared, BOOTS, { skinned: true,material:'leather' })
      : /short01|eyebrow/.test(name) ? paint(shared, HAIR, { skinned: true,material:/eyebrow/.test(name)?'brow':'hair' })
      : /high-poly/.test(name) ? paint(shared, EYES, { skinned: true,material:'eyes' })
      : paint(shared, SKIN, { skinned: true,material:'skin' });
    mesh.layers.enable(1);
    mesh.frustumCulled = false;
  }
  const dabs = new THREE.Group();

  const wardrobe=workClothes(shared,man,paint,HAT,SHIRT);
  dabs.add(wardrobe.mesh);

  const pack=createWoodPack(shared,man,{paint,canvasPalette:palettes.PACK??palettes.CLOAK??PACK});
  dabs.add(pack.paint.mesh);

  // --- paint on the body itself: pins on his clothes, skin, boots and hair ---
  const partOf = (re) => man.meshes.find((m) => re.test(m.name));
  const UP = new THREE.Vector3(0, 1, 0), OUT = new THREE.Vector3(1, 0, 0), FWD = new THREE.Vector3(0, 0, 1);
  const parts = [];
  const suit = partOf(/casualsuit/), skin = partOf(/generic/), shoes = partOf(/shoes/), hair = partOf(/short01/);
  // he was made standing with his arms straight out: a sleeve runs sideways, everything else runs down
  if (suit) parts.push({ mesh: suit, count: 410, style: (p,n) => ({ pal: p.y < 0.98 ? 1 : 0, size: [0.024, 0.059], dir: Math.abs(p.x) > 0.2 && p.y > 1.3 ? OUT : new THREE.Vector3(.24*n.z,1,.16*n.x) }) });
  // skin only where it shows: the head and neck, and the arms past the sleeves
  if (skin) parts.push({
    mesh: skin, count: 132, accept: (p) => (p.y > 1.52 || Math.abs(p.x) > 0.37) && !(p.y>1.60 && p.y<1.81 && p.z>.032),
    style: (p, n) => (Math.abs(p.x) > 0.37
      ? { pal: 2, size: Math.abs(p.x) > 0.78 ? [0.022, 0.04] : [0.024, 0.054], dir: OUT }
      : { pal: 2, size: [0.013, 0.024], dir: new THREE.Vector3().crossVectors(UP, n).add(new THREE.Vector3(0, 0.3, 0)) }),
  });
  if (shoes) parts.push({ mesh: shoes, count: 70, style: () => ({ pal: 3, size: [0.045, 0.085], dir: FWD }) });
  if (hair) parts.push({ mesh: hair, count: 36, accept:p=>p.y<1.757, style: () => ({ pal: 4, size: [0.010, 0.024], dir: UP }) });
  const bodyDabs = pinDabs(shared, [SHIRT, TROUSERS, SKIN, BOOTS, HAIR], parts,{surface:true});
  dabs.add(bodyDabs.mesh);

  const eyes=partOf(/high-poly/),eyeUniforms=eyes?.material.uniforms;
  const quiet=[3.7,5.1,3.25,4.75,4.20];
  let blinkClock=0,blinkIndex=0;
  function update(dt) {
    if(eyeUniforms){
      blinkClock+=dt;
      const interval=quiet[blinkIndex];
      if(blinkClock>=interval){blinkClock-=interval;blinkIndex=(blinkIndex+1)%quiet.length;}
      const age=blinkClock-(quiet[blinkIndex]-.17);
      eyeUniforms.uBlink.value=age<0?0:age<.06?THREE.MathUtils.smoothstep(age,0,.06):1.-THREE.MathUtils.smoothstep(age,.065,.17);
      eyeUniforms.uGaze.value=.00145*Math.sin((blinkIndex+1)*2.31+.27*blinkClock);
    }
    bodyDabs.update();wardrobe.update();
    pack.update(dt);
  }

  function setAppearance(value) {
    const a=sanitizeAppearance(value),p=characterPalettes(a);
    for(const [mesh,pal,lower] of [[suit,p.SHIRT,TROUSERS],[skin,p.SKIN],[hair,p.HAIR]]) if(mesh)tint(mesh.material,pal,lower);
    if(eyeUniforms)for(const [i,key] of ['uLidL','uLidM','uLidS'].entries())eyeUniforms[key].value.setRGB(...p.SKIN[i]);
    if(hair)hair.material.uniforms.uHatHem.value=[1.802,1.771,1.785][a.headwear];
    const brows=partOf(/eyebrow/);
    if(brows)tint(brows.material,p.HAIR.map((colour,i)=>colour.map((v,k)=>v*.67+p.SKIN[2][k]*.19)));
    if(skin){skin.material.uniforms.uBeard.value=a.beard;skin.material.uniforms.uWhisker.value.setRGB(...p.HAIR[1]);}
    bodyDabs.setPalette(0,p.SHIRT);bodyDabs.setPalette(2,p.SKIN);bodyDabs.setPalette(4,p.HAIR);
    wardrobe.set(a,p);pack.setCanvas(p.PACK);pack.setLayer(a.workwear);
  }
  setAppearance(appearance);
  return { man, hat:wardrobe.hat, headwear:wardrobe.headwear, pack, dabs, update, setAppearance,
    weather(dt,rain,shelter,heat){shared.uWearWet.value=workwearWetness(shared.uWearWet.value,dt,rain,shelter,heat);}
  };
}
