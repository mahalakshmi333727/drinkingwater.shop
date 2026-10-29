/* ============================================================
   storage-materials.js — Part 9: storage and container materials
   Reuses Part 4's existing chapter progress event.
   ============================================================ */

export function initStorageMaterials({ scene = null } = {}) {
  initStorage({ scene });
  initMaterials({ scene });
}

function initStorage({ scene }) {
  const section = document.getElementById('storage');
  const stages = Array.from(document.querySelectorAll('[data-storage-stage]'));
  const progress = document.querySelector('[data-storage-progress]');
  const readout = document.querySelector('[data-storage-readout]');
  if (!section || !stages.length) return;

  const labels = ['CLEAN ZONE', 'CLOSED', 'HEAT', 'SUNLIGHT', 'MATERIAL', 'CLEANING', 'ROTATION'];
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
    scene?.setStorageStage?.(active);
  };
  stages.forEach((stage, index) => stage.querySelector('button')?.addEventListener('click', () => setActive(index)));
  setActive(0);
  window.addEventListener('dws:journey-progress', (event) => {
    if (event.detail?.id === 'storage') setActive(Math.min(stages.length - 1, Math.floor(event.detail.progress * stages.length)));
  });
}

function initMaterials({ scene }) {
  const wrap = document.querySelector('[data-storage-materials]');
  const choices = Array.from(document.querySelectorAll('[data-material-choice]'));
  const readout = document.querySelector('[data-material-readout]');
  const detail = document.querySelector('[data-material-detail]');
  if (!wrap || !choices.length) return;

  const labels = {
    glass: 'GLASS / INSPECT', steel: 'STEEL / REUSABLE', hdpe: 'HDPE / UTILITY',
    pet: 'PET / LIGHTWEIGHT', pp: 'PP / PRACTICAL', copper: 'COPPER / SPECIALIZED'
  };
  let active = -1;
  const setActive = (index) => {
    const next = Math.max(0, Math.min(index, choices.length - 1));
    if (next === active) return;
    active = next;
    const key = choices[active].dataset.materialChoice;
    choices.forEach((choice, choiceIndex) => {
      const isActive = choiceIndex === active;
      choice.classList.toggle('is-active', isActive);
      choice.querySelector('button')?.setAttribute('aria-pressed', String(isActive));
    });
    if (readout) readout.textContent = `${labels[key]} / SAMPLE`;
    if (detail) detail.textContent = labels[key];
    scene?.setMaterialsStage?.(active);
  };
  choices.forEach((choice, index) => choice.querySelector('button')?.addEventListener('click', () => setActive(index)));
  setActive(0);
  window.addEventListener('dws:journey-progress', (event) => {
    if (event.detail?.id === 'materials') setActive(Math.min(choices.length - 1, Math.floor(event.detail.progress * choices.length)));
  });
}