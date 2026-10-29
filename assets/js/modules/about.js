/* about.js — the non-destructive About experience layered over the scene */

export function initAbout() {
  const root = document.querySelector('[data-about]');
  const trigger = document.querySelector('.dws-about-trigger');
  const panel = root?.querySelector('.dws-about-panel');
  const closeTargets = root?.querySelectorAll('[data-about-close]');
  if (!root || !trigger || !panel || !closeTargets) return;

  let lastFocused = null;

  const setOpen = (open) => {
    if (open) {
      lastFocused = document.activeElement;
      root.hidden = false;
      root.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('dws-about-open');
      requestAnimationFrame(() => {
        root.classList.add('is-open');
        panel.focus();
      });
      return;
    }

    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('dws-about-open');
    window.setTimeout(() => {
      if (!root.classList.contains('is-open')) root.hidden = true;
    }, 700);
    if (lastFocused instanceof HTMLElement) lastFocused.focus();
  };

  trigger.addEventListener('click', () => setOpen(true));
  closeTargets.forEach((target) => target.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !root.hidden) setOpen(false);
  });
}