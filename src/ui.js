/* ==========================================================================
   Waypoint · shared components (kept deliberately small)
   ========================================================================== */

function Icon({ n, s = 18, w = 2, c }) {
  return html`<svg class=${cx('ic', c)} width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${w} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" dangerouslySetInnerHTML=${{ __html: ICONS[n] || '' }}></svg>`;
}

function LogoMark({ s = 28 }) {
  return html`<svg class="logo-mark" width=${s} height=${s} viewBox="0 0 32 32" aria-hidden="true">
    <path d="M4.5 8.5 10.4 23 16 12.4 21.6 23 27.5 8.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"></path>
    <circle cx="27.5" cy="8.5" r="4.3" fill="var(--accent)"></circle>
  </svg>`;
}
function Logo({ to = '' }) {
  if (to == null) return html`<span class="logo"><${LogoMark} /><span>Waypoint</span></span>`;
  return html`<a class="logo" href=${'#' + to} onClick=${(e) => { e.preventDefault(); go(to); }} aria-label="Waypoint"><${LogoMark} /><span>Waypoint</span></a>`;
}

function TypeLabel({ t }) {
  return html`<span class="tl" data-t=${t}><i aria-hidden="true"></i>${typeOf(t).one}</span>`;
}

function MatchRing({ v, size = 46, muted }) {
  const w = size > 50 ? 5 : 4;
  const r = (size - w) / 2;
  const c = 2 * Math.PI * r;
  return html`<span class="ring" style=${`width:${size}px;height:${size}px`} role="img" aria-label=${`${v} percent match`}>
    <svg width=${size} height=${size} viewBox=${`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke="var(--line)" stroke-width=${w}></circle>
      <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${muted ? 'var(--ink-3)' : v >= 80 ? 'var(--ok)' : 'var(--accent-2)'} stroke-width=${w} stroke-linecap="round"
        stroke-dasharray=${c.toFixed(2)} stroke-dashoffset=${(c * (1 - v / 100)).toFixed(2)} transform=${`rotate(-90 ${size / 2} ${size / 2})`}></circle>
    </svg>
    <b style=${`font-size:${Math.round(size * 0.3)}px`}>${v}</b>
  </span>`;
}

function imageOf(op) { return typeof PHOTOS !== 'undefined' ? PHOTOS.of(op) : null; }
function OppImage({ op, cls, photo }) {
  const src = photo && typeof PHOTOS !== 'undefined' ? PHOTOS.url(photo) : imageOf(op);
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  return html`<span class=${cx('ph', cls)} data-t=${op.type} aria-hidden="true">
    <${Icon} n=${typeOf(op.type).icon} s=${22} />
    ${src && !bad ? html`<img src=${src} alt="" loading="lazy" decoding="async" onError=${() => setBad(true)} />` : null}
  </span>`;
}

const moneyOf = (op) => (op.funding === 'full' ? 'Fully funded' : op.fundLabel);
const placeOf = (op) => (op.local ? `${op.city} · ${op.dist} km away` : op.region === 'remote' ? 'Remote' : op.city);

function OppCard({ row, onOpen, st, photo }) {
  const { op, score } = row;
  const ok = row.el ? row.el.ok : true;
  const di = deadlineInfo(op);
  const saved = st && st.saved.includes(op.id);
  const applied = st && !!appliedOn(st, op.id);
  return html`<button class=${cx('card', !ok && 'card-off')} onClick=${onOpen} aria-label=${`${op.title} at ${op.org}, ${ok ? score + '% match' : 'not open to you yet'}`}>
    <${OppImage} op=${op} cls="card-img" photo=${photo} />
    <span class="card-top"><${TypeLabel} t=${op.type} />${applied ? html`<span class="badge badge-ok"><${Icon} n="check" s=${13} w=${3} />Applied</span>` : saved ? html`<span class="badge"><${Icon} n="bookmark-check" s=${13} />Saved</span>` : !ok ? html`<span class="badge">Not eligible yet</span>` : null}</span>
    <span class="card-main">
      <span class="card-tx">
        <b class="card-t">${op.title}</b>
        <span class="card-o">${op.org}${op.sample ? html`<em> · Sample</em>` : null}</span>
      </span>
      <${MatchRing} v=${score} size=${46} muted=${!ok} />
    </span>
    <span class="card-tags">
      <span class=${cx('tag', di.tone === 'urgent' && 'tag-urgent')}><${Icon} n="calendar" s=${14} />${di.d ? `Closes ${fmtDate(di.d)}` : 'Open all year'}</span>
      <span class="tag"><${Icon} n=${op.local ? 'map-pin' : op.region === 'remote' ? 'wifi' : 'globe'} s=${14} />${placeOf(op)}</span>
      <span class="tag"><${Icon} n="wallet" s=${14} />${moneyOf(op)}</span>
    </span>
  </button>`;
}

function Drawer({ onClose, label, children }) {
  const panel = useRef();
  useEffect(() => {
    const prev = document.activeElement;
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    document.body.classList.add('no-scroll');
    if (panel.current) panel.current.focus();
    return () => { window.removeEventListener('keydown', k); document.body.classList.remove('no-scroll'); if (prev && prev.focus) prev.focus(); };
  }, []);
  return html`<div class="drawer-wrap">
    <div class="drawer-back" onClick=${onClose}></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label=${label} tabindex="-1" ref=${panel}>
      <button class="icon-btn drawer-x" aria-label="Close" onClick=${onClose}><${Icon} n="x" s=${20} /></button>
      ${children}
    </aside>
  </div>`;
}

function OppDetail({ op, p, st, onAsk, onApply, photo }) {
  const row = rowOf(op, p, st);
  const di = deadlineInfo(op);
  const ok = row.el.ok;
  const reasons = ok
    ? matchReasons(op, p).filter((r) => ['field', 'place', 'origin'].includes(r.k))
    : row.el.issues.map((i) => ({ ok: false, text: i.text })).concat(matchReasons(op, p).filter((r) => r.ok && ['field', 'place'].includes(r.k))).slice(0, 3);
  const reqs = op.reqs.filter((r) => reqStatus(r, op, p, st).s !== 'na');
  const ready = opReadiness(op, p, st);
  const [openReq, setOpenReq] = useState(null);
  const saved = st.saved.includes(op.id);
  const appliedDate = appliedOn(st, op.id);
  const applied = !!appliedDate;
  const facts = ticketFields(op).slice(0, 2);
  const start = startOf(op);
  const startDays = daysUntil(start);
  return html`<div class="det">
    <${OppImage} op=${op} cls="det-img" photo=${photo} />
    <${TypeLabel} t=${op.type} />
    <h2 class="det-t">${op.title}</h2>
    <p class="det-o">${op.org} · ${placeOf(op)}${op.sample ? ' · Sample listing' : ''}</p>
    ${applied ? html`<div class="applied-note"><${Icon} n="circle-check" s=${18} /><span>You applied on <b>${fmtDate(appliedDate, true)}</b>. It starts around <b>${fmtDate(start, true)}</b>.</span><button class="btn-link" onClick=${() => A.unapply(op.id)}>Undo</button></div>` : null}
    ${applied && applyWarning(op, p, st) ? html`<div class="warn"><${Icon} n="circle-alert" s=${20} /><span><b>Don’t forget</b><span>${applyWarning(op, p, st)}</span></span></div>` : null}
    <p class="det-sum">${op.summary}</p>

    <div class="facts">
      <div><span>Deadline</span><b class=${cx(di.tone === 'urgent' && 'urgent')}>${di.d ? fmtDate(di.d, true) : 'Open all year'}</b>${di.d ? html`<small>${di.days} days left${di.est ? ' · estimate' : ''}</small>` : null}</div>
      <div><span>Starts</span><b>${fmtDate(start, true)}</b><small>${startDays > 0 ? `in ${startDays} days · estimate` : 'estimate'}</small></div>
      ${facts.map(([k, v]) => html`<div><span>${k}</span><b>${v}</b></div>`)}
    </div>

    <div class="why">
      <${MatchRing} v=${row.score} size=${58} muted=${!ok} />
      <div><b>${!ok ? 'Not open to you yet' : row.score >= 80 ? 'Great match' : row.score >= 62 ? 'Good match' : 'Worth a look'}</b>
        <ul>${reasons.map((r) => html`<li class=${cx(r.ok && 'ok')}><${Icon} n=${r.ok ? 'check' : 'info'} s=${14} w=${2.6} />${r.text}</li>`)}</ul></div>
    </div>

    <section class="needs-wrap">
      <div class="needs-head"><b>What you need</b><span>${ready.met} of ${ready.n} done</span></div>
      <div class="prog"><span style=${`width:${ready.pct}%`}></span></div>
      <ul class="needs">${reqs.map((r) => html`<${NeedRow} key=${r.k + (r.t || '')} r=${r} op=${op} p=${p} st=${st} open=${openReq === r.k} onToggle=${() => setOpenReq(openReq === r.k ? null : r.k)} />`)}</ul>
    </section>

    ${onAsk ? html`<button class="ask-link" onClick=${() => onAsk(op)}><span class="ask-link-ic"><${Icon} n="compass" s=${18} /></span><span><b>Questions about this?</b><span>Ask Compass, your Waypoint guide</span></span><${Icon} n="arrow-right" s=${18} /></button>` : null}

    <div class="det-actions">
      ${!applied
        ? html`<button class="btn btn-primary btn-lg" onClick=${() => (onApply ? onApply(op) : A.markApplied(op))}><${Icon} n="send" s=${18} />Apply now</button>`
        : op.url
          ? html`<button class="btn btn-primary btn-lg" onClick=${() => onApply && onApply(op)}>Go to official site<${Icon} n="arrow-up-right" s=${18} /></button>`
          : html`<button class="btn btn-primary btn-lg" disabled><${Icon} n="check" s=${18} />Applied</button>`}
      <button class="btn btn-secondary btn-lg" aria-pressed=${String(saved)} onClick=${() => A.toggleSave(op.id)}><${Icon} n=${saved ? 'bookmark-check' : 'bookmark'} s=${18} />${saved ? 'Saved' : 'Save'}</button>
    </div>
  </div>`;
}

function NeedRow({ r, op, p, st, open, onToggle }) {
  const g = REQ[r.k] || {};
  const rs = reqStatus(r, op, p, st);
  const auto = g.kind !== 'doc' || (r.k === 'english' && rs.s === 'met' && (st.docs || {}).english !== 'ready');
  const sb = startBy(r, op);
  const label = r.t || g.label;
  const hint = rs.s === 'met' ? (auto ? rs.note : 'Done') : auto ? rs.note : sb ? `${r.k === 'interview' ? 'Expect around' : 'Start by'} ${fmtDate(sb)}` : '';
  const city = homeCity(p);
  return html`<li class=${cx('need', rs.s === 'met' && 'done', open && 'open')}>
    <button class="need-box" disabled=${auto} aria-pressed=${String(rs.s === 'met')} aria-label=${auto ? `${label}: ${rs.s === 'met' ? 'done' : 'not yet'}` : rs.s === 'met' ? `Mark ${label} as not done` : `Mark ${label} as done`}
      onClick=${() => A.setDoc(r.k, rs.s === 'met' ? null : 'ready')}>${rs.s === 'met' ? html`<${Icon} n="check" s=${14} w=${3.2} />` : null}</button>
    <button class="need-main" aria-expanded=${String(!!open)} disabled=${!g.steps} onClick=${onToggle}>
      <span class="need-tx"><b>${label}</b>${hint ? html`<small>${hint}${r.opt ? ' · optional' : ''}</small>` : null}</span>
      ${g.steps ? html`<${Icon} n="chevron-down" s=${18} c="need-chev" />` : null}
    </button>
    ${open && g.steps ? html`<div class="need-how">
      <ol>${g.steps.map((s) => html`<li>${s}</li>`)}</ol>
      ${g.local ? html`<p class="need-local"><${Icon} n="map-pin" s=${15} />${g.local.replace('{city}', city.name)}</p>` : null}
      ${typeof VAULT_KEYS !== 'undefined' && VAULT_KEYS.includes(r.k) ? html`<button class="btn btn-sm btn-secondary need-up" onClick=${() => go('documents')}><${Icon} n="upload" s=${15} />${rs.s === 'met' ? 'See it in My documents' : 'Upload it in My documents'}</button>` : null}
    </div>` : null}
  </li>`;
}

/* ---------- Toasts ---------- */
function Toasts() {
  const [, f] = useState(0);
  useEffect(() => { const h = () => f((x) => x + 1); TOASTS.subs.add(h); return () => TOASTS.subs.delete(h); }, []);
  return html`<div class="toasts" role="status" aria-live="polite">${TOASTS.list.map((t) => html`<div class="toast" key=${t.id}><${Icon} n=${t.icon} s=${18} />${t.msg}</div>`)}</div>`;
}

/* ---------- Outside-click popover ---------- */
function usePop() {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('pointerdown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  return [open, setOpen, ref];
}

/* ---------- City picker ---------- */
function CityPicker({ value, onPick, id = 'city' }) {
  const cur = cityOf(value);
  const label = (c) => `${c.name}, ${c.country}`;
  const [q, setQ] = useState(cur ? label(cur) : '');
  const [open, setOpen, ref] = usePop();
  const [act, setAct] = useState(0);
  useEffect(() => { if (cur) setQ(label(cur)); }, [value]);
  const term = q.trim().toLowerCase();
  const list = (term && !(cur && q === label(cur)) ? CITIES.filter((c) => c.name.toLowerCase().includes(term) || c.country.toLowerCase().includes(term)) : CITIES).slice(0, 60);
  const pick = (c) => { onPick(c.id); setQ(label(c)); setOpen(false); };
  return html`<div class="combo" ref=${ref}>
    <div class="input-wrap"><${Icon} n="map-pin" s=${18} />
      <input id=${id} class="input input-ic" role="combobox" aria-expanded=${String(open)} aria-controls=${id + '-list'} autocomplete="off" placeholder="Search your city" value=${q}
        onFocus=${(e) => { setOpen(true); e.target.select(); }}
        onInput=${(e) => { setQ(e.target.value); setOpen(true); setAct(0); }}
        onKeyDown=${(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setAct((a) => Math.min(list.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAct((a) => Math.max(0, a - 1)); }
          else if (e.key === 'Enter' && open && list[act]) { e.preventDefault(); pick(list[act]); }
        }} />
    </div>
    ${open && html`<div class="combo-list" id=${id + '-list'} role="listbox">
      ${list.length ? list.map((c, i) => html`<button type="button" role="option" aria-selected=${String(i === act)} class=${cx('combo-opt', i === act && 'act')} onPointerDown=${(e) => e.preventDefault()} onClick=${() => pick(c)}>
        <span><b>${c.name}</b> <span class="muted">${c.country}</span></span>
      </button>`) : html`<div class="combo-empty">No match. Try a nearby city.</div>`}
    </div>`}
  </div>`;
}
