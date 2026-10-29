/* ============================================================
   icon-scene.js — the 7 floating hotspots + immersive overlay
   Inspired by the interaction concept of Penderecki's Garden's
   "The Maestro's Manor" (floating hotspots over a scene, opening
   into an immersive content panel) — reusing this project's own
   existing seven lab chapters as the content, not new copy.

   Safety rule this module follows throughout: it only ever READS
   from the live chapter sections and works on cloned copies. Any
   clone that leaves this module has every id/data-* attribute
   stripped first, so it can never be picked up by the other
   chapter modules' document-wide selectors (e.g. filter-lab.js
   querying `[data-filter-lab-stage]`). The original chapters are
   never modified, moved, or removed.
   ============================================================ */

import { playClickSound } from './interaction-sound.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// How long the slow 3D "bubble launch" plays before the existing
// heading/off-canvas reveal runs — skipped for reduced-motion visitors
// so their tap stays instantly responsive.
const ICON_LAUNCH_DELAY = prefersReducedMotion ? 0 : 620;

/* Exactly 7 hotspots. Positions, keys, icons and 3D-stage mappings are
   untouched from the original build — only the visible label (hotspot
   tooltip / aria text) and the off-canvas panel copy behind each one
   have been updated, per the site's new content brief: Home, About,
   Services, Products, Technology, Solutions, Contact — mapped in order
   onto the 7 existing hotspots. */
const TOPICS = [
  { key: 'source',       sectionId: 'source',       label: 'Home',        icon: 'drop',   hx: '50%', hy: '10%', delay: '0s' },
  { key: 'purification', sectionId: 'purification', label: 'About',       icon: 'tank',   hx: '86%', hy: '28%', delay: '0.6s' },
  { key: 'laboratory',   sectionId: 'laboratory',   label: 'Services',    icon: 'filter', hx: '88%', hy: '62%', delay: '1.2s' },
  { key: 'quality',      sectionId: 'quality',      label: 'Products',    icon: 'flask',  hx: '50%', hy: '90%', delay: '1.8s' },
  { key: 'storage',      sectionId: 'storage',      label: 'Technology',  icon: 'shelf',  hx: '12%', hy: '62%', delay: '2.4s' },
  { key: 'handling',     sectionId: 'handling',     label: 'Solutions',   icon: 'seal',   hx: '14%', hy: '28%', delay: '3s' },
  { key: 'materials',    sectionId: 'materials',    label: 'Contact',     icon: 'bottle', hx: '50%', hy: '48%', delay: '3.6s' }
];

const ICONS = {
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3.5 11 8.5-7 8.5 7"/><path d="M5.5 9.5V20h13V9.5M9.5 20v-6h5v6"/></svg>',
  tank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8.5" cy="8.5" r="3"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M3.5 19c.5-3.2 2.4-5 5-5s4.5 1.8 5 5M14 14.5c2.7-.1 4.8 1.5 5.5 4.5"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="9" cy="5" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="19" r="2"/></svg>',
  flask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9.5 3h5M10.5 3v6l-5 9a1.6 1.6 0 0 0 1.4 2.4h10.2a1.6 1.6 0 0 0 1.4-2.4l-5-9V3"/><path d="M8 15h8"/></svg>',
  seal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M19 9h3M2 15h3M19 15h3"/></svg>',
  shelf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="11" cy="18" r="1.5"/></svg>',
  bottle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5.5" width="16" height="13" rx="1.5"/><path d="m5 7 7 5.5L19 7"/><path d="M8 3h8"/></svg>'
};

/* ------------------------------------------------------------
   Small reusable icon set + markup helpers for the off-canvas
   panel's content blocks (cards / steps / contact rows). Kept
   separate from ICONS above, which stays reserved for hotspots.
   ------------------------------------------------------------ */
const CARD_ICONS = {
  compass:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-4 2 2-6 4-2Z"/></svg>',
  spark:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3v4M12 17v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M3 12h4M17 12h4M4.2 19.8 7 17M17 7l2.8-2.8"/></svg>',
  shield:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3.5 19 6v6c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6l7-2.5Z"/><path d="m9 12 2 2 4-4.5"/></svg>',
  arrow:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9.5 8.5 14 12l-4.5 3.5"/></svg>',
  users:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 3-5 5.5-5s4.9 2 5.5 5"/><circle cx="17" cy="9" r="2.3"/><path d="M15.8 14.2c2 .2 3.7 1.9 4.2 4.3"/></svg>',
  target:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none"/></svg>',
  layers:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m12 3 8 4.3-8 4.3-8-4.3L12 3Z"/><path d="m4 12 8 4.3 8-4.3"/><path d="m4 16.5 8 4.3 8-4.3"/></svg>',
  wrench:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.3 2.3-2-2 2.3-2.3Z"/></svg>',
  headset:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="5.5" rx="1.3"/><rect x="17" y="13" width="4" height="5.5" rx="1.3"/><path d="M19 18.5c0 1.7-1.6 3-3.6 3H14"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3.5" y="5" width="17" height="15" rx="1.6"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="m8.3 14 2 2 4.2-4.5"/></svg>',
  sliders:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  cpu:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="6" width="12" height="12" rx="1.6"/><rect x="9.3" y="9.3" width="5.4" height="5.4" rx="0.8"/><path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2"/></svg>',
  gauge:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15 15.5 10"/><path d="M12 15h.01"/></svg>',
  rocket:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3c3 1 5 4 5 8 0 2-.6 3.6-1.5 5L12 20l-3.5-4C7.6 14.6 7 13 7 11c0-4 2-7 5-8Z"/><circle cx="12" cy="10.5" r="1.6"/><path d="M9 16.5 6.5 19M15 16.5 17.5 19"/></svg>',
  search:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.3-4.3"/></svg>',
  ruler:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m4 15 5-11 11 5-5 11-11-5Z"/><path d="m9.5 9.5 1.2 1.2M12 7l1.2 1.2M7 12l1.2 1.2"/></svg>',
  truck:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7h10v9H3z"/><path d="M13 10h4l3.5 3.5V16H13z"/><circle cx="7" cy="18" r="1.7"/><circle cx="17" cy="18" r="1.7"/></svg>',
  lifebuoy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="m6.4 6.4 3.3 3.3M17.6 6.4l-3.3 3.3M6.4 17.6l3.3-3.3M17.6 17.6l-3.3-3.3"/></svg>',
  mail:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5.5" width="18" height="13" rx="1.6"/><path d="m4 6.5 8 6.5 8-6.5"/></svg>',
  pin:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 1 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  message:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 5.5h16v10.5H9.5L5 20v-4H4Z"/></svg>'
};

function ovCard(icon, title, text) {
  return `<div class="ov-card">
      <span class="ov-card__icon" aria-hidden="true">${CARD_ICONS[icon] || ''}</span>
      <h4 class="ov-card__title">${title}</h4>
      <p class="ov-card__text">${text}</p>
    </div>`;
}

function ovStep(num, icon, title, text) {
  return `<div class="ov-step">
      <span class="ov-step__num" aria-hidden="true">${CARD_ICONS[icon] || ''}<em>${num}</em></span>
      <h4 class="ov-step__title">${title}</h4>
      <p class="ov-step__text">${text}</p>
    </div>`;
}

