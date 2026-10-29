/* ============================================================
   three-scene.js — the persistent purification facility
   ------------------------------------------------------------
   Composition:
     water.js       animated tank surface
     chambers.js    glass vessels, media beds, lab framework
     pipes.js       transparent transfer lines with flow pulses
     particles.js   suspended motes + rising bubbles
     droplet.js     the glowing drop, which ripples the water
     environment.js palette, lights, volumetric lamps
     quality.js     device tiering and the runtime perf guard

   The canvas is fixed behind the page, has pointer-events: none,
   and never receives input — every control on the page stays
   clickable. Nothing here reads or writes the DOM apart from the
   canvas, the theme attribute, and scroll position.
   ============================================================ */

import { detectQuality, createPerformanceGuard } from './quality.js';
import { paletteFor, buildEnvironment, buildLights, buildVolumetrics } from './environment.js';
import { buildWater } from './water.js';
import { buildChambers, CHAMBER_LAYOUT } from './chambers.js';
import { buildPipes } from './pipes.js';
import { buildParticles } from './particles.js';
import { buildDroplet } from './droplet.js';
import { buildRainWater } from './rain-water.js';
import { createJourneyTracker, WAYPOINTS } from './journey.js';

const WATER_Y = -3.4;

const LANDSCAPE_WAYPOINTS = {
  source: { pos: [-7.6, 1.8, -18.6], look: [-7.6, 1.8, -25] },
  purification: { pos: [-3.9, 1.8, -19.1], look: [-3.9, 1.8, -25] },
  laboratory: { pos: [0.1, 1.8, -19.2], look: [0.1, 1.8, -25] },
  quality: { pos: [3.7, 1.8, -19.0], look: [3.7, 1.8, -25] },
  handling: { pos: [7.5, 1.8, -19.0], look: [7.5, 1.8, -25] },
  storage: { pos: [-2.3, 1.8, -21.0], look: [-2.3, 1.8, -25] },
  materials: { pos: [2.6, 1.8, -21.0], look: [2.6, 1.8, -25] }
};

/* Hand the main thread back to the browser so input and painting are never
   blocked by one long synchronous scene build. */
const yieldToMain = () => new Promise((resolve) => {
  if (typeof requestAnimationFrame === 'function' && !document.hidden) requestAnimationFrame(() => setTimeout(resolve, 0));
  else setTimeout(resolve, 0);
});

