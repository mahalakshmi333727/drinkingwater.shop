/* ============================================================
   particles.js — suspended motes and rising bubbles
   Two Points systems, two draw calls. All motion happens in the
   vertex shader, so the CPU never touches the buffers after the
   initial fill. That's what keeps this affordable on a phone.
   ============================================================ */

import { particleVertex, particleFragment } from './shaders.js';

export function buildParticles(THREE, scene, palette, quality, layout) {
  const motes = makeSystem(THREE, {
    count: quality.motes,
    color: palette.particle,
    opacity: 0.55,
    rim: 0.0,
    rise: 0.16,
    span: 30,
    wobble: 0.9,
    sizeRange: [0.9, 2.6],
    spread: (i, position) => {
      position[i * 3] = (Math.random() - 0.5) * 60;
      position[i * 3 + 1] = (Math.random() - 0.5) * 30;
      position[i * 3 + 2] = (Math.random() - 0.5) * 34 - 4;
    }
  });
  motes.points.position.y = 4;
  scene.add(motes.points);

  /* Bubbles are seeded inside the vessels, so they read as gas
     breaking out of water under treatment rather than dust. */
  const columns = layout.length ? layout : [{ x: 0, z: 0, radius: 3, height: 8 }];

  const bubbles = makeSystem(THREE, {
    count: quality.bubbles,
    color: palette.sky,
    opacity: 0.75,
    rim: 1.0,
    rise: 0.95,
    span: 9,
    wobble: 0.22,
    sizeRange: [1.4, 4.2],
    spread: (i, position) => {
      const column = columns[i % columns.length];
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * (column.radius - 0.4);
      position[i * 3] = column.x + Math.cos(angle) * radius;
      position[i * 3 + 1] = (Math.random() - 0.5) * 9;
      position[i * 3 + 2] = column.z + Math.sin(angle) * radius;
    }
  });
  bubbles.points.position.y = 0.9;
  scene.add(bubbles.points);

  const systems = [motes, bubbles];
  let baseMoteOpacity = 0.55;
  let baseBubbleOpacity = 0.75;
  let soundAmount = 0;
  let soundTarget = 0;
  const applyOpacity = () => {
    motes.uniforms.uOpacity.value = baseMoteOpacity * (1 + soundAmount * 0.08);
    bubbles.uniforms.uOpacity.value = baseBubbleOpacity * (1 + soundAmount * 0.16);
  };

  return {
    motes,
    bubbles,

    update(time) {
      soundAmount += (soundTarget - soundAmount) * 0.035;
      applyOpacity();
      systems.forEach((system) => { system.uniforms.uTime.value = time; });
    },

    setPixelRatio(ratio) {
      systems.forEach((system) => { system.uniforms.uPixelRatio.value = ratio; });
    },

    applyPalette(palette) {
      motes.uniforms.uColor.value.set(palette.particle);
      bubbles.uniforms.uColor.value.set(palette.sky);
    },

    // PART 6: make the water read progressively more controlled without hiding it.
    setTreatmentStage(stage) {
      const normalized = stage == null ? 0 : Math.max(0, Math.min(stage, 5));
      baseMoteOpacity = stage == null ? 0.55 : 0.55 - normalized * 0.055;
      baseBubbleOpacity = stage === 4 || stage === 5 ? 0.9 : 0.68;
      applyOpacity();
    },

    // PART 7: keep a small suspended sample visible while clarity is measured.
    setQualityStage(stage) {
      const normalized = stage == null ? 0 : Math.max(0, Math.min(stage, 6));
      baseMoteOpacity = stage == null ? 0.55 : 0.46 - normalized * 0.035;
      baseBubbleOpacity = stage === 2 || stage === 5 ? 0.82 : 0.58;
      applyOpacity();
    },

    // PART 8: keep the clean-zone atmosphere intentionally restrained.
    setHandlingStage(stage) {
      baseMoteOpacity = stage == null ? 0.55 : 0.20;
      baseBubbleOpacity = stage == null ? 0.75 : 0.34;
      applyOpacity();
    },

    // PART 9: quiet the clean storage atmosphere while retaining water motion.
    setStorageStage(stage) {
      baseMoteOpacity = stage == null ? 0.55 : 0.16;
      baseBubbleOpacity = stage == null ? 0.75 : 0.28;
      applyOpacity();
    },

    setMaterialsStage(stage) {
      baseMoteOpacity = stage == null ? 0.55 : 0.22;
      baseBubbleOpacity = stage == null ? 0.75 : 0.30;
      applyOpacity();
    },

    // PART 11: reduce suspended activity as the journey reaches daily use.
    setHabitsStage(stage) {
      baseMoteOpacity = stage == null ? 0.55 : 0.10;
      baseBubbleOpacity = stage == null ? 0.75 : 0.18;
      applyOpacity();
    },

    // PART 12: soften the atmosphere as attention narrows to the drop.
    setFinaleStage(progress) {
      const amount = progress == null ? 0 : Math.max(0, Math.min(progress, 1));
      baseMoteOpacity = 0.10 * (1 - amount * 0.55);
      baseBubbleOpacity = 0.16 * (1 - amount * 0.55);
      applyOpacity();
    },

    // PART 13: gently increase suspended water activity while sound is on.
    setSoundStage(enabled) {
      soundTarget = enabled ? 1 : 0;
    },

    dispose() {
      systems.forEach((system) => {
        system.geometry.dispose();
        system.material.dispose();
        scene.remove(system.points);
      });
    }
  };
}

function makeSystem(THREE, options) {
  const { count, sizeRange, spread } = options;

  const position = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const scale = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    spread(i, position);
    seed[i] = Math.random();
    scale[i] = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geometry.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    uRise: { value: options.rise },
    uSpan: { value: options.span },
    uWobble: { value: options.wobble },
    uColor: { value: new THREE.Color(options.color) },
    uOpacity: { value: options.opacity },
    uRim: { value: options.rim }
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 6;

  return { points, geometry, material, uniforms };
}
