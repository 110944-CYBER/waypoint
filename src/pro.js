/* ==========================================================================
   Waypoint · Pro: the paid plan. Free keeps every match, checklist and
   deadline; Pro adds Compass, the AI guide that plans with you.
   Prototype: starting Pro takes no payment.
   ========================================================================== */

const PRO_PLANS = {
  monthly: { label: 'Monthly', price: '$4.99', per: 'a month', note: '' },
  yearly: { label: 'Yearly', price: '$39', per: 'a year', note: 'Save 35%' },
};
const PRO_FEATURES = [
  ['compass', 'Compass, your AI guide', 'Answers any question about studies, admissions and careers.'],
  ['route', 'Your personal plan', 'Any goal turned into clear steps, with timing.'],
  ['file-user', 'CV tailoring', 'Shape your CV for each opportunity.'],
  ['circle-check', 'Eligibility checks', 'Know if you qualify before you apply.'],
  ['calendar-clock', 'A weekly plan', 'What to do this week, every week.'],
];

function ProSheet({ onClose, onStarted }) {
  const cur = S.state.pro;
  const [plan, setPlan] = useState((cur && cur.plan) || 'yearly');
  const ref = useRef();
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    document.body.classList.add('no-scroll');
    if (ref.current) ref.current.focus();
    return () => { window.removeEventListener('keydown', k); document.body.classList.remove('no-scroll'); };
  }, []);
  return html`<div class="pro-wrap">
    <div class="pro-back" onClick=${onClose}></div>
    <div class="pro-sheet" role="dialog" aria-modal="true" aria-label="Waypoint Pro" tabindex="-1" ref=${ref}>
      <button class="icon-btn pro-x" aria-label="Close" onClick=${onClose}><${Icon} n="x" s=${20} /></button>
      <span class="pro-badge"><${Icon} n="sparkles" s=${14} />Waypoint Pro</span>
      <h2 class="pro-h">${cur ? 'You’re on Waypoint Pro' : 'Your personal plan, built by AI'}</h2>
      <p class="pro-sub">${cur
        ? `${PRO_PLANS[cur.plan].label} plan, ${PRO_PLANS[cur.plan].price} ${PRO_PLANS[cur.plan].per}. Started ${fmtDate(new Date(cur.since), true)}.`
        : 'Everything in Free, plus Compass: an AI guide that plans every step with you.'}</p>
      <ul class="pro-feats">${PRO_FEATURES.map(([ic, t, d]) => html`<li>
        <span class="pro-ic"><${Icon} n=${ic} s=${18} /></span><span><b>${t}</b><span>${d}</span></span>
      </li>`)}</ul>
      ${cur ? html`
        <button class="btn btn-primary btn-lg btn-block" onClick=${onClose}>Keep using Pro</button>
        <button class="btn btn-ghost btn-block" onClick=${() => { A.cancelPro(); onClose(); }}>Cancel Pro</button>` : html`
        <div class="pro-plans" role="radiogroup" aria-label="Choose a plan">${Object.entries(PRO_PLANS).map(([id, pl]) => html`<button type="button" role="radio" aria-checked=${String(plan === id)} class=${cx('pro-plan', plan === id && 'on')} onClick=${() => setPlan(id)}>
          <span class="pro-plan-l">${pl.label}${pl.note ? html`<em>${pl.note}</em>` : null}</span>
          <span class="pro-plan-p"><b>${pl.price}</b> ${pl.per}</span>
        </button>`)}</div>
        <button class="btn btn-primary btn-lg btn-block" onClick=${() => { A.startPro(plan); if (onStarted) onStarted(); else onClose(); }}>Start Waypoint Pro</button>
        <p class="pro-fine"><${Icon} n="lock" s=${13} />Prototype: no payment is taken. Free stays free: every match, checklist and deadline.</p>`}
    </div>
  </div>`;
}

/* The plans, side by side, for the landing page. */
function Plans({ onStart }) {
  return html`<section class="plans wrap" aria-labelledby="plans-h">
    <h2 id="plans-h" class="plans-h">Free to start. Pro to go further.</h2>
    <div class="plans-grid">
      <div class="plan-card">
        <span class="plan-name">Free</span>
        <span class="plan-price"><b>$0</b> forever</span>
        <ul class="plan-list">
          <li><${Icon} n="check" s=${16} />Matches ranked by how well they fit you</li>
          <li><${Icon} n="check" s=${16} />Every opportunity, near and far</li>
          <li><${Icon} n="check" s=${16} />What each one needs, step by step</li>
          <li><${Icon} n="check" s=${16} />Deadlines and an applications tracker</li>
        </ul>
        <button class="btn btn-secondary btn-block" onClick=${onStart}>Get started</button>
      </div>
      <div class="plan-card on">
        <span class="plan-name"><${Icon} n="sparkles" s=${16} />Waypoint Pro</span>
        <span class="plan-price"><b>$4.99</b> a month, or $39 a year</span>
        <ul class="plan-list">
          <li><${Icon} n="check" s=${16} />Everything in Free</li>
          <li><${Icon} n="check" s=${16} />Compass, your AI guide</li>
          <li><${Icon} n="check" s=${16} />A personal step-by-step plan</li>
          <li><${Icon} n="check" s=${16} />CV tailoring and eligibility checks</li>
        </ul>
        <button class="btn btn-primary btn-block" onClick=${onStart}>Start with Pro</button>
      </div>
    </div>
  </section>`;
}
