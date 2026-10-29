/* ============================================================
   hero.js — cinematic entrance + parallax for the Hero only
   Runs once, after the loader hands off (body.is-ready). Falls
   back to the plain CSS rise already defined in sections.css
   ([data-load]) whenever GSAP is unavailable or the visitor
   prefers reduced motion — the hero renders correctly either way.
   Nothing here touches any other chapter, module, or the
   persistent Three.js scene.
   ============================================================ */

export function initHero({ prefersReducedMotion } = {}) {
  const hero = document.querySelector('.chapter--hero');
  if (!hero) return;

  initParallax(hero, prefersReducedMotion);
  initEntrance(hero, prefersReducedMotion);
}

/* ---- subtle pointer parallax on the hero's own text/atmosphere layers ----
   Independent of the persistent Three.js scene's own pointer drift (that
   moves the whole tank on its own scale in three-scene.js); this only
   nudges the hero's light rays and copy panel a few pixels for depth. */
function initParallax(hero, prefersReducedMotion) {
  if (prefersReducedMotion) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const layers = Array.from(hero.querySelectorAll('[data-parallax]'));
  if (!layers.length) return;

  const state = { x: 0, y: 0 };
  let raf = null;

  const apply = () => {
    raf = null;
    layers.forEach((layer) => {
      const depth = parseFloat(layer.dataset.parallax) || 0;
      layer.style.transform = `translate3d(${(state.x * depth).toFixed(2)}px, ${(state.y * depth * 0.6).toFixed(2)}px, 0)`;
    });
  };

  const onMove = (event) => {
    const rect = hero.getBoundingClientRect();
    state.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    state.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    if (!raf) raf = requestAnimationFrame(apply);
  };

  const reset = () => {
    layers.forEach((layer) => { layer.style.transform = ''; });
  };

  hero.addEventListener('pointermove', onMove, { passive: true });
  hero.addEventListener('pointerleave', reset, { passive: true });
}

/* ---- GSAP entrance: the headline gets a masked line-by-line reveal;
   everything else keeps the site's existing [data-load] rise so the
   whole hero still reads as one orchestrated sequence. ---- */
function initEntrance(hero, prefersReducedMotion) {
  const gsap = window.gsap;
  const title = hero.querySelector('[data-hero-headline]');
  const lines = title ? title.querySelectorAll('.line') : [];

  if (!gsap || !lines.length || prefersReducedMotion) return;

  const play = () => {
    // Hands the headline off from the CSS fallback (sections.css) to GSAP.
    document.body.classList.add('hero-gsap-ready');
    gsap.fromTo(lines,
      { yPercent: 115, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: 1.15,
        ease: 'power4.out',
        stagger: 0.12,
        delay: 0.15
      }
    );
  };

  if (document.body.classList.contains('is-ready')) {
    play();
    return;
  }

  const observer = new MutationObserver(() => {
    if (document.body.classList.contains('is-ready')) {
      observer.disconnect();
      play();
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
