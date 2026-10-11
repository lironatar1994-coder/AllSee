// AllSee server: serves the page under /allsee/, keeps the editable list on disk,
// and gates editing behind one admin password. No dependencies (Node 22+).
//   Local:  start.cmd  (or: node --env-file=.data/admin.env server.mjs)  -> http://localhost:4310/allsee/
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const BASE = '/allsee';
const PORT = Number(process.env.PORT) || 4310;
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = path.resolve(process.env.ALLSEE_DATA_DIR || path.join(ROOT, '.data'));
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const SHOTS_DIR = path.join(DATA_DIR, 'shots');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const SEED_FILE = path.join(ROOT, 'data', 'seed.json');
const REVISION = readText(path.join(ROOT, 'REVISION')) || 'dev';
const PASSWORD_HASH = process.env.ALLSEE_PASSWORD_HASH || '';
const SECRET = process.env.ALLSEE_SECRET || '';
const SESSION_DAYS = 30;

if (!/^scrypt:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(PASSWORD_HASH) || SECRET.length < 32) {
  console.error('ALLSEE_PASSWORD_HASH and ALLSEE_SECRET are missing. Run: node tools/set-password.mjs');
  process.exit(1);
}

function readText(file) { try { return fs.readFileSync(file, 'utf8').trim(); } catch { return ''; } }

// ---------- data ----------
const KINDS = ['client', 'product', 'tool'];
const PLACES = ['live', 'local', 'github'];
const SORTS = ['manual', 'recent', 'updated', 'az'];
const SETTING_LIMITS = { brand: 40, placeholder: 60, hint: 200, localTitle: 80, localText: 300, ghTitle: 80, ghText: 300, footer: 300 };

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max) : '');
const list = v => (Array.isArray(v) ? v : []);
function link(v) {
  const s = str(v, 600);
  if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; }
}
const repoName = v => { const s = str(v, 100); return /^[A-Za-z0-9._-]+$/.test(s) ? s : ''; };
const folderName = v => { const s = str(v, 100); return s && !/[\\/:*?"<>|]/.test(s) && s !== '.' && s !== '..' ? s : ''; };

function cleanSite(s) {
  if (!s || typeof s !== 'object' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(s.id)) throw new Error('bad site id');
  return {
    id: s.id,
    name: str(s.name, 80) || 'ללא שם',
    sub: str(s.sub, 80),
    what: str(s.what, 400),
    kind: KINDS.includes(s.kind) ? s.kind : 'client',
    place: PLACES.includes(s.place) ? s.place : 'live',
    url: link(s.url),
    signIn: s.signIn === true,
    shot: /^[a-z0-9-]{1,80}\.(jpg|png|webp)$/.test(s.shot) ? s.shot : '',
    extra: list(s.extra).slice(0, 8).map(e => ({ label: str(e?.label, 40), url: link(e?.url), admin: e?.admin === true })).filter(e => e.label && e.url),
    local: link(s.local),
    repo: repoName(s.repo),
    repos: list(s.repos).map(repoName).filter(Boolean).slice(0, 8),
    folders: list(s.folders).map(folderName).filter(Boolean).slice(0, 6),
    updated: /^\d{4}-\d{2}-\d{2}$/.test(s.updated) ? s.updated : '',
    tags: str(s.tags, 500),
    hidden: s.hidden === true,
  };
}
function cleanDoc(input, rev) {
  if (!input || typeof input !== 'object') throw new Error('bad body');
  const raw = input.settings || {};
  const settings = {};
  for (const [k, max] of Object.entries(SETTING_LIMITS)) settings[k] = str(raw[k], max);
  settings.brand ||= 'AllSee';
  settings.kinds = Object.fromEntries(KINDS.map(k => [k, str(raw.kinds?.[k], 40) || k]));
  settings.defaultSort = SORTS.includes(raw.defaultSort) ? raw.defaultSort : 'manual';
  const sites = list(input.sites).slice(0, 300).map(cleanSite);
  if (new Set(sites.map(s => s.id)).size !== sites.length) throw new Error('duplicate site id');
  return { rev, settings, sites };
}

let doc;
async function loadDoc() {
  await fsp.mkdir(SHOTS_DIR, { recursive: true });
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  let raw;
  try { raw = JSON.parse(await fsp.readFile(DATA_FILE, 'utf8')); }
  catch (e) {
    if (e.code !== 'ENOENT') throw e;
    raw = JSON.parse(await fsp.readFile(SEED_FILE, 'utf8'));
    await writeAtomic(DATA_FILE, JSON.stringify(cleanDoc(raw, 1), null, 2));
  }
  doc = cleanDoc(raw, Number(raw.rev) || 1);
}
async function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, text);
  await fsp.rename(tmp, file);
}
async function saveDoc(next) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fsp.copyFile(DATA_FILE, path.join(BACKUP_DIR, `data-${stamp}-rev${doc.rev}.json`)).catch(() => {});
  await writeAtomic(DATA_FILE, JSON.stringify(next, null, 2));
  doc = next;
  const old = (await fsp.readdir(BACKUP_DIR)).filter(f => f.endsWith('.json')).sort().slice(0, -40);
  await Promise.all(old.map(f => fsp.rm(path.join(BACKUP_DIR, f), { force: true })));
}
const publicDoc = () => ({ ...doc, sites: doc.sites.filter(s => !s.hidden) });

