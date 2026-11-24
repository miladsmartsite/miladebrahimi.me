<?php
/**
 * ME.Coach — data API (single file, no database server, no third-party service).
 * Storage: JSON files in DATA_DIR (default ./data, protected by .htaccess); one folder per user in data/u/<id>.
 * Auth: email + password (bcrypt) or passkey -> random bearer tokens (stored hashed). 7-day free trial, then subscription.
 * Sync: record-level merge, newest updatedAt wins; deletes are soft (deleted:true).
 */
declare(strict_types=1);

const APP_VERSION = '15.0.0';
const TRIAL_DAYS = 7;
const GLOBAL_FILES = ['users.json', 'tokens.json', 'attempts.json', 'keys.json', 'system.json', '.lock', 'webauthn-chal.json', 'requests.json', 'bookings.json', 'coach-notes.json'];
/* Plans shown in the app. Keep the prices in sync with the public pages (platform/tools/build_coach_site.py). */
const PLANS = [
    'monthly' => ['name' => 'Pro Monthly', 'omr' => '2.900', 'usd' => '7.99', 'per' => 'month', 'days' => 31],
    'yearly' => ['name' => 'Pro Yearly', 'omr' => '24.000', 'usd' => '59', 'per' => 'year', 'days' => 366],
    'coach' => ['name' => 'Coaching', 'omr' => '25.000', 'usd' => '65', 'per' => 'month', 'days' => 31],
];
const TOKEN_DAYS = 180;
const MAX_BODY = 8 * 1024 * 1024;          // 8 MB per request
const BACKUPS_KEEP = 30;                   // daily snapshots kept
const COLLECTIONS = ['tasks','events','projects','goals','skills','logs','evidence','decisions','notes','ielts','sessions','settings','milestones','applications','immigration','habits','money','templates','courses','areas','wheel','cycles','focus','products','tests','careers'];
const HISTORY_KEEP = 15;
const DONE_STATES = ['Done', 'Cancelled', 'Completed & Verified', 'Completed - Not Verified'];

if (is_file(__DIR__ . '/config.local.php')) { require __DIR__ . '/config.local.php'; }
if (!defined('DATA_DIR')) { define('DATA_DIR', __DIR__ . '/data'); }

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');

function out(int $code, $payload): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(int $code, string $msg): void { out($code, ['ok' => false, 'error' => $msg]); }
const COOKIE = 'mec_t';
function is_https(): bool { return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') || (($_SERVER['SERVER_PORT'] ?? '') == 443); }
function cookie_path(): string { $d = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/'); return $d === '' ? '/' : $d . '/'; }
function set_auth_cookie(string $tok, int $days): void {
    setcookie(COOKIE, $tok, ['expires' => $tok === '' ? time() - 3600 : time() + $days * 86400, 'path' => cookie_path(), 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict']);
}

function ensure_dir(): void {
    if (!is_dir(DATA_DIR) && !@mkdir(DATA_DIR, 0750, true)) { fail(500, 'Cannot create data folder'); }
    $ht = DATA_DIR . '/.htaccess';
    if (!is_file($ht)) { @file_put_contents($ht, "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n"); }
    $ix = DATA_DIR . '/index.html';
    if (!is_file($ix)) { @file_put_contents($ix, ''); }
    if (!is_dir(DATA_DIR . '/u')) { @mkdir(DATA_DIR . '/u', 0750, true); }
}
function udir(): string { return DATA_DIR . '/u/' . $GLOBALS['UID']; }
function path(string $name): string { return (!empty($GLOBALS['UID']) && !in_array($name, GLOBAL_FILES, true)) ? udir() . '/' . $name : DATA_DIR . '/' . $name; }
function use_user(string $uid): void {
    if (!preg_match('/^[a-z0-9]{8,40}$/', $uid)) { fail(400, 'Bad user'); }
    $GLOBALS['UID'] = $uid; $d = udir(); if (!is_dir($d . '/backups')) { @mkdir($d . '/backups', 0750, true); }
}
/* ---------- users and access ---------- */
function users(): array { return read_json('users.json', []); }
function cur_user(): array { return users()[$GLOBALS['UID'] ?? ''] ?? []; }
function has_access(array $u): bool { if (($u['role'] ?? '') === 'owner') { return true; } $n = time(); return (int)($u['paidUntil'] ?? 0) > $n || (int)($u['trialEnds'] ?? 0) > $n; }
function user_public(array $u, string $uid): array {
    $n = time(); $plan = ($u['role'] ?? '') === 'owner' ? 'owner' : ((int)($u['paidUntil'] ?? 0) > $n ? 'active' : ((int)($u['trialEnds'] ?? 0) > $n ? 'trial' : 'expired'));
    return ['id' => $uid, 'email' => $u['email'] ?? '', 'name' => $u['name'] ?? '', 'role' => $u['role'] ?? 'user', 'plan' => $plan, 'access' => has_access($u), 'trialEnds' => !empty($u['trialEnds']) ? gmdate('c', (int)$u['trialEnds']) : null, 'paidUntil' => !empty($u['paidUntil']) ? gmdate('c', (int)$u['paidUntil']) : null, 'created' => $u['created'] ?? null, 'planName' => $u['planName'] ?? '', 'google' => !empty($u['google'])];
}
function keys_map(): array { return read_json('keys.json', ['ics' => [], 'short' => [], 'wa' => []]); }
function key_set(string $kind, string $key, string $uid, ?string $old = null): void {
    with_lock(function () use ($kind, $key, $uid, $old) { $k = keys_map(); if ($old) { unset($k[$kind][$old]); } if ($key !== '') { $k[$kind][$key] = $uid; } write_json('keys.json', $k); });
}
function require_owner(): void { require_auth(); if ((cur_user()['role'] ?? '') !== 'owner') { fail(403, 'Owner only'); } }
function require_access(): void { require_auth(); if (!has_access(cur_user())) { fail(402, 'Your free week has ended. Subscribe to keep adding and editing.'); } }

/** Read JSON with a shared lock. */
function read_json(string $name, $default) {
    $p = path($name);
    if (!is_file($p)) { return $default; }
    $fh = fopen($p, 'rb'); if (!$fh) { return $default; }
    flock($fh, LOCK_SH); $raw = stream_get_contents($fh); flock($fh, LOCK_UN); fclose($fh);
    $v = json_decode((string)$raw, true);
    return is_array($v) ? $v : $default;
}
/** Atomic write: temp file + rename, under an exclusive lock file. */
function write_json(string $name, $data): void {
    $p = path($name); $tmp = $p . '.tmp' . bin2hex(random_bytes(4));
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false) { fail(500, 'Write failed'); }
    if (!rename($tmp, $p)) { @unlink($tmp); fail(500, 'Write failed'); }
}
function with_lock(callable $fn) {
    $lf = fopen(path('.lock'), 'c'); if (!$lf) { fail(500, 'Lock failed'); }
    flock($lf, LOCK_EX);
    try { return $fn(); } finally { flock($lf, LOCK_UN); fclose($lf); }
}

function body(): array {
    $len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > MAX_BODY) { fail(413, 'Request too large'); }
    $raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
    if ($raw === false || $raw === '') { return []; }
    $v = json_decode($raw, true);
    if (!is_array($v)) { fail(400, 'Invalid JSON'); }
    return $v;
}

function config(): array { return read_json('config.json', []); }
function is_setup(): bool { return count(users()) > 0; }

/* ---------- rate limiting for password attempts ---------- */
function throttle_check(): void {
    $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'x');
    $a = read_json('attempts.json', []);
    $now = time(); $rec = $a[$ip] ?? ['n' => 0, 't' => $now];
    if ($now - $rec['t'] > 900) { $rec = ['n' => 0, 't' => $now]; }
    if ($rec['n'] >= 8) { fail(429, 'Too many attempts. Try again in 15 minutes.'); }
}
function throttle_hit(bool $ok): void {
    $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'x');
    with_lock(function () use ($ip, $ok) {
        $a = read_json('attempts.json', []); $now = time();
        if ($ok) { unset($a[$ip]); }
        else { $rec = $a[$ip] ?? ['n' => 0, 't' => $now]; if ($now - $rec['t'] > 900) { $rec = ['n' => 0, 't' => $now]; } $rec['n']++; $a[$ip] = $rec; }
        foreach ($a as $k => $r) { if ($now - ($r['t'] ?? 0) > 3600) { unset($a[$k]); } }
        write_json('attempts.json', $a);
    });
}

/* ---------- tokens ---------- */
function issue_token(string $device, string $uid = ''): string {
    if ($uid === '') { $uid = (string)($GLOBALS['UID'] ?? ''); }
    $tok = bin2hex(random_bytes(32));
    set_auth_cookie($tok, TOKEN_DAYS);
    with_lock(function () use ($tok, $device, $uid) {
        $t = read_json('tokens.json', []); $now = time();
        $t = array_filter($t, fn($r) => ($r['exp'] ?? 0) > $now);
        $t[hash('sha256', $tok)] = ['exp' => $now + TOKEN_DAYS * 86400, 'uid' => $uid, 'device' => mb_substr($device, 0, 60), 'created' => gmdate('c')];
        write_json('tokens.json', $t);
    });
    return $tok;
}
function bearer(): string {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ($h === '' && function_exists('getallheaders')) { foreach (getallheaders() as $k => $v) { if (strtolower($k) === 'authorization') { $h = $v; } } }
    if ($h === '' || !preg_match('/Bearer\s+[a-f0-9]{64}/i', $h)) { $x = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? ''; $h = 'Bearer ' . ($x !== '' ? $x : ($_COOKIE[COOKIE] ?? '')); }
    return preg_match('/Bearer\s+([a-f0-9]{64})/i', $h, $m) ? strtolower($m[1]) : '';
}
function token_uid(string $tok): string {
    if ($tok === '') { return ''; }
    $t = read_json('tokens.json', []); $r = $t[hash('sha256', $tok)] ?? null;
    return $r && ($r['exp'] ?? 0) >= time() && !empty($r['uid']) && isset(users()[$r['uid']]) ? (string)$r['uid'] : '';
}
function token_valid(string $tok): bool { return token_uid($tok) !== ''; }
function require_auth(): string {
    $tok = bearer(); if ($tok === '') { fail(401, 'Not signed in'); }
    $uid = token_uid($tok); if ($uid === '') { fail(401, 'Session expired'); }
    use_user($uid);
    return hash('sha256', $tok);
}

/* ---------- store ---------- */
function empty_store(): array {
    $c = []; foreach (COLLECTIONS as $n) { $c[$n] = new stdClass(); }
    return ['schema' => 1, 'rev' => 0, 'updatedAt' => null, 'collections' => $c];
}
function load_store(): array {
    $s = read_json('store.json', null);
    if (!is_array($s)) { $s = empty_store(); }
    foreach (COLLECTIONS as $n) { if (!isset($s['collections'][$n]) || !is_array($s['collections'][$n])) { $s['collections'][$n] = []; } }
    return $s;
}
function save_history(): void {
    if (empty($GLOBALS['HIST'])) { return; }
    $h = read_json('history.json', []);
    foreach ($GLOBALS['HIST'] as $k => $vers) { foreach ($vers as $v) { $h[$k][] = $v; } $h[$k] = array_slice($h[$k], -HISTORY_KEEP); }
    write_json('history.json', $h); $GLOBALS['HIST'] = [];
}
function backup_store(): void {
    $src = path('store.json'); if (!is_file($src)) { return; }
    $dst = path('backups/store-' . gmdate('Ymd') . '.json');
    if (!is_file($dst)) { @copy($src, $dst); }
    $files = glob(path('backups/store-*.json')) ?: []; sort($files);
    while (count($files) > BACKUPS_KEEP) { @unlink(array_shift($files)); }
}
function valid_id($id): bool { return is_string($id) && preg_match('/^[A-Za-z0-9_\-:.]{1,80}$/', $id) === 1; }

/** Merge client changes; newest updatedAt wins; returns number applied. */
function merge_changes(array &$store, array $changes): int {
    $applied = 0;
    foreach ($changes as $ch) {
        $c = $ch['c'] ?? ''; $r = $ch['r'] ?? null;
        if (!in_array($c, COLLECTIONS, true) || !is_array($r) || !valid_id($r['id'] ?? null)) { continue; }
        $id = $r['id']; $cur = $store['collections'][$c][$id] ?? null;
        $newTs = (string)($r['updatedAt'] ?? ''); $curTs = is_array($cur) ? (string)($cur['updatedAt'] ?? '') : '';
        if ($cur === null || strcmp($newTs, $curTs) > 0) { if (is_array($cur)) { $GLOBALS['HIST'][$c . ':' . $id][] = $cur; } $store['collections'][$c][$id] = $r; $applied++; }
    }
    return $applied;
}