export async function initWaterFacility(canvas, options = {}) {
  if (!canvas || !supportsWebGL()) return null;

  const THREE = await import('three');
  const reducedMotion = options.reducedMotion === true;
  const previewCanvas = document.querySelector('[data-landscape-preview-canvas]');

  let quality = detectQuality();
  let palette = paletteFor(document.documentElement.dataset.theme);

  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: quality.antialias,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = palette.exposure;

  const previewRenderer = previewCanvas ? new THREE.WebGLRenderer({
    canvas: previewCanvas,
    alpha: true,
    antialias: quality.antialias,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true
  }) : null;
  if (previewRenderer) {
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap));
    previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
    previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    previewRenderer.toneMappingExposure = palette.exposure;
    previewRenderer.setClearColor(0x100b1a, 1);
  }

  /* ---------- scene + camera ---------- */
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(palette.fog, palette.fogNear, palette.fogFar);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 160);
  camera.position.set(0, 1.4, 19);
  const previewCamera = new THREE.PerspectiveCamera(52, 1, 0.1, 160);
  previewCamera.position.set(0, 4.2, -10.5);
  const previewLook = new THREE.Vector3(0, 0.45, -25);

  /* The landscape thumbnail is a ~90px circle that re-renders the whole scene.
     Its content drifts very slowly, so it does not need the full frame rate, and it needs none while it is not
     on screen (menu open, or hidden behind the topic preview on phones). It is
     still redrawn right away after a resize or when it becomes visible again. */
  const PREVIEW_MIN_INTERVAL = (1 / 20) * 0.85; // ~20fps cap (slow drift, tiny circle), tolerant of vsync jitter
  const previewHost = previewCanvas ? previewCanvas.closest('[data-landscape-entry]') : null;
  let previewVisible = true;
  let previewDirty = true;
  let lastPreviewTime = -Infinity;
  const checkPreviewVisible = () => {
    if (!previewHost) return;
    const style = window.getComputedStyle(previewHost);
    const next = style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none';
    if (next && !previewVisible) previewDirty = true;
    previewVisible = next;
  };
  checkPreviewVisible();
  const previewVisibilityTimer = previewHost ? window.setInterval(checkPreviewVisible, 250) : null;

  const lookTarget = new THREE.Vector3(0, -0.6, -5);
  const lookCurrent = lookTarget.clone();

  /* ---------- content ---------- */
  buildLights(THREE, scene, palette);

  const waterCan = buildWaterCan(THREE, scene, palette, quality);

  let envMap = quality.envMap ? buildEnvironment(THREE, renderer, palette) : null;
  if (envMap) scene.environment = envMap;

  const water = buildWater(THREE, scene, palette, quality);
  await yieldToMain();
  const chambers = buildChambers(THREE, scene, palette, quality);
  const pipes = buildPipes(THREE, scene, palette, quality, chambers.layout);
  await yieldToMain();
  const particles = buildParticles(THREE, scene, palette, quality, chambers.layout);
  const rainWater = buildRainWater(THREE, scene, palette, quality);
  await yieldToMain();

  // The fixed gateway (immersive-mode) is now the homepage itself, so it
  // shows the real facility built above — vessels, pipes, particles, the
  // outlet droplet — as its landscape, with the dedicated can-and-water
  // atmosphere layered on top as foreground detail. Nothing is hidden.
  const bubbleField = buildBubbleField(THREE, scene, palette, quality);
  const referenceLandscape = buildReferenceLandscape(THREE, scene, palette, quality);

  const volumetrics = buildVolumetrics(
    THREE, scene, palette, quality,
    chambers.layout.map((c) => [c.x, c.z])
  );

  if (envMap) {
    chambers.setEnvMap(envMap);
    pipes.setEnvMap(envMap);
  }

  // the drop hangs beneath the outlet run, over open water
  const lastChamber = chambers.layout[chambers.layout.length - 1];
  const dropAnchor = new THREE.Vector3(lastChamber.x + 5.6, WATER_Y + 4.6, lastChamber.z + 6.2);
  const droplet = buildDroplet(THREE, scene, palette, dropAnchor, WATER_Y + 0.15);

  /* ---------- Part 4: scroll-based water journey ----------
     A chapter-to-chapter camera path through this same facility.
     If GSAP/ScrollTrigger aren't available, `journey` stays null
     and updateCamera() below falls back to the original, unchanged
     scroll-drift behaviour — no second animation system is created. */
  const journey = reducedMotion ? null : createJourneyTracker();

  // Smaller screens get a gentler pass through the facility so the
  // motion never feels excessive on mobile.
  const journeyScale = quality.tier === 'low' ? 0.45 : quality.tier === 'mid' ? 0.7 : 1;

  const journeyPos = new THREE.Vector3(...WAYPOINTS[0].pos);
  const journeyLook = new THREE.Vector3(...WAYPOINTS[0].look);
  let laboratoryStage = null;
  let laboratoryCameraOffset = 0;
  let qualityStage = null;
  let qualityCameraOffset = 0;
  let handlingStage = null;
  let handlingCameraOffset = 0;
  let storageStage = null;
  let storageCameraOffset = 0;
  let materialsStage = null;
  let materialsCameraOffset = 0;
  let comparisonStage = null;
  let comparisonCameraOffset = 0;
  let habitsStage = null;
  let habitsCameraOffset = 0;
  let finaleStage = null;
  let soundEnabled = document.querySelector('[data-sound-toggle]')?.getAttribute('aria-pressed') === 'true';
  let baseExposure = palette.exposure;
  // Each hotspot flies the camera to that chapter's own hand-tuned waypoint
  // through the real facility (see journey.js) — the same shots the scroll
  // journey uses, reused here so the landscape genuinely changes vantage
  // per topic instead of nudging around a fixed close-up.
  const heroWaypoint = WAYPOINTS[0];
  const hotspotWaypoints = {
    source: WAYPOINTS[1],
    purification: WAYPOINTS[2],
    laboratory: WAYPOINTS[4],
    quality: WAYPOINTS[5],
    handling: WAYPOINTS[6],
    storage: WAYPOINTS[7],
    materials: WAYPOINTS[8],
    habits: WAYPOINTS[10]
  };
  const hotspotCamera = {
    pos: [...heroWaypoint.pos],
    look: [...heroWaypoint.look],
    targetPos: [...heroWaypoint.pos],
    targetLook: [...heroWaypoint.look]
  };
  const landscapeCamera = {
    pos: [0, 2.2, -12.5],
    look: [0, 2.2, -25],
    targetPos: [0, 2.2, -12.5],
    targetLook: [0, 2.2, -25]
  };
  /* ===== START responsive landscape camera (overview framing) =====
     The overview keeps the original front/eye-level pose (y 2.2, 12.5 units
     back) whenever the whole process row already fits the horizontal field of
     view, so desktop is unchanged. On narrower / portrait viewports the camera
     only dollies straight back (never tilts down) until the row fits, capped so
     tanks do not shrink to nothing. */
  const OVERVIEW_HALF_WIDTH = 9.4;
  const OVERVIEW_DISTANCE = { min: 12.5, max: 24 };
  let landscapeOverview = true;
  const landscapeFrustumHalfWidth = () => Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect;
  const getLandscapeOverviewPose = () => {
    const need = OVERVIEW_HALF_WIDTH / Math.max(0.05, landscapeFrustumHalfWidth());
    const distance = clamp(need, OVERVIEW_DISTANCE.min, OVERVIEW_DISTANCE.max);
    return { pos: [0, 2.2, -25 + distance], look: [0, 2.2, -25] };
  };
  /* ===== END responsive landscape camera (overview framing) ===== */
  const processStages = {
    source: { setter: setPurificationStage, steps: 1 },
    purification: { setter: setPurificationStage, steps: 7 },
    laboratory: { setter: setLaboratoryStage, steps: 6 },
    quality: { setter: setQualityStage, steps: 7 },
    handling: { setter: setHandlingStage, steps: 7 },
    storage: { setter: setStorageStage, steps: 7 },
    materials: { setter: setMaterialsStage, steps: 6 }
  };
  let processKey = null;
  let processStep = 0;
  let processElapsed = 0;
  let pendingProcessKey = null;

  const setProcessLocation = (key) => {
    processKey = processStages[key] ? key : null;
    processStep = 0;
    processElapsed = 0;
    if (processKey) {
      processStages[processKey].setter(0);
      return;
    }
    Object.values(processStages).forEach(({ setter }) => setter(null));
  };

  const onSound = (event) => {
    soundEnabled = event.detail?.on === true;
    setSoundStage(soundEnabled);
  };
  document.body.addEventListener('dws:sound', onSound);

  const onHotspotPreview = (event) => {
    const wp = hotspotWaypoints[event.detail?.key] || heroWaypoint;
    hotspotCamera.targetPos = [...wp.pos];
    hotspotCamera.targetLook = [...wp.look];
  };
  document.body.addEventListener('dws:hotspot-preview', onHotspotPreview);

  const onLandscapeLocation = (event) => {
    const waypoint = LANDSCAPE_WAYPOINTS[event.detail?.key];
    pendingProcessKey = event.detail?.key || null;
    setProcessLocation(null);
    landscapeOverview = !waypoint;
    if (!waypoint) {
      referenceLandscape.setLocation(null);
      return;
    }
    landscapeCamera.targetPos = [...waypoint.pos];
    // START responsive: on narrow viewports step back a little so the whole module stays in frame
    landscapeCamera.targetPos[2] += clamp(2.2 / Math.max(0.05, landscapeFrustumHalfWidth()) - 5.5, 0, 6);
    // END responsive
    landscapeCamera.targetLook = [...waypoint.look];
    referenceLandscape.setLocation(event.detail.key);
  };
  document.body.addEventListener('dws:landscape-location', onLandscapeLocation);

  const onLandscapeOverview = () => {
    pendingProcessKey = null;
    setProcessLocation(null);
    referenceLandscape.setLocation(null);
    landscapeOverview = true;
    landscapeCamera.targetPos = [0, 2.2, -12.5];
    landscapeCamera.targetLook = [0, 2.2, -25];
  };
  document.body.addEventListener('dws:landscape-overview', onLandscapeOverview);

  /* ---------- pointer parallax ---------- */
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

  const onPointerMove = (event) => {
    pointer.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    pointer.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
  };

  // Touch devices get a gentle drift from device orientation instead,
  // since there is no hover pointer to follow.
  const onOrientation = (event) => {
    if (event.gamma == null || event.beta == null) return;
    pointer.targetX = clamp(event.gamma / 35, -1, 1);
    pointer.targetY = clamp((event.beta - 45) / 45, -1, 1);
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  if (window.matchMedia('(hover: none)').matches) {
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
  }

  /* ---------- scroll drift ---------- */
  let scrollRatio = 0;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollRatio = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- resize ---------- */
  let lastWidth = 0;
  let lastHeight = 0;

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width || window.innerWidth));
    const height = Math.max(1, Math.round(bounds.height || window.innerHeight));

    // Mobile browsers resize on every scroll as the chrome collapses.
    // Ignore small height-only changes so the scene doesn't jitter.
    const widthChanged = width !== lastWidth;
    const heightChanged = Math.abs(height - lastHeight) > 120;
    if (!widthChanged && !heightChanged) return;

    lastWidth = width;
    lastHeight = height;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap));
    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    // widen the field of view on narrow screens so the tanks stay in frame
    camera.fov = width < 760 ? 60 : 46;
    camera.updateProjectionMatrix();

    particles.setPixelRatio(renderer.getPixelRatio());
    if (previewRenderer && previewCanvas) {
      const previewBounds = previewCanvas.getBoundingClientRect();
      const previewWidth = Math.max(1, Math.round(previewBounds.width));
      const previewHeight = Math.max(1, Math.round(previewBounds.height));
      previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap));
      previewRenderer.setSize(previewWidth, previewHeight, false);
      previewCamera.aspect = previewWidth / previewHeight;
      previewCamera.updateProjectionMatrix();
      previewCamera.lookAt(previewLook);
      previewDirty = true; // setSize cleared the thumbnail's buffer
    }
  };

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();
  setSoundStage(soundEnabled);

  /* ---------- theme ---------- */
  const themeObserver = new MutationObserver(() => {
    palette = paletteFor(document.documentElement.dataset.theme);
    applyPalette();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function applyPalette() {
    scene.fog.color.set(palette.fog);
    scene.fog.near = palette.fogNear;
    scene.fog.far = palette.fogFar;
    renderer.toneMappingExposure = palette.exposure;
    baseExposure = palette.exposure;

    water.applyPalette(palette);
    chambers.applyPalette(palette);
    pipes.applyPalette(palette);
    particles.applyPalette(palette);
    rainWater.applyPalette(palette);
    droplet.applyPalette(palette);
    volumetrics.forEach((v) => {
      v.material.uniforms.uColor.value.set(palette.lamp);
      v.lampMat.color.set(palette.lamp);
    });

    // lights carry theme colour too
    scene.traverse((obj) => {
      if (obj.isHemisphereLight) { obj.color.set(palette.sky); obj.groundColor.set(palette.deepWater); }
      if (obj.isDirectionalLight) { /* left as set at build time */ }
    });

    if (quality.envMap) {
      const next = buildEnvironment(THREE, renderer, palette);
      scene.environment?.dispose?.();
      scene.environment = next;
      chambers.setEnvMap(next);
      pipes.setEnvMap(next);
      envMap = next;
    }
  }

  /* ---------- performance guard ---------- */
  const guard = createPerformanceGuard(quality, (averageMs) => {
    console.info(`[three-scene] frame budget exceeded (${averageMs.toFixed(1)}ms) — reducing quality.`);
    quality = { ...quality, pixelRatioCap: 1, targetFps: 30, waterDetail: 0 };
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
    water.setQuality(quality);
    particles.setPixelRatio(renderer.getPixelRatio());
    volumetrics.forEach((v) => { v.material.uniforms.uOpacity.value = 0.10; });
  });

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  let running = true;
  let frameHandle = null;
  let accumulator = 0;

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) clock.getDelta(); // drop the paused interval
  });

  function frame() {
    frameHandle = requestAnimationFrame(frame);
    if (!running) return;

    const delta = Math.min(clock.getDelta(), 0.05);

    // frame cap for the low tier — half the work, same look
    if (quality.targetFps < 60) {
      accumulator += delta;
      if (accumulator < 1 / quality.targetFps) return;
      accumulator = 0;
    }

    guard(delta);
    const time = clock.getElapsedTime();

    water.update(time);
    chambers.update(time);
    pipes.update(time);
    particles.update(time);
    rainWater.update(time, (x, z, rippleTime, strength) => water.ripple(x, z, rippleTime, strength));
    waterCan.update(time);
    bubbleField.update(time);
    referenceLandscape.update(time);
    referenceLandscape.setOpen(document.body.classList.contains('landscape-open'));
    if (pendingProcessKey && document.body.classList.contains('landscape-open') && processKey !== pendingProcessKey) {
      const cameraDistance = Math.hypot(
        camera.position.x - landscapeCamera.targetPos[0],
        camera.position.y - landscapeCamera.targetPos[1],
        camera.position.z - landscapeCamera.targetPos[2]
      );
      if (cameraDistance < 0.75) {
        setProcessLocation(pendingProcessKey);
        document.body.dispatchEvent(new CustomEvent('dws:landscape-arrived', { detail: { key: pendingProcessKey } }));
      }
    }
    if (processKey) {
      processElapsed += delta;
      if (processElapsed >= 1.05 && processStages[processKey].steps > 1) {
        processElapsed = 0;
        processStep = (processStep + 1) % processStages[processKey].steps;
        processStages[processKey].setter(processStep);
      }
    }
    volumetrics.forEach((v) => { v.material.uniforms.uTime.value = time; });

    // Part 4: as the journey nears its final chapter (the last drop),
    // give the droplet a small forward drift. Zero everywhere else,
    // so its original hang/fall/land cycle is otherwise untouched.
    const dropT = journey
      ? clamp(journey.state.continuous / (WAYPOINTS.length - 1), 0, 1)
      : 0;
    const dropDrift = {
      x: Math.sin(time * 0.6) * 0.4 * dropT * journeyScale,
      z: Math.cos(time * 0.5) * 0.3 * dropT * journeyScale
    };

    droplet.setFinaleProgress?.(journey?.state.index === 11 ? finaleStage : null);
    droplet.update(time, camera, (x, z) => {
      water.ripple(x, z, time, 0.9);
    }, dropDrift);

    updateCamera(time, delta);
    renderer.render(scene, camera);
    if (
      previewRenderer && previewCanvas && previewVisible && referenceLandscape.isReady() &&
      !document.body.classList.contains('landscape-open') &&
      (previewDirty || time - lastPreviewTime >= PREVIEW_MIN_INTERVAL)
    ) {
      previewDirty = false;
      lastPreviewTime = time;
      referenceLandscape.setOpen(true);
      referenceLandscape.setPreviewScale(2.4);
      previewRenderer.render(scene, previewCamera);
      referenceLandscape.setPreviewScale(1);
      referenceLandscape.setOpen(false);
    }
  }

  function updateCamera(time, delta) {
    const ease = 1 - Math.pow(0.001, delta);

    pointer.x += (pointer.targetX - pointer.x) * ease * 0.5;
    pointer.y += (pointer.targetY - pointer.y) * ease * 0.5;

    if (document.body.classList.contains('landscape-open')) {
      // START responsive: overview pose follows the current aspect ratio
      if (landscapeOverview) {
        const overview = getLandscapeOverviewPose();
        landscapeCamera.targetPos = overview.pos;
        landscapeCamera.targetLook = overview.look;
      }
      // END responsive
      landscapeCamera.pos = lerp3(landscapeCamera.pos, landscapeCamera.targetPos, ease * 0.18);
      landscapeCamera.look = lerp3(landscapeCamera.look, landscapeCamera.targetLook, ease * 0.18);
      camera.position.set(...landscapeCamera.pos);
      lookTarget.set(...landscapeCamera.look);
      lookCurrent.lerp(lookTarget, ease * 0.5);
      camera.lookAt(lookCurrent);
    } else if (document.body.classList.contains('immersive-mode')) {
      // Ease toward whichever waypoint the active hotspot (or the hero
      // establishing shot, when none is open) has requested, then layer
      // the original slow drift + pointer parallax on top so the scene
      // still feels alive between clicks.
      hotspotCamera.pos = lerp3(hotspotCamera.pos, hotspotCamera.targetPos, ease * 0.22);
      hotspotCamera.look = lerp3(hotspotCamera.look, hotspotCamera.targetLook, ease * 0.22);

      const driftX = Math.sin(time * 0.18) * 0.35;
      const driftY = Math.sin(time * 0.13) * 0.12;

      const immersiveX = hotspotCamera.pos[0] + pointer.x * 1.15 + driftX;
      const immersiveY = hotspotCamera.pos[1] + (-pointer.y * 0.45) + driftY;
      const immersiveZ = hotspotCamera.pos[2];
      camera.position.x += (immersiveX - camera.position.x) * ease * 0.8;
      camera.position.y += (immersiveY - camera.position.y) * ease * 0.8;
      camera.position.z += (immersiveZ - camera.position.z) * ease * 0.8;
      lookTarget.set(
        hotspotCamera.look[0] + pointer.x * 0.3,
        hotspotCamera.look[1] - pointer.y * 0.18,
        hotspotCamera.look[2]
      );
      lookCurrent.lerp(lookTarget, ease * 0.55);
      camera.lookAt(lookCurrent);
    } else if (journey) {
      /* ---- Part 4: chapter-to-chapter camera path ----
         Blends between the two nearest waypoints using each chapter's
         own scroll progress, then rides the hero's original idle
         wander + pointer parallax on top — identical motion language
         throughout the journey, not just in the hero. */
      const idx = journey.state.index;
      const from = WAYPOINTS[idx] || WAYPOINTS[0];
      const to = WAYPOINTS[Math.min(idx + 1, WAYPOINTS.length - 1)];
      const t = journey.state.progress;
      const hero0 = WAYPOINTS[0];

      const wp = lerp3(from.pos, to.pos, t);
      const wl = lerp3(from.look, to.look, t);

      // Travel is scaled around the hero's own resting point. At the
      // hero itself (index 0, t 0) wp === hero0.pos exactly, so the
      // hero's framing is pixel-for-pixel unchanged; journeyScale only
      // softens how far the camera travels for the rest of the page
      // (used to keep mobile calmer).
      let targetX = hero0.pos[0] + (wp[0] - hero0.pos[0]) * journeyScale;
      let targetY = hero0.pos[1] + (wp[1] - hero0.pos[1]) * journeyScale;
      let targetZ = hero0.pos[2] + (wp[2] - hero0.pos[2]) * journeyScale;
      let targetLX = hero0.look[0] + (wl[0] - hero0.look[0]) * journeyScale;
      let targetLY = hero0.look[1] + (wl[1] - hero0.look[1]) * journeyScale;
      let targetLZ = hero0.look[2] + (wl[2] - hero0.look[2]) * journeyScale;

      if (idx === 11 && finaleStage != null) {
        const finalT = finaleStage;
        const finalCamera = lerp3([11.4, 4.6, 13.2], [15.8, 0.4, 7.0], finalT);
        const finalLook = lerp3([14.0, 0.5, 1.8], [15.6, -2.8, 2.2], finalT);
        targetX = finalCamera[0];
        targetY = finalCamera[1];
        targetZ = finalCamera[2];
        targetLX = finalLook[0];
        targetLY = finalLook[1];
        targetLZ = finalLook[2];
      }

      journeyPos.lerp({ x: targetX, y: targetY, z: targetZ }, ease * 0.2);
      journeyLook.lerp({ x: targetLX, y: targetLY, z: targetLZ }, ease * 0.2);

      // the hero's own slow cinematic drift, unchanged, riding on top
      // of the current journey position
      const finalJourney = idx === 11 && finaleStage != null;
      const driftX = finalJourney ? 0 : Math.sin(time * 0.058) * 2.6;
      const driftY = finalJourney ? 0 : Math.sin(time * 0.041) * 0.7;
      const driftZ = finalJourney ? 0 : Math.sin(time * 0.033) * 1.4;
      const labTargetOffset = journey.state.index === 4 && laboratoryStage != null
        ? (laboratoryStage - 2.5) * 0.8
        : 0;
      laboratoryCameraOffset += (labTargetOffset - laboratoryCameraOffset) * ease * 0.2;
      const qualityTargetOffset = journey.state.index === 5 && qualityStage != null
        ? (qualityStage - 3) * 0.62
        : 0;
      qualityCameraOffset += (qualityTargetOffset - qualityCameraOffset) * ease * 0.2;
      const handlingTargetOffset = journey.state.index === 6 && handlingStage != null
        ? (handlingStage - 3) * 0.54
        : 0;
      handlingCameraOffset += (handlingTargetOffset - handlingCameraOffset) * ease * 0.2;
      const storageTargetOffset = journey.state.index === 7 && storageStage != null
        ? (storageStage - 3) * 0.48
        : 0;
      storageCameraOffset += (storageTargetOffset - storageCameraOffset) * ease * 0.2;
      const materialsTargetOffset = journey.state.index === 8 && materialsStage != null
        ? (materialsStage - 2.5) * 0.44
        : 0;
      materialsCameraOffset += (materialsTargetOffset - materialsCameraOffset) * ease * 0.2;
      const comparisonTargetOffset = journey.state.index === 9 && comparisonStage != null
        ? (comparisonStage - 2.5) * 0.38
        : 0;
      comparisonCameraOffset += (comparisonTargetOffset - comparisonCameraOffset) * ease * 0.2;
      const habitsTargetOffset = journey.state.index === 10 && habitsStage != null
        ? (habitsStage - 3.5) * 0.24
        : 0;
      habitsCameraOffset += (habitsTargetOffset - habitsCameraOffset) * ease * 0.12;

      camera.position.set(
        journeyPos.x + driftX + pointer.x * 1.7 + laboratoryCameraOffset + qualityCameraOffset + handlingCameraOffset + storageCameraOffset + materialsCameraOffset + comparisonCameraOffset + habitsCameraOffset,
        journeyPos.y + driftY - pointer.y * 0.9,
        journeyPos.z + driftZ
      );

      lookTarget.set(journeyLook.x + pointer.x * 0.8 + laboratoryCameraOffset * 0.65 + qualityCameraOffset * 0.55 + handlingCameraOffset * 0.5 + storageCameraOffset * 0.45 + materialsCameraOffset * 0.42 + comparisonCameraOffset * 0.38 + habitsCameraOffset * 0.32, journeyLook.y, journeyLook.z);
      lookCurrent.lerp(lookTarget, ease * 0.4);
      camera.lookAt(lookCurrent);

      // gentle section-to-section lighting/fog shift
      const exposureMul = from.exposure + (to.exposure - from.exposure) * t;
      const fogMul = from.fog + (to.fog - from.fog) * t;
      renderer.toneMappingExposure = baseExposure * exposureMul;
      scene.fog.near = palette.fogNear * fogMul;
      scene.fog.far = palette.fogFar * fogMul;

    } else {
      /* ---- original behaviour, unchanged: no GSAP/ScrollTrigger ---- */
      const driftX = Math.sin(time * 0.058) * 2.6;
      const driftY = 1.4 + Math.sin(time * 0.041) * 0.7;
      const driftZ = 19 + Math.sin(time * 0.033) * 1.4;

      // the page descends, so the camera sinks a little as you read
      const descent = scrollRatio * 2.4;

      camera.position.x = driftX + pointer.x * 1.7;
      camera.position.y = driftY - pointer.y * 0.9 - descent;
      camera.position.z = driftZ - scrollRatio * 2.0;

      lookTarget.set(pointer.x * 0.8, -0.6 - descent * 0.4, -5);
      lookCurrent.lerp(lookTarget, ease * 0.4);
      camera.lookAt(lookCurrent);
    }
  }

  if (reducedMotion) {
    // render a single composed frame and stop
    water.update(0);
    chambers.update(0);
    pipes.update(0);
    particles.update(0);
    droplet.update(0, camera, null);
    camera.lookAt(lookCurrent);
    renderer.render(scene, camera);
  } else {
    frame();
  }

  /* ---------- teardown ---------- */
  function dispose() {
    if (frameHandle) cancelAnimationFrame(frameHandle);
    if (previewVisibilityTimer) window.clearInterval(previewVisibilityTimer);
    journey?.destroy();
    themeObserver.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('deviceorientation', onOrientation);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', resize);
    document.body.removeEventListener('dws:sound', onSound);
    document.body.removeEventListener('dws:hotspot-preview', onHotspotPreview);
    document.body.removeEventListener('dws:landscape-location', onLandscapeLocation);
    document.body.removeEventListener('dws:landscape-overview', onLandscapeOverview);

    water.dispose();
    waterCan.dispose();
    bubbleField.dispose();
    referenceLandscape.dispose();
    chambers.dispose();
    pipes.dispose();
    particles.dispose();
    rainWater.dispose();
    droplet.dispose();
    envMap?.dispose?.();
    renderer.dispose();
    previewRenderer?.dispose?.();
  }

  // PART 5: expose a small highlight API; geometry and the render loop remain owned here.
  function setPurificationStage(stage) {
    chambers.setFocus?.(stage);
    pipes.setFocus?.(stage);
  }

  // PART 6: reuse the existing facility for filter-lab focus and camera emphasis.
  function setLaboratoryStage(stage) {
    laboratoryStage = stage;
    chambers.setLaboratoryFocus?.(stage);
    pipes.setLaboratoryFocus?.(stage);
    particles.setTreatmentStage?.(stage);
    water.setTreatmentStage?.(stage);
  }

  // PART 7: reuse the facility for quality-sample focus and camera emphasis.
  function setQualityStage(stage) {
    qualityStage = stage;
    chambers.setQualityFocus?.(stage);
    pipes.setQualityFocus?.(stage);
    particles.setQualityStage?.(stage);
    water.setQualityStage?.(stage);
  }

  // PART 8: reuse the outlet and final chamber for clean handling focus.
  function setHandlingStage(stage) {
    handlingStage = stage;
    chambers.setHandlingFocus?.(stage);
    pipes.setHandlingFocus?.(stage);
    particles.setHandlingStage?.(stage);
    water.setHandlingStage?.(stage);
  }

  // PART 9: reuse the final facility area for storage and material focus.
  function setStorageStage(stage) {
    storageStage = stage;
    chambers.setStorageFocus?.(stage);
    pipes.setStorageFocus?.(stage);
    particles.setStorageStage?.(stage);
    water.setStorageStage?.(stage);
  }

  function setMaterialsStage(stage) {
    materialsStage = stage;
    chambers.setMaterialsFocus?.(stage);
    pipes.setMaterialsFocus?.(stage);
    particles.setMaterialsStage?.(stage);
    water.setMaterialsStage?.(stage);
  }

  // PART 10: reuse the material-study vessel for active comparison focus.
  function setComparisonStage(stage) {
    comparisonStage = stage;
    chambers.setMaterialsFocus?.(stage);
    pipes.setMaterialsFocus?.(stage);
    particles.setMaterialsStage?.(stage);
    water.setMaterialsStage?.(stage);
  }

  // PART 11: keep everyday-use focus calm while reusing the final water objects.
  function setHabitsStage(stage) {
    habitsStage = stage;
    chambers.setHabitsFocus?.(stage);
    pipes.setHabitsFocus?.(stage);
    particles.setHabitsStage?.(stage);
    water.setHabitsStage?.(stage);
  }

  // PART 12: narrow the existing facility around the scroll-controlled drop.
  function setFinaleStage(stage) {
    finaleStage = stage == null ? null : clamp(stage, 0, 1);
    chambers.setFinaleFocus?.(finaleStage);
    pipes.setFinaleFocus?.(finaleStage);
    particles.setFinaleStage?.(finaleStage);
    water.setFinaleStage?.(finaleStage);
  }

  // PART 13: keep the existing render loop subtly responsive to ambience.
  function setSoundStage(enabled) {
    water.setSoundStage?.(enabled);
    particles.setSoundStage?.(enabled);
    rainWater.setSoundStage?.(enabled);
  }

  return { scene, camera, renderer, quality, setPurificationStage, setLaboratoryStage, setQualityStage, setHandlingStage, setStorageStage, setMaterialsStage, setComparisonStage, setHabitsStage, setFinaleStage, dispose };
}

