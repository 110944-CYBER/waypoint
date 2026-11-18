/* ==========================================================================
   Waypoint · My documents and one-tap apply.
   Students add their details and documents once; every application reuses
   them, so there are no forms to fill. Files stay in this browser
   (IndexedDB); nothing is uploaded to a server.
   ========================================================================== */

// Documents a student can keep ready, most asked-for first.
const VAULT_KEYS = ['cv', 'statement', 'transcript', 'refs', 'english', 'passport', 'consent', 'schoolletter', 'portfolio', 'leadership', 'research', 'gre', 'health', 'video', 'need'];
const VAULT_MAIN = 6; // shown before "More documents"
const MAX_FILE = 15 * 1024 * 1024;

const vault = {
  _db: null,
  open() {
    if (!this._db) {
      this._db = new Promise((res, rej) => {
        try {
          const r = indexedDB.open('waypoint-vault', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('files');
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        } catch (e) { rej(e); }
      });
    }
    return this._db;
  },
  async run(mode, fn) {
    try {
      const db = await this.open();
      return await new Promise((res, rej) => {
        const tx = db.transaction('files', mode);
        const out = fn(tx.objectStore('files'));
        tx.oncomplete = () => res(out && 'result' in out ? out.result : true);
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) { return null; }
  },
  put(k, file) { return this.run('readwrite', (s) => s.put(file, k)); },
  get(k) { return this.run('readonly', (s) => s.get(k)); },
  del(k) { return this.run('readwrite', (s) => s.delete(k)); },
  clear() { return this.run('readwrite', (s) => s.clear()); },
};

const fileSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/* Documents this listing asks for that can be kept in My documents, with their state. */
function applyItems(op, p, st) {
  return op.reqs
    .filter((r) => VAULT_KEYS.includes(r.k) && reqStatus(r, op, p, st).s !== 'na')
    .map((r) => ({ k: r.k, label: r.t || REQ[r.k].label, opt: !!r.opt, ready: reqStatus(r, op, p, st).s === 'met', file: (st.files || {})[r.k] }));
}
/* The date to have everything in by: the deadline, or the start date when there is no future deadline. */
function dueDate(op) {
  const di = deadlineInfo(op);
  return di.d && daysUntil(di.d) >= 0 ? di.d : startOf(op);
}
const listOf = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
// Lower-case a label for use mid-sentence, keeping acronyms (CV) and proper nouns (English) intact.
const lc = (t) => (t.length > 1 && t[1] === t[1].toLowerCase() ? t[0].toLowerCase() + t.slice(1) : t);
/* A plain warning for an application that still needs something, or null when it's complete. */
function applyWarning(op, p, st) {
  const missing = applyItems(op, p, st).filter((i) => !i.ready && !i.opt).map((i) => lc(i.label));
  const due = fmtDate(dueDate(op), true);
  if (missing.length) return `Submit your ${listOf(missing)} before ${due}, or this application won’t be complete.`;
  if (op.url) return `Finish on ${op.org}’s website before ${due}.`;
  return null;
}

/* ---------- The header tabs ---------- */
function TopNav({ active }) {
  const tab = (id, label, icon) => html`<a class=${cx('topnav-a', active === id && 'on')} href=${'#' + id} aria-label=${label} title=${label} aria-current=${active === id ? 'page' : null}
    onClick=${(e) => { e.preventDefault(); go(id); }}><${Icon} n=${icon} s=${17} /><span>${label}</span></a>`;
  return html`<nav class="topnav" aria-label="Sections">${tab('home', 'Matches', 'sparkles')}${tab('documents', 'My documents', 'folder-open')}</nav>`;
}

/* ---------- Apply with saved info ---------- */
function ApplySheet({ op, p, st, onClose }) {
  const [sent, setSent] = useState(!!appliedOn(st, op.id));
  const ref = useRef();
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', k, true);
    if (ref.current) ref.current.focus();
    return () => window.removeEventListener('keydown', k, true);
  }, []);
  const items = applyItems(op, p, st);
  const missing = items.filter((i) => !i.ready && !i.opt);
  const u = st.user || {};
  const d = st.details || {};
  const due = fmtDate(dueDate(op), true);
  const toDocs = () => { onClose(); go('documents'); };
  const apply = () => { A.markApplied(op); setSent(true); };
  const redirect = () => { try { window.open(op.url, '_blank', 'noopener'); } catch (e) { /* blocked */ } onClose(); };
  return html`<div class="pro-wrap">
    <div class="pro-back" onClick=${onClose}></div>
    <div class="pro-sheet apply" role="dialog" aria-modal="true" aria-label=${`Apply to ${op.title}`} tabindex="-1" ref=${ref}>
      <button class="icon-btn pro-x" aria-label="Close" onClick=${onClose}><${Icon} n="x" s=${20} /></button>
      ${!sent ? html`
        <span class="pro-badge apply-badge"><${Icon} n="send" s=${14} />One-tap apply</span>
        <h2 class="pro-h">Apply to ${op.title}</h2>
        <p class="pro-sub">${op.org} · Closes ${due}. We use your saved info, so there are no forms to fill.</p>
        <ul class="apply-list">
          <li class="ok"><${Icon} n="circle-check" s=${18} /><span><b>Your details</b><span>${[u.name, u.email, d.phone, d.school].filter(Boolean).join(' · ')}</span></span></li>
          ${items.map((i) => html`<li class=${i.ready ? 'ok' : i.opt ? 'opt' : 'miss'}>
            <${Icon} n=${i.ready ? 'circle-check' : 'circle-alert'} s=${18} />
            <span><b>${i.label}</b><span>${i.ready ? (i.file ? `${i.file.name} · ${fileSize(i.file.size)}` : 'Ready') : i.opt ? 'Optional' : 'Missing'}</span></span>
          </li>`)}
        </ul>
        ${missing.length ? html`<div class="warn" role="alert"><${Icon} n="circle-alert" s=${20} />
          <span><b>Submit your info before ${due}</b><span>${listOf(missing.map((i) => i.label))} ${missing.length > 1 ? 'are' : 'is'} still missing. You can apply now and add ${missing.length > 1 ? 'them' : 'it'} later.</span>
          <button class="btn-link" onClick=${toDocs}>Add in My documents</button></span>
        </div>` : null}
        <button class="btn btn-primary btn-lg btn-block" onClick=${apply}><${Icon} n="send" s=${18} />Apply with my saved info</button>` : html`
        <span class="apply-done"><${Icon} n="circle-check" s=${30} /></span>
        <h2 class="pro-h">You applied to ${op.title}</h2>
        ${op.url ? html`
          <p class="pro-sub">${op.org} takes final submissions on its own website. Would you like to be redirected there now?</p>
          ${missing.length ? html`<div class="warn"><${Icon} n="circle-alert" s=${20} /><span><b>Before ${due}</b><span>Add your ${listOf(missing.map((i) => lc(i.label)))} too.</span></span></div>` : null}
          <button class="btn btn-primary btn-lg btn-block" onClick=${redirect}>Yes, take me to ${op.org}<${Icon} n="arrow-up-right" s=${18} /></button>
          <button class="btn btn-ghost btn-block" onClick=${onClose}>No, stay on Waypoint</button>` : html`
          <p class="pro-sub">Your saved info was sent. You’ll find it in My applications, with its start date.</p>
          ${missing.length ? html`<div class="warn"><${Icon} n="circle-alert" s=${20} /><span><b>Submit your info before ${due}</b><span>Add your ${listOf(missing.map((i) => lc(i.label)))} in My documents.</span><button class="btn-link" onClick=${toDocs}>Add in My documents</button></span></div>` : null}
          <button class="btn btn-primary btn-lg btn-block" onClick=${onClose}>Done</button>`}`}
    </div>
  </div>`;
}

/* ---------- My documents page ---------- */
function DocRow({ k, st, need }) {
  const g = REQ[k];
  const file = (st.files || {})[k];
  const ready = (st.docs || {})[k] === 'ready';
  const inRef = useRef();
  const pick = () => inRef.current && inRef.current.click();
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_FILE) { toast('Please choose a file under 15 MB', 'info'); return; }
    const stored = await vault.put(k, f);
    A.addDoc(k, { name: f.name, size: f.size, type: f.type, date: new Date().toISOString(), stored: !!stored });
  };
  const view = async () => {
    const blob = await vault.get(k);
    if (!blob) { toast('This file isn’t saved in this browser', 'info'); return; }
    try { const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    catch (err) { toast('Can’t open the file here', 'info'); }
  };
  return html`<li class=${cx('doc', ready && 'ok')}>
    <span class="doc-ic"><${Icon} n=${ready ? 'file-check' : g.icon || 'file-text'} s=${20} /></span>
    <span class="doc-main"><b>${g.label}</b>
      <span>${file ? `${file.name} · ${fileSize(file.size)} · added ${fmtDate(new Date(file.date))}` : ready ? 'Marked as ready' : need ? `Needed for ${need} of your matches` : 'Not added yet'}</span></span>
    <span class="doc-acts">
      ${file && file.stored ? html`<button class="btn btn-sm btn-ghost" onClick=${view}>View</button>` : null}
      <button class=${cx('btn btn-sm', ready ? 'btn-secondary' : 'btn-primary')} onClick=${pick}><${Icon} n=${ready ? 'refresh-cw' : 'upload'} s=${15} />${ready ? 'Replace' : 'Upload'}</button>
      ${ready ? html`<button class="icon-btn doc-x" aria-label=${`Remove ${g.label}`} onClick=${() => A.removeDoc(k)}><${Icon} n="trash-2" s=${17} /></button>` : null}
    </span>
    <input ref=${inRef} type="file" hidden accept=".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg,.heic" onChange=${onFile} />
  </li>`;
}