/* ---------- iCalendar feed (for iPhone/iPad Calendar subscription with alarms) ---------- */
function ics_escape(string $s): string { return addcslashes(str_replace(["\r\n", "\n", "\r"], '\\n', $s), ",;\\"); }
function ics_dt(string $iso, bool $allDay): string {
    $iso = trim($iso);
    if ($allDay || strlen($iso) === 10) { return ';VALUE=DATE:' . str_replace('-', '', substr($iso, 0, 10)); }
    $d = date_create($iso); if (!$d) { return ';VALUE=DATE:' . str_replace('-', '', substr($iso, 0, 10)); }
    $d->setTimezone(new DateTimeZone('UTC'));
    return ':' . $d->format('Ymd\THis\Z');
}
function ics_feed(array $store): string {
    $L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ME.Coach//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:ME.Coach", "X-WR-TIMEZONE:Asia/Muscat"];
    $stamp = gmdate('Ymd\THis\Z');
    $add = function (string $uid, string $title, string $start, ?string $end, bool $allDay, string $desc, ?string $rrule, array $ex, int $alarm) use (&$L, $stamp) {
        $L[] = 'BEGIN:VEVENT'; $L[] = 'UID:' . $uid . '-' . ($GLOBALS['UID'] ?? '') . '@me.coach'; $L[] = 'DTSTAMP:' . $stamp;
        $L[] = 'DTSTART' . ics_dt($start, $allDay);
        if ($end) { $L[] = 'DTEND' . ics_dt($end, $allDay); }
        elseif ($allDay) { $d = date_create(substr($start, 0, 10)); if ($d) { $d->modify('+1 day'); $L[] = 'DTEND;VALUE=DATE:' . $d->format('Ymd'); } }
        $L[] = 'SUMMARY:' . ics_escape($title);
        if ($desc !== '') { $L[] = 'DESCRIPTION:' . ics_escape(mb_substr($desc, 0, 900)); }
        if ($rrule) { $L[] = 'RRULE:' . preg_replace('/[^A-Z0-9=;,:\-]/', '', strtoupper($rrule)); }
        foreach ($ex as $x) { $L[] = 'EXDATE' . ics_dt($x, $allDay); }
        if ($alarm > 0) { $L[] = 'BEGIN:VALARM'; $L[] = 'ACTION:DISPLAY'; $L[] = 'DESCRIPTION:' . ics_escape($title); $L[] = 'TRIGGER:-PT' . $alarm . 'M'; $L[] = 'END:VALARM'; }
        $L[] = 'END:VEVENT';
    };
    foreach ($store['collections']['events'] as $e) {
        if (!is_array($e) || !empty($e['deleted']) || empty($e['start'])) { continue; }
        $add('ev-' . $e['id'], (string)($e['title'] ?? 'Event'), (string)$e['start'], $e['end'] ?? null, !empty($e['allDay']), (string)($e['notes'] ?? ''), $e['rrule'] ?? null, (array)($e['exdates'] ?? []), (int)($e['alarm'] ?? 15));
    }
    foreach ($store['collections']['tasks'] as $t) {
        if (!is_array($t) || !empty($t['deleted'])) { continue; }
        $state = (string)($t['state'] ?? '');
        if (in_array($state, DONE_STATES, true)) { continue; }
        if (!empty($t['scheduled'])) {
            $add('ts-' . $t['id'], (string)($t['title'] ?? 'Task'), (string)$t['scheduled'], $t['scheduledEnd'] ?? null, strlen((string)$t['scheduled']) === 10, 'Next action: ' . (string)($t['nextAction'] ?? ''), null, [], 15);
        }
        if (!empty($t['due']) && !empty($t['dueAlert'])) {
            $add('td-' . $t['id'], 'DUE: ' . (string)($t['title'] ?? 'Task'), (string)$t['due'], null, true, (string)($t['nextAction'] ?? ''), null, [], 0);
        }
    }
    $tops = [];
    foreach ($store['collections']['tasks'] as $t) {
        if (!is_array($t) || !empty($t['deleted']) || empty($t['focusDate']) || in_array((string)($t['state'] ?? ''), DONE_STATES, true)) { continue; }
        if ($t['focusDate'] < gmdate('Y-m-d', time() - 86400 * 2)) { continue; }
        $tops[$t['focusDate']][] = (string)($t['title'] ?? '');
    }
    foreach ($tops as $day => $titles) { $add('top3-' . $day, '★ ' . implode(' · ', array_slice($titles, 0, 3)), $day, null, true, "Top 3 for today:\n" . implode("\n", $titles), null, [], 0); }
    foreach ($store['collections']['applications'] ?? [] as $ap) {
        if (!is_array($ap) || !empty($ap['deleted']) || empty($ap['followUp'])) { continue; }
        if (!in_array((string)($ap['stage'] ?? 'Saved'), ['Saved', 'Applied', 'Screening', 'Interview', 'Offer'], true)) { continue; }
        $add('fu-' . $ap['id'], 'Follow up: ' . trim((string)($ap['role'] ?? '') . ' · ' . (string)($ap['company'] ?? ''), ' ·'), (string)$ap['followUp'], null, true, (string)($ap['notes'] ?? ''), null, [], 0);
    }
    $L[] = 'END:VCALENDAR';
    $out = '';
    foreach ($L as $line) { // fold at 74 octets
        while (strlen($line) > 74) { $cut = 74; while ($cut > 1 && (ord($line[$cut]) & 0xC0) === 0x80) { $cut--; } $out .= substr($line, 0, $cut) . "\r\n "; $line = substr($line, $cut); }
        $out .= $line . "\r\n";
    }
    return $out;
}

/* ---------- Web Push (RFC 8030 / 8291 / 8292), no third-party library ---------- */
function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64u_dec(string $s): string { $r = base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true); return $r === false ? '' : $r; }
function ec_new(): array {
    $k = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if (!$k) { throw new RuntimeException('EC key generation failed'); }
    $d = openssl_pkey_get_details($k); openssl_pkey_export($k, $pem);
    $raw = "\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT);
    return [$k, $pem, $raw];
}
function ec_pub_pem(string $raw): string {
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $raw;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
}
function der_to_raw(string $der): string {
    $o = 2; if (ord($der[1]) & 0x80) { $o += ord($der[1]) & 0x7f; }
    $lr = ord($der[$o + 1]); $r = substr($der, $o + 2, $lr); $o += 2 + $lr;
    $ls = ord($der[$o + 1]); $s = substr($der, $o + 2, $ls);
    $fix = fn($x) => str_pad(ltrim($x, "\0"), 32, "\0", STR_PAD_LEFT);
    return $fix($r) . $fix($s);
}
function push_state(): array { return read_json('push.json', ['subs' => []]); }
function system_state(): array {
    $s = read_json('system.json', []);
    if (empty($s['vapid']['pem']) || empty($s['cronKey'])) {
        $s = with_lock(function () {
            $s = read_json('system.json', []);
            if (empty($s['vapid']['pem'])) { [, $pem, $raw] = ec_new(); $s['vapid'] = ['pem' => $pem, 'pub' => b64u($raw)]; }
            if (empty($s['cronKey'])) { $s['cronKey'] = bin2hex(random_bytes(20)); }
            write_json('system.json', $s); return $s;
        });
    }
    return $s;
}
function push_keys(): array { $s = system_state(); return $s + ['subs' => push_state()['subs'] ?? []]; }
function push_encrypt(string $payload, string $uaPubB64, string $authB64): string {
    $uaPub = b64u_dec($uaPubB64); $auth = b64u_dec($authB64);
    if (strlen($uaPub) !== 65 || strlen($auth) < 16) { throw new RuntimeException('Bad subscription keys'); }
    [$eph, , $asPub] = ec_new();
    $peer = openssl_pkey_get_public(ec_pub_pem($uaPub));
    $secret = openssl_pkey_derive($peer, $eph, 32);
    if ($secret === false) { throw new RuntimeException('ECDH failed'); }
    $ikm = hash_hkdf('sha256', $secret, 32, "WebPush: info\0" . $uaPub . $asPub, $auth);
    $salt = random_bytes(16);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);
    $tag = '';
    $ct = openssl_encrypt($payload . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    return $salt . pack('N', 4096) . chr(65) . $asPub . $ct . $tag;
}
function push_jwt(string $endpoint, array $keys, string $subject): string {
    $u = parse_url($endpoint); $aud = $u['scheme'] . '://' . $u['host'] . (isset($u['port']) ? ':' . $u['port'] : '');
    $in = b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256'])) . '.' . b64u(json_encode(['aud' => $aud, 'exp' => time() + 12 * 3600, 'sub' => $subject], JSON_UNESCAPED_SLASHES));
    openssl_sign($in, $der, $keys['vapid']['pem'], OPENSSL_ALGO_SHA256);
    return $in . '.' . b64u(der_to_raw($der));
}
function push_send(array $sub, array $msg, array $keys, string $subject): int {
    $ep = (string)($sub['endpoint'] ?? '');
    if (!preg_match('#^https://#', $ep)) { return 0; }
    $body = push_encrypt(json_encode($msg, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), (string)($sub['keys']['p256dh'] ?? ''), (string)($sub['keys']['auth'] ?? ''));
    $hdr = ['TTL: 43200', 'Urgency: normal', 'Content-Type: application/octet-stream', 'Content-Encoding: aes128gcm', 'Authorization: vapid t=' . push_jwt($ep, $keys, $subject) . ', k=' . $keys['vapid']['pub']];
    $ch = curl_init($ep);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $hdr, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
    curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return $code;
}
function local_now(string $tz): DateTime { try { return new DateTime('now', new DateTimeZone($tz ?: 'UTC')); } catch (Throwable $e) { return new DateTime('now', new DateTimeZone('UTC')); } }
function digest(string $kind, string $day, array $store): ?array {
    $c = $store['collections']; $live = fn($r) => is_array($r) && empty($r['deleted']);
    $tasks = array_filter($c['tasks'] ?? [], $live);
    $open = array_filter($tasks, fn($t) => !in_array((string)($t['state'] ?? ''), DONE_STATES, true));
    $top = array_values(array_filter($open, fn($t) => ($t['focusDate'] ?? '') === $day));
    $topDone = count(array_filter($tasks, fn($t) => ($t['focusDate'] ?? '') === $day && in_array((string)($t['state'] ?? ''), DONE_STATES, true)));
    $due = count(array_filter($open, fn($t) => ($t['due'] ?? '') === $day));
    $over = count(array_filter($open, fn($t) => ($t['due'] ?? '') !== '' && $t['due'] < $day));
    $fu = count(array_filter(array_filter($c['applications'] ?? [], $live), fn($a) => ($a['followUp'] ?? '') !== '' && $a['followUp'] <= $day && in_array((string)($a['stage'] ?? 'Saved'), ['Saved', 'Applied', 'Screening', 'Interview', 'Offer'], true)));
    $logs = array_filter($c['logs'] ?? [], $live);
    $dow = (int)date('N', strtotime($day)); $ws = date('Y-m-d', strtotime($day . ' -' . ($dow - 1) . ' days'));
    $weeklyDone = (bool)array_filter($logs, fn($l) => ($l['type'] ?? '') === 'weekly' && (($l['week'] ?? '') === $ws || (($l['date'] ?? '') >= $ws && ($l['date'] ?? '') <= $day)));
    $extra = [];
    if ($due) { $extra[] = $due . ' due today'; }
    if ($over) { $extra[] = $over . ' overdue'; }
    if ($fu) { $extra[] = $fu . ' job follow-up' . ($fu > 1 ? 's' : ''); }
    if ($kind === 'morning') {
        $lines = []; foreach (array_slice($top, 0, 3) as $i => $t) { $lines[] = ($i + 1) . '. ' . (string)($t['title'] ?? ''); }
        $body = $lines ? implode("\n", $lines) : 'No Top 3 yet. Choose three things that matter today.';
        if ($extra) { $body .= "\n" . implode(' · ', $extra); }
        return ['title' => 'Morning Balance · 1 minute', 'body' => $body, 'url' => './#/today', 'tag' => 'mec-morning'];
    }
    if ((bool)array_filter($logs, fn($l) => ($l['type'] ?? '') === 'closeout' && ($l['date'] ?? '') === $day)) { return null; }
    $n = count($top) + $topDone;
    $body = ($n ? "$topDone of $n Top 3 done. " : '') . "Night Balance: score your day and carry over what is left (1 minute).";
    if ($dow >= 5 && !$weeklyDone) { $body .= "\nWeekly review is due."; }
    return ['title' => 'Night Balance · 1 minute', 'body' => $body, 'url' => './#/today', 'tag' => 'mec-evening'];
}
function run_cron(): array {
    $p = push_keys(); $store = load_store(); $sent = 0; $drop = [];
    $subject = (string)($p['subject'] ?? 'https://localhost');
    foreach ($p['subs'] as $id => $s) {
        $now = local_now((string)($s['tz'] ?? 'UTC')); $day = $now->format('Y-m-d'); $hm = $now->format('H:i');
        foreach (['morning', 'evening'] as $kind) {
            $at = (string)($s[$kind] ?? ''); if (!preg_match('/^\d{2}:\d{2}$/', $at)) { continue; }
            if (($s['last'][$kind] ?? '') === $day || $hm < $at) { continue; }
            [$h, $m] = array_map('intval', explode(':', $at)); $due = (clone $now)->setTime($h, $m);
            if ($now->getTimestamp() - $due->getTimestamp() > 3 * 3600) { continue; }
            $msg = digest($kind, $day, $store);
            $p['subs'][$id]['last'][$kind] = $day;
            if ($msg === null) { continue; }
            $code = push_send($s['sub'], $msg, $p, $subject);
            if ($code === 404 || $code === 410) { $drop[] = $id; } elseif ($code >= 200 && $code < 300) { $sent++; }
        }
    }
    with_lock(function () use ($p, $drop) { $cur = push_state(); foreach ($p['subs'] as $id => $s) { if (isset($cur['subs'][$id])) { $cur['subs'][$id]['last'] = $s['last'] ?? []; } } foreach ($drop as $id) { unset($cur['subs'][$id]); } write_json('push.json', $cur); });
    return ['sent' => $sent, 'removed' => count($drop), 'devices' => count($p['subs'])];
}

