/* landscape-entry.js — promotes the existing facility canvas from preview to full screen */

import { playClickSound } from './interaction-sound.js';

/* Landscape-only supporting copy. Keyed by data-landscape-location. Headings stay
   sourced from the existing chapter titles; the main-page chapters are not touched. */
const LANDSCAPE_COPY = {
  source: {
    intro: 'Every reliable drinking water solution begins with understanding the source. Water from borewells, municipal supplies, or other approved sources can contain suspended soil, sand, rust, dissolved minerals, and other impurities. The first step is to assess the incoming water and identify the treatment it requires.',
    process: 'For hospitals, hotels, factories, and corporate facilities, understanding the source water is essential for planning a purification system that meets the site\u2019s daily demand and intended water quality.',
    why: 'Process steps 1\u20132: identify the source, test the incoming water, and assess particles, dissolved substances, hardness, and microbiological risk.'
  },
  purification: {
    intro: 'Purification is a series of carefully selected treatment stages, not a single filter. Depending on the water test results, pretreatment may include sediment filtration to reduce sand, soil, and suspended particles. Activated carbon can help reduce chlorine, odours, and certain organic compounds. Water softening or other pretreatment may be required for specific water conditions.',
    process: 'Reverse osmosis can reduce many dissolved substances, while suitable filtration and disinfection technologies address other treatment requirements. Each stage has a specific purpose, and the complete system must be designed for the incoming water quality and required output.',
    keepList: true,
    why: 'Process steps 3\u20135: select pretreatment and filtration, apply technologies such as reverse osmosis when required, then use suitable disinfection and verify treated water quality. Stages vary by source water and intended application; this is not an identical sequence for every installation.'
  },
  storage: {
    intro: 'Purification does not end when water leaves the treatment equipment. Properly designed storage tanks, suitable food-contact materials, hygienic tank conditions, and protected distribution lines help maintain treated water quality.',
    process: 'Hotels, hospitals, factories, and large office buildings need storage and distribution systems planned around daily consumption, peak demand, cleaning schedules, and operational requirements. Regular inspection and maintenance help reduce the risk of contamination after treatment.',
    why: 'Process steps 6\u20138: move treated water to hygienically maintained storage, distribute it through a properly designed system, and keep inspecting and maintaining it.'
  },
  laboratory: {
    intro: 'Different treatment technologies target different impurities. Sediment filters can capture suspended particles such as soil and sand. Activated carbon can reduce selected chemicals, chlorine, and unwanted odours. Reverse osmosis membranes can reduce many dissolved salts and other substances, depending on membrane performance and operating conditions.',
    process: 'Some systems also require dedicated treatment for hardness, iron, or other source-specific contaminants. Appropriate disinfection helps control harmful microorganisms. The treatment process must be selected according to water testing; no single filter should be presented as removing every impurity.',
    why: 'Restaurants, commercial kitchens, and factories often need different combinations of these stages, chosen from their own water test results.'
  },
  quality: {
    intro: 'Water that looks clear is not necessarily safe to drink. Some dissolved contaminants and harmful microorganisms cannot be identified by appearance alone. Appropriate water testing, suitable treatment, effective disinfection where required, and periodic quality checks are essential.',
    process: 'For commercial facilities, the objective is not simply to make water look clear. It is to design and operate a treatment system that consistently meets the applicable water quality requirements for its intended use.',
    why: 'Schools, colleges, hospitals, and apartment communities rely on periodic quality checks, not appearance, to confirm treated water is suitable for use.'
  },
  materials: {
    intro: 'The right water solution depends on where the water will be used and how much is needed. A hospital, a hotel, a manufacturing plant, and a corporate campus can have different water quality requirements, consumption patterns, and operating schedules.',
    process: 'Commercial purification systems should therefore be selected according to source water, daily demand, peak consumption, intended use, available space, and maintenance requirements. Properly planned storage, distribution, monitoring, and servicing help support reliable water availability across the facility.',
    why: 'Hospitals, hotels and resorts, IT parks, institutions, and large apartment communities each size treatment capacity and distribution differently.'
  }
};

