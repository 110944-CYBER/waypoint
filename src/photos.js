/* ==========================================================================
   Waypoint · photos: each program shows its real institution, and listings
   near the student show their real city. All are openly licensed
   (Wikimedia Commons); PHOTO_CREDITS (photo-credits.js) holds the author
   and licence of each.
   ========================================================================== */

// Each program shows its own institution. Sample listings show the real city they are set in.
const PHOTO_BY_OP = {
  'gates-cambridge': 'cambridge', 'cam-llm': 'cam-law', 'cam-mphil-acs': 'cam-cs',
  'rhodes': 'rhodes-house', 'oxford-ghse': 'oxford', 'oxford-ecm': 'bodleian',
  'chevening': 'chevening', 'lse-media': 'lse', 'atlas-analyst': 'londoncity',
  'bartlett-march': 'bartlett', 'ucl-ioe-edu': 'ioe', 'commonwealth-masters': 'glasgow-uni',
  'fulbright': 'usa', 'knight-hennessy': 'stanford', 'rsi-mit': 'mit', 'hks-mpp': 'hks',
  'world-bank-sip': 'world-bank', 'hale-policy': 'washington', 'un-internship': 'un',
  'novacare-clinical': 'boston', 'jhu-mph': 'baltimore', 'pearson-uoft': 'uoft',
  'erasmus-mundus': 'europe', 'eu-blue-book': 'brussels', 'daad': 'germany', 'greenline-climate': 'berlin',
  'ironbridge-mech': 'munich', 'tum-msc-mech': 'tum', 'swiss-excellence': 'epfl', 'ethz-msc-cs': 'zurich',
  'cern-summer': 'cern', 'hec-mim': 'hec', 'stipendium-hungaricum': 'bme', 'turkiye-burslari': 'istanbul-uni',
  'orbit-swe': 'dubai', 'kaust': 'kaust', 'mastercard-scholars': 'uct',
  'mext': 'utokyo', 'gks': 'korea-uni', 'schwarzman': 'tsinghua',
  'lumen-design': 'singapore', 'nus-mcomp': 'nus', 'australia-awards': 'usyd', 'commons-remote': 'remote',
};

const PHOTOS = {
  base: 'img/',
  has(k) { return typeof PHOTO_CREDITS !== 'undefined' && !!PHOTO_CREDITS[k]; },
  key(op) {
    if (!op) return null;
    if (op.local) return this.localKey(op);
    const k = PHOTO_BY_OP[op.id];
    return k && this.has(k) ? k : null;
  },
  // Listings near the student are samples, so they show the student's real city.
  cityKeys(id) {
    const ks = [];
    for (let n = 1; this.has(`city-${id}-${n}`); n++) ks.push(`city-${id}-${n}`);
    return ks;
  },
  localKey(op) {
    const ks = this.cityKeys(op.cityId);
    const i = Number(String(op.id).split('-').pop()) || 0; // ids look like loc-<city>-<template index>
    return ks.length ? ks[i % ks.length] : null;
  },
  // Photos for a list shown as a grid: a card never repeats the photo of the
  // card before it or the card above it (two columns).
  spread(ops) {
    const out = [];
    ops.forEach((op, i) => {
      let k = this.key(op);
      if (op.local && k) {
        const ks = this.cityKeys(op.cityId);
        const start = ks.indexOf(k);
        for (let n = 0; n < ks.length; n++) {
          const c = ks[(start + n) % ks.length];
          if (c !== out[i - 1] && c !== out[i - 2]) { k = c; break; }
        }
      }
      out.push(k);
    });
    return out;
  },
  of(op) { const k = this.key(op); return k ? this.base + k + '.jpg' : null; },
  url(k) { return this.has(k) ? this.base + k + '.jpg' : null; },
};

function Credits({ onClose }) {
  const list = typeof PHOTO_CREDITS !== 'undefined' ? Object.entries(PHOTO_CREDITS) : [];
  return html`<${Drawer} label="Photo credits" onClose=${onClose}>
    <div class="det credits">
      <h2 class="det-t">Photo credits</h2>
      <p class="credits-sub">Photos from Wikimedia Commons, resized for the web. Thank you to every photographer.</p>
      <ul class="credits-list">${list.map(([k, c]) => html`<li key=${k}>
        <img src=${PHOTOS.url(k)} alt="" loading="lazy" decoding="async" />
        <span><a href=${c.u} target="_blank" rel="noopener noreferrer">${c.t}</a><span>${c.a || 'Unknown author'} · ${c.l}</span></span>
      </li>`)}</ul>
    </div>
  </${Drawer}>`;
}