/* ---------- Siri / Shortcuts helpers ---------- */
function prefs_of(array $store): array { $p = $store['collections']['settings']['prefs'] ?? []; return is_array($p) ? $p : []; }
function local_day(array $store, int $plus = 0): string { $n = local_now((string)(prefs_of($store)['tz'] ?? 'UTC')); if ($plus) { $n->modify("+$plus day"); } return $n->format('Y-m-d'); }
function now_ms(): string { $t = microtime(true); return gmdate('Y-m-d\TH:i:s', (int)$t) . sprintf('.%03dZ', (int)(($t - floor($t)) * 1000)); }
function new_id(string $p): string { return $p . '-' . base_convert((string)(int)(microtime(true) * 1000), 10, 36) . bin2hex(random_bytes(3)); }
function word_date(string $w, array $store): string {
    $w = strtolower($w); $t = local_day($store);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $w)) { return $w; }
    if ($w === 'today') { return $t; } if ($w === 'tomorrow' || $w === 'tmr') { return local_day($store, 1); }
    $days = ['mon' => 1, 'tue' => 2, 'wed' => 3, 'thu' => 4, 'fri' => 5, 'sat' => 6, 'sun' => 7];
    $k = substr($w, 0, 3); if (isset($days[$k])) { $d = new DateTime($t); $cur = (int)$d->format('N'); $add = ($days[$k] - $cur + 7) % 7 ?: 7; $d->modify("+$add day"); return $d->format('Y-m-d'); }
    return '';
}
function shortcut_text(): string {
    $v = $_GET['text'] ?? $_POST['text'] ?? '';
    if ($v === '') { $raw = file_get_contents('php://input', false, null, 0, 20000) ?: ''; $j = json_decode($raw, true); $v = is_array($j) ? (string)($j['text'] ?? '') : $raw; }
    return trim(mb_substr((string)$v, 0, 500));
}
function store_put(string $c, array $rec): void {
    with_lock(function () use ($c, $rec) { $s = load_store(); backup_store(); $s['collections'][$c][$rec['id']] = $rec; $s['rev'] = (int)$s['rev'] + 1; $s['updatedAt'] = gmdate('c'); write_json('store.json', $s); });
}
function plain(string $txt): void { header('Content-Type: text/plain; charset=utf-8'); echo $txt; exit; }
function shortcut_auth(): void {
    $k = (string)($_GET['k'] ?? ($_SERVER['HTTP_X_KEY'] ?? '')); $uid = $k !== '' ? (keys_map()['short'][$k] ?? '') : '';
    if ($uid === '' || !isset(users()[$uid])) { http_response_code(404); plain('Not found'); }
    use_user($uid); if (!has_access(cur_user())) { plain('Your ME.Coach subscription has ended.'); }
}

/* ---------- WebAuthn (Face ID / Touch ID passkeys) ---------- */
function cbor_decode(string $d, int &$o) {
    $b = ord($d[$o++]); $mt = $b >> 5; $ai = $b & 31;
    if ($ai < 24) { $len = $ai; } elseif ($ai === 24) { $len = ord($d[$o]); $o += 1; } elseif ($ai === 25) { $len = unpack('n', substr($d, $o, 2))[1]; $o += 2; }
    elseif ($ai === 26) { $len = unpack('N', substr($d, $o, 4))[1]; $o += 4; } elseif ($ai === 27) { $len = unpack('J', substr($d, $o, 8))[1]; $o += 8; } else { throw new RuntimeException('CBOR: indefinite length'); }
    switch ($mt) {
        case 0: return $len; case 1: return -1 - $len;
        case 2: case 3: $v = substr($d, $o, $len); $o += $len; return $v;
        case 4: $a = []; for ($i = 0; $i < $len; $i++) { $a[] = cbor_decode($d, $o); } return $a;
        case 5: $m = []; for ($i = 0; $i < $len; $i++) { $k = cbor_decode($d, $o); $m[$k] = cbor_decode($d, $o); } return $m;
        case 7: return $ai === 20 ? false : ($ai === 21 ? true : null);
    }
    throw new RuntimeException('CBOR: unsupported type');
}
function wa_state(): array { return read_json('webauthn.json', ['creds' => []]) + ['creds' => []]; }
function wa_chal(): array { return read_json('webauthn-chal.json', []); }
function wa_origin(): string { return (is_https() ? 'https://' : 'http://') . (string)($_SERVER['HTTP_HOST'] ?? ''); }
function wa_rpid(): string { return preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? 'localhost')); }
function wa_challenge(string $purpose): string {
    $ch = random_bytes(32);
    with_lock(function () use ($ch, $purpose) { $w = wa_chal(); $now = time(); foreach ($w as $k => $v) { if (($v['exp'] ?? 0) < $now) { unset($w[$k]); } } $w[b64u($ch)] = ['exp' => $now + 180, 'p' => $purpose]; write_json('webauthn-chal.json', $w); });
    return b64u($ch);
}
function wa_client(string $cdjB64, string $type): array {
    $cdj = b64u_dec($cdjB64); $c = json_decode($cdj, true);
    if (!is_array($c) || ($c['type'] ?? '') !== $type) { fail(400, 'Passkey: wrong type'); }
    if (($c['origin'] ?? '') !== wa_origin()) { fail(400, 'Passkey: wrong origin'); }
    $ok = with_lock(function () use ($c, $type) { $w = wa_chal(); $k = (string)($c['challenge'] ?? ''); $v = $w[$k] ?? null; unset($w[$k]); write_json('webauthn-chal.json', $w); return $v && $v['exp'] >= time() && $v['p'] === $type; });
    if (!$ok) { fail(400, 'Passkey: challenge expired, try again'); }
    return [$cdj, $c];
}
function wa_authdata(string $ad): array {
    if (strlen($ad) < 37) { fail(400, 'Passkey: bad data'); }
    if (!hash_equals(hash('sha256', wa_rpid(), true), substr($ad, 0, 32))) { fail(400, 'Passkey: wrong site'); }
    $flags = ord($ad[32]); if (!($flags & 1)) { fail(400, 'Passkey: user not present'); }
    return ['flags' => $flags, 'count' => unpack('N', substr($ad, 33, 4))[1]];
}


/* ---------- billing, Google sign-in, book ---------- */
function billing(): array { $s = read_json('system.json', []); return is_array($s['billing'] ?? null) ? $s['billing'] : []; }
function billing_public(): array {
    $b = billing(); $co = [];
    foreach (array_keys(PLANS) as $k) { $u = (string)($b['checkout'][$k] ?? ''); if ($u !== '') { $co[$k] = $u; } }
    return ['google' => (string)($b['googleClientId'] ?? ''), 'checkout' => $co, 'manual' => (string)($b['manualText'] ?? ''), 'whatsapp' => (string)($b['whatsapp'] ?? ''), 'email' => (string)($b['contactEmail'] ?? ''), 'plans' => PLANS];
}
function http_get_json(string $url): ?array {
    $raw = false;
    if (function_exists('curl_init')) { $c = curl_init($url); curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 5]); $raw = curl_exec($c); $code = (int)curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c); if ($code !== 200) { return null; } }
    else { $raw = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => false]])); }
    if (!is_string($raw) || $raw === '') { return null; }
    $j = json_decode($raw, true); return is_array($j) ? $j : null;
}
function find_uid_by_email(string $email): string { foreach (users() as $id => $u) { if (($u['email'] ?? '') === $email) { return (string)$id; } } return ''; }
function create_user(string $email, string $name, array $extra): string {
    $uid = with_lock(function () use ($email, $name, $extra) {
        $us = users(); foreach ($us as $u) { if (($u['email'] ?? '') === $email) { fail(409, 'This email already has an account. Sign in instead.'); } }
        $uid = bin2hex(random_bytes(10)); $owner = count($us) === 0;
        $us[$uid] = ['email' => $email, 'name' => $name, 'role' => $owner ? 'owner' : 'user', 'created' => gmdate('c'), 'trialEnds' => time() + TRIAL_DAYS * 86400, 'paidUntil' => 0] + $extra;
        write_json('users.json', $us); return $uid;
    });
    use_user($uid); write_json('store.json', empty_store());
    $ics = bin2hex(random_bytes(20)); write_json('config.json', ['icsKey' => $ics, 'created' => gmdate('c')]); key_set('ics', $ics, $uid);
    return $uid;
}
function set_paid(string $uid, int $until, string $plan, bool $exact): void {
    with_lock(function () use ($uid, $until, $plan, $exact) {
        $us = users(); if (!isset($us[$uid])) { return; }
        $us[$uid]['paidUntil'] = $exact ? $until : max((int)($us[$uid]['paidUntil'] ?? 0), $until); if ($plan !== '') { $us[$uid]['planName'] = $plan; }
        write_json('users.json', $us);
        $r = read_json('requests.json', []); foreach ($r as &$q) { if (($q['uid'] ?? '') === $uid && empty($q['done'])) { $q['done'] = gmdate('c'); } } unset($q); write_json('requests.json', $r);
    });
}

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

/* ---------- v10: Claude assistant (owner sets the key in the app; it never leaves the server) ---------- */
function ai_cfg(): array { $s = read_json('system.json', []); return is_array($s['ai'] ?? null) ? $s['ai'] : []; }
function ai_call(string $system, array $content, int $max = 1200): array { return ai_call_multi($system, [['role' => 'user', 'content' => $content]], $max); }
function ai_call_multi(string $system, array $messages, int $max = 1200): array {
    $c = ai_cfg(); $key = (string)($c['key'] ?? ''); if ($key === '') { return ['ok' => false, 'error' => 'AI is not set up yet. The owner adds the Anthropic API key in Settings → AI.']; }
    $model = (string)($c['model'] ?? 'claude-opus-5-5');
    $req = ['model' => $model, 'max_tokens' => $max, 'system' => $system, 'messages' => $messages, 'output_config' => ['effort' => 'low']];
    $hdr = ['Content-Type: application/json', 'x-api-key: ' . $key, 'anthropic-version: 2023-06-01'];
    if (in_array($model, ['claude-opus-5-5', 'claude-sonnet-5-5'], true)) { $req['fallbacks'] = 'default'; $hdr[] = 'anthropic-beta: server-side-fallback-2026-07-01'; }
    $ch = curl_init('https://api.anthropic.com/v1/messages'); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($req), CURLOPT_HTTPHEADER => $hdr, CURLOPT_TIMEOUT => 90, CURLOPT_CONNECTTIMEOUT => 10]);
    $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    $j = is_string($raw) ? json_decode($raw, true) : null;
    if ($code !== 200 || !is_array($j)) { return ['ok' => false, 'error' => 'AI error' . ($code ? " ($code)" : '') . (is_array($j) && isset($j['error']['message']) ? ': ' . mb_substr((string)$j['error']['message'], 0, 160) : '')]; }
    if (($j['stop_reason'] ?? '') === 'refusal') { return ['ok' => false, 'error' => 'The AI declined this request. Try rephrasing it.']; }
    $txt = ''; foreach (($j['content'] ?? []) as $b) { if (($b['type'] ?? '') === 'text') { $txt .= $b['text']; } }
    return ['ok' => true, 'text' => trim($txt), 'usage' => $j['usage'] ?? null];
}
function ai_quota(): bool { $d = gmdate('Y-m-d'); $q = read_json('ai-usage.json', []); $n = (int)(($q[$d] ?? 0)); $max = (int)(ai_cfg()['daily'] ?? 40); if ($n >= $max) { return false; } write_json('ai-usage.json', [$d => $n + 1]); return true; }
/* read a Google Calendar secret iCal address (one-way: Google → ME.Coach) */
function ics_parse(string $ics, string $from, string $to): array {
    $out = []; $ics = preg_replace("/\r?\n[ \t]/", '', $ics);
    foreach (explode('BEGIN:VEVENT', $ics) as $i => $blk) { if ($i === 0) { continue; } $g = function ($k) use ($blk) { return preg_match('/^' . $k . '(;[^:\r\n]*)?:(.*)$/m', $blk, $m) ? [trim($m[2]), $m[1] ?? ''] : ['', '']; };
        [$s, $sp] = $g('DTSTART'); [$e] = $g('DTEND'); [$sum] = $g('SUMMARY'); [$uid] = $g('UID'); [$rr] = $g('RRULE'); if ($s === '') { continue; }
        $allDay = strlen($s) === 8; $tz = preg_match('/TZID=([^;:]+)/', $sp, $m) ? $m[1] : 'UTC';
        $conv = function ($v) use ($allDay, $tz) { if ($v === '') { return ''; } if ($allDay) { return substr($v, 0, 4) . '-' . substr($v, 4, 2) . '-' . substr($v, 6, 2); } try { $z = str_ends_with($v, 'Z') ? new DateTimeZone('UTC') : new DateTimeZone($tz); $d = DateTime::createFromFormat('Ymd\THis', rtrim($v, 'Z'), $z); return $d ? $d->format('c') : ''; } catch (Throwable $x) { return ''; } };
        $st = $conv($s); $day = substr($st, 0, 10); if ($rr === '' && ($day < $from || $day > $to)) { continue; }
        $out[] = ['uid' => $uid ?: md5($s . $sum), 'title' => str_replace(['\\,', '\;', '\\n'], [',', ';', ' '], $sum ?: 'Event'), 'start' => $st, 'end' => $conv($e), 'allDay' => $allDay, 'rrule' => $rr];
        if (count($out) >= 400) { break; } }
    return $out;
}

