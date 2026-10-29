/* ============================================================
   environment.js — palette, lighting rig, volumetric lamps
   ============================================================ */

import { volumeVertex, volumeFragment } from './shaders.js';

export const PALETTE = {
  deep: {
    fog: 0x02080f,
    deepWater: 0x04203a,
    shallowWater: 0x1d7f92,
    sky: 0x9fe6f0,
    key: 0x8fdcff,
    fill: 0x2f6fae,
    lamp: 0x63e4de,
    glass: 0xbfe6f5,
    particle: 0x9fe4ee,
    dropCore: 0xe6ffff,
    dropRim: 0x3fd9c9,
    exposure: 1.05,
    fogNear: 22,
    fogFar: 78
  },
  lab: {
    fog: 0xeef5f9,
    deepWater: 0x7fb6cc,
    shallowWater: 0xd6eef4,
    sky: 0xffffff,
    key: 0xffffff,
    fill: 0xbcd9e8,
    lamp: 0x3fb8b8,
    glass: 0xffffff,
    particle: 0x2c7f94,
    dropCore: 0xffffff,
    dropRim: 0x0b8c8c,
    exposure: 1.2,
    fogNear: 26,
    fogFar: 92
  }
};

export function paletteFor(themeName) {
  return themeName === 'lab' ? PALETTE.lab : PALETTE.deep;
}

/* ------------------------------------------------------------
   A tiny gradient environment. Cheaper than loading an HDRI and
   enough to give the glass something believable to reflect.
   ------------------------------------------------------------ */
export function buildEnvironment(THREE, renderer, palette) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0.00, hex(palette.sky));
  gradient.addColorStop(0.42, hex(palette.fill));
  gradient.addColorStop(0.62, hex(palette.lamp));
  gradient.addColorStop(1.00, hex(palette.deepWater));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // two soft lamp hotspots, so reflections have somewhere to catch
  ctx.globalCompositeOperation = 'lighter';
  [[size * 0.28, size * 0.22], [size * 0.74, size * 0.30]].forEach(([x, y]) => {
    const spot = ctx.createRadialGradient(x, y, 0, x, y, size * 0.26);
    spot.addColorStop(0, 'rgba(255,255,255,0.85)');
    spot.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, size, size);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromEquirectangular(texture).texture;

  pmrem.dispose();
  texture.dispose();

  return envMap;
}

/* ------------------------------------------------------------
   Lighting rig
   Key from above front, cool fill from behind, plus a hemisphere
   so the glass edges never go fully black.
   ------------------------------------------------------------ */
export function buildLights(THREE, scene, palette) {
  const hemi = new THREE.HemisphereLight(palette.sky, palette.deepWater, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(palette.key, 1.15);
  key.position.set(6, 14, 8);
  scene.add(key);

  const fill = new THREE.DirectionalLight(palette.fill, 0.55);
  fill.position.set(-9, 5, -7);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(palette.lamp, 0.45);
  rim.position.set(0, 3, -12);
  scene.add(rim);

  return { hemi, key, fill, rim };
}

/* ------------------------------------------------------------
   Volumetric lamp cones above the tanks
   ------------------------------------------------------------ */
export function buildVolumetrics(THREE, scene, palette, quality, positions) {
  const cones = [];
  const count = Math.min(quality.volumetrics, positions.length);

  for (let i = 0; i < count; i += 1) {
    const [x, z] = positions[i];
    const height = 13;

    // open-ended cylinder, wider at the base than the lamp
    const geometry = new THREE.CylinderGeometry(0.55, 4.4, height, 26, 1, true);

    const material = new THREE.ShaderMaterial({
      vertexShader: volumeVertex,
      fragmentShader: volumeFragment,
      uniforms: {
        uColor: { value: new THREE.Color(palette.lamp) },
        uOpacity: { value: 0.16 },
        uTime: { value: 0 }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    const cone = new THREE.Mesh(geometry, material);
    // the shader wants uv.y = 1 at the lamp, which is the cylinder's top
    cone.position.set(x, height * 0.5 - 1.2, z);
    cone.renderOrder = 2;
    scene.add(cone);

    // a small emissive plate where the lamp itself sits
    const lampGeo = new THREE.CircleGeometry(0.62, 20);
    const lampMat = new THREE.MeshBasicMaterial({
      color: palette.lamp,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(x, height - 1.2, z);
    scene.add(lamp);

    cones.push({ cone, material, lamp, lampMat });
  }

  return cones;
}

function hex(value) {
  return `#${value.toString(16).padStart(6, '0')}`;
}