/* ------------------------------------------------------------ */

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch (_) {
    return false;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function buildWaterCan(THREE, scene, palette, quality) {
  const group = new THREE.Group();
  group.userData.immersiveCan = true;
  group.scale.setScalar(0.76);
  group.position.set(0, 0.1, -4.4);
  group.rotation.y = -0.12;
  scene.add(group);

  const glass = new THREE.MeshPhysicalMaterial({
    color: palette.glass,
    roughness: 0.08,
    metalness: 0.02,
    transmission: 0.72,
    transparent: true,
    opacity: 0.46,
    thickness: 0.16,
    ior: 1.34,
    clearcoat: 0.8,
    clearcoatRoughness: 0.12
  });
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: palette.dropRim,
    roughness: 0.12,
    transmission: 0.18,
    transparent: true,
    opacity: 0.78,
    metalness: 0.02
  });
  const chrome = new THREE.MeshStandardMaterial({ color: palette.glass, metalness: 0.78, roughness: 0.22 });
  const labelMaterial = new THREE.MeshStandardMaterial({ color: palette.deepWater, roughness: 0.48, metalness: 0.06 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.58, 6.6, quality.tier === 'low' ? 32 : 64, 1, true), glass);
  body.position.y = -0.3;
  group.add(body);

  const waterVolume = new THREE.Mesh(new THREE.CylinderGeometry(2.32, 2.42, 4.9, 48), waterMaterial);
  waterVolume.position.y = -1.02;
  group.add(waterVolume);

  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 2.45, 1.25, 48), glass);
  shoulder.position.y = 3.62;
  group.add(shoulder);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.05, 1.1, 40), glass);
  neck.position.y = 4.72;
  group.add(neck);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.42, 40), chrome);
  cap.position.y = 5.45;
  group.add(cap);

  const label = new THREE.Mesh(new THREE.CylinderGeometry(2.48, 2.48, 1.15, 64, 1, true, 0, Math.PI * 2), labelMaterial);
  label.position.y = -0.55;
  label.scale.z = 1.01;
  group.add(label);

  const bubbleCount = quality.tier === 'low' ? 18 : 34;
  const bubbleGroup = new THREE.Group();
  const bubbleMaterial = new THREE.MeshPhysicalMaterial({ color: palette.glass, transmission: 0.9, transparent: true, opacity: 0.46, roughness: 0.04 });
  const bubbles = [];
  for (let index = 0; index < bubbleCount; index += 1) {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.035 + (index % 4) * 0.018, 10, 8), bubbleMaterial);
    bubble.userData.phase = index * 0.73;
    bubble.userData.radius = 0.4 + (index % 7) * 0.25;
    bubble.userData.height = -3.1 + (index % 9) * 0.52;
    bubble.userData.speed = 0.22 + (index % 5) * 0.035;
    bubbleGroup.add(bubble);
    bubbles.push(bubble);
  }
  group.add(bubbleGroup);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.85, 3.15, 0.18, 64),
    new THREE.MeshStandardMaterial({ color: palette.deepWater, transparent: true, opacity: 0.65, roughness: 0.2 })
  );
  base.position.y = -3.72;
  group.add(base);

  const halo = new THREE.PointLight(palette.dropRim, 3.2, 9, 2);
  halo.position.set(0, 0.4, 1.8);
  group.add(halo);

  return {
    update(time) {
      group.position.y = 0.1 + Math.sin(time * 0.48) * 0.16;
      group.rotation.y = -0.12 + Math.sin(time * 0.17) * 0.045;
      waterVolume.position.y = -1.02 + Math.sin(time * 0.7) * 0.035;
      bubbles.forEach((bubble) => {
        const phase = bubble.userData.phase;
        bubble.position.x = Math.sin(time * 0.45 + phase) * bubble.userData.radius;
        bubble.position.z = Math.cos(time * 0.36 + phase) * bubble.userData.radius * 0.52;
        bubble.position.y = ((bubble.userData.height + time * bubble.userData.speed + 3.1) % 6.1) - 3.1;
      });
      halo.intensity = 2.7 + Math.sin(time * 1.2) * 0.35;
    },
    dispose() {
      group.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
        else object.material?.dispose?.();
      });
      scene.remove(group);
    }
  };
}