// ---------- auth ----------
function verifyPassword(password) {
  const [, saltB64, hashB64] = PASSWORD_HASH.split(':');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(String(password).normalize('NFC'), Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}
const sign = v => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
function makeToken() {
  const payload = `${Date.now() + SESSION_DAYS * 864e5}.${crypto.randomBytes(9).toString('base64url')}`;
  return `${payload}.${sign(payload)}`;
}
function isAdmin(req) {
  const m = /(?:^|;\s*)allsee=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const i = m[1].lastIndexOf('.');
  if (i < 0) return false;
  const payload = m[1].slice(0, i), mac = Buffer.from(m[1].slice(i + 1));
  const good = Buffer.from(sign(payload));
  if (mac.length !== good.length || !crypto.timingSafeEqual(mac, good)) return false;
  return Number(payload.split('.')[0]) > Date.now();
}
const secure = req => req.headers['x-forwarded-proto'] === 'https';
function cookie(req, value, maxAge) {
  return `allsee=${value}; Path=${BASE}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure(req) ? '; Secure' : ''}`;
}
// Mutations must come from this page, not another site.
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
const attempts = new Map();
function clientIp(req) { return req.headers['x-real-ip'] || req.socket.remoteAddress || '?'; }
function limited(ip) {
  const a = attempts.get(ip);
  return a && a.until > Date.now() && a.count >= 6;
}
function failed(ip) {
  const a = attempts.get(ip);
  if (!a || a.until < Date.now()) attempts.set(ip, { count: 1, until: Date.now() + 15 * 60e3 });
  else a.count++;
}

// ---------- http helpers ----------
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";
function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY, ...headers });
  res.end(body);
}
const json = (res, status, data, headers = {}) =>
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limit = 1 << 20) {
  try { return JSON.parse((await readBody(req, limit)).toString('utf8')); }
  catch (e) { throw Object.assign(e, { status: e.status || 400 }); }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
async function sendFile(res, file, cache) {
  try {
    const data = await fsp.readFile(file);
    send(res, 200, data, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': cache });
    return true;
  } catch { return false; }
}
const pageTemplate = () => fsp.readFile(path.join(PUBLIC, 'index.html'), 'utf8');
async function sendPage(req, res) {
  const admin = isAdmin(req);
  const boot = JSON.stringify({ doc: admin ? doc : publicDoc(), admin, revision: REVISION }).replace(/</g, '\\u003c');
  const html = (await pageTemplate()).replace('<!--BOOT-->', `<script id="boot" type="application/json">${boot}</script>`);
  send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': CSP });
}
function sniffImage(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return '';
}

// ---------- routes ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const method = req.method;

  if (p === BASE) return send(res, 308, '', { Location: `${BASE}/` });
  if (!p.startsWith(`${BASE}/`)) return send(res, 404, 'Not found');
  const route = p.slice(BASE.length);

  if (method === 'GET' && route === '/admin/') return send(res, 308, '', { Location: `${BASE}/admin` });
  if (method === 'GET' && (route === '/' || route === '/admin')) return sendPage(req, res);

  if (route.startsWith('/api/')) {
    const api = route.slice(4);
    if (method === 'GET' && api === '/health') return json(res, 200, { ok: true, revision: REVISION, rev: doc.rev, sites: doc.sites.length });
    if (method === 'GET' && api === '/data') return json(res, 200, { doc: isAdmin(req) ? doc : publicDoc(), admin: isAdmin(req) });

    if (method !== 'POST' && method !== 'PUT') return json(res, 405, { error: 'method' });
    if (!sameOrigin(req)) return json(res, 403, { error: 'origin' });

    if (api === '/login') {
      const ip = clientIp(req);
      if (limited(ip)) return json(res, 429, { error: 'יותר מדי ניסיונות. נסו שוב בעוד רבע שעה.' });
      const body = await readJson(req, 4096);
      if (typeof body.password !== 'string' || !verifyPassword(body.password)) {
        failed(ip);
        return json(res, 401, { error: 'הסיסמה לא נכונה.' });
      }
      attempts.delete(ip);
      return json(res, 200, { doc }, { 'Set-Cookie': cookie(req, makeToken(), SESSION_DAYS * 86400) });
    }
    if (api === '/logout') return json(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, '', 0) });

    if (!isAdmin(req)) return json(res, 401, { error: 'צריך להתחבר מחדש.' });

    if (method === 'PUT' && api === '/data') {
      const body = await readJson(req);
      if (Number(body.baseRev) !== doc.rev) return json(res, 409, { error: 'הרשימה נשמרה בינתיים ממקום אחר.', doc });
      let next;
      try { next = cleanDoc(body, doc.rev + 1); } catch (e) { return json(res, 400, { error: `הנתונים לא תקינים (${e.message}).` }); }
      await saveDoc(next);
      return json(res, 200, { doc });
    }
    if (method === 'POST' && api === '/shot') {
      const id = url.searchParams.get('id') || '';
      if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) return json(res, 400, { error: 'מזהה לא תקין.' });
      const buf = await readBody(req, 5 << 20);
      const ext = sniffImage(buf);
      if (!ext) return json(res, 415, { error: 'אפשר להעלות רק JPG, PNG או WebP.' });
      const name = `${id}-${Date.now().toString(36)}.${ext}`;
      await fsp.writeFile(path.join(SHOTS_DIR, name), buf);
      return json(res, 200, { shot: name });
    }
    return json(res, 404, { error: 'not found' });
  }

  if (method === 'GET' && route.startsWith('/shots/')) {
    const name = route.slice(7);
    if (!/^[a-z0-9-]{1,80}\.(jpg|png|webp)$/.test(name)) return send(res, 404, 'Not found');
    if (await sendFile(res, path.join(SHOTS_DIR, name), 'public, max-age=31536000, immutable')) return;
    if (await sendFile(res, path.join(PUBLIC, 'shots', name), 'public, max-age=3600')) return;
    return send(res, 404, 'Not found');
  }
  if (method === 'GET' && /^\/[a-z0-9-]+\.(js|css|svg|ico)$/.test(route)) {
    if (await sendFile(res, path.join(PUBLIC, route.slice(1)), 'no-cache')) return;
  }
  send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
}

await loadDoc();
http.createServer((req, res) => {
  handle(req, res).catch(err => {
    if (!res.headersSent) json(res, err.status || 500, { error: err.status ? 'בקשה לא תקינה.' : 'שגיאת שרת.' });
    if (!err.status) console.error(err);
  });
}).listen(PORT, HOST, () => console.log(`AllSee ${REVISION} on http://${HOST === '127.0.0.1' ? 'localhost' : HOST}:${PORT}${BASE}/  (data: ${DATA_DIR})`));
