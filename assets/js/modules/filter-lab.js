/* ============================================================
   filter-lab.js — Part 6: interactive filter laboratory
   One chapter-level ScrollTrigger drives six stage states.
   ============================================================ */

export function initFilterLab({ prefersReducedMotion = false, scene = null } = {}) {
  const section = document.getElementById('laboratory');
  const stages = Array.from(document.querySelectorAll('[data-filter-stage]'));
  const progress = document.querySelector('[data-filter-lab-progress]');
  const readout = document.querySelector('[data-filter-lab-readout]');

  if (!section || !stages.length) return;

  const labels = ['INTAKE', 'CARBON', 'FINE FILTER', 'MEMBRANE', 'UV', 'OZONE'];
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
    scene?.setLaboratoryStage?.(active);
  };

  stages.forEach((stage, index) => stage.querySelector('button')?.addEventListener('click', () => setActive(index)));
  setActive(0);

  // Part 4's existing journey trigger owns this section; it forwards progress
  // here so the lab never creates a second trigger for the same chapter.
  const onJourneyProgress = (event) => {
    if (event.detail?.id !== 'laboratory') return;
    setActive(Math.min(stages.length - 1, Math.floor(event.detail.progress * stages.length)));
  };
  window.addEventListener('dws:journey-progress', onJourneyProgress);
}