function buildReferenceLandscape(THREE, scene, palette, quality) {
  const group = new THREE.Group();
  group.position.set(0, -0.9, -25);
  group.userData.referenceLandscape = true;
  scene.add(group);

  /* ===== START single landscape =====
     The landscape is the GLB terrain only (massif_du_devoluy.glb). Nothing else
     is ever drawn in its place: no procedural island and no stand-in platform.
     If the terrain cannot load, the equipment is simply not placed and the
     hotspots open their panels directly (see landscape-entry.js). ===== */
  /* ===== END single landscape ===== */

  const sparklePositions = [];
  const sparkleCount = quality.tier === 'low' ? 90 : 170;
  for (let index = 0; index < sparkleCount; index += 1) {
    sparklePositions.push(
      (hash(index, 9, 1) - 0.5) * 22,
      0.2 + hash(index, 9, 2) * 2.2,
      (hash(index, 9, 3) - 0.5) * 7
    );
  }
  const sparkleGeometry = new THREE.BufferGeometry();
  sparkleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sparklePositions, 3));
  const sparkleMaterial = new THREE.PointsMaterial({
    color: palette.particle,
    size: 0.075,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
  group.add(sparkles);
  let sparkleMotion = null; // set once the modules are placed (rising bubbles over each module)
  const modulePositions = {
    source: [-7.6, 1.8, 0.15],
    purification: [-3.9, 1.8, -0.3],
    laboratory: [0.1, 1.8, 0.15],
    quality: [3.7, 1.8, -0.25],
    handling: [7.5, 1.8, 0.1],
    storage: [-2.3, 1.8, 1.1],
    materials: [2.6, 1.8, 1.05]
  };
  // Each anchor is an empty, static stage slot. The real water-treatment
  // equipment (water_treatment_plant.glb) is parented into it once loaded.
  const locationModules = new Map();
  Object.entries(modulePositions).forEach(([key, position]) => {
    const anchor = new THREE.Group();
    anchor.position.set(...position);
    anchor.userData.stageKey = key;
    group.add(anchor);
    locationModules.set(key, anchor);
  });
  let terrainRoot = null;
  /* ---------- GLB terrain (massif_du_devoluy.glb) ----------
     This is the only landscape. It streams in asynchronously; nothing else
     is drawn in its place while it loads. The model is normalised from its own bounding
     box to the same footprint the old island covered, so the camera
     waypoints, hotspots and process modules need no changes. */
  const TERRAIN = { width: 25.22, depth: 11.18, height: 2.6, baseY: -0.2 };

  /* Depth-based elevation profile (front-elevation composition).
     The raw massif has almost the same relief at every depth, so seen from the
     fixed camera the peaks in front of the modules hide them. Relief above
     PROFILE.datum is therefore compressed in front of / around the process row
     and ramped up toward the back, so the mountains stand behind the modules.
     Only vertex heights above the datum change; the base, walls and footprint
     are untouched. Runs before the modules are seated, so they follow it. */
  const PROFILE = {
    datum: 1.0,
    front: { z: -0.6, gain: 0.4 },
    back: { z: -4.8, gain: 3.6 }
  };
  const reprofileTerrain = (terrain) => {
    group.updateMatrixWorld(true);
    terrain.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const toGroup = new THREE.Matrix4();
    const vertex = new THREE.Vector3();
    const { datum, front, back } = PROFILE;
    terrain.traverse((mesh) => {
      const geometry = mesh.geometry;
      if (!mesh.isMesh || !geometry?.attributes?.position) return;
      mesh.updateWorldMatrix(true, false);
      toGroup.multiplyMatrices(inverse, mesh.matrixWorld);
      const e = toGroup.elements;
      // the mesh height axis (Z-up export) must map purely onto group Y
      if (Math.abs(e[9]) < 1e-9 || Math.abs(e[1]) > Math.abs(e[9]) * 1e-6 || Math.abs(e[5]) > Math.abs(e[9]) * 1e-6) return;
      const position = geometry.attributes.position;
      const normal = geometry.attributes.normal;
      for (let index = 0; index < position.count; index += 1) {
        vertex.fromBufferAttribute(position, index).applyMatrix4(toGroup);
        if (vertex.y <= datum) continue;
        const u = Math.min(1, Math.max(0, (front.z - vertex.z) / (front.z - back.z)));
        const gain = front.gain + (back.gain - front.gain) * (u * u * (3 - 2 * u));
        position.setZ(index, position.getZ(index) + (datum + (vertex.y - datum) * gain - vertex.y) / e[9]);
        if (normal) {
          const nx = normal.getX(index);
          const ny = normal.getY(index);
          const nz = normal.getZ(index) / gain;
          const length = Math.hypot(nx, ny, nz) || 1;
          normal.setXYZ(index, nx / length, ny / length, nz / length);
        }
      }
      position.needsUpdate = true;
      if (normal) normal.needsUpdate = true;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    });
  };

  /* ===== START terrain natural colour grade =====
     The baked texture goes brown/grey on some flanks (notably the tall right-hand
     peak). A light shader grade, driven by height and slope, pulls every flank into
     one natural alpine palette: forest / meadow low, grey-green rock on steep or
     high faces, a faint snow tint on the highest gentle ridges. Texture detail is
     kept (the grade is a blend, not a replacement). */
  const terrainGrade = { uScale: { value: 1 }, uOriginY: { value: group.position.y } };
  const gradeTerrainMaterial = (material) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uScale = terrainGrade.uScale;
      shader.uniforms.uOriginY = terrainGrade.uOriginY;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uScale;
          uniform float uOriginY;
          varying float vDwsHeight;
          varying vec3 vDwsNormal;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 dwsWorld = modelMatrix * vec4(position, 1.0);
          vDwsHeight = (dwsWorld.y - uOriginY) / uScale;
          vDwsNormal = normalize(mat3(modelMatrix) * normal);`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying float vDwsHeight;
          varying vec3 vDwsNormal;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          {
            float dwsLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            float dwsH = clamp((vDwsHeight - 1.0) / 5.5, 0.0, 1.0);
            float dwsSlope = 1.0 - clamp(normalize(vDwsNormal).y, 0.0, 1.0);
            vec3 texel = vec3(min(diffuseColor.r, diffuseColor.g * 0.92), diffuseColor.g, min(diffuseColor.b, diffuseColor.g * 0.8));
            vec3 forest = vec3(0.035, 0.075, 0.032);
            vec3 meadow = vec3(0.095, 0.155, 0.055);
            vec3 rockTone = vec3(0.150, 0.162, 0.140);
            vec3 natural = mix(forest, meadow, smoothstep(0.05, 0.35, dwsH) * (1.0 - smoothstep(0.25, 0.6, dwsSlope)));
            float rockAmount = clamp(smoothstep(0.4, 0.75, dwsSlope) * 0.7 + smoothstep(0.55, 0.9, dwsH) * 0.6, 0.0, 0.85);
            natural = mix(natural, rockTone, rockAmount) * (0.55 + 1.6 * dwsLuma);
            float snow = smoothstep(0.9, 1.0, dwsH) * (1.0 - smoothstep(0.3, 0.6, dwsSlope)) * 0.45;
            diffuseColor.rgb = mix(mix(texel, natural, 0.6), vec3(0.62, 0.66, 0.68), snow);
          }`);
    };
    material.customProgramCacheKey = () => 'dws-terrain-grade';
  };
  /* ===== END terrain natural colour grade ===== */

  const fitTerrain = (gltf) => {
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    let size = box.getSize(new THREE.Vector3());
    if (size.y > Math.min(size.x, size.z) * 1.5) {
      model.rotation.x = -Math.PI / 2; // Z-up export: stand it upright
      model.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(model);
      size = box.getSize(new THREE.Vector3());
    }
    const center = box.getCenter(new THREE.Vector3());

    const terrain = new THREE.Group();
    model.position.set(-center.x, -box.min.y, -center.z);
    terrain.add(model);
    terrain.scale.set(TERRAIN.width / size.x, TERRAIN.height / size.y, TERRAIN.depth / size.z);
    terrain.position.y = TERRAIN.baseY;

    model.traverse((object) => {
      if (!object.isMesh) return;
      const material = object.material;
      material.roughness = 1;
      material.metalness = 0;
      if (material.map) {
        if (quality.tier === 'low') {
          // 4096px texture -> 2048px on low-end devices to save GPU memory
          const canvas = document.createElement('canvas');
          canvas.width = 2048;
          canvas.height = 2048;
          canvas.getContext('2d').drawImage(material.map.image, 0, 0, 2048, 2048);
          const small = new THREE.CanvasTexture(canvas);
          small.colorSpace = material.map.colorSpace;
          small.flipY = false;
          material.map.dispose();
          material.map = small;
        }
        material.map.anisotropy = quality.tier === 'low' ? 2 : 8;
        // light lift so the terrain reads in the dark theme, like the old ground.
        // (a flat green-tinted emissive replaces the old texture-emissive, which
        //  re-added the baked brown/grey on top of the natural grade)
        material.emissive = new THREE.Color(0x2a3a2a);
        material.emissiveMap = null;
        material.emissiveIntensity = 1;
        gradeTerrainMaterial(material);
        material.needsUpdate = true;
      }
    });

    terrainRoot = terrain;
    group.add(terrain);
    reprofileTerrain(terrain);
    try {
      buildTerrainUnderside(THREE, group, model, quality);
    } catch (error) {
      console.warn('Terrain underside could not be rebuilt; keeping the original base.', error);
    }
  };

  const loadGLB = (file) => import('three/addons/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => new Promise((resolve, reject) => {
      // ?v= busts the 30-day cache so returning visitors fetch the optimised models
      new GLTFLoader().load(new URL(`../../models/${file}?v=opt1`, import.meta.url).href, resolve, undefined, reject);
    }));

  const terrainReady = loadGLB('massif_du_devoluy.glb')
    .then(fitTerrain)
    .catch((error) => {
      console.warn('Landscape GLB failed to load.', error);
    });

  /* ---------- Water-treatment plant (water_treatment_plant.glb) ----------
     Real treatment equipment replaces the old abstract modules. The GLB's own
     ground and fence were stripped from the shipped file, so only equipment is
     used. Each piece is re-centred, sunk onto the terrain surface, and left
     completely static; only the water/process effects below animate.
     Stage order (left -> right along the site):
       01 Raw intake      source        unfiltered channel
       02 Sediment        purification  settling basin
       03 Carbon          storage       silo / vessel row
       04 Fine filtration laboratory    filtration channel
       05 Membrane / RO   materials     treated-water basin
       06 UV / Ozone      quality       treated-water basin
       07 Final quality   handling      control / lab building */
  const PLANT_SCALE = 0.34;
  const STAGE_ORDER = ['source', 'purification', 'storage', 'laboratory', 'materials', 'quality', 'handling'];
  const STAGE_LAYOUT = {
    source: { node: 'Water_Filtration_Square_5' },
    purification: { node: 'Water_Basin_Round_3', round: true },
    storage: { node: 'Silos_12', rot: Math.PI / 2, dz: 0.35, lift: 0.5 },
    laboratory: { node: 'Water_Filtration_Square.001_16', dz: -0.35 },
    materials: { node: 'Water_Basin_Round.001_20', dx: 0.2, round: true },
    quality: { node: 'Water_Basin_Round.002_24', dx: 0.3, dz: -0.3, round: true },
    handling: { node: 'Building_14', lift: 0.45 }
  };
  const WATER_MATERIAL = /^Water_(Semi|Unfiltered|filtered)/;

  // Coarse top-surface height map of whatever terrain is showing, in group space.
  const buildHeightField = () => {
    const cols = 168;
    const rows = 76;
    const x0 = -10.5;
    const x1 = 10.5;
    const z0 = -5;
    const z1 = 5;
    const field = new Float32Array(cols * rows).fill(-Infinity);
    group.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const matrix = new THREE.Matrix4();
    const vertex = new THREE.Vector3();
    terrainRoot.traverse((object) => {
      if (!object.isMesh || !object.geometry?.attributes?.position) return;
      object.updateWorldMatrix(true, false);
      matrix.multiplyMatrices(inverse, object.matrixWorld);
      const position = object.geometry.attributes.position;
      for (let index = 0; index < position.count; index += 1) {
        vertex.fromBufferAttribute(position, index).applyMatrix4(matrix);
        const column = Math.floor(((vertex.x - x0) / (x1 - x0)) * cols);
        const row = Math.floor(((vertex.z - z0) / (z1 - z0)) * rows);
        if (column < 0 || column >= cols || row < 0 || row >= rows) continue;
        const cell = row * cols + column;
        if (vertex.y > field[cell]) field[cell] = vertex.y;
      }
    });
    return (x, z) => {
      const column = Math.floor(((x - x0) / (x1 - x0)) * cols);
      const row = Math.floor(((z - z0) / (z1 - z0)) * rows);
      for (let radius = 1; radius <= 6; radius += 1) {
        let sum = 0;
        let count = 0;
        for (let dr = -radius; dr <= radius; dr += 1) {
          for (let dc = -radius; dc <= radius; dc += 1) {
            const r = row + dr;
            const c = column + dc;
            if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
            const value = field[r * cols + c];
            if (Number.isFinite(value)) { sum += value; count += 1; }
          }
        }
        if (count) return sum / count;
      }
      return 1.4;
    };
  };

  const placePlant = (gltf) => {
    const plant = gltf.scene;
    plant.updateMatrixWorld(true);
    const findNode = (name) => {
      let found = null;
      plant.traverse((object) => {
        if (!found && (object.userData?.name === name || object.name === name)) found = object;
      });
      return found;
    };
    let heightAt = buildHeightField();

    // Shared material tuning (once per material): keep PBR look, lift slightly
    // so the equipment reads in the dark theme like the terrain does.
    const seen = new Set();
    plant.traverse((object) => {
      if (!object.isMesh) return;
      const material = object.material;
      if (seen.has(material)) return;
      seen.add(material);
      if (material.map) {
        material.map.anisotropy = quality.tier === 'low' ? 2 : 6;
        if (!WATER_MATERIAL.test(material.name)) {
          material.emissive = new THREE.Color(0xffffff);
          material.emissiveMap = material.map;
          material.emissiveIntensity = 0.07;
        }
      }
      if (WATER_MATERIAL.test(material.name)) material.envMapIntensity = 1.4;
      material.needsUpdate = true;
    });

    const concrete = new THREE.MeshStandardMaterial({ color: 0x77807b, roughness: 0.95, metalness: 0 });
    const S = PLANT_SCALE;
    const stages = {};

    STAGE_ORDER.forEach((key) => {
      const spec = STAGE_LAYOUT[key];
      const anchor = locationModules.get(key);
      const node = findNode(spec.node);
      if (!anchor || !node) { console.warn('Plant part missing for stage', key); return; }

      const inner = new THREE.Group();
      inner.attach(node);
      inner.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(inner);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // water surfaces (for process effects), measured before re-centring
      const waters = [];
      node.traverse((object) => {
        if (object.isMesh && WATER_MATERIAL.test(object.material?.name || '')) {
          const wb = new THREE.Box3().setFromObject(object);
          waters.push({
            cx: (wb.min.x + wb.max.x) / 2 - center.x,
            cz: (wb.min.z + wb.max.z) / 2 - center.z,
            sx: wb.max.x - wb.min.x,
            sz: wb.max.z - wb.min.z,
            y: wb.max.y
          });
        }
      });

      inner.position.set(-center.x, 0, -center.z);
      const content = new THREE.Group();
      content.rotation.y = spec.rot || 0;
      content.add(inner);

      const pad = new THREE.Mesh(new THREE.BoxGeometry(size.x + 0.5, 1.4, size.z + 0.5), concrete);
      pad.position.y = -0.68;
      content.add(pad);

      const root = new THREE.Group();
      root.scale.setScalar(S);
      root.add(content);
      root.position.set(spec.dx || 0, 0, spec.dz || 0);
      anchor.add(root);

      // half extents in group units after rotation
      const swap = Math.abs(Math.sin(spec.rot || 0)) > 0.5;
      const hx = ((swap ? size.z : size.x) / 2) * S;
      const hz = ((swap ? size.x : size.z) / 2) * S;

      // seat on the terrain: median of a 3x3 sample across the footprint
      /* START seating (re-runnable so spacing adjustments can re-seat the module) */
      const seat = () => {
        const cx = anchor.position.x + root.position.x;
        const cz = anchor.position.z + root.position.z;
        const samples = [];
        for (let ix = -1; ix <= 1; ix += 1) {
          for (let iz = -1; iz <= 1; iz += 1) samples.push(heightAt(cx + ix * hx * 0.8, cz + iz * hz * 0.8));
        }
        samples.sort((left, right) => left - right);
        anchor.position.y = samples[4];
      };
      seat();
      /* END seating */

      // process fx: drifting water sparks over the actual water surfaces
      const sparkCount = waters.length ? 26 : 0;
      let sparks = null;
      let sparkData = null;
      if (sparkCount) {
        const positions = new Float32Array(sparkCount * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        sparks = new THREE.Points(geometry, new THREE.PointsMaterial({
          color: 0x9ff5ea, size: 0.05, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending
        }));
        sparks.frustumCulled = false;
        content.add(sparks);
        sparkData = Array.from({ length: sparkCount }, (_, index) => ({
          water: waters[index % waters.length],
          phase: hash(index, 21, 1),
          lane: hash(index, 21, 2),
          radius: 0.25 + hash(index, 21, 3) * 0.6
        }));
      }

      const light = new THREE.PointLight(0x79f1dc, 0.15, 2.8, 2);
      light.position.set(0, 0.9, 0.25);
      anchor.add(light);

      anchor.userData.process = (time, active) => {
        const amount = active ? 1 : 0.35;
        if (sparks) {
          const array = sparks.geometry.attributes.position.array;
          sparkData.forEach((spark, index) => {
            const water = spark.water;
            let x;
            let z;
            if (spec.round) {
              const angle = spark.phase * Math.PI * 2 + time * (0.16 + amount * 0.34) * (index % 2 ? 1 : -1);
              const radius = (Math.min(water.sx, water.sz) / 2) * spark.radius;
              x = water.cx + Math.cos(angle) * radius;
              z = water.cz + Math.sin(angle) * radius;
            } else {
              const travel = (spark.phase + time * (0.05 + amount * 0.14)) % 1;
              x = water.cx + (travel - 0.5) * water.sx * 0.9;
              z = water.cz + (spark.lane - 0.5) * water.sz * 0.7;
            }
            array[index * 3] = x;
            array[index * 3 + 1] = water.y + 0.06;
            array[index * 3 + 2] = z;
          });
          sparks.geometry.attributes.position.needsUpdate = true;
          sparks.material.opacity += ((active ? 0.95 : 0.55) - sparks.material.opacity) * 0.08;
        }
        light.intensity += ((active ? 1.2 : 0.15) - light.intensity) * 0.08;
      };

      stages[key] = { anchor, root, seat, hx, hz, round: !!spec.round, lift: spec.lift || 0.35 };
    });

    /* ===== START module spacing =====
       Keeps a clear gap between neighbouring equipment footprints (no overlap)
       by nudging a module along the flow axis only when it would collide, then
       re-seats it on the terrain. Anchors and camera waypoints are untouched. */
    const MODULE_GAP = 0.4;
    const centreX = (stage) => stage.anchor.position.x + stage.root.position.x;
    const centreZ = (stage) => stage.anchor.position.z + stage.root.position.z;
    const ordered = STAGE_ORDER.map((key) => stages[key]).filter(Boolean);
    for (let pass = 0; pass < 2; pass += 1) {
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1];
        const current = ordered[index];
        const needX = previous.hx + current.hx + MODULE_GAP;
        const overlapZ = Math.abs(centreZ(current) - centreZ(previous)) < previous.hz + current.hz + MODULE_GAP;
        const actualX = centreX(current) - centreX(previous);
        if (overlapZ && actualX < needX) {
          current.root.position.x += Math.min(needX - actualX, 1.2);
          current.seat();
        }
      }
    }
    /* ===== END module spacing ===== */

    /* ===== START ground platforms =====
       Each module gets a levelled pad graded into the terrain (flat inside its
       footprint, blending back into the slope over a short skirt). Tanks then sit
       on solid ground instead of floating on a slope or sinking into it. The
       height field is rebuilt afterwards so pipes and supports follow the graded
       ground. */
    if (terrainRoot) {
      const PLATFORM_FALLOFF = 0.8;
      const platforms = ordered.map((stage) => ({
        x: centreX(stage), z: centreZ(stage), y: stage.anchor.position.y, hx: stage.hx + 0.12, hz: stage.hz + 0.12
      }));
      group.updateMatrixWorld(true);
      terrainRoot.updateMatrixWorld(true);
      const inverseGroup = new THREE.Matrix4().copy(group.matrixWorld).invert();
      const toGroupSpace = new THREE.Matrix4();
      const probe = new THREE.Vector3();
      terrainRoot.traverse((mesh) => {
        const geometry = mesh.geometry;
        if (!mesh.isMesh || !geometry?.attributes?.position) return;
        mesh.updateWorldMatrix(true, false);
        toGroupSpace.multiplyMatrices(inverseGroup, mesh.matrixWorld);
        const m = toGroupSpace.elements;
        if (Math.abs(m[9]) < 1e-9 || Math.abs(m[1]) > Math.abs(m[9]) * 1e-6 || Math.abs(m[5]) > Math.abs(m[9]) * 1e-6) return;
        const position = geometry.attributes.position;
        const normal = geometry.attributes.normal;
        let touched = false;
        for (let index = 0; index < position.count; index += 1) {
          probe.fromBufferAttribute(position, index).applyMatrix4(toGroupSpace);
          let y = probe.y;
          for (let p = 0; p < platforms.length; p += 1) {
            const platform = platforms[p];
            const dx = Math.max(0, Math.abs(probe.x - platform.x) - platform.hx);
            const dz = Math.max(0, Math.abs(probe.z - platform.z) - platform.hz);
            const distance = Math.hypot(dx, dz);
            if (distance >= PLATFORM_FALLOFF) continue;
            const u = distance / PLATFORM_FALLOFF;
            const weight = 1 - u * u * (3 - 2 * u);
            const target = platform.y;
            const next = y + (target - y) * weight;
            if (normal) {
              const nx = normal.getX(index) * (1 - weight);
              const ny = normal.getY(index) * (1 - weight);
              const nz = normal.getZ(index) * (1 - weight) + weight;
              const length = Math.hypot(nx, ny, nz) || 1;
              normal.setXYZ(index, nx / length, ny / length, nz / length);
            }
            y = next;
          }
          if (y !== probe.y) {
            position.setZ(index, position.getZ(index) + (y - probe.y) / m[9]);
            touched = true;
          }
        }
        if (touched) {
          position.needsUpdate = true;
          if (normal) normal.needsUpdate = true;
          geometry.computeBoundingBox();
          geometry.computeBoundingSphere();
        }
      });
      heightAt = buildHeightField();
    }
    /* ===== END ground platforms ===== */

    /* ===== START bubble / spark placement =====
       The ambient sparkles used to be scattered across the whole island (many ended
       up inside mountains). They are now bubbles that rise slowly from just above
       each module's ground, spread over the stages in process order, fading in and
       out so nothing pops, and never leaving the module's own footprint. */
    if (ordered.length) {
      const base = new Float32Array(sparkleCount * 3);
      const phase = new Float32Array(sparkleCount);
      const speed = new Float32Array(sparkleCount);
      const colors = new Float32Array(sparkleCount * 3);
      for (let index = 0; index < sparkleCount; index += 1) {
        const stage = ordered[index % ordered.length];
        base[index * 3] = centreX(stage) + (hash(index, 31, 1) - 0.5) * stage.hx * 1.6;
        base[index * 3 + 1] = stage.anchor.position.y + 0.1;
        base[index * 3 + 2] = centreZ(stage) + (hash(index, 31, 3) - 0.5) * stage.hz * 1.6;
        phase[index] = hash(index, 31, 4);
        speed[index] = 0.04 + hash(index, 31, 5) * 0.05;
      }
      sparkleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      sparkleMaterial.vertexColors = true;
      sparkleMaterial.size = 0.055;
      sparkleMaterial.opacity = 0.7;
      sparkleMaterial.needsUpdate = true;
      sparkles.frustumCulled = false;
      sparkleMotion = { base, phase, speed, colors, rise: 0.85, tone: new THREE.Color(palette.particle) };
    }
    /* ===== END bubble / spark placement ===== */

    // ---- pipes between consecutive stages, with beads of water flowing through ----
    const pipeMaterial = new THREE.MeshStandardMaterial({
      color: 0xbfe9e3, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.45, depthWrite: false
    });
    const postMaterial = new THREE.MeshStandardMaterial({ color: 0x8e9a96, roughness: 0.6, metalness: 0.5 });
    const pipes = [];
    /* ===== START pipe routing =====
       Orthogonal runs (horizontal along the flow, vertical risers/drops) with
       rounded bends. Each pipe leaves the facing edge of one module and enters
       the facing edge of the next at that module's connection height, and runs
       high enough to clear the terrain underneath. */
    const roundedPath = (points, bend) => {
      const clean = points.filter((point, i) => i === 0 || point.distanceTo(points[i - 1]) > 1e-4);
      const path = new THREE.CurvePath();
      let cursor = clean[0].clone();
      for (let i = 1; i < clean.length - 1; i += 1) {
        const before = clean[i - 1];
        const corner = clean[i];
        const after = clean[i + 1];
        const lengthIn = corner.distanceTo(before);
        const lengthOut = corner.distanceTo(after);
        const r = Math.min(bend, lengthIn * 0.5, lengthOut * 0.5);
        const entry = corner.clone().addScaledVector(before.clone().sub(corner).normalize(), r);
        const exit = corner.clone().addScaledVector(after.clone().sub(corner).normalize(), r);
        if (cursor.distanceTo(entry) > 1e-4) path.add(new THREE.LineCurve3(cursor.clone(), entry));
        path.add(new THREE.QuadraticBezierCurve3(entry, corner.clone(), exit));
        cursor = exit;
      }
      const last = clean[clean.length - 1];
      if (cursor.distanceTo(last) > 1e-4) path.add(new THREE.LineCurve3(cursor.clone(), last.clone()));
      return path;
    };
    const collarGeometry = new THREE.CylinderGeometry(0.078, 0.078, 0.045, 14);
    const flangeGeometry = new THREE.TorusGeometry(0.06, 0.013, 6, 16);
    const baseGeometry = new THREE.CylinderGeometry(0.075, 0.085, 0.03, 8);
    const zAxis = new THREE.Vector3(0, 0, 1);
    for (let index = 0; index < STAGE_ORDER.length - 1; index += 1) {
      const from = stages[STAGE_ORDER[index]];
      const to = stages[STAGE_ORDER[index + 1]];
      if (!from || !to) continue;
      const ax = centreX(from);
      const az = centreZ(from);
      const bx = centreX(to);
      const bz = centreZ(to);
      const dirX = Math.sign(bx - ax) || 1;
      const xa = ax + dirX * from.hx * 0.98;
      const xb = bx - dirX * to.hx * 0.98;
      const y0 = from.anchor.position.y + from.lift;
      const y1 = to.anchor.position.y + to.lift;
      const mx = (xa + xb) / 2;

      // clearance: lift the run above any terrain it crosses
      let run = Math.max(y0, y1);
      const probe = (x0, z0, x1, z1) => {
        for (let step = 0; step <= 12; step += 1) {
          const u = step / 12;
          run = Math.max(run, heightAt(x0 + (x1 - x0) * u, z0 + (z1 - z0) * u) + 0.3);
        }
      };
      probe(xa, az, mx, az);
      probe(mx, az, mx, bz);
      probe(mx, bz, xb, bz);

      const rise = Math.min(0.22, Math.abs(xb - xa) * 0.2);
      const route = [new THREE.Vector3(xa, y0, az)];
      if (run > y0 + 0.02) route.push(new THREE.Vector3(xa + dirX * rise, y0, az), new THREE.Vector3(xa + dirX * rise, run, az));
      route.push(new THREE.Vector3(mx, run, az));
      if (Math.abs(bz - az) > 0.02) route.push(new THREE.Vector3(mx, run, bz));
      if (run > y1 + 0.02) route.push(new THREE.Vector3(xb - dirX * rise, run, bz), new THREE.Vector3(xb - dirX * rise, y1, bz));
      route.push(new THREE.Vector3(xb, y1, bz));

      const curve = roundedPath(route, 0.16);
      const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.05, 10, false), pipeMaterial);
      group.add(pipe);
      [[xa, y0, az], [xb, y1, bz]].forEach(([x, y, z]) => {
        const collar = new THREE.Mesh(collarGeometry, postMaterial);
        collar.rotation.z = Math.PI / 2;
        collar.position.set(x - dirX * 0.01 * 0, y, z);
        group.add(collar);
      });
      // flanged joints where each straight run meets a bend
      curve.curves.forEach((segment, segmentIndex) => {
        if (segmentIndex === 0) return;
        const joint = new THREE.Mesh(flangeGeometry, postMaterial);
        joint.position.copy(segment.getPoint(0));
        joint.quaternion.setFromUnitVectors(zAxis, segment.getTangent(0).normalize());
        group.add(joint);
      });
      // supports: post + base plate + pipe clamp, only under level runs
      [0.25, 0.5, 0.75].forEach((u) => {
        const point = curve.getPointAt(u);
        const tangent = curve.getTangentAt(u);
        if (Math.abs(tangent.y) > 0.3) return;
        const floor = heightAt(point.x, point.z);
        const height = point.y - 0.05 - floor;
        if (height < 0.04) return;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, height, 8), postMaterial);
        post.position.set(point.x, floor + height / 2, point.z);
        group.add(post);
        const plate = new THREE.Mesh(baseGeometry, postMaterial);
        plate.position.set(point.x, floor + 0.012, point.z);
        group.add(plate);
        const clamp = new THREE.Mesh(flangeGeometry, postMaterial);
        clamp.position.copy(point);
        clamp.quaternion.setFromUnitVectors(zAxis, tangent.normalize());
        clamp.scale.setScalar(0.92);
        group.add(clamp);
      });
      pipes.push({ curve, from: STAGE_ORDER[index], to: STAGE_ORDER[index + 1], offset: index * 0.17 });
    }
    /* ===== END pipe routing ===== */

    const BEADS_PER_PIPE = 5;
    const beadMaterial = new THREE.MeshStandardMaterial({
      color: 0x71eee0, emissive: 0x2bbcb0, emissiveIntensity: 0.9, roughness: 0.1
    });
    const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.036, 8, 6), beadMaterial, Math.max(1, pipes.length * BEADS_PER_PIPE));
    beads.frustumCulled = false;
    group.add(beads);
    const beadMatrix = new THREE.Matrix4();
    const beadScale = new THREE.Vector3();
    const beadQuaternion = new THREE.Quaternion();
    const beadPosition = new THREE.Vector3();
    flowSystem = {
      update(time, active) {
        let slot = 0;
        pipes.forEach((pipe) => {
          const hot = active === pipe.from || active === pipe.to;
          const speed = hot ? 0.3 : 0.1;
          for (let bead = 0; bead < BEADS_PER_PIPE; bead += 1) {
            const progress = (time * speed + bead / BEADS_PER_PIPE + pipe.offset) % 1;
            pipe.curve.getPointAt(progress, beadPosition);
            beadScale.setScalar(hot ? 1.25 : 0.8);
            beadMatrix.compose(beadPosition, beadQuaternion, beadScale);
            beads.setMatrixAt(slot, beadMatrix);
            slot += 1;
          }
        });
        beads.instanceMatrix.needsUpdate = true;
        beadMaterial.emissiveIntensity += ((active ? 1.3 : 0.9) - beadMaterial.emissiveIntensity) * 0.08;
      }
    };
  };

  const plantReady = loadGLB('water_treatment_plant.glb')
    .catch((error) => { console.warn('Water-treatment plant GLB failed to load.', error); return null; });

  /* The landscape is "ready" once the terrain has loaded and the equipment has
     been placed on it. Until then the preview thumbnail is not drawn, and the
     hotspots still open their panels directly (see landscape-entry.js). */
  let landscapeReady = false;
  const markLandscapeReady = () => {
    if (landscapeReady) return;
    landscapeReady = true;
    document.body.classList.add('landscape-ready');
    document.body.dispatchEvent(new CustomEvent('dws:landscape-ready'));
  };
  Promise.all([terrainReady, plantReady]).then(([, plantGltf]) => {
    // Equipment is only placed on the real terrain; there is no stand-in ground.
    if (plantGltf && terrainRoot) placePlant(plantGltf);
  }).catch((error) => console.warn('Water-treatment plant could not be placed.', error))
    .finally(() => {
      if (!terrainRoot) return; // terrain missing: stay "not ready" so hotspots open panels directly
      // let the freshly added geometry upload on the next frame before revealing it
      requestAnimationFrame(() => requestAnimationFrame(markLandscapeReady));
    });

  let activeLocation = null;
  let flowSystem = null;
  const originalVisibility = new Map();
  let open = false;

  const setOpen = (nextOpen) => {
    if (nextOpen === open) return;
    open = nextOpen;
    if (open) {
      scene.traverse((object) => {
        if (!object.isMesh && !object.isPoints && !object.isLine && !object.isLineSegments) return;
        originalVisibility.set(object, object.visible);
        let parent = object;
        let belongsToLandscape = false;
        while (parent) {
          if (parent === group) {
            belongsToLandscape = true;
            break;
          }
          parent = parent.parent;
        }
        object.visible = belongsToLandscape;
      });
      group.visible = true;
      return;
    }

    originalVisibility.forEach((visible, object) => { object.visible = visible; });
    originalVisibility.clear();
    group.visible = false;
  };

  const setLocation = (key) => {
    activeLocation = key;
  };

  group.visible = false;

  return {
    setOpen,
    setPreviewScale(scale) {
      // Uniform scale of the whole landscape only; the equipment stays in place.
      group.scale.setScalar(scale);
      terrainGrade.uScale.value = scale;
    },
    setLocation,
    isReady: () => landscapeReady,
    update(time) {
      sparkles.rotation.y = Math.sin(time * 0.05) * 0.01; // gentle sway only; sparks stay over their modules
      sparkles.position.y = sparkleMotion ? 0 : Math.sin(time * 0.42) * 0.08;
      if (sparkleMotion) {
        const { base, phase, speed, colors, rise, tone } = sparkleMotion;
        const array = sparkleGeometry.attributes.position.array;
        for (let index = 0; index < sparkleCount; index += 1) {
          const progress = (phase[index] + time * speed[index]) % 1;
          const fade = Math.sin(progress * Math.PI);
          array[index * 3] = base[index * 3] + Math.sin(time * 0.5 + phase[index] * 6.283) * 0.03;
          array[index * 3 + 1] = base[index * 3 + 1] + progress * rise;
          array[index * 3 + 2] = base[index * 3 + 2] + Math.cos(time * 0.43 + phase[index] * 6.283) * 0.03;
          colors[index * 3] = tone.r * fade;
          colors[index * 3 + 1] = tone.g * fade;
          colors[index * 3 + 2] = tone.b * fade;
        }
        sparkleGeometry.attributes.position.needsUpdate = true;
        sparkleGeometry.attributes.color.needsUpdate = true;
      }
      locationModules.forEach((module, key) => module.userData.process?.(time, key === activeLocation));
      flowSystem?.update(time, activeLocation);
    },
    dispose() {
      group.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
        else object.material?.dispose?.();
      });
      scene.remove(group);
    }
  };
}

