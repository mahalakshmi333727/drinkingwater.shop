/* ============================================================
   icon-bubble-field.js — front-page 3D bubble environment
   ------------------------------------------------------------
   Scope: mounts ONLY into the icon-scene's own canvas
   ([data-icon-bubble-canvas], inside .icon-scene__field). It never
   touches #stage-canvas, three-scene.js, or any of the persistent
   facility/landscape modules — those stay exactly as they are.

   Reuses the existing Three.js architecture rather than inventing
   a new one:
     - particleVertex / particleFragment (shaders.js) — the same
       GPU-only rise+wobble+rim-lit-bubble shader three-scene.js
       already uses for its own suspended motes/bubbles.
     - paletteFor()/PALETTE (environment.js) — the same lab/deep
       colour pairs the facility scene reads, so the two scenes
       always agree on "what teal/ice/navy currently mean".
     - detectQuality() (quality.js) — the same device-tier budget,
       scaled down for a decorative background layer.

   What it adds, specific to this brief:
     - a soft-particle layer + a rim-lit "bubble" layer (depth)
     - eight glow anchors unprojected from the real screen position
       of the 7 hotspots + the central bottle, so the lighting
       genuinely sits where those DOM elements are — not a random
       backdrop behind flat icons
     - a brief anchor brighten/dim tied to the existing
       `dws:hotspot-preview` event icon-scene.js already dispatches,
       so the bubble field visibly reacts to the same launch/close
       moments the hotspots already animate for
     - theme (lab/deep) + reduced-motion + visibility handling

   Read-only with respect to every other module: this file only
   ever reads document-theme state and the hotspots' own screen
   position; it never writes to the DOM apart from its own canvas.
   ============================================================ */

import { particleVertex, particleFragment } from './shaders.js';
import { paletteFor } from './environment.js';
import { detectQuality } from './quality.js';