function ovContactRow(icon, label, value, href) {
  const inner = href
    ? `<a href="${href}">${value}</a>`
    : `<span>${value}</span>`;
  return `<div class="ov-contact__row">
      <span class="ov-contact__icon" aria-hidden="true">${CARD_ICONS[icon] || ''}</span>
      <span class="ov-contact__text"><small>${label}</small>${inner}</span>
    </div>`;
}

/* ===== START: commercial-content helpers (added for the 7-page content update) ===== */
// Section → hash used by the top navigation, so CTA links in the panels match the nav.
const TOPIC_HASH = {
  source: '#hero', purification: '#purification', laboratory: '#laboratory',
  quality: '#quality', storage: '#storage', handling: '#handling', materials: '#footer'
};

// Button-style link that jumps to another of the 7 panels (handled in initIconScene).
function ovAction(label, topicKey, ghost) {
  return `<a class="ov-btn${ghost ? ' ov-btn--ghost' : ''}" href="${TOPIC_HASH[topicKey] || '#'}" data-overlay-goto="${topicKey}">${label}</a>`;
}

// Inline text link that jumps to another panel.
function ovLink(label, topicKey) {
  return `<a class="ov-link" href="${TOPIC_HASH[topicKey] || '#'}" data-overlay-goto="${topicKey}">${label}</a>`;
}

// Collapsible sector block (native <details>, so it needs no JS and stays keyboard accessible).
function ovSector(title, rows, open) {
  const list = rows.map(([label, text]) => `<div><dt>${label}</dt><dd>${text}</dd></div>`).join('');
  return `<details class="ov-sector"${open ? ' open' : ''}>
      <summary class="ov-sector__summary"><span>${title}</span></summary>
      <dl class="ov-sector__list">${list}</dl>
    </details>`;
}

// Direct email remains available if Web3Forms returns an error.
const CONTACT_EMAIL = 'info@drinkingwater.shop';

function getContactAccessKey() {
  return document.querySelector('[data-contact-access-key]')?.value.trim() || '';
}

const TN_DISTRICTS = ['Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram', 'Kanniyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'];

const BUSINESS_TYPES = ['Hospital / Healthcare facility', 'Hotel / Resort', 'Restaurant / Food service', 'Factory / Industrial facility', 'IT park / Corporate office', 'School / College / University', 'Mall / Commercial complex', 'Convention centre / Event venue', 'Apartment / Gated community', 'Other institution'];

const WATER_REQUIREMENTS = ['Commercial drinking water purification', 'Industrial / process water treatment', 'Water quality testing and assessment', 'RO / multistage filtration plant', 'Bulk water supply planning', 'Maintenance or filter replacement for an existing system', 'Not sure — need a recommendation'];

function ovField(id, label, control, required, wide) {
  return `<div class="ov-field${wide ? ' ov-field--wide' : ''}">
        <label for="dws-cf-${id}">${label}${required ? ' <i aria-hidden="true">*</i>' : ''}</label>
        ${control}
        <span class="ov-field__error" id="dws-cf-${id}-error" aria-live="polite"></span>
      </div>`;
}

function ovSelect(id, name, options, required) {
  const opts = options.map((o) => `<option value="${o}">${o}</option>`).join('');
  return `<select id="dws-cf-${id}" name="${name}"${required ? ' required' : ''}><option value="">Select…</option>${opts}</select>`;
}

// The commercial enquiry form shown inside the Contact panel.
function ovContactForm() {
  return `<form class="ov-form" action="https://api.web3forms.com/submit" method="POST" data-contact-form novalidate>
      <input type="hidden" name="access_key" value="${getContactAccessKey()}">
      <input type="hidden" name="subject" value="Commercial water consultation request">
      <input type="hidden" name="from_name" value="drinkingwater.shop">
      <div class="ov-form__grid">
        ${ovField('name', 'Full Name', '<input id="dws-cf-name" name="Full Name" type="text" autocomplete="name" required>', true)}
        ${ovField('company', 'Company / Organization Name', '<input id="dws-cf-company" name="Company / Organization Name" type="text" autocomplete="organization" required>', true)}
        ${ovField('email', 'Email Address', '<input id="dws-cf-email" name="Email Address" type="email" autocomplete="email" required>', true)}
        ${ovField('city', 'City / District in Tamil Nadu', `<input id="dws-cf-city" name="City / District" type="text" list="dws-cf-districts" autocomplete="address-level2" required><datalist id="dws-cf-districts">${TN_DISTRICTS.map((d) => `<option value="${d}"></option>`).join('')}</datalist>`, true)}
        ${ovField('business', 'Business Type', ovSelect('business', 'Business Type', BUSINESS_TYPES, true), true)}
        ${ovField('requirement', 'Water Requirement', ovSelect('requirement', 'Water Requirement', WATER_REQUIREMENTS, true), true)}
        ${ovField('demand', 'Approximate Daily Water Demand', '<input id="dws-cf-demand" name="Approximate Daily Water Demand" type="text" placeholder="e.g. litres per day, or “not sure yet”">', false)}
        ${ovField('message', 'Message / Project Requirements', '<textarea id="dws-cf-message" name="Message / Project Requirements" rows="4" placeholder="Tell us about your facility, your water source and what you need."></textarea>', false, true)}
      </div>
      <input class="ov-form__trap" type="text" name="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button class="ov-btn ov-form__submit" type="submit">Request a Commercial Water Consultation</button>
      <p class="ov-form__status" data-contact-status role="status" aria-live="polite"></p>
    </form>`;
}

// Tamil Nadu map: Google Maps embed framed on the service region. No marker is drawn,
// so it shows the service region without implying an office location.
function ovTamilNaduMap() {
  return `<div class="ov-map">
      <div class="ov-map__frame">
        <iframe title="Map of Tamil Nadu, India — our service region" src="https://www.google.com/maps?q=Tamil+Nadu%2C+India&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>
      <p class="ov-map__caption">We serve businesses and institutions across Tamil Nadu. The map shows the state for reference and does not mark an office location. <a class="ov-link" href="https://www.google.com/maps/search/?api=1&amp;query=Tamil%20Nadu%2C%20India" target="_blank" rel="noopener noreferrer">View larger map</a></p>
    </div>`;
}

/* ----- Contact form behaviour (delegated from the overlay, because panel content is re-rendered) ----- */
function setFieldError(field, message) {
  const input = field.querySelector('input, select, textarea');
  const error = field.querySelector('.ov-field__error');
  if (!input || !error) return;
  error.textContent = message;
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', error.id);
  } else {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
}

function validateContactForm(form) {
  let firstInvalid = null;
  form.querySelectorAll('.ov-field').forEach((field) => {
    const input = field.querySelector('input, select, textarea');
    if (!input) return;
    const value = input.value.trim();
    let message = '';
    if (input.required && !value) message = 'This field is required.';
    else if (input.name === 'Email Address' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) message = 'Enter a valid email address.';
    setFieldError(field, message);
    if (message && !firstInvalid) firstInvalid = input;
  });
  return firstInvalid;
}

function showContactStatus(form, message, kind) {
  const status = form.querySelector('[data-contact-status]');
  if (!status) return;
  status.textContent = message;
  status.className = `ov-form__status${kind ? ` ov-form__status--${kind}` : ''}`;
  status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
}