/* ---------- v12: coach panel and session booking ---------- */
function coach_cfg(): array { $s = read_json('system.json', []); return ($s['coach'] ?? []) + ['days' => [0, 1, 2, 3, 4], 'from' => '18:00', 'to' => '21:00', 'len' => 45, 'link' => '', 'tz' => 'Asia/Muscat', 'open' => false]; }
function coach_eligible(array $u): bool { return ($u['role'] ?? '') === 'owner' || !empty($u['coachClient']) || (($u['planName'] ?? '') === 'coach' && (int)($u['paidUntil'] ?? 0) > time()) || (!empty(coach_cfg()['open']) && has_access($u)); }
function coach_bookings(): array { $b = read_json('bookings.json', []); return is_array($b) ? $b : []; }
function coach_slots(): array {
    $c = coach_cfg(); try { $tz = new DateTimeZone($c['tz']); } catch (Throwable $e) { $tz = new DateTimeZone('Asia/Muscat'); }
    $taken = []; foreach (coach_bookings() as $b) { if (($b['status'] ?? '') === 'booked') { $taken[(string)$b['at']] = 1; } }
    $out = []; $now = new DateTime('now', $tz); $len = max(15, (int)$c['len']);
    for ($i = 0; $i < 14; $i++) { $d = (clone $now)->setTime(0, 0)->modify("+$i day"); if (!in_array((int)$d->format('w'), array_map('intval', $c['days']), true)) { continue; }
        [$fh, $fm] = array_map('intval', explode(':', $c['from'])); [$th, $tm] = array_map('intval', explode(':', $c['to']));
        for ($t = (clone $d)->setTime($fh, $fm); $t->getTimestamp() + $len * 60 <= (clone $d)->setTime($th, $tm)->getTimestamp(); $t->modify("+$len minutes")) {
            if ($t->getTimestamp() < time() + 12 * 3600) { continue; } $iso = $t->format('c'); if (!isset($taken[$iso])) { $out[] = $iso; } } }
    return $out;
}
function client_summary(string $uid, array $u): array {
    $s = json_decode((string)@file_get_contents(DATA_DIR . '/u/' . $uid . '/store.json'), true); $c = is_array($s) ? ($s['collections'] ?? []) : [];
    $live = fn($k) => array_values(array_filter((array)($c[$k] ?? []), fn($r) => is_array($r) && empty($r['deleted'])));
    $areas = []; foreach ($live('areas') as $a) { $areas[$a['id']] = $a['title'] ?? ''; }
    $wh = $live('wheel'); usort($wh, fn($a, $b) => strcmp((string)($b['date'] ?? ''), (string)($a['date'] ?? ''))); $w = $wh[0] ?? null; $wheel = [];
    if ($w) { foreach (($w['scores'] ?? []) as $id => $v) { if (isset($areas[$id])) { $wheel[] = [$areas[$id], round((float)$v, 2)]; } } }
    $goals = []; foreach ($live('goals') as $g) { if (in_array($g['status'] ?? '', ['Done', 'Achieved', 'Dropped', 'Cancelled'], true)) { continue; } $tot = 0; $dn = 0; foreach (($g['plan'] ?? []) as $p) { $tot += (int)($p['count'] ?? 0); $dn += min((int)($p['count'] ?? 0), count((array)($p['done'] ?? []))); } $goals[] = ['title' => $g['title'] ?? '', 'area' => $areas[$g['areaId'] ?? ''] ?? '', 'target' => $g['target'] ?? '', 'pct' => $tot ? (int)round(100 * $dn / $tot) : null]; }
    $logs = $live('logs'); $days = []; foreach ($logs as $l) { if (($l['type'] ?? '') === 'closeout' && ($l['date'] ?? '') >= gmdate('Y-m-d', time() - 7 * 86400)) { $days[] = (float)($l['assess'] ?? $l['score'] ?? 0); } }
    $cy = null; foreach ($live('cycles') as $x) { if (($x['status'] ?? '') === 'active') { $cy = ['start' => $x['start'] ?? '', 'intention' => $x['intention'] ?? '']; } }
    $notes = (read_json('coach-notes.json', [])[$uid] ?? []);
    return ['id' => $uid, 'name' => $u['name'] ?? '', 'email' => $u['email'] ?? '', 'plan' => user_public($u, $uid)['plan'], 'coachClient' => !empty($u['coachClient']) || ($u['planName'] ?? '') === 'coach', 'shared' => !empty($u['coachShare']),
        'wheel' => !empty($u['coachShare']) ? $wheel : [], 'wheelDate' => !empty($u['coachShare']) && $w ? ($w['date'] ?? '') : '', 'goals' => !empty($u['coachShare']) ? array_slice($goals, 0, 8) : [], 'avg7' => !empty($u['coachShare']) && $days ? round(array_sum($days) / count($days), 2) : null, 'nights7' => !empty($u['coachShare']) ? count($days) : null, 'cycle' => !empty($u['coachShare']) ? $cy : null,
        'lastActive' => is_array($s) ? ($s['updatedAt'] ?? '') : '', 'notes' => array_slice($notes, -20)];
}

/* ---------- v13: Ava, the private AI coach (chat + Siri) ---------- */
const AVA_SYSTEM = "You are Ava, the private coach inside ME.Coach: smart, elegant and warm, with a light sense of humour. You coach with the method of the book Self-Coaching Blueprint by Milad Ebrahimi: the Wheel of Life (8 areas), 40-day goals, goals broken into daily micro-actions, Morning Balance (expectation, focus, Top 3, improvement actions, gratitude) and Night Balance (score, what to improve, carry over, ideas). Use the user's data given below. Answer in the user's language. Be concise (under 120 words unless asked for more), concrete and kind. Ask at most one question back. When you suggest actions the user can add to the app, put each on its own line starting with '• ' (max 3). You are not a therapist, doctor or lawyer: for health, legal or crisis topics, encourage professional help.";
function ava_context(array $s): string {
    $c = $s['collections'] ?? []; $live = fn($k) => array_values(array_filter((array)($c[$k] ?? []), fn($r) => is_array($r) && empty($r['deleted'])));
    $areas = []; foreach ($live('areas') as $a) { $areas[$a['id']] = $a['title'] ?? ''; }
    $wh = $live('wheel'); usort($wh, fn($a, $b) => strcmp((string)($b['date'] ?? ''), (string)($a['date'] ?? ''))); $wheel = [];
    if ($wh) { foreach (($wh[0]['scores'] ?? []) as $id => $v) { if (isset($areas[$id])) { $wheel[] = $areas[$id] . ' ' . round((float)$v, 1); } } }
    $goals = []; foreach ($live('goals') as $g) { if (!in_array($g['status'] ?? '', ['Done', 'Achieved', 'Dropped', 'Cancelled'], true)) { $goals[] = ($g['title'] ?? '') . (!empty($g['target']) ? ' (by ' . $g['target'] . ')' : ''); } }
    $d = local_day($s); $tasks = []; foreach ($live('tasks') as $t) { if (!in_array((string)($t['state'] ?? ''), DONE_STATES, true) && (($t['focusDate'] ?? '') === $d || ($t['due'] ?? '') === $d)) { $tasks[] = $t['title'] ?? ''; } }
    return 'Today: ' . $d . '. Wheel of Life: ' . implode(', ', $wheel) . '. Goals: ' . implode('; ', array_slice($goals, 0, 6)) . '. Tasks today: ' . implode('; ', array_slice($tasks, 0, 8)) . '.';
}


/* ---------- v14: YouTube gift link and invite (referral) rewards ---------- */
function gift_cfg(): array { $s = read_json('system.json', []); return ($s['gift'] ?? []) + ['code' => '', 'days' => 30, 'max' => 500, 'used' => 0, 'on' => false]; }
function ref_code(string $uid): string { return substr(hash('sha256', 'ref' . $uid), 0, 8); }
function signup_bonus(string $uid, array $b): void {
    $gift = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($b['gift'] ?? ''))); $ref = preg_replace('/[^a-f0-9]/', '', (string)($b['ref'] ?? ''));
    with_lock(function () use ($uid, $gift, $ref) {
        $us = users(); if (!isset($us[$uid])) { return; } $s = read_json('system.json', []); $g = gift_cfg(); $now = time();
        if ($gift !== '' && !empty($g['on']) && $gift === strtoupper((string)$g['code']) && (int)$g['used'] < (int)$g['max']) {
            $us[$uid]['trialEnds'] = max((int)$us[$uid]['trialEnds'], $now + (int)$g['days'] * 86400); $us[$uid]['source'] = 'gift:' . $gift; $g['used'] = (int)$g['used'] + 1; $s['gift'] = $g; write_json('system.json', $s);
        }
        if ($ref !== '') { foreach ($us as $rid => &$ru) { if ($rid !== $uid && ref_code((string)$rid) === $ref) { $us[$uid]['referredBy'] = $rid; $us[$uid]['trialEnds'] = (int)$us[$uid]['trialEnds'] + 7 * 86400;
            if ((int)($ru['refRewards'] ?? 0) < 10) { $ru['refRewards'] = (int)($ru['refRewards'] ?? 0) + 1; if ((int)($ru['paidUntil'] ?? 0) > $now) { $ru['paidUntil'] = (int)$ru['paidUntil'] + 7 * 86400; } elseif (($ru['role'] ?? '') !== 'owner') { $ru['trialEnds'] = max($now, (int)($ru['trialEnds'] ?? 0)) + 7 * 86400; } }
            break; } } unset($ru); }
        write_json('users.json', $us);
    });
}

