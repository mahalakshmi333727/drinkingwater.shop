/* ============================================================
   panels.js — interactive selectors
   Copy lives here for now; it moves to a data file once the
   chapters are written in full.
   ============================================================ */

const LAYERS = {
  mesh:     { title: 'Outer mesh',    body: 'The first surface water meets. Holds back anything large enough to see, and protects the layers behind it from clogging early.' },
  sediment: { title: 'Sediment wrap', body: 'Graded fibre that catches sand, silt and pipe rust. Density increases toward the centre, so larger particles stop first.' },
  carbon:   { title: 'Carbon block',  body: 'Compressed activated carbon with an enormous internal surface. Chlorine, taste and odour bind here rather than pass through.' },
  membrane: { title: 'Membrane',      body: 'The size gate. Pores are measured against bacteria and cysts, and in reverse osmosis against dissolved salts.' },
  core:     { title: 'Mineral core',  body: 'Calcium and magnesium returned in measured amounts, so water that has been stripped clean still tastes like water.' }
};

const MATERIALS = ['glass', 'steel', 'copper', 'tritan', 'pet'];

export function initPanels() {
  initLab();
  initMaterials();
}

function initLab() {
  const wrap = document.querySelector('[data-lab-layers]');
  const detail = document.querySelector('[data-lab-detail]');
  if (!wrap || !detail) return;

  const buttons = Array.from(wrap.querySelectorAll('button'));

  const select = (key) => {
    const data = LAYERS[key];
    if (!data) return;

    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.layer === key));
    });

    detail.innerHTML = `<h3>${data.title}</h3><p>${data.body}</p>`;
    // TODO: tell the cartridge scene which layer to isolate.
    document.body.dispatchEvent(new CustomEvent('dws:layer', { detail: { layer: key } }));
  };

  wrap.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-layer]');
    if (button) select(button.dataset.layer);
  });

  select('mesh');
}

function initMaterials() {
  const wrap = document.querySelector('[data-materials]');
  if (!wrap) return;

  const buttons = Array.from(wrap.querySelectorAll('button[data-material]'));

  const select = (key) => {
    if (!MATERIALS.includes(key)) return;
    buttons.forEach((button) => button.classList.toggle('is-active', button.dataset.material === key));
    document.body.dispatchEvent(new CustomEvent('dws:material', { detail: { material: key } }));
  };

  wrap.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-material]');
    if (button) select(button.dataset.material);
  });

  select('glass');
}