async function handleContactSubmit(form) {
  const firstInvalid = validateContactForm(form);
  if (firstInvalid) {
    showContactStatus(form, 'Please check the highlighted fields and try again.', 'error');
    firstInvalid.focus();
    return;
  }
  // Honeypot: real visitors never fill this in.
  const honeypot = form.querySelector('[name="botcheck"]');
  if (honeypot && (honeypot.type === 'checkbox' ? honeypot.checked : honeypot.value)) return;

  const formData = new FormData(form);
  const accessKey = String(formData.get('access_key') || getContactAccessKey()).trim();
  const submit = form.querySelector('button[type="submit"]');

  if (!accessKey) {
    showContactStatus(form, 'This form is not configured yet. Add your Web3Forms access key to the hidden access_key field in index.html.', 'error');
    return;
  }

  if (form.dataset.submitting === 'true') return;
  form.dataset.submitting = 'true';
  if (submit) submit.disabled = true;
  showContactStatus(form, 'Sending your request…', '');

  const fields = {};
  formData.forEach((value, key) => {
    if (!['access_key', 'botcheck', 'subject', 'from_name'].includes(key)) {
      const text = String(value).trim();
      if (text) fields[key] = text;
    }
  });
  const company = fields['Company / Organization Name'] || 'website visitor';
  const subject = fields['Company / Organization Name']
    ? `Commercial water consultation request — ${company}`
    : String(formData.get('subject') || 'Website contact enquiry');

  try {
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: accessKey,
        subject,
        from_name: String(formData.get('from_name') || 'drinkingwater.shop'),
        replyto: fields.email || fields.Email || fields['Email Address'],
        ...fields
      })
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || 'Request failed');
    showContactStatus(form, 'Thank you. Your request has been sent and our team will review it.', 'success');
    form.reset();
  } catch (error) {
    showContactStatus(form, `We could not send your request just now. Please try again, or email ${CONTACT_EMAIL} directly.`, 'error');
  } finally {
    form.dataset.submitting = 'false';
    if (submit) submit.disabled = false;
  }
}
/* ===== END: commercial-content helpers ===== */

/* ------------------------------------------------------------
   Full, one-page-level copy for each of the 7 hotspots. This is
   the only thing that changed inside the off-canvas panel: the
   panel itself, its open/close animation and its structural
   markup (eyebrow / title / lede / content / pager) are untouched
   — only the data poured into `data-overlay-content` is new.

   ===== START: commercial water treatment content update =====
   Positioning: commercial B2B drinking water purification, filtration,
   treatment and bulk-supply planning for Tamil Nadu.
   VERIFY BEFORE PUBLISHING: the "25 years of industry experience" claim
   (Home + About) is used as briefed and must be confirmed by the company.
   No certifications, clients, projects, approvals, statistics, product
   models, capacities or prices are stated anywhere in this copy.
   `short` (optional) is the compact title used by the hotspot preview
   card and the circular navigation; `title` is the full panel heading.
   ------------------------------------------------------------ */
