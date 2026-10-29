/* ============================================================
   habits.js — Part 11: everyday habits and responsible use
   Reuses Part 4's existing chapter progress event.
   ============================================================ */

export function initHabits({ scene = null } = {}) {
  const section = document.getElementById('habits');
  const habits = Array.from(document.querySelectorAll('[data-habit-stage]'));
  const progress = document.querySelector('[data-habits-progress]');
  const readout = document.querySelector('[data-habits-readout]');
  if (!section || !habits.length) return;

  const labels = ['CLEAN', 'MATERIAL', 'CLOSED', 'HEAT', 'SUNLIGHT', 'DAMAGE', 'REUSE', 'STORE'];
  let active = -1;
  const setActive = (index) => {
    const next = Math.max(0, Math.min(index, habits.length - 1));
    if (next === active) return;
    active = next;
    habits.forEach((habit, habitIndex) => {
      const isActive = habitIndex === active;
      habit.classList.toggle('is-active', isActive);
      habit.querySelector('button')?.setAttribute('aria-current', isActive ? 'step' : 'false');
    });
    if (progress) progress.style.transform = `scaleY(${(active + 1) / habits.length})`;
    if (readout) readout.textContent = `${String(active + 1).padStart(2, '0')} / ${labels[active]}`;
    scene?.setHabitsStage?.(active);
  };
  habits.forEach((habit, index) => habit.querySelector('button')?.addEventListener('click', () => setActive(index)));
  setActive(0);
  window.addEventListener('dws:journey-progress', (event) => {
    if (event.detail?.id === 'habits') setActive(Math.min(habits.length - 1, Math.floor(event.detail.progress * habits.length)));
  });
}