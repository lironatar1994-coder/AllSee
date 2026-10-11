'use strict';
const WORK = 'C:\\Users\\User\\Desktop\\Liron\\Work\\';
const GH = 'https://github.com/lironatar1994-coder/';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const host = u => String(u).replace(/^https?:\/\//, '').replace(/\/$/, '');
const clone = o => JSON.parse(JSON.stringify(o));
function safeUrl(u) {
  try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : ''; } catch { return ''; }
}
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const boot = JSON.parse(document.getElementById('boot')?.textContent || 'null');
if (!boot) {
  document.body.innerHTML = '<p style="padding:40px;font:18px Rubik,sans-serif">צריך לפתוח את AllSee דרך השרת: start.cmd ואז http://localhost:4310/allsee/</p>';
  throw new Error('no boot data');
}

let doc = boot.doc;
let saved = clone(doc);
let admin = boot.admin;
const adminRoute = /\/admin\/?$/.test(location.pathname);
let editing = false;
let dirty = false;
let kind = 'all', sel = 0, visible = [];
let sortMode = doc.settings.defaultSort || 'manual';
let opened = store.get('allsee.opened', {});
const status = {};
const site = id => doc.sites.find(s => s.id === id);

const I = {
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  gh: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  local: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
};

// ---------- rendering ----------
const ed = field => editing ? `data-edit="${field}" contenteditable="plaintext-only" spellcheck="false"` : '';

function links(s) {
  const out = [];
  const url = safeUrl(s.url);
  if (s.signIn && url) out.push(`<a class="lk admin" href="${esc(url)}" target="_blank" rel="noopener" data-open="${esc(s.id)}">${I.key}דף כניסה</a>`);
  (s.extra || []).forEach(e => {
    const u = safeUrl(e.url); if (!u) return;
    out.push(`<a class="lk ${e.admin ? 'admin' : ''}" href="${esc(u)}" target="_blank" rel="noopener" data-open="${esc(s.id)}">${e.admin ? I.key : I.ext}${esc(e.label)}</a>`);
  });
  const local = safeUrl(s.local);
  if (local) out.push(`<a class="lk" href="${esc(local)}" target="_blank" rel="noopener" title="עובד רק כשהוא רץ על המחשב הזה">${I.local}מקומי</a>`);
  if (s.repo) out.push(`<a class="lk" href="${GH + encodeURIComponent(s.repo)}" target="_blank" rel="noopener" title="github.com/lironatar1994-coder/${esc(s.repo)}">${I.gh}GitHub</a>`);
  (s.repos || []).forEach(r => out.push(`<a class="lk" href="${GH + encodeURIComponent(r)}" target="_blank" rel="noopener"><span class="ltr">${I.gh}</span>${esc(r)}</a>`));
  (s.folders || []).forEach(f => out.push(`<button class="lk" type="button" data-copy="${esc(WORK + f)}" title="העתקת ${esc(WORK + f)}">${I.folder}<span class="ltr">${esc(f)}</span></button>`));
  return out.join('');
}

function tools(s, isRow) {
  const group = visible.filter(v => v.place === s.place);
  const k = group.findIndex(v => v.id === s.id);
  return `<div class="tools" role="group" aria-label="עריכת ${esc(s.name)}">
    <button class="icon-btn drag" type="button" data-drag aria-label="גרירה לשינוי הסדר" title="גרירה לשינוי הסדר">${I.grip}</button>
    <button class="icon-btn" type="button" data-move="-1" ${k <= 0 ? 'disabled' : ''} aria-label="הזזה מוקדם יותר" title="מוקדם יותר">${isRow ? I.up : I.prev}</button>
    <button class="icon-btn" type="button" data-move="1" ${k >= group.length - 1 ? 'disabled' : ''} aria-label="הזזה מאוחר יותר" title="מאוחר יותר">${isRow ? I.down : I.next}</button>
    <button class="icon-btn" type="button" data-hide aria-pressed="${s.hidden}" aria-label="${s.hidden ? 'הצגה בעמוד הציבורי' : 'הסתרה מהעמוד הציבורי'}" title="${s.hidden ? 'מוסתר. ללחוץ כדי להציג' : 'מוצג. ללחוץ כדי להסתיר'}">${s.hidden ? I.eyeOff : I.eye}</button>
    <button class="icon-btn" type="button" data-editsite aria-label="עריכת כל הפרטים" title="עריכת כל הפרטים">${I.pen}</button>
  </div>`;
}