const CONTENT = {
  source: {
    eyebrow: 'Home',
    title: 'Commercial Drinking Water Solutions for Businesses Across Tamil Nadu',
    short: 'Commercial Drinking Water Solutions',
    lede: 'Reliable purification, filtration and treatment for hospitals, hotels, industries, offices and institutions, backed by 25 years of industry experience.',
    body: `
      <p class="ov-lead">Reliable water purification, filtration, and treatment solutions designed for hospitals, hotels, industries, corporate facilities, and institutions. From water quality assessment to system installation and maintenance, we help businesses plan dependable purified water solutions according to their requirements.</p>
      <div class="ov-actions">
        ${ovAction('Request a Consultation', 'materials')}
        ${ovAction('Explore Our Solutions', 'handling', true)}
      </div>
      <p class="ov-note">25 years of industry experience in commercial water purification and treatment.</p>
      <h3 class="ov-subhead">What we do</h3>
      <div class="ov-grid">
        ${ovCard('layers', 'Commercial Drinking Water Purification', 'Treatment systems for facilities that need purified drinking water for large numbers of people every day, planned around your source water and your demand.')}
        ${ovCard('search', 'Water Quality Assessment', 'We start with the water itself. Testing and assessment of your source water show which treatment stages your facility actually needs.')}
        ${ovCard('sliders', 'Filtration & Treatment Systems', 'RO, multistage filtration, softening, ultrafiltration and UV disinfection, combined as the water and the application require.')}
        ${ovCard('wrench', 'Installation, Maintenance & Support', 'Installation, scheduled maintenance, filter replacement and technical support, so a system keeps performing after it is commissioned.')}
      </div>
      <h3 class="ov-subhead">Who we serve</h3>
      <p>Hospitals and healthcare facilities, hotels, resorts and restaurants, IT parks and corporate offices, factories and industrial facilities, schools, colleges and universities, shopping malls and commercial complexes, apartments and gated communities, convention centres and event venues, and other institutions that need high-volume purified drinking water.</p>
      <h3 class="ov-subhead">Serving Tamil Nadu</h3>
      <p>We work with businesses and institutions across Tamil Nadu. Whether you need a new purification system, a review of an existing plant, or help planning a bulk purified water requirement, the first step is the same: tell us about your facility and your water. Bulk requirements are assessed individually, around your consumption and storage.</p>
      <p class="ov-cta"><span>Ready to plan your facility’s water requirement?</span> Share a few details about your site and we will suggest a sensible next step. ${ovLink('Contact Our Team →', 'materials')}</p>
    `
  },
  purification: {
    eyebrow: 'About',
    title: 'About Us: Commercial Water Treatment in Tamil Nadu',
    short: 'About Us',
    lede: 'A commercial water purification and treatment solutions provider serving businesses and institutions across Tamil Nadu, with 25 years of industry experience.',
    body: `
      <p class="ov-lead">We design, install and support drinking water purification and treatment systems for commercial and institutional facilities across Tamil Nadu. A large facility cannot rely on guesswork when it comes to water, so every recommendation starts from the water itself and from the way the facility uses it.</p>
      <div class="ov-grid ov-grid--2">
        ${ovCard('users', 'Who We Are', 'A commercial water purification and treatment solutions provider serving businesses and institutions in Tamil Nadu: hospitals, hotels, factories, offices, schools and other facilities that depend on reliable drinking water.')}
        ${ovCard('calendar', '25 Years of Experience', 'Two and a half decades in the water treatment industry give us practical experience of how commercial water systems are specified, installed and kept running.')}
        ${ovCard('target', 'Commercial Water Requirements', 'Commercial treatment is not simply a bigger domestic purifier. Large facilities have continuous and peak demand, bulk storage, many points of use and a duty to keep supplying people. We plan for those realities.')}
        ${ovCard('search', 'Water Quality & Facility Demand', 'Source water varies widely, and so does demand. We look at both, the quality of the water coming in and how much the facility needs including peak periods, before proposing a system.')}
        ${ovCard('sliders', 'Customized System Planning', 'Treatment stages, capacity and equipment are selected for the facility. No two sites are the same, so we do not begin from a fixed package.')}
        ${ovCard('wrench', 'Quality-Focused Installation & Maintenance', 'Careful installation, followed by scheduled maintenance, filter replacement and periodic water quality checks, because a good system only stays good if it is looked after.')}
        ${ovCard('headset', 'Long-Term Customer Support', 'Our relationship does not end at commissioning. Technical support and ongoing service help keep the supply dependable as your facility and its demand change.')}
        ${ovCard('shield', 'Our Commitment', 'To recommend what the water and the facility actually need, to explain our reasoning clearly, and to support reliable water treatment over the long term.')}
      </div>
      <p>We are careful not to overstate. Treatment design depends on testing, and results depend on how a system is operated and maintained, so we talk about requirements and process rather than guarantees.</p>
      <p class="ov-cta"><span>Planning a water system for your facility?</span> Tell us about it and we can talk through the requirement. ${ovLink('Contact Our Team →', 'materials')}</p>
    `
  },
  laboratory: {
    eyebrow: 'Services',
    title: 'Commercial Water Treatment Services',
    short: 'Our Services',
    lede: 'From water quality testing and system installation to maintenance and technical support: the services a commercial facility needs to keep purified drinking water dependable.',
    body: `
      <p class="ov-lead">A commercial water system needs more than equipment. It needs the right assessment before it is built, careful installation, and reliable servicing for years afterwards. These are the services we offer.</p>
      <div class="ov-grid">
        ${ovCard('layers', 'Commercial Drinking Water Purification', 'Design and supply of purification systems that produce drinking water for large numbers of people: staff, patients, guests, students or residents. The benefit is a planned, consistent source of purified water matched to your demand, rather than ad hoc or undersized arrangements.')}
        ${ovCard('search', 'Water Quality Testing & Assessment', 'Testing and review of your source water to understand what needs treating, for example hardness, dissolved solids, turbidity, iron or microbiological concerns. The benefit is treatment decisions based on your actual water, which avoids both under-treatment and unnecessary equipment.')}
        ${ovCard('wrench', 'Commercial Filtration System Installation', 'Installation and commissioning of filtration equipment, including connection to existing storage and distribution. The benefit is a system installed to its design intent, which is what lets it perform as planned from the start.')}
        ${ovCard('cpu', 'Industrial & Institutional Water Treatment', 'Treatment for factories, campuses and institutions that use water at scale, including pretreatment such as sediment, iron or hardness control ahead of purification. The benefit is protection of downstream equipment and a steadier output quality.')}
        ${ovCard('truck', 'Bulk Water Supply Planning & Coordination', 'Help in working out how much purified water a facility needs, how it should be stored and how supply can be arranged around peak demand. The benefit is fewer shortages and a clearer plan. This is planning support; whether physical bulk delivery can be arranged is confirmed separately for each requirement.')}
        ${ovCard('sliders', 'RO & Multistage Filtration Solutions', 'Reverse osmosis and multistage filtration configured for the source water and the output quality needed. The benefit is purification stages chosen for a reason, rather than a fixed sequence applied to every site.')}
        ${ovCard('calendar', 'Water Treatment System Maintenance', 'Scheduled servicing, cleaning, inspection and periodic quality checks for treatment plants. The benefit is consistent performance, fewer unplanned stoppages and earlier detection of problems.')}
        ${ovCard('headset', 'Filter Replacement & Technical Support', 'Replacement of filters, membranes and other consumables, with technical help for troubleshooting. The benefit is a system that keeps its treatment performance as components wear.')}
      </div>
      <h3 class="ov-subhead">Three different things, kept separate</h3>
      <div class="ov-grid">
        ${ovCard('layers', 'Purified water production systems', 'Equipment installed at your facility that treats your own source water into purified drinking water.')}
        ${ovCard('wrench', 'Water treatment services', 'Assessment, design support, installation, maintenance and technical support for those systems.')}
        ${ovCard('truck', 'Physical bulk water delivery', 'Transporting water to a site is a separate matter from treating it. We do not assume it is part of any requirement; availability is confirmed individually with our team.')}
      </div>
      <p class="ov-cta"><span>Not sure which services you need?</span> Describe your facility and we will suggest a starting point. ${ovLink('Contact Our Team →', 'materials')}</p>
    `
  },
  quality: {
    eyebrow: 'Products',
    title: 'Commercial Water Treatment Equipment',
    short: 'Our Products',
    lede: 'Purification and filtration equipment for large facilities, each matched to the facility, its water and the treatment need it addresses.',
    body: `
      <p class="ov-lead">Commercial water treatment equipment is chosen to solve a specific problem in a specific kind of facility. Each category below shows what it is used for, who it suits and the need it addresses.</p>
      <p class="ov-note">Models, capacities, specifications and availability are confirmed after assessing your requirement. None are listed here.</p>
      <h3 class="ov-subhead">Equipment categories</h3>
      <div class="ov-grid">
        ${ovCard('layers', 'Commercial RO Water Purification Systems', '<b>Used for:</b> producing purified drinking water at facility scale by reverse osmosis. <b>Suits:</b> hospitals, hotels, offices, campuses and apartment communities. <b>Addresses:</b> high dissolved solids in the source water and the need for consistent drinking water quality.')}
        ${ovCard('cpu', 'Industrial RO Treatment Plants', '<b>Used for:</b> larger-scale RO treatment where volumes are high or process needs apply, normally with pretreatment ahead of the membranes. <b>Suits:</b> factories, industrial facilities and large institutions. <b>Addresses:</b> dissolved salts and other dissolved impurities in high-volume supply.')}
        ${ovCard('layers', 'Multimedia & Sediment Filters', '<b>Used for:</b> removing suspended particles, silt and turbidity from raw water, usually as a first stage. <b>Suits:</b> any facility drawing on borewell, surface or tanker water. <b>Addresses:</b> cloudy or sediment-laden water, and protection of the equipment downstream.')}
        ${ovCard('shield', 'Activated Carbon Filtration Systems', '<b>Used for:</b> reducing certain tastes, odours, chlorine and some organic compounds. <b>Suits:</b> hotels, restaurants, offices and institutions where taste matters, and plants fed by chlorinated supply. <b>Addresses:</b> taste and odour complaints, and chlorine that can affect RO membranes.')}
        ${ovCard('sliders', 'Water Softening Systems', '<b>Used for:</b> reducing water hardness by ion exchange. <b>Suits:</b> hotels, hospitals, kitchens and laundries, and factories with boilers or heat exchangers. <b>Addresses:</b> scale build-up on pipes, heaters and equipment, and hard water ahead of RO.')}
        ${ovCard('spark', 'UV Water Disinfection Equipment', '<b>Used for:</b> inactivating microorganisms with ultraviolet light as a disinfection stage. <b>Suits:</b> any facility producing drinking water, usually as a final step. <b>Addresses:</b> microbiological control, as one part of a treatment train and not a substitute for the other stages.')}
        ${ovCard('gauge', 'Ultrafiltration Systems', '<b>Used for:</b> membrane filtration that removes fine suspended particles and many microorganisms. <b>Suits:</b> institutions and industries with variable or turbid supply. <b>Addresses:</b> fine particles and turbidity, and pretreatment ahead of RO.')}
        ${ovCard('truck', 'Commercial Water Storage & Distribution Equipment', '<b>Used for:</b> holding treated water and delivering it to points of use: tanks, distribution lines and, where needed, point-of-use dispensing. <b>Suits:</b> large facilities, campuses and apartment communities. <b>Addresses:</b> keeping treated water clean after treatment and meeting peak demand.')}
      </div>
      <p class="ov-cta"><span>Need help choosing?</span> The right equipment depends on your water test results, daily demand and peak demand. ${ovLink('Contact Our Team →', 'materials')}</p>
    `
  },
  storage: {
    eyebrow: 'Technology',
    title: 'How Commercial Water Treatment Works',
    short: 'Water Treatment Technology',
    lede: 'From raw water to treated storage: the stages commonly used to produce drinking water for large facilities, and why not every site needs every stage.',
    body: `
      <p class="ov-lead">Treatment is a sequence in which each stage prepares the water for the next. The stages below are the ones commonly considered. Which of them a facility actually needs is decided from its source water, its test results and the quality it has to achieve.</p>
      <div class="ov-steps">
        ${ovStep('01', 'search', 'Source Water & Quality Assessment', 'Borewell, municipal, surface or tanker water each behave differently. Testing establishes what has to be removed or controlled.')}
        ${ovStep('02', 'layers', 'Sediment & Particle Filtration', 'Multimedia and sediment filters take out sand, silt and suspended particles that would otherwise foul the finer stages.')}
        ${ovStep('03', 'shield', 'Activated Carbon Treatment', 'Where required, carbon reduces chlorine, certain organic compounds and unwanted taste or odour.')}
        ${ovStep('04', 'sliders', 'Softening & Pretreatment', 'Where required, softening or other pretreatment controls hardness and similar issues, protecting the membranes and equipment that follow.')}
        ${ovStep('05', 'cpu', 'RO or Other Purification', 'Reverse osmosis, ultrafiltration or another suitable technology reduces dissolved and fine contaminants, chosen for the water and the target quality.')}
        ${ovStep('06', 'spark', 'UV or Other Disinfection', 'UV light, or another suitable method, controls microorganisms as part of the treatment train.')}
        ${ovStep('07', 'arrow', 'Treated Water Storage & Distribution', 'Clean, protected storage and distribution carry treated water to the points of use without undoing the treatment.')}
        ${ovStep('08', 'calendar', 'Monitoring & Maintenance', 'Periodic checks, servicing and replacement of filters and membranes keep each stage performing as designed.')}
      </div>
      <p class="ov-note">The actual stages depend on the source water, the test results, the required output quality and the intended application.</p>
      <p>Not every facility needs every stage, and no single technology makes all water safe to drink on its own. RO, UV and the rest each address specific concerns. A well-designed system combines only what the water requires and is checked regularly once it is running.</p>
    `
  },
  handling: {
    eyebrow: 'Solutions',
    title: 'Water Solutions for Every Type of Facility',
    short: 'Solutions by Sector',
    lede: 'How commercial purification and treatment can be planned for different kinds of business and institution, based on testing, consumption and peak demand.',
    body: `
      <p class="ov-lead">A hospital, a hotel kitchen, a factory and a school do not use water in the same way. Below are the customer categories we aim to serve and how we approach each one. They are sectors we are set up to support, not a list of existing clients.</p>
      <div class="ov-steps">
        ${ovStep('01', 'search', 'Understand', 'Water testing, a look at the facility, and an estimate of daily and peak demand.')}
        ${ovStep('02', 'ruler', 'Design', 'Treatment stages and capacity selected from those findings.')}
        ${ovStep('03', 'truck', 'Install', 'Installation and commissioning to suit the space, plumbing and storage.')}
        ${ovStep('04', 'lifebuoy', 'Support', 'Maintenance, filter replacement and periodic water quality checks.')}
      </div>
      <p class="ov-note">For every facility, treatment design and capacity are decided from water testing, actual consumption, peak demand and the facility’s own requirements, never from the sector alone.</p>
      <h3 class="ov-subhead">Solutions by sector</h3>
      <div class="ov-sectors">
        ${ovSector('Hospital Water Purification Solutions', [
          ['Typical water needs', 'Drinking water for patients, visitors and staff around the clock, plus water for catering and general facility use.'],
          ['Why it matters', 'Patients can be more vulnerable to poor water quality, and an interruption in supply is hard to absorb in a facility that never closes.'],
          ['Options to consider', 'Sediment and carbon pretreatment, softening where hardness is an issue, RO or ultrafiltration, UV disinfection, and protected storage and distribution.'],
          ['Planning capacity', 'Planned around bed count, staff and visitor numbers and 24-hour peak demand, with storage and standby arrangements discussed up front.'],
          ['Maintenance & checks', 'Frequent scheduled servicing and periodic water quality checks. Clinical uses such as dialysis or sterile processing have their own requirements and are assessed separately with the hospital’s clinical and engineering teams.']
        ], true)}
        ${ovSector('Hotel & Resort Water Treatment Solutions', [
          ['Typical water needs', 'Drinking water for guests and staff, kitchen and beverage water, and treated water that protects equipment such as boilers and laundry machines.'],
          ['Why it matters', 'Guests notice taste and clarity, and hard or poor-quality water shortens the life of fittings and equipment.'],
          ['Options to consider', 'Carbon filtration for taste and odour, softening for scale, RO or ultrafiltration for drinking water, and UV disinfection.'],
          ['Planning capacity', 'Sized to room count, restaurants and events, with allowance for seasonal and weekend occupancy peaks.'],
          ['Maintenance & checks', 'Regular servicing, scheduled filter replacement and periodic water quality checks, timed around occupancy where possible.']
        ])}
        ${ovSector('Restaurant & Food-Service Water Solutions', [
          ['Typical water needs', 'Drinking water, cooking and beverage preparation, ice-making and dishwashing.'],
          ['Why it matters', 'Water goes straight into food and drink, so taste, odour and hygiene matter, and scale can damage coffee machines, ice makers and other equipment.'],
          ['Options to consider', 'Sediment and carbon filtration, scale control or softening, and RO or UV where the water requires it.'],
          ['Planning capacity', 'Planned around covers served and the busiest service periods, since demand is concentrated into a few hours.'],
          ['Maintenance & checks', 'Regular filter changes and scheduled checks, because worn filters can affect taste and equipment.']
        ])}
        ${ovSector('Industrial & Factory Water Treatment', [
          ['Typical water needs', 'Drinking and canteen water for employees and, separately, water for production processes, which may have different quality requirements.'],
          ['Why it matters', 'Raw water can vary and may carry hardness, dissolved solids or iron. Untreated, it can foul equipment and affect product and process.'],
          ['Options to consider', 'Multimedia filtration and iron or hardness control as pretreatment, RO treatment plants, and UV disinfection for drinking water. The handling of RO reject water is considered in the design.'],
          ['Planning capacity', 'Sized to headcount for drinking water and to process requirements for process water, across shifts and peak production.'],
          ['Maintenance & checks', 'Planned servicing schedules, membrane and filter replacement and regular water testing to keep output consistent.']
        ])}
        ${ovSector('IT Park & Corporate Office Water Solutions', [
          ['Typical water needs', 'Drinking water for large workforces across several floors, pantries and cafeterias.'],
          ['Why it matters', 'Demand is high and predictable, and employees notice interruptions or taste problems quickly.'],
          ['Options to consider', 'Centralised treatment (sediment, carbon, RO or ultrafiltration, UV) with storage and distribution serving several floors, or distributed units for individual blocks, depending on the layout.'],
          ['Planning capacity', 'Based on occupancy, shifts and peak times such as morning arrival and lunch.'],
          ['Maintenance & checks', 'Scheduled servicing outside working hours where possible, and periodic quality checks at points of use.']
        ])}
        ${ovSector('School & College Water Purification', [
          ['Typical water needs', 'Drinking water for students and staff at several points across a campus, plus canteen use.'],
          ['Why it matters', 'Many people drink from shared points at the same times of day, so hygiene and dependable supply matter.'],
          ['Options to consider', 'Sediment and carbon filtration, RO or ultrafiltration where required, UV disinfection and clean storage, using robust equipment that is easy to service.'],
          ['Planning capacity', 'Planned around student and staff numbers and break-time peaks, which are short and intense.'],
          ['Maintenance & checks', 'Regular servicing, plus cleaning and flushing after holidays and vacations, when water sits unused.']
        ])}
        ${ovSector('Apartment & Residential Community Solutions', [
          ['Typical water needs', 'Drinking water for many households, often drawn from a mix of municipal, borewell and tanker sources into shared storage.'],
          ['Why it matters', 'Residents depend on shared infrastructure, and hardness or contamination in a common tank affects everyone.'],
          ['Options to consider', 'Centralised filtration and softening where needed, RO or ultrafiltration for the drinking water supply, UV disinfection, and attention to tank hygiene.'],
          ['Planning capacity', 'Based on the number of households and residents, with morning and evening peaks.'],
          ['Maintenance & checks', 'A servicing schedule agreed with the residents’ association, periodic tank cleaning and water quality checks.']
        ])}
        ${ovSector('Mall, Convention Centre & Institutional Solutions', [
          ['Typical water needs', 'Drinking water points, food courts and beverage outlets serving large and highly variable numbers of visitors.'],
          ['Why it matters', 'Footfall swings sharply between quiet days and events, and a shortfall at peak is very visible.'],
          ['Options to consider', 'Filtration and purification sized for peak days, with buffer storage to absorb surges, plus UV disinfection and hygienic distribution.'],
          ['Planning capacity', 'Planned around peak footfall and event days, not the daily average.'],
          ['Maintenance & checks', 'Servicing planned around event calendars, with periodic quality checks at drinking points and food outlets.']
        ])}
      </div>
      <p class="ov-cta"><span>Tell us about your facility.</span> We will help work out what it needs. ${ovLink('Request a Consultation →', 'materials')}</p>
    `
  },
  materials: {
    eyebrow: 'Contact',
    title: 'Plan Your Water Requirement With Us',
    short: 'Contact',
    lede: 'For businesses and institutions in Tamil Nadu seeking a quotation, site assessment, consultation or water treatment system recommendation.',
    body: `
      <p class="ov-lead">Tell us about your facility and your water. We will use the details to suggest a sensible next step, whether that is a conversation, a site assessment, water testing or a system recommendation.</p>
      <div class="ov-contact">
        ${ovContactRow('mail', 'Email', CONTACT_EMAIL, `mailto:${CONTACT_EMAIL}`)}
        ${ovContactRow('pin', 'Service Region', 'Businesses and institutions across Tamil Nadu, India', null)}
      </div>
      <h3 class="ov-subhead">Request a Commercial Water Consultation</h3>
      ${ovContactForm()}
      <h3 class="ov-subhead">Our service region: Tamil Nadu</h3>
      ${ovTamilNaduMap()}
    `
  }
};
/* ===== END: commercial water treatment content update ===== */

