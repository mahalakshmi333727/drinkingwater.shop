/* ============================================================
   rain-water.js — Part 13: sound-reactive rain and waterfall layer
   One lightweight geometry group, updated by the existing scene loop.
   It stays dormant until the sound control is enabled.
   ============================================================ */

export function buildRainWater(THREE, scene, palette, quality) {
  const mobile = quality.tier !== 'high';
  const rainCount = mobile ? 110 : 240;
  const fallCount = mobile ? 28 : 52;
  const splashCount = mobile ? 12 : 24;
  const rainData = createRainData(rainCount);
  const fallData = createFallData(fallCount);
  const splashData = createSplashData(splashCount);

  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainData.positions, 3));
  const rainMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(palette.sky),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
  rain.frustumCulled = false;
  rain.renderOrder = 8;

  const fallGeometry = new THREE.BufferGeometry();
  fallGeometry.setAttribute('position', new THREE.BufferAttribute(fallData.positions, 3));
  const fallMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(palette.shallowWater),
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const waterfall = new THREE.LineSegments(fallGeometry, fallMaterial);
  waterfall.frustumCulled = false;
  waterfall.renderOrder = 7;

  const splashGeometry = new THREE.BufferGeometry();
  splashGeometry.setAttribute('position', new THREE.BufferAttribute(splashData.positions, 3));
  const splashMaterial = new THREE.PointsMaterial({
    color: new THREE.Color(palette.sky),
    size: mobile ? 0.045 : 0.065,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const splashes = new THREE.Points(splashGeometry, splashMaterial);
  splashes.frustumCulled = false;
  splashes.renderOrder = 8;

  const group = new THREE.Group();
  group.add(rain, waterfall, splashes);
  scene.add(group);

  let soundAmount = 0;
  let soundTarget = 0;
  let lastRipple = -10;

  return {
    group,

    update(time, ripple) {
      soundAmount += (soundTarget - soundAmount) * 0.045;
      if (soundTarget === 0 && soundAmount < 0.001) return;
      updateRain(rainData, rainGeometry.attributes.position.array, time, soundAmount);
      updateWaterfall(fallData, fallGeometry.attributes.position.array, time, soundAmount);
      updateSplashes(splashData, splashGeometry.attributes.position.array, time, soundAmount);
      rainGeometry.attributes.position.needsUpdate = true;
      fallGeometry.attributes.position.needsUpdate = true;
      splashGeometry.attributes.position.needsUpdate = true;

      rainMaterial.opacity = 0.07 * soundAmount;
      fallMaterial.opacity = 0.19 * soundAmount;
      splashMaterial.opacity = 0.28 * soundAmount;

      if (soundAmount > 0.72 && time - lastRipple > 2.8) {
        lastRipple = time;
        ripple?.(15.6, 2.2, time, 0.18);
      }
    },

    setSoundStage(enabled) {
      soundTarget = enabled ? 1 : 0;
      if (!enabled) {
        rainMaterial.opacity = 0;
        fallMaterial.opacity = 0;
        splashMaterial.opacity = 0;
      }
    },

    applyPalette(nextPalette) {
      rainMaterial.color.set(nextPalette.sky);
      fallMaterial.color.set(nextPalette.shallowWater);
      splashMaterial.color.set(nextPalette.sky);
    },

    dispose() {
      rainGeometry.dispose();
      rainMaterial.dispose();
      fallGeometry.dispose();
      fallMaterial.dispose();
      splashGeometry.dispose();
      splashMaterial.dispose();
      scene.remove(group);
    }
  };
}

function createRainData(count) {
  const positions = new Float32Array(count * 6);
  const drops = [];
  for (let index = 0; index < count; index += 1) {
    const x = (Math.random() - 0.5) * 38;
    const y = Math.random() * 22 - 3;
    const z = Math.random() * 22 - 15;
    drops.push({ x, y, z, length: 0.10 + Math.random() * 0.36, speed: 3.2 + Math.random() * 4.6, phase: Math.random() * 10 });
    writeSegment(positions, index, x, y, z, x, y - drops[index].length, z);
  }
  return { positions, drops };
}

function createFallData(count) {
  const positions = new Float32Array(count * 6);
  const streams = [];
  for (let index = 0; index < count; index += 1) {
    const x = 14.2 + Math.random() * 2.8;
    const z = 1.2 + Math.random() * 2.3;
    streams.push({ x, z, y: Math.random() * 8 - 3.2, speed: 1.5 + Math.random() * 1.8, length: 0.65 + Math.random() * 1.1, phase: Math.random() * 8 });
    writeSegment(positions, index, x, streams[index].y, z, x + (Math.random() - 0.5) * 0.05, streams[index].y - streams[index].length, z);
  }
  return { positions, streams };
}

function createSplashData(count) {
  const positions = new Float32Array(count * 3);
  const splashes = [];
  for (let index = 0; index < count; index += 1) {
    splashes.push({ angle: Math.random() * Math.PI * 2, radius: Math.random() * 0.85, phase: Math.random() * 6, speed: 0.5 + Math.random() * 0.8 });
    positions[index * 3] = 15.6;
    positions[index * 3 + 1] = -3.1;
    positions[index * 3 + 2] = 2.2;
  }
  return { positions, splashes };
}

function updateRain(data, positions, time, amount) {
  data.drops.forEach((drop, index) => {
    const travel = (time * drop.speed + drop.phase) % 25;
    const y = 18 - travel;
    const visible = amount * (0.65 + Math.sin(time * 0.8 + drop.phase) * 0.12);
    const x = drop.x + Math.sin(time * 0.22 + drop.phase) * 0.08 * visible;
    writeSegment(positions, index, x, y, drop.z, x, y - drop.length, drop.z);
  });
}

function updateWaterfall(data, positions, time, amount) {
  data.streams.forEach((stream, index) => {
    const travel = (time * stream.speed + stream.phase) % 10;
    const y = 5.6 - travel;
    const sway = Math.sin(time * 1.2 + stream.phase) * 0.09 * amount;
    writeSegment(positions, index, stream.x + sway, y, stream.z, stream.x + sway * 1.3, y - stream.length, stream.z);
  });
}

function updateSplashes(data, positions, time, amount) {
  data.splashes.forEach((splash, index) => {
    const phase = (time * splash.speed + splash.phase) % 2.4;
    const spread = splash.radius * Math.min(phase, 1.2) * amount;
    positions[index * 3] = 15.6 + Math.cos(splash.angle) * spread;
    positions[index * 3 + 1] = -3.08 + Math.sin(phase * 4 + splash.phase) * 0.16 * amount;
    positions[index * 3 + 2] = 2.2 + Math.sin(splash.angle) * spread;
  });
}

function writeSegment(positions, index, x1, y1, z1, x2, y2, z2) {
  const offset = index * 6;
  positions[offset] = x1;
  positions[offset + 1] = y1;
  positions[offset + 2] = z1;
  positions[offset + 3] = x2;
  positions[offset + 4] = y2;
  positions[offset + 5] = z2;
}