function card(s, i) {
  const url = safeUrl(s.url);
  const img = s.shot ? `<img src="shots/${esc(s.shot)}" alt="" loading="lazy" width="1280" height="800" draggable="false">` : '<span class="noshot">אין צילום מסך</span>';
  const addr = url ? `<span class="addr"><span class="dot ${status[s.id] || ''}" data-dot="${esc(s.id)}"></span><span class="ltr">${esc(host(url))}</span></span>` : '';
  return `<article class="site${s.hidden ? ' is-hidden' : ''}" data-i="${i}" data-id="${esc(s.id)}" data-place="${s.place}">
    ${editing ? tools(s, false) : ''}${s.hidden ? '<span class="badge">מוסתר</span>' : ''}
    <a class="shot" ${url ? `href="${esc(url)}" target="_blank" rel="noopener"` : ''} data-open="${esc(s.id)}" draggable="false" aria-label="פתיחת ${esc(s.name)}${url ? ', ' + esc(host(url)) : ''}">${img}${addr}</a>
    <div class="meta">
      <div class="name"><h3 ${ed('name')}>${esc(s.name)}</h3>${s.sub || editing ? `<span class="sub" dir="auto" ${ed('sub')}>${esc(s.sub)}</span>` : ''}</div>
      <p class="what" ${ed('what')}>${esc(s.what)}</p>
      <div class="links">${links(s)}</div>
    </div>
  </article>`;
}

function row(s, i) {
  return `<div class="row${s.hidden ? ' is-hidden' : ''}" data-i="${i}" data-id="${esc(s.id)}" data-place="${s.place}">
    <div><h3><span ${ed('name')}>${esc(s.name)}</span>${s.hidden ? '<span class="badge">מוסתר</span>' : ''}</h3>${s.sub || editing ? `<span class="sub" dir="auto" ${ed('sub')}>${esc(s.sub)}</span>` : ''}</div>
    <p class="what" ${ed('what')}>${esc(s.what)}</p>
    <div class="links">${links(s)}${editing ? tools(s, true) : ''}</div>
  </div>`;
}

