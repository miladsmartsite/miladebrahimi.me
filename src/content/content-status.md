# Content Status — Internal Tracking

Internal documentation only. Not rendered on the public site (lives in `src/content/` alongside
`content-brief.md`, `master-profile.md`, `project-evidence.md`, and `case-study-index.md` — none
of these are wired into any page or collection). This file tracks, section by section, what's
actually confirmed versus what's provisional positioning copy written for V1.

**Status legend:**
- **CONFIRMED** — explicitly stated by Milad or present in the CV/project evidence.
- **SUPPORTED** — strongly implied by project files, not explicitly attributed to Milad by name.
- **PROVISIONAL** — positioning language, framing, or synthesis written for the site; not a
  factual claim.
- **NEEDS VERIFICATION** — should eventually be replaced with more specific evidence.

---

## Identity & Positioning

| Item | Status | Note |
| --- | --- | --- |
| Name, current roles, companies, dates | CONFIRMED | From CV |
| "Building better ways for businesses to work" | PROVISIONAL | Strategic direction, not a verified claim |
| Hero headline / subhead | PROVISIONAL | Written for V1, may be revised |
| "Multidisciplinary operator" framing | PROVISIONAL | Synthesis of CV career arc, not a CV quote |
| Practice areas (7 themes) framing as Practice/Experience/Focus | PROVISIONAL | Framing decision made for V1 pending Milad's own evaluation per `content-brief.md` §5 |

## Career History

| Item | Status | Note |
| --- | --- | --- |
| All 7 role/date/location entries | CONFIRMED | Verbatim from CV |
| Role responsibilities/initiatives per role | NEEDS VERIFICATION | CV gives titles/dates, not day-to-day detail — homepage/CV copy stays at CV-level detail only |
| DOB, marital status, nationality, phone | EXCLUDED | Per privacy rule — never transcribed anywhere in this project |

## The Five Systems (Case Studies)

| Item | Status | Note |
| --- | --- | --- |
| That Milad personally built all five | CONFIRMED | Milad's own direct statement, independent of per-file evidence |
| Operations Dashboard — system description, deliverables list | CONFIRMED | Two files explicitly attribute this to Milad by name |
| Operations Dashboard — specific KPI figures (100% / +18% / OMR 3,100) | EXCLUDED FROM PUBLIC SITE | Source document explicitly marked "Internal/Confidential" + two of three figures self-labeled "estimated" — not published per `case-study-index.md` |
| Material Request System — system description, workflow | SUPPORTED | Strong circumstantial fit (Milad's own automation folder, Persian code comment), no explicit byline |
| Material Request System — outcome/metrics | NEEDS VERIFICATION | No outcome metric found in any file |
| Daily Site Reporting System — system description, workflow | SUPPORTED | Real usage log + prototype exist; no byline |
| Daily Site Reporting System — outcome/metrics | NEEDS VERIFICATION | None found |
| Project Operations System — system description | SUPPORTED | Matches CV title exactly; document itself marked "Confidential" |
| Project Operations System — outcome/metrics | NEEDS VERIFICATION | None found |
| Marketing & Lead Operations System — system description | SUPPORTED | Matches CV title/dates |
| Marketing & Lead Operations System — outcome/metrics | NEEDS VERIFICATION | CV's +30% figure explicitly could NOT be traced to this system in any file — kept separate, see Results below |
| All confidential/third-party details (client project codes, subcontractor names, PM names, other employee names) | EXCLUDED FROM PUBLIC SITE | Never appear anywhere in site copy |

## Results (CV-stated)

| Item | Status | Note |
| --- | --- | --- |
| Perla Engineering: "Increased lead generation by 30% with a refined content strategy and stronger brand visuals" | CONFIRMED (CV-stated) | Presented as a CV-stated result, NOT attributed to the Marketing & Lead Operations System case study — no evidence connects the two |
| SKYLAND Holding: "Boosted monthly inquiries by 40% through targeted social media campaigns" | CONFIRMED (CV-stated) | Same treatment |
| Noor Alyaqoot: "Improved engagement by 55% with structured content calendars and optimized Instagram posts" | CONFIRMED (CV-stated) | Same treatment |
| Perla Engineering: "Designed and implemented operational systems that improved reporting, accountability, and process efficiency across departments" | CONFIRMED (CV-stated) | Qualitative, no percentage — kept as-is, no number invented |
| Self-Employed (Iran): "Applied 6 years of marketing experience..." | CONFIRMED (CV-stated) | Duration claim, not an outcome — used only on /cv, not homepage Results |

## Books

| Item | Status | Note |
| --- | --- | --- |
| Titles, languages, years, descriptions for all 3 books | CONFIRMED | Verbatim from CV |
| Self-Coaching Blueprint subtitle + cover concept (yellow cover, "A Repeatable Plan...") | CONFIRMED | Visible in CV; no actual cover image file has been supplied to the project, so the site uses a typographic treatment, not the real cover image |
| Time Engineering / The Balance Book covers | NEEDS VERIFICATION | No cover exists/was supplied for either |
| Purchase/read links for all 3 | NEEDED | Not yet provided |

## Ideas (Articles)

| Item | Status | Note |
| --- | --- | --- |
| Topic categories (Operations, Systems, Productivity, AI, Marketing, Business, Construction/RE) | CONFIRMED | Directly from this project's own instructions |
| Specific article titles/content | PROVISIONAL — "coming soon" framing | No real articles exist; entries are explicitly badged Placeholder and framed as topics in development, not finished pieces |

## Speaking

| Item | Status | Note |
| --- | --- | --- |
| Any past speaking engagement | NONE EXISTS | No fabricated engagements added — the two old fake placeholder entries were removed |
| Topics Milad could speak/write about | PROVISIONAL | Reasonable topics derived from the confirmed practice areas and systems work — not a claim that any talk has happened |

## Resources

| Item | Status | Note |
| --- | --- | --- |
| Any real resource | NEEDED | None exist yet; page kept in "coming soon" state |

## Contact

| Item | Status | Note |
| --- | --- | --- |
| Public email address (miladsmartsite@gmail.com) | CONFIRMED | Explicitly confirmed by Milad for public use — used on `/contact`, and no other address from the CV or project files should ever be published |
| LinkedIn (linkedin.com/in/miladebrahimi-me) | CONFIRMED | Explicitly confirmed by Milad — used on `/contact`, in the footer, and in the Person JSON-LD `sameAs` field |
| Topics open for conversation on `/contact` | PROVISIONAL | Phrasing written for the page; the six topic areas themselves are CONFIRMED (Milad's own list) |

## About / Personal narrative

| Item | Status | Note |
| --- | --- | --- |
| Career arc (education → marketing → operations → systems) | CONFIRMED | Structurally matches CV role progression |
| Specific personal philosophy / "how I think" language | PROVISIONAL | Written for V1 in a restrained, evidence-consistent voice; not a direct Milad quote |

---

## What changed in this build (V1)

- Replaced all placeholder project entries with the five confirmed real systems.
- Replaced the single placeholder experience entry with the seven real CV-sourced roles.
- Replaced the two placeholder book entries with the three real CV-sourced books.
- Removed the two fake "Talk Title" speaking placeholders — speaking now leads with honestly-
  framed topics rather than invented engagements.
- Softened article placeholders to read as "topics in development," not finished-sounding titles.
- Added `/cv` as a new page, built from `master-profile.md` with the same privacy exclusions
  applied throughout this project.
