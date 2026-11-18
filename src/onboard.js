/* ==========================================================================
   Waypoint · sign in and the five questions
   ========================================================================== */

const DEMO_PROFILE = { age: 20, stage: 'ug', types: ['internship', 'scholarship', 'shadowing'], fields: ['cs', 'biz'], city: 'riyadh', dest: ['home', 'uk', 'eu'] };
const DEMO_DOCS = { transcript: 'ready', passport: 'ready', cv: 'progress', statement: 'progress' };
const TAGLINE = { internship: 'Paid work experience', scholarship: 'Funding for your studies', shadowing: 'Spend a day with a professional', postgrad: "Master's and PhD programs" };

// The demo account gives a name, then answers the five questions like any new account.
function startDemo() {
  if (typeof vault !== 'undefined') vault.clear();
  S.set({ user: { name: '', email: 'demo@example.com' }, profile: null, docs: {}, files: {}, details: {}, saved: [], dismissed: [], applied: [], pro: null });
  go('check-in');
}

/* ---------- Sign up / log in ---------- */
function Auth({ mode }) {
  const [tab, setTab] = useState(mode === 'login' ? 'login' : 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setTab(mode === 'login' ? 'login' : 'signup'); setErr(''); }, [mode]);
  const submit = (e) => {
    e.preventDefault();
    if (tab === 'signup' && !name.trim()) { setErr('Please add your name.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr('Enter an email address, for example you@school.edu.'); return; }
    if (pw.length < 6) { setErr('Use at least 6 characters for your password.'); return; }
    const prev = S.state.user;
    const guess = email.trim().split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim().replace(/\b\w/g, (m) => m.toUpperCase());
    if (tab === 'signup') S.set({ user: { name: name.trim(), email: email.trim() }, profile: null, saved: [], applied: [], docs: {} });
    else S.set({ user: { name: prev && prev.email === email.trim() ? prev.name : guess || 'Explorer', email: email.trim() } });
    go(tab === 'login' && S.state.profile ? 'home' : 'check-in');
  };
  const swap = () => { setTab(tab === 'signup' ? 'login' : 'signup'); setErr(''); };
  return html`<div class="auth">
    <header class="top"><${Logo} /><span class="sp"></span><button class="btn btn-ghost btn-sm" onClick=${() => go('')}><${Icon} n="arrow-left" s=${16} />Back</button></header>
    <main class="auth-main">
      <form class="auth-card" onSubmit=${submit} novalidate>
        <h1 class="auth-h">${tab === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
        <p class="auth-p">${tab === 'signup' ? 'Then answer five quick questions.' : 'Log in to see your matches.'}</p>
        ${tab === 'signup' ? html`<div class="field"><label for="au-name">Full name</label><input id="au-name" class="input" autocomplete="name" value=${name} onInput=${(e) => setName(e.target.value)} /></div>` : null}
        <div class="field"><label for="au-email">Email</label><input id="au-email" class="input" type="email" autocomplete="email" placeholder="you@school.edu" value=${email} onInput=${(e) => setEmail(e.target.value)} /></div>
        <div class="field"><label for="au-pw">Password</label>
          <div class="input-wrap input-wrap-r"><input id="au-pw" class="input" type=${show ? 'text' : 'password'} autocomplete=${tab === 'signup' ? 'new-password' : 'current-password'} placeholder="At least 6 characters" value=${pw} onInput=${(e) => setPw(e.target.value)} />
            <button type="button" class="pw-eye" aria-label=${show ? 'Hide password' : 'Show password'} onClick=${() => setShow(!show)}><${Icon} n=${show ? 'eye-off' : 'eye'} s=${18} /></button></div>
        </div>
        ${err ? html`<p class="form-err" role="alert">${err}</p>` : null}
        <button class="btn btn-primary btn-lg btn-block" type="submit">Continue</button>
        <p class="auth-alt">${tab === 'signup' ? 'Have an account?' : 'New here?'} <button type="button" class="btn-link" onClick=${swap}>${tab === 'signup' ? 'Log in' : 'Create one'}</button></p>
        <div class="or"><span>or</span></div>
        <button type="button" class="btn btn-secondary btn-lg btn-block" onClick=${() => startDemo()}>Try the demo</button>
        <p class="fine"><${Icon} n="lock" s=${14} />Prototype. Nothing you type leaves this browser.</p>
      </form>
    </main>
  </div>`;
}

/* ---------- The demo starts with a name ---------- */
function NameStep() {
  const [name, setName] = useState('');
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  const clean = name.trim().replace(/\s+/g, ' ');
  const submit = (e) => { e.preventDefault(); if (clean) A.setUser({ name: clean }); };
  return html`<form class="ci" onSubmit=${submit} novalidate>
    <header class="top"><${Logo} /><span class="sp"></span></header>
    <main class="ci-main wrap">
      <h1 class="ci-h">First, what’s your name?</h1>
      <p class="ci-note ci-intro">Then five quick questions.</p>
      <input ref=${ref} id="ci-name" class="input ci-name" autocomplete="given-name" autocapitalize="words" maxlength="40" placeholder="Your name" aria-label="Your name" value=${name} onInput=${(e) => setName(e.target.value)} />
    </main>
    <footer class="ci-foot">
      <button type="button" class="btn btn-ghost" onClick=${() => { S.set({ user: null }); go(''); }}><${Icon} n="arrow-left" s=${18} />Back</button>
      <button type="submit" class="btn btn-primary btn-lg" disabled=${!clean}>Continue</button>
    </footer>
  </form>`;
}

/* ---------- The five questions ---------- */
function CheckIn() {
  return S.state.user && !S.state.user.name ? html`<${NameStep} />` : html`<${Questions} />`;
}
function Questions() {
  const st = S.state;
  const prev = st.profile;
  const [step, setStep] = useState(0);
  const [d, setD] = useState(() => (prev ? Object.assign({}, prev) : { age: 20, stage: null, types: [], fields: [], city: null, dest: [] }));
  const [ageSet, setAgeSet] = useState(!!prev);
  const set = (patch) => setD((x) => Object.assign({}, x, patch));
  const valid = [true, !!d.stage, d.types.length > 0, d.fields.length > 0, !!d.city && d.dest.length > 0];
  const live = liveMatches({ age: ageSet || step > 0 ? d.age : null, stage: d.stage, types: d.types, fields: d.fields, city: d.city, dest: d.dest });
  const finish = () => { S.set({ profile: { age: d.age, stage: d.stage, types: d.types, fields: d.fields, city: d.city, dest: d.dest } }); go('home'); };
  const next = () => { if (!valid[step]) return; if (step === 0) setAgeSet(true); if (step < 4) setStep(step + 1); else finish(); };
  const first = !prev;
  const back = () => (step > 0 ? setStep(step - 1) : go('home'));
  const toggleIn = (key, id, max) => {
    if (max && !d[key].includes(id) && d[key].length >= max) { toast(`Pick up to ${max}.`, 'info'); return; }
    setD((x) => {
      const cur = x[key];
      if (cur.includes(id)) return Object.assign({}, x, { [key]: cur.filter((v) => v !== id) });
      if (max && cur.length >= max) return x;
      return Object.assign({}, x, { [key]: cur.concat(id) });
    });
  };
  const pickStage = (id) => { set({ stage: id }); setTimeout(() => setStep((s) => (s === 1 ? 2 : s)), reducedMotion() ? 0 : 240); };
  const toggleDest = (id) => setD((x) => {
    if (id === 'any') return Object.assign({}, x, { dest: x.dest.includes('any') ? [] : ['any'] });
    const base = x.dest.filter((v) => v !== 'any');
    return Object.assign({}, x, { dest: base.includes(id) ? base.filter((v) => v !== id) : base.concat(id) });
  });
  useEffect(() => {
    const k = (e) => { if (e.key === 'Enter' && !e.target.closest('input, textarea, button, .combo')) next(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  return html`<div class="ci">
    <header class="top">
      <${Logo} to=${first ? null : 'home'} />
      <div class="ci-prog" aria-label=${`Question ${step + 1} of 5`}><div class="prog"><span style=${`width:${((step + 1) / 5) * 100}%`}></span></div><span>${step + 1} of 5</span></div>
      ${first ? html`<span class="ci-req">Required</span>` : html`<button class="icon-btn" aria-label="Cancel and keep my answers" onClick=${() => go('home')}><${Icon} n="x" s=${20} /></button>`}
    </header>

    <main class="ci-main wrap" key=${step}>
      ${step === 0 && html`
        <h1 class="ci-h">How old are you?</h1>
        ${first ? html`<p class="ci-note ci-intro">Answer all five to see your matches.</p>` : null}
        <div class="age">
          <button type="button" class="round-btn" aria-label="Younger" onClick=${() => { setAgeSet(true); set({ age: Math.max(13, d.age - 1) }); }}><${Icon} n="minus" s=${22} /></button>
          <output class="age-num" for="ci-age" aria-live="polite">${d.age}${d.age >= 40 ? '+' : ''}</output>
          <button type="button" class="round-btn" aria-label="Older" onClick=${() => { setAgeSet(true); set({ age: Math.min(40, d.age + 1) }); }}><${Icon} n="plus" s=${22} /></button>
        </div>
        <input id="ci-age" class="slider" type="range" min="13" max="40" step="1" value=${d.age} aria-label="Age" onInput=${(e) => { setAgeSet(true); set({ age: +e.target.value }); }} style=${`--p:${((d.age - 13) / 27) * 100}%`} />`}

      ${step === 1 && html`
        <h1 class="ci-h">Where are you right now?</h1>
        <div class="opts">${STAGES.map((s) => html`<button type="button" class=${cx('opt', d.stage === s.id && 'on')} aria-pressed=${String(d.stage === s.id)} onClick=${() => pickStage(s.id)}>
          <span class="opt-ic"><${Icon} n=${s.icon} s=${22} /></span><span class="opt-tx"><b>${s.label}</b><span>${s.sub}</span></span>
        </button>`)}</div>`}

      ${step === 2 && html`
        <h1 class="ci-h">What are you looking for?</h1>
        <div class="opts opts-2">${TYPE_ORDER.map((id) => { const on = d.types.includes(id); return html`<button type="button" class=${cx('opt', on && 'on')} data-t=${id} aria-pressed=${String(on)} onClick=${() => toggleIn('types', id)}>
          <span class="opt-ic"><${Icon} n=${typeOf(id).icon} s=${22} /></span><span class="opt-tx"><b>${typeOf(id).label}</b><span>${TAGLINE[id]}</span></span>
          <span class="tick">${on ? html`<${Icon} n="check" s=${14} w=${3} />` : null}</span>
        </button>`; })}</div>
        <p class="ci-note">Choose as many as you like.</p>`}

      ${step === 3 && html`
        <h1 class="ci-h">What interests you?</h1>
        <div class="pills">${FIELDS.map((f) => html`<button type="button" class=${cx('pill', d.fields.includes(f.id) && 'on')} aria-pressed=${String(d.fields.includes(f.id))} onClick=${() => toggleIn('fields', f.id, 3)}>${f.label}</button>`)}</div>
        <p class="ci-note">Up to three.</p>`}

      ${step === 4 && html`
        <h1 class="ci-h">Where do you live, and where would you go?</h1>
        <div class="field"><label for="ci-city">Your city</label><${CityPicker} id="ci-city" value=${d.city} onPick=${(id) => set({ city: id })} /></div>
        <div class="pills pills-sm">${POPULAR_CITIES.map((id) => html`<button type="button" class=${cx('pill', d.city === id && 'on')} aria-pressed=${String(d.city === id)} onClick=${() => set({ city: id })}>${cityOf(id).name}</button>`)}</div>
        <div class="field"><span class="label">Where you’d go</span>
          <div class="pills">
            <button type="button" class=${cx('pill', d.dest.includes('home') && 'on')} aria-pressed=${String(d.dest.includes('home'))} onClick=${() => toggleDest('home')}>Near home</button>
            ${REGIONS.map((r) => html`<button type="button" class=${cx('pill', d.dest.includes(r.id) && 'on')} aria-pressed=${String(d.dest.includes(r.id))} onClick=${() => toggleDest(r.id)}>${r.short}</button>`)}
            <button type="button" class=${cx('pill', d.dest.includes('any') && 'on')} aria-pressed=${String(d.dest.includes('any'))} onClick=${() => toggleDest('any')}>Anywhere</button>
          </div>
        </div>`}
    </main>

    <footer class="ci-foot">
      ${step === 0 && first ? html`<span></span>` : html`<button type="button" class="btn btn-ghost" onClick=${back}><${Icon} n="arrow-left" s=${18} />${step === 0 ? 'Cancel' : 'Back'}</button>`}
      <span class="ci-live"><b>${live.length}</b> matches so far</span>
      <button type="button" class="btn btn-primary btn-lg" disabled=${!valid[step]} onClick=${next}>${step === 4 ? 'See my matches' : 'Continue'}</button>
    </footer>
  </div>`;
}