const norm = t => (t || '').toLowerCase().replace(/[\u0591-\u05C7״׳"'·־-]/g, ' ');
function matches(s, q) {
  if (!q) return true;
  const hay = norm([s.name, s.sub, s.what, s.url, (s.folders || []).join(' '), s.repo, (s.repos || []).join(' '), s.tags, (s.extra || []).map(e => e.url + ' ' + e.label).join(' ')].join(' '));
  return norm(q).split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
function sorted(list) {
  const mode = editing ? 'manual' : sortMode;
  const index = new Map(doc.sites.map((s, i) => [s.id, i]));
  return [...list].sort((a, b) => {
    if (mode === 'az') return a.name.localeCompare(b.name, 'he');
    if (mode === 'recent') { const d = (opened[b.id] || 0) - (opened[a.id] || 0); if (d) return d; }
    if (mode === 'updated') { const d = (b.updated || '').localeCompare(a.updated || ''); if (d) return d; }
    return index.get(a.id) - index.get(b.id);
  });
}
const shown = () => doc.sites.filter(s => editing || !s.hidden);

function applySettings() {
  const st = doc.settings;
  document.title = editing ? `עריכה · ${st.brand}` : st.brand;
  $('#q').placeholder = st.placeholder || '';
  $$('[data-setting]').forEach(el => {
    if (document.activeElement !== el) el.textContent = st[el.dataset.setting] || '';
    if (editing) { el.setAttribute('contenteditable', 'plaintext-only'); el.spellcheck = false; }
    else el.removeAttribute('contenteditable');
  });
}

function filtersUI() {
  const all = shown();
  const kinds = [['all', 'הכול'], ...Object.entries(doc.settings.kinds)];
  $('#filters').innerHTML = kinds.map(([k, l]) => {
    const n = k === 'all' ? all.length : all.filter(s => s.kind === k).length;
    return `<button class="chip" type="button" data-kind="${k}" aria-pressed="${k === kind}">${esc(l)}<span>${n}</span></button>`;
  }).join('');
}

function countsUI() {
  const all = shown();
  const live = all.filter(s => s.place === 'live');
  const domains = new Set(live.map(s => { try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch { return ''; } }).filter(Boolean));
  $('#counts').innerHTML = `<span><b>${live.length}</b> חיים</span><span><b>${domains.size}</b> דומיינים</span><span><b>${all.filter(s => s.place === 'local').length}</b> מקומיים</span>`;
}

function render() {
  const q = $('#q').value.trim();
  const f = shown().filter(s => (kind === 'all' || s.kind === kind) && matches(s, q));
  const live = sorted(f.filter(s => s.place === 'live'));
  const local = sorted(f.filter(s => s.place === 'local'));
  const gh = sorted(f.filter(s => s.place === 'github'));
  visible = [...live, ...local, ...gh];
  let i = 0;
  $('#grid').innerHTML = live.map(s => card(s, i++)).join('');
  $('#local').innerHTML = local.map(s => row(s, i++)).join('');
  $('#gh').innerHTML = gh.map(s => row(s, i++)).join('');
  $('#localSec').hidden = !local.length;
  $('#ghSec').hidden = !gh.length;
  const none = !visible.length;
  $('#empty').style.display = none ? 'block' : 'none';
  if (none) $('#empty').innerHTML = `אין תוצאות ל־<b>„${esc(q)}”</b>${kind !== 'all' ? ' בסינון הזה' : ''}. אפשר לנסות דומיין, שם תיקייה או את שם הלקוח באנגלית.`;
  sel = Math.min(sel, Math.max(visible.length - 1, 0));
  applySettings(); filtersUI(); countsUI();
  paintSel(false);
}

function paintSel(scroll) {
  $$('.sel').forEach(e => e.classList.remove('sel'));
  if (!$('#q').value && !scroll) return;
  const el = document.querySelector(`[data-i="${sel}"]`);
  if (el) {
    el.classList.add('sel');
    if (scroll) el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}

// ---------- shared interactions ----------
function markOpened(id) { opened[id] = Date.now(); store.set('allsee.opened', opened); }
function openSel() {
  const s = visible[sel]; if (!s) return;
  const u = safeUrl(s.url) || safeUrl(s.local) || (s.repo && GH + encodeURIComponent(s.repo));
  if (!u) return;
  markOpened(s.id);
  window.open(u, '_blank', 'noopener');
}
let toastT;
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
}

document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]'); if (o && o.hasAttribute('href')) markOpened(o.dataset.open);
  const c = e.target.closest('[data-copy]');
  if (c) {
    const p = c.dataset.copy;
    (navigator.clipboard?.writeText(p) || Promise.reject()).then(
      () => { c.classList.add('copied'); toast('הנתיב הועתק. אפשר להדביק אותו בסייר הקבצים.'); setTimeout(() => c.classList.remove('copied'), 1500); },
      () => window.prompt('העתיקו את הנתיב:', p));
  }
  const k = e.target.closest('[data-kind]');
  if (k) { kind = k.dataset.kind; sel = 0; render(); }
  if (editing && e.target.closest('#brandLink')) e.preventDefault();
});
$('#q').addEventListener('input', () => { sel = 0; render(); });
$('#sort').addEventListener('change', () => { sortMode = $('#sort').value; render(); });

function cols() {
  const g = $('#grid'); const first = g.children[0]; if (!first) return 1;
  const top = first.offsetTop; let n = 0;
  for (const c of g.children) { if (c.offsetTop !== top) break; n++; }
  return n || 1;
}
document.addEventListener('keydown', e => {
  const t = e.target;
  if (t.isContentEditable) {
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); t.blur(); }
    return;
  }
  if (t.closest('dialog, .login') || $('#editor').open || $('#settings').open || !$('#login').hidden) return;
  const q = $('#q');
  const inInput = t === q;
  if (e.key === 'Escape') { q.value = ''; sel = 0; render(); q.focus(); return; }
  if (t.matches('select, textarea, input:not(#q)')) return;
  if (!inInput && !e.key.startsWith('Arrow') && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !t.closest('a,button')) { q.focus(); return; }
  if (inInput && e.key === 'Enter') { e.preventDefault(); openSel(); return; }
  const sideways = !inInput || q.value === '';
  const liveCount = $('#grid').children.length, c = cols(), inGrid = sel < liveCount;
  let n;
  if (e.key === 'ArrowDown') n = inGrid ? Math.min(sel + c, liveCount) : sel + 1;
  else if (e.key === 'ArrowUp') n = inGrid ? sel - c : (sel === liveCount ? liveCount - 1 : sel - 1);
  else if (e.key === 'ArrowLeft' && sideways) n = sel + 1;   // RTL: left is "next"
  else if (e.key === 'ArrowRight' && sideways) n = sel - 1;
  else return;
  e.preventDefault();
  sel = Math.max(0, Math.min(visible.length - 1, n));
  paintSel(true);
});

