<?php
/* Extracted from ME.Coach v14 api.php for ME Studio. Depends on ME.Coach helpers: read_json, write_json, with_lock, load_store, path, udir, users, cur_user, prefs_of, now_ms, new_id, backup_store, require_access, require_auth, require_owner, body, out, fail. */
/* Inside the cron action, after the push reminders: runs the daily search once per day for users who turned Autopilot on. */
        $jobsRun = 0; foreach (users() as $uid => $u) { if (!has_access($u)) { continue; } use_user($uid); $st = load_store(); $ap = prefs_of($st)['autopilot'] ?? []; if (empty($ap['on']) || empty($ap['titles'])) { continue; } $last = (string)(read_json('autopilot.json', [])['last'] ?? ''); if ($last !== '' && time() - strtotime($last) < 20 * 3600) { continue; } jobs_run(); $jobsRun++; }
        $tot['jobsRun'] = $jobsRun;
