/* ============================================================
   handling-lab.js — Part 8: clean handling and packaging workflow
   Reuses Part 4's existing chapter progress event.
   ============================================================ */

export function initHandlingLab({ scene = null } = {}) {
  const section = document.getElementById('handling');
  const stages = Array.from(document.querySelectorAll('[data-handling-stage]'));
  const progress = document.querySelector('[data-handling-progress]');
  const readout = document.querySelector('[data-handling-readout]');

  if (!section || !stages.length) return;

  const labels = ['VERIFICATION', 'EQUIPMENT', 'CONTAINERS', 'FILLING', 'CLOSURE', 'STORAGE', 'DISTRIBUTION'];
  let active = -1;

  const setActive = (index) => {
    const next = Math.max(0, Math.min(index, stages.length - 1));
    if (next === active) return;
    active = next;

    stages.forEach((stage, stageIndex) => {
      const isActive = stageIndex === active;
      stage.classList.toggle('is-active', isActive);
      stage.querySelector('button')?.setAttribute('aria-current', isActive ? 'step' : 'false');
    });
    if (progress) progress.style.transform = `scaleY(${(active + 1) / stages.length})`;
    if (readout) readout.textContent = `${String(active + 1).padStart(2, '0')} / ${labels[active]}`;
    scene?.setHandlingStage?.(active);
  };

  stages.forEach((stage, index) => stage.querySelector('button')?.addEventListener('click', () => setActive(index)));
  setActive(0);

  // The existing journey tracker owns this chapter's ScrollTrigger.
  window.addEventListener('dws:journey-progress', (event) => {
    if (event.detail?.id === 'handling') {
      setActive(Math.min(stages.length - 1, Math.floor(event.detail.progress * stages.length)));
    }
  });
}