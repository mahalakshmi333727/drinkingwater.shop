/* ============================================================
   journey.js — Part 4: scroll-based water journey storytelling
   ------------------------------------------------------------
   Maps the page's existing chapters onto camera waypoints inside
   the ALREADY-BUILT facility (chambers.js / pipes.js) — intake on
   the left, three chambers, outlet on the right. Chapters that
   have no literal geometry of their own (quality, storage,
   materials, comparison, habits) still get a distinct vantage
   point on that same facility, so the whole page reads as one
   continuous pass through it rather than a slideshow of scenes.

   This module only tracks *where the journey is* (active chapter
   index + progress through it). It does not touch the DOM, the
   Three.js scene, or the render loop — three-scene.js reads the
   returned state once per frame inside its own single requestAnimationFrame
   loop and does the actual (smoothed) camera movement there. That
   keeps this to one render loop and one ScrollTrigger registration,
   as required.
   ============================================================ */

/** Chapter order exactly as the sections appear in index.html. */
export const JOURNEY_ORDER = [
  'hero',
  'source',
  'purification',
  'removed',
  'laboratory',
  'quality',
  'handling',
  'storage',
  'materials',
  'comparison',
  'habits',
  'drop'
];

/**
 * Camera waypoints, one per chapter above, hand-placed against the
 * real coordinates in chambers.js (chambers at x -10.5 / 0 / 10,
 * z -5 / -9 / -4) and pipes.js (intake off-stage left, outlet at
 * roughly x 16, z 2). Waypoint 0 is intentionally identical to the
 * hero's original resting camera, so the hero is visually unchanged.
 */
export const WAYPOINTS = [
  { pos: [0.0, 1.4, 19.0], look: [0.0, -0.6, -5.0], exposure: 1.00, fog: 1.00 }, // hero
  { pos: [-17.0, 3.4, 12.0], look: [-15.0, 0.6, -2.0], exposure: 1.03, fog: 0.94 }, // source / intake
  { pos: [-10.5, 2.0, 8.5], look: [-10.5, 1.2, -5.0], exposure: 1.05, fog: 0.90 }, // purification / chamber 1
  { pos: [-4.5, 5.2, 13.0], look: [-5.0, 0.2, -6.0], exposure: 1.02, fog: 1.00 }, // what is removed — pulled back for scale
  { pos: [0.5, 1.7, 6.5], look: [0.0, 1.6, -9.0], exposure: 1.08, fog: 0.85 }, // filter laboratory — pushed in on chamber 2
  { pos: [3.5, 3.4, 8.0], look: [0.5, 0.6, -9.0], exposure: 1.10, fog: 0.85 }, // water quality — testing angle
  { pos: [7.5, 2.6, 8.8], look: [10.0, 0.9, -4.0], exposure: 1.03, fog: 0.95 }, // clean handling — swinging toward chamber 3
  { pos: [10.5, 3.1, 7.6], look: [10.0, 1.3, -4.0], exposure: 1.00, fog: 1.00 }, // storage / chamber 3
  { pos: [13.5, 2.1, 10.0], look: [12.0, 0.5, -1.5], exposure: 1.02, fog: 0.96 }, // container materials — toward the outlet run
  { pos: [6.0, 6.2, 17.0], look: [2.0, 0.0, -6.0], exposure: 0.98, fog: 1.08 }, // comparison — wide establishing pull-back
  { pos: [12.5, 3.7, 11.0], look: [15.0, 0.2, 2.0], exposure: 1.02, fog: 0.98 }, // everyday habits — nearing the outlet
  { pos: [15.6, 2.1, 10.0], look: [15.6, 0.8, 2.2], exposure: 1.06, fog: 0.88 } // the last drop — arrives at the droplet
];

/**
 * Builds a lightweight ScrollTrigger per chapter that only ever
 * writes plain numbers onto `state`. Returns null when GSAP /
 * ScrollTrigger aren't available so the caller can fall back to
 * its previous (unchanged) camera behaviour — no partial/duplicate
 * animation system is created.
 */
export function createJourneyTracker(sectionIds = JOURNEY_ORDER) {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) return null;

  // Registering a plugin twice is a documented no-op in GSAP — this does
  // not create a second instance of anything, it just guarantees the
  // plugin is present if this module happens to init before reveal.js.
  gsap.registerPlugin(ScrollTrigger);

  const state = { index: 0, progress: 0, continuous: 0 };
  const triggers = [];

  sectionIds.forEach((id, i) => {
    const section = document.getElementById(id);
    if (!section) return;

    triggers.push(ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom top',
      onUpdate: (self) => {
        state.index = i;
        state.progress = self.progress;
        state.continuous = i + self.progress;
        window.dispatchEvent(new CustomEvent('dws:journey-progress', {
          detail: { id, progress: self.progress }
        }));
      },
      onEnterBack: () => {
        state.index = i;
      }
    }));
  });

  return {
    state,
    destroy() {
      triggers.forEach((t) => t.kill());
    }
  };
}
