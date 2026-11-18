/* ==========================================================================
   Waypoint · core: Preact bindings, store, router, theme, toasts
   ========================================================================== */
const { html, render, useState, useEffect, useRef, useMemo } = htmPreact;

const cx = (...a) => a.filter(Boolean).join(' ');
const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const canHover = () => !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);

/* ---------- Store (per viewer, kept in this browser only) ---------- */
const STORE_KEY = 'waypoint.prototype.v2';
const blankState = () => ({ v: 2, user: null, profile: null, saved: [], dismissed: [], applied: [], docs: {}, files: {}, details: {}, theme: null, pro: null });
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const s = JSON.parse(raw); if (s && s.v === 2) return Object.assign(blankState(), s); }
  } catch (e) { /* storage unavailable: start fresh */ }
  return blankState();
}
const S = {
  state: loadState(),
  subs: new Set(),
  set(patch) {
    const next = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = Object.assign({}, this.state, next);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
    this.subs.forEach((f) => f());
  },
};
function useStore() {
  const [, force] = useState(0);
  useEffect(() => { const h = () => force((x) => x + 1); S.subs.add(h); return () => S.subs.delete(h); }, []);
  return S.state;
}

/* ---------- Router (plain #names only) ---------- */
const parseRoute = () => decodeURIComponent((location.hash || '').replace(/^#/, ''));
function go(name) {
  if (parseRoute() === name) { window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); return; }
  location.hash = name;
}
function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

/* ---------- Theme ---------- */
function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
}
function isDark() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t === 'dark';
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
function toggleTheme() { S.set({ theme: isDark() ? 'light' : 'dark' }); }

/* ---------- Toasts ---------- */
const TOASTS = { list: [], subs: new Set() };
function toast(msg, icon = 'check') {
  const id = Math.random().toString(36).slice(2);
  TOASTS.list = TOASTS.list.concat({ id, msg, icon });
  TOASTS.subs.forEach((f) => f());
  setTimeout(() => { TOASTS.list = TOASTS.list.filter((t) => t.id !== id); TOASTS.subs.forEach((f) => f()); }, 2600);
}

/* ---------- Actions ---------- */
const A = {
  toggleSave(id) {
    const on = S.state.saved.includes(id);
    S.set({ saved: on ? S.state.saved.filter((x) => x !== id) : S.state.saved.concat(id) });
    toast(on ? 'Removed from saved' : 'Saved', on ? 'bookmark' : 'bookmark-check');
  },
  save(id) { if (!S.state.saved.includes(id)) S.set({ saved: S.state.saved.concat(id) }); },
  unsave(id) { S.set({ saved: S.state.saved.filter((x) => x !== id) }); },
  dismiss(id) { const d = S.state.dismissed || []; if (!d.includes(id)) S.set({ dismissed: d.concat(id) }); },
  undismiss(id) { S.set({ dismissed: (S.state.dismissed || []).filter((x) => x !== id) }); },
  clearDismissed() { S.set({ dismissed: [] }); },
  setDoc(k, v) {
    const docs = Object.assign({}, S.state.docs);
    if (v) docs[k] = v; else delete docs[k];
    S.set({ docs });
  },
  markApplied(op) {
    if (appliedOn(S.state, op.id)) return;
    S.set({ applied: appliedList(S.state).concat({ id: op.id, date: new Date().toISOString() }) });
    toast('Applied with your saved info', 'send');
  },
  addDoc(k, meta) {
    S.set({ files: Object.assign({}, S.state.files, { [k]: meta }), docs: Object.assign({}, S.state.docs, { [k]: 'ready' }) });
    toast(`${REQ[k].label} saved`, 'file-check');
  },
  removeDoc(k) {
    const files = Object.assign({}, S.state.files); delete files[k];
    const docs = Object.assign({}, S.state.docs); delete docs[k];
    S.set({ files, docs });
    if (typeof vault !== 'undefined') vault.del(k);
    toast(`${REQ[k].label} removed`, 'trash-2');
  },
  setDetails(patch) { S.set({ details: Object.assign({}, S.state.details, patch) }); },
  setUser(patch) { S.set({ user: Object.assign({}, S.state.user, patch) }); },
  unapply(id) {
    S.set({ applied: appliedList(S.state).filter((a) => a.id !== id) });
    toast('Removed from My applications', 'rotate-ccw');
  },
  startPro(plan) { S.set({ pro: { plan, since: new Date().toISOString() } }); toast('Welcome to Waypoint Pro', 'sparkles'); },
  cancelPro() { S.set({ pro: null }); toast('You’re back on the free plan', 'rotate-ccw'); },
  signOut() { S.set({ user: null }); go(''); },
  reset() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    if (typeof vault !== 'undefined') vault.clear();
    S.set(blankState());
    go('');
  },
};