/* ------------------------------------------------------------
   Terrain underside
   The GLB ships a flat base plate joined to the terrain rim by a few very
   long triangles whose UVs stretch one texel row down the whole wall — the
   "vertical streaks". Only those base/wall triangles are removed; every
   triangle of the mountain surface is untouched. In their place a real,
   tapering rock body is built from the terrain's own rim, so the island
   ends in an irregular, natural underside instead of a straight cut.
   All values are in the landscape group's space (same units as the modules).
   ------------------------------------------------------------ */
/* START underside tuning: deeper, irregular, rock-coloured taper (was a shallow flat green-tinted slab) */
const UNDERSIDE = {
  depth: 1.5,
  bins: 512,       // angular resolution of the rim outline
  rings: 12,       // rings between rim and keel
  bandWidth: 0.12  // outer rim band used to read edge height / colour
};
/* END underside tuning */

function buildTerrainUnderside(THREE, group, model, quality) {
  group.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const toGroup = new THREE.Matrix4();
  const vertex = new THREE.Vector3();

  /* ---- 1. find base plate + wall triangles and the rim they hang from ---- */
  const strip = [];   // { geometry, kept }
  const rim = [];     // { x, y, z, u, v }
  let mapImage = null;

  model.traverse((object) => {
    if (!object.isMesh || !object.geometry?.index || !object.geometry.attributes.position) return;
    const geometry = object.geometry;
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    geometry.computeBoundingBox();
    const floor = geometry.boundingBox.min.z;      // model is Z-up in mesh space
    if (floor > -100) return;                      // no base plate in this piece
    const cut = floor + 1;
    if (!mapImage && object.material?.map?.image) mapImage = object.material.map.image;

    const low = new Uint8Array(position.count);
    for (let i = 0; i < position.count; i += 1) low[i] = position.getZ(i) < cut ? 1 : 0;

    const index = geometry.index.array;
    const kept = new index.constructor(index.length);
    const isRim = new Uint8Array(position.count);
    let count = 0;
    for (let i = 0; i < index.length; i += 3) {
      const a = index[i];
      const b = index[i + 1];
      const c = index[i + 2];
      if (low[a] || low[b] || low[c]) {
        if (!low[a]) isRim[a] = 1;
        if (!low[b]) isRim[b] = 1;
        if (!low[c]) isRim[c] = 1;
        continue;
      }
      kept[count] = a;
      kept[count + 1] = b;
      kept[count + 2] = c;
      count += 3;
    }
    if (count === index.length) return;

    object.updateWorldMatrix(true, false);
    toGroup.multiplyMatrices(inverse, object.matrixWorld);
    for (let i = 0; i < position.count; i += 1) {
      if (!isRim[i]) continue;
      vertex.fromBufferAttribute(position, i).applyMatrix4(toGroup);
      rim.push({
        x: vertex.x,
        y: vertex.y,
        z: vertex.z,
        u: uv ? uv.getX(i) : 0,
        v: uv ? uv.getY(i) : 0
      });
    }
    strip.push({ geometry, kept: kept.slice(0, count) });
  });

  if (!strip.length || rim.length < 16) return;

  /* ---- 2. rim outline: outermost point per angular bin ---- */
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  rim.forEach((p) => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  });
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const halfX = (maxX - minX) / 2;
  const halfZ = (maxZ - minZ) / 2;
  const B = UNDERSIDE.bins;

  // terrain colour lookup so the rim of the rock body matches the surface
  let colorAt = null;
  if (mapImage) {
    try {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(mapImage, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      colorAt = (u, v) => {
        const px = Math.min(size - 1, Math.max(0, Math.floor((u - Math.floor(u)) * size)));
        const py = Math.min(size - 1, Math.max(0, Math.floor((v - Math.floor(v)) * size)));
        const o = (py * size + px) * 4;
        return [data[o] / 255, data[o + 1] / 255, data[o + 2] / 255];
      };
    } catch (error) {
      colorAt = null;
    }
  }

  const radius = new Float32Array(B).fill(-1);
  const binOf = (p) => {
    let a = Math.atan2(p.z - cz, p.x - cx);
    if (a < 0) a += Math.PI * 2;
    return Math.min(B - 1, Math.floor((a / (Math.PI * 2)) * B));
  };
  rim.forEach((p) => {
    const bin = binOf(p);
    const r = Math.hypot(p.x - cx, p.z - cz);
    p.bin = bin;
    p.r = r;
    if (r > radius[bin]) radius[bin] = r;
  });

  const edge = Array.from({ length: B }, () => ({ n: 0, x: 0, y: 0, z: 0, cr: 0, cg: 0, cb: 0, has: false }));
  rim.forEach((p) => {
    if (p.r < radius[p.bin] - UNDERSIDE.bandWidth) return;
    const e = edge[p.bin];
    e.n += 1; e.x += p.x; e.y += p.y; e.z += p.z;
    if (colorAt) {
      const [r, g, b] = colorAt(p.u, p.v);
      e.cr += r; e.cg += g; e.cb += b;
    }
  });
  edge.forEach((e) => {
    if (!e.n) return;
    e.x /= e.n; e.y /= e.n; e.z /= e.n; e.cr /= e.n; e.cg /= e.n; e.cb /= e.n;
    e.has = true;
  });
  // fill empty bins from their nearest filled neighbours
  for (let i = 0; i < B; i += 1) {
    if (edge[i].has) continue;
    let prev = i;
    let next = i;
    let dp = 0;
    let dn = 0;
    while (!edge[prev].has && dp < B) { prev = (prev - 1 + B) % B; dp += 1; }
    while (!edge[next].has && dn < B) { next = (next + 1) % B; dn += 1; }
    const t = dp / Math.max(1, dp + dn);
    const a = edge[prev];
    const b = edge[next];
    edge[i] = {
      n: 0, has: false, fill: true,
      x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
      cr: a.cr + (b.cr - a.cr) * t, cg: a.cg + (b.cg - a.cg) * t, cb: a.cb + (b.cb - a.cb) * t
    };
  }
  edge.forEach((e) => { e.has = true; });

  /* ---- 3. build the tapering rock body ---- */
  let rimMinY = Infinity;
  edge.forEach((e) => { rimMinY = Math.min(rimMinY, e.y); });

  const K = UNDERSIDE.rings;
  const smooth = (t) => t * t * (3 - 2 * t);

  const positions = new Float32Array((B * (K + 1) + 1) * 3);
  const colors = new Float32Array((B * (K + 1) + 1) * 3);
  /* START underside v2: terrain-matched flank, tapering to a rocky keel (no flat base)
     - Above the lowest rim point the body continues the mountain flank in the same
       forest-green palette as the terrain (this is what the tall right-hand peak
       sits on, so it no longer reads as a separate brown/grey object).
     - Below it, the flank darkens into shadowed earth and every ring converges on a
       single keel point, so there is no flat disc / plane at the bottom at all. */
  const earth = new THREE.Color(0x2b2a22);
  const deep = new THREE.Color(0x15130f);
  const forestFloor = new THREE.Color(0x24381f);
  const tint = new THREE.Color();
  const sample = new THREE.Color();
  const hsl = { h: 0, s: 0, l: 0 };
  const keelY = rimMinY - UNDERSIDE.depth * 1.1;
  const keelX = cx;
  const keelZ = cz;

  for (let k = 0; k <= K; k += 1) {
    const t = k / K;
    // collapse weight: 0 along the upper flank, 1 at the keel
    const collapse = Math.pow(smooth(Math.min(1, Math.max(0, (t - 0.3) / 0.7))), 1.25);
    for (let i = 0; i < B; i += 1) {
      const angle = (i / B) * Math.PI * 2;
      const e = edge[i];
      const wobble = Math.sin(angle * 5 + k * 0.7) * 0.5 + Math.sin(angle * 13 + k * 1.9) * 0.3;
      const bottomY = rimMinY - UNDERSIDE.depth * (0.8 + 0.2 * Math.sin(angle * 3 + 1.3) + 0.1 * wobble);

      // side flank: drop from the rim and lean inward proportionally to the drop,
      // like a real mountain slope rather than a vertical cut
      const sideY = e.y + (bottomY - e.y) * Math.pow(t, 0.85);
      const drop = e.y - sideY;
      const toX = cx - e.x;
      const toZ = cz - e.z;
      const toLength = Math.hypot(toX, toZ) || 1;
      const inset = Math.min(drop * 0.45 * (1 + 0.2 * wobble) + smooth(t) * 0.2, toLength * 0.85);
      const sideX = e.x + (toX / toLength) * inset;
      const sideZ = e.z + (toZ / toLength) * inset;

      const px = sideX + (keelX - sideX) * collapse;
      const pz = sideZ + (keelZ - sideZ) * collapse;
      const py = sideY + (keelY - sideY) * collapse + wobble * 0.05 * Math.sin(t * Math.PI);

      const o = (k * B + i) * 3;
      positions[o] = px;
      positions[o + 1] = py;
      positions[o + 2] = pz;

      // colour: terrain rim colour pushed to the natural green family, then shadowed earth below the rim
      if (colorAt) sample.setRGB(e.cr, e.cg, e.cb, THREE.SRGBColorSpace);
      else sample.copy(forestFloor);
      sample.getHSL(hsl);
      sample.setHSL(Math.min(0.32, Math.max(0.22, hsl.h)), Math.max(0.22, hsl.s * 0.85), hsl.l * 0.85);
      tint.copy(sample).lerp(forestFloor, 0.25 + 0.35 * Math.min(1, drop / 3));
      const below = Math.min(1, Math.max(0, (rimMinY - py) / UNDERSIDE.depth));
      tint.lerp(earth, smooth(Math.min(1, below * 1.4)) * 0.9);
      tint.lerp(deep, smooth(Math.min(1, Math.max(0, below - 0.5) * 2)));
      tint.multiplyScalar((0.9 + hash(i, k, 24) * 0.2) * (0.94 + 0.06 * Math.sin(py * 16 + Math.sin(angle * 7))));
      colors[o] = tint.r;
      colors[o + 1] = tint.g;
      colors[o + 2] = tint.b;
    }
  }
  // keel vertex closes the bottom
  const keel = B * (K + 1);
  positions[keel * 3] = keelX;
  positions[keel * 3 + 1] = keelY;
  positions[keel * 3 + 2] = keelZ;
  colors[keel * 3] = deep.r;
  colors[keel * 3 + 1] = deep.g;
  colors[keel * 3 + 2] = deep.b;
  /* END underside v2 */

  const indices = [];
  for (let k = 0; k < K; k += 1) {
    for (let i = 0; i < B; i += 1) {
      const n = (i + 1) % B;
      const a = k * B + i;
      const b = k * B + n;
      const c = (k + 1) * B + i;
      const d = (k + 1) * B + n;
      indices.push(a, c, b, b, c, d);
    }
  }
  for (let i = 0; i < B; i += 1) {
    indices.push(K * B + i, keel, K * B + ((i + 1) % B));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    flatShading: true,        // faceted rock read, no smooth plastic gradient
    side: THREE.DoubleSide,   // winding-proof; the body is closed so this is cosmetic only
    emissive: 0x1d2a1b,
    emissiveIntensity: 0.3
  });
  const body = new THREE.Mesh(geometry, material);
  body.name = 'terrainUnderside';

  /* ---- 4. only now drop the stretched base/wall triangles ---- */
  strip.forEach(({ geometry: source, kept }) => {
    source.setIndex(new THREE.BufferAttribute(kept, 1));
  });
}

