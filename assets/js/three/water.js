/* ============================================================
   water.js — the tank surface
   A displaced plane driven by four travelling waves. No solver,
   no simulation buffers: it runs the same on a phone as a laptop,
   only with fewer segments.
   ============================================================ */

import { waterVertex, waterFragment } from './shaders.js';

export function buildWater(THREE, scene, palette, quality) {
  const size = 92;
  const segments = quality.waterSegments;

  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);

  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 1.0 },
    uSound: { value: 0 },
    uDetail: { value: quality.waterDetail },
    uRipple: { value: new THREE.Vector4(0, 0, -100, 0) },
    uDeep: { value: new THREE.Color(palette.deepWater) },
    uShallow: { value: new THREE.Color(palette.shallowWater) },
    uSky: { value: new THREE.Color(palette.sky) },
    uLightDir: { value: new THREE.Vector3(6, 14, 8).normalize() },
    uOpacity: { value: 0.92 }
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -3.4;
  mesh.renderOrder = 0;
  scene.add(mesh);

  let soundTarget = 0;

  return {
    mesh,
    material,
    uniforms,

    /** Kick a ripple at a world position — used when the droplet lands. */
    ripple(worldX, worldZ, time, strength = 0.85) {
      uniforms.uRipple.value.set(worldX, worldZ, time, strength);
    },

    update(time) {
      uniforms.uTime.value = time;
      uniforms.uSound.value += (soundTarget - uniforms.uSound.value) * 0.035;
    },

    // PART 6: a restrained clarity shift for the laboratory sequence.
    setTreatmentStage(stage) {
      uniforms.uAmp.value = stage == null ? 1.0 : 1.0 - Math.max(0, Math.min(stage, 5)) * 0.06;
    },

    // PART 7: soften surface movement as the sample is read and compared.
    setQualityStage(stage) {
      uniforms.uAmp.value = stage == null ? 1.0 : 0.92 - Math.max(0, Math.min(stage, 6)) * 0.025;
    },

    // PART 8: calm the surface as water enters the clean handling line.
    setHandlingStage(stage) {
      uniforms.uAmp.value = stage == null ? 1.0 : 0.78;
    },

    // PART 9: keep the stored-water surface calm and legible.
    setStorageStage(stage) {
      uniforms.uAmp.value = stage == null ? 1.0 : 0.70;
    },

    setMaterialsStage(stage) {
      uniforms.uAmp.value = stage == null ? 1.0 : 0.74;
    },

    // PART 11: slow the surface into a settled, everyday-use rhythm.
    setHabitsStage(stage) {
      uniforms.uAmp.value = stage == null ? 1.0 : 0.56;
    },

    // PART 12: settle the existing water surface for the final ripple.
    setFinaleStage(progress) {
      uniforms.uAmp.value = progress == null ? 1.0 : 0.42;
    },

    // PART 13: let enabled ambience add only a barely perceptible surface lift.
    setSoundStage(enabled) {
      soundTarget = enabled ? 1 : 0;
    },

    applyPalette(palette) {
      uniforms.uDeep.value.set(palette.deepWater);
      uniforms.uShallow.value.set(palette.shallowWater);
      uniforms.uSky.value.set(palette.sky);
    },

    setQuality(nextQuality) {
      uniforms.uDetail.value = nextQuality.waterDetail;
    },

    dispose() {
      geometry.dispose();
      material.dispose();
      scene.remove(mesh);
    }
  };
}
