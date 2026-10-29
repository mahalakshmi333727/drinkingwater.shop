/* ============================================================
   purification.js — Part 5: purification process storytelling
   One chapter-level ScrollTrigger drives the seven readable states.
   ============================================================ */

export function initPurification({ prefersReducedMotion = false, scene = null } = {}) {
  const section = document.getElementById('purification');
  const cards = Array.from(document.querySelectorAll('[data-purification-stage]'));
  const progress = document.querySelector('[data-purification-progress]');
  if (!section || !cards.length) return;

  let active = -1;
  const setActive = (index) => {
    const next = Math.max(0, Math.min(index, cards.length - 1));
    if (next === active) return;
    active = next;
    cards.forEach((card, cardIndex) => {
      const isActive = cardIndex === active;
      card.classList.toggle('is-active', isActive);
      card.querySelector('button')?.setAttribute('aria-current', isActive ? 'step' : 'false');
    });
    if (progress) progress.style.transform = `scaleY(${(active + 1) / cards.length})`;
    scene?.setPurificationStage?.(active);
  };

  cards.forEach((card, index) => card.querySelector('button')?.addEventListener('click', () => setActive(index)));
  setActive(0);
  window.addEventListener('dws:journey-progress', (event) => {
    if (event.detail?.id === 'purification') {
      setActive(Math.min(cards.length - 1, Math.floor(event.detail.progress * cards.length)));
    }
  });
}