export async function initIconBubbleField(canvas) {
  if (!canvas || !supportsWebGL()) return null;

  const THREE = await import('three');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const quality = scaleDown(detectQuality());

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
    stencil: false,
    depth: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60);
  camera.position.set(0, 0, 13);

  let palette = paletteFor(document.documentElement.dataset.theme);
  let isDeep = document.documentElement.dataset.theme !== 'lab';

  /* ---------- ambient soft-particle layer (uRim ~0.12) ---------- */
  const dust = makeSystem(THREE, {
    count: quality.dust,
    color: palette.particle,
    opacity: isDeep ? 0.4 : 0.46,
    rim: 0.12,
    rise: 0.11,
    span: 16,
    wobble: 0.7,
    sizeRange: isDeep ? [0.7, 1.8] : [0.9, 2.4],
    spread: (i, position) => {
      position[i * 3] = (Math.random() - 0.5) * 20;
      position[i * 3 + 1] = (Math.random() - 0.5) * 16;
      position[i * 3 + 2] = (Math.random() - 0.5) * 9 - 3;
    }
  });
  scene.add(dust.points);

  /* ---------- rim-lit "bubble" layer (uRim 1.0), the main effect ---------- */
  const bubbles = makeSystem(THREE, {
    count: quality.bubbles,
    color: isDeep ? palette.sky : palette.lamp,
    opacity: isDeep ? 0.62 : 0.78,
    rim: 1.0,
    rise: 0.5,
    span: 15,
    wobble: 0.5,
    sizeRange: isDeep ? [2.2, 6.4] : [2.6, 7.2],
    spread: (i, position) => {
      position[i * 3] = (Math.random() - 0.5) * 18;
      position[i * 3 + 1] = (Math.random() - 0.5) * 15;
      position[i * 3 + 2] = (Math.random() - 0.5) * 11 - 2;
    }
  });
  scene.add(bubbles.points);

  /* ---------- 8 glow anchors: 7 hotspots + the central bottle ----------
     Unprojected from the *real* screen position of the existing DOM
     elements, recomputed on resize — so the glow genuinely sits behind
     whichever icon/bottle is on screen, at every breakpoint, without
     this module knowing anything about layout or copying coordinates. */
  const anchorEls = () => ({
    hotspots: Array.from(document.querySelectorAll('.icon-scene__hotspot')),
    can: document.querySelector('.icon-scene__can')
  });
  const anchors = [];
  function rebuildAnchors() {
    const { hotspots, can } = anchorEls();
    const targets = can ? [...hotspots, can] : hotspots;
    while (anchors.length < targets.length) {
      const anchor = makeAnchor(THREE, palette, isDeep, anchors.length === targets.length - 1 && Boolean(can));
      anchors.push(anchor);
      scene.add(anchor.sprite);
    }
    while (anchors.length > targets.length) {
      const anchor = anchors.pop();
      scene.remove(anchor.sprite);
      anchor.dispose();
    }
    anchors.forEach((anchor, index) => {
      anchor.el = targets[index] || null;
    });
  }

  function placeAnchors() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (!w || !h) return;
    anchors.forEach((anchor) => {
      if (!anchor.el) return;
      const rect = anchor.el.getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      const ndcX = ((rect.left + rect.width / 2) / w) * 2 - 1;
      const ndcY = -(((rect.top + rect.height / 2) / h) * 2 - 1);
      // Cast a ray through the icon's real screen position and drop the
      // anchor a little further along it than the camera-to-origin
      // distance, so it sits just behind the DOM icon/bottle rather than
      // exactly on top of it.
      const rayPoint = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
      const dir = rayPoint.sub(camera.position).normalize();
      const distance = camera.position.z + (anchor.isCentral ? 3 : 1.5);
      anchor.basePosition.copy(camera.position).addScaledVector(dir, distance);
    });
  }

  /* ---------- pointer parallax (background layers only — anchors stay
     locked to their DOM element so they never drift out of place) ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  function onPointerMove(event) {
    pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
  }
  if (!prefersReducedMotion) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
  }

  /* ---------- react to the same open/close moments the hotspots use ---------- */
  let activeKey = null;
  document.body.addEventListener('dws:hotspot-preview', (event) => {
    activeKey = event.detail?.key || null;
  });

  /* ---------- resize ---------- */
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  /* ---------- theme changes: keep colour + blend mode in sync with the
     same toggle three-scene.js already listens to ---------- */
  const themeWatcher = new MutationObserver(() => {
    isDeep = document.documentElement.dataset.theme !== 'lab';
    palette = paletteFor(document.documentElement.dataset.theme);
    applyPalette();
    renderOnce();
  });
  themeWatcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function applyPalette() {
    dust.material.blending = isDeep ? THREE.AdditiveBlending : THREE.NormalBlending;
    dust.uniforms.uColor.value.set(palette.particle);
    dust.uniforms.uOpacity.value = isDeep ? 0.4 : 0.46;
    dust.material.needsUpdate = true;

    bubbles.material.blending = isDeep ? THREE.AdditiveBlending : THREE.NormalBlending;
    bubbles.uniforms.uColor.value.set(isDeep ? palette.sky : palette.lamp);
    bubbles.uniforms.uOpacity.value = isDeep ? 0.62 : 0.78;
    bubbles.material.needsUpdate = true;

  }

  resize();

  /* ---------- visibility: pause whenever the icon scene itself is
     hidden (landscape opened, scrolled past, tab backgrounded) rather
     than trying to enumerate every class that can do that ---------- */
  const sceneEl = document.querySelector('[data-icon-scene]');
  let visible = true;
  function checkVisible() {
    if (!sceneEl) return;
    const style = window.getComputedStyle(sceneEl);
    visible = style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none';
  }
  checkVisible();
  const visibilityTimer = window.setInterval(checkVisible, 500);

  let tabVisible = !document.hidden;
  document.addEventListener('visibilitychange', () => { tabVisible = !document.hidden; });

  const clock = new THREE.Clock();

  function renderOnce() {
    dust.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    bubbles.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    renderer.render(scene, camera);
  }

  function tick() {
    requestAnimationFrame(tick);
    if (!tabVisible || !visible) return;

    const t = clock.getElapsedTime();
    dust.uniforms.uTime.value = t;
    bubbles.uniforms.uTime.value = t;

    if (!prefersReducedMotion) {
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      dust.points.rotation.y = pointer.x * 0.06;
      bubbles.points.rotation.y = pointer.x * 0.08;
      bubbles.points.rotation.x = -pointer.y * 0.05;
    }

    renderer.render(scene, camera);
  }

  if (prefersReducedMotion) {
    // Give the DOM one layout pass so anchor rects are final, then
    // draw a single settled frame instead of animating forever.
    requestAnimationFrame(() => { renderOnce(); });
  } else {
    tick();
  }

  return {
    scene,
    camera,
    renderer,
    refreshAnchors() { if (prefersReducedMotion) renderOnce(); },
    dispose() {
      window.clearInterval(visibilityTimer);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      window.removeEventListener('pointermove', onPointerMove);
      themeWatcher.disconnect();
    }
  };
}

