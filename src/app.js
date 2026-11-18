/* ==========================================================================
   Waypoint · home: your matches, one tap to open
   ========================================================================== */

function UserMenu({ name }) {
  const [open, setOpen, ref] = usePop();
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { if (!open) setConfirmReset(false); }, [open]);
  return html`<div class="pop-wrap" ref=${ref}>
    <button class="avatar" aria-label="Account menu" aria-expanded=${String(open)} onClick=${() => setOpen(!open)}>${initials(name || 'You')}</button>
    ${open && html`<div class="pop menu" role="menu">
      <div class="menu-me"><b>${name}</b><span>Prototype account</span></div>
      <button role="menuitem" onClick=${() => { setOpen(false); go('check-in'); }}><${Icon} n="square-pen" s=${17} />Edit my answers</button>
      <button role="menuitem" onClick=${() => toggleTheme()}><${Icon} n=${isDark() ? 'sun' : 'moon'} s=${17} />${isDark() ? 'Light mode' : 'Dark mode'}</button>
      <button role="menuitem" onClick=${() => { setOpen(false); A.signOut(); }}><${Icon} n="log-out" s=${17} />Sign out</button>
      <button role="menuitem" class=${cx(confirmReset && 'danger')} onClick=${() => (confirmReset ? A.reset() : setConfirmReset(true))}><${Icon} n="rotate-ccw" s=${17} />${confirmReset ? 'Click again to erase' : 'Reset demo'}</button>
    </div>`}
  </div>`;
}

function NextStep({ p, st }) {
  const nb = nextBestStep(p, st);
  const [open, setOpen] = useState(false);
  if (!nb) return null;
  const g = REQ[nb.k];
  return html`<div class=${cx('next', open && 'open')}>
    <span class="next-ic"><${Icon} n="flag" s=${18} /></span>
    <span class="next-tx"><b>Next step: ${REQ_ACTION[nb.k] || g.label}</b><span>Needed for ${nb.n} of your matches</span></span>
    <button class="btn btn-sm btn-secondary" aria-expanded=${String(open)} onClick=${() => setOpen(!open)}>${open ? 'Hide' : 'How?'}</button>
    ${open ? html`<div class="next-how"><ol>${g.steps.map((s) => html`<li>${s}</li>`)}</ol>
      <button class="btn btn-sm btn-primary" onClick=${() => { A.setDoc(nb.k, 'ready'); setOpen(false); toast('Marked as done', 'circle-check'); }}><${Icon} n="check" s=${15} />I’ve done this</button></div>` : null}
  </div>`;
}

