/* MILAD 2031 OS — client (vanilla JS, no framework, no third-party services).
 * Offline-first: everything is cached on the device and changes queue in an outbox.
 * Sync: api.php merges record by record (newest updatedAt wins), so iPhone and iPad
 * can both edit and converge. Deletes are soft (deleted:true) so nothing is lost. */
(() => {
'use strict';

const VERSION = '3.1.0';
const API = 'api.php';
const K = { db: 'm2031.db', out: 'm2031.outbox', tok: 'm2031.token', rev: 'm2031.rev', ui: 'm2031.ui', last: 'm2031.lastSync' };
const COLS = ['tasks','events','projects','goals','skills','logs','evidence','decisions','notes','ielts','sessions','settings','milestones','applications','immigration','habits','money','templates','courses'];
const STATES = ['To do','Doing','Waiting','Done','Cancelled'];
const LEGACY = { 'Not Started': 'To do', 'Waiting for Me': 'To do', 'In Progress': 'Doing', 'Ready for Review': 'Doing', 'Waiting for External Input': 'Waiting', 'Blocked': 'Waiting', 'Completed & Verified': 'Done', 'Completed - Not Verified': 'Done', 'Cancelled': 'Cancelled' };
const stOf = t => STATES.includes(t.state) ? t.state : (LEGACY[t.state] || 'To do');
const DONE = { has: s => s === 'Done' || s === 'Cancelled' || /^Completed/.test(s || '') };
const PRI = ['P1','P2','P3'];
const OWNERS = ['Milad','Claude','External'];
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
function fmtDate(s, withYear) { const d = parseD(s); if (!d) return ''; return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }); }
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
function save(c, rec) {
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
  if (r.status === 401 && action !== 'login' && action !== 'setup' && action !== 'password') {
    // Only sign out when the server says the token itself is no longer valid.
    if (j.error === 'Session expired' || !tok) { ls.del(K.tok); showAuth(j.error || 'Please sign in again'); }
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
  return `<span class="sync" id="syncind" title="${esc(lastError)}"><i class="dot ${syncState === 'off' ? 'off' : pending ? 'pending' : ''}"></i>${esc(label)}</span>`;
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
const NAV_MAIN = [['today', 'Today', I.today], ['tasks', 'Tasks', I.tasks], ['calendar', 'Calendar', I.cal], ['progress', 'Progress', I.prog], ['more', 'More', I.more]];
const NAV_MORE = [['jobs', 'Job search', I.jobs], ['immigration', 'Immigration', I.imm], ['evidence', 'Evidence', I.evid], ['notes', 'Notes', I.notes], ['journal', 'Journal', I.journal], ['templates', 'Templates', I.tmpl], ['decisions', 'Decisions', I.dec], ['review', 'Review', I.review], ['trash', 'Trash', I.trash], ['health', 'System health', I.health], ['settings', 'Settings', I.set]];
const P_TABS = [['overview', 'Overview'], ['roadmap', 'Roadmap'], ['goals', 'Goals'], ['learning', 'Learning'], ['money', 'Money']];

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
const FA = (window.M2031_FA || { dict: {}, rx: [] });
function trStr(s) {
  const t = s.trim(); if (!t || /^[\d\s.,:/+\-–%★✓↻→←·()]+$/.test(t)) return null;
  let r = FA.dict[t]; if (r === undefined) for (const [rx, rep] of FA.rx) if (rx.test(t)) { r = t.replace(rx, rep); break; }
  return r === undefined ? null : s.replace(t, r);
}
function trNode(root) {
  if (ui.lang !== 'fa' || !root) return;
  if (root.nodeType === 3) { const p = root.parentElement; if (p && !p.closest('[dir=auto],.mono,textarea,script,style,.ft')) { const r = trStr(root.nodeValue); if (r !== null) root.nodeValue = r; } return; }
  if (root.nodeType !== 1 || root.closest('[dir=auto],.mono,script,style')) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeType === 1 && n.matches('[dir=auto],.mono,textarea,script,style,svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const els = [root]; let n; const texts = [];
  while ((n = w.nextNode())) { if (n.nodeType === 3) texts.push(n); else els.push(n); }
  for (const t of texts) { const r = trStr(t.nodeValue); if (r !== null) t.nodeValue = r; }
  if (root.querySelectorAll) root.querySelectorAll('[placeholder]').forEach(el => { if (!els.includes(el)) els.push(el); });
  for (const el of els) for (const at of ['placeholder', 'aria-label', 'title']) { const v = el.getAttribute && el.getAttribute(at); if (v) { const r = trStr(v); if (r !== null) el.setAttribute(at, r); } }
}
new MutationObserver(ms => { if (ui.lang !== 'fa') return; for (const m of ms) m.addedNodes.forEach(trNode); }).observe(document.documentElement, { childList: true, subtree: true });
function applyLang() { const fa = ui.lang === 'fa'; const h = document.documentElement; h.lang = fa ? 'fa' : 'en'; h.dir = fa ? 'rtl' : 'ltr'; if (fa) trNode(document.body); }
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
    const cred = await navigator.credentials.create({ publicKey: { challenge: b64uBytes(o.challenge), rp: { id: o.rpId, name: 'MILAD 2031' }, user: { id: b64uBytes(o.user), name: 'milad', displayName: 'Milad' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }], authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' }, excludeCredentials: (o.exclude || []).map(id => ({ type: 'public-key', id: b64uBytes(id) })), attestation: 'none', timeout: 60000 } });
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
function vHealth() { setTimeout(vHealthFill, 0); return header('System health', 'Everything that keeps MILAD 2031 safe and running') + `<div class="card" id="hbox"><div class="empty">Checking…</div></div><div class="btns" style="margin-top:12px"><button class="btn" data-act="health-run">Check again</button><button class="btn" data-act="sync-now">Sync now</button></div>`; }
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
  if (sp.kind === 'link' || sp.kind === 'note') return done(save('notes', { title: sp.title || sp.url, body: sp.url ? `<${sp.url}>` : '', source: sp.url || '' }), 'notes', 'Note saved');
  if (sp.kind === 'money') return done(save('money', { amount: sp.amount, date: today() }), 'money', 'Balance saved');
  const p = sp;
  if (!p.title) return;
  const rec = { title: p.title, state: 'To do', priority: p.priority || 'P2', owner: 'Milad' };
  if (p.due) rec.due = p.due;
  if (p.top) { const n = list('tasks').filter(x => isOpen(x) && x.focusDate === today()).length; if (n >= 3) toast('Top 3 is full; added without it'); else rec.focusDate = today(); }
  ui.quick = ''; saveUi(); const nr = save('tasks', rec); toast('Added', 'Undo', () => remove('tasks', nr.id));
  setTimeout(() => { const i = document.querySelector('.qadd input'); if (i) i.focus(); }, 30);
}
document.addEventListener('submit', e => { const f = e.target.closest('[data-form="qadd"]'); if (f) { e.preventDefault(); quickSubmit(f); } });

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
  const fu = followUps().length, ex = expiring().length, lm = lateMilestones().length;
  const out = [];
  if (weeklyDue()) out.push(['weekly', '', I.review, 'Weekly review is due', '5 minutes · three questions', 'warn']);
  if (od) out.push(['filter', 'overdue', I.alert, `${od} overdue task${od > 1 ? 's' : ''}`, 'Reschedule or finish', 'bad']);
  if (fu) out.push(['go', 'jobs', I.jobs, `${fu} job follow-up${fu > 1 ? 's' : ''} due`, 'Applications to chase', 'warn']);
  if (ex) out.push(['go', 'immigration', I.imm, `${ex} document${ex > 1 ? 's' : ''} expiring within 6 months`, 'Check passport, test reports and certificates', 'warn']);
  if (lm) out.push(['go', 'plan', I.flag, `${lm} roadmap milestone${lm > 1 ? 's' : ''} past target`, 'Update the date or the status', 'warn']);
  if (!ui.lastBackup ? list('tasks').length > 20 && new Date().getDay() === 0 : daysTo(ui.lastBackup) < -14) out.push(['enc-backup', '', I.health, 'Time for a backup copy', 'Encrypted file to keep in iCloud Drive', '']);
  for (const c of list('courses').filter(c => ['Active', 'Paused'].includes(c.status) && c.nextReview && c.nextReview <= today()).slice(0, 2)) out.push(['c-review', c.id, I.course, 'Course review: ' + c.title, 'Keep, pause or drop. 1 minute', 'warn']);
  if (wt) out.push(['filter', 'ext', I.clock, `${wt} waiting on others`, 'Nudge or keep waiting', '']);
  return out;
}
const attRow = ([act, arg, ic, t, s, tone]) => `<div role="button" tabindex="0" class="row att ${tone}" data-act="${act}" ${act === 'filter' ? `data-f="${arg}"` : act === 'go' ? `data-to="${arg}"` : arg ? `data-id="${esc(arg)}"` : ''}><span class="att-i">${ic}</span><div class="main"><div class="t">${esc(t)}</div><div class="m">${esc(s)}</div></div><span class="att-go">${I.right}</span></div>`;

function vToday() {
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
  return header(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), '') + `
  ${setupCard()}
  <a class="vision" href="#/progress" data-act="p-tab" data-t="roadmap"><b>${dl.toLocaleString('en-GB')}</b> days to MILAD 2031 <span>${I.right}</span></a>
  ${quickBar('What needs doing?')}
  <div class="card"><h2>★ Top 3 <span class="count">${doneTop.length}/${top.length + doneTop.length}</span><span style="flex:1"></span>${top.length + doneTop.length ? `<button class="btn small ghost" data-act="plan-day" data-day="${t}">Change</button>` : ''}</h2>
    ${top.length ? `<div class="list">${top.map(x => taskRow(x)).join('')}</div>` : doneTop.length ? '<div class="empty">All done for today. 🎉</div>' : (() => { const sg = suggestTop(t); return sg.length ? `<div class="small" style="margin-bottom:6px">Suggested for today:</div><div class="list">${sg.map(x => `<div class="row sug"><span class="dotx warn"></span><div class="main"><div class="t" dir="auto">${esc(x.title)}</div><div class="m">${dueChip(x)}${x.priority === 'P1' ? priChip('P1') : ''}</div></div></div>`).join('')}</div><div class="btns" style="margin-top:10px"><button class="btn primary" data-act="accept-top" data-ids="${esc(sg.map(x => x.id).join(','))}">Use these</button><button class="btn" data-act="plan-day" data-day="${t}">Choose myself</button></div>` : `<button class="btn primary wide" data-act="plan-day" data-day="${t}">Pick today's Top 3</button>`; })()}</div>
  ${habitStrip()}
  ${sched.length || dueToday.length ? `<div class="card" style="margin-top:12px"><h2>Also today <span class="count">${sched.length + dueToday.length}</span></h2><div class="list">${sched.map(agendaRow).join('')}${dueToday.map(x => taskRow(x)).join('')}</div></div>` : ''}
  ${(() => { const up = courseLive().filter(c => cNext(c) && cWeekDone(c) < (Number(c.perWeek) || 1) && (c.status || 'Planned') === 'Active').slice(0, 2); return up.length ? `<div class="card" style="margin-top:12px"><h2>${I.course} Up next</h2><div class="list">${up.map(c => `<div class="row" data-act="go" data-to="course/${encodeURIComponent(c.id)}"><div class="main"><div class="t" dir="auto">${esc(cNext(c).t)}</div><div class="m"><span dir="auto">${esc(c.title)}</span><span>${cWeekDone(c)}/${c.perWeek || 1} this week</span></div></div><button class="icon-btn playb" data-act="c-start" data-id="${esc(c.id)}" aria-label="Start">${I.play}</button></div>`).join('')}</div></div>` : ''; })()}
  ${overdue.length ? `<div class="card" style="margin-top:12px"><h2>Overdue <span class="count">${overdue.length}</span><span style="flex:1"></span><button class="btn small ghost" data-act="od-today">Move all to today</button></h2><div class="list">${overdue.slice(0, 5).map(x => taskRow(x)).join('')}</div>${overdue.length > 5 ? `<a class="btn small ghost" href="#/tasks">See all ${overdue.length}</a>` : ''}</div>` : ''}
  ${att.length ? `<div class="card" style="margin-top:12px"><div class="list">${att.map(attRow).join('')}</div></div>` : ''}
  <div style="margin-top:14px">${closed ? `<div class="card closed">✓ Day closed<button class="btn small ghost" data-act="closeout">Again</button></div>` : `<button class="btn primary wide" data-act="closeout">Close the day</button>`}</div>`;
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
  const t = today();
  if (!ui.calMonth) ui.calMonth = t.slice(0, 7);
  if (!ui.calSel) ui.calSel = t;
  const [y, m] = ui.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1); const gridStart = new Date(first); const wd = (first.getDay() + 6) % 7; gridStart.setDate(1 - wd);
  const days = []; for (let i = 0; i < 42; i++) { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); days.push(dstr(d)); }
  const items = agenda(days[0], days[41]); const byDay = {}; items.forEach(a => (byDay[a.day] = byDay[a.day] || []).push(a));
  const sel = byDay[ui.calSel] || [];
  const monthName = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return header('Calendar', 'Events, scheduled tasks and deadlines') + `
  <div class="card"><div class="cal-h"><button class="icon-btn" data-act="cal-move" data-d="-1" aria-label="Previous month">${I.left}</button><b>${esc(monthName)}</b><button class="btn small" data-act="cal-today">Today</button><button class="icon-btn" data-act="cal-move" data-d="1" aria-label="Next month">${I.right}</button></div>
  <div class="month">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dow">${d}</div>`).join('')}
  ${days.map(d => { const it = byDay[d] || []; return `<div class="day ${d.slice(0, 7) !== ui.calMonth ? 'out' : ''} ${d === t ? 'today' : ''} ${d === ui.calSel ? 'sel' : ''}" data-act="cal-sel" data-day="${d}"><span class="n">${Number(d.slice(8))}</span><div class="dots">${it.slice(0, 6).map(a => `<i class="${a.kind === 'task' || a.kind === 'ms' ? 't' : a.kind === 'due' || a.kind === 'follow' ? 'd' : ''}"></i>`).join('')}</div>${it.slice(0, 3).map(a => `<div class="lbl" dir="auto">${esc(a.time ? a.time + ' ' : '')}${esc(a.title)}</div>`).join('')}${it.length > 3 ? `<div class="lbl">+${it.length - 3}</div>` : ''}</div>`; }).join('')}</div></div>
  <div class="card" style="margin-top:14px"><h2>${esc(fmtDate(ui.calSel, true))} <span class="count">${sel.length}</span></h2>${sel.length ? `<div class="list">${sel.map(agendaRow).join('')}</div>` : '<div class="empty">Nothing on this day.</div>'}
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
  const body = p === 'roadmap' ? vRoadmap() : p === 'goals' ? (ui.planTab = 'goals', vPlan()) : p === 'learning' ? vLearn() : p === 'money' ? vMoney() : vOverview();
  return header('Progress', 'Where you are, and where you are heading') + `<div class="seg ptabs">${P_TABS.filter(([k]) => !(k === 'money' && hidden().has('money'))).map(([k, l]) => `<button class="${p === k ? 'on' : ''}" data-act="p-tab" data-t="${k}">${l}</button>`).join('')}</div><div style="height:12px"></div>` + stripHead(body);
}
/* ---------- habits ---------- */
function habitWeek(h, ws = weekStart()) { let n = 0; for (let i = 0; i < 7; i++) if ((h.done || {})[addDays(ws, i)]) n++; return n; }
function habitStreak(h) { const d0 = h.done || {}; let d = today(); if (!d0[d]) d = addDays(d, -1); let n = 0; while (d0[d]) { n++; d = addDays(d, -1); } return n; }
function habitStrip() {
  const hs = list('habits').sort((a, b) => String(a.title).localeCompare(String(b.title))); const t = today();
  if (!hs.length) return '';
  return `<div class="habits">${hs.map(h => { const on = !!(h.done || {})[t]; return `<button class="hab ${on ? 'on' : ''}" data-act="hab" data-id="${esc(h.id)}"><span class="hk">${on ? '✓' : ''}</span><span dir="auto">${esc(h.title)}</span>${habitStreak(h) > 1 ? `<i>🔥${habitStreak(h)}</i>` : ''}</button>`; }).join('')}</div>`;
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
  const hs = list('habits'), hTarget = hs.reduce((n, h) => n + (Number(h.perWeek) || 7), 0), hDone = hs.reduce((n, h) => n + Math.min(Number(h.perWeek) || 7, habitWeek(h, ws)), 0);
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
  const ws = weekStart(), s = weekScore(ws), p = weekScore(addDays(ws, -7)); const hs = list('habits');
  return header('Overview', '') + `
  <div class="card score"><div class="score-n">${s.total ?? '—'}</div><div><b>This week's score</b><div class="small">${p.total !== null && s.total !== null ? (s.total >= p.total ? '▲ ' : '▼ ') + Math.abs(s.total - p.total) + ' vs last week' : 'Average of the areas below'}</div></div></div>
  <div class="tiles">${s.rows.map((r, i) => { const pv = p.rows[i][1]; return `<div class="tile"><div class="tl">${r[0]}</div><div class="tv">${r[1] === null ? '—' : r[1]}</div><div class="bar"><i style="width:${r[1] || 0}%"></i></div><div class="small" dir="auto">${esc(r[2])}${r[1] !== null && pv !== null && pv !== r[1] ? ` · ${r[1] > pv ? '▲' : '▼'} ${Math.abs(r[1] - pv)}` : ''}</div></div>`; }).join('')}</div>
  <div class="card" style="margin-top:12px"><h2>Projections</h2><div class="small" style="margin-bottom:6px">Straight-line projections from your own records. Not promises.</div><div class="list">${forecasts().map(([t, m, tone]) => `<div class="row"><span class="dotx ${tone}"></span><div class="main"><div class="t">${esc(t)}</div><div class="m">${esc(m)}</div></div></div>`).join('')}</div></div>
  <div class="card" style="margin-top:12px"><h2>Habits <span class="count">${hs.length}</span><span style="flex:1"></span><button class="btn small ghost" data-act="new-habit">${I.plus} Habit</button></h2>${hs.length ? `<div class="list">${hs.map(h => `<div class="row" data-act="habit" data-id="${esc(h.id)}"><div class="main"><div class="t" dir="auto">${esc(h.title)}</div><div class="m"><span>${habitWeek(h)} of ${Number(h.perWeek) || 7} this week</span>${habitStreak(h) ? `<span>🔥 ${habitStreak(h)} days</span>` : ''}</div></div><div class="week7">${[0, 1, 2, 3, 4, 5, 6].map(i => `<i class="${(h.done || {})[addDays(ws, i)] ? 'on' : ''}"></i>`).join('')}</div></div>`).join('')}</div>` : '<div class="empty">Small daily habits: exercise, sleep by 11, 20 min reading. Tick them on Today.</div>'}</div>
  <div class="btns" style="margin-top:14px"><a class="btn" href="#/report">Progress report (PDF)</a><button class="btn" data-act="weekly">Weekly review</button></div>`;
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
const cPct = c => { const ls = cLessons(c); return ls.length ? Math.round(100 * ls.filter(l => l.done).length / ls.length) : 0; };
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
  const n = cNext(c), ls = cLessons(c);
  return `<div class="row crow" data-act="go" data-to="course/${encodeURIComponent(c.id)}"><div class="main"><div class="t" dir="auto">${esc(c.title)}</div><div class="bar" style="margin:6px 0 4px"><i style="width:${cPct(c)}%"></i></div><div class="m"><span>${ls.filter(l => l.done).length}/${ls.length}</span>${c.status && c.status !== 'Active' ? `<span class="chip">${esc(c.status)}</span>` : ''}${n ? `<span dir="auto">Next: ${esc(n.t).slice(0, 70)}</span>` : '<span>All lessons done 🎉</span>'}</div></div>${n && (c.status || 'Planned') !== 'Paused' ? `<button class="icon-btn playb" data-act="c-start" data-id="${esc(c.id)}" aria-label="Start next lesson">${I.play}</button>` : ''}</div>`;
}
function vCourses() {
  const cs = list('courses').sort((a, b) => COURSE_STATES.indexOf(a.status || 'Planned') - COURSE_STATES.indexOf(b.status || 'Planned') || String(a.title).localeCompare(String(b.title)));
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
    <div class="acts" style="margin-top:14px">${n ? `<button class="act pri" data-act="c-start" data-id="${esc(c.id)}"><span>▶</span>Start: ${esc(n.t).slice(0, 48)}</button>` : ''}<button class="act" data-act="c-review" data-id="${esc(c.id)}"><span>⟳</span>Review course</button><button class="act" data-act="c-edit" data-id="${esc(c.id)}"><span>✎</span>Edit</button></div></div>
  <div class="card" style="margin-top:12px"><h2>Lessons <span class="count">${ls.filter(l => l.done).length}/${ls.length}</span><span style="flex:1"></span><button class="btn small ghost" data-act="c-lessons" data-id="${esc(c.id)}">Edit list</button></h2>
    <div class="list">${ls.map(l => `<div class="row"><button class="check ${l.done ? 'done' : ''}" data-act="c-tick" data-id="${esc(c.id)}" data-l="${esc(l.id)}" aria-label="Done">${I.tick}</button><div class="main"><div class="t" dir="auto">${esc(l.t)}</div>${l.done && l.doneOn ? `<div class="m">${esc(fmtDate(l.doneOn, true))}${l.min ? ' · ' + l.min + ' min' : ''}</div>` : ''}</div>${!l.done ? `<button class="icon-btn playb small" data-act="c-start" data-id="${esc(c.id)}" data-l="${esc(l.id)}" aria-label="Start">${I.play}</button>` : ''}</div>`).join('') || '<div class="empty">No lessons. Tap Edit list.</div>'}</div></div>
  ${(c.reviews || []).length ? `<div class="card" style="margin-top:12px"><h2>Reviews</h2><div class="list">${c.reviews.slice().reverse().map(r => `<div class="row"><div class="main"><div class="t">${esc(r.decision)}</div><div class="m"><span>${esc(fmtDate(r.date, true))}</span>${r.note ? `<span dir="auto">${esc(r.note)}</span>` : ''}</div></div></div>`).join('')}</div></div>` : ''}`;
}
function courseForm(c) {
  formColl = 'courses';
  form(c.id ? 'Edit course' : 'New course', [{ k: 'title', label: 'Course', req: true }, [{ k: 'status', label: 'Status', type: 'select', options: COURSE_STATES, blank: false, def: 'Active' }, { k: 'skillId', label: 'Skill', type: 'select', options: skillOpts }], { k: 'perWeek', label: 'Lessons per week', type: 'select', options: [1, 2, 3, 4, 5, 6, 7], def: 2 }, 'MORE', { k: 'provider', label: 'Provider / platform' }, { k: 'link', label: 'Course link', type: 'url' }, { k: 'gate', label: 'Start condition', ph: 'e.g. after Power BI Page 1' }, { k: 'reviewEvery', label: 'Review every (days)', type: 'number', def: 30 }, ...(c.id ? [] : [{ k: 'lessonText', label: 'Lessons, one per line', type: 'textarea' }])], c, v => {
    if (!v.title) return 'Give the course a name.';
    const rec = Object.assign({}, c, v); if (!c.id) { rec.lessons = L(String(v.lessonText || '').split('\n').map(x => x.trim()).filter(Boolean)); delete rec.lessonText; rec.nextReview = addDays(today(), Number(v.reviewEvery) || 30); }
    const r = save('courses', rec); toast('Course saved'); if (!c.id) setTimeout(() => { location.hash = '#/course/' + encodeURIComponent(r.id); }, 50);
  }, { onDelete: c.id ? () => { remove('courses', c.id); closeSheet(); location.hash = '#/progress'; } : null });
}
function newCourseSheet() {
  const notes = list('notes').sort((a, b) => String(a.title).localeCompare(String(b.title)));
  openSheet('New course', `<div class="small" style="margin-bottom:6px">Start from a plan you already have</div><div class="acts one">${COURSE_STARTERS.map(s => `<button class="act" data-act="c-starter" data-v="${s.key}"><span>★</span>${esc(s.title)}</button>`).join('')}</div>
    ${notes.length ? `<div class="small" style="margin:14px 0 6px">Or turn a note's list into lessons</div><div class="acts one">${notes.map(n => `<button class="act" data-act="c-from-note" data-id="${esc(n.id)}"><span>≡</span><span dir="auto" style="width:auto;text-align:inherit;color:inherit;font-size:inherit">${esc(n.title)}</span></button>`).join('')}</div>` : ''}
    <div class="acts one" style="margin-top:14px"><button class="act" data-act="c-blank"><span>+</span>Blank course</button></div>`, '', { noFocus: true });
}
function lessonsFromNote(id) {
  const n = get('notes', id); if (!n) return; const items = parseNoteLessons(n.body);
  if (!items.length) { toast('No list found in this note'); return; }
  closeSheet(true);
  openSheet('Lessons from note', `<div class="small" style="margin-bottom:8px">Untick anything that is not a lesson.</div><div class="f"><label>Course name</label><input name="ct" dir="auto" value="${esc(n.title)}"></div><div class="list">${items.map((t, i) => `<label class="row" style="cursor:pointer"><input type="checkbox" name="li" value="${i}" checked style="width:22px;height:22px;margin-top:2px"><div class="main"><div class="t" dir="auto">${esc(t)}</div></div></label>`).join('')}</div>`,
    '<button class="btn" data-act="sheet-close">Cancel</button><button class="btn primary" data-act="form-save">Create course</button>', { noFocus: true, onSave: () => {
      const el = sheetCtx.el; const pick = [...el.querySelectorAll('input[name=li]:checked')].map(x => items[Number(x.value)]);
      if (!pick.length) return; const r = save('courses', { title: el.querySelector('[name=ct]').value.trim() || n.title, status: 'Active', perWeek: 2, reviewEvery: 30, nextReview: addDays(today(), 30), lessons: L(pick), source: n.id });
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
  <div class="card" style="margin-top:12px">${logs.length ? `<div class="list">${logs.slice(0, 120).map(l => `<div class="row" data-act="logitem" data-id="${esc(l.id)}"><div class="time">${l.mood ? MOODS[l.mood] : '·'}</div><div class="main"><div class="t">${esc(fmtDate(l.date, true))}</div>${l.done ? `<div class="na" dir="auto">${esc(l.done)}</div>` : ''}${l.notes ? `<div class="m" dir="auto">${esc(l.notes).slice(0, 160)}</div>` : ''}</div></div>`).join('')}</div>` : '<div class="empty">Nothing yet. Close the day to write your first line.</div>'}</div>`;
}
/* ---------- printable report ---------- */
function vReport() {
  const t = today(), tasks = list('tasks'), done = tasks.filter(x => stOf(x) === 'Done' && x.completedOn).sort((a, b) => b.completedOn.localeCompare(a.completedOn));
  const ms = list('milestones').sort((a, b) => String(a.target || '9').localeCompare(String(b.target || '9')));
  const sk = list('skills'), ie = list('ielts').sort((a, b) => String(a.date).localeCompare(String(b.date))), ev = list('evidence').sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }));
  const apps = list('applications'), s = weekScore(weekStart());
  const tbl = (head, rows) => rows.length ? `<table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td dir="auto">${esc(c ?? '')}</td>`).join('')}</tr>`).join('')}</table>` : '<p class="small">None recorded.</p>';
  return `<div class="report"><div class="noprint btns" style="margin-bottom:14px"><a class="btn" href="#/progress">${I.left} Back</a><button class="btn primary" data-act="print">Save as PDF / Print</button></div>
  <h1>MILAD 2031 · Progress report</h1><p class="small">Generated ${esc(fmtDate(t, true))} from the MILAD 2031 OS records. Estimates are labelled; only official documents count as evidence.</p>
  <h2>Summary</h2><p>${daysTo(visionDate())} days to the ${esc(fmtDate(visionDate(), true))} target. This week's score: ${s.total ?? 'n/a'}. Milestones done: ${ms.filter(m => m.status === 'Done').length} of ${ms.filter(m => m.status !== 'Dropped').length}. Tasks completed: ${done.length}. Learning this week: ${hrs(weekMinutes(weekStart()))} h.</p>
  <h2>Roadmap</h2>${tbl(['Milestone', 'Target', 'Status'], ms.map(m => [m.title, m.target ? fmtDate(m.target, true) : '', m.status || 'Planned']))}
  <h2>Skills</h2>${tbl(['Skill', 'Status', 'Level', 'Hours / week'], sk.map(x => [x.title, x.status || '', `${x.current ?? '?'} → ${x.target ?? '?'}`, x.weeklyHours || '']))}
  <h2>IELTS log</h2>${tbl(['Date', 'Skill', 'Band / score', 'Type'], ie.map(e => [fmtDate(e.date, true), e.skill, e.band, e.kind]))}
  <h2>Evidence register</h2>${tbl(['ID', 'Document', 'Status'], ev.map(e => [e.code, e.title, e.status || 'MISSING']))}
  <h2>Job search</h2>${tbl(['Role', 'Company', 'Stage', 'Applied'], apps.map(a => [a.role, a.company, a.stage || 'Saved', a.appliedOn ? fmtDate(a.appliedOn, true) : '']))}
  <h2>Completed work (latest 40)</h2>${tbl(['Done', 'Task', 'Proof'], done.slice(0, 40).map(x => [fmtDate(x.completedOn, true), x.title, x.evidence || '']))}</div>`;
}
/* ---------- global search ---------- */
const SEARCH_IN = [['courses', 'Course', r => [r.title, r.provider, cLessons(r).map(l => l.t).join(' ')], 'course-open'], ['tasks', 'Task', r => [r.title, r.nextAction, r.notes], 'task'], ['notes', 'Note', r => [r.title, r.body, r.tags], 'note'], ['applications', 'Job', r => [r.role, r.company, r.notes], 'application'], ['events', 'Event', r => [r.title, r.notes], 'event'], ['decisions', 'Decision', r => [r.title, r.decision], 'decision'], ['evidence', 'Evidence', r => [r.code, r.title, r.proves], 'evidence'], ['immigration', 'Document', r => [r.title, r.notes], 'immig'], ['milestones', 'Milestone', r => [r.title, r.notes], 'milestone'], ['skills', 'Skill', r => [r.title], 'skill'], ['goals', 'Goal', r => [r.title, r.success], 'goal'], ['logs', 'Journal', r => [r.title, r.done, r.notes], 'logitem']];
const PALETTE = [['New task', 'new-task'], ['New event', 'new-event'], ['Log practice', 'log-time'], ['Start next lesson', 'next-lesson'], ['Close the day', 'closeout'], ['Weekly review', 'weekly'], ['New course', 'new-course'], ['Job application', 'new-application'], ['Update savings', 'money-add'], ['Go to Today', 'go', 'today'], ['Go to Tasks', 'go', 'tasks'], ['Go to Calendar', 'go', 'calendar'], ['Go to Progress', 'go', 'progress'], ['Go to Job search', 'go', 'jobs'], ['Go to Immigration', 'go', 'immigration'], ['Go to Notes', 'go', 'notes'], ['Go to Journal', 'go', 'journal'], ['Go to Settings', 'go', 'settings'], ['Go to System health', 'go', 'health']];
function searchSheet() {
  openSheet('Search everything', `<input class="search" id="gsq" type="search" placeholder="Type to search" style="width:100%" autocomplete="off" dir="auto"><div id="gsr" class="list" style="margin-top:10px"></div>`, '', {});
  const inp = $('#gsq'); setTimeout(() => inp.focus(), 60);
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase(); const out = [];
    const acts = PALETTE.filter(([l]) => !q || l.toLowerCase().includes(q)).slice(0, q ? 5 : 12);
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
  <div class="card hero"><div class="hero-n">${dl.toLocaleString('en-GB')}</div><div class="hero-l">days to MILAD 2031 · ${esc(fmtDate(vd, true))} <button class="btn small ghost" data-act="vision">Change</button></div>
    <div class="bar" style="margin-top:12px"><i style="width:${live ? Math.round(100 * done / live) : 0}%"></i></div><div class="small" style="margin-top:6px">${done} of ${live} milestones done</div>
    <div class="btns" style="margin-top:12px"><button class="btn primary small" data-act="new-milestone">${I.plus} Milestone</button>${list('goals').some(g => g.target) ? '<button class="btn small" data-act="ms-from-goals">Create from goal dates</button>' : ''}</div></div>
  <div class="timeline">${years.map(y => { const it = ms.filter(m => yearOf(m) === y).sort((a, b) => a.target.localeCompare(b.target)); const d = it.filter(m => m.status === 'Done').length; const cur = y === Number(t.slice(0, 4));
    return `<div class="yr ${cur ? 'cur' : ''} ${y < Number(t.slice(0, 4)) ? 'past' : ''}"><div class="yr-h"><b>${y}</b>${it.length ? `<span class="small">${d}/${it.length}</span>` : ''}${cur ? '<span class="chip s-rev">now</span>' : ''}</div>${it.length ? `<div class="list">${it.map(msRow).join('')}</div>` : `<div class="empty">No milestones yet. <a href="#" data-act="new-milestone" data-year="${y}">Add one</a></div>`}</div>`; }).join('')}</div>
  ${noDate.length ? `<div class="card" style="margin-top:12px"><h2>No date yet</h2><div class="list">${noDate.map(msRow).join('')}</div></div>` : ''}`;
}
function vJobs() {
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
const MORE_GROUPS = [['Career', ['jobs', 'evidence']], ['Migration', ['immigration']], ['Knowledge', ['notes', 'journal', 'templates', 'decisions']], ['System', ['review', 'trash', 'health', 'settings']]];
const OPTIONAL = [['jobs', 'Job search'], ['immigration', 'Immigration'], ['evidence', 'Evidence'], ['journal', 'Journal'], ['templates', 'Templates'], ['decisions', 'Decisions'], ['review', 'Review'], ['money', 'Money']];
const hidden = () => new Set(prefs().hidden || []);
const navMore = () => NAV_MORE.filter(([k]) => !hidden().has(k));
function badge(k) {
  if (k === 'today') { const n = list('tasks').filter(t => isOpen(t) && t.due && t.due < today()).length; return n ? `<b class="badge">${n > 99 ? '99+' : n}</b>` : ''; }
  if (k === 'progress') return weeklyDue() || list('courses').some(c => ['Active', 'Paused'].includes(c.status) && c.nextReview && c.nextReview <= today()) ? '<b class="badge dot"></b>' : '';
  if (k === 'more') { const n = followUps().length + expiring().filter(x => x.expiry < addDays(today(), 60)).length; return n ? `<b class="badge">${n}</b>` : ''; }
  return '';
}
/* ---------- setup checklist ---------- */
function setupItems() {
  return [[!!ui.pkSet, 'Sign in with Face ID', 'pk-add'], [!!ui.pushOn, 'Morning and evening reminders', 'go-settings'], [!!ui.calDone, 'Calendar on your iPhone', 'ics-setup'], [!!ui.siriDone, 'Siri shortcuts', 'siri'], [list('habits').length > 0, 'One daily habit', 'new-habit'], [list('milestones').length > 0, 'First 2031 milestone', 'new-milestone'], [list('courses').length > 0, 'Your courses', 'new-course'], [!!ui.lastBackup, 'First backup copy', 'enc-backup']];
}
function setupCard() {
  if (ui.setupHidden) return ''; const it = setupItems(), d = it.filter(x => x[0]).length; if (d === it.length) return '';
  return `<div class="card setup" role="button" data-act="setup" style="margin-bottom:12px"><div class="main"><div class="t">Finish setting up · ${d} of ${it.length}</div><div class="bar" style="margin-top:6px"><i style="width:${Math.round(100 * d / it.length)}%"></i></div></div><span class="att-go">${I.right}</span></div>`;
}
function setupSheet() {
  openSheet('Set up MILAD 2031', `<div class="list">${setupItems().map(([ok, l, act]) => `<div class="row"><span class="hstat ${ok ? 'ok' : ''}">${ok ? '✓' : ''}</span><div class="main"><div class="t">${l}</div></div>${ok ? '' : `<button class="btn small primary" data-act="${act}">Set up</button>`}</div>`).join('')}</div>
    <div class="btns" style="margin-top:12px"><button class="btn small" data-act="setup-mark">I did calendar and Siri</button><button class="btn small ghost" data-act="setup-hide">Hide this</button></div>`, '', { noFocus: true });
}
function vMore() {
  const hs = hidden(); const by = Object.fromEntries(NAV_MORE.map(x => [x[0], x]));
  return header('More', '') + MORE_GROUPS.map(([g, ks]) => { const items = ks.filter(k => !hs.has(k) && by[k]); return items.length ? `<div class="grp-h">${g}</div><div class="card tight"><div class="list">${items.map(k => { const [, l, ic] = by[k]; return `<a class="row mrow" href="#/${k}"><span class="att-i">${ic}</span><div class="main"><div class="t">${l}</div><div class="m">${moreHint(k)}</div></div><span class="att-go">${I.right}</span></a>`; }).join('')}</div></div>` : ''; }).join('');
}
function moreHint(k) {
  return { journal: `${list('logs').filter(l => l.type === 'closeout').length} days written`, templates: `${TEMPLATE_STARTERS.length + list('templates').length} templates`, trash: `${COLS.reduce((n, c) => n + Object.values(db[c] || {}).filter(r => r && r.deleted).length, 0)} deleted items`, health: 'Server, backups, sync and security checks', jobs: `${list('applications').filter(a => APP_ACTIVE.includes(a.stage || 'Saved')).length} active applications`, immigration: `${list('immigration').length} documents`, learn: `${list('skills').length} skills · ${list('sessions').length} sessions · ${list('ielts').length} IELTS entries`, evidence: `${list('evidence').length} items`, decisions: `${list('decisions').length} decisions`, notes: `${list('notes').length} documents`, review: 'Live executive review and close-out logs', settings: 'Sync, calendar feed, backup, password' }[k] || '';
}
function vLearn() {
  const skills = list('skills').sort((a, b) => String(a.priority || 'P9').localeCompare(String(b.priority || 'P9')));
  const sessions = list('sessions').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const ielts = list('ielts').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const ws = weekStart(), mins = weekMinutes(ws), tgt = weekTarget(), st = streak();
  const tracked = skills.filter(s => Number(s.weeklyHours) > 0 || weekMinutes(ws, s.id) > 0);
  return header('Learning', 'Competence is shown by practical checks, not attendance') + vCourses() + `
  <div class="card"><h2>This week <span class="count">${hrs(mins)} h${tgt ? ' / ' + hrs(tgt) + ' h' : ''}</span><span style="flex:1"></span><button class="btn small primary" data-act="log-time">${I.plus} Log time</button></h2>
    <div class="small" style="margin-bottom:8px">${st ? `🔥 ${st}-day streak` : 'No streak yet. Log any practice today to start one.'} · Week of ${esc(fmtDate(ws))}</div>
    ${tracked.length ? tracked.map(s => { const m = weekMinutes(ws, s.id), g = Math.round((Number(s.weeklyHours) || 0) * 60); return `<div style="margin:8px 0"><div class="small" style="display:flex;justify-content:space-between;gap:8px"><span dir="auto">${esc(s.title)}</span><b>${hrs(m)}${g ? ' / ' + hrs(g) : ''} h</b></div><div class="bar"><i style="width:${g ? Math.min(100, Math.round(100 * m / g)) : 100}%"></i></div></div>`; }).join('') : '<div class="empty">Set weekly hours on a skill to track it here.</div>'}</div>
  <div class="card" style="margin-top:14px"><h2>IELTS progress</h2><div class="small" style="margin-bottom:10px">Target 7.5 overall, no skill below 7.0. ● official result · ○ estimate (not an IELTS score)</div>${ieltsCharts()}</div>
  <div class="card" style="margin-top:14px"><h2>Skills <span class="count">${skills.length}</span></h2>${skills.length ? `<div class="list">${skills.map(s => `<div class="row" data-act="skill" data-id="${esc(s.id)}"><div class="main"><div class="t" dir="auto">${esc(s.title)}</div><div class="m">${priChip(s.priority)}<span class="chip">${esc(s.status || 'Not started')}</span><span>Level ${esc(s.current ?? '?')} → ${esc(s.target ?? '?')}</span>${s.weeklyHours ? `<span>${esc(s.weeklyHours)} h/week</span>` : ''}</div>${s.evidenceNeeded ? `<div class="na" dir="auto">Evidence: ${esc(s.evidenceNeeded)}</div>` : ''}</div></div>`).join('')}</div>` : '<div class="empty">No skills yet.</div>'}
    <div class="btns" style="margin-top:10px"><button class="btn small" data-act="new-skill">${I.plus} Skill</button></div></div>
  <div class="grid two" style="margin-top:14px">
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
  <div class="grid two" style="margin-top:14px">
    <div class="card"><h2>By status</h2>${counts.map(([s, n]) => `<div style="margin:6px 0"><div class="small" style="display:flex;justify-content:space-between"><span>${esc(s)}</span><b>${n}</b></div><div class="bar"><i style="width:${Math.round(100 * n / max)}%"></i></div></div>`).join('') || '<div class="empty">No tasks.</div>'}</div>
    <div class="card"><h2>Quality checks</h2><div class="small">Open tasks without a next action: <b>${noNext.length}</b><br>Completed tasks without evidence: <b>${noEvid.length}</b><br>Open tasks with no due date: <b>${open.filter(x => !x.due).length}</b></div>
      <div class="hr"></div><div class="btns"><button class="btn small" data-act="log" data-type="weekly">Log weekly review</button><button class="btn small" data-act="log" data-type="monthly">Log monthly review</button><button class="btn small" data-act="closeout">Daily close-out</button></div></div>
  </div>
  ${overdue.length ? `<div class="card" style="margin-top:14px"><h2>Overdue <span class="count">${overdue.length}</span></h2><div class="list">${overdue.map(x => taskRow(x, { na: false })).join('')}</div></div>` : ''}
  <div class="card" style="margin-top:14px"><h2>Due in the next 30 days <span class="count">${next30.length}</span></h2>${next30.length ? `<div class="list">${next30.map(x => taskRow(x, { na: false })).join('')}</div>` : '<div class="empty">Nothing due.</div>'}</div>
  <div class="card" style="margin-top:14px"><h2>Recent logs <span class="count">${logs.length}</span></h2>${logs.length ? `<div class="list">${logs.map(l => `<div class="row" data-act="logitem" data-id="${esc(l.id)}"><div class="main"><div class="t">${esc(l.title || l.type)}</div><div class="m"><span>${esc(fmtDate(l.date, true))}</span><span class="chip">${esc(l.type)}</span></div>${l.done ? `<div class="na" dir="auto">${esc(l.done).slice(0, 200)}</div>` : ''}</div></div>`).join('')}</div>` : '<div class="empty">No logs yet.</div>'}</div>`;
}
function vSettings() {
  const pending = Object.keys(outbox).length, last = ls.get(K.last);
  const n = COLS.map(c => `${c}: ${list(c).length}`).join(' · ');
  return header('Settings', `MILAD 2031 OS ${VERSION}`) + `
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
  <div class="card"><h2>Sections</h2><div class="small" style="margin-bottom:8px">Hide what you do not use. Nothing is deleted.</div><div class="pick">${OPTIONAL.map(([k, l]) => `<button class="${hidden().has(k) ? '' : 'on'}" data-act="toggle-sec" data-v="${k}">${hidden().has(k) ? '' : '✓ '}${l}</button>`).join('')}</div></div>
  <div class="card"><h2>Language</h2><div class="seg">${[['en', 'English'], ['fa', 'فارسی']].map(([k, l]) => `<button class="${(ui.lang || 'en') === k ? 'on' : ''}" data-act="set-lang" data-v="${k}">${l}</button>`).join('')}</div></div>
  <div class="card"><h2>Security</h2><div class="btns"><button class="btn small" data-act="password">Change password</button><button class="btn small danger" data-act="logout">Sign out on this device</button></div>
    <div class="small" style="margin-top:8px">Do not store passport numbers, ID numbers, salaries or confidential employer files here. Keep those in your private evidence vault.</div></div>
  </div>`;
}
function header(title, sub) {
  if (ui.lang === 'fa') { title = trStr(title) || title; sub = sub && (trStr(sub) || sub); }
  const pg = route().page; const back = !NAV_MAIN.some(([k]) => k === pg) && pg !== 'plan' && pg !== 'learn';
  return `<div class="top"><div class="top-row">${back ? `<button class="icon-btn hback" data-act="back" aria-label="Back">${I.left}</button>` : ''}<h1 dir="auto">${esc(title)}</h1>${syncHtml()}<button class="icon-btn hsearch" data-act="search" aria-label="Search">${I.search}</button></div>${sub ? `<div class="sub" dir="auto">${esc(sub)}</div>` : ''}</div><div class="spacer" style="height:14px"></div>`;
}

/* ---------------- shell + router ---------------- */
function route() { const h = location.hash.replace(/^#\/?/, '') || 'today'; const [p, ...rest] = h.split('/'); return { page: p, arg: decodeURIComponent(rest.join('/')) }; }
function render() {
  if (!ls.get(K.tok) && !document.querySelector('.shell')) return;
  const { page, arg } = route();
  const views = { today: vToday, tasks: vTasks, calendar: vCalendar, plan: vPlan, more: vMore, learn: vLearn, evidence: vEvidence, decisions: vDecisions, notes: vNotes, note: () => vNote(arg), review: vReview, settings: vSettings, jobs: vJobs, immigration: vImmigration, progress: vProgress, journal: vJournal, report: vReport, templates: vTemplates, trash: vTrash, health: vHealth, course: () => vCourse(arg) };
  if (page === 'plan') { ui.pTab = ui.planTab === 'goals' ? 'goals' : 'roadmap'; views.plan = vProgress; } if (page === 'learn') { ui.pTab = 'learning'; views.learn = vProgress; }
  const html = (views[page] || vToday)();
  const active = NAV_MAIN.some(([k]) => k === page) ? page : ['plan', 'learn', 'report', 'course'].includes(page) ? 'progress' : page === 'note' ? 'more' : NAV_MORE.some(([k]) => k === page) ? 'more' : 'today';
  const focusKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.input : null;
  const sel = focusKey ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  const scrollY = window.scrollY;
  const app = $('#app');
  app.innerHTML = `<div class="shell">
    <aside class="side"><div class="brand">MILAD<span>2031 OS</span></div>${NAV_MAIN.filter(([k]) => k !== 'more').map(([k, l, ic]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}">${ic}${l}${badge(k)}</a>`).join('')}<div class="grp">Workspace</div>${navMore().map(([k, l, ic]) => `<a href="#/${k}" class="${page === k || (k === 'notes' && page === 'note') ? 'on' : ''}">${ic}${l}</a>`).join('')}</aside>
    <main class="pg-${esc(page)}${render.lastPage !== page ? ' pg-in' : ''}">${html}</main>
    <nav class="tabs">${NAV_MAIN.map(([k, l, ic]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}">${ic}${badge(k)}<span>${l}</span></a>`).join('')}</nav>
    <button class="fab" data-act="quick" aria-label="Add">${I.plus}</button></div>`;
  if (focusKey) { const el = app.querySelector(`[data-input="${focusKey}"]`); if (el) { el.focus(); try { el.setSelectionRange(sel[0], sel[1]); } catch {} } }
  if (page === 'settings') setTimeout(() => { pushRender(); pkRender(); }, 0);
  render.lastPage = page;
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
  if (ui.lang === 'fa') title = trStr(title) || title;
  sh.innerHTML = `<div class="sheet-h"><h3 dir="auto">${esc(title)}</h3><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.close}</button></div><div class="sheet-b">${bodyHtml}</div>${footHtml ? `<div class="sheet-f">${footHtml}</div>` : ''}`;
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
    if (f.type === 'check') o[f.k] = inp.checked; else if (f.type === 'datetime') o[f.k] = fromInput(inp.value); else if (f.type === 'number') o[f.k] = inp.value === '' ? '' : Number(inp.value); else o[f.k] = inp.value.trim(); }
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
    [{ k: 'owner', label: 'Owner', type: 'select', options: OWNERS, def: 'Milad' }, { k: 'area', label: 'Area', type: 'select', options: AREAS }],
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
function focusStart(id, mins = 25) { ui.focus = { id, dur: mins, start: Date.now(), paused: 0, pausedAt: 0 }; saveUi(); closeSheet(true); focusShow(); }
function focusShow() {
  const f = ui.focus; let el = $('#focus'); if (!f) { if (el) el.remove(); clearInterval(focusTick); return; }
  const t = f.kind === 'lesson' ? { title: f.title } : get('tasks', f.id);
  if (!el) { el = document.createElement('div'); el.id = 'focus'; document.body.appendChild(el); }
  const draw = () => { if (!ui.focus) { clearInterval(focusTick); return; } const ms = focusLeft(); const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000); const tt = $('#focus .ft'); if (tt) tt.textContent = `${pad(m)}:${pad(s)}`; const ring = $('#focus .ring i'); if (ring) ring.style.setProperty('--p', (100 - 100 * ms / (f.dur * 60000)).toFixed(1)); if (ms <= 0 && !ui.focus.finished) { ui.focus.finished = true; saveUi(); focusEnd(true); } };
  el.innerHTML = `<div class="fbox"><div class="small">Focus</div><div class="fttl" dir="auto">${esc(t ? t.title : 'Focus session')}</div><div class="ring"><i></i><div class="ft">--:--</div></div>
    <div class="btns" style="justify-content:center">${f.pausedAt ? '<button class="btn" data-act="f-resume">Resume</button>' : '<button class="btn" data-act="f-pause">Pause</button>'}<button class="btn" data-act="f-plus">+5 min</button><button class="btn primary" data-act="f-stop">Finish</button></div>
    <button class="btn ghost small" data-act="f-cancel" style="margin-top:10px">Cancel without saving</button></div>`;
  clearInterval(focusTick); draw(); if (ui.focus) focusTick = setInterval(draw, 1000);
}
function focusEnd(auto) {
  const f = ui.focus; if (!f) return; const mins = Math.max(1, Math.round((f.dur * 60000 - focusLeft()) / 60000));
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
    <div class="acts" style="margin-top:14px">${t && isOpen(t) ? `<button class="act pri" data-act="t-done" data-id="${esc(t.id)}"><span>✓</span>Task is done</button>` : ''}<button class="act" data-act="sheet-close"><span>→</span>Keep it open</button><button class="act" data-act="f-again" data-id="${esc(f.id)}"><span>↻</span>Another 25 min</button></div>`, '', { noFocus: true });
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
  for (const it of items) made.push(save('tasks', { title: it.title, state: 'To do', priority: 'P2', owner: 'Milad', due: it.off === null ? '' : addDays(today(), it.off), notes: 'From template: ' + tp.title }));
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
  habit: r => simpleForm('habits', 'habit', [{ k: 'title', label: 'Habit', req: true, ph: 'e.g. 30 min walk' }, { k: 'perWeek', label: 'Times per week', type: 'select', options: [1, 2, 3, 4, 5, 6, 7], blank: false, def: 7 }], r),
  milestone: r => simpleForm('milestones', 'milestone', [{ k: 'title', label: 'Milestone', req: true, ph: 'e.g. Official IELTS 7.5 achieved' }, [{ k: 'target', label: 'Target date', type: 'date' }, { k: 'status', label: 'Status', type: 'select', options: MS_STATES, blank: false, def: 'Planned' }], 'MORE', [{ k: 'goalId', label: 'Goal', type: 'select', options: goalOpts }, { k: 'area', label: 'Area', type: 'select', options: AREAS }], { k: 'proof', label: 'How I will know it is achieved', type: 'textarea' }, { k: 'notes', label: 'Notes', type: 'textarea' }], r),
  application: r => simpleForm('applications', 'application', [[{ k: 'company', label: 'Company', req: true }, { k: 'role', label: 'Role', req: true }], [{ k: 'stage', label: 'Stage', type: 'select', options: APP_STAGES, blank: false, def: 'Saved' }, { k: 'appliedOn', label: 'Applied on', type: 'date' }], { k: 'followUp', label: 'Follow up on', type: 'date', hint: 'Appears in Today and the calendar.' }, 'MORE', [{ k: 'location', label: 'Location' }, { k: 'source', label: 'Found via', ph: 'LinkedIn, referral…' }], { k: 'link', label: 'Job ad link', type: 'url' }, [{ k: 'cvVersion', label: 'CV version used' }, { k: 'contact', label: 'Contact person' }], { k: 'notes', label: 'Notes', type: 'textarea' }], r),
  immig: r => simpleForm('immigration', 'document', [{ k: 'title', label: 'Document', req: true }, [{ k: 'status', label: 'Status', type: 'select', options: IMM_STATES, blank: false, def: 'Not started' }, { k: 'category', label: 'Category', type: 'select', options: IMM_CATS, blank: false, def: 'Other' }], { k: 'expiry', label: 'Expiry date (if any)', type: 'date' }, 'MORE', { k: 'source', label: 'Official requirement link', type: 'url' }, { k: 'evidenceId', label: 'Linked evidence item', type: 'select', options: () => list('evidence').map(e => [e.id, (e.code ? e.code + ' · ' : '') + e.title]) }, { k: 'notes', label: 'Notes', type: 'textarea' }], r),
  logtime: r => form('Log practice time', [[{ k: 'skill', label: 'Skill', type: 'select', options: skillOpts, blank: false }, { k: 'minutes', label: 'Minutes', type: 'number', step: 5, def: 30 }], { k: 'date', label: 'Date', type: 'date', def: today() }, 'MORE', { k: 'title', label: 'Title', ph: 'e.g. Reading test 3' }, { k: 'done', label: 'What I did', type: 'textarea' }], r, v => {
    if (!v.skill) return 'Add a skill first (Learning → Skill).'; if (!(Number(v.minutes) > 0)) return 'Enter the minutes.';
    const sk = get('skills', v.skill); save('sessions', Object.assign({ title: v.title || ((sk ? sk.title : 'Practice') + ' · ' + v.minutes + ' min'), result: 'Not a check' }, v)); toast('Logged ' + v.minutes + ' min');
  }),
  goal: r => simpleForm('goals', 'goal', [{ k: 'title', label: 'Goal', req: true }, [{ k: 'status', label: 'Status', type: 'select', options: GOAL_STATES }, { k: 'target', label: 'Target date', type: 'date' }], 'MORE', [{ k: 'code', label: 'Code', ph: 'G1' }, { k: 'area', label: 'Area', type: 'select', options: AREAS }], { k: 'success', label: 'Success criteria', type: 'textarea' }, { k: 'notes', label: 'Notes', type: 'textarea' }], r),
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
  openSheet('Add', `<div class="grid two">${[['new-task', 'Task', I.tasks], ['new-event', 'Event', I.cal], ['log-time', 'Log practice', I.clock], ['new-application', 'Job application', I.jobs], ['new-note', 'Note', I.notes], ['new-course', 'Course', I.course], ['from-tpl', 'From template', I.tmpl], ['money-add', 'Update savings', I.money], ['weekly', 'Weekly review', I.review]].map(([a, l, ic]) => `<button class="card row" data-act="${a}" style="align-items:center;text-align:left"><span style="width:24px;color:var(--brass-ink)">${ic}</span><div class="main"><div class="t">${l}</div></div></button>`).join('')}</div>`, '', { noFocus: true });
}

/* ---------------- navigation polish ---------------- */
document.addEventListener('click', e => { const l = e.target.closest('nav.tabs a, .side a'); if (l && l.getAttribute('href') === '#/' + route().page) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, true);
let ptr = null;
document.addEventListener('touchstart', e => { if (window.scrollY > 0 || sheetCtx || $('#focus') || e.touches.length > 1 || e.target.closest('.row[data-act=task]')) return; ptr = { y: e.touches[0].clientY, d: 0 }; }, { passive: true });
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
document.addEventListener('touchstart', e => { const r = e.target.closest('.row[data-act=task]'); if (!r || e.target.closest('.check') || e.touches.length > 1) return; sw = { r, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, on: false }; }, { passive: true });
document.addEventListener('touchmove', e => {
  if (!sw) return; const dx = e.touches[0].clientX - sw.x, dy = e.touches[0].clientY - sw.y;
  if (!sw.on) { if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; } if (Math.abs(dx) > 14) sw.on = true; else return; }
  sw.dx = dx; sw.r.style.transform = `translateX(${dx}px)`; sw.r.classList.toggle('sw-r', dx > 0); sw.r.classList.toggle('sw-l', dx < 0); sw.r.classList.toggle('sw-go', Math.abs(dx) > 90);
}, { passive: true });
document.addEventListener('touchend', () => {
  if (!sw) return; const { r, dx, on } = sw; sw = null; if (!on) return; swBlock = Date.now();
  r.style.transition = 'transform .18s'; r.style.transform = ''; setTimeout(() => { r.style.transition = ''; r.classList.remove('sw-r', 'sw-l', 'sw-go'); }, 200);
  const id = r.dataset.id; if (dx > 90) toggleDone(id); else if (dx < -90) { const t = get('tasks', id); if (t && isOpen(t)) setTask(id, Object.assign({ due: addDays(today(), 1) }, t.focusDate === today() ? { focusDate: addDays(today(), 1) } : {}), 'Moved to tomorrow'); }
});

/* ---------------- events (delegated) ---------------- */
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (Date.now() - swBlock < 400 && a.dataset.act === 'task') return;
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
    event: () => eventForm(get('events', id) || {}),
    'new-event': () => eventForm({}, a.dataset.day || today()),
    goal: () => FORMS.goal(get('goals', id) || {}), 'new-goal': () => FORMS.goal({}),
    project: () => FORMS.project(get('projects', id) || {}), 'new-project': () => FORMS.project({}),
    skill: () => FORMS.skill(get('skills', id) || {}), 'new-skill': () => FORMS.skill({}),
    session: () => FORMS.session(get('sessions', id) || {}), 'new-session': () => FORMS.session({}),
    ielts: () => FORMS.ielts(get('ielts', id) || {}), 'new-ielts': () => FORMS.ielts({ kind: IELTS_KINDS[0] }),
    evidence: () => FORMS.evidence(get('evidence', id) || {}), 'new-evidence': () => FORMS.evidence({}),
    decision: () => FORMS.decision(get('decisions', id) || {}), 'new-decision': () => FORMS.decision({}),
    'new-note': () => FORMS.note({}), 'edit-note': () => FORMS.note(get('notes', id) || {}),
    logitem: () => FORMS.logitem(get('logs', id) || {}),
    log: () => a.dataset.type === 'weekly' ? weeklyReview() : FORMS.logitem({ type: a.dataset.type, date: today(), title: (a.dataset.type === 'weekly' ? 'Weekly review ' : 'Monthly review ') + fmtDate(today(), true) }),
    filter: () => { if (route().page !== 'tasks') location.hash = '#/tasks'; else render(); },
    'cal-move': () => { const [y, m] = ui.calMonth.split('-').map(Number); const d = new Date(y, m - 1 + Number(a.dataset.d), 1); ui.calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; saveUi(); render(); },
    'cal-today': () => { ui.calMonth = today().slice(0, 7); ui.calSel = today(); saveUi(); render(); },
    'cal-sel': () => { ui.calSel = a.dataset.day; if (a.dataset.day.slice(0, 7) !== ui.calMonth) ui.calMonth = a.dataset.day.slice(0, 7); saveUi(); render(); },
    'plan-day': () => planDay(a.dataset.day || today(), false),
    closeout: () => closeDay(),
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
    'new-course': () => newCourseSheet(),
    'c-starter': () => { const s = COURSE_STARTERS.find(x => x.key === a.dataset.v); if (!s) return; const sk = list('skills').find(k => s.skill.test(k.title)); const r = save('courses', { title: s.title, status: s.gate ? 'Planned' : 'Active', skillId: sk ? sk.id : '', provider: s.provider, gate: s.gate, perWeek: s.perWeek, reviewEvery: 30, nextReview: addDays(today(), 30), lessons: s.lessons() }); closeSheet(); toast('Course created'); location.hash = '#/course/' + encodeURIComponent(r.id); },
    'c-from-note': () => lessonsFromNote(id),
    'c-blank': () => { closeSheet(true); courseForm({ status: 'Active', perWeek: 2, reviewEvery: 30 }); },
    'c-edit': () => courseForm(get('courses', id)),
    'c-lessons': () => { const c = get('courses', id); form('Edit lessons', [{ k: 'txt', label: 'Lessons, one per line (finished ones stay ticked)', type: 'big' }], { txt: cLessons(c).map(l => l.t).join('\n') }, v => { const old = cLessons(c); const lines = String(v.txt || '').split('\n').map(x => x.trim()).filter(Boolean); const used = new Set(); const ls = lines.map((t, i) => { const o = old.find(l => l.t === t && !used.has(l.id)); if (o) { used.add(o.id); return o; } return { id: 'l' + Date.now().toString(36) + i, t, done: false, doneOn: '' }; }); save('courses', Object.assign({}, c, { lessons: ls })); toast('Lessons saved'); }); },
    'c-tick': () => { lessonDone(id, a.dataset.l); },
    'l-done': () => { lessonDone(id, a.dataset.l, Number(a.dataset.v)); closeSheet(); toast('Lesson done ✓'); },
    'c-start': () => { e.stopPropagation(); courseStart(id, a.dataset.l); },
    'c-review': () => courseReview(id),
    'c-decide': () => { const c = get('courses', id); const note = (sheetCtx.el.querySelector('[name=rn]') || {}).value || ''; const d = { Active: 'Keep going', Paused: 'Paused', Done: 'Finished', Dropped: 'Dropped' }[a.dataset.v]; save('courses', Object.assign({}, c, { status: a.dataset.v, lastReview: today(), nextReview: ['Active', 'Paused'].includes(a.dataset.v) ? addDays(today(), Number(c.reviewEvery) || 30) : '', reviews: (c.reviews || []).concat([{ date: today(), decision: d, note: note.trim() }]) })); closeSheet(); toast('Review saved: ' + d); },
    setup: () => setupSheet(),
    'setup-mark': () => { ui.calDone = true; ui.siriDone = true; saveUi(); closeSheet(); render(); },
    'setup-hide': () => { ui.setupHidden = true; saveUi(); closeSheet(); render(); },
    'go-settings': () => { closeSheet(true); location.hash = '#/settings'; },
    'ics-setup': () => { closeSheet(true); location.hash = '#/settings'; setTimeout(() => { const b = document.querySelector('[data-act=ics]'); if (b) { b.click(); b.scrollIntoView({ block: 'center' }); } }, 300); },
    back: () => { const pg = route().page; location.hash = '#/' + (pg === 'note' ? 'notes' : pg === 'course' || pg === 'report' ? 'progress' : 'more'); },
    'toggle-sec': () => { const h = hidden(); if (h.has(a.dataset.v)) h.delete(a.dataset.v); else h.add(a.dataset.v); save('settings', Object.assign({}, prefs(), { id: 'prefs', hidden: [...h] })); },
    'od-today': () => { const od = list('tasks').filter(x => isOpen(x) && x.due && x.due < today()); od.forEach(x => save('tasks', Object.assign({}, x, { due: today() }))); toast(`${od.length} moved to today`); },
    'p-tab': () => { ui.pTab = a.dataset.t; saveUi(); if (route().page !== 'progress') location.hash = '#/progress'; else render(); window.scrollTo(0, 0); },
    search: () => searchSheet(),
    'next-lesson': () => { closeSheet(true); const c = courseLive().filter(x => cNext(x))[0]; if (c) courseStart(c.id); else toast('No course with a next lesson'); },
    'course-open': () => { closeSheet(true); location.hash = '#/course/' + encodeURIComponent(id); },
    'open-note': () => { closeSheet(true); location.hash = '#/note/' + encodeURIComponent(id); },
    print: () => window.print(),
    hab: () => { const h = get('habits', id); if (!h) return; const d = Object.assign({}, h.done || {}); const t = today(); if (d[t]) delete d[t]; else d[t] = true; save('habits', Object.assign({}, h, { done: d })); },
    habit: () => FORMS.habit(get('habits', id) || {}), 'new-habit': () => FORMS.habit({ perWeek: 7 }),
    'money-add': () => form('Update balance', [{ k: 'amount', label: 'Savings balance now', type: 'number', req: true }, 'MORE', { k: 'date', label: 'Date', type: 'date', def: today() }, { k: 'note', label: 'Note' }], { date: today() }, v => { if (v.amount === '') return 'Enter the amount.'; save('money', { amount: Number(v.amount), date: v.date || today(), note: v.note }); toast('Balance saved'); }),
    'money-edit': () => { const x = get('money', id); form('Edit balance', [{ k: 'amount', label: 'Amount', type: 'number', req: true }, { k: 'date', label: 'Date', type: 'date' }, { k: 'note', label: 'Note' }], x, v => { save('money', Object.assign({}, x, v, { amount: Number(v.amount) })); }, { onDelete: () => { remove('money', id); closeSheet(); } }); },
    'money-goal': () => form('Savings goal', [[{ k: 'savingsGoal', label: 'Goal amount', type: 'number' }, { k: 'currency', label: 'Currency', ph: 'OMR, CAD, AUD…' }]], prefs(), v => { save('settings', Object.assign({}, prefs(), { id: 'prefs', savingsGoal: v.savingsGoal, currency: v.currency })); }),
    'journal-new': () => { const ex = list('logs').find(l => l.type === 'closeout' && l.date === today()); FORMS.logitem(ex || { type: 'journal', date: today(), title: 'Journal ' + fmtDate(today()) }); },
    'plan-tab': () => { ui.planTab = a.dataset.t; saveUi(); render(); },
    'job-filter': () => { ui.jobFilter = ui.jobFilter === a.dataset.f && a.dataset.f !== 'active' ? 'active' : a.dataset.f; saveUi(); render(); },
    milestone: () => FORMS.milestone(get('milestones', id) || {}), 'new-milestone': () => FORMS.milestone(a.dataset.year ? { target: a.dataset.year + '-12-31' } : {}),
    'ms-done': () => { e.stopPropagation(); const m = get('milestones', id); if (m) save('milestones', Object.assign({}, m, { status: m.status === 'Done' ? 'In progress' : 'Done', doneOn: m.status === 'Done' ? '' : today() })); },
    'ms-from-goals': () => { let n = 0; for (const g of list('goals')) { if (!g.target || list('milestones').some(m => m.goalId === g.id)) continue; save('milestones', { title: g.title, target: g.target, goalId: g.id, status: 'Planned', area: g.area || '' }); n++; } toast(n ? `${n} milestone${n > 1 ? 's' : ''} created` : 'Every dated goal already has a milestone'); },
    vision: () => form('MILAD 2031 target date', [{ k: 'visionDate', label: 'Target date', type: 'date', req: true }], { visionDate: visionDate() }, v => { if (!v.visionDate) return 'Choose a date.'; save('settings', Object.assign({}, prefs(), { id: 'prefs', visionDate: v.visionDate })); }),
    application: () => a.dataset.kind === 'follow' || route().page === 'jobs' || route().page === 'today' || route().page === 'calendar' ? appSheet(id) : FORMS.application(get('applications', id) || {}), 'new-application': () => FORMS.application({ appliedOn: '', stage: 'Saved' }),
    immig: () => FORMS.immig(get('immigration', id) || {}), 'new-immig': () => FORMS.immig({}),
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
    logout: async () => { if (!confirm('Sign out on this device? Data stays on the server.')) return; if (Object.keys(outbox).length) await sync(); try { await api('logout', { method: 'POST' }); } catch {} ls.del(K.tok); ls.del(K.db); ls.del(K.out); ls.del(K.rev); db = blankDb(); outbox = {}; showAuth(); }
  };
  if (map[act]) { if (act !== 'sheet-close' && act !== 'form-save' && act !== 'form-del' && sheetCtx && ['new-task', 'new-event', 'new-note', 'new-decision', 'new-evidence', 'new-session', 'closeout', 'log-time', 'new-application', 'new-milestone', 'new-immig', 'weekly', 'money-add', 'from-tpl', 'new-course'].includes(act)) closeSheet(true); map[act](); }
});
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.input; if (k) { ui[k] = e.target.value; saveUi(); if (e.target.dataset.norender) return; clearTimeout(render.t); render.t = setTimeout(render, 180); } });
document.addEventListener('change', e => {
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
      const cols = j.collections || j; let n = 0, skipped = 0;
      for (const c of COLS) { const src = cols[c]; if (!src) continue; for (const r of Array.isArray(src) ? src : Object.values(src)) { if (!r || !r.id) continue; const cur = db[c][r.id]; if (cur && String(cur.updatedAt) >= String(r.updatedAt || '')) { skipped++; continue; } const rec = Object.assign({ createdAt: nowIso() }, r, { updatedAt: r.updatedAt || nowIso() }); db[c][r.id] = rec; outbox[c + ':' + r.id] = rec; n++; } }
      migrate(); persist(); render(); queueSync(200); toast(`Imported ${n} records${skipped ? `, kept ${skipped} newer local records` : ''}`);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && sheetCtx && sheetCtx.onSave) sheetCtx.onSave(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { sync(); render(); } });
