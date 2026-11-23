/* ME.Coach — client (vanilla JS, no framework, no third-party services).
 * Offline-first: everything is cached on the device and changes queue in an outbox.
 * Sync: api.php merges record by record (newest updatedAt wins), so iPhone and iPad
 * can both edit and converge. Deletes are soft (deleted:true) so nothing is lost. */
(() => {
'use strict';

const VERSION = '11.0.0';
const API = 'api.php';
const K = { db: 'mec.db', out: 'mec.outbox', tok: 'mec.token', rev: 'mec.rev', ui: 'mec.ui', last: 'mec.lastSync', user: 'mec.user' };
const COLS = ['tasks','events','projects','goals','skills','logs','evidence','decisions','notes','ielts','sessions','settings','milestones','applications','immigration','habits','money','templates','courses','areas','wheel','cycles','focus','products','tests','careers'];
const STATES = ['To do','Doing','Waiting','Done','Cancelled'];
const LEGACY = { 'Not Started': 'To do', 'Waiting for Me': 'To do', 'In Progress': 'Doing', 'Ready for Review': 'Doing', 'Waiting for External Input': 'Waiting', 'Blocked': 'Waiting', 'Completed & Verified': 'Done', 'Completed - Not Verified': 'Done', 'Cancelled': 'Cancelled' };
const stOf = t => STATES.includes(t.state) ? t.state : (LEGACY[t.state] || 'To do');
const DONE = { has: s => s === 'Done' || s === 'Cancelled' || /^Completed/.test(s || '') };
const PRI = ['P1','P2','P3'];
const OWNERS = ['Me','Someone else'];
const AREAS = ['Migration','English & Education','Technical Skills','Career & Tathmeer','Personal Brand','Finance','Personal & Sustainability'];
const SCHED = ['Focus session','Fixed deadline','Flexible'];
const EVIDENCE_STATES = ['MISSING','NOT AVAILABLE','REQUESTED','RECOVERED','VERIFIED','USER-REPORTED','INFERRED','PROPOSED','UNVERIFIED'];
const PROJECT_STATES = ['Planned','In progress','On hold','Done','Cancelled'];
const GOAL_STATES = ['Not started','In progress','On track','At risk','Achieved','Dropped'];
const DECISION_STATES = ['Open','Decided','Closed'];
const IELTS_KINDS = ['Self-estimate (not an IELTS score)','Assessor estimate (not official)','Official IELTS result'];
const SKILL_STATES = ['Not started','Learning','Practising','Competence shown'];
const MS_STATES = ['Planned','In progress','Done','At risk','Dropped'];
const APP_STAGES = ['Saved','Applied','Screening','Interview','Offer','Rejected','Withdrawn'];
const APP_ACTIVE = ['Saved','Applied','Screening','Interview','Offer'];
const IMM_CATS = ['Identity','Education','Employment','English test','Finance','Police & health','Forms & fees','Other'];
const IMM_STATES = ['Not started','Collecting','Ready','Submitted','Not needed'];

/* ---------------- storage ---------------- */
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast('Device storage is full or blocked'); return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
let db = blankDb();
let outbox = {};            // "collection:id" -> record
let ui = Object.assign({ taskFilter: 'active', taskQuery: '', calMonth: null, calSel: null, noteQuery: '' }, ls.get(K.ui, {}));
let syncState = 'ok', syncing = false, syncAgain = false, syncTimer = null, lastError = '';

function blankDb() { const o = {}; COLS.forEach(c => o[c] = {}); return o; }
function normalise(cols) { const o = blankDb(); for (const c of COLS) { const src = cols && cols[c]; if (src && typeof src === 'object') { for (const [id, r] of Object.entries(src)) { if (r && typeof r === 'object') o[c][id] = r; } } } return o; }
function persist() { ls.set(K.db, db); ls.set(K.out, outbox); }
function saveUi() { ls.set(K.ui, ui); }

/* ---------------- helpers ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nowIso = () => new Date().toISOString();
const pad = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dstr(new Date());
function addDays(s, n) { const d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); }
function parseD(s) { if (!s) return null; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); } const d = new Date(s); return isNaN(d) ? null : d; }
function dayOf(s) { if (!s) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = parseD(s); return d ? dstr(d) : ''; }
function tzOffset() { const m = -new Date().getTimezoneOffset(); const s = m >= 0 ? '+' : '-'; const a = Math.abs(m); return `${s}${pad(Math.floor(a / 60))}:${pad(a % 60)}`; }
function toInput(s) { if (!s) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + 'T09:00'; const d = parseD(s); return d ? `${dstr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}` : ''; }
function fromInput(v) { return v ? v.slice(0, 16) + tzOffset() : ''; }
function fmtDate(s, withYear) { const d = parseD(s); if (!d) return ''; return d.toLocaleDateString(LOC(), { weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }); }
function fmtTime(s) { if (!s || s.length <= 10) return ''; const d = parseD(s); return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : ''; }
function rel(s) { const t = today(); if (!s) return ''; const n = Math.round((parseD(s) - parseD(t)) / 86400000); if (n === 0) return 'today'; if (n === 1) return 'tomorrow'; if (n === -1) return 'yesterday'; return n < 0 ? `${-n}d late` : `in ${n}d`; }
function toast(msg, label, fn) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  if (label && fn) { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { t.remove(); fn(); }; t.appendChild(b); }
  document.body.appendChild(t); setTimeout(() => t.remove(), label ? 5000 : 2400);
}
const list = c => Object.values(db[c] || {}).filter(r => r && !r.deleted);
const get = (c, id) => { const r = db[c] && db[c][id]; return r && !r.deleted ? r : null; };
const isOpen = t => !DONE.has(t.state);
const device = () => /iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document ? 'iPad' : /iPhone/.test(navigator.userAgent) ? 'iPhone' : 'Browser';

/* ---------------- data writes ---------------- */
let me = ls.get(K.user, null);
function save(c, rec) {
  if (me && me.access === false) { paywall(); return Object.assign({}, rec); }
  const r = Object.assign({}, rec);
  if (!r.id) r.id = uid(c.slice(0, 3));
  if (!r.createdAt) r.createdAt = nowIso();
  r.updatedAt = nowIso();
  r.by = device();
  db[c][r.id] = r; outbox[c + ':' + r.id] = r;
  persist(); queueSync(); render();
  return r;
}
function remove(c, id) { const r = db[c][id]; if (!r) return; save(c, Object.assign({}, r, { deleted: true })); }

/* ---------------- sync ---------------- */
async function api(action, opts = {}) {
  const tok = ls.get(K.tok);
  const headers = { 'Content-Type': 'application/json' };
  if (tok) { headers.Authorization = 'Bearer ' + tok; headers['X-Auth-Token'] = tok; }
  let r;
  try { r = await fetch(`${API}?action=${action}${opts.q || ''}`, { method: opts.body ? 'POST' : (opts.method || 'GET'), headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store', credentials: 'same-origin' }); }
  catch { throw new Error('offline'); }
  let j = null; try { j = await r.json(); } catch {}
  if (!j) throw new Error(`Server error (${r.status})`);
  if (r.status === 402) { if (me) { me.access = false; ls.set(K.user, me); } setTimeout(paywall, 0); throw new Error('auth'); }
  if (r.status === 401 && action !== 'login' && action !== 'signup' && action !== 'password') {
    // Only sign out when the server says the token itself is no longer valid.
    if (j.error === 'Session expired' || !tok) { ls.del(K.tok); showLanding(); }
    else setSyncState('err', 'Server did not receive the sign-in token (' + (j.error || 401) + ')');
    throw new Error('auth');
  }
  if (!j.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
function queueSync(delay = 1200) { clearTimeout(syncTimer); syncTimer = setTimeout(sync, delay); setSyncState(Object.keys(outbox).length ? 'pending' : syncState); }
function setSyncState(s, err) { syncState = s; if (err !== undefined) lastError = err; const el = $('#syncind'); if (el) el.outerHTML = syncHtml(); }
function syncHtml() {
  const pending = Object.keys(outbox).length;
  const last = ls.get(K.last);
  const label = syncState === 'off' ? 'offline' : pending ? `${pending} to sync` : last ? 'synced ' + fmtTime(last) : 'synced';
  return `<span class="sync" id="syncind" title="${esc(lastError)}"><i class="dot ${syncState === 'off' ? 'off' : pending ? 'pending' : ''}"></i><span class="sync-l">${esc(label)}</span></span>`;
}
async function sync() {
  if (!ls.get(K.tok)) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  try {
    const sent = Object.entries(outbox).map(([k, r]) => [k, r.updatedAt]);
    let j;
    if (sent.length) j = await api('push', { body: { changes: Object.entries(outbox).map(([k, r]) => ({ c: k.split(':')[0], r })) } });
    else j = await api('pull', { q: '&since=' + encodeURIComponent(ls.get(K.rev) ?? '') });
    for (const [k, ts] of sent) { if (outbox[k] && outbox[k].updatedAt === ts) delete outbox[k]; }
    if (!sent.length && !j.unchanged && Number(j.rev) === 0) {   // server was reset or reinstalled: restore it from this device instead of wiping the device
      let n = 0; for (const c of COLS) for (const r of Object.values(db[c] || {})) { if (r && r.id) { outbox[c + ':' + r.id] = r; n++; } }
      if (n) { persist(); toast(`The server was empty. Restoring ${n} records from this device…`); syncAgain = true; return; }
    }
    if (!j.unchanged && j.collections) {
      const server = normalise(j.collections);
      for (const c of COLS) if (!(c in j.collections)) server[c] = db[c];   // an older server does not know this collection: keep ours
      if (j.version !== VERSION && !sync.warned) { sync.warned = true; toast(`The server part is version ${j.version || 'old'}, the app is ${VERSION}. Re-upload the full zip so both match.`); }
      for (const [k, r] of Object.entries(outbox)) { server[k.split(':')[0]][r.id] = r; }
      db = server; migrate();
    }
    ls.set(K.rev, j.rev); ls.set(K.last, nowIso()); persist();
    setSyncState('ok', '');
    try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (tz && !sync.tzDone) { sync.tzDone = true; if (prefs().tz !== tz) save('settings', Object.assign({}, prefs(), { id: 'prefs', tz })); } } catch {}
    if (!j.unchanged) render();
  } catch (e) {
    if (e.message !== 'auth') setSyncState(e.message === 'offline' ? 'off' : 'pending', e.message);
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; queueSync(300); }
  }
}

/* ---------------- recurrence ---------------- */
const WD = ['SU','MO','TU','WE','TH','FR','SA'];
function parseRule(s) { const o = {}; String(s || '').split(';').forEach(p => { const [k, v] = p.split('='); if (k && v) o[k.toUpperCase()] = v.toUpperCase(); }); return o; }
function occurrences(ev, from, to) {
  const start = parseD(ev.start); if (!start) return [];
  const sDay = dayOf(ev.start);
  const dur = ev.end ? Math.max(0, parseD(ev.end) - start) : 0;
  const ex = new Set((ev.exdates || []).map(dayOf));
  const mk = day => { const d = parseD(day); if (!ev.allDay && ev.start.length > 10) d.setHours(start.getHours(), start.getMinutes()); return { day, start: d, end: dur ? new Date(d.getTime() + dur) : null }; };
  if (!ev.rrule) return sDay >= from && sDay <= to && !ex.has(sDay) ? [mk(sDay)] : [];
  const r = parseRule(ev.rrule), freq = r.FREQ || 'WEEKLY', interval = Math.max(1, parseInt(r.INTERVAL || '1', 10));
  const count = r.COUNT ? parseInt(r.COUNT, 10) : Infinity;
  const until = r.UNTIL ? `${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}` : '9999-12-31';
  const byday = r.BYDAY ? r.BYDAY.split(',').map(x => x.slice(-2)) : [WD[start.getDay()]];
  const out = []; let n = 0; let d = parseD(sDay); const s0 = parseD(sDay);
  const weekStart = new Date(s0); weekStart.setDate(s0.getDate() - s0.getDay());
  for (let i = 0; i < 1500 && n < count; i++) {
    const day = dstr(d); if (day > until || day > to) break;
    let hit = false;
    if (freq === 'DAILY') hit = Math.round((d - s0) / 86400000) % interval === 0;
    else if (freq === 'WEEKLY') hit = Math.floor(Math.round((d - weekStart) / 86400000) / 7) % interval === 0 && byday.includes(WD[d.getDay()]);
    else if (freq === 'MONTHLY') hit = d.getDate() === s0.getDate() && ((d.getFullYear() - s0.getFullYear()) * 12 + d.getMonth() - s0.getMonth()) % interval === 0;
    else if (freq === 'YEARLY') hit = d.getDate() === s0.getDate() && d.getMonth() === s0.getMonth();
    if (hit) { n++; if (day >= from && !ex.has(day)) out.push(mk(day)); }
    d.setDate(d.getDate() + 1);
  }
  return out;
}
/** Everything that lands on a day: event occurrences, scheduled tasks, due tasks. */
function agenda(from, to) {
  const items = [];
  for (const ev of list('events')) for (const o of occurrences(ev, from, to)) items.push({ kind: 'event', day: o.day, time: ev.allDay ? '' : `${pad(o.start.getHours())}:${pad(o.start.getMinutes())}`, end: o.end && !ev.allDay ? `${pad(o.end.getHours())}:${pad(o.end.getMinutes())}` : '', title: ev.title, id: ev.id, rec: ev });
  for (const t of list('tasks')) {
    if (!isOpen(t)) continue;
    const sd = dayOf(t.scheduled); if (sd && sd >= from && sd <= to) items.push({ kind: 'task', day: sd, time: fmtTime(t.scheduled), end: fmtTime(t.scheduledEnd), title: t.title, id: t.id, rec: t });
    const dd = dayOf(t.due); if (dd && dd >= from && dd <= to && dd !== sd) items.push({ kind: 'due', day: dd, time: '', title: t.title, id: t.id, rec: t });
  }
  for (const a of list('applications')) { const d = a.followUp; if (d && APP_ACTIVE.includes(a.stage || 'Saved') && d >= from && d <= to) items.push({ kind: 'follow', day: d, time: '', title: 'Follow up: ' + [a.role, a.company].filter(Boolean).join(' · '), id: a.id, rec: a }); }
  for (const m of list('milestones')) { const d = m.target; if (d && d >= from && d <= to && m.status !== 'Done' && m.status !== 'Dropped') items.push({ kind: 'ms', day: d, time: '', title: 'Milestone: ' + m.title, id: m.id, rec: m }); }
  return items.sort((a, b) => (a.day + (a.time || '00:00')).localeCompare(b.day + (b.time || '00:00')));
}

/* ---------------- markdown (safe subset) ---------------- */
function inline(s) {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => /^(https?:|mailto:|#|\.\/|\/)/i.test(url.replace(/&amp;/g, '&')) ? `<a href="${url}" target="_blank" rel="noopener">${txt}</a>` : txt);
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  return t;
}
function md(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n'); const out = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
    const h = l.match(/^(#{1,3})\s+(.*)/); if (h) { out.push(`<h${h[1].length} dir="auto">${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^\|/.test(l)) { const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]); const cells = r => r.replace(/^\||\|$/g, '').split('|').map(x => x.trim()); let html = '<table>'; rows.forEach((r, k) => { if (/^[\s|:\-]+$/.test(r)) return; const tag = k === 0 ? 'th' : 'td'; html += '<tr>' + cells(r).map(c => `<${tag} dir="auto">${inline(c)}</${tag}>`).join('') + '</tr>'; }); out.push(html + '</table>'); continue; }
    if (/^\s*[-*]\s+/.test(l)) { const buf = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*]\s+/, '')); out.push('<ul>' + buf.map(x => `<li dir="auto">${inline(x.replace(/^\[( |x)\]\s*/i, m => m.includes('x') || m.includes('X') ? '☑ ' : '☐ '))}</li>`).join('') + '</ul>'); continue; }
    if (/^\s*\d+[.)]\s+/.test(l)) { const buf = []; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+[.)]\s+/, '')); out.push('<ol>' + buf.map(x => `<li dir="auto">${inline(x)}</li>`).join('') + '</ol>'); continue; }
    if (/^>\s?/.test(l)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, '')); out.push(`<blockquote dir="auto">${inline(buf.join(' '))}</blockquote>`); continue; }
    if (!l.trim()) { i++; continue; }
    const buf = []; while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|\||\s*[-*]\s|\s*\d+[.)]\s|>)/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p dir="auto">${buf.map(inline).join('<br>')}</p>`);
  }
  return out.join('');
}

/* ---------------- icons ---------------- */
const I = {
  course: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M9 8h7M9 12h5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  prog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/></svg>',
  journal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 3h11a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1z"/><path d="M9 8h6M9 12h6M5 17a2 2 0 0 1 2-2h12"/></svg>',
  tmpl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M3 10h2M19 15h2"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>',
  jobs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></svg>',
  imm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="2.5" width="14" height="19" rx="2"/><circle cx="12" cy="10" r="3.2"/><path d="M8.8 10h6.4M12 6.8c-1.2 1.5-1.2 4.9 0 6.4M12 6.8c1.2 1.5 1.2 4.9 0 6.4M9 17h6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
  learn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10v5c3 2.5 9 2.5 12 0v-5"/></svg>',
  evid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14l2 2 4-4"/></svg>',
  dec: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v18M5 7h14l-2 5H7z"/></svg>',
  notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 3h10l4 4v14H5z"/><path d="M9 11h6M9 15h6M9 7h3"/></svg>',
  review: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 8v5l3 2"/></svg>',
  set: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  tick: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12l5 5 9-10"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>'
};
const S = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
Object.assign(I, {
  star: S('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z"/>'), dot: S('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>'),
  skip: S('<path d="M5 6l7 6-7 6zM13 6l7 6-7 6z"/>'), pause: S('<path d="M8 5v14M16 5v14"/>'), repeat: S('<path d="M4 11a8 8 0 0 1 14-4.5L20 9M20 4v5h-5M20 13a8 8 0 0 1-14 4.5L4 15M4 20v-5h5"/>'),
  edit: S('<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>'), undo: S('<path d="M8 5L4 9l4 4M4 9h10a5 5 0 0 1 0 10h-3"/>'), flame: S('<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-1.8.8-3 1.8-4 .2 1.5 1 2.2 2 2.2C11 9 10.5 6 12 3z"/>'),
  pin: S('<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>'), spark: S('<path d="M12 4v5M12 15v5M4 12h5M15 12h5M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5L15 9M9 15l-2.5 2.5"/>'), arrow: S('<path d="M5 12h14M13 6l6 6-6 6"/>'), go: S('<path d="M9 6l6 6-6 6"/>')
});
const GLYPH = { '✓': I.tick, '★': I.star, '●': I.dot, '→': I.arrow, '⇥': I.skip, '📅': I.cal, '⏸': I.pause, '▶': I.play, '◷': I.timer, '↻': I.repeat, '⟳': I.repeat, '✎': I.edit, '🗑': I.trash, '↺': I.undo, '✕': I.close, '≡': I.tasks, '+': I.plus, '⏰': I.bell };
const icoize = h => String(h).replace(/<span>([^<]{1,3})<\/span>/gu, (m, g) => GLYPH[g] ? `<span class="ai">${GLYPH[g]}</span>` : m).replace(/🔥 ?/g, `<i class="ii fl">${I.flame}</i>`).replace(/🕘 ?/g, `<i class="ii">${I.clock}</i>`).replace(/📌 ?/g, `<i class="ii">${I.pin}</i>`).replace(/✨ ?/g, `<i class="ii">${I.spark}</i>`).replace(/★ /g, `<i class="ii st">${I.star}</i>`);
const NAV_MAIN = [['today', 'Today', I.today], ['calendar', 'Calendar', I.cal], ['life', 'Life', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></svg>'], ['discover', 'Discover', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z"/></svg>'], ['hub', 'More', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>']];
Object.assign(I, { board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="5" height="15" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/></svg>', calm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 21c-4-2.5-7-6-7-10a7 7 0 0 1 14 0c0 4-3 7.5-7 10z"/><path d="M12 8v6M9 11h6"/></svg>', users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/></svg>' });
const NAV_MORE = [['projects', 'Boards', I.board], ['calm', 'Calm', I.calm], ['products', 'Products', I.money], ['jobs', 'Job search', I.jobs], ['admin', 'Members', I.users], ['settings', 'Settings', I.set]];
const P_TABS = [['overview', 'Coach'], ['insights', 'Insights'], ['wheel', 'Wheel'], ['goals', 'Goals'], ['roadmap', 'Roadmap'], ['learning', 'Learning'], ['money', 'Money']];

/* ---------------- chips ---------------- */
function stateChip(s0) { const s = STATES.includes(s0) ? s0 : (LEGACY[s0] || 'To do'); const c = s === 'Done' ? 's-done' : s === 'Waiting' ? 's-wait' : s === 'Doing' ? 's-prog' : ''; return s === 'To do' ? '' : `<span class="chip ${c}">${esc(s)}</span>`; }
const priChip = p => p ? `<span class="chip ${esc(p.toLowerCase())}">${esc(p)}</span>` : '';
function dueChip(t) { if (!t.due) return ''; const late = isOpen(t) && t.due < today(); const r = rel(t.due); return `<span class="chip ${late ? 'late' : ''}">${esc(/^(today|tomorrow|yesterday)$/.test(r) ? r[0].toUpperCase() + r.slice(1) : fmtDate(t.due))}</span>`; }

function taskRow(t, opts = {}) {
  const proj = t.projectId && get('projects', t.projectId);
  return `<div class="row" data-act="task" data-id="${esc(t.id)}">
    <button class="check ${DONE.has(t.state) ? 'done' : ''}" data-act="complete" data-id="${esc(t.id)}" aria-label="Complete">${I.tick}</button>
    <div class="main"><div class="t" dir="auto">${esc(t.title)}</div>
      <div class="m">${isOpen(t) && t.focusDate === today() ? '<span class="chip s-rev">★ Top 3</span>' : ''}${t.priority === 'P1' && isOpen(t) ? priChip('P1') : ''}${stOf(t) === 'Waiting' ? stateChip('Waiting') : ''}${isOpen(t) ? dueChip(t) : ''}${t.scheduled && isOpen(t) ? `<span>🕘 ${esc(fmtTime(t.scheduled))}</span>` : ''}${t.repeat && isOpen(t) ? '<span>↻</span>' : ''}</div>
      ${opts.na !== false && t.nextAction ? `<div class="na" dir="auto">→ ${esc(t.nextAction)}</div>` : ''}</div></div>`;
}
const sortTasks = arr => arr.sort((a, b) => (a.priority || 'P9').localeCompare(b.priority || 'P9') || (a.due || '9999').localeCompare(b.due || '9999') || String(a.title).localeCompare(String(b.title)));

/* ---------------- appearance ---------------- */
const darkMq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
  const m = ui.theme || 'auto'; const dark = m === 'dark' || (m === 'auto' && darkMq && darkMq.matches);
  const h = document.documentElement; h.classList.toggle('dark', dark); h.classList.toggle('large', ui.size === 'large');
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = dark ? '#0f1824' : '#22344a';
}
if (darkMq && darkMq.addEventListener) darkMq.addEventListener('change', applyTheme);
applyTheme();

/* ---------------- language (English / Persian) ---------------- */
const RTL = () => ui.lang === 'fa' || ui.lang === 'ar';
const LOC = () => ui.lang === 'fa' ? 'fa-IR' : ui.lang === 'ar' ? 'ar-OM' : 'en-GB';
const dowS = (d, n) => RTL() ? parseD(d).toLocaleDateString(LOC(), { weekday: n === 2 ? 'narrow' : 'short' }) : DOWS[parseD(d).getDay()].slice(0, n);
const LD = () => (ui.lang === 'ar' ? window.M2031_AR : window.M2031_FA) || { dict: {}, rx: [] };
function trStr(s) {
  const t = s.trim(); if (!t || /^[\d\s.,:/+\-–%★✓↻→←·()]+$/.test(t)) return null;
  const D = LD(); let r = D.dict[t]; if (r === undefined) for (const [rx, rep] of D.rx) if (rx.test(t)) { r = t.replace(rx, rep); break; }
  if (r === undefined) { const m = t.match(/^([^A-Za-z(]+?)\s*([A-Za-z(].*?)\s*([↗→]?)$/); if (m && m[2] !== t) { const c = D.dict[m[2]]; if (c !== undefined) r = (m[1] ? m[1] + ' ' : '') + c + (m[3] ? ' ' + m[3] : ''); } else { const n = t.match(/^(.*?[A-Za-z.!?)])\s*([↗→])$/); if (n && D.dict[n[1]] !== undefined) r = D.dict[n[1]] + ' ' + n[2]; } }
  return r === undefined ? null : s.replace(t, r);
}
function trNode(root) {
  if (!RTL() || !root) return;
  if (root.nodeType === 3) { const p = root.parentElement; if (p && !p.closest('[dir=auto],.mono,textarea,script,style,.ft')) { const r = trStr(root.nodeValue); if (r !== null) root.nodeValue = r; } return; }
  if (root.nodeType !== 1 || root.closest('[dir=auto],.mono,script,style')) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeType === 1 && n.matches('[dir=auto],.mono,textarea,script,style,svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const els = [root]; let n; const texts = [];
  while ((n = w.nextNode())) { if (n.nodeType === 3) texts.push(n); else els.push(n); }
  for (const t of texts) { const r = trStr(t.nodeValue); if (r !== null) t.nodeValue = r; }
  if (root.querySelectorAll) root.querySelectorAll('[placeholder]').forEach(el => { if (!els.includes(el)) els.push(el); });
  for (const el of els) for (const at of ['placeholder', 'aria-label', 'title']) { const v = el.getAttribute && el.getAttribute(at); if (v) { const r = trStr(v); if (r !== null) el.setAttribute(at, r); } }
}
new MutationObserver(ms => { if (!RTL()) return; for (const m of ms) m.addedNodes.forEach(trNode); }).observe(document.documentElement, { childList: true, subtree: true });
function applyLang() { const q = new URLSearchParams(location.search).get('lang'); if (q && ['en', 'fa', 'ar'].includes(q) && q !== ui.lang) { ui.lang = q; saveUi(); } const rtl = RTL(); const h = document.documentElement; h.lang = rtl ? ui.lang : 'en'; h.dir = rtl ? 'rtl' : 'ltr'; if (rtl) trNode(document.body); }
applyLang();

/* ---------------- notifications (Web Push) ---------------- */
const pushOk = () => location.protocol === 'https:' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const b64uBytes = s => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function pushSub() { try { const r = await navigator.serviceWorker.ready; return await r.pushManager.getSubscription(); } catch { return null; } }
function pushTimes() { return `<div class="fgrid" style="margin:10px 0 4px"><div class="f"><label for="push-m">Morning: Top 3</label><input type="time" id="push-m" value="${esc(ui.pushMorning ?? '07:30')}"></div><div class="f"><label for="push-e">Evening: close the day</label><input type="time" id="push-e" value="${esc(ui.pushEvening ?? '21:00')}"></div></div><div style="margin:-6px 0 10px">Leave a time empty to turn that reminder off.</div>`; }
async function pushPost(sub) {
  ui.pushMorning = ($('#push-m') || {}).value ?? ui.pushMorning; ui.pushEvening = ($('#push-e') || {}).value ?? ui.pushEvening; saveUi();
  await api('pushsub', { body: { sub: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', morning: ui.pushMorning || '', evening: ui.pushEvening || '', device: device() } });
}
async function pushRender() {
  const box = $('#pushbox'); if (!box) return;
  if (!pushOk()) {
    box.innerHTML = /iPhone|iPad|Macintosh/.test(navigator.userAgent) && !standalone() ? 'On iPhone and iPad, notifications work in the installed app only: Safari → Share → <b>Add to Home Screen</b>, then open MILAD 2031 from its icon and come back here (iOS 16.4 or later).' : 'Notifications need the installed app over HTTPS, in a browser that supports them.';
    return;
  }
  const sub = await pushSub(); if (!$('#pushbox')) return;
  if (!sub || Notification.permission !== 'granted') { box.innerHTML = `Get your Top 3 each morning and a reminder to close the day.${pushTimes()}<div class="btns"><button class="btn small primary" data-act="push-on">Turn on notifications</button></div>`; return; }
  box.innerHTML = `<b style="color:var(--ok)">On for this device.</b>${pushTimes()}<div class="btns"><button class="btn small primary" data-act="push-save">Save times</button><button class="btn small" data-act="push-test">Send a test</button><button class="btn small danger" data-act="push-off">Turn off</button></div><div id="croninfo" style="margin-top:12px"></div>`;
  try { const i = await api('pushinfo'); const ci = $('#croninfo'); if (ci) ci.innerHTML = `<b>One-time server setup</b> so reminders arrive on time: Hostinger hPanel → Advanced → <b>Cron Jobs</b> → Custom → every 15 minutes (*/15 * * * *) → paste this command:<div class="mono" style="word-break:break-all;margin:6px 0;padding:8px;background:var(--paper-dim);border-radius:8px">${esc(i.cronCmd)}</div><button class="btn small" data-act="copy" data-text="${esc(i.cronCmd)}">Copy command</button><div style="margin-top:6px">${i.lastCron ? 'Server check last ran ' + esc(fmtDate(i.lastCron, true) + ' ' + fmtTime(i.lastCron)) + '.' : '<span style="color:var(--warn)">The server check has not run yet.</span>'} Keep this command private.</div>`; } catch {}
}

/* ---------------- passkeys (Face ID) ---------------- */
const pkOk = () => !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
const toB64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function pkRegister() {
  try {
    const o = await api('wa-reg-opts');
    const cred = await navigator.credentials.create({ publicKey: { challenge: b64uBytes(o.challenge), rp: { id: o.rpId, name: 'ME.Coach' }, user: { id: b64uBytes(o.user), name: o.name || 'me', displayName: o.display || 'Me' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }], authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' }, excludeCredentials: (o.exclude || []).map(id => ({ type: 'public-key', id: b64uBytes(id) })), attestation: 'none', timeout: 60000 } });
    await api('wa-reg', { body: { id: cred.id, clientDataJSON: toB64u(cred.response.clientDataJSON), attestationObject: toB64u(cred.response.attestationObject), device: device() } });
    ui.pkSet = true; saveUi(); toast('Face ID sign-in is ready'); render();
  } catch (e) { toast(e.name === 'NotAllowedError' ? 'Cancelled' : e.name === 'InvalidStateError' ? 'This device already has a passkey' : 'Could not set up: ' + e.message); }
}
async function pkLogin(err) {
  try {
    const o = await api('wa-login-opts');
    const c = await navigator.credentials.get({ publicKey: { challenge: b64uBytes(o.challenge), rpId: o.rpId, allowCredentials: o.allow.map(id => ({ type: 'public-key', id: b64uBytes(id) })), userVerification: 'required', timeout: 60000 } });
    const j = await api('wa-login', { body: { id: c.id, clientDataJSON: toB64u(c.response.clientDataJSON), authenticatorData: toB64u(c.response.authenticatorData), signature: toB64u(c.response.signature), device: device() } });
    ls.set(K.tok, j.token); start();
  } catch (e) { if (err) err.textContent = e.name === 'NotAllowedError' ? 'Face ID was cancelled. Use your password.' : e.message; }
}
async function pkRender() {
  const box = $('#pkbox'); if (!box) return;
  if (!pkOk()) { box.innerHTML = 'Face ID sign-in needs HTTPS and iOS 16 or later.'; return; }
  try { const r = await api('wa-list'); if (!$('#pkbox')) return; box.innerHTML = (r.items.length ? `<div class="list" style="margin-bottom:8px">${r.items.map(p => `<div class="row"><div class="main"><div class="t">${esc(p.device || 'Device')}</div><div class="m"><span>added ${esc(fmtDate(p.created, true))}</span>${p.used ? `<span>last used ${esc(fmtDate(p.used, true))}</span>` : ''}</div></div><button class="btn small ghost danger" data-act="pk-del" data-id="${esc(p.id)}">Remove</button></div>`).join('')}</div>` : 'Sign in with Face ID or Touch ID instead of typing the password.') + `<div class="btns" style="margin-top:8px"><button class="btn small primary" data-act="pk-add">${r.items.length ? 'Add this device' : 'Set up Face ID'}</button></div>`; } catch { box.textContent = 'Could not load passkeys.'; }
}
/* ---------------- trash + history ---------------- */
const CNAME = { tasks: 'Task', events: 'Event', projects: 'Project', goals: 'Goal', skills: 'Skill', logs: 'Journal', evidence: 'Evidence', decisions: 'Decision', notes: 'Note', ielts: 'IELTS', sessions: 'Practice', milestones: 'Milestone', applications: 'Job', immigration: 'Document', habits: 'Habit', money: 'Savings', templates: 'Template' };
const recTitle = r => r.title || r.role || r.code || (r.amount !== undefined ? fmtMoney(r.amount) : '') || r.id;
function vTrash() {
  const items = []; for (const c of COLS) for (const r of Object.values(db[c] || {})) if (r && r.deleted) items.push([c, r]);
  items.sort((a, b) => String(b[1].updatedAt).localeCompare(String(a[1].updatedAt)));
  return header('Trash', 'Deleted items stay here. Restore any of them.') + `<div class="card">${items.length ? `<div class="list">${items.slice(0, 200).map(([c, r]) => `<div class="row"><div class="main"><div class="t" dir="auto">${esc(recTitle(r))}</div><div class="m"><span class="chip">${CNAME[c] || c}</span><span>deleted ${esc(fmtDate(r.updatedAt, true))}</span></div></div><button class="btn small" data-act="restore" data-c="${c}" data-id="${esc(r.id)}">Restore</button></div>`).join('')}</div>` : '<div class="empty">Trash is empty.</div>'}</div>`;
}
async function historySheet(c, id) {
  closeSheet(true); openSheet('History', '<div class="empty">Loading…</div>', '', { noFocus: true });
  try {
    const r = await api('history', { q: `&c=${encodeURIComponent(c)}&id=${encodeURIComponent(id)}` }); const cur = db[c][id] || {};
    const diff = v => Object.keys(Object.assign({}, v, cur)).filter(k => !['updatedAt', 'by', 'createdAt'].includes(k) && JSON.stringify(v[k] ?? '') !== JSON.stringify(cur[k] ?? '')).slice(0, 4).join(', ');
    sheetCtx && (sheetCtx.versions = r.versions);
    $('.sheet-b', sheetCtx.el).innerHTML = r.versions.length ? `<div class="small" style="margin-bottom:8px">Earlier versions saved on the server (latest first).</div><div class="list">${r.versions.map((v, i) => `<div class="row"><div class="main"><div class="t" dir="auto">${esc(recTitle(v))}</div><div class="m"><span>${esc(fmtDate(v.updatedAt, true) + ' ' + fmtTime(v.updatedAt))}</span><span>${esc(v.by || '')}</span>${diff(v) ? `<span>differs: ${esc(diff(v))}</span>` : ''}</div></div><button class="btn small" data-act="hist-restore" data-c="${c}" data-i="${i}">Restore</button></div>`).join('')}</div>` : '<div class="empty">No earlier versions yet. They are kept from version 3.0 onwards.</div>';
  } catch (e) { $('.sheet-b', sheetCtx.el).innerHTML = `<div class="empty">${esc(e.message === 'offline' ? 'History needs a connection.' : e.message)}</div>`; }
}
/* ---------------- health ---------------- */
async function vHealthFill() {
  const box = $('#hbox'); if (!box) return; const rows = [];
  const add = (ok, t, m) => rows.push(`<div class="row"><span class="hstat ${ok === true ? 'ok' : ok === false ? 'bad' : 'warn'}">${ok === true ? '✓' : ok === false ? '!' : '•'}</span><div class="main"><div class="t">${esc(t)}</div><div class="m">${esc(m)}</div></div></div>`);
  let h = null; try { h = await api('health'); } catch (e) { add(false, 'Server', e.message === 'offline' ? 'Offline. Checks will run when you are online.' : e.message); }
  if (h) {
    add(true, 'Server', `Version ${h.version} · PHP ${h.php} · revision ${h.rev}`);
    add(h.writable, 'Data folder', h.writable ? `Writable · data ${h.storeKB} KB · history ${h.historyKB} KB${h.outsideWebroot ? ' · outside the web folder' : ''}` : 'Not writable. Saving will fail. Check folder permissions in hPanel.');
    const bAge = h.lastBackup ? daysTo(`${h.lastBackup.slice(0, 4)}-${h.lastBackup.slice(4, 6)}-${h.lastBackup.slice(6, 8)}`) : null;
    add(h.backups > 0 && bAge > -8, 'Server backups', h.backups ? `${h.backups} daily snapshots · latest ${fmtDate(`${h.lastBackup.slice(0, 4)}-${h.lastBackup.slice(4, 6)}-${h.lastBackup.slice(6, 8)}`, true)}` : 'None yet. One is made on the first change of each day.');
    add(h.pushDevices ? (h.lastCron && (Date.now() - Date.parse(h.lastCron)) < 3600e3 ? true : false) : null, 'Reminder schedule (cron)', h.pushDevices ? (h.lastCron ? `Last run ${fmtDate(h.lastCron, true)} ${fmtTime(h.lastCron)}` : 'Not running yet. Add the cron job from Settings → Notifications.') : 'Notifications are off, so no cron job is needed.');
    add(h.passkeys ? true : null, 'Face ID sign-in', h.passkeys ? `${h.passkeys} device(s)` : 'Not set up (Settings → Security).');
  }
  try { const r = await fetch('data/store.json', { cache: 'no-store' }); add(r.status === 403 || r.status === 404, 'Data protection', r.status === 403 || r.status === 404 ? `Private (server answers ${r.status})` : `EXPOSED: the data file is readable (HTTP ${r.status}). Re-upload .htaccess files now.`); } catch { add(null, 'Data protection', 'Could not check while offline.'); }
  const pending = Object.keys(outbox).length, last = ls.get(K.last);
  add(!pending, 'Sync on this device', pending ? `${pending} change(s) waiting to upload` : `Up to date · ${last ? fmtDate(last, true) + ' ' + fmtTime(last) : ''}`);
  const lb = ui.lastBackup; add(lb && daysTo(lb) > -15 ? true : null, 'Your own backup copy', lb ? `Last downloaded ${fmtDate(lb, true)}` : 'Never downloaded. Settings → Backup.');
  let persisted = null; try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch {}
  add(standalone() ? true : null, 'Installed app', standalone() ? 'Running from the Home Screen' : 'Running in the browser. Add to Home Screen for notifications and full screen.');
  if (persisted !== null) add(persisted ? true : null, 'Device storage', persisted ? 'Protected from automatic clean-up' : 'Browser may clear it if space runs low; the server copy stays safe.');
  if ($('#hbox')) $('#hbox').innerHTML = `<div class="list">${rows.join('')}</div>`;
}
function vHealth() { setTimeout(vHealthFill, 0); return header('System health', 'Everything that keeps ME.Coach safe and running') + `<div class="card" id="hbox"><div class="empty">Checking…</div></div><div class="btns" style="margin-top:12px"><button class="btn" data-act="health-run">Check again</button><button class="btn" data-act="sync-now">Sync now</button></div>`; }
/* ---------------- encrypted backup ---------------- */
async function deriveKey(pass, salt) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
async function encBackup() {
  const p1 = prompt('Choose a backup password (8+ characters). You need it to restore this file.'); if (!p1) return; if (p1.length < 8) return toast('Use at least 8 characters');
  if (prompt('Type the backup password again') !== p1) return toast('Passwords do not match');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify({ app: 'milad2031', version: 1, exportedAt: nowIso(), collections: db }));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(p1, salt), data);
  download(JSON.stringify({ app: 'milad2031', enc: 'AES-GCM/PBKDF2-SHA256', salt: toB64u(salt), iv: toB64u(iv), data: toB64u(ct) }), `milad2031-encrypted-${today()}.json`);
  ui.lastBackup = today(); saveUi(); toast('Encrypted backup downloaded');
}
async function decBackup(j) { const p = prompt('This backup is encrypted. Enter its password.'); if (!p) throw new Error('cancelled'); try { const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64uBytes(j.iv) }, await deriveKey(p, b64uBytes(j.salt)), b64uBytes(j.data)); return JSON.parse(new TextDecoder().decode(pt)); } catch { throw new Error('Wrong password or damaged file'); } }
function download(txt, name) { const u = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); const l = document.createElement('a'); l.href = u; l.download = name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
/* ---------------- Siri & Shortcuts ---------------- */
async function siriSheet() {
  ui.siriDone = true; saveUi();
  openSheet('Siri & Shortcuts', '<div class="empty">Loading…</div>', '', { noFocus: true });
  try {
    const { key } = await api('shortkey'); const base = new URL('api.php', location.href).href; const u = (a, extra = '') => `${base}?action=${a}&k=${key}${extra}`;
    const blk = (name, say, steps, url) => `<div class="siri"><div class="siri-h"><b>${name}</b><span>“Hey Siri, ${say}”</span></div><ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol><div class="mono siri-u">${esc(url)}</div><button class="btn small" data-act="copy" data-text="${esc(url)}">Copy link</button></div>`;
    $('.sheet-b', sheetCtx.el).innerHTML = `<div class="small" style="margin-bottom:10px">Make each one once in the <b>Shortcuts</b> app (+ → Add Action). The shortcut's name is what you say to Siri, so name it as shown or anything you like. Siri works in English. Keep these links private: anyone with them can add to your list.</div>
    ${blk('Add task', 'add task', ['Add <b>Dictate Text</b>', 'Add <b>Get Contents of URL</b>, paste the link, open Show More: Method <b>POST</b>, Request Body <b>Form</b>, add field <b>text</b> = Dictated Text', 'Add <b>Speak Text</b> with Contents of URL', 'Name the shortcut <b>Add task</b>'], u('s-add'))}
    <div class="small" style="margin:-4px 0 12px">Say “… tomorrow” or “… today” at the end to set the date.</div>
    ${blk('My Top 3', 'my top three', ['Add <b>Get Contents of URL</b> with the link (method GET)', 'Add <b>Speak Text</b> with Contents of URL', 'Name it <b>My top three</b>'], u('s-top3'))}
    ${blk('Log practice', 'log practice', ['Add <b>Ask for Input</b> (Text): “Which skill?”', 'Add <b>Ask for Input</b> (Number): “How many minutes?”', 'Add <b>Get Contents of URL</b> with the link, then tap the link text and add <b>&skill=</b>[first answer]<b>&min=</b>[second answer]', 'Add <b>Speak Text</b>, name it <b>Log practice</b>'], u('s-log'))}
    ${blk('Save job ad', 'save this job (or from the Share button)', ['In the shortcut settings turn on <b>Show in Share Sheet</b> (accepts URLs and Safari pages)', 'Add <b>Get Contents of URL</b> with the link: method POST, Form fields <b>url</b> = Shortcut Input and <b>text</b> = Shortcut Input’s Name', 'Add <b>Show Notification</b> with Contents of URL', 'Name it <b>Save job</b>. In Safari, tap Share → Save job'], u('s-job'))}
    <div class="btns" style="margin-top:6px"><button class="btn small danger" data-act="siri-rotate">Make new links (old ones stop working)</button></div>`;
  } catch (e) { $('.sheet-b', sheetCtx.el).innerHTML = `<div class="empty">${esc(e.message === 'offline' ? 'Needs a connection.' : e.message)}</div>`; }
}

/* ---------------- quick capture ---------------- */
const WDN = ['sun','mon','tue','wed','thu','fri','sat'];
function wordDate(w) {
  w = w.toLowerCase(); const t = today();
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return w;
  if (w === 'today' || w === 'امروز') return t; if (w === 'tomorrow' || w === 'tmr' || w === 'فردا') return addDays(t, 1); if (w === 'پسفردا' || w === 'پس‌فردا') return addDays(t, 2);
  if (w === 'week') return addDays(t, 7); if (w === 'month') return addDays(t, 30);
  const i = WDN.indexOf(w.slice(0, 3)); if (i >= 0) { const d = parseD(t).getDay(); return addDays(t, ((i - d + 7) % 7) || 7); }
  const m = w.match(/^(\d{1,2})\/(\d{1,2})$/); if (m) { const y = Number(t.slice(0, 4)); let s = `${y}-${pad(m[2])}-${pad(m[1])}`; if (s < t) s = `${y + 1}-${pad(m[2])}-${pad(m[1])}`; return s; }
  return '';
}
function parseQuick(s) {
  const r = {}; let x = ' ' + s + ' ';
  x = x.replace(/\s!([123])(?=\s)/, (m, p) => { r.priority = 'P' + p; return ' '; });
  x = x.replace(/\s\*(?=\s)/, () => { r.top = true; return ' '; });
  x = x.replace(/\s@(\S+)(?=\s)/, (m, w) => { const d = wordDate(w); if (d) { r.due = d; return ' '; } return m; });
  if (!r.due) { const m = x.trim().match(/^(.+?)\s+(?:on\s+)?(today|tomorrow|tmr|امروز|فردا|(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?)$/i); if (m) { const d = wordDate(m[2]); if (d) { r.due = d; x = ' ' + m[1] + ' '; } } }
  r.title = x.replace(/\s+/g, ' ').trim(); return r;
}
function quickBar(ph) {
  const w = ui.qWhen || '';
  return `<form class="qadd" data-form="qadd"><input name="q" enterkeyhint="done" autocomplete="off" dir="auto" placeholder="${esc(ph || 'Add a task…')}" value="${esc(ui.quick || '')}" data-input="quick" data-norender="1"><button class="btn primary" type="submit" aria-label="Add">${I.plus}</button></form>
  <div class="qprev" aria-live="polite">${esc(smartLabel(parseSmart(ui.quick || '')))}</div><div class="qchips">${[['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'Next week'], ['top', '★ Top 3']].map(([k, l]) => `<button type="button" class="${w === k ? 'on' : ''}" data-act="qwhen" data-v="${k}">${l}</button>`).join('')}</div>`;
}
const JOB_RX = /linkedin\.com\/jobs|indeed\.|bayt\.com|gulftalent|naukrigulf|seek\.com|glassdoor|workable|lever\.co|greenhouse\.io|\bjobs?\b|careers?/i;
function skillFind(q) { q = q.toLowerCase().trim(); if (!q) return null; return list('skills').find(s => String(s.title).toLowerCase().includes(q)) || list('skills').find(s => q.split(/\s+/).some(w => w.length > 2 && String(s.title).toLowerCase().includes(w))); }
function parseSmart(raw) {
  const s = String(raw || '').trim(); if (!s) return null; let m;
  if ((m = s.match(/https?:\/\/\S+/i))) { const url = m[0], rest = s.replace(url, '').trim(); return JOB_RX.test(url + ' ' + rest) ? { kind: 'job', url, title: rest } : { kind: 'link', url, title: rest }; }
  if ((m = s.match(/^(?:note|یادداشت)\s*[:：]\s*(.+)$/i))) return { kind: 'note', title: m[1] };
  if ((m = s.match(/^(?:saved|savings|balance|پس\u200cانداز|پس انداز)\s+([\d,.]+)$/i))) return { kind: 'money', amount: Number(m[1].replace(/,/g, '')) };
  if ((m = s.match(/^(?:log\s+)?(\d{1,3})\s*(?:m|min|mins|minutes|دقیقه)\s+(.+)$/i)) || (m = s.match(/^log\s+(.+?)\s+(\d{1,3})\s*(?:m|min|mins|minutes)?$/i))) {
    const [mins, q] = /^\d+$/.test(m[1]) ? [Number(m[1]), m[2]] : [Number(m[2]), m[1]]; const sk = skillFind(q); if (sk && mins > 0) return { kind: 'practice', skill: sk, minutes: mins };
  }
  if ((m = s.match(/(?:^|\s)(?:at\s+)?(\d{1,2}):(\d{2})(?=\s|$)/)) && Number(m[1]) < 24 && Number(m[2]) < 60) {
    const p = parseQuick(s.replace(m[0], ' ')); const day = p.due || today();
    return { kind: 'event', title: p.title || 'Event', start: `${day}T${pad(Number(m[1]))}:${m[2]}${tzOffset()}`, day, time: `${pad(Number(m[1]))}:${m[2]}` };
  }
  const p = parseQuick(s); const w = ui.qWhen || '';
  if (!p.due && w === 'today') p.due = today(); if (!p.due && w === 'tomorrow') p.due = addDays(today(), 1); if (!p.due && w === 'week') p.due = addDays(weekStart(), 7);
  if (w === 'top') { p.top = true; if (!p.due) p.due = today(); }
  return Object.assign({ kind: 'task' }, p);
}
function smartLabel(p) {
  if (!p) return '';
  if (p.kind === 'task') return `→ Task${p.due ? ' · ' + (rel(p.due) === 'today' || rel(p.due) === 'tomorrow' ? rel(p.due) : fmtDate(p.due)) : ''}${p.top ? ' · ★ Top 3' : ''}${p.priority ? ' · ' + p.priority : ''}`;
  if (p.kind === 'event') return `→ Event · ${fmtDate(p.day)} ${p.time}`;
  if (p.kind === 'practice') return `→ Practice · ${p.minutes} min ${p.skill.title}`;
  if (p.kind === 'job') return '→ Job ad · saved to Job search';
  if (p.kind === 'link') return '→ Note with link';
  if (p.kind === 'note') return '→ Note';
  if (p.kind === 'money') return `→ Savings balance ${fmtMoney(p.amount)}`;
  return '';
}
document.addEventListener('input', e => { if (e.target.closest && e.target.closest('.qadd')) { const pv = document.querySelector('.qprev'); if (pv) pv.textContent = smartLabel(parseSmart(e.target.value)); } });
function quickSubmit(form) {
  const inp = form.querySelector('input'); const sp = parseSmart(inp.value || ''); if (!sp) return;
  const done = (r, c, msg) => { ui.quick = ''; saveUi(); toast(msg, 'Undo', () => remove(c, r.id)); setTimeout(() => { const i = document.querySelector('.qadd input'); if (i) i.focus(); }, 30); };
  if (sp.kind === 'event') return done(save('events', { title: sp.title, start: sp.start, end: '', alarm: 15 }), 'events', 'Event added');
  if (sp.kind === 'practice') return done(save('sessions', { title: sp.skill.title + ' · ' + sp.minutes + ' min', skill: sp.skill.id, minutes: sp.minutes, date: today(), result: 'Not a check' }), 'sessions', `Logged ${sp.minutes} min`);
  if (sp.kind === 'job') { let host = ''; try { host = new URL(sp.url).hostname.replace(/^www\./, ''); } catch {} return done(save('applications', { company: '', role: sp.title || 'Job from ' + host, stage: 'Saved', link: sp.url, source: host, followUp: addDays(today(), 2) }), 'applications', 'Saved to Job search'); }
  if (sp.kind === 'link' || sp.kind === 'note' || (sp.kind === 'job' && !isOwner())) return done(save('tasks', { title: sp.title || sp.url || 'Read later', notes: sp.url || '', state: 'To do', priority: 'P3', owner: 'Me' }), 'tasks', 'Saved as a task');
  if (sp.kind === 'money') return done(save('money', { amount: sp.amount, date: today() }), 'money', 'Balance saved');
  const p = sp;
  if (!p.title) return;
  const rec = { title: p.title, state: 'To do', priority: p.priority || 'P2', owner: 'Me' };
  if (p.due) rec.due = p.due;
  if (p.top) { const n = list('tasks').filter(x => isOpen(x) && x.focusDate === today()).length; if (n >= 3) toast('Top 3 is full; added without it'); else rec.focusDate = today(); }
  ui.quick = ''; saveUi(); const nr = save('tasks', rec); toast('Added', 'Undo', () => remove('tasks', nr.id));
  setTimeout(() => { const i = document.querySelector('.qadd input'); if (i) i.focus(); }, 30);
}
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
  if (f.dataset.form === 'qadd') return quickSubmit(f);
  const inp = f.querySelector('input'), p = parseQuick(inp.value || ''); if (!p.title) return; const g = get('goals', f.dataset.goal);
  if (f.dataset.form === 'ms-add') save('milestones', { title: p.title, target: p.due || '', goalId: f.dataset.goal, status: 'Planned', area: g ? g.area || '' : '' });
  if (f.dataset.form === 'gt-add') save('tasks', { title: p.title, due: p.due || '', state: 'To do', priority: p.priority || 'P2', owner: 'Me', goalId: f.dataset.goal });
  toast('Added');
});

/* ---------------- views ---------------- */
/* ---------------- 2031 helpers ---------------- */
const prefs = () => get('settings', 'prefs') || { id: 'prefs' };
const visionDate = () => prefs().visionDate || '2031-12-31';
const daysTo = d => Math.round((parseD(d) - parseD(today())) / 86400000);
function weekStart(d = today()) { const x = parseD(d); return addDays(d, -((x.getDay() + 6) % 7)); }
const inWeek = (d, ws) => d && d >= ws && d <= addDays(ws, 6);
function weekMinutes(ws, skillId) { return list('sessions').filter(s => inWeek(s.date, ws) && (!skillId || s.skill === skillId)).reduce((n, s) => n + (Number(s.minutes) || 0), 0); }
function weekTarget() { return Math.round(list('skills').reduce((n, s) => n + (Number(s.weeklyHours) || 0), 0) * 60); }
function streak() {
  const days = new Set(list('sessions').filter(s => s.date && (Number(s.minutes) > 0 || s.done)).map(s => s.date));
  let d = today(); if (!days.has(d)) d = addDays(d, -1); let n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
const hrs = m => (Math.round(m / 6) / 10).toString();
function weeklyLogged(ws = weekStart()) { return list('logs').some(l => l.type === 'weekly' && (l.week === ws || inWeek(l.date, ws))); }
function weeklyDue() { const wd = new Date().getDay(); return (wd === 5 || wd === 6 || wd === 0) && !weeklyLogged(); }
function expiring() { const lim = addDays(today(), 180); return list('immigration').filter(x => x.expiry && x.expiry <= lim && x.status !== 'Not needed'); }
function followUps() { return list('applications').filter(a => a.followUp && a.followUp <= today() && APP_ACTIVE.includes(a.stage || 'Saved')); }
function lateMilestones() { return list('milestones').filter(m => m.target && m.target < today() && !['Done', 'Dropped'].includes(m.status)); }
function attention() {
  const t = today(), open = list('tasks').filter(isOpen);
  const od = open.filter(x => x.due && x.due < t).length, wt = open.filter(x => stOf(x) === 'Waiting').length;
  const fu = isOwner() ? followUps().length : 0, ex = 0, lm = lateMilestones().length;
  const out = [];
  if (weeklyDue()) out.push(['weekly', '', I.review, 'Weekly review is due', '5 minutes · three questions', 'warn']);
  if (od) out.push(['filter', 'overdue', I.alert, `${od} overdue task${od > 1 ? 's' : ''}`, 'Reschedule or finish', 'bad']);
  if (fu) out.push(['go', 'jobs', I.jobs, `${fu} job follow-up${fu > 1 ? 's' : ''} due`, 'Applications to chase', 'warn']);
  if (lm) out.push(['go', 'plan', I.flag, `${lm} roadmap milestone${lm > 1 ? 's' : ''} past target`, 'Update the date or the status', 'warn']);
  if (!ui.lastBackup ? list('tasks').length > 20 && new Date().getDay() === 0 : daysTo(ui.lastBackup) < -14) out.push(['enc-backup', '', I.health, 'Time for a backup copy', 'Encrypted file to keep in iCloud Drive', '']);
  for (const c of list('courses').filter(c => ['Active', 'Paused'].includes(c.status) && c.nextReview && c.nextReview <= today()).slice(0, 2)) out.push(['c-review', c.id, I.course, 'Course review: ' + c.title, 'Keep, pause or drop. 1 minute', 'warn']);
  if (wt) out.push(['filter', 'ext', I.clock, `${wt} waiting on others`, 'Nudge or keep waiting', '']);
  return out;
}
const attRow = ([act, arg, ic, t, s, tone]) => `<div role="button" tabindex="0" class="row att ${tone}" data-act="${act}" ${act === 'filter' ? `data-f="${arg}"` : act === 'go' ? `data-to="${arg}"` : arg ? `data-id="${esc(arg)}"` : ''}><span class="att-i">${ic}</span><div class="main"><div class="t">${esc(t)}</div><div class="m">${esc(s)}</div></div><span class="att-go">${I.right}</span></div>`;

function vToday() {
  if (ui.tday && ui.tday !== today()) return vDay(ui.tday);
  const t = today(), open = list('tasks').filter(isOpen);
  const top = sortTasks(open.filter(x => x.focusDate === t));
  const doneTop = list('tasks').filter(x => !isOpen(x) && x.focusDate === t);
  const ids = new Set(top.map(x => x.id));
  const dueToday = sortTasks(open.filter(x => x.due === t && !ids.has(x.id)));
  const sched = agenda(t, t).filter(a => a.kind !== 'due' && !ids.has(a.id));
  const overdue = sortTasks(open.filter(x => x.due && x.due < t && !ids.has(x.id)));
  const closed = list('logs').some(l => l.type === 'closeout' && l.date === t);
  const att = attention().filter(a => a[0] !== 'filter');
  const dl = daysTo(visionDate());
  const hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const tm = addDays(t, 1), tomTop = sortTasks(open.filter(x => x.focusDate === tm));
  const doneToday = list('tasks').filter(x => !isOpen(x) && x.completedOn === t).length;
  const cyc = activeCycle(), mlog = logOf('morning'), nlog = logOf('closeout');
  const head = header(new Date().toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'long' }), greet + (me && me.name ? ', ' + me.name.split(' ')[0] : '') + (cyc ? ` · day ${cycleDay(cyc)} of ${cyc.days || 40}` : '')) + weekStrip(t) + `
  ${me && me.plan === 'trial' ? `<a class="trialpill" href="#" data-act="plans">Free trial · ${Math.max(0, Math.ceil((Date.parse(me.trialEnds) - Date.now()) / 86400000))} days left</a>` : ''}
  ${setupCard()}
  ${coachCard()}
  ${widgetGrid()}
  ${bookCard()}
  ${microCard()}
  ${!closed && !mlog ? `<div class="card balcard morning" data-act="morning" role="button"><span class="bal-i">${I.today}</span><div class="main"><b>Morning Balance</b><div class="small">1 minute · expectation, focus, Top 3</div></div><button class="btn ${hr < 14 ? 'primary' : ''}" data-act="morning">Start</button></div>` : ''}
  ${!closed && mlog ? `<div class="mline" data-act="morning" role="button"><span class="hstat ok">${I.tick}</span><div class="main">${mlog.focus || (mlog.focusAreas || []).length ? `<b>Focus:</b> <span dir="auto">${esc(mlog.focus || (mlog.focusAreas || []).map(id => (get('areas', id) || {}).title).filter(Boolean).join(', '))}</span>` : '<b>Morning Balance done</b>'}${mlog.expect ? `<div class="small" dir="auto">${esc(mlog.expect)}</div>` : ''}</div></div>` : ''}
  ${quickBar('What needs doing?')}`;
  const tlCard = `<div class="card"><h2>Today's plan<span style="flex:1"></span><button class="btn small ghost" data-act="focus-free">${I.timer} Focus</button></h2>${timeline(t)}</div>`;
  const visionLine = `<a class="visionline" href="#/progress" data-act="p-tab" data-t="roadmap"><b>${dl.toLocaleString('en-GB')}</b> days to ${esc(prefs().visionName || 'your vision')} ${I.go}</a>`;
  if (closed) return head + `
  <div class="card done-day"><div class="dd-h"><span class="hstat ok">${I.tick}</span><div><b>Day closed${nlog && nlog.score ? ` · ${nlog.score}/10` : ''}</b><div class="small">${doneToday} done today${nlog && nlog.better ? ` · tomorrow: <span dir="auto">${esc(nlog.better)}</span>` : ''}</div></div><span style="flex:1"></span><button class="btn small ghost" data-act="closeout">Edit</button></div></div>
  <div class="card"><h2>Tomorrow <span class="count">${tomTop.length}</span><span style="flex:1"></span><button class="btn small ghost" data-act="plan-day" data-day="${tm}">${tomTop.length ? 'Change' : 'Plan'}</button></h2>${tomTop.length ? `<div class="list">${tomTop.map(x => taskRow(x)).join('')}</div>` : '<div class="empty">Nothing picked yet for tomorrow.</div>'}</div>
  ${habitStrip()}
  ${att.length ? `<div class="card"><div class="list">${att.map(attRow).join('')}</div></div>` : ''}
  ${visionLine}`;
  const evening = hr >= 18;
  const closeBtn = `<button class="btn wide nightbtn" data-act="closeout">${I.moon} Night Balance · 1 min</button>`;
  return head + `
  ${evening ? `<div class="card balcard night" data-act="closeout" role="button"><span class="bal-i">${I.moon}</span><div class="main"><b>Night Balance</b><div class="small">1 minute · ${doneToday} done · ${top.length + dueToday.length} still open</div></div><button class="btn primary" data-act="closeout">Start</button></div>` : ''}
  <div class="card"><h2>★ Top 3 <span class="count">${doneTop.length}/${top.length + doneTop.length}</span><span style="flex:1"></span>${top.length + doneTop.length ? `<button class="btn small ghost" data-act="plan-day" data-day="${t}">Change</button>` : ''}</h2>
    ${top.length ? `<div class="list">${top.map(x => taskRow(x)).join('')}</div>` : doneTop.length ? '<div class="empty win">All three done. 🎉</div>' : (() => { const sg = suggestTop(t); return sg.length ? `<div class="small" style="margin-bottom:6px">Suggested for today</div><div class="list">${sg.map(x => `<div class="row sug"><span class="dotx warn"></span><div class="main"><div class="t" dir="auto">${esc(x.title)}</div><div class="m">${dueChip(x)}${x.priority === 'P1' ? priChip('P1') : ''}</div></div></div>`).join('')}</div><div class="btns" style="margin-top:10px"><button class="btn primary" data-act="accept-top" data-ids="${esc(sg.map(x => x.id).join(','))}">Use these</button><button class="btn" data-act="plan-day" data-day="${t}">Choose myself</button></div>` : `<div class="empty">Add a task above, then pick your three for today.</div>`; })()}</div>
  ${habitStrip()}
  ${tlCard}
  ${dueToday.length ? `<div class="card"><h2>Also today <span class="count">${dueToday.length}</span></h2><div class="list">${dueToday.map(x => taskRow(x)).join('')}</div></div>` : ''}
  ${(() => { const up = courseLive().filter(c => cNext(c) && cWeekDone(c) < (Number(c.perWeek) || 1) && (c.status || 'Planned') === 'Active').slice(0, 2); return up.length ? `<div class="card"><h2>Up next</h2><div class="list">${up.map(c => `<div class="row" data-act="go" data-to="course/${encodeURIComponent(c.id)}"><div class="main"><div class="t" dir="auto">${esc(cNext(c).t)}</div><div class="m"><span dir="auto">${esc(c.title)}</span><span>${cWeekDone(c)}/${c.perWeek || 1} this week</span></div></div><button class="icon-btn playb" data-act="c-start" data-id="${esc(c.id)}" aria-label="Start">${I.play}</button></div>`).join('')}</div></div>` : ''; })()}
  ${overdue.length ? `<div class="card"><h2>Overdue <span class="count">${overdue.length}</span><span style="flex:1"></span><button class="btn small ghost" data-act="od-today">Move all to today</button></h2><div class="list">${overdue.slice(0, 5).map(x => taskRow(x)).join('')}</div>${overdue.length > 5 ? `<a class="btn small ghost" href="#/tasks">See all ${overdue.length}</a>` : ''}</div>` : ''}
  ${att.length ? `<div class="card"><div class="list">${att.map(attRow).join('')}</div></div>` : ''}
  ${evening ? '' : closeBtn}
  ${visionLine}`;
}
function agendaRow(a) {
  const tag = a.kind === 'event' ? '' : a.kind === 'due' ? '<span class="chip late">Due</span>' : a.kind === 'follow' ? '<span class="chip s-wait">Job</span>' : a.kind === 'ms' ? '<span class="chip s-rev">2031</span>' : '<span class="chip s-prog">Task</span>';
  const act = { event: 'event', follow: 'application', ms: 'milestone' }[a.kind] || 'task';
  return `<div class="row" data-act="${act}" data-kind="${a.kind}" data-id="${esc(a.id)}"><div class="time">${esc(a.time || 'all day')}${a.end ? `<br><span class="small">${esc(a.end)}</span>` : ''}</div><div class="main"><div class="t" dir="auto">${esc(a.title)}</div><div class="m">${tag}${(a.kind === 'task' || a.kind === 'due') && a.rec.nextAction ? `<span dir="auto">${esc(a.rec.nextAction).slice(0, 120)}</span>` : ''}${a.kind === 'event' && a.rec.rrule ? '<span>repeats</span>' : ''}</div></div></div>`;
}
function vTasks() {
  const t = today(), tm = addDays(t, 1), wk = addDays(t, 7), q = (ui.taskQuery || '').toLowerCase();
  let arr = list('tasks'); if (q) arr = arr.filter(x => [x.title, x.nextAction, x.notes].join(' ').toLowerCase().includes(q));
  const open = arr.filter(isOpen), waiting = sortTasks(open.filter(x => stOf(x) === 'Waiting')), act = open.filter(x => stOf(x) !== 'Waiting');
  const groups = [['Overdue', act.filter(x => x.due && x.due < t)], ['Today', act.filter(x => x.due === t || (!x.due && x.focusDate === t))], ['Tomorrow', act.filter(x => x.due === tm)], ['This week', act.filter(x => x.due > tm && x.due <= wk)], ['Later', act.filter(x => x.due > wk)], ['No date', act.filter(x => !x.due && x.focusDate !== t)], ['Waiting on others', waiting]];
  const done = arr.filter(x => !isOpen(x)).sort((a, b) => String(b.completedOn || '').localeCompare(String(a.completedOn || '')));
  return header('Tasks', `${open.length} open`) + `
  ${quickBar()}
  <input class="search" type="search" placeholder="Search" value="${esc(ui.taskQuery)}" data-input="taskQuery" style="width:100%;margin:2px 0 4px">
  <div class="qhint" style="margin-bottom:8px">Swipe a task → to finish it, ← to move it to tomorrow.</div>
  ${groups.filter(([, g]) => g.length).map(([n, g]) => `<div class="grp-h ${n === 'Overdue' ? 'bad' : ''}">${n} <span>${g.length}</span></div><div class="card tight"><div class="list">${sortTasks(g).map(x => taskRow(x)).join('')}</div></div>`).join('') || '<div class="card empty">Nothing here. Add a task above.</div>'}
  ${done.length ? `<details class="donebox"><summary>Done (${done.length})</summary><div class="card tight"><div class="list">${done.slice(0, 40).map(x => taskRow(x)).join('')}</div></div></details>` : ''}`;
}
function vCalendar() {
  const view = ui.calView || (window.innerWidth >= 900 ? 'week' : '3day'), sel = ui.calSel || today();
  if (view !== 'month') {
    const days = gridDays(view, sel), title = parseD(days[0]).toLocaleDateString(LOC(), { month: 'long', year: 'numeric' });
    setTimeout(() => { const gb = $('#gbody'); if (gb && !render.calScrolled) { gb.scrollTop = Math.max(0, (Math.min(new Date().getHours(), 20) - H0 - 1) * HOUR_PX); render.calScrolled = true; } }, 0);
    return header('Calendar', '') + calHead(title, view) + `<div class="card gcard">${timeGrid(days)}</div><div class="btns" style="margin-top:12px"><button class="btn small" data-act="new-event" data-day="${sel}">${I.plus} Event</button><button class="btn small" data-act="new-task" data-day="${sel}">${I.plus} Task</button></div>`;
  }
  return vMonth();
}
function calHead(title, view) { return `<div class="calbar"><button class="icon-btn" data-act="cv-move" data-d="-1" aria-label="Previous">${I.left}</button><b>${esc(title)}</b><button class="icon-btn" data-act="cv-move" data-d="1" aria-label="Next">${I.right}</button><button class="btn small" data-act="cv-today">Today</button></div><div class="seg" style="margin:8px 0 12px">${[['day', 'Day'], ['3day', '3 days'], ['week', 'Week'], ['month', 'Month']].map(([k, l]) => `<button class="${view === k ? 'on' : ''}" data-act="cv" data-v="${k}">${l}</button>`).join('')}</div>`; }
function vMonth() {
  const t = today();
  if (!ui.calMonth) ui.calMonth = t.slice(0, 7);
  if (!ui.calSel) ui.calSel = t;
  const [y, m] = ui.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1); const gridStart = new Date(first); const wd = (first.getDay() + 6) % 7; gridStart.setDate(1 - wd);
  const days = []; for (let i = 0; i < 42; i++) { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); days.push(dstr(d)); }
  const items = agenda(days[0], days[41]); const byDay = {}; items.forEach(a => (byDay[a.day] = byDay[a.day] || []).push(a));
  const sel = byDay[ui.calSel] || [];
  const monthName = first.toLocaleDateString(LOC(), { month: 'long', year: 'numeric' });
  return header('Calendar', '') + calHead(first.toLocaleDateString(LOC(), { month: 'long', year: 'numeric' }), 'month') + `
  <div class="card"><div class="cal-h" style="display:none"><button class="icon-btn" data-act="cal-move" data-d="-1" aria-label="Previous month">${I.left}</button><b>${esc(monthName)}</b><button class="btn small" data-act="cal-today">Today</button><button class="icon-btn" data-act="cal-move" data-d="1" aria-label="Next month">${I.right}</button></div>
  <div class="month">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dow">${d}</div>`).join('')}
  ${days.map(d => { const it = byDay[d] || []; return `<div class="day ${d.slice(0, 7) !== ui.calMonth ? 'out' : ''} ${d === t ? 'today' : ''} ${d === ui.calSel ? 'sel' : ''}" data-act="cal-sel" data-day="${d}"><span class="n">${Number(d.slice(8))}</span><div class="dots">${it.slice(0, 6).map(a => `<i class="${a.kind === 'task' || a.kind === 'ms' ? 't' : a.kind === 'due' || a.kind === 'follow' ? 'd' : ''}"></i>`).join('')}</div>${it.slice(0, 3).map(a => `<div class="lbl" dir="auto">${esc(a.time ? a.time + ' ' : '')}${esc(a.title)}</div>`).join('')}${it.length > 3 ? `<div class="lbl">+${it.length - 3}</div>` : ''}</div>`; }).join('')}</div></div>
  <div class="card" style="margin-top:12px"><h2>${esc(fmtDate(ui.calSel, true))} <span class="count">${sel.length}</span></h2>${sel.length ? `<div class="list">${sel.map(agendaRow).join('')}</div>` : '<div class="empty">Nothing on this day.</div>'}
  <div class="btns" style="margin-top:10px"><button class="btn small" data-act="new-event" data-day="${ui.calSel}">${I.plus} Event</button><button class="btn small" data-act="new-task" data-day="${ui.calSel}">${I.plus} Task on this day</button></div></div>`;
}
function vPlan() {
  const goals = list('goals').sort((a, b) => String(a.code || a.title).localeCompare(String(b.code || b.title)));
  const projects = list('projects'); const tasks = list('tasks');
  const prog = pid => { const ts = tasks.filter(t => t.projectId === pid); const d = ts.filter(t => DONE.has(t.state)).length; return [d, ts.length]; };
  const gprog = gid => { const ts = tasks.filter(t => t.goalId === gid || (t.projectId && (get('projects', t.projectId) || {}).goalId === gid)); const d = ts.filter(t => DONE.has(t.state)).length; return [d, ts.length]; };
  const bar = ([d, n]) => `<div class="bar" title="${d}/${n}"><i style="width:${n ? Math.round(100 * d / n) : 0}%"></i></div><div class="small">${d} of ${n} tasks done</div>`;
  const orphan = projects.filter(p => !p.goalId || !get('goals', p.goalId));
  if ((ui.planTab || 'roadmap') === 'roadmap') return vRoadmap();
  return header('Plan', 'Vision → goals → projects → actions') + planTabs() + `
  <div class="btns" style="margin-bottom:12px"><button class="btn primary" data-act="new-goal">${I.plus} Goal</button><button class="btn" data-act="new-project">${I.plus} Project</button></div>
  ${goals.length ? goals.map(g => { const ps = projects.filter(p => p.goalId === g.id); return `<div class="card" style="margin-bottom:12px"><div class="row" data-act="goal" data-id="${esc(g.id)}" style="border:0;padding-top:0"><div class="main"><div class="t" dir="auto">${esc(g.title)}</div><div class="m"><span class="chip">${esc(g.status || 'Not started')}</span>${g.area ? `<span>${esc(g.area)}</span>` : ''}${g.target ? `<span>Target ${esc(fmtDate(g.target, true))}</span>` : ''}</div>${g.success ? `<div class="na" dir="auto">${esc(g.success)}</div>` : ''}</div></div>${bar(gprog(g.id))}
    ${ps.length ? `<div class="list" style="margin-top:8px">${ps.map(p => `<div class="row" data-act="project" data-id="${esc(p.id)}"><div class="main"><div class="t" dir="auto">${esc(p.title)}</div><div class="m"><span class="chip">${esc(p.status || 'Planned')}</span>${p.target ? `<span>Target ${esc(fmtDate(p.target, true))}</span>` : ''}<span>${prog(p.id)[1] - prog(p.id)[0]} open</span></div></div></div>`).join('')}</div>` : ''}</div>`; }).join('') : '<div class="card empty">No goals yet. Import your MILAD 2031 data in Settings, or add a goal.</div>'}
  ${orphan.length ? `<div class="card"><h2>Projects without a goal</h2><div class="list">${orphan.map(p => `<div class="row" data-act="project" data-id="${esc(p.id)}"><div class="main"><div class="t" dir="auto">${esc(p.title)}</div><div class="m"><span class="chip">${esc(p.status || 'Planned')}</span></div></div></div>`).join('')}</div></div>` : ''}`;
}
function planTabs() { return ''; }
const stripHead = h => h.replace(/^<div class="top">[\s\S]*?<div class="spacer"[^>]*><\/div>/, '');
function vProgress() {
  const p = ui.pTab || 'overview';
  const body = p === 'insights' ? vInsights() : p === 'roadmap' ? vRoadmap() : p === 'goals' ? vGoals() : p === 'wheel' ? vWheel() : p === 'learning' ? vLearn() : p === 'money' ? vMoney() : vOverview();
  return header('Coach', 'Your self-coaching blueprint, applied daily') + `<div class="seg ptabs">${P_TABS.filter(([k]) => !(k === 'money' && hidden().has('money'))).map(([k, l]) => `<button class="${p === k ? 'on' : ''}" data-act="p-tab" data-t="${k}">${l}</button>`).join('')}</div><div style="height:12px"></div>` + stripHead(body);
}
/* ================= HABITS PAGE ================= */
function vHabits() {
  const t = today(), hs = list('habits').sort((a, b) => String(a.time || '99').localeCompare(String(b.time || '99')) || String(a.title).localeCompare(String(b.title)));
  const due = hs.filter(h => habDue(h, t)), done = due.filter(h => (h.done || {})[t]);
  const week = []; for (let i = 6; i >= 0; i--) week.push(addDays(t, -i));
  const best = hs.reduce((m, h) => Math.max(m, habitStreak(h)), 0), rate = hs.length ? Math.round(hs.reduce((n, h) => n + habRate(h, 7), 0) / hs.length) : 0;
  return header('Habits', '') + `
  <div class="card hsum">${ring(due.length ? Math.round(100 * done.length / due.length) : 0, 86, `${done.length}/${due.length}`)}<div class="main"><b>${due.length ? (done.length === due.length ? 'All done today' : `${due.length - done.length} to go today`) : 'Nothing scheduled today'}</b><div class="hs-st"><div><span>${best}</span><small>best streak</small></div><div><span>${rate}%</span><small>last 7 days</small></div><div><span>${hs.length}</span><small>habits</small></div></div></div></div>
  ${hs.map(h => { const st = habitStreak(h); return `<div class="card hcard" style="--ac:${habColor(h)}"><div class="hc-top" data-act="habit-open" data-id="${esc(h.id)}" role="button"><span class="hc-av">${esc(String(h.title).slice(0, 1).toUpperCase())}</span><div class="main"><b dir="auto">${esc(h.title)}</b><div class="small">${esc(habSched(h))}${h.time ? ' · ' + esc(h.time) : ''}</div></div>${st ? `<span class="hc-st">${I.flame}${st}</span>` : ''}</div>
    <div class="hc-week">${week.map(d => { const due = habDue(h, d), on = !!(h.done || {})[d]; return `<button class="hd ${on ? 'on' : ''} ${due ? '' : 'off'} ${d === t ? 'td' : ''}" data-act="hab-day" data-id="${esc(h.id)}" data-d="${d}" aria-label="${esc(fmtDate(d))}"><small>${dowS(d, 3).slice(0, 1)}</small><i>${on ? I.tick : parseD(d).getDate()}</i></button>`; }).join('')}</div></div>`; }).join('') || '<div class="card empty">No habits yet. Small and specific works best: “10 minute walk after lunch”.</div>'}
  <button class="btn primary wide" data-act="new-habit">${I.plus} New habit</button>`;
}
function habitSheet(id) {
  const h = get('habits', id); if (!h) return; const t = today(), start = addDays(weekStart(t), -77), cells = [];
  for (let d = start; d <= addDays(weekStart(t), 6); d = addDays(d, 1)) { const due = habDue(h, d), on = !!(h.done || {})[d]; cells.push(`<i class="${on ? 'on' : due ? 'due' : ''} ${d > t ? 'fut' : ''}" title="${esc(fmtDate(d, true))}${on ? ' · done' : ''}"></i>`); }
  openSheet(h.title, `<div class="hstats" style="--ac:${habColor(h)}"><div><b>${habitStreak(h)}</b><span>current streak</span></div><div><b>${habBest(h)}</b><span>best streak</span></div><div><b>${habRate(h, 30)}%</b><span>last 30 days</span></div><div><b>${Object.keys(h.done || {}).length}</b><span>times in total</span></div></div>
    <div class="small" style="margin:12px 0 6px">Last 12 weeks · ${esc(habSched(h))}</div><div class="hheat" style="--ac:${habColor(h)}">${cells.join('')}</div>${h.why ? `<div class="small" style="margin-top:12px" dir="auto"><b>Why:</b> ${esc(h.why)}</div>` : ''}`,
    `<button class="btn danger" data-act="i-del" data-c="habits" data-id="${esc(id)}">Delete</button><span style="flex:1"></span><button class="btn" data-act="i-edit" data-c="habits" data-id="${esc(id)}">Edit</button>`, { noFocus: true });
}
/* ================= INSIGHTS (health-style) ================= */
function dayFocus(d) { return list('focus').filter(f => f.kind !== 'calm' && f.date === d).reduce((n, f) => n + (Number(f.minutes) || 0), 0) + list('sessions').filter(s => s.date === d).reduce((n, s) => n + (Number(s.minutes) || 0), 0); }
function dayHabits(d) { const hs = list('habits').filter(h => habDue(h, d) && (h.createdAt || '').slice(0, 10) <= d); if (!hs.length) return null; return Math.round(100 * hs.filter(h => (h.done || {})[d]).length / hs.length); }
function series(n, fn, end = today()) { const out = []; for (let i = n - 1; i >= 0; i--) { const d = addDays(end, -i); out.push([d, fn(d)]); } return out; }
const avgOf = arr => { const v = arr.map(x => x[1]).filter(x => x !== null && x !== '' && !isNaN(x)); return v.length ? v.reduce((a, b) => a + Number(b), 0) / v.length : null; };
const sumOf = arr => arr.reduce((a, x) => a + (Number(x[1]) || 0), 0);
function bars(data, col, fmt = v => v, maxV) {
  const W = 320, H = 96, n = data.length, bw = W / n, mx = maxV || Math.max(1, ...data.map(x => Number(x[1]) || 0));
  return `<svg viewBox="0 0 ${W} ${H + 14}" class="ibars" role="img">${data.map(([d, v], i) => { const h = v ? Math.max(2, (Number(v) / mx) * H) : 0; return `<g><rect x="${(i * bw + bw * .18).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${Math.max(1, bw * .64).toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, bw * .3).toFixed(1)}" fill="${v ? col : 'transparent'}"/><rect x="${(i * bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H}" fill="transparent"><title>${esc(fmtDate(d, true))}: ${v === null || v === '' ? '–' : esc(fmt(v))}</title></rect></g>`; }).join('')}<line x1="0" x2="${W}" y1="${H}" y2="${H}" class="ib-base"/><text x="0" y="${H + 12}" class="ax">${esc(fmtDate(data[0][0]))}</text><text x="${W}" y="${H + 12}" class="ax" text-anchor="end">${esc(fmtDate(data[n - 1][0]))}</text></svg>`;
}
function vInsights() {
  const n = Number(ui.irange) || 30, cur = e => series(n, e), prev = e => series(n, e, addDays(today(), -n));
  const sc = cur(d => { const l = logOf('closeout', d); return l && Number(l.score) ? Number(l.score) : null; }), scP = prev(d => { const l = logOf('closeout', d); return l && Number(l.score) ? Number(l.score) : null; });
  const fo = cur(dayFocus), foP = prev(dayFocus), hb = cur(dayHabits), hbP = prev(dayHabits);
  const td = cur(d => list('tasks').filter(x => x.completedOn === d && stOf(x) === 'Done').length), tdP = prev(d => list('tasks').filter(x => x.completedOn === d && stOf(x) === 'Done').length);
  const bal = cur(d => (logOf('morning', d) ? 1 : 0) + (logOf('closeout', d) ? 1 : 0));
  const delta = (a, b, unit = '', dec = 0) => a === null || b === null ? '' : `<span class="dl ${a >= b ? 'up' : 'down'}">${a >= b ? '▲' : '▼'} ${Math.abs(a - b).toFixed(dec)}${unit}</span>`;
  const r1 = x => x === null ? '–' : (Math.round(x * 10) / 10).toString();
  const sA = avgOf(sc), sB = avgOf(scP), fA = sumOf(fo) / n, fB = sumOf(foP) / n, hA = avgOf(hb), hB = avgOf(hbP), tA = sumOf(td), tB = sumOf(tdP);
  const hl = []; if (sA !== null) hl.push(`Your average day score is <b>${r1(sA)}</b>${sB !== null ? `, ${sA >= sB ? 'up' : 'down'} ${r1(Math.abs(sA - sB))} from the ${n} days before` : ''}.`);
  if (fA) hl.push(`You focused <b>${Math.round(fA)} min</b> a day on average${fB ? ` (${fA >= fB ? 'more' : 'less'} than before)` : ''}.`); if (hA !== null) hl.push(`You kept <b>${Math.round(hA)}%</b> of your habits.`);
  const ws = wheels().slice().reverse(), wpts = ws.map(w => [w.date, Math.round(10 * areas().reduce((s, a) => s + (areaScore(a.id, w) || 0), 0) / Math.max(1, areas().length)) / 10]);
  const card = (t, col, big, unit, dl, chart, sub) => `<div class="card icard"><div class="ic-h"><span class="ic-dot" style="background:${col}"></span><b>${t}</b><span style="flex:1"></span>${dl}</div><div class="ic-v"><span>${big}</span><small>${unit}</small></div>${sub ? `<div class="small">${sub}</div>` : ''}${chart}</div>`;
  return header('Insights', '') + `<div class="seg" style="margin-bottom:12px">${[[7, '7 days'], [30, '30 days'], [90, '90 days']].map(([k, l]) => `<button class="${n === k ? 'on' : ''}" data-act="irange" data-v="${k}">${l}</button>`).join('')}</div>
  ${hl.length ? `<div class="card ihl"><span class="att-i">${I.spark}</span><div>${hl.join(' ')}</div></div>` : '<div class="card empty">Close a few days with Night Balance and your insights will appear here.</div>'}
  <div class="igrid">
  ${card('Day score', AREA_COL[6], r1(sA), 'avg / 10', delta(sA, sB, '', 1), bars(sc, AREA_COL[6], v => v + '/10', 10), `${sc.filter(x => x[1]).length} of ${n} days scored`)}
  ${card('Focus', AREA_COL[0], Math.round(fA), 'min / day', delta(fA, fB, ' min'), bars(fo, AREA_COL[0], v => v + ' min'), `${Math.round(sumOf(fo) / 60 * 10) / 10} h in total`)}
  ${card('Habits kept', AREA_COL[2], hA === null ? '–' : Math.round(hA), '%', delta(hA, hB, '%'), bars(hb, AREA_COL[2], v => v + '%', 100), '')}
  ${card('Tasks done', AREA_COL[1], tA, 'in ' + n + ' days', delta(tA, tB), bars(td, AREA_COL[1]), '')}
  ${card('Balance check-ins', AREA_COL[3], bal.filter(x => x[1] === 2).length, `full days of ${n}`, '', `<div class="dots">${bal.map(([d, v]) => `<i class="v${v}" title="${esc(fmtDate(d, true))}: ${v === 2 ? 'morning and night' : v ? 'one of two' : 'none'}"></i>`).join('')}</div>`, 'Dark = morning and night · light = one of them')}
  ${wpts.length > 1 ? card('Life balance', AREA_COL[5], wpts[wpts.length - 1][1], '/ 10', delta(wpts[wpts.length - 1][1], wpts[wpts.length - 2][1], '', 1), lineChart(wpts, 0, v => v + '/10'), `${wpts.length} Wheel of Life tests`) : ''}
  </div>`;
}
/* ================= PRODUCTS ================= */
const PROD_TYPES = ['Book', 'Course', 'Template', 'App', 'Coaching', 'Video', 'Other'], PROD_STATES = ['Idea', 'Building', 'Live', 'Paused'];
function vProducts() {
  const ps = list('products').sort((a, b) => PROD_STATES.indexOf(a.status || 'Idea') - PROD_STATES.indexOf(b.status || 'Idea') || String(a.title).localeCompare(String(b.title)));
  const rev = p => (p.sales || []).reduce((n, s) => n + (Number(s.amount) || 0), 0), units = p => (p.sales || []).reduce((n, s) => n + (Number(s.units) || 0), 0);
  const tot = ps.reduce((n, p) => n + rev(p), 0), cur = prefs().currency || '';
  return header('Products', 'What you sell, where, and how it is doing') + `
  <div class="card psum"><div><b>${ps.filter(p => p.status === 'Live').length}</b><span>live</span></div><div><b>${ps.filter(p => ['Idea', 'Building'].includes(p.status || 'Idea')).length}</b><span>in the pipeline</span></div><div><b>${esc((cur + ' ' + Math.round(tot).toLocaleString('en-GB')).trim())}</b><span>sales recorded</span></div></div>
  <div class="toolbar"><button class="btn primary" data-act="new-product">${I.plus} Product</button></div>
  ${ps.length ? `<div class="pgrid">${ps.map(p => `<div class="card pcard" data-act="product" data-id="${esc(p.id)}" role="button"><div class="pc-t"><span class="chip ${p.status === 'Live' ? 's-done' : p.status === 'Building' ? 's-prog' : ''}">${esc(p.status || 'Idea')}</span><span class="small">${esc(p.type || '')}</span></div><b dir="auto">${esc(p.title)}</b><div class="small" dir="auto">${esc([p.platform, p.price ? `${p.currency || cur} ${p.price}` : ''].filter(Boolean).join(' · '))}</div>${(p.sales || []).length ? `<div class="pc-s"><span>${units(p)} sold</span><span>${esc(((p.currency || cur) + ' ' + Math.round(rev(p)).toLocaleString('en-GB')).trim())}</span></div>` : ''}</div>`).join('')}</div>` : '<div class="card empty">Add your books, courses, templates and other products to track them in one place.</div>'}`;
}
function productSheet(id) {
  const p = get('products', id); if (!p) return;
  openSheet(p.title, `<div class="small" style="margin-bottom:10px">${esc([p.type, p.status, p.platform].filter(Boolean).join(' · '))}${p.link ? ` · <a href="${esc(p.link)}" target="_blank" rel="noopener">Open</a>` : ''}</div>
    <div class="list">${(p.sales || []).slice().reverse().map(s => `<div class="row"><div class="main"><div class="t">${esc(s.units || 0)} × · ${esc(((p.currency || '') + ' ' + (s.amount || 0)).trim())}</div><div class="m">${esc(fmtDate(s.date, true))}${s.note ? ' · ' + esc(s.note) : ''}</div></div></div>`).join('') || '<div class="empty">No sales recorded yet.</div>'}</div>`,
    `<button class="btn" data-act="p-edit" data-id="${esc(id)}">Edit</button><span style="flex:1"></span><button class="btn primary" data-act="p-sale" data-id="${esc(id)}">${I.plus} Record a sale</button>`, { noFocus: true });
}
/* ================= DAY TIMELINE (structured-style) ================= */
const toMin = hm => { const [h, m] = String(hm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const fromMin = n => `${pad(Math.floor(n / 60) % 24)}:${pad(n % 60)}`;
const dur = n => n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ' ' + (n % 60) + ' min' : ''}` : `${n} min`;
function timelineItems(d) {
  const items = agenda(d, d).filter(a => a.time).map(a => ({ s: toMin(a.time), e: a.end ? toMin(a.end) : toMin(a.time) + (a.kind === 'event' ? 60 : 30), title: a.title, kind: a.kind === 'event' ? (a.rec.kind === 'focus' ? 'deep' : 'event') : 'task', act: a.kind === 'event' ? 'event' : 'task', id: a.id, done: a.kind !== 'event' && !isOpen(a.rec) }));
  list('habits').filter(h => h.time && habDue(h, d)).forEach(h => items.push({ s: toMin(h.time), e: toMin(h.time) + 15, title: h.title, kind: 'habit', act: 'hab', id: h.id, done: !!(h.done || {})[d] }));
  list('focus').filter(f => f.kind !== 'calm' && f.date === d && f.start).forEach(f => items.push({ s: toMin(f.start), e: toMin(f.start) + (Number(f.minutes) || 25), title: 'Focus · ' + (f.label || 'deep work'), kind: 'focus', act: '', id: f.id, done: true }));
  if (balOn('m', 'expect') || true) items.push({ s: toMin(ui.pushMorning || '07:30'), e: toMin(ui.pushMorning || '07:30') + 1, title: 'Morning Balance', kind: 'bal', act: 'morning', id: '', done: !!logOf('morning', d) });
  items.push({ s: toMin(ui.pushEvening || '21:30'), e: toMin(ui.pushEvening || '21:30') + 1, title: 'Night Balance', kind: 'baln', act: 'closeout', id: '', done: !!logOf('closeout', d) });
  return items.sort((a, b) => a.s - b.s || a.e - b.e);
}
const TL_ICON = { event: I.cal, deep: I.timer, task: I.tasks, habit: I.repeat, focus: I.timer, bal: I.today, baln: I.moon };
function timeline(d) {
  const it = timelineItems(d), now = new Date(), nowM = d === today() ? now.getHours() * 60 + now.getMinutes() : -1; let html = '', last = null, nowDone = nowM < 0;
  const nowRow = () => `<div class="tl-now"><span>${fromMin(nowM)}</span><i></i></div>`;
  for (const x of it) {
    if (!nowDone && nowM < x.s) { html += nowRow(); nowDone = true; }
    if (last !== null && x.s - last >= 60) html += `<div class="tl-gap"><span>${dur(x.s - last)} free</span><button class="icon-btn" data-act="new-event" data-day="${d}" data-time="${fromMin(last)}" aria-label="Add">${I.plus}</button></div>`;
    const len = Math.max(0, x.e - x.s), tall = Math.min(160, Math.max(48, len * 0.9));
    html += `<div class="tl-it k-${x.kind} ${x.done ? 'done' : ''}" ${x.act ? `data-act="${x.act}" data-id="${esc(x.id)}"` : ''} role="button" style="min-height:${tall}px"><div class="tl-t"><b>${fromMin(x.s)}</b>${len > 1 ? `<span>${fromMin(x.e)}</span>` : ''}</div><div class="tl-node">${x.done ? I.tick : TL_ICON[x.kind] || I.dot}</div><div class="tl-c"><div class="t" dir="auto">${esc(x.title)}</div>${len > 1 ? `<div class="small">${dur(len)}</div>` : ''}</div></div>`;
    last = Math.max(last || 0, x.e);
  }
  if (!nowDone) html += nowRow();
  return `<div class="timeline2">${html}</div>`;
}
function weekStrip(sel) {
  const t = today(), ws = mideast() ? addDays(t, -parseD(t).getDay()) : weekStart(t), days = []; for (let i = 0; i < 7; i++) days.push(addDays(ws, i));
  return `<div class="wstrip"><button class="icon-btn" data-act="tday-move" data-d="-7" aria-label="Previous week">${I.left}</button>${days.map(d => { const n = agenda(d, d).length; return `<button class="ws-d ${d === sel ? 'on' : ''} ${d === t ? 'td' : ''}" data-act="tday" data-day="${d}"><small>${dowS(d, 2)}</small><b>${parseD(d).getDate()}</b>${n ? '<i></i>' : ''}</button>`; }).join('')}<button class="icon-btn" data-act="tday-move" data-d="7" aria-label="Next week">${I.right}</button></div>`;
}
function vDay(d) {
  const open = list('tasks').filter(isOpen), due = sortTasks(open.filter(x => x.due === d && !x.scheduled));
  return header(fmtDate(d, true), rel(d)) + weekStrip(d) + `<button class="btn small ghost" data-act="tday" data-day="${today()}">${I.left} Back to today</button>
  <div class="card"><h2>Plan</h2>${timeline(d)}</div>${due.length ? `<div class="card"><h2>To do that day <span class="count">${due.length}</span></h2><div class="list">${due.map(x => taskRow(x)).join('')}</div></div>` : ''}`;
}
/* ================= CALENDAR: day / 3 days / week / month ================= */
const HOUR_PX = 48, H0 = 6;
function gridDays(view, sel) {
  if (view === 'day') return [sel];
  if (view === '3day') return [sel, addDays(sel, 1), addDays(sel, 2)];
  const ws = mideast() ? addDays(sel, -parseD(sel).getDay()) : weekStart(sel); const out = []; for (let i = 0; i < 7; i++) out.push(addDays(ws, i)); return out;
}
function timeGrid(days) {
  const t = today(), now = new Date(), nowM = now.getHours() * 60 + now.getMinutes(), hours = []; for (let h = H0; h < 24; h++) hours.push(h);
  const cols = days.map(d => {
    const all = agenda(d, d), timed = all.filter(a => a.time), allDay = all.filter(a => !a.time);
    const evs = timed.map(a => ({ a, s: toMin(a.time), e: a.end ? Math.max(toMin(a.end), toMin(a.time) + 15) : toMin(a.time) + 60 })).sort((x, y) => x.s - y.s);
    const lanes = []; evs.forEach(x => { let l = lanes.findIndex(end => end <= x.s); if (l < 0) { l = lanes.length; lanes.push(0); } lanes[l] = x.e; x.l = l; }); const L = Math.max(1, lanes.length);
    const blocks = evs.map(x => { const top = Math.max(0, (x.s - H0 * 60) / 60 * HOUR_PX), h = Math.max(20, (x.e - x.s) / 60 * HOUR_PX), col = x.a.kind === 'event' ? (x.a.rec.kind === 'focus' ? AREA_COL[6] : AREA_COL[0]) : x.a.kind === 'follow' ? AREA_COL[1] : AREA_COL[3];
      return `<div class="gb ${x.a.kind !== 'event' && !isOpen(x.a.rec) ? 'done' : ''}" data-act="${{ event: 'event', follow: 'application', ms: 'milestone' }[x.a.kind] || 'task'}" data-id="${esc(x.a.id)}" style="top:${top.toFixed(1)}px;height:${h.toFixed(1)}px;left:${(100 * x.l / L).toFixed(2)}%;width:${(100 / L).toFixed(2)}%;--c:${col}"><b dir="auto">${esc(x.a.title)}</b><span>${esc(x.a.time)}${x.a.end ? '–' + esc(x.a.end) : ''}</span></div>`; }).join('');
    return { d, allDay, html: `<div class="gcol ${d === t ? 'td' : ''}" data-act="cal-slot" data-day="${d}">${hours.map(() => '<i></i>').join('')}${blocks}${d === t && nowM >= H0 * 60 ? `<div class="gnow" style="top:${((nowM - H0 * 60) / 60 * HOUR_PX).toFixed(1)}px"></div>` : ''}</div>` };
  });
  return `<div class="gcal" style="--n:${days.length}"><div class="gh"><div></div>${days.map(d => `<div class="ghd ${d === t ? 'td' : ''}" data-act="cal-pick" data-day="${d}"><small>${dowS(d, 3)}</small><b>${parseD(d).getDate()}</b></div>`).join('')}</div>
  <div class="gall"><div class="small">all-day</div>${cols.map(c => `<div>${c.allDay.slice(0, 3).map(a => `<span class="gad" data-act="${{ event: 'event', follow: 'application', ms: 'milestone' }[a.kind] || 'task'}" data-id="${esc(a.id)}" dir="auto">${esc(a.title)}</span>`).join('')}${c.allDay.length > 3 ? `<span class="small">+${c.allDay.length - 3}</span>` : ''}</div>`).join('')}</div>
  <div class="gbody" id="gbody"><div class="gtimes">${hours.map(h => `<span>${pad(h)}:00</span>`).join('')}</div>${cols.map(c => c.html).join('')}</div></div>`;
}

const AREA_COL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const AREA_COL_D = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const WHEEL_PRESETS = [['classic', 'Classic Wheel of Life', ['Career', 'Money', 'Health', 'Family', 'Relationships', 'Personal growth', 'Fun & recreation', 'Home & environment']], ['milad', 'My MILAD 2031 areas', AREAS]];
const areas = () => list('areas').sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.title).localeCompare(String(b.title)));
const areaColor = a => (document.documentElement.classList.contains('dark') ? AREA_COL_D : AREA_COL)[((Number(a && a.color) || 0) % 8 + 8) % 8];
const wheels = () => list('wheel').filter(w => w.date && w.scores).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
const r2 = n => Math.round(Number(n) * 100) / 100;
const areaScore = (id, w = wheels()[0]) => w && w.scores && w.scores[id] != null ? r2(w.scores[id]) : null;
const areaTarget = a => Number(a.target) || 8;
const areaGap = a => { const s = areaScore(a.id); return s == null ? 0 : r2(Math.max(0, areaTarget(a) - s)); };
const goalArea = g => g ? (g.areaId && get('areas', g.areaId)) || areas().find(a => a.title === g.area) || null : null;
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const activeCycle = () => list('cycles').filter(c => c.status === 'active').sort((a, b) => String(b.start).localeCompare(String(a.start)))[0] || null;
const cycleDay = c => Math.max(1, Math.min(Number(c.days) || 40, daysBetween(c.start, today()) + 1));
const logOf = (type, d = today()) => list('logs').find(l => l.type === type && l.date === d) || null;
const BAL_DEF = { m: { expect: 1, focus: 1, top: 1, improve: 1, thanks: 1, note: 0 }, n: { score: 1, better: 1, carry: 1, ideas: 1, persp: 0, thanks: 1, topics: 0 } };
const balOn = (side, k) => { const p = (prefs().balance || {})[side] || {}; return p[k] === undefined ? !!BAL_DEF[side][k] : !!p[k]; };
const BAL_LABEL = { m: { expect: 'My expectation today', focus: 'My focus today', top: 'My important tasks (Top 3)', improve: 'My improvement action', thanks: 'Thank you for', note: 'Note' }, n: { score: 'Score for today (1–10)', better: 'How can I get a better score tomorrow?', carry: 'Tasks carried over to tomorrow', ideas: 'Ideas', persp: 'Perspectives', thanks: 'Thank you for', topics: 'My interesting topics today' } };
function goalProgress(g) {
  const ms = list('milestones').filter(m => m.goalId === g.id && m.status !== 'Dropped');
  if (ms.length) { const d = ms.filter(m => m.status === 'Done').length; return [d, ms.length, 'milestones']; }
  const ts = list('tasks').filter(t => t.goalId === g.id); return [ts.filter(t => !isOpen(t)).length, ts.length, 'tasks'];
}
const pct = ([d, n]) => n ? Math.round(100 * d / n) : 0;
function ring(p, size = 64, label = '') {
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  return `<svg class="ring2" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${p}%"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="rb"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="rf" stroke-dasharray="${(c * p / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="50%" dy=".35em" text-anchor="middle">${label || p + '%'}</text></svg>`;
}
/* ---------- wheel of life chart: one wedge per area, filled out to the score ---------- */
function wheelSvg(w, prev, opts = {}) {
  const as = areas(); if (!as.length) return '';
  const S = opts.size || 340, cx = S / 2, cy = S / 2, R = S / 2 - (opts.labels === false ? 6 : 58), n = as.length, step = 2 * Math.PI / n;
  const pt = (rad, ang) => [cx + rad * Math.sin(ang), cy - rad * Math.cos(ang)];
  const wedge = (rad, a0, a1) => { if (rad <= 0) return ''; const [x0, y0] = pt(rad, a0), [x1, y1] = pt(rad, a1); return `M${cx},${cy}L${x0.toFixed(1)},${y0.toFixed(1)}A${rad.toFixed(1)},${rad.toFixed(1)} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}Z`; };
  const arc = (rad, a0, a1) => { const [x0, y0] = pt(rad, a0), [x1, y1] = pt(rad, a1); return `M${x0.toFixed(1)},${y0.toFixed(1)}A${rad.toFixed(1)},${rad.toFixed(1)} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}`; };
  let g = ''; for (let k = 2; k <= 10; k += 2) g += `<circle cx="${cx}" cy="${cy}" r="${(R * k / 10).toFixed(1)}" class="wg"/>`;
  as.forEach((a, i) => {
    const a0 = i * step + 0.012, a1 = (i + 1) * step - 0.012, s = areaScore(a.id, w), p = prev ? areaScore(a.id, prev) : null, col = areaColor(a), t = areaTarget(a);
    g += `<g class="wedge" data-act="area-open" data-id="${esc(a.id)}"><path d="${wedge(R, a0, a1)}" class="wbg"/>${s ? `<path d="${wedge(R * s / 10, a0, a1)}" fill="${col}"/>` : ''}${p ? `<path d="${arc(R * p / 10, a0, a1)}" class="wprev"/>` : ''}<path d="${arc(R * t / 10, a0 + step * .3, a1 - step * .3)}" class="wtgt"/><title>${esc(a.title)}: ${s ?? '–'}/10${p ? ` (before ${p})` : ''} · target ${t}</title></g>`;
    if (opts.labels !== false) { const mid = (a0 + a1) / 2, [lx, ly] = pt(R + 14, mid), anchor = Math.abs(Math.sin(mid)) < .2 ? 'middle' : Math.sin(mid) > 0 ? 'start' : 'end'; g += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" class="wl" dy="${Math.cos(mid) < -.5 ? '.9em' : Math.cos(mid) > .5 ? '-.2em' : '.35em'}"><tspan class="wls">${s ?? '–'}</tspan> ${esc(String(a.title).slice(0, 16))}</text>`; }
  });
  const padX = opts.labels === false ? 0 : 56;
  return `<svg viewBox="${-padX} 0 ${S + 2 * padX} ${S}" class="wheel" role="img" aria-label="Wheel of Life">${g}</svg>`;
}
function wheelTable(w, prev) {
  return `<div class="list">${areas().map(a => { const s = areaScore(a.id, w), p = prev ? areaScore(a.id, prev) : null; return `<div class="row" data-act="area-open" data-id="${esc(a.id)}"><span class="sw" style="background:${areaColor(a)}"></span><div class="main"><div class="t" dir="auto">${esc(a.title)}</div><div class="bar thin"><i style="width:${(s || 0) * 10}%;background:${areaColor(a)}"></i></div></div><div class="sc"><b>${s ?? '–'}</b><span>/${areaTarget(a)}</span>${s != null && p != null && s !== p ? `<em class="${s > p ? 'up' : 'down'}">${s > p ? '▲' : '▼'}${r2(Math.abs(s - p))}</em>` : ''}</div></div>`; }).join('')}</div>`;
}
function vWheel() {
  const as = areas(), ws = wheels(), w = ws[0], prev = ws[1];
  if (!as.length) return header('Wheel of Life', '') + `<div class="card hero"><h2>Start with your Wheel of Life</h2><div class="small" style="margin-bottom:12px">Score each area of your life from 1 to 10. The wheel shows where you are balanced and where to focus your next 40 days.</div><div class="acts one">${WHEEL_PRESETS.map(([k, l, xs]) => `<button class="act" data-act="wheel-preset" data-v="${k}"><span>●</span>${l}<small class="sub2">${xs.length} areas · ${esc(xs.slice(0, 3).join(', '))}…</small></button>`).join('')}</div></div>`;
  const avg = w ? Math.round(10 * as.reduce((n, a) => n + (areaScore(a.id, w) || 0), 0) / as.length) / 10 : null;
  const low = w ? as.slice().sort((x, y) => areaGap(y) - areaGap(x)).filter(a => areaGap(a) > 0).slice(0, 2) : [];
  return header('Wheel of Life', '') + `
  <div class="card wheelcard">${w ? wheelSvg(w, prev) : '<div class="empty">Take the test to draw your wheel.</div>'}
    <div class="wleg small">${w ? `Balance ${avg}/10 · tested ${esc(fmtDate(w.date, true))}` : ''}${prev ? ' · <span class="dash"></span> previous test' : ''} · <span class="tk"></span> target</div>
    <div class="btns" style="justify-content:center;margin-top:10px"><button class="btn primary" data-act="wheel-test">${w ? 'Retake the test' : 'Take the test · 1 min'}</button><button class="btn" data-act="areas-edit">Edit areas</button></div></div>
  ${low.length ? `<div class="card coachtip"><span class="att-i">${I.spark}</span><div class="main"><b>Coach</b><div class="small">Your biggest gaps are ${low.map(a => `<b>${esc(a.title)}</b> (${areaScore(a.id)} → ${areaTarget(a)})`).join(' and ')}. Make them the focus of your next 40-day cycle.</div></div></div>` : ''}
  <div class="card">${wheelTable(w, prev)}</div>
  ${ws.length > 1 ? `<div class="card"><h2>History <span class="count">${ws.length}</span></h2><div class="list">${ws.slice(0, 12).map(x => `<div class="row"><div class="main"><div class="t">${esc(fmtDate(x.date, true))}</div><div class="m">${esc(x.note || '')}</div></div><div class="sc"><b>${Math.round(10 * as.reduce((n, a) => n + (areaScore(a.id, x) || 0), 0) / as.length) / 10}</b><span>/10</span></div></div>`).join('')}</div></div>` : ''}`;
}
function wheelTest() {
  const as = areas(); if (!as.length) { location.hash = '#/progress'; ui.pTab = 'wheel'; saveUi(); return; }
  const last = wheels()[0];
  openSheet('Wheel of Life test', `<div class="small" style="margin-bottom:10px">How satisfied are you with each area right now? 1 = not at all, 10 = fully.</div>${as.map(a => { const s = areaScore(a.id, last); return `<div class="wt" data-area="${esc(a.id)}"><div class="wt-h"><span class="sw" style="background:${areaColor(a)}"></span><b dir="auto">${esc(a.title)}</b>${s ? `<span class="small">last ${s}</span>` : ''}</div><div class="nums">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => `<button data-act="wt-pick" data-v="${v}" class="${s === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>`; }).join('')}
    <div class="f" style="margin-top:12px"><label>One line about this test (optional)</label><input name="wn" dir="auto"></div>`,
    '<button class="btn primary wide" data-act="form-save">Save my wheel</button>', { noFocus: true, onSave: () => {
      const scores = {}; sheetCtx.el.querySelectorAll('.wt').forEach(r => { const b = r.querySelector('.nums .on'); if (b) scores[r.dataset.area] = Number(b.textContent); });
      if (!Object.keys(scores).length) { toast('Tap a score for at least one area'); return; }
      save('wheel', { date: today(), scores, note: (sheetCtx.el.querySelector('[name=wn]') || {}).value || '' }); closeSheet(); toast('Wheel saved'); ui.pTab = 'wheel'; saveUi(); if (route().page !== 'progress') location.hash = '#/progress';
    } });
}
function areasEdit() {
  openSheet('Areas of your life', `<div class="small" style="margin-bottom:8px">Rename, recolour or remove areas. Goals, courses and scores stay linked.</div><div class="list">${areas().map(a => `<div class="row" data-act="area-form" data-id="${esc(a.id)}"><span class="sw" style="background:${areaColor(a)}"></span><div class="main"><div class="t" dir="auto">${esc(a.title)}</div><div class="m">target ${areaTarget(a)}/10${a.vision ? ' · ' + esc(a.vision) : ''}</div></div><span class="att-go">${I.go}</span></div>`).join('')}</div>`,
    '<button class="btn" data-act="area-form">+ Area</button><button class="btn primary" data-act="sheet-close">Done</button>', { noFocus: true });
}
function areaForm(a) {
  formColl = 'areas';
  form(a.id ? 'Edit area' : 'New area', [{ k: 'title', label: 'Area', req: true }, [{ k: 'color', label: 'Colour', type: 'select', options: AREA_COL.map((c, i) => [i, ['Blue', 'Orange', 'Aqua', 'Yellow', 'Pink', 'Green', 'Violet', 'Red'][i]]), blank: false }, { k: 'target', label: 'Target score', type: 'select', options: [5, 6, 7, 8, 9, 10], blank: false, def: 8 }], { k: 'vision', label: 'What 10/10 looks like', type: 'textarea', ph: 'One or two lines' }, 'MORE', { k: 'order', label: 'Order', type: 'number' }],
    Object.assign({ color: areas().length % 8, order: areas().length + 1 }, a), v => { if (!v.title) return 'Name the area.'; save('areas', Object.assign({}, a, v, { color: Number(v.color), target: Number(v.target) })); toast('Area saved'); },
    { onDelete: a.id ? () => { if (!confirm('Remove this area? Goals keep their data.')) return; remove('areas', a.id); closeSheet(); } : null });
}
function vArea(id) {
  const a = get('areas', id); if (!a) return header('Area', '') + '<div class="card empty">Not found.</div>';
  const gs = list('goals').filter(g => goalArea(g) && goalArea(g).id === id), cs = list('courses').filter(c => c.areaId === id), s = areaScore(id);
  const hist = wheels().slice(0, 8).reverse().filter(w => areaScore(id, w) != null);
  return header(a.title, a.vision || '') + `
  <div class="card areahero" style="--ac:${areaColor(a)}"><div class="ah-n">${s ?? '–'}<span>/10</span></div><div class="main"><div class="small">Target ${areaTarget(a)} · gap ${Math.round(areaGap(a) * 10) / 10}</div><div class="spark">${hist.map(w => `<i style="height:${areaScore(id, w) * 10}%" title="${esc(fmtDate(w.date))}: ${areaScore(id, w)}"></i>`).join('')}</div></div><button class="btn small ghost" data-act="area-form" data-id="${esc(id)}">Edit</button></div>
  <div class="card"><h2>Goals <span class="count">${gs.length}</span><span style="flex:1"></span><button class="btn small ghost" data-act="new-goal" data-area="${esc(id)}">${I.plus} Goal</button></h2>${gs.length ? `<div class="list">${gs.map(goalRow).join('')}</div>` : '<div class="empty">No goal for this area yet.</div>'}</div>
  <div class="card"><h2>Courses <span class="count">${cs.length}</span><span style="flex:1"></span><button class="btn small ghost" data-act="new-course" data-area="${esc(id)}">${I.plus} Course</button></h2>${cs.length ? `<div class="list">${cs.map(courseRow).join('')}</div>` : '<div class="empty">No course linked to this area.</div>'}</div>`;
}
/* ---------- goals: per area, with milestones ---------- */
function goalRow(g) {
  const p = goalProgress(g), a = goalArea(g), nm = list('milestones').filter(m => m.goalId === g.id && !['Done', 'Dropped'].includes(m.status)).sort((x, y) => String(x.target || '9').localeCompare(String(y.target || '9')))[0];
  return `<div class="row grow" data-act="go" data-to="goal/${encodeURIComponent(g.id)}" style="--ac:${a ? areaColor(a) : 'var(--line)'}"><div class="gbar"></div><div class="main"><div class="t" dir="auto">${esc(g.title)}</div><div class="bar thin" style="margin:6px 0 4px"><i style="width:${pct(p)}%;background:var(--ac)"></i></div><div class="m"><span>${p[0]}/${p[1]} ${p[2]}</span>${g.status && g.status !== 'Not started' ? `<span class="chip">${esc(g.status)}</span>` : ''}${g.target ? `<span>${esc(fmtDate(g.target, true))}</span>` : ''}${nm ? `<span dir="auto">Next: ${esc(nm.title).slice(0, 50)}</span>` : ''}</div></div></div>`;
}
function vGoals() {
  const as = areas(), gs = list('goals').filter(g => !['Dropped'].includes(g.status));
  const groups = as.map(a => [a, gs.filter(g => goalArea(g) && goalArea(g).id === a.id)]);
  const loose = gs.filter(g => !goalArea(g));
  return header('Goals', '') + `<div class="toolbar"><button class="btn primary" data-act="new-goal">${I.plus} Goal</button>${!as.length ? '<span class="small">Set up your Wheel of Life to group goals by area.</span>' : ''}</div>
  ${groups.map(([a, g]) => `<div class="areahead" data-act="go" data-to="area/${encodeURIComponent(a.id)}" style="--ac:${areaColor(a)}"><span class="sw"></span><b dir="auto">${esc(a.title)}</b><span class="small">${areaScore(a.id) ?? '–'}/10</span><span style="flex:1"></span><span class="small">${g.length} goal${g.length === 1 ? '' : 's'}</span></div>${g.length ? `<div class="card tight"><div class="list">${g.map(goalRow).join('')}</div></div>` : ''}`).join('')}
  ${loose.length ? `<div class="areahead"><span class="sw" style="background:var(--line)"></span><b>No area yet</b></div><div class="card tight"><div class="list">${loose.map(goalRow).join('')}</div></div>` : ''}`;
}
function vGoal(id) {
  const g = get('goals', id); if (!g) return header('Goal', '') + '<div class="card empty">This goal does not exist.</div>';
  const a = goalArea(g), p = goalProgress(g), ms = list('milestones').filter(m => m.goalId === id).sort((x, y) => String(x.target || '9').localeCompare(String(y.target || '9')));
  const ts = sortTasks(list('tasks').filter(t => t.goalId === id && isOpen(t))), cs = list('courses').filter(c => c.goalId === id || (a && c.areaId === a.id));
  const left = g.target ? daysTo(g.target) : null;
  return header(g.title, a ? a.title : '') + `
  <div class="card goalhero" style="--ac:${a ? areaColor(a) : 'var(--brass)'}">${ring(pct(p), 84)}<div class="main"><div class="small">${p[0]} of ${p[1]} ${p[2]} done</div>${left !== null ? `<div class="gl"><b>${left >= 0 ? left : Math.abs(left)}</b> days ${left >= 0 ? 'left' : 'past target'} · ${esc(fmtDate(g.target, true))}</div>` : ''}<div class="m small">${esc(g.status || 'Not started')}</div></div></div>
  ${g.why || g.measure ? `<div class="card">${g.why ? `<div class="small"><b>Why it matters</b></div><div dir="auto" style="margin:2px 0 10px">${esc(g.why)}</div>` : ''}${g.measure ? `<div class="small"><b>How I will measure it</b></div><div dir="auto">${esc(g.measure)}</div>` : ''}</div>` : ''}
  <div class="acts" style="margin-bottom:12px"><button class="act" data-act="goal-status" data-id="${esc(id)}"><span>●</span>Status</button><button class="act" data-act="goal-edit" data-id="${esc(id)}"><span>✎</span>Edit</button></div>
  <div class="card"><h2>Milestones <span class="count">${ms.filter(m => m.status === 'Done').length}/${ms.length}</span></h2>
    <div class="mlist">${ms.map(m => { const late = m.target && m.target < today() && !['Done', 'Dropped'].includes(m.status); return `<div class="row mrow2" data-act="milestone" data-id="${esc(m.id)}"><button class="check ${m.status === 'Done' ? 'done' : ''}" data-act="ms-done" data-id="${esc(m.id)}" aria-label="Done">${I.tick}</button><div class="main"><div class="t" dir="auto">${esc(m.title)}</div><div class="m">${m.target ? `<span class="chip ${late ? 'late' : ''}">${esc(fmtDate(m.target, true))}</span>` : ''}${m.status && !['Planned', 'Done'].includes(m.status) ? `<span class="chip">${esc(m.status)}</span>` : ''}</div></div></div>`; }).join('') || '<div class="empty">Break the goal into 3–5 milestones.</div>'}</div>
    <form class="qadd" data-form="ms-add" data-goal="${esc(id)}" style="margin-top:10px"><input name="q" placeholder="Add a milestone… (add a date like @2027-03-01)" dir="auto" autocomplete="off"><button class="btn primary" type="submit">${I.plus}</button></form></div>
  <div class="card"><h2>Next actions <span class="count">${ts.length}</span></h2>${ts.length ? `<div class="list">${ts.slice(0, 8).map(x => taskRow(x)).join('')}</div>` : '<div class="empty">No open task for this goal.</div>'}
    <form class="qadd" data-form="gt-add" data-goal="${esc(id)}" style="margin-top:10px"><input name="q" placeholder="Add a task for this goal…" dir="auto" autocomplete="off"><button class="btn primary" type="submit">${I.plus}</button></form></div>
  ${cs.length ? `<div class="card"><h2>Courses</h2><div class="list">${cs.map(courseRow).join('')}</div></div>` : ''}`;
}
/* ---------- 40-day cycle ---------- */
function cycleCells(c) {
  const n = Number(c.days) || 40, out = [];
  for (let i = 0; i < n; i++) { const d = addDays(c.start, i), nl = logOf('closeout', d), ml = logOf('morning', d), sc = nl && Number(nl.score);
    out.push(`<i class="${d === today() ? 'today' : ''} ${d > today() ? 'fut' : ''}" style="${sc ? `background:color-mix(in srgb,var(--brass) ${20 + sc * 8}%,var(--paper-dim))` : ''}" title="Day ${i + 1} · ${esc(fmtDate(d, true))}${sc ? ' · score ' + sc : ''}${ml ? ' · morning done' : ''}">${ml ? '<b></b>' : ''}</i>`); }
  return `<div class="cells">${out.join('')}</div>`;
}
function cycleStats(c) {
  const n = cycleDay(c); let m = 0, nn = 0, sum = 0, k = 0;
  for (let i = 0; i < n; i++) { const d = addDays(c.start, i); if (logOf('morning', d)) m++; const nl = logOf('closeout', d); if (nl) { nn++; if (Number(nl.score)) { sum += Number(nl.score); k++; } } }
  return { day: n, morning: m, night: nn, avg: k ? Math.round(10 * sum / k) / 10 : null };
}
function cycleCard(c, big) {
  const st = cycleStats(c), total = Number(c.days) || 40, gs = (c.goals || []).map(id => get('goals', id)).filter(Boolean);
  return `<div class="card cycle"><div class="cy-h">${ring(Math.round(100 * st.day / total), big ? 92 : 64, `${st.day}/${total}`)}<div class="main"><div class="small">40-day cycle · day ${st.day}</div><div class="cy-i" dir="auto">${esc(c.intention || 'My next 40 days')}</div><div class="m small">${st.morning} mornings · ${st.night} nights${st.avg ? ` · avg day ${st.avg}/10` : ''}</div></div></div>
    ${big ? cycleCells(c) + '<div class="small cleg">Each square is a day. Darker = higher day score. A dot = morning done.</div>' : ''}
    ${gs.length ? `<div class="list" style="margin-top:8px">${gs.map(goalRow).join('')}</div>` : ''}
    ${big ? `<div class="btns" style="margin-top:10px"><button class="btn small" data-act="cycle-edit" data-id="${esc(c.id)}">Edit</button><button class="btn small ${st.day >= total ? 'primary' : ''}" data-act="cycle-end" data-id="${esc(c.id)}">${st.day >= total ? 'Finish cycle and retest' : 'End early'}</button></div>` : ''}</div>`;
}
function cycleWizard() {
  const as = areas(); if (!as.length) { ui.pTab = 'wheel'; saveUi(); location.hash = '#/progress'; toast('First set up your Wheel of Life'); return; }
  const w = wheels()[0], fresh = w && daysBetween(w.date, today()) <= 14;
  const sorted = as.slice().sort((x, y) => areaGap(y) - areaGap(x)), picks = new Set(sorted.filter(a => areaGap(a) > 0).slice(0, 2).map(a => a.id));
  openSheet('Start a 40-day cycle', `${fresh ? '' : `<div class="card warnbox small" style="margin-bottom:12px">Your wheel is ${w ? 'older than two weeks' : 'empty'}. <a href="#" data-act="wheel-test">Take the test first</a> so the coach can suggest your focus.</div>`}
    <div class="small" style="margin-bottom:6px"><b>1. Focus areas</b> · pick 1 to 3</div>
    <div class="pick" id="cyAreas">${sorted.map(a => `<button class="${picks.has(a.id) ? 'on' : ''}" data-act="cy-area" data-id="${esc(a.id)}" style="--ac:${areaColor(a)}"><span class="sw"></span>${esc(a.title)}${areaScore(a.id) != null ? ` <small>${areaScore(a.id)}→${areaTarget(a)}</small>` : ''}</button>`).join('')}</div>
    <div class="small" style="margin:14px 0 6px"><b>2. One goal per focus area</b></div><div id="cyGoals"></div>
    <div class="f" style="margin-top:12px"><label>3. My intention for these 40 days</label><input name="intent" dir="auto" placeholder="In 40 days I will…"></div>
    <div class="f"><label>Start date</label><input name="start" type="date" value="${today()}"></div>`,
    '<button class="btn primary wide" data-act="form-save">Start my 40 days</button>', { noFocus: true, onSave: () => {
      const el = sheetCtx.el, ids = [...el.querySelectorAll('#cyAreas .on')].map(b => b.dataset.id); if (!ids.length) { toast('Pick at least one focus area'); return; }
      const start = el.querySelector('[name=start]').value || today(), goals = [];
      for (const aid of ids) { const sel = el.querySelector(`[name="g-${aid}"]`), txt = el.querySelector(`[name="gn-${aid}"]`); let gid = sel && sel.value;
        if ((!gid || gid === '__new') && txt && txt.value.trim()) gid = save('goals', { title: txt.value.trim(), areaId: aid, area: (get('areas', aid) || {}).title || '', status: 'In progress', target: addDays(start, 39) }).id;
        if (gid && gid !== '__new') goals.push(gid); }
      list('cycles').filter(c => c.status === 'active').forEach(c => save('cycles', Object.assign({}, c, { status: 'done' })));
      save('cycles', { start, days: 40, focus: ids, goals, intention: el.querySelector('[name=intent]').value.trim(), status: 'active' });
      closeSheet(); toast('Your 40 days start now'); ui.pTab = 'overview'; saveUi(); location.hash = '#/progress';
    } });
  drawCyGoals();
}
function drawCyGoals() {
  if (!sheetCtx) return; const box = $('#cyGoals', sheetCtx.el); if (!box) return;
  const ids = [...sheetCtx.el.querySelectorAll('#cyAreas .on')].map(b => b.dataset.id);
  box.innerHTML = ids.map(aid => { const a = get('areas', aid), gs = list('goals').filter(g => goalArea(g) && goalArea(g).id === aid && !['Achieved', 'Dropped'].includes(g.status));
    return `<div class="f"><label style="color:${areaColor(a)}">${esc(a.title)}</label>${gs.length ? `<select name="g-${aid}">${gs.map(g => `<option value="${esc(g.id)}">${esc(g.title)}</option>`).join('')}<option value="__new">+ New goal…</option></select>` : ''}<input name="gn-${aid}" dir="auto" placeholder="${gs.length ? 'Or type a new goal' : 'Goal for this area'}"></div>`; }).join('') || '<div class="small">Pick a focus area above.</div>';
}
/* ---------- morning & night balance (one minute each) ---------- */
function chipsFor(name, items, sel = [], max = 9) { return `<div class="pick bal" data-name="${name}">${items.slice(0, max).map(([v, l]) => `<button type="button" data-act="bal-chip" data-v="${esc(v)}" class="${sel.includes(v) ? 'on' : ''}" dir="auto">${esc(l)}</button>`).join('')}</div>`; }
function recentVals(field, n = 8) { const seen = new Set(); return list('logs').filter(l => l.type === 'morning' && Array.isArray(l[field])).sort((a, b) => String(b.date).localeCompare(String(a.date))).flatMap(l => l[field]).filter(x => x && !seen.has(x) && seen.add(x)).slice(0, n); }
function morningSheet() {
  const t = today(), ex = logOf('morning') || {}, c = activeCycle(), open = list('tasks').filter(isOpen);
  const top = open.filter(x => x.focusDate === t).map(x => x.id), cand = sortTasks(open.filter(x => x.focusDate === t || (x.due && x.due <= t))).concat(suggestTop(t)).filter((x, i, arr) => arr.findIndex(y => y.id === x.id) === i).slice(0, 8);
  const focusAreas = (c ? c.focus.map(id => get('areas', id)).filter(Boolean) : []).concat(areas()).filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i);
  const imp = list('habits').map(h => [h.title, h.title]).concat(recentVals('improve').map(x => [x, x])).filter((x, i, arr) => arr.findIndex(y => y[0] === x[0]) === i);
  const f = (k, html) => balOn('m', k) ? `<div class="bq"><div class="bl">${BAL_LABEL.m[k]}</div>${html}</div>` : '';
  openSheet('Morning Balance', `<div class="small bal-sub">${esc(fmtDate(t, true))}${c ? ` · day ${cycleDay(c)} of ${c.days || 40}` : ''}</div>
    ${f('expect', `<input name="expect" dir="auto" value="${esc(ex.expect || '')}" placeholder="Today will be good because…">`)}
    ${f('focus', chipsFor('focusAreas', focusAreas.map(a => [a.id, a.title]), ex.focusAreas || (c ? c.focus : []), 8) + `<input name="focus" dir="auto" value="${esc(ex.focus || '')}" placeholder="In one line…" style="margin-top:6px">`)}
    ${f('top', cand.length ? chipsFor('top', cand.map(x => [x.id, x.title]), top, 8) + '<div class="small" style="margin-top:4px">Tap up to three.</div>' : '<div class="small">No open tasks. Add some from Today.</div>')}
    ${f('improve', (imp.length ? chipsFor('improve', imp, ex.improve || [], 8) : '') + `<input name="improve" dir="auto" placeholder="One small improvement…" style="margin-top:6px">`)}
    ${f('thanks', `<input name="thanks" dir="auto" value="${esc(ex.thanks || '')}" placeholder="I am grateful for…">`)}
    ${f('note', `<input name="note" dir="auto" value="${esc(ex.note || '')}">`)}`,
    '<button class="btn primary wide" data-act="form-save">Start my day</button>', { noFocus: true, onSave: () => {
      const el = sheetCtx.el, val = n => (el.querySelector(`[name=${n}]`) || {}).value || '', on = n => [...el.querySelectorAll(`.bal[data-name=${n}] .on`)].map(b => b.dataset.v);
      const tops = on('top'); if (tops.length > 3) { toast('Keep it to three'); return; }
      if (balOn('m', 'top')) { for (const x of open) { const want = tops.includes(x.id); if (want && x.focusDate !== t) save('tasks', Object.assign({}, x, { focusDate: t })); if (!want && x.focusDate === t) save('tasks', Object.assign({}, x, { focusDate: '' })); } }
      const improve = on('improve').concat(val('improve').trim() ? [val('improve').trim()] : []);
      save('logs', Object.assign({}, ex, { type: 'morning', date: t, title: 'Morning Balance ' + fmtDate(t), expect: val('expect').trim(), focus: val('focus').trim(), focusAreas: on('focusAreas'), improve, thanks: val('thanks').trim(), note: val('note').trim() }));
      closeSheet(); toast('Have a great day ☀');
    } });
}
function nightSheet() {
  const t = today(), tm = addDays(t, 1), ex = logOf('closeout') || {}, open = list('tasks').filter(isOpen);
  const left = open.filter(x => x.focusDate === t || x.due === t), doneN = list('tasks').filter(x => !isOpen(x) && x.completedOn === t).length;
  const m = logOf('morning'), f = (k, html) => balOn('n', k) ? `<div class="bq"><div class="bl">${BAL_LABEL.n[k]}</div>${html}</div>` : '';
  openSheet('Night Balance', `<div class="small bal-sub">${doneN} done today${m && m.expect ? ` · this morning: “${esc(m.expect)}”` : ''}</div>
    ${f('score', `<div class="nums score">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => `<button data-act="score-pick" data-v="${v}" class="${Number(ex.score) === v ? 'on' : ''}">${v}</button>`).join('')}</div>`)}
    ${f('better', `<input name="better" dir="auto" value="${esc(ex.better || '')}" placeholder="Tomorrow I will…">`)}
    ${f('carry', left.length ? `<div class="list">${left.map(x => `<label class="row" style="cursor:pointer;padding:6px 2px"><input type="checkbox" name="carry" value="${esc(x.id)}" checked style="width:20px;height:20px"><div class="main"><div class="t" dir="auto">${esc(x.title)}</div></div></label>`).join('')}</div>` : '<div class="small">Nothing left over. Well done.</div>')}
    ${f('ideas', `<input name="ideas" dir="auto" value="${esc(ex.ideas || '')}">`)}${f('persp', `<input name="persp" dir="auto" value="${esc(ex.persp || '')}">`)}
    ${f('thanks', `<input name="thanks" dir="auto" value="${esc(ex.thanks || '')}" placeholder="I am grateful for…">`)}${f('topics', `<input name="topics" dir="auto" value="${esc(ex.topics || '')}">`)}`,
    '<button class="btn primary wide" data-act="form-save">Close the day</button>', { noFocus: true, onSave: () => {
      const el = sheetCtx.el, val = n => ((el.querySelector(`[name=${n}]`) || {}).value || '').trim();
      const carry = [...el.querySelectorAll('[name=carry]:checked')].map(x => x.value), sc = el.querySelector('.nums.score .on'), score = sc ? Number(sc.textContent) : (Number(ex.score) || '');
      for (const x of left) if (carry.includes(x.id)) save('tasks', Object.assign({}, x, x.focusDate === t ? { focusDate: tm, due: x.due && x.due <= t ? tm : x.due } : { due: tm }));
      save('logs', Object.assign({}, ex, { type: 'closeout', date: t, title: 'Night Balance ' + fmtDate(t), score, mood: score ? Math.ceil(score / 2) : ex.mood || '', better: val('better'), ideas: val('ideas'), persp: val('persp'), thanks: val('thanks'), topics: val('topics'), done: ex.done || '', notes: carry.length ? 'Carried over: ' + left.filter(x => carry.includes(x.id)).map(x => x.title).join('; ') : '' }));
      closeSheet(); toast('Day closed. Sleep well.');
      const tp = list('tasks').filter(x => x.focusDate === t); if (score >= 8 || (tp.length >= 3 && tp.every(x => !isOpen(x)))) celebrate();
    } });
}
function balanceSettings() {
  const row = (side, k) => `<button class="${balOn(side, k) ? 'on' : ''}" data-act="bal-toggle" data-s="${side}" data-k="${k}">${balOn(side, k) ? '✓ ' : ''}${BAL_LABEL[side][k]}</button>`;
  return `<div class="small" style="margin-bottom:6px">Morning</div><div class="pick">${Object.keys(BAL_DEF.m).map(k => row('m', k)).join('')}</div><div class="small" style="margin:12px 0 6px">Night</div><div class="pick">${Object.keys(BAL_DEF.n).map(k => row('n', k)).join('')}</div>`;
}

/* ---------- habits ---------- */
const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const habDays = h => Array.isArray(h.days) && h.days.length ? h.days.map(Number) : [0, 1, 2, 3, 4, 5, 6];
const habDue = (h, d) => habDays(h).includes(parseD(d).getDay());
const habSched = h => { const ds = habDays(h).slice().sort(); if (ds.length === 7) return 'Every day'; if (ds.join() === '0,1,2,3,4') return 'Sun–Thu'; if (ds.join() === '1,2,3,4,5') return 'Mon–Fri'; return ds.map(i => DOWS[i]).join(', '); };
const habColor = h => AREA_COL[((Number(h.color) || 0) % 8 + 8) % 8];
function habitWeek(h, ws = weekStart()) { let n = 0; for (let i = 0; i < 7; i++) if ((h.done || {})[addDays(ws, i)]) n++; return n; }
function habDueCount(h, from, to) { let n = 0; for (let d = from; d <= to; d = addDays(d, 1)) if (habDue(h, d)) n++; return n; }
function habRate(h, days = 30) { const from = addDays(today(), -(days - 1)); let due = 0, done = 0; for (let d = from; d <= today(); d = addDays(d, 1)) { if (habDue(h, d)) { due++; if ((h.done || {})[d]) done++; } } return due ? Math.round(100 * done / due) : 0; }
function habBest(h) { const ds = Object.keys(h.done || {}).sort(); if (!ds.length) return 0; let best = 0, cur = 0; for (let d = ds[0]; d <= today(); d = addDays(d, 1)) { if (!habDue(h, d)) continue; if ((h.done || {})[d]) { cur++; best = Math.max(best, cur); } else cur = 0; } return best; }
function habitStreak(h) { const d0 = h.done || {}; let d = today(); if (!d0[d]) d = addDays(d, -1); let n = 0, k = 0; while (k++ < 800) { if (!habDue(h, d)) { d = addDays(d, -1); continue; } if (!d0[d]) break; n++; d = addDays(d, -1); } return n; }
function habitStrip() {
  const t = today(); const hs = list('habits').filter(h => habDue(h, t)).sort((a, b) => String(a.time || '99').localeCompare(String(b.time || '99')) || String(a.title).localeCompare(String(b.title)));
  if (!hs.length) return '';
  return `<div class="habits">${hs.map(h => { const on = !!(h.done || {})[t]; return `<button class="hab ${on ? 'on' : ''}" data-act="hab-day" data-id="${esc(h.id)}" data-d="${t}" style="--ac:${habColor(h)}"><span class="hk">${on ? '✓' : ''}</span><span dir="auto">${esc(h.title)}</span>${habitStreak(h) > 1 ? `<i>🔥${habitStreak(h)}</i>` : ''}</button>`; }).join('')}</div>`;
}
/* ---------- money ---------- */
const money = () => list('money').filter(m => m.date && m.amount !== '' && !isNaN(Number(m.amount))).sort((a, b) => a.date.localeCompare(b.date));
const fmtMoney = n => ((prefs().currency || '') + ' ' + Math.round(Number(n)).toLocaleString('en-GB')).trim();
function linFit(pts) { // pts [[x,y]] -> {a,b} with y = a + b x
  const n = pts.length; if (n < 2) return null; const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0); if (!sxx) return null; const b = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / sxx; return { a: my - b * mx, b };
}
const dayNum = d => Math.round(parseD(d).getTime() / 86400000);
const numDay = n => dstr(new Date(n * 86400000 + 12 * 3600000));
function forecastSavings() { const m = money(); const goal = Number(prefs().savingsGoal) || 0; if (!goal || m.length < 2) return null; const f = linFit(m.map(x => [dayNum(x.date), Number(x.amount)])); if (!f || f.b <= 0) return { stalled: true }; const last = Number(m[m.length - 1].amount); if (last >= goal) return { reached: true }; return { date: numDay(Math.ceil((goal - f.a) / f.b)) }; }
function vMoney() {
  const m = money(); const goal = Number(prefs().savingsGoal) || 0; const last = m.length ? Number(m[m.length - 1].amount) : 0; const fc = forecastSavings();
  return header('Money', '') + `
  <div class="card hero"><div class="small">Savings now</div><div class="hero-n">${m.length ? esc(fmtMoney(last)) : '—'}</div>
    ${goal ? `<div class="bar" style="margin-top:10px"><i style="width:${Math.min(100, Math.round(100 * last / goal))}%"></i></div><div class="small" style="margin-top:6px">${Math.round(100 * last / goal)}% of ${esc(fmtMoney(goal))} goal${fc && fc.date ? ` · at this pace: ${esc(fmtDate(fc.date, true))}` : fc && fc.reached ? ' · goal reached 🎉' : fc && fc.stalled ? ' · not growing yet' : ''}</div>` : '<div class="small">Set a savings goal, for example the proof of funds you will need.</div>'}
    <div class="btns" style="margin-top:12px"><button class="btn primary" data-act="money-add">Update balance</button><button class="btn small ghost" data-act="money-goal">${goal ? 'Change goal' : 'Set goal'}</button></div></div>
  ${m.length > 1 ? `<div class="card" style="margin-top:12px"><h2>Trend</h2>${lineChart(m.map(x => [x.date, Number(x.amount)]), goal, v => fmtMoney(v))}</div>` : ''}
  <div class="card" style="margin-top:12px"><h2>History <span class="count">${m.length}</span></h2>${m.length ? `<div class="list">${m.slice().reverse().map(x => `<div class="row" data-act="money-edit" data-id="${esc(x.id)}"><div class="main"><div class="t">${esc(fmtMoney(x.amount))}</div><div class="m"><span>${esc(fmtDate(x.date, true))}</span>${x.note ? `<span dir="auto">${esc(x.note)}</span>` : ''}</div></div></div>`).join('')}</div>` : '<div class="empty">No balance recorded yet.</div>'}</div>`;
}
function lineChart(pts, target, fmt) {
  const W = 320, H = 130, pl = 6, pr = 6, pt = 14, pb = 18; const ys = pts.map(p => p[1]).concat(target ? [target] : []);
  const lo = Math.min(...ys) * 0.95, hi = Math.max(...ys) * 1.05 || 1; const x0 = dayNum(pts[0][0]), x1 = Math.max(x0 + 1, dayNum(pts[pts.length - 1][0]));
  const x = d => pl + (dayNum(d) - x0) / (x1 - x0) * (W - pl - pr), y = v => pt + (hi - v) / (hi - lo || 1) * (H - pt - pb);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" class="bchart" role="img" aria-label="Trend, latest ${esc(fmt(last[1]))}">${target ? `<line x1="${pl}" x2="${W - pr}" y1="${y(target)}" y2="${y(target)}" class="tg"/><text x="${W - pr}" y="${y(target) - 4}" class="ax" text-anchor="end">goal ${esc(fmt(target))}</text>` : ''}<path d="${path}" class="ln"/>${pts.map(p => `<g class="pt"><circle cx="${x(p[0])}" cy="${y(p[1])}" r="10" class="hit"/><circle cx="${x(p[0])}" cy="${y(p[1])}" r="3.5" class="off"/><title>${esc(fmtDate(p[0], true))}: ${esc(fmt(p[1]))}</title></g>`).join('')}<text x="${pl}" y="${H - 3}" class="ax">${esc(fmtDate(pts[0][0]))}</text><text x="${W - pr}" y="${H - 3}" class="ax" text-anchor="end">${esc(fmtDate(last[0]))}</text></svg>`;
}
/* ---------- scorecard + forecasts ---------- */
function weekScore(ws) {
  const we = addDays(ws, 6), tasks = list('tasks');
  const topAll = tasks.filter(t => t.focusDate && t.focusDate >= ws && t.focusDate <= we), topDone = topAll.filter(t => !isOpen(t));
  const tgt = weekTarget(), mins = weekMinutes(ws);
  const hs = list('habits'), hTarget = hs.reduce((n, h) => n + habDueCount(h, ws, we), 0), hDone = hs.reduce((n, h) => { let k = 0; for (let d = ws; d <= we; d = addDays(d, 1)) if (habDue(h, d) && (h.done || {})[d]) k++; return n + k; }, 0);
  const career = list('applications').filter(a => inWeek(a.appliedOn, ws) || inWeek(String(a.updatedAt || '').slice(0, 10), ws)).length + tasks.filter(t => /Career/.test(t.area || '') && inWeek(t.completedOn, ws)).length;
  const imm = list('immigration'), immOk = imm.filter(x => ['Ready', 'Submitted', 'Not needed'].includes(x.status)).length;
  const rows = [
    ['Execution', topAll.length ? Math.round(100 * topDone.length / topAll.length) : null, `${topDone.length} of ${topAll.length} Top 3 items done`],
    ['Learning', tgt ? Math.min(100, Math.round(100 * mins / tgt)) : null, `${hrs(mins)} of ${hrs(tgt)} h`],
    ['Habits', hTarget ? Math.round(100 * hDone / hTarget) : null, `${hDone} of ${hTarget} check-ins`],
    ['Career', Math.min(100, career * 25), `${career} job actions (4 = 100)`],
    ['Migration', imm.length ? Math.round(100 * immOk / imm.length) : null, `${immOk} of ${imm.length} documents ready`]
  ];
  const vals = rows.map(r => r[1]).filter(v => v !== null);
  return { rows, total: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
}
function forecasts() {
  const out = []; const vd = visionDate();
  const ie = list('ielts').filter(e => e.skill === 'Overall' && e.date && bandOf(e) !== null).sort((a, b) => a.date.localeCompare(b.date));
  if (ie.length >= 3) { const f = linFit(ie.map(e => [dayNum(e.date), bandOf(e)])); const last = bandOf(ie[ie.length - 1]); if (last >= 7.5) out.push(['IELTS overall', 'Target 7.5 reached in your log. Book or confirm the official test.', 'ok']); else if (f && f.b > 0) { const d = numDay(Math.ceil((7.5 - f.a) / f.b)); out.push(['IELTS overall', `At this pace, 7.5 around ${fmtDate(d, true)}`, d <= vd ? 'ok' : 'warn']); } else out.push(['IELTS overall', 'Bands are not rising yet. Look at the weakest skill.', 'warn']); }
  else out.push(['IELTS overall', `Needs 3 overall bands to project (${ie.length} so far)`, '']);
  const ms = list('milestones'), done = ms.filter(m => m.status === 'Done' && m.doneOn).sort((a, b) => a.doneOn.localeCompare(b.doneOn)), left = ms.filter(m => !['Done', 'Dropped'].includes(m.status)).length;
  if (done.length >= 2 && left) { const span = Math.max(30, dayNum(today()) - dayNum(done[0].doneOn)); const rate = done.length / span; const d = numDay(dayNum(today()) + Math.ceil(left / rate)); out.push(['Roadmap', `${left} milestones left; at this pace done by ${fmtDate(d, true)}`, d <= vd ? 'ok' : 'warn']); }
  else out.push(['Roadmap', ms.length ? `${left} milestones left. Projection starts after 2 are done.` : 'Add milestones in Roadmap to see a projection.', '']);
  const fs = forecastSavings(); if (fs) out.push(['Savings', fs.reached ? 'Goal reached' : fs.stalled ? 'Balance is not growing yet' : `Goal reached around ${fmtDate(fs.date, true)}`, fs.reached || (fs.date && fs.date <= vd) ? 'ok' : 'warn']);
  const w0 = weekMinutes(weekStart()), w1 = weekMinutes(addDays(weekStart(), -7)), tgt = weekTarget(); if (tgt) out.push(['Learning', `Last week ${hrs(w1)} h, this week ${hrs(w0)} h, target ${hrs(tgt)} h`, w1 >= tgt ? 'ok' : 'warn']);
  return out;
}
function vOverview() {
  const ws = weekStart(), s = weekScore(ws), p = weekScore(addDays(ws, -7)); const hs = list('habits'); const c = activeCycle(), w = wheels()[0];
  return header('Overview', '') + `
  ${c ? cycleCard(c, true) : `<div class="card hero"><h2>Your next 40 days</h2><div class="small" style="margin-bottom:12px">A repeatable plan: test your wheel, pick 1–3 focus areas, set one goal for each, then run a one-minute Morning and Night Balance every day.</div><button class="btn primary" data-act="cycle-new">Start a 40-day cycle</button></div>`}
  <div class="card wheelmini" data-act="p-tab" data-t="wheel" role="button">${areas().length && w ? wheelSvg(w, wheels()[1], { size: 200, labels: false }) : `<div class="empty">${areas().length ? 'Take the Wheel of Life test' : 'Set up your Wheel of Life'}</div>`}<div class="main"><b>Wheel of Life</b><div class="small">${w ? `Tested ${esc(fmtDate(w.date, true))}` : 'Score each area of your life in one minute.'}</div><span class="att-go">${I.go}</span></div></div>
  <div class="card score">
<div class="score-n">${s.total ?? '—'}</div><div><b>This week's score</b><div class="small">${p.total !== null && s.total !== null ? (s.total >= p.total ? '▲ ' : '▼ ') + Math.abs(s.total - p.total) + ' vs last week' : 'Average of the areas below'}</div></div></div>
  <div class="tiles">${s.rows.map((r, i) => { const pv = p.rows[i][1]; return `<div class="tile"><div class="tl">${r[0]}</div><div class="tv">${r[1] === null ? '—' : r[1]}</div><div class="bar"><i style="width:${r[1] || 0}%"></i></div><div class="small" dir="auto">${esc(r[2])}${r[1] !== null && pv !== null && pv !== r[1] ? ` · ${r[1] > pv ? '▲' : '▼'} ${Math.abs(r[1] - pv)}` : ''}</div></div>`; }).join('')}</div>
  <div class="card" style="margin-top:12px"><h2>Projections</h2><div class="small" style="margin-bottom:6px">Straight-line projections from your own records. Not promises.</div><div class="list">${forecasts().map(([t, m, tone]) => `<div class="row"><span class="dotx ${tone}"></span><div class="main"><div class="t">${esc(t)}</div><div class="m">${esc(m)}</div></div></div>`).join('')}</div></div>
  <div class="card" style="margin-top:12px"><h2>Habits <span class="count">${hs.length}</span><span style="flex:1"></span><button class="btn small ghost" data-act="new-habit">${I.plus} Habit</button></h2>${hs.length ? `<div class="list">${hs.map(h => `<div class="row" data-act="habit" data-id="${esc(h.id)}"><div class="main"><div class="t" dir="auto">${esc(h.title)}</div><div class="m"><span>${habitWeek(h)} of ${Number(h.perWeek) || 7} this week</span>${habitStreak(h) ? `<span>🔥 ${habitStreak(h)} days</span>` : ''}</div></div><div class="week7">${[0, 1, 2, 3, 4, 5, 6].map(i => `<i class="${(h.done || {})[addDays(ws, i)] ? 'on' : ''}"></i>`).join('')}</div></div>`).join('')}</div>` : '<div class="empty">Small daily habits: exercise, sleep by 11, 20 min reading. Tick them on Today.</div>'}</div>
  <div class="btns" style="margin-top:12px"><a class="btn" href="#/report">Progress report (PDF)</a><button class="btn" data-act="weekly">Weekly review</button>${c ? '' : '<button class="btn" data-act="cycle-new">Start a cycle</button>'}</div>`;
}
/* ---------- courses ---------- */
const COURSE_STATES = ['Planned', 'Active', 'Paused', 'Done', 'Dropped'];
const L = (arr) => arr.map((t, i) => ({ id: 'l' + (i + 1), t, done: false, doneOn: '' }));
const SQL_STAGES = [['Core queries', 'SELECT, WHERE, GROUP BY, HAVING, dates', 'Q1, Q2, Q3, Q6 correct unaided'], ['Joins and keys', 'INNER/LEFT JOIN, anti-join, duplicates, grain', 'correct + explain the grain'], ['KPI queries', 'CASE, date arithmetic, ratios', 'SQL equals the expected values'], ['Data-quality SQL', 'missing, out-of-range, duplicates, date order, orphans', 'all 8 seeded defects found, none altered'], ['Analytical SQL and design', 'CTEs, window functions, views, ER model', '10 questions unaided; ER model explained']];
const COURSE_STARTERS = [
  { key: 'sql', title: 'SQL learning path (20 sessions)', skill: /sql/i, provider: 'Self-study, SQLite', gate: 'Starts after Power BI Page 1 is built and QA-checked.', perWeek: 2, lessons: () => L(SQL_STAGES.flatMap(([n, k, pc], si) => [1, 2, 3, 4].map(i => `S${si * 4 + i} · ${n} (${i}/4): ${k}`).concat([`Stage ${si + 1} pass check: ${pc}`]))) },
  { key: 'pbi', title: 'Power BI build: construction dashboard (S0–S10)', skill: /power bi/i, provider: 'Self-build, Power BI Desktop', gate: '', perWeek: 3, lessons: () => L(['S0 Open Power BI Desktop and note the version', 'S1 Download the six CSVs to C:\\MILAD2031\\PBI1\\data', 'S2 Import and check row counts', 'S3 Four relationships, StatusDate and Measures tables', 'S4 Calculated columns and measures', 'S5 Results log before visuals', 'S6 Page 1 layout', 'S7 Slicers', 'S8 Empty states', 'S9 Defects log', 'S10 Save the .pbix and upload it']) },
  { key: 'ielts', title: 'IELTS weekly practice cycle', skill: /ielts/i, provider: 'Self-study with official practice tests', gate: '', perWeek: 4, lessons: () => L([1, 2, 3].flatMap(r => [`Round ${r}: Listening test (timed) and review`, `Round ${r}: Reading test (timed) and review`, `Round ${r}: Writing Task 1 and 2 (timed)`, `Round ${r}: Speaking recording and self-review`])) }
];
const cLessons = c => Array.isArray(c.lessons) ? c.lessons : [];
const cNext = c => cLessons(c).find(l => !l.done);
const cPct = c => { const ls = cLessons(c); return ls.length ? Math.round(100 * ls.filter(l => l.done).length / ls.length) : Math.max(0, Math.min(100, Number(c.progress) || 0)); };
const cWeekDone = c => cLessons(c).filter(l => l.done && inWeek(l.doneOn, weekStart())).length;
const courseLive = () => list('courses').filter(c => ['Active', 'Planned'].includes(c.status || 'Planned'));
function cleanMd(s) { return String(s).replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim(); }
function parseNoteLessons(md) {
  const out = []; let inTable = 0;
  for (const raw of String(md || '').split('\n')) {
    const line = raw.trim(); let m;
    if (/^\|.*\|$/.test(line)) { if (/^\|[\s|:\-]+\|$/.test(line)) continue; inTable++; if (inTable === 1) continue; const cells = line.slice(1, -1).split('|').map(x => cleanMd(x)); if (cells[0]) out.push(cells[0] + (cells[1] ? ` (${cells[1]})` : '')); continue; }
    inTable = 0;
    if ((m = line.match(/^[-*+]\s+(?:\[[ xX]\]\s*)?(.+)$/)) || (m = line.match(/^\d+[.)]\s+(.+)$/))) out.push(cleanMd(m[1]));
  }
  return out.filter(Boolean).slice(0, 120);
}
function courseRow(c) {
  const n = cNext(c), ls = cLessons(c), ca = c.areaId && get('areas', c.areaId);
  return `<div class="row crow" data-act="go" data-to="course/${encodeURIComponent(c.id)}"><div class="main"><div class="t" dir="auto">${esc(c.title)}</div><div class="bar" style="margin:6px 0 4px"><i style="width:${cPct(c)}%"></i></div><div class="m"><span>${ls.length ? `${ls.filter(l => l.done).length}/${ls.length}` : `${cPct(c)}%`}</span>${c.cert ? '<span class="chip s-done">certificate</span>' : ''}${c.target ? `<span>by ${esc(fmtDate(c.target))}</span>` : ''}${ca ? `<span class="achip" style="--ac:${areaColor(ca)}"><span class="sw"></span>${esc(ca.title)}</span>` : ''}${c.status && c.status !== 'Active' ? `<span class="chip">${esc(c.status)}</span>` : ''}${n ? `<span dir="auto">Next: ${esc(n.t).slice(0, 70)}</span>` : ls.length ? '<span>All lessons done 🎉</span>' : c.provider ? `<span dir="auto">${esc(c.provider)}</span>` : ''}</div></div>${n && (c.status || 'Planned') !== 'Paused' ? `<button class="icon-btn playb" data-act="c-start" data-id="${esc(c.id)}" aria-label="Start next lesson">${I.play}</button>` : ''}</div>`;
}
function vCourses() {
  const rank = s => ({ Active: 0, Planned: 1, Paused: 2, Done: 3, Dropped: 4 })[s || 'Planned'];
  const cs = list('courses').sort((a, b) => rank(a.status) - rank(b.status) || (Number(a.order) || 999) - (Number(b.order) || 999) || String(a.title).localeCompare(String(b.title)));
  const live = cs.filter(c => ['Active', 'Planned', 'Paused'].includes(c.status || 'Planned')), old = cs.filter(c => !live.includes(c));
  return `<div class="card"><h2>${I.course} Courses <span class="count">${live.length}</span><span style="flex:1"></span><button class="btn small ghost" data-act="new-course">${I.plus} Course</button></h2>
    ${live.length ? `<div class="list">${live.map(courseRow).join('')}</div>` : '<div class="empty">No courses yet. Start from your SQL path, the Power BI build, an IELTS cycle, or any note.</div>'}
    ${old.length ? `<details class="donebox" style="margin-top:6px"><summary>Finished or dropped (${old.length})</summary><div class="list">${old.map(courseRow).join('')}</div></details>` : ''}</div><div style="height:14px"></div>`;
}
function vCourse(id) {
  const c = get('courses', id); if (!c) return header('Course', '') + '<div class="card empty">This course does not exist.</div>';
  const ls = cLessons(c), sk = c.skillId && get('skills', c.skillId), n = cNext(c);
  return header(c.title, `${c.status || 'Planned'} · ${cPct(c)}% done`) + `
  <div class="card"><div class="m small" style="display:flex;flex-wrap:wrap;gap:6px 12px">${sk ? `<span>Skill: ${esc(sk.title)}</span>` : ''}${c.provider ? `<span dir="auto">${esc(c.provider)}</span>` : ''}${c.perWeek ? `<span>${esc(c.perWeek)} lessons / week · ${cWeekDone(c)} this week</span>` : ''}${c.nextReview ? `<span>Review ${esc(rel(c.nextReview))}</span>` : ''}${c.link ? `<a href="${esc(c.link)}" target="_blank" rel="noopener">Open course</a>` : ''}</div>
    ${c.gate ? `<div class="warnbox card small" style="margin-top:10px" dir="auto">${esc(c.gate)}</div>` : ''}
    <div class="bar" style="margin-top:12px"><i style="width:${cPct(c)}%"></i></div>
    <div class="acts" style="margin-top:12px">${n ? `<button class="act pri" data-act="c-start" data-id="${esc(c.id)}"><span>▶</span>Start: ${esc(n.t).slice(0, 48)}</button>` : ''}<button class="act" data-act="c-review" data-id="${esc(c.id)}"><span>⟳</span>Review course</button><button class="act" data-act="c-edit" data-id="${esc(c.id)}"><span>✎</span>Edit</button></div></div>
  <div class="card" style="margin-top:12px"><h2>Lessons <span class="count">${ls.filter(l => l.done).length}/${ls.length}</span><span style="flex:1"></span><button class="btn small ghost" data-act="c-lessons" data-id="${esc(c.id)}">Edit list</button></h2>
    <div class="list">${ls.map(l => `<div class="row"><button class="check ${l.done ? 'done' : ''}" data-act="c-tick" data-id="${esc(c.id)}" data-l="${esc(l.id)}" aria-label="Done">${I.tick}</button><div class="main"><div class="t" dir="auto">${esc(l.t)}</div>${l.done && l.doneOn ? `<div class="m">${esc(fmtDate(l.doneOn, true))}${l.min ? ' · ' + l.min + ' min' : ''}</div>` : ''}</div>${!l.done ? `<button class="icon-btn playb small" data-act="c-start" data-id="${esc(c.id)}" data-l="${esc(l.id)}" aria-label="Start">${I.play}</button>` : ''}</div>`).join('') || '<div class="empty">No lessons. Tap Edit list.</div>'}</div></div>
  ${(c.reviews || []).length ? `<div class="card" style="margin-top:12px"><h2>Reviews</h2><div class="list">${c.reviews.slice().reverse().map(r => `<div class="row"><div class="main"><div class="t">${esc(r.decision)}</div><div class="m"><span>${esc(fmtDate(r.date, true))}</span>${r.note ? `<span dir="auto">${esc(r.note)}</span>` : ''}</div></div></div>`).join('')}</div></div>` : ''}`;
}
function courseForm(c) {
  formColl = 'courses';
  form(c.id ? 'Edit course' : 'New course', [{ k: 'title', label: 'Course', req: true }, [{ k: 'progress', label: 'Progress %', type: 'number' }, { k: 'target', label: 'Finish by', type: 'date' }], { k: 'cert', label: 'Certificate earned', type: 'check' }, [{ k: 'status', label: 'Status', type: 'select', options: COURSE_STATES, blank: false, def: 'Active' }, { k: 'areaId', label: 'Area of life', type: 'select', options: () => areas().map(a => [a.id, a.title]) }], [{ k: 'skillId', label: 'Skill', type: 'select', options: skillOpts }, { k: 'goalId', label: 'Goal', type: 'select', options: goalOpts }], { k: 'perWeek', label: 'Lessons per week', type: 'select', options: [1, 2, 3, 4, 5, 6, 7], def: 2 }, 'MORE', { k: 'provider', label: 'Provider / platform' }, { k: 'link', label: 'Course link', type: 'url' }, { k: 'gate', label: 'Start condition', ph: 'e.g. after Power BI Page 1' }, { k: 'reviewEvery', label: 'Review every (days)', type: 'number', def: 30 }, ...(c.id ? [] : [{ k: 'lessonText', label: 'Lessons, one per line', type: 'textarea' }])], c, v => {
    if (!v.title) return 'Give the course a name.';
    const rec = Object.assign({}, c, v); if (!c.id) { rec.lessons = L(String(v.lessonText || '').split('\n').map(x => x.trim()).filter(Boolean)); delete rec.lessonText; rec.nextReview = addDays(today(), Number(v.reviewEvery) || 30); }
    const r = save('courses', rec); toast('Course saved'); if (!c.id) setTimeout(() => { location.hash = '#/course/' + encodeURIComponent(r.id); }, 50);
  }, { onDelete: c.id ? () => { remove('courses', c.id); closeSheet(); location.hash = '#/progress'; } : null });
}
function newCourseSheet(areaId) {
  const notes = list('notes').sort((a, b) => String(a.title).localeCompare(String(b.title)));
  const as = areas().slice().sort((x, y) => areaGap(y) - areaGap(x)), coachPick = as.find(a => areaGap(a) > 0 && !list('courses').some(c => c.areaId === a.id && ['Active', 'Planned'].includes(c.status)));
  const cur = areaId || (coachPick && coachPick.id) || '';
  openSheet('New course', `${as.length ? `<div class="small" style="margin-bottom:6px"><b>Which area of life is it for?</b></div><div class="pick" id="ncArea">${as.map(a => `<button class="${a.id === cur ? 'on' : ''}" data-act="nc-area" data-id="${esc(a.id)}" style="--ac:${areaColor(a)}"><span class="sw"></span>${esc(a.title)}${coachPick && coachPick.id === a.id ? ' <small>coach pick</small>' : ''}</button>`).join('')}</div><div style="height:12px"></div>` : ''}<div class="small" style="margin-bottom:6px">Start from a plan you already have</div><div class="acts one">${COURSE_STARTERS.map(s => `<button class="act" data-act="c-starter" data-v="${s.key}"><span>★</span>${esc(s.title)}</button>`).join('')}</div>
    ${notes.length ? `<div class="small" style="margin:14px 0 6px">Or turn a note's list into lessons</div><div class="acts one">${notes.map(n => `<button class="act" data-act="c-from-note" data-id="${esc(n.id)}"><span>≡</span><span dir="auto" style="width:auto;text-align:inherit;color:inherit;font-size:inherit">${esc(n.title)}</span></button>`).join('')}</div>` : ''}
    <div class="acts one" style="margin-top:12px"><button class="act" data-act="c-blank"><span>+</span>Blank course</button></div>`, '', { noFocus: true });
}
const ncArea = () => { const b = sheetCtx && sheetCtx.el.querySelector('#ncArea .on'); return b ? b.dataset.id : ''; };
function lessonsFromNote(id) {
  const n = get('notes', id); if (!n) return; const items = parseNoteLessons(n.body);
  if (!items.length) { toast('No list found in this note'); return; }
  closeSheet(true);
  openSheet('Lessons from note', `<div class="small" style="margin-bottom:8px">Untick anything that is not a lesson.</div><div class="f"><label>Course name</label><input name="ct" dir="auto" value="${esc(n.title)}"></div><div class="list">${items.map((t, i) => `<label class="row" style="cursor:pointer"><input type="checkbox" name="li" value="${i}" checked style="width:22px;height:22px;margin-top:2px"><div class="main"><div class="t" dir="auto">${esc(t)}</div></div></label>`).join('')}</div>`,
    '<button class="btn" data-act="sheet-close">Cancel</button><button class="btn primary" data-act="form-save">Create course</button>', { noFocus: true, onSave: () => {
      const el = sheetCtx.el; const pick = [...el.querySelectorAll('input[name=li]:checked')].map(x => items[Number(x.value)]);
      if (!pick.length) return; const r = save('courses', { title: el.querySelector('[name=ct]').value.trim() || n.title, status: 'Active', perWeek: 2, reviewEvery: 30, nextReview: addDays(today(), 30), lessons: L(pick), source: n.id, areaId: ui.ncArea || '' });
      closeSheet(); toast('Course created'); location.hash = '#/course/' + encodeURIComponent(r.id);
    } });
}
function courseReview(id) {
  const c = get('courses', id); if (!c) return; closeSheet(true);
  const ls = cLessons(c), last30 = ls.filter(l => l.done && l.doneOn >= addDays(today(), -30)).length;
  openSheet('Review: ' + c.title, `<div class="small" style="margin-bottom:10px">${cPct(c)}% done · ${last30} lessons in the last 30 days${c.perWeek ? ` · plan ${c.perWeek}/week` : ''}.<br>Is this still the right course for your 2031 goals?</div>
    <div class="f"><label>Note (optional)</label><input name="rn" dir="auto" placeholder="Why, or what to change"></div>
    <div class="acts">${[['Active', '▶', 'Keep going'], ['Paused', '⏸', 'Pause for now'], ['Done', '✓', 'Finished'], ['Dropped', '✕', 'Drop it']].map(([s, ic, l]) => `<button class="act ${s === 'Active' ? 'pri' : ''}" data-act="c-decide" data-id="${esc(id)}" data-v="${s}"><span>${ic}</span>${l}</button>`).join('')}</div>`, '', { noFocus: true });
}
function courseStart(id, lid) {
  const c = get('courses', id); if (!c) return; const l = lid ? cLessons(c).find(x => x.id === lid) : cNext(c); if (!l) return;
  if (c.status !== 'Active') save('courses', Object.assign({}, c, { status: 'Active' }));
  ui.focus = { kind: 'lesson', course: id, lesson: l.id, title: l.t, dur: 25, start: Date.now(), paused: 0, pausedAt: 0 }; saveUi(); closeSheet(true); focusShow();
}
function lessonDone(id, lid, mins) {
  const c = get('courses', id); if (!c) return;
  const ls = cLessons(c).map(l => l.id === lid ? Object.assign({}, l, { done: !l.done, doneOn: l.done ? '' : today(), min: mins || l.min || '' }) : l);
  save('courses', Object.assign({}, c, { lessons: ls, status: ls.every(l => l.done) ? 'Done' : (c.status === 'Planned' ? 'Active' : c.status) }));
}

/* ---------- journal ---------- */
const MOODS = ['', '😞', '🙁', '😐', '🙂', '😄'];
function vJournal() {
  const logs = list('logs').filter(l => l.type === 'closeout' || l.type === 'journal').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const byDay = {}; logs.forEach(l => { if (!byDay[l.date]) byDay[l.date] = l; });
  const days = []; for (let i = 111; i >= 0; i--) days.push(addDays(today(), -i));
  return header('Journal', 'One line a day, written when you close the day') + `
  <div class="card"><div class="heat">${days.map(d => { const l = byDay[d]; return `<i class="m${l && l.mood ? l.mood : l ? 'x' : ''}" title="${esc(fmtDate(d, true))}${l && l.mood ? ' ' + MOODS[l.mood] : ''}"></i>`; }).join('')}</div><div class="small" style="margin-top:8px">Last 16 weeks · colour = mood · ${Object.keys(byDay).length} days written</div>
    <div class="btns" style="margin-top:10px"><button class="btn small" data-act="journal-new">${I.plus} Write for today</button></div></div>
  <div class="card" style="margin-top:12px">${logs.length ? `<div class="list">${logs.slice(0, 120).map(l => { const ml = logOf('morning', l.date); return `<div class="row" data-act="logitem" data-id="${esc(l.id)}"><div class="time">${l.score ? `<b class="sc10">${l.score}</b>` : l.mood ? MOODS[l.mood] : '·'}</div><div class="main jl"><div class="t">${esc(fmtDate(l.date, true))}</div>${ml && ml.expect ? `<div class="m" dir="auto">☀ ${esc(ml.expect)}</div>` : ''}${[['Better', l.better], ['Thanks', l.thanks || (ml && ml.thanks)], ['Ideas', l.ideas], ['Perspective', l.persp], ['Topics', l.topics]].filter(x => x[1]).map(x => `<div class="m" dir="auto"><b>${x[0]}:</b> ${esc(x[1])}</div>`).join('')}${l.done ? `<div class="na" dir="auto">${esc(l.done)}</div>` : ''}${l.notes ? `<div class="m" dir="auto">${esc(l.notes).slice(0, 160)}</div>` : ''}</div></div>`; }).join('')}</div>` : '<div class="empty">Nothing yet. Close the day to write your first line.</div>'}</div>`;
}
/* ---------- printable report ---------- */
function vReport() {
  const t = today(), tasks = list('tasks'), done = tasks.filter(x => stOf(x) === 'Done' && x.completedOn).sort((a, b) => b.completedOn.localeCompare(a.completedOn));
  const ms = list('milestones').sort((a, b) => String(a.target || '9').localeCompare(String(b.target || '9')));
  const sk = list('skills'), ie = list('ielts').sort((a, b) => String(a.date).localeCompare(String(b.date))), ev = list('evidence').sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }));
  const apps = list('applications'), s = weekScore(weekStart());
  const tbl = (head, rows) => rows.length ? `<table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td dir="auto">${esc(c ?? '')}</td>`).join('')}</tr>`).join('')}</table>` : '<p class="small">None recorded.</p>';
  return `<div class="report"><div class="noprint btns" style="margin-bottom:14px"><a class="btn" href="#/progress">${I.left} Back</a><button class="btn primary" data-act="print">Save as PDF / Print</button></div>
  <h1>${esc(me && me.name ? me.name : 'My')} · Progress report</h1><p class="small">Generated ${esc(fmtDate(t, true))} from ME.Coach. Estimates are labelled; only official documents count as evidence.</p>
  <h2>Summary</h2><p>${daysTo(visionDate())} days to the ${esc(fmtDate(visionDate(), true))} target. This week's score: ${s.total ?? 'n/a'}. Milestones done: ${ms.filter(m => m.status === 'Done').length} of ${ms.filter(m => m.status !== 'Dropped').length}. Tasks completed: ${done.length}. Learning this week: ${hrs(weekMinutes(weekStart()))} h.</p>
  <h2>Roadmap</h2>${tbl(['Milestone', 'Target', 'Status'], ms.map(m => [m.title, m.target ? fmtDate(m.target, true) : '', m.status || 'Planned']))}
  <h2>Skills</h2>${tbl(['Skill', 'Status', 'Level', 'Hours / week'], sk.map(x => [x.title, x.status || '', `${x.current ?? '?'} → ${x.target ?? '?'}`, x.weeklyHours || '']))}
  <h2>IELTS log</h2>${tbl(['Date', 'Skill', 'Band / score', 'Type'], ie.map(e => [fmtDate(e.date, true), e.skill, e.band, e.kind]))}
  <h2>Evidence register</h2>${tbl(['ID', 'Document', 'Status'], ev.map(e => [e.code, e.title, e.status || 'MISSING']))}
  <h2>Job search</h2>${tbl(['Role', 'Company', 'Stage', 'Applied'], apps.map(a => [a.role, a.company, a.stage || 'Saved', a.appliedOn ? fmtDate(a.appliedOn, true) : '']))}
  <h2>Completed work (latest 40)</h2>${tbl(['Done', 'Task', 'Proof'], done.slice(0, 40).map(x => [fmtDate(x.completedOn, true), x.title, x.evidence || '']))}</div>`;
}
/* ---------- global search ---------- */
const SEARCH_IN = [['courses', 'Course', r => [r.title, r.provider, cLessons(r).map(l => l.t).join(' ')], 'course-open'], ['tasks', 'Task', r => [r.title, r.nextAction, r.notes], 'task'], ['projects', 'Board', r => [r.title, r.notes], 'board-open'], ['applications', 'Job', r => [r.role, r.company, r.notes], 'application'], ['events', 'Event', r => [r.title, r.notes], 'event'], ['milestones', 'Milestone', r => [r.title, r.notes], 'milestone'], ['habits', 'Habit', r => [r.title], 'habit-open'], ['goals', 'Goal', r => [r.title, r.success], 'goal'], ['logs', 'Journal', r => [r.title, r.done, r.notes, r.better], 'logitem']];
const PALETTE = [['Focus timer', 'focus-free'], ['Breathe', 'breathe'], ['Morning Balance', 'morning'], ['Night Balance', 'closeout'], ['Wheel of Life test', 'wheel-test'], ['Start a 40-day cycle', 'cycle-new'], ['New goal', 'new-goal'], ['New task', 'new-task'], ['New board', 'new-project'], ['New habit', 'new-habit'], ['New event', 'new-event'], ['Log practice', 'log-time'], ['Start next lesson', 'next-lesson'], ['Weekly review', 'weekly'], ['New course', 'new-course'], ['Update savings', 'money-add'], ['Level and badges', 'w-level'], ['Edit widgets', 'w-edit'], ['Home-screen widget', 'w-home'], ['Job sprint', 'sprint', '', 'jobs'], ['Add jobs', 'job-bulk', '', 'jobs'], ['Job application', 'new-application', '', 'jobs'], ['Go to Today', 'go', 'today'], ['Go to Tasks', 'go', 'tasks'], ['Go to Boards', 'go', 'projects'], ['Go to Calendar', 'go', 'calendar'], ['Go to Habits', 'go', 'habits'], ['Go to Coach', 'go', 'progress'], ['Go to Insights', 'p-tab-insights'], ['Go to Calm', 'go', 'calm'], ['Go to Job search', 'go', 'jobs', 'jobs'], ['Go to Products', 'go', 'products', 'products'], ['Go to Members', 'go', 'admin', 'admin'], ['Go to Journal', 'go', 'journal'], ['Go to Trash', 'go', 'trash'], ['Go to Settings', 'go', 'settings'], ['Go to System health', 'go', 'health']];
function searchSheet() {
  openSheet('Search everything', `<input class="search" id="gsq" type="search" placeholder="Type to search" style="width:100%" autocomplete="off" dir="auto"><div id="gsr" class="list" style="margin-top:10px"></div>`, '', {});
  const inp = $('#gsq'); setTimeout(() => inp.focus(), 60);
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase(); const out = [];
    const acts = PALETTE.filter(x => !x[3] || can(x[3])).filter(([l]) => !q || l.toLowerCase().includes(q)).slice(0, q ? 5 : 12);
    const actHtml = acts.map(([l, act, to]) => `<div class="row" data-act="${act}" ${to ? `data-to="${to}"` : ''}><span class="att-i">${to ? I.right : I.plus}</span><div class="main"><div class="t">${l}</div></div></div>`).join('');
    if (q.length > 1) for (const [c, label, f, act] of SEARCH_IN) for (const r of list(c)) { const txt = f(r).filter(Boolean).join(' '); if (txt.toLowerCase().includes(q)) out.push([label, r, act, c]); if (out.length > 60) break; }
    $('#gsr').innerHTML = actHtml + (q.length < 2 ? '' : out.length ? out.map(([l, r, act, c]) => `<div class="row" data-act="${act === 'note' ? 'open-note' : act}" data-id="${esc(r.id)}"><div class="main"><div class="t" dir="auto">${esc(r.title || r.role || r.code || '')}${c === 'applications' && r.company ? ' · ' + esc(r.company) : ''}</div><div class="m"><span class="chip">${l}</span>${c === 'tasks' && !isOpen(r) ? '<span>done</span>' : ''}</div></div></div>`).join('') : acts.length ? '' : '<div class="empty">No matches.</div>');
  });
  inp.dispatchEvent(new Event('input'));
}

function vRoadmap() {
  const ms = list('milestones'); const t = today(); const vd = visionDate();
  const done = ms.filter(m => m.status === 'Done').length, live = ms.filter(m => m.status !== 'Dropped').length;
  const y0 = Math.min(Number(t.slice(0, 4)), ...ms.filter(m => m.target).map(m => Number(m.target.slice(0, 4)))), y1 = Math.max(Number(vd.slice(0, 4)), ...ms.filter(m => m.target).map(m => Number(m.target.slice(0, 4))));
  const years = []; for (let y = y0; y <= y1; y++) years.push(y);
  const yearOf = m => m.target ? Number(m.target.slice(0, 4)) : null;
  const noDate = ms.filter(m => !m.target);
  const msRow = m => { const late = m.target && m.target < t && !['Done', 'Dropped'].includes(m.status); return `<div class="row" data-act="milestone" data-id="${esc(m.id)}"><button class="check ${m.status === 'Done' ? 'done' : ''}" data-act="ms-done" data-id="${esc(m.id)}" aria-label="Mark done">${I.tick}</button><div class="main"><div class="t" dir="auto">${esc(m.title)}</div><div class="m">${m.status && m.status !== 'Planned' ? `<span class="chip ${m.status === 'Done' ? 's-done' : m.status === 'At risk' ? 's-block' : m.status === 'In progress' ? 's-prog' : ''}">${esc(m.status)}</span>` : ''}${m.target ? `<span class="chip ${late ? 'late' : ''}">${esc(fmtDate(m.target, true))}</span>` : ''}${m.goalId && get('goals', m.goalId) ? `<span dir="auto">${esc(get('goals', m.goalId).title)}</span>` : ''}</div></div></div>`; };
  const dl = daysTo(vd);
  return header('Plan', 'Where you are going and by when') + planTabs() + `
  <div class="card hero"><div class="hero-n">${dl.toLocaleString('en-GB')}</div><div class="hero-l">days to ${esc(prefs().visionName || 'your vision')} · ${esc(fmtDate(vd, true))} <button class="btn small ghost" data-act="vision">Change</button></div>
    <div class="bar" style="margin-top:12px"><i style="width:${live ? Math.round(100 * done / live) : 0}%"></i></div><div class="small" style="margin-top:6px">${done} of ${live} milestones done</div>
    <div class="btns" style="margin-top:12px"><button class="btn primary small" data-act="new-milestone">${I.plus} Milestone</button>${list('goals').some(g => g.target) ? '<button class="btn small" data-act="ms-from-goals">Create from goal dates</button>' : ''}</div></div>
  <div class="timeline">${years.map(y => { const it = ms.filter(m => yearOf(m) === y).sort((a, b) => a.target.localeCompare(b.target)); const d = it.filter(m => m.status === 'Done').length; const cur = y === Number(t.slice(0, 4));
    return `<div class="yr ${cur ? 'cur' : ''} ${y < Number(t.slice(0, 4)) ? 'past' : ''}"><div class="yr-h"><b>${y}</b>${it.length ? `<span class="small">${d}/${it.length}</span>` : ''}${cur ? '<span class="chip s-rev">now</span>' : ''}</div>${it.length ? `<div class="list">${it.map(msRow).join('')}</div>` : `<div class="empty">No milestones yet. <a href="#" data-act="new-milestone" data-year="${y}">Add one</a></div>`}</div>`; }).join('')}</div>
  ${noDate.length ? `<div class="card" style="margin-top:12px"><h2>No date yet</h2><div class="list">${noDate.map(msRow).join('')}</div></div>` : ''}`;
}
function vJobsList() {
  const f = ui.jobFilter || 'active'; const all = list('applications');
  const arr = all.filter(a => f === 'active' ? APP_ACTIVE.includes(a.stage || 'Saved') : f === 'all' ? true : (a.stage || 'Saved') === f)
    .sort((a, b) => String(a.followUp || '9999').localeCompare(String(b.followUp || '9999')) || String(b.appliedOn || '').localeCompare(String(a.appliedOn || '')));
  const cnt = s => all.filter(a => (a.stage || 'Saved') === s).length;
  const t = today();
  return header('Job search', 'Applications and follow-ups. Nothing is sent from here.') + `
  <div class="funnel">${APP_STAGES.slice(0, 5).map(s => `<button data-act="job-filter" data-f="${s}" class="${f === s ? 'on' : ''}"><b>${cnt(s)}</b><span>${s}</span></button>`).join('')}</div>
  <div class="seg" style="margin:12px 0"><button class="${f === 'active' ? 'on' : ''}" data-act="job-filter" data-f="active">Active</button><button class="${f === 'Rejected' ? 'on' : ''}" data-act="job-filter" data-f="Rejected">Rejected (${cnt('Rejected')})</button><button class="${f === 'Withdrawn' ? 'on' : ''}" data-act="job-filter" data-f="Withdrawn">Withdrawn</button><button class="${f === 'all' ? 'on' : ''}" data-act="job-filter" data-f="all">All</button></div>
  <div class="toolbar"><button class="btn primary" data-act="new-application">${I.plus} Application</button></div>
  <div class="card">${arr.length ? `<div class="list">${arr.map(a => { const late = a.followUp && a.followUp <= t && APP_ACTIVE.includes(a.stage || 'Saved'); return `<div class="row" data-act="application" data-id="${esc(a.id)}"><div class="main"><div class="t" dir="auto">${esc(a.role || 'Role')} · ${esc(a.company || '')}</div><div class="m"><span class="chip ${['Interview', 'Offer'].includes(a.stage) ? 's-done' : a.stage === 'Rejected' ? 's-block' : a.stage === 'Saved' ? '' : 's-prog'}">${esc(a.stage || 'Saved')}</span>${a.appliedOn ? `<span>Applied ${esc(fmtDate(a.appliedOn))}</span>` : ''}${a.followUp && APP_ACTIVE.includes(a.stage || 'Saved') ? `<span class="chip ${late ? 'late' : ''}">Follow up ${esc(rel(a.followUp))}</span>` : ''}${a.location ? `<span dir="auto">${esc(a.location)}</span>` : ''}</div></div></div>`; }).join('')}</div>` : '<div class="empty">No applications in this view.</div>'}</div>`;
}
function vImmigration() {
  const items = list('immigration'); const t = today(); const lim = addDays(t, 180);
  const ok = items.filter(x => ['Ready', 'Submitted', 'Not needed'].includes(x.status)).length;
  const row = x => { const exp = x.expiry && x.status !== 'Not needed' ? (x.expiry < t ? 'late' : x.expiry <= lim ? 's-wait' : '') : null; const ev = x.evidenceId && get('evidence', x.evidenceId);
    return `<div class="row" data-act="immig" data-id="${esc(x.id)}"><button class="check ${['Ready', 'Submitted', 'Not needed'].includes(x.status) ? 'done' : ''}" data-act="imm-ready" data-id="${esc(x.id)}" aria-label="Mark ready">${I.tick}</button><div class="main"><div class="t" dir="auto">${esc(x.title)}</div><div class="m"><span class="chip ${['Ready', 'Submitted'].includes(x.status) ? 's-done' : x.status === 'Collecting' ? 's-prog' : ''}">${esc(x.status || 'Not started')}</span>${exp !== null && x.expiry ? `<span class="chip ${exp}">Expires ${esc(fmtDate(x.expiry, true))}</span>` : ''}${ev ? `<span>${esc(ev.code || '')} ${esc(ev.status || '')}</span>` : ''}</div></div></div>`; };
  return header('Immigration', 'Documents to collect, and when they expire') + `
  <div class="card warnbox small">This checklist does not decide eligibility. Confirm each requirement on the official government website for your pathway, and paste that link in the item.</div>
  <div class="card" style="margin-top:12px"><div class="bar"><i style="width:${items.length ? Math.round(100 * ok / items.length) : 0}%"></i></div><div class="small" style="margin-top:6px">${ok} of ${items.length} ready</div>
    <div class="btns" style="margin-top:10px"><button class="btn primary small" data-act="new-immig">${I.plus} Document</button>${items.length ? '' : '<button class="btn small" data-act="imm-starter">Add a starter list</button>'}</div></div>
  ${IMM_CATS.map(c => { const it = items.filter(x => (x.category || 'Other') === c).sort((a, b) => String(a.title).localeCompare(String(b.title))); return it.length ? `<div class="card" style="margin-top:12px"><h2>${esc(c)} <span class="count">${it.filter(x => ['Ready', 'Submitted', 'Not needed'].includes(x.status)).length}/${it.length}</span></h2><div class="list">${it.map(row).join('')}</div></div>` : ''; }).join('')}`;
}
const OPTIONAL = [['products', 'Products'], ['jobs', 'Job search'], ['calm', 'Calm'], ['money', 'Money']];
const hidden = () => new Set(prefs().hidden || []);
const navMore = () => NAV_MORE.filter(([k]) => can(k) && !hidden().has(k));
function badge(k) {
  if (k === 'today') { const n = list('tasks').filter(t => isOpen(t) && t.due && t.due < today()).length; return n ? `<b class="badge">${n > 99 ? '99+' : n}</b>` : ''; }
  if (k === 'progress' || k === 'life') return weeklyDue() || list('courses').some(c => ['Active', 'Paused'].includes(c.status) && c.nextReview && c.nextReview <= today()) ? '<b class="badge dot"></b>' : '';
  if (k === 'more' || k === 'hub') { const hs = hidden(); const n = hs.has('jobs') || !isOwner() ? 0 : followUps().length; return n ? `<b class="badge">${n}</b>` : ''; }
  return '';
}
/* ---------- setup checklist ---------- */
function setupItems() {
  return [[!!ui.pkSet, 'Sign in with Face ID', 'pk-add'], [!!ui.pushOn, 'Morning and evening reminders', 'go-settings'], [!!ui.calDone, 'Calendar on your iPhone', 'ics-setup'], [!!ui.siriDone, 'Siri shortcuts', 'siri'], [wheels().length > 0, 'Wheel of Life test', 'wheel-start'], [!!activeCycle(), 'Start a 40-day cycle', 'cycle-new'], [!!list('logs').find(l => l.type === 'morning'), 'First Morning Balance', 'morning'], [list('habits').length > 0, 'One daily habit', 'new-habit'], [!!ui.lastBackup, 'First backup copy', 'enc-backup']];
}
function setupCard() {
  if (ui.setupHidden) return ''; const it = setupItems(), d = it.filter(x => x[0]).length; if (d === it.length) return '';
  return `<div class="card setup" role="button" data-act="setup" style="margin-bottom:12px"><div class="main"><div class="t">Finish setting up · ${d} of ${it.length}</div><div class="bar" style="margin-top:6px"><i style="width:${Math.round(100 * d / it.length)}%"></i></div></div><span class="att-go">${I.right}</span></div>`;
}
function setupSheet() {
  openSheet('Set up ME.Coach', `<div class="list">${setupItems().map(([ok, l, act]) => `<div class="row"><span class="hstat ${ok ? 'ok' : ''}">${ok ? '✓' : ''}</span><div class="main"><div class="t">${l}</div></div>${ok ? '' : `<button class="btn small primary" data-act="${act}">Set up</button>`}</div>`).join('')}</div>
    <div class="btns" style="margin-top:12px"><button class="btn small" data-act="setup-mark">I did calendar and Siri</button><button class="btn small ghost" data-act="setup-hide">Hide this</button></div>`, '', { noFocus: true });
}
function vMore() {
  return header('More', '') + `<div class="card tight"><div class="list"><a class="row mrow" href="${BOOK_URL}" target="_blank" rel="noopener"><span class="att-i">📘</span><div class="main"><div class="t">Free book</div><div class="m">Self-Coaching Blueprint · PDF</div></div><span class="att-go">${I.go}</span></a>${navMore().map(([k, l, ic]) => `<a class="row mrow" href="#/${k}"><span class="att-i">${ic}</span><div class="main"><div class="t">${l}</div><div class="m">${moreHint(k)}</div></div>${badgeMore(k)}<span class="att-go">${I.go}</span></a>`).join('')}</div></div>`;
}
const badgeMore = k => { const n = k === 'jobs' ? followUps().length : k === 'documents' ? expiring().filter(x => x.expiry < addDays(today(), 60)).length : 0; return n ? `<b class="badge inl">${n}</b>` : ''; };
const subTabs = (key, tabs, cur) => `<div class="seg ptabs">${tabs.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-act="sub-tab" data-k="${key}" data-t="${k}">${l}</button>`).join('')}</div><div style="height:12px"></div>`;
function vDocuments() { const t = ui.dTab === 'evidence' ? 'evidence' : 'immigration'; return header('Documents', 'What to collect, and what proves your record') + subTabs('dTab', [['immigration', 'Immigration checklist'], ['evidence', 'Evidence register']], t) + stripHead(t === 'evidence' ? vEvidence() : vImmigration()); }
function vNotesHub() { const t = ['journal', 'decisions'].includes(ui.nTab) ? ui.nTab : 'notes'; return header('Notes', 'Documents, your daily line, and decisions') + subTabs('nTab', [['notes', 'Notes'], ['journal', 'Journal'], ['decisions', 'Decisions']], t) + stripHead(t === 'journal' ? vJournal() : t === 'decisions' ? vDecisions() : vNotes()); }
function moreHint(k) {
  return { products: `${list('products').length} products · ${list('products').filter(p => p.status === 'Live').length} live`, documents: `${list('immigration').length} to collect · ${list('evidence').length} evidence items`, notes: `${list('notes').length} notes · ${list('logs').filter(l => l.type === 'closeout').length} journal days · ${list('decisions').length} decisions`, journal: `${list('logs').filter(l => l.type === 'closeout').length} days written`, templates: `${TEMPLATE_STARTERS.length + list('templates').length} templates`, trash: `${COLS.reduce((n, c) => n + Object.values(db[c] || {}).filter(r => r && r.deleted).length, 0)} deleted items`, health: 'Server, backups, sync and security checks', jobs: `${list('applications').filter(a => APP_ACTIVE.includes(a.stage || 'Saved')).length} active applications`, immigration: `${list('immigration').length} documents`, learn: `${list('skills').length} skills · ${list('sessions').length} sessions · ${list('ielts').length} IELTS entries`, evidence: `${list('evidence').length} items`, decisions: `${list('decisions').length} decisions`, review: 'Live executive review and close-out logs', settings: 'Sync, calendar feed, backup, password' }[k] || '';
}
function vLearn() {
  const skills = list('skills').sort((a, b) => String(a.priority || 'P9').localeCompare(String(b.priority || 'P9')));
  const sessions = list('sessions').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const ielts = list('ielts').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const ws = weekStart(), mins = weekMinutes(ws), tgt = weekTarget(), st = streak();
  const tracked = skills.filter(s => Number(s.weeklyHours) > 0 || weekMinutes(ws, s.id) > 0);
  const gapA = areas().slice().sort((x, y) => areaGap(y) - areaGap(x)).find(a => areaGap(a) > 0 && !list('courses').some(c => c.areaId === a.id && ['Active', 'Planned'].includes(c.status)));
  return header('Learning', 'Competence is shown by practical checks, not attendance') + (gapA ? `<div class="card coachtip"><span class="att-i">${I.spark}</span><div class="main"><b>Coach</b><div class="small"><b>${esc(gapA.title)}</b> is ${areaScore(gapA.id)}/10 against a target of ${areaTarget(gapA)} and has no course. Pick one that moves it.</div></div><button class="btn small primary" data-act="new-course" data-area="${esc(gapA.id)}">Pick a course</button></div>` : '') + vCourses() + `
  <div class="card"><h2>This week <span class="count">${hrs(mins)} h${tgt ? ' / ' + hrs(tgt) + ' h' : ''}</span><span style="flex:1"></span><button class="btn small primary" data-act="log-time">${I.plus} Log time</button></h2>
    <div class="small" style="margin-bottom:8px">${st ? `🔥 ${st}-day streak` : 'No streak yet. Log any practice today to start one.'} · Week of ${esc(fmtDate(ws))}</div>
    ${tracked.length ? tracked.map(s => { const m = weekMinutes(ws, s.id), g = Math.round((Number(s.weeklyHours) || 0) * 60); return `<div style="margin:8px 0"><div class="small" style="display:flex;justify-content:space-between;gap:8px"><span dir="auto">${esc(s.title)}</span><b>${hrs(m)}${g ? ' / ' + hrs(g) : ''} h</b></div><div class="bar"><i style="width:${g ? Math.min(100, Math.round(100 * m / g)) : 100}%"></i></div></div>`; }).join('') : '<div class="empty">Set weekly hours on a skill to track it here.</div>'}</div>
  <div class="card" style="margin-top:12px"><h2>IELTS progress</h2><div class="small" style="margin-bottom:10px">Target 7.5 overall, no skill below 7.0. ● official result · ○ estimate (not an IELTS score)</div>${ieltsCharts()}</div>
  <div class="card" style="margin-top:12px"><h2>Skills <span class="count">${skills.length}</span></h2>${skills.length ? `<div class="list">${skills.map(s => `<div class="row" data-act="skill" data-id="${esc(s.id)}"><div class="main"><div class="t" dir="auto">${esc(s.title)}</div><div class="m">${priChip(s.priority)}<span class="chip">${esc(s.status || 'Not started')}</span><span>Level ${esc(s.current ?? '?')} → ${esc(s.target ?? '?')}</span>${s.weeklyHours ? `<span>${esc(s.weeklyHours)} h/week</span>` : ''}</div>${s.evidenceNeeded ? `<div class="na" dir="auto">Evidence: ${esc(s.evidenceNeeded)}</div>` : ''}</div></div>`).join('')}</div>` : '<div class="empty">No skills yet.</div>'}
    <div class="btns" style="margin-top:10px"><button class="btn small" data-act="new-skill">${I.plus} Skill</button></div></div>
  <div class="grid two" style="margin-top:12px">
  <div class="card"><h2>Practice sessions <span class="count">${sessions.length}</span></h2>${sessions.length ? `<div class="list">${sessions.slice(0, 30).map(s => `<div class="row" data-act="session" data-id="${esc(s.id)}"><div class="main"><div class="t" dir="auto">${esc(s.title || ('Session ' + (s.number || '')))}</div><div class="m"><span>${esc(fmtDate(s.date, true))}</span>${s.minutes ? `<span>${esc(s.minutes)} min</span>` : ''}${s.result ? `<span class="chip ${s.result === 'Pass' ? 's-done' : s.result === 'Partial' ? 's-wait' : ''}">${esc(s.result)}</span>` : ''}${s.skill ? `<span>${esc((get('skills', s.skill) || {}).title || '')}</span>` : ''}</div></div></div>`).join('')}</div>` : '<div class="empty">No sessions logged.</div>'}
    <div class="btns" style="margin-top:10px"><button class="btn small" data-act="new-session">${I.plus} Log session</button></div></div>
  <div class="card"><h2>IELTS log <span class="count">${ielts.length}</span></h2><div class="small" style="margin-bottom:6px">Target 7.5 overall, no skill below 7.0. Only an official test report is an IELTS score.</div>${ielts.length ? `<div class="list">${ielts.map(e => `<div class="row" data-act="ielts" data-id="${esc(e.id)}"><div class="main"><div class="t">${esc(e.skill || 'IELTS')} ${e.band ? '· ' + esc(e.band) : ''}</div><div class="m"><span>${esc(fmtDate(e.date, true))}</span><span class="chip ${/Official/.test(e.kind) ? 's-done' : 's-wait'}">${esc(e.kind || '')}</span></div></div></div>`).join('')}</div>` : '<div class="empty">No entries yet. No baseline exists.</div>'}
    <div class="btns" style="margin-top:10px"><button class="btn small" data-act="new-ielts">${I.plus} Entry</button></div></div></div>`;
}
function bandOf(e) { const m = String(e.band || '').trim().match(/^(\d(?:\.[05])?)$/); const v = m ? Number(m[1]) : NaN; return v >= 0 && v <= 9 ? v : null; }
function ieltsCharts() {
  const groups = [['Listening', ['Listening'], 7], ['Reading', ['Reading'], 7], ['Writing', ['Writing Task 1', 'Writing Task 2', 'Writing'], 7], ['Speaking', ['Speaking'], 7], ['Overall', ['Overall'], 7.5]];
  const all = list('ielts').filter(e => e.date && bandOf(e) !== null);
  return `<div class="minis">${groups.map(([name, keys, target]) => bandChart(name, all.filter(e => keys.includes(e.skill)).sort((a, b) => a.date.localeCompare(b.date)), target)).join('')}</div>`;
}
function bandChart(name, pts, target) {
  if (!pts.length) return `<div class="mini"><div class="mini-h"><b>${name}</b><span class="small">no band yet</span></div></div>`;
  const W = 300, H = 118, pl = 22, pr = 30, pt = 8, pb = 18;
  const lo = Math.max(0, Math.min(4, Math.floor(Math.min(...pts.map(bandOf))))), hi = 9;
  const t0 = parseD(pts[0].date).getTime(), t1 = parseD(pts[pts.length - 1].date).getTime();
  const x = d => t1 === t0 ? (pl + (W - pl - pr) / 2) : pl + (parseD(d).getTime() - t0) / (t1 - t0) * (W - pl - pr);
  const y = v => pt + (hi - v) / (hi - lo) * (H - pt - pb);
  const grid = []; for (let v = Math.ceil(lo); v <= hi; v++) grid.push(`<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="g"/><text x="${pl - 5}" y="${y(v) + 3}" class="ax" text-anchor="end">${v}</text>`);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(bandOf(p)).toFixed(1)}`).join('');
  const last = pts[pts.length - 1], lv = bandOf(last);
  const dots = pts.map(p => { const off = /Official/.test(p.kind || ''); return `<g class="pt"><circle cx="${x(p.date)}" cy="${y(bandOf(p))}" r="12" class="hit"/><circle cx="${x(p.date)}" cy="${y(bandOf(p))}" r="4.5" class="${off ? 'off' : 'est'}"/><title>${esc(fmtDate(p.date, true))}: ${bandOf(p)} · ${esc(off ? 'official result' : 'estimate, not an IELTS score')}</title></g>`; }).join('');
  return `<div class="mini"><div class="mini-h"><b>${name}</b><span class="small">latest ${lv}${/Official/.test(last.kind || '') ? '' : ' (est.)'}</span></div>
  <svg viewBox="0 0 ${W} ${H}" class="bchart" role="img" aria-label="${name} band over time, latest ${lv}, target ${target}">${grid.join('')}
  <line x1="${pl}" x2="${W - pr}" y1="${y(target)}" y2="${y(target)}" class="tg"/><text x="${W - pr + 4}" y="${y(target) + 3}" class="ax tgl">${target}</text>
  <path d="${line}" class="ln"/>${dots}
  <text x="${pl}" y="${H - 3}" class="ax">${esc(fmtDate(pts[0].date))}</text>${pts.length > 1 ? `<text x="${W - pr}" y="${H - 3}" class="ax" text-anchor="end">${esc(fmtDate(last.date))}</text>` : ''}</svg></div>`;
}
function vEvidence() {
  const items = list('evidence').sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }));
  return header('Evidence', 'Employment and qualification evidence register') + `
  <div class="toolbar"><button class="btn primary" data-act="new-evidence">${I.plus} Item</button><span class="small">Never upgrade a claim without a document. Sensitive files stay in your private vault, not here.</span></div>
  <div class="card">${items.length ? `<div class="list">${items.map(e => `<div class="row" data-act="evidence" data-id="${esc(e.id)}"><div class="main"><div class="t" dir="auto">${esc(e.code ? e.code + ' · ' : '')}${esc(e.title)}</div><div class="m">${priChip(e.priority)}<span class="chip ${/VERIFIED|RECOVERED/.test(e.status || '') ? 's-done' : /MISSING|NOT AVAILABLE/.test(e.status || '') ? 's-block' : 's-wait'}">${esc(e.status || 'MISSING')}</span>${e.conflicts ? `<span>${esc(e.conflicts)}</span>` : ''}${e.target ? `<span>by ${esc(fmtDate(e.target))}</span>` : ''}</div>${e.proves ? `<div class="na" dir="auto">Proves: ${esc(e.proves)}</div>` : ''}</div></div>`).join('')}</div>` : '<div class="empty">No evidence items yet.</div>'}</div>`;
}
function vDecisions() {
  const items = list('decisions').sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return header('Decisions', 'Decision, evidence, alternatives, next action') + `
  <div class="toolbar"><button class="btn primary" data-act="new-decision">${I.plus} Decision</button></div>
  <div class="card">${items.length ? `<div class="list">${items.map(d => `<div class="row" data-act="decision" data-id="${esc(d.id)}"><div class="main"><div class="t" dir="auto">${esc(d.title)}</div><div class="m"><span class="chip ${d.status === 'Decided' ? 's-done' : d.status === 'Open' ? 's-wait' : ''}">${esc(d.status || 'Open')}</span>${d.date ? `<span>${esc(fmtDate(d.date, true))}</span>` : ''}${d.category ? `<span>${esc(d.category)}</span>` : ''}</div>${d.decision ? `<div class="na" dir="auto">${esc(d.decision).slice(0, 220)}</div>` : ''}</div></div>`).join('')}</div>` : '<div class="empty">No decisions recorded.</div>'}</div>`;
}
function vNotes() {
  const q = (ui.noteQuery || '').toLowerCase();
  let items = list('notes'); if (q) items = items.filter(n => [n.title, n.tags, n.body].join(' ').toLowerCase().includes(q));
  items.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return header('Notes & docs', 'CV drafts, strategies, plans, meeting notes') + `
  <div class="toolbar"><input class="search" type="search" placeholder="Search documents" value="${esc(ui.noteQuery)}" data-input="noteQuery"><button class="btn primary" data-act="new-note">${I.plus} Document</button></div>
  <div class="card">${items.length ? `<div class="list">${items.map(n => `<a class="row" href="#/note/${encodeURIComponent(n.id)}" style="text-decoration:none"><div class="main"><div class="t" dir="auto">${n.pinned ? '📌 ' : ''}${esc(n.title)}</div><div class="m">${n.tags ? `<span>${esc(n.tags)}</span>` : ''}<span>Updated ${esc(fmtDate(n.updatedAt, true))}</span>${n.source ? '<span>imported</span>' : ''}</div></div></a>`).join('')}</div>` : '<div class="empty">No documents yet.</div>'}</div>`;
}
function vNote(id) {
  const n = get('notes', id); if (!n) return header('Not found', '') + '<div class="card empty">This document does not exist.</div>';
  return header(n.title, `${n.tags || ''} · updated ${fmtDate(n.updatedAt, true)}`) + `
  <div class="btns" style="margin-bottom:12px"><a class="btn small" href="#/notes">${I.left} All documents</a><button class="btn small primary" data-act="edit-note" data-id="${esc(n.id)}">Edit</button>${n.source ? `<a class="btn small ghost" href="${esc(n.source)}" target="_blank" rel="noopener">Original source</a>` : ''}</div>
  <div class="card prose">${md(n.body)}</div>`;
}
function vReview() {
  const t = today(); const tasks = list('tasks'); const open = tasks.filter(isOpen);
  const counts = STATES.map(s => [s, tasks.filter(x => stOf(x) === s).length]).filter(([, n]) => n);
  const max = Math.max(1, ...counts.map(([, n]) => n));
  const overdue = sortTasks(open.filter(x => x.due && x.due < t));
  const next30 = sortTasks(open.filter(x => x.due && x.due >= t && x.due <= addDays(t, 30)));
  const doneWeek = tasks.filter(x => DONE.has(x.state) && x.completedOn && x.completedOn >= addDays(t, -7));
  const noNext = open.filter(x => !x.nextAction);
  const noEvid = tasks.filter(x => stOf(x) === 'Done' && !x.evidence);
  const logs = list('logs').sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);
  return header('Review', 'Live executive review, computed from your records') + `
  <div class="kpis"><div class="kpi"><b>${open.length}</b><span>Open tasks</span></div><div class="kpi ${overdue.length ? 'bad' : ''}"><b>${overdue.length}</b><span>Overdue</span></div><div class="kpi"><b>${doneWeek.length}</b><span>Completed in 7 days</span></div><div class="kpi ${noNext.length || noEvid.length ? 'warn' : ''}"><b>${noNext.length + noEvid.length}</b><span>Quality issues</span></div></div>
  <div class="grid two" style="margin-top:12px">
    <div class="card"><h2>By status</h2>${counts.map(([s, n]) => `<div style="margin:6px 0"><div class="small" style="display:flex;justify-content:space-between"><span>${esc(s)}</span><b>${n}</b></div><div class="bar"><i style="width:${Math.round(100 * n / max)}%"></i></div></div>`).join('') || '<div class="empty">No tasks.</div>'}</div>
    <div class="card"><h2>Quality checks</h2><div class="small">Open tasks without a next action: <b>${noNext.length}</b><br>Completed tasks without evidence: <b>${noEvid.length}</b><br>Open tasks with no due date: <b>${open.filter(x => !x.due).length}</b></div>
      <div class="hr"></div><div class="btns"><button class="btn small" data-act="log" data-type="weekly">Log weekly review</button><button class="btn small" data-act="log" data-type="monthly">Log monthly review</button><button class="btn small" data-act="closeout">Daily close-out</button></div></div>
  </div>
  ${overdue.length ? `<div class="card" style="margin-top:12px"><h2>Overdue <span class="count">${overdue.length}</span></h2><div class="list">${overdue.map(x => taskRow(x, { na: false })).join('')}</div></div>` : ''}
  <div class="card" style="margin-top:12px"><h2>Due in the next 30 days <span class="count">${next30.length}</span></h2>${next30.length ? `<div class="list">${next30.map(x => taskRow(x, { na: false })).join('')}</div>` : '<div class="empty">Nothing due.</div>'}</div>
  <div class="card" style="margin-top:12px"><h2>Recent logs <span class="count">${logs.length}</span></h2>${logs.length ? `<div class="list">${logs.map(l => `<div class="row" data-act="logitem" data-id="${esc(l.id)}"><div class="main"><div class="t">${esc(l.title || l.type)}</div><div class="m"><span>${esc(fmtDate(l.date, true))}</span><span class="chip">${esc(l.type)}</span></div>${l.done ? `<div class="na" dir="auto">${esc(l.done).slice(0, 200)}</div>` : ''}</div></div>`).join('')}</div>` : '<div class="empty">No logs yet.</div>'}</div>`;
}
function vSettings() {
  const pending = Object.keys(outbox).length, last = ls.get(K.last);
  const n = COLS.map(c => `${c}: ${list(c).length}`).join(' · ');
  return header('Settings', `ME.Coach ${VERSION}`) + accountCard() + `
  <div class="card tight" style="margin-bottom:12px"><div class="list">${[['health', 'System health', I.health, 'Server, backups, sync and security checks'], ['review', 'Review', I.review, 'Task quality and what is due'], ['trash', 'Trash', I.trash, 'Restore deleted items']].map(([k, l, ic, m]) => `<a class="row mrow" href="#/${k}"><span class="att-i">${ic}</span><div class="main"><div class="t">${l}</div><div class="m">${m}</div></div><span class="att-go">${I.go}</span></a>`).join('')}</div></div>
  <div class="grid two">
  <div class="card"><h2>Sync</h2><div class="small">Status: <b>${esc(syncState === 'off' ? 'offline' : pending ? pending + ' change(s) waiting' : 'up to date')}</b><br>Last sync: ${last ? esc(fmtDate(last, true) + ' ' + fmtTime(last)) : 'never'}<br>Server revision: ${esc(ls.get(K.rev) ?? '-')}${lastError ? `<br>Last error: ${esc(lastError)}` : ''}<br>This device: ${esc(device())}</div>
    <div class="btns" style="margin-top:10px"><button class="btn small primary" data-act="sync-now">Sync now</button><button class="btn small" data-act="reload">Reload from server</button></div></div>
  <div class="card"><h2>Calendar on iPhone and iPad</h2><div class="small">Subscribe once and your events and scheduled tasks appear in the Apple Calendar app with reminders (15 minutes before, or the alarm you set).</div>
    <div class="btns" style="margin-top:10px"><button class="btn small primary" data-act="ics">Show my calendar link</button></div><div id="icsbox" class="small" style="margin-top:8px"></div></div>
  <div class="card"><h2>Appearance</h2>
    <div class="small" style="margin-bottom:6px">Theme</div><div class="seg">${[['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button class="${(ui.theme || 'auto') === k ? 'on' : ''}" data-act="set-theme" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="small" style="margin:12px 0 6px">Text size</div><div class="seg">${[['normal', 'Normal'], ['large', 'Large']].map(([k, l]) => `<button class="${(ui.size || 'normal') === k ? 'on' : ''}" data-act="set-size" data-v="${k}">${l}</button>`).join('')}</div></div>
  <div class="card"><h2>${I.bell} Notifications</h2><div id="pushbox" class="small">Checking…</div></div>
  <div class="card"><h2>Install on iPhone or iPad</h2><div class="small">Open this page in Safari → Share → <b>Add to Home Screen</b>. It then opens full screen like an app and works offline; changes sync when you are online.</div></div>
  <div class="card"><h2>Backup and import</h2><div class="small">The server also keeps a daily snapshot for 30 days. Export a copy regularly.</div>
    <div class="btns" style="margin-top:10px"><button class="btn small primary" data-act="enc-backup">Download encrypted backup</button><button class="btn small" data-act="export">Plain JSON</button><label class="btn small" style="cursor:pointer">Import JSON<input type="file" accept="application/json,.json" data-change="import" hidden></label></div>
    <div class="small mono" style="margin-top:8px">${esc(n)}</div></div>
  <div class="card"><h2>Siri & Shortcuts</h2><div class="small">Add tasks, hear your Top 3, log practice and save job ads by voice or from Safari's Share button.</div><div class="btns" style="margin-top:10px"><button class="btn small primary" data-act="siri">Set up Siri</button></div></div>
  <div class="card"><h2>Face ID sign-in</h2><div id="pkbox" class="small">Checking…</div></div>
  <div class="card"><h2>Morning &amp; Night Balance</h2><div class="small" style="margin-bottom:8px">Choose the questions you answer. Fewer questions = faster.</div>${balanceSettings()}</div>
  <div class="card"><h2>Areas of life</h2><div class="small" style="margin-bottom:8px">${areas().length} areas in your Wheel of Life.</div><div class="btns"><button class="btn small" data-act="areas-edit">Edit areas</button><button class="btn small" data-act="wheel-test">Retake the wheel</button></div></div>
  <div class="card"><h2>Sections</h2><div class="small" style="margin-bottom:8px">Hide what you do not use. Nothing is deleted.</div><div class="pick">${OPTIONAL.filter(([k]) => can(k)).map(([k, l]) => `<button class="${hidden().has(k) ? '' : 'on'}" data-act="toggle-sec" data-v="${k}">${hidden().has(k) ? '' : '✓ '}${l}</button>`).join('')}</div></div>
  <div class="card"><h2>Language</h2><div class="seg">${[['en', 'English'], ['fa', 'فارسی'], ['ar', 'العربية']].map(([k, l]) => `<button class="${(ui.lang || 'en') === k ? 'on' : ''}" data-act="set-lang" data-v="${k}">${l}</button>`).join('')}</div></div>
  <div class="card"><h2>Security</h2><div class="btns"><button class="btn small" data-act="password">Change password</button><button class="btn small danger" data-act="logout">Sign out on this device</button></div>
    <div class="small" style="margin-top:8px">Do not store passport numbers, ID numbers, salaries or confidential employer files here. Keep those in your private evidence vault.</div></div>
  </div>`;
}
function header(title, sub) {
  if (RTL()) { title = trStr(title) || title; sub = sub && (trStr(sub) || sub); }
  const pg = route().page; const back = !NAV_MAIN.some(([k]) => k === pg) && pg !== 'plan' && pg !== 'learn';
  return `<div class="top"><div class="top-row">${back ? `<button class="icon-btn hback" data-act="back" aria-label="Back">${I.left}</button>` : ''}<h1 dir="auto">${esc(title)}</h1>${syncHtml()}<button class="icon-btn hsearch" data-act="search" aria-label="Search">${I.search}</button><button class="icon-btn hmore" data-act="page-menu" aria-label="Options">${I.more}${badge('more')}</button></div>${sub ? `<div class="sub" dir="auto">${esc(sub)}</div>` : ''}</div><div class="spacer" style="height:14px"></div>`;
}

/* ================= v7: owner mode, boards, job sprint, motivation, calm ================= */
const isOwner = () => !!me && me.role === 'owner';
const OWNER_ONLY = new Set(['products', 'jobs', 'admin']);
const REMOVED = new Set(['notes', 'note', 'templates', 'documents', 'immigration', 'evidence', 'decisions']);
const can = k => !OWNER_ONLY.has(k) || isOwner();
const BCOLS = ['To do', 'Doing', 'Waiting', 'Done'];
const BCOL_TONE = { 'To do': '', Doing: 's-prog', Waiting: 's-wait', Done: 's-done' };
const PJ_EMOJI = ['🎯', '🚀', '💼', '📘', '🧠', '💪', '🏠', '✈️', '💰', '🛠️', '🎨', '❤️', '🌱', '📈', '🎓', '🧘'];
const bOrder = t => t.korder !== undefined ? Number(t.korder) : Date.parse(t.createdAt || 0) / 1e6;
const colOf = t => DONE.has(t.state) ? 'Done' : BCOLS.includes(t.state) ? t.state : 'To do';
const projTasks = pid => list('tasks').filter(t => t.state !== 'Cancelled' && (pid === 'inbox' ? !t.projectId || !get('projects', t.projectId) : t.projectId === pid));
const projPct = pid => { const ts = projTasks(pid); return ts.length ? Math.round(100 * ts.filter(t => DONE.has(t.state)).length / ts.length) : 0; };
const pjIcon = p => p.icon || PJ_EMOJI[Math.abs([...String(p.title || 'x')].reduce((n, c) => n + c.charCodeAt(0), 0)) % PJ_EMOJI.length];

/* ---------- boards (Trello) + table (Notion) ---------- */
function vBoards() {
  const ps = list('projects').filter(p => p.status !== 'Cancelled').sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.title).localeCompare(String(b.title)));
  const v = ui.bView === 'table' ? 'table' : 'gallery';
  const inbox = projTasks('inbox').filter(isOpen).length;
  const card = p => { const ts = projTasks(p.id), open = ts.filter(isOpen).length, doing = ts.filter(t => colOf(t) === 'Doing').length, g = p.goalId && get('goals', p.goalId);
    return `<a class="bcard" href="#/board/${encodeURIComponent(p.id)}"><div class="bc-cover" style="--ac:${habColor({ color: p.color !== undefined && p.color !== '' ? p.color : [...String(p.title || '')].reduce((n, c) => n + c.charCodeAt(0), 0) })}"><span>${pjIcon(p)}</span></div><div class="bc-b"><b dir="auto">${esc(p.title)}</b><div class="small">${open} open${doing ? ` · ${doing} doing` : ''}${p.target ? ' · ' + esc(fmtDate(p.target)) : ''}</div>${g ? `<div class="small" dir="auto">🎯 ${esc(g.title)}</div>` : ''}<div class="bar"><i style="width:${projPct(p.id)}%"></i></div></div></a>`; };
  return header('Boards', 'Every project with its own board, table and daily tasks') + `
  <div class="toolbar"><div class="seg"><button class="${v === 'gallery' ? 'on' : ''}" data-act="b-view" data-v="gallery">Gallery</button><button class="${v === 'table' ? 'on' : ''}" data-act="b-view" data-v="table">Table</button></div><span style="flex:1"></span><button class="btn primary" data-act="new-project">${I.plus} New board</button></div>
  ${v === 'gallery' ? `<div class="bgrid">${ps.map(card).join('')}<a class="bcard inbox" href="#/board/inbox"><div class="bc-cover"><span>📥</span></div><div class="bc-b"><b>Inbox</b><div class="small">${inbox} tasks without a board</div></div></a></div>${ps.length ? '' : '<div class="card empty" style="margin-top:12px">Create a board for each project: a course, the job search, a product launch. Each board has its own To do, Doing, Waiting and Done.</div>'}`
    : `<div class="card tight ntable-wrap"><table class="ntable"><thead><tr><th>Name</th><th>Status</th><th>Goal</th><th>Open</th><th>Progress</th><th>Target</th></tr></thead><tbody>${ps.map(p => `<tr data-act="go" data-to="board/${esc(encodeURIComponent(p.id))}"><td><span class="nt-ic">${pjIcon(p)}</span> <b dir="auto">${esc(p.title)}</b></td><td><span class="chip">${esc(p.status || 'Planned')}</span></td><td dir="auto">${esc((get('goals', p.goalId) || {}).title || '')}</td><td>${projTasks(p.id).filter(isOpen).length}</td><td><div class="bar mini"><i style="width:${projPct(p.id)}%"></i></div> ${projPct(p.id)}%</td><td>${p.target ? esc(fmtDate(p.target, true)) : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No boards yet.</td></tr>'}</tbody></table></div>`}`;
}
function vBoard(id) {
  const p = id === 'inbox' ? { id: 'inbox', title: 'Inbox', icon: '📥' } : get('projects', id);
  if (!p) return header('Not found', '') + '<div class="card empty">This board does not exist.</div>';
  const ts = projTasks(p.id), v = (ui.bvMode || {})[p.id] || 'board', g = p.goalId && get('goals', p.goalId);
  const cardH = t => `<div class="kcard ${DONE.has(t.state) ? 'done' : ''}" data-act="task" data-id="${esc(t.id)}" data-drag="task" data-o="${bOrder(t)}"><div class="kc-t" dir="auto">${esc(t.title)}</div><div class="m">${t.priority === 'P1' && isOpen(t) ? priChip('P1') : ''}${isOpen(t) ? dueChip(t) : ''}${isOpen(t) && t.focusDate === today() ? '<span class="chip s-rev">★ Today</span>' : ''}</div>${t.nextAction && isOpen(t) ? `<div class="na" dir="auto">→ ${esc(t.nextAction)}</div>` : ''}</div>`;
  const board = `<div class="kb">${BCOLS.map(c => { const cs = ts.filter(t => colOf(t) === c).sort((a, b) => bOrder(a) - bOrder(b)); return `<section class="kcol" data-drop="${c}" data-kind="task"><header><span class="chip ${BCOL_TONE[c]}">${c}</span><span class="count">${cs.length}</span></header><div class="kcards">${(c === 'Done' ? cs.slice(-25) : cs).map(cardH).join('')}</div><button class="kadd" data-act="k-add" data-col="${c}" data-id="${esc(p.id)}">${I.plus} Add a card</button></section>`; }).join('')}</div>`;
  const table = `<div class="card tight ntable-wrap"><table class="ntable"><thead><tr><th>Task</th><th>Status</th><th>Due</th><th>Priority</th><th>Next action</th><th></th></tr></thead><tbody>${ts.sort((a, b) => BCOLS.indexOf(colOf(a)) - BCOLS.indexOf(colOf(b)) || String(a.due || '9').localeCompare(String(b.due || '9'))).map(t => `<tr><td><input class="nt-in" data-change="k-title" data-id="${esc(t.id)}" value="${esc(t.title)}" dir="auto"><button class="nt-open" data-act="task" data-id="${esc(t.id)}" aria-label="Open">↗</button></td><td><select data-change="k-state" data-id="${esc(t.id)}">${BCOLS.map(c => `<option ${colOf(t) === c ? 'selected' : ''}>${c}</option>`).join('')}</select></td><td><input type="date" class="nt-in" data-change="k-due" data-id="${esc(t.id)}" value="${esc(t.due || '')}"></td><td><select data-change="k-pri" data-id="${esc(t.id)}">${['', 'P1', 'P2', 'P3'].map(x => `<option ${String(t.priority || '') === x ? 'selected' : ''} value="${x}">${x || '—'}</option>`).join('')}</select></td><td><input class="nt-in" data-change="k-next" data-id="${esc(t.id)}" value="${esc(t.nextAction || '')}" placeholder="Next action…" dir="auto"></td><td><button class="icon-btn" data-act="k-del" data-id="${esc(t.id)}" aria-label="Delete">${I.trash}</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">No tasks yet.</td></tr>'}</tbody></table></div><button class="btn" data-act="k-add" data-col="To do" data-id="${esc(p.id)}" style="margin-top:10px">${I.plus} Task</button>`;
  const today_ = ts.filter(t => isOpen(t) && (t.due === today() || t.focusDate === today()));
  return header(`${pjIcon(p)} ${p.title}`, [g ? '🎯 ' + g.title : '', p.target ? 'Target ' + fmtDate(p.target, true) : '', `${projPct(p.id)}% done`].filter(Boolean).join(' · ')) + `
  <div class="toolbar"><div class="seg"><button class="${v === 'board' ? 'on' : ''}" data-act="bv-mode" data-id="${esc(p.id)}" data-v="board">Board</button><button class="${v === 'table' ? 'on' : ''}" data-act="bv-mode" data-id="${esc(p.id)}" data-v="table">Table</button></div><span style="flex:1"></span>${p.id !== 'inbox' ? `<button class="btn ghost small" data-act="project" data-id="${esc(p.id)}">Edit board</button>` : ''}</div>
  ${p.notes ? `<div class="pj-desc" dir="auto">${esc(p.notes)}</div>` : ''}
  ${today_.length ? `<div class="card tight"><h2 style="padding:10px 12px 0">Today on this board <span class="count">${today_.length}</span></h2><div class="list">${today_.map(t => taskRow(t)).join('')}</div></div>` : ''}
  ${v === 'table' ? table : board}<div class="qhint" style="margin-top:8px">Drag a card to another column. On a phone, hold it for a moment first.</div>`;
}

/* ---------- drag and drop (mouse, pen and touch) ---------- */
let drag = null, dragEnded = 0;
const DROP = {
  task: (id, col, order) => { const t = get('tasks', id); if (!t) return; const p = { state: col, korder: order }; if (col === 'Done' && !DONE.has(t.state)) { p.completedOn = today(); celebrate(); } if (col !== 'Done') p.completedOn = ''; save('tasks', Object.assign({}, t, p)); },
  app: (id, col, order) => { const a = get('applications', id); if (!a) return; const p = { stage: col, korder: order }; if (col === 'Applied' && !a.appliedOn) { p.appliedOn = today(); p.followUp = addDays(today(), 7); } save('applications', Object.assign({}, a, p)); }
};
function dragStart(x, y) {
  const el = drag.el, r = el.getBoundingClientRect(); drag.on = true; drag.dx = x - r.left; drag.dy = y - r.top;
  const g = el.cloneNode(true); g.className += ' kghost'; g.style.width = r.width + 'px'; document.body.appendChild(g); drag.g = g; el.classList.add('kdragging');
  if (navigator.vibrate) try { navigator.vibrate(12); } catch {}
  dragMove(x, y);
}
function dragMove(x, y) {
  drag.g.style.transform = `translate(${x - drag.dx}px,${y - drag.dy}px) rotate(2deg)`;
  drag.g.style.display = 'none'; const under = document.elementFromPoint(x, y); drag.g.style.display = '';
  const col = under && under.closest('[data-drop]'); document.querySelectorAll('.kover').forEach(c => c !== col && c.classList.remove('kover')); if (col) col.classList.add('kover'); drag.col = col; drag.x1 = x; drag.y1 = y;
  const kb = drag.el.closest('.kb'); if (kb) { const r = kb.getBoundingClientRect(); if (x > r.right - 40) kb.scrollLeft += 14; else if (x < r.left + 40) kb.scrollLeft -= 14; }
}
function dragStop(drop) {
  const d = drag; drag = null; if (!d) return; clearTimeout(d.timer); if (!d.on) return; dragEnded = Date.now();
  if (d.g) d.g.remove(); d.el.classList.remove('kdragging'); document.querySelectorAll('.kover').forEach(c => c.classList.remove('kover'));
  if (render.pending) { render.pending = false; setTimeout(render, 0); }
  if (!drop || !d.col) return;
  const sibs = [...d.col.querySelectorAll('[data-drag]')].filter(c => c !== d.el); let before = null, prev = null;
  for (const s of sibs) { const r = s.getBoundingClientRect(); if (r.top + r.height / 2 > d.y1) { before = s; break; } prev = s; }
  const o = s => Number(s.dataset.o) || 0; const order = before ? (prev ? (o(prev) + o(before)) / 2 : o(before) - 1) : (prev ? o(prev) + 1 : Date.now() / 1e6);
  (DROP[d.col.dataset.kind] || (() => {}))(d.el.dataset.id, d.col.dataset.drop, order);
}
document.addEventListener('pointerdown', e => {
  const c = e.target.closest && e.target.closest('[data-drag]'); if (!c || e.button > 0 || e.target.closest('button,select,input,a')) return;
  drag = { el: c, x: e.clientX, y: e.clientY, on: false, touch: e.pointerType !== 'mouse' };
  if (drag.touch) { const d0 = drag; drag.timer = setTimeout(() => { if (drag === d0 && !d0.on) dragStart(d0.x, d0.y); }, 300); }
});
document.addEventListener('pointermove', e => {
  if (!drag) return; if (!drag.on) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return; if (drag.touch) { clearTimeout(drag.timer); drag = null; return; } dragStart(e.clientX, e.clientY); return; }
  dragMove(e.clientX, e.clientY);
});
document.addEventListener('pointerup', () => dragStop(true));
document.addEventListener('pointercancel', () => { if (drag && drag.on) return; dragStop(false); });
document.addEventListener('touchmove', e => { if (drag && drag.on) { e.preventDefault(); const t = e.touches[0]; if (t) dragMove(t.clientX, t.clientY); } }, { passive: false });
document.addEventListener('touchend', () => { if (drag && drag.on) dragStop(true); });
document.addEventListener('touchcancel', () => { if (drag && drag.on) dragStop(false); });
document.addEventListener('click', e => { if (Date.now() - dragEnded < 350) { e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('[data-drag]')) e.preventDefault(); });

/* ---------- job search: apply sprint (owner) ---------- */
const JOB_TPL = {
  cover: 'Dear Hiring Team,\n\nI am applying for the {role} role at {company}. I bring hands-on project delivery and data reporting experience, and I am keen to contribute from day one. My CV is attached.\n\nKind regards,\n{me}',
  apply: 'Subject: Application – {role}\n\nDear {name},\n\nI would like to apply for the {role} position at {company}. My CV is attached. I would welcome a short call to discuss how I can help your team.\n\nKind regards,\n{me}',
  follow: 'Subject: Following up – {role} application\n\nDear {name},\n\nI applied for the {role} role at {company} on {date} and wanted to check on the next steps. I remain very interested and happy to share anything else you need.\n\nKind regards,\n{me}',
  li: 'Hi {name}, I recently applied for the {role} role at {company}. I would value a quick chat about the team and the role. Thank you!'
};
const jobTpl = k => ((prefs().jobTpl || {})[k]) || JOB_TPL[k];
const fillTpl = (s, a) => String(s).replace(/\{(\w+)\}/g, (m, k) => ({ role: a.role || 'the', company: a.company || 'your company', name: a.contact || 'Hiring Manager', me: (me && me.name) || '', date: a.appliedOn ? fmtDate(a.appliedOn, true) : 'recently' })[k] ?? m);
const jobSrc = a => { const s = String(a.source || a.link || '').toLowerCase(); return /linkedin/.test(s) ? 'LinkedIn' : /indeed/.test(s) ? 'Indeed' : a.source || ''; };
const jobTarget = () => Number(prefs().jobTarget) || 20;
const appliedOn = d => list('applications').filter(a => a.appliedOn === d).length;
const jobQueue = () => list('applications').filter(a => (a.stage || 'Saved') === 'Saved').sort((a, b) => (b.easy ? 1 : 0) - (a.easy ? 1 : 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
const staleApps = () => list('applications').filter(a => ['Applied', 'Screening'].includes(a.stage) && a.appliedOn && daysTo(a.appliedOn) <= -30 && (Number(a.fuCount) || 0) >= 2);
function jobStreak() { let n = 0, d = today(); if (appliedOn(d) < jobTarget()) d = addDays(d, -1); while (n < 400 && appliedOn(d) >= jobTarget()) { n++; d = addDays(d, -1); } return n; }
function jobStats() {
  const all = list('applications'), applied = all.filter(a => a.appliedOn), wk = addDays(today(), -6);
  const replied = applied.filter(a => ['Screening', 'Interview', 'Offer'].includes(a.stage)).length;
  return { week: applied.filter(a => a.appliedOn >= wk).length, total: applied.length, rate: applied.length ? Math.round(100 * replied / applied.length) : 0, interviews: all.filter(a => ['Interview', 'Offer'].includes(a.stage)).length };
}
function vJobs() {
  const tab = ['pipeline', 'list', 'follow', 'tpl'].includes(ui.jTab) ? ui.jTab : 'pipeline';
  const tgt = jobTarget(), done = appliedOn(today()), q = jobQueue(), fu = followUps(), st = jobStats();
  const pipe = APP_STAGES.slice(0, 5).map(s => { const cs = list('applications').filter(a => (a.stage || 'Saved') === s).sort((a, b) => bOrder(a) - bOrder(b)); return `<section class="kcol" data-drop="${s}" data-kind="app"><header><span class="chip">${s}</span><span class="count">${cs.length}</span></header><div class="kcards">${cs.slice(0, 60).map(a => `<div class="kcard" data-act="application" data-id="${esc(a.id)}" data-drag="app" data-o="${bOrder(a)}"><div class="kc-t" dir="auto">${esc(a.role || 'Role')}</div><div class="small" dir="auto">${esc(a.company || '')}${a.location ? ' · ' + esc(a.location) : ''}</div><div class="m">${jobSrc(a) ? `<span class="chip">${esc(jobSrc(a))}</span>` : ''}${a.easy ? '<span class="chip s-done">Easy Apply</span>' : ''}${a.followUp && APP_ACTIVE.includes(a.stage || 'Saved') && a.stage !== 'Saved' ? `<span class="chip ${a.followUp <= today() ? 'late' : ''}">Follow up ${esc(rel(a.followUp))}</span>` : ''}</div></div>`).join('')}</div></section>`; }).join('');
  const fuRow = (a, stale) => `<div class="row"><div class="main"><div class="t" dir="auto">${esc(a.role || 'Role')} · ${esc(a.company || '')}</div><div class="m">${a.appliedOn ? `<span>Applied ${esc(fmtDate(a.appliedOn))}</span>` : ''}<span>${Number(a.fuCount) || 0} follow-ups</span>${a.contactEmail ? `<span>${esc(a.contactEmail)}</span>` : ''}</div><div class="btns" style="margin-top:6px">${stale ? `<button class="btn small" data-act="jf-close" data-id="${esc(a.id)}">Close it (no reply)</button>` : `${a.contactEmail ? `<button class="btn small primary" data-act="jf-email" data-id="${esc(a.id)}">✉ Email</button>` : ''}<button class="btn small" data-act="jf-li" data-id="${esc(a.id)}">LinkedIn message</button><button class="btn small ghost" data-act="jf-done" data-id="${esc(a.id)}">Done</button>`}</div></div></div>`;
  const body = tab === 'pipeline' ? `<div class="kb">${pipe}</div><div class="qhint" style="margin-top:8px">Drag a card to change its stage. Moving to Applied sets a follow-up in 7 days.</div>`
    : tab === 'list' ? vJobsList()
    : tab === 'follow' ? `<div class="card"><h2>Due now <span class="count">${fu.length}</span></h2>${fu.length ? `<div class="list">${fu.map(a => fuRow(a)).join('')}</div>` : '<div class="empty">No follow-ups due. ME.Coach sets the next one automatically: 7 days after you apply, then 7 more after each follow-up.</div>'}</div>${staleApps().length ? `<div class="card"><h2>No reply after 30 days</h2><div class="list">${staleApps().map(a => fuRow(a, true)).join('')}</div></div>` : ''}`
    : `<div class="card"><h2>Message templates</h2><p class="small">Use {role}, {company}, {name} (contact), {me} and {date}. They fill in automatically.</p>${[['cover', 'Short cover note (copy into the form)'], ['apply', 'Email application'], ['follow', 'Follow-up email'], ['li', 'LinkedIn message']].map(([k, l]) => `<div class="f"><label>${l}</label><textarea rows="5" data-change="job-tpl" data-k="${k}" dir="auto">${esc(jobTpl(k))}</textarea></div>`).join('')}<div class="f"><label>Daily target</label><input type="number" min="1" max="60" value="${tgt}" data-change="job-target" style="max-width:120px"></div></div>`;
  return header('Job search', 'UK · Ireland · New Zealand') + `
  <div class="card sprint-hero"><div class="sh-ring">${ring(Math.min(100, Math.round(100 * done / tgt)), 92, `${done}/${tgt}`)}</div><div class="main"><b>${done >= tgt ? 'Target reached today 🎉' : `${tgt - done} to go today`}</b><div class="small">${q.length} in the queue · ${q.filter(a => a.easy).length} Easy Apply${jobStreak() ? ` · 🔥 ${jobStreak()}-day streak` : ''}</div>
    <div class="btns" style="margin-top:10px"><button class="btn primary" data-act="sprint" ${q.length ? '' : 'disabled'}>▶ Start sprint</button><button class="btn" data-act="job-bulk">${I.plus} Add jobs</button>${fu.length ? `<button class="btn" data-act="j-tab" data-t="follow">Follow-ups <b class="badge inl">${fu.length}</b></button>` : ''}</div></div></div>
  <div class="statrow"><div><b>${st.week}</b><span>applied this week</span></div><div><b>${st.total}</b><span>applied in total</span></div><div><b>${st.rate}%</b><span>reply rate</span></div><div><b>${st.interviews}</b><span>interviews</span></div></div>
  <div class="seg ptabs" style="margin:12px 0">${[['pipeline', 'Pipeline'], ['list', 'List'], ['follow', 'Follow-ups'], ['tpl', 'Templates']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="j-tab" data-t="${k}">${l}</button>`).join('')}</div>
  ${body}
  <p class="small" style="margin-top:14px">LinkedIn and Indeed do not allow other apps to press Apply for you, so the last click is always yours. ME.Coach lines everything up so each application takes about a minute, then tracks it and reminds you to follow up.</p>`;
}
function jobBulk() {
  if (sheetCtx) closeSheet(true);
  form('Add jobs', [{ html: '<p class="small" style="margin-top:0">Paste one job per line: a link, or <b>Role | Company | link</b>. Add the word <b>easy</b> to a line for Easy Apply jobs. From LinkedIn or Indeed on your phone you can also use Share → ME.Coach.</p>' }, { k: 'lines', label: 'Jobs', type: 'textarea', req: true, ph: 'Project Coordinator | Acme Ltd | https://www.linkedin.com/jobs/view/123 easy' }, [{ k: 'location', label: 'Location', ph: 'London, UK' }, { k: 'easy', label: 'All are Easy Apply', type: 'check' }]], {}, v => {
    const have = new Set(list('applications').map(a => normLink(a.link)).filter(Boolean)); let n = 0, dup = 0;
    for (const raw of String(v.lines || '').split('\n')) { const line = raw.trim(); if (!line) continue; const m = line.match(/https?:\/\/\S+/); const link = m ? m[0] : ''; if (link && have.has(normLink(link))) { dup++; continue; }
      const easy = v.easy || /\beasy\b/i.test(line); const rest = line.replace(link, '').replace(/\beasy( apply)?\b/ig, '').split('|').map(s => s.trim()).filter(Boolean);
      let host = ''; try { host = new URL(link).hostname.replace(/^www\./, ''); } catch {}
      save('applications', { role: rest[0] || (host ? 'Job from ' + host : line.slice(0, 80)), company: rest[1] || '', link, source: host, easy, stage: 'Saved', location: rest[2] || v.location || '' }); if (link) have.add(normLink(link)); n++; }
    toast(`${n} added to the queue${dup ? ` · ${dup} already there` : ''}`);
  });
}
const normLink = u => { if (!u) return ''; try { const x = new URL(u); const li = x.pathname.match(/\/jobs\/view\/(\d+)/) || [null, x.searchParams.get('currentJobId')]; if (li[1]) return 'li:' + li[1]; const jk = x.searchParams.get('jk') || x.searchParams.get('vjk'); if (jk) return 'in:' + jk; return x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, ''); } catch { return u; } };
function sprintOpen() { if (sheetCtx) closeSheet(true); const q = jobQueue(); if (!q.length) { toast('The queue is empty. Add jobs first.'); return; } ui.sprint = { ids: q.map(a => a.id), i: 0, n: 0 }; sprintDraw(); }
function sprintDraw() {
  const s = ui.sprint; let el = $('#sprint'); if (!s) { if (el) el.remove(); return; }
  while (s.i < s.ids.length && !(get('applications', s.ids[s.i]) && (get('applications', s.ids[s.i]).stage || 'Saved') === 'Saved')) s.i++;
  if (!el) { el = document.createElement('div'); el.id = 'sprint'; document.body.appendChild(el); }
  const tgt = jobTarget(), done = appliedOn(today()), a = get('applications', s.ids[s.i]);
  el.innerHTML = `<div class="sp-top"><button class="icon-btn" data-act="sprint-close" aria-label="Close">✕</button><div class="sp-prog"><i style="width:${Math.min(100, 100 * done / tgt)}%"></i></div><b>${done}/${tgt}</b></div>
  ${a ? `<div class="sp-card"><div class="m">${jobSrc(a) ? `<span class="chip">${esc(jobSrc(a))}</span>` : ''}${a.easy ? '<span class="chip s-done">Easy Apply</span>' : ''}<span class="small">${s.i + 1} of ${s.ids.length}</span></div><h2 dir="auto">${esc(a.role || 'Role')}</h2><div class="sp-co" dir="auto">${esc(a.company || '')}${a.location ? ' · ' + esc(a.location) : ''}</div>
    <div class="sp-steps"><button class="btn wide primary" data-act="sp-open" data-id="${esc(a.id)}" ${a.link ? '' : 'disabled'}>1 · Open the job ↗</button><button class="btn wide" data-act="sp-copy" data-id="${esc(a.id)}">Copy cover note</button>${a.contactEmail ? `<button class="btn wide" data-act="sp-mail" data-id="${esc(a.id)}">✉ Email the application to ${esc(a.contact || a.contactEmail)}</button>` : ''}<button class="btn wide ok" data-act="sp-applied" data-id="${esc(a.id)}">2 · ✓ I applied</button></div>
    <div class="btns" style="justify-content:center"><button class="btn ghost small" data-act="sp-skip">Skip for now</button><button class="btn ghost small" data-act="sp-no" data-id="${esc(a.id)}">Not for me</button></div></div>`
    : `<div class="sp-card sp-end"><div class="sp-big">${done >= tgt ? '🎉' : '✓'}</div><h2>${done >= tgt ? 'Daily target reached' : 'Queue finished'}</h2><p class="small">${s.n} applied in this sprint · ${done} today. Follow-ups are set for 7 days from now.</p><div class="btns" style="justify-content:center"><button class="btn primary" data-act="sprint-close">Done</button><button class="btn" data-act="job-bulk">Add more jobs</button></div></div>`}`;
}
const markFollowed = id => { const a = get('applications', id); if (!a) return; const n = (Number(a.fuCount) || 0) + 1; const prev = Object.assign({}, a); save('applications', Object.assign({}, a, { fuCount: n, lastFollow: today(), followUp: addDays(today(), n >= 2 ? 10 : 7) })); toast('Followed up · next reminder set', 'Undo', () => save('applications', prev)); };

/* ---------- motivation: points, levels, badges, rings, coach ---------- */
const lvlAt = n => 50 * n * (n - 1);
function xpStats() {
  const tasks = list('tasks').filter(t => t.state === 'Done').length, hs = list('habits'), checks = hs.reduce((n, h) => n + Object.keys(h.done || {}).length, 0);
  const foc = list('focus').filter(f => f.kind !== 'calm'), calm = list('focus').filter(f => f.kind === 'calm'), fmin = foc.reduce((n, f) => n + (Number(f.minutes) || 0), 0);
  const morn = list('logs').filter(l => l.type === 'morning').length, night = list('logs').filter(l => l.type === 'closeout').length, apps = list('applications').filter(a => a.appliedOn).length, wh = list('wheel').length;
  const xp = tasks * 10 + checks * 5 + Math.floor(fmin / 5) * 2 + (morn + night) * 15 + apps * 8 + wh * 20 + calm.length * 10;
  let lv = 1; while (xp >= lvlAt(lv + 1)) lv++;
  const best = Math.max(0, ...hs.map(habitStreak)), maxDay = Math.max(0, ...Object.values(list('applications').reduce((m, a) => { if (a.appliedOn) m[a.appliedOn] = (m[a.appliedOn] || 0) + 1; return m; }, {})));
  const B = [['🌅', 'First Morning Balance', morn >= 1], ['🌙', '7 Night Balances', night >= 7], ['🔥', '7-day streak', best >= 7], ['🏆', '30-day streak', best >= 30], ['🎧', '10 focus sessions', foc.length >= 10], ['⏱️', '10 hours of deep work', fmin >= 600], ['✅', '50 tasks done', tasks >= 50], ['💯', '250 tasks done', tasks >= 250], ['🧭', 'Two Wheel tests', wh >= 2], ['🧘', '7 calm sessions', calm.length >= 7]];
  if (isOwner()) B.push(['💼', '20 applications in a day', maxDay >= 20], ['🚀', '100 applications', apps >= 100]);
  return { xp, lv, into: xp - lvlAt(lv), need: lvlAt(lv + 1) - lvlAt(lv), best, badges: B, fmin };
}
const LV_NAMES = ['Starter', 'Builder', 'Focused', 'Consistent', 'Driven', 'Disciplined', 'Unstoppable', 'Master', 'Mentor', 'Legend'];
const lvName = lv => LV_NAMES[Math.min(LV_NAMES.length - 1, Math.floor((lv - 1) / 2))];
function rings(d = today()) {
  const logs = list('logs').filter(l => l.date === d), plan = (logs.some(l => l.type === 'morning') ? 50 : 0) + (logs.some(l => l.type === 'closeout') ? 50 : 0);
  const tasks = list('tasks'), top = tasks.filter(t => t.focusDate === d), topDone = top.filter(t => DONE.has(t.state)).length, doneD = tasks.filter(t => t.completedOn === d).length;
  const act = top.length ? Math.round(100 * topDone / top.length) : Math.min(100, Math.round(100 * doneD / 3));
  const grow = dayHabits(d); return { plan, act, grow: grow === null ? 0 : grow };
}
function ringsSvg(r, size = 120) {
  const R = [[r.act, '#eb6834', 0], [r.grow, '#1baf7a', 1], [r.plan, '#2a78d6', 2]], c = size / 2, w = size * 0.1;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="arings" role="img" aria-label="Do ${r.act}%, Grow ${r.grow}%, Plan ${r.plan}%">${R.map(([p, col, i]) => { const rad = c - w / 2 - i * (w + 3), L = 2 * Math.PI * rad; return `<circle cx="${c}" cy="${c}" r="${rad}" fill="none" stroke="${col}" stroke-opacity=".18" stroke-width="${w}"/><circle cx="${c}" cy="${c}" r="${rad}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(L * Math.min(100, p) / 100).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 ${c} ${c})"/>`; }).join('')}</svg>`;
}
function coachMsgs(d = today()) {
  const r = rings(d), mlog = list('logs').find(l => l.type === 'morning' && l.date === d), top = list('tasks').filter(t => t.focusDate === d), open = top.filter(isOpen);
  const dueH = list('habits').filter(h => habDue(h, d) && !(h.done || {})[d]), hs = list('habits').map(h => [h, habitStreak(h)]).sort((a, b) => b[1] - a[1]);
  const dl = daysTo(visionDate()), vis = prefs().visionName || 'your vision', st = hs[0], nm = me && me.name ? me.name.split(' ')[0] : '';
  const pick = (arr, k) => arr[(Number(d.replace(/-/g, '')) + k) % arr.length];
  const morning = !mlog ? `Good morning${nm ? ', ' + nm : ''}. One minute of Morning Balance decides your three wins for today.` : `Your focus today: ${mlog.focus || 'your Top 3'}. Protect the first deep-work block for it.`;
  const midday = open.length ? `${top.length - open.length} of ${top.length} Top 3 done. Next: "${open[0].title}". One 25-minute block moves it.` : dueH.length ? `Top 3 is clear. Still open: ${dueH.slice(0, 2).map(h => h.title).join(' and ')}.` : pick(['Progress beats perfection. Pick the next small step and start it now.', 'You are building the person who reaches ' + vis + '. Show up for one more block.'], 1);
  const afternoon = st && st[1] >= 2 ? `${st[0].title} is on a ${st[1]}-day streak. Keep it alive today.` : dueH.length ? `${dueH.length} habit${dueH.length > 1 ? 's' : ''} left today. Start with "${dueH[0].title}". It takes less than you think.` : pick([`${dl.toLocaleString('en-GB')} days to ${vis}. Today counts.`, 'Small daily wins compound. Finish one thing before you start another.'], 2);
  const evening = r.plan >= 100 ? 'Day closed. Rest well. Tomorrow is already planned.' : `Close the day in one minute: score it, note one win, pick tomorrow's Top 3.`;
  return { morning, midday, afternoon, evening };
}
const slotOf = h => h < 11 ? 'morning' : h < 15 ? 'midday' : h < 18 ? 'afternoon' : 'evening';
const WIDGETS = [['rings', 'Daily rings'], ['level', 'Level and points'], ['streak', 'Best streak'], ['focus', 'Focus today'], ['vision', 'Vision countdown'], ['money', 'Savings'], ['jobs', 'Job sprint'], ['badges', 'Badges']];
const myWidgets = () => (prefs().widgets || ['rings', 'level', 'streak', 'focus', 'vision', 'jobs']).filter(k => k !== 'jobs' || isOwner());
function widgetHtml(k) {
  const t = today();
  if (k === 'rings') { const r = rings(t); return `<div class="wg wg-rings" data-act="w-rings">${ringsSvg(r, 96)}<div class="wl"><span style="--c:#eb6834">Do <b>${r.act}%</b></span><span style="--c:#1baf7a">Grow <b>${r.grow}%</b></span><span style="--c:#2a78d6">Plan <b>${r.plan}%</b></span></div></div>`; }
  if (k === 'level') { const x = xpStats(); return `<div class="wg" data-act="w-level"><div class="wk">Level ${x.lv} · ${lvName(x.lv)}</div><div class="wv">${x.xp.toLocaleString('en-GB')}<small> pts</small></div><div class="bar"><i style="width:${Math.round(100 * x.into / x.need)}%"></i></div><div class="small">${x.need - x.into} to level ${x.lv + 1}</div></div>`; }
  if (k === 'streak') { const hs = list('habits').map(h => [h, habitStreak(h)]).sort((a, b) => b[1] - a[1])[0]; return `<div class="wg" data-act="go" data-to="habits"><div class="wk">Best streak</div><div class="wv">🔥 ${hs ? hs[1] : 0}<small> days</small></div><div class="small" dir="auto">${hs ? esc(hs[0].title) : 'Add a habit'}</div></div>`; }
  if (k === 'focus') { const m = dayFocus(t); return `<div class="wg" data-act="focus-free"><div class="wk">Focus today</div><div class="wv">${Math.floor(m / 60)}<small>h</small> ${m % 60}<small>m</small></div><div class="small">Tap to start a session</div></div>`; }
  if (k === 'vision') { const dl = daysTo(visionDate()); return `<div class="wg" data-act="p-tab" data-t="roadmap"><div class="wk">${esc(prefs().visionName || 'Vision')}</div><div class="wv">${dl.toLocaleString('en-GB')}<small> days</small></div><div class="small">to go</div></div>`; }
  if (k === 'money') { const goal = Number(prefs().savingsGoal) || 0, m = list('money').sort((a, b) => String(b.date).localeCompare(String(a.date)))[0], have = m ? Number(m.amount) || 0 : 0; return `<div class="wg" data-act="p-tab" data-t="money"><div class="wk">Savings</div><div class="wv">${esc(prefs().currency || '')} ${have.toLocaleString('en-GB')}</div>${goal ? `<div class="bar"><i style="width:${Math.min(100, Math.round(100 * have / goal))}%"></i></div><div class="small">of ${goal.toLocaleString('en-GB')}</div>` : '<div class="small">Set a goal in Money</div>'}</div>`; }
  if (k === 'jobs') { const d = appliedOn(t), g = jobTarget(); return `<div class="wg" data-act="go" data-to="jobs"><div class="wk">Applications today</div><div class="wv">${d}<small>/${g}</small></div><div class="bar"><i style="width:${Math.min(100, Math.round(100 * d / g))}%"></i></div><div class="small">${jobQueue().length} in the queue</div></div>`; }
  if (k === 'badges') { const b = xpStats().badges.filter(x => x[2]); return `<div class="wg" data-act="w-level"><div class="wk">Badges</div><div class="wv">${b.length}<small>/${xpStats().badges.length}</small></div><div class="wbadges">${b.slice(-5).map(x => `<span title="${esc(x[1])}">${x[0]}</span>`).join('') || '<span class="small">Your first one is close</span>'}</div></div>`; }
  return '';
}
function coachCard() {
  const m = coachMsgs()[slotOf(new Date().getHours())];
  return `<div class="coach-msg"><span class="cm-av">ME<b>.</b></span><div class="main"><div class="small">Your coach</div><div dir="auto">${esc(m)}</div></div></div>`;
}
function widgetGrid() { const ws = myWidgets(); return ws.length ? `<div class="wgrid">${ws.map(widgetHtml).join('')}</div><div class="wg-edit"><button class="btn ghost small" data-act="w-edit">Edit widgets</button></div>` : `<div class="wg-edit"><button class="btn ghost small" data-act="w-edit">Add widgets</button></div>`; }
function levelSheet() {
  const x = xpStats();
  openSheet(`Level ${x.lv} · ${lvName(x.lv)}`, `<div class="lv-hero"><div class="wv">${x.xp.toLocaleString('en-GB')} pts</div><div class="bar"><i style="width:${Math.round(100 * x.into / x.need)}%"></i></div><div class="small">${x.need - x.into} points to level ${x.lv + 1}</div></div>
  <h2 style="margin-top:14px">Badges</h2><div class="badges">${x.badges.map(([e, l, ok]) => `<div class="bdg ${ok ? 'on' : ''}"><span>${e}</span><div class="small">${esc(l)}</div></div>`).join('')}</div>
  <h2 style="margin-top:14px">How you earn points</h2><div class="small">Task done 10 · habit kept 5 · every 5 focus minutes 2 · Morning or Night Balance 15 · calm session 10 · Wheel test 20${isOwner() ? ' · application sent 8' : ''}</div>`, '', { noFocus: true });
}
function widgetEdit() {
  const on = new Set(myWidgets()), all = WIDGETS.filter(([k]) => k !== 'jobs' || isOwner());
  openSheet('Widgets', `<p class="small" style="margin-top:0">Choose what shows on Today. They update every time something changes.</p><div class="list">${all.map(([k, l]) => `<label class="row"><input type="checkbox" data-change="w-tog" data-k="${k}" ${on.has(k) ? 'checked' : ''}><div class="main"><div class="t">${l}</div></div></label>`).join('')}</div>
  <div class="card" style="margin-top:14px"><b>On your iPhone, iPad or Mac</b><p class="small">Add a live ME.Coach widget to your home screen or desktop. It refreshes several times a day.</p><button class="btn primary" data-act="w-home">Set up home-screen widget</button></div>`, '', { noFocus: true });
}
/* snapshot the server can hand to home-screen widgets */
function widgetSnap() {
  const t = today(), x = xpStats(), r = rings(t), top = list('tasks').filter(k => k.focusDate === t);
  const hs = list('habits').filter(h => habDue(h, t)), best = list('habits').map(h => [h.title, habitStreak(h)]).sort((a, b) => b[1] - a[1])[0];
  const o = { id: 'widget', date: t, level: x.lv, levelName: lvName(x.lv), xp: x.xp, pct: Math.round(100 * x.into / x.need), rings: r, msgs: coachMsgs(t), top3: top.map(k => ({ t: k.title, done: DONE.has(k.state) })), habits: { due: hs.length, done: hs.filter(h => (h.done || {})[t]).length }, streak: best ? { t: best[0], n: best[1] } : null, focus: dayFocus(t), vision: { name: prefs().visionName || '', days: daysTo(visionDate()) } };
  if (isOwner()) o.jobs = { done: appliedOn(t), target: jobTarget(), queue: jobQueue().length };
  return o;
}
function pushWidget() {
  clearTimeout(pushWidget.t); pushWidget.t = setTimeout(() => { if (!ls.get(K.tok) || (me && me.access === false)) return; try { const s = widgetSnap(), cur = get('settings', 'widget'); const strip = o => { const c = Object.assign({}, o); delete c.createdAt; delete c.updatedAt; delete c.by; return JSON.stringify(c); }; if (!cur || strip(cur) !== strip(s)) { const r = Object.assign({}, cur || {}, s, { createdAt: (cur && cur.createdAt) || nowIso(), updatedAt: nowIso(), by: device() }); db.settings.widget = r; outbox['settings:widget'] = r; persist(); queueSync(); } } catch {} }, 4000);
}
async function homeWidget() {
  let key = ''; try { key = (await api('shortkey')).key; } catch (e) { toast('Connect to the internet first'); return; }
  const base = new URL('api.php', location.href).href, url = `${base}?action=s-widget&k=${key}`;
  const script = SCRIPTABLE.replace('__URL__', url);
  openSheet('Home-screen widget', `<h2>iPhone and iPad</h2><ol class="small steps"><li>Install the free app <b>Scriptable</b> from the App Store.</li><li>Open it, tap <b>+</b>, paste the script below and name it <b>ME.Coach</b>.</li><li>Long-press the home screen → <b>+</b> → Scriptable → choose a size → tap the widget → Script: <b>ME.Coach</b>.</li></ol>
  <button class="btn primary" data-act="copy" data-text="${esc(script)}">Copy the script</button>
  <h2 style="margin-top:16px">Mac, Windows or any browser</h2><p class="small">Open this page and keep it as a small window. On a Mac with Safari: File → Add to Dock. It refreshes every 15 minutes.</p><div class="btns"><a class="btn" href="${esc(url)}&format=html" target="_blank" rel="noopener">Open desktop widget</a><button class="btn ghost" data-act="copy" data-text="${esc(url + '&format=html')}">Copy link</button></div>
  <p class="small" style="margin-top:12px">The link contains a private key. Anyone with it can read your widget summary. Change it any time in Settings → Siri (Rotate key).</p>`, '', { noFocus: true });
}
const SCRIPTABLE = `// ME.Coach widget for Scriptable
const URL_ = "__URL__";
let d; try { d = await new Request(URL_).loadJSON(); } catch (e) { d = null; }
const w = new ListWidget(); w.backgroundColor = Color.dynamic(new Color("#ffffff"), new Color("#191919"));
w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000); w.url = URL_.split("api.php")[0];
const ink = Color.dynamic(new Color("#37352f"), new Color("#e6e6e6")), meta = Color.dynamic(new Color("#787774"), new Color("#9b9b9b"));
function t(s, size, c, bold) { const x = w.addText(String(s)); x.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size); x.textColor = c || ink; x.minimumScaleFactor = 0.6; return x; }
function bar(p, col) { const ctx = new DrawContext(); ctx.size = new Size(200, 8); ctx.opaque = false; ctx.respectScreenScale = true; ctx.setFillColor(new Color(col, 0.18)); ctx.fillPath(roundRect(ctx, 200)); ctx.setFillColor(new Color(col)); ctx.fillPath(roundRect(ctx, Math.max(8, 2 * Math.min(100, p)))); const i = w.addImage(ctx.getImage()); i.imageSize = new Size(200, 8); w.addSpacer(4); }
function roundRect(ctx, wd) { const p = new Path(); p.addRoundedRect(new Rect(0, 0, wd, 8), 4, 4); return p; }
if (!d || !d.ok) { t("ME.Coach", 14, null, true); t(d && d.message ? d.message : "Open the app once to refresh.", 11, meta); }
else {
  const fam = config.widgetFamily || "medium";
  t("ME. Level " + d.level + " · " + d.levelName, 11, meta, true); w.addSpacer(4);
  bar(d.rings.act, "#eb6834"); bar(d.rings.grow, "#1baf7a"); bar(d.rings.plan, "#2a78d6");
  if (fam !== "small") { w.addSpacer(4); t(d.message, 12); }
  if (fam === "large") { w.addSpacer(8); (d.top3 || []).forEach(k => t((k.done ? "✓ " : "○ ") + k.t, 12, k.done ? meta : ink)); if (d.jobs) { w.addSpacer(6); t("Applications " + d.jobs.done + "/" + d.jobs.target, 12, null, true); } }
  w.addSpacer(); t(d.habits.done + "/" + d.habits.due + " habits · " + d.focus + " min focus" + (d.streak && d.streak.n ? " · 🔥" + d.streak.n : ""), 10, meta);
}
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium(); Script.complete();`;

/* ---------- calm: breathing and meditation ---------- */
const BREATHS = [['box', 'Box breathing', 'Steady and focused', [['Breathe in', 4], ['Hold', 4], ['Breathe out', 4], ['Hold', 4]], 'ocean'], ['478', '4-7-8', 'Calm down, fall asleep', [['Breathe in', 4], ['Hold', 7], ['Breathe out', 8]], 'night'], ['coh', 'Coherent', 'Balance body and mind', [['Breathe in', 5.5], ['Breathe out', 5.5]], 'forest'], ['sigh', 'Quick reset', 'Release stress in a minute', [['Breathe in', 2], ['A little more', 1], ['Long breath out', 6]], 'dusk']];
const MEDS = [['god', '8 minutes with God', 8, 'night', ['Sit still. Let your breathing slow down.', 'Thank God for three things from today.', 'Speak freely: what is on your heart?', 'Ask for guidance on one decision.', 'Listen in silence.', 'Leave with one intention for the rest of the day.']], ['morning', 'Morning clarity', 5, 'dusk', ['Notice how you feel right now, without judging it.', 'Picture today going well. What did you do?', 'Choose one word for today.']], ['scan', 'Body scan', 10, 'forest', ['Bring attention to your feet.', 'Move slowly up to your legs and hips.', 'Notice your belly rising and falling.', 'Relax your shoulders and jaw.', 'Feel your whole body at once.']], ['sleep', 'Before sleep', 10, 'night', ['Let the day go. It is done.', 'Name one thing you are proud of today.', 'Breathe out longer than you breathe in.', 'Let your body grow heavy.']], ['free', 'Silent timer', 10, 'ocean', []]];
function vCalm() {
  const wk = addDays(today(), -6), cs = list('focus').filter(f => f.kind === 'calm'), wmin = cs.filter(f => f.date >= wk).reduce((n, f) => n + (Number(f.minutes) || 0), 0);
  let st = 0, d = today(); if (!cs.some(f => f.date === d)) d = addDays(d, -1); while (st < 400 && cs.some(f => f.date === d)) { st++; d = addDays(d, -1); }
  return header('Calm', 'Breathe, reset, reflect') + `
  <div class="statrow"><div><b>${wmin}</b><span>mindful minutes this week</span></div><div><b>${cs.length}</b><span>sessions</span></div><div><b>${st ? '🔥 ' + st : 0}</b><span>day streak</span></div></div>
  <h2 class="sec-h">Breathing</h2><div class="calm-grid">${BREATHS.map(([k, l, s, , sc]) => `<button class="calm-card scene-${sc}" data-act="calm-breath" data-v="${k}"><b>${l}</b><span>${s}</span></button>`).join('')}</div>
  <h2 class="sec-h">Meditation</h2><div class="calm-grid">${MEDS.map(([k, l, m, sc]) => `<button class="calm-card scene-${sc}" data-act="calm-med" data-v="${k}"><b>${l}</b><span>${m} min</span></button>`).join('')}</div>`;
}
let calmT = null;
function calmOpen(kind, key, mins) {
  if (sheetCtx) closeSheet(true); clearInterval(calmT);
  const B = BREATHS.find(b => b[0] === key), M = MEDS.find(m => m[0] === key); if (!B && !M) return;
  const total = (mins || (B ? 3 : M[2])) * 60000, scene = B ? B[4] : M[3];
  ui.calm = { kind, key, start: Date.now(), total, title: B ? B[1] : M[1] };
  let el = $('#calm'); if (!el) { el = document.createElement('div'); el.id = 'calm'; document.body.appendChild(el); }
  el.className = 'scene-' + scene;
  el.innerHTML = `<div class="fbg"><i></i><i></i><i></i></div><div class="calm-box"><div class="fttl">${esc(ui.calm.title)}</div>${B ? `<div class="bcirc"><i></i><span class="bl">Get ready</span></div><div class="fmodes">${[1, 3, 5].map(m => `<button class="${total === m * 60000 ? 'on' : ''}" data-act="calm-len" data-v="${key}" data-m="${m}">${m} min</button>`).join('')}</div>` : `<div class="mcue" dir="auto">${esc(M[4][0] || 'Sit comfortably and close your eyes.')}</div>`}
  <div class="ft calm-t">--:--</div><div class="fopts"><div>${SOUNDS.map(([k, l]) => `<button class="${(amb ? amb.kind : 'off') === k ? 'on' : ''}" data-act="calm-sound" data-v="${k}">${l}</button>`).join('')}</div></div>
  <div class="btns" style="justify-content:center"><button class="btn primary" data-act="calm-end">Finish</button><button class="btn ghost" data-act="calm-cancel">Close</button></div></div>`;
  const circ = el.querySelector('.bcirc i'), lab = el.querySelector('.bl'), cue = el.querySelector('.mcue'), tt = el.querySelector('.calm-t');
  let ph = -1, phEnd = Date.now() + 1500;
  const tick = () => { const c = ui.calm; if (!c) { clearInterval(calmT); return; } const left = c.total - (Date.now() - c.start); tt.textContent = `${pad(Math.max(0, Math.floor(left / 60000)))}:${pad(Math.max(0, Math.floor(left % 60000 / 1000)))}`;
    if (left <= 0) { calmEnd(true); return; }
    if (B && Date.now() >= phEnd) { ph = (ph + 1) % B[3].length; const [name, sec] = B[3][ph]; phEnd = Date.now() + sec * 1000; lab.textContent = name; circ.style.transitionDuration = sec + 's'; circ.style.transform = /in|more/i.test(name) ? 'scale(1)' : /out/i.test(name) ? 'scale(.45)' : circ.style.transform || 'scale(.45)'; }
    if (M && M[4].length > 1) { const i = Math.min(M[4].length - 1, Math.floor((Date.now() - c.start) / (c.total / M[4].length))); if (cue.dataset.i !== String(i)) { cue.dataset.i = i; cue.classList.remove('in'); void cue.offsetWidth; cue.textContent = M[4][i]; cue.classList.add('in'); } } };
  if (circ) circ.style.transform = 'scale(.45)';
  tick(); calmT = setInterval(tick, 250);
}
function calmEnd(save_) {
  const c = ui.calm; clearInterval(calmT); ui.calm = null; ambient('off'); const el = $('#calm'); if (el) el.remove(); if (!c || !save_) return;
  const mins = Math.max(1, Math.round(Math.min(c.total, Date.now() - c.start) / 60000)), st = new Date(c.start);
  save('focus', { date: dstr(st), start: `${pad(st.getHours())}:${pad(st.getMinutes())}`, minutes: mins, label: c.title, kind: 'calm' });
  if (c.key === 'god') { const h = list('habits').find(h => /god|خدا|pray|نماز/i.test(h.title || '')); const t = today(); if (h && !(h.done || {})[t]) save('habits', Object.assign({}, h, { done: Object.assign({}, h.done || {}, { [t]: true }) })); }
  celebrate(); toast(`${mins} mindful minute${mins > 1 ? 's' : ''} saved`);
}

/* ---------- v7 actions ---------- */
function v7Acts(a, id, e) {
  return {
    'b-view': () => { ui.bView = a.dataset.v; saveUi(); render(); },
    'bv-mode': () => { ui.bvMode = Object.assign({}, ui.bvMode, { [id]: a.dataset.v }); saveUi(); render(); },
    'k-add': () => { const col = a.dataset.col, pid = id; form('New card · ' + col, [{ k: 'title', label: 'Card', req: true }, [{ k: 'due', label: 'Due', type: 'date' }, { k: 'priority', label: 'Priority', type: 'select', options: ['P1', 'P2', 'P3'], blank: false, def: 'P2' }]], {}, v => { const r = { title: v.title, due: v.due || '', priority: v.priority || 'P2', state: col, owner: 'Me', projectId: pid === 'inbox' ? '' : pid, korder: Date.now() / 1e6 }; if (col === 'Done') r.completedOn = today(); save('tasks', r); }); },
    'j-tab': () => { ui.jTab = a.dataset.t; saveUi(); if (route().page !== 'jobs') location.hash = '#/jobs'; else render(); },
    'job-bulk': () => { if ($('#sprint')) { ui.sprint = null; sprintDraw(); } jobBulk(); },
    sprint: () => sprintOpen(),
    'sprint-close': () => { ui.sprint = null; sprintDraw(); render(); },
    'sp-open': () => { const x = get('applications', id); if (x && x.link) { window.open(x.link, '_blank', 'noopener'); save('applications', Object.assign({}, x, { openedAt: nowIso() })); sprintDraw(); } },
    'sp-copy': async () => { const x = get('applications', id); const s = fillTpl(jobTpl('cover'), x || {}); try { await navigator.clipboard.writeText(s); toast('Cover note copied. Paste it into the form.'); } catch { prompt('Copy this', s); } },
    'sp-mail': () => { const x = get('applications', id); if (!x) return; const [sub, ...rest] = fillTpl(jobTpl('apply'), x).split('\n'); location.href = `mailto:${encodeURIComponent(x.contactEmail)}?subject=${encodeURIComponent(sub.replace(/^Subject:\s*/i, ''))}&body=${encodeURIComponent(rest.join('\n').trim())}`; toast('Attach your CV in the email, send it, then tap “I applied”.'); },
    'sp-applied': () => { const x = get('applications', id); if (!x) return; const before = appliedOn(today()); save('applications', Object.assign({}, x, { stage: 'Applied', appliedOn: today(), followUp: addDays(today(), 7), appliedVia: x.easy ? 'Easy Apply' : jobSrc(x) || 'Website' })); ui.sprint.n++; ui.sprint.i++; if (before + 1 === jobTarget()) celebrate(); sprintDraw(); },
    'sp-skip': () => { const s = ui.sprint; s.ids.push(s.ids.splice(s.i, 1)[0]); if (s.ids.length === 1 || s.skipped > s.ids.length) s.i++; s.skipped = (s.skipped || 0) + 1; sprintDraw(); },
    'sp-no': () => { const x = get('applications', id); if (x) save('applications', Object.assign({}, x, { stage: 'Withdrawn', notes: [x.notes, 'Not a fit (sprint)'].filter(Boolean).join('\n') })); ui.sprint.i++; sprintDraw(); },
    'jf-email': () => { const x = get('applications', id); if (!x) return; const [sub, ...rest] = fillTpl(jobTpl('follow'), x).split('\n'); location.href = `mailto:${encodeURIComponent(x.contactEmail)}?subject=${encodeURIComponent(sub.replace(/^Subject:\s*/i, ''))}&body=${encodeURIComponent(rest.join('\n').trim())}`; markFollowed(id); },
    'jf-li': async () => { const x = get('applications', id); if (!x) return; const s = fillTpl(jobTpl('li'), x); try { await navigator.clipboard.writeText(s); } catch {} window.open(x.contactUrl || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent((x.company || '') + ' recruiter')}`, '_blank', 'noopener'); toast('Message copied. Paste it on LinkedIn.'); markFollowed(id); },
    'jf-done': () => markFollowed(id),
    'jf-close': () => { const x = get('applications', id); if (x) save('applications', Object.assign({}, x, { stage: 'Rejected', notes: [x.notes, 'Closed: no reply after 30 days'].filter(Boolean).join('\n') })); },
    'w-edit': () => widgetEdit(), 'w-level': () => levelSheet(), 'w-home': () => { closeSheet(true); homeWidget(); },
    'w-rings': () => { const r = rings(); openSheet('Daily rings', `<div style="display:grid;place-items:center">${ringsSvg(r, 180)}</div><div class="list" style="margin-top:12px"><div class="row"><span class="dotx" style="background:#eb6834"></span><div class="main"><div class="t">Do · ${r.act}%</div><div class="m">Your Top 3 done (or 3 tasks finished)</div></div></div><div class="row"><span class="dotx" style="background:#1baf7a"></span><div class="main"><div class="t">Grow · ${r.grow}%</div><div class="m">Habits due today that you kept</div></div></div><div class="row"><span class="dotx" style="background:#2a78d6"></span><div class="main"><div class="t">Plan · ${r.plan}%</div><div class="m">Morning Balance and Night Balance</div></div></div></div>`, '', { noFocus: true }); },
    'calm-breath': () => calmOpen('breath', a.dataset.v), 'calm-med': () => calmOpen('med', a.dataset.v),
    breathe: () => { if (sheetCtx) closeSheet(true); location.hash = '#/calm'; },
    'calm-len': () => calmOpen('breath', a.dataset.v, Number(a.dataset.m)),
    'calm-sound': () => { ambient(a.dataset.v); document.querySelectorAll('#calm .fopts button').forEach(b => b.classList.toggle('on', b.dataset.v === a.dataset.v)); },
    'calm-end': () => calmEnd(true), 'calm-cancel': () => calmEnd(false)
  };
}
function v7Change(e) {
  const d = e.target.dataset || {};
  if (d.change === 'k-state') { DROP.task(d.id, e.target.value, (get('tasks', d.id) || {}).korder); return true; }
  if (d.change === 'job-tpl') { save('settings', Object.assign({}, prefs(), { id: 'prefs', jobTpl: Object.assign({}, prefs().jobTpl || {}, { [d.k]: e.target.value }) })); toast('Template saved'); return true; }
  if (d.change === 'job-target') { save('settings', Object.assign({}, prefs(), { id: 'prefs', jobTarget: Math.max(1, Math.min(60, Number(e.target.value) || 20)) })); return true; }
  if (d.change === 'w-tog') { const cur = myWidgets().filter(k => k !== d.k); if (e.target.checked) cur.push(d.k); const order = WIDGETS.map(w => w[0]); save('settings', Object.assign({}, prefs(), { id: 'prefs', widgets: cur.sort((x, y) => order.indexOf(x) - order.indexOf(y)) })); return true; }
  return false;
}

/* ================= v7.1: plans, Google sign-in, passkey first, book ================= */
let BILL = ls.get('mec.bill', null);
async function loadBilling() { try { const s = await api('status'); if (s.billing) { BILL = s.billing; ls.set('mec.bill', BILL); } return s; } catch { return null; } }
const PLAN_ORDER = ['monthly', 'yearly', 'coach'];
const PLAN_POINTS = { monthly: ['Everything in ME.Coach', 'Cancel any time'], yearly: ['Everything in ME.Coach', 'About 30% cheaper than monthly', 'Best for a full year of cycles'], coach: ['Everything in Pro', 'A monthly 1:1 session with Milad', 'Plan and Wheel review every month'] };
const curPref = () => (Intl.DateTimeFormat().resolvedOptions().timeZone || '').startsWith('Asia/Muscat') || ui.cur === 'omr' ? 'omr' : 'usd';
const priceOf = p => curPref() === 'omr' ? `${p.omr} OMR` : `$${p.usd}`;
function plansHtml(cur) {
  const ps = (BILL && BILL.plans) || {};
  return `<div class="plans">${PLAN_ORDER.filter(k => ps[k]).map(k => { const p = ps[k]; return `<div class="plan-c ${k === 'yearly' ? 'best' : ''}">${k === 'yearly' ? '<span class="pl-tag">Best value</span>' : ''}<b>${esc(p.name)}</b><div class="pl-p">${esc(priceOf(p))}<small> / ${esc(p.per)}</small></div><ul>${(PLAN_POINTS[k] || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul><button class="btn ${k === 'yearly' ? 'primary' : ''} wide" data-act="buy" data-v="${k}" ${cur === p.name ? 'disabled' : ''}>${cur === p.name ? 'Your plan' : 'Choose'}</button></div>`; }).join('')}</div>
  <div class="small" style="text-align:center;margin-top:8px">Prices in ${curPref() === 'omr' ? 'Omani rial' : 'US dollars'} · <a href="#" data-act="cur-swap">show in ${curPref() === 'omr' ? 'USD' : 'OMR'}</a></div>`;
}
async function plansSheet(title) {
  if (!BILL) await loadBilling();
  openSheet(title || 'Choose your plan', `<p class="small" style="margin-top:0">Keep your plan, habits, cycles and insights going. Your data always stays yours.</p>${plansHtml(me && me.planName)}`, '', { noFocus: true, paywall: !!(me && me.access === false) });
}
async function buy(k) {
  if (!BILL) await loadBilling(); const url = BILL && BILL.checkout && BILL.checkout[k];
  if (url) { const q = new URLSearchParams(); if (me && me.email) q.set('checkout[email]', me.email); if (me && me.name) q.set('checkout[name]', me.name); if (me && me.id) q.set('checkout[custom][uid]', me.id); q.set('checkout[custom][plan]', k); window.open(url + (url.includes('?') ? '&' : '?') + q.toString(), '_blank', 'noopener'); toast('Finish the payment in the new tab. Your account updates automatically.'); return; }
  try { await api('pay-request', { body: { plan: k } }); } catch (e) { toast(e.message); return; }
  const p = BILL.plans[k], msg = `Hi Milad, I would like to subscribe to ME.Coach ${p.name} (${priceOf(p)}). My account: ${me ? me.email : ''}`;
  openSheet('Almost there', `<p>Your request for <b>${esc(p.name)}</b> is saved. Complete the payment and your account is activated, usually within a few hours.</p>${BILL.manual ? `<div class="card" style="white-space:pre-wrap" dir="auto">${esc(BILL.manual)}</div>` : ''}
    <div class="btns" style="margin-top:12px">${BILL.whatsapp ? `<a class="btn primary" href="https://wa.me/${esc(BILL.whatsapp.replace(/\D/g, ''))}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp Milad</a>` : ''}<a class="btn ${BILL.whatsapp ? '' : 'primary'}" href="mailto:${esc(BILL.email || 'info@miladebrahimi.me')}?subject=${encodeURIComponent('ME.Coach subscription')}&body=${encodeURIComponent(msg)}">Email</a></div>`, '', { noFocus: true });
}
/* Google Identity Services */
let gisP = null;
function gisLoad() { if (gisP) return gisP; gisP = new Promise((res, rej) => { if (window.google && google.accounts) return res(); const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => res(); s.onerror = () => { gisP = null; rej(new Error('Google is not reachable')); }; document.head.appendChild(s); }); return gisP; }
async function googleButton(el, onCred, text) {
  if (!el) return; if (!BILL) await loadBilling(); const cid = BILL && BILL.google; if (!cid) { el.remove(); return; }
  try { await gisLoad(); google.accounts.id.initialize({ client_id: cid, callback: r => onCred(r.credential), ux_mode: 'popup', auto_select: false });
    el.innerHTML = ''; google.accounts.id.renderButton(el, { theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text: text || 'continue_with', width: Math.min(360, el.clientWidth || 320) });
  } catch { el.remove(); }
}
async function googleSignIn(cred, plan) {
  try { const r = await api('google', { body: { credential: cred, device: device(), name: plan && plan.name } }); signedIn(r, r.created && plan && !plan.skip ? plan : null, r.created); }
  catch (e) { toast(e.message === 'offline' ? 'No connection.' : e.message); }
}
function securePrompt() {
  if (!pkOk() || ui.pkSet) return;
  openSheet('Protect your account', `<div class="pw"><div class="pw-i">🔐</div><p><b>Sign in with Face ID or Touch ID.</b> No password to remember, and nobody else can open your coach.</p></div>`,
    `<button class="btn primary wide" data-act="pk-first">Use Face ID</button><button class="btn ghost wide" data-act="sheet-close">Later</button>`, { noFocus: true });
}
/* the book */
const BOOK_URL = 'api.php?action=book';
function bookCard() {
  if (ui.bookHidden) return '';
  return `<div class="card bookcard"><img src="assets/img/book-3d.png" alt="Self-Coaching Blueprint by Milad Ebrahimi" width="88" height="112" loading="lazy"><div class="main"><div class="small">Free with ME.Coach</div><b>Self-Coaching Blueprint</b><div class="small">The 40-day method behind this app · PDF, 102 pages</div><div class="btns" style="margin-top:8px"><a class="btn small primary" href="${BOOK_URL}" target="_blank" rel="noopener" data-act="book-dl">Download</a><button class="btn small ghost" data-act="book-hide">Hide</button></div></div></div>`;
}
async function adminConfig() {
  const box = $('#adcfg'); if (!box) return;
  try { const r = await api('admin-config'); const c = r.config; if (!$('#adcfg')) return;
    box.innerHTML = `<h2>Payments and sign-in</h2><div class="small" style="margin-bottom:10px">Book downloads: <b>${r.bookDownloads}</b></div>
    <div class="f"><label>Google sign-in Client ID</label><input name="googleClientId" value="${esc(c.googleClientId)}" placeholder="1234-abc.apps.googleusercontent.com"></div>
    ${PLAN_ORDER.map(k => `<div class="f"><label>Checkout link · ${esc((BILL && BILL.plans && BILL.plans[k] || {}).name || k)}</label><input name="co-${k}" type="url" value="${esc((c.checkout || {})[k] || '')}" placeholder="https://… (Lemon Squeezy, Paddle or Thawani link)"></div>`).join('')}
    <div class="f"><label>Lemon Squeezy signing secret ${c.hasSecret ? '(saved)' : ''}</label><input name="lsSecret" type="password" placeholder="${c.hasSecret ? 'Leave empty to keep · type - to remove' : 'From Settings → Webhooks'}" autocomplete="off"></div>
    <div class="small" style="margin:-4px 0 10px">Webhook URL for Lemon Squeezy: <code>${esc(r.webhook)}</code></div>
    <div class="f"><label>Manual payment instructions (bank transfer, Thawani link…)</label><textarea name="manualText" rows="4" dir="auto">${esc(c.manualText)}</textarea></div>
    <div class="fgrid"><div class="f"><label>WhatsApp number</label><input name="whatsapp" value="${esc(c.whatsapp)}" placeholder="+968…"></div><div class="f"><label>Contact email</label><input name="contactEmail" type="email" value="${esc(c.contactEmail)}" placeholder="info@miladebrahimi.me"></div></div>
    <button class="btn primary" data-act="adcfg-save">Save</button>
    ${(r.log || []).length ? `<h2 style="margin-top:14px">Payment events</h2><div class="list">${r.log.slice().reverse().map(l => `<div class="row"><div class="main"><div class="t">${esc(l.event)}</div><div class="m"><span>${esc(l.user)}</span><span>${esc(l.at.slice(0, 16).replace('T', ' '))}</span>${l.until ? `<span>until ${esc(l.until)}</span>` : ''}</div></div></div>`).join('')}</div>` : ''}`;
  } catch (e) { box.textContent = e.message; }
}
function v71Acts(a, id) {
  return {
    plans: () => plansSheet(), buy: () => buy(a.dataset.v),
    'cur-swap': () => { ui.cur = curPref() === 'omr' ? 'usd' : 'omr'; saveUi(); const b = sheetCtx && sheetCtx.el && sheetCtx.el.querySelector('.sheet-b'); if (b) b.innerHTML = `<p class="small" style="margin-top:0">Keep your plan, habits, cycles and insights going. Your data always stays yours.</p>${plansHtml(me && me.planName)}`; },
    'pk-first': async () => { closeSheet(true); await pkRegister(); },
    'book-hide': () => { ui.bookHidden = true; saveUi(); render(); },
    'book-dl': () => {},
    'adcfg-save': async () => { const box = $('#adcfg'), v = n => (box.querySelector(`[name="${n}"]`) || {}).value || '';
      try { await api('admin-config', { body: { googleClientId: v('googleClientId').trim(), checkout: Object.fromEntries(PLAN_ORDER.map(k => [k, v('co-' + k).trim()])), lsSecret: v('lsSecret'), manualText: v('manualText'), whatsapp: v('whatsapp'), contactEmail: v('contactEmail') } }); toast('Saved'); BILL = null; ls.del('mec.bill'); loadBilling(); adminConfig(); } catch (e) { toast(e.message); } }
  };
}

/* ================= v8: Emi guide, Discover (tests + pack + career), Life hub, micro-actions, grouped navigation ================= */
Object.assign(I, {
  wheel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 15l-3-3c1-4 5-9 12-9 0 7-5 11-9 12z"/><circle cx="14.5" cy="9.5" r="1.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/></svg>'
});
const paid = () => !!me && (me.plan === 'owner' || me.plan === 'active');
const jsLoads = {};
function loadJs(src) { if (jsLoads[src]) return jsLoads[src]; jsLoads[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src + '?v=' + VERSION; s.onload = () => res(); s.onerror = () => { delete jsLoads[src]; rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); }); return jsLoads[src]; }
const needTests = () => window.MEC_TESTS ? Promise.resolve() : loadJs('assets/tests-data.js');
const needCareers = () => window.MEC_CAREERS ? Promise.resolve() : loadJs('assets/career-data.js');
const needEmi = () => window.Emi ? Promise.resolve() : loadJs('assets/vendor/three.min.js').then(() => loadJs('assets/emi.js'));
const AREA_EMOJI = { 'Career': '💼', 'Money': '💰', 'Health': '💪', 'Family': '🏠', 'Relationships': '🤝', 'Personal growth': '🌱', 'Fun & recreation': '🎈', 'Home & environment': '🪴' };
const areaEmoji = a => AREA_EMOJI[a && a.title] || '◎';
const areaByName = n => areas().find(a => a.title === n) || null;

/* ---------- Emi: floating guide ---------- */
let emiInst = null, emiReactAt = 0;
const emiAllowed = () => !ui.emiOff && (!navigator.webdriver || ui.emiForce) && !(window.matchMedia && matchMedia('(max-width: 340px)').matches);
function emiDock() {
  let d = $('#emi-dock');
  if (!emiAllowed() || !ls.get(K.tok)) { if (d) { if (emiInst) emiInst.destroy(); emiInst = null; d.remove(); } return; }
  if (d) return;
  d = document.createElement('div'); d.id = 'emi-dock'; d.innerHTML = '<div class="emi-stage"></div><button class="emi-more" data-act="emi-sheet" aria-label="Talk to Emi">…</button>'; document.body.appendChild(d);
  needEmi().then(() => {
    if (!window.Emi || !Emi.supported()) { d.classList.add('emi-flat'); return; }
    emiInst = Emi.mount(d.querySelector('.emi-stage'), { fps: 30, zoom: 6.8, onTap: () => emiTalk() });
    if (!emiInst) { d.classList.add('emi-flat'); return; }
    const h = new Date().getHours(); setTimeout(() => { if (!emiInst) return; if (h >= 23 || h < 5) emiInst.play('sleep'); else { emiInst.play('wave'); emiInst.say(emiGreeting(), 5200); } }, 900);
  }).catch(() => d.classList.add('emi-flat'));
}
function emiGreeting() { const h = new Date().getHours(), nm = me && me.name ? me.name.split(' ')[0] : ''; return (h < 12 ? 'Good morning' : h < 18 ? 'Hi' : 'Good evening') + (nm ? ', ' + nm : '') + '! ' + (coachMsgs()[slotOf(h)] || '').split('. ')[0] + '.'; }
function emiTalk() { if (!emiInst) return; const tips = emiTips(); const t = tips[Math.floor(Math.random() * Math.min(3, tips.length))]; emiInst.say(t ? t[0] : coachMsgs()[slotOf(new Date().getHours())]); }
function emiTips() {
  const t = today(), out = [], mlog = list('logs').find(l => l.type === 'morning' && l.date === t), done = id => list('tests').some(x => x.test === id);
  if (!mlog && new Date().getHours() < 14) out.push(['Psst… one minute of Morning Balance and your day plans itself. Almost. ☀', 'morning', 'Start Morning Balance']);
  if (!wheels().length) out.push(['Want to see your life as a wheel? The book test is my favourite thing ever. 📘', 'wheel-test', 'Take the Wheel test']);
  const m = microToday()[0]; if (m) out.push([`Tiny step for today: ${m.t}. You’ve got this!`, 'go', 'Open Life', 'life']);
  if (paid() && !done('disc')) out.push(['Want to know your communication style? Try the DISC test.', 'test-start', 'Start DISC', 'disc']);
  else if (paid() && !done('riasec')) out.push(['Your career interests unlock the Career explorer.', 'test-start', 'Start Career interests', 'riasec']);
  else if (!paid()) out.push(['The personality tests and your self-knowledge pack come with a plan.', 'plans', 'See plans']);
  const low = areas().filter(a => areaScore(a.id) != null).sort((a, b) => areaScore(a.id) - areaScore(b.id))[0]; if (low) out.push([`${low.title} needs you most right now (${areaScore(low.id)}/10). One small action today?`, 'go', 'Open ' + low.title, 'area/' + encodeURIComponent(low.id)]);
  if (new Date().getHours() >= 19) out.push(['Let’s close the day together. One minute, then rest. 🌙', 'closeout', 'Night Balance']);
  out.push([coachMsgs()[slotOf(new Date().getHours())], 'go', 'Open Today', 'today']);
  return out;
}
function emiSheet() {
  const tips = emiTips();
  openSheet('Emi · your guide', `<div class="emi-sh"><div class="emi-sh-stage" id="emi-sh-stage"></div><div class="main"><b>Hi, I’m Emi! 👋</b><p class="small">Your slightly goofy, always-on-your-side guide. I cheer, I nudge, I tell bad jokes. Tap me any time.</p></div></div>
    <div class="list">${tips.slice(0, 4).map(([t, act, l, arg]) => `<div class="row"><span class="att-i">${I.spark}</span><div class="main"><div class="t" dir="auto">${esc(t)}</div></div><button class="btn small" data-act="${act}" ${act === 'go' ? `data-to="${esc(arg)}"` : arg ? `data-id="${esc(arg)}"` : ''}>${esc(l)}</button></div>`).join('')}</div>
    <div class="btns" style="margin-top:12px"><a class="btn primary" href="#/emi" data-act="sheet-close-go">Meet Emi in 3D</a><button class="btn ghost" data-act="emi-hide">Hide Emi</button></div>`, '', { noFocus: true });
  if (emiInst) emiInst.play('nod');
}
function emiReact(kind, text) {
  if (!emiInst || Date.now() - emiReactAt < 1500) return; emiReactAt = Date.now();
  const map = { habit: 'cheer', task: 'thumbs', morning: 'wave', night: 'nod', test: 'celebrate', calm: 'breathe', focus: 'celebrate', goal: 'think', micro: 'cheer', career: 'surprised' };
  emiInst.play(map[kind] || 'nod'); if (text) emiInst.say(text, 4200);
}
/* react to what the user does, without touching every action */
const _saveV7 = save;
save = function (c, rec) {
  const prev = rec && rec.id && db[c] && db[c][rec.id] ? Object.assign({}, db[c][rec.id]) : null; const r = _saveV7(c, rec);
  try {
    if (c === 'habits' && prev) { const t = today(), was = !!(prev.done || {})[t], now = !!(r.done || {})[t]; if (!was && now) emiReact('habit', `Yes! ${r.title} done. ${habitStreak(r) > 1 ? habitStreak(r) + '-day streak 🔥' : ''}`); }
    else if (c === 'tasks' && prev && !DONE.has(prev.state) && r.state === 'Done') emiReact('task', 'Nice work. One more thing off your list.');
    else if (c === 'logs' && !prev && r.type === 'morning') emiReact('morning', 'Great start. Protect your first block for your Top 3.');
    else if (c === 'logs' && !prev && r.type === 'closeout') emiReact('night', 'Day closed. Rest well, you earned it.');
    else if (c === 'focus' && !prev) emiReact(r.kind === 'calm' ? 'calm' : 'focus', r.kind === 'calm' ? 'Calm and clear. Well done.' : `${r.minutes} focused minutes. Great job!`);
    else if (c === 'goals' && !prev) emiReact('goal', 'New goal! Let’s break it into tiny steps.');
  } catch (e) { }
  return r;
};
function vEmi() {
  setTimeout(() => { const el = $('#emi-big'); if (!el || el.dataset.on) return; el.dataset.on = 1; needEmi().then(() => { if (!$('#emi-big')) return; if (!Emi.supported()) { el.innerHTML = '<div class="empty">3D is not available on this device.</div>'; return; } const x = Emi.mount(el, { orbit: true, zoom: window.innerWidth < 700 ? 7.4 : 6.2, onTap: () => {} }); vEmi.inst = x; if (x) { x.play('wave'); x.say('Hi! Drag me to see me from every side.', 4500); } }); }, 0);
  const acts = [['laugh', 'Laugh'], ['wink', 'Wink'], ['giggle', 'Giggle'], ['hop', 'Hop'], ['heart', 'Love'], ['facepalm', 'Facepalm'], ['yawn', 'Yawn'], ['lookaround', 'Look around'], ['wave', 'Wave'], ['celebrate', 'Celebrate'], ['think', 'Think'], ['dance', 'Dance'], ['shy', 'Shy'], ['surprised', 'Surprised'], ['thumbs', 'Thumbs up'], ['cheer', 'Cheer'], ['stretch', 'Stretch'], ['breathe', 'Breathe'], ['sleep', 'Sleep'], ['point-left', 'Point left'], ['point-right', 'Point right']];
  return header('Meet Emi', 'Your ME.Coach guide') + `<div class="emi-page"><div class="card emi-viewer"><div id="emi-big"></div><div class="emi-views">${[['front', 'Front'], ['three', '¾'], ['right', 'Right'], ['back', 'Back'], ['left', 'Left'], ['top', 'Top']].map(([k, l]) => `<button data-act="emi-view" data-v="${k}">${l}</button>`).join('')}<button data-act="emi-spin">Turntable</button></div></div>
  <div class="card"><h2>Make Emi move</h2><div class="emi-acts">${acts.map(([k, l]) => `<button class="btn small" data-act="emi-play" data-v="${k}">${l}</button>`).join('')}</div>
  <h2 style="margin-top:16px">About Emi</h2><p class="small">Emi lives in the corner of your app. Emi waves in the morning, cheers when you keep a habit, breathes with you in Calm, celebrates finished tests and suggests your next tiny step. Tap Emi for a tip; drag here to see every side.</p>
  <div class="btns"><button class="btn" data-act="emi-toggle">${ui.emiOff ? 'Show Emi in the app' : 'Hide Emi in the app'}</button></div></div></div>`;
}

/* ---------- micro-actions (tiny steps for every goal) ---------- */
const MICRO_TPL = {
  'Career': ['Write the next tiny step for “{g}”', 'Send one message that moves “{g}” forward', 'Spend 10 minutes learning a skill for “{g}”', 'Add one line to your CV or LinkedIn', 'Block 25 minutes tomorrow for “{g}”', 'Ask one person for advice on “{g}”'],
  'Money': ['Check today’s spending in 2 minutes', 'Move a small amount to savings', 'Cancel one subscription you don’t use', 'Write one idea to earn more for “{g}”', 'Update your savings number'],
  'Health': ['Walk for 10 minutes', 'Drink a glass of water now', 'Do 10 squats or push-ups', 'Go to bed 15 minutes earlier', 'Stretch for 3 minutes', 'Plan one healthy meal for tomorrow'],
  'Family': ['Call or message a family member', 'Plan one family activity this week', 'Ask someone at home how their day was', 'Put your phone away during one meal'],
  'Relationships': ['Send a thank-you message', 'Check in on a friend', 'Give one sincere compliment', 'Plan a coffee with someone you miss'],
  'Personal growth': ['Read 10 pages', 'Write 3 lines in your journal', 'Watch one 10-minute lesson for “{g}”', 'Practise “{g}” for 15 minutes', 'Reflect: what did I learn today?'],
  'Fun & recreation': ['Do something fun for 15 minutes', 'Plan one adventure this month', 'Play, draw or make music for 10 minutes', 'Spend time outside without your phone'],
  'Home & environment': ['Tidy one small surface', 'Clear 10 items you don’t need', 'Fix one small thing at home', 'Prepare tomorrow’s clothes and bag'],
  default: ['Write the next tiny step for “{g}”', 'Spend 10 minutes on “{g}”', 'Tell someone about “{g}”']
};
function goalMicros(g) {
  const own = (g.micro || []).filter(Boolean); const a = goalArea(g), tpl = (MICRO_TPL[a && a.title] || MICRO_TPL.default).map(x => x.replace(/\{g\}/g, String(g.title || '').slice(0, 60)));
  return own.length ? own : tpl;
}
const dayIdx = () => Math.floor(Date.parse(today()) / 864e5);
function microToday() {
  const gs = list('goals').filter(g => !['Done', 'Achieved', 'Dropped', 'Cancelled'].includes(g.status)).sort((a, b) => (areaScore((goalArea(a) || {}).id) ?? 10) - (areaScore((goalArea(b) || {}).id) ?? 10)).slice(0, 3);
  return gs.map(g => { const ms = goalMicros(g), shift = Number((g.microShift || {})[today()]) || 0, t = ms[(dayIdx() + shift) % ms.length]; return { g, t, done: !!(g.microDone || {})[today()] }; });
}
function microCard() {
  const ms = microToday(); if (!ms.length) return '';
  return `<div class="card microcard"><h2>${I.bolt} Tiny steps today <span class="count">${ms.filter(m => m.done).length}/${ms.length}</span><span style="flex:1"></span><a class="btn small ghost" href="#/life">Life</a></h2><div class="list">${ms.map(m => { const a = goalArea(m.g); return `<div class="row micro ${m.done ? 'done' : ''}" style="--ac:${a ? areaColor(a) : 'var(--line)'}"><button class="check ${m.done ? 'done' : ''}" data-act="micro-done" data-id="${esc(m.g.id)}" aria-label="Done">${I.tick}</button><div class="main"><div class="t" dir="auto">${esc(m.t)}</div><div class="m"><span>${areaEmoji(a)} ${esc(a ? a.title : 'Goal')}</span><span dir="auto">${esc(m.g.title)}</span></div></div>${m.done ? '' : `<button class="icon-btn" data-act="micro-shuffle" data-id="${esc(m.g.id)}" aria-label="Another step" title="Another step">↻</button>`}</div>`; }).join('')}</div></div>`;
}
function goalMicroCard(id) {
  const g = get('goals', id); if (!g) return '';
  const ms = goalMicros(g), log = Object.entries(g.microDone || {}).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
  return `<div class="card"><h2>${I.bolt} Micro-actions <span class="count">${ms.length}</span><span style="flex:1"></span><button class="btn small ghost" data-act="micro-add" data-id="${esc(id)}">${I.plus} Add</button></h2>
  <p class="small" style="margin-top:-4px">Steps of 2 to 15 minutes. One shows on Today each day${(g.micro || []).length ? '' : '. These are suggestions for this area; add your own to replace them'}.</p>
  <div class="list">${ms.map((t, i) => `<div class="row"><span class="mnum">${i + 1}</span><div class="main"><div class="t" dir="auto">${esc(t)}</div></div>${(g.micro || []).length ? `<button class="icon-btn" data-act="micro-del" data-id="${esc(id)}" data-i="${i}" aria-label="Remove">${I.close}</button>` : ''}</div>`).join('')}</div>
  ${log.length ? `<div class="small" style="margin-top:10px">Done recently: ${log.map(([d]) => esc(fmtDate(d))).join(' · ')}</div>` : ''}</div>`;
}
const _vGoalV7 = vGoal;
vGoal = id => _vGoalV7(id) + goalMicroCard(id);

/* ---------- Life: the 8 areas ---------- */
function vLife() {
  const as = areas(), w = wheels()[0], prev = wheels()[1], sc = as.map(a => areaScore(a.id)).filter(x => x != null), avg = sc.length ? Math.round(10 * sc.reduce((s, x) => s + x, 0) / sc.length) / 10 : null;
  if (!as.length) return header('Life', 'Your 8 areas of life') + `<div class="card empty">Set up your Wheel of Life to see your areas.<div class="btns" style="justify-content:center;margin-top:10px"><button class="btn primary" data-act="wheel-start">Set up</button></div></div>`;
  const ms = microToday(), habs = list('habits');
  const card = a => { const s = areaScore(a.id), ps = prev ? areaScore(a.id, prev) : null, gs = list('goals').filter(g => goalArea(g) && goalArea(g).id === a.id && !['Done', 'Achieved', 'Dropped'].includes(g.status)), hs = habs.filter(h => h.areaId === a.id || gs.some(g => g.id === h.goalId)), m = ms.find(x => goalArea(x.g) && goalArea(x.g).id === a.id), tr = s != null && ps != null ? r2(s - ps) : 0;
    return `<a class="acard" href="#/area/${encodeURIComponent(a.id)}" style="--ac:${areaColor(a)}"><div class="ac-top"><span class="ac-e">${areaEmoji(a)}</span><b dir="auto">${esc(a.title)}</b><span class="ac-s">${s ?? '–'}<small>/10</small>${tr ? `<i class="${tr > 0 ? 'up' : 'dn'}">${tr > 0 ? '▲' : '▼'}${Math.abs(tr)}</i>` : ''}</span></div>
    <div class="ac-bar"><i style="width:${(s || 0) * 10}%"></i><em style="left:${areaTarget(a) * 10}%"></em></div>
    <div class="ac-m"><span>${gs.length} goal${gs.length === 1 ? '' : 's'}</span><span>${hs.length} habit${hs.length === 1 ? '' : 's'}</span></div>
    ${m ? `<div class="ac-micro ${m.done ? 'done' : ''}">${m.done ? '✓' : I.bolt} <span dir="auto">${esc(m.t)}</span></div>` : gs.length ? '' : '<div class="ac-micro empty">No goal yet · add one</div>'}</a>`; };
  const tools = [['progress', 'p-tab', 'goals', I.flag, 'Goals'], ['habits', 'go', 'habits', I.repeat, 'Habits'], ['progress', 'p-tab', 'overview', I.prog, '40-day cycle'], ['progress', 'p-tab', 'roadmap', I.plan, 'Roadmap'], ['progress', 'p-tab', 'insights', I.health, 'Insights'], ['progress', 'p-tab', 'learning', I.course, 'Learning'], ['progress', 'p-tab', 'money', I.money, 'Money']];
  return header('Life', avg != null ? `Balance ${avg}/10 · ${w ? 'tested ' + fmtDate(w.date, true) : ''}` : 'Your 8 areas of life') + `
  <div class="life-hero card"><div class="lh-w" data-act="p-tab" data-t="wheel" role="button">${w ? wheelSvg(w, prev, { size: 260, labels: false }) : ''}</div><div class="main"><div class="small">Wheel of Life</div><div class="lh-n">${avg ?? '–'}<small>/10</small></div>
    ${sc.length ? (() => { const srt = as.filter(a => areaScore(a.id) != null).sort((a, b) => areaScore(b.id) - areaScore(a.id)); return `<div class="lh-g"><span>Strongest <b style="color:${areaColor(srt[0])}">${esc(srt[0].title)}</b></span><span>Needs you <b style="color:${areaColor(srt[srt.length - 1])}">${esc(srt[srt.length - 1].title)}</b></span></div>`; })() : ''}
    <div class="btns" style="margin-top:10px"><button class="btn primary small" data-act="wheel-test">Retake the test</button><button class="btn small" data-act="new-goal">${I.plus} Goal</button></div></div></div>
  ${microCard()}
  <div class="agrid">${as.map(card).join('')}</div>
  <h2 class="sec-h">Tools for your areas</h2><div class="tiles2">${tools.map(([pg, act, t, ic, l]) => `<button class="tile2" data-act="${act}" ${act === 'go' ? `data-to="${t}"` : `data-t="${t}"`}><span>${ic}</span>${l}</button>`).join('')}</div>`;
}
const _vAreaV7 = vArea;
vArea = id => {
  const a = get('areas', id); let extra = '';
  if (a) {
    const hs = list('habits').filter(h => h.areaId === id), tm = testMicros().filter(m => m[0] === a.title);
    extra = `<div class="card"><h2>${I.repeat} Habits <span class="count">${hs.length}</span><span style="flex:1"></span><button class="btn small ghost" data-act="new-habit-area" data-id="${esc(id)}">${I.plus} Habit</button></h2>${hs.length ? `<div class="list">${hs.map(h => `<div class="row" data-act="habit-open" data-id="${esc(h.id)}"><div class="main"><div class="t" dir="auto">${esc(h.title)}</div><div class="m"><span>🔥 ${habitStreak(h)}</span></div></div></div>`).join('')}</div>` : '<div class="empty">Link a habit to this area to see it here.</div>'}</div>
    ${tm.length ? `<div class="card"><h2>${I.spark} From your tests</h2><div class="list">${tm.map(m => microRow(m)).join('')}</div></div>` : ''}`;
  }
  return _vAreaV7(id) + extra;
};

/* ---------- Discover: tests, pack, career ---------- */
const testsDone = () => { const o = {}; list('tests').sort((a, b) => String(a.date + a.createdAt).localeCompare(String(b.date + b.createdAt))).forEach(r => { o[r.test] = r; }); return o; };
function testMicros() { if (!window.MEC_TESTS) return []; const d = testsDone(), out = []; Object.values(d).forEach(r => { try { const rep = MEC_TESTS.report(r.test, r.result); rep.micro.forEach(m => out.push([m[0], m[1], r.test])); } catch (e) { } }); return out; }
function microRow(m) { const a = areaByName(m[0]); return `<div class="row"><span class="att-i" style="color:${a ? areaColor(a) : 'inherit'}">${AREA_EMOJI[m[0]] || '◎'}</span><div class="main"><div class="t" dir="auto">${esc(m[1])}</div><div class="m"><span>${esc(m[0])}</span></div></div><div class="btns"><button class="btn small" data-act="micro-task" data-v="${esc(m[1])}" data-a="${esc(m[0])}">Today</button><button class="btn small ghost" data-act="micro-habit" data-v="${esc(m[1])}" data-a="${esc(m[0])}">Habit</button></div></div>`; }
function vDiscover() {
  if (!window.MEC_TESTS) { needTests().then(render); return header('Discover', 'Know yourself') + '<div class="card empty">Loading…</div>'; }
  const T = MEC_TESTS, d = testsDone(), n = T.order.filter(k => d[k]).length, lock = !paid();
  const cats = [...new Set(T.order.map(k => T.tests[k].cat))];
  const tile = k => { const t = T.tests[k], r = d[k]; let chip = ''; if (r) { try { chip = T.report(k, r.result).chips[0]; } catch (e) { } }
    return `<button class="tcard ${r ? 'done' : ''}" style="--tc:${t.color}" data-act="${lock ? 'plans' : r ? 'go' : 'test-start'}" ${r && !lock ? `data-to="test/${k}"` : `data-id="${k}"`}><span class="tc-i">${t.icon}</span><b>${esc(t.name)}</b><span class="small">${esc(t.short)}</span><span class="tc-f">${lock ? `${I.lock} With a plan` : r ? `<span class="chip">${esc(chip)}</span> Result` : `${t.mins} min · Start`}</span></button>`; };
  return header('Discover', 'Know yourself. Know others. Choose your path.') + `
  <div class="card packcard"><div class="pk-l"><div class="small">Your self-knowledge pack</div><b>${n ? `${n} of ${T.order.length} tests done` : 'Take your first test'}</b><div class="bar" style="margin:8px 0"><i style="width:${Math.round(100 * n / T.order.length)}%"></i></div><p class="small">Every test adds to one personal pack: who you are, how you work, how to deal with others and tiny steps for each life area.</p>
    <div class="btns"><a class="btn primary" href="#/me">${I.user} Open my pack</a>${lock ? `<button class="btn" data-act="plans">${I.lock} Unlock all tests</button>` : ''}</div></div><div class="pk-r">${T.order.map(k => `<i style="background:${d[k] ? T.tests[k].color : 'var(--paper-dim)'}" title="${esc(T.tests[k].name)}"></i>`).join('')}</div></div>
  <a class="card careerbanner" href="#/career"><div class="main"><span class="small">New</span><b>Career explorer</b><p class="small">Turn your experience into skills, see the careers that fit you on a map, and make the best one your next goal.</p></div><span class="cb-art">${I.compass}</span></a>
  ${cats.map(c => `<h2 class="sec-h">${esc(c)}</h2><div class="tgrid">${T.order.filter(k => T.tests[k].cat === c).map(tile).join('')}${c === 'Wellbeing' ? `<button class="tcard" style="--tc:#2a78d6" data-act="wheel-test"><span class="tc-i">◎</span><b>Wheel of Life</b><span class="small">Balance across your 8 areas</span><span class="tc-f">2 min · Free</span></button>` : ''}</div>`).join('')}
  <p class="small" style="margin-top:16px">These tests are tools for reflection, written for ME.Coach and based on well-known public models. They are not clinical or hiring assessments.</p>`;
}
/* test runner */
let trun = null, trEmi = null;
function testStart(id) {
  if (!paid()) { plansSheet('Unlock the tests'); return; }
  needTests().then(() => {
    const t = MEC_TESTS.tests[id]; if (!t) return; if (sheetCtx) closeSheet(true);
    const dr = (ui.tdraft || {})[id]; trun = { id, i: dr && dr.a ? Math.min(dr.i, t.items.length - 1) : 0, a: dr && dr.a ? dr.a.slice() : [] };
    let el = $('#trun'); if (!el) { el = document.createElement('div'); el.id = 'trun'; document.body.appendChild(el); }
    el.style.setProperty('--tc', t.color);
    el.innerHTML = `<div class="tr-top"><button class="icon-btn" data-act="tr-close" aria-label="Close">${I.close}</button><div class="tr-bar"><i></i></div><span class="tr-n small"></span></div><div class="tr-body"><div class="tr-emi"></div><div class="tr-q"></div></div>`;
    trDraw(); if (emiAllowed()) needEmi().then(() => { const st = $('#trun .tr-emi'); if (st && Emi.supported()) { trEmi = Emi.mount(st, { fps: 30, zoom: 6.6 }); if (trEmi) { trEmi.play('wave'); trEmi.say(dr && dr.a && dr.a.length ? 'Welcome back! Let’s continue.' : `Let’s do ${t.name}. Answer with your first instinct.`, 4000); } } }).catch(() => { });
  });
}
function trDraw() {
  const t = MEC_TESTS.tests[trun.id], it = t.items[trun.i], n = t.items.length, el = $('#trun'); if (!el) return;
  el.querySelector('.tr-bar i').style.width = Math.round(100 * trun.i / n) + '%'; el.querySelector('.tr-n').textContent = `${trun.i + 1} / ${n}`;
  const cur = trun.a[trun.i];
  el.querySelector('.tr-q').innerHTML = `<div class="small tr-k">${esc(t.name)}</div>` + (t.kind === 'pair'
    ? `<h2 dir="auto">${esc(it[0])}</h2><div class="tr-pair">${[it[1], it[2]].map((x, v) => `<button class="${cur === v ? 'on' : ''}" data-act="tr-ans" data-v="${v}">${esc(x)}</button>`).join('')}</div>`
    : `<h2 dir="auto">${esc(it[0])}</h2><div class="tr-lik">${t.scale.map((x, v) => `<button class="${cur === v ? 'on' : ''}" data-act="tr-ans" data-v="${v}"><i style="--s:${.55 + v * .12}"></i><span>${esc(x)}</span></button>`).join('')}</div>`)
    + `<div class="tr-nav">${trun.i ? `<button class="btn ghost small" data-act="tr-back">${I.left} Back</button>` : '<span></span>'}<span class="small">${esc(t.about.split('.')[0])}.</span></div>`;
}
function trAnswer(v) {
  const t = MEC_TESTS.tests[trun.id], n = t.items.length; trun.a[trun.i] = v; trun.i++;
  ui.tdraft = Object.assign({}, ui.tdraft, { [trun.id]: { i: trun.i, a: trun.a } }); saveUi();
  if (trEmi) { if (trun.i === Math.floor(n / 2)) { trEmi.play('cheer'); trEmi.say('Halfway there!', 2200); } else if (trun.i % 6 === 0) trEmi.play(['nod', 'thumbs', 'listen'][trun.i % 3]); }
  if (trun.i >= n) return trFinish(); trDraw();
}
function trFinish() {
  const id = trun.id, r = MEC_TESTS.score(id, trun.a); save('tests', { test: id, date: today(), answers: trun.a, result: r });
  const d = Object.assign({}, ui.tdraft); delete d[id]; ui.tdraft = d; saveUi();
  if (trEmi) { trEmi.play('celebrate'); trEmi.say('Done! Here is what I found.', 2500); }
  setTimeout(() => { trClose(); location.hash = '#/test/' + id; celebrate(); }, 1400);
}
function trClose() { if (trEmi) { trEmi.destroy(); trEmi = null; } const el = $('#trun'); if (el) el.remove(); trun = null; }
function testBars(t, r) {
  const T = MEC_TESTS;
  if (t.kind === 'pair') return `<div class="tbars">${['EI', 'SN', 'TF', 'JP'].map(d => { const p = r.pct[d]; return `<div class="tb2"><span class="${p >= 50 ? 'on' : ''}">${esc(t.letters[d[0]][0])}</span><div class="tb2-b"><i style="width:${p}%"></i></div><span class="${p < 50 ? 'on' : ''}">${esc(t.letters[d[1]][0])}</span><b>${p >= 50 ? p : 100 - p}%</b></div>`; }).join('')}</div>`;
  const lab = k => t.results && t.results[k] ? (Array.isArray(t.results[k]) ? (t.id === 'ennea' ? `${k} · ${t.results[k][0]}` : t.results[k][0]) : t.results[k].name) : t.traits ? t.traits[k][0] : k === 'EN' ? 'Energy' : k;
  return `<div class="tbars">${r.top.map(k => `<div class="tb"><span dir="auto">${esc(lab(k))}</span><div class="tb-b"><i style="width:${r.pct[k]}%"></i></div><b>${r.pct[k]}%</b></div>`).join('')}</div>`;
}
function vTest(id) {
  if (!window.MEC_TESTS) { needTests().then(render); return header('Result', '') + '<div class="card empty">Loading…</div>'; }
  const t = MEC_TESTS.tests[id], d = testsDone()[id]; if (!t) return header('Not found', '') + '<div class="card empty">Unknown test.</div>';
  if (!d) return header(t.name, t.short) + `<div class="card"><p>${esc(t.about)}</p><button class="btn primary" data-act="test-start" data-id="${id}">Start · ${t.mins} min</button></div>`;
  const R = MEC_TESTS.report(id, d.result), hist = list('tests').filter(x => x.test === id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return header(t.name, 'Taken ' + fmtDate(d.date, true)) + `
  <div class="card thero" style="--tc:${t.color}"><span class="th-i">${t.icon}</span><div class="small">${esc(R.tag)}</div><h2 class="th-t" dir="auto">${esc(R.title)}</h2><p dir="auto">${esc(R.summary)}</p></div>
  <div class="card" style="--tc:${t.color}"><h2>Your scores</h2>${testBars(t, d.result)}<p class="small" style="margin-top:8px">${esc(t.about)}</p></div>
  ${R.blocks.map(([h, items]) => `<div class="card"><h2>${esc(h)}</h2><ul class="tlist">${items.map(x => `<li dir="auto">${esc(x)}</li>`).join('')}</ul></div>`).join('')}
  ${R.others.length ? `<div class="card"><h2>${I.users} Working with others</h2><div class="list">${R.others.map(([k, v]) => `<div class="row"><div class="main"><div class="t">${esc(k)}</div><div class="m"><span dir="auto">${esc(v)}</span></div></div></div>`).join('')}</div></div>` : ''}
  <div class="card"><h2>${I.bolt} Tiny steps for your life areas</h2><div class="list">${R.micro.map(m => microRow(m)).join('')}</div></div>
  <div class="btns" style="margin:4px 0 14px"><a class="btn primary" href="#/me">${I.user} My full pack</a><button class="btn" data-act="test-start" data-id="${id}">Retake</button>${id === 'riasec' ? `<a class="btn" href="#/career">${I.compass} Career explorer</a>` : ''}</div>
  ${hist.length > 1 ? `<div class="small">Earlier: ${hist.slice(1, 5).map(h => { let c = ''; try { c = MEC_TESTS.report(id, h.result).chips[0]; } catch (e) { } return esc(fmtDate(h.date) + ' ' + c); }).join(' · ')}</div>` : ''}`;
}
/* the self-knowledge pack */
function vMe() {
  if (!window.MEC_TESTS || !window.MEC_CAREERS) { Promise.all([needTests(), needCareers()]).then(render); return header('My pack', '') + '<div class="card empty">Loading…</div>'; }
  const T = MEC_TESTS, d = testsDone(), got = T.order.filter(k => d[k]), rep = k => T.report(k, d[k].result);
  if (!got.length) return header('My pack', 'Your self-knowledge pack') + `<div class="card empty">Take a test in Discover and your pack starts here.<div class="btns" style="justify-content:center;margin-top:10px"><a class="btn primary" href="#/discover">Go to Discover</a></div></div>`;
  const chips = got.flatMap(k => rep(k).chips.map(c => [T.tests[k].color, T.tests[k].name, c]));
  const disc = d.disc && rep('disc'), types = d.types && rep('types'), riasec = d.riasec && rep('riasec');
  const talk = [disc && T.tests.disc.results[d.disc.result.top[0]].talk, types && (d.types.result.type[0] === 'I' ? 'Give me time to think before I answer.' : 'I think out loud; talking it through helps me.'), d.conflict && `In disagreements I tend to ${T.tests.conflict.results[d.conflict.result.top[0]][0].toLowerCase()}.`].filter(Boolean);
  const works = [disc && T.tests.disc.results[d.disc.result.top[0]].work, types && types.blocks[0][1][0], d.big5 && rep('big5').blocks[0][1][1]].filter(Boolean);
  const others = [].concat(disc ? disc.others : [], d.conflict ? rep('conflict').others.slice(0, 5) : []);
  const fit = riasec ? careerRank(careerProfile(), riasec.code).slice(0, 5) : [];
  const micros = testMicros(), byArea = T.areas.map(a => [a, micros.filter(m => m[0] === a)]).filter(x => x[1].length);
  const nm = me && me.name || 'Me';
  return header('My pack', 'Your self-knowledge pack') + `
  <div class="card mehero"><div class="mh-av">${esc(nm.slice(0, 1).toUpperCase())}</div><div class="main"><b dir="auto">${esc(nm)}</b><div class="mh-chips">${chips.map(([c, n, v]) => `<span class="mchip" style="--tc:${c}" title="${esc(n)}">${esc(v)}</span>`).join('')}</div><div class="small">${got.length} of ${T.order.length} tests · updated ${esc(fmtDate(Object.values(d).map(x => x.date).sort().pop(), true))}</div></div><button class="btn small" data-act="print-pack">PDF</button></div>
  <div class="card"><h2>${I.user} Who you are</h2><div class="list">${got.map(k => { const r = rep(k); return `<a class="row" href="#/test/${k}"><span class="att-i" style="color:${T.tests[k].color}">${T.tests[k].icon}</span><div class="main"><div class="t">${esc(T.tests[k].name)} · <span dir="auto">${esc(r.title)}</span></div><div class="m"><span dir="auto">${esc(r.summary).slice(0, 220)}</span></div></div></a>`; }).join('')}</div></div>
  ${works.length ? `<div class="card"><h2>${I.rocket} How you work best</h2><ul class="tlist">${works.map(x => `<li dir="auto">${esc(x)}</li>`).join('')}</ul></div>` : ''}
  ${talk.length ? `<div class="card talkcard"><h2>${I.users} How to talk to me</h2><ul class="tlist">${talk.map(x => `<li dir="auto">${esc(x)}</li>`).join('')}</ul><button class="btn small" data-act="copy" data-text="${esc('How to work with ' + nm + ':\n- ' + talk.join('\n- '))}">Copy to share with your team</button></div>` : ''}
  ${others.length ? `<div class="card"><h2>${I.users} Dealing with other people</h2><div class="list">${others.map(([k, v]) => `<div class="row"><div class="main"><div class="t">${esc(k)}</div><div class="m"><span dir="auto">${esc(v)}</span></div></div></div>`).join('')}</div></div>` : ''}
  ${d.values ? `<div class="card"><h2>${I.star} What drives you</h2><p dir="auto">${esc(rep('values').summary)}</p>${d.ennea ? `<p dir="auto">${esc(rep('ennea').summary)}</p>` : ''}</div>` : ''}
  ${fit.length ? `<div class="card"><h2>${I.compass} Career fit · code ${esc(riasec.code)}</h2><div class="list">${fit.map(c => `<a class="row" href="#/career/${c.id}"><div class="main"><div class="t">${esc(c.title)}</div><div class="bar thin" style="margin-top:6px"><i style="width:${c.match}%;background:${MEC_CAREERS.FAM[c.fam][1]}"></i></div></div><b class="small">${c.match}%</b></a>`).join('')}</div><a class="btn small" href="#/career" style="margin-top:8px">Open the Career explorer</a></div>` : ''}
  <div class="card"><h2>${I.wheel} Your growth plan across the 8 areas</h2>${byArea.length ? byArea.map(([a, ms]) => `<div class="pk-area"><div class="pk-ah">${AREA_EMOJI[a] || ''} <b>${esc(a)}</b>${areaByName(a) && areaScore(areaByName(a).id) != null ? `<span class="chip">${areaScore(areaByName(a).id)}/10</span>` : ''}</div><div class="list">${ms.map(m => microRow(m)).join('')}</div></div>`).join('') : '<div class="empty">Take more tests to fill your growth plan.</div>'}</div>
  <p class="small">Based on your answers. Use it as a mirror for reflection; people grow and change.</p>`;
}

/* ---------- Career explorer ---------- */
const careerProfile = () => get('careers', 'profile') || { id: 'profile', roles: [], exps: [], skills: [], wants: [], edu: '', saved: [] };
function careerSkills(p) {
  const C = MEC_CAREERS, w = {}; const add = (ids, n) => ids.forEach(s => { w[s] = (w[s] || 0) + n; });
  (p.roles || []).forEach(r => { const R = C.ROLES.find(x => x[0] === r); if (R) add(R[1], 2); });
  (p.exps || []).forEach(r => { const E = C.EXPS.find(x => x[0] === r); if (E) add(E[1], 1); });
  add(p.skills || [], 2); (p.off || []).forEach(s => { if (!(p.skills || []).includes(s)) delete w[s]; });
  const mx = Math.max(1, ...Object.values(w)); return Object.entries(w).map(([s, v]) => [s, v / mx]).sort((a, b) => b[1] - a[1]);
}
function careerCode(p) { const d = testsDone().riasec; return d ? d.result.top.slice(0, 3).join('') : (p.code || ''); }
function careerRank(p, code) {
  const C = MEC_CAREERS, sk = Object.fromEntries(careerSkills(p)), cd = code || careerCode(p), wantFam = new Set((p.wants || []).flatMap(w => C.WANT_FAM[w] || []));
  return C.careers.map(c => { const have = c.skills.filter(s => sk[s]), skill = Math.sqrt(c.skills.reduce((s, x) => s + Math.min(1, sk[x] || 0), 0) / c.skills.length);
    const inter = cd ? ([...c.code].reduce((s, l, i) => s + (cd.indexOf(l) === 0 ? 1 : cd.indexOf(l) === 1 ? .7 : cd.indexOf(l) === 2 ? .45 : 0) * (i ? .6 : 1), 0) / 1.6) : .4;
    const want = wantFam.size ? (wantFam.has(c.fam) ? 1 : .2) : .5;
    return Object.assign({}, c, { have, miss: c.skills.filter(s => !sk[s]), match: Math.round(100 * Math.min(1, .6 * skill + .3 * Math.min(1, inter) + .1 * want)) }); }).sort((a, b) => b.match - a.match);
}
function identity(p) {
  const C = MEC_CAREERS, sk = careerSkills(p).slice(0, 3).map(([s]) => C.S[s].toLowerCase()), top = careerRank(p).slice(0, 3), fam = top[0] ? C.FAM[top[0].fam][0].toLowerCase() : 'my field';
  const roles = (p.roles || []).slice(0, 2).join(' and ').toLowerCase(), wants = (p.wants || []).map(w => (C.WANTS.find(x => x[0] === w) || [, ''])[1].toLowerCase()).slice(0, 2).join(' and ');
  if (!sk.length) return '';
  return `I am a ${roles ? roles + ' ' : ''}professional who brings ${sk.slice(0, -1).join(', ')}${sk.length > 1 ? ' and ' : ''}${sk[sk.length - 1]}. I am moving toward ${fam}${wants ? `, looking for ${wants}` : ''}.`;
}
function vCareer(arg) {
  if (!window.MEC_CAREERS) { Promise.all([needCareers(), needTests()]).then(render); return header('Career explorer', '') + '<div class="card empty">Loading…</div>'; }
  const C = MEC_CAREERS, p = careerProfile(); if (!['story', 'skills', 'map', 'saved'].includes(ui.cStep)) { ui.cStep = (p.roles || []).length ? 'map' : 'story'; saveUi(); } const step = ui.cStep;
  if (arg) setTimeout(() => careerSheet(arg), 30);
  const steps = [['story', '1', 'Your story'], ['skills', '2', 'Your skills'], ['map', '3', 'Explore'], ['saved', '4', `Saved${(p.saved || []).length ? ' · ' + p.saved.length : ''}`]];
  const nav = `<div class="cstep">${steps.map(([k, n, l]) => `<button class="${step === k ? 'on' : ''}" data-act="c-step" data-v="${k}"><b>${n}</b>${l}</button>`).join('')}</div>`;
  let body = '';
  if (step === 'story') {
    const q = (ui.cq || '').toLowerCase(), roles = C.ROLES.map(r => r[0]).filter(r => !q || r.toLowerCase().includes(q));
    body = `<div class="card"><h2>Roles you have had</h2><p class="small">Pick every job or role you have done, including part-time and freelance.</p><input class="search" type="search" placeholder="Search roles" data-input="cq" value="${esc(ui.cq || '')}" style="width:100%;margin:6px 0 10px"><div class="ochips">${roles.map(r => `<button class="ochip ${(p.roles || []).includes(r) ? 'on' : ''}" data-act="c-tog" data-k="roles" data-v="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>
    <div class="card"><h2>Other experience</h2><div class="ochips">${C.EXPS.map(([e]) => `<button class="ochip ${(p.exps || []).includes(e) ? 'on' : ''}" data-act="c-tog" data-k="exps" data-v="${esc(e)}">${esc(e)}</button>`).join('')}</div></div>
    <div class="card"><h2>What you want more of</h2><div class="ochips">${C.WANTS.map(([k, l]) => `<button class="ochip ${(p.wants || []).includes(k) ? 'on' : ''}" data-act="c-tog" data-k="wants" data-v="${k}">${esc(l)}</button>`).join('')}</div></div>
    <div class="card"><h2>Your interests</h2>${testsDone().riasec ? `<p>From your Career interests test: <b>${esc(careerCode(p))}</b></p>` : `<p class="small">Pick up to three, or take the Career interests test for a precise code.</p><div class="ochips">${['R', 'I', 'A', 'S', 'E', 'C'].map(l => `<button class="ochip ${(p.code || '').includes(l) ? 'on' : ''}" data-act="c-code" data-v="${l}">${esc({ R: 'Hands-on', I: 'Analysing', A: 'Creating', S: 'Helping', E: 'Leading', C: 'Organising' }[l])}</button>`).join('')}</div>${paid() ? '<button class="btn small" data-act="test-start" data-id="riasec" style="margin-top:10px">Take the 6-minute test</button>' : ''}`}</div>
    <div class="btns"><button class="btn primary" data-act="c-step" data-v="skills" ${(p.roles || []).length + (p.exps || []).length ? '' : 'disabled'}>See my skills →</button></div>`;
  } else if (step === 'skills') {
    const sk = careerSkills(p), id = identity(p);
    body = sk.length ? `<div class="card idcard"><div class="small">Your career identity</div><p class="id-s" dir="auto">${esc(id)}</p><button class="btn small" data-act="copy" data-text="${esc(id)}">Copy</button></div>
    <div class="card"><h2>Your skill fingerprint <span class="count">${sk.length}</span></h2><p class="small">Bigger means more evidence from your story. Tap a skill to remove it, or add more below.</p><div class="skcloud">${sk.map(([s, w]) => `<button class="skb" style="--w:${(.8 + w * .7).toFixed(2)}" data-act="c-skill-off" data-v="${s}">${esc(C.S[s])}</button>`).join('')}</div>
    <details style="margin-top:10px"><summary class="small">Add a skill</summary><div class="ochips" style="margin-top:8px">${Object.entries(C.S).filter(([k]) => !sk.some(x => x[0] === k)).map(([k, l]) => `<button class="ochip" data-act="c-tog" data-k="skills" data-v="${k}">${esc(l)}</button>`).join('')}</div></details></div>
    <div class="btns"><button class="btn primary" data-act="c-step" data-v="map">Explore careers →</button></div>` : '<div class="card empty">Add your roles first.</div>';
  } else if (step === 'map') {
    const ranked = careerRank(p), fam = ui.cFam || 'all', shown = ranked.filter(c => fam === 'all' || c.fam === fam), view = ui.cView === 'list' ? 'list' : 'map';
    body = `<div class="toolbar"><div class="seg"><button class="${view === 'map' ? 'on' : ''}" data-act="c-view" data-v="map">Map</button><button class="${view === 'list' ? 'on' : ''}" data-act="c-view" data-v="list">List</button></div></div>
    <div class="ochips cfam"><button class="ochip ${fam === 'all' ? 'on' : ''}" data-act="c-fam" data-v="all">All</button>${Object.entries(C.FAM).map(([k, [l, col]]) => `<button class="ochip ${fam === k ? 'on' : ''}" data-act="c-fam" data-v="${k}" style="--fc:${col}"><i class="fdot" style="background:${col}"></i>${esc(l)}</button>`).join('')}</div>
    ${view === 'map' ? careerMap(shown.slice(0, 28), p) : `<div class="clist">${shown.slice(0, 40).map(c => `<button class="ccard" data-act="c-open" data-id="${c.id}" style="--fc:${C.FAM[c.fam][1]}"><div class="cc-top"><b>${esc(c.title)}</b><span class="cc-m">${c.match}%</span></div><div class="bar thin"><i style="width:${c.match}%;background:var(--fc)"></i></div><div class="small">${esc(C.FAM[c.fam][0])} · ${c.have.length}/${c.skills.length} skills · ${(p.saved || []).includes(c.id) ? '♥ saved' : esc(c.code)}</div></button>`).join('')}</div>`}`;
  } else {
    const ranked = careerRank(p), sv = (p.saved || []).map(id => ranked.find(c => c.id === id)).filter(Boolean);
    body = sv.length ? `<div class="ctable-wrap card tight"><table class="ntable ccomp"><thead><tr><th></th>${sv.map(c => `<th><a href="#" data-act="c-open" data-id="${c.id}">${esc(c.title)}</a></th>`).join('')}</tr></thead><tbody>
      <tr><td>Match</td>${sv.map(c => `<td><b>${c.match}%</b></td>`).join('')}</tr><tr><td>Field</td>${sv.map(c => `<td>${esc(C.FAM[c.fam][0])}</td>`).join('')}</tr><tr><td>Skills you have</td>${sv.map(c => `<td>${c.have.length}/${c.skills.length}</td>`).join('')}</tr><tr><td>To build</td>${sv.map(c => `<td class="small">${c.miss.map(s => esc(C.S[s])).join(', ') || '—'}</td>`).join('')}</tr><tr><td>Start</td>${sv.map(c => `<td class="small">${esc(c.start)}</td>`).join('')}</tr><tr><td></td>${sv.map(c => `<td><button class="btn small primary" data-act="c-goal" data-id="${c.id}">Make it my goal</button></td>`).join('')}</tr></tbody></table></div>` : '<div class="card empty">Tap ♥ on a career to save it and compare here.</div>';
  }
  return header('Career explorer', 'From your story to your next career') + nav + body;
}
function careerMap(cs, p) {
  const C = MEC_CAREERS, narrow = window.innerWidth < 700, W = narrow ? 420 : 760, H = narrow ? 640 : 540, cx = W / 2, cy = H / 2, saved = new Set(p.saved || []);
  const fams = Object.keys(C.FAM).filter(f => cs.some(c => c.fam === f)), mx = Math.max(...cs.map(c => c.match)), mn = Math.min(...cs.map(c => c.match)), rx = W / 2 - 46, ry = H / 2 - 46;
  const nodes = cs.map(c => { const fi = fams.indexOf(c.fam), sector = (Math.PI * 2) / fams.length, sib = cs.filter(x => x.fam === c.fam), k = sib.indexOf(c), ang = -Math.PI / 2 + sector * fi + sector * ((k + .5) / sib.length - .5) * .8, rel = mx > mn ? (mx - c.match) / (mx - mn) : .5, d = .3 + rel * .66; return Object.assign({ x: cx + Math.cos(ang) * rx * d, y: cy + Math.sin(ang) * ry * d, r: (narrow ? 9 : 8) + (c.match - mn) / Math.max(1, mx - mn) * (narrow ? 9 : 10) }, c); });
  const placed = [], lab = new Set(); nodes.slice().sort((a, b) => b.match - a.match).forEach(n => { if (lab.size >= (narrow ? 7 : 14)) return; const ly = n.y + n.r + 14; if (placed.some(q => Math.abs(q[0] - n.x) < (narrow ? 185 : 165) && Math.abs(q[1] - ly) < 30)) return; placed.push([n.x, ly]); lab.add(n.id); });
  const fs = narrow ? 13 : 12;
  return `<div class="card cmap-wrap"><svg class="cmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="Career map">
    ${[.36, .63, .96].map((r, i) => `<ellipse cx="${cx}" cy="${cy}" rx="${(rx * r).toFixed(0)}" ry="${(ry * r).toFixed(0)}" class="cm-ring"/><text x="${cx}" y="${(cy - ry * r + 13).toFixed(0)}" class="cm-rl" text-anchor="middle">${['Strongest fit', 'Good fit', 'Stretch'][i]}</text>`).join('')}
    ${nodes.map(n => `<line x1="${cx}" y1="${cy}" x2="${n.x.toFixed(1)}" y2="${n.y.toFixed(1)}" class="cm-ln" style="stroke:${C.FAM[n.fam][1]}"/>`).join('')}
    <g class="cm-me"><circle cx="${cx}" cy="${cy}" r="${narrow ? 30 : 34}"/><text x="${cx}" y="${cy + 5}" text-anchor="middle">You</text></g>
    ${nodes.map(n => { const t = n.title.length > 22 ? n.title.slice(0, 20) + '…' : n.title, ax = Math.max(60, Math.min(W - 60, n.x)); return `<g class="cm-n" data-act="c-open" data-id="${n.id}" role="button" tabindex="0"><circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.r.toFixed(1)}" fill="${C.FAM[n.fam][1]}"/>${saved.has(n.id) ? `<text x="${n.x.toFixed(1)}" y="${(n.y + 4).toFixed(1)}" text-anchor="middle" class="cm-heart">♥</text>` : ''}${lab.has(n.id) ? `<text x="${ax.toFixed(1)}" y="${(n.y + n.r + 14).toFixed(1)}" text-anchor="middle" class="cm-t" style="font-size:${fs}px">${esc(t)} <tspan class="cm-p">${n.match}%</tspan></text>` : ''}<title>${esc(n.title)} · ${n.match}%</title></g>`; }).join('')}
  </svg><div class="small" style="text-align:center">Closer to you means a stronger fit. Colours show the field. Tap a circle for details, or switch to List.</div></div>`;
}
function careerSheet(id) {
  const C = MEC_CAREERS, p = careerProfile(), c = careerRank(p).find(x => x.id === id); if (!c) return;
  const pitch = `I am interested in the ${c.title} role. In my experience as ${(p.roles || []).slice(0, 2).join(' and ') || 'a professional'}, I built ${c.have.slice(0, 3).map(s => C.S[s].toLowerCase()).join(', ') || 'relevant skills'}. I am now developing ${c.miss.slice(0, 2).map(s => C.S[s].toLowerCase()).join(' and ') || 'further expertise'} to grow in this direction.`;
  openSheet(c.title, `<div class="csh" style="--fc:${C.FAM[c.fam][1]}"><div class="csh-top">${ring(c.match, 76, c.match + '%')}<div class="main"><span class="chip" style="background:color-mix(in srgb,var(--fc) 18%,transparent);color:var(--fc)">${esc(C.FAM[c.fam][0])}</span><p dir="auto">${esc(c.what)}</p><div class="small">Interest code ${esc(c.code)}</div></div></div>
    <h3>Skills you already have</h3><div class="ochips">${c.have.map(s => `<span class="skc ok">✓ ${esc(C.S[s])}</span>`).join('') || '<span class="small">None yet from your story.</span>'}</div>
    <h3>Skills to build</h3><div class="ochips">${c.miss.map(s => `<span class="skc gap">+ ${esc(C.S[s])}</span>`).join('') || '<span class="small">You have them all.</span>'}</div>
    <h3>How to start</h3><p class="small">${esc(c.start)}</p><ol class="cpath">${c.path.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    <h3>Related careers</h3><div class="ochips">${c.rel.map(r => C.careers.find(x => x.id === r)).filter(Boolean).map(r => `<button class="ochip" data-act="c-open" data-id="${r.id}">${esc(r.title)}</button>`).join('')}</div>
    <h3>Your pitch</h3><p class="small pitch" dir="auto">${esc(pitch)}</p></div>`,
    `<button class="btn" data-act="c-save" data-id="${c.id}">${(p.saved || []).includes(c.id) ? '♥ Saved' : '♡ Save'}</button><button class="btn" data-act="copy" data-text="${esc(pitch)}">Copy pitch</button><button class="btn primary" data-act="c-goal" data-id="${c.id}">Make it my goal</button>`, { noFocus: true });
  emiReact('career', `${c.title}: ${c.match}% match.`);
}
function careerGoal(id) {
  const C = MEC_CAREERS, p = careerProfile(), c = careerRank(p).find(x => x.id === id); if (!c) return;
  if (list('goals').some(g => g.careerId === id)) { toast('This career is already a goal'); return; }
  const a = areaByName('Career'), t = today(), tgt = addDays(t, 365);
  const g = save('goals', { title: 'Become a ' + c.title, areaId: a ? a.id : '', area: 'Career', target: tgt, status: 'In progress', careerId: id, why: c.what, micro: [...c.miss.slice(0, 4).map(s => `Spend 15 minutes building ${C.S[s].toLowerCase()}`), `Read one job ad for ${c.title} and note 3 requirements`, `Message one ${c.title} on LinkedIn for advice`] });
  c.path.forEach((s, i) => save('milestones', { title: s, goalId: g.id, target: addDays(t, Math.round(365 * (i + 1) / c.path.length)), status: 'Planned' }));
  closeSheet(true); toast('Goal created with milestones and micro-actions'); location.hash = '#/goal/' + encodeURIComponent(g.id);
}
function careerSave(fn) { const p = careerProfile(); const n = fn(Object.assign({}, p, { roles: (p.roles || []).slice(), exps: (p.exps || []).slice(), skills: (p.skills || []).slice(), wants: (p.wants || []).slice(), saved: (p.saved || []).slice(), off: (p.off || []).slice() })) || p; save('careers', Object.assign({ id: 'profile' }, n)); }

/* ---------- navigation: grouped and visual ---------- */
const NAV_GROUPS = () => [
  ['Plan', [['today', 'Today', I.today], ['calendar', 'Calendar', I.cal], ['tasks', 'Tasks', I.tasks], ['projects', 'Boards', I.board]]],
  ['Grow', [['life', 'Life areas', I.wheel], ['habits', 'Habits', I.repeat], ['progress', 'Coach', I.prog]]],
  ['Discover', [['discover', 'Tests', I.spark], ['me', 'My pack', I.user], ['career', 'Career explorer', I.compass]]],
  ['Wellbeing', [['calm', 'Calm', I.calm], ['emi', 'Emi guide', I.star]]],
  ...(isOwner() ? [['Business', [['products', 'Products', I.money], ['jobs', 'Job search', I.jobs], ['admin', 'Members', I.users]]]] : []),
  ['', [['settings', 'Settings', I.set]]]
];
const navActive = page => ({ today: 'today', calendar: 'calendar', life: 'life', area: 'life', goal: 'life', habits: 'life', progress: 'life', plan: 'life', learn: 'life', discover: 'discover', test: 'discover', me: 'discover', career: 'discover' })[page] || 'hub';
function sideHtml(page) {
  return `<aside class="side"><div class="brand">ME<b>.</b>Coach<span>self-coaching</span></div>${NAV_GROUPS().map(([g, items]) => `${g ? `<div class="grp">${g}</div>` : '<div class="grp sp"></div>'}${items.filter(([k]) => can(k) && !hidden().has(k)).map(([k, l, ic]) => `<a href="#/${k}" class="${page === k || (navActive(page) === k && page !== 'today') || (k === 'projects' && page === 'board') ? 'on' : ''}">${ic}${l}${badge(k)}</a>`).join('')}`).join('')}</aside>`;
}
function vHub() {
  const desc = { today: 'Plan and close your day', calendar: 'Day, week and month', tasks: 'Everything to do', projects: 'Boards for every project', life: 'Your 8 areas and goals', habits: 'Daily habits and streaks', progress: '40-day cycle, insights, roadmap', discover: '9 tests to know yourself', me: 'Your self-knowledge pack', career: 'Find careers that fit you', calm: 'Breathe and reflect', emi: 'Meet your 3D guide', products: 'Your products and sales', jobs: 'Applications and follow-ups', admin: 'Accounts and payments', settings: 'Account, data, reminders' };
  const col = { Plan: '#2a78d6', Grow: '#1baf7a', Discover: '#6250d6', Wellbeing: '#e87ba4', Business: '#c9a227', '': '#787774' };
  return header('More', '') + NAV_GROUPS().map(([g, items]) => `${g ? `<h2 class="sec-h">${g}</h2>` : '<h2 class="sec-h">Account</h2>'}<div class="hubgrid">${items.filter(([k]) => can(k) && !hidden().has(k)).map(([k, l, ic]) => `<a class="hubt" href="#/${k}" style="--hc:${col[g]}"><span class="hi">${ic}</span><b>${l}</b><span class="small">${desc[k] || ''}</span>${badge(k)}</a>`).join('')}</div>`).join('') +
    `<h2 class="sec-h">Extras</h2><div class="hubgrid"><a class="hubt" href="${BOOK_URL}" target="_blank" rel="noopener" style="--hc:#c9a227"><span class="hi">📘</span><b>Free book</b><span class="small">Self-Coaching Blueprint</span></a><a class="hubt" href="#/journal" style="--hc:#787774"><span class="hi">${I.journal}</span><b>Journal</b><span class="small">Your Night Balance days</span></a><a class="hubt" href="#/trash" style="--hc:#787774"><span class="hi">${I.trash}</span><b>Trash</b><span class="small">Restore deleted items</span></a></div>`;
}

function v8Acts(a, id) {
  return {
    'emi-sheet': () => emiSheet(), 'emi-hide': () => { ui.emiOff = true; saveUi(); closeSheet(true); emiDock(); toast('Emi is hidden. Turn it back on in More → Emi guide.'); },
    'emi-toggle': () => { ui.emiOff = !ui.emiOff; saveUi(); emiDock(); render(); },
    'emi-view': () => vEmi.inst && vEmi.inst.view(a.dataset.v), 'emi-spin': () => vEmi.inst && vEmi.inst.autoRotate(true), 'emi-play': () => vEmi.inst && vEmi.inst.play(a.dataset.v),
    'sheet-close-go': () => closeSheet(true),
    'test-start': () => testStart(id), 'tr-ans': () => trAnswer(Number(a.dataset.v)), 'tr-back': () => { if (trun && trun.i > 0) { trun.i--; trDraw(); if (trEmi) trEmi.play('listen'); } }, 'tr-close': () => { trClose(); toast('Progress saved. Continue any time.'); },
    'micro-done': () => { const g = get('goals', id); if (!g) return; const md = Object.assign({}, g.microDone || {}), t = today(); if (md[t]) delete md[t]; else md[t] = microToday().find(m => m.g.id === id)?.t || true; save('goals', Object.assign({}, g, { microDone: md })); if (md[t]) emiReact('micro', 'Tiny step, big direction. 👏'); },
    'micro-shuffle': () => { const g = get('goals', id); if (!g) return; const sh = Object.assign({}, g.microShift || {}); sh[today()] = (Number(sh[today()]) || 0) + 1; save('goals', Object.assign({}, g, { microShift: sh })); },
    'micro-add': () => { const g = get('goals', id); if (!g) return; form('New micro-action', [{ k: 't', label: 'A step of 2 to 15 minutes', req: true, ph: 'e.g. Write the first line of my cover letter' }], {}, v => { save('goals', Object.assign({}, g, { micro: [...(g.micro || []), v.t.trim()] })); toast('Added'); }); },
    'micro-del': () => { const g = get('goals', id); if (!g) return; const m = (g.micro || []).slice(); m.splice(Number(a.dataset.i), 1); save('goals', Object.assign({}, g, { micro: m })); },
    'micro-task': () => { const ar = areaByName(a.dataset.a); save('tasks', { title: a.dataset.v, due: today(), state: 'To do', priority: 'P2', owner: 'Me', areaId: ar ? ar.id : '' }); toast('Added to today'); },
    'micro-habit': () => { const ar = areaByName(a.dataset.a); save('habits', { title: a.dataset.v.replace(/ today\.?$/i, '').replace(/\.$/, ''), days: [0, 1, 2, 3, 4, 5, 6], perWeek: 7, areaId: ar ? ar.id : '', color: ar ? ar.color : 0 }); toast('New habit added'); },
    'new-habit-area': () => FORMS.habit({ areaId: id, days: [0, 1, 2, 3, 4, 5, 6] }),
    'print-pack': () => { document.documentElement.classList.add('printing'); setTimeout(() => { window.print(); document.documentElement.classList.remove('printing'); }, 60); },
    'c-step': () => { ui.cStep = a.dataset.v; saveUi(); render(); window.scrollTo(0, 0); },
    'c-tog': () => { const k = a.dataset.k, v = a.dataset.v; careerSave(p => { const arr = p[k] || []; const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); p[k] = arr; if (k === 'skills') p.off = (p.off || []).filter(x => x !== v); return p; }); },
    'c-code': () => careerSave(p => { let c = p.code || ''; c = c.includes(a.dataset.v) ? c.replace(a.dataset.v, '') : (c + a.dataset.v).slice(-3); p.code = c; return p; }),
    'c-skill-off': () => careerSave(p => { const v = a.dataset.v; p.skills = (p.skills || []).filter(s => s !== v); p.off = [...(p.off || []).filter(x => x !== v), v]; return p; }),
    'c-view': () => { ui.cView = a.dataset.v; saveUi(); render(); }, 'c-fam': () => { ui.cFam = a.dataset.v; saveUi(); render(); },
    'c-open': () => careerSheet(id),
    'c-save': () => { careerSave(p => { const s = p.saved || []; const i = s.indexOf(id); if (i >= 0) s.splice(i, 1); else s.push(id); p.saved = s; return p; }); careerSheet(id); },
    'c-goal': () => careerGoal(id)
  };
}

/* ---------------- shell + router ---------------- */
function route() { const h = location.hash.replace(/^#\/?/, '') || 'today'; const [p, ...rest] = h.split('/'); return { page: p, arg: decodeURIComponent(rest.join('/')) }; }
function render() {
  if (!ls.get(K.tok) && !document.querySelector('.shell')) return;
  if (drag && drag.on) { render.pending = true; return; }
  const { page, arg } = route();
  if (REMOVED.has(page) || (me && !can(page))) { location.replace('#/today'); return; }
  const views = { cyclereport: vCycleReport, life: vLife, discover: vDiscover, test: () => vTest(arg), me: vMe, career: () => vCareer(arg), emi: vEmi, hub: vHub, projects: vBoards, board: () => vBoard(arg), calm: vCalm,  today: vToday, tasks: vTasks, calendar: vCalendar, plan: vPlan, more: vHub, learn: vLearn, evidence: vEvidence, decisions: vDecisions, notes: vNotes, note: () => vNote(arg), review: vReview, settings: vSettings, jobs: vJobs, immigration: vImmigration, progress: vProgress, journal: vJournal, report: vReport, templates: vTemplates, trash: vTrash, health: vHealth, course: () => vCourse(arg), documents: vDocuments, notes: vNotesHub, goal: () => vGoal(arg), area: () => vArea(arg), admin: vAdmin, habits: vHabits, products: vProducts };
  if (page === 'immigration' || page === 'evidence') { ui.dTab = page; views[page] = vDocuments; } if (page === 'journal') views.journal = () => header('Journal', 'Your Night Balance days') + stripHead(vJournal());
  if (page === 'plan') { ui.pTab = ui.planTab === 'goals' ? 'goals' : 'roadmap'; views.plan = vProgress; } if (page === 'learn') { ui.pTab = 'learning'; views.learn = vProgress; }
  const html = icoize((views[page] || vToday)());
  const active = navActive(page);
  const focusKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.input : null;
  const sel = focusKey ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  const scrollY = window.scrollY;
  const app = $('#app');
  app.innerHTML = `<div class="shell">
    ${sideHtml(page)}
    <main class="pg-${esc(page)}${render.lastPage !== page ? ' pg-in' : ''}">${html}</main>
    <nav class="tabs">${NAV_MAIN.map(([k, l, ic]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}">${ic}${badge(k)}<span>${l}</span></a>`).join('')}</nav>
    <button class="fab" data-act="quick" aria-label="Add">${I.plus}</button></div>`;
  if (focusKey) { const el = app.querySelector(`[data-input="${focusKey}"]`); if (el) { el.focus(); try { el.setSelectionRange(sel[0], sel[1]); } catch {} } }
  if (page === 'settings') setTimeout(() => { pushRender(); pkRender(); }, 0);
  render.lastPage = page; pushWidget();
  if (render.keepScroll) window.scrollTo(0, scrollY);
  render.keepScroll = true;
}
window.addEventListener('hashchange', () => { render.keepScroll = false; render(); window.scrollTo(0, 0); });

/* ---------------- sheets (forms) ---------------- */
let sheetCtx = null;
function openSheet(title, bodyHtml, footHtml, ctx = {}) {
  closeSheet(true);
  const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.dataset.act = 'sheet-close';
  const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
  if (RTL()) title = trStr(title) || title;
  sh.innerHTML = `<div class="sheet-h"><h3 dir="auto">${esc(title)}</h3><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.close}</button></div><div class="sheet-b">${icoize(bodyHtml)}</div>${footHtml ? `<div class="sheet-f">${footHtml}</div>` : ''}`;
  document.body.append(scrim, sh); sheetCtx = Object.assign({ el: sh, scrim }, ctx);
  requestAnimationFrame(() => { scrim.classList.add('on'); sh.classList.add('on'); });
  const first = sh.querySelector('input:not([type=checkbox]),textarea,select'); if (first && !ctx.noFocus && window.innerWidth > 700) first.focus();
}
function closeSheet(instant) {
  if (!sheetCtx) return; const { el, scrim } = sheetCtx; sheetCtx = null;
  if (instant) { el.remove(); scrim.remove(); return; }
  el.classList.remove('on'); scrim.classList.remove('on'); setTimeout(() => { el.remove(); scrim.remove(); }, 250);
}
function field(f, v) {
  const id = 'f_' + f.k, val = v ?? f.def ?? '';
  const lab = `<label for="${id}">${esc(f.label)}</label>`; const hint = f.hint ? `<div class="hint">${esc(f.hint)}</div>` : '';
  if (f.type === 'days') { const sel = (Array.isArray(val) && val.length ? val : [0, 1, 2, 3, 4, 5, 6]).map(Number); return `<div class="f">${lab}<div class="daypick" data-name="${f.k}">${DOWS.map((d, i) => `<button type="button" class="${sel.includes(i) ? 'on' : ''}" data-act="day-tog" data-v="${i}">${d.slice(0, 2)}</button>`).join('')}</div><input type="hidden" name="${f.k}" value="${sel.join(',')}"><div class="hint"><a href="#" data-act="day-preset" data-v="0,1,2,3,4,5,6">Every day</a> · <a href="#" data-act="day-preset" data-v="${mideast() ? '0,1,2,3,4' : '1,2,3,4,5'}">Work days</a></div></div>`; }
  if (f.type === 'check') return `<div class="f check-f ${f.half ? 'half' : ''}"><input type="checkbox" id="${id}" name="${f.k}" ${val ? 'checked' : ''}><label for="${id}">${esc(f.label)}</label></div>`;
  if (f.type === 'select') { const opts = (typeof f.options === 'function' ? f.options() : f.options).map(o => Array.isArray(o) ? o : [o, o]); return `<div class="f">${lab}<select id="${id}" name="${f.k}">${f.blank !== false ? '<option value="">—</option>' : ''}${opts.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>${hint}</div>`; }
  if (f.type === 'textarea' || f.type === 'big') return `<div class="f ${f.type === 'big' ? 'big' : ''}">${lab}<textarea id="${id}" name="${f.k}" dir="auto" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}>${esc(val)}</textarea>${hint}</div>`;
  const type = f.type === 'datetime' ? 'datetime-local' : (f.type || 'text');
  const shown = f.type === 'datetime' ? toInput(val) : val;
  return `<div class="f">${lab}<input id="${id}" name="${f.k}" type="${type}" ${type === 'text' ? 'dir="auto"' : ''} value="${esc(shown)}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''} ${f.req ? 'required' : ''} ${f.step ? `step="${f.step}"` : ''}>${hint}</div>`;
}
function readForm(fields, el) {
  const o = {};
  for (const f of fields) { const inp = el.querySelector(`[name="${f.k}"]`); if (!inp) continue;
    if (f.type === 'days') o[f.k] = inp.value.split(',').filter(x => x !== '').map(Number); else if (f.type === 'check') o[f.k] = inp.checked; else if (f.type === 'datetime') o[f.k] = fromInput(inp.value); else if (f.type === 'number') o[f.k] = inp.value === '' ? '' : Number(inp.value); else o[f.k] = inp.value.trim(); }
  return o;
}
let formColl = null;
function form(title, fields, rec, onSave, opts = {}) {
  const hc = opts.coll || formColl; formColl = null; if (hc && rec && rec.id && db[hc] && db[hc][rec.id]) opts.extra = (opts.extra || '') + `<button class="btn ghost" data-act="history" data-c="${hc}" data-id="${esc(rec.id)}">History</button>`;
  const draw = fs => fs.map(f => Array.isArray(f) ? `<div class="fgrid">${f.map(x => field(x, rec[x.k])).join('')}</div>` : f.html ? f.html : field(f, rec[f.k])).join('');
  const cut = fields.indexOf('MORE');
  const main = cut < 0 ? fields : fields.slice(0, cut), extra = cut < 0 ? [] : fields.slice(cut + 1);
  const filled = extra.flat().filter(f => f.k && rec[f.k] !== undefined && rec[f.k] !== '' && rec[f.k] !== null && rec[f.k] !== false && !(Array.isArray(rec[f.k]) && !rec[f.k].length)).length;
  const body = draw(main) + (extra.length ? `<details class="more"><summary>More details${filled ? ` <span class="small">(${filled} filled)</span>` : ''}</summary>${draw(extra)}</details>` : '') + `<div class="err" id="formerr"></div>`;
  const flat = fields.filter(f => f !== 'MORE').flat().filter(f => f.k);
  const foot = `${opts.onDelete ? '<button class="btn danger" data-act="form-del">Delete</button><span style="flex:1"></span>' : ''}${opts.extra || ''}<button class="btn" data-act="sheet-close">Cancel</button><button class="btn primary" data-act="form-save">Save</button>`;
  openSheet(title, body, foot, { onSave: () => { const v = readForm(flat, sheetCtx.el); const err = onSave(v); if (err) { $('#formerr', sheetCtx.el).textContent = err; return; } closeSheet(); }, onDelete: opts.onDelete, noFocus: opts.noFocus });
}
const projOpts = () => list('projects').sort((a, b) => String(a.title).localeCompare(String(b.title))).map(p => [p.id, p.title]);
const goalOpts = () => list('goals').sort((a, b) => String(a.title).localeCompare(String(b.title))).map(g => [g.id, g.title]);
const skillOpts = () => list('skills').map(s => [s.id, s.title]);

function taskForm(t = {}) {
  const fields = [
    { k: 'title', label: 'Task', req: true },
    { k: 'due', label: 'Date', type: 'date' },
    { k: 'nextAction', label: 'Note', ph: 'Next step or a short note (optional)' },
    'MORE',
    [{ k: 'state', label: 'Status', type: 'select', options: STATES, blank: false, def: 'To do' }, { k: 'priority', label: 'Priority', type: 'select', options: PRI, def: 'P2' }],
    [{ k: 'focusDate', label: 'Top 3 on day', type: 'date' }, { k: 'repeat', label: 'Repeat', type: 'select', options: REPEATS, blank: false, def: '' }],
    [{ k: 'owner', label: 'Owner', type: 'select', options: OWNERS, def: 'Me' }, { k: 'area', label: 'Area', type: 'select', options: AREAS }],
    [{ k: 'projectId', label: 'Project', type: 'select', options: projOpts }, { k: 'goalId', label: 'Goal', type: 'select', options: goalOpts }],
    { k: 'criterion', label: 'Done when…', type: 'textarea', ph: 'What must exist for this to count as done?' },
    [{ k: 'scheduled', label: 'Scheduled start', type: 'datetime' }, { k: 'scheduledEnd', label: 'Scheduled end', type: 'datetime' }],
    [{ k: 'schedType', label: 'Schedule type', type: 'select', options: SCHED }, { k: 'estMinutes', label: 'Estimate (minutes)', type: 'number', step: 5 }],
    { k: 'dueAlert', label: 'Show the due date in my phone calendar', type: 'check' },
    { k: 'blockedBy', label: 'Waiting on (who / what)' },
    { k: 'evidence', label: 'Proof of completion (optional)', type: 'textarea' }, { k: 'verified', label: 'Evidence verified by a document', type: 'check' },
    [{ k: 'completedOn', label: 'Completed on', type: 'date' }, { k: 'docLink', label: 'Document link', type: 'url' }],
    { k: 'notes', label: 'Notes', type: 'textarea' }
  ];
  formColl = 'tasks'; form(t.id ? 'Edit task' : 'New task', fields, t, v => {
    if (!v.title) return 'Give the task a title.';
    if (DONE.has(v.state) && !v.completedOn) v.completedOn = today();
    if (!DONE.has(v.state) && DONE.has(t.state || '')) v.completedOn = '';
    save('tasks', Object.assign({}, t, v));
    toast('Saved');
  }, { onDelete: t.id ? () => { if (confirm('Delete this task? It can be restored from a backup.')) { remove('tasks', t.id); closeSheet(); } } : null });
}
function celebrate() {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div'); box.className = 'confetti'; const cols = ['#c9a227', '#2f6b4f', '#22344a', '#e3c25a', '#9b2c2c'];
  for (let i = 0; i < 36; i++) { const s = document.createElement('i'); s.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${Math.random() * .25}s;animation-duration:${1 + Math.random() * .8}s;transform:rotate(${Math.random() * 360}deg)`; box.appendChild(s); }
  document.body.appendChild(box); setTimeout(() => box.remove(), 2200);
}
function tour() {
  if (ui.tourDone || sheetCtx) return;
  const row = (ic, t, m) => `<div class="row"><span class="att-i">${ic}</span><div class="main"><div class="t">${t}</div><div class="m">${m}</div></div></div>`;
  openSheet('Welcome to ME.Coach', `<div class="list">${row(I.plus, 'One box for everything', 'Type a task, “fri 10:30 meeting”, “30 min sql” or paste a job link.')}${row(I.tasks, 'Tap for actions, swipe to finish', 'Swipe right to finish. Swipe a task left to move it to tomorrow.')}${row(I.star, 'One minute morning and night', 'Morning Balance sets your focus and Top 3. Night Balance scores the day and carries over the rest.')}${row(I.prog, 'Coach', 'Wheel of Life, 40-day cycles, goals by area and milestones.')}${row(I.search, 'Search does everything', 'Find anything, or type “close” to close the day.')}</div>`, '<button class="btn primary wide" data-act="tour-ok">Start</button>', { noFocus: true });
}
function setTask(id, patch, msg) { const t = get('tasks', id); if (!t) return; const before = Object.assign({}, t); save('tasks', Object.assign({}, t, patch)); closeSheet(); if (msg) toast(msg, 'Undo', () => save('tasks', before)); }
const REPEATS = [['', 'Does not repeat'], ['daily', 'Every day'], ['weekdays', 'Weekdays (Mon–Fri)'], ['weekly', 'Every week'], ['monthly', 'Every month']];
function nextDue(from, rep) {
  const base = from && from > today() ? from : today(); let d = parseD(base);
  if (rep === 'daily') d.setDate(d.getDate() + 1);
  else if (rep === 'weekdays') { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); }
  else if (rep === 'weekly') { d = parseD(from || base); do { d.setDate(d.getDate() + 7); } while (dstr(d) <= today()); }
  else if (rep === 'monthly') { d = parseD(from || base); do { d.setMonth(d.getMonth() + 1); } while (dstr(d) <= today()); }
  return dstr(d);
}
function toggleDone(id) {
  const t = get('tasks', id); if (!t) return;
  if (DONE.has(t.state)) return setTask(id, { state: 'To do', completedOn: '' }, 'Reopened');
  const before = Object.assign({}, t); save('tasks', Object.assign({}, t, { state: 'Done', completedOn: today() })); closeSheet();
  let nx = null;
  if (t.repeat) { const d = nextDue(t.due, t.repeat); nx = save('tasks', { title: t.title, nextAction: t.nextAction || '', priority: t.priority || 'P2', owner: t.owner || 'Milad', area: t.area || '', projectId: t.projectId || '', goalId: t.goalId || '', notes: t.notes || '', repeat: t.repeat, state: 'To do', due: d, prevId: t.id }); }
  toast(nx ? `Done ✓ · next ${rel(nx.due)}` : 'Done ✓', 'Undo', () => { save('tasks', before); if (nx) remove('tasks', nx.id); });
  if (t.focusDate === today()) { const tp = list('tasks').filter(x => x.focusDate === today()); if (tp.length >= 3 && tp.every(x => !isOpen(x))) celebrate(); }
}
function repeatSheet(id) {
  const t = get('tasks', id); if (!t) return;
  openSheet('Repeat', `<div class="acts one">${REPEATS.map(([k, l]) => `<button class="act ${(t.repeat || '') === k ? 'pri' : ''}" data-act="t-rep" data-id="${esc(id)}" data-v="${k}"><span>${(t.repeat || '') === k ? '✓' : '↻'}</span>${l}</button>`).join('')}</div><div class="small" style="margin-top:10px">When you tick it done, the next one is created automatically.</div>`, '', { noFocus: true });
}
/* ---- Top 3 suggestion ---- */
function suggestTop(day = today()) {
  const score = t => { let s = 0; if (t.due && t.due < day) s += 100 + Math.min(30, dayNum(day) - dayNum(t.due)); else if (t.due === day) s += 80; else if (t.due && t.due <= addDays(day, 3)) s += 50; else if (t.due && t.due <= addDays(day, 7)) s += 20;
    s += t.priority === 'P1' ? 40 : t.priority === 'P2' ? 15 : 0; if (stOf(t) === 'Doing') s += 30; if (t.goalId || t.projectId) s += 10; return s; };
  return list('tasks').filter(t => isOpen(t) && stOf(t) !== 'Waiting').map(t => [score(t), t]).sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => x[1]);
}
/* ---- focus timer ---- */
let focusTick = null;
function focusLeft() { const f = ui.focus; if (!f) return 0; const used = (f.pausedAt || Date.now()) - f.start - (f.paused || 0); return Math.max(0, f.dur * 60000 - used); }
function focusStart(id, mins = 25, extra = {}) { ui.focus = Object.assign({ id, dur: mins, start: Date.now(), paused: 0, pausedAt: 0, mode: 'focus' }, extra); ui.fRound = (ui.fRound || 0); saveUi(); closeSheet(true); focusShow(); }
const SCENES = [['dusk', 'Dusk'], ['forest', 'Forest'], ['ocean', 'Ocean'], ['night', 'Night']], SOUNDS = [['off', 'Silence'], ['rain', 'Rain'], ['waves', 'Waves'], ['brown', 'Deep noise']];
let amb = null;
function ambient(kind) {
  if (amb) { try { amb.ctx.close(); } catch {} amb = null; } if (!kind || kind === 'off') return;
  try { const ctx = new (window.AudioContext || window.webkitAudioContext)(), len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), dd = buf.getChannelData(0); let lastV = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown' || kind === 'waves') { lastV = (lastV + 0.02 * w) / 1.02; dd[i] = lastV * 3.5; } else dd[i] = w * 0.6; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = kind === 'rain' ? 2400 : kind === 'waves' ? 700 : 1000; const g = ctx.createGain(); g.gain.value = kind === 'rain' ? 0.18 : 0.5;
    if (kind === 'waves') { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 0.35; lfo.connect(lg); lg.connect(g.gain); lfo.start(); }
    src.connect(fl); fl.connect(g); g.connect(ctx.destination); src.start(); amb = { ctx, kind }; } catch { toast('Sound is not available on this device'); }
}
function focusShow() {
  const f = ui.focus; let el = $('#focus'); if (!f) { if (el) el.remove(); clearInterval(focusTick); return; }
  const t = f.kind === 'lesson' ? { title: f.title } : get('tasks', f.id);
  if (!el) { el = document.createElement('div'); el.id = 'focus'; document.body.appendChild(el); }
  const draw = () => { if (!ui.focus) { clearInterval(focusTick); return; } const ms = focusLeft(); const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000); const tt = $('#focus .ft'); if (tt) tt.textContent = `${pad(m)}:${pad(s)}`; const ring = $('#focus .ring i'); if (ring) ring.style.setProperty('--p', (100 - 100 * ms / (f.dur * 60000)).toFixed(1)); if (ms <= 0 && !ui.focus.finished) { ui.focus.finished = true; saveUi(); focusEnd(true); } };
  el.className = 'scene-' + (ui.fScene || 'dusk');
  el.innerHTML = `<div class="fbg"><i></i><i></i><i></i></div><div class="fbox"><div class="fmodes">${[['focus', 'Focus', 25], ['short', 'Short break', 5], ['long', 'Long break', 15]].map(([k, l, m]) => `<button class="${(f.mode || 'focus') === k ? 'on' : ''}" data-act="f-mode" data-v="${k}" data-m="${m}">${l}</button>`).join('')}</div>
    <div class="fttl" dir="auto">${esc(f.mode && f.mode !== 'focus' ? 'Breathe. Stretch. Drink water.' : (t ? t.title : f.label || 'Deep work'))}</div><div class="ring"><i></i><div class="ft">--:--</div></div>
    <div class="frounds">${[0, 1, 2, 3].map(i => `<i class="${i < (ui.fRound || 0) % 4 ? 'on' : ''}"></i>`).join('')}</div>
    <div class="btns" style="justify-content:center">${f.pausedAt ? '<button class="btn" data-act="f-resume">Resume</button>' : '<button class="btn" data-act="f-pause">Pause</button>'}<button class="btn" data-act="f-plus">+5 min</button><button class="btn primary" data-act="f-stop">${f.mode && f.mode !== 'focus' ? 'End break' : 'Finish'}</button></div>
    <div class="fopts"><div>${SCENES.map(([k, l]) => `<button class="${(ui.fScene || 'dusk') === k ? 'on' : ''}" data-act="f-scene" data-v="${k}">${l}</button>`).join('')}</div><div>${SOUNDS.map(([k, l]) => `<button class="${(amb ? amb.kind : 'off') === k ? 'on' : ''}" data-act="f-sound" data-v="${k}">${l}</button>`).join('')}</div></div>
    <button class="btn ghost small" data-act="f-cancel" style="margin-top:6px">Cancel without saving</button></div>`;
  clearInterval(focusTick); draw(); if (ui.focus) focusTick = setInterval(draw, 1000);
}
function focusEnd(auto) {
  const f = ui.focus; if (!f) return; const mins = Math.max(1, Math.round((f.dur * 60000 - focusLeft()) / 60000));
  if (f.mode && f.mode !== 'focus') { ui.focus = null; saveUi(); clearInterval(focusTick); const e0 = $('#focus'); if (e0) e0.remove(); ambient('off'); toast('Break is over. Ready for the next round?', 'Start', () => focusStart(f.id, 25, { label: f.label })); return; }
  const st = new Date(f.start); save('focus', { date: dstr(st), start: `${pad(st.getHours())}:${pad(st.getMinutes())}`, minutes: mins, label: f.kind === 'lesson' ? f.title : (get('tasks', f.id) || {}).title || f.label || 'Deep work', taskId: f.id || '' });
  ui.fRound = (ui.fRound || 0) + 1; saveUi(); ambient('off');
  if (f.kind === 'lesson') {
    ui.focus = null; saveUi(); clearInterval(focusTick); const el0 = $('#focus'); if (el0) el0.remove();
    const c = get('courses', f.course); const sk = c && c.skillId && get('skills', c.skillId);
    save('sessions', { title: (c ? c.title.split(' (')[0] + ': ' : '') + f.title, skill: c ? c.skillId || '' : '', minutes: mins, date: today(), result: 'Not a check', course: f.course });
    openSheet(auto ? 'Time is up 🎉' : 'Lesson time saved', `<div class="closeday"><div class="big">${mins}</div><div class="small">minutes logged${sk ? ' to ' + esc(sk.title) : ''}</div></div><div class="small" style="margin:10px 0" dir="auto">${esc(f.title)}</div>
      <div class="acts"><button class="act pri" data-act="l-done" data-id="${esc(f.course)}" data-l="${esc(f.lesson)}" data-v="${mins}"><span>✓</span>Lesson finished</button><button class="act" data-act="sheet-close"><span>→</span>Not finished yet</button><button class="act" data-act="c-start" data-id="${esc(f.course)}" data-l="${esc(f.lesson)}"><span>↻</span>Another 25 min</button></div>`, '', { noFocus: true });
    return;
  }
  const t = get('tasks', f.id);
  ui.focus = null; saveUi(); clearInterval(focusTick); const el = $('#focus'); if (el) el.remove();
  if (t) save('tasks', Object.assign({}, t, { focusMin: (Number(t.focusMin) || 0) + mins }));
  const sk = list('skills').sort((a, b) => (Number(b.weeklyHours) || 0) - (Number(a.weeklyHours) || 0)).slice(0, 6);
  openSheet(auto ? 'Time is up 🎉' : 'Focus finished', `<div class="closeday"><div class="big">${mins}</div><div class="small">minutes on “${esc(t ? t.title : 'focus')}”</div></div>
    ${sk.length ? `<div class="small" style="margin:12px 0 6px">Also count it as practice for:</div><div class="pick">${sk.map(s => `<button data-act="f-skill" data-id="${esc(s.id)}" data-v="${mins}" dir="auto">${esc(s.title)}</button>`).join('')}</div>` : ''}
    <div class="acts" style="margin-top:12px">${t && isOpen(t) ? `<button class="act pri" data-act="t-done" data-id="${esc(t.id)}"><span>✓</span>Task is done</button>` : ''}<button class="act" data-act="sheet-close"><span>→</span>Keep it open</button><button class="act" data-act="f-again" data-id="${esc(f.id)}"><span>↻</span>Another 25 min</button></div>`, '', { noFocus: true });
}
/* ---- templates ---- */
const TEMPLATE_STARTERS = [
  { id: 'st-job', title: 'Job application', lines: 'Read the ad and list the must-have skills | 0\nTailor CV to the ad | 0\nWrite a short cover letter | 1\nSubmit the application | 1\nFollow up if no reply | 8' },
  { id: 'st-mock', title: 'IELTS mock test', lines: 'Listening test (timed) | 0\nReading test (timed) | 0\nWriting Task 1 and 2 (timed) | 1\nSpeaking recording | 1\nReview mistakes and log bands | 2' },
  { id: 'st-sql', title: 'SQL practice session', lines: 'Warm-up: 5 queries from last session | 0\nNew topic exercises | 0\nPass check and log result | 0' },
  { id: 'st-doc', title: 'Request a document', lines: 'Draft the request | 0\nSend the request | 1\nFollow up | 8\nFile the document and update Evidence | 15' },
  { id: 'st-week', title: 'Weekly reset', lines: 'Weekly review | 0\nPlan next week Top 3 | 0\nTidy inbox and notes | 0' }
];
function parseLines(txt) { return String(txt || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(.*?)\s*\|\s*\+?(\d+)\s*$/); return m ? { title: m[1], off: Number(m[2]) } : { title: l, off: null }; }); }
function useTemplate(tp) {
  const items = parseLines(tp.lines); const made = [];
  for (const it of items) made.push(save('tasks', { title: it.title, state: 'To do', priority: 'P2', owner: 'Me', due: it.off === null ? '' : addDays(today(), it.off), notes: 'From template: ' + tp.title }));
  closeSheet(); toast(`${made.length} tasks added`, 'Undo', () => made.forEach(r => remove('tasks', r.id)));
}
function vTemplates() {
  const mine = list('templates').sort((a, b) => String(a.title).localeCompare(String(b.title)));
  const card = (tp, own) => { const it = parseLines(tp.lines); return `<div class="row" data-act="tp-open" data-id="${esc(tp.id)}"><div class="main"><div class="t" dir="auto">${esc(tp.title)}</div><div class="m"><span>${it.length} tasks</span>${own ? '' : '<span class="chip">starter</span>'}</div></div><button class="btn small primary" data-act="tp-use" data-id="${esc(tp.id)}">Use</button></div>`; };
  return header('Templates', 'One tap creates a ready set of tasks with dates') + `
  <div class="toolbar"><button class="btn primary" data-act="tp-new">${I.plus} New template</button></div>
  ${mine.length ? `<div class="card"><h2>Mine</h2><div class="list">${mine.map(t => card(t, true)).join('')}</div></div>` : ''}
  <div class="card" style="margin-top:12px"><h2>Starters</h2><div class="list">${TEMPLATE_STARTERS.map(t => card(t, false)).join('')}</div></div>`;
}
const tplById = id => get('templates', id) || TEMPLATE_STARTERS.find(t => t.id === id);
function tplForm(tp) {
  const own = !!get('templates', tp.id);
  form(own ? 'Edit template' : tp.id ? 'Copy of ' + tp.title : 'New template', [{ k: 'title', label: 'Name', req: true }, { k: 'lines', label: 'Tasks, one per line', type: 'textarea', hint: 'Add “| 3” to set the due date 3 days after you use it.', ph: 'Tailor CV | 0\nSubmit | 1\nFollow up | 8' }],
    own ? tp : { title: tp.title || '', lines: tp.lines || '' }, v => { if (!v.title || !v.lines) return 'Add a name and at least one task.'; save('templates', Object.assign({}, own ? tp : {}, v)); toast('Template saved'); },
    { onDelete: own ? () => { remove('templates', tp.id); closeSheet(); } : null });
}

function taskSheet(id) {
  const t = get('tasks', id); if (!t) return;
  const open = isOpen(t), top = t.focusDate === today(), wait = stOf(t) === 'Waiting';
  const b = (act, ic, l, cls = '') => `<button class="act ${cls}" data-act="${act}" data-id="${esc(id)}"><span>${ic}</span>${l}</button>`;
  const info = [t.due ? 'Due ' + fmtDate(t.due, true) : '', t.nextAction ? '→ ' + t.nextAction : '', t.blockedBy ? 'Waiting on: ' + t.blockedBy : ''].filter(Boolean);
  openSheet(t.title, `${info.length ? `<div class="small" dir="auto" style="margin:-4px 0 12px">${info.map(esc).join('<br>')}</div>` : ''}
  <div class="acts">${open ? b('t-done', '✓', 'Done', 'pri') : b('t-done', '↺', 'Reopen', 'pri')}
  ${open ? b('t-top', '★', top ? 'Remove from Top 3' : 'Top 3 today') : ''}
  ${open ? b('t-today', '●', 'Do today') : ''}
  ${open ? b('t-tom', '→', 'Tomorrow') : ''}
  ${open ? b('t-week', '⇥', 'Next week') : ''}
  ${open ? `<label class="act"><span>📅</span>Pick a date<input type="date" data-change="t-date" data-id="${esc(id)}" value="${esc(t.due || '')}"></label>` : ''}
  ${open ? b('t-wait', wait ? '▶' : '⏸', wait ? 'Not waiting' : 'Waiting on someone') : ''}
  ${open ? b('t-focus', '◷', 'Focus 25 min') : ''}
  ${open ? b('t-repeat', '↻', t.repeat ? REPEATS.find(r => r[0] === t.repeat)[1] : 'Repeat…') : ''}
  ${b('t-edit', '✎', 'Edit details')}
  ${b('t-del', '🗑', 'Delete', 'danger')}</div>`, '', { noFocus: true });
}
const ITEM = {
  milestones: { name: 'milestone', form: r => FORMS.milestone(r), info: r => [r.status || 'Planned', r.target ? fmtDate(r.target, true) : ''],
    acts: r => [r.status === 'Done' ? ['↺', 'Reopen', { status: 'In progress', doneOn: '' }, 'pri'] : ['✓', 'Done', { status: 'Done', doneOn: today() }, 'pri'], ['▶', 'In progress', { status: 'In progress' }], ['●', 'At risk', { status: 'At risk' }], r.target ? ['⇥', 'Push 1 month', { target: (() => { const d = parseD(r.target); d.setMonth(d.getMonth() + 1); return dstr(d); })() }] : null] },
  immigration: { name: 'document', form: r => FORMS.immig(r), info: r => [r.status || 'Not started', r.expiry ? 'expires ' + fmtDate(r.expiry, true) : ''],
    acts: r => [['✓', 'Ready', { status: 'Ready' }, 'pri'], ['▶', 'Collecting', { status: 'Collecting' }], ['→', 'Submitted', { status: 'Submitted' }], ['✕', 'Not needed', { status: 'Not needed' }]] },
  evidence: { name: 'evidence item', form: r => FORMS.evidence(r), info: r => [r.status || 'MISSING', r.proves || ''],
    acts: r => [['→', 'Requested', { status: 'REQUESTED' }, 'pri'], ['↻', 'Recovered', { status: 'RECOVERED' }], ['✕', 'Not available', { status: 'NOT AVAILABLE' }]], note: 'Mark as verified only in Edit, once you hold the document.' },
  goals: { name: 'goal', form: r => FORMS.goal(r), info: r => [r.status || 'Not started', r.target ? 'target ' + fmtDate(r.target, true) : ''],
    acts: r => [['▶', 'In progress', { status: 'In progress' }], ['✓', 'On track', { status: 'On track' }], ['●', 'At risk', { status: 'At risk' }], ['★', 'Achieved', { status: 'Achieved' }]] },
  habits: { name: 'habit', form: r => FORMS.habit(r), info: r => [habSched(r), `${habitWeek(r)} of ${habDueCount(r, weekStart(), addDays(weekStart(), 6))} this week`],
    acts: r => { const d = Object.assign({}, r.done || {}); const t = today(); const on = !!d[t]; if (on) delete d[t]; else d[t] = true; return [['✓', on ? 'Undo today' : 'Done today', { done: d }, 'pri']]; } },
  skills: { name: 'skill', form: r => FORMS.skill(r), info: r => [r.status || 'Not started', r.weeklyHours ? r.weeklyHours + ' h/week' : ''], acts: () => [], extra: r => `<button class="act pri" data-act="sk-log" data-id="${esc(r.id)}"><span>◷</span>Log practice</button>` },
  events: { name: 'event', form: r => eventForm(r), info: r => [fmtDate(r.start, true) + (r.allDay ? '' : ' ' + fmtTime(r.start)), r.rrule ? 'repeats' : ''],
    acts: r => { if (r.rrule) return []; const sh = (s, n) => { if (!s) return s; const d = parseD(s); d.setDate(d.getDate() + n); return s.length <= 10 ? dstr(d) : `${dstr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}${tzOffset()}`; }; return [['→', 'Tomorrow', { start: sh(r.start, 1), end: sh(r.end, 1) }], ['⇥', 'Next week', { start: sh(r.start, 7), end: sh(r.end, 7) }]]; } }
};
function itemSheet(c, id) {
  const r = get(c, id), def = ITEM[c]; if (!r || !def) return;
  const info = def.info(r).filter(Boolean);
  const btn = x => x ? `<button class="act ${x[3] || ''}" data-act="i-set" data-c="${c}" data-id="${esc(id)}" data-p="${esc(JSON.stringify(x[2]))}"><span>${x[0]}</span>${x[1]}</button>` : '';
  openSheet(recTitle(r), `${info.length ? `<div class="small" dir="auto" style="margin:-4px 0 12px">${info.map(esc).join(' · ')}</div>` : ''}<div class="acts">${def.extra ? def.extra(r) : ''}${def.acts(r).map(btn).join('')}
    <button class="act" data-act="i-edit" data-c="${c}" data-id="${esc(id)}"><span>✎</span>Edit details</button><button class="act danger" data-act="i-del" data-c="${c}" data-id="${esc(id)}"><span>🗑</span>Delete</button></div>${def.note ? `<div class="small" style="margin-top:10px">${def.note}</div>` : ''}`, '', { noFocus: true });
}
function closeDay() {
  const t = today(), tm = addDays(t, 1), open = list('tasks').filter(isOpen);
  const left = open.filter(x => x.focusDate === t || x.due === t);
  const doneN = list('tasks').filter(x => !isOpen(x) && x.completedOn === t).length;
  openSheet('Close the day', `<div class="closeday"><div class="big">${doneN}</div><div class="small">done today</div></div>
  ${left.length ? `<div class="small" style="margin:10px 0 6px">${left.length} still open from today. They move to tomorrow:</div><div class="list">${left.map(x => `<div class="row"><div class="main"><div class="t" dir="auto">${esc(x.title)}</div></div></div>`).join('')}</div>` : '<div class="small" style="margin:10px 0">Nothing left over. Well done.</div>'}
  <div class="small" style="margin:14px 0 6px">How was today?</div><div class="moods">${[1, 2, 3, 4, 5].map(m => `<button data-act="mood" data-v="${m}">${MOODS[m]}</button>`).join('')}</div>
  <div class="f" style="margin-top:12px"><label>One line about today (optional)</label><input name="note" dir="auto" placeholder="e.g. CV section 2 finished"></div>`,
  `<button class="btn primary wide" data-act="form-save">${left.length ? 'Move to tomorrow and close' : 'Close the day'}</button>`, { noFocus: true, onSave: () => {
    const note = (sheetCtx.el.querySelector('[name=note]') || {}).value || '';
    for (const x of left) save('tasks', Object.assign({}, x, x.focusDate === t ? { focusDate: tm, due: x.due && x.due <= t ? tm : x.due } : { due: tm }));
    const ex = list('logs').find(l => l.type === 'closeout' && l.date === t) || {};
    save('logs', { ...ex, type: 'closeout', date: t, mood: sheetCtx.mood || ex.mood || '', title: 'Close-out ' + fmtDate(t), done: note.trim() || ex.done || '', notes: left.length ? 'Moved to tomorrow: ' + left.map(x => x.title).join('; ') : '' });
    closeSheet(); toast('Day closed. See you tomorrow.');
  } });
}
function logTimeSheet() {
  const sk = list('skills').sort((a, b) => (Number(b.weeklyHours) || 0) - (Number(a.weeklyHours) || 0) || String(a.title).localeCompare(String(b.title)));
  if (!sk.length) { toast('Add a skill first in Learning'); return; }
  const cur = ui.lastSkill && get('skills', ui.lastSkill) ? ui.lastSkill : sk[0].id;
  const used = new Set(list('sessions').map(s => s.skill)); const main = sk.filter((s, i) => s.id === cur || i < 5 || used.has(s.id)); const rest = sk.filter(s => !main.includes(s));
  const btn = s => `<button class="${s.id === cur ? 'on' : ''}" data-act="lt-skill" data-id="${esc(s.id)}" dir="auto">${esc(s.title)}</button>`;
  openSheet('Log practice', `<div class="small" style="margin-bottom:6px">Skill</div><div class="pick">${main.map(btn).join('')}</div>${rest.length ? `<details class="more" style="border:0;padding-top:4px;margin:4px 0 0"><summary>Other skills (${rest.length})</summary><div class="pick">${rest.map(btn).join('')}</div></details>` : ''}
  <div class="small" style="margin:14px 0 6px">How long? Tap to save.</div><div class="pick mins">${[15, 30, 45, 60, 90].map(m => `<button data-act="lt-min" data-v="${m}">${m} min</button>`).join('')}</div>`, '', { noFocus: true });
  sheetCtx.skill = cur;
}
function appSheet(id) {
  const a = get('applications', id); if (!a) return;
  const i = APP_STAGES.indexOf(a.stage || 'Saved'); const next = i >= 0 && i < 4 ? APP_STAGES[i + 1] : null;
  const b = (act, ic, l, extra = '', cls = '') => `<button class="act ${cls}" data-act="${act}" data-id="${esc(id)}" ${extra}><span>${ic}</span>${l}</button>`;
  openSheet(`${a.role || 'Role'} · ${a.company || ''}`, `<div class="small" style="margin:-4px 0 12px">Stage: <b>${esc(a.stage || 'Saved')}</b>${a.followUp ? ' · follow up ' + esc(fmtDate(a.followUp, true)) : ''}</div><div class="acts">
  ${next ? b('a-next', '→', 'Move to ' + next, '', 'pri') : ''}${b('a-fu', '⏰', 'Follow up in 1 week')}${b('a-fudone', '✓', 'Followed up today')}${b('a-rej', '✕', 'Rejected')}${b('a-edit', '✎', 'Edit details')}</div>`, '', { noFocus: true });
}
function completeTask(id) {
  const t = get('tasks', id); if (!t) return;
  if (DONE.has(t.state)) { if (confirm('Reopen this task?')) save('tasks', Object.assign({}, t, { state: 'To do', completedOn: '' })); return; }
  form('Complete: ' + t.title, [
    { html: t.criterion ? `<div class="card" style="margin-bottom:12px"><div class="small"><b>Completion criterion</b><br>${esc(t.criterion)}</div></div>` : '' },
    { k: 'state', label: 'Result', type: 'select', options: ['Done', 'Cancelled'], blank: false, def: 'Done' },
    { k: 'evidence', label: 'What shows it is done?', type: 'textarea', ph: 'File, link, result or date' },
    { k: 'verified', label: 'Verified by a document', type: 'check' }
  ], { evidence: t.evidence || '', verified: !!t.verified }, v => {
    if (v.state !== 'Cancelled' && !v.evidence) return 'Write one line of evidence first.';
    save('tasks', Object.assign({}, t, v, { completedOn: today() })); toast(v.state === 'Done' ? 'Done ✓' : 'Cancelled');
  });
}
function eventForm(e = {}, day) {
  const r = parseRule(e.rrule);
  const rec = Object.assign({ start: day ? day + 'T09:00' + tzOffset() : '', alarm: 15 }, e, { repeat: r.FREQ || '', interval: r.INTERVAL || '', byday: r.BYDAY || '', count: r.COUNT || '', until: r.UNTIL ? `${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}` : '', exlist: (e.exdates || []).map(dayOf).join(', ') });
  const fields = [
    { k: 'title', label: 'Title', req: true },
    [{ k: 'start', label: 'Starts', type: 'datetime' }, { k: 'end', label: 'Ends', type: 'datetime' }],
    [{ k: 'repeat', label: 'Repeats', type: 'select', options: [['DAILY', 'Daily'], ['WEEKLY', 'Weekly'], ['MONTHLY', 'Monthly'], ['YEARLY', 'Yearly']] }, { k: 'alarm', label: 'Reminder', type: 'select', options: [[0, 'None'], [5, '5 min before'], [15, '15 min before'], [30, '30 min before'], [60, '1 hour before'], [1440, '1 day before']], blank: false }],
    'MORE',
    { k: 'allDay', label: 'All-day event', type: 'check' },
    [{ k: 'interval', label: 'Every (n)', type: 'number' }, { k: 'count', label: 'Number of times', type: 'number' }],
    [{ k: 'byday', label: 'On days (weekly)', ph: 'e.g. TH or SA,TH' }, { k: 'until', label: 'Repeat until', type: 'date' }],
    { k: 'exlist', label: 'Skip these dates', ph: '2026-12-31, 2027-01-07', hint: 'Comma-separated dates on which a repeating event does not happen.' },
    { k: 'taskId', label: 'Linked task', type: 'select', options: () => list('tasks').filter(isOpen).map(t => [t.id, t.title]) },
    { k: 'notes', label: 'Notes', type: 'textarea' }
  ];
  formColl = 'events'; form(e.id ? 'Edit event' : 'New event', fields, rec, v => {
    if (!v.title || !v.start) return 'Title and start are required.';
    if (v.allDay) { v.start = v.start.slice(0, 10); v.end = v.end ? v.end.slice(0, 10) : ''; }
    else if (!v.end) { const d = new Date(v.start); if (!isNaN(d)) { d.setHours(d.getHours() + 1); v.end = fromInput(toInput(d.toISOString())); } }
    let rr = ''; if (v.repeat) { rr = 'FREQ=' + v.repeat; if (v.interval > 1) rr += ';INTERVAL=' + v.interval; if (v.byday && v.repeat === 'WEEKLY') rr += ';BYDAY=' + v.byday.toUpperCase().replace(/[^A-Z,]/g, ''); if (v.count) rr += ';COUNT=' + v.count; if (v.until) rr += ';UNTIL=' + v.until.replace(/-/g, '') + 'T235959Z'; }
    const ex = v.exlist ? v.exlist.split(/[,\s]+/).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)) : [];
    const out = Object.assign({}, e, { title: v.title, allDay: v.allDay, start: v.start, end: v.end, rrule: rr, exdates: ex, alarm: Number(v.alarm) || 0, taskId: v.taskId, notes: v.notes });
    save('events', out); toast('Saved');
  }, { onDelete: e.id ? () => { if (confirm('Delete this event?')) { remove('events', e.id); closeSheet(); } } : null });
}
function simpleForm(c, title, fields, rec) {
  formColl = c; form((rec.id ? 'Edit ' : 'New ') + title, fields, rec, v => { const req = fields.flat().find(f => f && f.req && !v[f.k]); if (req) return `${req.label} is required.`; save(c, Object.assign({}, rec, v)); toast('Saved'); },
    { onDelete: rec.id ? () => { if (confirm('Delete this ' + title + '?')) { remove(c, rec.id); closeSheet(); } } : null });
}
const FORMS = {
  product: r => simpleForm('products', 'product', [{ k: 'title', label: 'Product', req: true }, [{ k: 'type', label: 'Type', type: 'select', options: PROD_TYPES, blank: false, def: 'Book' }, { k: 'status', label: 'Status', type: 'select', options: PROD_STATES, blank: false, def: 'Idea' }], [{ k: 'price', label: 'Price', type: 'number', step: 0.01 }, { k: 'currency', label: 'Currency', ph: 'OMR, USD…' }], 'MORE', [{ k: 'platform', label: 'Sold on', ph: 'Amazon, website, YouTube…' }, { k: 'launch', label: 'Launch date', type: 'date' }], { k: 'link', label: 'Store link', type: 'url' }, { k: 'notes', label: 'Notes', type: 'textarea' }], r),
  habit: r => simpleForm('habits', 'habit', [{ k: 'title', label: 'Habit', req: true, ph: 'e.g. 30 min walk' }, { k: 'days', label: 'Which days', type: 'days' }, { k: 'areaId', label: 'Area of life', type: 'select', options: () => areas().map(a => [a.id, a.title]) }, [{ k: 'time', label: 'Time (optional)', type: 'time' }, { k: 'color', label: 'Colour', type: 'select', options: AREA_COL.map((c, i) => [i, ['Blue', 'Orange', 'Aqua', 'Yellow', 'Pink', 'Green', 'Violet', 'Red'][i]]), blank: false }], 'MORE', { k: 'goalId', label: 'Supports goal', type: 'select', options: goalOpts }, { k: 'why', label: 'Why this habit', type: 'textarea' }], Object.assign({ days: [0, 1, 2, 3, 4, 5, 6], color: list('habits').length % 8 }, r)),
  milestone: r => simpleForm('milestones', 'milestone', [{ k: 'title', label: 'Milestone', req: true, ph: 'e.g. Official IELTS 7.5 achieved' }, [{ k: 'target', label: 'Target date', type: 'date' }, { k: 'status', label: 'Status', type: 'select', options: MS_STATES, blank: false, def: 'Planned' }], 'MORE', [{ k: 'goalId', label: 'Goal', type: 'select', options: goalOpts }, { k: 'area', label: 'Area', type: 'select', options: AREAS }], { k: 'proof', label: 'How I will know it is achieved', type: 'textarea' }, { k: 'notes', label: 'Notes', type: 'textarea' }], r),
  application: r => simpleForm('applications', 'application', [[{ k: 'company', label: 'Company', req: true }, { k: 'role', label: 'Role', req: true }], [{ k: 'stage', label: 'Stage', type: 'select', options: APP_STAGES, blank: false, def: 'Saved' }, { k: 'appliedOn', label: 'Applied on', type: 'date' }], { k: 'followUp', label: 'Follow up on', type: 'date', hint: 'Appears in Today and the calendar.' }, 'MORE', [{ k: 'location', label: 'Location' }, { k: 'source', label: 'Found via', ph: 'LinkedIn, referral…' }], { k: 'link', label: 'Job ad link', type: 'url' }, [{ k: 'easy', label: 'Easy Apply', type: 'check' }, { k: 'contactEmail', label: 'Contact email', type: 'email' }], { k: 'contactUrl', label: 'Contact LinkedIn profile', type: 'url' }, [{ k: 'cvVersion', label: 'CV version used' }, { k: 'contact', label: 'Contact person' }], { k: 'notes', label: 'Notes', type: 'textarea' }], r),
  immig: r => simpleForm('immigration', 'document', [{ k: 'title', label: 'Document', req: true }, [{ k: 'status', label: 'Status', type: 'select', options: IMM_STATES, blank: false, def: 'Not started' }, { k: 'category', label: 'Category', type: 'select', options: IMM_CATS, blank: false, def: 'Other' }], { k: 'expiry', label: 'Expiry date (if any)', type: 'date' }, 'MORE', { k: 'source', label: 'Official requirement link', type: 'url' }, { k: 'evidenceId', label: 'Linked evidence item', type: 'select', options: () => list('evidence').map(e => [e.id, (e.code ? e.code + ' · ' : '') + e.title]) }, { k: 'notes', label: 'Notes', type: 'textarea' }], r),
  logtime: r => form('Log practice time', [[{ k: 'skill', label: 'Skill', type: 'select', options: skillOpts, blank: false }, { k: 'minutes', label: 'Minutes', type: 'number', step: 5, def: 30 }], { k: 'date', label: 'Date', type: 'date', def: today() }, 'MORE', { k: 'title', label: 'Title', ph: 'e.g. Reading test 3' }, { k: 'done', label: 'What I did', type: 'textarea' }], r, v => {
    if (!v.skill) return 'Add a skill first (Learning → Skill).'; if (!(Number(v.minutes) > 0)) return 'Enter the minutes.';
    const sk = get('skills', v.skill); save('sessions', Object.assign({ title: v.title || ((sk ? sk.title : 'Practice') + ' · ' + v.minutes + ' min'), result: 'Not a check' }, v)); toast('Logged ' + v.minutes + ' min');
  }),
  goal: r => simpleForm('goals', 'goal', [{ k: 'title', label: 'Goal', req: true }, [{ k: 'areaId', label: 'Area of life', type: 'select', options: () => areas().map(a => [a.id, a.title]) }, { k: 'target', label: 'Target date', type: 'date' }], { k: 'why', label: 'Why it matters', type: 'textarea', ph: 'The reason that keeps you going' }, 'MORE', { k: 'measure', label: 'How I will measure it', type: 'textarea' }, [{ k: 'status', label: 'Status', type: 'select', options: GOAL_STATES }, { k: 'code', label: 'Code', ph: 'G1' }], { k: 'success', label: 'Success criteria', type: 'textarea' }, { k: 'notes', label: 'Notes', type: 'textarea' }], Object.assign({}, r, !r.areaId && goalArea(r) ? { areaId: goalArea(r).id } : {})),
  project: r => simpleForm('projects', 'project', [{ k: 'title', label: 'Project', req: true }, [{ k: 'status', label: 'Status', type: 'select', options: PROJECT_STATES }, { k: 'target', label: 'Target date', type: 'date' }], 'MORE', [{ k: 'goalId', label: 'Goal', type: 'select', options: goalOpts }, { k: 'start', label: 'Start', type: 'date' }], { k: 'deliverable', label: 'Deliverable', type: 'textarea' }, { k: 'dependencies', label: 'Dependencies', type: 'textarea' }, { k: 'notes', label: 'Notes', type: 'textarea' }], r),
  skill: r => simpleForm('skills', 'skill', [{ k: 'title', label: 'Skill', req: true }, [{ k: 'status', label: 'Status', type: 'select', options: SKILL_STATES }, { k: 'weeklyHours', label: 'Hours per week', type: 'number', step: 0.5 }], 'MORE', [{ k: 'current', label: 'Level now (0-5)', type: 'number' }, { k: 'target', label: 'Target level', type: 'number' }], [{ k: 'priority', label: 'Priority', type: 'select', options: PRI }, { k: 'category', label: 'Category', type: 'select', options: ['Technical', 'Language', 'Domain', 'Commercial', 'Leadership'] }], { k: 'evidenceNeeded', label: 'Evidence of competence', type: 'textarea' }, { k: 'plan', label: 'Learning plan', type: 'big' }], r),
  session: r => simpleForm('sessions', 'session', [{ k: 'title', label: 'Session', req: true, ph: 'SQL S1: core queries' }, [{ k: 'date', label: 'Date', type: 'date', def: today() }, { k: 'minutes', label: 'Minutes', type: 'number', step: 5 }], [{ k: 'skill', label: 'Skill', type: 'select', options: skillOpts }, { k: 'result', label: 'Result', type: 'select', options: ['Pass', 'Partial', 'Not yet', 'Not a check'] }], 'MORE', { k: 'done', label: 'What I did', type: 'textarea' }, { k: 'number', label: 'Session no.', type: 'number' }, { k: 'difficulty', label: 'Difficulties / next time', type: 'textarea' }], r),
  ielts: r => simpleForm('ielts', 'IELTS entry', [[{ k: 'date', label: 'Date', type: 'date', def: today(), req: true }, { k: 'skill', label: 'Skill', type: 'select', options: ['Listening', 'Reading', 'Writing Task 1', 'Writing Task 2', 'Speaking', 'Overall'] }], [{ k: 'kind', label: 'Type', type: 'select', options: IELTS_KINDS, blank: false }, { k: 'band', label: 'Band / raw score', ph: 'e.g. 31/40 or 6.5' }], 'MORE', { k: 'assessor', label: 'Assessor / source' }, { k: 'feedback', label: 'Feedback by criterion', type: 'textarea' }, { k: 'actions', label: 'Next actions', type: 'textarea' }], r),
  evidence: r => simpleForm('evidence', 'evidence item', [{ k: 'title', label: 'Document', req: true }, { k: 'status', label: 'Status', type: 'select', options: EVIDENCE_STATES }, 'MORE', { k: 'code', label: 'ID', ph: 'A1' }, { k: 'why', label: 'Why it is needed', type: 'textarea' }, { k: 'proves', label: 'Exact facts it can prove', type: 'textarea' }, [{ k: 'conflicts', label: 'Related conflicts', ph: 'C1, C2' }, { k: 'priority', label: 'Priority', type: 'select', options: PRI }], { k: 'source', label: 'Likely source / issuer' }, { k: 'recovery', label: 'Recovery action', type: 'textarea' }, { k: 'alternative', label: 'Alternative (proposed, not confirmed accepted)', type: 'textarea' }, [{ k: 'target', label: 'Target date', type: 'date' }, { k: 'location', label: 'Where the file is stored', ph: 'Private vault, not this app' }], { k: 'notes', label: 'Notes', type: 'textarea' }], r),
  decision: r => simpleForm('decisions', 'decision', [{ k: 'title', label: 'Decision', req: true }, { k: 'decision', label: 'What was decided', type: 'textarea' }, 'MORE', [{ k: 'status', label: 'Status', type: 'select', options: DECISION_STATES }, { k: 'date', label: 'Date', type: 'date', def: today() }], { k: 'category', label: 'Category', type: 'select', options: ['Career', 'Migration', 'Learning', 'Finance', 'Tathmeer', 'Personal', 'System'] }, { k: 'evidence', label: 'Evidence used', type: 'textarea' }, { k: 'alternatives', label: 'Alternatives considered', type: 'textarea' }, { k: 'risks', label: 'Risks and assumptions', type: 'textarea' }, [{ k: 'nextAction', label: 'Next action' }, { k: 'review', label: 'Review date', type: 'date' }]], r),
  note: r => simpleForm('notes', 'document', [{ k: 'title', label: 'Title', req: true }, { k: 'body', label: 'Content', type: 'big' }, 'MORE', [{ k: 'tags', label: 'Tags', ph: 'CV, career' }, { k: 'pinned', label: 'Pin to top', type: 'check' }], { k: 'source', label: 'Original source link', type: 'url' }], r),
  logitem: r => simpleForm('logs', 'log', [{ k: 'date', label: 'Date', type: 'date', req: true }, { k: 'done', label: 'Today in one line', type: 'textarea' }, { k: 'mood', label: 'Mood', type: 'select', options: [[1, '😞'], [2, '🙁'], [3, '😐'], [4, '🙂'], [5, '😄']] }, 'MORE', { k: 'type', label: 'Type', type: 'select', options: ['closeout', 'weekly', 'monthly', 'session', 'note'] }, { k: 'title', label: 'Title' }, { k: 'blockers', label: 'Blockers', type: 'textarea' }, { k: 'notes', label: 'Notes', type: 'textarea' }], r)
};

function planDay(day, isCloseout) {
  const open = sortTasks(list('tasks').filter(isOpen));
  const chosen = new Set(open.filter(t => t.focusDate === day).map(t => t.id));
  const rows = open.map(t => `<label class="row" style="cursor:pointer"><input type="checkbox" name="pick" value="${esc(t.id)}" ${chosen.has(t.id) ? 'checked' : ''} style="width:22px;height:22px;margin-top:2px"><div class="main"><div class="t" dir="auto">${esc(t.title)}</div><div class="m">${priChip(t.priority)}${stateChip(t.state)}${dueChip(t)}</div></div></label>`).join('');
  const sug = suggestTop(day).map(t => t.id);
  const head0 = `<button class="btn small" data-act="suggest-pick" data-ids="${esc(sug.join(','))}" style="margin-bottom:10px">✨ Suggest three for me</button>`;
  const head = head0 + (isCloseout ? `<div class="f"><label>What got done today</label><textarea name="done" dir="auto" placeholder="Deliverables, not effort"></textarea></div><div class="f"><label>Blockers</label><textarea name="blockers" dir="auto"></textarea></div><div class="small" style="margin-bottom:8px">Choose up to three for <b>${esc(fmtDate(day))}</b>. Keep it achievable.</div>` : `<div class="small" style="margin-bottom:8px">Choose up to three for <b>${esc(fmtDate(day))}</b>.</div>`);
  openSheet(isCloseout ? 'Daily close-out' : 'Top 3 for ' + fmtDate(day), head + `<div class="list">${rows || '<div class="empty">No open tasks.</div>'}</div><div class="err" id="formerr"></div>`,
    '<button class="btn" data-act="sheet-close">Cancel</button><button class="btn primary" data-act="form-save">Save</button>',
    { noFocus: true, onSave: () => {
      const el = sheetCtx.el; const picks = [...el.querySelectorAll('input[name=pick]:checked')].map(x => x.value);
      if (picks.length > 3) { $('#formerr', el).textContent = `${picks.length} selected. Keep the Top 3 to three items.`; return; }
      for (const t of open) { const want = picks.includes(t.id); if (want && t.focusDate !== day) save('tasks', Object.assign({}, t, { focusDate: day })); if (!want && t.focusDate === day) save('tasks', Object.assign({}, t, { focusDate: '' })); }
      if (isCloseout) save('logs', { type: 'closeout', date: today(), title: 'Close-out ' + fmtDate(today()), done: el.querySelector('[name=done]').value.trim(), blockers: el.querySelector('[name=blockers]').value.trim(), notes: 'Top 3 for ' + day + ': ' + picks.map(id => (get('tasks', id) || {}).title).join('; ') });
      closeSheet(); toast(isCloseout ? 'Close-out saved' : 'Top 3 saved');
    } });
}
function weeklyReview() {
  const ws = weekStart(), t = today(), tasks = list('tasks');
  const done = tasks.filter(x => x.completedOn && inWeek(x.completedOn, ws) && stOf(x) === 'Done');
  const od = tasks.filter(x => isOpen(x) && x.due && x.due < t);
  const mins = weekMinutes(ws), tgt = weekTarget();
  const apps = list('applications').filter(a => inWeek(a.appliedOn, ws)).length;
  const ie = list('ielts').filter(e => inWeek(e.date, ws)).length;
  const stats = `${done.length} done · ${od.length} overdue · learning ${hrs(mins)}${tgt ? '/' + hrs(tgt) : ''} h · ${apps} applications · ${ie} IELTS entries`;
  const prev = list('logs').find(l => l.type === 'weekly' && l.week === ws) || {};
  form('Weekly review · ' + fmtDate(ws), [
    { html: `<div class="card" style="margin-bottom:12px"><div class="small"><b>This week</b><br>${esc(stats)}</div>${done.length ? `<div class="small" style="margin-top:6px">${done.slice(0, 8).map(x => '✓ ' + esc(x.title)).join('<br>')}</div>` : ''}</div>` },
    { k: 'done', label: '1. What moved forward?', type: 'textarea' },
    { k: 'blockers', label: '2. What slipped, and why?', type: 'textarea' },
    { k: 'next', label: '3. Top 3 for next week', type: 'textarea', ph: 'One per line' }
  ], prev, v => {
    save('logs', Object.assign({}, prev, { type: 'weekly', week: ws, date: t, title: 'Weekly review · ' + fmtDate(ws, true), done: v.done, blockers: v.blockers, next: v.next, notes: 'Next week: ' + (v.next || '') + '\n' + stats })); toast('Weekly review saved');
  });
}
const IMM_STARTER = [['Passport', 'Identity'], ['National ID / birth certificate', 'Identity'], ['Degree certificate', 'Education'], ['Academic transcripts', 'Education'], ['Employment reference letters', 'Employment'], ['English test report (IELTS)', 'English test'], ['Police clearance certificates', 'Police & health'], ['Medical examination', 'Police & health'], ['Proof of funds', 'Finance'], ['Passport-style photos', 'Forms & fees']];
function quickAdd() {
  openSheet('Add', `<div class="grid two">${[['morning', 'Morning Balance', I.today], ['closeout', 'Night Balance', I.moon], ['focus-free', 'Focus', I.timer], ['breathe', 'Breathe', I.calm], ['new-task', 'Task', I.tasks], ['new-habit', 'Habit', I.repeat], ['new-goal', 'Goal', I.flag], ['new-project', 'Board', I.board], ['new-event', 'Event', I.cal], ['log-time', 'Log practice', I.clock], ['new-course', 'Course', I.course], ['money-add', 'Update savings', I.money], ['weekly', 'Weekly review', I.review]].concat(isOwner() ? [['job-bulk', 'Add jobs', I.jobs], ['sprint', 'Job sprint', I.jobs], ['new-product', 'Product', I.money]] : []).map(([a, l, ic]) => `<button class="card row" data-act="${a}" style="align-items:center;text-align:left"><span style="width:24px;color:var(--brass-ink)">${ic}</span><div class="main"><div class="t">${l}</div></div></button>`).join('')}</div>`, '', { noFocus: true });
}

/* ---------------- navigation polish ---------------- */
document.addEventListener('click', e => { const l = e.target.closest('nav.tabs a, .side a'); if (l && l.getAttribute('href') === '#/' + route().page) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, true);
let ptr = null;
document.addEventListener('touchstart', e => { if (window.scrollY > 0 || sheetCtx || $('#focus') || e.touches.length > 1) return; ptr = { y: e.touches[0].clientY, d: 0 }; }, { passive: true });
document.addEventListener('touchmove', e => { if (!ptr) return; ptr.d = e.touches[0].clientY - ptr.y; let el = $('#ptr'); if (ptr.d > 10) { if (!el) { el = document.createElement('div'); el.id = 'ptr'; document.body.appendChild(el); } el.textContent = ptr.d > 80 ? '↻ Release to sync' : '↓ Pull to sync'; el.style.opacity = Math.min(1, ptr.d / 80); } }, { passive: true });
document.addEventListener('touchend', () => { if (!ptr) return; const d = ptr.d; ptr = null; const el = $('#ptr'); if (el) el.remove(); if (d > 80) { toast('Syncing…'); sync().then(() => toast(syncState === 'ok' ? 'Up to date' : 'Sync failed')); } });
document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select') || e.metaKey && e.key !== 'k' || e.ctrlKey || e.altKey) return;
  if ((e.metaKey && e.key === 'k') || e.key === '/') { e.preventDefault(); searchSheet(); return; }
  if (sheetCtx) return;
  const n = Number(e.key); if (n >= 1 && n <= 5) { location.hash = '#/' + NAV_MAIN[n - 1][0]; return; }
  if (e.key === 'n') { e.preventDefault(); if (route().page !== 'today' && route().page !== 'tasks') location.hash = '#/today'; setTimeout(() => { const i = document.querySelector('.qadd input'); if (i) i.focus(); }, 80); }
});

/* ---------------- swipe on task rows ---------------- */
let sw = null, swBlock = 0;
document.addEventListener('touchstart', e => { const r = e.target.closest('.row'); if (!r || !(r.dataset.act === 'task' || r.querySelector('.check')) || e.target.closest('.check') || e.touches.length > 1) return; sw = { r, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, on: false }; }, { passive: true });
document.addEventListener('touchmove', e => {
  if (!sw) return; const dx = e.touches[0].clientX - sw.x, dy = e.touches[0].clientY - sw.y;
  if (!sw.on) { if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; } if (Math.abs(dx) > 14) sw.on = true; else return; }
  sw.dx = dx; sw.r.style.transform = `translateX(${dx}px)`; sw.r.classList.toggle('sw-r', dx > 0); sw.r.classList.toggle('sw-l', dx < 0); sw.r.classList.toggle('sw-go', Math.abs(dx) > 90);
}, { passive: true });
document.addEventListener('touchend', () => {
  if (!sw) return; const { r, dx, on } = sw; sw = null; if (!on) return; swBlock = Date.now();
  r.style.transition = 'transform .18s'; r.style.transform = ''; setTimeout(() => { r.style.transition = ''; r.classList.remove('sw-r', 'sw-l', 'sw-go'); }, 200);
  const id = r.dataset.id; if (r.dataset.act !== 'task') { if (dx > 90) { const c = r.querySelector('.check'); if (c) c.click(); } return; }
  if (dx > 90) toggleDone(id); else if (dx < -90) { const t = get('tasks', id); if (t && isOpen(t)) setTask(id, Object.assign({ due: addDays(today(), 1) }, t.focusDate === today() ? { focusDate: addDays(today(), 1) } : {}), 'Moved to tomorrow'); }
});

/* ---------------- events (delegated) ---------------- */
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (Date.now() - swBlock < 400 && a.classList.contains('row')) return;
  const act = a.dataset.act, id = a.dataset.id;
  if ((act !== 'task' && act !== 'event' && a.tagName !== 'A') || a.getAttribute('href') === '#' || act === 'go') e.preventDefault();
  if (act === 'complete') { e.stopPropagation(); e.preventDefault(); return toggleDone(id); }
  const map = {
    'sheet-close': () => closeSheet(),
    'form-save': () => sheetCtx && sheetCtx.onSave && sheetCtx.onSave(),
    'form-del': () => sheetCtx && sheetCtx.onDelete && sheetCtx.onDelete(),
    task: () => taskSheet(id),
    't-done': () => toggleDone(id),
    't-top': () => { const t = get('tasks', id); if (!t) return; if (t.focusDate === today()) return setTask(id, { focusDate: '' }, 'Removed from Top 3'); if (list('tasks').filter(x => isOpen(x) && x.focusDate === today()).length >= 3) { toast('Top 3 is full. Remove one first.'); return; } setTask(id, { focusDate: today() }, '★ In Top 3 today'); },
    't-today': () => setTask(id, { due: today() }, 'Moved to today'),
    't-tom': () => { const t = get('tasks', id); setTask(id, Object.assign({ due: addDays(today(), 1) }, t && t.focusDate === today() ? { focusDate: addDays(today(), 1) } : {}), 'Moved to tomorrow'); },
    't-week': () => setTask(id, { due: addDays(weekStart(), 7), focusDate: '' }, 'Moved to next week'),
    't-wait': () => { const t = get('tasks', id); setTask(id, { state: stOf(t) === 'Waiting' ? 'To do' : 'Waiting' }, stOf(t) === 'Waiting' ? 'Back to To do' : 'Marked as waiting'); },
    't-edit': () => { closeSheet(true); taskForm(get('tasks', id) || {}); },
    't-del': () => { const t = get('tasks', id); remove('tasks', id); closeSheet(); toast('Deleted', 'Undo', () => save('tasks', Object.assign({}, t, { deleted: false }))); },
    qwhen: () => { ui.qWhen = ui.qWhen === a.dataset.v ? '' : a.dataset.v; saveUi(); render(); { const pv = document.querySelector('.qprev'), qi = document.querySelector('.qadd input'); if (pv && qi) pv.textContent = smartLabel(parseSmart(qi.value)); } const i = document.querySelector('.qadd input'); if (i && i.value) i.focus(); },
    'lt-skill': () => { sheetCtx.skill = id; ui.lastSkill = id; saveUi(); sheetCtx.el.querySelectorAll('[data-act="lt-skill"]').forEach(x => x.classList.toggle('on', x.dataset.id === id)); },
    'lt-min': () => { const sk = get('skills', sheetCtx.skill); const m = Number(a.dataset.v); ui.lastSkill = sheetCtx.skill; saveUi(); const r = save('sessions', { title: (sk ? sk.title : 'Practice') + ' · ' + m + ' min', skill: sheetCtx.skill, minutes: m, date: today(), result: 'Not a check' }); closeSheet(); toast(`Logged ${m} min`, 'Undo', () => remove('sessions', r.id)); },
    'a-next': () => { const x = get('applications', id); const i = APP_STAGES.indexOf(x.stage || 'Saved'); save('applications', Object.assign({}, x, { stage: APP_STAGES[i + 1], appliedOn: x.appliedOn || (APP_STAGES[i + 1] === 'Applied' ? today() : ''), followUp: addDays(today(), 7) })); closeSheet(); toast('Moved to ' + APP_STAGES[i + 1]); },
    'a-fu': () => { const x = get('applications', id); save('applications', Object.assign({}, x, { followUp: addDays(today(), 7) })); closeSheet(); toast('Follow-up in 1 week'); },
    'a-fudone': () => { const x = get('applications', id); save('applications', Object.assign({}, x, { followUp: addDays(today(), 7), notes: ((x.notes || '') + '\nFollowed up ' + today()).trim() })); closeSheet(); toast('Noted. Next follow-up in 1 week'); },
    'a-rej': () => { const x = get('applications', id); save('applications', Object.assign({}, x, { stage: 'Rejected', followUp: '' })); closeSheet(); toast('Marked rejected'); },
    'a-edit': () => { closeSheet(true); FORMS.application(get('applications', id) || {}); },
    'new-task': () => taskForm(a.dataset.day ? { scheduled: a.dataset.day + 'T09:00' + tzOffset(), due: a.dataset.day } : {}),
    event: () => { closeSheet(true); itemSheet('events', id); },
    'new-event': () => eventForm(a.dataset.time ? { start: `${a.dataset.day}T${a.dataset.time}${tzOffset()}` } : {}, a.dataset.day || today()),
    goal: () => { closeSheet(true); location.hash = '#/goal/' + encodeURIComponent(id); }, 'new-goal': () => FORMS.goal(a.dataset.area ? { areaId: a.dataset.area, status: 'In progress' } : { status: 'In progress' }),
    project: () => FORMS.project(get('projects', id) || {}), 'new-project': () => FORMS.project({}),
    skill: () => { closeSheet(true); itemSheet('skills', id); }, 'new-skill': () => FORMS.skill({}),
    session: () => FORMS.session(get('sessions', id) || {}), 'new-session': () => FORMS.session({}),
    ielts: () => FORMS.ielts(get('ielts', id) || {}), 'new-ielts': () => FORMS.ielts({ kind: IELTS_KINDS[0] }),
    evidence: () => { closeSheet(true); itemSheet('evidence', id); }, 'new-evidence': () => FORMS.evidence({}),
    decision: () => FORMS.decision(get('decisions', id) || {}), 'new-decision': () => FORMS.decision({}),
    'new-note': () => FORMS.note({}), 'edit-note': () => FORMS.note(get('notes', id) || {}),
    logitem: () => FORMS.logitem(get('logs', id) || {}),
    log: () => a.dataset.type === 'weekly' ? weeklyReview() : FORMS.logitem({ type: a.dataset.type, date: today(), title: (a.dataset.type === 'weekly' ? 'Weekly review ' : 'Monthly review ') + fmtDate(today(), true) }),
    filter: () => { if (route().page !== 'tasks') location.hash = '#/tasks'; else render(); },
    'cal-move': () => { const [y, m] = ui.calMonth.split('-').map(Number); const d = new Date(y, m - 1 + Number(a.dataset.d), 1); ui.calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; saveUi(); render(); },
    'cal-today': () => { ui.calMonth = today().slice(0, 7); ui.calSel = today(); saveUi(); render(); },
    'cal-sel': () => { ui.calSel = a.dataset.day; if (a.dataset.day.slice(0, 7) !== ui.calMonth) ui.calMonth = a.dataset.day.slice(0, 7); saveUi(); render(); },
    'plan-day': () => planDay(a.dataset.day || today(), false),
    closeout: () => nightSheet(),
    morning: () => morningSheet(),
    quick: () => quickAdd(),
    go: () => { closeSheet(true); location.hash = '#/' + a.dataset.to; if (a.dataset.to === 'plan') { ui.planTab = 'roadmap'; saveUi(); } },
    't-repeat': () => { closeSheet(true); repeatSheet(id); },
    't-rep': () => { const t = get('tasks', id); setTask(id, { repeat: a.dataset.v, due: t.due || (a.dataset.v ? today() : t.due) }, a.dataset.v ? 'Repeats ' + REPEATS.find(r => r[0] === a.dataset.v)[1].toLowerCase() : 'No longer repeats'); },
    't-focus': () => focusStart(id, 25),
    'f-pause': () => { ui.focus.pausedAt = Date.now(); saveUi(); focusShow(); },
    'f-resume': () => { ui.focus.paused += Date.now() - ui.focus.pausedAt; ui.focus.pausedAt = 0; saveUi(); focusShow(); },
    'f-plus': () => { ui.focus.dur += 5; ui.focus.finished = false; saveUi(); focusShow(); },
    'f-stop': () => focusEnd(false),
    'f-cancel': () => { if (!confirm('Cancel this focus session without saving the time?')) return; ui.focus = null; saveUi(); focusShow(); },
    'f-again': () => focusStart(id, 25),
    'f-skill': () => { const sk = get('skills', id); const m = Number(a.dataset.v); save('sessions', { title: (sk ? sk.title : 'Practice') + ' · focus ' + m + ' min', skill: id, minutes: m, date: today(), result: 'Not a check' }); a.classList.add('on'); a.disabled = true; toast(`Logged ${m} min to ${sk ? sk.title : 'practice'}`); },
    mood: () => { sheetCtx.mood = Number(a.dataset.v); sheetCtx.el.querySelectorAll('[data-act=mood]').forEach(x => x.classList.toggle('on', x === a)); },
    'suggest-pick': () => { const ids = (a.dataset.ids || '').split(',').filter(Boolean); sheetCtx.el.querySelectorAll('input[name=pick]').forEach(x => { x.checked = ids.includes(x.value); }); toast('Suggested. Change anything, then Save.'); },
    'accept-top': () => { const ids = (a.dataset.ids || '').split(',').filter(Boolean); ids.forEach(i => { const t = get('tasks', i); if (t) save('tasks', Object.assign({}, t, { focusDate: today() })); }); toast('Top 3 set ★'); },
    'tp-use': () => { e.stopPropagation(); const tp = tplById(id); if (tp) useTemplate(tp); },
    'tp-open': () => { const tp = tplById(id); if (!tp) return; const it = parseLines(tp.lines); openSheet(tp.title, `<div class="list">${it.map(x => `<div class="row"><div class="main"><div class="t" dir="auto">${esc(x.title)}</div><div class="m">${x.off === null ? 'no date' : x.off === 0 ? 'same day' : '+' + x.off + ' days'}</div></div></div>`).join('')}</div>`, `<button class="btn" data-act="tp-edit" data-id="${esc(id)}">${get('templates', id) ? 'Edit' : 'Copy and edit'}</button><button class="btn primary" data-act="tp-use" data-id="${esc(id)}">Use template</button>`, { noFocus: true }); },
    'tp-edit': () => { closeSheet(true); tplForm(tplById(id)); },
    'tp-new': () => tplForm({}),
    'from-tpl': () => { closeSheet(true); location.hash = '#/templates'; },
    'pk-add': () => pkRegister(),
    'pk-del': async () => { if (!confirm('Remove this passkey?')) return; try { await api('wa-del', { body: { id } }); pkRender(); } catch (err) { toast(err.message); } },
    restore: () => { const c = a.dataset.c, r = db[c] && db[c][id]; if (r) { save(c, Object.assign({}, r, { deleted: false })); toast('Restored'); } },
    history: () => historySheet(a.dataset.c, id),
    'hist-restore': () => { const v = sheetCtx && sheetCtx.versions && sheetCtx.versions[Number(a.dataset.i)]; if (v) { save(a.dataset.c, Object.assign({}, v, { deleted: false })); closeSheet(); toast('Earlier version restored'); } },
    'health-run': () => render(),
    'enc-backup': () => encBackup(),
    siri: () => siriSheet(),
    'siri-rotate': async () => { if (!confirm('Make new links? Shortcuts using the old links stop working until you paste the new ones.')) return; try { await api('shortkey', { method: 'POST', q: '&rotate=1', body: {} }); closeSheet(true); siriSheet(); } catch (err) { toast(err.message); } },
    'set-lang': () => { ui.lang = a.dataset.v; saveUi(); applyLang(); render(); },
    'new-course': () => newCourseSheet(a.dataset.area),
    'c-starter': () => { const s = COURSE_STARTERS.find(x => x.key === a.dataset.v); if (!s) return; const sk = list('skills').find(k => s.skill.test(k.title)); const r = save('courses', { areaId: ncArea(), title: s.title, status: s.gate ? 'Planned' : 'Active', skillId: sk ? sk.id : '', provider: s.provider, gate: s.gate, perWeek: s.perWeek, reviewEvery: 30, nextReview: addDays(today(), 30), lessons: s.lessons() }); closeSheet(); toast('Course created'); location.hash = '#/course/' + encodeURIComponent(r.id); },
    'c-from-note': () => { ui.ncArea = ncArea(); lessonsFromNote(id); },
    'c-blank': () => { const ar = ncArea(); closeSheet(true); courseForm({ status: 'Active', perWeek: 2, reviewEvery: 30, areaId: ar }); },
    'c-edit': () => courseForm(get('courses', id)),
    'c-lessons': () => { const c = get('courses', id); form('Edit lessons', [{ k: 'txt', label: 'Lessons, one per line (finished ones stay ticked)', type: 'big' }], { txt: cLessons(c).map(l => l.t).join('\n') }, v => { const old = cLessons(c); const lines = String(v.txt || '').split('\n').map(x => x.trim()).filter(Boolean); const used = new Set(); const ls = lines.map((t, i) => { const o = old.find(l => l.t === t && !used.has(l.id)); if (o) { used.add(o.id); return o; } return { id: 'l' + Date.now().toString(36) + i, t, done: false, doneOn: '' }; }); save('courses', Object.assign({}, c, { lessons: ls })); toast('Lessons saved'); }); },
    'c-tick': () => { lessonDone(id, a.dataset.l); },
    'l-done': () => { lessonDone(id, a.dataset.l, Number(a.dataset.v)); closeSheet(); toast('Lesson done ✓'); },
    'c-start': () => { e.stopPropagation(); courseStart(id, a.dataset.l); },
    'c-review': () => courseReview(id),
    'c-decide': () => { const c = get('courses', id); const note = (sheetCtx.el.querySelector('[name=rn]') || {}).value || ''; const d = { Active: 'Keep going', Paused: 'Paused', Done: 'Finished', Dropped: 'Dropped' }[a.dataset.v]; save('courses', Object.assign({}, c, { status: a.dataset.v, lastReview: today(), nextReview: ['Active', 'Paused'].includes(a.dataset.v) ? addDays(today(), Number(c.reviewEvery) || 30) : '', reviews: (c.reviews || []).concat([{ date: today(), decision: d, note: note.trim() }]) })); closeSheet(); toast('Review saved: ' + d); },
    setup: () => setupSheet(),
    'wheel-start': () => { closeSheet(true); ui.pTab = 'wheel'; saveUi(); location.hash = '#/progress'; if (areas().length) setTimeout(wheelFlow, 300); },
    'setup-mark': () => { ui.calDone = true; ui.siriDone = true; saveUi(); closeSheet(); render(); },
    'setup-hide': () => { ui.setupHidden = true; saveUi(); closeSheet(); render(); },
    'go-settings': () => { closeSheet(true); location.hash = '#/settings'; },
    'ics-setup': () => { closeSheet(true); location.hash = '#/settings'; setTimeout(() => { const b = document.querySelector('[data-act=ics]'); if (b) { b.click(); b.scrollIntoView({ block: 'center' }); } }, 300); },
    back: () => { const pg = route().page; if (pg === 'note') { ui.nTab = 'notes'; saveUi(); } if (pg === 'goal') { ui.pTab = 'goals'; saveUi(); } if (pg === 'area') { ui.pTab = 'wheel'; saveUi(); } location.hash = '#/' + (pg === 'note' ? 'notes' : ['course', 'report', 'goal', 'area'].includes(pg) ? 'progress' : ['health', 'trash', 'review'].includes(pg) ? 'settings' : 'more'); },
    'sub-tab': () => { ui[a.dataset.k] = a.dataset.t; saveUi(); const base = a.dataset.k === 'dTab' ? 'documents' : 'notes'; if (route().page !== base) location.hash = '#/' + base; else render(); },
    'toggle-sec': () => { const h = hidden(); if (h.has(a.dataset.v)) h.delete(a.dataset.v); else h.add(a.dataset.v); save('settings', Object.assign({}, prefs(), { id: 'prefs', hidden: [...h] })); },
    'i-set': () => { const c = a.dataset.c, r = get(c, id); if (!r) return; const before = Object.assign({}, r); save(c, Object.assign({}, r, JSON.parse(a.dataset.p))); closeSheet(); toast('Updated', 'Undo', () => save(c, before)); },
    'i-edit': () => { const c = a.dataset.c, r = get(c, id); closeSheet(true); if (r) ITEM[c].form(r); },
    'i-del': () => { const c = a.dataset.c, r = get(c, id); if (!r) return; remove(c, id); closeSheet(); toast('Deleted', 'Undo', () => save(c, Object.assign({}, r, { deleted: false }))); },
    'sk-log': () => { ui.lastSkill = id; saveUi(); closeSheet(true); logTimeSheet(); },
    'tour-ok': () => { ui.tourDone = true; saveUi(); closeSheet(); },
    'wheel-preset': () => { const p = WHEEL_PRESETS.find(x => x[0] === a.dataset.v); if (!p) return; p[2].forEach((t, i) => save('areas', { title: t, color: i % 8, order: i + 1, target: 8 })); toast('Areas ready. Now score them.'); setTimeout(wheelFlow, 300); },
    'wheel-test': () => { closeSheet(true); wheelFlow(); },
    'wt-pick': () => { a.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === a)); },
    'score-pick': () => { a.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === a)); },
    'areas-edit': () => areasEdit(),
    'area-form': () => { const ar = id ? get('areas', id) : {}; closeSheet(true); areaForm(ar || {}); },
    'area-open': () => { location.hash = '#/area/' + encodeURIComponent(id); },
    'cycle-new': () => cycleWizard(),
    'cy-area': () => { const on = [...a.parentElement.querySelectorAll('.on')]; if (!a.classList.contains('on') && on.length >= 3) { toast('Up to three focus areas'); return; } a.classList.toggle('on'); drawCyGoals(); },
    'cycle-edit': () => { const c = get('cycles', id); form('Edit cycle', [{ k: 'intention', label: 'Intention' }, [{ k: 'start', label: 'Start', type: 'date' }, { k: 'days', label: 'Days', type: 'number' }]], c, v => { save('cycles', Object.assign({}, c, v, { days: Number(v.days) || 40 })); }); },
    'cycle-end': () => { const c = get('cycles', id); if (!c) return; const st = cycleStats(c); form('Finish this cycle', [{ html: `<div class="small" style="margin-bottom:10px">${st.day} days · ${st.morning} mornings · ${st.night} nights${st.avg ? ` · average day ${st.avg}/10` : ''}</div>` }, { k: 'lesson', label: 'What did these days teach me?', type: 'textarea' }, { k: 'keep', label: 'What do I keep doing?' }], {}, v => { save('cycles', Object.assign({}, c, { status: 'done', ended: today(), review: v })); toast('Cycle finished. Retake your wheel.'); setTimeout(wheelFlow, 400); }); },
    'bal-chip': () => { const box = a.parentElement; if (box.dataset.name === 'top' && !a.classList.contains('on') && box.querySelectorAll('.on').length >= 3) { toast('Three is enough'); return; } a.classList.toggle('on'); },
    'bal-toggle': () => { const b = Object.assign({ m: {}, n: {} }, prefs().balance || {}); b[a.dataset.s] = Object.assign({}, b[a.dataset.s], { [a.dataset.k]: !balOn(a.dataset.s, a.dataset.k) }); save('settings', Object.assign({}, prefs(), { id: 'prefs', balance: b })); },
    'nc-area': () => { a.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === a)); },
    'goal-status': () => itemSheet('goals', id),
    'goal-edit': () => FORMS.goal(get('goals', id) || {}),
    'l-start': () => { e.preventDefault(); onboard(); },
    'l-signin': () => { e.preventDefault(); signInSheet(); },
    'l-pk': () => { closeSheet(true); pkLogin({ set textContent(v) { toast(v); } }); },
    'fl-next': () => flowNext(),
    'fl-skip': () => { flow.i++; flowDraw(); },
    'fl-back': () => { if (!flow) return; if (flow.i === 0) { if (flow.cls === 'onboard' || confirm('Leave the test? Your answers are not saved.')) flowClose(); return; } flowRead(); flow.i--; flowDraw(); },
    'fl-chip': () => { const k = a.dataset.k, v = a.dataset.v; if (a.dataset.multi) { const arr = flow.a[k] = (flow.a[k] || []).slice(); const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else { if (arr.length >= 4) { toast('Up to 4'); return; } arr.push(v); } } else flow.a[k] = v; flowRead(); flowDraw(); },
    'fl-score': () => { flow.a.scores = Object.assign({}, flow.a.scores, { [a.dataset.i]: Number(a.dataset.v) }); a.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === a)); const mw = $('#flow .wq-mini'); if (mw) mw.innerHTML = miniWheel(flow.cls === 'onboard' ? CLASSIC : areas().map(x => x.title), flow.a.scores, Number(a.dataset.i)); setTimeout(() => { if (flow) { flow.i++; flowDraw(); } }, 260); },
    'ob-skip': () => { flowRead(); flow.a.skip = true; flow.a.name = flow.a.name || ''; flow.i = flow.steps.length - 1; flowDraw(); },
    'ad-set': async () => { const d = Number(a.dataset.v); if (!d && !confirm('Stop access for this account now?')) return; try { await api('admin-set', { body: { id, days: d } }); toast(d ? `Access extended by ${d} days` : 'Access stopped'); vAdminFill(); } catch (err) { toast(err.message); } },
    'habit-open': () => habitSheet(id),
    'hab-day': () => { const h = get('habits', id); if (!h) return; const d = Object.assign({}, h.done || {}), k = a.dataset.d; if (k > today()) return; if (d[k]) delete d[k]; else d[k] = true; save('habits', Object.assign({}, h, { done: d })); if (k === today() && list('habits').filter(x => habDue(x, k)).every(x => (x === h ? d : x.done || {})[k])) celebrate(); },
    'day-tog': () => { a.classList.toggle('on'); const box = a.parentElement, inp = box.parentElement.querySelector(`input[name="${box.dataset.name}"]`); inp.value = [...box.querySelectorAll('.on')].map(b => b.dataset.v).join(','); },
    'day-preset': () => { const box = a.closest('.f').querySelector('.daypick'), vals = a.dataset.v.split(','); box.querySelectorAll('button').forEach(b => b.classList.toggle('on', vals.includes(b.dataset.v))); a.closest('.f').querySelector('input[type=hidden]').value = a.dataset.v; },
    irange: () => { ui.irange = Number(a.dataset.v); saveUi(); render(); },
    tday: () => { ui.tday = a.dataset.day === today() ? '' : a.dataset.day; saveUi(); if (route().page !== 'today') location.hash = '#/today'; else render(); window.scrollTo(0, 0); },
    'tday-move': () => { const base = ui.tday || today(); ui.tday = addDays(base, Number(a.dataset.d)); if (ui.tday === today()) ui.tday = ''; saveUi(); render(); },
    cv: () => { ui.calView = a.dataset.v; render.calScrolled = false; saveUi(); render(); },
    'cv-move': () => { const v = ui.calView || (window.innerWidth >= 900 ? 'week' : '3day'), s = ui.calSel || today(); if (v === 'month') { const d = parseD(s); d.setMonth(d.getMonth() + Number(a.dataset.d)); ui.calSel = dstr(d); ui.calMonth = ui.calSel.slice(0, 7); } else ui.calSel = addDays(s, Number(a.dataset.d) * (v === 'day' ? 1 : v === '3day' ? 3 : 7)); saveUi(); render(); },
    'cv-today': () => { ui.calSel = today(); ui.calMonth = today().slice(0, 7); render.calScrolled = false; saveUi(); render(); },
    'cal-pick': () => { ui.calSel = a.dataset.day; ui.calView = 'day'; saveUi(); render(); },
    'cal-slot': () => { const r = a.getBoundingClientRect(), y = e.clientY - r.top, mins = H0 * 60 + Math.floor(y / HOUR_PX * 2) * 30; eventForm({ start: `${a.dataset.day}T${fromMin(mins)}${tzOffset()}`, end: `${a.dataset.day}T${fromMin(mins + 60)}${tzOffset()}` }, a.dataset.day); },
    'focus-free': () => focusStart(null, 25, { label: 'Deep work' }),
    'f-mode': () => { const m = Number(a.dataset.m); Object.assign(ui.focus, { mode: a.dataset.v, dur: m, start: Date.now(), paused: 0, pausedAt: 0, finished: false }); saveUi(); focusShow(); },
    'f-scene': () => { ui.fScene = a.dataset.v; saveUi(); focusShow(); },
    'f-sound': () => { ambient(a.dataset.v); focusShow(); },
    product: () => productSheet(id), 'new-product': () => FORMS.product({ status: 'Idea', currency: prefs().currency || '' }), 'p-edit': () => { closeSheet(true); FORMS.product(get('products', id) || {}); },
    'p-sale': () => { const p = get('products', id); closeSheet(true); form('Record a sale', [[{ k: 'units', label: 'Units', type: 'number', def: 1 }, { k: 'amount', label: 'Amount', type: 'number', req: true }], { k: 'date', label: 'Date', type: 'date', def: today() }, { k: 'note', label: 'Note' }], { units: 1, date: today() }, v => { if (v.amount === '') return 'Enter the amount.'; save('products', Object.assign({}, p, { sales: (p.sales || []).concat([{ date: v.date || today(), units: Number(v.units) || 1, amount: Number(v.amount), note: v.note }]) })); toast('Sale recorded'); }); },
    'od-today': () => { const od = list('tasks').filter(x => isOpen(x) && x.due && x.due < today()); od.forEach(x => save('tasks', Object.assign({}, x, { due: today() }))); toast(`${od.length} moved to today`); },
    'p-tab': () => { ui.pTab = a.dataset.t; saveUi(); if (route().page !== 'progress') location.hash = '#/progress'; else render(); window.scrollTo(0, 0); },
    search: () => searchSheet(),
    'p-tab-insights': () => { closeSheet(true); ui.pTab = 'insights'; saveUi(); location.hash = '#/progress'; render(); },
    'next-lesson': () => { closeSheet(true); const c = courseLive().filter(x => cNext(x))[0]; if (c) courseStart(c.id); else toast('No course with a next lesson'); },
    'course-open': () => { closeSheet(true); location.hash = '#/course/' + encodeURIComponent(id); },
    'open-note': () => { closeSheet(true); location.hash = '#/note/' + encodeURIComponent(id); },
    print: () => window.print(),
    hab: () => { const h = get('habits', id); if (!h) return; const d = Object.assign({}, h.done || {}); const t = today(); if (d[t]) delete d[t]; else d[t] = true; save('habits', Object.assign({}, h, { done: d })); },
    'habit-tl': () => {},
    habit: () => { closeSheet(true); itemSheet('habits', id); }, 'new-habit': () => FORMS.habit({ perWeek: 7 }),
    'money-add': () => form('Update balance', [{ k: 'amount', label: 'Savings balance now', type: 'number', req: true }, 'MORE', { k: 'date', label: 'Date', type: 'date', def: today() }, { k: 'note', label: 'Note' }], { date: today() }, v => { if (v.amount === '') return 'Enter the amount.'; save('money', { amount: Number(v.amount), date: v.date || today(), note: v.note }); toast('Balance saved'); }),
    'money-edit': () => { const x = get('money', id); form('Edit balance', [{ k: 'amount', label: 'Amount', type: 'number', req: true }, { k: 'date', label: 'Date', type: 'date' }, { k: 'note', label: 'Note' }], x, v => { save('money', Object.assign({}, x, v, { amount: Number(v.amount) })); }, { onDelete: () => { remove('money', id); closeSheet(); } }); },
    'money-goal': () => form('Savings goal', [[{ k: 'savingsGoal', label: 'Goal amount', type: 'number' }, { k: 'currency', label: 'Currency', ph: 'OMR, CAD, AUD…' }]], prefs(), v => { save('settings', Object.assign({}, prefs(), { id: 'prefs', savingsGoal: v.savingsGoal, currency: v.currency })); }),
    'journal-new': () => { const ex = list('logs').find(l => l.type === 'closeout' && l.date === today()); FORMS.logitem(ex || { type: 'journal', date: today(), title: 'Journal ' + fmtDate(today()) }); },
    'plan-tab': () => { ui.planTab = a.dataset.t; saveUi(); render(); },
    'job-filter': () => { ui.jobFilter = ui.jobFilter === a.dataset.f && a.dataset.f !== 'active' ? 'active' : a.dataset.f; saveUi(); render(); },
    milestone: () => { closeSheet(true); itemSheet('milestones', id); }, 'new-milestone': () => FORMS.milestone(a.dataset.year ? { target: a.dataset.year + '-12-31' } : {}),
    'ms-done': () => { e.stopPropagation(); const m = get('milestones', id); if (m) save('milestones', Object.assign({}, m, { status: m.status === 'Done' ? 'In progress' : 'Done', doneOn: m.status === 'Done' ? '' : today() })); },
    'ms-from-goals': () => { let n = 0; for (const g of list('goals')) { if (!g.target || list('milestones').some(m => m.goalId === g.id)) continue; save('milestones', { title: g.title, target: g.target, goalId: g.id, status: 'Planned', area: g.area || '' }); n++; } toast(n ? `${n} milestone${n > 1 ? 's' : ''} created` : 'Every dated goal already has a milestone'); },
    vision: () => form('My vision', [{ k: 'visionName', label: 'Name of my vision', ph: 'e.g. MILAD 2031' }, { k: 'visionDate', label: 'Target date', type: 'date', req: true }, { k: 'visionText', label: 'In one line', type: 'textarea' }], { visionDate: visionDate(), visionName: prefs().visionName || '', visionText: prefs().visionText || '' }, v => { if (!v.visionDate) return 'Choose a date.'; save('settings', Object.assign({}, prefs(), { id: 'prefs' }, v)); }),
    application: () => a.dataset.kind === 'follow' || route().page === 'jobs' || route().page === 'today' || route().page === 'calendar' ? appSheet(id) : FORMS.application(get('applications', id) || {}), 'new-application': () => FORMS.application({ appliedOn: '', stage: 'Saved' }),
    immig: () => { closeSheet(true); itemSheet('immigration', id); }, 'new-immig': () => FORMS.immig({}),
    'imm-ready': () => { e.stopPropagation(); const x = get('immigration', id); if (x) save('immigration', Object.assign({}, x, { status: ['Ready', 'Submitted', 'Not needed'].includes(x.status) ? 'Collecting' : 'Ready' })); },
    'imm-starter': () => { if (!confirm('Add 10 common document types? They are generic placeholders; confirm each against the official checklist for your pathway.')) return; for (const [title, category] of IMM_STARTER) save('immigration', { title, category, status: 'Not started', notes: 'Generic starter item. Confirm the exact requirement on the official website.' }); },
    'log-time': () => { e.stopPropagation(); logTimeSheet(); },
    weekly: () => weeklyReview(),
    'set-theme': () => { ui.theme = a.dataset.v; saveUi(); applyTheme(); render(); },
    'set-size': () => { ui.size = a.dataset.v; saveUi(); applyTheme(); render(); },
    'push-on': async () => {
      try {
        const perm = await Notification.requestPermission(); if (perm !== 'granted') { toast('Notifications were not allowed. Change it in Settings → Notifications → MILAD 2031.'); return; }
        const reg = await navigator.serviceWorker.ready; const { key } = await api('vapid');
        const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(key) });
        await pushPost(sub); ui.pushOn = true; saveUi(); toast('Notifications on'); pushRender();
      } catch (err) { toast('Could not turn on: ' + err.message); }
    },
    'push-save': async () => { const s = await pushSub(); if (!s) return pushRender(); try { await pushPost(s); toast('Times saved'); } catch (err) { toast(err.message); } },
    'push-test': async () => { const s = await pushSub(); if (!s) return pushRender(); try { await pushPost(s); await api('pushtest', { body: { endpoint: s.endpoint } }); toast('Test sent. It should arrive in a few seconds.'); } catch (err) { toast(err.message); } },
    'push-off': async () => { const s = await pushSub(); if (s) { try { await api('pushunsub', { body: { endpoint: s.endpoint } }); } catch {} await s.unsubscribe().catch(() => {}); } toast('Notifications off'); pushRender(); },
    'sync-now': () => { toast('Syncing…'); sync().then(() => toast(syncState === 'ok' ? 'Up to date' : 'Sync failed: ' + lastError)); },
    reload: async () => { if (Object.keys(outbox).length && !confirm('Some changes have not synced yet. Reload anyway? Unsynced changes are kept and sent first.')) return; ls.del(K.rev); await sync(); render(); toast('Reloaded'); },
    export: () => { const blob = new Blob([JSON.stringify({ app: 'milad2031', version: 1, exportedAt: nowIso(), collections: db }, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = `milad2031-backup-${today()}.json`; ui.lastBackup = today(); saveUi(); document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); },
    ics: async () => { try { const j = await api('icskey'); const url = new URL(`${API}?action=ics&k=${j.key}`, location.href).href; ui.calDone = true; saveUi(); $('#icsbox').innerHTML = `<div class="mono" style="word-break:break-all;margin-bottom:8px">${esc(url)}</div><div class="btns"><button class="btn small" data-act="copy" data-text="${esc(url)}">Copy link</button><a class="btn small" href="${esc(url.replace(/^https?:/, 'webcal:'))}">Subscribe now</a></div><div style="margin-top:8px">iPhone/iPad: tap <b>Subscribe now</b>, or Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar, and paste the link. Keep this link private.</div>`; } catch (err) { toast(err.message === 'offline' ? 'You are offline' : err.message); } },
    copy: async () => { try { await navigator.clipboard.writeText(a.dataset.text); toast('Copied'); } catch { prompt('Copy this link', a.dataset.text); } },
    password: () => form('Change password', [{ k: 'current', label: 'Current password', type: 'password', req: true }, { k: 'next', label: 'New password (10+ characters)', type: 'password', req: true }], {}, v => { api('password', { body: v }).then(j => { ls.set(K.tok, j.token); toast('Password changed. Other devices must sign in again.'); }).catch(err => toast(err.message)); }),
    logout: async () => { if (!confirm('Sign out on this device? Data stays on the server.')) return; if (Object.keys(outbox).length) await sync(); try { await api('logout', { method: 'POST' }); } catch {} ls.del(K.tok); ls.del(K.db); ls.del(K.out); ls.del(K.rev); ls.del(K.user); me = null; db = blankDb(); outbox = {}; showLanding(); }
  };
  Object.assign(map, v7Acts(a, id, e), v71Acts(a, id), v8Acts(a, id), v9Acts(a, id), v9JobActs(a, id), pmActs(a, id), v91Acts(a, id), v10Acts(a, id), { 'board-open': () => { closeSheet(true); location.hash = '#/board/' + encodeURIComponent(id); }, 'habit-open-s': () => {} });
  if (map[act]) { if (act !== 'sheet-close' && act !== 'form-save' && act !== 'form-del' && sheetCtx && ['new-task', 'new-event', 'new-note', 'new-decision', 'new-evidence', 'new-session', 'closeout', 'log-time', 'new-application', 'new-milestone', 'new-immig', 'weekly', 'money-add', 'from-tpl', 'new-course', 'morning', 'new-goal', 'wheel-test', 'cycle-new', 'focus-free', 'new-habit'].includes(act)) closeSheet(true); map[act](); }
});
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.input; if (k) { ui[k] = e.target.value; saveUi(); if (e.target.dataset.norender) return; clearTimeout(render.t); render.t = setTimeout(render, 180); } });
document.addEventListener('change', e => {
  if (v7Change(e)) return;
  if (e.target.dataset && e.target.dataset.change === 't-date' && e.target.value) { setTask(e.target.dataset.id, { due: e.target.value }, 'Moved to ' + fmtDate(e.target.value)); return; }
  if (e.target.dataset && e.target.dataset.change === 'import') {
    const file = e.target.files[0]; if (!file) return;
    file.text().then(txt => {
      let j; try { j = JSON.parse(txt); } catch { return toast('Not a valid JSON file'); }
      if (j.enc) { decBackup(j).then(d => { importData(d); }).catch(err => toast(err.message)); return; }
      importData(j);
    });
    e.target.value = '';
  }
});
function importData(j) {
      const cols = j.collections || j; let n = 0, skipped = 0, gone = 0;
      const repl = Array.isArray(j.replace) ? j.replace.filter(c => COLS.includes(c)) : [];
      if (repl.length && !confirm(`This file replaces your ${repl.join(', ')}. The current ones go to Trash, where you can restore them. Continue?`)) return;
      for (const c of repl) { const keep = new Set(Object.values(cols[c] || {}).map(r => r && r.id)); for (const r of Object.values(db[c] || {})) { if (r && !r.deleted && !keep.has(r.id)) { const rec = Object.assign({}, r, { deleted: true, updatedAt: nowIso() }); db[c][r.id] = rec; outbox[c + ':' + r.id] = rec; gone++; } } }
      for (const c of COLS) { const src = cols[c]; if (!src) continue; for (const r of Array.isArray(src) ? src : Object.values(src)) { if (!r || !r.id) continue; const cur = db[c][r.id]; if (cur && String(cur.updatedAt) >= String(r.updatedAt || '')) { skipped++; continue; } const rec = Object.assign({ createdAt: nowIso() }, r, { updatedAt: r.updatedAt || nowIso() }); db[c][r.id] = rec; outbox[c + ':' + r.id] = rec; n++; } }
      migrate(); persist(); render(); queueSync(200); toast(`Imported ${n} records${gone ? `, moved ${gone} old ones to Trash` : ''}${skipped ? `, kept ${skipped} newer local records` : ''}`);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && sheetCtx && sheetCtx.onSave) sheetCtx.onSave(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { sync(); render(); } });
window.addEventListener('online', () => sync());
window.addEventListener('offline', () => setSyncState('off', 'offline'));
setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 45000);

/* ---------------- auth screens ---------------- */
/* ================= ME.Coach: landing, onboarding, account ================= */
const AREA_HINT = { 'Career': 'Work, growth and how much you enjoy it', 'Money': 'Income, savings and feeling secure', 'Health': 'Energy, sleep, fitness and food', 'Family': 'Time and closeness with your family', 'Relationships': 'Partner, friends and the people around you', 'Personal growth': 'Learning, mindset and your inner life', 'Fun & recreation': 'Play, hobbies, rest and joy', 'Home & environment': 'Your home, your space and your surroundings' };
const CLASSIC = WHEEL_PRESETS[0][2];
const FOCUS_OPTS = [['Career', 'Career', 'Career'], ['Money', 'Money', 'Money'], ['Health', 'Health', 'Health'], ['Learning', 'Learning', 'Personal growth'], ['Relationships', 'Relationships', 'Relationships'], ['Business', 'My business', 'Career'], ['Balance', 'More balance', '']];
const HABIT_OPTS = ['Walk or exercise', 'Read 20 minutes', 'Learn a language', 'Deep work', 'Meditate or pray', 'Sleep before 11', 'Drink 2 litres of water', 'Journal', 'Less phone', 'Call family'];
const GOAL_TPL = { 'Career': 'Take one career step every week', 'Money': 'Save a fixed amount every month', 'Health': 'Move 30 minutes, 4 days a week', 'Family': 'Make family time a weekly ritual', 'Relationships': 'Invest in one relationship each week', 'Personal growth': 'Learn something new every week', 'Fun & recreation': 'Plan guilt-free fun every week', 'Home & environment': 'Make my space calm and organised' };
const mideast = () => /Muscat|Dubai|Riyadh|Qatar|Bahrain|Kuwait|Tehran|Baghdad|Amman/.test(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
const brandMark = `<span class="mark">ME<b>.</b></span>`;
function showLanding(msg) {
  setTimeout(emiDock, 0);
  const site = document.getElementById('site');
  if (site) { closeSheet(true); document.documentElement.classList.remove('in-app'); $('#app').innerHTML = ''; document.title = 'ME.Coach · Your self-coaching app'; const q = new URLSearchParams(location.search); if (q.has('start')) onboard(); else if (q.has('signin')) signInSheet(msg); else if (msg) toast(msg); return; }
  closeSheet(true); const app = $('#app'); document.title = 'ME.Coach · Your self-coaching app';
  const feat = (ic, t, d) => `<div class="lf"><span class="lf-i">${ic}</span><b>${t}</b><p>${d}</p></div>`;
  app.innerHTML = `<div class="landing">
  <header class="l-top">${brandMark}<span>Coach</span><span style="flex:1"></span><button class="btn small ghost" data-act="l-signin">Sign in</button></header>
  <section class="l-hero"><div class="l-kicker">Based on the book <i>Self-Coaching Blueprint</i></div><h1>Your coach,<br>one minute a day.</h1>
    <p>Score your Wheel of Life, pick what matters for the next 40 days, and run a one-minute Morning and Night Balance. ME.Coach turns it into a visual plan you can follow every day.</p>
    <div class="btns l-cta"><button class="btn primary big" data-act="l-start">Start free for 7 days</button><button class="btn big" data-act="l-signin">I have an account</button></div>
    <div class="small">No card needed · 9 quick questions · your data stays yours</div>
    <div class="l-phone"><div class="l-wheel">${previewWheel()}</div></div></section>
  <section class="l-sec"><h2>Everything a coach would ask you, every day</h2><div class="l-grid">
    ${feat(I.prog, 'Wheel of Life', 'Score eight areas of life in a minute and see your balance as a wheel.')}
    ${feat(I.repeat, '40-day cycles', 'Pick 1–3 focus areas, set one goal each, and track 40 days on a single grid.')}
    ${feat(I.today, 'Morning & Night Balance', 'Expectation, focus and Top 3 in the morning. Score, carry-over and gratitude at night.')}
    ${feat(I.cal, 'Visual day planner', 'Your day as a timeline, with a calendar that feels like the one you already use.')}
    ${feat(I.tick, 'Habit tracker', 'Pick the days, tick with one tap, keep your streaks.')}
    ${feat(I.timer, 'Focus mode', 'A calm full-screen timer with ambient sound that logs your deep work.')}
    ${feat(I.health, 'Insights', 'Clear charts of your days, habits, focus and goals over time.')}
    ${feat(I.flag, 'Goals & milestones', 'Goals by area of life, broken into milestones and next actions.')}</div></section>
  <section class="l-sec l-steps"><h2>How it works</h2><ol><li><b>Answer 9 questions</b><span>About your focus, your goal and your habits. Two minutes.</span></li><li><b>Get your plan</b><span>Your wheel, your first 40-day cycle, goals, habits and today's Top 3, ready.</span></li><li><b>One minute, morning and night</b><span>Plan the day, close the day, and watch your wheel grow.</span></li></ol></section>
  <section class="l-sec l-book"><div class="l-bookc">SELF<br>COACHING<small>BLUEPRINT</small></div><div><h2>The method behind it</h2><p>ME.Coach applies the <i>Self-Coaching Blueprint</i> by Milad Ebrahimi: a repeatable plan to boost your efficiency and achieve your goals, with the Wheel of Life and daily Morning and Night Balance at its core.</p></div></section>
  <section class="l-sec l-faq"><h2>Questions</h2>
    <details><summary>What happens after 7 days?</summary><p>You keep read-only access to everything you created. To keep adding and editing, you subscribe. You can export your data at any time.</p></details>
    <details><summary>Does it work on iPhone and iPad?</summary><p>Yes. Open it in Safari, tap Share → Add to Home Screen, and it works like an app, including offline.</p></details>
    <details><summary>Who can see my data?</summary><p>Only you. Each account has its own private space on the server. Nothing is sold or shared.</p></details></section>
  <footer class="l-foot">${brandMark} Coach · <a href="https://miladebrahimi.me/">miladebrahimi.me</a></footer>
  ${msg ? `<div class="toast">${esc(msg)}</div>` : ''}</div>`;
  applyLang();
}
function previewWheel() {
  const sc = [7, 5, 6, 8, 6, 7, 4, 6], S = 260, cx = 130, cy = 130, R = 118, n = 8, st = 2 * Math.PI / n, pt = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  let g = ''; sc.forEach((s, i) => { const a0 = i * st + .015, a1 = (i + 1) * st - .015, w = r => { const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1); return `M${cx},${cy}L${x0.toFixed(1)},${y0.toFixed(1)}A${r},${r} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}Z`; }; g += `<path d="${w(R)}" class="wbg"/><path d="${w(R * s / 10)}" fill="${AREA_COL[i]}"/>`; });
  return `<svg viewBox="0 0 ${S} ${S}" class="wheel">${g}</svg>`;
}
function signInSheet(msg) {
  openSheet('Sign in', `${pkOk() ? '<button type="button" class="btn primary wide" data-act="l-pk" style="margin:0 0 14px">Sign in with Face ID</button>' : ''}<div id="gbtn" class="gbtn"></div><div class="small" style="text-align:center;margin-bottom:10px">or with your email</div>
    <div class="f"><label for="li-e">Email</label><input id="li-e" type="email" autocomplete="username" inputmode="email"></div><div class="f"><label for="li-p">Password</label><input id="li-p" type="password" autocomplete="current-password"></div><div class="err" id="li-err">${esc(msg || '')}</div>`,
    '<button class="btn primary wide" data-act="form-save">Sign in</button>', { onSave: async () => {
      const err = $('#li-err'); err.textContent = '…';
      try { const r = await api('login', { body: { email: $('#li-e').value, password: $('#li-p').value, device: device() } }); signedIn(r); }
      catch (e) { err.textContent = e.message === 'offline' ? 'No connection.' : e.message; }
    } });
  googleButton($('#gbtn'), c => googleSignIn(c), 'signin_with');
}
function signedIn(r, plan, isNew) {
  ls.set(K.tok, r.token); ls.del(K.rev); me = r.user; ls.set(K.user, me); closeSheet(true); const fl = $('#flow'); if (fl) fl.remove();
  if (plan) { db = blankDb(); outbox = {}; persist(); buildPlan(plan); }
  location.hash = '#/today'; signedIn.pk = (isNew || !!plan) && pkOk() && !ui.pkSet; start(); if (pkOk() && !ui.pkSet) setTimeout(() => isNew || plan ? securePrompt() : toast('Use Face ID next time?', 'Set up', pkRegister), isNew || plan ? 1600 : 2200);
}
/* ---------- full-screen flow (onboarding and the Wheel of Life test) ---------- */
let flow = null;
function flowOpen(f) { flow = Object.assign({ i: 0, a: {} }, f); let el = $('#flow'); if (!el) { el = document.createElement('div'); el.id = 'flow'; document.body.appendChild(el); } flowDraw(); }
function flowClose() { flow = null; const el = $('#flow'); if (el) el.remove(); }
function flowDraw() {
  const el = $('#flow'); if (!el || !flow) return; const st = flow.steps[flow.i], n = flow.steps.length;
  el.className = 'flow ' + (flow.cls || '');
  el.innerHTML = `<div class="fl-top"><button class="icon-btn" data-act="fl-back" aria-label="Back">${flow.i ? I.left : I.close}</button><div class="fl-bar"><i style="width:${Math.round(100 * (flow.i + 1) / n)}%"></i></div><span class="small">${flow.i + 1}/${n}</span></div>
    <div class="fl-body">${st.html(flow.a)}</div>${st.next === false ? '' : `<div class="fl-foot"><button class="btn primary wide" data-act="fl-next">${st.nextLabel || 'Continue'}</button>${st.skip ? `<button class="btn ghost wide" data-act="fl-skip">${st.skip}</button>` : ''}</div>`}`;
  const inp = el.querySelector('input:not([type=hidden])'); if (inp && window.innerWidth > 700) inp.focus();
  const gb = el.querySelector('#gbtn-ob'); if (gb) googleButton(gb, c => { flowRead(); googleSignIn(c, flow.a); }, 'signup_with');
  applyLang();
}
function flowRead() { const el = $('#flow'); if (!el) return; el.querySelectorAll('input[data-k],select[data-k],textarea[data-k]').forEach(x => { if (x.type === 'checkbox') return; flow.a[x.dataset.k] = x.value; }); }
function flowNext() { flowRead(); const st = flow.steps[flow.i]; const e = st.check ? st.check(flow.a) : ''; if (e) { toast(e); return; } if (st.done) { st.done(flow.a); return; } flow.i = Math.min(flow.steps.length - 1, flow.i + 1); flowDraw(); }
const chip = (k, v, l, on, multi) => `<button type="button" class="ochip ${on ? 'on' : ''}" data-act="fl-chip" data-k="${k}" data-v="${esc(v)}" ${multi ? 'data-multi="1"' : ''}>${esc(l)}</button>`;
function wheelSteps(names, prev) {
  return names.map((nm, i) => ({ next: false, html: a => { const cur = (a.scores || {})[i]; return `<div class="wq"><div class="wq-mini">${miniWheel(names, a.scores || {}, i)}</div><div class="wq-k" style="color:${AREA_COL[i % 8]}">${i + 1} of ${names.length}</div><h2>${esc(nm)}</h2><p class="small">${esc(AREA_HINT[nm] || 'How satisfied are you with this area right now?')}</p>
    <div class="wq-q">How satisfied are you today?</div><div class="wq-nums">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => `<button data-act="fl-score" data-i="${i}" data-v="${v}" class="${cur === v ? 'on' : ''}" style="--ac:${AREA_COL[i % 8]}">${v}</button>`).join('')}</div><div class="wq-scale small"><span>Not at all</span><span>Completely</span></div>${prev && prev[i] != null ? `<div class="small" style="margin-top:10px">Last time: ${prev[i]}</div>` : ''}</div>`; } }));
}
function miniWheel(names, sc, hi) {
  const S = 160, cx = 80, cy = 80, R = 74, n = names.length, st = 2 * Math.PI / n, pt = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  return `<svg viewBox="0 0 ${S} ${S}" class="wheel">${names.map((_, i) => { const a0 = i * st + .02, a1 = (i + 1) * st - .02, w = r => { if (r <= 0) return ''; const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1); return `M${cx},${cy}L${x0.toFixed(1)},${y0.toFixed(1)}A${r},${r} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}Z`; }; const s = sc[i]; return `<path d="${w(R)}" class="wbg ${i === hi ? 'hi' : ''}"/>${s ? `<path d="${w(R * s / 10)}" fill="${AREA_COL[i % 8]}"/>` : ''}`; }).join('')}</svg>`;
}
function wheelResult(names, sc) {
  const vals = names.map((nm, i) => [nm, sc[i] || 0, i]), avg = Math.round(10 * vals.reduce((s, x) => s + x[1], 0) / vals.length) / 10, srt = vals.slice().sort((x, y) => x[1] - y[1]);
  return `<div class="wres"><div class="wres-w">${miniWheel(names, sc, -1)}</div><div class="wres-n">${avg}<span>/10</span></div><div class="small">Your balance today</div>
    <div class="wres-g"><div><span class="small">Strongest</span><b style="color:${AREA_COL[srt[srt.length - 1][2] % 8]}">${esc(srt[srt.length - 1][0])} · ${srt[srt.length - 1][1]}</b></div><div><span class="small">Needs you most</span><b style="color:${AREA_COL[srt[0][2] % 8]}">${esc(srt[0][0])} · ${srt[0][1]}</b></div></div></div>`;
}
/* the professional Wheel of Life test, used in the app */
function wheelFlow() {
  if (!areas().length) { ui.pTab = 'wheel'; saveUi(); location.hash = '#/progress'; return; }
  const as = areas(), names = as.map(a => a.title), last = wheels()[0], prev = last ? as.map(a => areaScore(a.id, last)) : null;
  flowOpen({ cls: 'wheelflow', steps: wheelSteps(names, prev).concat([{ nextLabel: 'Save my wheel', html: a => wheelResult(names, a.scores || {}) + '<div class="f" style="margin-top:16px"><label>One line about this test (optional)</label><input data-k="note" dir="auto"></div>', done: a => {
    const scores = {}; as.forEach((x, i) => { if ((a.scores || {})[i]) scores[x.id] = a.scores[i]; }); if (!Object.keys(scores).length) { toast('Score at least one area'); return; }
    save('wheel', { date: today(), scores, note: a.note || '' }); flowClose(); ui.pTab = 'wheel'; saveUi(); location.hash = '#/progress'; render(); toast('Wheel saved'); celebrate();
  } }]) });
}
/* onboarding: 8 questions, then the account */
function onboard() {
  const steps = [
    { html: a => `<div class="ob"><div class="ob-k">${brandMark} Coach</div><h2>Hi! What should I call you?</h2><input class="big" data-k="name" value="${esc(a.name || '')}" placeholder="Your first name" autocomplete="given-name" dir="auto"><p class="small">I will ask 8 quick questions and build your plan. About two minutes.</p><button class="btn ghost small" data-act="ob-skip">Skip — I will import my own data</button></div>`, check: a => a.name && a.name.trim() ? '' : 'Tell me your name' },
    { html: a => `<div class="ob"><h2>${esc(a.name)}, what matters most in the next 3 months?</h2><div class="ochips">${FOCUS_OPTS.map(([v, l]) => chip('focus', v, l, a.focus === v)).join('')}</div></div>`, check: a => a.focus ? '' : 'Pick one' },
    { html: a => `<div class="ob"><h2>Your one big goal</h2><p class="small">Write it the way you would say it to a friend.</p><input class="big" data-k="goal" value="${esc(a.goal || '')}" placeholder="e.g. Get a new job abroad" dir="auto"><div class="small" style="margin:14px 0 6px">By when?</div><div class="ochips">${[['3', '3 months'], ['6', '6 months'], ['12', '12 months']].map(([v, l]) => chip('horizon', v, l, (a.horizon || '6') === v)).join('')}</div></div>`, check: a => a.goal && a.goal.trim() ? '' : 'Write your goal in a few words' },
    { html: () => `<div class="ob"><h2>Now, your Wheel of Life</h2><p>Eight quick taps. Score how satisfied you are with each area of your life today, from 1 to 10. There are no wrong answers.</p><div class="ob-wheel">${miniWheel(CLASSIC, {}, -1)}</div></div>`, nextLabel: 'Start the test' },
    ...wheelSteps(CLASSIC),
    { html: a => wheelResult(CLASSIC, a.scores || {}) },
    { html: a => `<div class="ob"><h2>Which habits do you want to build?</h2><p class="small">Pick up to 4. You can change days and times later.</p><div class="ochips">${HABIT_OPTS.map(h => chip('habits', h, h, (a.habits || []).includes(h), true)).join('')}</div></div>` },
    { html: a => `<div class="ob"><h2>When do you do your best work?</h2><div class="ochips">${[['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']].map(([v, l]) => chip('when', v, l, (a.when || 'morning') === v)).join('')}</div><div class="small" style="margin:16px 0 6px">Deep work per day</div><div class="ochips">${['1', '2', '3', '4'].map(v => chip('hours', v, v + ' h', (a.hours || '2') === v)).join('')}</div></div>` },
    { html: a => `<div class="ob"><h2>Your one-minute check-ins</h2><p class="small">Morning Balance plans your day. Night Balance closes it.</p><div class="fgrid"><div class="f"><label>Morning</label><input type="time" data-k="mt" value="${esc(a.mt || '07:30')}"></div><div class="f"><label>Night</label><input type="time" data-k="nt" value="${esc(a.nt || '21:30')}"></div></div></div>` },
    { html: a => `<div class="ob"><h2>Where do you want to be in a few years?</h2><p class="small">Optional, but it keeps you going.</p><input class="big" data-k="vision" value="${esc(a.vision || '')}" placeholder="e.g. Living and working in Ireland" dir="auto"><div class="small" style="margin:14px 0 6px">Target year</div><div class="ochips">${[1, 2, 3, 5].map(n => { const y = String(new Date().getFullYear() + n); return chip('year', y, y, (a.year || String(new Date().getFullYear() + 3)) === y); }).join('')}</div></div>` },
    { nextLabel: 'Create my account', html: a => { const pa = primaryArea(a); return `<div class="ob"><h2>Your plan is ready</h2><div class="plan"><div class="plan-r"><span class="sw" style="background:${AREA_COL[CLASSIC.indexOf(pa) % 8]}"></span><div><b dir="auto">${esc(a.goal)}</b><div class="small">${esc(pa)} · in ${a.horizon || 6} months</div></div></div><div class="plan-r"><span class="sw" style="background:${AREA_COL[CLASSIC.indexOf(secondArea(a)) % 8]}"></span><div><b>${esc(GOAL_TPL[secondArea(a)])}</b><div class="small">${esc(secondArea(a))} · your lowest score</div></div></div>${(a.habits || []).length ? `<div class="plan-r"><span class="sw"></span><div><b>${(a.habits || []).map(esc).join(' · ')}</b><div class="small">Daily habits</div></div></div>` : ''}<div class="plan-r"><span class="sw"></span><div><b>40-day cycle starts today</b><div class="small">Morning ${esc(a.mt || '07:30')} · Night ${esc(a.nt || '21:30')}</div></div></div></div>
      <div id="gbtn-ob" class="gbtn" style="margin-top:16px"></div><div class="f" style="margin-top:12px"><label>Email</label><input data-k="email" type="email" autocomplete="username" inputmode="email" value="${esc(a.email || '')}"></div><div class="f"><label>Password (8+ characters)</label><input data-k="pw" type="password" autocomplete="new-password"></div><p class="small">7 days free. No card needed.</p></div>`; },
      check: a => !/^\S+@\S+\.\S+$/.test(a.email || '') ? 'Enter your email' : (a.pw || '').length < 8 ? 'Use at least 8 characters' : '',
      done: async a => { try { const r = await api('signup', { body: { email: a.email, password: a.pw, name: a.name, device: device() } }); signedIn(r, a.skip ? null : a, true); } catch (e) { toast(e.message === 'offline' ? 'No connection.' : e.message); } } }
  ];
  flowOpen({ cls: 'onboard', steps, a: { horizon: '6', when: 'morning', hours: '2', habits: [] } });
}
function primaryArea(a) { const f = FOCUS_OPTS.find(x => x[0] === a.focus); if (f && f[2]) return f[2]; const sc = a.scores || {}; return CLASSIC.slice().sort((x, y) => (sc[CLASSIC.indexOf(x)] || 10) - (sc[CLASSIC.indexOf(y)] || 10))[0]; }
function secondArea(a) { const sc = a.scores || {}, p = primaryArea(a); return CLASSIC.filter(x => x !== p).sort((x, y) => (sc[CLASSIC.indexOf(x)] || 10) - (sc[CLASSIC.indexOf(y)] || 10))[0]; }
function buildPlan(a) {
  const t = today(), tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', ids = {};
  save('settings', { id: 'prefs', tz, visionName: a.vision ? 'My vision' : 'My vision', visionText: a.vision || '', visionDate: `${a.year || new Date().getFullYear() + 3}-12-31`, hidden: ['jobs', 'documents'], onboarded: t });
  CLASSIC.forEach((nm, i) => { ids[nm] = save('areas', { title: nm, color: i % 8, order: i + 1, target: 8 }).id; });
  const scores = {}; CLASSIC.forEach((nm, i) => { if ((a.scores || {})[i]) scores[ids[nm]] = a.scores[i]; }); if (Object.keys(scores).length) save('wheel', { date: t, scores });
  const p = primaryArea(a), s = secondArea(a), months = Number(a.horizon) || 6, tgt = (() => { const d = parseD(t); d.setMonth(d.getMonth() + months); return dstr(d); })();
  const g1 = save('goals', { title: a.goal.trim(), areaId: ids[p], area: p, target: tgt, status: 'In progress', why: a.vision ? 'It moves me towards: ' + a.vision : '' });
  const half = addDays(t, Math.round(daysBetween(t, tgt) / 2));
  [['Define the first concrete step', addDays(t, 7)], ['Halfway review', half], ['Goal reached', tgt]].forEach(([title, d]) => save('milestones', { title, target: d, goalId: g1.id, status: 'Planned' }));
  const g2 = save('goals', { title: GOAL_TPL[s], areaId: ids[s], area: s, target: addDays(t, 39), status: 'In progress' });
  save('cycles', { start: t, days: 40, focus: [ids[p], ids[s]], goals: [g1.id, g2.id], intention: 'In 40 days I will be closer to: ' + a.goal.trim(), status: 'active' });
  const wk = mideast() ? [0, 1, 2, 3, 4] : [1, 2, 3, 4, 5];
  (a.habits || []).slice(0, 4).forEach(h => save('habits', { title: h, perWeek: 7, days: [0, 1, 2, 3, 4, 5, 6] }));
  const at = { morning: '09:00', afternoon: '14:00', evening: '19:00' }[a.when || 'morning'], hrsN = Number(a.hours) || 2, [hh, mm] = at.split(':').map(Number);
  save('events', { title: 'Deep work', start: `${t}T${at}${tzOffset()}`, end: `${t}T${pad(hh + hrsN)}:${pad(mm)}${tzOffset()}`, rrule: 'FREQ=WEEKLY;BYDAY=' + wk.map(i => WD[i]).join(','), alarm: 10, kind: 'focus' });
  save('tasks', { title: 'Do your first Morning Balance', due: t, focusDate: t, state: 'To do', priority: 'P1', owner: 'Me' });
  save('tasks', { title: 'Take one step on: ' + a.goal.trim(), due: t, focusDate: t, state: 'To do', priority: 'P1', owner: 'Me', goalId: g1.id });
  save('tasks', { title: `Break “${a.goal.trim()}” into 3 milestones`, due: addDays(t, 1), state: 'To do', priority: 'P2', owner: 'Me', goalId: g1.id });
  ui.pushMorning = a.mt || '07:30'; ui.pushEvening = a.nt || '21:30'; ui.tourDone = false; saveUi();
}
function paywall() {
  if (sheetCtx && sheetCtx.paywall) return;
  plansSheet('Your free week has ended').then(() => { const b = sheetCtx && sheetCtx.el && sheetCtx.el.querySelector('.sheet-b'); if (b) b.insertAdjacentHTML('beforeend', '<button class="btn ghost wide" data-act="export" style="margin-top:8px">Download my data</button>'); });
}
function accountCard() {
  if (!me) return '';
  const left = me.trialEnds ? Math.max(0, Math.ceil((Date.parse(me.trialEnds) - Date.now()) / 86400000)) : 0;
  const plan = { owner: 'Owner', active: 'Subscribed' + (me.paidUntil ? ' until ' + fmtDate(me.paidUntil.slice(0, 10), true) : ''), trial: `Free trial · ${left} day${left === 1 ? '' : 's'} left`, expired: 'Trial ended' }[me.plan] || '';
  return `<div class="card acct"><div class="av">${esc((me.name || me.email || '?').slice(0, 1).toUpperCase())}</div><div class="main"><b dir="auto">${esc(me.name || 'Me')}</b><div class="small">${esc(me.email)} · ${esc(plan)}</div></div>${me.role === 'owner' ? '<a class="btn small" href="#/admin">Members</a>' : `<button class="btn small primary" data-act="plans">${me.plan === 'active' ? 'Plan' : 'Upgrade'}</button>`}</div>`;
}
async function vAdminFill() {
  const box = $('#adbox'); if (!box) return;
  try { const r = await api('admin-users'); if (!$('#adbox')) return;
    box.innerHTML = `<div class="small" style="margin-bottom:8px">${r.users.length} accounts · ${r.users.filter(u => u.plan === 'trial').length} on trial · ${r.users.filter(u => u.plan === 'active').length} subscribed</div><div class="list">${r.users.map(u => `<div class="row"><div class="av sm">${esc((u.name || u.email).slice(0, 1).toUpperCase())}</div><div class="main"><div class="t">${esc(u.name || '—')} <span class="small">${esc(u.email)}</span></div><div class="m"><span class="chip ${u.plan === 'active' || u.plan === 'owner' ? 's-done' : u.plan === 'trial' ? 's-wait' : 's-block'}">${esc(u.plan)}</span>${u.trialEnds && u.plan === 'trial' ? `<span>trial ends ${esc(fmtDate(u.trialEnds.slice(0, 10)))}</span>` : ''}${u.paidUntil ? `<span>paid until ${esc(fmtDate(u.paidUntil.slice(0, 10), true))}</span>` : ''}<span>${u.storeKB} KB</span></div></div>${u.role === 'owner' ? '' : `<div class="btns"><button class="btn small" data-act="ad-set" data-id="${esc(u.id)}" data-v="30">+30 d</button><button class="btn small" data-act="ad-set" data-id="${esc(u.id)}" data-v="365">+1 y</button><button class="btn small ghost danger" data-act="ad-set" data-id="${esc(u.id)}" data-v="0">Stop</button></div>`}</div>`).join('')}</div>`;
    const rq = $('#adreq'); if (rq) rq.innerHTML = (r.requests || []).length ? `<div class="card" style="margin-bottom:12px"><h2>Payment requests <span class="count">${r.requests.length}</span></h2><div class="list">${r.requests.map(q => `<div class="row"><div class="main"><div class="t">${esc(q.email)}</div><div class="m"><span class="chip s-wait">${esc(q.planName)}</span><span>${esc(q.at.slice(0, 16).replace('T', ' '))}</span></div></div><div class="btns"><button class="btn small primary" data-act="ad-set" data-id="${esc(q.uid)}" data-v="${q.plan === 'yearly' ? 366 : 31}">Activate</button></div></div>`).join('')}</div></div>` : '';
  } catch (e) { box.textContent = e.message; }
}
function vAdmin() { setTimeout(() => { vAdminFill(); adminConfig(); }, 0); return header('Members', 'Accounts, trials and subscriptions') + '<div id="adreq"></div><div class="card" id="adbox"><div class="empty">Loading…</div></div><div class="small" style="margin-top:8px">With a checkout link and the webhook, subscriptions activate automatically. Otherwise activate a subscriber here after they pay you.</div><div class="card" id="adcfg" style="margin-top:12px"><div class="empty">Loading…</div></div>'; }
async function refreshMe() { try { const r = await api('me'); me = r.user; ls.set(K.user, me); } catch {} }
async function showAuth(msg) {
  closeSheet(true);
  try { const s = await api('status'); if (s.billing) { BILL = s.billing; ls.set('mec.bill', BILL); } if (s.authed && s.token) { ls.set(K.tok, s.token); if (s.user) { me = s.user; ls.set(K.user, me); } return start(); } } catch (e) { if (e.message === 'offline' && ls.get(K.tok)) return start(); }
  showLanding(msg);
}
function migrate() {
  let n = 0;
  for (const t of Object.values(db.tasks)) {
    if (!t || t.deleted || !t.state || STATES.includes(t.state) || !LEGACY[t.state]) continue;
    const r = Object.assign({}, t, { state: LEGACY[t.state], legacyState: t.state, updatedAt: nowIso(), by: device() });
    if (t.state === 'Completed & Verified') r.verified = true;
    db.tasks[t.id] = r; outbox['tasks:' + t.id] = r; n++;
  }
  if (n) { persist(); queueSync(); }
}
function start() { setTimeout(emiDock, 400); document.documentElement.classList.add('in-app'); loadBilling(); document.title = 'ME.Coach'; db = normalise(ls.get(K.db, null)); outbox = ls.get(K.out, {}) || {}; migrate(); render.keepScroll = false; render(); sync(); refreshMe().then(() => { render(); if (me && me.access === false) paywall(); else if (sheetCtx && sheetCtx.paywall) closeSheet(); }); if (ui.focus) focusShow(); else if (!signedIn.pk) setTimeout(tour, 900); signedIn.pk = false; }

/* ================= v9: the book's method end to end, growth library, visual roadmap, friendlier Emi ================= */
const needGrowth = () => window.MEC_GROWTH ? Promise.resolve() : loadJs('assets/growth-data.js');
const BOOK8 = ['Business', 'Finance', 'Lifestyle', 'Health', 'Relationships', 'Social', 'Mental', 'Spiritual'];
/* new accounts use the 8 fields of the book */
CLASSIC.splice(0, CLASSIC.length, ...BOOK8); WHEEL_PRESETS[0][1] = 'Self-Coaching Blueprint wheel';
Object.assign(AREA_HINT, { Business: 'Your job or business, growth and how work feels', Finance: 'Income, savings and feeling secure', Lifestyle: 'Routine, fun, rest and your space', Health: 'Energy, sleep, fitness and body', Relationships: 'Family, partner and the people closest to you', Social: 'Friends, community and how you connect', Mental: 'Calm, focus, mindset and self-talk', Spiritual: 'Purpose, values, gratitude and faith' });
Object.assign(AREA_EMOJI, { Business: '💼', Finance: '💰', Lifestyle: '🎈', Relationships: '🏠', Social: '🤝', Mental: '🧠', Spiritual: '✨' });
Object.assign(GOAL_TPL, { Business: 'Take one career step every week', Finance: 'Save a fixed amount every month', Lifestyle: 'A daily routine I enjoy', Health: 'Move 30 minutes, 4 days a week', Relationships: 'Quality family time every week', Social: 'See a friend every week', Mental: 'A calm mind: 10 minutes a day', Spiritual: 'Daily gratitude and reflection' });
Object.assign(MICRO_TPL, { Business: MICRO_TPL.Career, Finance: MICRO_TPL.Money, Lifestyle: MICRO_TPL['Fun & recreation'], Relationships: MICRO_TPL.Family, Social: MICRO_TPL.Relationships, Mental: MICRO_TPL['Personal growth'], Spiritual: ['Write 3 things you are thankful for', 'Take 8 minutes for prayer or silence', 'Do one kind thing without being asked', 'Read one page that feeds your soul'] });
FOCUS_OPTS.splice(0, FOCUS_OPTS.length, ['Business', 'Career or business', 'Business'], ['Finance', 'Money', 'Finance'], ['Health', 'Health and energy', 'Health'], ['Relationships', 'Family and love', 'Relationships'], ['Mental', 'Calm and focus', 'Mental'], ['Lifestyle', 'A better routine', 'Lifestyle'], ['Social', 'Friends', 'Social'], ['Spiritual', 'Meaning and faith', 'Spiritual'], ['Balance', 'More balance', '']);
COURSE_STARTERS.splice(0, COURSE_STARTERS.length); if (!APP_STAGES.includes('Found')) APP_STAGES.push('Found');
const fieldKey = a => window.MEC_GROWTH ? MEC_GROWTH.fieldOf(a && a.title) : '';
const fieldName = k => ({ business: 'Business', finance: 'Finance', lifestyle: 'Lifestyle', health: 'Health', relationships: 'Relationships', social: 'Social', mental: 'Mental', spiritual: 'Spiritual' })[k] || '';
const areaForField = k => areas().find(a => fieldKey(a) === k) || null;

/* ---------- owner: his course list only (once) ---------- */
const MY_COURSES = [['Google Project Management', 'specializations/google-project-management', 'Active', '2026-11-20', 'Business'], ['Power BI Basics: Requirements to Visualizations', 'learn/powerbi-basics/home/welcome', 'Active', '2026-11-20', 'Business'],
  ['The Science of Mind and Decision Making', 'specializations/the-science-of-mind-and-decision-making', 'Planned', '2027-03-16', 'Mental'], ['Microsoft Power BI Data Analyst', 'specializations/microsoft-power-bi-data-analyst', 'Planned', '2027-03-16', 'Business'],
  ['Project Management and Planning', 'specializations/project-management-and-planning', 'Planned', '2027-03-16', 'Business'], ['Microsoft Project Management: Build Job-Ready Skills', 'specializations/microsoft-project-management', 'Planned', '2027-03-16', 'Business'],
  ['Meta Social Media Marketing', 'specializations/facebook-social-media-marketing', 'Planned', '2027-03-16', 'Business'], ['Google Business Intelligence', 'specializations/google-business-intelligence', 'Planned', '2027-03-16', 'Business'],
  ['Google AI Essentials', 'specializations/ai-essentials-google', 'Planned', '2027-03-16', 'Business'], ['Generative AI for Project Managers', 'specializations/generative-ai-for-project-managers', 'Planned', '2027-03-16', 'Business'],
  ['Google AI', 'specializations/google-ai', 'Planned', '2027-03-16', 'Business'], ['Next-Gen Workplace Automation with GenAI', 'specializations/next-gen-workplace-automation-with-genai', 'Planned', '2027-03-16', 'Business'],
  ['Google Data Analytics', 'specializations/google-data-analytics', 'Planned', '2027-03-16', 'Business'], ['Personality Types at Work', '', 'Planned', '2027-03-16', 'Mental']];
function ownerCourses() {
  if (!isOwner() || !ls.get(K.rev) || prefs().coursesV9) return;
  needGrowth().then(() => {
    if (prefs().coursesV9) return;
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''), keep = new Set();
    MY_COURSES.forEach(([title, path, status, target, f], i) => {
      const ex = list('courses').find(c => norm(c.title) === norm(title)) || get('courses', 'c-' + String(i + 1).padStart(2, '0'));
      const ar = areaForField(f.toLowerCase()) || areas()[0];
      const r = save('courses', Object.assign({ status, target, progress: 0, perWeek: 5, reviewEvery: 30, lessons: [] }, ex || { id: 'c-' + String(i + 1).padStart(2, '0') }, { title, link: path ? 'https://www.coursera.org/' + path : '', provider: path ? 'Coursera' : (ex && ex.provider) || '', order: i + 1, areaId: (ex && ex.areaId) || (ar ? ar.id : '') }));
      keep.add(r.id);
    });
    let gone = 0; list('courses').filter(c => !keep.has(c.id)).forEach(c => { remove('courses', c.id); gone++; });
    save('settings', Object.assign({}, prefs(), { id: 'prefs', coursesV9: today() }));
    toast(`Your ${MY_COURSES.length} Coursera courses are in Learning${gone ? ` · ${gone} other courses moved to Trash` : ''}`);
  });
}

/* ---------- the Balance Wheel Test from the book: 8 fields × 10 keywords ---------- */
function wheelChooser() {
  openSheet('Wheel of Life test', `<div class="wchoose"><button class="wc" data-act="bt-start"><span class="wc-i">📘</span><b>The full book test</b><span class="small">80 questions · about 8 minutes · the exact Balance Wheel Test from <i>Self-Coaching Blueprint</i>, with a score for every keyword</span><em>Recommended</em></button>
    <button class="wc" data-act="wq-start"><span class="wc-i">⚡</span><b>Quick check</b><span class="small">8 taps · 1 minute · one score per area</span></button></div>`, '', { noFocus: true });
}
function bookTest() {
  needGrowth().then(() => {
    const G = MEC_GROWTH, draft = ui.btDraft && ui.btDraft.v === 1 ? ui.btDraft : { v: 1, s: {} };
    const step = f => ({ next: true, nextLabel: 'Next area', html: a => { const sc = a.s[f.key] || [], tot = sc.reduce((s, x) => s + (x || 0), 0), n = sc.filter(Boolean).length;
      return `<div class="bt"><div class="bt-h" style="--ac:${AREA_COL[BOOK8.indexOf(f.name) % 8]}"><span class="bt-e">${f.emoji}</span><div><div class="small">${BOOK8.indexOf(f.name) + 1} of 8 · ${esc(f.hint)}</div><h2>${esc(f.label)}</h2></div><div class="bt-avg">${n ? (Math.round(10 * tot / n) / 10) : '–'}<small>avg</small></div></div>
      <p class="small">Rate each statement from 1 to 10. The higher the score, the more you agree. Be honest: no one else will see it.</p>
      ${f.rows.map((r, i) => `<div class="bt-q ${sc[i] ? 'ok' : ''}"><div class="bt-t"><span class="bt-n">${i + 1}</span><span>${esc(r.q)}<em>${esc(r.k)}</em></span></div><div class="bt-nums">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => `<button data-act="bt-score" data-f="${f.key}" data-i="${i}" data-v="${v}" class="${sc[i] === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>`).join('')}</div>`; },
      check: a => (a.s[f.key] || []).filter(Boolean).length < 10 ? 'Score all 10 statements' : '' });
    flowOpen({ cls: 'wheelflow booktest', a: draft, steps: [{ nextLabel: 'Begin the test', html: () => `<div class="ob"><div class="ob-k">📘 Self-Coaching Blueprint · Chapter 2</div><h2>The Balance Wheel Test</h2><p>Eight fields, ten statements each. Score every statement from 1 to 10 based on your life right now. Take your time and trust your inner voice.</p><div class="ob-wheel">${miniWheel(BOOK8, {}, -1)}</div><p class="small">Your answers are saved as you go. You can stop and continue later.</p></div>` },
      ...G.fields.map(step),
      { nextLabel: 'Save my wheel', html: a => bookResultHtml(a.s), done: a => bookSave(a.s) }] });
  });
}
function bookAvg(s, k) { const sc = (s[k] || []).filter(Boolean); return sc.length ? Math.round(10 * sc.reduce((x, y) => x + y, 0) / sc.length) / 10 : null; }
function bookResultHtml(s) {
  const G = MEC_GROWTH, avgs = BOOK8.map((n, i) => bookAvg(s, G.fields[i].key)), sc = {}; avgs.forEach((v, i) => { if (v != null) sc[i] = v; });
  const all = avgs.filter(v => v != null), avg = all.length ? Math.round(10 * all.reduce((a, b) => a + b, 0) / all.length) / 10 : 0;
  const weak = G.fields.flatMap(f => f.rows.map((r, i) => [f, r.k, (s[f.key] || [])[i] || 0])).filter(x => x[2]).sort((a, b) => a[2] - b[2]).slice(0, 5);
  return `<div class="wres"><div class="wres-w">${miniWheel(BOOK8, sc, -1)}</div><div class="wres-n">${avg}<span>/10</span></div><div class="small">The state of balance in my life · ${esc(fmtDate(today(), true))}</div></div>
  <div class="bt-res">${G.fields.map((f, i) => `<div class="bt-r"><span>${f.emoji} ${esc(f.name)}</span><i><b style="width:${(avgs[i] || 0) * 10}%;background:${AREA_COL[i]}"></b></i><em>${avgs[i] ?? '–'}</em></div>`).join('')}</div>
  ${weak.length ? `<div class="card" style="margin-top:12px"><h2>Keywords that need you most</h2><div class="pick">${weak.map(([f, k, v]) => `<span class="kwchip">${f.emoji} ${esc(k)} <b>${v}</b></span>`).join('')}</div><p class="small" style="margin-bottom:0">Next, the book’s Step 1: choose a field and a keyword, then turn it into a 40-day goal with micro-actions.</p></div>` : ''}`;
}
function bookSave(s) {
  const G = MEC_GROWTH, scores = {}, book = {};
  G.fields.forEach(f => { if ((s[f.key] || []).filter(Boolean).length) book[f.key] = s[f.key].slice(0, 10); });
  areas().forEach(a => { const k = fieldKey(a); const v = k && bookAvg(s, k); if (v != null && v !== '') scores[a.id] = v; });
  if (!Object.keys(book).length) { toast('Score at least one field'); return; }
  save('wheel', { date: today(), scores, book, kind: 'book' }); delete ui.btDraft; saveUi(); flowClose();
  toast('Your Balance Wheel is saved'); celebrate(); emiReact('test', 'Wheel done! Now let’s pick what to grow in the next 40 days.');
  location.hash = '#/life'; setTimeout(() => goalWizard(), 900);
}
const bookLatest = () => wheels().find(w => w.book) || null;
function kwScores(fk) { const w = bookLatest(); if (!w || !w.book || !w.book[fk] || !window.MEC_GROWTH) return []; const f = MEC_GROWTH.field(fk); return f.rows.map((r, i) => [r.k, w.book[fk][i] || 0, r.q]); }
function kwCard(a) {
  const fk = fieldKey(a), ks = kwScores(fk); if (!ks.length) return `<div class="card kwcard"><h2>📘 Keywords</h2><p class="small">Take the full book test to see a score for each of the 10 keywords in ${esc(a.title)}.</p><button class="btn small primary" data-act="bt-start">Take the book test</button></div>`;
  return `<div class="card kwcard"><h2>📘 Keywords <span class="count">${esc(fmtDate(bookLatest().date))}</span></h2><div class="kwbars">${ks.slice().sort((x, y) => x[1] - y[1]).map(([k, v, q]) => `<button class="kwb" data-act="gw-kw" data-a="${esc(a.id)}" data-k="${esc(k)}" title="${esc(q)}"><span>${esc(k)}</span><i><b style="width:${v * 10}%;background:${areaColor(a)}"></b></i><em>${v}</em></button>`).join('')}</div><p class="small" style="margin:8px 0 0">Tap a keyword to turn it into a 40-day goal.</p></div>`;
}

/* ---------- Goal to Micro-Action: the five steps from Chapter 3 ---------- */
function goalWizard(preArea, preKw, fromGoal) {
  needGrowth().then(() => {
    const G = MEC_GROWTH, as = areas(); if (!as.length) { toast('Set up your areas first'); return; }
    const low = as.filter(a => areaScore(a.id) != null).sort((a, b) => areaScore(a.id) - areaScore(b.id))[0];
    const fg = fromGoal && get('goals', fromGoal); const a0 = { pattern: preArea ? 'Intention' : 'Balance', area: preArea || (low || as[0]).id, kw: preKw || '', days: '40', micro: [], counts: {}, syms: {}, goal: fg ? fg.title : '', fromGoal: fg ? fg.id : '' };
    const ar = st => get('areas', st.area), fk = st => fieldKey(ar(st)) || 'lifestyle';
    const kwList = st => { const sc = kwScores(fk(st)); const f = G.field(fk(st)); return f.rows.map((r, i) => [r.k, sc.length ? sc[i][1] : null]).sort((x, y) => (x[1] ?? 11) - (y[1] ?? 11)); };
    const ideas = st => { const kws = st.kw ? [st.kw] : kwList(st).slice(0, 3).map(x => x[0]); const a = ar(st); return [...new Set((st.aiIdeas || []).concat(kws.flatMap(k => G.KW[k] || []).concat((G.LIB[fk(st)] || []).filter(x => x.kind === 'habit').map(x => x.t)).concat((MICRO_TPL[a && a.title] || []).map(x => x.replace(/“?\{g\}”?/g, 'my goal')))))].slice(0, 16); };
    const defCount = days => Math.round(Number(days) * 5 / 7);
    flowOpen({ cls: 'goalflow', a: a0, steps: [
      { html: st => `<div class="ob"><div class="ob-k">Step 1 · Choosing a field</div><h2>Which area of your life do you want to change?</h2>
        <div class="small" style="margin:6px 0">Pattern</div><div class="ochips">${[['Balance', 'Balance · my lowest score'], ['Intention', 'Intention · where I want to invest'], ['Aggression', 'Aggression · most crucial right now']].map(([v, l]) => chip('pattern', v, l, st.pattern === v)).join('')}</div>
        <div class="gw-areas">${as.map(a => `<button class="gw-a ${st.area === a.id ? 'on' : ''}" data-act="gw-area" data-id="${esc(a.id)}" style="--ac:${areaColor(a)}"><span>${areaEmoji(a)}</span><b dir="auto">${esc(a.title)}</b><em>${areaScore(a.id) ?? '–'}</em></button>`).join('')}</div></div>` },
      { html: st => `<div class="ob"><div class="ob-k">Step 1 · Keyword</div><h2>Which keyword in ${esc(ar(st).title)} do you want to improve?</h2><p class="small">${kwScores(fk(st)).length ? 'Sorted from your lowest score in the book test.' : 'Take the full book test later to see your score for each keyword.'}</p>
        <div class="ochips">${kwList(st).map(([k, v]) => chip('kw', k, k + (v != null ? ' · ' + v : ''), st.kw === k)).join('')}</div></div>`, check: st => st.kw ? '' : 'Pick one keyword' },
      { html: st => { const pp = (G.PAIN[fk(st)] || []); return `<div class="ob"><div class="ob-k">Step 2 · Pain and pleasure</div><h2>What do you not want any more?</h2><div class="ochips">${pp.map(([p]) => chip('pain', p, p, st.pain === p)).join('')}</div><input class="big" data-k="painTxt" value="${esc(st.painTxt || '')}" placeholder="Or in your own words (optional)" dir="auto">
        <h2 style="margin-top:18px">What do you want to experience instead?</h2><div class="ochips">${pp.map(([, q]) => chip('goal', q, q, st.goal === q)).join('')}${chip('goal', 'Better ' + st.kw.toLowerCase(), 'Better ' + st.kw.toLowerCase(), st.goal === 'Better ' + st.kw.toLowerCase())}</div><input class="big" data-k="goalTxt" value="${esc(st.goalTxt || '')}" placeholder="Or write your goal in your words" dir="auto"></div>`; }, check: st => { st.goal = (st.goalTxt || '').trim() || st.goal || ''; st.pain = (st.painTxt || '').trim() || st.pain || ''; return st.goal ? '' : 'Pick or write what you want instead'; } },
      { html: st => `<div class="ob"><div class="ob-k">Step 2 · Timeline</div><h2>By when?</h2><p class="small">The book recommends 40 days: short enough to stay focused, long enough to change.</p><div class="ochips">${[['40', '40 days (recommended)'], ['90', '3 months'], ['180', '6 months'], ['365', '1 year']].map(([v, l]) => chip('days', v, l, st.days === v)).join('')}</div>
        <div class="gw-goal" style="--ac:${areaColor(ar(st))}"><span>${areaEmoji(ar(st))}</span><div><b dir="auto">${esc(st.goal)}</b><div class="small">${esc(ar(st).title)} · ${esc(st.kw)} · by ${esc(fmtDate(addDays(today(), Number(st.days) - 1), true))}</div></div></div></div>` },
      { html: st => `<div class="ob"><div class="ob-k">Step 3 · Micro-actions</div><h2>What can you do every day to get there?</h2><p class="small">Pick up to 3 small actions. Until an action is a micro-action, it is hard to do every day.</p>
        <div class="gw-mic">${ideas(st).concat(st.micro.filter(m => !ideas(st).includes(m))).map(m => `<button class="${st.micro.includes(m) ? 'on' : ''}" data-act="gw-mic" data-v="${esc(m)}" dir="auto">${st.micro.includes(m) ? '✓ ' : ''}${esc(m)}</button>`).join('')}</div>
        <form class="qadd" data-form="gw-own" style="margin-top:10px"><input name="q" placeholder="Or write your own…" dir="auto" autocomplete="off"><button class="btn primary" type="submit">${I.plus}</button></form><button class="btn small" data-act="gw-ai" style="margin-top:8px">✨ More ideas with AI</button></div>`, check: st => st.micro.length ? '' : 'Pick at least one micro-action' },
      { html: st => `<div class="ob"><div class="ob-k">Step 4 · Number of actions</div><h2>How many times in the next ${st.days} days?</h2>${st.micro.map((m, i) => { const c = Number(st.counts[i]) || defCount(st.days); return `<div class="gw-cnt"><div dir="auto">${esc(m)}</div><div class="nums sm">${[...new Set([5, 10, 20, defCount(st.days), Number(st.days)])].sort((x, y) => x - y).map(v => `<button data-act="gw-count" data-i="${i}" data-v="${v}" class="${c === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>`; }).join('')}<p class="small">${defCount(st.days)} = five days a week. ${st.days} = every day.</p></div>` },
      { html: st => `<div class="ob"><div class="ob-k">Step 5 · Action symbol</div><h2>Give each action a symbol</h2><p class="small">You will see it every morning in “My improvement action”.</p>${st.micro.map((m, i) => { const s = st.syms[i] || G.SYMBOLS[i]; return `<div class="gw-cnt"><div dir="auto"><b class="gw-sym">${esc(s)}</b> ${esc(m)}</div><div class="gw-syms">${G.SYMBOLS.map(x => `<button data-act="gw-sym" data-i="${i}" data-v="${esc(x)}" class="${s === x ? 'on' : ''}">${x}</button>`).join('')}</div></div>`; }).join('')}</div>` },
      { nextLabel: 'Create my goal', html: st => `<div class="ob"><div class="ob-k">Goal to Micro-Action table</div><h2>Your plan</h2><div class="gmtable"><div class="gm-top" style="--ac:${areaColor(ar(st))}"><span>${areaEmoji(ar(st))} ${esc(ar(st).title)} · ${esc(st.kw)}</span><b dir="auto">${esc(st.goal)}</b><span>by ${esc(fmtDate(addDays(today(), Number(st.days) - 1), true))}</span></div><div class="gm-h"><span>Sample</span><span>Micro-action</span><span>Count</span></div>${st.micro.map((m, i) => `<div class="gm-r"><span class="gw-sym">${esc(st.syms[i] || G.SYMBOLS[i])}</span><span dir="auto">${esc(m)}</span><span>× ${Number(st.counts[i]) || defCount(st.days)}</span></div>`).join('')}</div>
        <p class="small">Each morning you choose your improvement actions, each night you tick what you did. ME.Coach counts every action towards your goal.</p></div>`,
        done: st => {
          const t = today(), tgt = addDays(t, Number(st.days) - 1), a = ar(st);
          const plan = st.micro.map((m, i) => ({ id: 'p' + i + Math.random().toString(36).slice(2, 6), t: m, count: Number(st.counts[i]) || defCount(st.days), sym: st.syms[i] || G.SYMBOLS[i], done: {} }));
          const base = st.fromGoal && get('goals', st.fromGoal); const g = save('goals', Object.assign({}, base || {}, { title: st.goal.trim(), areaId: a.id, area: a.title, target: tgt, status: 'In progress', keyword: st.kw, pattern: st.pattern, pain: (st.pain || '').trim(), why: st.pain ? 'Instead of: ' + st.pain.trim() : '', measure: plan.map(p => `${p.sym} ${p.t} × ${p.count}`).join(' · '), plan, method: 'book' }));
          save('milestones', { title: 'Halfway check: day ' + Math.round(Number(st.days) / 2), target: addDays(t, Math.round(Number(st.days) / 2) - 1), goalId: g.id, status: 'Planned', area: a.title });
          save('milestones', { title: 'Goal reached: ' + st.goal.trim(), target: tgt, goalId: g.id, status: 'Planned', area: a.title });
          const c = activeCycle(); if (c) save('cycles', Object.assign({}, c, { goals: [...new Set([...(c.goals || []), g.id])], focus: [...new Set([...(c.focus || []), a.id])] }));
          else save('cycles', { start: t, days: 40, focus: [a.id], goals: [g.id], intention: 'In 40 days: ' + st.goal.trim(), status: 'active' });
          flowClose(); toast('Goal created with ' + plan.length + ' micro-actions'); celebrate(); location.hash = '#/goal/' + encodeURIComponent(g.id);
        } }
    ] });
  });
}

/* ---------- micro-actions: plan items count towards the goal ---------- */
const livePlanGoals = () => list('goals').filter(g => Array.isArray(g.plan) && g.plan.length && !['Done', 'Achieved', 'Dropped', 'Cancelled'].includes(g.status));
const pDone = p => Object.keys(p.done || {}).length;
function planItems() { return livePlanGoals().flatMap(g => g.plan.map(p => ({ g, p, key: g.id + ':' + p.id }))); }
const _microTodayV8 = microToday;
microToday = function () {
  const t = today(), m = logOf('morning'), chosen = (m && m.impIds) || null, items = planItems();
  let pick = chosen ? items.filter(x => chosen.includes(x.key)) : items.slice().sort((x, y) => (pDone(x.p) / x.p.count) - (pDone(y.p) / y.p.count)).filter((x, i, arr) => arr.findIndex(z => z.g.id === x.g.id) === i).slice(0, 3);
  if (!chosen && pick.length < 3) pick = pick.concat(items.filter(x => !pick.includes(x)).slice(0, 3 - pick.length));
  const out = pick.map(x => ({ g: x.g, t: x.p.t, sym: x.p.sym, pid: x.p.id, key: x.key, done: !!(x.p.done || {})[t], n: pDone(x.p), count: x.p.count }));
  const legacy = _microTodayV8().filter(x => !(Array.isArray(x.g.plan) && x.g.plan.length));
  return out.concat(legacy).slice(0, Math.max(3, out.length));
};
microCard = function () {
  const ms = microToday(); if (!ms.length) return `<div class="card microcard"><h2>${I.bolt} My improvement actions</h2><div class="empty">Turn a goal into daily micro-actions, the way the book does it.<div class="btns" style="justify-content:center;margin-top:8px"><button class="btn primary small" data-act="goal-wizard">Plan a goal in 5 steps</button></div></div></div>`;
  return `<div class="card microcard"><h2>${I.bolt} My improvement actions <span class="count">${ms.filter(m => m.done).length}/${ms.length}</span><span style="flex:1"></span><button class="btn small ghost" data-act="imp-pick">Change</button></h2><div class="list">${ms.map(m => { const a = goalArea(m.g); return `<div class="row micro ${m.done ? 'done' : ''}" style="--ac:${a ? areaColor(a) : 'var(--line)'}"><button class="check ${m.done ? 'done' : ''}" data-act="${m.pid ? 'plan-done' : 'micro-done'}" data-id="${esc(m.g.id)}" data-p="${esc(m.pid || '')}" aria-label="Done">${I.tick}</button>${m.sym ? `<span class="psym">${esc(m.sym)}</span>` : ''}<div class="main"><div class="t" dir="auto">${esc(m.t)}</div><div class="m"><span dir="auto">${esc(m.g.title)}</span>${m.count ? `<span>${m.n}/${m.count}</span>` : ''}</div></div>${m.done || m.pid ? '' : `<button class="icon-btn" data-act="micro-shuffle" data-id="${esc(m.g.id)}" aria-label="Another step">↻</button>`}</div>`; }).join('')}</div></div>`;
};
function impPickSheet() {
  const items = planItems(), m = logOf('morning') || {}, cur = (m.impIds || microToday().filter(x => x.key).map(x => x.key));
  if (!items.length) { goalWizard(); return; }
  openSheet('My improvement actions today', `<p class="small" style="margin-top:0">Pick up to three. Each one you do earns a point in today’s assessment.</p><div class="list">${items.map(x => `<label class="row"><input type="checkbox" name="imp" value="${esc(x.key)}" ${cur.includes(x.key) ? 'checked' : ''} style="width:20px;height:20px"><span class="psym">${esc(x.p.sym)}</span><div class="main"><div class="t" dir="auto">${esc(x.p.t)}</div><div class="m"><span dir="auto">${esc(x.g.title)}</span><span>${pDone(x.p)}/${x.p.count}</span></div></div></label>`).join('')}</div>`,
    '<button class="btn primary wide" data-act="form-save">Save</button>', { noFocus: true, onSave: () => { const ids = [...sheetCtx.el.querySelectorAll('[name=imp]:checked')].map(x => x.value); if (ids.length > 3) { toast('Three is enough'); return; } const ex = logOf('morning'); save('logs', Object.assign({ type: 'morning', date: today(), title: 'Morning Balance ' + fmtDate(today()) }, ex || {}, { impIds: ids })); closeSheet(); } });
}
function planToggle(gid, pid, day = today(), force) {
  const g = get('goals', gid); if (!g || !Array.isArray(g.plan)) return;
  const plan = g.plan.map(p => { if (p.id !== pid) return p; const d = Object.assign({}, p.done || {}); const on = force != null ? force : !d[day]; if (on) d[day] = true; else delete d[day]; return Object.assign({}, p, { done: d }); });
  save('goals', Object.assign({}, g, { plan })); const p = plan.find(x => x.id === pid);
  if (p && p.done[day] && force == null) { const n = pDone(p); emiReact('micro', n >= p.count ? `🎉 ${p.t}: ${n} of ${p.count}. You did it!` : `${p.sym} ${n} of ${p.count}. Look at you go!`); }
}
goalMicroCard = function (id) {
  const g = get('goals', id); if (!g) return '';
  if (!(Array.isArray(g.plan) && g.plan.length)) {
    const ms = goalMicros(g);
    return `<div class="card"><h2>${I.bolt} Micro-actions</h2><p class="small" style="margin-top:-4px">Turn this goal into a Goal to Micro-Action plan: daily actions, how many times, and a symbol for each.</p><div class="btns"><button class="btn primary small" data-act="plan-from-goal" data-id="${esc(id)}">Make my action plan</button></div><div class="list" style="margin-top:8px">${ms.slice(0, 4).map((t, i) => `<div class="row"><span class="mnum">${i + 1}</span><div class="main"><div class="t" dir="auto">${esc(t)}</div></div></div>`).join('')}</div></div>`;
  }
  const tot = g.plan.reduce((s, p) => s + p.count, 0), dn = g.plan.reduce((s, p) => s + Math.min(p.count, pDone(p)), 0), t = today();
  return `<div class="card gmcard"><h2>${I.bolt} Action plan <span class="count">${dn}/${tot}</span><span style="flex:1"></span><button class="btn small ghost" data-act="plan-ai" data-id="${esc(id)}">✨ Ideas</button><button class="btn small ghost" data-act="plan-add" data-id="${esc(id)}">${I.plus} Action</button></h2>
  ${g.keyword ? `<div class="small" style="margin:-4px 0 8px">📘 ${esc(g.keyword)}${g.pain ? ` · instead of “${esc(g.pain)}”` : ''}</div>` : ''}
  <div class="list">${g.plan.map(p => { const n = pDone(p); return `<div class="row gmrow"><button class="check ${(p.done || {})[t] ? 'done' : ''}" data-act="plan-done" data-id="${esc(id)}" data-p="${esc(p.id)}" aria-label="Done today">${I.tick}</button><span class="psym">${esc(p.sym)}</span><div class="main" data-act="plan-edit" data-id="${esc(id)}" data-p="${esc(p.id)}" role="button"><div class="t" dir="auto">${esc(p.t)} <span class="small">✎</span></div><div class="bar" style="margin:6px 0 2px"><i style="width:${Math.min(100, Math.round(100 * n / p.count))}%"></i></div><div class="m"><span>${n} of ${p.count}</span>${n >= p.count ? '<span class="chip s-done">done</span>' : ''}</div></div><button class="icon-btn" data-act="plan-del" data-id="${esc(id)}" data-p="${esc(p.id)}" aria-label="Remove">${I.close}</button></div>`; }).join('')}</div>
  <div class="pdots">${(() => { const days = []; for (let i = 13; i >= 0; i--) days.push(addDays(t, -i)); return days.map(d => { const k = g.plan.filter(p => (p.done || {})[d]).length; return `<i title="${esc(fmtDate(d))}" style="opacity:${k ? .35 + .65 * k / g.plan.length : 1}" class="${k ? 'on' : ''}"></i>`; }).join(''); })()}</div><div class="small">Last 14 days</div></div>`;
};

/* ---------- Morning & Night Balance, following the book (with the daily assessment score) ---------- */
function assess(d = today()) {
  const m = logOf('morning', d), n = logOf('closeout', d), top = list('tasks').filter(x => x.focusDate === d), topDone = top.filter(x => !isOpen(x)).length;
  const imp = planItems().filter(x => (x.p.done || {})[d]).length + list('goals').filter(g => (g.microDone || {})[d]).length;
  const feel = n && n.feel != null && n.feel !== '' ? Number(n.feel) : 0;
  const s = (m ? 1 : 0) + (n ? 1 : 0) + Math.min(3, topDone) + Math.min(3, imp) + Math.min(2, feel);
  return { s, m: !!m, n: !!n, top: Math.min(3, topDone), imp: Math.min(3, imp), feel, level: s < 3 ? 'Standard' : s < 6 ? 'Sound' : 'Excellent' };
}
function assessChip(d) { const a = assess(d); return `<button class="assess lv-${a.level.toLowerCase()}" data-act="assess-info"><b>${a.s}</b>/10 · ${a.level} level</button>`; }
function assessSheet() {
  const a = assess();
  openSheet('My assessment today', `<div class="asx"><div class="asx-n">${a.s}<small>/10</small></div><div class="small">${a.level} level</div></div><div class="list">${[['Morning Balance', a.m ? 1 : 0, 1], ['Night Balance', a.n ? 1 : 0, 1], ['My important tasks (Top 3)', a.top, 3], ['My improvement actions', a.imp, 3], ['How I feel about myself today', a.feel, 2]].map(([l, v, mx]) => `<div class="row"><div class="main"><div class="t">${l}</div><div class="bar" style="margin-top:6px"><i style="width:${100 * v / mx}%"></i></div></div><b>${v}/${mx}</b></div>`).join('')}</div>
    <p class="small">From the book’s assessment template: below 3 is Standard, 3 to 6 is Sound, 6 to 10 is Excellent.</p>`, '', { noFocus: true });
}
morningSheet = function () {
  const t = today(), ex = logOf('morning') || {}, c = activeCycle(), open = list('tasks').filter(isOpen);
  const top = open.filter(x => x.focusDate === t).map(x => x.id), cand = sortTasks(open.filter(x => x.focusDate === t || (x.due && x.due <= t))).concat(suggestTop(t)).filter((x, i, arr) => arr.findIndex(y => y.id === x.id) === i).slice(0, 8);
  const focusAreas = (c ? c.focus.map(id => get('areas', id)).filter(Boolean) : []).concat(areas()).filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i);
  const items = planItems(), cur = ex.impIds || microToday().filter(x => x.key).map(x => x.key);
  const f = (k, html) => balOn('m', k) ? `<div class="bq"><div class="bl">${BAL_LABEL.m[k]}</div>${html}</div>` : '';
  const exps = ['A calm and focused day', 'Good news', 'A great conversation', 'Real progress on my goal', 'Energy and joy'];
  openSheet('Morning Balance', `<div class="small bal-sub">${esc(fmtDate(t, true))}${c ? ` · day ${cycleDay(c)} of ${c.days || 40}` : ''}</div>
    ${f('expect', chipsFor('expectC', exps.map(x => [x, x]), [ex.expect], 5) + `<input name="expect" dir="auto" value="${esc(ex.expect || '')}" placeholder="Or in your words: today I would like to experience…" style="margin-top:6px">`)}
    ${f('focus', chipsFor('focusAreas', focusAreas.map(a => [a.id, a.title]), ex.focusAreas || (c ? c.focus : []), 8) + `<input name="focus" dir="auto" value="${esc(ex.focus || '')}" placeholder="In one line (optional)" style="margin-top:6px">`)}
    ${f('top', cand.length ? chipsFor('top', cand.map(x => [x.id, x.title]), top, 8) + '<div class="small" style="margin-top:4px">Tap up to three.</div>' : '<div class="small">No open tasks. Add some from Today.</div>')}
    ${f('improve', items.length ? `<div class="pick bal" data-name="imp">${items.map(x => `<button type="button" data-act="bal-chip" data-v="${esc(x.key)}" class="${cur.includes(x.key) ? 'on' : ''}" dir="auto">${esc(x.p.sym)} ${esc(x.p.t)}</button>`).join('')}</div><div class="small" style="margin-top:4px">Up to three, from your goals.</div>` : `<div class="small">No micro-actions yet. <a href="#" data-act="goal-wizard">Plan a goal in 5 steps</a></div>`)}
    ${f('thanks', chipsFor('thanksC', ['My health', 'My family', 'A new day', 'My work', 'Small joys'].map(x => [x, x]), [], 5) + `<input name="thanks" dir="auto" value="${esc(ex.thanks || '')}" placeholder="I am grateful for…" style="margin-top:6px">`)}
    ${f('note', `<input name="note" dir="auto" value="${esc(ex.note || '')}">`)}`,
    '<button class="btn primary wide" data-act="form-save">Start my day</button>', { noFocus: true, onSave: () => {
      const el = sheetCtx.el, val = n => (el.querySelector(`[name=${n}]`) || {}).value || '', on = n => [...el.querySelectorAll(`.bal[data-name=${n}] .on`)].map(b => b.dataset.v);
      const tops = on('top'); if (tops.length > 3) { toast('Keep it to three'); return; } const imp = on('imp'); if (imp.length > 3) { toast('Three improvement actions are enough'); return; }
      if (balOn('m', 'top')) { for (const x of open) { const want = tops.includes(x.id); if (want && x.focusDate !== t) save('tasks', Object.assign({}, x, { focusDate: t })); if (!want && x.focusDate === t) save('tasks', Object.assign({}, x, { focusDate: '' })); } }
      const pickTxt = (n, k) => val(k).trim() || on(n).join(', ');
      save('logs', Object.assign({}, ex, { type: 'morning', date: t, title: 'Morning Balance ' + fmtDate(t), expect: pickTxt('expectC', 'expect'), focus: val('focus').trim(), focusAreas: on('focusAreas'), impIds: imp, improve: items.filter(x => imp.includes(x.key)).map(x => x.p.t), thanks: pickTxt('thanksC', 'thanks'), note: val('note').trim() }));
      closeSheet(); toast('Have a great day ☀');
    } });
};
nightSheet = function () {
  const t = today(), tm = addDays(t, 1), ex = logOf('closeout') || {}, open = list('tasks').filter(isOpen);
  const left = open.filter(x => x.focusDate === t || x.due === t), doneN = list('tasks').filter(x => !isOpen(x) && x.completedOn === t).length;
  const m = logOf('morning'), f = (k, html) => balOn('n', k) ? `<div class="bq"><div class="bl">${BAL_LABEL.n[k]}</div>${html}</div>` : '';
  const imps = microToday().filter(x => x.pid), a0 = assess();
  openSheet('Night Balance', `<div class="small bal-sub">${doneN} done today${m && m.expect ? ` · this morning: “${esc(m.expect)}”` : ''}</div>
    ${imps.length ? `<div class="bq"><div class="bl">My improvement actions today</div><div class="list">${imps.map(x => `<label class="row" style="cursor:pointer;padding:6px 2px"><input type="checkbox" name="impd" value="${esc(x.g.id + ':' + x.pid)}" ${x.done ? 'checked' : ''} style="width:20px;height:20px"><span class="psym">${esc(x.sym)}</span><div class="main"><div class="t" dir="auto">${esc(x.t)}</div></div></label>`).join('')}</div></div>` : ''}
    <div class="bq"><div class="bl">How do I feel about myself today?</div><div class="nums feel">${[[0, '😐 Not great'], [1, '🙂 Good'], [2, '😄 Great']].map(([v, l]) => `<button data-act="score-pick" data-v="${v}" class="${Number(ex.feel) === v && ex.feel !== '' && ex.feel != null ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    ${f('score', `<div class="small" style="margin-bottom:6px">Your assessment so far: <b>${a0.s}/10</b> (${a0.level}). Adjust if it feels different.</div><div class="nums score">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => `<button data-act="score-pick" data-v="${v}" class="${(Number(ex.score) || 0) === v ? 'on' : ''}">${v}</button>`).join('')}</div>`)}
    ${f('better', chipsFor('betterC', ['Start my Top 3 earlier', 'Less phone', 'Sleep on time', 'Do my micro-actions first'].map(x => [x, x]), [], 4) + `<input name="better" dir="auto" value="${esc(ex.better || '')}" placeholder="Tomorrow I will…" style="margin-top:6px">`)}
    ${f('carry', left.length ? `<div class="list">${left.map(x => `<label class="row" style="cursor:pointer;padding:6px 2px"><input type="checkbox" name="carry" value="${esc(x.id)}" checked style="width:20px;height:20px"><div class="main"><div class="t" dir="auto">${esc(x.title)}</div></div></label>`).join('')}</div>` : '<div class="small">Nothing left over. Well done.</div>')}
    ${f('ideas', `<input name="ideas" dir="auto" value="${esc(ex.ideas || '')}">`)}${f('persp', `<input name="persp" dir="auto" value="${esc(ex.persp || '')}">`)}
    ${f('thanks', `<input name="thanks" dir="auto" value="${esc(ex.thanks || '')}" placeholder="I am grateful for…">`)}${f('topics', `<input name="topics" dir="auto" value="${esc(ex.topics || '')}">`)}`,
    '<button class="btn primary wide" data-act="form-save">Close the day</button>', { noFocus: true, onSave: () => {
      const el = sheetCtx.el, val = n => ((el.querySelector(`[name=${n}]`) || {}).value || '').trim(), on = n => [...el.querySelectorAll(`.bal[data-name=${n}] .on`)].map(b => b.dataset.v);
      const did = [...el.querySelectorAll('[name=impd]:checked')].map(x => x.value); imps.forEach(x => planToggle(x.g.id, x.pid, t, did.includes(x.g.id + ':' + x.pid)));
      const fe = el.querySelector('.nums.feel .on'), feel = fe ? Number(fe.dataset.v) : '';
      const carry = [...el.querySelectorAll('[name=carry]:checked')].map(x => x.value), sc = el.querySelector('.nums.score .on');
      for (const x of left) if (carry.includes(x.id)) save('tasks', Object.assign({}, x, x.focusDate === t ? { focusDate: tm, due: x.due && x.due <= t ? tm : x.due } : { due: tm }));
      const rec = Object.assign({}, ex, { type: 'closeout', date: t, title: 'Night Balance ' + fmtDate(t), feel, better: val('better') || on('betterC').join(', '), ideas: val('ideas'), persp: val('persp'), thanks: val('thanks'), topics: val('topics'), done: ex.done || '', notes: carry.length ? 'Carried over: ' + left.filter(x => carry.includes(x.id)).map(x => x.title).join('; ') : '' });
      save('logs', rec); const auto = assess(t).s; const score = sc ? Number(sc.dataset.v) : Math.max(1, auto);
      save('logs', Object.assign({}, logOf('closeout'), { score, assess: auto, mood: Math.ceil(score / 2) }));
      closeSheet(); toast(`Day closed · ${auto}/10 ${assess(t).level}. Sleep well.`);
      if (score >= 8 || auto >= 6) celebrate();
    } });
};

/* ---------- Today: assessment chip, timeline items can be ticked done (e.g. Deep work) ---------- */
const _vTodayV8 = vToday;
vToday = function () { const h = _vTodayV8(); if (ui.tday && ui.tday !== today()) return h; return h.replace('<div class="spacer" style="height:14px"></div>', `<div class="spacer" style="height:10px"></div><div class="asrow">${assessChip()}</div>`); };
const _tlItemsV8 = timelineItems;
timelineItems = function (d) { return _tlItemsV8(d).map(x => { if (x.act === 'event' && x.id) { const e = get('events', x.id); if (e && (e.doneOn || {})[d]) x.done = true; x.evDay = d; } return x; }); };
timeline = function (d) {
  const all = timelineItems(d), now = new Date(), nowM = d === today() ? now.getHours() * 60 + now.getMinutes() : -1;
  const it = all.filter(x => !x.done), dn = all.filter(x => x.done); let html = '', last = null, nowDone = nowM < 0;
  const nowRow = () => `<div class="tl-now"><span>${fromMin(nowM)}</span><i></i></div>`;
  const tick = x => x.act === 'event' ? `<button class="tl-tick" data-act="ev-done" data-id="${esc(x.id)}" data-day="${d}" aria-label="Mark done">${I.tick}</button>` : x.act === 'task' ? `<button class="tl-tick" data-act="complete" data-id="${esc(x.id)}" aria-label="Mark done">${I.tick}</button>` : x.act === 'hab' ? `<button class="tl-tick" data-act="hab" data-id="${esc(x.id)}" aria-label="Mark done">${I.tick}</button>` : '';
  for (const x of it) {
    if (!nowDone && nowM < x.s) { html += nowRow(); nowDone = true; }
    if (last !== null && x.s - last >= 60) html += `<div class="tl-gap"><span>${dur(x.s - last)} free</span><button class="icon-btn" data-act="new-event" data-day="${d}" data-time="${fromMin(last)}" aria-label="Add">${I.plus}</button></div>`;
    const len = Math.max(0, x.e - x.s), tall = Math.min(120, Math.max(48, len * 0.6));
    html += `<div class="tl-it k-${x.kind}" ${x.act ? `data-act="${x.act}" data-id="${esc(x.id)}"` : ''} role="button" style="min-height:${tall}px"><div class="tl-t"><b>${fromMin(x.s)}</b>${len > 1 ? `<span>${fromMin(x.e)}</span>` : ''}</div><div class="tl-node">${TL_ICON[x.kind] || I.dot}</div><div class="tl-c"><div class="t" dir="auto">${esc(x.title)}</div>${len > 1 ? `<div class="small">${dur(len)}</div>` : ''}</div>${tick(x)}</div>`;
    last = Math.max(last || 0, x.e);
  }
  if (!nowDone) html += nowRow();
  return `<div class="timeline2">${html || '<div class="empty">Nothing left on the plan. 🎉</div>'}</div>${dn.length ? `<details class="tl-donebox"><summary>${I.tick} Done · ${dn.length}</summary>${dn.map(x => `<div class="tl-dn" ${x.act ? `data-act="${x.act}" data-id="${esc(x.id)}"` : ''}><b>${fromMin(x.s)}</b><span dir="auto">${esc(x.title)}</span>${x.act === 'event' ? `<button class="btn small ghost" data-act="ev-done" data-id="${esc(x.id)}" data-day="${d}">Undo</button>` : ''}</div>`).join('')}</details>` : ''}`;
};

/* ---------- onboarding: only the name is typed, everything else is a tap ---------- */
onboard = function () {
  needGrowth().catch(() => {});
  const goalIdeas = a => { const f = (FOCUS_OPTS.find(x => x[0] === a.focus) || [])[2] || 'Lifestyle', k = f.toLowerCase(); const P = window.MEC_GROWTH ? MEC_GROWTH.PAIN[k] || [] : []; return [...new Set(P.map(x => x[1]).concat([GOAL_TPL[f]]))].filter(Boolean); };
  const steps = [
    { html: a => `<div class="ob"><div class="ob-k">${brandMark} Coach</div><h2>Hi! I’m Emi. What should I call you?</h2><input class="big" data-k="name" value="${esc(a.name || '')}" placeholder="Your first name" autocomplete="given-name" dir="auto"><p class="small">The rest is just taps. About one minute.</p><div class="ochips" style="margin:6px 0 10px">${[['en', 'English'], ['fa', 'فارسی'], ['ar', 'العربية']].map(([k, l]) => `<button type="button" class="ochip ${(ui.lang || 'en') === k ? 'on' : ''}" data-act="ob-lang" data-v="${k}">${l}</button>`).join('')}</div><button class="btn ghost small" data-act="ob-skip">Skip — I will import my own data</button></div>`, check: a => a.name && a.name.trim() ? '' : 'Tell me your name' },
    { html: a => `<div class="ob"><h2>${esc(a.name)}, what matters most right now?</h2><div class="ochips">${FOCUS_OPTS.map(([v, l]) => chip('focus', v, l, a.focus === v)).join('')}</div></div>`, check: a => a.focus ? '' : 'Pick one' },
    { html: a => `<div class="ob"><h2>Pick your first goal</h2><p class="small">You can change the words later.</p><div class="ochips col">${goalIdeas(a).map(g => chip('goal', g, g, a.goal === g)).join('')}</div><div class="small" style="margin:16px 0 6px">By when?</div><div class="ochips">${[['40', '40 days'], ['90', '3 months'], ['180', '6 months'], ['365', '1 year']].map(([v, l]) => chip('horizon', v, l, (a.horizon || '40') === v)).join('')}</div></div>`, check: a => a.goal ? '' : 'Pick a goal' },
    { html: () => `<div class="ob"><h2>Your Wheel of Life</h2><p>Eight quick taps, one per area of life, from 1 to 10. Later you can take the full 80-question test from the book.</p><div class="ob-wheel">${miniWheel(CLASSIC, {}, -1)}</div></div>`, nextLabel: 'Start' },
    ...wheelSteps(CLASSIC),
    { html: a => wheelResult(CLASSIC, a.scores || {}) },
    { html: a => `<div class="ob"><h2>Which habits do you want?</h2><p class="small">Pick up to 4.</p><div class="ochips">${HABIT_OPTS.filter(h => h !== 'Deep work').map(h => chip('habits', h, h, (a.habits || []).includes(h), true)).join('')}</div></div>` },
    { html: a => `<div class="ob"><h2>Your one-minute check-ins</h2><p class="small">Morning Balance plans your day. Night Balance closes it.</p><div class="small" style="margin:10px 0 6px">Morning</div><div class="ochips">${['06:00', '06:30', '07:00', '07:30', '08:00', '09:00'].map(v => chip('mt', v, v, (a.mt || '07:30') === v)).join('')}</div><div class="small" style="margin:14px 0 6px">Night</div><div class="ochips">${['20:30', '21:00', '21:30', '22:00', '22:30', '23:00'].map(v => chip('nt', v, v, (a.nt || '21:30') === v)).join('')}</div></div>` },
    { nextLabel: 'Create my account', html: a => { const pa = primaryArea(a); return `<div class="ob"><h2>Your plan is ready</h2><div class="plan"><div class="plan-r"><span class="sw" style="background:${AREA_COL[CLASSIC.indexOf(pa) % 8]}"></span><div><b dir="auto">${esc(a.goal)}</b><div class="small">${esc(pa)} · ${({ 40: '40 days', 90: '3 months', 180: '6 months', 365: '1 year' })[a.horizon || '40']} · with 3 micro-actions</div></div></div><div class="plan-r"><span class="sw" style="background:${AREA_COL[CLASSIC.indexOf(secondArea(a)) % 8]}"></span><div><b>${esc(GOAL_TPL[secondArea(a)])}</b><div class="small">${esc(secondArea(a))} · your lowest score</div></div></div>${(a.habits || []).length ? `<div class="plan-r"><span class="sw"></span><div><b>${(a.habits || []).map(esc).join(' · ')}</b><div class="small">Habits</div></div></div>` : ''}<div class="plan-r"><span class="sw"></span><div><b>40-day cycle starts today</b><div class="small">Morning ${esc(a.mt || '07:30')} · Night ${esc(a.nt || '21:30')}</div></div></div></div>
      <div id="gbtn-ob" class="gbtn" style="margin-top:16px"></div><div class="f" style="margin-top:12px"><label>Email</label><input data-k="email" type="email" autocomplete="username" inputmode="email" value="${esc(a.email || '')}"></div><div class="f"><label>Password (8+ characters)</label><input data-k="pw" type="password" autocomplete="new-password"></div><p class="small">7 days free. No card needed.</p></div>`; },
      check: a => !/^\S+@\S+\.\S+$/.test(a.email || '') ? 'Enter your email' : (a.pw || '').length < 8 ? 'Use at least 8 characters' : '',
      done: async a => { try { const r = await api('signup', { body: { email: a.email, password: a.pw, name: a.name, device: device() } }); signedIn(r, a.skip ? null : a, true); } catch (e) { toast(e.message === 'offline' ? 'No connection.' : e.message); } } }
  ];
  flowOpen({ cls: 'onboard', steps, a: { horizon: '40', habits: [], mt: '07:30', nt: '21:30' } });
};
buildPlan = function (a) {
  const t = today(), tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', ids = {}, G = window.MEC_GROWTH;
  save('settings', { id: 'prefs', tz, visionName: 'My vision', visionText: '', visionDate: `${new Date().getFullYear() + 3}-12-31`, hidden: ['jobs', 'documents'], onboarded: t });
  CLASSIC.forEach((nm, i) => { ids[nm] = save('areas', { title: nm, color: i % 8, order: i + 1, target: 8 }).id; });
  const scores = {}; CLASSIC.forEach((nm, i) => { if ((a.scores || {})[i]) scores[ids[nm]] = a.scores[i]; }); if (Object.keys(scores).length) save('wheel', { date: t, scores });
  const p = primaryArea(a), s = secondArea(a), days = Number(a.horizon) || 40, tgt = addDays(t, days - 1), k = p.toLowerCase();
  const kws = G ? G.field(k).rows.map(r => r.k) : []; const mic = G ? [...new Set(kws.slice(0, 3).flatMap(x => (G.KW[x] || []).slice(0, 1)))].slice(0, 3) : (MICRO_TPL[p] || []).slice(0, 3);
  const cnt = Math.round(Math.min(days, 40) * 5 / 7), syms = G ? G.SYMBOLS : ['►', '☺', '$'];
  const g1 = save('goals', { title: String(a.goal).trim(), areaId: ids[p], area: p, target: tgt, status: 'In progress', method: 'book', plan: mic.map((m, i) => ({ id: 'p' + i, t: m, count: cnt, sym: syms[i], done: {} })) });
  save('milestones', { title: 'Halfway check', target: addDays(t, Math.round(days / 2) - 1), goalId: g1.id, status: 'Planned' });
  save('milestones', { title: 'Goal reached', target: tgt, goalId: g1.id, status: 'Planned' });
  const g2 = save('goals', { title: GOAL_TPL[s], areaId: ids[s], area: s, target: addDays(t, 39), status: 'In progress' });
  save('cycles', { start: t, days: 40, focus: [ids[p], ids[s]], goals: [g1.id, g2.id], intention: 'In 40 days I will be closer to: ' + String(a.goal).trim(), status: 'active' });
  (a.habits || []).slice(0, 4).forEach(h => save('habits', { title: h, perWeek: 7, days: [0, 1, 2, 3, 4, 5, 6], areaId: ids[p] }));
  save('tasks', { title: 'Do your first Morning Balance', due: t, focusDate: t, state: 'To do', priority: 'P1', owner: 'Me' });
  save('tasks', { title: 'Take the full Balance Wheel Test (80 questions)', due: addDays(t, 1), state: 'To do', priority: 'P2', owner: 'Me' });
  ui.pushMorning = a.mt || '07:30'; ui.pushEvening = a.nt || '21:30'; ui.tourDone = false; saveUi();
};

/* ---------- Life area: growth library + a new pick every visit ---------- */
const LIB_KIND = { action: ['Action', '⚡'], habit: ['Habit', '🔁'], challenge: ['Challenge', '🏁'], read: ['Read', '📖'], listen: ['Listen', '🎧'], watch: ['Watch', '▶️'] };
const libUrl = x => x.kind === 'watch' ? 'https://www.youtube.com/results?search_query=' + encodeURIComponent(x.t + ' ' + String(x.by || '').replace(/ · .*/, '').replace('Search on YouTube', '')) : x.kind === 'listen' ? 'https://podcasts.apple.com/search?term=' + encodeURIComponent(x.t) : 'https://www.google.com/search?q=' + encodeURIComponent(x.t + ' ' + (x.by || ''));
function libFor(fk) { const G = window.MEC_GROWTH; if (!G) return []; const base = (G.LIB[fk] || []).map((x, i) => Object.assign({ i: 'L' + i }, x)); const kw = G.field(fk).rows.flatMap((r, ri) => (G.KW[r.k] || []).map((t, j) => ({ i: 'K' + ri + '-' + j, kind: 'action', t, d: 'Micro-action for ' + r.k, kw: r.k }))); return base.concat(kw); }
function libNew(a) {
  const fk = fieldKey(a), items = libFor(fk); if (!items.length) return null;
  const st = (ui.libState = ui.libState || {})[a.id] || { seen: [], cur: null, visit: '' };
  const visit = String(render.visit || 0);
  if (st.visit !== visit || !st.cur) { const added = new Set((ui.libAdded || {})[a.id] || []); const pool = items.filter(x => !st.seen.includes(x.i) && !added.has(x.i)); const pick = (pool.length ? pool : items)[Math.floor(Math.random() * (pool.length || items.length))]; st.cur = pick.i; st.seen = pool.length ? [...st.seen, pick.i].slice(-200) : [pick.i]; st.visit = visit; ui.libState[a.id] = st; saveUi(); }
  return items.find(x => x.i === st.cur) || items[0];
}
function libCard(x, a, big) {
  const [kl, ke] = LIB_KIND[x.kind] || ['', '•'], added = ((ui.libAdded || {})[a.id] || []).includes(x.i), media = ['read', 'listen', 'watch'].includes(x.kind);
  return `<div class="libc k-${x.kind} ${big ? 'big' : ''} ${added ? 'added' : ''}" style="--ac:${areaColor(a)}"><div class="libc-k"><span>${ke}</span>${kl}${x.days ? ` · ${x.days} days` : ''}${x.kw ? ` · ${esc(x.kw)}` : ''}</div><b dir="auto">${esc(x.t)}</b>${x.by ? `<div class="libc-by">${esc(x.by)}</div>` : ''}${x.d ? `<div class="small">${esc(x.d)}</div>` : ''}
    <div class="libc-b">${media ? `<a class="btn small" href="${esc(libUrl(x))}" target="_blank" rel="noopener">${x.kind === 'watch' ? 'Watch' : x.kind === 'listen' ? 'Listen' : 'Find it'} ↗</a>` : ''}<button class="btn small ${added ? 'ok' : 'primary'}" data-act="lib-add" data-a="${esc(a.id)}" data-i="${esc(x.i)}">${added ? '✓ Added' : x.kind === 'habit' ? '+ Habit' : x.kind === 'challenge' ? 'Start' : media ? '+ My list' : '+ Today'}</button></div></div>`;
}
function libSection(a) {
  if (!window.MEC_GROWTH) { needGrowth().then(() => { if (route().page === 'area') render(); }); return ['<div class="card empty">Loading ideas…</div>', '']; }
  const fk = fieldKey(a); if (!fk) return ['', ''];
  const items = libFor(fk), nw = libNew(a), kind = (ui.libKind || {})[a.id] || 'all';
  const shown = items.filter(x => kind === 'all' ? !x.kw : x.kind === kind && (kind !== 'action' || true)).slice(0, kind === 'all' ? 60 : 80);
  return [`<div class="card libnew" style="--ac:${areaColor(a)}"><h2>✨ New for you today<span style="flex:1"></span><button class="icon-btn" data-act="lib-next" data-a="${esc(a.id)}" aria-label="Another idea" title="Another idea">↻</button></h2>${nw ? libCard(nw, a, true) : ''}</div>`, `<h2 class="sec-h">Grow your ${esc(a.title)} <span class="count">${items.length}</span></h2>
  <div class="libtabs">${[['all', 'All'], ['action', '⚡ Actions'], ['habit', '🔁 Habits'], ['challenge', '🏁 Challenges'], ['read', '📖 Read'], ['listen', '🎧 Listen'], ['watch', '▶️ Watch']].map(([k, l]) => `<button class="${kind === k ? 'on' : ''}" data-act="lib-kind" data-a="${esc(a.id)}" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="libgrid">${shown.map(x => libCard(x, a)).join('')}</div>`];
}
function libAdd(aid, iid) {
  const a = get('areas', aid), x = libFor(fieldKey(a)).find(y => y.i === iid); if (!a || !x) return;
  const t = today();
  if (x.kind === 'habit') save('habits', { title: x.t, days: [0, 1, 2, 3, 4, 5, 6], perWeek: 7, areaId: aid, color: a.color || 0, why: x.d || '' });
  else if (x.kind === 'challenge') { const h = save('habits', { title: `🏁 ${x.t}`, days: [0, 1, 2, 3, 4, 5, 6], perWeek: 7, areaId: aid, color: a.color || 0, why: x.d || '', until: addDays(t, (x.days || 7) - 1) }); save('tasks', { title: `Finish challenge: ${x.t}`, due: addDays(t, (x.days || 7) - 1), state: 'To do', priority: 'P2', owner: 'Me', areaId: aid, habitId: h.id }); }
  else if (['read', 'listen', 'watch'].includes(x.kind)) save('tasks', { title: `${LIB_KIND[x.kind][0]}: ${x.t}${x.by ? ' · ' + x.by : ''}`, due: addDays(t, 6), state: 'To do', priority: 'P3', owner: 'Me', areaId: aid, link: libUrl(x), nextAction: x.d || '' });
  else save('tasks', { title: x.t, due: t, focusDate: '', state: 'To do', priority: 'P2', owner: 'Me', areaId: aid });
  ui.libAdded = ui.libAdded || {}; ui.libAdded[aid] = [...new Set([...(ui.libAdded[aid] || []), iid])]; saveUi();
  toast(x.kind === 'habit' ? 'Habit added' : x.kind === 'challenge' ? `Challenge started: ${x.days || 7} days` : ['read', 'listen', 'watch'].includes(x.kind) ? 'Added to your list for this week' : 'Added to today');
  emiReact('micro', ['Ooh, good pick!', 'Love it. Small steps, big change.', 'Added! I’ll cheer when you do it.'][Math.floor(Math.random() * 3)]);
}
const _vAreaV8 = vArea;
vArea = function (id) {
  const a = get('areas', id); if (!a) return _vAreaV8(id);
  if (!window.MEC_GROWTH) needGrowth().then(() => { if (route().page === 'area') render(); });
  if (render.lastPage !== 'area' || vArea.last !== id) render.visit = Date.now(); vArea.last = id;
  const h = _vAreaV8(id), lib = libSection(a);
  const plan = `<div class="card gw-cta" style="--ac:${areaColor(a)}"><div class="main"><b>Turn ${esc(a.title)} into a 40-day goal</b><div class="small">The book’s 5 steps: field, keyword, pain → pleasure, micro-actions, count and symbol.</div></div><button class="btn primary small" data-act="goal-wizard" data-id="${esc(id)}">Plan it</button></div>`;
  const i = h.indexOf('<div class="card"><h2>Goals'); const head = i > 0 ? h.slice(0, i) : h, rest = i > 0 ? h.slice(i) : '';
  return head + lib[0] + plan + (window.MEC_GROWTH ? kwCard(a) : '') + rest + lib[1];
};

/* ---------- visual roadmap ---------- */
vRoadmap = function () {
  const t = today(), vd = visionDate(), gs = list('goals').filter(g => g.target && !['Dropped', 'Cancelled'].includes(g.status)).sort((a, b) => String(a.target).localeCompare(String(b.target)));
  const ms = list('milestones').filter(m => m.status !== 'Dropped'), done = ms.filter(m => m.status === 'Done').length;
  const end = [vd, ...gs.map(g => g.target)].sort().pop(), span = Math.max(30, daysBetween(t, end)), pos = d => Math.max(0, Math.min(100, 100 * daysBetween(t, d) / span));
  const months = []; { const d = parseD(t); d.setDate(1); for (let i = 0; i < 400 && dstr(d) <= end; i++) { const s = dstr(d); if (s >= t) months.push(s); d.setMonth(d.getMonth() + (span > 900 ? 6 : span > 400 ? 3 : 1)); } }
  const next = ms.filter(m => m.target && m.target >= t && m.status !== 'Done').sort((a, b) => a.target.localeCompare(b.target)).slice(0, 6);
  const c = activeCycle(), dl = daysTo(vd);
  const row = g => { const a = goalArea(g), s = g.createdAt ? String(g.createdAt).slice(0, 10) : t, p = goalProgress(g), gm = ms.filter(m => m.goalId === g.id && m.target);
    const plan = Array.isArray(g.plan) && g.plan.length ? Math.round(100 * g.plan.reduce((x, q) => x + Math.min(q.count, pDone(q)), 0) / g.plan.reduce((x, q) => x + q.count, 0)) : pct(p);
    return `<div class="gt-row" data-act="goal" data-id="${esc(g.id)}" role="button" style="--ac:${a ? areaColor(a) : 'var(--brass)'}"><div class="gt-l"><span>${areaEmoji(a)}</span><b dir="auto">${esc(g.title)}</b><em>${plan}%</em></div><div class="gt-track"><i class="gt-bar" style="left:${pos(s < t ? t : s)}%;width:${Math.max(2, pos(g.target) - pos(s < t ? t : s))}%"><b style="width:${plan}%"></b></i>${gm.map(m => `<i class="gt-ms ${m.status === 'Done' ? 'done' : ''}" style="left:${pos(m.target)}%" title="${esc(m.title)} · ${esc(fmtDate(m.target))}"></i>`).join('')}</div></div>`; };
  return header('Plan', 'Where you are going and by when') + planTabs() + `
  <div class="card rm-hero"><div class="rm-v"><div class="small">Your vision</div><b dir="auto">${esc(prefs().visionName || 'My vision')}</b>${prefs().visionText ? `<div class="small" dir="auto">${esc(prefs().visionText)}</div>` : ''}<button class="btn small ghost" data-act="vision">Change</button></div><div class="rm-n">${dl.toLocaleString('en-GB')}<small>days to go</small></div></div>
  <div class="card"><h2>🛣 The road ahead</h2><div class="road">${[`<div class="rd-n now"><i></i><div><b>Today</b><span>${esc(fmtDate(t, true))}${c ? ` · day ${cycleDay(c)} of 40` : ''}</span></div></div>`].concat(next.map((m, i) => { const g = m.goalId && get('goals', m.goalId), a = g ? goalArea(g) : null; return `<div class="rd-n ${i % 2 ? 'r' : 'l'}" data-act="milestone" data-id="${esc(m.id)}" role="button" style="--ac:${a ? areaColor(a) : 'var(--brass)'}"><i>${areaEmoji(a)}</i><div><b dir="auto">${esc(m.title)}</b><span>${esc(fmtDate(m.target, true))} · ${esc(rel(m.target))}</span></div></div>`; })).concat([`<div class="rd-n goal"><i>🏁</i><div><b dir="auto">${esc(prefs().visionName || 'My vision')}</b><span>${esc(fmtDate(vd, true))}</span></div></div>`]).join('')}</div>
    <div class="small" style="margin-top:8px">${done} of ${ms.length} milestones done</div><div class="btns" style="margin-top:8px"><button class="btn primary small" data-act="new-milestone">${I.plus} Milestone</button><button class="btn small" data-act="goal-wizard">${I.plus} Goal in 5 steps</button></div></div>
  <div class="card"><h2>📅 Goals on a timeline</h2><div class="gantt"><div class="gt-axis">${months.map(m => `<span style="left:${pos(m)}%">${esc(parseD(m).toLocaleDateString(LOC(), { month: 'short', year: span > 400 ? '2-digit' : undefined }))}</span>`).join('')}</div>${c ? `<div class="gt-cycle" style="left:${pos(c.start < t ? t : c.start)}%;width:${Math.max(1, pos(addDays(c.start, 39)) - pos(c.start < t ? t : c.start))}%"><span>40 days</span></div>` : ''}${gs.map(row).join('') || '<div class="empty">Goals with a target date appear here.</div>'}</div><div class="small" style="margin-top:6px">Bars run from today to each goal’s date. Fill = progress. Dots = milestones.</div></div>
  ${ms.some(m => !m.target) ? `<div class="card"><h2>No date yet</h2><div class="list">${ms.filter(m => !m.target).map(m => `<div class="row" data-act="milestone" data-id="${esc(m.id)}"><div class="main"><div class="t" dir="auto">${esc(m.title)}</div></div></div>`).join('')}</div></div>` : ''}`;
};

/* ---------- Emi: warmer, funnier words ---------- */
const EMI_JOKES = ['Why did the to-do list go to therapy? Too many unresolved issues. 😄', 'I tried to catch fog once. I mist. Anyway, how is your day going?', 'Fun fact: tiny steps are my favourite size. I am also tiny. Coincidence? 🤔', 'Coffee first, world domination second. Or Top 3 first. Your call. ☕', 'I don’t have legs for running, but I can cheer really loud. 📣', 'Plot twist: you are doing better than you think.', 'My hobby? Watching you tick boxes. It never gets old. ✓'];
emiGreeting = function () { const h = new Date().getHours(), nm = me && me.name ? me.name.split(' ')[0] : 'friend'; const opts = h < 5 ? [`Still up, ${nm}? Sleep is a superpower 😴`] : h < 12 ? [`Morning, ${nm}! ☀ Ready for a good one?`, `Hey ${nm}! New day, fresh start.`, `Good morning, ${nm}! I saved you a seat.`] : h < 18 ? [`Hey ${nm}! How’s the day treating you?`, `Hi ${nm}! Quick win time?`, `Afternoon, ${nm}! Water break? 💧`] : [`Evening, ${nm}! Let’s land this day softly. 🌙`, `Hey ${nm}! Proud of you for showing up today.`]; return opts[Math.floor(Math.random() * opts.length)]; };
emiTalk = function () { if (!emiInst) return; const tips = emiTips(); const r = Math.random(); if (r < .3) { emiInst.play(['laugh', 'wink', 'giggle'][Math.floor(Math.random() * 3)]); emiInst.say(EMI_JOKES[Math.floor(Math.random() * EMI_JOKES.length)]); return; } const t = tips[Math.floor(Math.random() * Math.min(3, tips.length))]; emiInst.say(t ? t[0] : emiGreeting()); };

function v9Acts(a, id) {
  return {
    'wheel-test': () => { closeSheet(true); wheelChooser(); }, 'wq-start': () => { closeSheet(true); wheelFlow(); }, 'bt-start': () => { closeSheet(true); bookTest(); },
    'bt-score': () => { const s = flow.a.s, f = a.dataset.f, i = Number(a.dataset.i); s[f] = (s[f] || []).slice(); s[f][i] = Number(a.dataset.v); ui.btDraft = flow.a; saveUi(); a.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === a)); a.closest('.bt-q').classList.add('ok'); const n = s[f].filter(Boolean); const av = $('#flow .bt-avg'); if (av) av.innerHTML = `${Math.round(10 * n.reduce((x, y) => x + y, 0) / n.length) / 10}<small>avg</small>`; const nx = a.closest('.bt-q').nextElementSibling; if (nx && !nx.classList.contains('ok')) setTimeout(() => nx.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120); },
    'goal-wizard': () => { closeSheet(true); goalWizard(id || ''); }, 'gw-kw': () => goalWizard(a.dataset.a, a.dataset.k),
    'gw-area': () => { flow.a.area = id; flow.a.kw = ''; flow.a.micro = []; flowDraw(); },
    'gw-mic': () => { const m = flow.a.micro, v = a.dataset.v, i = m.indexOf(v); if (i >= 0) m.splice(i, 1); else { if (m.length >= 3) { toast('Three is plenty for 40 days'); return; } m.push(v); } flowDraw(); },
    'gw-count': () => { flow.a.counts[a.dataset.i] = Number(a.dataset.v); flowDraw(); }, 'gw-sym': () => { flow.a.syms[a.dataset.i] = a.dataset.v; flowDraw(); },
    'plan-done': () => planToggle(id, a.dataset.p), 'imp-pick': () => impPickSheet(), 'assess-info': () => assessSheet(),
    'plan-del': () => { const g = get('goals', id); if (!g || !confirm('Remove this micro-action?')) return; save('goals', Object.assign({}, g, { plan: g.plan.filter(p => p.id !== a.dataset.p) })); },
    'plan-add': () => { const g = get('goals', id); if (!g) return; form('New micro-action', [{ k: 't', label: 'Micro-action', req: true, ph: 'e.g. Walk for 30 minutes' }, [{ k: 'count', label: 'How many times', type: 'number', def: 28 }, { k: 'sym', label: 'Symbol', def: '★' }]], {}, v => { save('goals', Object.assign({}, g, { plan: [...(g.plan || []), { id: 'p' + Date.now().toString(36), t: v.t.trim(), count: Number(v.count) || 28, sym: (v.sym || '★').slice(0, 2), done: {} }] })); toast('Added'); }); },
    'plan-from-goal': () => { const g = get('goals', id); if (!g) return; const a2 = goalArea(g); goalWizard(a2 ? a2.id : '', g.keyword || '', g.id); },
    'new-goal': () => { closeSheet(true); goalWizard(a.dataset.area || ''); }, 'new-goal-quick': () => FORMS.goal(a.dataset.area ? { areaId: a.dataset.area, status: 'In progress' } : { status: 'In progress' }),
    'fl-back': () => { if (!flow) return; if (flow.i === 0) { if (/onboard|booktest/.test(flow.cls) || confirm('Leave without saving?')) { if (/booktest/.test(flow.cls)) toast('Saved. Continue the test any time.'); flowClose(); } return; } flowRead(); flow.i--; flowDraw(); },
    'ev-done': () => { const e = get('events', id), d = a.dataset.day || today(); if (!e) return; const dn = Object.assign({}, e.doneOn || {}); if (dn[d]) delete dn[d]; else dn[d] = true; save('events', Object.assign({}, e, { doneOn: dn })); if (dn[d]) emiReact('task', ['Done and dusted! ✨', 'Another one bites the dust 🎵', 'Look at you, finishing things!'][Math.floor(Math.random() * 3)]); },
    'lib-add': () => { libAdd(a.dataset.a, a.dataset.i); render(); }, 'lib-next': () => { render.visit = Date.now(); render(); },
    'lib-kind': () => { ui.libKind = Object.assign({}, ui.libKind, { [a.dataset.a]: a.dataset.v }); saveUi(); render(); }
  };
}
/* the old wizard gets the goal title from an existing goal when re-planned */
document.addEventListener('submit', e => { const f = e.target; if (f.dataset && f.dataset.form === 'gw-own' && flow) { e.preventDefault(); e.stopImmediatePropagation(); const v = (f.q.value || '').trim(); if (v) { if (flow.a.micro.length >= 3) { toast('Three is plenty for 40 days'); return; } flow.a.micro.push(v); flowDraw(); } } }, true);
/* every fresh visit (page load or entering an area) gets a new library pick */
render.visit = Date.now();
const _startV8 = start;
start = function () { _startV8(); setTimeout(ownerCourses, 2500); setTimeout(ownerCourses, 9000); };

/* ---------- Job autopilot: finds jobs daily, you approve, it sends your latest CV ---------- */
let JOBST = null;
const apPrefs = () => Object.assign({ on: false, titles: [], countries: ['gb', 'ie', 'nz'], skills: [], exclude: [], minScore: 40, arbeitnow: false, maxPerRun: 30 }, prefs().autopilot || {});
const apSave = patch => save('settings', Object.assign({}, prefs(), { id: 'prefs', autopilot: Object.assign(apPrefs(), patch) }));
const CC = { gb: '🇬🇧 UK', ie: '🇮🇪 Ireland', nz: '🇳🇿 New Zealand', remote: '🌍 Remote' };
async function jobsState(force) { if (JOBST && !force) return JOBST; try { JOBST = await api('jobs-state'); } catch (e) { JOBST = { err: e.message, cv: [], state: {}, sources: {} }; } return JOBST; }
const foundJobs = () => list('applications').filter(a => a.stage === 'Found').sort((a, b) => (Number(b.match) || 0) - (Number(a.match) || 0));
function apSplit(splitApply) { const t = jobTpl('apply'); const m = t.match(/^Subject:\s*(.*)\n+/); return m ? [m[1], t.slice(m[0].length)] : ['Application – {role}', t]; }
function vAuto() {
  if (!JOBST) { jobsState().then(() => { if (route().page === 'jobs') render(); }); }
  const ap = apPrefs(), st = (JOBST && JOBST.state) || {}, cv = (JOBST && JOBST.cv) || [], src = (JOBST && JOBST.sources) || {}, fj = foundJobs(), sel = new Set(ui.apSel || []);
  const sent = list('applications').filter(a => a.sentAt).sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt))).slice(0, 8);
  const jc = a => `<div class="jcard ${sel.has(a.id) ? 'sel' : ''}"><label class="jsel"><input type="checkbox" data-change="ap-sel" data-id="${esc(a.id)}" ${sel.has(a.id) ? 'checked' : ''}></label><div class="jm" style="--m:${Number(a.match) || 0}"><b>${Number(a.match) || 0}</b><small>match</small></div><div class="main"><div class="t" dir="auto">${esc(a.role)}</div><div class="small" dir="auto">${esc([a.company, a.location].filter(Boolean).join(' · '))}</div><div class="m">${a.source ? `<span class="chip">${esc(a.source)}</span>` : ''}${a.contactEmail ? '<span class="chip s-done">✉ email found</span>' : '<span class="chip">apply on site</span>'}${a.salary ? `<span>${esc(a.salary)}</span>` : ''}${a.posted ? `<span>${esc(rel(a.posted))}</span>` : ''}</div>${a.desc ? `<details class="jdesc"><summary>Details</summary><div dir="auto">${esc(String(a.desc).slice(0, 900))}${String(a.desc).length > 900 ? '…' : ''}</div></details>` : ''}
    <div class="btns" style="margin-top:8px">${a.contactEmail ? `<button class="btn small primary" data-act="ap-send" data-id="${esc(a.id)}">✓ Approve & send CV</button>` : `<button class="btn small primary" data-act="ap-ok" data-id="${esc(a.id)}">✓ Approve</button>`}${a.link ? `<a class="btn small" href="${esc(a.link)}" target="_blank" rel="noopener">Open ↗</a>` : ''}<button class="btn small ghost" data-act="ap-no" data-id="${esc(a.id)}">Skip</button></div></div></div>`;
  return `<div class="card aphero ${ap.on ? 'on' : ''}"><div class="ap-i">${ap.on ? '🤖' : '💤'}</div><div class="main"><b>Autopilot is ${ap.on ? 'on' : 'off'}</b><div class="small">${ap.on ? 'Searches every day and lines up matching jobs for you.' : 'Turn it on to search for jobs every day.'}${st.last ? ` Last search ${esc(rel(String(st.last).slice(0, 10)))}: ${st.added || 0} new.` : ''}</div>
    <div class="btns" style="margin-top:10px"><button class="btn ${ap.on ? '' : 'primary'}" data-act="ap-toggle">${ap.on ? 'Pause' : 'Turn on'}</button><button class="btn primary" data-act="ap-run">🔎 Search now</button></div></div></div>
  ${(() => { const q = jobQueue(); return `<div class="card apsprint"><div class="main"><b>${q.length} approved, ready to apply on the job site</b><div class="small">Your one-minute Sprint opens each job with the cover note copied.</div></div><div class="btns"><button class="btn small primary" data-act="sprint" ${q.length ? '' : 'disabled'}>▶ Sprint</button><button class="btn small" data-act="job-bulk">${I.plus} Add jobs</button></div></div>`; })()}
  <div class="ap-steps"><div class="${ap.titles.length ? 'ok' : ''}"><b>1</b>What you want</div><div class="${cv.length ? 'ok' : ''}"><b>2</b>Your CV</div><div class="${fj.length ? 'ok' : ''}"><b>3</b>You approve</div><div class="${sent.length ? 'ok' : ''}"><b>4</b>Sent + follow-up</div></div>
  <details class="card apset" ${ap.titles.length ? '' : 'open'}><summary><b>⚙ What to look for</b> <span class="small">${ap.titles.length ? esc(ap.titles.join(', ')) + ' · ' + ap.countries.map(c => CC[c] || c).join(', ') : 'Set up in 30 seconds'}</span></summary>
    <div class="bq"><div class="bl">Job titles</div><div class="pick">${ap.titles.map(t => `<button class="on" data-act="ap-title-del" data-v="${esc(t)}">${esc(t)} ✕</button>`).join('')}${['Project Manager', 'Project Coordinator', 'Business Analyst', 'PMO Analyst', 'Data Analyst', 'Operations Manager'].filter(t => !ap.titles.includes(t)).map(t => `<button data-act="ap-title-add" data-v="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div><form class="qadd" data-form="ap-title" style="margin-top:8px"><input name="q" placeholder="Add another title…" autocomplete="off"><button class="btn primary" type="submit">${I.plus}</button></form></div>
    <div class="bq"><div class="bl">Where</div><div class="pick">${Object.entries(CC).map(([k, l]) => `<button class="${ap.countries.includes(k) ? 'on' : ''}" data-act="ap-cc" data-v="${k}">${l}</button>`).join('')}</div></div>
    <div class="bq"><div class="bl">Your skills (they raise the match score)</div><input data-change="ap-skills" value="${esc(ap.skills.join(', '))}" placeholder="Power BI, Agile, stakeholder management, SQL…"></div>
    <div class="bq"><div class="bl">Never show titles with</div><input data-change="ap-exclude" value="${esc(ap.exclude.join(', '))}" placeholder="intern, sales, nurse…"></div>
    <div class="bq"><div class="bl">Minimum match</div><div class="pick">${[30, 40, 50, 60, 70].map(v => `<button class="${Number(ap.minScore) === v ? 'on' : ''}" data-act="ap-min" data-v="${v}">${v}%</button>`).join('')}</div></div>
    <div class="small">Sources: ${['adzuna', 'reed', 'jooble'].map(k => `${{ adzuna: 'Adzuna (UK, NZ)', reed: 'Reed (UK)', jooble: 'Jooble (Ireland and all)' }[k]} ${src[k] ? '✓' : '— needs a free key'}`).join(' · ')} · Remotive ✓${isOwner() ? ' · <a href="#" data-act="ap-keys">Add keys</a>' : ''}</div></details>
  <div class="card apcv"><h2>📄 Your CV <span class="count">${cv.length ? 'latest is sent' : 'needed'}</span></h2>${cv.length ? `<div class="row"><span class="att-i">📄</span><div class="main"><div class="t">${esc(cv[0].name)}</div><div class="m"><span>${esc(fmtDate(String(cv[0].at).slice(0, 10)))}</span><span>${Math.round(cv[0].size / 1024)} KB</span></div></div><button class="btn small ghost" data-act="cv-dl" data-id="${esc(cv[0].id)}">Download</button></div>` : '<div class="empty">Upload your latest CV (PDF). Every approved email application sends this file.</div>'}
    <label class="btn small ${cv.length ? '' : 'primary'}" style="cursor:pointer;margin-top:8px">${cv.length ? 'Upload a newer CV' : 'Upload CV'}<input type="file" accept="application/pdf,.pdf,.docx" data-change="cv-up" hidden></label>${cv.length > 1 ? `<div class="small" style="margin-top:6px">Older: ${cv.slice(1, 4).map(c => esc(c.name) + ' · ' + esc(fmtDate(String(c.at).slice(0, 10)))).join(' · ')}</div>` : ''}</div>
  <div class="card"><h2>👀 Waiting for your approval <span class="count">${fj.length}</span><span style="flex:1"></span>${fj.length ? `<button class="btn small" data-act="ap-selall">${sel.size ? 'Clear' : 'Select all'}</button>` : ''}</h2>
    ${sel.size ? `<div class="apbulk"><b>${sel.size} selected</b><button class="btn small primary" data-act="ap-bulk">✓ Approve ${sel.size}</button><button class="btn small ghost" data-act="ap-bulk-no">Skip ${sel.size}</button></div>` : ''}
    ${fj.length ? `<div class="jlist">${fj.slice(0, 60).map(jc).join('')}</div>` : `<div class="empty">${ap.titles.length ? 'No new jobs waiting. Tap “Search now” or let Autopilot search tomorrow.' : 'Add the job titles you want, then tap “Search now”.'}</div>`}</div>
  ${sent.length ? `<div class="card"><h2>📤 Sent by ME.Coach <span class="count">${sent.length}</span></h2><div class="list">${sent.map(a => `<div class="row" data-act="application" data-id="${esc(a.id)}"><span class="att-i">✓</span><div class="main"><div class="t" dir="auto">${esc(a.role)} · ${esc(a.company || '')}</div><div class="m"><span>to ${esc(a.sentTo || '')}</span><span>${esc(rel(String(a.sentAt).slice(0, 10)))}</span>${a.cvSent ? `<span>📄 ${esc(a.cvSent)}</span>` : ''}${a.followUp ? `<span>follow up ${esc(rel(a.followUp))}</span>` : ''}</div></div></div>`).join('')}</div></div>` : ''}
  <p class="small">Nothing is sent without your approval. Emails go from your domain with your email as the reply address, your latest CV attached, max 25 a day. Jobs without an email address (LinkedIn, Indeed, company portals) cannot be submitted by any app; approving them puts them in your one-minute Sprint with the cover note ready.</p>`;
}
const _vJobsV8 = vJobs;
vJobs = function () {
  if (!ui.jTab) ui.jTab = 'auto';
  if (ui.jTab !== 'auto') return _vJobsV8().replace('<div class="seg ptabs" style="margin:12px 0">', `<div class="seg ptabs" style="margin:12px 0"><button data-act="j-tab" data-t="auto">🤖 Autopilot${foundJobs().length ? ` <b class="badge inl">${foundJobs().length}</b>` : ''}</button>`);
  const h = _vJobsV8(); const i = h.indexOf('<div class="card sprint-hero">');
  const tabs = `<div class="seg ptabs" style="margin:12px 0"><button class="on" data-act="j-tab" data-t="auto">🤖 Autopilot${foundJobs().length ? ` <b class="badge inl">${foundJobs().length}</b>` : ''}</button>${[['pipeline', 'Pipeline'], ['list', 'List'], ['follow', 'Follow-ups'], ['tpl', 'Templates']].map(([k, l]) => `<button data-act="j-tab" data-t="${k}">${l}</button>`).join('')}</div>`;
  return h.slice(0, i) + tabs + vAuto();
};
function apSendSheet(ids) {
  const apps = ids.map(id => get('applications', id)).filter(a => a && a.contactEmail), cv = (JOBST && JOBST.cv) || [];
  if (!apps.length) { toast('No email address found for these jobs'); return; }
  if (!cv.length) { toast('Upload your CV first'); return; }
  const [subj, body] = apSplit(), one = apps.length === 1 ? apps[0] : null, fill = (s, a) => fillTpl(s, Object.assign({}, a, { contact: a.contact || 'Hiring Manager' }));
  openSheet(one ? 'Send application' : `Send ${apps.length} applications`, `${one ? `<div class="f"><label>To</label><input name="to" type="email" value="${esc(one.contactEmail)}"></div><div class="f"><label>Subject</label><input name="subj" value="${esc(fill(subj, one))}"></div><div class="f"><label>Message</label><textarea name="body" rows="9" dir="auto">${esc(fill(body, one))}</textarea></div>`
    : `<div class="list">${apps.map(a => `<div class="row"><span class="att-i">✉</span><div class="main"><div class="t" dir="auto">${esc(a.role)} · ${esc(a.company || '')}</div><div class="m"><span>${esc(a.contactEmail)}</span><span>${Number(a.match) || 0}% match</span></div></div></div>`).join('')}</div><p class="small">Each email uses your “Email application” template, filled with the role and company.</p>`}
    <div class="apattach"><span>📎</span><div><b>${esc(cv[0].name)}</b><div class="small">Your latest CV · uploaded ${esc(fmtDate(String(cv[0].at).slice(0, 10)))}</div></div></div>
    <label class="row apok"><input type="checkbox" name="ok" style="width:22px;height:22px"><div class="main"><div class="t">I approve sending ${one ? 'this application' : `these ${apps.length} applications`}</div><div class="small">Sent from ${esc((JOBST && JOBST.mailFrom) || 'your domain')} with your email as reply address.</div></div></label>`,
    `<button class="btn primary wide" data-act="form-save">Send ${apps.length === 1 ? 'now' : apps.length + ' now'}</button>`, { noFocus: true, onSave: async () => {
      const el = sheetCtx.el; if (!el.querySelector('[name=ok]').checked) { toast('Tick the approval box first'); return; }
      const btn = el.querySelector('.sheet-f .btn'); btn.disabled = true; let n = 0, err = '';
      for (const a of apps) { btn.textContent = `Sending ${n + 1} of ${apps.length}…`;
        try { await api('jobs-send', { body: one ? { id: a.id, to: el.querySelector('[name=to]').value.trim(), subject: el.querySelector('[name=subj]').value, body: el.querySelector('[name=body]').value, cv: cv[0].id, approved: true } : { id: a.id, to: a.contactEmail, subject: fill(subj, a), body: fill(body, a), cv: cv[0].id, approved: true } }); n++; }
        catch (e) { err = e.message; if (/limit/i.test(err)) break; } }
      closeSheet(); ui.apSel = []; saveUi(); await sync(); jobsState(true).then(render);
      toast(n ? `Sent ${n} application${n === 1 ? '' : 's'} with your CV ✉${err ? ' · ' + err : ''}` : err || 'Nothing sent'); if (n) { celebrate(); emiReact('test', n > 1 ? `${n} applications out! Fingers crossed 🤞` : 'Application sent! Fingers crossed 🤞'); }
    } });
}
function apApprove(id) { const a = get('applications', id); if (!a) return; save('applications', Object.assign({}, a, { stage: 'Saved', approvedOn: today() })); }
function apKeysSheet() {
  api('jobs-keys').then(r => {
    form('Job sources', [{ html: `<p class="small" style="margin-top:0">Free developer keys. Adzuna: developer.adzuna.com · Reed: reed.co.uk/developers · Jooble: jooble.org/api/about. Keys stay on your server. Saved: ${['adzuna', 'reed', 'jooble'].filter(k => r.has[k]).join(', ') || 'none yet'}.</p>` }, [{ k: 'adzunaId', label: 'Adzuna app ID' }, { k: 'adzunaKey', label: 'Adzuna app key' }], { k: 'reedKey', label: 'Reed API key' }, { k: 'joobleKey', label: 'Jooble API key' }, { k: 'mailFrom', label: 'Send applications from', type: 'email', ph: 'jobs@miladebrahimi.me (create it in Hostinger email)' }], { mailFrom: r.mailFrom }, async v => { try { await api('jobs-keys', { body: v }); toast('Saved'); jobsState(true).then(render); } catch (e) { toast(e.message); } });
  }).catch(e => toast(e.message));
}
function v9JobActs(a, id) {
  return {
    'ap-toggle': () => { const on = !apPrefs().on; apSave({ on }); toast(on ? 'Autopilot on: it searches every day' : 'Autopilot paused'); },
    'ap-run': async () => { if (!apPrefs().titles.length) { toast('Add a job title first'); return; } a.disabled = true; a.textContent = 'Searching…'; await sync(); try { const r = await api('jobs-run', { body: {} }); await sync(); JOBST = null; await jobsState(true); render(); toast(r.ok ? `${r.added} new matching job${r.added === 1 ? '' : 's'} from ${r.searched} found · ${r.sources.join(', ')}` : r.error); } catch (e) { toast(e.message === 'offline' ? 'No connection' : e.message); render(); } },
    'ap-title-add': () => apSave({ titles: [...new Set([...apPrefs().titles, a.dataset.v])] }), 'ap-title-del': () => apSave({ titles: apPrefs().titles.filter(t => t !== a.dataset.v) }),
    'ap-cc': () => { const c = apPrefs().countries, v = a.dataset.v; apSave({ countries: c.includes(v) ? c.filter(x => x !== v) : [...c, v] }); },
    'ap-min': () => apSave({ minScore: Number(a.dataset.v) }), 'ap-keys': () => apKeysSheet(),
    'ap-send': () => apSendSheet([id]), 'ap-ok': () => { apApprove(id); toast('Approved · it is in your Sprint queue', 'Open Sprint', () => sprintOpen()); },
    'ap-no': () => { const x = get('applications', id); if (x) save('applications', Object.assign({}, x, { stage: 'Withdrawn', skipped: today() })); },
    'ap-selall': () => { ui.apSel = (ui.apSel || []).length ? [] : foundJobs().map(x => x.id); saveUi(); render(); },
    'ap-bulk': () => { const ids = ui.apSel || [], withMail = ids.filter(i => (get('applications', i) || {}).contactEmail), rest = ids.filter(i => !withMail.includes(i)); rest.forEach(apApprove); if (rest.length) toast(`${rest.length} approved into your Sprint queue`); ui.apSel = withMail; saveUi(); if (withMail.length) apSendSheet(withMail); else { ui.apSel = []; saveUi(); render(); } },
    'ap-bulk-no': () => { (ui.apSel || []).forEach(i => { const x = get('applications', i); if (x) save('applications', Object.assign({}, x, { stage: 'Withdrawn', skipped: today() })); }); ui.apSel = []; saveUi(); },
    'cv-dl': () => { fetch(`${API}?action=cv-get&id=${encodeURIComponent(id)}`, { headers: { Authorization: 'Bearer ' + ls.get(K.tok), 'X-Auth-Token': ls.get(K.tok) } }).then(r => r.blob()).then(b => { const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = ((JOBST.cv || []).find(c => c.id === id) || {}).name || 'CV.pdf'; document.body.appendChild(l); l.click(); l.remove(); }).catch(() => toast('Could not download')); }
  };
}
document.addEventListener('change', e => {
  const d = e.target.dataset || {};
  if (d.change === 'ap-sel') { const s = new Set(ui.apSel || []); if (e.target.checked) s.add(d.id); else s.delete(d.id); ui.apSel = [...s]; saveUi(); render(); }
  if (d.change === 'ap-skills' || d.change === 'ap-exclude') apSave({ [d.change === 'ap-skills' ? 'skills' : 'exclude']: e.target.value.split(',').map(x => x.trim()).filter(Boolean) });
  if (d.change === 'cv-up') { const f = e.target.files[0]; if (!f) return; if (f.size > 5 * 1024 * 1024) { toast('Max 5 MB'); return; } const rd = new FileReader(); rd.onload = async () => { try { toast('Uploading…'); const r = await api('cv-upload', { body: { name: f.name, data: String(rd.result).split(',')[1] } }); JOBST = Object.assign(JOBST || {}, { cv: r.cv }); render(); toast('CV saved · this one will be sent'); } catch (err) { toast(err.message); } }; rd.readAsDataURL(f); e.target.value = ''; }
});
document.addEventListener('submit', e => { const f = e.target; if (f.dataset && f.dataset.form === 'ap-title') { e.preventDefault(); e.stopImmediatePropagation(); const v = (f.q.value || '').trim(); if (v) apSave({ titles: [...new Set([...apPrefs().titles, v])] }); } }, true);


/* ---------- ⋯ menu: actions for the page you are on (edit, delete, add), then the rest of the app ---------- */
function pageMenu() {
  const { page, arg } = route(), it = [], add = (act, l, ic, x = '') => it.push(`<button class="pm-i ${/del/.test(act) ? 'danger' : ''}" data-act="${act}" ${x}><span>${ic}</span>${esc(l)}</button>`), idA = v => `data-id="${esc(v)}"`;
  if (page === 'goal' && get('goals', arg)) { const g = get('goals', arg); add('goal-edit', 'Edit goal', '✎', idA(arg)); add('goal-status', 'Change status', '●', idA(arg)); add(g.plan && g.plan.length ? 'plan-add' : 'plan-from-goal', g.plan && g.plan.length ? 'Add micro-action' : 'Make my action plan', '⚡', idA(arg)); add('pm-ms', 'Add milestone', '⚑', idA(arg)); add('pm-del-goal', 'Delete goal', '🗑', idA(arg)); }
  else if (page === 'area' && get('areas', arg)) { add('area-form', 'Edit or remove area', '✎', idA(arg)); add('goal-wizard', 'New goal in this area', '⚑', idA(arg)); add('new-habit-area', 'New habit in this area', '🔁', idA(arg)); add('new-course', 'New course', '📘', `data-area="${esc(arg)}"`); }
  else if (page === 'course' && get('courses', arg)) { add('c-edit', 'Edit or delete course', '✎', idA(arg)); }
  else if (page === 'board' && get('projects', arg)) { add('project', 'Edit or delete board', '✎', idA(arg)); add('k-add', 'New task', '+', `${idA(arg)} data-col="To do"`); }
  else if (page === 'test' && arg) { add('test-start', 'Retake this test', '↻', idA(arg)); add('pm-del-test', 'Delete my result', '🗑', idA(arg)); }
  else if (page === 'jobs') { add('job-bulk', 'Add jobs', '+'); add('new-application', 'New application', '✎'); if (isOwner()) add('ap-keys', 'Job sources and sender email', '⚙'); }
  else if (page === 'habits') add('new-habit', 'New habit', '🔁');
  else if (page === 'life' || page === 'progress') { add('goal-wizard', 'New goal (5 steps)', '⚑'); add('wheel-test', 'Wheel of Life test', '◎'); add('areas-edit', 'Edit areas', '✎'); add('cycle-new', 'New 40-day cycle', '↻'); add('cr-open', '40-day report', '📊'); }
  const common = [['new-task', 'Task', '✓'], ['goal-wizard', 'Goal', '⚑'], ['new-habit', 'Habit', '🔁'], ['new-event', 'Event', '📅']];
  openSheet('Options', `${it.length ? `<div class="pm-g">${it.join('')}</div>` : ''}<div class="small pm-h">Add</div><div class="pm-q">${common.map(([a, l, ic]) => `<button data-act="${a}"><span>${ic}</span>${l}</button>`).join('')}</div>
    <div class="pm-g" style="margin-top:12px"><button class="pm-i" data-act="go" data-to="hub"><span>▦</span>All sections</button><button class="pm-i" data-act="go" data-to="trash"><span>♻</span>Trash (restore deleted)</button><button class="pm-i" data-act="go" data-to="settings"><span>⚙</span>Settings</button></div>`, '', { noFocus: true });
}
function planEdit(gid, pid) {
  const g = get('goals', gid), q = g && (g.plan || []).find(x => x.id === pid); if (!q) return;
  form('Edit micro-action', [{ k: 't', label: 'Micro-action', req: true }, [{ k: 'count', label: 'How many times', type: 'number' }, { k: 'sym', label: 'Symbol' }], { html: `<div class="small">Done ${pDone(q)} times so far.</div>` }], { t: q.t, count: q.count, sym: q.sym },
    v => { save('goals', Object.assign({}, g, { plan: g.plan.map(x => x.id === pid ? Object.assign({}, x, { t: v.t.trim(), count: Math.max(1, Number(v.count) || x.count), sym: (v.sym || x.sym).slice(0, 2) }) : x) })); toast('Saved'); },
    { onDelete: () => { if (confirm('Delete this micro-action?')) { save('goals', Object.assign({}, g, { plan: g.plan.filter(x => x.id !== pid) })); closeSheet(); } } });
}
function pmActs(a, id) {
  return {
    'page-menu': () => pageMenu(), 'plan-edit': () => planEdit(id, a.dataset.p),
    'pm-ms': () => { closeSheet(true); FORMS.milestone({ goalId: id, status: 'Planned' }); },
    'pm-del-goal': () => { const g = get('goals', id); if (!g || !confirm(`Delete “${g.title}”? Its milestones go to Trash too.`)) return; list('milestones').filter(m => m.goalId === id).forEach(m => remove('milestones', m.id)); remove('goals', id); closeSheet(true); toast('Goal moved to Trash'); location.hash = '#/life'; },
    'pm-del-test': () => { const rs = list('tests').filter(r => r.test === id); if (!rs.length || !confirm('Delete your result for this test?')) return; rs.forEach(r => remove('tests', r.id)); closeSheet(true); toast('Result deleted'); location.hash = '#/discover'; }
  };
}
/* ================= v9.2: Google-style calendar drag, tasks ↔ calendar, Today hero, roadmap by area, editable board table, sounds ================= */
/* ---------- sounds: soft, short, synthesised (no files) ---------- */
const SND = (() => { let ctx = null; const SEQ = { done: [[880, 0, .12], [1320, .08, .2]], habit: [[660, 0, .1], [990, .07, .18]], micro: [[784, 0, .1], [1175, .06, .22]], celebrate: [[523, 0, .12], [659, .1, .12], [784, .2, .12], [1047, .3, .35]], pick: [[520, 0, .05, 'triangle', .035]], drop: [[390, 0, .08, 'triangle', .04]], del: [[300, 0, .09, 'sine', .04], [210, .06, .14, 'sine', .03]], soft: [[1100, 0, .05, 'sine', .02]] };
  return { play(k) { if (ui.soundOff || !SEQ[k]) return; try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); const n = ctx.currentTime;
    SEQ[k].forEach(([f, t0, d, type = 'sine', g = .06]) => { const o = ctx.createOscillator(), v = ctx.createGain(); o.type = type; o.frequency.value = f; v.gain.setValueAtTime(0, n + t0); v.gain.linearRampToValueAtTime(g, n + t0 + .012); v.gain.exponentialRampToValueAtTime(.0001, n + t0 + d); o.connect(v).connect(ctx.destination); o.start(n + t0); o.stop(n + t0 + d + .02); }); } catch (e) { } } }; })();
const _saveV9 = save;
save = function (c, rec) {
  const prev = rec && rec.id && db[c] && db[c][rec.id] ? db[c][rec.id] : null, r = _saveV9(c, rec), t = today();
  try {
    if (c === 'tasks' && prev && isOpen(prev) && !isOpen(r)) SND.play('done');
    else if (c === 'habits' && prev && !(prev.done || {})[t] && (r.done || {})[t]) SND.play('habit');
    else if (c === 'goals' && prev && Array.isArray(r.plan)) { const n = g => (g.plan || []).reduce((s, p) => s + ((p.done || {})[t] ? 1 : 0), 0); if (n(r) > n(prev)) SND.play('micro'); }
    else if (c === 'events' && prev && !(prev.doneOn || {})[t] && (r.doneOn || {})[t]) SND.play('done');
  } catch (e) { }
  return r;
};
const _removeV9 = remove; remove = function (c, id) { SND.play('del'); return _removeV9(c, id); };
const _celebrateV9 = celebrate; celebrate = function () { SND.play('celebrate'); return _celebrateV9(); };
const _vSettingsV9 = vSettings; vSettings = function () { return _vSettingsV9().replace('<div class="spacer" style="height:14px"></div>', `<div class="spacer" style="height:14px"></div><div class="card setrow"><div class="main"><b>🔔 Sounds</b><div class="small">A soft chime when you finish a task, habit or micro-action.</div></div><button class="btn small ${ui.soundOff ? '' : 'primary'}" data-act="snd-toggle">${ui.soundOff ? 'Off' : 'On'}</button></div>`); };

/* ---------- calendar: hold an event to move it (any day/time), drag its bottom edge to change the length ---------- */
let gdrag = null, gSuppress = 0;
const SNAP = 15, pxMin = HOUR_PX / 60;
function gbInfo(b) { const col = b.closest('.gcol'); return { col, day: col && col.dataset.day, top: parseFloat(b.style.top) || 0, h: parseFloat(b.style.height) || 24 }; }
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.gcal .gb'); if (!b || !['event', 'task'].includes(b.dataset.act) || e.button > 0) return;
  const i = gbInfo(b), r = b.getBoundingClientRect(), resize = e.clientY > r.bottom - 14;
  gdrag = Object.assign(i, { b, id: b.dataset.id, act: b.dataset.act, x0: e.clientX, y0: e.clientY, day0: i.day, top0: i.top, h0: i.h, resize, on: false, pid: e.pointerId });
  gdrag.timer = setTimeout(() => { if (!gdrag) return; gdrag.on = true; b.classList.add('lift'); SND.play('pick'); try { navigator.vibrate && navigator.vibrate(12); } catch (x) { } }, e.pointerType === 'mouse' ? 140 : 380);
}, true);
document.addEventListener('touchmove', e => { if (gdrag && gdrag.on) e.preventDefault(); }, { passive: false });
document.addEventListener('pointermove', e => {
  if (!gdrag) return; const dx = e.clientX - gdrag.x0, dy = e.clientY - gdrag.y0;
  if (!gdrag.on) { if (gdrag.scrolling || Math.abs(dx) + Math.abs(dy) > 8) { if (e.pointerType === 'mouse') { gdrag.on = true; gdrag.b.classList.add('lift'); SND.play('pick'); } else { clearTimeout(gdrag.timer); gdrag.scrolling = true; const gb = $('#gbody'), d = e.clientY - (gdrag.ly ?? gdrag.y0); gdrag.ly = e.clientY; if (gb) gb.scrollTop -= d; window.scrollBy(0, gb && (gb.scrollTop <= 0 || gb.scrollTop + gb.clientHeight >= gb.scrollHeight) ? -d : 0); return; } } else return; }
  e.preventDefault(); const step = SNAP * pxMin, b = gdrag.b;
  if (gdrag.resize) { gdrag.h = Math.max(step, Math.round((gdrag.h0 + dy) / step) * step); b.style.height = gdrag.h + 'px'; }
  else { gdrag.top = Math.max(0, Math.round((gdrag.top0 + dy) / step) * step); b.style.top = gdrag.top + 'px';
    const el = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList && x.classList.contains('gcol')); if (el && el !== gdrag.col) { el.appendChild(b); gdrag.col = el; gdrag.day = el.dataset.day; b.style.left = '0%'; b.style.width = '100%'; } }
  const s = H0 * 60 + Math.round(gdrag.top / pxMin), en = s + Math.round(gdrag.h / pxMin), sp = b.querySelector('span'); if (sp) sp.textContent = `${fromMin(s)}–${fromMin(en)}`;
  const gb = $('#gbody'); if (gb) { const r = gb.getBoundingClientRect(); if (e.clientY > r.bottom - 30) gb.scrollTop += 8; else if (e.clientY < r.top + 30) gb.scrollTop -= 8; }
}, { passive: false });
function gDrop() {
  const g = gdrag; gdrag = null; if (!g) return; clearTimeout(g.timer); if (g.scrolling) { gSuppress = Date.now(); return; } if (!g.on) return; gSuppress = Date.now(); g.b.classList.remove('lift');
  const s = H0 * 60 + Math.round(g.top / pxMin), dur = Math.max(SNAP, Math.round(g.h / pxMin)), delta = daysBetween(g.day0, g.day);
  if (s === H0 * 60 + Math.round(g.top0 / pxMin) && dur === Math.round(g.h0 / pxMin) && !delta) { render(); return; }
  const at = (dateStr, m) => fromInput(`${dateStr}T${fromMin(Math.min(m, 24 * 60 - 1))}`);
  if (g.act === 'event') { const ev = get('events', g.id); if (!ev) return render(); const sd = addDays(dayOf(ev.start), delta), prev = Object.assign({}, ev);
    save('events', Object.assign({}, ev, { start: at(sd, s), end: at(sd, s + dur) })); toast(`${ev.title} · ${fmtDate(g.day)} ${fromMin(s)}–${fromMin(s + dur)}${ev.rrule ? ' · all repeats' : ''}`, 'Undo', () => save('events', prev)); }
  else { const t = get('tasks', g.id); if (!t) return render(); const prev = Object.assign({}, t); save('tasks', Object.assign({}, t, { scheduled: at(g.day, s), scheduledEnd: at(g.day, s + dur), due: t.due && t.due < g.day ? g.day : t.due })); toast(`${t.title} · ${fmtDate(g.day)} ${fromMin(s)}`, 'Undo', () => save('tasks', prev)); }
  SND.play('drop');
}
document.addEventListener('pointerup', gDrop, true); document.addEventListener('pointercancel', () => { if (gdrag && !gdrag.on) { clearTimeout(gdrag.timer); gdrag = null; } else gDrop(); }, true);
document.addEventListener('click', e => { if (Date.now() - gSuppress < 400 && e.target.closest('.gcal')) { e.stopPropagation(); e.preventDefault(); } }, true);
/* place a task: pick it in the tray, then tap a time */
document.addEventListener('click', e => {
  if (!ui.place) return; const col = e.target.closest('.gcol'); if (!col || e.target.closest('.gb')) return; e.stopPropagation(); e.preventDefault();
  const t = get('tasks', ui.place); delete ui.place; saveUi(); if (!t) return render();
  const r = col.getBoundingClientRect(), m = H0 * 60 + Math.floor((e.clientY - r.top) / pxMin / SNAP) * SNAP, d = col.dataset.day;
  save('tasks', Object.assign({}, t, { scheduled: fromInput(`${d}T${fromMin(m)}`), scheduledEnd: fromInput(`${d}T${fromMin(m + 30)}`), due: t.due || d })); SND.play('drop'); toast(`Scheduled ${fromMin(m)} · hold it to move or stretch`);
}, true);
const trayTasks = () => sortTasks(list('tasks').filter(x => isOpen(x) && !x.scheduled)).slice(0, 14);
const _calHeadV9 = calHead;
calHead = function (title, view) {
  const tt = trayTasks();
  return _calHeadV9(title, view) + `<div class="caltray"><a class="btn small" href="#/tasks">☑ Tasks</a>${view === 'month' ? '' : tt.length ? `<span class="small">${ui.place ? 'Now tap a time ↓' : 'Tap a task, then a time · hold an event to move it'}</span><div class="ctray">${tt.map(x => `<button class="${ui.place === x.id ? 'on' : ''}" data-act="cal-place" data-id="${esc(x.id)}" dir="auto">${x.priority === 'P1' ? '🔴 ' : ''}${esc(x.title)}</button>`).join('')}</div>` : '<span class="small">All tasks are scheduled.</span>'}</div>`;
};
/* tasks page: calendar access + schedule from the task */
const _vTasksV9 = vTasks;
vTasks = function () {
  const t = today(), ag = agenda(t, addDays(t, 2)).filter(a => a.time && a.kind !== 'due').slice(0, 6);
  return _vTasksV9().replace('<div class="spacer" style="height:14px"></div>', `<div class="spacer" style="height:14px"></div><div class="card tcal"><div class="tcal-h"><b>📅 Coming up</b><a class="btn small" href="#/calendar">Open calendar</a></div>${ag.length ? `<div class="tcal-l">${ag.map(a => `<div class="tcal-i" data-act="${a.kind === 'event' ? 'event' : 'task'}" data-id="${esc(a.id)}" role="button"><b>${a.day === t ? 'Today' : esc(fmtDate(a.day))} ${esc(a.time)}</b><span dir="auto">${esc(a.title)}</span></div>`).join('')}</div>` : '<div class="small">Nothing scheduled in the next 3 days. Open a task and tap “Schedule time”.</div>'}</div>`);
};
function schedSheet(id) {
  const t = get('tasks', id); if (!t) return; const cur = t.scheduled ? toInput(t.scheduled) : `${t.due || today()}T09:00`, d0 = t.scheduled && t.scheduledEnd ? Math.max(15, Math.round((parseD(t.scheduledEnd) - parseD(t.scheduled)) / 60000)) : 30;
  form('Schedule on calendar', [[{ k: 'day', label: 'Day', type: 'date' }, { k: 'time', label: 'Start', type: 'time' }], { k: 'dur', label: 'Length', type: 'select', options: [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1.5 hours'], [120, '2 hours'], [180, '3 hours']], blank: false }], { day: cur.slice(0, 10), time: cur.slice(11, 16), dur: d0 }, v => {
    if (!v.day || !v.time) return 'Pick a day and a time.'; const [h, m] = v.time.split(':').map(Number), s = h * 60 + m, e2 = s + Number(v.dur || 30);
    save('tasks', Object.assign({}, t, { scheduled: fromInput(`${v.day}T${v.time}`), scheduledEnd: fromInput(`${v.day}T${fromMin(Math.min(e2, 1439))}`), due: t.due || v.day })); toast('On your calendar', 'Open', () => { ui.calSel = v.day; saveUi(); location.hash = '#/calendar'; });
  }, { onDelete: t.scheduled ? () => { save('tasks', Object.assign({}, t, { scheduled: '', scheduledEnd: '' })); closeSheet(); toast('Removed from calendar'); } : null });
}
const _taskSheetV9 = taskSheet;
taskSheet = function (id) { const r = _taskSheetV9.apply(this, arguments); try { const box = sheetCtx && sheetCtx.el.querySelector('.acts'); if (box && get('tasks', id) && isOpen(get('tasks', id))) box.insertAdjacentHTML('afterbegin', `<button class="act" data-act="t-sched" data-id="${esc(id)}"><span>🕒</span>${get('tasks', id).scheduled ? 'Reschedule' : 'Schedule time'}</button>`); } catch (e) { } return r; };

/* ---------- Today: a clear hero instead of a stack of boxes ---------- */
coachCard = () => '';
function todayHero() {
  const t = today(), a = assess(), top = list('tasks').filter(x => x.focusDate === t), topD = top.filter(x => !isOpen(x)).length, hs = list('habits').filter(h => habDue(h, t)), hD = hs.filter(h => (h.done || {})[t]).length, ms = microToday(), mD = ms.filter(m => m.done).length;
  const nowM = new Date().getHours() * 60 + new Date().getMinutes(), nx = agenda(t, t).filter(x => x.time && toMin(x.time) >= nowM - 5 && !(x.kind === 'event' && ((x.rec.doneOn || {})[t])))[0];
  const msg = (coachMsgs()[slotOf(new Date().getHours())] || '').replace(/^(Good (morning|afternoon|evening)|Hi),?[^.]*\.\s*/, '');
  const pc = Math.round(a.s * 10), st = (l, n, d, ic) => `<div class="th-s"><span>${ic}</span><b>${n}<small>/${d}</small></b><em>${l}</em></div>`;
  return `<div class="card thero"><div class="th-top"><div class="th-ring" style="--p:${pc}" data-act="assess-info" role="button"><b>${a.s}</b><small>/10</small></div><div class="main"><div class="th-lv">${a.level} level</div><div class="th-msg" dir="auto">${esc(msg || 'One step at a time.')}</div>${nx ? `<div class="th-next" data-act="${nx.kind === 'event' ? 'event' : 'task'}" data-id="${esc(nx.id)}" role="button">Next · <b>${esc(nx.time)}</b> <span dir="auto">${esc(nx.title)}</span></div>` : ''}</div></div>
    <div class="th-stats">${st('Top 3', topD, Math.max(3, top.length), '★')}${st('Habits', hD, hs.length || 0, '🔁')}${st('Actions', mD, ms.length || 0, '⚡')}</div></div>`;
}
const _vTodayV91 = vToday;
vToday = function () { const h = _vTodayV91(); if (ui.tday && ui.tday !== today()) return h; return h.replace(/<div class="asrow">[\s\S]*?<\/button><\/div>/, '').replace(/(<div class="wstrip">[\s\S]*?<\/div>)/, '$1' + todayHero()); };

/* ---------- Life: visual tools ---------- */
const _vLifeV91 = vLife;
vLife = function () {
  const h = _vLifeV91(), i = h.indexOf('<h2 class="sec-h">Tools for your areas</h2>'); if (i < 0) return h;
  const t = today(), gs = list('goals').filter(g => !['Done', 'Achieved', 'Dropped', 'Cancelled'].includes(g.status)), gp = gs.length ? Math.round(gs.reduce((s, g) => s + pct(goalProgress(g)), 0) / gs.length) : 0;
  const hs = list('habits').filter(h2 => habDue(h2, t)), c = activeCycle(), nm = list('milestones').filter(m => m.target && m.target >= t && m.status !== 'Done').sort((a, b) => a.target.localeCompare(b.target))[0];
  const ls7 = list('logs').filter(l => l.type === 'closeout' && l.date >= addDays(t, -6) && Number(l.score)), avg = ls7.length ? r2(ls7.reduce((s, l) => s + Number(l.score), 0) / ls7.length) : null, cs = list('courses').filter(x => x.status === 'Active');
  const T = (act, x, col, ic, l, big, sub, bar) => `<button class="vtool" data-act="${act}" ${x} style="--tc:${col}"><span class="vt-i">${ic}</span><b>${l}</b><div class="vt-big">${big}</div><div class="small">${sub}</div>${bar != null ? `<i class="vt-bar"><i style="width:${Math.max(3, Math.min(100, bar))}%"></i></i>` : ''}</button>`;
  return h.slice(0, i) + `<h2 class="sec-h">Tools for your areas</h2><div class="vtools">
    ${T('p-tab', 'data-t="goals"', '#2a78d6', '⚑', 'Goals', gs.length, `${gp}% average progress`, gp)}
    ${T('go', 'data-to="habits"', '#1baf7a', '🔁', 'Habits', `${hs.filter(x => (x.done || {})[t]).length}/${hs.length}`, 'done today', hs.length ? 100 * hs.filter(x => (x.done || {})[t]).length / hs.length : 0)}
    ${T('p-tab', 'data-t="overview"', '#c9a227', '◷', '40-day cycle', c ? `${cycleDay(c)}/40` : '–', c ? 'days into your cycle' : 'start one', c ? 100 * cycleDay(c) / 40 : 0)}
    ${T('p-tab', 'data-t="roadmap"', '#6250d6', '🛣', 'Roadmap', nm ? esc(rel(nm.target)) : '–', nm ? esc(nm.title).slice(0, 40) : 'add milestones', null)}
    ${T('p-tab', 'data-t="insights"', '#e87ba4', '📈', 'Insights', avg ?? '–', 'average day score, 7 days', avg ? avg * 10 : 0)}
    ${T('p-tab', 'data-t="learning"', '#eb6834', '📘', 'Learning', cs.length, 'active courses', null)}
    ${T('p-tab', 'data-t="money"', '#008300', '💰', 'Money', esc(String(prefs().currency || 'OMR')), 'savings and income', null)}</div>`;
};

/* ---------- Roadmap: filter by area (one, several or all), three views ---------- */
vRoadmap = function () {
  const t = today(), vd = visionDate(), as = areas(), sel = (ui.rmAreas || []).filter(id => get('areas', id)), on = a => !sel.length || sel.includes(a.id), view = ui.rmView || 'lanes';
  const gArea = g => goalArea(g), gs = list('goals').filter(g => !['Dropped', 'Cancelled'].includes(g.status) && (!sel.length || (gArea(g) && sel.includes(gArea(g).id)))).sort((a, b) => String(a.target || '9').localeCompare(String(b.target || '9')));
  const gids = new Set(gs.map(g => g.id)), ms = list('milestones').filter(m => m.status !== 'Dropped' && (gids.has(m.goalId) || (!sel.length && !m.goalId)));
  const end = [vd, ...gs.map(g => g.target).filter(Boolean)].sort().pop(), span = Math.max(30, daysBetween(t, end)), pos = d => Math.max(0, Math.min(100, 100 * daysBetween(t, d) / span));
  const gpc = g => Array.isArray(g.plan) && g.plan.length ? Math.round(100 * g.plan.reduce((x, q) => x + Math.min(q.count, pDone(q)), 0) / g.plan.reduce((x, q) => x + q.count, 0)) : pct(goalProgress(g));
  const months = []; { const d = parseD(t); d.setDate(1); d.setMonth(d.getMonth() + 1); for (let i = 0; i < 80 && dstr(d) <= end; i++) { months.push(dstr(d)); d.setMonth(d.getMonth() + (span > 900 ? 6 : span > 400 ? 3 : 1)); } }
  const axis = `<div class="ln-axis">${months.map(m => `<span style="left:${pos(m)}%">${esc(parseD(m).toLocaleDateString(LOC(), { month: 'short', year: span > 400 ? '2-digit' : undefined }))}</span>`).join('')}</div>`;
  const chips = `<div class="rmchips"><button class="${sel.length ? '' : 'on'}" data-act="rm-all">All areas</button>${as.map(a => `<button class="${sel.includes(a.id) ? 'on' : ''}" data-act="rm-area" data-id="${esc(a.id)}" style="--ac:${areaColor(a)}">${areaEmoji(a)} ${esc(a.title)}</button>`).join('')}</div>`;
  const views = `<div class="seg rmview">${[['lanes', '▤ Lanes'], ['road', '🛣 Road'], ['list', '☰ List']].map(([k, l]) => `<button class="${view === k ? 'on' : ''}" data-act="rm-view" data-v="${k}">${l}</button>`).join('')}</div>`;
  const one = sel.length === 1 ? get('areas', sel[0]) : null;
  const hero = one ? `<div class="card rm-hero" style="background:linear-gradient(135deg,${areaColor(one)},color-mix(in srgb,${areaColor(one)} 55%,#1d2440))"><div class="rm-v"><div class="small">${areaEmoji(one)} ${esc(one.title)} roadmap</div><b dir="auto">${esc(one.vision || 'Where I want ' + one.title + ' to be')}</b><button class="btn small ghost" data-act="area-form" data-id="${esc(one.id)}">Edit vision</button></div><div class="rm-n">${areaScore(one.id) ?? '–'}<small>now → ${areaTarget(one)} target</small></div></div>`
    : `<div class="card rm-hero"><div class="rm-v"><div class="small">${sel.length ? sel.length + ' areas' : 'Your vision'}</div><b dir="auto">${esc(prefs().visionName || 'My vision')}</b>${prefs().visionText ? `<div class="small" dir="auto">${esc(prefs().visionText)}</div>` : ''}<button class="btn small ghost" data-act="vision">Change</button></div><div class="rm-n">${daysTo(vd).toLocaleString('en-GB')}<small>days to go</small></div></div>`;
  const stats = (() => { const d = ms.filter(m => m.status === 'Done').length, late = ms.filter(m => m.target && m.target < t && m.status !== 'Done').length, av = gs.length ? Math.round(gs.reduce((s, g) => s + gpc(g), 0) / gs.length) : 0; return `<div class="rmstats"><div><b>${gs.length}</b><span>goals</span></div><div><b>${av}%</b><span>avg progress</span></div><div><b>${d}/${ms.length}</b><span>milestones</span></div><div class="${late ? 'bad' : ''}"><b>${late}</b><span>late</span></div></div>`; })();
  const goalBar = g => { const a = gArea(g), s0 = g.createdAt ? String(g.createdAt).slice(0, 10) : t, s = s0 < t ? t : s0, p = gpc(g), gm = ms.filter(m => m.goalId === g.id && m.target);
    return `<div class="ln-g" data-act="go" data-to="goal/${encodeURIComponent(g.id)}" role="button" style="--ac:${a ? areaColor(a) : 'var(--brass)'}"><div class="ln-gl"><b dir="auto">${esc(g.title)}</b><em>${p}%</em></div><div class="ln-tr"><i class="ln-today"></i>${g.target ? `<i class="ln-bar" style="left:${pos(s)}%;width:${Math.max(2, pos(g.target) - pos(s))}%"><b style="width:${p}%"></b></i>` : '<span class="small">no date</span>'}${gm.map(m => `<i class="ln-ms ${m.status === 'Done' ? 'done' : m.target < t ? 'late' : ''}" style="left:${pos(m.target)}%" title="${esc(m.title)} · ${esc(fmtDate(m.target))}"></i>`).join('')}</div></div>`; };
  let body = '';
  if (view === 'lanes') body = `<div class="card lanes">${axis}${as.filter(on).map(a => { const ag = gs.filter(g => gArea(g) && gArea(g).id === a.id); return `<div class="lane" style="--ac:${areaColor(a)}"><div class="lane-h" data-act="go" data-to="area/${encodeURIComponent(a.id)}" role="button"><span>${areaEmoji(a)}</span><b>${esc(a.title)}</b><em>${areaScore(a.id) ?? '–'} → ${areaTarget(a)}</em><span class="small">${ag.length} goal${ag.length === 1 ? '' : 's'}</span><button class="icon-btn" data-act="goal-wizard" data-id="${esc(a.id)}" aria-label="New goal">${I.plus}</button></div>${ag.map(goalBar).join('') || '<div class="small lane-e">No goal yet</div>'}</div>`; }).join('')}<div class="small" style="margin-top:8px">Bars run from today to each goal’s date · fill = progress · ◆ milestones (red = late)</div></div>`;
  else if (view === 'road') { const nx = ms.filter(m => m.target && m.status !== 'Done').sort((a, b) => a.target.localeCompare(b.target)).slice(0, 12), c = activeCycle();
    body = `<div class="card"><div class="road">${[`<div class="rd-n now"><i></i><div><b>Today</b><span>${esc(fmtDate(t, true))}${c ? ` · day ${cycleDay(c)} of 40` : ''}</span></div></div>`].concat(nx.map((m, i) => { const g = m.goalId && get('goals', m.goalId), a = g ? gArea(g) : null; return `<div class="rd-n ${i % 2 ? 'r' : 'l'} ${m.target < t ? 'late' : ''}" data-act="milestone" data-id="${esc(m.id)}" role="button" style="--ac:${a ? areaColor(a) : 'var(--brass)'}"><i>${areaEmoji(a)}</i><div><b dir="auto">${esc(m.title)}</b><span>${esc(fmtDate(m.target, true))} · ${esc(rel(m.target))}${g ? ' · ' + esc(g.title).slice(0, 30) : ''}</span></div></div>`; })).concat([`<div class="rd-n goal"><i>🏁</i><div><b dir="auto">${esc(one ? one.vision || one.title : prefs().visionName || 'My vision')}</b><span>${esc(fmtDate(one ? end : vd, true))}</span></div></div>`]).join('')}</div></div>`; }
  else body = `<div class="card"><div class="list">${gs.map(g => { const a = gArea(g), gm = ms.filter(m => m.goalId === g.id).sort((x, y) => String(x.target || '9').localeCompare(String(y.target || '9'))); return `<div class="rml" style="--ac:${a ? areaColor(a) : 'var(--brass)'}"><div class="rml-h" data-act="go" data-to="goal/${encodeURIComponent(g.id)}" role="button"><span>${areaEmoji(a)}</span><b dir="auto">${esc(g.title)}</b><em>${gpc(g)}%</em></div><div class="rml-m">${gm.map(m => `<button class="${m.status === 'Done' ? 'done' : ''}" data-act="milestone" data-id="${esc(m.id)}">${m.status === 'Done' ? '✓' : '◆'} ${esc(m.title)} <small>${m.target ? esc(fmtDate(m.target)) : ''}</small></button>`).join('') || '<span class="small">No milestones</span>'}</div></div>`; }).join('') || '<div class="empty">No goals in this filter.</div>'}</div></div>`;
  return header('Plan', 'Where you are going and by when') + planTabs() + chips + hero + stats + views + body + `<div class="btns" style="margin-top:12px"><button class="btn primary small" data-act="goal-wizard" ${one ? `data-id="${esc(one.id)}"` : ''}>${I.plus} Goal in 5 steps</button><button class="btn small" data-act="new-milestone">${I.plus} Milestone</button></div>`;
};

/* ---------- boards: the Notion-style table is editable in place ---------- */
function v91Acts(a, id) {
  return {
    'ob-lang': () => { flowRead(); ui.lang = a.dataset.v; saveUi(); applyLang(); flowDraw(); },
    'snd-toggle': () => { ui.soundOff = !ui.soundOff; saveUi(); if (!ui.soundOff) SND.play('done'); render(); },
    'cal-place': () => { ui.place = ui.place === id ? null : id; saveUi(); render(); if (ui.place) toast('Now tap a time in the calendar'); },
    't-sched': () => { closeSheet(true); schedSheet(id); },
    'rm-all': () => { ui.rmAreas = []; saveUi(); render(); }, 'rm-area': () => { const s = new Set(ui.rmAreas || []); s.has(id) ? s.delete(id) : s.add(id); ui.rmAreas = [...s]; saveUi(); render(); }, 'rm-view': () => { ui.rmView = a.dataset.v; saveUi(); render(); },
    'k-del': () => { const t = get('tasks', id); if (t && confirm(`Delete “${t.title}”?`)) { remove('tasks', id); toast('Moved to Trash'); } }
  };
}
document.addEventListener('change', e => {
  const d = e.target.dataset || {}; const t = d.id && get('tasks', d.id); if (!t) return;
  if (d.change === 'k-title' && e.target.value.trim()) save('tasks', Object.assign({}, t, { title: e.target.value.trim() }));
  else if (d.change === 'k-due') save('tasks', Object.assign({}, t, { due: e.target.value }));
  else if (d.change === 'k-pri') save('tasks', Object.assign({}, t, { priority: e.target.value }));
  else if (d.change === 'k-next') save('tasks', Object.assign({}, t, { nextAction: e.target.value }));
});

/* ================= v10: Claude assistant, 40-day report, Google Calendar import, development roadmap ================= */
async function aiAsk(kind, input) { const r = await api('ai', { body: { kind, input } }); return r; }
const aiBusy = (el, on, label) => { if (!el) return; el.disabled = on; if (on) { el.dataset.l = el.textContent; el.textContent = label || 'Thinking…'; } else if (el.dataset.l) el.textContent = el.dataset.l; };
/* settings: AI key (owner) and Google Calendar import (everyone) */
const _vSettingsV10 = vSettings;
vSettings = function () {
  setTimeout(() => { if (isOwner() && $('#aibox')) api('ai-config').then(r => { const b = $('#aibox'); if (b) b.innerHTML = `${r.hasKey ? '✓ Key saved' : 'No key yet'} · ${esc(r.model)} · max ${r.daily} requests a day <button class="btn small" data-act="ai-setup">${r.hasKey ? 'Change' : 'Add key'}</button>`; }).catch(() => {}); }, 0);
  const g = prefs().gcal || {};
  return _vSettingsV10().replace('<div class="spacer" style="height:14px"></div>', `<div class="spacer" style="height:14px"></div>
  ${isOwner() ? `<div class="card setrow"><div class="main"><b>✨ AI assistant (Claude)</b><div class="small" id="aibox">Loading…</div></div></div>` : ''}
  <div class="card setrow"><div class="main"><b>📅 Google Calendar</b><div class="small">${g.url ? `Connected · last import ${g.at ? esc(rel(String(g.at).slice(0, 10))) : 'never'} · ${g.n || 0} events` : 'Show your Google Calendar events inside ME.Coach.'}</div></div><div class="btns">${g.url ? `<button class="btn small" data-act="gcal-run">Import now</button>` : ''}<button class="btn small ${g.url ? 'ghost' : 'primary'}" data-act="gcal-setup">${g.url ? 'Change' : 'Connect'}</button></div></div>`);
};
function aiSetup() {
  form('AI assistant', [{ html: '<p class="small" style="margin-top:0">Create a key at console.anthropic.com → API keys, then paste it here. It is stored only on your server and never shown again. Usage is billed by Anthropic to your account.</p>' }, { k: 'key', label: 'Anthropic API key', type: 'password', ph: 'sk-ant-…' }, [{ k: 'model', label: 'Model', type: 'select', options: [['claude-opus-5-5', 'Claude Opus 5.5 (best)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (cheapest)']], blank: false }, { k: 'daily', label: 'Max requests a day', type: 'number', def: 40 }]], { model: 'claude-opus-5-5', daily: 40 },
    v => { api('ai-config', { body: { key: v.key || '', model: v.model, daily: Number(v.daily) || 40 } }).then(() => { toast('AI settings saved'); render(); }).catch(e => toast(e.message)); });
}
function gcalSetup() {
  const g = prefs().gcal || {};
  form('Google Calendar', [{ html: '<p class="small" style="margin-top:0">In Google Calendar on a computer: Settings → your calendar → Integrate calendar → copy <b>Secret address in iCal format</b>, paste it here. ME.Coach reads it every few hours. To send ME.Coach events to Google, use Settings → Calendar feed.</p>' }, { k: 'url', label: 'Secret iCal address', ph: 'https://calendar.google.com/calendar/ical/…/basic.ics' }], { url: g.url || '' }, v => {
    const url = (v.url || '').trim(); if (!url) { save('settings', Object.assign({}, prefs(), { id: 'prefs', gcal: {} })); list('events').filter(e => e.source === 'google').forEach(e => remove('events', e.id)); toast('Disconnected'); return; }
    save('settings', Object.assign({}, prefs(), { id: 'prefs', gcal: { url } })); setTimeout(() => gcalRun(true), 50);
  });
}
async function gcalRun(loud) {
  const g = prefs().gcal || {}; if (!g.url) return;
  try { const r = await api('gcal-import', { body: { url: g.url } }); const seen = new Set();
    r.events.forEach(x => { const id = 'gcal-' + String(x.uid).replace(/[^A-Za-z0-9]/g, '').slice(0, 60); seen.add(id); const cur = get('events', id), rec = { id, title: x.title, start: x.allDay ? x.start : x.start, end: x.end || '', allDay: !!x.allDay, rrule: x.rrule || '', source: 'google', kind: 'google' };
      if (!cur || cur.title !== rec.title || cur.start !== rec.start || cur.end !== rec.end || (cur.rrule || '') !== rec.rrule) save('events', Object.assign({}, cur || {}, rec)); });
    list('events').filter(e => e.source === 'google' && !seen.has(e.id)).forEach(e => _removeV9('events', e.id));
    save('settings', Object.assign({}, prefs(), { id: 'prefs', gcal: Object.assign({}, g, { at: nowIso(), n: r.events.length }) })); if (loud) toast(`${r.events.length} Google events imported`);
  } catch (e) { if (loud) toast(e.message); }
}
/* AI in the goal wizard, on the goal page, in the job email and in Emi */
async function aiMicro(goalTitle, areaTitle, kw, have) { const r = await aiAsk('micro', { goal: goalTitle, area: areaTitle, keyword: kw || '', have: (have || []).join('; ') }); return r.items || []; }
const _apSendSheetV10 = apSendSheet;
apSendSheet = function (ids) {
  _apSendSheetV10(ids); if (!sheetCtx || ids.length !== 1) return; const box = sheetCtx.el.querySelector('[name=body]'); if (!box) return;
  box.insertAdjacentHTML('beforebegin', '<button type="button" class="btn small" data-act="ai-cover" style="margin-bottom:6px">✨ Write it from my CV and this ad</button>'); sheetCtx.aiJob = ids[0];
};
const _emiSheetV10 = emiSheet;
emiSheet = function () { _emiSheetV10(); if (!sheetCtx) return; const b = sheetCtx.el.querySelector('.emi-sh'); if (b) b.insertAdjacentHTML('afterend', `<form class="qadd" data-form="emi-ask" style="margin:4px 0 12px"><input name="q" placeholder="Ask Emi anything…" dir="auto" autocomplete="off"><button class="btn primary" type="submit">✨</button></form><div id="emi-ans" class="emi-ans" hidden></div>`); };
function emiContext() {
  const as = areas().map(a => `${a.title} ${areaScore(a.id) ?? '?'}/10`).join(', '), gs = list('goals').filter(g => !['Done', 'Achieved', 'Dropped'].includes(g.status)).slice(0, 6).map(g => g.title).join('; '), a = assess();
  return `Name: ${(me && me.name) || ''}. Wheel: ${as}. Goals: ${gs}. Today: ${a.s}/10 (${a.level}). Open tasks today: ${list('tasks').filter(x => isOpen(x) && (x.due === today() || x.focusDate === today())).map(x => x.title).slice(0, 6).join('; ')}.`;
}
document.addEventListener('submit', async e => {
  const f = e.target; if (!(f.dataset && f.dataset.form === 'emi-ask')) return; e.preventDefault(); e.stopImmediatePropagation();
  const q = (f.q.value || '').trim(), out = $('#emi-ans'); if (!q || !out) return; out.hidden = false; out.textContent = 'Emi is thinking…'; if (emiInst) emiInst.play('think');
  try { const r = await aiAsk('emi', { q, context: emiContext() }); out.textContent = r.text; if (emiInst) { emiInst.play('nod'); emiInst.say(r.text.slice(0, 140) + (r.text.length > 140 ? '…' : ''), 7000); } f.q.value = ''; } catch (err) { out.textContent = err.message; }
}, true);

/* ---------- 40-day report ---------- */
function vCycleReport() {
  const c = activeCycle() || list('cycles').sort((a, b) => String(b.start).localeCompare(String(a.start)))[0];
  if (!c) return header('40-day report', '') + '<div class="card empty">Start a 40-day cycle to get a report.</div>';
  const st = cycleStats(c), end = addDays(c.start, (Number(c.days) || 40) - 1), ws = wheels(), before = ws.filter(w => w.date <= c.start)[0] || ws[ws.length - 1], after = ws.filter(w => w.date >= c.start)[0] || ws[0];
  const days = []; for (let i = 0; i < st.day; i++) days.push(addDays(c.start, i));
  const sc = days.map(d => { const l = logOf('closeout', d); return [d, l ? Number(l.assess != null ? l.assess : l.score) || 0 : 0]; });
  const gs = (c.goals || []).map(id => get('goals', id)).filter(Boolean), done = g => (g.plan || []).reduce((s, p) => s + Object.keys(p.done || {}).filter(d => d >= c.start && d <= end).length, 0);
  const best = sc.slice().sort((a, b) => b[1] - a[1]).filter(x => x[1]).slice(0, 3), avgA = sc.filter(x => x[1]).length ? r2(sc.filter(x => x[1]).reduce((s, x) => s + x[1], 0) / sc.filter(x => x[1]).length) : null;
  const rows = as => areas().map(a => { const b = before ? areaScore(a.id, before) : null, n = after ? areaScore(a.id, after) : null; return `<div class="cr-a" style="--ac:${areaColor(a)}"><span>${areaEmoji(a)} ${esc(a.title)}</span><i><b style="width:${(b || 0) * 10}%" class="was"></b><b style="width:${(n || 0) * 10}%"></b></i><em>${b ?? '–'} → ${n ?? '–'}</em></div>`; }).join('');
  ui.crData = `Cycle ${c.start} to ${end}, day ${st.day}/40. Intention: ${c.intention || ''}. Mornings ${st.morning}, nights ${st.night}, average day ${avgA ?? 'n/a'}/10. Wheel before: ${before ? areas().map(a => a.title + ' ' + (areaScore(a.id, before) ?? '?')).join(', ') : 'n/a'}. Wheel now: ${after ? areas().map(a => a.title + ' ' + (areaScore(a.id, after) ?? '?')).join(', ') : 'n/a'}. Goals: ${gs.map(g => `${g.title} (${done(g)} micro-actions done${g.plan ? ' of ' + g.plan.reduce((s, p) => s + p.count, 0) : ''})`).join('; ')}. Night notes: ${days.map(d => (logOf('closeout', d) || {}).better).filter(Boolean).slice(-8).join(' | ')}`;
  return header('40-day report', `${fmtDate(c.start, true)} – ${fmtDate(end, true)}`) + `<div class="cr">
  <div class="card cr-hero">${ring(Math.round(100 * st.day / (Number(c.days) || 40)), 92, `${st.day}/40`)}<div class="main"><div class="small">Intention</div><b dir="auto">${esc(c.intention || 'My 40 days')}</b><div class="rmstats" style="margin-top:10px"><div><b>${st.morning}</b><span>mornings</span></div><div><b>${st.night}</b><span>nights</span></div><div><b>${avgA ?? '–'}</b><span>avg day /10</span></div><div><b>${gs.reduce((s, g) => s + done(g), 0)}</b><span>micro-actions</span></div></div></div></div>
  <div class="card"><h2>Day by day</h2><div class="cr-bars">${sc.map(([d, v]) => `<i title="${esc(fmtDate(d))}: ${v}/10" style="height:${Math.max(4, v * 10)}%;opacity:${v ? 1 : .25}"></i>`).join('')}</div><div class="small">${best.length ? 'Best days: ' + best.map(([d, v]) => `${esc(fmtDate(d))} (${v})`).join(' · ') : 'Close your days with Night Balance to see this chart.'}</div></div>
  <div class="card"><h2>Wheel of Life: start → now</h2>${rows()}<div class="small" style="margin-top:6px">Faded bar = start of the cycle. Retake the book test at the end to see the real change.</div></div>
  <div class="card"><h2>Goals and micro-actions</h2><div class="list">${gs.map(g => { const tot = (g.plan || []).reduce((s, p) => s + p.count, 0), d = done(g); return `<div class="row" data-act="go" data-to="goal/${encodeURIComponent(g.id)}"><div class="main"><div class="t" dir="auto">${esc(g.title)}</div><div class="bar" style="margin-top:6px"><i style="width:${tot ? Math.min(100, Math.round(100 * d / tot)) : pct(goalProgress(g))}%"></i></div><div class="m"><span>${d}${tot ? ' of ' + tot : ''} micro-actions</span></div></div></div>`; }).join('') || '<div class="empty">No goals in this cycle.</div>'}</div></div>
  <div class="card"><h2>✨ Coach review</h2><div id="cr-ai" class="small" style="white-space:pre-wrap">A short review written by AI from the numbers above.</div><div class="btns" style="margin-top:10px"><button class="btn primary small" data-act="cr-ai">Write my review</button><button class="btn small" data-act="print-pack">Save as PDF</button>${st.day >= 40 ? `<button class="btn small" data-act="bt-start">Retake the book test</button>` : ''}</div></div></div>`;
}

/* ---------- owner: the ME.Coach development roadmap as a goal with milestones (once) ---------- */
function ownerDevRoadmap() {
  if (!isOwner() || !ls.get(K.rev) || prefs().devRoadmapV1) return; const ar = areaForField('business') || areas()[0];
  const g = save('goals', { id: 'g-mecoach-dev', title: 'ME.Coach: launch and grow the product', areaId: ar ? ar.id : '', area: ar ? ar.title : '', target: '2027-04-30', status: 'In progress', why: 'Income beyond my salary and a product with my name on it' });
  [['9.3 Launch-ready: payments, Google sign-in, job sender email, 7 days of real use', '2026-11-30'], ['10 AI assistant: cover letters, micro-action ideas, Emi chat', '2026-12-15'], ['10.5 40-day report and Google Calendar import', '2026-12-31'], ['11 Persian and Arabic interface, Gulf pricing, first 10 paying users', '2027-02-15'], ['12 Coach panel and coaching plan with booking', '2027-04-30']]
    .forEach(([t, d], i) => save('milestones', { id: 'ms-mecoach-' + (i + 1), title: t, target: d, goalId: g.id, status: i < 2 ? 'In progress' : 'Planned' }));
  save('settings', Object.assign({}, prefs(), { id: 'prefs', devRoadmapV1: today() }));
}

function v10Acts(a, id) {
  return {
    'ai-setup': () => aiSetup(), 'gcal-setup': () => gcalSetup(), 'gcal-run': () => gcalRun(true),
    'ai-cover': async () => { const j = sheetCtx && get('applications', sheetCtx.aiJob); if (!j) return; aiBusy(a, true, 'Reading your CV and the ad…'); try { const r = await aiAsk('cover', { role: j.role, company: j.company, location: j.location, desc: j.desc }); const box = sheetCtx && sheetCtx.el.querySelector('[name=body]'); if (box) box.value = r.text; toast('Draft ready · edit before sending'); } catch (e) { toast(e.message); } aiBusy(a, false); },
    'gw-ai': async () => { if (!flow) return; const st = flow.a, ar = get('areas', st.area); aiBusy(a, true); try { const items = await aiMicro(st.goal || (st.goalTxt || ''), ar ? ar.title : '', st.kw, st.micro); st.aiIdeas = items; flowDraw(); } catch (e) { toast(e.message); aiBusy(a, false); } },
    'plan-ai': async () => { const g = get('goals', id); if (!g) return; const ar = goalArea(g); aiBusy(a, true); try { const items = await aiMicro(g.title, ar ? ar.title : '', g.keyword, (g.plan || []).map(p => p.t)); openSheet('✨ Micro-action ideas', `<div class="list">${items.map(t => `<div class="row"><div class="main"><div class="t" dir="auto">${esc(t)}</div></div><button class="btn small" data-act="plan-add-ai" data-id="${esc(id)}" data-v="${esc(t)}">+ Add</button></div>`).join('')}</div>`, '', { noFocus: true }); } catch (e) { toast(e.message); } aiBusy(a, false); },
    'plan-add-ai': () => { const g = get('goals', id); if (!g) return; const syms = window.MEC_GROWTH ? MEC_GROWTH.SYMBOLS : ['★']; save('goals', Object.assign({}, g, { plan: [...(g.plan || []), { id: 'p' + Date.now().toString(36), t: a.dataset.v, count: 28, sym: syms[(g.plan || []).length % syms.length], done: {} }] })); a.textContent = '✓ Added'; a.disabled = true; },
    'cr-open': () => { closeSheet(true); location.hash = '#/cyclereport'; },
    'cr-ai': async () => { aiBusy(a, true, 'Writing…'); try { const r = await aiAsk('report', { data: ui.crData || '' }); const b = $('#cr-ai'); if (b) b.textContent = r.text; } catch (e) { toast(e.message); } aiBusy(a, false); }
  };
}
const _startV10 = start;
start = function () { _startV10(); setTimeout(ownerDevRoadmap, 3500); setTimeout(() => { const g = prefs().gcal || {}; if (g.url && (!g.at || Date.now() - Date.parse(g.at) > 6 * 3600e3)) gcalRun(false); }, 5000); };

/* ---------------- boot ---------------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') { const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.register('sw.js').catch(() => {}); navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) toast('ME.Coach was updated', 'Reload', () => location.reload()); }); }
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
if (ls.get(K.tok)) start(); else showAuth();
window.MEC = { onboard, wheelFlow };
})();
