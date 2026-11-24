<?php
/* Extracted from ME.Coach v14 api.php for ME Studio. Depends on ME.Coach helpers: read_json, write_json, with_lock, load_store, path, udir, users, cur_user, prefs_of, now_ms, new_id, backup_store, require_access, require_auth, require_owner, body, out, fail. */
/* ---------- v9: job autopilot (search on a schedule, match, approve, send with the latest CV) ---------- */
function jobs_keys(): array { $s = read_json('system.json', []); return is_array($s['jobs'] ?? null) ? $s['jobs'] : []; }
function http_req(string $url, string $method = 'GET', ?string $body = null, array $hdr = [], string $userpwd = ''): ?string {
    if (!function_exists('curl_init')) { $ctx = stream_context_create(['http' => ['method' => $method, 'timeout' => 15, 'header' => implode("\r\n", $hdr), 'content' => $body ?? '', 'ignore_errors' => true]]); $r = @file_get_contents($url, false, $ctx); return is_string($r) ? $r : null; }
    $c = curl_init($url); $o = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_HTTPHEADER => array_merge(['Accept: application/json', 'User-Agent: ME.Coach job finder'], $hdr), CURLOPT_CUSTOMREQUEST => $method];
    if ($body !== null) { $o[CURLOPT_POSTFIELDS] = $body; } if ($userpwd !== '') { $o[CURLOPT_USERPWD] = $userpwd; }
    curl_setopt_array($c, $o); $r = curl_exec($c); $code = (int)curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c);
    return ($code >= 200 && $code < 300 && is_string($r)) ? $r : null;
}
function jtxt($s, int $n = 4000): string { $s = html_entity_decode(strip_tags(str_replace(['<br>', '<br/>', '<br />', '</p>', '</li>'], "\n", (string)$s)), ENT_QUOTES | ENT_HTML5, 'UTF-8'); return mb_substr(trim(preg_replace("/[ \t]+/", ' ', preg_replace("/\n{3,}/", "\n\n", $s))), 0, $n); }
function job_email(string $t): string { if (preg_match('/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/', $t, $m)) { $e = strtolower($m[0]); if (!preg_match('/^(no-?reply|donotreply)@/', $e)) { return $e; } } return ''; }
/** search every enabled source for one user's settings; returns normalised jobs */
function jobs_search(array $ap): array {
    $keys = jobs_keys(); $out = []; $titles = array_slice(array_values(array_filter(array_map('strval', $ap['titles'] ?? []))), 0, 5);
    $countries = array_values(array_filter(array_map('strval', $ap['countries'] ?? ['gb'])));
    $add = function (array $j) use (&$out) { if (($j['link'] ?? '') === '' || ($j['role'] ?? '') === '') { return; } $j['ext'] = $j['ext'] ?? md5($j['link']); $out[$j['ext']] = $j; };
    $where = ['gb' => 'United Kingdom', 'ie' => 'Ireland', 'nz' => 'New Zealand'];
    foreach ($titles as $q) {
        foreach ($countries as $cc) {
            if ($cc === 'remote') { continue; }
            if (!empty($keys['adzunaId']) && !empty($keys['adzunaKey']) && in_array($cc, ['gb', 'nz', 'au', 'ca', 'us', 'de', 'nl', 'fr', 'sg'], true)) {
                $r = http_req('https://api.adzuna.com/v1/api/jobs/' . $cc . '/search/1?' . http_build_query(['app_id' => $keys['adzunaId'], 'app_key' => $keys['adzunaKey'], 'results_per_page' => 30, 'what' => $q, 'max_days_old' => 7, 'content-type' => 'application/json']));
                $j = $r ? json_decode($r, true) : null; foreach (($j['results'] ?? []) as $x) { $d = jtxt($x['description'] ?? ''); $add(['ext' => 'az:' . ($x['id'] ?? md5((string)($x['redirect_url'] ?? ''))), 'role' => jtxt($x['title'] ?? '', 200), 'company' => jtxt($x['company']['display_name'] ?? '', 120), 'location' => jtxt($x['location']['display_name'] ?? '', 120), 'link' => (string)($x['redirect_url'] ?? ''), 'desc' => $d, 'source' => 'Adzuna', 'country' => $cc, 'posted' => substr((string)($x['created'] ?? ''), 0, 10), 'salary' => isset($x['salary_min']) ? (string)round($x['salary_min']) . (isset($x['salary_max']) ? '–' . round($x['salary_max']) : '') : '', 'contactEmail' => job_email($d)]); }
            }
            if ($cc === 'gb' && !empty($keys['reedKey'])) {
                $r = http_req('https://www.reed.co.uk/api/1.0/search?' . http_build_query(['keywords' => $q, 'resultsToTake' => 30]), 'GET', null, [], $keys['reedKey'] . ':');
                $j = $r ? json_decode($r, true) : null; foreach (($j['results'] ?? []) as $x) { $d = jtxt($x['jobDescription'] ?? ''); $add(['ext' => 'reed:' . ($x['jobId'] ?? ''), 'role' => jtxt($x['jobTitle'] ?? '', 200), 'company' => jtxt($x['employerName'] ?? '', 120), 'location' => jtxt($x['locationName'] ?? '', 120), 'link' => (string)($x['jobUrl'] ?? ''), 'desc' => $d, 'source' => 'Reed', 'country' => 'gb', 'posted' => '', 'salary' => isset($x['minimumSalary']) ? (string)$x['minimumSalary'] . (isset($x['maximumSalary']) ? '–' . $x['maximumSalary'] : '') : '', 'contactEmail' => job_email($d)]); }
            }
            if (!empty($keys['joobleKey'])) {
                $r = http_req('https://jooble.org/api/' . rawurlencode($keys['joobleKey']), 'POST', json_encode(['keywords' => $q, 'location' => $where[$cc] ?? $cc]), ['Content-Type: application/json']);
                $j = $r ? json_decode($r, true) : null; foreach (array_slice($j['jobs'] ?? [], 0, 30) as $x) { $d = jtxt($x['snippet'] ?? ''); $add(['ext' => 'jb:' . ($x['id'] ?? md5((string)($x['link'] ?? ''))), 'role' => jtxt($x['title'] ?? '', 200), 'company' => jtxt($x['company'] ?? '', 120), 'location' => jtxt($x['location'] ?? '', 120), 'link' => (string)($x['link'] ?? ''), 'desc' => $d, 'source' => 'Jooble', 'country' => $cc, 'posted' => substr((string)($x['updated'] ?? ''), 0, 10), 'salary' => jtxt($x['salary'] ?? '', 60), 'contactEmail' => job_email($d)]); }
            }
        }
        if (in_array('remote', $countries, true) || !empty($ap['remote'])) {
            $r = http_req('https://remotive.com/api/remote-jobs?' . http_build_query(['search' => $q, 'limit' => 30]));
            $j = $r ? json_decode($r, true) : null; foreach (($j['jobs'] ?? []) as $x) { $d = jtxt($x['description'] ?? ''); $add(['ext' => 'rm:' . ($x['id'] ?? ''), 'role' => jtxt($x['title'] ?? '', 200), 'company' => jtxt($x['company_name'] ?? '', 120), 'location' => 'Remote · ' . jtxt($x['candidate_required_location'] ?? '', 80), 'link' => (string)($x['url'] ?? ''), 'desc' => $d, 'source' => 'Remotive', 'country' => 'remote', 'posted' => substr((string)($x['publication_date'] ?? ''), 0, 10), 'salary' => jtxt($x['salary'] ?? '', 60), 'contactEmail' => job_email($d)]); }
        }
    }
    if (!empty($ap['arbeitnow'])) {
        $r = http_req('https://www.arbeitnow.com/api/job-board-api'); $j = $r ? json_decode($r, true) : null;
        foreach (($j['data'] ?? []) as $x) { $t = (string)($x['title'] ?? ''); $hit = false; foreach ($titles as $q) { if (stripos($t, $q) !== false) { $hit = true; } } if (!$hit) { continue; } $d = jtxt($x['description'] ?? ''); $add(['ext' => 'an:' . ($x['slug'] ?? md5((string)($x['url'] ?? ''))), 'role' => jtxt($t, 200), 'company' => jtxt($x['company_name'] ?? '', 120), 'location' => jtxt($x['location'] ?? '', 120) . (!empty($x['remote']) ? ' · Remote' : ''), 'link' => (string)($x['url'] ?? ''), 'desc' => $d, 'source' => 'Arbeitnow', 'country' => 'eu', 'posted' => '', 'salary' => '', 'contactEmail' => job_email($d)]); }
    }
    return array_values($out);
}
function job_match(array $j, array $ap): int {
    $t = mb_strtolower($j['role'] ?? ''); $d = mb_strtolower(($j['desc'] ?? '') . ' ' . $t); $s = 0;
    foreach (($ap['titles'] ?? []) as $q) { $q = mb_strtolower(trim((string)$q)); if ($q === '') { continue; } if (str_contains($t, $q)) { $s = max($s, 55); } else { $w = array_filter(preg_split('/\s+/', $q)); $hit = count(array_filter($w, fn($x) => str_contains($t, $x))); if ($w) { $s = max($s, (int)round(40 * $hit / count($w))); } } }
    $kw = array_filter(array_map(fn($x) => mb_strtolower(trim((string)$x)), $ap['skills'] ?? [])); if ($kw) { $hit = count(array_filter($kw, fn($x) => str_contains($d, $x))); $s += (int)round(35 * min(1, $hit / max(1, min(6, count($kw))))); }
    if (in_array($j['country'] ?? '', $ap['countries'] ?? [], true)) { $s += 10; }
    if (($j['contactEmail'] ?? '') !== '') { $s += 5; }
    foreach (($ap['exclude'] ?? []) as $x) { $x = mb_strtolower(trim((string)$x)); if ($x !== '' && str_contains($t, $x)) { return 0; } }
    if (preg_match('/\b(senior director|vp|vice president|chief)\b/', $t)) { $s -= 15; }
    return max(0, min(100, $s));
}
/** run the search for the current user and add new matches to the review queue (stage "Found") */
function jobs_run(): array {
    $s = load_store(); $ap = prefs_of($s)['autopilot'] ?? []; if (!is_array($ap) || empty($ap['titles'])) { return ['ok' => false, 'error' => 'Add at least one job title in Autopilot settings.']; }
    $have = []; foreach ($s['collections']['applications'] as $a) { if (is_array($a)) { if (!empty($a['ext'])) { $have[$a['ext']] = 1; } if (!empty($a['link'])) { $have[md5((string)$a['link'])] = 1; } } }
    $jobs = jobs_search($ap); $min = (int)($ap['minScore'] ?? 40); $new = [];
    foreach ($jobs as $j) { if (isset($have[$j['ext']]) || isset($have[md5($j['link'])])) { continue; } $m = job_match($j, $ap); if ($m < $min) { continue; } $j['match'] = $m; $new[] = $j; }
    usort($new, fn($a, $b) => $b['match'] <=> $a['match']); $new = array_slice($new, 0, (int)($ap['maxPerRun'] ?? 30));
    if ($new) { with_lock(function () use ($new) { $s = load_store(); backup_store(); $now = now_ms(); foreach ($new as $j) { $id = new_id('job'); $s['collections']['applications'][$id] = $j + ['id' => $id, 'stage' => 'Found', 'foundOn' => gmdate('Y-m-d'), 'createdAt' => $now, 'updatedAt' => $now, 'by' => 'Autopilot']; } $s['rev'] = (int)$s['rev'] + 1; $s['updatedAt'] = gmdate('c'); write_json('store.json', $s); }); }
    write_json('autopilot.json', ['last' => gmdate('c'), 'found' => count($jobs), 'added' => count($new)]);
    return ['ok' => true, 'searched' => count($jobs), 'added' => count($new), 'sources' => array_values(array_filter([!empty(jobs_keys()['adzunaKey']) ? 'Adzuna' : '', !empty(jobs_keys()['reedKey']) ? 'Reed' : '', !empty(jobs_keys()['joobleKey']) ? 'Jooble' : '', 'Remotive', !empty($ap['arbeitnow']) ? 'Arbeitnow' : '']))];
}
function cv_index(): array { $l = read_json('cv.json', []); return is_array($l) ? $l : []; }
function mail_with_file(string $to, string $from, string $fromName, string $replyTo, string $subject, string $text, ?array $file): bool {
    $b = 'mec' . bin2hex(random_bytes(8)); $enc = fn($s) => '=?UTF-8?B?' . base64_encode($s) . '?=';
    $h = ['MIME-Version: 1.0', 'From: ' . $enc($fromName) . ' <' . $from . '>', 'Reply-To: ' . $replyTo, 'X-Mailer: ME.Coach', 'Content-Type: multipart/mixed; boundary="' . $b . '"'];
    $body = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text)) . "\r\n";
    if ($file) { $body .= "--$b\r\nContent-Type: " . $file['type'] . '; name="' . $file['name'] . "\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"" . $file['name'] . "\"\r\n\r\n" . chunk_split(base64_encode($file['data'])) . "\r\n"; }
    $body .= "--$b--";
    return @mail($to, $enc($subject), $body, implode("\r\n", $h), '-f' . $from);
}