const themeKey = 'allsee.theme';
const savedTheme = store.get(themeKey, null);
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
$('#theme').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme;
  const dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  document.documentElement.dataset.theme = next; store.set(themeKey, next);
});

// A no-cors request resolves when the server answers at all.
async function check() {
  const live = shown().filter(s => s.place === 'live' && safeUrl(s.url));
  let up = 0;
  await Promise.all(live.map(async s => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    try { await fetch(s.url, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal }); status[s.id] = 'live'; up++; }
    catch { status[s.id] = 'down'; }
    clearTimeout(t);
    const d = document.querySelector(`[data-dot="${CSS.escape(s.id)}"]`); if (d) d.className = 'dot ' + status[s.id];
  }));
  const down = live.filter(s => status[s.id] === 'down').map(s => s.name);
  $('#statusNote').textContent = down.length
    ? `${up} מתוך ${live.length} אתרים ענו. לא עונים: ${down.join(', ')}.`
    : `כל ${live.length} האתרים החיים ענו עכשיו.`;
}

// ---------- API ----------
async function api(path, opts = {}) {
  try {
    const r = await fetch(`api/${path}`, { credentials: 'same-origin', cache: 'no-store', ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    let data = {}; try { data = await r.json(); } catch {}
    return { ok: r.ok, status: r.status, data };
  } catch { return { ok: false, status: 0, data: { error: 'אין חיבור לשרת. בודקים את האינטרנט ומנסים שוב.' } }; }
}

// ---------- login ----------
function showLogin(msg) {
  $('#login').hidden = false;
  $('#loginError').textContent = msg || '';
  setTimeout(() => $('#password').focus(), 30);
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const pw = $('#password').value;
  if (!pw) { $('#loginError').textContent = 'צריך להקליד סיסמה.'; return; }
  $('#loginBtn').disabled = true; $('#loginBtn').textContent = 'בודק…';
  const r = await api('login', { method: 'POST', body: JSON.stringify({ password: pw }) });
  $('#loginBtn').disabled = false; $('#loginBtn').textContent = 'כניסה';
  if (!r.ok) {
    $('#loginError').textContent = r.data.error || 'הכניסה נכשלה.';
    const card = $('.login-card'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    $('#password').select();
    return;
  }
  admin = true;
  $('#password').value = '';
  $('#login').hidden = true;
  if (dirty) saved = clone(r.data.doc);          // keep unsaved edits, rebase on the server copy
  else { doc = r.data.doc; saved = clone(doc); }
  enterEdit();
});

// ---------- edit mode ----------
function enterEdit() {
  editing = true;
  document.body.classList.add('editing');
  $('#adminbar').hidden = false;
  $('#editTip').hidden = false;
  $('#adminLink').hidden = true;
  $('#sort').value = 'manual'; $('#sort').disabled = true;
  $('#sort').title = 'במצב עריכה רואים את הסדר שלך. את סדר ברירת המחדל לציבור קובעים בהגדרות העמוד.';
  changed(); render();
}
function changed() {
  dirty = JSON.stringify({ s: doc.settings, x: doc.sites }) !== JSON.stringify({ s: saved.settings, x: saved.sites });
  document.body.classList.toggle('dirty', dirty);
  $('#save').disabled = !dirty;
  $('#discard').disabled = !dirty;
  $('#dirtyNote').textContent = dirty ? 'יש שינויים שעוד לא נשמרו' : 'הכול שמור';
}
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

$('#save').addEventListener('click', async () => {
  const btn = $('#save'); btn.disabled = true; btn.textContent = 'שומר…';
  const r = await api('data', { method: 'PUT', body: JSON.stringify({ baseRev: saved.rev, settings: doc.settings, sites: doc.sites }) });
  btn.textContent = 'שמירה';
  if (r.ok) {
    doc = r.data.doc; saved = clone(doc); changed(); render();
    toast('נשמר. העמוד הציבורי כבר מעודכן.');
  } else if (r.status === 401) {
    admin = false; changed();
    showLogin('החיבור פג. אחרי הכניסה לוחצים שוב על „שמירה”. השינויים לא נמחקו.');
  } else if (r.status === 409) {
    if (confirm('הרשימה נשמרה בינתיים ממכשיר אחר. לטעון את הגרסה החדשה? השינויים שעשית כאן יימחקו.')) {
      doc = r.data.doc; saved = clone(doc); changed(); render();
    } else changed();
  } else {
    toast(r.data.error || 'השמירה נכשלה.', 4000); changed();
  }
});
$('#discard').addEventListener('click', () => {
  if (!confirm('לבטל את כל השינויים מאז השמירה האחרונה?')) return;
  doc = clone(saved); changed(); render(); toast('השינויים בוטלו.');
});
$('#logout').addEventListener('click', async () => {
  if (dirty && !confirm('יש שינויים שלא נשמרו. לצאת בלי לשמור?')) return;
  dirty = false;
  await api('logout', { method: 'POST', body: '{}' });
  location.href = './';
});

// Inline text edits
document.addEventListener('input', e => {
  const el = e.target;
  if (!editing || !el.isContentEditable) return;
  const text = el.textContent.replace(/\s+/g, ' ');
  if (el.dataset.setting) {
    doc.settings[el.dataset.setting] = text.trim();
    if (el.dataset.setting === 'brand') document.title = `עריכה · ${text.trim()}`;
  } else if (el.dataset.edit) {
    const s = site(el.closest('[data-id]')?.dataset.id); if (!s) return;
    s[el.dataset.edit] = text.trim();
  }
  changed();
});
document.addEventListener('focusout', e => {
  const el = e.target;
  if (editing && el.isContentEditable && el.dataset.edit === 'name' && !el.textContent.trim()) {
    const s = site(el.closest('[data-id]')?.dataset.id);
    if (s) { s.name = 'ללא שם'; el.textContent = s.name; changed(); }
  }
});
document.addEventListener('paste', e => {
  if (!e.target.isContentEditable) return;
  e.preventDefault();
  document.execCommand('insertText', false, (e.clipboardData?.getData('text/plain') || '').replace(/\s+/g, ' '));
});

// Card tools: move, hide, edit
function placeRelative(id, targetId, where) {
  if (id === targetId) return;
  const arr = doc.sites;
  const [it] = arr.splice(arr.findIndex(s => s.id === id), 1);
  let to = arr.findIndex(s => s.id === targetId);
  if (where === 'after') to++;
  arr.splice(to, 0, it);
  changed(); render();
}
document.addEventListener('click', e => {
  if (!editing) return;
  const holder = e.target.closest('[data-id]'); if (!holder) return;
  const id = holder.dataset.id, s = site(id);
  const mv = e.target.closest('[data-move]');
  if (mv && !mv.disabled) {
    const d = Number(mv.dataset.move);
    const group = visible.filter(v => v.place === s.place);
    const other = group[group.findIndex(v => v.id === id) + d];
    if (other) {
      placeRelative(id, other.id, d > 0 ? 'after' : 'before');
      document.querySelector(`[data-id="${CSS.escape(id)}"] [data-move="${d}"]:not(:disabled)`)?.focus()
        || document.querySelector(`[data-id="${CSS.escape(id)}"] [data-move="${-d}"]`)?.focus();
    }
  }
  if (e.target.closest('[data-hide]')) {
    s.hidden = !s.hidden; changed(); render();
    document.querySelector(`[data-id="${CSS.escape(id)}"] [data-hide]`)?.focus();
    toast(s.hidden ? `„${s.name}” יוסתר מהעמוד הציבורי אחרי השמירה.` : `„${s.name}” יוצג בעמוד הציבורי אחרי השמירה.`);
  }
  if (e.target.closest('[data-editsite]')) openEditor(id, false);
});

// Drag and drop reordering (the grip turns dragging on, so text stays selectable)
let dragId = null;
document.addEventListener('pointerdown', e => {
  const g = e.target.closest('[data-drag]'); if (!g || !editing) return;
  g.closest('[data-id]').setAttribute('draggable', 'true');
});
document.addEventListener('pointerup', () => $$('[draggable="true"][data-id]').forEach(el => el.removeAttribute('draggable')));
document.addEventListener('dragstart', e => {
  const el = e.target.closest?.('[data-id][draggable="true"]'); if (!el) return;
  dragId = el.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragId);
  requestAnimationFrame(() => el.classList.add('dragging'));
});
function dropTarget(e) {
  const el = e.target.closest?.('[data-id]');
  if (!el || !dragId || el.dataset.id === dragId || el.dataset.place !== site(dragId)?.place) return null;
  const r = el.getBoundingClientRect();
  const isRow = el.classList.contains('row');
  const before = isRow ? e.clientY < r.top + r.height / 2 : e.clientX > r.left + r.width / 2; // RTL: right half = before
  return { el, where: before ? 'before' : 'after' };
}
function clearDrop() { $$('.drop-before,.drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after')); }
document.addEventListener('dragover', e => {
  const t = dropTarget(e); clearDrop(); if (!t) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  t.el.classList.add(t.where === 'before' ? 'drop-before' : 'drop-after');
});
document.addEventListener('drop', e => {
  const t = dropTarget(e); clearDrop(); if (!t) return;
  e.preventDefault();
  const id = dragId; dragId = null;
  placeRelative(id, t.el.dataset.id, t.where);
});
document.addEventListener('dragend', () => {
  clearDrop(); dragId = null;
  $$('.dragging').forEach(x => x.classList.remove('dragging'));
  $$('[draggable="true"][data-id]').forEach(el => el.removeAttribute('draggable'));
});

