/* MILAD 2031 OS — client (vanilla JS, no framework, no third-party services).
 * Offline-first: everything is cached on the device and changes queue in an outbox.
 * Sync: api.php merges record by record (newest updatedAt wins), so iPhone and iPad
 * can both edit and converge. Deletes are soft (deleted:true) so nothing is lost. */
(() => {
'use strict';

const VERSION = '1.0.0';
const API = 'api.php';
const K = { db: 'm2031.db', out: 'm2031.outbox', tok: 'm2031.token', rev: 'm2031.rev', ui: 'm2031.ui', last: 'm2031.lastSync' };
const COLS = ['tasks','events','projects','goals','skills','logs','evidence','decisions','notes','ielts','sessions','settings'];
const STATES = ['Not Started','In Progress','Waiting for Me','Waiting for External Input','Blocked','Ready for Review','Completed & Verified','Completed - Not Verified','Cancelled'];
const DONE = new Set(['Completed & Verified','Completed - Not Verified','Cancelled']);
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
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
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
  if (r.status === 401 && action !== 'login' && action !== 'setup') { ls.del(K.tok); showAuth(j.error || 'Please sign in again'); throw new Error('auth'); }
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
    if (!j.unchanged && j.collections) {
      const server = normalise(j.collections);
      for (const [k, r] of Object.entries(outbox)) { server[k.split(':')[0]][r.id] = r; }
      db = server;
    }
    ls.set(K.rev, j.rev); ls.set(K.last, nowIso()); persist();
    setSyncState('ok', '');
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
const NAV_MAIN = [['today', 'Today', I.today], ['tasks', 'Tasks', I.tasks], ['calendar', 'Calendar', I.cal], ['plan', 'Plan', I.plan], ['more', 'More', I.more]];
const NAV_MORE = [['learn', 'Learning', I.learn], ['evidence', 'Evidence', I.evid], ['decisions', 'Decisions', I.dec], ['notes', 'Notes & docs', I.notes], ['review', 'Review', I.review], ['settings', 'Settings', I.set]];

/* ---------------- chips ---------------- */
function stateChip(s) { const c = DONE.has(s) ? 's-done' : /Waiting/.test(s) ? 's-wait' : s === 'Blocked' ? 's-block' : s === 'In Progress' ? 's-prog' : s === 'Ready for Review' ? 's-rev' : ''; return `<span class="chip ${c}">${esc(s || 'Not Started')}</span>`; }
const priChip = p => p ? `<span class="chip ${esc(p.toLowerCase())}">${esc(p)}</span>` : '';
function dueChip(t) { if (!t.due) return ''; const late = isOpen(t) && t.due < today(); return `<span class="chip ${late ? 'late' : ''}">Due ${esc(fmtDate(t.due))} · ${esc(rel(t.due))}</span>`; }

function taskRow(t, opts = {}) {
  const proj = t.projectId && get('projects', t.projectId);
  return `<div class="row" data-act="task" data-id="${esc(t.id)}">
    <button class="check ${DONE.has(t.state) ? 'done' : ''}" data-act="complete" data-id="${esc(t.id)}" aria-label="Complete">${I.tick}</button>
    <div class="main"><div class="t" dir="auto">${esc(t.title)}</div>
      <div class="m">${priChip(t.priority)}${stateChip(t.state)}${dueChip(t)}${t.scheduled ? `<span>🕘 ${esc(fmtDate(t.scheduled))} ${esc(fmtTime(t.scheduled))}</span>` : ''}${proj ? `<span dir="auto">${esc(proj.title)}</span>` : ''}${t.owner && t.owner !== 'Milad' ? `<span>${esc(t.owner)}</span>` : ''}</div>
      ${opts.na !== false && t.nextAction ? `<div class="na" dir="auto">→ ${esc(t.nextAction)}</div>` : ''}</div></div>`;
}
const sortTasks = arr => arr.sort((a, b) => (a.priority || 'P9').localeCompare(b.priority || 'P9') || (a.due || '9999').localeCompare(b.due || '9999') || String(a.title).localeCompare(String(b.title)));

/* ---------------- views ---------------- */
function vToday() {
  const t = today(), open = list('tasks').filter(isOpen);
  const top = sortTasks(open.filter(x => x.focusDate === t));
  const overdue = sortTasks(open.filter(x => x.due && x.due < t));
  const week = open.filter(x => x.due && x.due >= t && x.due <= addDays(t, 7));
  const mine = sortTasks(open.filter(x => x.state === 'Waiting for Me'));
  const ext = open.filter(x => x.state === 'Waiting for External Input' || x.state === 'Blocked');
  const sched = agenda(t, t).filter(a => a.kind !== 'due');
  const lastClose = list('logs').filter(l => l.type === 'closeout').sort((a, b) => b.date.localeCompare(a.date))[0];
  return header(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), 'Today') + `
  <div class="kpis"><div class="kpi"><b>${top.length}</b><span>Top 3 today</span></div><div class="kpi ${overdue.length ? 'bad' : ''}"><b>${overdue.length}</b><span>Overdue</span></div><div class="kpi"><b>${week.length}</b><span>Due in 7 days</span></div><div class="kpi ${mine.length ? 'warn' : ''}"><b>${mine.length}</b><span>Waiting for me</span></div></div>
  <div class="grid two" style="margin-top:14px">
    <div class="card"><h2>Top 3 <span class="count">${top.length}</span></h2>${top.length ? `<div class="list">${top.map(x => taskRow(x)).join('')}</div>` : `<div class="empty">No Top 3 set for today.</div>`}
      <div class="btns" style="margin-top:10px"><button class="btn small" data-act="plan-day" data-day="${t}">Choose today's Top 3</button></div></div>
    <div class="card"><h2>Schedule <span class="count">${sched.length}</span></h2>${sched.length ? `<div class="list">${sched.map(agendaRow).join('')}</div>` : '<div class="empty">Nothing scheduled today.</div>'}</div>
  </div>
  ${overdue.length ? `<div class="card" style="margin-top:14px"><h2>Overdue <span class="count">${overdue.length}</span></h2><div class="list">${overdue.map(x => taskRow(x)).join('')}</div></div>` : ''}
  <div class="grid two" style="margin-top:14px">
    <div class="card"><h2>Waiting for me <span class="count">${mine.length}</span></h2>${mine.length ? `<div class="list">${mine.slice(0, 6).map(x => taskRow(x, { na: false })).join('')}</div>${mine.length > 6 ? `<a class="btn small ghost" href="#/tasks" data-act="filter" data-f="mine">See all ${mine.length}</a>` : ''}` : '<div class="empty">Nothing waiting for you.</div>'}</div>
    <div class="card"><h2>External and blocked <span class="count">${ext.length}</span></h2>${ext.length ? `<div class="list">${ext.slice(0, 6).map(x => taskRow(x, { na: false })).join('')}</div>` : '<div class="empty">No blocked items.</div>'}</div>
  </div>
  <div class="card" style="margin-top:14px"><h2>Daily close-out</h2><div class="small">${lastClose ? `Last close-out: ${esc(fmtDate(lastClose.date))}.` : 'No close-out recorded yet.'} Update states, record what was done, and set tomorrow's Top 3. About 10 minutes.</div>
    <div class="btns" style="margin-top:10px"><button class="btn primary" data-act="closeout">Close out today</button></div></div>`;
}
function agendaRow(a) {
  const tag = a.kind === 'event' ? '' : a.kind === 'due' ? '<span class="chip late">Due</span>' : '<span class="chip s-rev">Task</span>';
  return `<div class="row" data-act="${a.kind === 'event' ? 'event' : 'task'}" data-id="${esc(a.id)}"><div class="time">${esc(a.time || 'all day')}${a.end ? `<br><span class="small">${esc(a.end)}</span>` : ''}</div><div class="main"><div class="t" dir="auto">${esc(a.title)}</div><div class="m">${tag}${a.kind !== 'event' && a.rec.nextAction ? `<span dir="auto">${esc(a.rec.nextAction).slice(0, 120)}</span>` : ''}${a.kind === 'event' && a.rec.rrule ? '<span>repeats</span>' : ''}</div></div></div>`;
}
const TASK_FILTERS = [['active', 'Active'], ['top', 'Top 3'], ['mine', 'Waiting for me'], ['ext', 'External / blocked'], ['overdue', 'Overdue'], ['week', 'Next 7 days'], ['month', 'Next 30 days'], ['done', 'Completed'], ['all', 'All']];
function vTasks() {
  const t = today(), f = ui.taskFilter, q = (ui.taskQuery || '').toLowerCase();
  let arr = list('tasks');
  const by = {
    active: x => isOpen(x), top: x => isOpen(x) && x.focusDate === t, mine: x => x.state === 'Waiting for Me', ext: x => x.state === 'Waiting for External Input' || x.state === 'Blocked',
    overdue: x => isOpen(x) && x.due && x.due < t, week: x => isOpen(x) && x.due && x.due <= addDays(t, 7), month: x => isOpen(x) && x.due && x.due <= addDays(t, 30), done: x => DONE.has(x.state), all: () => true
  };
  arr = arr.filter(by[f] || by.active);
  if (q) arr = arr.filter(x => [x.title, x.nextAction, x.notes, x.area].join(' ').toLowerCase().includes(q));
  if (f === 'done') arr.sort((a, b) => String(b.completedOn || '').localeCompare(String(a.completedOn || ''))); else sortTasks(arr);
  return header('Tasks', `${arr.length} shown`) + `
  <div class="seg">${TASK_FILTERS.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}</div>
  <div class="toolbar"><input class="search" type="search" placeholder="Search tasks" value="${esc(ui.taskQuery)}" data-input="taskQuery"><button class="btn primary" data-act="new-task">${I.plus} Task</button></div>
  <div class="card">${arr.length ? `<div class="list">${arr.map(x => taskRow(x)).join('')}</div>` : '<div class="empty">No tasks in this view.</div>'}</div>`;
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
  ${days.map(d => { const it = byDay[d] || []; return `<div class="day ${d.slice(0, 7) !== ui.calMonth ? 'out' : ''} ${d === t ? 'today' : ''} ${d === ui.calSel ? 'sel' : ''}" data-act="cal-sel" data-day="${d}"><span class="n">${Number(d.slice(8))}</span><div class="dots">${it.slice(0, 6).map(a => `<i class="${a.kind === 'task' ? 't' : a.kind === 'due' ? 'd' : ''}"></i>`).join('')}</div>${it.slice(0, 3).map(a => `<div class="lbl" dir="auto">${esc(a.time ? a.time + ' ' : '')}${esc(a.title)}</div>`).join('')}${it.length > 3 ? `<div class="lbl">+${it.length - 3}</div>` : ''}</div>`; }).join('')}</div></div>
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
  return header('Plan', 'Vision → goals → projects → actions') + `
  <div class="btns" style="margin-bottom:12px"><button class="btn primary" data-act="new-goal">${I.plus} Goal</button><button class="btn" data-act="new-project">${I.plus} Project</button></div>
  ${goals.length ? goals.map(g => { const ps = projects.filter(p => p.goalId === g.id); return `<div class="card" style="margin-bottom:12px"><div class="row" data-act="goal" data-id="${esc(g.id)}" style="border:0;padding-top:0"><div class="main"><div class="t" dir="auto">${esc(g.title)}</div><div class="m"><span class="chip">${esc(g.status || 'Not started')}</span>${g.area ? `<span>${esc(g.area)}</span>` : ''}${g.target ? `<span>Target ${esc(fmtDate(g.target, true))}</span>` : ''}</div>${g.success ? `<div class="na" dir="auto">${esc(g.success)}</div>` : ''}</div></div>${bar(gprog(g.id))}
    ${ps.length ? `<div class="list" style="margin-top:8px">${ps.map(p => `<div class="row" data-act="project" data-id="${esc(p.id)}"><div class="main"><div class="t" dir="auto">${esc(p.title)}</div><div class="m"><span class="chip">${esc(p.status || 'Planned')}</span>${p.target ? `<span>Target ${esc(fmtDate(p.target, true))}</span>` : ''}<span>${prog(p.id)[1] - prog(p.id)[0]} open</span></div></div></div>`).join('')}</div>` : ''}</div>`; }).join('') : '<div class="card empty">No goals yet. Import your MILAD 2031 data in Settings, or add a goal.</div>'}
  ${orphan.length ? `<div class="card"><h2>Projects without a goal</h2><div class="list">${orphan.map(p => `<div class="row" data-act="project" data-id="${esc(p.id)}"><div class="main"><div class="t" dir="auto">${esc(p.title)}</div><div class="m"><span class="chip">${esc(p.status || 'Planned')}</span></div></div></div>`).join('')}</div></div>` : ''}`;
}
function vMore() {
  return header('More', 'Everything else in MILAD 2031') + `<div class="grid two">${NAV_MORE.map(([k, l, ic]) => `<a class="card row" href="#/${k}" style="text-decoration:none;align-items:center"><span style="width:26px;color:var(--brass-ink)">${ic}</span><div class="main"><div class="t">${l}</div><div class="m">${moreHint(k)}</div></div></a>`).join('')}</div>`;
}
function moreHint(k) {
  return { learn: `${list('skills').length} skills · ${list('sessions').length} sessions · ${list('ielts').length} IELTS entries`, evidence: `${list('evidence').length} items`, decisions: `${list('decisions').length} decisions`, notes: `${list('notes').length} documents`, review: 'Live executive review and close-out logs', settings: 'Sync, calendar feed, backup, password' }[k] || '';
}
function vLearn() {
  const skills = list('skills').sort((a, b) => String(a.priority || 'P9').localeCompare(String(b.priority || 'P9')));
  const sessions = list('sessions').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const ielts = list('ielts').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return header('Learning', 'Competence is shown by practical checks, not attendance') + `
  <div class="card"><h2>Skills <span class="count">${skills.length}</span></h2>${skills.length ? `<div class="list">${skills.map(s => `<div class="row" data-act="skill" data-id="${esc(s.id)}"><div class="main"><div class="t" dir="auto">${esc(s.title)}</div><div class="m">${priChip(s.priority)}<span class="chip">${esc(s.status || 'Not started')}</span><span>Level ${esc(s.current ?? '?')} → ${esc(s.target ?? '?')}</span>${s.weeklyHours ? `<span>${esc(s.weeklyHours)} h/week</span>` : ''}</div>${s.evidenceNeeded ? `<div class="na" dir="auto">Evidence: ${esc(s.evidenceNeeded)}</div>` : ''}</div></div>`).join('')}</div>` : '<div class="empty">No skills yet.</div>'}
    <div class="btns" style="margin-top:10px"><button class="btn small" data-act="new-skill">${I.plus} Skill</button></div></div>
  <div class="grid two" style="margin-top:14px">
  <div class="card"><h2>Practice sessions <span class="count">${sessions.length}</span></h2>${sessions.length ? `<div class="list">${sessions.slice(0, 30).map(s => `<div class="row" data-act="session" data-id="${esc(s.id)}"><div class="main"><div class="t" dir="auto">${esc(s.title || ('Session ' + (s.number || '')))}</div><div class="m"><span>${esc(fmtDate(s.date, true))}</span>${s.result ? `<span class="chip ${s.result === 'Pass' ? 's-done' : s.result === 'Partial' ? 's-wait' : ''}">${esc(s.result)}</span>` : ''}${s.skill ? `<span>${esc((get('skills', s.skill) || {}).title || '')}</span>` : ''}</div></div></div>`).join('')}</div>` : '<div class="empty">No sessions logged.</div>'}
    <div class="btns" style="margin-top:10px"><button class="btn small" data-act="new-session">${I.plus} Log session</button></div></div>
  <div class="card"><h2>IELTS log <span class="count">${ielts.length}</span></h2><div class="small" style="margin-bottom:6px">Target 7.5 overall, no skill below 7.0. Only an official test report is an IELTS score.</div>${ielts.length ? `<div class="list">${ielts.map(e => `<div class="row" data-act="ielts" data-id="${esc(e.id)}"><div class="main"><div class="t">${esc(e.skill || 'IELTS')} ${e.band ? '· ' + esc(e.band) : ''}</div><div class="m"><span>${esc(fmtDate(e.date, true))}</span><span class="chip ${/Official/.test(e.kind) ? 's-done' : 's-wait'}">${esc(e.kind || '')}</span></div></div></div>`).join('')}</div>` : '<div class="empty">No entries yet. No baseline exists.</div>'}
    <div class="btns" style="margin-top:10px"><button class="btn small" data-act="new-ielts">${I.plus} Entry</button></div></div></div>`;
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
  const counts = STATES.map(s => [s, tasks.filter(x => (x.state || 'Not Started') === s).length]).filter(([, n]) => n);
  const max = Math.max(1, ...counts.map(([, n]) => n));
  const overdue = sortTasks(open.filter(x => x.due && x.due < t));
  const next30 = sortTasks(open.filter(x => x.due && x.due >= t && x.due <= addDays(t, 30)));
  const doneWeek = tasks.filter(x => DONE.has(x.state) && x.completedOn && x.completedOn >= addDays(t, -7));
  const noNext = open.filter(x => !x.nextAction);
  const noEvid = tasks.filter(x => /Completed/.test(x.state || '') && !x.evidence);
  const logs = list('logs').sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);
  return header('Review', 'Live executive review, computed from your records') + `
  <div class="kpis"><div class="kpi"><b>${open.length}</b><span>Open tasks</span></div><div class="kpi ${overdue.length ? 'bad' : ''}"><b>${overdue.length}</b><span>Overdue</span></div><div class="kpi"><b>${doneWeek.length}</b><span>Completed in 7 days</span></div><div class="kpi ${noNext.length || noEvid.length ? 'warn' : ''}"><b>${noNext.length + noEvid.length}</b><span>Quality issues</span></div></div>
  <div class="grid two" style="margin-top:14px">
    <div class="card"><h2>By workflow state</h2>${counts.map(([s, n]) => `<div style="margin:6px 0"><div class="small" style="display:flex;justify-content:space-between"><span>${esc(s)}</span><b>${n}</b></div><div class="bar"><i style="width:${Math.round(100 * n / max)}%"></i></div></div>`).join('') || '<div class="empty">No tasks.</div>'}</div>
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
  <div class="card"><h2>Install on iPhone or iPad</h2><div class="small">Open this page in Safari → Share → <b>Add to Home Screen</b>. It then opens full screen like an app and works offline; changes sync when you are online.</div></div>
  <div class="card"><h2>Backup and import</h2><div class="small">The server also keeps a daily snapshot for 30 days. Export a copy regularly.</div>
    <div class="btns" style="margin-top:10px"><button class="btn small" data-act="export">Export JSON backup</button><label class="btn small" style="cursor:pointer">Import JSON<input type="file" accept="application/json,.json" data-change="import" hidden></label></div>
    <div class="small mono" style="margin-top:8px">${esc(n)}</div></div>
  <div class="card"><h2>Security</h2><div class="btns"><button class="btn small" data-act="password">Change password</button><button class="btn small danger" data-act="logout">Sign out on this device</button></div>
    <div class="small" style="margin-top:8px">Do not store passport numbers, ID numbers, salaries or confidential employer files here. Keep those in your private evidence vault.</div></div>
  </div>`;
}
function header(title, sub) {
  return `<div class="top"><div class="top-row"><h1 dir="auto">${esc(title)}</h1>${syncHtml()}</div>${sub ? `<div class="sub" dir="auto">${esc(sub)}</div>` : ''}</div><div class="spacer" style="height:14px"></div>`;
}

