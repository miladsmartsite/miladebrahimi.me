<?php
/**
 * ME.Coach — data API (single file, no database server, no third-party service).
 * Storage: JSON files in DATA_DIR (default ./data, protected by .htaccess); one folder per user in data/u/<id>.
 * Auth: email + password (bcrypt) or passkey -> random bearer tokens (stored hashed). 7-day free trial, then subscription.
 * Sync: record-level merge, newest updatedAt wins; deletes are soft (deleted:true).
 */
declare(strict_types=1);

const APP_VERSION = '6.0.0';
const TRIAL_DAYS = 7;
const GLOBAL_FILES = ['users.json', 'tokens.json', 'attempts.json', 'keys.json', 'system.json', '.lock', 'webauthn-chal.json'];
const TOKEN_DAYS = 180;
const MAX_BODY = 8 * 1024 * 1024;          // 8 MB per request
const BACKUPS_KEEP = 30;                   // daily snapshots kept
const COLLECTIONS = ['tasks','events','projects','goals','skills','logs','evidence','decisions','notes','ielts','sessions','settings','milestones','applications','immigration','habits','money','templates','courses','areas','wheel','cycles','focus','products'];
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
    return ['id' => $uid, 'email' => $u['email'] ?? '', 'name' => $u['name'] ?? '', 'role' => $u['role'] ?? 'user', 'plan' => $plan, 'access' => has_access($u), 'trialEnds' => !empty($u['trialEnds']) ? gmdate('c', (int)$u['trialEnds']) : null, 'paidUntil' => !empty($u['paidUntil']) ? gmdate('c', (int)$u['paidUntil']) : null, 'created' => $u['created'] ?? null];
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

/* ---------- router ---------- */
if (defined('M2031_LIB')) { return; }
ensure_dir();
if (PHP_SAPI === 'cli') { $_GET['action'] = $argv[1] ?? ''; }
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($action) {
    case 'status':
        $tk = bearer(); $uid = token_uid($tk); $u = $uid !== '' ? users()[$uid] : null;
        out(200, ['ok' => true, 'setup' => is_setup(), 'passkey' => !empty(keys_map()['wa']), 'authed' => $uid !== '', 'token' => $uid !== '' ? $tk : null, 'user' => $u ? user_public($u, $uid) : null, 'trialDays' => TRIAL_DAYS, 'version' => APP_VERSION, 'time' => gmdate('c')]);

    case 'signup':
    case 'setup':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        throttle_check();
        $b = body(); $email = strtolower(trim((string)($b['email'] ?? ''))); $pw = (string)($b['password'] ?? ''); $name = mb_substr(trim((string)($b['name'] ?? '')), 0, 60);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { fail(400, 'Enter a valid email address'); }
        if (mb_strlen($pw) < 8) { fail(400, 'Use at least 8 characters for the password'); }
        $uid = with_lock(function () use ($email, $pw, $name) {
            $us = users(); foreach ($us as $u) { if (($u['email'] ?? '') === $email) { fail(409, 'This email already has an account. Sign in instead.'); } }
            $uid = bin2hex(random_bytes(10)); $owner = count($us) === 0;
            $us[$uid] = ['email' => $email, 'name' => $name, 'passHash' => password_hash($pw, PASSWORD_DEFAULT), 'role' => $owner ? 'owner' : 'user', 'created' => gmdate('c'), 'trialEnds' => time() + TRIAL_DAYS * 86400, 'paidUntil' => 0];
            write_json('users.json', $us); return $uid;
        });
        throttle_hit(true);
        use_user($uid); write_json('store.json', empty_store());
        $ics = bin2hex(random_bytes(20)); write_json('config.json', ['icsKey' => $ics, 'created' => gmdate('c')]); key_set('ics', $ics, $uid);
        out(200, ['ok' => true, 'token' => issue_token((string)($b['device'] ?? 'device'), $uid), 'user' => user_public(users()[$uid], $uid)]);

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
        out(200, ['ok' => true, 'users' => $rows]);

    case 'admin-set':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_owner(); $b = body(); $id = (string)($b['id'] ?? ''); $days = (int)($b['days'] ?? 0);
        $r = with_lock(function () use ($id, $days) {
            $us = users(); if (!isset($us[$id])) { fail(404, 'No such user'); } if (($us[$id]['role'] ?? '') === 'owner') { fail(400, 'The owner always has access'); }
            if ($days > 0) { $us[$id]['paidUntil'] = max(time(), (int)($us[$id]['paidUntil'] ?? 0)) + $days * 86400; } else { $us[$id]['paidUntil'] = 0; $us[$id]['trialEnds'] = min((int)($us[$id]['trialEnds'] ?? 0), time()); }
            write_json('users.json', $us); return user_public($us[$id], $id);
        });
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
        out(200, ['ok' => true, 'rev' => $s['rev'], 'updatedAt' => $s['updatedAt'], 'collections' => $s['collections']]);

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
        out(200, ['ok' => true, 'applied' => $res[1], 'rev' => $res[0]['rev'], 'updatedAt' => $res[0]['updatedAt'], 'collections' => $res[0]['collections']]);

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

    default:
        fail(404, 'Unknown action');
}
