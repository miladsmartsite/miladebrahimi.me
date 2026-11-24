<?php
/* Extracted from ME.Coach v14 api.php for ME Studio. Depends on ME.Coach helpers: read_json, write_json, with_lock, load_store, path, udir, users, cur_user, prefs_of, now_ms, new_id, backup_store, require_access, require_auth, require_owner, body, out, fail. */
/* Paste inside the router switch. */
    /* ----- v9: job autopilot ----- */
    case 'jobs-run':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_access(); out(200, jobs_run() + ['state' => read_json('autopilot.json', [])]);

    case 'jobs-state':
        require_auth(); $k = jobs_keys();
        out(200, ['ok' => true, 'state' => read_json('autopilot.json', new stdClass()), 'cv' => array_map(fn($x) => array_diff_key($x, ['file' => 1]), cv_index()), 'sources' => ['adzuna' => !empty($k['adzunaKey']), 'reed' => !empty($k['reedKey']), 'jooble' => !empty($k['joobleKey']), 'remotive' => true, 'arbeitnow' => true], 'mailFrom' => (string)($k['mailFrom'] ?? ''), 'sentToday' => count(array_filter(read_json('sent.json', []), fn($x) => substr((string)($x['at'] ?? ''), 0, 10) === gmdate('Y-m-d')))]);

    case 'jobs-keys':
        require_owner();
        if ($method === 'POST') { $b = body(); with_lock(function () use ($b) { $s = read_json('system.json', []); $k = is_array($s['jobs'] ?? null) ? $s['jobs'] : [];
            foreach (['adzunaId', 'adzunaKey', 'reedKey', 'joobleKey'] as $f) { $v = trim((string)($b[$f] ?? '')); if ($v === '-') { $k[$f] = ''; } elseif ($v !== '') { $k[$f] = preg_replace('/[^A-Za-z0-9_\-]/', '', $v); } }
            $mf = strtolower(trim((string)($b['mailFrom'] ?? ''))); if ($mf !== '' && filter_var($mf, FILTER_VALIDATE_EMAIL)) { $k['mailFrom'] = $mf; }
            $s['jobs'] = $k; write_json('system.json', $s); }); }
        $k = jobs_keys(); out(200, ['ok' => true, 'has' => ['adzuna' => !empty($k['adzunaKey']), 'reed' => !empty($k['reedKey']), 'jooble' => !empty($k['joobleKey'])], 'mailFrom' => (string)($k['mailFrom'] ?? '')]);

    case 'cv-upload':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_access(); $b = body(); $name = preg_replace('/[^A-Za-z0-9 ._\-]/', '', (string)($b['name'] ?? 'CV.pdf')); $data = base64_decode((string)($b['data'] ?? ''), true);
        if ($data === false || strlen($data) < 200 || strlen($data) > 5 * 1024 * 1024) { fail(400, 'Upload a PDF or Word file up to 5 MB.'); }
        $isPdf = substr($data, 0, 4) === '%PDF'; $isDocx = substr($data, 0, 2) === 'PK' && preg_match('/\.docx$/i', $name);
        if (!$isPdf && !$isDocx) { fail(400, 'Only PDF or .docx files.'); }
        if (!is_dir(udir() . '/cv')) { @mkdir(udir() . '/cv', 0700, true); }
        $id = 'cv' . gmdate('YmdHis') . bin2hex(random_bytes(2)); $fn = $id . ($isPdf ? '.pdf' : '.docx'); file_put_contents(udir() . '/cv/' . $fn, $data);
        with_lock(function () use ($id, $fn, $name, $data, $isPdf) { $l = cv_index(); array_unshift($l, ['id' => $id, 'file' => $fn, 'name' => $name ?: ('CV' . ($isPdf ? '.pdf' : '.docx')), 'type' => $isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'size' => strlen($data), 'at' => gmdate('c')]); write_json('cv.json', array_slice($l, 0, 10)); });
        out(200, ['ok' => true, 'cv' => array_map(fn($x) => array_diff_key($x, ['file' => 1]), cv_index())]);

    case 'cv-get':
        require_auth(); $id = (string)($_GET['id'] ?? ''); foreach (cv_index() as $c) { if ($c['id'] === $id && is_file(udir() . '/cv/' . $c['file'])) { header('Content-Type: ' . $c['type']); header('Content-Disposition: attachment; filename="' . $c['name'] . '"'); header('Cache-Control: private, no-store'); readfile(udir() . '/cv/' . $c['file']); exit; } }
        fail(404, 'Not found');

    case 'jobs-send':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_access(); $b = body(); $id = (string)($b['id'] ?? ''); $to = strtolower(trim((string)($b['to'] ?? '')));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) { fail(400, 'The recipient email is not valid.'); }
        if (empty($b['approved'])) { fail(400, 'Approval is required before sending.'); }
        $sent = read_json('sent.json', []); $day = gmdate('Y-m-d'); if (count(array_filter($sent, fn($x) => substr((string)($x['at'] ?? ''), 0, 10) === $day)) >= 25) { fail(429, 'Daily limit of 25 emails reached. This protects your email reputation.'); }
        $s = load_store(); $a = $s['collections']['applications'][$id] ?? null; if (!is_array($a)) { fail(404, 'Job not found'); }
        foreach ($sent as $x) { if (($x['id'] ?? '') === $id) { fail(409, 'Already sent for this job.'); } }
        $k = jobs_keys(); $host = preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? 'localhost')); $from = (string)($k['mailFrom'] ?? '') ?: 'jobs@' . preg_replace('/^www\./', '', $host);
        $u = cur_user(); $cvs = cv_index(); $cv = null; $want = (string)($b['cv'] ?? ''); foreach ($cvs as $c) { if ($want === '' || $c['id'] === $want) { $cv = $c; break; } }
        $file = $cv && is_file(udir() . '/cv/' . $cv['file']) ? ['name' => $cv['name'], 'type' => $cv['type'], 'data' => file_get_contents(udir() . '/cv/' . $cv['file'])] : null;
        if (!$file && empty($b['noCv'])) { fail(400, 'Upload your CV first.'); }
        $subject = mb_substr(trim((string)($b['subject'] ?? 'Application')), 0, 180); $text = mb_substr((string)($b['body'] ?? ''), 0, 8000);
        $ok = PHP_SAPI === 'cli-server' && defined('MAIL_TEST') ? true : mail_with_file($to, $from, (string)($u['name'] ?? 'Applicant'), (string)($u['email'] ?? $from), $subject, $text, $file);
        if (defined('MAIL_TEST')) { $ok = true; @file_put_contents(DATA_DIR . '/mail-test.log', json_encode(['to' => $to, 'from' => $from, 'subject' => $subject, 'cv' => $file ? $file['name'] : '']) . "\n", FILE_APPEND); }
        if (!$ok) { fail(502, 'The server could not send the email. Check that the sender address exists in Hostinger email.'); }
        with_lock(function () use ($id, $to, $subject, $cv, $day) { $l = read_json('sent.json', []); $l[] = ['id' => $id, 'to' => $to, 'subject' => $subject, 'cv' => $cv['name'] ?? '', 'at' => gmdate('c')]; write_json('sent.json', array_slice($l, -2000));
            $s = load_store(); $a = $s['collections']['applications'][$id] ?? null; if (is_array($a)) { $a['stage'] = 'Applied'; $a['appliedOn'] = $day; $a['sentTo'] = $to; $a['sentAt'] = gmdate('c'); $a['cvSent'] = $cv['name'] ?? ''; $a['followUp'] = gmdate('Y-m-d', time() + 7 * 86400); $a['updatedAt'] = now_ms(); $s['collections']['applications'][$id] = $a; $s['rev'] = (int)$s['rev'] + 1; $s['updatedAt'] = gmdate('c'); write_json('store.json', $s); } });
        out(200, ['ok' => true, 'sentTo' => $to]);

    case 's-job':
        shortcut_auth(); $s = load_store(); $url = trim((string)($_GET['url'] ?? $_POST['url'] ?? '')); $title = shortcut_text();
        if ($url === '' && preg_match('#https?://\S+#', $title, $m)) { $url = $m[0]; $title = trim(str_replace($url, '', $title)); }
        if (!preg_match('#^https?://#', $url)) { plain('Share a job ad link.'); }
        $host = preg_replace('/^www\./', '', (string)parse_url($url, PHP_URL_HOST));
        $role = $title !== '' ? $title : 'Job from ' . $host;
        $now = now_ms(); store_put('applications', ['id' => new_id('app'), 'company' => '', 'role' => mb_substr($role, 0, 200), 'stage' => 'Saved', 'link' => $url, 'source' => $host, 'followUp' => local_day($s, 2), 'createdAt' => $now, 'updatedAt' => $now, 'by' => 'Siri']);
        plain('Saved to Job search: ' . $role);

