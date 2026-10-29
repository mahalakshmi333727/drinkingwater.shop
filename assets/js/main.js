/* ============================================================
   main.js — entry point
   Boot order: loader → shell → scroll systems → (after first paint) 3D scenes
   ============================================================ */

import { runLoader } from './modules/loader.js';
import { initNavigation } from './modules/navigation.js';
import { initProgress } from './modules/progress.js';
import { initControls } from './modules/controls.js';
import { initAudio } from './modules/audio.js';
import { initReveal } from './modules/reveal.js';
import { initPanels } from './modules/panels.js';
import { initIconScene } from './modules/icon-scene.js?v=circle-nav';
import { initHero } from './modules/hero.js';
import { initPurification } from './modules/purification.js';
import { initFilterLab } from './modules/filter-lab.js';
import { initQualityLab } from './modules/quality-lab.js';
import { initHandlingLab } from './modules/handling-lab.js';
import { initStorageMaterials } from './modules/storage-materials.js';
import { initComparison } from './modules/comparison.js';
import { initHabits } from './modules/habits.js';
import { initFinale } from './modules/finale.js';
import { initAbout } from './modules/about.js';
import { initLandscapeEntry } from './modules/landscape-entry.js';
import { initWaterFacility } from './three/three-scene.js?v=landscape-single-1';
import { initIconBubbleField } from './three/icon-bubble-field.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function boot() {
  document.body.classList.add('immersive-mode');
  // Year in the footer
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  initNavigation();
  initControls();
  initAbout();
  initLandscapeEntry();
  // PART 13: attach one optional, user-started ambience engine to the existing sound event.
  initAudio({ prefersReducedMotion });
  initPanels();
  // New: the 7-hotspot immersive gateway (Penderecki's Garden-style interaction),
  // built from the existing seven lab chapters — see modules/icon-scene.js.
  initIconScene();
  // New: the front-page bubble/depth environment behind the hotspots + bottle
  // only — a separate, decorative Three.js layer that never touches the
  // persistent facility scene below. Non-blocking and self-fallback-safe.
  initProgress();
  initReveal({ prefersReducedMotion });
  initHero({ prefersReducedMotion });

  // Heavy WebGL work starts only after the shell has painted, so the page and
  // the page content are visible immediately and the main thread is free.
  afterFirstPaint(startScenes);
}

/* Runs fn after the browser has painted at least one frame. */
function afterFirstPaint(fn) {
  requestAnimationFrame(() => window.setTimeout(fn, 0));
}

function startScenes() {
  // Decorative bubble layer behind the hotspots + bottle (own small renderer).
  initIconBubbleField(document.querySelector('[data-icon-bubble-canvas]'))
    .catch((err) => console.warn('Icon bubble field unavailable, continuing without it.', err));

  // Persistent background: the purification facility. It renders a single
  // composed frame under reduced-motion rather than disappearing, and the
  // page is fully usable if WebGL is unavailable.
  initWaterFacility(document.getElementById('stage-canvas'), { reducedMotion: prefersReducedMotion })
    .then((scene) => {
      if (!scene) {
        document.body.classList.add('no-webgl');
        return;
      }
      window.__dwsScene = scene; // handy while the chapter scenes are being built
      // PART 5: connect the purification chapter to the existing scene and scroll system.
      initPurification({ prefersReducedMotion, scene });
      // PART 6: connect the filter laboratory to the same scene and scroll system.
      initFilterLab({ prefersReducedMotion, scene });
      // PART 7: connect water quality verification to the same scene and scroll system.
      initQualityLab({ prefersReducedMotion, scene });
      // PART 8: connect clean handling to the same scene and scroll system.
      initHandlingLab({ scene });
      // PART 9: connect storage and materials to the same scene and scroll system.
      initStorageMaterials({ scene });
      // PART 10: connect comparison to the same scene and scroll system.
      initComparison({ scene });
      // PART 11: connect everyday habits to the same scene and scroll system.
      initHabits({ scene });
      // PART 12: connect the final cinematic drop to the same scene and scroll system.
      initFinale({ prefersReducedMotion, scene });
    })
    .catch((err) => {
      document.body.classList.add('no-webgl');
      console.warn('Facility scene unavailable, continuing without it.', err);
    });
}

runLoader().then(() => {
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-ready');
  if (window.ScrollTrigger) window.ScrollTrigger.refresh();
});

boot();
