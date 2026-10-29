/* ============================================================
   quality-lab.js — Part 7: water quality verification
   Reuses Part 4's existing chapter progress event.
   ============================================================ */

export function initQualityLab({ scene = null } = {}) {
  const section = document.getElementById('quality');
  const parameters = Array.from(document.querySelectorAll('[data-quality-stage]'));
  const progress = document.querySelector('[data-quality-progress]');
  const readout = document.querySelector('[data-quality-readout]');
  const ph = document.querySelector('[data-quality-ph]');
  const conductivity = document.querySelector('[data-quality-conductivity]');
  const clarity = document.querySelector('[data-quality-clarity]');

  if (!section || !parameters.length) return;

  const labels = ['CLARITY', 'SENSORY', 'MICROBIOLOGY', 'CHEMISTRY', 'MINERALS', 'PERFORMANCE', 'RELEASE'];
  const metricValues = [
    ['7.0', '01'], ['7.0', '02'], ['7.1', '03'], ['7.1', '04'], ['7.2', '05'], ['7.2', '06'], ['7.2', '07']
  ];
  let active = -1;

  const setActive = (index) => {
    const next = Math.max(0, Math.min(index, parameters.length - 1));
    if (next === active) return;
    active = next;

    parameters.forEach((parameter, parameterIndex) => {
      const isActive = parameterIndex === active;
      parameter.classList.toggle('is-active', isActive);
      parameter.querySelector('button')?.setAttribute('aria-current', isActive ? 'step' : 'false');
    });

    const [phValue, clarityValue] = metricValues[active];
    if (progress) progress.style.transform = `scaleY(${(active + 1) / parameters.length})`;
    if (readout) readout.textContent = `${String(active + 1).padStart(2, '0')} / ${labels[active]}`;
    if (ph) ph.textContent = phValue;
    if (conductivity) conductivity.textContent = active >= 3 ? 'LIVE' : '—';
    if (clarity) clarity.textContent = clarityValue;
    scene?.setQualityStage?.(active);
  };

  parameters.forEach((parameter, index) => parameter.querySelector('button')?.addEventListener('click', () => setActive(index)));
  setActive(0);

  // The existing journey tracker owns the quality ScrollTrigger, so this chapter
  // stays synchronized without creating a second trigger for the same section.
  window.addEventListener('dws:journey-progress', (event) => {
    if (event.detail?.id === 'quality') {
      setActive(Math.min(parameters.length - 1, Math.floor(event.detail.progress * parameters.length)));
    }
  });
}