/* ============================================================
   interaction-sound.js — subtle click/touch feedback
   A tiny, synthesised "soft droplet" blip (Web Audio API, no
   audio file needed) for the front-page icon and landscape
   click/touch interactions. Independent of the ambient waterfall
   bed in audio.js: this only ever plays one short envelope per
   click, never loops, and never starts on its own — every call
   to playClickSound() happens from inside a real click/touch
   handler, so it always runs on a genuine user gesture and never
   fights the browser's autoplay restrictions.
   ============================================================ */

let ctx = null;
let master = null;

function ensureContext() {
  if (ctx) return ctx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  ctx = new AudioContextClass();
  master = ctx.createGain();
  master.gain.value = 0.16; // deliberately quiet — a hint, not a chime
  master.connect(ctx.destination);
  return ctx;
}

/** Plays one short, soft, non-looping click blip. Safe to call from any
 *  click/touch handler; does nothing if Web Audio isn't available. */
export function playClickSound() {
  const context = ensureContext();
  if (!context) return;
  if (context.state === 'suspended') context.resume().catch(() => {});

  const now = context.currentTime;
  const osc = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1900, now);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(740, now);
  osc.frequency.exponentialRampToValueAtTime(340, now + 0.09);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(1, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  osc.connect(filter).connect(gain).connect(master);
  osc.start(now);
  osc.stop(now + 0.18);
}
