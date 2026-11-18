/* ==========================================================================
   Waypoint · Calendar: a month view of deadlines and start dates for what
   the student saved and applied to (or their top matches until then).
   ========================================================================== */

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function calEvents(p, st) {
  const ids = [...new Set(appliedList(st).map((a) => a.id).concat(st.saved || []))];
  const own = ids.length > 0;
  const ops = own ? ids.map((id) => opById(id, p)).filter(Boolean) : matches(p, st).slice(0, 8).map((m) => m.op);
  const ev = [];
  for (const op of ops) {
    const applied = !!appliedOn(st, op.id);
    const di = deadlineInfo(op);
    if (di.d && !applied) ev.push({ d: di.d, kind: 'deadline', op, est: di.est });
    ev.push({ d: startOf(op), kind: 'start', op, applied });
  }
  ev.sort((a, b) => a.d - b.d || (a.kind === 'deadline' ? -1 : 1));
  return { ev, own };
}

function CalendarView({ p, st, onOpen }) {
  const t = today();
  const [ym, setYm] = useState([t.getFullYear(), t.getMonth()]);
  const [sel, setSel] = useState(null); // a selected day's time, or null
  const { ev, own } = calEvents(p, st);
  const byDay = {};
  ev.forEach((e) => { (byDay[dayKey(e.d)] = byDay[dayKey(e.d)] || []).push(e); });
  const first = new Date(ym[0], ym[1], 1);
  const cells = [];
  for (let i = 0; i < 42; i++) cells.push(new Date(ym[0], ym[1], 1 - first.getDay() + i));
  const shown = cells[35].getMonth() !== ym[1] ? cells.slice(0, 35) : cells;
  const title = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const shift = (n) => { setYm(([y, m]) => { const d = new Date(y, m + n, 1); return [d.getFullYear(), d.getMonth()]; }); setSel(null); };
  const selDate = sel != null ? new Date(sel) : null;
  const list = selDate ? byDay[dayKey(selDate)] || [] : ev.filter((e) => e.d >= t).slice(0, 8);
  const label = (e) => `${e.kind === 'deadline' ? 'Closes' : 'Starts'}: ${e.op.title}`;

  return html`<section class="cal" aria-label="Calendar">
    <div class="cal-head">
      <h2 class="cal-title">${title}</h2>
      <div class="cal-nav">
        <button class="icon-btn" aria-label="Previous month" onClick=${() => shift(-1)}><${Icon} n="chevron-left" s=${20} /></button>
        <button class="btn btn-sm btn-secondary" onClick=${() => { setYm([t.getFullYear(), t.getMonth()]); setSel(null); }}>Today</button>
        <button class="icon-btn" aria-label="Next month" onClick=${() => shift(1)}><${Icon} n="chevron-right" s=${20} /></button>
      </div>
    </div>
    <div class="cal-legend">
      <span class="lg deadline"><i></i>Deadline</span><span class="lg start"><i></i>Starts</span>
      ${own ? null : html`<span class="cal-note">Showing your top matches. Save or apply to add your own.</span>`}
    </div>
    <div class="cal-grid">
      ${WEEKDAYS.map((w) => html`<div class="cal-wd">${w}</div>`)}
      ${shown.map((d) => {
        const k = dayKey(d);
        const items = byDay[k] || [];
        const out = d.getMonth() !== ym[1];
        const isToday = +d === +t;
        const isSel = sel != null && +d === sel;
        return html`<div key=${k} class=${cx('cal-day', out && 'out', isToday && 'today', isSel && 'sel', items.length && 'has')}
          role="button" tabindex="0" aria-label=${`${fmtDate(d, true)}${items.length ? `, ${items.map(label).join('; ')}` : ''}`}
          onClick=${() => setSel(isSel ? null : +d)} onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(isSel ? null : +d); } }}>
          <span class="cal-num">${d.getDate()}</span>
          <span class="cal-evs">
            ${items.slice(0, 2).map((e) => html`<span class=${cx('cal-ev', e.kind)} title=${label(e)}
              onClick=${(x) => { x.stopPropagation(); onOpen(e.op); }}>${label(e)}</span>`)}
            ${items.length > 2 ? html`<span class="cal-more">+${items.length - 2} more</span>` : null}
          </span>
          ${items.length ? html`<span class="cal-dots">${items.slice(0, 3).map((e) => html`<i class=${e.kind}></i>`)}</span>` : null}
        </div>`;
      })}
    </div>

    <div class="cal-agenda">
      <div class="cal-agenda-h"><h3>${selDate ? fmtDate(selDate, true) : 'Coming up'}</h3>${selDate ? html`<button class="btn-link" onClick=${() => setSel(null)}>Show all</button>` : null}</div>
      ${list.length ? html`<ul class="agenda">${list.map((e) => html`<li><button class="ag" onClick=${() => onOpen(e.op)}>
        <span class="ag-date"><b>${e.d.getDate()}</b><span>${MONTHS[e.d.getMonth()]}</span></span>
        <span class="ag-main"><span class=${cx('ag-kind', e.kind)}>${e.kind === 'deadline' ? `Deadline${e.est ? ' (estimate)' : ''}` : e.applied ? 'Starts · applied' : 'Starts'}</span><b>${e.op.title}</b><span>${e.op.org} · ${placeOf(e.op)}</span></span>
        <${Icon} n="chevron-right" s=${18} />
      </button></li>`)}</ul>` : html`<p class="sec-empty">${selDate ? 'Nothing on this day.' : 'Nothing coming up yet. Save or apply to see dates here.'}</p>`}
    </div>
  </section>`;
}