/* ---------------- shell + router ---------------- */
function route() { const h = location.hash.replace(/^#\/?/, '') || 'today'; const [p, ...rest] = h.split('/'); return { page: p, arg: decodeURIComponent(rest.join('/')) }; }
function render() {
  if (!ls.get(K.tok) && !document.querySelector('.shell')) return;
  const { page, arg } = route();
  const views = { today: vToday, tasks: vTasks, calendar: vCalendar, plan: vPlan, more: vMore, learn: vLearn, evidence: vEvidence, decisions: vDecisions, notes: vNotes, note: () => vNote(arg), review: vReview, settings: vSettings };
  const html = (views[page] || vToday)();
  const active = NAV_MAIN.some(([k]) => k === page) ? page : page === 'note' ? 'more' : NAV_MORE.some(([k]) => k === page) ? 'more' : 'today';
  const focusKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.input : null;
  const sel = focusKey ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  const scrollY = window.scrollY;
  const app = $('#app');
  app.innerHTML = `<div class="shell">
    <aside class="side"><div class="brand">MILAD<span>2031 OS</span></div>${NAV_MAIN.filter(([k]) => k !== 'more').map(([k, l, ic]) => `<a href="#/${k}" class="${page === k ? 'on' : ''}">${ic}${l}</a>`).join('')}<div class="grp">Workspace</div>${NAV_MORE.map(([k, l, ic]) => `<a href="#/${k}" class="${page === k || (k === 'notes' && page === 'note') ? 'on' : ''}">${ic}${l}</a>`).join('')}</aside>
    <main>${html}</main>
    <nav class="tabs">${NAV_MAIN.map(([k, l, ic]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}">${ic}<span>${l}</span></a>`).join('')}</nav>
    <button class="fab" data-act="quick" aria-label="Add">${I.plus}</button></div>`;
  if (focusKey) { const el = app.querySelector(`[data-input="${focusKey}"]`); if (el) { el.focus(); try { el.setSelectionRange(sel[0], sel[1]); } catch {} } }
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
function form(title, fields, rec, onSave, opts = {}) {
  const body = fields.map(f => Array.isArray(f) ? `<div class="fgrid">${f.map(x => field(x, rec[x.k])).join('')}</div>` : f.html ? f.html : field(f, rec[f.k])).join('') + `<div class="err" id="formerr"></div>`;
  const flat = fields.flat().filter(f => f.k);
  const foot = `${opts.onDelete ? '<button class="btn danger" data-act="form-del">Delete</button><span style="flex:1"></span>' : ''}${opts.extra || ''}<button class="btn" data-act="sheet-close">Cancel</button><button class="btn primary" data-act="form-save">Save</button>`;
  openSheet(title, body, foot, { onSave: () => { const v = readForm(flat, sheetCtx.el); const err = onSave(v); if (err) { $('#formerr', sheetCtx.el).textContent = err; return; } closeSheet(); }, onDelete: opts.onDelete, noFocus: opts.noFocus });
}
const projOpts = () => list('projects').sort((a, b) => String(a.title).localeCompare(String(b.title))).map(p => [p.id, p.title]);
const goalOpts = () => list('goals').sort((a, b) => String(a.title).localeCompare(String(b.title))).map(g => [g.id, g.title]);
const skillOpts = () => list('skills').map(s => [s.id, s.title]);

function taskForm(t = {}) {
  const fields = [
    { k: 'title', label: 'Task', req: true },
    [{ k: 'state', label: 'Workflow state', type: 'select', options: STATES, blank: false, def: 'Not Started' }, { k: 'priority', label: 'Priority', type: 'select', options: PRI, def: 'P2' }],
    [{ k: 'owner', label: 'Owner', type: 'select', options: OWNERS, def: 'Milad' }, { k: 'area', label: 'Strategic area', type: 'select', options: AREAS }],
    [{ k: 'projectId', label: 'Project', type: 'select', options: projOpts }, { k: 'goalId', label: 'Goal', type: 'select', options: goalOpts }],
    { k: 'nextAction', label: 'Next action', type: 'textarea', ph: 'One concrete next step' },
    { k: 'criterion', label: 'Completion criterion', type: 'textarea', ph: 'What must exist for this to count as done?' },
    [{ k: 'due', label: 'Due date', type: 'date' }, { k: 'focusDate', label: 'Top 3 day (Focus Date)', type: 'date' }],
    [{ k: 'scheduled', label: 'Scheduled start', type: 'datetime' }, { k: 'scheduledEnd', label: 'Scheduled end', type: 'datetime' }],
    [{ k: 'schedType', label: 'Schedule type', type: 'select', options: SCHED }, { k: 'estMinutes', label: 'Estimate (minutes)', type: 'number', step: 5 }],
    { k: 'dueAlert', label: 'Show the due date in my phone calendar', type: 'check' },
    { k: 'blockedBy', label: 'Blocked by / waiting on' },
    { k: 'evidence', label: 'Evidence of completion', type: 'textarea', hint: 'Required before a task can be marked Completed.' },
    [{ k: 'completedOn', label: 'Completed on', type: 'date' }, { k: 'docLink', label: 'Document link', type: 'url' }],
    { k: 'notes', label: 'Notes', type: 'textarea' }
  ];
  form(t.id ? 'Edit task' : 'New task', fields, t, v => {
    if (!v.title) return 'Give the task a title.';
    if (/Completed/.test(v.state) && !v.evidence) return 'Add the evidence of completion first. A task is not complete because a document was drafted.';
    if (DONE.has(v.state) && !v.completedOn) v.completedOn = today();
    if (!DONE.has(v.state)) v.completedOn = v.completedOn && /Completed/.test(t.state || '') ? '' : v.completedOn;
    save('tasks', Object.assign({}, t, v));
    toast('Saved');
  }, { onDelete: t.id ? () => { if (confirm('Delete this task? It can be restored from a backup.')) { remove('tasks', t.id); closeSheet(); } } : null });
}
function completeTask(id) {
  const t = get('tasks', id); if (!t) return;
  if (DONE.has(t.state)) { if (confirm('Reopen this task?')) save('tasks', Object.assign({}, t, { state: 'In Progress', completedOn: '' })); return; }
  form('Complete: ' + t.title, [
    { html: t.criterion ? `<div class="card" style="margin-bottom:12px"><div class="small"><b>Completion criterion</b><br>${esc(t.criterion)}</div></div>` : '' },
    { k: 'state', label: 'Result', type: 'select', options: ['Completed & Verified', 'Completed - Not Verified', 'Cancelled'], blank: false, def: 'Completed & Verified' },
    { k: 'evidence', label: 'Evidence of completion', type: 'textarea', ph: 'What exists now, and where? (file, link, result, date)', req: true },
    { k: 'completedOn', label: 'Completed on', type: 'date', def: today() }
  ], { evidence: t.evidence || '', completedOn: today() }, v => {
    if (v.state !== 'Cancelled' && !v.evidence) return 'Record the evidence first.';
    save('tasks', Object.assign({}, t, v)); toast('Marked ' + v.state);
  });
}
function eventForm(e = {}, day) {
  const r = parseRule(e.rrule);
  const rec = Object.assign({ start: day ? day + 'T09:00' + tzOffset() : '', alarm: 15 }, e, { repeat: r.FREQ || '', interval: r.INTERVAL || '', byday: r.BYDAY || '', count: r.COUNT || '', until: r.UNTIL ? `${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}` : '', exlist: (e.exdates || []).map(dayOf).join(', ') });
  const fields = [
    { k: 'title', label: 'Title', req: true },
    { k: 'allDay', label: 'All-day event', type: 'check' },
    [{ k: 'start', label: 'Starts', type: 'datetime' }, { k: 'end', label: 'Ends', type: 'datetime' }],
    [{ k: 'repeat', label: 'Repeats', type: 'select', options: [['DAILY', 'Daily'], ['WEEKLY', 'Weekly'], ['MONTHLY', 'Monthly'], ['YEARLY', 'Yearly']] }, { k: 'interval', label: 'Every (n)', type: 'number' }],
    [{ k: 'byday', label: 'On days (weekly)', ph: 'e.g. TH or SA,TH' }, { k: 'count', label: 'Number of times', type: 'number' }],
    [{ k: 'until', label: 'Repeat until', type: 'date' }, { k: 'alarm', label: 'Reminder', type: 'select', options: [[0, 'None'], [5, '5 min before'], [15, '15 min before'], [30, '30 min before'], [60, '1 hour before'], [1440, '1 day before']], blank: false }],
    { k: 'exlist', label: 'Skip these dates', ph: '2026-12-31, 2027-01-07', hint: 'Comma-separated dates on which a repeating event does not happen.' },
    { k: 'taskId', label: 'Linked task', type: 'select', options: () => list('tasks').filter(isOpen).map(t => [t.id, t.title]) },
    { k: 'notes', label: 'Notes', type: 'textarea' }
  ];
  form(e.id ? 'Edit event' : 'New event', fields, rec, v => {
    if (!v.title || !v.start) return 'Title and start are required.';
    if (v.allDay) { v.start = v.start.slice(0, 10); v.end = v.end ? v.end.slice(0, 10) : ''; }
    let rr = ''; if (v.repeat) { rr = 'FREQ=' + v.repeat; if (v.interval > 1) rr += ';INTERVAL=' + v.interval; if (v.byday && v.repeat === 'WEEKLY') rr += ';BYDAY=' + v.byday.toUpperCase().replace(/[^A-Z,]/g, ''); if (v.count) rr += ';COUNT=' + v.count; if (v.until) rr += ';UNTIL=' + v.until.replace(/-/g, '') + 'T235959Z'; }
    const ex = v.exlist ? v.exlist.split(/[,\s]+/).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)) : [];
    const out = Object.assign({}, e, { title: v.title, allDay: v.allDay, start: v.start, end: v.end, rrule: rr, exdates: ex, alarm: Number(v.alarm) || 0, taskId: v.taskId, notes: v.notes });
    save('events', out); toast('Saved');
  }, { onDelete: e.id ? () => { if (confirm('Delete this event?')) { remove('events', e.id); closeSheet(); } } : null });
}
function simpleForm(c, title, fields, rec) {
  form((rec.id ? 'Edit ' : 'New ') + title, fields, rec, v => { const req = fields.flat().find(f => f.req && !v[f.k]); if (req) return `${req.label} is required.`; save(c, Object.assign({}, rec, v)); toast('Saved'); },
    { onDelete: rec.id ? () => { if (confirm('Delete this ' + title + '?')) { remove(c, rec.id); closeSheet(); } } : null });
}
const FORMS = {
  goal: r => simpleForm('goals', 'goal', [{ k: 'title', label: 'Goal', req: true }, [{ k: 'code', label: 'Code', ph: 'G1' }, { k: 'status', label: 'Status', type: 'select', options: GOAL_STATES }], [{ k: 'area', label: 'Strategic area', type: 'select', options: AREAS }, { k: 'target', label: 'Target date', type: 'date' }], { k: 'success', label: 'Success criteria', type: 'textarea' }, { k: 'notes', label: 'Notes', type: 'textarea' }], r),
  project: r => simpleForm('projects', 'project', [{ k: 'title', label: 'Project', req: true }, [{ k: 'status', label: 'Status', type: 'select', options: PROJECT_STATES }, { k: 'goalId', label: 'Goal', type: 'select', options: goalOpts }], [{ k: 'start', label: 'Start', type: 'date' }, { k: 'target', label: 'Target', type: 'date' }], { k: 'deliverable', label: 'Deliverable', type: 'textarea' }, { k: 'dependencies', label: 'Dependencies', type: 'textarea' }, { k: 'notes', label: 'Notes', type: 'textarea' }], r),
  skill: r => simpleForm('skills', 'skill', [{ k: 'title', label: 'Skill', req: true }, [{ k: 'status', label: 'Status', type: 'select', options: SKILL_STATES }, { k: 'priority', label: 'Priority', type: 'select', options: PRI }], [{ k: 'current', label: 'Current level (0-5)', type: 'number', hint: 'Raise only after a passed practical check.' }, { k: 'target', label: 'Target level', type: 'number' }], [{ k: 'weeklyHours', label: 'Weekly hours', type: 'number', step: 0.1 }, { k: 'category', label: 'Category', type: 'select', options: ['Technical', 'Language', 'Domain', 'Commercial', 'Leadership'] }], { k: 'evidenceNeeded', label: 'Evidence of competence', type: 'textarea' }, { k: 'plan', label: 'Learning plan', type: 'big' }], r),
  session: r => simpleForm('sessions', 'session', [{ k: 'title', label: 'Session', req: true, ph: 'SQL S1: core queries' }, [{ k: 'date', label: 'Date', type: 'date', def: today() }, { k: 'skill', label: 'Skill', type: 'select', options: skillOpts }], [{ k: 'number', label: 'Session no.', type: 'number' }, { k: 'result', label: 'Pass check', type: 'select', options: ['Pass', 'Partial', 'Not yet', 'Not a check'] }], { k: 'done', label: 'What I did', type: 'textarea' }, { k: 'difficulty', label: 'Difficulties / next time', type: 'textarea' }], r),
  ielts: r => simpleForm('ielts', 'IELTS entry', [[{ k: 'date', label: 'Date', type: 'date', def: today(), req: true }, { k: 'skill', label: 'Skill', type: 'select', options: ['Listening', 'Reading', 'Writing Task 1', 'Writing Task 2', 'Speaking', 'Overall'] }], [{ k: 'kind', label: 'Type', type: 'select', options: IELTS_KINDS, blank: false }, { k: 'band', label: 'Band / raw score', ph: 'e.g. 31/40 or 6.5' }], { k: 'assessor', label: 'Assessor / source' }, { k: 'feedback', label: 'Feedback by criterion', type: 'textarea' }, { k: 'actions', label: 'Next actions', type: 'textarea' }], r),
  evidence: r => simpleForm('evidence', 'evidence item', [[{ k: 'code', label: 'ID', ph: 'A1' }, { k: 'status', label: 'Status', type: 'select', options: EVIDENCE_STATES }], { k: 'title', label: 'Document', req: true }, { k: 'why', label: 'Why it is needed', type: 'textarea' }, { k: 'proves', label: 'Exact facts it can prove', type: 'textarea' }, [{ k: 'conflicts', label: 'Related conflicts', ph: 'C1, C2' }, { k: 'priority', label: 'Priority', type: 'select', options: PRI }], { k: 'source', label: 'Likely source / issuer' }, { k: 'recovery', label: 'Recovery action', type: 'textarea' }, { k: 'alternative', label: 'Alternative (proposed, not confirmed accepted)', type: 'textarea' }, [{ k: 'target', label: 'Target date', type: 'date' }, { k: 'location', label: 'Where the file is stored', ph: 'Private vault, not this app' }], { k: 'notes', label: 'Notes', type: 'textarea' }], r),
  decision: r => simpleForm('decisions', 'decision', [{ k: 'title', label: 'Decision', req: true }, [{ k: 'status', label: 'Status', type: 'select', options: DECISION_STATES }, { k: 'date', label: 'Date', type: 'date', def: today() }], { k: 'category', label: 'Category', type: 'select', options: ['Career', 'Migration', 'Learning', 'Finance', 'Tathmeer', 'Personal', 'System'] }, { k: 'decision', label: 'What was decided', type: 'textarea' }, { k: 'evidence', label: 'Evidence used', type: 'textarea' }, { k: 'alternatives', label: 'Alternatives considered', type: 'textarea' }, { k: 'risks', label: 'Risks and assumptions', type: 'textarea' }, [{ k: 'nextAction', label: 'Next action' }, { k: 'review', label: 'Review date', type: 'date' }]], r),
  note: r => simpleForm('notes', 'document', [{ k: 'title', label: 'Title', req: true }, [{ k: 'tags', label: 'Tags', ph: 'CV, career' }, { k: 'pinned', label: 'Pin to top', type: 'check' }], { k: 'body', label: 'Content (Markdown)', type: 'big' }, { k: 'source', label: 'Original source link', type: 'url' }], r),
  logitem: r => simpleForm('logs', 'log', [[{ k: 'date', label: 'Date', type: 'date', req: true }, { k: 'type', label: 'Type', type: 'select', options: ['closeout', 'weekly', 'monthly', 'session', 'note'] }], { k: 'title', label: 'Title' }, { k: 'done', label: 'Done / outcome', type: 'textarea' }, { k: 'blockers', label: 'Blockers', type: 'textarea' }, { k: 'notes', label: 'Notes', type: 'textarea' }], r)
};

function planDay(day, isCloseout) {
  const open = sortTasks(list('tasks').filter(isOpen));
  const chosen = new Set(open.filter(t => t.focusDate === day).map(t => t.id));
  const rows = open.map(t => `<label class="row" style="cursor:pointer"><input type="checkbox" name="pick" value="${esc(t.id)}" ${chosen.has(t.id) ? 'checked' : ''} style="width:22px;height:22px;margin-top:2px"><div class="main"><div class="t" dir="auto">${esc(t.title)}</div><div class="m">${priChip(t.priority)}${stateChip(t.state)}${dueChip(t)}</div></div></label>`).join('');
  const head = isCloseout ? `<div class="f"><label>What got done today</label><textarea name="done" dir="auto" placeholder="Deliverables, not effort"></textarea></div><div class="f"><label>Blockers</label><textarea name="blockers" dir="auto"></textarea></div><div class="small" style="margin-bottom:8px">Choose up to three for <b>${esc(fmtDate(day))}</b>. Keep it achievable.</div>` : `<div class="small" style="margin-bottom:8px">Choose up to three for <b>${esc(fmtDate(day))}</b>.</div>`;
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
function quickAdd() {
  openSheet('Add', `<div class="grid two">${[['new-task', 'Task', I.tasks], ['new-event', 'Event', I.cal], ['new-note', 'Document', I.notes], ['new-decision', 'Decision', I.dec], ['new-evidence', 'Evidence item', I.evid], ['new-session', 'Practice session', I.learn], ['closeout', 'Daily close-out', I.review]].map(([a, l, ic]) => `<button class="card row" data-act="${a}" style="align-items:center;text-align:left"><span style="width:24px;color:var(--brass-ink)">${ic}</span><div class="main"><div class="t">${l}</div></div></button>`).join('')}</div>`, '', { noFocus: true });
}

/* ---------------- events (delegated) ---------------- */
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act, id = a.dataset.id;
  if (act !== 'task' && act !== 'event' && a.tagName !== 'A') e.preventDefault();
  if (act === 'complete') { e.stopPropagation(); e.preventDefault(); return completeTask(id); }
  const map = {
    'sheet-close': () => closeSheet(),
    'form-save': () => sheetCtx && sheetCtx.onSave && sheetCtx.onSave(),
    'form-del': () => sheetCtx && sheetCtx.onDelete && sheetCtx.onDelete(),
    task: () => taskForm(get('tasks', id) || {}),
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
    log: () => FORMS.logitem({ type: a.dataset.type, date: today(), title: (a.dataset.type === 'weekly' ? 'Weekly review ' : 'Monthly review ') + fmtDate(today(), true) }),
    filter: () => { ui.taskFilter = a.dataset.f; saveUi(); if (route().page !== 'tasks') location.hash = '#/tasks'; else render(); },
    'cal-move': () => { const [y, m] = ui.calMonth.split('-').map(Number); const d = new Date(y, m - 1 + Number(a.dataset.d), 1); ui.calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; saveUi(); render(); },
    'cal-today': () => { ui.calMonth = today().slice(0, 7); ui.calSel = today(); saveUi(); render(); },
    'cal-sel': () => { ui.calSel = a.dataset.day; if (a.dataset.day.slice(0, 7) !== ui.calMonth) ui.calMonth = a.dataset.day.slice(0, 7); saveUi(); render(); },
    'plan-day': () => planDay(a.dataset.day || today(), false),
    closeout: () => planDay(addDays(today(), 1), true),
    quick: () => quickAdd(),
    'sync-now': () => { toast('Syncing…'); sync().then(() => toast(syncState === 'ok' ? 'Up to date' : 'Sync failed: ' + lastError)); },
    reload: async () => { if (Object.keys(outbox).length && !confirm('Some changes have not synced yet. Reload anyway? Unsynced changes are kept and sent first.')) return; ls.del(K.rev); await sync(); render(); toast('Reloaded'); },
    export: () => { const blob = new Blob([JSON.stringify({ app: 'milad2031', version: 1, exportedAt: nowIso(), collections: db }, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = `milad2031-backup-${today()}.json`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); },
    ics: async () => { try { const j = await api('icskey'); const url = new URL(`${API}?action=ics&k=${j.key}`, location.href).href; $('#icsbox').innerHTML = `<div class="mono" style="word-break:break-all;margin-bottom:8px">${esc(url)}</div><div class="btns"><button class="btn small" data-act="copy" data-text="${esc(url)}">Copy link</button><a class="btn small" href="${esc(url.replace(/^https?:/, 'webcal:'))}">Subscribe now</a></div><div style="margin-top:8px">iPhone/iPad: tap <b>Subscribe now</b>, or Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar, and paste the link. Keep this link private.</div>`; } catch (err) { toast(err.message === 'offline' ? 'You are offline' : err.message); } },
    copy: async () => { try { await navigator.clipboard.writeText(a.dataset.text); toast('Copied'); } catch { prompt('Copy this link', a.dataset.text); } },
    password: () => form('Change password', [{ k: 'current', label: 'Current password', type: 'password', req: true }, { k: 'next', label: 'New password (10+ characters)', type: 'password', req: true }], {}, v => { api('password', { body: v }).then(j => { ls.set(K.tok, j.token); toast('Password changed. Other devices must sign in again.'); }).catch(err => toast(err.message)); }),
    logout: async () => { if (!confirm('Sign out on this device? Data stays on the server.')) return; if (Object.keys(outbox).length) await sync(); try { await api('logout', { method: 'POST' }); } catch {} ls.del(K.tok); ls.del(K.db); ls.del(K.out); ls.del(K.rev); db = blankDb(); outbox = {}; showAuth(); }
  };
  if (map[act]) { if (act !== 'sheet-close' && act !== 'form-save' && act !== 'form-del' && sheetCtx && ['new-task', 'new-event', 'new-note', 'new-decision', 'new-evidence', 'new-session', 'closeout'].includes(act)) closeSheet(true); map[act](); }
});
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.input; if (k) { ui[k] = e.target.value; saveUi(); clearTimeout(render.t); render.t = setTimeout(render, 180); } });
document.addEventListener('change', e => {
  if (e.target.dataset && e.target.dataset.change === 'import') {
    const file = e.target.files[0]; if (!file) return;
    file.text().then(txt => {
      let j; try { j = JSON.parse(txt); } catch { return toast('Not a valid JSON file'); }
      const cols = j.collections || j; let n = 0, skipped = 0;
      for (const c of COLS) { const src = cols[c]; if (!src) continue; for (const r of Array.isArray(src) ? src : Object.values(src)) { if (!r || !r.id) continue; const cur = db[c][r.id]; if (cur && String(cur.updatedAt) >= String(r.updatedAt || '')) { skipped++; continue; } const rec = Object.assign({ createdAt: nowIso() }, r, { updatedAt: r.updatedAt || nowIso() }); db[c][r.id] = rec; outbox[c + ':' + r.id] = rec; n++; } }
      persist(); render(); queueSync(200); toast(`Imported ${n} records${skipped ? `, kept ${skipped} newer local records` : ''}`);
    });
    e.target.value = '';
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && sheetCtx && sheetCtx.onSave) sheetCtx.onSave(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { sync(); render(); } });
window.addEventListener('online', () => sync());
window.addEventListener('offline', () => setSyncState('off', 'offline'));
setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 45000);

/* ---------------- auth screens ---------------- */
async function showAuth(msg) {
  closeSheet(true);
  let setup = true;
  try { const s = await api('status'); setup = s.setup; } catch (e) { if (e.message === 'offline' && ls.get(K.tok)) return start(); }
  $('#app').innerHTML = `<div class="login"><form class="box" id="authform"><h1>MILAD 2031</h1><p>${setup ? 'Sign in to your personal operating system.' : 'First run: create the owner password for this platform. Use a long password you do not use elsewhere.'}</p>
    <div class="f"><label for="pw">${setup ? 'Password' : 'New password (10+ characters)'}</label><input id="pw" type="password" autocomplete="${setup ? 'current-password' : 'new-password'}" required></div>
    ${setup ? '' : '<div class="f"><label for="pw2">Repeat password</label><input id="pw2" type="password" autocomplete="new-password" required></div>'}
    <div class="err" id="autherr">${esc(msg || '')}</div><button class="btn primary" style="width:100%;justify-content:center" type="submit">${setup ? 'Sign in' : 'Create password and open'}</button></form></div>`;
  $('#authform').addEventListener('submit', async ev => {
    ev.preventDefault(); const pw = $('#pw').value; const err = $('#autherr');
    if (!setup && pw !== $('#pw2').value) { err.textContent = 'The passwords do not match.'; return; }
    err.textContent = '…';
    try { const j = await api(setup ? 'login' : 'setup', { body: { password: pw, device: device() } }); ls.set(K.tok, j.token); ls.del(K.rev); err.textContent = ''; start(); }
    catch (e2) { err.textContent = e2.message === 'offline' ? 'No connection to the server.' : e2.message; }
  });
  setTimeout(() => { const p = $('#pw'); if (p) p.focus(); }, 50);
}
function start() { db = normalise(ls.get(K.db, null)); outbox = ls.get(K.out, {}) || {}; render.keepScroll = false; render(); sync(); }

/* ---------------- boot ---------------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') { navigator.serviceWorker.register('sw.js').catch(() => {}); }
if (ls.get(K.tok)) start(); else showAuth();
})();
