// The lumberjack: a wide hat, an open canvas wood pack, and brush strokes that follow the body.
import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { dabMaterial, dabGeometry, dabMesh } from '../oilpaint/dabs.js';
import { loadMan } from './man.js';
import { createWoodPack } from './pack.js';
import { pinDabs } from '../oilpaint/pins.js';

const PAINT_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uL; uniform vec3 uM; uniform vec3 uS;
uniform vec3 uL2; uniform vec3 uM2; uniform vec3 uS2;
uniform vec3 uOwn; uniform vec3 uOwn2;
uniform float uSplit;
uniform float uGrain;
in vec3 vWorld; in vec3 vN; in vec3 vBind;
layout(location = 0) out vec4 outC;
void main() {
  vec3 Nn = normalize(vN);
  if (!gl_FrontFacing) Nn = -Nn;
  float n = texture(tNoise, vBind.xy * uGrain + vBind.z * 1.7).r;
  float m = texture(tNoise, vBind.yx * uGrain * 0.31 + 0.4).g;
  float lit = sunAt(vWorld + Nn * 0.08) * clamp(dot(Nn, uSunDir) * 0.85 + 0.42, 0.0, 1.0);
  bool lower = vBind.y < uSplit + (n - 0.5) * 0.05;
  vec3 c = lower ? paint3(uL2, uM2, uS2, lit, n) : paint3(uL, uM, uS, lit, n);
  // light thrown up by the ground (warm, off the leaves), cool light from the sky into the shade
  c += uBounce * max(-Nn.y, 0.0) * (1.0 - lit);
  c = mix(c, c * vec3(0.86, 0.92, 1.18), (1.0 - lit) * max(Nn.y, 0.0) * 0.6);
  c *= 0.88 + 0.24 * m;
  if (!gl_FrontFacing) c *= 0.62;
  c += (lower ? uOwn2 : uOwn) * uLampCol * lampAt(vWorld, Nn);
  outC = vec4(hazed(c, vWorld), 1.0);
}
`;

// A palette is [light, half-tone, shade] and, where a lamp is carried, the thing's own colour for its light to fall on.
export function paint(shared, [L, M, S, A = L], { skinned = false, lower = null, split = -10, grain = 2.2 } = {}) {
  const col = (c) => ({ value: new THREE.Color(...c) });
  const [L2, M2, S2, A2 = L2] = lower ?? [L, M, S, A];
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide,
    uniforms: { ...shared, uL: col(L), uM: col(M), uS: col(S), uL2: col(L2), uM2: col(M2), uS2: col(S2), uOwn: col(A), uOwn2: col(A2), uSplit: { value: split }, uGrain: { value: grain } },
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
        vBind = vec3(uv * 0.6, 0.0);
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
export async function createFigure(shared, onProgress, palettes = {}) {
  const { PACK, HAT, SHIRT, TROUSERS, SKIN, BOOTS, HAIR, EYES } = { ...DAY, ...palettes };
  const own = (p) => `vec3(${p[3] ?? p[0]})`;
  const man = await loadMan({ base: './figure/', onProgress });
  for (const mesh of man.meshes) {
    const name = mesh.name + ' ' + (mesh.material?.name ?? '');
    if (/eyebrow|eyelash/.test(name)) { mesh.visible = false; continue; }
    mesh.material = /casualsuit/.test(name) ? paint(shared, SHIRT, { skinned: true, lower: TROUSERS, split: 0.98, grain: 2.6 })
      : /shoes/.test(name) ? paint(shared, BOOTS, { skinned: true })
      : /short01/.test(name) ? paint(shared, HAIR, { skinned: true })
      : /high-poly/.test(name) ? paint(shared, EYES, { skinned: true })
      : paint(shared, SKIN, { skinned: true });
    mesh.layers.enable(1);
    mesh.frustumCulled = false;
  }
  const dabs = new THREE.Group();

  // --- the hat: a low crown and a wide brim, set on while he still stands in the pose he was made in ---
  man.object.updateMatrixWorld(true);
  const profile = [[0, 0.15], [0.05, 0.143], [0.095, 0.11], [0.118, 0.05], [0.125, 0.0], [0.21, -0.035], [0.3, -0.075], [0.37, -0.105]].map(([r, y]) => new THREE.Vector2(r, y));
  const hat = new THREE.Mesh(new THREE.LatheGeometry(profile, 22), paint(shared, HAT, { grain: 3 }));
  hat.position.set(0, 1.805, -0.012);
  hat.rotation.x = -0.1;
  hat.layers.enable(1);
  man.object.add(hat);
  hat.updateMatrixWorld(true);
  man.bones.Head.attach(hat);
  {
    const n = 460, pos = new Float32Array(n * 3), dir = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i * 2.399963) % (Math.PI * 2), brim = i % 3 !== 0;
      const r = brim ? 0.15 + 0.2 * ((i * 0.618) % 1) : 0.03 + 0.085 * ((i * 0.618) % 1);
      const y = brim ? -(r - 0.125) * 0.42 : 0.15 - r * 0.6;
      pos.set([Math.cos(a) * r, y + 0.006, Math.sin(a) * r], i * 3);
      dir.set([-Math.sin(a), 0, Math.cos(a)], i * 3);
      nrm.set(brim ? [Math.cos(a) * 0.45, 1, Math.sin(a) * 0.45] : [Math.cos(a) * 0.7, 0.7, Math.sin(a) * 0.7], i * 3);
    }
    const mesh = dabMesh(dabGeometry(n, { aPos: [pos, 3], aDir: [dir, 3], aNrm: [nrm, 3] }), dabMaterial(shared, {
      head: /* glsl */ `in vec3 aPos; in vec3 aDir; in vec3 aNrm; uniform mat4 uHat;`,
      body: /* glsl */ `
        void makeDab(inout Dab d) {
          vec4 r = hash4(float(gl_InstanceID) * 3.7 + 1.0);
          vec3 P = (uHat * vec4(aPos, 1.0)).xyz;
          vec3 Nn = normalize(mat3(uHat) * aNrm);
          float lit = sunAt(P + Nn * 0.1) * clamp(dot(Nn, uSunDir) * 0.85 + 0.42, 0.0, 1.0);
          vec3 c = jitter(paint3(vec3(${HAT[0]}), vec3(${HAT[1]}), vec3(${HAT[2]}), lit, r.x), r.yzw, 0.4);
          c += ${own(HAT)} * uLampCol * lampAt(P, Nn);
          d.pos = P; d.dir = mat3(uHat) * aDir;
          d.size = vec2(0.065, 0.15) * (0.8 + 0.5 * r.y);
          d.turnabout = 1.0;
          d.c1 = hazed(c, P); d.c2 = hazed(c * 1.25, P);
          d.seed = float(gl_InstanceID); d.lift = 0.4;
        }`,
      uniforms: { uHat: { value: hat.matrixWorld } },
      minPx: [3, 6], maxPx: [200, 400], cells: [0, 4],
    }), 5);
    dabs.add(mesh);
  }

  const pack=createWoodPack(shared,man,{paint,canvasPalette:palettes.PACK??palettes.CLOAK??PACK});
  dabs.add(pack.paint.mesh);

  // --- paint on the body itself: pins on his clothes, skin, boots and hair ---
  const partOf = (re) => man.meshes.find((m) => re.test(m.name));
  const UP = new THREE.Vector3(0, 1, 0), OUT = new THREE.Vector3(1, 0, 0), FWD = new THREE.Vector3(0, 0, 1);
  const parts = [];
  const suit = partOf(/casualsuit/), skin = partOf(/generic/), shoes = partOf(/shoes/), hair = partOf(/short01/);
  // he was made standing with his arms straight out: a sleeve runs sideways, everything else runs down
  if (suit) parts.push({ mesh: suit, count: 520, style: (p) => ({ pal: p.y < 0.98 ? 1 : 0, size: [0.055, 0.12], dir: Math.abs(p.x) > 0.2 && p.y > 1.3 ? OUT : UP }) });
  // skin only where it shows: the head and neck, and the arms past the sleeves
  if (skin) parts.push({
    mesh: skin, count: 230, accept: (p) => p.y > 1.52 || Math.abs(p.x) > 0.37,
    style: (p, n) => (Math.abs(p.x) > 0.37
      ? { pal: 2, size: Math.abs(p.x) > 0.78 ? [0.022, 0.04] : [0.034, 0.08], dir: OUT }
      : { pal: 2, size: [0.028, 0.05], dir: new THREE.Vector3().crossVectors(UP, n).add(new THREE.Vector3(0, 0.3, 0)) }),
  });
  if (shoes) parts.push({ mesh: shoes, count: 70, style: () => ({ pal: 3, size: [0.045, 0.085], dir: FWD }) });
  if (hair) parts.push({ mesh: hair, count: 50, style: () => ({ pal: 4, size: [0.035, 0.07], dir: UP }) });
  const bodyDabs = pinDabs(shared, [SHIRT, TROUSERS, SKIN, BOOTS, HAIR], parts);
  dabs.add(bodyDabs.mesh);

  function update(dt) {
    bodyDabs.update();
    pack.update(dt);
  }

  return { man, hat, pack, dabs, update };
}
