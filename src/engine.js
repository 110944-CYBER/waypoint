/* ==========================================================================
   Waypoint · engine
   Dates, matching, eligibility, requirement status, readiness, route planning
   and the built-in guide used when Claude is not available.
   ========================================================================== */

const DAY = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysUntil = (d) => Math.round((d - today()) / DAY);
const fmtDate = (d, year) => `${d.getDate()} ${MONTHS[d.getMonth()]}${year ? ' ' + d.getFullYear() : ''}`;
const fmtDay = (d) => `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
const pad2 = (n) => String(n).padStart(2, '0');

function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rad = (x) => (x * Math.PI) / 180;
function haversine(a1, o1, a2, o2) {
  const dA = rad(a2 - a1), dO = rad(o2 - o1);
  const s = Math.sin(dA / 2) ** 2 + Math.cos(rad(a1)) * Math.cos(rad(a2)) * Math.sin(dO / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

const roundNice = (n) => {
  const step = n >= 1e6 ? 1e5 : n >= 1e5 ? 1e4 : n >= 1e4 ? 1000 : n >= 1000 ? 100 : 10;
  return Math.round(n / step) * step;
};
function fmtMoney(n, cur) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); }
  catch (e) { return `${cur} ${Math.round(n).toLocaleString('en')}`; }
}
const initials = (s) => s.replace(/[^A-Za-z0-9 &]/g, ' ').split(/\s+/).filter((w) => w && !/^(of|the|and|&|for|a)$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const firstName = (n) => (n || '').trim().split(/\s+/)[0] || '';

/* ---------- Deadlines ---------- */
function deadlineOf(op) {
  if (op._dl !== undefined) return op._dl;
  const w = op.when || {};
  let d = null;
  if (w.inDays != null) d = addDays(today(), w.inDays);
  else if (w.md) {
    const [m, dd] = w.md.split('-').map(Number);
    const t = today();
    d = new Date(t.getFullYear(), m - 1, dd);
    if (d < t) d = new Date(t.getFullYear() + 1, m - 1, dd);
  }
  op._dl = d;
  return d;
}
function deadlineInfo(op) {
  const d = deadlineOf(op);
  if (!d) return { d: null, days: null, label: 'Rolling', short: 'Rolling', tone: 'calm', est: false };
  const days = daysUntil(d);
  const est = !!(op.when && op.when.md);
  const tone = days <= 14 ? 'urgent' : days <= 45 ? 'soon' : 'calm';
  const label = days === 0 ? 'Closes today' : days === 1 ? 'Closes tomorrow' : days <= 60 ? `Closes in ${days} days` : `Closes ${fmtDate(d)}`;
  return { d, days, label, short: fmtDate(d), tone, est };
}

/* ---------- Local opportunities around a city (fictional organisations) ---------- */
const _localCache = {};
function localOps(cityId) {
  if (!cityId) return [];
  if (_localCache[cityId]) return _localCache[cityId];
  const city = cityOf(cityId);
  if (!city) return [];
  const rnd = seeded('waypoint:' + cityId);
  const list = LOCAL_TPL.map((t, i) => {
    const dist = +(1.2 + Math.pow(rnd(), 1.3) * 40).toFixed(1);
    const brg = Math.round(rnd() * 359);
    const inDays = 6 + Math.round(rnd() * 64);
    const sessionIn = inDays + 4 + Math.round(rnd() * 16);
    const stip = STIPEND[city.cur] || 1000;
    let funding = 'free', fundLabel = t.t === 'shadowing' ? 'Free to attend' : 'Free', value = 0;
    if (t.pay === 'paid') {
      const amt = roundNice(stip * (0.85 + rnd() * 0.45));
      funding = 'paid'; fundLabel = `${fmtMoney(amt, city.cur)} a month`; value = 1500;
    } else if (t.pay === 'bursary') {
      const amt = roundNice(stip * (3 + rnd() * 3));
      funding = 'partial'; fundLabel = `Up to ${fmtMoney(amt, city.cur)}`; value = 4000;
    }
    return {
      id: `loc-${cityId}-${i}`, local: true, sample: true, cityId,
      type: t.t, title: t.title, org: t.org, mono: initials(t.org),
      city: city.name, country: city.country, region: city.region, dist, brg, lat: null, lon: null,
      mode: 'On-site', level: t.st.includes('hs') ? 'School and university students' : 'University students and graduates',
      stages: t.st, age: t.age || null, orig: 'any', fields: [t.f],
      funding, fundLabel, value, duration: t.dur,
      when: { inDays }, session: addDays(today(), sessionIn),
      summary: t.sum, covers: [], reqs: t.reqs,
    };
  });
  _localCache[cityId] = list;
  return list;
}

const homeCity = (p) => (p && cityOf(p.city)) || cityOf('riyadh');
const homeRegion = (p) => homeCity(p).region;
function allOps(p) { return GLOBAL_OPS.concat(localOps(p && p.city)); }
function opById(id, p) {
  const g = GLOBAL_OPS.find((o) => o.id === id);
  if (g) return g;
  const m = /^loc-(.+)-\d+$/.exec(id);
  if (m) return localOps(m[1]).find((o) => o.id === id) || null;
  return null;
}
/* Distance (km) from the student's home city; null for remote listings. */
function distanceOf(op, p) {
  if (op.local) return op.dist;
  if (op.lat == null) return null;
  const c = homeCity(p);
  return Math.round(haversine(c.lat, c.lon, op.lat, op.lon));
}
function fmtKm(km) { return km == null ? 'Remote' : km < 100 ? `${km} km` : `${Math.round(km).toLocaleString('en')} km`; }

/* ---------- Eligibility ---------- */
const ageRangeOf = (op, p) => (op.ageByStage ? op.ageByStage[p.stage] || null : op.age || null);
function originOk(op, p) {
  const hr = homeRegion(p);
  if (!op.orig || op.orig === 'any') return true;
  if (op.orig.only) return op.orig.only.includes(hr);
  if (op.orig.not) return !op.orig.not.includes(hr);
  return true;
}
function eligibility(op, p) {
  const issues = [];
  const ar = ageRangeOf(op, p);
  let tooYoung = false;
  if (ar && (p.age < ar[0] || p.age > ar[1])) { tooYoung = p.age < ar[0]; issues.push({ k: 'age', text: `Open to ages ${ar[0]}–${ar[1]}` }); }
  let laterStage = false;
  if (!op.stages.includes(p.stage)) {
    const minIdx = Math.min(...op.stages.map((s) => STAGE_ORDER.indexOf(s)));
    laterStage = STAGE_ORDER.indexOf(p.stage) < minIdx;
    issues.push({ k: 'stage', text: laterStage ? `Opens up once you are ${stageOf(STAGE_ORDER[minIdx]).label.toLowerCase()}` : `For ${op.stages.map((s) => stageOf(s).label.toLowerCase()).join(', ')}` });
  }
  if (!originOk(op, p)) issues.push({ k: 'origin', text: op.origNote || 'Nationality rules apply' });
  const later = issues.length > 0 && issues.every((i) => (i.k === 'stage' && laterStage) || (i.k === 'age' && tooYoung));
  return { ok: issues.length === 0, later, issues };
}

/* ---------- Fit ---------- */
function fieldFit(op, p) {
  if (op.fields.includes('any')) return 0.72;
  if (!p.fields || !p.fields.length) return 0.72;
  const ov = op.fields.filter((f) => p.fields.includes(f)).length;
  return ov ? Math.min(1, 0.92 + 0.04 * ov) : 0.12;
}
function destFit(op, p) {
  if (op.local) return 1 - (Math.min(op.dist, 50) / 50) * 0.18;
  if (op.region === 'remote') return 0.9;
  const dest = p.dest || [];
  if (!dest.length || dest.includes('any')) return 0.95;
  if (dest.includes(op.region)) return 1;
  if (dest.includes('home') && op.region === homeRegion(p)) return 1;
  return 0.25;
}
const typeOk = (op, p) => !p.types || !p.types.length || p.types.includes(op.type);

const NATIVE_ENGLISH = ['United Kingdom', 'United States', 'Canada', 'Australia', 'New Zealand', 'Ireland', 'Singapore'];

/* ---------- Requirement status ---------- */
function cvScore(cv) {
  if (!cv) return 0;
  let s = 0;
  if (cv.headline && cv.headline.trim()) s += 10;
  if ((cv.education || []).some((e) => e.school && e.qual)) s += 20;
  const ex = (cv.experience || []).filter((e) => e.role).length;
  s += ex >= 2 ? 25 : ex === 1 ? 18 : 0;
  const sk = (cv.skills || []).length;
  s += sk >= 3 ? 15 : sk * 5;
  if ((cv.languages || []).length) s += 10;
  if ((cv.tests || []).some((t) => t.name && t.score)) s += 10;
  if ((cv.activities || []).some((a) => a.title)) s += 10;
  return Math.min(100, s);
}
const hasEnglishTest = (cv) => !!cv && (cv.tests || []).some((t) => /ielts|toefl|duolingo|pte|cambridge/i.test(t.name || '') && t.score);

function reqStatus(r, op, p, st) {
  const g = REQ[r.k] || {};
  if (g.minorOnly && p.age >= 18) return { s: 'na' };
  const docs = st.docs || {};
  switch (r.k) {
    case 'age': {
      const ar = ageRangeOf(op, p);
      if (!ar) return { s: 'met', note: 'No age limit.' };
      const ok = p.age >= ar[0] && p.age <= ar[1];
      return { s: ok ? 'met' : 'todo', note: ok ? `You are ${p.age}. Open to ages ${ar[0]}–${ar[1]}.` : `Open to ages ${ar[0]}–${ar[1]}. You are ${p.age}.` };
    }
    case 'hsdiploma':
      return p.stage === 'hs' ? { s: 'progress', note: 'You will have this when you finish school. Predicted grades are enough to apply.' } : { s: 'met', note: 'Completed.' };
    case 'bachelor':
      if (['grad', 'pg', 'pro'].includes(p.stage)) return { s: 'met', note: 'Completed.' };
      return p.stage === 'ug' ? { s: 'progress', note: 'Final-year students can usually apply before graduating.' } : { s: 'todo', note: 'Comes after your first degree.' };
    case 'master':
      if (p.stage === 'pg') return { s: 'progress', note: 'In progress now.' };
      return p.stage === 'pro' ? { s: 'progress', note: "Counts if your degree is at master's level." } : { s: 'todo', note: "Needs a master's degree first." };
    case 'enrolled':
      return ['hs', 'ug', 'pg'].includes(p.stage) ? { s: 'met', note: 'You are a current student.' } : { s: 'todo', note: 'Usually needs current enrollment or very recent graduation.' };
    case 'workexp':
      if (p.stage === 'pro') return { s: 'met', note: 'You are working now. Keep a log of dates and hours.' };
      return p.stage === 'grad' ? { s: 'progress', note: 'Count your hours from your first role.' } : { s: 'todo', note: 'Builds up after you graduate.' };
    case 'english': {
      if (NATIVE_ENGLISH.includes(homeCity(p).country)) return { s: 'met', note: 'Usually waived when your schooling was in English.' };
      if (hasEnglishTest(st.cv) || docs.english === 'ready') return { s: 'met', note: 'Score on file.' };
      if (docs.english === 'progress') return { s: 'progress', note: 'Preparing now.' };
      return { s: 'todo', note: 'No test score on file yet.' };
    }
    default: {
      const d = docs[r.k];
      return d === 'ready' ? { s: 'met', note: 'Marked as ready.' } : d === 'progress' ? { s: 'progress', note: 'In progress.' } : { s: 'todo', note: '' };
    }
  }
}
function opReadiness(op, p, st) {
  let n = 0, got = 0, met = 0;
  for (const r of op.reqs) {
    const s = reqStatus(r, op, p, st).s;
    if (s === 'na' || (r.opt && s !== 'met')) continue;
    n++;
    if (s === 'met') { got += 1; met++; } else if (s === 'progress') got += 0.5;
  }
  return { pct: n ? Math.round((got / n) * 100) : 100, met, n };
}
function missingReqs(op, p, st) {
  return op.reqs.filter((r) => !r.opt && ['todo', 'progress'].includes(reqStatus(r, op, p, st).s)).map((r) => r.t || REQ[r.k].label);
}

/* ---------- Scoring and matching ---------- */
function scoreOp(op, p, st) {
  const f = fieldFit(op, p), d = destFit(op, p), t = typeOk(op, p) ? 1 : 0.45;
  const rd = opReadiness(op, p, st).pct / 100;
  const km = distanceOf(op, p);
  const near = op.local ? 0.035 - Math.min(op.dist, 40) / 2000 : -Math.min(0.06, (km || 0) / 90000);
  const raw = Math.min(1, 0.34 * f + 0.34 * d + 0.18 * t + 0.14 * rd + near);
  return Math.max(12, Math.min(99, Math.round(100 * Math.pow(raw, 1.25))));
}
const isStrongFit = (op, p) => typeOk(op, p) && fieldFit(op, p) >= 0.72 && destFit(op, p) >= 0.8;

const _memo = { key: '', val: null };
function evaluate(p, st) {
  const key = JSON.stringify([p, st.docs, st.cv && cvScore(st.cv), hasEnglishTest(st.cv)]);
  if (_memo.key === key) return _memo.val;
  const rows = allOps(p).map((op) => {
    const el = eligibility(op, p);
    return { op, el, score: scoreOp(op, p, st), ready: opReadiness(op, p, st), fit: isStrongFit(op, p) };
  });
  rows.sort((a, b) => b.score - a.score || ((deadlineOf(a.op) || 9e15) - (deadlineOf(b.op) || 9e15)));
  _memo.key = key; _memo.val = rows;
  return rows;
}
const matches = (p, st) => evaluate(p, st).filter((r) => r.el.ok && r.fit);
const laterOn = (p, st) => evaluate(p, st).filter((r) => !r.el.ok && r.el.later && fieldFit(r.op, p) >= 0.72 && destFit(r.op, p) >= 0.8 && (!p.types.length || p.types.includes(r.op.type) || r.op.type === 'postgrad'));
const rowOf = (op, p, st) => evaluate(p, st).find((r) => r.op.id === op.id) || { op, el: eligibility(op, p), score: scoreOp(op, p, st), ready: opReadiness(op, p, st), fit: isStrongFit(op, p) };

/* Live count during onboarding: the sample catalog narrowed by whatever has been answered. */
function liveMatches(d) {
  const proxyCity = d.city || 'london';
  const ops = GLOBAL_OPS.concat(localOps(proxyCity));
  const p = { age: d.age ?? 20, stage: d.stage || 'ug', types: d.types || [], fields: d.fields || [], city: proxyCity, dest: d.dest && d.dest.length ? d.dest : ['any'] };
  return ops.filter((op) => {
    if (d.age != null) { const ar = op.ageByStage ? (d.stage ? op.ageByStage[d.stage] : null) : op.age; if (ar && (d.age < ar[0] || d.age > ar[1])) return false; }
    if (d.stage && !op.stages.includes(d.stage)) return false;
    if (d.types && d.types.length && !d.types.includes(op.type)) return false;
    if (d.fields && d.fields.length && fieldFit(op, p) < 0.72) return false;
    if (d.city && !originOk(op, p)) return false;
    if (d.city && d.dest && d.dest.length && destFit(op, p) < 0.8) return false;
    if (!d.city && op.local) return d.fields && d.fields.length ? fieldFit(op, p) >= 0.92 : true;
    return true;
  });
}

/* Why this matches, in plain words. */
function matchReasons(op, p) {
  const out = [];
  const ar = ageRangeOf(op, p);
  out.push({ k: 'age', ok: !ar || (p.age >= ar[0] && p.age <= ar[1]), text: ar ? `Ages ${ar[0]}–${ar[1]}; you are ${p.age}` : 'No age limit' });
  out.push({ k: 'stage', ok: op.stages.includes(p.stage), text: op.stages.includes(p.stage) ? `Open to ${stageOf(p.stage).label.toLowerCase()} applicants` : eligibility(op, p).issues.find((i) => i.k === 'stage').text });
  const ff = fieldFit(op, p);
  const shared = op.fields.filter((f) => p.fields.includes(f)).map((f) => fieldOf(f).label);
  out.push({ k: 'field', ok: ff >= 0.72, text: op.fields.includes('any') ? 'Open to every field' : shared.length ? `Matches your interest in ${shared.join(' and ')}` : `Focused on ${op.fields.map((f) => fieldOf(f).label).join(', ')}` });
  const df = destFit(op, p);
  const km = distanceOf(op, p);
  out.push({ k: 'place', ok: df >= 0.8, text: op.local ? `${km} km from home in ${op.city}` : op.region === 'remote' ? 'Remote, so it works from anywhere' : df >= 0.8 ? `In ${regionName(op.region)}, a region you chose` : `In ${regionName(op.region)}, outside the regions you chose` });
  out.push({ k: 'origin', ok: originOk(op, p), text: originOk(op, p) ? `Open to applicants from ${homeCity(p).country}` : op.origNote || 'Nationality rules apply' });
  return out;
}

/* ---------- Highest-leverage requirement ---------- */
function nextBestStep(p, st) {
  const ms = matches(p, st).slice(0, 16);
  const tally = (states) => {
    const out = {};
    for (const { op } of ms) for (const r of op.reqs) {
      const g = REQ[r.k];
      if (!g || g.kind !== 'doc' || r.opt || r.k === 'interview') continue;
      if (states.includes(reqStatus(r, op, p, st).s)) (out[r.k] = out[r.k] || new Set()).add(op.id);
    }
    return out;
  };
  let count = tally(['todo']);
  if (!Object.keys(count).length) count = tally(['progress']);
  let best = null;
  for (const k in count) if (!best || count[k].size > count[best].size || (count[k].size === count[best].size && (REQ[k].lead || 0) > (REQ[best].lead || 0))) best = k;
  return best ? { k: best, n: count[best].size, of: ms.length, ids: [...count[best]] } : null;
}

function profileReadiness(p, st) {
  const ms = matches(p, st);
  if (!ms.length) return cvScore(st.cv);
  return Math.round(ms.reduce((a, r) => a + r.ready.pct, 0) / ms.length);
}

/* Documents the student's matches ask for, most-used first. */
function docNeeds(p, st) {
  const need = {};
  const base = ['cv', 'transcript', 'statement', 'refs', 'passport', 'english'];
  base.forEach((k) => (need[k] = new Set()));
  for (const { op } of matches(p, st)) for (const r of op.reqs) {
    const g = REQ[r.k];
    if (!g || g.kind !== 'doc' || r.k === 'interview') continue;
    if (g.minorOnly && p.age >= 18) continue;
    (need[r.k] = need[r.k] || new Set()).add(op.id);
  }
  return Object.keys(need).map((k) => ({ k, n: need[k].size })).sort((a, b) => b.n - a.n);
}

/* ---------- Route planning ---------- */
const REQ_ACTION = {
  english: 'Book and sit an English test', refs: 'Ask for recommendation letters', statement: 'Draft your personal statement',
  cv: 'Finish your CV', transcript: 'Request official transcripts', passport: 'Check or renew your passport',
  consent: 'Get parent or guardian consent', schoolletter: 'Get a school enrollment letter', health: 'Collect health and vaccination records',
  portfolio: 'Build your portfolio', research: 'Write your research proposal', gre: 'Sit the GRE or GMAT', exam: 'Prepare for the entrance test',
  coding: 'Practise for the coding assessment', offer: 'Apply to the university course', video: 'Record your video statement',
  leadership: 'Write up your leadership record', need: 'Gather evidence of financial need', interview: 'Prepare for interviews',
};
function buildRoute(p, st) {
  const T = today();
  let targets = (st.saved || []).map((id) => opById(id, p)).filter(Boolean);
  const auto = targets.length === 0;
  if (auto) targets = matches(p, st).map((r) => r.op).filter((o) => o.type !== 'shadowing').slice(0, 4);
  const steps = new Map();
  const add = (s) => {
    const cur = steps.get(s.id);
    if (!cur) { steps.set(s.id, s); return; }
    if (s.date < cur.date) cur.date = s.date;
    cur.for = [...new Set(cur.for.concat(s.for))];
    cur.tight = cur.tight || s.tight;
  };
  for (const o of targets) {
    const dl = deadlineOf(o);
    const end = dl || addDays(T, 45);
    for (const r of o.reqs) {
      const g = REQ[r.k];
      if (!g || g.kind !== 'doc' || r.opt) continue;
      const s = reqStatus(r, o, p, st).s;
      if (s === 'na') continue;
      if (r.k === 'interview') {
        add({ id: 'int:' + o.id, kind: 'interview', date: addDays(end, 21), title: 'Prepare for interviews', detail: o.title, line: o.type, for: [o.id], req: 'interview' });
        continue;
      }
      let date = addDays(end, -(g.lead || 21));
      let tight = false;
      if (date < T) { date = T; tight = true; }
      add({ id: 'req:' + r.k, kind: 'req', req: r.k, date, title: REQ_ACTION[r.k] || g.label, line: 'req', for: [o.id], tight });
    }
    const sub = dl ? (addDays(dl, -2) < T ? T : addDays(dl, -2)) : addDays(T, 45);
    add({ id: 'sub:' + o.id, kind: 'submit', date: sub, title: `Submit ${o.title}`, detail: o.org, line: o.type, for: [o.id], deadline: dl });
  }
  const exp = matches(p, st).map((r) => r.op).find((o) => o.local && o.type === 'shadowing');
  if (exp) add({ id: 'exp:' + exp.id, kind: 'experience', date: exp.session, title: exp.title, detail: `${exp.org} · ${exp.dist} km from home`, line: 'shadowing', for: [exp.id] });
  (st.customSteps || []).forEach((c) => add({ id: c.id, kind: 'custom', date: new Date(c.date), title: c.title, line: 'custom', for: [] }));
  const list = [...steps.values()].sort((a, b) => a.date - b.date);
  list.forEach((s) => { s.done = stepDone(s, p, st); });
  return { targets, auto, steps: list };
}
function stepDone(s, p, st) {
  if (s.kind === 'req') {
    if (s.req === 'cv') return cvScore(st.cv) >= 80;
    if (s.req === 'english') return hasEnglishTest(st.cv) || (st.docs || {}).english === 'ready' || NATIVE_ENGLISH.includes(homeCity(p).country);
    return (st.docs || {})[s.req] === 'ready';
  }
  return !!(st.routeDone || {})[s.id];
}

/* ---------- Labels ---------- */
function destLabel(d, p) {
  if (d === 'any') return 'Anywhere';
  if (d === 'home') return `Near home (${regionName(homeRegion(p))})`;
  return regionName(d);
}
function routeLabel(p) {
  const c = homeCity(p);
  const dest = (p.dest || []).map((d) => (d === 'home' ? 'home region' : d === 'any' ? 'anywhere' : (REGIONS.find((r) => r.id === d) || {}).short || d));
  return `${c.name} → ${dest.length ? dest.join(', ') : 'anywhere'}`;
}

/* ---------- Text for Claude ---------- */
const AI_RULES = `You are Compass, the guide inside Waypoint, an app that helps students and graduates plan their path: internships, scholarships, job shadowing, university and postgraduate admissions, and careers.