window.addEventListener('online', () => sync());
window.addEventListener('offline', () => setSyncState('off', 'offline'));
setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 45000);

/* ---------------- auth screens ---------------- */
async function showAuth(msg) {
  closeSheet(true);
  let setup = true;
  let pk = false;
  try { const s = await api('status'); setup = s.setup; pk = !!s.passkey && pkOk(); if (s.authed && s.token) { ls.set(K.tok, s.token); return start(); } } catch (e) { if (e.message === 'offline' && ls.get(K.tok)) return start(); }
  $('#app').innerHTML = `<div class="login"><form class="box" id="authform"><h1>MILAD 2031</h1><p>${setup ? 'Sign in to your personal operating system.' : 'First run: create the owner password for this platform. Use a long password you do not use elsewhere.'}</p>
    ${pk ? '<button type="button" class="btn primary" id="pkbtn" style="width:100%;justify-content:center;margin-bottom:14px">Sign in with Face ID</button><div class="small" style="text-align:center;margin-bottom:10px">or use your password</div>' : ''}
    <div class="f"><label for="pw">${setup ? 'Password' : 'New password (10+ characters)'}</label><input id="pw" type="password" autocomplete="${setup ? 'current-password' : 'new-password'}" required></div>
    ${setup ? '' : '<div class="f"><label for="pw2">Repeat password</label><input id="pw2" type="password" autocomplete="new-password" required></div>'}
    <div class="err" id="autherr">${esc(msg || '')}</div><button class="btn primary" style="width:100%;justify-content:center" type="submit">${setup ? 'Sign in' : 'Create password and open'}</button></form></div>`;
  $('#authform').addEventListener('submit', async ev => {
    ev.preventDefault(); const pw = $('#pw').value; const err = $('#autherr');
    if (!setup && pw !== $('#pw2').value) { err.textContent = 'The passwords do not match.'; return; }
    err.textContent = '…';
    try { const j = await api(setup ? 'login' : 'setup', { body: { password: pw, device: device() } }); ls.set(K.tok, j.token); ls.del(K.rev); err.textContent = ''; start(); if (pkOk() && !ui.pkSet) setTimeout(() => toast('Use Face ID next time?', 'Set up', pkRegister), 1500); }
    catch (e2) { err.textContent = e2.message === 'offline' ? 'No connection to the server.' : e2.message; }
  });
  const pb = $('#pkbtn'); if (pb) pb.addEventListener('click', () => pkLogin($('#autherr')));
  setTimeout(() => { const p = $('#pw'); if (p && !pb) p.focus(); }, 50);
  applyLang();
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
function start() { db = normalise(ls.get(K.db, null)); outbox = ls.get(K.out, {}) || {}; migrate(); render.keepScroll = false; render(); sync(); if (ui.focus) focusShow(); }

/* ---------------- boot ---------------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') { const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.register('sw.js').catch(() => {}); navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) toast('MILAD 2031 was updated', 'Reload', () => location.reload()); }); }
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
if (ls.get(K.tok)) start(); else showAuth();
})();
