/* ============================================================
  controls.js — sound + theme toggles
  The sound button owns preference and user intent; audio.js owns
  the optional playback engine and listens to its event.
   ============================================================ */

const THEME_KEY = 'dws-theme';
const SOUND_KEY = 'dws-sound';

export function initControls() {
  initTheme();
  initSound();
}

function initTheme() {
  const button = document.querySelector('[data-theme-toggle]');
  const label = document.querySelector('[data-theme-label]');
  const root = document.documentElement;

  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (_) { /* storage may be blocked */ }

  const apply = (theme) => {
    root.dataset.theme = theme;
    const isLab = theme === 'lab';
    if (button) button.setAttribute('aria-pressed', String(isLab));
    if (label) label.textContent = isLab ? 'Lab light' : 'Deep';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isLab ? '#EEF5F9' : '#02080F');
  };

  // Light is the site default. Only an explicit, previously-saved choice
  // for dark ("deep") should override it — anything else (nothing saved,
  // or a saved 'lab') opens bright.
  apply(saved === 'deep' ? 'deep' : 'lab');

  button?.addEventListener('click', () => {
    const next = root.dataset.theme === 'lab' ? 'deep' : 'lab';
    apply(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (_) { /* ignore */ }
  });
}

function initSound() {
  const button = document.querySelector('[data-sound-toggle]');
  const label = document.querySelector('[data-sound-label]');
  if (!button) return;

  let saved = true;
  try {
    const stored = localStorage.getItem(SOUND_KEY);
    if (stored === 'on' || stored === 'off') saved = stored === 'on';
  } catch (_) { /* storage may be blocked */ }

  let on = saved;
  const apply = (next) => {
    on = next;
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', on ? 'SOUND ON' : 'SOUND OFF');
    button.classList.toggle('is-sound-on', on);
    if (label) label.textContent = on ? 'SOUND ON' : 'SOUND OFF';
  };

  apply(on);

  button.addEventListener('click', () => {
    apply(!on);
    button.classList.remove('is-sound-pulse');
    requestAnimationFrame(() => button.classList.add('is-sound-pulse'));
    window.setTimeout(() => button.classList.remove('is-sound-pulse'), 700);
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch (_) { /* ignore */ }
    document.body.dispatchEvent(new CustomEvent('dws:sound', { detail: { on } }));
  });
}
