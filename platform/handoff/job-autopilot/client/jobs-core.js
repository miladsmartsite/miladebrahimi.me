/* Extracted from ME.Coach v14 assets/app.js for ME Studio. Depends on ME.Coach helpers: list, get, save, prefs, today, addDays, rel, fmtDate, esc, toast, openSheet, closeSheet, form, api, sync, render, route, ui, saveUi, I (icons), header, celebrate, ring. */
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