function buildHotspot(topic) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-scene__hotspot';
  button.dataset.iconTarget = topic.key;
  button.style.setProperty('--hx', topic.hx);
  button.style.setProperty('--hy', topic.hy);
  button.style.setProperty('--hd', topic.delay);
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-label', `Open ${topic.label}`);
  button.innerHTML = `
    <span class="icon-scene__hotspot-dot" aria-hidden="true">
      ${ICONS[topic.icon] || ''}
      <span class="icon-scene__hotspot-check" aria-hidden="true">&#10003;</span>
    </span>
    <span class="icon-scene__hotspot-label">${topic.label}</span>
    <span class="icon-scene__hotspot-tip" role="tooltip">${topic.label}</span>
  `;
  return button;
}

/* ------------------------------------------------------------
   Small, self-contained "reach the module" animation driver.
   Reuses the existing setPurificationStage / setLaboratoryStage /
   setQualityStage / setHandlingStage / setStorageStage /
   setMaterialsStage API already exposed by three-scene.js (see
   window.__dwsScene, set once the facility finishes loading in
   main.js) — nothing here creates new 3D objects or touches the
   scroll-driven chapters; it only calls the same public setters
   those chapters already call, so the real equipment in the
   facility visibly runs through its process while that module's
   hotspot is open, then settles back to its resting frame 0 when
   closed. If the scene hasn't loaded yet, every call below is a
   harmless no-op via optional chaining. ------------------------ */
