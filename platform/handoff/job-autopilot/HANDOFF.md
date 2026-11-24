# Handoff: Work & Income module → ME Studio

From: ME.Coach v15 (this Claude account) · To: ME Studio (other Claude account) · 24 Nov 2026

ME.Coach is now focused only on the book *Self-Coaching Blueprint* (tests, goals, micro-actions, daily balance, learning path). Everything about **work and income** moves to ME Studio:

| Module | What it does | Moves as |
|---|---|---|
| **Job search + Autopilot** | Finds jobs daily, scores them, you approve, it emails your latest CV; Sprint for portal jobs; follow-ups | **Code + data** (this folder) |
| Products / sales | Your books, apps, courses and sales numbers | Data only (JSON) |
| Boards (Trello / Notion table) | Projects with To do / Doing / Waiting / Done | Data only (JSON) |
| Money | Savings balance history and savings goal | Data only (JSON) |

In ME.Coach these are **hidden, not deleted**. The old job page still opens at `#/jobs`. Autopilot keeps running there until you press **Settings → Work and income → Pause Autopilot**.

## 1. Move the data (5 minutes)
1. In ME.Coach (owner): **Settings → 📦 Work and income → Export**. You get `me-coach-work-income-YYYY-MM-DD.json`.
2. Download your CV from ME.Coach: old Job search page → Your CV → Download.
3. Give both files to ME Studio and import them (format below).
4. When Studio's version works, press **Pause Autopilot** in ME.Coach so the two don't both search.

### Export format
```json
{
  "app": "me-coach-work-income", "version": 1, "exportedAt": "ISO date",
  "applications": [ { "id", "role", "company", "location", "link", "source", "stage", "match", "contactEmail",
                      "desc", "salary", "posted", "foundOn", "appliedOn", "followUp", "fuCount", "sentTo", "sentAt", "cvSent",
                      "easy", "ext", "createdAt", "updatedAt" } ],
  "autopilot": { "on", "titles": [], "countries": ["gb","ie","nz","remote"], "skills": [], "exclude": [], "minScore": 40, "arbeitnow": false, "maxPerRun": 30 },
  "jobTpl": { "cover", "apply", "follow", "li" },   "jobTarget": 20,
  "products": [ { "id", "title", "type", "status", "price", "currency", "platform", "link", "launch", "notes", "sales": [ { "date", "units", "amount" } ] } ],
  "boards": [ { "id", "title", "notes", "view" } ],  "boardTasks": [ { "id", "title", "projectId", "state", "due", "priority", "nextAction", "korder" } ],
  "money": [ { "id", "date", "amount", "note" } ],  "savingsGoal": 4000, "currency": "OMR"
}
```
`stage` values: `Found` (waiting for approval), `Saved` (approved, apply on site), `Applied`, `Screening`, `Interview`, `Offer`, `Rejected`, `Withdrawn`.

## 2. The code (in this folder)
Plain PHP 8 + vanilla JS, extracted from ME.Coach. Each file says which ME.Coach helpers it relies on; ME Studio can keep the logic and replace those helpers with its own.

| File | Contains |
|---|---|
| `server/jobs-functions.php` | Sources (Adzuna UK/NZ, Reed UK, Jooble incl. Ireland, Remotive remote, Arbeitnow EU), `job_match` scoring, `jobs_run` (dedupe, adds `Found` jobs), CV index, `mail_with_file` (MIME email with the CV attached) |
| `server/jobs-endpoints.php` | `jobs-run`, `jobs-state`, `jobs-keys` (owner: API keys + sender email), `cv-upload`, `cv-get`, `jobs-send` (needs `approved: true`, 25/day cap, no double send, sets Applied + follow-up in 7 days), Siri `s-job` |
| `server/cron-snippet.php` | Daily search for users with Autopilot on (inside the 15-minute cron) |
| `server/ai-cover-letter.php` | Claude call (raw HTTP, model from settings, default Claude Haiku 5.5) + the cover-letter prompt that reads the CV PDF and the job ad |
| `client/jobs-core.js` | Templates, queue, stats, pipeline board, add jobs in bulk, the one-minute Sprint, follow-ups |
| `client/autopilot.js` | Autopilot screen: settings, CV upload, review queue, bulk approve, send sheet with approval tick, sent log, “Write it from my CV and this ad” |
| `client/jobs-actions.js` | Click and change handlers for the screens above |
| `client/jobs.css` | Styles (uses ME.Coach CSS variables) |

### Rules that must stay
- **Nothing is sent without an explicit approval** (`approved: true` + the tick in the UI). Max 25 emails a day. No double sending.
- Emails go from Milad's domain (e.g. `jobs@miladebrahimi.me`) with **Reply-To = Milad's own email**.
- LinkedIn / Indeed / company portals cannot be auto-submitted (their terms forbid it): those go to the Sprint (open link + copied cover note + mark applied).
- API keys stay on the server; never in chat or in the browser.

### Settings to recreate in Studio
- Sender mailbox (Hostinger Email) · Adzuna app ID/key · Reed key · Jooble key · Anthropic API key + daily cap · cron every 15 minutes.

## 3. Ideas for “more features” in ME Studio
- Tailor the **CV per job** (Claude rewrites the summary and top bullets for the ad; you approve).
- **Recruiter CRM**: contacts, last touch, next follow-up, LinkedIn message drafts.
- **Interview prep**: likely questions from the ad + STAR answers from your CV.
- **Weekly report**: applications, replies, interviews, best sources, salary range seen.
- Link to income goals: offers and salary feed Studio's income dashboard.
- Job alerts by email/Telegram for 80%+ matches.