function buildBubbleField(THREE, scene, palette, quality) {
  const group = new THREE.Group();
  group.position.set(0, 0, -4);
  group.userData.immersiveBubbleField = true;
  scene.add(group);

  const tiers = [
    { count: quality.tier === 'low' ? 58 : 112, radius: 0.075, opacity: 0.58, color: palette.particle, spread: 22, depth: 24, speed: 0.16 },
    { count: quality.tier === 'low' ? 70 : 140, radius: 0.12, opacity: 0.42, color: palette.glass, spread: 18, depth: 19, speed: 0.25 },
    { count: quality.tier === 'low' ? 42 : 84, radius: 0.18, opacity: 0.3, color: palette.dropRim, spread: 14, depth: 14, speed: 0.34 }
  ];
  const layers = [];

  tiers.forEach((tier, tierIndex) => {
    const geometry = new THREE.SphereGeometry(tier.radius, tierIndex === 2 ? 12 : 8, tierIndex === 2 ? 10 : 6);
    const material = new THREE.MeshStandardMaterial({
      color: tier.color,
      roughness: 0.18,
      metalness: 0,
      transparent: true,
      opacity: tier.opacity,
      depthWrite: false,
      emissive: tier.color,
      emissiveIntensity: tierIndex === 2 ? 0.28 : 0.12
    });
    const mesh = new THREE.InstancedMesh(geometry, material, tier.count);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    group.add(mesh);

    const items = Array.from({ length: tier.count }, (_, index) => ({
      x: (hash(index, tierIndex, 1) - 0.5) * tier.spread * 2,
      y: (hash(index, tierIndex, 2) - 0.5) * 13,
      z: (hash(index, tierIndex, 3) - 0.5) * tier.depth,
      phase: hash(index, tierIndex, 4) * Math.PI * 2,
      speed: tier.speed * (0.75 + hash(index, tierIndex, 5) * 0.7),
      scale: 0.65 + hash(index, tierIndex, 6) * 1.7
    }));
    layers.push({ mesh, items, spread: tier.spread, speed: tier.speed });
  });

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();

  return {
    update(time) {
      layers.forEach(({ mesh, items, spread }) => {
        items.forEach((item, index) => {
          position.set(
            item.x + Math.sin(time * 0.12 + item.phase) * 0.8,
            ((item.y + time * item.speed + 6.5) % 13) - 6.5,
            item.z + Math.cos(time * 0.1 + item.phase) * 0.6
          );
          scale.setScalar(item.scale * (0.88 + Math.sin(time * 0.7 + item.phase) * 0.08));
          matrix.compose(position, rotation, scale);
          mesh.setMatrixAt(index, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.position.x = Math.sin(time * 0.035) * spread * 0.045;
      });
    },
    dispose() {
      layers.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      scene.remove(group);
    }
  };
}

function hash(index, layer, salt) {
  const value = Math.sin((index + 1) * 12.9898 + (layer + 1) * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

export { CHAMBER_LAYOUT };