const MODULE_STAGE_RANGE = {
  // Source/intake has no separate chamber of its own — it IS the intake
  // pipe run (pipes.js route 0, always flowing). setPurificationStage(0)
  // is the exact existing call that puts full emphasis on that intake
  // run without lighting any treatment chamber, so re-asserting it here
  // guarantees the intake glows while this hotspot is open even if the
  // purification hotspot left the facility mid-cycle beforehand.
  source:       { setter: 'setPurificationStage', steps: 1 },
  purification: { setter: 'setPurificationStage', steps: 8 },
  laboratory:   { setter: 'setLaboratoryStage',   steps: 6 },
  quality:      { setter: 'setQualityStage',      steps: 7 },
  handling:     { setter: 'setHandlingStage',      steps: 8 },
  storage:      { setter: 'setStorageStage',       steps: 7 },
  materials:    { setter: 'setMaterialsStage',     steps: 6 }
};

let moduleAnimTimer = null;
let moduleAnimKey = null;

function stopModuleAnimation() {
  if (moduleAnimTimer) {
    window.clearInterval(moduleAnimTimer);
    moduleAnimTimer = null;
  }
  const cfg = moduleAnimKey && MODULE_STAGE_RANGE[moduleAnimKey];
  if (cfg) window.__dwsScene?.[cfg.setter]?.(0);
  moduleAnimKey = null;
}

function startModuleAnimation(key) {
  if (moduleAnimKey === key) return;
  stopModuleAnimation();
  const cfg = MODULE_STAGE_RANGE[key];
  if (!cfg) return; // topic has no dedicated 3D module — leave the facility at rest
  moduleAnimKey = key;
  let step = 0;
  let dir = 1;
  const tick = () => {
    if (!window.__dwsScene?.[cfg.setter]) return;
    window.__dwsScene[cfg.setter](step);
    if (cfg.steps > 1) {
      if (step >= cfg.steps - 1) dir = -1;
      else if (step <= 0) dir = 1;
      step += dir;
    }
  };
  tick();
  if (cfg.steps > 1) moduleAnimTimer = window.setInterval(tick, 900);
}

