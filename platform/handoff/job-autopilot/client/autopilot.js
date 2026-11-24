/* Extracted from ME.Coach v14 assets/app.js for ME Studio. Depends on ME.Coach helpers: list, get, save, prefs, today, addDays, rel, fmtDate, esc, toast, openSheet, closeSheet, form, api, sync, render, route, ui, saveUi, I (icons), header, celebrate, ring. */
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

/* v10: "Write it from my CV and this ad" button in the send sheet */
const _apSendSheetV10 = apSendSheet;
apSendSheet = function (ids) {
  _apSendSheetV10(ids); if (!sheetCtx || ids.length !== 1) return; const box = sheetCtx.el.querySelector('[name=body]'); if (!box) return;
  box.insertAdjacentHTML('beforebegin', '<button type="button" class="btn small" data-act="ai-cover" style="margin-bottom:6px">✨ Write it from my CV and this ad</button>'); sheetCtx.aiJob = ids[0];
};
/* action (merge into the click handler map): */
const aiCoverAct = (a) => ({
    'ai-cover': async () => { const j = sheetCtx && get('applications', sheetCtx.aiJob); if (!j) return; aiBusy(a, true, 'Reading your CV and the ad…'); try { const r = await aiAsk('cover', { role: j.role, company: j.company, location: j.location, desc: j.desc }); const box = sheetCtx && sheetCtx.el.querySelector('[name=body]'); if (box) box.value = r.text; toast('Draft ready · edit before sending'); } catch (e) { toast(e.message); } aiBusy(a, false); },
});
