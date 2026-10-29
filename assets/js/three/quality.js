/* ============================================================
   quality.js — device tiering
   Decides the budget once, at boot. Everything downstream reads
   from the returned object rather than sniffing the device again.
   ============================================================ */

export function detectQuality() {
  const ua = navigator.userAgent || '';
  const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 760;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const saveData = navigator.connection?.saveData === true;

  const isMobile = coarse || narrow || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isWeak = cores <= 4 || memory <= 4 || saveData;

  let tier = 'high';
  if (isMobile && isWeak) tier = 'low';
  else if (isMobile || isWeak) tier = 'mid';

  // A software renderer will report SwiftShader / llvmpipe — always fall back.
  if (/SwiftShader|llvmpipe|Software/i.test(rendererString())) tier = 'low';

  return BUDGETS[tier];
}

const BUDGETS = {
  high: {
    tier: 'high',
    pixelRatioCap: 2,
    waterSegments: 128,
    waterDetail: 1,
    motes: 1400,
    bubbles: 420,
    chambers: 3,
    pipeSegments: 96,
    pipeRadialSegments: 12,
    volumetrics: 3,
    transmission: true,
    antialias: true,
    envMap: true,
    targetFps: 60
  },
  mid: {
    tier: 'mid',
    pixelRatioCap: 1.6,
    waterSegments: 80,
    waterDetail: 1,
    motes: 700,
    bubbles: 220,
    chambers: 3,
    pipeSegments: 64,
    pipeRadialSegments: 8,
    volumetrics: 2,
    transmission: false,
    antialias: true,
    envMap: true,
    targetFps: 60
  },
  low: {
    tier: 'low',
    pixelRatioCap: 1.25,
    waterSegments: 44,
    waterDetail: 0,
    motes: 300,
    bubbles: 90,
    chambers: 2,
    pipeSegments: 40,
    pipeRadialSegments: 6,
    volumetrics: 1,
    transmission: false,
    antialias: false,
    envMap: false,
    targetFps: 30
  }
};

function rendererString() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch (_) {
    return '';
  }
}

/* Watches real frame cost and steps the budget down if the device
   can't hold its target. Called from the render loop. */
export function createPerformanceGuard(quality, onDowngrade) {
  let samples = 0;
  let accumulated = 0;
  let downgraded = false;
  const budgetMs = 1000 / quality.targetFps * 1.7;

  return function sample(delta) {
    if (downgraded || quality.tier === 'low') return;
    accumulated += delta * 1000;
    samples += 1;
    if (samples < 90) return;

    const average = accumulated / samples;
    samples = 0;
    accumulated = 0;

    if (average > budgetMs) {
      downgraded = true;
      onDowngrade(average);
    }
  };
}