function Home() {
  const st = S.state;
  const p = st.profile;
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(12);
  const [allRec, setAllRec] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [openPhoto, setOpenPhoto] = useState(null);
  const [cpOpen, setCpOpen] = useState(false);
  const [cpAbout, setCpAbout] = useState(null);
  const [credits, setCredits] = useState(false);
  const rows = evaluate(p, st);
  const rec = rows.filter((r) => r.el.ok && r.fit);
  const apps = appliedList(st).map((a) => ({ a, op: opById(a.id, p) })).filter((x) => x.op).sort((x, y) => startOf(x.op) - startOf(y.op));
  const everything = rows.slice().sort((a, b) => (b.el.ok - a.el.ok) || (b.score - a.score));
  const count = (pred) => everything.filter(pred).length;
  const tabs = [['all', 'All', everything.length]]
    .concat(TYPE_ORDER.map((t) => [t, typeOf(t).label, count((r) => r.op.type === t)]))
    .concat([['near', 'Near you', count((r) => r.op.local)]])
    .concat(st.saved.length ? [['saved', 'Saved', st.saved.length]] : []);
  let list = tab === 'all' ? everything
    : tab === 'near' ? everything.filter((r) => r.op.local).sort((a, b) => (b.el.ok - a.el.ok) || (a.op.dist - b.op.dist))
    : tab === 'saved' ? everything.filter((r) => st.saved.includes(r.op.id))
    : everything.filter((r) => r.op.type === tab);
  const term = q.trim().toLowerCase();
  if (term) list = list.filter((r) => [r.op.title, r.op.org, r.op.city, r.op.country, typeOf(r.op.type).label, ...r.op.fields.map((f) => fieldOf(f).label)].join(' ').toLowerCase().includes(term));
  useEffect(() => setLimit(12), [tab, term]);
  const name = (st.user && st.user.name) || 'there';
  const city = homeCity(p);
  const dests = p.dest.map((x) => (x === 'home' ? 'near home' : x === 'any' ? 'anywhere' : (REGIONS.find((r) => r.id === x) || {}).short)).join(', ');
  const op = openId ? opById(openId, p) : null;
  const grid = (arr) => {
    const photos = PHOTOS.spread(arr.map((r) => r.op));
    return html`<div class="grid">${arr.map((r, i) => html`<${OppCard} key=${r.op.id} row=${r} st=${st} photo=${photos[i]} onOpen=${() => { setOpenPhoto(photos[i]); setOpenId(r.op.id); }} />`)}</div>`;
  };
  return html`<div class="home">
    <header class="top">
      <${Logo} to="home" />
      <span class="sp"></span>
      <${UserMenu} name=${name} />
    </header>
    <main class="wrap home-in" id="main">
      <div class="home-head">
        <h1 class="home-h">Hi ${firstName(name)}</h1>
        <p class="home-sub">${city.name} → ${dests} · <button class="btn-link" onClick=${() => go('check-in')}>Edit answers</button></p>
      </div>
      <${NextStep} p=${p} st=${st} />

      ${apps.length ? html`<section class="sec" aria-labelledby="apps-h">
        <div class="sec-head"><h2 id="apps-h"><${Icon} n="send" s=${19} />My applications</h2><span>${apps.length} sent</span></div>
        <ul class="apps">${apps.map(({ a, op: o }) => { const s0 = startOf(o); const n = daysUntil(s0); return html`<li key=${o.id}><button class="app" onClick=${() => { setOpenPhoto(null); setOpenId(o.id); }} aria-label=${`${o.title}, starts ${fmtDate(s0, true)}`}>
          <${OppImage} op=${o} cls="app-img" />
          <span class="app-main"><${TypeLabel} t=${o.type} /><b>${o.title}</b><span>${o.org} · ${placeOf(o)}</span></span>
          <span class="app-dates">
            <span><small>Applied</small><b>${fmtDate(new Date(a.date))}</b></span>
            <span><small>Starts</small><b>${fmtDate(s0, true)}</b><em>${n > 0 ? `in ${n} days` : 'started'}</em></span>
          </span>
          <span class="app-info"><span class="tag"><${Icon} n="hourglass" s=${14} />${o.duration}</span><span class="tag"><${Icon} n="wallet" s=${14} />${moneyOf(o)}</span></span>
        </button></li>`; })}</ul>
      </section>` : null}

      <section class="sec sec-rec" aria-labelledby="rec-h">
        <div class="sec-head"><h2 id="rec-h"><${Icon} n="sparkles" s=${20} />Recommended for you</h2><span>${rec.length} based on your answers</span></div>
        ${rec.length ? grid(allRec ? rec : rec.slice(0, 4)) : html`<p class="sec-empty">No strong matches yet. Browse everything below, or edit your answers to widen your search.</p>`}
        ${rec.length > 4 ? html`<button class="btn btn-secondary center-btn" onClick=${() => setAllRec(!allRec)}>${allRec ? 'Show fewer' : `Show all ${rec.length} recommended`}</button>` : null}
      </section>

      <section class="sec" aria-labelledby="all-h">
        <div class="sec-head"><h2 id="all-h">All opportunities</h2><span>${everything.length} open to browse</span></div>
        <div class="browse">
          <div class="tabs" role="tablist" aria-label="Filter by type">
            ${tabs.map(([id, l, n]) => html`<button role="tab" aria-selected=${String(tab === id)} class=${cx('tab', tab === id && 'on')} onClick=${() => setTab(id)}>${l}<span>${n}</span></button>`)}
          </div>
          <label class="search"><${Icon} n="search" s=${17} /><input type="search" placeholder="Search" aria-label="Search all opportunities" value=${q} onInput=${(e) => setQ(e.target.value)} /></label>
        </div>
        ${list.length ? grid(list.slice(0, limit)) : html`<p class="sec-empty">${tab === 'saved' ? 'Nothing saved yet. Open any card and tap Save.' : 'Nothing matches that search.'}</p>`}
        ${list.length > limit ? html`<button class="btn btn-secondary center-btn" onClick=${() => setLimit(limit + 12)}>Show more (${list.length - limit} left)</button>` : null}
      </section>
    </main>
    <footer class="foot wrap home-foot"><p>Waypoint prototype · <button class="btn-link" onClick=${() => setCredits(true)}>Photo credits</button></p></footer>
    ${credits ? html`<${Credits} onClose=${() => setCredits(false)} />` : null}
    ${op ? html`<${Drawer} label=${op.title} onClose=${() => setOpenId(null)}><${OppDetail} key=${op.id} op=${op} p=${p} st=${st} photo=${openPhoto} onAsk=${(o) => { setOpenId(null); setCpAbout(o); setCpOpen(true); }} /></${Drawer}>` : null}
    <${Compass} p=${p} st=${st} open=${cpOpen} setOpen=${setCpOpen} about=${cpAbout} setAbout=${setCpAbout} />
  </div>`;
}

/* ---------- Root ---------- */
function Redirect({ to }) {
  useEffect(() => { location.replace('#' + to); }, [to]);
  return null;
}
function Root() {
  const st = useStore();
  const [route, setRoute] = useState(parseRoute());
  useEffect(() => {
    const h = () => { setRoute(parseRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  useEffect(() => { applyTheme(st.theme); }, [st.theme]);
  let r = route === 'welcome' ? 'check-in' : route;
  if (!['', 'top', 'login', 'signup', 'check-in', 'home'].includes(r)) r = 'home';
  let view;
  if ((r === 'home' || r === 'check-in') && !st.user) view = html`<${Redirect} to="signup" />`;
  else if (r === 'home' && !st.profile) view = html`<${Redirect} to="check-in" />`;
  else if (r === '' || r === 'top') view = html`<${Landing} />`;
  else if (r === 'login' || r === 'signup') view = html`<${Auth} mode=${r} />`;
  else if (r === 'check-in') view = html`<${CheckIn} />`;
  else view = html`<${Home} />`;
  return html`${view}<${Toasts} />`;
}

applyTheme(S.state.theme);
render(html`<${Root} />`, document.getElementById('app'));