// ---------- site editor ----------
const edForm = $('#edForm');
const F = n => edForm.elements.namedItem(n);
let edId = null, edNew = false, edShot = '', edApplied = false;

function extraRow(x = { label: '', url: '', admin: false }) {
  const d = document.createElement('div');
  d.className = 'xrow';
  d.innerHTML = `<input type="text" aria-label="שם הקישור" placeholder="שם הקישור" maxlength="40" value="${esc(x.label)}">
    <input type="url" dir="ltr" aria-label="כתובת" placeholder="https://" value="${esc(x.url)}">
    <label class="check"><input type="checkbox" ${x.admin ? 'checked' : ''}> ניהול</label>
    <button class="icon-btn" type="button" aria-label="הסרת הקישור">✕</button>`;
  d.querySelector('button').addEventListener('click', () => d.remove());
  return d;
}
function openEditor(id, isNew) {
  const s = site(id); if (!s) return;
  edId = id; edNew = isNew; edShot = s.shot || ''; edApplied = false;
  $('#edTitle').textContent = isNew ? 'אתר חדש' : `עריכת ${s.name}`;
  F('kind').innerHTML = Object.entries(doc.settings.kinds).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('');
  for (const n of ['name', 'sub', 'what', 'kind', 'place', 'url', 'local', 'updated', 'repo', 'tags']) F(n).value = s[n] || '';
  F('repos').value = (s.repos || []).join(', ');
  F('folders').value = (s.folders || []).join(', ');
  F('signIn').checked = !!s.signIn;
  F('hidden').checked = !!s.hidden;
  $('#edExtra').replaceChildren(...(s.extra || []).map(extraRow));
  $('#edShot').src = edShot ? `shots/${edShot}` : 'data:,';
  $('#edError').textContent = '';
  $('#edDelete').hidden = isNew;
  $('#editor').showModal();
  setTimeout(() => F('name').focus(), 30);
}
$('#edAddExtra').addEventListener('click', () => { const r = extraRow(); $('#edExtra').append(r); r.querySelector('input').focus(); });
$('#edShotFile').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { $('#edError').textContent = 'הקובץ גדול מ־5MB.'; return; }
  $('#edError').textContent = 'מעלה…';
  const r = await api(`shot?id=${encodeURIComponent(edId)}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
  if (r.status === 401) { $('#edError').textContent = 'החיבור פג. צריך להיכנס שוב.'; return; }
  if (!r.ok) { $('#edError').textContent = r.data.error || 'ההעלאה נכשלה.'; return; }
  edShot = r.data.shot; $('#edShot').src = `shots/${edShot}`;
  $('#edError').textContent = '';
});
const splitList = v => v.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
edForm.addEventListener('submit', e => {
  e.preventDefault();
  const err = m => { $('#edError').textContent = m; };
  const name = F('name').value.trim();
  if (!name) { err('צריך שם.'); F('name').focus(); return; }
  for (const n of ['url', 'local']) {
    const v = F(n).value.trim();
    if (v && !safeUrl(v)) { err('הכתובת צריכה להתחיל ב־https:// או http://'); F(n).focus(); return; }
  }
  const extra = [];
  for (const r of $$('#edExtra .xrow')) {
    const [label, url, adm] = r.querySelectorAll('input');
    if (!label.value.trim() && !url.value.trim()) continue;
    if (!label.value.trim()) { err('לכל קישור צריך שם.'); label.focus(); return; }
    if (!safeUrl(url.value.trim())) { err('אחד הקישורים לא מתחיל ב־https://'); url.focus(); return; }
    extra.push({ label: label.value.trim(), url: url.value.trim(), admin: adm.checked });
  }
  const repoBad = [F('repo').value, ...splitList(F('repos').value)].some(r => r.trim() && !/^[A-Za-z0-9._-]+$/.test(r.trim()));
  if (repoBad) { err('שם מאגר יכול להכיל רק אותיות באנגלית, ספרות, נקודה, מקף וקו תחתון.'); return; }
  const s = site(edId);
  Object.assign(s, {
    name, sub: F('sub').value.trim(), what: F('what').value.trim(), kind: F('kind').value, place: F('place').value,
    url: F('url').value.trim(), local: F('local').value.trim(), updated: F('updated').value, repo: F('repo').value.trim(),
    repos: splitList(F('repos').value), folders: splitList(F('folders').value), tags: F('tags').value.trim(),
    signIn: F('signIn').checked, hidden: F('hidden').checked, extra, shot: edShot,
  });
  edApplied = true;
  $('#editor').close();
  changed(); render();
  toast(edNew ? 'האתר נוסף. לא לשכוח ללחוץ על „שמירה”.' : 'עודכן. לא לשכוח ללחוץ על „שמירה”.');
});
$('#editor').addEventListener('close', () => {
  if (edNew && !edApplied) { doc.sites = doc.sites.filter(s => s.id !== edId); changed(); render(); }
});
$('#edDelete').addEventListener('click', () => {
  const s = site(edId);
  if (!confirm(`למחוק את „${s.name}”? עד השמירה אפשר עוד לבטל עם „ביטול שינויים”.`)) return;
  doc.sites = doc.sites.filter(x => x.id !== edId);
  edApplied = true;
  $('#editor').close();
  changed(); render();
  toast('נמחק. נשמר רק אחרי לחיצה על „שמירה”.');
});
$('#addSite').addEventListener('click', () => {
  const id = `site-${Date.now().toString(36)}`;
  doc.sites.unshift({ id, name: '', sub: '', what: '', kind: kind !== 'all' ? kind : 'client', place: 'live', url: '', signIn: false, shot: '', extra: [], local: '', repo: '', repos: [], folders: [], updated: new Date().toISOString().slice(0, 10), tags: '', hidden: false });
  openEditor(id, true);
});

// ---------- page settings ----------
const stForm = $('#stForm');
const S = n => stForm.elements.namedItem(n);
const SETTING_FIELDS = ['brand', 'placeholder', 'hint', 'defaultSort', 'localTitle', 'localText', 'ghTitle', 'ghText', 'footer'];
$('#openSettings').addEventListener('click', () => {
  const st = doc.settings;
  SETTING_FIELDS.forEach(n => { S(n).value = st[n] || ''; });
  for (const k of ['client', 'product', 'tool']) S(`kind_${k}`).value = st.kinds[k] || '';
  $('#settings').showModal();
});
stForm.addEventListener('submit', e => {
  e.preventDefault();
  const st = doc.settings;
  SETTING_FIELDS.forEach(n => { st[n] = S(n).value.trim(); });
  st.brand ||= 'AllSee';
  for (const k of ['client', 'product', 'tool']) st.kinds[k] = S(`kind_${k}`).value.trim() || st.kinds[k];
  $('#settings').close();
  changed(); render();
  toast('עודכן. לא לשכוח ללחוץ על „שמירה”.');
});
$$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

// ---------- start ----------
$('#sort').value = sortMode;
render();
check();
if (adminRoute) { if (admin) enterEdit(); else showLogin(); }
