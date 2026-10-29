/* ============================================================
   progress.js — rising water level + depth gauge
   The progress line reads as a water level rather than a bar:
   it fills downward on the left edge as the journey descends.
   ============================================================ */

export function initProgress() {
  const level = document.querySelector('[data-progress-level]');
  const ticksWrap = document.querySelector('[data-gauge-ticks]');
  const indexEl = document.querySelector('[data-gauge-index]');
  const nameEl = document.querySelector('[data-gauge-name]');
  const chapters = Array.from(document.querySelectorAll('.chapter'));
  const navLinks = Array.from(document.querySelectorAll('[data-nav-list] a'));

  if (!chapters.length) return;

  // Build the gauge ticks from the chapters actually present
  const ticks = chapters.map((section) => {
    const li = document.createElement('li');
    li.dataset.for = section.id;
    ticksWrap?.appendChild(li);
    return li;
  });

  const total = String(chapters.length).padStart(2, '0');
  const totalEl = document.querySelector('.gauge__stage i');
  if (totalEl) totalEl.textContent = `/ ${total}`;

  /* ---- water level ---- */
  const updateLevel = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    if (level) level.style.height = `${(ratio * 100).toFixed(2)}%`;
    document.body.classList.toggle('is-scrolled', window.scrollY > 40);
  };

  let frame = null;
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { updateLevel(); frame = null; });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateLevel);
  updateLevel();

  /* ---- active chapter ---- */
  const setActive = (section) => {
    const activeIndex = chapters.indexOf(section);
    if (activeIndex < 0) return;

    if (indexEl) indexEl.textContent = section.dataset.chapter || String(activeIndex + 1).padStart(2, '0');
    if (nameEl) nameEl.textContent = section.dataset.chapterName || '';

    ticks.forEach((tick, i) => {
      tick.classList.toggle('is-current', i === activeIndex);
      tick.classList.toggle('is-past', i < activeIndex);
    });

    navLinks.forEach((link) => {
      link.classList.toggle('is-current', link.getAttribute('href') === `#${section.id}`);
    });
  };

  const observer = new IntersectionObserver((entries) => {
    entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      .slice(0, 1)
      .forEach((entry) => setActive(entry.target));
  }, { threshold: [0.25, 0.5, 0.75], rootMargin: '-20% 0px -20% 0px' });

  chapters.forEach((section) => observer.observe(section));
  setActive(chapters[0]);
}
