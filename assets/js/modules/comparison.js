/* ============================================================
   comparison.js — Part 10: container comparison
   Reuses Part 4's existing chapter progress event.
   ============================================================ */

const MATERIALS = {
  glass: {
    name: 'Glass',
    rows: {
      'Reusability': 'Often reusable', 'Durability': 'Breakable; avoid impact', 'Weight': 'Heavy', 'Transparency': 'Transparent',
      'Typical Usage': 'Home, hospitality, controlled storage', 'Storage Suitability': 'Suitable when protected from impact', 'Cleaning Convenience': 'Easy to inspect and clean',
      'Heat/Sunlight Considerations': 'Avoid thermal shock; sunlight is visible through the container', 'Handling Requirements': 'Careful handling and stable placement'
    }
  },
  steel: {
    name: 'Stainless Steel',
    rows: {
      'Reusability': 'Durable and reusable', 'Durability': 'High in many practical uses', 'Weight': 'Medium; often lighter than glass', 'Transparency': 'Opaque',
      'Typical Usage': 'Portable and repeated-use containers', 'Storage Suitability': 'Suitable with appropriate care', 'Cleaning Convenience': 'Requires proper cleaning and drying',
      'Heat/Sunlight Considerations': 'Opaque; temperature still depends on storage conditions', 'Handling Requirements': 'Inspect closures and clean contact surfaces'
    }
  },
  hdpe: {
    name: 'Food-Grade HDPE',
    rows: {
      'Reusability': 'Depends on design and guidance', 'Durability': 'Lightweight and impact-resistant', 'Weight': 'Light', 'Transparency': 'Usually opaque or semi-opaque',
      'Typical Usage': 'Larger containers and utility storage', 'Storage Suitability': 'Suitable when approved for intended contact use', 'Cleaning Convenience': 'Requires access for cleaning and inspection',
      'Heat/Sunlight Considerations': 'Avoid conditions beyond design guidance', 'Handling Requirements': 'Confirm food/water-contact approval'
    }
  },
  pet: {
    name: 'Food-Grade PET',
    rows: {
      'Reusability': 'Follow intended-use and reuse guidance', 'Durability': 'Lightweight; less resistant to repeated wear than some reusable designs', 'Weight': 'Very light', 'Transparency': 'Transparent',
      'Typical Usage': 'Packaged-water applications', 'Storage Suitability': 'Suitable within intended packaging conditions', 'Cleaning Convenience': 'Reuse and cleaning depend on the specific design and guidance',
      'Heat/Sunlight Considerations': 'Avoid excessive heat and direct sunlight', 'Handling Requirements': 'Protect from crushing, heat, and prolonged exposure'
    }
  },
  pp: {
    name: 'Food-Grade PP',
    rows: {
      'Reusability': 'Often used in reusable designs', 'Durability': 'Lightweight and durable', 'Weight': 'Light', 'Transparency': 'Opaque or translucent depending on design',
      'Typical Usage': 'Reusable and food-contact containers', 'Storage Suitability': 'Depends on design, closure, and intended use', 'Cleaning Convenience': 'Requires regular cleaning for reusable use',
      'Heat/Sunlight Considerations': 'Performance depends on design, thickness, and conditions', 'Handling Requirements': 'Use within intended temperature and contact guidance'
    }
  },
  copper: {
    name: 'Copper',
    rows: {
      'Reusability': 'Reusable with appropriate care', 'Durability': 'Durable but can change with chemistry and wear', 'Weight': 'Medium to heavy', 'Transparency': 'Opaque',
      'Typical Usage': 'Some traditional storage practices and specialized uses', 'Storage Suitability': 'Not suitable for every water type or condition', 'Cleaning Convenience': 'Requires appropriate cleaning and care',
      'Heat/Sunlight Considerations': 'Consider water chemistry, contact time, and storage conditions', 'Handling Requirements': 'Avoid unsupported health claims; inspect surface and lining'
    }
  }
};

export function initComparison({ scene = null } = {}) {
  const section = document.getElementById('comparison');
  const buttons = Array.from(document.querySelectorAll('[data-comparison-material]'));
  const galleryContainers = Array.from(document.querySelectorAll('.comparison-lab__container'));
  const attributes = document.querySelector('[data-comparison-attributes]');
  const readout = document.querySelector('[data-comparison-readout]');
  if (!section || !buttons.length || !attributes) return;

  let active = -1;
  const setActive = (index) => {
    const next = Math.max(0, Math.min(index, buttons.length - 1));
    if (next === active) return;
    active = next;
    const key = buttons[active].dataset.comparisonMaterial;
    const material = MATERIALS[key];
    buttons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === active;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-current', String(isActive));
    });
    galleryContainers.forEach((container) => container.classList.toggle('is-active', container.classList.contains(`comparison-lab__container--${key}`)));
    attributes.innerHTML = Object.entries(material.rows).map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
    if (readout) readout.textContent = `${String(active + 1).padStart(2, '0')} / ${material.name.toUpperCase()}`;
    scene?.setComparisonStage?.(active);
  };

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => setActive(index));
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      setActive(next);
      buttons[next].focus();
    });
  });
  setActive(0);
  window.addEventListener('dws:journey-progress', (event) => {
    if (event.detail?.id === 'comparison') setActive(Math.min(buttons.length - 1, Math.floor(event.detail.progress * buttons.length)));
  });
}