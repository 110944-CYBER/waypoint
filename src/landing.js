/* ==========================================================================
   Waypoint · landing page: one headline, one action, one preview
   ========================================================================== */

function startJourney() {
  const st = S.state;
  go(st.user ? (st.profile ? 'home' : 'check-in') : 'signup');
}

function previewRows() {
  const st = { docs: DEMO_DOCS, saved: [], applied: [] };
  const rows = evaluate(DEMO_PROFILE, st).filter((r) => r.el.ok && r.fit);
  const pick = (t, pred) => rows.find((r) => r.op.type === t && (!pred || pred(r.op)));
  return [pick('internship', (o) => !o.sample), pick('internship', (o) => o.sample && !o.local), pick('scholarship', (o) => !o.sample)].filter(Boolean);
}

function Landing() {
  const st = S.state;
  const signedIn = !!(st.user && st.profile);
  const rows = useMemo(previewRows, []);
  const [credits, setCredits] = useState(false);
  return html`<div class="landing">
    <header class="top">
      <${Logo} />
      <span class="sp"></span>
      <button class="btn btn-ghost btn-sm" onClick=${() => go(signedIn ? 'home' : 'login')}>${signedIn ? 'My matches' : 'Log in'}</button>
      <button class="btn btn-primary btn-sm" onClick=${startJourney}>Get started</button>
    </header>

    <main>
      <section class="hero wrap">
        <div class="hero-copy">
          <h1 class="hero-h">Find internships that fit you.</h1>
          <p class="hero-sub">Answer five questions. See your best matches, and exactly what each one needs.</p>
          <div class="hero-ctas">
            <button class="btn btn-primary btn-lg" onClick=${startJourney}>Get started<${Icon} n="arrow-right" s=${18} c="ic-arrow" /></button>
            <button class="btn btn-link" onClick=${() => startDemo()}>Try the demo</button>
          </div>
          <p class="hero-also">Also scholarships, job shadowing and postgraduate programs, near you and abroad.</p>
        </div>
        <div class="hero-vis" aria-hidden="true">
          ${rows.map((r, i) => html`<div class=${'stack stack-' + i}><${OppCard} row=${r} onOpen=${() => {}} /></div>`)}
        </div>
      </section>

      <section class="how wrap" aria-label="How it works">
        <ol class="steps">
          <li><span class="step-ic"><${Icon} n="list-checks" s=${22} /></span><b>Answer 5 questions</b><span>Takes about a minute</span></li>
          <li><span class="step-ic"><${Icon} n="target" s=${22} /></span><b>See your matches</b><span>Ranked for you, near and far</span></li>
          <li><span class="step-ic"><${Icon} n="circle-check" s=${22} /></span><b>Apply with a checklist</b><span>Know exactly what’s needed</span></li>
        </ol>
      </section>
    </main>

    <footer class="foot wrap">
      <p>Waypoint prototype. Program dates are estimates; local listings are samples. <button class="btn-link" onClick=${() => setCredits(true)}>Photo credits</button></p>
    </footer>
    ${credits ? html`<${Credits} onClose=${() => setCredits(false)} />` : null}
  </div>`;
}