export function initLandscapeEntry() {
  const entry = document.querySelector('[data-landscape-entry]');
  const openButton = entry?.querySelector('[data-landscape-open]');
  const closeButton = document.querySelector('[data-landscape-close]');
  const experience = document.querySelector('[data-landscape-experience]');
  const locations = Array.from(document.querySelectorAll('[data-landscape-location]'));
  const panel = document.querySelector('[data-landscape-panel]');
  const panelClose = panel?.querySelector('[data-landscape-panel-close]');
  const panelEyebrow = panel?.querySelector('[data-landscape-panel-eyebrow]');
  const panelTitle = panel?.querySelector('[data-landscape-panel-title]');
  const panelIntro = panel?.querySelector('[data-landscape-panel-intro]');
  const panelProcess = panel?.querySelector('[data-landscape-panel-process]');
  const panelWhy = panel?.querySelector('[data-landscape-panel-why]');
  if (!entry || !openButton || !closeButton || !experience) return;

  let lastFocused = null;
  let panelTimer = null;
  let directOpenTimer = null; // opens a panel without the 3D camera when the scene is not available

  const cleanClone = (node) => {
    const clone = node.cloneNode(true);
    [clone, ...clone.querySelectorAll('*')].forEach((element) => {
      Array.from(element.attributes).forEach((attribute) => {
        if (attribute.name === 'id' || attribute.name.toLowerCase().startsWith('data-')) element.removeAttribute(attribute.name);
      });
    });
    return clone;
  };

  const closePanel = () => {
    if (!panel || panel.hidden) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    locations.forEach((item) => item.classList.remove('is-active'));
    document.body.dispatchEvent(new CustomEvent('dws:landscape-overview'));
    window.clearTimeout(directOpenTimer);
    window.clearTimeout(panelTimer);
    panelTimer = window.setTimeout(() => { panel.hidden = true; }, 520);
  };

  const openPanel = (key) => {
    const location = locations.find((item) => item.dataset.landscapeLocation === key);
    const section = location && document.getElementById(location.dataset.landscapeSection);
    if (!panel || !section) return;
    const heading = section.querySelector('.chapter__title');
    const headingText = heading
      ? Array.from(heading.querySelectorAll('.line')).map((line) => line.textContent.trim()).join(' ').replace(/\s+/g, ' ').trim()
      : '';
    const header = section.querySelector('.chapter__head');
    const eyebrow = header?.querySelector('[class$="__eyebrow"]');
    const intro = header?.querySelector('.chapter__lede');
    const process = section.querySelector('[class*="__sequence"], [class*="__choices"], [class*="__aside"]');
    const reason = process?.querySelector('em')?.textContent.trim() || process?.querySelector('.note')?.textContent.trim() || '';

    panelEyebrow.textContent = eyebrow?.textContent.trim() || location.dataset.landscapeLocation;
    panelTitle.textContent = headingText;
    const copy = LANDSCAPE_COPY[location.dataset.landscapeLocation];
    if (copy) {
      panelIntro.textContent = copy.intro;
      const body = document.createElement('p');
      body.className = 'landscape-panel__body';
      body.textContent = copy.process;
      const nodes = [body];
      if (copy.keepList && process) nodes.push(cleanClone(process));
      panelProcess.replaceChildren(...nodes);
      panelWhy.textContent = copy.why;
    } else {
      panelIntro.textContent = intro?.textContent.trim() || '';
      panelProcess.replaceChildren(process ? cleanClone(process) : document.createTextNode(''));
      panelWhy.textContent = reason;
    }
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    window.clearTimeout(panelTimer);
    requestAnimationFrame(() => panel.classList.add('is-open'));
  };

  const setOpen = (open) => {
    if (open) {
      lastFocused = document.activeElement;
      document.body.classList.add('landscape-open');
      openButton.setAttribute('aria-expanded', 'true');
      experience.setAttribute('aria-hidden', 'false');
      closeButton.focus({ preventScroll: true });
      window.dispatchEvent(new Event('resize'));
      return;
    }

    window.clearTimeout(directOpenTimer);
    document.body.classList.remove('landscape-open');
    openButton.setAttribute('aria-expanded', 'false');
    experience.setAttribute('aria-hidden', 'true');
    document.body.dispatchEvent(new CustomEvent('dws:landscape-location', { detail: { key: null } }));
    closePanel();
    window.dispatchEvent(new Event('resize'));
    if (lastFocused instanceof HTMLElement) lastFocused.focus({ preventScroll: true });
  };

  openButton.setAttribute('aria-expanded', 'false');
  locations.forEach((location) => {
    const section = document.getElementById(location.dataset.landscapeSection);
    const heading = section?.querySelector('.chapter__title');
    const headingText = heading
      ? Array.from(heading.querySelectorAll('.line')).map((line) => line.textContent.trim()).join(' ').replace(/\s+/g, ' ').trim()
      : '';
    const headingEl = location.querySelector('strong');
    if (headingText && headingEl) headingEl.textContent = headingText;
    location.setAttribute('aria-label', headingText || 'Open purification location');
    location.addEventListener('click', () => {
      playClickSound();
      closePanel();
      locations.forEach((item) => item.classList.remove('is-active'));
      location.classList.add('is-active');
      document.body.dispatchEvent(new CustomEvent('dws:landscape-location', {
        detail: { key: location.dataset.landscapeLocation }
      }));
      /* Fallback: the panel is normally opened by the 3D camera's arrival event.
         While the terrain is still streaming in, or if WebGL / a model failed,
         that event may never come, so the hotspot opens its panel directly. */
      window.clearTimeout(directOpenTimer);
      if (!document.body.classList.contains('landscape-ready')) {
        const key = location.dataset.landscapeLocation;
        directOpenTimer = window.setTimeout(() => {
          if (location.classList.contains('is-active') && (!panel || !panel.classList.contains('is-open'))) openPanel(key);
        }, 450);
      }
    });
  });

  panelClose?.addEventListener('click', closePanel);
  document.body.addEventListener('dws:landscape-arrived', (event) => openPanel(event.detail?.key));
  openButton.addEventListener('click', () => {
    playClickSound();
    setOpen(true);
  });
  closeButton.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('landscape-open')) setOpen(false);
    if (event.key === 'Escape' && panel && !panel.hidden) closePanel();
  });
}