function Documents() {
  const st = S.state;
  const p = st.profile;
  const u = st.user || {};
  const d = st.details || {};
  const [more, setMore] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const name = u.name || 'there';
  const ms = matches(p, st);
  const needCount = (k) => ms.filter(({ op }) => op.reqs.some((r) => r.k === k && reqStatus(r, op, p, st).s !== 'na')).length;
  const keys = VAULT_KEYS.filter((k) => REQ[k] && !(REQ[k].minorOnly && p.age >= 18)).map((k) => ({ k, need: needCount(k) }));
  const main = keys.slice(0, VAULT_MAIN);
  const rest = keys.slice(VAULT_MAIN).sort((a, b) => b.need - a.need);
  const readyN = keys.filter(({ k }) => (st.docs || {})[k] === 'ready').length;
  const field = (id, label, value, onSet, type = 'text', ph = '') => html`<div class="field"><label for=${id}>${label}</label>
    <input id=${id} class="input" type=${type} placeholder=${ph} value=${value || ''} onChange=${(e) => onSet(e.target.value.trim())} /></div>`;
  return html`<div class="home">
    <header class="top">
      <${Logo} to="home" />
      <${TopNav} active="documents" />
      <span class="sp"></span>
      <button class=${cx('pro-pill', st.pro && 'on')} onClick=${() => setProOpen(true)}><${Icon} n="sparkles" s=${14} /><span class="pro-pill-tx">${st.pro ? 'Pro' : 'Get Pro'}</span></button>
      <${UserMenu} name=${name} pro=${!!st.pro} onPro=${() => setProOpen(true)} />
    </header>
    <main class="wrap home-in docs-in" id="main">
      <div class="home-head">
        <h1 class="home-h">My documents</h1>
        <p class="home-sub">Add them once. Every application uses them, so you never fill the same form twice.</p>
      </div>
      <div class="docs-meter"><b>${readyN} of ${keys.length}</b><span>documents ready</span><div class="prog"><span style=${`width:${Math.round((readyN / keys.length) * 100)}%`}></span></div></div>

      <section class="sec" aria-labelledby="det-h">
        <div class="sec-head"><h2 id="det-h"><${Icon} n="user-round" s=${19} />Your details</h2><span>Used on every application</span></div>
        <div class="docs-form">
          ${field('d-name', 'Full name', u.name, (v) => v && A.setUser({ name: v }))}
          ${field('d-email', 'Email', u.email, (v) => v && A.setUser({ email: v }), 'email')}
          ${field('d-phone', 'Phone', d.phone, (v) => A.setDetails({ phone: v }), 'tel', '+973 3000 0000')}
          ${field('d-school', 'School or university', d.school, (v) => A.setDetails({ school: v }), 'text', 'Your school')}
          ${field('d-grades', 'Grades or GPA', d.grades, (v) => A.setDetails({ grades: v }), 'text', 'e.g. 3.8 / 4.0')}
          ${field('d-nat', 'Nationality', d.nationality, (v) => A.setDetails({ nationality: v }), 'text', homeCity(p).country)}
        </div>
      </section>

      <section class="sec" aria-labelledby="docs-h">
        <div class="sec-head"><h2 id="docs-h"><${Icon} n="folder-open" s=${19} />Documents</h2><span>PDF, Word or photos, up to 15 MB</span></div>
        <ul class="docs">${main.map(({ k, need }) => html`<${DocRow} key=${k} k=${k} st=${st} need=${need} />`)}</ul>
        ${rest.length ? html`<button class="btn btn-secondary center-btn" aria-expanded=${String(more)} onClick=${() => setMore(!more)}>${more ? 'Show fewer' : `More documents (${rest.length})`}</button>` : null}
        ${more ? html`<ul class="docs">${rest.map(({ k, need }) => html`<${DocRow} key=${k} k=${k} st=${st} need=${need} />`)}</ul>` : null}
      </section>
      <p class="fine docs-fine"><${Icon} n="lock" s=${14} />Saved only in this browser. Nothing is uploaded to a server in this prototype.</p>
    </main>
    ${proOpen ? html`<${ProSheet} onClose=${() => setProOpen(false)} />` : null}
  </div>`;
}
