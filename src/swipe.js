/* ==========================================================================
   Waypoint · Quick picks: one card at a time. Swipe right to save it,
   left to skip it. Cards come from the student's answers, learn from what
   they save or skip, and never repeat.
   ========================================================================== */

const SWIPE_OUT = 110; // px past which letting go counts as a swipe

/* Every open opportunity not yet saved, skipped or applied to, best first.
   Saving or skipping nudges similar cards up or down. */
function swipeQueue(p, st) {
  const seen = new Set([...(st.saved || []), ...(st.dismissed || []), ...appliedList(st).map((a) => a.id)]);
  const liked = (st.saved || []).map((id) => opById(id, p)).filter(Boolean);
  const skipped = (st.dismissed || []).map((id) => opById(id, p)).filter(Boolean);
  const boost = (op) => {
    let b = 0;
    for (const o of liked) { if (o.type === op.type) b += 3; if (o.fields.some((f) => op.fields.includes(f))) b += 4; }
    for (const o of skipped) { if (o.type === op.type) b -= 2; if (o.fields.some((f) => op.fields.includes(f))) b -= 2; }
    return Math.max(-24, Math.min(24, b));
  };
  return evaluate(p, st)
    .filter((r) => r.el.ok && !seen.has(r.op.id))
    .map((r) => ({ r, s: r.score + boost(r.op) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.r);
}

function swipePoints(op, p) {
  const di = deadlineInfo(op);
  const why = matchReasons(op, p).find((m) => m.ok && m.k === 'field');
  return [
    !di.d ? 'Open all year' : di.days <= 1 ? di.label : `Closes ${fmtDate(di.d)} · ${di.days} days left`,
    moneyOf(op),
    op.duration,
    why ? why.text : null,
  ].filter(Boolean).slice(0, 4);
}

function SwipeCard({ row, p, next, cardRef, h }) {
  const op = row.op;
  return html`<div class=${cx('sw-card', next && 'sw-next')} data-id=${op.id} ref=${next ? null : cardRef} aria-hidden=${next ? 'true' : null}
    onPointerDown=${h && h.down} onPointerMove=${h && h.move} onPointerUp=${h && h.up} onPointerCancel=${h && h.cancel}
    onDragStart=${(e) => e.preventDefault()}>
    <div class="sw-img">
      <${OppImage} op=${op} cls="sw-ph" />
      <span class="stamp like">Save</span><span class="stamp nope">Skip</span>
    </div>
    <div class="sw-body">
      <div class="sw-top">
        <span class="sw-tx"><${TypeLabel} t=${op.type} /><b class="sw-t">${op.title}</b><span class="sw-o">${op.org} · ${placeOf(op)}</span></span>
        <${MatchRing} v=${row.score} size=${48} />
      </div>
      <ul class="sw-pts">${swipePoints(op, p).map((t) => html`<li><span>${t}</span></li>`)}</ul>
    </div>
  </div>`;
}

function SwipeDeck({ p, st, onOpen }) {
  const [paused, setPaused] = useState(false);
  const [picks, setPicks] = useState([]); // saved in this sitting, newest first
  const [last, setLast] = useState(null); // { id, act } for Undo
  const cardRef = useRef();
  const drag = useRef(null);
  const busy = useRef(false);
  const queue = swipeQueue(p, st);
  const row = queue[0];
  const nextRow = queue[1];

  const commit = (op, act) => {
    if (act === 'save') { A.save(op.id); setPicks((x) => [op.id].concat(x.filter((i) => i !== op.id))); }
    else A.dismiss(op.id);
    setLast({ id: op.id, act });
    busy.current = false;
  };
  const fly = (dir, dy = 0) => {
    const el = cardRef.current;
    if (!el || !row || busy.current) return;
    busy.current = true;
    const op = row.op;
    el.style.animation = 'none';
    el.style.transition = 'transform .3s ease-in, opacity .3s ease-in';
    el.style.transform = `translate(${dir * 680}px, ${dy * 0.3}px) rotate(${dir * 24}deg)`;
    el.style.opacity = '0';
    setTimeout(() => commit(op, dir > 0 ? 'save' : 'skip'), reducedMotion() ? 0 : 230);
  };
  const reset = (el) => {
    el.style.transition = 'transform .25s var(--ease)';
    el.style.transform = '';
    el.style.setProperty('--like', 0);
    el.style.setProperty('--nope', 0);
  };
  const h = {
    down(e) {
      if (busy.current || (e.button != null && e.button !== 0)) return;
      drag.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.style.animation = 'none';
      e.currentTarget.style.transition = 'none';
    },
    move(e) {
      const d = drag.current;
      if (!d) return;
      d.dx = e.clientX - d.x;
      d.dy = e.clientY - d.y;
      if (Math.abs(d.dx) > 6 || Math.abs(d.dy) > 6) d.moved = true;
      const el = e.currentTarget;
      el.style.transform = `translate(${d.dx}px, ${d.dy * 0.3}px) rotate(${d.dx / 18}deg)`;
      el.style.setProperty('--like', Math.max(0, Math.min(1, d.dx / SWIPE_OUT)));
      el.style.setProperty('--nope', Math.max(0, Math.min(1, -d.dx / SWIPE_OUT)));
    },
    up(e) {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      const el = e.currentTarget;
      if (!d.moved) { reset(el); onOpen(row.op); return; }
      if (Math.abs(d.dx) > SWIPE_OUT) fly(d.dx > 0 ? 1 : -1, d.dy);
      else reset(el);
    },
    cancel(e) { drag.current = null; reset(e.currentTarget); },
  };
  const undo = () => {
    if (!last) return;
    if (last.act === 'save') { A.unsave(last.id); setPicks((x) => x.filter((i) => i !== last.id)); }
    else A.undismiss(last.id);
    setLast(null);
  };
  // Arrow keys work anywhere on the page, except while typing or with a panel open.
  const keyRef = useRef();
  keyRef.current = (e) => {
    if (paused || !row || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    const a = document.activeElement;
    if (document.querySelector('.drawer, .pro-sheet, .compass') || (a && a.closest && a.closest('input, textarea, select, [contenteditable="true"]'))) return;
    e.preventDefault();
    fly(e.key === 'ArrowRight' ? 1 : -1);
  };
  useEffect(() => {
    const k = (e) => keyRef.current(e);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const pickIds = picks.length ? picks : (st.saved || []).slice().reverse();
  const pickOps = pickIds.map((id) => opById(id, p)).filter(Boolean);
  const skippedN = (st.dismissed || []).length;

  return html`<section class="swipe" aria-labelledby="qp-h">
    <div class="swipe-side">
      <h1 id="qp-h" class="swipe-h"><${Icon} n="layers" s=${28} />Quick picks</h1>
      <p class="swipe-p">Swipe right to save, left to skip.<span class="swipe-p2"> Picked from your answers, and it learns as you go.</span></p>
      <div class="swipe-bar">
        <div class="swipe-stats">
          <span><b>${(st.saved || []).length}</b>saved</span>
          <span><b>${skippedN}</b>skipped</span>
          <span><b>${queue.length}</b>to go</span>
        </div>
        <button class="btn btn-secondary btn-sm swipe-pause" onClick=${() => setPaused(!paused)}>
          <${Icon} n=${paused ? 'layers' : 'list-checks'} s=${16} />${paused ? 'Keep swiping' : html`<span class="pz-l">Pause and see my picks</span><span class="pz-s">My picks</span>`}
        </button>
      </div>
      <p class="swipe-keys" aria-hidden="true"><kbd>←</kbd><kbd>→</kbd>Skip or save with your arrow keys</p>
    </div>

    <div class="swipe-stage">
      ${paused ? html`<div class="picks">
          <h3 class="picks-h">${picks.length ? `You picked ${picks.length} just now` : pickOps.length ? `Your saved picks (${pickOps.length})` : 'No picks yet'}</h3>
          ${pickOps.length ? html`<ul class="picks-list">${pickOps.slice(0, 8).map((o) => html`<li key=${o.id}><button class="pick" onClick=${() => onOpen(o)}>
              <${OppImage} op=${o} cls="pick-img" /><span class="pick-tx"><b>${o.title}</b><span>${o.org} · ${placeOf(o)}</span></span><${Icon} n="chevron-right" s=${18} />
            </button></li>`)}</ul>` : html`<p class="picks-empty">Swipe right on anything you like and it shows up here.</p>`}
          <div class="picks-acts">
            <button class="btn btn-primary" onClick=${() => setPaused(false)}><${Icon} n="layers" s=${16} />Keep swiping</button>
            <button class="btn btn-secondary" onClick=${() => go('saved')}>All saved</button>
          </div>
        </div>`
      : row ? html`
        <div class="sw-stack">
          ${nextRow ? html`<${SwipeCard} key=${'n' + nextRow.op.id} row=${nextRow} p=${p} next />` : null}
          <${SwipeCard} key=${row.op.id} row=${row} p=${p} cardRef=${cardRef} h=${h} />
        </div>
        <div class="sw-btns">
          <button class="sw-btn undo" aria-label="Undo last swipe" title="Undo" disabled=${!last} onClick=${undo}><${Icon} n="undo-2" s=${20} /></button>
          <button class="sw-btn nope" aria-label=${`Skip ${row.op.title}`} title="Skip" onClick=${() => fly(-1)}><${Icon} n="x" s=${26} w=${2.4} /></button>
          <button class="sw-btn like" aria-label=${`Save ${row.op.title}`} title="Save" onClick=${() => fly(1)}><${Icon} n="heart" s=${26} w=${2.2} /></button>
          <button class="sw-btn info" aria-label=${`Details for ${row.op.title}`} title="Details" onClick=${() => onOpen(row.op)}><${Icon} n="info" s=${20} /></button>
        </div>`
      : html`<div class="swipe-end">
          <span class="swipe-end-ic"><${Icon} n="party-popper" s=${28} /></span>
          <b>You’ve seen every match</b>
          <p>Edit your answers for new ones${skippedN ? ', or look again at the ones you skipped' : ''}.</p>
          <div class="picks-acts">
            ${skippedN ? html`<button class="btn btn-primary" onClick=${() => A.clearDismissed()}>Review ${skippedN} skipped</button>` : null}
            <button class="btn btn-secondary" onClick=${() => go('check-in')}>Edit answers</button>
          </div>
        </div>`}
    </div>
  </section>`;
}
