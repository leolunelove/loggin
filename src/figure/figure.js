// The lumberjack: a wide hat, an open canvas wood pack, and brush strokes that follow the body.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { loadMan } from './man.js';
import {workClothes,tint} from './work-clothes.js';
import {characterPalettes,sanitizeAppearance} from '../appearance.js';
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
uniform float uGrain;uniform float uDistanceHaze;uniform float uCloth;uniform float uTimber;
in vec3 vWorld; in vec3 vN; in vec3 vBind;
layout(location = 0) out vec4 outC;
void main() {
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
  #ifdef TOOL_STEEL
    vec3 eye=normalize(cameraPosition-vWorld),halfDir=normalize(eye+uSunDir);
    float sky=clamp(.55+.25*Nn.y+.19*dot(Nn,uSunDir),0.,1.);
    float reflected=smoothstep(.54+.24*uPolish,.97,dot(Nn,halfDir));
    float grind=texture(tNoise,vec2(vBind.x*28.+vBind.y*9.,vBind.y*3.)).g;
    c=mix(c,mix(uS,uL,sky*.61+.11),.20+.18*uPolish);
    c*=.95+.085*grind;
    c+=uL*reflected*(.08+.24*uPolish)*uDaylight*(1.-.65*uOvercast);
  #endif
  if(uCloth>.5){
    vec3 low=lower?uS2:uS,mid=lower?uM2:uM,high=lower?uL2:uL;
    float skyFill=clamp(.46+Nn.y*.22+dot(Nn,uSunDir)*.23,0.,1.);
    vec3 modelled=mix(low,mid,.22+.55*skyFill);
    c=mix(c,mix(modelled,high,smoothstep(.29,.94,lit)),.52);
  }
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
  outC = vec4(hazeAt(c, vWorld,uDistanceHaze), 1.0);
}
`;

// A palette is [light, half-tone, shade] and, where a lamp is carried, the thing's own colour for its light to fall on.
export function paint(shared, [L, M, S, A = L], { skinned = false, lower = null, split = -10, grain = 2.2, quilted = false, stock = false, polish = null } = {}) {
  const col = (c) => ({ value: new THREE.Color(...c) });
  const [L2, M2, S2, A2 = L2] = lower ?? [L, M, S, A];
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    defines:{...(quilted?{QUILTED:1}:{}),...(stock?{TOOL_STOCK:1}:{}),...(polish!=null?{TOOL_STEEL:1}:{})},
    side: THREE.DoubleSide,
    uniforms: { ...shared,uDistanceHaze:{value:1},uCloth:{value:skinned?1:0},uTimber:{value:stock&&polish==null?1:0},uPolish:{value:polish??0}, uL: col(L), uM: col(M), uS: col(S), uL2: col(L2), uM2: col(M2), uS2: col(S2), uOwn: col(A), uOwn2: col(A2), uSplit: { value: split }, uGrain: { value: grain } },
    vertexShader: skinned ? /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      out vec3 vWorld; out vec3 vN; out vec3 vBind;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 w = modelMatrix * vec4(transformed, 1.0);
        vWorld = w.xyz;
        vN = normalize(mat3(modelMatrix) * objectNormal);
        vBind = position;
        gl_Position = projectionMatrix * viewMatrix * w;
      }` : /* glsl */ `
      out vec3 vWorld; out vec3 vN; out vec3 vBind;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        #ifdef TOOL_STOCK
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
export async function createFigure(shared, onProgress, palettes = {}, appearance = {}) {
  const { PACK, HAT, SHIRT, TROUSERS, SKIN, BOOTS, HAIR, EYES } = { ...DAY, ...palettes };
  const man = await loadMan({ base: './figure/', onProgress });
  for (const mesh of man.meshes) {
    const name = mesh.name + ' ' + (mesh.material?.name ?? '');
    if (/eyelash/.test(name)) { mesh.visible = false; continue; }
    mesh.material = /casualsuit/.test(name) ? paint(shared, SHIRT, { skinned: true, lower: TROUSERS, split: 0.98, grain: 2.6 })
      : /shoes/.test(name) ? paint(shared, BOOTS, { skinned: true })
      : /short01|eyebrow/.test(name) ? paint(shared, HAIR, { skinned: true })
      : /high-poly/.test(name) ? paint(shared, EYES, { skinned: true })
      : paint(shared, SKIN, { skinned: true });
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
  if (suit) parts.push({ mesh: suit, count: 520, style: (p) => ({ pal: p.y < 0.98 ? 1 : 0, size: [0.034, 0.075], dir: Math.abs(p.x) > 0.2 && p.y > 1.3 ? OUT : UP }) });
  // skin only where it shows: the head and neck, and the arms past the sleeves
  if (skin) parts.push({
    mesh: skin, count: 160, accept: (p) => (p.y > 1.52 || Math.abs(p.x) > 0.37) && !(p.y>1.64 && p.y<1.76 && p.z>.065),
    style: (p, n) => (Math.abs(p.x) > 0.37
      ? { pal: 2, size: Math.abs(p.x) > 0.78 ? [0.022, 0.04] : [0.034, 0.08], dir: OUT }
      : { pal: 2, size: [0.013, 0.024], dir: new THREE.Vector3().crossVectors(UP, n).add(new THREE.Vector3(0, 0.3, 0)) }),
  });
  if (shoes) parts.push({ mesh: shoes, count: 70, style: () => ({ pal: 3, size: [0.045, 0.085], dir: FWD }) });
  if (hair) parts.push({ mesh: hair, count: 50, style: () => ({ pal: 4, size: [0.035, 0.07], dir: UP }) });
  const bodyDabs = pinDabs(shared, [SHIRT, TROUSERS, SKIN, BOOTS, HAIR], parts,{surface:true});
  dabs.add(bodyDabs.mesh);

  function update(dt) {
    bodyDabs.update();wardrobe.update();
    pack.update(dt);
  }

  function setAppearance(value) {
    const a=sanitizeAppearance(value),p=characterPalettes(a);
    for(const [mesh,pal,lower] of [[suit,p.SHIRT,TROUSERS],[skin,p.SKIN],[hair,p.HAIR],[partOf(/eyebrow/),p.HAIR]]) if(mesh)tint(mesh.material,pal,lower);
    bodyDabs.setPalette(0,p.SHIRT);bodyDabs.setPalette(2,p.SKIN);bodyDabs.setPalette(4,p.HAIR);
    wardrobe.set(a,p);pack.setCanvas(p.PACK);
  }
  setAppearance(appearance);
  return { man, hat:wardrobe.hat, pack, dabs, update, setAppearance };
}