Always help. Answer every question as fully and usefully as you can, using your own knowledge of education, admissions and careers worldwide: universities, medical, law and business schools, entrance exams, timelines, CVs, essays and interviews. Never refuse, never say you don't know, and never say you can only help with Waypoint listings. If you are unsure of an exact detail such as a deadline, fee or requirement, still give your best guidance and add that the student should confirm it on the official site.

Talk to the student directly as "you", never in the third person. Their own words come first: if their message says who or where they are (for example "as a high school student"), plan for exactly that and do not correct them with the profile. Use the Waypoint data below (profile, matches and applications) only to fill in what the message leaves out. When a goal has earlier stages (for example, medical school comes after a bachelor's degree), lay out the whole path starting from the student's current stage, without lecturing them about it. When a Waypoint listing fits a step, name it as an example; listings marked (sample) are demo listings, so present them as examples of what to look for.

Style: warm, direct and practical. Keep quick questions short (under 120 words). For a plan, roadmap or step-by-step request, give a complete plan organized by stage or year, with concrete actions and timing (up to about 400 words). Use short paragraphs and "- " bullets, and put each stage title in **bold** on its own line. No tables. Dates marked est. are estimates.`;

function aiContext(p, st, op) {
  const c = homeCity(p);
  const ms = matches(p, st).slice(0, 8);
  const L = [];
  L.push(`Today is ${fmtDate(today(), true)}.`);
  L.push(`Student: ${(st.user && st.user.name) || 'Student'}, age ${p.age}, ${stageOf(p.stage).label}. Interests: ${p.fields.map((f) => fieldOf(f).label).join(', ') || 'open'}. Lives in ${c.name}, ${c.country}. Wants to go: ${(p.dest || []).map((d) => destLabel(d, p)).join(', ') || 'anywhere'}. Looking for: ${(p.types || []).map((t) => typeOf(t).label).join(', ') || 'everything'}.`);
  L.push(`CV status: ${(st.docs || {}).cv === 'ready' ? 'ready' : (st.docs || {}).cv === 'progress' ? 'in progress' : 'not started'}. Documents marked ready: ${Object.keys(st.docs || {}).filter((k) => st.docs[k] === 'ready').map((k) => REQ[k].label).join(', ') || 'none yet'}.`);
  L.push('Top matches (title | type | where | deadline | readiness | still needed):');
  for (const { op: o, ready } of ms) {
    const di = deadlineInfo(o);
    L.push(`- ${o.title}${o.sample ? ' (sample)' : ''}, ${o.org} | ${typeOf(o.type).one} | ${o.local ? o.city + ', ' + o.dist + ' km away' : o.city} | ${di.d ? fmtDate(di.d, true) + (di.est ? ' est.' : '') : 'rolling'} | ${ready.pct}% | ${missingReqs(o, p, st).join(', ') || 'nothing'}`);
  }
  const apps = appliedList(st).map((a) => ({ a, o: opById(a.id, p) })).filter((x) => x.o);
  if (apps.length) {
    L.push('Applications sent (title | applied on | starts):');
    apps.forEach(({ a, o }) => L.push(`- ${o.title}${o.sample ? ' (sample)' : ''}, ${o.org} | ${fmtDate(new Date(a.date), true)} | ${fmtDate(startOf(o), true)} est.`));
  }
  if (op) {
    const di = deadlineInfo(op);
    L.push(`The student is looking at: ${op.title}${op.sample ? ' (sample)' : ''} by ${op.org}, ${op.city}. Funding: ${op.fundLabel}. Deadline: ${di.d ? fmtDate(di.d, true) + (di.est ? ' est.' : '') : 'rolling'}. Requirements: ${op.reqs.map((r) => `${r.t || REQ[r.k].label} [${reqStatus(r, op, p, st).s}]`).join('; ')}.`);
  }
  return L.join('\n');
}

function cvText(cv, user, p) {
  if (!cv) return '';
  const c = homeCity(p);
  const L = [`${(user && user.name) || 'Applicant'} · ${c.name}, ${c.country}`, cv.headline || ''];
  if ((cv.education || []).length) { L.push('EDUCATION'); cv.education.forEach((e) => L.push(`- ${e.qual}, ${e.school} (${e.start}–${e.end})${e.grade ? ' · ' + e.grade : ''}`)); }
  if ((cv.experience || []).length) { L.push('EXPERIENCE'); cv.experience.forEach((e) => L.push(`- ${e.role}, ${e.org} (${e.start}–${e.end}): ${e.desc || ''}`)); }
  if ((cv.activities || []).length) { L.push('ACTIVITIES AND AWARDS'); cv.activities.forEach((a) => L.push(`- ${a.title}: ${a.detail || ''}`)); }
  if ((cv.skills || []).length) L.push('SKILLS: ' + cv.skills.join(', '));
  if ((cv.languages || []).length) L.push('LANGUAGES: ' + cv.languages.map((l) => `${l.lang} (${l.level})`).join(', '));
  if ((cv.tests || []).length) L.push('TESTS: ' + cv.tests.map((t) => `${t.name} ${t.score}`).join(', '));
  return L.filter(Boolean).join('\n');
}

/* ---------- Built-in guide (no Claude) ---------- */
function guideAnswer(q, p, st, op) {
  const t = q.toLowerCase();
  const ms = matches(p, st);
  const c = homeCity(p);
  const nb = nextBestStep(p, st);
  const route = buildRoute(p, st).steps.filter((s) => !s.done).slice(0, 3);
  const bullets = (arr) => arr.map((x) => `- ${x}`).join('\n');
  const guideFor = (k) => {
    const g = REQ[k];
    return `**${g.label}** takes about ${g.time ? g.time.toLowerCase() : 'a few weeks'}.\n${bullets(g.steps)}${g.local ? '\n\n' + g.local.replace('{city}', c.name) : ''}`;
  };
  const apps = appliedList(st).map((a) => ({ a, o: opById(a.id, p) })).filter((x) => x.o);
  if (/my application|applied|start date|when do i start|when does it start/i.test(t)) {
    return apps.length
      ? `You have applied to ${apps.length}:\n${bullets(apps.map(({ a, o }) => `**${o.title}**, ${o.org}: applied ${fmtDate(new Date(a.date))}, starts around ${fmtDate(startOf(o), true)}`))}\n\nStart dates are estimates until the host confirms.`
      : 'You have not applied to anything yet. Open a match and tap **Apply now**, and it will show up under My applications with its start date.';
  }
  if (!op && /fit me|suit me|best (match|matches|fit|option|options|internships?|scholarships?)|which (internships?|scholarships?|programs?|programmes?|ones?)\b|recommend(ed)? (for )?me/i.test(t)) {
    const want = /internship/i.test(t) ? 'internship' : /scholarship/i.test(t) ? 'scholarship' : null;
    const top = ms.filter(({ op: o }) => (!want || o.type === want) && !appliedOn(st, o.id)).slice(0, 3);
    return top.length
      ? `Your strongest ${want ? want + 's' : 'matches'} right now:\n${bullets(top.map(({ op: o, score }) => `**${o.title}**, ${o.org}: ${score}% match${deadlineOf(o) ? `, closes ${fmtDate(deadlineOf(o))}` : ''}`))}\n\nOpen any of them to see exactly what it needs.`
      : 'Nothing strong yet. Try adding another destination or interest in Edit answers.';
  }
  if (op && /tailor|my cv|resume|résumé/i.test(t)) return cvTailor(op, p);
  if (/recommend|reference|referee|letter of/i.test(t)) return guideFor('refs');
  if (/statement|essay|motivation|personal/i.test(t)) return guideFor('statement');
  if (/ielts|toefl|english|language test/i.test(t)) {
    const n = ms.filter(({ op }) => op.reqs.some((r) => r.k === 'english')).length;
    return `${n} of your ${ms.length} matches ask for proof of English.\n\n${guideFor('english')}`;
  }
  if (/cv|resume|résumé/i.test(t)) return guideFor('cv');
  if (/fund|money|paid|afford|free|cost/i.test(t)) {
    const f = ms.filter(({ op }) => op.funding === 'full' || op.funding === 'paid').slice(0, 4);
    return f.length ? `These matches are fully funded or paid:\n${bullets(f.map(({ op }) => `**${op.title}**: ${op.fundLabel}`))}\n\nOpen any of them to see exactly what it covers.` : 'None of your current matches are fully funded yet. Try adding another region on your profile to widen the search.';
  }
  if (/near|local|close|shadow|weekend/i.test(t)) {
    const n = ms.filter(({ op }) => op.local).sort((a, b) => a.op.dist - b.op.dist).slice(0, 3);
    return n.length ? `Closest to you in ${c.name}:\n${bullets(n.map(({ op }) => `**${op.title}**, ${op.org}: ${op.dist} km, next session ${fmtDay(op.session)}`))}\n\nShadowing days are short and free, and they give you real stories for your personal statement.` : `Nothing near ${c.name} matches your fields yet. The Near you tab shows everything close by.`;
  }
  if (/deadline|soon|closing|when/i.test(t)) {
    const soon = ms.filter(({ op }) => deadlineOf(op)).sort((a, b) => deadlineOf(a.op) - deadlineOf(b.op)).slice(0, 4);
    return `Your next deadlines:\n${bullets(soon.map(({ op }) => `**${op.title}**: ${fmtDate(deadlineOf(op))} (${daysUntil(deadlineOf(op))} days)`))}\n\nOpen any of them to see what to start first.`;
  }
  if (op && /this|chance|eligible|qualify|apply/i.test(t)) {
    const miss = missingReqs(op, p, st);
    const r = rowOf(op, p, st);
    const an = /^8/.test(String(r.score)) || r.score === 11 || r.score === 18 ? 'an' : 'a';
    const head = r.el.ok
      ? `Yes, you can apply to **${op.title}**. It is ${an} ${r.score}% match and you are ${r.ready.pct}% ready.`
      : `Not yet. ${r.el.issues.map((i) => i.text).join('. ')}.`;
    return `${head}\n${miss.length ? `Still to do:\n${bullets(miss.slice(0, 4))}` : 'You have everything it asks for. Time to submit.'}\n\nDeadline: ${deadlineInfo(op).d ? fmtDate(deadlineInfo(op).d, true) : 'rolling'}.`;
  }
  const lines = [];
  if (nb) lines.push(`Your highest-impact step is **${REQ_ACTION[nb.k] ? REQ_ACTION[nb.k].toLowerCase() : REQ[nb.k].label}**. It is needed by ${nb.n} of your top ${nb.of} matches.`);
  if (route.length) lines.push(`Coming up on your route:\n${bullets(route.map((s) => `${fmtDate(s.date)}: ${s.title}`))}`);
  if (ms[0]) lines.push(`Your strongest match right now is **${ms[0].op.title}** (${ms[0].score}%).`);
  return lines.join('\n\n') || 'Tell me what you are working on and I will suggest the next step.';
}

function guideCvReview(op, p, st) {
  const cv = st.cv || {};
  const strengths = [];
  const gaps = [];
  const edits = [];
  const exp = (cv.experience || []).filter((e) => e.role);
  if ((cv.activities || []).length) strengths.push(`${cv.activities[0].title} shows initiative beyond the classroom.`);
  if (exp.length) strengths.push(`Your role as ${exp[0].role.toLowerCase()} gives you a concrete story to build on.`);
  if ((cv.languages || []).length > 1) strengths.push(`Speaking ${cv.languages.map((l) => l.lang).join(' and ')} is an asset for international programs.`);
  if ((cv.education || []).some((e) => e.grade)) strengths.push('Your grades are stated clearly, which reviewers look for first.');
  for (const r of op.reqs) {
    const s = reqStatus(r, op, p, st);
    if (s.s === 'todo' && !r.opt) gaps.push(`${r.t || REQ[r.k].label}: ${s.note || 'not started yet'}`);
  }
  exp.forEach((e) => { if (!/\d/.test(e.desc || '')) edits.push(`Add a number to "${e.role}": how many people, hours or results?`); });
  if ((cv.skills || []).length < 4) edits.push('List at least four skills, starting with the ones this opportunity mentions.');
  if (!cv.headline) edits.push(`Add a one-line headline that names your goal, for example "Aspiring ${fieldOf(p.fields[0] || 'sci').label.split(' ')[0].toLowerCase()} student".`);
  edits.push(`Move the experience most relevant to ${op.title} to the top of your CV.`);
  const rd = opReadiness(op, p, st).pct;
  return {
    verdict: rd >= 70 ? `You are close: ${rd}% ready for ${op.title}. Polish and submit.` : `A solid start at ${rd}% ready. Close the gaps below before the deadline.`,
    strengths: strengths.slice(0, 3).length ? strengths.slice(0, 3) : ['Your CV has a clear structure to build on.'],
    gaps: gaps.slice(0, 3).length ? gaps.slice(0, 3) : ['No hard gaps. Focus on making each line specific.'],
    edits: edits.slice(0, 3),
  };
}

/* ---------- Boarding-pass helpers ---------- */
function orgCode(org) {
  const w = org.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter((x) => x && !/^(of|the|and|for|a)$/i.test(x));
  if (w.length >= 3) return (w[0][0] + w[1][0] + w[2][0]).toUpperCase();
  if (w.length === 2) return (w[0][0] + w[1].slice(0, 2)).toUpperCase();
  return (w[0] || 'WPT').slice(0, 3).toUpperCase();
}
function fromOf(p) { const c = homeCity(p); return { code: CITY_CODE[c.id] || c.name.slice(0, 3).toUpperCase(), name: c.name }; }
function destOf(op, p) {
  if (op.local) return { code: orgCode(op.org), name: `${op.dist} km away`, local: true };
  const d = DEST[op.id];
  if (d) return { code: d[0], name: d[1], remote: d[0] === 'WEB' };
  return { code: op.city.slice(0, 3).toUpperCase(), name: op.city };
}
function destCodes(dest, city) {
  const codes = (dest || []).map((x) => (x === 'home' ? (city ? CITY_CODE[city.id] : 'HOME') : x === 'any' ? 'ANY' : REGION_CODE[x] || x.toUpperCase()));
  if (!codes.length) return { text: '···', more: 0 };
  return { text: codes.slice(0, 2).join('·'), more: Math.max(0, codes.length - 2) };
}
function startBy(r, op) {
  const g = REQ[r.k];
  if (!g || g.kind !== 'doc') return null;
  const dl = deadlineOf(op) || addDays(today(), 45);
  if (r.k === 'interview') return addDays(dl, 21);
  const d = addDays(dl, -(g.lead || 21));
  return d < today() ? today() : d;
}
function ticketFields(op) {
  const fund = op.funding === 'full' ? 'Fully funded' : op.fundLabel;
  if (op.type === 'internship') return [['Pay', fund], ['Length', op.duration], ['Format', op.mode]];
  if (op.type === 'shadowing') return [['Cost', op.fundLabel], ['Length', op.duration], ['Next', op.session ? fmtDay(op.session) : 'Ask host']];
  return [['Funding', fund], ['Length', op.duration], ['Level', op.level]];
}
function cvTailor(op, p) {
  const f = op.fields.find((x) => p.fields.includes(x)) || p.fields[0] || 'sci';
  const sn = CV_SNIPPETS[f] || CV_SNIPPETS.sci;
  const need = op.reqs.filter((r) => !r.opt && REQ[r.k] && REQ[r.k].kind === 'doc').map((r) => r.t || REQ[r.k].label).slice(0, 3);
  return `For **${op.title}**, shape your CV like this:\n- Open with one line: "${stageOf(p.stage).label} focused on ${fieldOf(f).label}".\n- Lead with your most relevant experience, like "${sn.exp[0]}", and say what changed because of you.\n- List the skills they screen for: ${sn.skills.join(', ')}.\n- Put a number on every line: people, hours or results.${need.length ? `\n\nThey will also ask for: ${need.join(', ')}.` : ''}`;
}

/* ---------- Applications and start dates ---------- */
function appliedList(st) {
  return ((st && st.applied) || []).map((x) => (typeof x === 'string' ? { id: x, date: today().toISOString() } : x));
}
function appliedOn(st, id) {
  const a = appliedList(st).find((x) => x.id === id);
  return a ? new Date(a.date) : null;
}
function startOf(op) {
  if (op._start !== undefined) return op._start;
  const base = deadlineOf(op) || addDays(today(), 30);
  let d;
  if (op.local && op.type === 'shadowing' && op.session) d = op.session;
  else if (START_MD[op.id]) {
    const [m, dd] = START_MD[op.id].split('-').map(Number);
    d = new Date(base.getFullYear(), m - 1, dd);
    if (d <= base) d = new Date(base.getFullYear() + 1, m - 1, dd);
  } else d = addDays(base, op.type === 'internship' ? 45 : op.type === 'shadowing' ? 14 : 120);
  op._start = d;
  return d;
}
