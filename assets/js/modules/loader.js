/* ============================================================
   loader.js — fills the glass while fonts and the page shell settle
   Resolves as soon as the document is parsed and fonts are usable (fonts
   are capped, never awaited indefinitely). It deliberately does NOT wait
   for window "load", the 3D scene, GLB models or audio: those stream in
   after the page is already visible (see main.js and three-scene.js).
   ============================================================ */

const MIN_DURATION = 450;   // ms — long enough for the fill to read as intentional
const FONT_CAP = 700;       // ms — never hold the page for web fonts longer than this
const HARD_CAP = 2000;      // ms — the loader can never outlive this

export function runLoader() {
  const countEl = document.querySelector('[data-loader-count]');
  const fillEl = document.querySelector('[data-loader-fill]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const minDuration = reduced ? 0 : MIN_DURATION;

  const started = performance.now();

  const domReady = new Promise((resolve) => {
    if (document.readyState !== 'loading') resolve();
    else document.addEventListener('DOMContentLoaded', resolve, { once: true });
  });

  const fontsReady = document.fonts
    ? Promise.race([
        document.fonts.ready.catch(() => {}),
        new Promise((resolve) => window.setTimeout(resolve, FONT_CAP))
      ])
    : Promise.resolve();

  return new Promise((resolve) => {
    let shown = 0;
    let assetsDone = false;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (countEl) countEl.textContent = '100';
      if (fillEl) fillEl.style.height = '100%';
      resolve();
    };

    Promise.all([domReady, fontsReady]).then(() => { assetsDone = true; });
    window.setTimeout(finish, HARD_CAP);

    const tick = () => {
      if (finished) return;
      const elapsed = performance.now() - started;
      const timeShare = minDuration ? Math.min(elapsed / minDuration, 1) : 1;
      const target = assetsDone ? timeShare * 100 : Math.min(timeShare * 100, 88);

      shown += (target - shown) * 0.3;
      const value = Math.min(Math.round(shown), 100);

      if (countEl) countEl.textContent = String(value);
      if (fillEl) fillEl.style.height = `${value}%`;

      if (assetsDone && timeShare >= 1 && value >= 99) {
        finish();
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}
