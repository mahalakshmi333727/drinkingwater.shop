/* ============================================================
   reveal.js — scroll-linked motion
   Deliberately restrained: headline lines lift on entry and the
   purification rules draw themselves. Everything else stays still,
   so motion means something when it happens.
   ============================================================ */

export function initReveal({ prefersReducedMotion } = {}) {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  if (!gsap || !ScrollTrigger) {
    console.warn('GSAP or ScrollTrigger missing — falling back to static layout.');
    document.body.classList.add('no-motion');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  if (prefersReducedMotion) {
    document.body.classList.add('no-motion');
    return;
  }

  /* ---- headline lines ---- */
  const headings = document.querySelectorAll('.chapter:not(.chapter--hero) .chapter__title, .finale__title');

  headings.forEach((heading) => {
    const lines = heading.querySelectorAll('.line');
    gsap.from(lines, {
      yPercent: 105,
      opacity: 0,
      duration: 1.05,
      ease: 'power3.out',
      stagger: 0.09,
      scrollTrigger: { trigger: heading, start: 'top 82%', once: true }
    });
    // mask so lines rise out of nothing
    lines.forEach((line) => { line.style.overflow = 'hidden'; });
    heading.style.overflow = 'hidden';
  });

  /* ---- ledes follow their headline, quietly ---- */
  gsap.utils.toArray('.chapter:not(.chapter--hero) .chapter__lede').forEach((lede) => {
    gsap.from(lede, {
      opacity: 0,
      y: 14,
      duration: 0.9,
      ease: 'power2.out',
      scrollTrigger: { trigger: lede, start: 'top 88%', once: true }
    });
  });

  /* ---- purification rules draw left to right ---- */
  gsap.utils.toArray('[data-rooms] li').forEach((room, i) => {
    ScrollTrigger.create({
      trigger: room,
      start: 'top 85%',
      once: true,
      onEnter: () => setTimeout(() => room.classList.add('is-open'), i * 110)
    });
  });

  /* ---- the last drop falls with the scroll ---- */
  const drop = document.querySelector('.finale__drop');
  const dropStage = document.querySelector('[data-scene="drop"]');
  if (drop && dropStage) {
    gsap.to(drop, {
      y: () => dropStage.clientHeight - 12,
      ease: 'none',
      scrollTrigger: {
        trigger: dropStage,
        start: 'top 70%',
        end: 'bottom bottom',
        scrub: 0.6
      }
    });
  }

  window.addEventListener('load', () => ScrollTrigger.refresh());
}