export function initIconScene() {
  const scene = document.querySelector('[data-icon-scene]');
  const overlay = document.querySelector('[data-content-overlay]');
  const preview = document.querySelector('[data-icon-preview]');
  const circleNav = document.querySelector('[data-circle-nav]');
  const discovered = document.querySelector('[data-icon-discovered]');
  if (!scene || !overlay || !preview || !circleNav || !discovered) return;

  const hotspotsWrap = scene.querySelector('[data-icon-hotspots]');
  if (!hotspotsWrap) return;

  TOPICS.forEach((topic) => hotspotsWrap.appendChild(buildHotspot(topic)));

  const panel = overlay.querySelector('.content-overlay__panel');
  const eyebrowEl = overlay.querySelector('[data-overlay-eyebrow]');
  const titleEl = overlay.querySelector('[data-overlay-title]');
  const ledeEl = overlay.querySelector('[data-overlay-lede]');
  const contentEl = overlay.querySelector('[data-overlay-content]');
  const pagerIndexEl = overlay.querySelector('[data-overlay-pager-index]');
  const previewEyebrowEl = preview.querySelector('[data-preview-eyebrow]');
  const previewTitleEl = preview.querySelector('[data-preview-title]');
  const previewLedeEl = preview.querySelector('[data-preview-lede]');
  const previewReadEl = preview.querySelector('[data-preview-read]');
  const discoveredValueEl = document.querySelector('[data-icon-discovered-value]');
  const circleIcons = circleNav.querySelector('[data-circle-icons]');
  const circleTitle = circleNav.querySelector('[data-circle-title]');
  const circleIndex = circleNav.querySelector('[data-circle-index]');
  const circleCloseTargets = circleNav.querySelectorAll('[data-circle-close]');

  const circleButtons = [];
  const originalHotspotState = new WeakMap();

  function moveHotspotsToCircle() {
    if (circleButtons.length) return;
    Array.from(hotspotsWrap.querySelectorAll('.icon-scene__hotspot')).forEach((button, index) => {
      originalHotspotState.set(button, {
        style: button.getAttribute('style') || '',
        ariaLabel: button.getAttribute('aria-label') || ''
      });
      button.classList.add('dws-circle-nav__icon');
      button.dataset.circleIndex = String(index + 1).padStart(2, '0');
      button.setAttribute('aria-label', `Focus ${TOPICS[index].label}`);
      circleIcons.appendChild(button);
      circleButtons.push(button);
    });
  }

  function restoreHotspots() {
    const sourceRects = circleButtons.map((button) => button.getBoundingClientRect());
    circleButtons.forEach((button) => hotspotsWrap.appendChild(button));
    circleButtons.forEach((button, index) => {
      const target = button.getBoundingClientRect();
      const source = sourceRects[index];
      button.classList.remove('dws-circle-nav__icon', 'is-selected');
      delete button.dataset.circleIndex;
      const originalState = originalHotspotState.get(button);
      if (originalState?.ariaLabel) button.setAttribute('aria-label', originalState.ariaLabel);
      button.style.position = 'fixed';
      button.style.left = `${source.left + source.width / 2}px`;
      button.style.top = `${source.top + source.height / 2}px`;
      button.style.width = `${source.width}px`;
      button.style.height = `${source.height}px`;
      button.style.margin = '0';
      button.style.animation = 'none';
      button.style.transition = 'none';
      button.style.transform = 'translate(-50%, -50%) scale(0.72)';
      button.style.opacity = '0.72';
      requestAnimationFrame(() => {
        button.style.transition = 'left 0.65s var(--ease), top 0.65s var(--ease), transform 0.65s var(--ease), opacity 0.5s var(--ease)';
        button.style.left = `${target.left + target.width / 2}px`;
        button.style.top = `${target.top + target.height / 2}px`;
        button.style.transform = 'translate(-50%, -50%) scale(1)';
        button.style.opacity = '1';
      });
      window.setTimeout(() => {
        if (originalState?.style) button.setAttribute('style', originalState.style);
        else button.removeAttribute('style');
      }, 700);
    });
    circleButtons.length = 0;
  }

  let circleActive = null;
  function focusCircleTopic(topic, index) {
    circleActive = topic;
    circleButtons.forEach((button, buttonIndex) => {
      button.classList.toggle('is-selected', buttonIndex === index);
    });
    const data = readTopic(topic);
    circleTitle.textContent = data?.short || data?.title || topic.label; // commercial content update: compact title
    circleIndex.textContent = String(index + 1).padStart(2, '0');
  }

  function closeCircleNav() {
    if (circleNav.hidden) return;
    circleNav.classList.remove('is-open');
    circleNav.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('circle-nav-open');
    restoreHotspots();
    window.setTimeout(() => {
      if (!circleNav.classList.contains('is-open')) circleNav.hidden = true;
    }, 650);
    circleActive = null;
  }

  function openCircleNav() {
    moveHotspotsToCircle();
    circleNav.hidden = false;
    circleNav.setAttribute('aria-hidden', 'false');
    document.body.classList.add('circle-nav-open');
    requestAnimationFrame(() => circleNav.classList.add('is-open'));
  }

  discovered.addEventListener('click', openCircleNav);
  discovered.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openCircleNav();
    }
  });
  circleIcons.addEventListener('click', (event) => {
    const button = event.target.closest('.dws-circle-nav__icon');
    if (!button) return;
    const index = circleButtons.indexOf(button);
    if (index >= 0) {
      markVisited(TOPICS[index]);
      focusCircleTopic(TOPICS[index], index);
    }
  });
  circleCloseTargets.forEach((target) => target.addEventListener('click', closeCircleNav));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCircleNav();
  });

  // Tracks which of the exactly-7 hotspots have been opened at least once,
  // so the "explored" readout at the bottom of the landscape can report a
  // live percentage — purely a display concern, touches no other module.
  const visited = new Set();
  function markVisited(topic) {
    if (!topic || visited.has(topic.key)) return;
    visited.add(topic.key);
    const button = hotspotsWrap.querySelector(`[data-icon-target="${topic.key}"]`) || circleButtons.find((item) => item.dataset.iconTarget === topic.key);
    button?.classList.add('is-visited');
    if (discoveredValueEl) {
      discoveredValueEl.textContent = `${Math.round((visited.size / TOPICS.length) * 100)}%`;
    }
  }

  let lastFocused = null;
  let closeTimer = null;
  let activeTopic = null;
  let previewOpener = null;      // element that had focus when the preview opened
  let previewHideTimer = null;   // delayed `hidden` after the close transition

  // Hidden content must never keep focus: aria-hidden / hidden / inert are only
  // applied to the preview after focus has been moved out of it. When `restore`
  // is true focus returns to whatever opened the preview (if it can still take
  // focus); otherwise, or if that fails, the focused element is blurred.
  function releasePreviewFocus(restore) {
    const active = document.activeElement;
    if (!active || !preview.contains(active)) return;
    const target = previewOpener;
    if (restore && target && target.isConnected && typeof target.focus === 'function' && !target.closest('[hidden], [inert]')) {
      target.focus({ preventScroll: true });
    }
    if (preview.contains(document.activeElement)) document.activeElement.blur();
  }

  function setPreviewScene(topic) {
    document.body.dispatchEvent(new CustomEvent('dws:hotspot-preview', {
      detail: { key: topic?.key || null }
    }));
    // Same open/close transition the camera flight already listens to —
    // start the destination module's own real-time process animation as
    // the camera arrives, and settle it back to rest as the camera leaves.
    if (topic?.key) startModuleAnimation(topic.key);
    else stopModuleAnimation();
    // Subtly highlight the marker the camera is currently travelling to,
    // and clear the highlight from whichever marker held it before.
    hotspotsWrap.querySelectorAll('.icon-scene__hotspot.is-active').forEach((el) => el.classList.remove('is-active'));
    if (topic?.key) hotspotsWrap.querySelector(`[data-icon-target="${topic.key}"]`)?.classList.add('is-active');
  }

  function readTopic(topic) {
    const data = CONTENT[topic.key];
    if (!data) return false;

    return {
      eyebrow: data.eyebrow || topic.label,
      title: data.title || topic.label,
      short: data.short || '',
      lede: data.lede || '',
      body: data.body || ''
    };
  }

  function fillFrom(topic) {
    const data = readTopic(topic);
    if (!data) return false;

    eyebrowEl.textContent = data.eyebrow;
    titleEl.textContent = data.title;
    ledeEl.textContent = data.lede;

    // Authored copy, not user input — safe to set directly.
    contentEl.innerHTML = data.body;
    // START: commercial content update — long panels always open at the top.
    overlay.querySelector('.content-overlay__body')?.scrollTo(0, 0);
    // END: commercial content update

    if (pagerIndexEl) {
      const index = TOPICS.findIndex((item) => item.key === topic.key);
      pagerIndexEl.textContent = `${String(index + 1).padStart(2, '0')} / ${String(TOPICS.length).padStart(2, '0')}`;
    }

    return true;
  }

  function openTopic(key, openFull = false) {
    const topic = TOPICS.find((item) => item.key === key);
    const data = topic && readTopic(topic);
    if (!topic || !data) return;

    activeTopic = topic;
    setPreviewScene(topic);
    markVisited(topic);
    if (openFull) {
      openFullTopic();
      return;
    }
    previewEyebrowEl.textContent = data.eyebrow;
    previewTitleEl.textContent = data.short || data.title; // commercial content update: compact title
    previewLedeEl.textContent = data.lede;
    if (previewHideTimer) { clearTimeout(previewHideTimer); previewHideTimer = null; }
    const opener = document.activeElement;
    if (opener && opener !== document.body && !preview.contains(opener)) previewOpener = opener;
    preview.inert = false;
    preview.hidden = false;
    preview.setAttribute('aria-hidden', 'false');
    document.body.classList.add('preview-open');
    requestAnimationFrame(() => {
      preview.classList.add('is-open');
      // keyboard / screen-reader users land in the preview they just opened
      preview.focus({ preventScroll: true });
    });
  }

  function openFullTopic() {
    if (!activeTopic || !fillFrom(activeTopic)) return;

    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    if (previewHideTimer) { clearTimeout(previewHideTimer); previewHideTimer = null; }
    // when "Read more" is used the focused element lives inside the preview that is
    // about to be hidden, so the panel should hand focus back to the original opener
    lastFocused = preview.contains(document.activeElement) ? previewOpener : document.activeElement;
    releasePreviewFocus(false);
    preview.inert = true;
    preview.classList.remove('is-open');
    preview.hidden = true;
    preview.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('preview-open');
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overlay-open');
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      panel?.focus({ preventScroll: true });
    });
  }

  // Optional prev/next through the 7 locations, requested only "if it
  // fits the existing system" — it does: it just re-runs the same
  // camera-flight + module-animation + content-fill path every hotspot
  // click already uses, so the panel never closes/reopens or reloads.
  function stepToTopic(delta) {
    if (!activeTopic) return;
    const currentIndex = TOPICS.findIndex((item) => item.key === activeTopic.key);
    const nextTopic = TOPICS[(currentIndex + delta + TOPICS.length) % TOPICS.length];
    activeTopic = nextTopic;
    setPreviewScene(nextTopic); // same camera-flight + module-animation trigger as any hotspot click
    markVisited(nextTopic);
    fillFrom(nextTopic);
  }

  // START: commercial content update — jump from a CTA/link inside a panel to another panel.
  // Same camera-flight + module-animation + content-fill path as stepToTopic.
  function goToTopic(key) {
    const nextTopic = TOPICS.find((item) => item.key === key);
    if (!nextTopic) return;
    activeTopic = nextTopic;
    setPreviewScene(nextTopic);
    markVisited(nextTopic);
    fillFrom(nextTopic);
  }
  // END: commercial content update

  function closeOverlay() {
    if (overlay.hidden) return;
    overlay.classList.remove('is-open');
    // focus leaves the panel before it is marked aria-hidden
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus({ preventScroll: true });
    }
    if (overlay.contains(document.activeElement)) document.activeElement.blur();
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overlay-open');
    setPreviewScene(null);
    closeTimer = setTimeout(() => { overlay.hidden = true; }, 420);
  }

  function closePreview() {
    if (preview.hidden) return;
    // move focus back to the opener first, then hide: no hidden element keeps focus
    releasePreviewFocus(true);
    preview.inert = true;
    preview.classList.remove('is-open');
    preview.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('preview-open');
    setPreviewScene(null);
    if (previewHideTimer) clearTimeout(previewHideTimer);
    previewHideTimer = setTimeout(() => { preview.hidden = true; previewHideTimer = null; }, 320);
    activeTopic = null;
    previewOpener = null;
  }

  let tipTimer = null;
  let launchTimer = null;
  hotspotsWrap.addEventListener('click', (event) => {
    const button = event.target.closest('[data-icon-target]');
    if (!button) return;

    // Subtle click/touch feedback — plays immediately, on the real
    // gesture, independent of the ambient sound toggle in audio.js.
    playClickSound();

    // Touch/click devices have no hover state to reveal the tooltip, so
    // show it briefly right on tap — the same small label a mouse user
    // already sees on hover, just time-boxed instead of hover-boxed.
    hotspotsWrap.querySelectorAll('.icon-scene__hotspot.is-tapped').forEach((el) => el.classList.remove('is-tapped'));
    button.classList.add('is-tapped');
    if (tipTimer) window.clearTimeout(tipTimer);
    tipTimer = window.setTimeout(() => button.classList.remove('is-tapped'), 1800);

    // Slow, premium 3D bubble launch: the icon eases forward first: once
    // that motion settles, the existing heading/off-canvas reveal below
    // (openTopic) runs exactly as it already did.
    hotspotsWrap.querySelectorAll('.icon-scene__hotspot.is-launching').forEach((el) => el.classList.remove('is-launching'));
    if (launchTimer) window.clearTimeout(launchTimer);
    if (ICON_LAUNCH_DELAY > 0) {
      button.classList.add('is-launching');
      launchTimer = window.setTimeout(() => {
        button.classList.remove('is-launching');
        openTopic(button.dataset.iconTarget);
      }, ICON_LAUNCH_DELAY);
    } else {
      openTopic(button.dataset.iconTarget);
    }
  });

  overlay.addEventListener('click', (event) => {
    if (event.target.closest('[data-overlay-close]')) closeOverlay();
    if (event.target.closest('[data-overlay-prev]')) stepToTopic(-1);
    if (event.target.closest('[data-overlay-next]')) stepToTopic(1);
    // START: commercial content update
    const jump = event.target.closest('[data-overlay-goto]');
    if (jump) {
      event.preventDefault();
      goToTopic(jump.dataset.overlayGoto);
    }
    // END: commercial content update
  });

  // START: commercial content update — contact form (delegated: panel content is re-rendered on every open)
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-contact-form]');
    if (!form) return;
    event.preventDefault();
    handleContactSubmit(form);
  });
  overlay.addEventListener('input', (event) => {
    const field = event.target.closest('.ov-field');
    if (field && field.querySelector('[aria-invalid="true"]')) setFieldError(field, '');
  });
  // END: commercial content update

  preview.addEventListener('click', (event) => {
    if (event.target.closest('[data-preview-read]')) openFullTopic();
    if (event.target.closest('[data-preview-close]')) closePreview();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!overlay.hidden) closeOverlay();
    else if (!preview.hidden) closePreview();
  });

  document.body.addEventListener('dws:navigation-topic', (event) => {
    openTopic(event.detail?.key, true);
  });
}