/* ---------- router ---------- */
if (defined('M2031_LIB')) { return; }
ensure_dir();
if (PHP_SAPI === 'cli') { $_GET['action'] = $argv[1] ?? ''; }
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($action) {
    case 'status':
        $tk = bearer(); $uid = token_uid($tk); $u = $uid !== '' ? users()[$uid] : null;
        out(200, ['ok' => true, 'setup' => is_setup(), 'passkey' => !empty(keys_map()['wa']), 'authed' => $uid !== '', 'token' => $uid !== '' ? $tk : null, 'user' => $u ? user_public($u, $uid) : null, 'trialDays' => TRIAL_DAYS, 'version' => APP_VERSION, 'time' => gmdate('c'), 'billing' => billing_public()]);

    case 'signup':
    case 'setup':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        throttle_check();
        $b = body(); $email = strtolower(trim((string)($b['email'] ?? ''))); $pw = (string)($b['password'] ?? ''); $name = mb_substr(trim((string)($b['name'] ?? '')), 0, 60);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { fail(400, 'Enter a valid email address'); }
        if (mb_strlen($pw) < 8) { fail(400, 'Use at least 8 characters for the password'); }
        $uid = create_user($email, $name, ['passHash' => password_hash($pw, PASSWORD_DEFAULT)]); signup_bonus($uid, $b);
        throttle_hit(true);
        out(200, ['ok' => true, 'token' => issue_token((string)($b['device'] ?? 'device'), $uid), 'user' => user_public(users()[$uid], $uid)]);

    case 'google':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        throttle_check();
        $b = body(); $cid = (string)(billing()['googleClientId'] ?? ''); $cred = (string)($b['credential'] ?? '');
        if ($cid === '') { fail(400, 'Google sign-in is not set up yet.'); }
        $info = strlen($cred) > 20 ? http_get_json('https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($cred)) : null;
        $ev = $info['email_verified'] ?? false;
        if (!$info || ($info['aud'] ?? '') !== $cid || !in_array($info['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true) || !($ev === true || $ev === 'true') || (int)($info['exp'] ?? 0) < time() || empty($info['email'])) { throttle_hit(false); fail(401, 'Google sign-in failed. Try again.'); }
        $email = strtolower((string)$info['email']); $uid = find_uid_by_email($email); $created = false;
        if ($uid === '') { $nm = trim((string)($b['name'] ?? '')) ?: (string)($info['given_name'] ?? $info['name'] ?? ''); $GLOBALS['NEWUSER_G'] = 1; $uid = create_user($email, mb_substr($nm, 0, 60), ['google' => (string)($info['sub'] ?? ''), 'passHash' => '']); $created = true; }
        if (!empty($GLOBALS['NEWUSER_G'])) { signup_bonus($uid, $b); }
        else { with_lock(function () use ($uid, $info) { $us = users(); if (empty($us[$uid]['google'])) { $us[$uid]['google'] = (string)($info['sub'] ?? ''); write_json('users.json', $us); } }); }
        throttle_hit(true);
        out(200, ['ok' => true, 'created' => $created, 'token' => issue_token((string)($b['device'] ?? 'device'), $uid), 'user' => user_public(users()[$uid], $uid)]);

    case 'pay-request':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_auth(); $b = body(); $plan = (string)($b['plan'] ?? ''); if (!isset(PLANS[$plan])) { fail(400, 'Unknown plan'); }
        $uid = $GLOBALS['UID'];
        with_lock(function () use ($uid, $plan, $b) { $r = read_json('requests.json', []); $r[] = ['uid' => $uid, 'plan' => $plan, 'at' => gmdate('c'), 'note' => mb_substr((string)($b['note'] ?? ''), 0, 300)]; write_json('requests.json', array_slice($r, -500)); });
        out(200, ['ok' => true]);

    case 'admin-config':
        require_owner(); $s0 = read_json('system.json', []);
        if ($method === 'POST') {
            $b = body();
            with_lock(function () use ($b) {
                $s = read_json('system.json', []); $bl = is_array($s['billing'] ?? null) ? $s['billing'] : [];
                $bl['googleClientId'] = preg_replace('/[^A-Za-z0-9._-]/', '', (string)($b['googleClientId'] ?? ($bl['googleClientId'] ?? '')));
                foreach (array_keys(PLANS) as $k) { $u = trim((string)($b['checkout'][$k] ?? '')); if ($u !== '' && !preg_match('#^https://#', $u)) { fail(400, 'Checkout links must start with https://'); } $bl['checkout'][$k] = $u; }
                foreach (['manualText' => 1500, 'whatsapp' => 30, 'contactEmail' => 120] as $k => $n) { if (isset($b[$k])) { $bl[$k] = mb_substr(trim((string)$b[$k]), 0, $n); } }
                $sec = trim((string)($b['lsSecret'] ?? '')); if ($sec === '-') { $bl['lsSecret'] = ''; } elseif ($sec !== '') { $bl['lsSecret'] = $sec; }
                $s['billing'] = $bl; write_json('system.json', $s);
            });
            $s0 = read_json('system.json', []);
        }
        $bl = is_array($s0['billing'] ?? null) ? $s0['billing'] : [];
        out(200, ['ok' => true, 'config' => ['googleClientId' => $bl['googleClientId'] ?? '', 'checkout' => $bl['checkout'] ?? new stdClass(), 'manualText' => $bl['manualText'] ?? '', 'whatsapp' => $bl['whatsapp'] ?? '', 'contactEmail' => $bl['contactEmail'] ?? '', 'hasSecret' => !empty($bl['lsSecret'])], 'webhook' => (is_https() ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '') . strtok((string)($_SERVER['REQUEST_URI'] ?? ''), '?') . '?action=ls-webhook', 'bookDownloads' => (int)($s0['bookDownloads'] ?? 0), 'log' => array_slice($s0['billingLog'] ?? [], -10)]);

    case 'ls-webhook':
        $raw = (string)file_get_contents('php://input', false, null, 0, 1024 * 1024); $sec = (string)(billing()['lsSecret'] ?? ''); $sig = (string)($_SERVER['HTTP_X_SIGNATURE'] ?? '');
        if ($sec === '' || $sig === '' || !hash_equals(hash_hmac('sha256', $raw, $sec), $sig)) { out(401, ['ok' => false]); }
        $j = json_decode($raw, true); if (!is_array($j)) { out(400, ['ok' => false]); }
        $ev = (string)($j['meta']['event_name'] ?? ''); $cd = $j['meta']['custom_data'] ?? []; $at = $j['data']['attributes'] ?? [];
        $uid = (string)($cd['uid'] ?? ''); if ($uid === '' || !isset(users()[$uid])) { $uid = find_uid_by_email(strtolower((string)($at['user_email'] ?? ''))); }
        $plan = (string)($cd['plan'] ?? ''); $planName = PLANS[$plan]['name'] ?? (string)($at['variant_name'] ?? $at['product_name'] ?? ''); $until = 0; $exact = false;
        if ($uid !== '') {
            if (in_array($ev, ['subscription_created', 'subscription_updated', 'subscription_resumed', 'subscription_unpaused', 'subscription_cancelled', 'subscription_expired'], true)) {
                $d = $ev === 'subscription_expired' ? null : (($at['ends_at'] ?? null) ?: ($at['renews_at'] ?? null));
                $until = $ev === 'subscription_expired' ? time() : ($d ? (int)strtotime((string)$d) + 86400 : 0); $exact = true;
            } elseif ($ev === 'order_created' && ($at['status'] ?? '') === 'paid' && isset(PLANS[$plan]) && empty($at['first_subscription_item'])) { $until = time() + PLANS[$plan]['days'] * 86400; }
            if ($until > 0) { set_paid($uid, $until, $planName, $exact); }
        }
        with_lock(function () use ($ev, $uid, $until) { $s = read_json('system.json', []); $l = $s['billingLog'] ?? []; $l[] = ['at' => gmdate('c'), 'event' => $ev, 'user' => $uid !== '' ? (users()[$uid]['email'] ?? '') : 'not found', 'until' => $until ? gmdate('Y-m-d', $until) : '']; $s['billingLog'] = array_slice($l, -50); write_json('system.json', $s); });
        out(200, ['ok' => true]);

    case 'book':
        with_lock(function () { $s = read_json('system.json', []); $s['bookDownloads'] = (int)($s['bookDownloads'] ?? 0) + 1; write_json('system.json', $s); });
        header('Location: book/self-coaching-blueprint.pdf', true, 302); exit;

    case 'login':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        throttle_check();
        $b = body(); $email = strtolower(trim((string)($b['email'] ?? ''))); $pw = (string)($b['password'] ?? ''); $uid = '';
        foreach (users() as $id => $u) { if (($u['email'] ?? '') === $email) { $uid = $id; } }
        $ok = $uid !== '' && password_verify($pw, (string)(users()[$uid]['passHash'] ?? ''));
        throttle_hit($ok);
        if (!$ok) { usleep(400000); fail(401, 'Wrong email or password'); }
        out(200, ['ok' => true, 'token' => issue_token((string)($b['device'] ?? 'device'), $uid), 'user' => user_public(users()[$uid], $uid)]);

    case 'me':
        require_auth(); out(200, ['ok' => true, 'user' => user_public(cur_user(), $GLOBALS['UID'])]);

    case 'profile':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_auth(); $b = body(); $uid = $GLOBALS['UID'];
        with_lock(function () use ($b, $uid) { $us = users(); if (isset($b['name'])) { $us[$uid]['name'] = mb_substr(trim((string)$b['name']), 0, 60); } write_json('users.json', $us); });
        out(200, ['ok' => true, 'user' => user_public(users()[$uid], $uid)]);

    case 'admin-users':
        require_owner(); $rows = [];
        foreach (users() as $id => $u) { $p = user_public($u, $id); $p['storeKB'] = round((@filesize(DATA_DIR . '/u/' . $id . '/store.json') ?: 0) / 1024); $rows[] = $p; }
        $req = array_values(array_filter(read_json('requests.json', []), fn($q) => empty($q['done'])));
        foreach ($req as &$q) { $q['email'] = users()[$q['uid']]['email'] ?? ''; $q['planName'] = PLANS[$q['plan']]['name'] ?? $q['plan']; } unset($q);
        out(200, ['ok' => true, 'users' => $rows, 'requests' => array_reverse($req)]);

    case 'admin-set':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_owner(); $b = body(); $id = (string)($b['id'] ?? ''); $days = (int)($b['days'] ?? 0);
        $r = with_lock(function () use ($id, $days) {
            $us = users(); if (!isset($us[$id])) { fail(404, 'No such user'); } if (($us[$id]['role'] ?? '') === 'owner') { fail(400, 'The owner always has access'); }
            if ($days > 0) { $us[$id]['paidUntil'] = max(time(), (int)($us[$id]['paidUntil'] ?? 0)) + $days * 86400; } else { $us[$id]['paidUntil'] = 0; $us[$id]['trialEnds'] = min((int)($us[$id]['trialEnds'] ?? 0), time()); }
            write_json('users.json', $us); return user_public($us[$id], $id);
        });
        if ($days > 0) { with_lock(function () use ($id) { $r = read_json('requests.json', []); foreach ($r as &$q) { if (($q['uid'] ?? '') === $id && empty($q['done'])) { $q['done'] = gmdate('c'); } } unset($q); write_json('requests.json', $r); }); }
        out(200, ['ok' => true, 'user' => $r]);

    case 'logout':
        $k = require_auth();
        with_lock(function () use ($k) { $t = read_json('tokens.json', []); unset($t[$k]); write_json('tokens.json', $t); });
        set_auth_cookie('', 0);
        out(200, ['ok' => true]);

    case 'pull':
        require_auth();
        $s = load_store();
        $since = (string)($_GET['since'] ?? '');
        if ($since !== '' && (string)$s['rev'] === $since) { out(200, ['ok' => true, 'rev' => $s['rev'], 'unchanged' => true]); }
        out(200, ['ok' => true, 'version' => APP_VERSION, 'rev' => $s['rev'], 'updatedAt' => $s['updatedAt'], 'collections' => $s['collections']]);

    case 'push':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_access();
        $b = body(); $changes = $b['changes'] ?? [];
        if (!is_array($changes) || count($changes) > 5000) { fail(400, 'Bad changes'); }
        $res = with_lock(function () use ($changes) {
            $s = load_store(); $n = merge_changes($s, $changes);
            if ($n > 0) { backup_store(); $s['rev'] = (int)$s['rev'] + 1; $s['updatedAt'] = gmdate('c'); write_json('store.json', $s); save_history(); }
            return [$s, $n];
        });
        out(200, ['ok' => true, 'version' => APP_VERSION, 'applied' => $res[1], 'rev' => $res[0]['rev'], 'updatedAt' => $res[0]['updatedAt'], 'collections' => $res[0]['collections']]);

    case 'password':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_auth(); throttle_check(); $uid = $GLOBALS['UID'];
        $b = body();
        if (!password_verify((string)($b['current'] ?? ''), (string)(cur_user()['passHash'] ?? ''))) { throttle_hit(false); fail(401, 'Current password is wrong'); }
        $np = (string)($b['next'] ?? ''); if (mb_strlen($np) < 8) { fail(400, 'Use at least 8 characters'); }
        with_lock(function () use ($np, $uid) { $us = users(); $us[$uid]['passHash'] = password_hash($np, PASSWORD_DEFAULT); write_json('users.json', $us); $t = read_json('tokens.json', []); foreach ($t as $k => $r) { if (($r['uid'] ?? '') === $uid) { unset($t[$k]); } } write_json('tokens.json', $t); });
        out(200, ['ok' => true, 'token' => issue_token('after-password-change')]);

    case 'icskey':
        require_auth();
        if ((($_GET['rotate'] ?? '') === '1' && $method === 'POST') || empty(config()['icsKey'])) {
            $old = config()['icsKey'] ?? null; $nk = bin2hex(random_bytes(20));
            with_lock(function () use ($nk) { $c = config(); $c['icsKey'] = $nk; write_json('config.json', $c); }); key_set('ics', $nk, $GLOBALS['UID'], $old);
        }
        out(200, ['ok' => true, 'key' => config()['icsKey'] ?? '']);

    case 'ics':
        $key = (string)($_GET['k'] ?? ''); $uid = $key !== '' ? (keys_map()['ics'][$key] ?? '') : '';
        if ($uid === '' || !isset(users()[$uid])) { http_response_code(404); exit; }
        use_user($uid);
        header('Content-Type: text/calendar; charset=utf-8');
        header('Content-Disposition: inline; filename="me-coach.ics"');
        echo ics_feed(load_store()); exit;

    case 'vapid':
        require_auth(); $p = push_keys();
        out(200, ['ok' => true, 'key' => $p['vapid']['pub']]);

    case 'pushsub':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_auth(); push_keys(); $b = body(); $s = $b['sub'] ?? null;
        if (!is_array($s) || !preg_match('#^https://#', (string)($s['endpoint'] ?? '')) || empty($s['keys']['p256dh']) || empty($s['keys']['auth'])) { fail(400, 'Bad subscription'); }
        $tm = fn($v, $d) => preg_match('/^\d{2}:\d{2}$/', (string)$v) ? (string)$v : $d;
        $host = preg_replace('/[^A-Za-z0-9.\-:]/', '', (string)($_SERVER['HTTP_HOST'] ?? 'localhost'));
        $rec = ['sub' => ['endpoint' => (string)$s['endpoint'], 'keys' => ['p256dh' => (string)$s['keys']['p256dh'], 'auth' => (string)$s['keys']['auth']]], 'tz' => mb_substr((string)($b['tz'] ?? 'UTC'), 0, 60), 'morning' => ($b['morning'] ?? null) === '' ? '' : $tm($b['morning'] ?? '', '07:30'), 'evening' => ($b['evening'] ?? null) === '' ? '' : $tm($b['evening'] ?? '', '21:00'), 'device' => mb_substr((string)($b['device'] ?? ''), 0, 40), 'updated' => gmdate('c')];
        with_lock(function () use ($rec, $host) { $p = push_state(); $id = hash('sha256', $rec['sub']['endpoint']); $rec['last'] = $p['subs'][$id]['last'] ?? []; $p['subs'][$id] = $rec; write_json('push.json', $p); $s = read_json('system.json', []); $s['subject'] = 'https://' . $host; write_json('system.json', $s); });
        out(200, ['ok' => true]);

    case 'pushunsub':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_auth(); $b = body(); $id = hash('sha256', (string)($b['endpoint'] ?? ''));
        with_lock(function () use ($id) { $p = push_state(); unset($p['subs'][$id]); write_json('push.json', $p); });
        out(200, ['ok' => true]);

    case 'pushtest':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_auth(); $b = body(); $p = push_keys(); $id = hash('sha256', (string)($b['endpoint'] ?? ''));
        if (empty($p['subs'][$id])) { fail(404, 'This device is not subscribed'); }
        $tz = (string)($p['subs'][$id]['tz'] ?? 'UTC'); $msg = digest('morning', local_now($tz)->format('Y-m-d'), load_store());
        try { $code = push_send($p['subs'][$id]['sub'], ['title' => 'ME.Coach · test', 'body' => $msg['body'], 'url' => './#/today', 'tag' => 'm2031-test'], $p, (string)($p['subject'] ?? 'https://localhost')); }
        catch (Throwable $e) { fail(500, 'Push failed: ' . $e->getMessage()); }
        if ($code < 200 || $code >= 300) { fail(502, 'Push service answered ' . $code); }
        out(200, ['ok' => true, 'code' => $code]);

    case 'pushinfo':
        require_auth(); $p = push_keys();
        $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
        $url = (is_https() ? 'https://' : 'http://') . preg_replace('/[^A-Za-z0-9.\-:]/', '', (string)($_SERVER['HTTP_HOST'] ?? 'localhost')) . $dir . '/api.php?action=cron&k=' . $p['cronKey'];
        out(200, ['ok' => true, 'devices' => count($p['subs']), 'cronUrl' => $url, 'cronCmd' => 'curl -fsS "' . $url . '" > /dev/null', 'lastCron' => read_json('system.json', [])['lastCron'] ?? null]);

    case 'cron':
        if (PHP_SAPI !== 'cli') { $sys = system_state(); if (!hash_equals((string)$sys['cronKey'], (string)($_GET['k'] ?? ''))) { http_response_code(404); exit; } }
        $tot = ['sent' => 0, 'removed' => 0, 'devices' => 0];
        foreach (users() as $uid => $u) { if (!has_access($u) || !is_file(DATA_DIR . '/u/' . $uid . '/push.json')) { continue; } use_user($uid); $r = run_cron(); foreach ($tot as $k => $v) { $tot[$k] += $r[$k]; } }
        $jobsRun = 0; foreach (users() as $uid => $u) { if (!has_access($u)) { continue; } use_user($uid); $st = load_store(); $ap = prefs_of($st)['autopilot'] ?? []; if (empty($ap['on']) || empty($ap['titles'])) { continue; } $last = (string)(read_json('autopilot.json', [])['last'] ?? ''); if ($last !== '' && time() - strtotime($last) < 20 * 3600) { continue; } jobs_run(); $jobsRun++; }
        $tot['jobsRun'] = $jobsRun;
        $GLOBALS['UID'] = '';
        with_lock(function () { $s = read_json('system.json', []); $s['lastCron'] = gmdate('c'); write_json('system.json', $s); });
        out(200, ['ok' => true] + $tot);

    /* ----- Siri / Shortcuts ----- */
    case 'shortkey':
        require_auth();
        if (($_GET['rotate'] ?? '') === '1' && $method === 'POST' || empty(config()['shortKey'])) { $old = config()['shortKey'] ?? null; $nk = bin2hex(random_bytes(16)); with_lock(function () use ($nk) { $c = config(); $c['shortKey'] = $nk; write_json('config.json', $c); }); key_set('short', $nk, $GLOBALS['UID'], $old); }
        out(200, ['ok' => true, 'key' => config()['shortKey']]);

    case 's-add':
        shortcut_auth(); $s = load_store(); $txt = ' ' . shortcut_text() . ' '; $rec = ['state' => 'To do', 'priority' => 'P2', 'owner' => 'Me'];
        $txt = preg_replace_callback('/\s!([123])(?=\s)/', function ($m) use (&$rec) { $rec['priority'] = 'P' . $m[1]; return ' '; }, $txt, 1);
        $top = false; $txt = preg_replace_callback('/\s\*(?=\s)/', function () use (&$top) { $top = true; return ' '; }, $txt, 1);
        $txt = preg_replace_callback('/\s@(\S+)(?=\s)/', function ($m) use (&$rec, $s) { $d = word_date($m[1], $s); if ($d) { $rec['due'] = $d; return ' '; } return $m[0]; }, $txt, 1);
        foreach (['tomorrow' => 1, 'today' => 0] as $w => $n) { if (!isset($rec['due']) && preg_match('/\s' . $w . '\s*$/i', $txt)) { $rec['due'] = local_day($s, $n); $txt = preg_replace('/\s' . $w . '\s*$/i', ' ', $txt); } }
        $title = trim(preg_replace('/\s+/', ' ', $txt)); if ($title === '') { plain('Nothing to add.'); }
        if ($top) { $rec['focusDate'] = local_day($s); $rec['due'] = $rec['due'] ?? $rec['focusDate']; }
        $now = now_ms(); $rec += ['id' => new_id('tsk'), 'title' => mb_substr($title, 0, 300), 'createdAt' => $now, 'updatedAt' => $now, 'by' => 'Siri'];
        store_put('tasks', $rec);
        plain('Added: ' . $rec['title'] . (isset($rec['due']) ? ' (' . ($rec['due'] === local_day($s) ? 'today' : ($rec['due'] === local_day($s, 1) ? 'tomorrow' : date('D j M', strtotime($rec['due'])))) . ')' : ''));

    case 's-top3':
        shortcut_auth(); $s = load_store(); $d = local_day($s); $tops = []; $due = 0;
        foreach ($s['collections']['tasks'] as $t) { if (!is_array($t) || !empty($t['deleted']) || in_array((string)($t['state'] ?? ''), DONE_STATES, true)) { continue; } if (($t['focusDate'] ?? '') === $d) { $tops[] = (string)$t['title']; } elseif (($t['due'] ?? '') === $d) { $due++; } }
        $msg = $tops ? 'Your Top 3 today. ' . implode('. ', array_map(fn($i, $x) => ($i + 1) . ', ' . $x, array_keys($tops), $tops)) . '.' : 'You have not picked a Top 3 for today yet.';
        if ($due) { $msg .= " Also $due more due today."; }
        plain($msg);

    case 's-log':
        shortcut_auth(); $s = load_store(); $q = mb_strtolower(trim((string)($_GET['skill'] ?? ''))); $min = (int)($_GET['min'] ?? 0);
        if ($min <= 0 || $min > 600) { plain('Say how many minutes.'); }
        $best = null; foreach ($s['collections']['skills'] as $sk) { if (!is_array($sk) || !empty($sk['deleted'])) { continue; } $t = mb_strtolower((string)($sk['title'] ?? '')); if ($q !== '' && str_contains($t, $q)) { $best = $sk; break; } }
        if (!$best) { plain('No skill matches "' . $q . '". Use a word from the skill name, like IELTS or SQL.'); }
        $now = now_ms(); store_put('sessions', ['id' => new_id('ses'), 'title' => $best['title'] . ' · ' . $min . ' min', 'skill' => $best['id'], 'minutes' => $min, 'date' => local_day($s), 'result' => 'Not a check', 'createdAt' => $now, 'updatedAt' => $now, 'by' => 'Siri']);
        plain("Logged $min minutes of " . $best['title'] . '.');

    case 's-job':
        shortcut_auth(); $s = load_store(); $url = trim((string)($_GET['url'] ?? $_POST['url'] ?? '')); $title = shortcut_text();
        if ($url === '' && preg_match('#https?://\S+#', $title, $m)) { $url = $m[0]; $title = trim(str_replace($url, '', $title)); }
        if (!preg_match('#^https?://#', $url)) { plain('Share a job ad link.'); }
        $host = preg_replace('/^www\./', '', (string)parse_url($url, PHP_URL_HOST));
        $role = $title !== '' ? $title : 'Job from ' . $host;
        $now = now_ms(); store_put('applications', ['id' => new_id('app'), 'company' => '', 'role' => mb_substr($role, 0, 200), 'stage' => 'Saved', 'link' => $url, 'source' => $host, 'followUp' => local_day($s, 2), 'createdAt' => $now, 'updatedAt' => $now, 'by' => 'Siri']);
        plain('Saved to Job search: ' . $role);

    case 's-widget':
        $k = (string)($_GET['k'] ?? ''); $wu = $k !== '' ? (keys_map()['short'][$k] ?? '') : '';
        header('Access-Control-Allow-Origin: *'); header('Cache-Control: no-store');
        if ($wu === '' || !isset(users()[$wu])) { out(404, ['ok' => false, 'message' => 'Widget link not valid.']); }
        use_user($wu); if (!has_access(cur_user())) { out(200, ['ok' => false, 'message' => 'Your ME.Coach subscription has ended.']); }
        $s = load_store(); $w = $s['collections']['settings']['widget'] ?? null;
        if (!is_array($w) || !empty($w['deleted'])) { out(200, ['ok' => false, 'message' => 'Open ME.Coach once to start the widget.']); }
        $h = (int)local_now((string)(prefs_of($s)['tz'] ?? 'UTC'))->format('G'); $slot = $h < 11 ? 'morning' : ($h < 15 ? 'midday' : ($h < 18 ? 'afternoon' : 'evening'));
        $stale = ($w['date'] ?? '') !== local_day($s);
        if ($stale) { $w['rings'] = ['act' => 0, 'grow' => 0, 'plan' => 0]; $w['top3'] = []; $w['focus'] = 0; $w['habits'] = ['due' => (int)($w['habits']['due'] ?? 0), 'done' => 0]; if (isset($w['jobs'])) { $w['jobs']['done'] = 0; } }
        $msg = $stale ? ($slot === 'evening' ? 'Close the day in one minute with Night Balance.' : 'New day. Open ME.Coach for one minute of Morning Balance.') : (string)($w['msgs'][$slot] ?? '');
        $o = ['ok' => true, 'slot' => $slot, 'message' => $msg, 'updatedAt' => $w['updatedAt'] ?? null] + array_intersect_key($w, array_flip(['level', 'levelName', 'xp', 'pct', 'rings', 'top3', 'habits', 'streak', 'focus', 'vision', 'jobs']));
        if (($_GET['format'] ?? '') !== 'html') { out(200, $o); }
        header('Content-Type: text/html; charset=utf-8'); $e = fn($x) => htmlspecialchars((string)$x, ENT_QUOTES);
        $bar = fn($p, $c, $l) => '<div class="r"><span>' . $l . '</span><div class="b"><i style="width:' . max(0, min(100, (int)$p)) . '%;background:' . $c . '"></i></div><b>' . (int)$p . '%</b></div>';
        $top = ''; foreach ($o['top3'] ?? [] as $t) { $top .= '<li class="' . (!empty($t['done']) ? 'd' : '') . '">' . $e($t['t'] ?? '') . '</li>'; }
        echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="900"><title>ME.Coach widget</title><style>:root{color-scheme:light dark}body{margin:0;font:14px/1.4 -apple-system,"Segoe UI",system-ui,sans-serif;background:#fff;color:#37352f;padding:18px}@media(prefers-color-scheme:dark){body{background:#191919;color:#e6e6e6}.m{color:#9b9b9b!important}.b{background:#2f2f2f!important}}.h{font-weight:700;font-size:13px;letter-spacing:.02em}.m{color:#787774;font-size:12px}.r{display:grid;grid-template-columns:44px 1fr 40px;gap:8px;align-items:center;margin:6px 0}.b{height:8px;border-radius:4px;background:#efefed;overflow:hidden}.b i{display:block;height:100%;border-radius:4px}.msg{margin:12px 0;font-size:15px}ul{padding-left:18px;margin:6px 0}li.d{text-decoration:line-through;opacity:.6}a{color:inherit}</style></head><body>'
          . '<div class="h">ME<span style="color:#c9a227">.</span>Coach · Level ' . (int)($o['level'] ?? 1) . ' ' . $e($o['levelName'] ?? '') . '</div>'
          . $bar($o['rings']['act'] ?? 0, '#eb6834', 'Do') . $bar($o['rings']['grow'] ?? 0, '#1baf7a', 'Grow') . $bar($o['rings']['plan'] ?? 0, '#2a78d6', 'Plan')
          . '<div class="msg">' . $e($msg) . '</div>' . ($top ? '<div class="m">Top 3</div><ul>' . $top . '</ul>' : '')
          . (isset($o['jobs']) ? '<div class="m">Applications today: <b>' . (int)$o['jobs']['done'] . '/' . (int)$o['jobs']['target'] . '</b></div>' : '')
          . '<div class="m">' . (int)($o['habits']['done'] ?? 0) . '/' . (int)($o['habits']['due'] ?? 0) . ' habits · ' . (int)($o['focus'] ?? 0) . ' min focus' . (!empty($o['vision']['days']) ? ' · ' . number_format((int)$o['vision']['days']) . ' days to ' . $e($o['vision']['name'] ?? '') : '') . '</div>'
          . '<p class="m"><a href="./" target="_blank">Open ME.Coach</a></p></body></html>';
        exit;

    /* ----- history and health ----- */
    case 'history':
        require_auth(); $k = (string)($_GET['c'] ?? '') . ':' . (string)($_GET['id'] ?? '');
        out(200, ['ok' => true, 'versions' => array_reverse(read_json('history.json', [])[$k] ?? [])]);

    case 'health':
        require_auth(); $s = load_store(); $p = push_state(); $b = glob(path('backups/store-*.json')) ?: []; sort($b);
        $counts = []; foreach (COLLECTIONS as $c) { $counts[$c] = count(array_filter($s['collections'][$c], fn($r) => is_array($r) && empty($r['deleted']))); }
        out(200, ['ok' => true, 'version' => APP_VERSION, 'php' => PHP_VERSION, 'rev' => $s['rev'], 'updatedAt' => $s['updatedAt'], 'storeKB' => round((@filesize(path('store.json')) ?: 0) / 1024), 'historyKB' => round((@filesize(path('history.json')) ?: 0) / 1024), 'backups' => count($b), 'lastBackup' => $b ? substr(basename(end($b)), 6, 8) : null, 'writable' => is_writable(DATA_DIR), 'lastCron' => read_json('system.json', [])['lastCron'] ?? null, 'pushDevices' => count($p['subs'] ?? []), 'passkeys' => count(wa_state()['creds']), 'counts' => $counts, 'time' => gmdate('c'), 'outsideWebroot' => strpos(realpath(DATA_DIR) ?: '', realpath(__DIR__) ?: '#') !== 0]);

    /* ----- passkeys ----- */
    case 'wa-reg-opts':
        require_auth();
        out(200, ['ok' => true, 'challenge' => wa_challenge('webauthn.create'), 'rpId' => wa_rpid(), 'user' => b64u('mec-' . $GLOBALS['UID']), 'name' => cur_user()['email'] ?? 'me', 'display' => cur_user()['name'] ?? 'Me', 'exclude' => array_keys(wa_state()['creds'])]);

    case 'wa-reg':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_auth(); $b = body(); wa_client((string)($b['clientDataJSON'] ?? ''), 'webauthn.create');
        try { $o = 0; $att = cbor_decode(b64u_dec((string)($b['attestationObject'] ?? '')), $o); } catch (Throwable $e) { fail(400, 'Passkey: unreadable'); }
        $ad = (string)($att['authData'] ?? ''); $f = wa_authdata($ad);
        if (!($f['flags'] & 64)) { fail(400, 'Passkey: no key'); }
        $cl = unpack('n', substr($ad, 53, 2))[1]; $cid = substr($ad, 55, $cl); $o = 55 + $cl;
        try { $k = cbor_decode($ad, $o); } catch (Throwable $e) { fail(400, 'Passkey: unreadable key'); }
        if (($k[1] ?? null) !== 2 || ($k[3] ?? null) !== -7 || strlen((string)($k[-2] ?? '')) !== 32) { fail(400, 'Passkey: unsupported key type'); }
        $pem = ec_pub_pem("\x04" . $k[-2] . $k[-3]);
        $dev = mb_substr((string)($b['device'] ?? 'device'), 0, 40);
        with_lock(function () use ($cid, $pem, $f, $dev) { $w = wa_state(); $w['creds'][b64u($cid)] = ['pem' => $pem, 'count' => $f['count'], 'device' => $dev, 'created' => gmdate('c')]; write_json('webauthn.json', $w); }); key_set('wa', b64u($cid), $GLOBALS['UID']);
        out(200, ['ok' => true]);

    case 'wa-login-opts':
        if (empty(keys_map()['wa'])) { fail(404, 'No passkey yet'); }
        throttle_check();
        out(200, ['ok' => true, 'challenge' => wa_challenge('webauthn.get'), 'rpId' => wa_rpid(), 'allow' => []]);

    case 'wa-login':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        throttle_check(); $b = body(); $id = (string)($b['id'] ?? ''); $uid = keys_map()['wa'][$id] ?? '';
        if ($uid === '' || !isset(users()[$uid])) { throttle_hit(false); fail(401, 'Unknown passkey'); }
        use_user($uid); $w = wa_state(); $cred = $w['creds'][$id] ?? null;
        if (!$cred) { throttle_hit(false); fail(401, 'Unknown passkey'); }
        [$cdj] = wa_client((string)($b['clientDataJSON'] ?? ''), 'webauthn.get');
        $ad = b64u_dec((string)($b['authenticatorData'] ?? '')); $f = wa_authdata($ad);
        $ok = openssl_verify($ad . hash('sha256', $cdj, true), b64u_dec((string)($b['signature'] ?? '')), $cred['pem'], OPENSSL_ALGO_SHA256) === 1;
        if ($ok && $f['count'] > 0 && $f['count'] <= (int)$cred['count']) { $ok = false; }
        throttle_hit($ok); if (!$ok) { fail(401, 'Passkey check failed'); }
        with_lock(function () use ($id, $f) { $w = wa_state(); if (isset($w['creds'][$id])) { $w['creds'][$id]['count'] = $f['count']; $w['creds'][$id]['used'] = gmdate('c'); } write_json('webauthn.json', $w); });
        out(200, ['ok' => true, 'token' => issue_token((string)($b['device'] ?? 'passkey'), $uid), 'user' => user_public(users()[$uid], $uid)]);

    case 'wa-list':
        require_auth(); out(200, ['ok' => true, 'items' => array_map(fn($k, $v) => ['id' => $k, 'device' => $v['device'] ?? '', 'created' => $v['created'] ?? '', 'used' => $v['used'] ?? ''], array_keys(wa_state()['creds']), wa_state()['creds'])]);

    case 'wa-del':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_auth(); $b = body(); $id = (string)($b['id'] ?? '');
        with_lock(function () use ($id) { $w = wa_state(); unset($w['creds'][$id]); write_json('webauthn.json', $w); }); key_set('wa', '', '', $id);
        out(200, ['ok' => true]);

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

    /* ----- v10: AI and Google Calendar import ----- */
    case 'ai-config':
        require_owner();
        if ($method === 'POST') { $b = body(); with_lock(function () use ($b) { $s = read_json('system.json', []); $a = is_array($s['ai'] ?? null) ? $s['ai'] : [];
            $k = trim((string)($b['key'] ?? '')); if ($k === '-') { $a['key'] = ''; } elseif ($k !== '') { if (!preg_match('/^sk-ant-[A-Za-z0-9_\-]{20,}$/', $k)) { fail(400, 'That does not look like an Anthropic API key (sk-ant-…).'); } $a['key'] = $k; }
            $m = (string)($b['model'] ?? ''); if (in_array($m, ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'], true)) { $a['model'] = $m; }
            if (isset($b['daily'])) { $a['daily'] = max(1, min(500, (int)$b['daily'])); } $s['ai'] = $a; write_json('system.json', $s); }); }
        $a = ai_cfg(); out(200, ['ok' => true, 'hasKey' => !empty($a['key']), 'model' => $a['model'] ?? 'claude-opus-5-5', 'daily' => (int)($a['daily'] ?? 40)]);

    case 'ai':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_access(); $b = body(); $kind = (string)($b['kind'] ?? ''); $in = is_array($b['input'] ?? null) ? $b['input'] : [];
        $clip = fn($k, $n = 1500) => mb_substr(trim((string)($in[$k] ?? '')), 0, $n);
        if (!ai_quota()) { fail(429, 'Daily AI limit reached. It resets tomorrow.'); }
        $u = cur_user(); $name = (string)($u['name'] ?? '');
        if ($kind === 'cover') {
            $content = []; $cvs = cv_index(); if ($cvs && is_file(udir() . '/cv/' . $cvs[0]['file']) && $cvs[0]['type'] === 'application/pdf') { $content[] = ['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => base64_encode(file_get_contents(udir() . '/cv/' . $cvs[0]['file']))]]; }
            $content[] = ['type' => 'text', 'text' => "Job title: " . $clip('role', 200) . "\nCompany: " . $clip('company', 200) . "\nLocation: " . $clip('location', 200) . "\nJob ad:\n" . $clip('desc', 5000) . "\n\nWrite the email body of my application. Signed: " . $name];
            $r = ai_call("You write short, specific job application emails for the applicant whose CV is attached (if attached). 120-180 words, plain text, no subject line, no placeholders, no invented facts: use only experience that is in the CV. Mention two concrete matches between the CV and the ad. Friendly, confident, British English. End with a one-line sign-off and the applicant's name.", $content, 900);
        } elseif ($kind === 'micro') {
            $r = ai_call("You are a self-coaching assistant following the book Self-Coaching Blueprint: goals become daily micro-actions of 2 to 30 minutes. Reply with exactly 6 micro-actions, one per line, no numbering, no extra text. Each starts with a verb and is concrete and doable today.", [['type' => 'text', 'text' => "Life area: " . $clip('area', 80) . "\nKeyword: " . $clip('keyword', 80) . "\nGoal: " . $clip('goal', 300) . "\nAlready planned: " . $clip('have', 600)]], 500);
            if ($r['ok']) { $r['items'] = array_values(array_slice(array_filter(array_map(fn($l) => trim(preg_replace('/^[\-\*\d\.\)\s]+/', '', $l)), explode("\n", $r['text']))), 0, 6)); }
        } elseif ($kind === 'emi') {
            $r = ai_call("You are Emi, the warm, upbeat and slightly playful guide inside the ME.Coach self-coaching app (based on the book Self-Coaching Blueprint: Wheel of Life, 40-day goals, micro-actions, Morning and Night Balance). Answer in the user's language, in at most 90 words. Be practical: suggest one next step they can do in the app or in real life. You are not a therapist or doctor; for health, legal or crisis topics suggest a professional.", [['type' => 'text', 'text' => "About me (from the app): " . $clip('context', 1500) . "\n\nMy question: " . $clip('q', 800)]], 600);
        } elseif ($kind === 'report') {
            $r = ai_call("You are a self-coach writing a short end-of-cycle review for the Self-Coaching Blueprint 40-day cycle. Use only the data given. 4 short sections with headings: What went well, What held you back, Your patterns, Next 40 days (3 concrete suggestions). Under 220 words, plain text.", [['type' => 'text', 'text' => $clip('data', 6000)]], 900);
        } else { fail(400, 'Unknown AI request'); }
        if (!$r['ok']) { fail(502, $r['error']); }
        out(200, $r);

    case 'gcal-import':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_access(); $b = body(); $url = trim((string)($b['url'] ?? ''));
        if (!preg_match('#^https://calendar\.google\.com/calendar/ical/[^\s]+\.ics$#', $url)) { fail(400, 'Paste the “Secret address in iCal format” from Google Calendar settings.'); }
        $raw = http_req($url); if (!$raw || strpos($raw, 'BEGIN:VCALENDAR') === false) { fail(502, 'Could not read that calendar. Check the address.'); }
        $from = gmdate('Y-m-d', time() - 7 * 86400); $to = gmdate('Y-m-d', time() + 120 * 86400);
        out(200, ['ok' => true, 'events' => ics_parse($raw, $from, $to)]);

    /* ----- v12: coaching ----- */
    case 'coach-me':
        require_auth(); $uid = $GLOBALS['UID']; $u = cur_user();
        if ($method === 'POST') { $b = body(); if (isset($b['share'])) { with_lock(function () use ($uid, $b) { $us = users(); $us[$uid]['coachShare'] = !empty($b['share']); write_json('users.json', $us); }); $u = users()[$uid]; } }
        $el = coach_eligible($u); $c = coach_cfg(); $mine = array_values(array_filter(coach_bookings(), fn($x) => ($x['uid'] ?? '') === $uid && ($x['status'] ?? '') === 'booked' && strtotime((string)$x['at']) > time() - 3600));
        foreach ($mine as &$m) { $m['link'] = $c['link']; } unset($m);
        out(200, ['ok' => true, 'share' => !empty($u['coachShare']), 'eligible' => $el, 'slots' => $el ? coach_slots() : [], 'len' => (int)$c['len'], 'tz' => $c['tz'], 'mine' => $mine]);

    case 'coach-book':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_auth(); $uid = $GLOBALS['UID']; $u = cur_user(); if (!coach_eligible($u)) { fail(403, 'Booking is part of the Coaching plan.'); }
        $b = body(); $at = (string)($b['at'] ?? ''); if (!in_array($at, coach_slots(), true)) { fail(409, 'That time is no longer free. Pick another.'); }
        $mineN = count(array_filter(coach_bookings(), fn($x) => ($x['uid'] ?? '') === $uid && ($x['status'] ?? '') === 'booked' && strtotime((string)$x['at']) > time()));
        if ($mineN >= 2 && ($u['role'] ?? '') !== 'owner') { fail(429, 'You already have two upcoming sessions.'); }
        $rec = ['id' => new_id('bk'), 'uid' => $uid, 'name' => $u['name'] ?? '', 'email' => $u['email'] ?? '', 'at' => $at, 'len' => (int)coach_cfg()['len'], 'topic' => mb_substr(trim((string)($b['topic'] ?? '')), 0, 300), 'status' => 'booked', 'created' => gmdate('c')];
        with_lock(function () use ($rec) { $l = coach_bookings(); $l[] = $rec; write_json('bookings.json', array_slice($l, -2000)); });
        out(200, ['ok' => true, 'booking' => $rec + ['link' => coach_cfg()['link']]]);

    case 'coach-cancel':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_auth(); $uid = $GLOBALS['UID']; $own = (cur_user()['role'] ?? '') === 'owner'; $id = (string)(body()['id'] ?? '');
        $r = with_lock(function () use ($id, $uid, $own) { $l = coach_bookings(); foreach ($l as &$x) { if (($x['id'] ?? '') === $id && (($x['uid'] ?? '') === $uid || $own)) { if (!$own && strtotime((string)$x['at']) - time() < 24 * 3600) { return 'Sessions can be cancelled up to 24 hours before.'; } $x['status'] = 'cancelled'; $x['cancelled'] = gmdate('c'); write_json('bookings.json', $l); return ''; } } return 'Not found'; });
        if ($r !== '') { fail(400, $r); } out(200, ['ok' => true]);

    case 'coach-panel':
        require_owner();
        if ($method === 'POST') { $b = body();
            if (isset($b['config'])) { $cf = (array)$b['config']; with_lock(function () use ($cf) { $s = read_json('system.json', []); $c = coach_cfg();
                $c['days'] = array_values(array_unique(array_filter(array_map('intval', (array)($cf['days'] ?? $c['days'])), fn($d) => $d >= 0 && $d <= 6)));
                foreach (['from', 'to'] as $k) { if (preg_match('/^\d\d:\d\d$/', (string)($cf[$k] ?? ''))) { $c[$k] = $cf[$k]; } }
                $c['len'] = max(15, min(180, (int)($cf['len'] ?? $c['len']))); $lk = trim((string)($cf['link'] ?? '')); $c['link'] = preg_match('#^https://#', $lk) ? $lk : ''; $c['open'] = !empty($cf['open']);
                try { new DateTimeZone((string)($cf['tz'] ?? '')); $c['tz'] = (string)$cf['tz']; } catch (Throwable $e) { }
                $s['coach'] = $c; write_json('system.json', $s); }); }
            if (isset($b['client'])) { $id = (string)$b['client']; with_lock(function () use ($id, $b) { $us = users(); if (isset($us[$id])) { $us[$id]['coachClient'] = !empty($b['on']); write_json('users.json', $us); } }); }
            if (isset($b['note'])) { $id = (string)($b['uid'] ?? ''); $t = mb_substr(trim((string)$b['note']), 0, 2000); if ($t !== '' && isset(users()[$id])) { with_lock(function () use ($id, $t) { $n = read_json('coach-notes.json', []); $n[$id][] = ['at' => gmdate('c'), 'text' => $t]; write_json('coach-notes.json', $n); }); } }
        }
        $rows = []; foreach (users() as $id => $u) { if (($u['role'] ?? '') === 'owner') { continue; } if (empty($u['coachShare']) && empty($u['coachClient']) && ($u['planName'] ?? '') !== 'coach') { continue; } $rows[] = client_summary((string)$id, $u); }
        $up = array_values(array_filter(coach_bookings(), fn($x) => ($x['status'] ?? '') === 'booked' && strtotime((string)$x['at']) > time() - 3600)); usort($up, fn($a, $b) => strcmp($a['at'], $b['at']));
        $all = []; foreach (users() as $id => $u) { if (($u['role'] ?? '') !== 'owner') { $all[] = ['id' => $id, 'name' => $u['name'] ?? '', 'email' => $u['email'] ?? '', 'coachClient' => !empty($u['coachClient'])]; } }
        out(200, ['ok' => true, 'config' => coach_cfg(), 'clients' => $rows, 'upcoming' => $up, 'members' => $all]);

    /* ----- v12.1: restore a daily server backup (the current data is kept as a safety copy first) ----- */
    case 'backups':
        require_auth(); $rows = [];
        foreach (array_merge(glob(path('backups/store-*.json')) ?: [], glob(path('backups/before-restore-*.json')) ?: []) as $f) {
            $j = json_decode((string)file_get_contents($f), true); if (!is_array($j)) { continue; } $cnt = [];
            foreach (['tasks', 'goals', 'milestones', 'habits', 'logs', 'events', 'courses', 'applications'] as $k) { $cnt[$k] = count(array_filter((array)($j['collections'][$k] ?? []), fn($r) => is_array($r) && empty($r['deleted']))); }
            $rows[] = ['name' => basename($f), 'kind' => str_starts_with(basename($f), 'before-') ? 'safety' : 'daily', 'updatedAt' => $j['updatedAt'] ?? '', 'rev' => $j['rev'] ?? 0, 'kb' => round(filesize($f) / 1024), 'counts' => $cnt];
        }
        usort($rows, fn($a, $b) => strcmp((string)$b['updatedAt'], (string)$a['updatedAt']));
        $cur = load_store(); $cc = []; foreach (['tasks', 'goals', 'milestones', 'habits', 'logs', 'events', 'courses', 'applications'] as $k) { $cc[$k] = count(array_filter((array)($cur['collections'][$k] ?? []), fn($r) => is_array($r) && empty($r['deleted']))); }
        out(200, ['ok' => true, 'backups' => $rows, 'current' => ['updatedAt' => $cur['updatedAt'], 'rev' => $cur['rev'], 'counts' => $cc]]);

    case 'backup-restore':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_auth(); $name = (string)(body()['name'] ?? '');
        if (!preg_match('/^(store-\d{8}|before-restore-\d{8}-\d{6})\.json$/', $name) || !is_file(path('backups/' . $name))) { fail(404, 'Backup not found'); }
        $res = with_lock(function () use ($name) {
            $b = json_decode((string)file_get_contents(path('backups/' . $name)), true); if (!is_array($b) || !isset($b['collections'])) { return 'That backup file is damaged.'; }
            @copy(path('store.json'), path('backups/before-restore-' . gmdate('Ymd-His') . '.json'));
            $cur = load_store(); $now = now_ms();
            foreach ($b['collections'] as $c => &$recs) { if (!is_array($recs)) { continue; } foreach ($recs as &$r) { if (is_array($r)) { $r['updatedAt'] = $now; } } unset($r); }
            unset($recs);
            foreach (COLLECTIONS as $c) { foreach ((array)($cur['collections'][$c] ?? []) as $id => $r) { if (!isset($b['collections'][$c][$id]) && is_array($r)) { $r['deleted'] = true; $r['updatedAt'] = $now; $b['collections'][$c][$id] = $r; } } }
            $b['rev'] = (int)$cur['rev'] + 1; $b['updatedAt'] = gmdate('c'); write_json('store.json', $b); return '';
        });
        if ($res !== '') { fail(400, $res); }
        out(200, ['ok' => true]);

    case 'ava':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_access(); if (!ai_quota()) { fail(429, 'Daily AI limit reached. It resets tomorrow.'); }
        $b = body(); $msgs = []; foreach (array_slice((array)($b['messages'] ?? []), -12) as $m) { $r = ($m['role'] ?? '') === 'assistant' ? 'assistant' : 'user'; $t = mb_substr(trim((string)($m['content'] ?? '')), 0, 2000); if ($t !== '') { $msgs[] = ['role' => $r, 'content' => $t]; } }
        while ($msgs && $msgs[0]['role'] !== 'user') { array_shift($msgs); } if (!$msgs || end($msgs)['role'] !== 'user') { fail(400, 'Say something to Ava.'); }
        $u = cur_user(); $sys = AVA_SYSTEM . "\n\nUser: " . ($u['name'] ?? '') . ". " . ava_context(load_store()) . ' ' . mb_substr((string)($b['context'] ?? ''), 0, 800);
        $c = ai_cfg(); if (empty($c['key'])) { fail(502, 'AI is not set up yet. The owner adds the Anthropic API key in Settings → AI.'); }
        $first = array_shift($msgs); $r = ai_call_multi($sys, array_merge([$first], $msgs), 900);
        if (!$r['ok']) { fail(502, $r['error']); } out(200, $r);

    case 's-ava':
        shortcut_auth(); $q = shortcut_text(); if ($q === '') { plain('Ask me anything, for example: what should I focus on today?'); }
        if (!ai_quota()) { plain('We have reached today’s AI limit. Let’s talk tomorrow.'); }
        $u = cur_user(); $r = ai_call_multi(AVA_SYSTEM . "\nYou are answering by voice through Siri: plain sentences only, no lists or symbols, under 70 words.\n\nUser: " . ($u['name'] ?? '') . '. ' . ava_context(load_store()), [['role' => 'user', 'content' => $q]], 400);
        plain($r['ok'] ? str_replace(['• ', '*', '#'], ['', '', ''], $r['text']) : 'Sorry, I could not answer right now.');

    case 'invite':
        require_auth(); $u = cur_user(); $base = (is_https() ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '') . rtrim(dirname(strtok((string)($_SERVER['REQUEST_URI'] ?? ''), '?')), '/') . '/';
        $n = 0; foreach (users() as $x) { if (($x['referredBy'] ?? '') === $GLOBALS['UID']) { $n++; } }
        out(200, ['ok' => true, 'link' => $base . '?ref=' . ref_code($GLOBALS['UID']), 'joined' => $n, 'rewards' => (int)($u['refRewards'] ?? 0)]);

    case 'gift-config':
        require_owner(); $base = (is_https() ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '') . rtrim(dirname(strtok((string)($_SERVER['REQUEST_URI'] ?? ''), '?')), '/') . '/';
        if ($method === 'POST') { $b = body(); with_lock(function () use ($b) { $s = read_json('system.json', []); $g = gift_cfg(); $c = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($b['code'] ?? $g['code']))); if ($c !== '') { $g['code'] = substr($c, 0, 20); } $g['days'] = max(7, min(90, (int)($b['days'] ?? $g['days']))); $g['max'] = max(1, min(10000, (int)($b['max'] ?? $g['max']))); $g['on'] = !empty($b['on']); $s['gift'] = $g; write_json('system.json', $s); }); }
        $g = gift_cfg(); out(200, ['ok' => true, 'gift' => $g, 'link' => $g['code'] !== '' ? $base . '?gift=' . $g['code'] : '']);

    case 'gift-info':
        $g = gift_cfg(); $c = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($_GET['code'] ?? '')));
        out(200, ['ok' => true, 'valid' => !empty($g['on']) && $c !== '' && $c === strtoupper((string)$g['code']) && (int)$g['used'] < (int)$g['max'], 'days' => (int)$g['days']]);

    default:
        fail(404, 'Unknown action');
}
