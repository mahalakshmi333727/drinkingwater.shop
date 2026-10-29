/* ============================================================
   ambient.js — background scene
   Intentionally minimal for this build: a slow drift of suspended
   points, tinted by the active theme. The per-chapter scenes
   (aquifer, pipeline, cartridge, drop) each get their own module
   and mount into the [data-scene] placeholders.
   ============================================================ */

const COUNT = 900;
const SPREAD = 26;

export async function initAmbientScene(canvas) {
  if (!canvas) return null;

  const THREE = await import('three');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.z = 16;

  /* suspended points */
  const positions = new Float32Array(COUNT * 3);
  const drift = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * SPREAD;
    positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
    positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD * 0.6;
    drift[i] = 0.2 + Math.random() * 0.8;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 0.045,
    color: new THREE.Color(readAccent()),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  /* pointer parallax */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (event) => {
    pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  /* theme colour follows the toggle */
  const themeWatcher = new MutationObserver(() => {
    material.color.set(readAccent());
    material.opacity = document.documentElement.dataset.theme === 'lab' ? 0.35 : 0.5;
  });
  themeWatcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  const clock = new THREE.Clock();

  const render = () => {
    requestAnimationFrame(render);
    if (!running) return;

    const t = clock.getElapsedTime();
    const pos = geometry.attributes.position.array;

    for (let i = 0; i < COUNT; i += 1) {
      pos[i * 3 + 1] -= 0.0025 * drift[i];
      if (pos[i * 3 + 1] < -SPREAD / 2) pos[i * 3 + 1] = SPREAD / 2;
    }
    geometry.attributes.position.needsUpdate = true;

    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;

    points.rotation.y = Math.sin(t * 0.05) * 0.12 + pointer.x * 0.08;
    points.rotation.x = -pointer.y * 0.06;

    renderer.render(scene, camera);
  };

  render();

  return { scene, camera, renderer };
}

function readAccent() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  return value || '#3FD9C9';
}
