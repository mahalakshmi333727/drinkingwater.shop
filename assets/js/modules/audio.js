/* ============================================================
   audio.js — Part 13: optional ambient sound system
  Uses a local, openly licensed waterfall recording as the dominant
  layer. Nothing starts until the visitor opts in.
   ============================================================ */

const CHAPTER_MIX = {
  hero: 2.40,
  source: 2.40,
  purification: 2.40,
  removed: 2.40,
  laboratory: 2.40,
  quality: 2.25,
  handling: 2.40,
  storage: 2.20,
  materials: 2.15,
  comparison: 2.10,
  habits: 2.40,
  drop: 2.30
};

export function initAudio({ prefersReducedMotion = false } = {}) {
  const button = document.querySelector('[data-sound-toggle]');
  if (!button) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  let context = null;
  let master = null;
  let limiter = null;
  let debugAnalyser = null;
  let waterGain = null;
  let waterfallMedia = null;
  let waterfallMediaNode = null;
  let fadeTimer = null;
  let sources = [];
  let started = false;
  let starting = false;
  let enabled = button.getAttribute('aria-pressed') === 'true';
  let chapter = 'hero';
  let mixedChapter = null;
  const isDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const debugAudio = (...args) => {
    if (isDevelopment) console.info('[audio-dev]', ...args.map((value) => typeof value === 'object' ? JSON.stringify(value) : value));
  };

  const schedule = (gain, value, duration = 1.2) => {
    if (!gain || !context) return;
    if (isDevelopment && gain === master) debugAudio('schedule-master', { value, duration, context: context.state, before: gain.gain.value });
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(value, now + Math.max(0.05, duration));
  };

  const start = async (withFeedback = false) => {
    if (started || starting || !enabled) return;
    starting = true;
    try {
      context = new AudioContextClass();
      master = context.createGain();
      waterGain = context.createGain();

      master.gain.value = 0.0001;
      waterGain.gain.value = 2.40;

      limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -22;
      limiter.knee.value = 18;
      limiter.ratio.value = 7;
      limiter.attack.value = 0.012;
      limiter.release.value = 0.24;
      if (isDevelopment) {
        debugAnalyser = context.createAnalyser();
        debugAnalyser.fftSize = 1024;
        limiter.connect(debugAnalyser).connect(context.destination);
      } else {
        limiter.connect(context.destination);
      }

      await context.resume();
      master.gain.setValueAtTime(0.75, context.currentTime);

      const waterfall = await loadWaterfall(context);
      if (!enabled || !context) {
        starting = false;
        return;
      }

      waterfallMedia = waterfall.media;
      if (waterfall.media) {
        waterfallMedia.volume = 0;
        await waterfallMedia.play();
        fadeMediaVolume(0.75, 700);
        debugAudio('playing', {
          url: waterfallMedia.currentSrc || waterfallMedia.src,
          readyState: waterfallMedia.readyState,
          paused: waterfallMedia.paused,
          muted: waterfallMedia.muted,
          volume: waterfallMedia.volume,
          currentTime: waterfallMedia.currentTime,
          duration: waterfallMedia.duration,
          audioContext: context.state,
          audioClock: context.currentTime,
          outputRoute: 'direct-html-audio',
          gain: waterfallMedia.volume,
          masterGain: master.gain.value
        });
        window.setTimeout(() => {
          if (!waterfallMedia) return;
          debugAudio('playback-check', {
            url: waterfallMedia.currentSrc || waterfallMedia.src,
            readyState: waterfallMedia.readyState,
            paused: waterfallMedia.paused,
            muted: waterfallMedia.muted,
            volume: waterfallMedia.volume,
            currentTime: waterfallMedia.currentTime,
            duration: waterfallMedia.duration,
            audioContext: context.state,
            audioClock: context.currentTime,
            outputRoute: 'direct-html-audio',
            gain: waterfallMedia?.volume,
            masterGain: master?.gain.value
          });
        }, 1500);
      } else {
        waterfallMediaNode = context.createBufferSource();
        waterfallMediaNode.buffer = waterfall.buffer;
        waterfallMediaNode.loop = true;
        waterfallMediaNode.connect(waterGain).connect(master);
        waterfallMediaNode.start();
      }
      sources = [waterfallMediaNode];
      started = true;
      starting = false;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.value = 0.75;
      setChapter(chapter);
    } catch (_) {
      starting = false;
      stop();
    }
  };

  const stop = () => {
    if (!context) return;
    debugAudio('stop', { context: context.state, masterGain: master?.gain.value, currentTime: waterfallMedia?.currentTime });
    fadeMediaVolume(0, 350);
    window.setTimeout(() => {
      sources.forEach((source) => {
        try { source.stop(); } catch (_) { /* already stopped */ }
      });
      if (waterfallMedia) {
        waterfallMedia.pause();
        waterfallMedia.currentTime = 0;
        waterfallMedia.remove();
      }
      context.close?.().catch(() => {});
      context = null;
      master = null;
      limiter = null;
      debugAnalyser = null;
      waterfallMedia = null;
      waterfallMediaNode = null;
      waterGain = null;
      sources = [];
      started = false;
    }, 500);
  };

  const fadeMediaVolume = (target, duration) => {
    if (!waterfallMedia) return;
    if (fadeTimer) window.clearInterval(fadeTimer);
    const startVolume = waterfallMedia.volume;
    const startedAt = performance.now();
    fadeTimer = window.setInterval(() => {
      if (!waterfallMedia) return;
      const progress = Math.min(1, (performance.now() - startedAt) / duration);
      waterfallMedia.volume = startVolume + (target - startVolume) * progress;
      if (progress >= 1) {
        window.clearInterval(fadeTimer);
        fadeTimer = null;
      }
    }, 16);






    
  };

  function setChapter(nextChapter) {
    chapter = CHAPTER_MIX[nextChapter] ? nextChapter : 'hero';
    if (!started) return;
    if (chapter === mixedChapter) return;
    mixedChapter = chapter;
    schedule(waterGain, CHAPTER_MIX[chapter], 1.5);
  }

  const onSound = (event) => {
    enabled = event.detail?.on === true;
    if (enabled) start(true);
    else stop();
  };

  document.body.addEventListener('dws:sound', onSound);
  window.addEventListener('dws:journey-progress', (event) => {
    if (event.detail?.id) setChapter(event.detail.id);
  });

  // A persisted opt-in never starts by itself; this first interaction only
  // resumes it after the browser has received a real user gesture.
  const resumeRemembered = () => {
    if (enabled && !started) start();
    if (started) context?.resume?.().catch(() => {});
  };
  window.addEventListener('pointerdown', resumeRemembered, { once: true, passive: true });
  window.addEventListener('keydown', resumeRemembered, { once: true });

  // Reduced-motion users still control sound explicitly, but no ambient bed
  // is started from a restored preference until they press the sound button.
  if (prefersReducedMotion && enabled) enabled = false;
}

async function loadWaterfall(context) {
  const mediaUrl = 'assets/media/waterfall-and-birds-sounds.wav';
  const waterfallMedia = document.createElement('audio');
  waterfallMedia.src = mediaUrl;
  waterfallMedia.dataset.audioWaterfall = 'true';
  waterfallMedia.setAttribute('aria-hidden', 'true');
  waterfallMedia.style.display = 'none';
  waterfallMedia.playsInline = true;
  document.body.appendChild(waterfallMedia);
  waterfallMedia.loop = true;
  waterfallMedia.preload = 'auto';
  waterfallMedia.muted = false;
  waterfallMedia.volume = 1;
  waterfallMedia.load();
  const debug = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (debug) console.info('[audio-dev] loading', waterfallMedia.src);
  if (waterfallMedia.canPlayType('audio/wav')) {
    if (debug) console.info('[audio-dev] loaded', { url: waterfallMedia.src, canPlay: waterfallMedia.canPlayType('audio/wav') });
    return { media: waterfallMedia, buffer: null };
  }
  const response = await fetch(mediaUrl);
  if (!response.ok) throw new Error(`Waterfall audio unavailable (${response.status})`);
  return { media: null, buffer: await context.decodeAudioData(await response.arrayBuffer()) };
}