/* ------------------------------------------------------------
   Particle system builder — identical technique to particles.js's
   own makeSystem(), duplicated locally (rather than imported) so
   this module never shares live buffers/uniforms with the facility
   scene and can be tuned independently for a decorative layer.
   ------------------------------------------------------------ */
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
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
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
    blending: THREE.NormalBlending
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return { points, geometry, material, uniforms };
}

/* ------------------------------------------------------------
   Glow anchor — a soft radial-gradient sprite unprojected to sit
   just behind a real DOM icon (or the central bottle), giving that
   element an actual pocket of light/depth in the 3D scene instead
   of floating over a flat backdrop.
   ------------------------------------------------------------ */
function makeAnchor(THREE, palette, isDeep, isCentral) {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 128;
  canvasEl.height = 128;
  const ctx = canvasEl.getContext('2d');
  const texture = new THREE.CanvasTexture(canvasEl);

  function paint(color) {
    ctx.clearRect(0, 0, 128, 128);
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, hexToRgba(color, 0.55));
    gradient.addColorStop(0.5, hexToRgba(color, 0.22));
    gradient.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    texture.needsUpdate = true;
  }
  paint(palette.lamp);

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: isDeep ? THREE.AdditiveBlending : THREE.NormalBlending,
    // the central anchor's glow (behind the centre "Contact" bottle) is
    // suppressed in dark theme only — every other anchor keeps its glow
    opacity: (isCentral && isDeep) ? 0 : (isDeep ? 0.55 : 0.52)
  });
  const sprite = new THREE.Sprite(material);
  const baseScale = isCentral ? 5.2 : 2.4;
  sprite.scale.setScalar(baseScale);

  const basePosition = new THREE.Vector3();
  const phase = Math.random() * Math.PI * 2;
  let activeAmount = 0;

  return {
    sprite,
    isCentral,
    el: null,
    basePosition,
    update(t, index, isActive, reducedMotion, isDeepNow) {
      sprite.position.copy(basePosition);
      const targetActive = isActive ? 1 : 0;
      activeAmount += (targetActive - activeAmount) * (reducedMotion ? 1 : 0.08);
      const pulse = reducedMotion ? 1 : 1 + Math.sin(t * 0.9 + phase + index) * 0.08;
      // the central anchor's glow (behind the centre "Contact" bottle) is
      // suppressed in dark theme only — every other anchor keeps its glow
      const suppressCentralGlow = isCentral && (typeof isDeepNow === 'boolean' ? isDeepNow : isDeep);
      material.opacity = suppressCentralGlow
        ? 0
        : (isDeep ? 0.5 : 0.52) + activeAmount * (isDeep ? 0.4 : 0.26);
      sprite.scale.setScalar(baseScale * pulse * (1 + activeAmount * 0.35));
    },
    applyPalette(nextPalette, deep) {
      paint(nextPalette.lamp);
      material.blending = deep ? THREE.AdditiveBlending : THREE.NormalBlending;
      material.opacity = (isCentral && deep) ? 0 : (deep ? 0.5 : 0.52);
      material.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      material.dispose();
    }
  };
}

function hexToRgba(hex, alpha) {
  const int = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* A decorative background layer runs at a fraction of the facility
   scene's already-tiered budget — this is one of several Three.js
   layers that can be on screen at once. */
function scaleDown(quality) {
  const divisor = quality.tier === 'high' ? 6 : quality.tier === 'mid' ? 8 : 12;
  return {
    pixelRatioCap: Math.min(quality.pixelRatioCap, 1.75),
    dust: Math.max(40, Math.round(quality.motes / divisor)),
    bubbles: Math.max(16, Math.round(quality.bubbles / (divisor / 2.2)))
  };
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch (_) {
    return false;
  }
}
