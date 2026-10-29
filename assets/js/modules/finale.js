/* ============================================================
   finale.js — Part 12: final cinematic water droplet journey
   Reuses the existing journey tracker rather than creating a new
   ScrollTrigger or animation loop.
   ============================================================ */

export function initFinale({ prefersReducedMotion = false, scene = null } = {}) {
  const section = document.getElementById('drop');
  const steps = Array.from(document.querySelectorAll('[data-finale-step]'));
  const restart = document.querySelector('[data-finale-restart]');
  if (!section) return;

  const setProgress = (progress) => {
    const value = Math.max(0, Math.min(progress, 1));
    const activeStep = Math.min(steps.length - 1, Math.floor(value * steps.length));
    steps.forEach((step, index) => {
      const active = index === activeStep;
      step.classList.toggle('is-active', active);
      step.setAttribute('aria-current', active ? 'step' : 'false');
    });
    scene?.setFinaleStage?.(value);
  };

  setProgress(prefersReducedMotion ? 1 : 0);
  window.addEventListener('dws:journey-progress', (event) => {
    if (event.detail?.id === 'drop') setProgress(event.detail.progress);
  });

  restart?.addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('hero')?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  });
}
