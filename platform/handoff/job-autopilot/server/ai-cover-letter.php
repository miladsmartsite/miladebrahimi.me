<?php
/* Extracted from ME.Coach v14 api.php for ME Studio. Depends on ME.Coach helpers: read_json, write_json, with_lock, load_store, path, udir, users, cur_user, prefs_of, now_ms, new_id, backup_store, require_access, require_auth, require_owner, body, out, fail. */
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

/* The cover-letter branch of the ai endpoint (input: role, company, location, desc; attaches the latest CV PDF): */
        if ($kind === 'cover') {
            $content = []; $cvs = cv_index(); if ($cvs && is_file(udir() . '/cv/' . $cvs[0]['file']) && $cvs[0]['type'] === 'application/pdf') { $content[] = ['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => base64_encode(file_get_contents(udir() . '/cv/' . $cvs[0]['file']))]]; }
            $content[] = ['type' => 'text', 'text' => "Job title: " . $clip('role', 200) . "\nCompany: " . $clip('company', 200) . "\nLocation: " . $clip('location', 200) . "\nJob ad:\n" . $clip('desc', 5000) . "\n\nWrite the email body of my application. Signed: " . $name];
            $r = ai_call("You write short, specific job application emails for the applicant whose CV is attached (if attached). 120-180 words, plain text, no subject line, no placeholders, no invented facts: use only experience that is in the CV. Mention two concrete matches between the CV and the ad. Friendly, confident, British English. End with a one-line sign-off and the applicant's name.", $content, 900);
}
