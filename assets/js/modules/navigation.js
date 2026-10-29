/* ============================================================
   navigation.js — floating chapter menu
   ============================================================ */

export function initNavigation() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const label = document.querySelector('[data-nav-label]');
  const list = document.querySelector('[data-nav-list]');
  const aboutTrigger = document.querySelector('[data-nav-about]');
  const aboutPanelTrigger = document.querySelector('.dws-about-trigger');
  const closeTargets = document.querySelectorAll('[data-nav-close]');
  if (!toggle || !list) return;

  const topicByHash = {
    '#hero': 'source',
    '#purification': 'purification',
    '#laboratory': 'laboratory',
    '#quality': 'quality',
    '#storage': 'storage',
    '#handling': 'handling',
    '#footer': 'materials'
  };

  const setActiveLink = (activeLink) => {
    list.querySelectorAll('a').forEach((link) => {
      link.classList.toggle('is-current', link === activeLink);
    });
  };

  const setOpen = (open) => {
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Close' : 'Chapters';
    list.setAttribute('aria-hidden', String(!open));
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  list.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;

    const topicKey = topicByHash[link.getAttribute('href')];
    if (!topicKey) {
      setOpen(false);
      return;
    }

    event.preventDefault();
    setActiveLink(link);
    setOpen(false);
    document.body.dispatchEvent(new CustomEvent('dws:navigation-topic', {
      detail: { key: topicKey }
    }));
  });

  aboutTrigger?.addEventListener('click', () => {
    setOpen(false);
    aboutPanelTrigger?.click();
  });

  closeTargets.forEach((target) => target.addEventListener('click', () => setOpen(false)));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.nav')) setOpen(false);
  });

  setOpen(false);
}
