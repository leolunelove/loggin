// Paint on the wanderer himself. A few hundred dabs are pinned to points of his clothes, skin, boots and hair and
// carried with them as he moves: each frame every pin is put through the same bones as the skin it sits on, along
// with the way its stroke runs (down a leg, along a sleeve, round the head) and the way its surface faces.
import * as THREE from 'three';
import { dabMaterial, dabGeometry, dabMesh } from './dabs.js';

/**
 * palettes: [[light, half-tone, shade, (its own colour, for a lamp's light)], ...]. parts: [{ mesh, count, accept(p), style(p, n) -> { pal, size: [across, along], dir } }],
 * where p and n are a point of the mesh and its normal in the pose it was made in.
 */
export function pinDabs(shared, palettes, parts, {surface=false}={}) {
  let seed = 9151;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pins = [], batches = [];
  const normalMatrix = new THREE.Matrix3(), linear = new THREE.Matrix3(), bindWorld = new THREE.Matrix4();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const part of parts) {
    const g = part.mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal, index = g.index;
    const tris = index ? index.count / 3 : pos.count / 3;
    const at = (t, k) => (index ? index.getX(t * 3 + k) : t * 3 + k);
    // larger faces are chosen more often, so the pins are spread evenly over the surface
    const sums = new Float32Array(tris);
    let total = 0;
    for (let t = 0; t < tris; t++) {
      a.fromBufferAttribute(pos, at(t, 0)); b.fromBufferAttribute(pos, at(t, 1)); c.fromBufferAttribute(pos, at(t, 2));
      total += b.sub(a).cross(c.sub(a)).length();
      sums[t] = total;
    }
    if (!total) continue;
    const batch = { mesh: part.mesh, first: pins.length, bones: new Map(), lastWorld: new THREE.Matrix4(), visible: null };
    batches.push(batch);
    for (let made = 0, tries = 0; made < part.count && tries < part.count * 40; tries++) {
      const want = rand() * total;
      let lo = 0, hi = tris - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sums[mid] < want) lo = mid + 1; else hi = mid; }
      const verts = [at(lo, 0), at(lo, 1), at(lo, 2)];
      const root = Math.sqrt(rand()), v = rand(), bary = [1 - root, root * (1 - v), root * v];
      const p = new THREE.Vector3(), n = new THREE.Vector3();
      for (let j = 0; j < 3; j++) {
        p.addScaledVector(a.fromBufferAttribute(pos, verts[j]), bary[j]);
        n.addScaledVector(b.fromBufferAttribute(nrm, verts[j]), bary[j]);
      }
      if (part.accept && !part.accept(p)) continue;
      n.normalize();
      const s = part.style(p, n);
      const pin = { p, n, d: s.dir.clone().normalize(), pal: s.pal, size: s.size, seed: rand() * 1000 };
      // Skin the surface point as the weighted sum of the three deformed corners.
      // Combining each bone's contribution here keeps the per-frame work small.
      if (part.mesh.isSkinnedMesh) {
        const influences = new Map();
        for (let j = 0; j < 3; j++) {
          const vertex = verts[j];
          a.fromBufferAttribute(pos, vertex); b.fromBufferAttribute(nrm, vertex);
          for (let k = 0; k < 4; k++) {
            const weight = bary[j] * g.attributes.skinWeight.getComponent(vertex, k);
            if (!weight) continue;
            const id = g.attributes.skinIndex.getComponent(vertex, k);
            if (!batch.bones.has(id)) batch.bones.set(id, { id, world: new THREE.Matrix4(), normal: new THREE.Matrix3(), linear: new THREE.Matrix3() });
            if (!influences.has(id)) influences.set(id, { bone: batch.bones.get(id), p: new THREE.Vector3(), n: new THREE.Vector3(), weight: 0 });
            const influence = influences.get(id);
            influence.p.addScaledVector(a, weight); influence.n.addScaledVector(b, weight); influence.weight += weight;
          }
        }
        pin.influences = [...influences.values()];
        for (const inf of pin.influences) inf.p.divideScalar(inf.weight);
      }
      pins.push(pin);
      made++;
    }
    batch.end = pins.length;
  }
  const count = pins.length;
  const aVisible = new Float32Array(count).fill(1);
  const aPos = new Float32Array(count * 3), aDir = new Float32Array(count * 3), aNrm = new Float32Array(count * 3), aData = new Float32Array(count * 4);
  pins.forEach((pin, i) => aData.set([pin.seed, pin.size[0], pin.size[1], pin.pal], i * 4));
  const geometry = dabGeometry(count, { aPos: [aPos, 3], aDir: [aDir, 3], aNrm: [aNrm, 3], aVisible: [aVisible, 1] }, true);
  geometry.setAttribute('aData', new THREE.InstancedBufferAttribute(aData, 4));
  const colors = k => ({value: palettes.map(p => new THREE.Vector3(...(p[k] ?? p[0])))});
  const paletteUniforms = {FIG_L:colors(0), FIG_M:colors(1), FIG_S:colors(2), FIG_A:colors(3)};
  const n = palettes.length;
  const mesh = dabMesh(geometry, dabMaterial(shared, {
    head: /* glsl */ `
      in vec3 aPos; in vec3 aDir; in vec3 aNrm; in vec4 aData; in float aVisible;
      uniform float uWearWet; uniform vec3 FIG_L[${n}], FIG_M[${n}], FIG_S[${n}], FIG_A[${n}];`,
    uniforms: {...paletteUniforms,uWearWet:shared.uWearWet??shared.uRain??{value:0}},
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        if (aVisible < 0.5) { d.alive = 0.0; return; }
        vec3 Nn = normalize(aNrm);
        // on the far side of him: not ours to paint
        if (dot(Nn, normalize(cameraPosition - aPos)) < -0.05) { d.alive = 0.0; return; }
        vec4 r = hash4(aData.x);
        int k = int(aData.w + 0.5);
        float lit = sunAt(aPos + Nn * 0.08) * clamp(dot(Nn, uSunDir) * 0.85 + 0.42, 0.0, 1.0);
        vec3 c = paint3(FIG_L[k], FIG_M[k], FIG_S[k], lit, r.x);
        ${surface?`float sky=clamp(.49+.30*Nn.y+.17*dot(Nn,uSunDir),0.,1.);
        vec3 fill=mix(FIG_S[k],FIG_M[k],.26+.59*sky);
        c=mix(c,mix(fill,FIG_L[k],smoothstep(.25,.97,lit)),.66);`:''}
        // warm light thrown up by the leaves on the ground, cool light from the sky into the shade
        c += uBounce * max(-Nn.y, 0.0) * (1.0 - lit);
        c = mix(c, c * vec3(0.86, 0.92, 1.18), (1.0 - lit) * max(Nn.y, 0.0) * 0.6);
        c = jitter(c, r.yzw, ${surface?'0.30':'0.45'});
        c += FIG_A[k] * uLampCol * lampAt(aPos, Nn);
        d.pos = aPos;
        d.dir = aDir;
        d.size = aData.yz * (0.8 + 0.45 * r.y);
        ${surface?`c*=1.-uWearWet*(.115+.10*max(Nn.y,0.));
        d.c1=hazeFacing(c,aPos,1.,Nn,.87);
        d.c2=hazeFacing(jitter(c*1.085,r.wxy,.23),aPos,1.,Nn,.87);`:`d.c1=hazed(c,aPos);
        d.c2=hazed(jitter(c*1.22,r.wxy,.5),aPos);`}
        d.seed = aData.x;
        ${surface?'d.lie = 1.0; d.nrm = Nn; d.height = 0.0009;':'d.lift = 0.3;'}
        d.turnabout = 1.0;
      }`,
    pigment:surface, minPx: surface ? [0.62,1.25] : [2.5,4], maxPx: [200, 400], cells: [0, 6],
  }), 5);

  const worldPos = new THREE.Vector3(), worldNormal = new THREE.Vector3(), worldDir = new THREE.Vector3();
  return {
    mesh,
    count,
    setPalette(index,palette) {
      Object.values(paletteUniforms).forEach((u,k)=>u.value[index].set(...(palette[k]??palette[0])));
    },
    update() {
      let moved = false, visibilityChanged = false;
      for (const batch of batches) {
        const m = batch.mesh;
        let visible = true;
        for (let node = m; node && visible; node = node.parent) visible = node.visible;
        const changed = visible !== batch.visible;
        if (changed) {
          aVisible.fill(visible ? 1 : 0, batch.first, batch.end);
          batch.visible = visible; visibilityChanged = true;
        }
        if (!visible || (!m.isSkinnedMesh && !changed && batch.lastWorld.equals(m.matrixWorld))) continue;
        moved = true;
        if (m.isSkinnedMesh) {
          bindWorld.multiplyMatrices(m.matrixWorld, m.bindMatrixInverse);
          for (const bone of batch.bones.values()) {
            bone.world.copy(bindWorld).multiply(m.skeleton.bones[bone.id].matrixWorld)
              .multiply(m.skeleton.boneInverses[bone.id]).multiply(m.bindMatrix);
            bone.normal.getNormalMatrix(bone.world); bone.linear.setFromMatrix4(bone.world);
          }
        } else {
          batch.lastWorld.copy(m.matrixWorld);
          normalMatrix.getNormalMatrix(m.matrixWorld); linear.setFromMatrix4(m.matrixWorld);
        }
        for (let i = batch.first; i < batch.end; i++) {
          const pin = pins[i], k = i * 3;
          if (pin.influences) {
            worldPos.set(0, 0, 0); worldNormal.set(0, 0, 0); worldDir.set(0, 0, 0);
            for (const inf of pin.influences) {
              worldPos.addScaledVector(a.copy(inf.p).applyMatrix4(inf.bone.world), inf.weight);
              worldNormal.add(b.copy(inf.n).applyMatrix3(inf.bone.normal));
              worldDir.addScaledVector(c.copy(pin.d).applyMatrix3(inf.bone.linear), inf.weight);
            }
          } else {
            worldPos.copy(pin.p).applyMatrix4(m.matrixWorld);
            worldNormal.copy(pin.n).applyMatrix3(normalMatrix);
            worldDir.copy(pin.d).applyMatrix3(linear);
          }
          worldPos.toArray(aPos, k); worldNormal.toArray(aNrm, k); worldDir.toArray(aDir, k);
        }
      }
      if (moved) for (const name of ['aPos', 'aDir', 'aNrm']) geometry.attributes[name].needsUpdate = true;
      if (visibilityChanged) geometry.attributes.aVisible.needsUpdate = true;
    },
  };
}
