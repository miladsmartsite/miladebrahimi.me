<?php
/**
 * MILAD 2031 OS — data API (single file, no database server, no third-party service).
 * Storage: JSON files in DATA_DIR (default ./data, protected by .htaccess).
 * Auth: one owner password (bcrypt) -> random bearer tokens (stored hashed).
 * Sync: record-level merge, newest updatedAt wins; deletes are soft (deleted:true).
 */
declare(strict_types=1);

const APP_VERSION = '1.1.0';
const TOKEN_DAYS = 180;
const MAX_BODY = 8 * 1024 * 1024;          // 8 MB per request
const BACKUPS_KEEP = 30;                   // daily snapshots kept
const COLLECTIONS = ['tasks','events','projects','goals','skills','logs','evidence','decisions','notes','ielts','sessions','settings'];

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
const COOKIE = 'm2031_t';
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
    if (!is_dir(DATA_DIR . '/backups')) { @mkdir(DATA_DIR . '/backups', 0750, true); }
}
function path(string $name): string { return DATA_DIR . '/' . $name; }

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
function is_setup(): bool { $c = config(); return !empty($c['passwordHash']); }

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
function issue_token(string $device): string {
    $tok = bin2hex(random_bytes(32));
    set_auth_cookie($tok, TOKEN_DAYS);
    with_lock(function () use ($tok, $device) {
        $t = read_json('tokens.json', []); $now = time();
        $t = array_filter($t, fn($r) => ($r['exp'] ?? 0) > $now);
        $t[hash('sha256', $tok)] = ['exp' => $now + TOKEN_DAYS * 86400, 'device' => mb_substr($device, 0, 60), 'created' => gmdate('c')];
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
function token_valid(string $tok): bool {
    if ($tok === '') { return false; }
    $t = read_json('tokens.json', []); $r = $t[hash('sha256', $tok)] ?? null;
    return $r && ($r['exp'] ?? 0) >= time();
}
function require_auth(): string {
    $tok = bearer(); if ($tok === '') { fail(401, 'Not signed in'); }
    $t = read_json('tokens.json', []); $k = hash('sha256', $tok);
    if (empty($t[$k]) || ($t[$k]['exp'] ?? 0) < time()) { fail(401, 'Session expired'); }
    return $k;
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
        if ($cur === null || strcmp($newTs, $curTs) > 0) { $store['collections'][$c][$id] = $r; $applied++; }
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
    $L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MILAD 2031 OS//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:MILAD 2031", "X-WR-TIMEZONE:Asia/Muscat"];
    $stamp = gmdate('Ymd\THis\Z');
    $add = function (string $uid, string $title, string $start, ?string $end, bool $allDay, string $desc, ?string $rrule, array $ex, int $alarm) use (&$L, $stamp) {
        $L[] = 'BEGIN:VEVENT'; $L[] = 'UID:' . $uid . '@milad2031'; $L[] = 'DTSTAMP:' . $stamp;
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
        if (in_array($state, ['Completed & Verified', 'Completed - Not Verified', 'Cancelled'], true)) { continue; }
        if (!empty($t['scheduled'])) {
            $add('ts-' . $t['id'], (string)($t['title'] ?? 'Task'), (string)$t['scheduled'], $t['scheduledEnd'] ?? null, strlen((string)$t['scheduled']) === 10, 'Next action: ' . (string)($t['nextAction'] ?? ''), null, [], 15);
        }
        if (!empty($t['due']) && !empty($t['dueAlert'])) {
            $add('td-' . $t['id'], 'DUE: ' . (string)($t['title'] ?? 'Task'), (string)$t['due'], null, true, (string)($t['nextAction'] ?? ''), null, [], 0);
        }
    }
    $L[] = 'END:VCALENDAR';
    $out = '';
    foreach ($L as $line) { // fold at 74 octets
        while (strlen($line) > 74) { $cut = 74; while ($cut > 1 && (ord($line[$cut]) & 0xC0) === 0x80) { $cut--; } $out .= substr($line, 0, $cut) . "\r\n "; $line = substr($line, $cut); }
        $out .= $line . "\r\n";
    }
    return $out;
}

/* ---------- router ---------- */
ensure_dir();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($action) {
    case 'status':
        $tk = bearer(); $authed = token_valid($tk);
        out(200, ['ok' => true, 'setup' => is_setup(), 'authed' => $authed, 'token' => $authed ? $tk : null, 'version' => APP_VERSION, 'time' => gmdate('c')]);

    case 'setup':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        if (is_setup()) { fail(409, 'Already set up'); }
        $b = body(); $pw = (string)($b['password'] ?? '');
        if (mb_strlen($pw) < 10) { fail(400, 'Use at least 10 characters'); }
        with_lock(function () use ($pw) {
            if (is_setup()) { fail(409, 'Already set up'); }
            write_json('config.json', ['passwordHash' => password_hash($pw, PASSWORD_DEFAULT), 'icsKey' => bin2hex(random_bytes(20)), 'created' => gmdate('c')]);
            if (!is_file(path('store.json'))) { write_json('store.json', empty_store()); }
        });
        out(200, ['ok' => true, 'token' => issue_token((string)($b['device'] ?? 'device'))]);

    case 'login':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        if (!is_setup()) { fail(409, 'Not set up yet'); }
        throttle_check();
        $b = body(); $pw = (string)($b['password'] ?? ''); $c = config();
        $ok = password_verify($pw, (string)$c['passwordHash']);
        throttle_hit($ok);
        if (!$ok) { usleep(400000); fail(401, 'Wrong password'); }
        out(200, ['ok' => true, 'token' => issue_token((string)($b['device'] ?? 'device'))]);

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
        require_auth();
        $b = body(); $changes = $b['changes'] ?? [];
        if (!is_array($changes) || count($changes) > 5000) { fail(400, 'Bad changes'); }
        $res = with_lock(function () use ($changes) {
            $s = load_store(); $n = merge_changes($s, $changes);
            if ($n > 0) { backup_store(); $s['rev'] = (int)$s['rev'] + 1; $s['updatedAt'] = gmdate('c'); write_json('store.json', $s); }
            return [$s, $n];
        });
        out(200, ['ok' => true, 'applied' => $res[1], 'rev' => $res[0]['rev'], 'updatedAt' => $res[0]['updatedAt'], 'collections' => $res[0]['collections']]);

    case 'password':
        if ($method !== 'POST') { fail(405, 'POST only'); }
        require_auth(); throttle_check();
        $b = body(); $c = config();
        if (!password_verify((string)($b['current'] ?? ''), (string)$c['passwordHash'])) { throttle_hit(false); fail(401, 'Current password is wrong'); }
        $np = (string)($b['next'] ?? ''); if (mb_strlen($np) < 10) { fail(400, 'Use at least 10 characters'); }
        with_lock(function () use ($np) { $c = config(); $c['passwordHash'] = password_hash($np, PASSWORD_DEFAULT); write_json('config.json', $c); write_json('tokens.json', []); });
        out(200, ['ok' => true, 'token' => issue_token('after-password-change')]);

    case 'icskey':
        require_auth();
        if (($_GET['rotate'] ?? '') === '1' && $method === 'POST') {
            with_lock(function () { $c = config(); $c['icsKey'] = bin2hex(random_bytes(20)); write_json('config.json', $c); });
        }
        out(200, ['ok' => true, 'key' => config()['icsKey'] ?? '']);

    case 'ics':
        $key = (string)($_GET['k'] ?? ''); $c = config();
        if ($key === '' || empty($c['icsKey']) || !hash_equals((string)$c['icsKey'], $key)) { http_response_code(404); exit; }
        header('Content-Type: text/calendar; charset=utf-8');
        header('Content-Disposition: inline; filename="milad2031.ics"');
        echo ics_feed(load_store()); exit;

    default:
        fail(404, 'Unknown action');
}
