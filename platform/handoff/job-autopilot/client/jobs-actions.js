/* Extracted from ME.Coach v14 assets/app.js for ME Studio. Depends on ME.Coach helpers: list, get, save, prefs, today, addDays, rel, fmtDate, esc, toast, openSheet, closeSheet, form, api, sync, render, route, ui, saveUi, I (icons), header, celebrate, ring. */
/* Click actions (data-act="…") used by the job screens. */
const jobActs = (a, id) => ({
    'j-tab': () => { ui.jTab = a.dataset.t; saveUi(); if (route().page !== 'jobs') location.hash = '#/jobs'; else render(); },
    'job-bulk': () => { if ($('#sprint')) { ui.sprint = null; sprintDraw(); } jobBulk(); },
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
});
/* Change handlers */
  if (d.change === 'job-tpl') { save('settings', Object.assign({}, prefs(), { id: 'prefs', jobTpl: Object.assign({}, prefs().jobTpl || {}, { [d.k]: e.target.value }) })); toast('Template saved'); return true; }
  if (d.change === 'job-target') { save('settings', Object.assign({}, prefs(), { id: 'prefs', jobTarget: Math.max(1, Math.min(60, Number(e.target.value) || 20)) })); return true; }
