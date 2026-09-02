# Case Study Content System

Content-strategy and evidence-classification document — not final copy, not published anywhere.
Built entirely from `content-brief.md`, `master-profile.md`, and `project-evidence.md`. Nothing
below is invented; where evidence doesn't support a field, it says so rather than guessing.

**Purpose of this file:** decide *what could eventually be said publicly*, and *what absolutely
cannot*, for each of the five confirmed real projects — before any case study is drafted.

---

## How to read each record

- **Evidence Strength** — how solid the underlying documentation is (`Strong / Good / Moderate / Weak`).
- **Authorship Evidence** — how directly the evidence ties the work to Milad (`Explicit / Supported / Unconfirmed`).
- **Publicity Status** — the current gating state (`PUBLIC / PRIVATE / PUBLIC WITH REDACTION / NEEDS APPROVAL`).
- Every fact in "The Story" carries an implicit source — see `project-evidence.md` for the exact
  file and quote. Nothing here restates a fact `project-evidence.md` didn't already establish.
- **Publication Safety** items are the actual gate before any of this becomes a public page.

---

# 1. Operations Dashboard

```
Project:            Operations Dashboard
Category:           Systems / Executive Reporting / Business Intelligence
Company / Context:  Tathmeer Development Company (client-facing work delivered via
                     Perla Engineering & Design — both attributions appear in source files)
Milad's Role:       Explicitly named as preparer/owner in two internal documents
Time Period:        Documented "Week 1–2, August 2026"; some initiative dates read "Jul 2026"
                     (unresolved discrepancy vs. CV's Aug 2026 Tathmeer start date)

Evidence Strength:   Strong
Authorship Evidence: Explicit
Publicity Status:    NEEDS APPROVAL
```

### The Story

**Context:** Tathmeer ran roughly 19 active construction projects, tracked through monthly Excel
reports with no single consolidated management view.

**Problem:** No one document or dashboard let management see portfolio status, risk, or KPIs
across all projects at once — visibility depended on manually reassembling separate Excel reports.

**Challenge:** Building a live reporting layer fast (a 4-week roadmap), without introducing a
parallel platform, while simultaneously running discovery interviews across 9 departments (7
completed in the same window) to understand what each department actually needed reported.

**Role:** Two internal documents explicitly credit Milad as preparer: *"Prepared by Milad,
Operations"* (TBOS Command Center) and *"Prepared by Milad, Perla Engineering & Design"*
(Document & Systems Library). Specific deliverables carry individual `owner: Milad` tags,
including the Group Management Review, the Tathmeer Project & Operations Library, and the
Subcontractor Performance Scorecard.

**Approach:** Ran structured department-discovery sessions before building anything; designed a
28-entity data model ("one formula, one owner, per field") to sit behind every dashboard and KPI;
chose to build a lightweight Google Sheets/Drive reporting layer on top of the existing Odoo
target rather than standing up new software.

**System:** A GM Executive Dashboard (all projects), per-group dashboards (three project groups),
a 6-parameter weighted Subcontractor Performance Scorecard, and an interactive, filterable Group
Management Review tool.

**Workflow:** Department-level data feeds the shared data model; the data model feeds the
dashboards and scorecard; validated data becomes eligible for the weekly/monthly executive review
and Chairman-level decisions.

**Tools:** Google Sheets and Google Drive as the reporting layer, built with an explicit path
toward deeper Odoo integration (Tathmeer's ERP).

**Implementation:** In the documented two-week window alone: 16 frameworks/roadmaps produced
across 6 categories, 5 dashboards delivered, 7 discovery sessions run, 3 role/org proposals
drafted.

**Outcome:** Three KPI figures appear, each explicitly attributed to Milad as owner —
**Management Visibility: 100% actual vs. 100% target**; **Employee Productivity: +18% actual vs.
+20% target** (source file itself marks this "estimated"); **Cost Saving: OMR 3,100 actual vs.
OMR 5,000/quarter target** (also marked "estimated"). These are the only measurable figures found
anywhere across all five projects' evidence — but two of the three are explicitly self-labeled
estimates, not measured results, and must never be presented otherwise.

**Evidence:** Two separate internal documents with direct, first-person-style authorship
attribution — the strongest evidence of the five projects.

**Visual Evidence:** Chairman-facing dashboard screens, a categorized systems-delivered index,
and value-creation cards with before/after framing — all exist as designed HTML documents.

**Lessons:** Not explicitly stated by Milad anywhere in the source material. A generic,
evidence-adjacent observation (e.g., "a lightweight layer over existing tools can replace a
parallel platform") could be *proposed* to Milad for confirmation, but nothing should be written
as "what Milad learned" without him saying it directly. `[NEEDS MILAD INPUT]`

### Publication Safety

| Item | Status |
| --- | --- |
| Naming Tathmeer as a client/employer context | SAFE TO PUBLISH |
| Naming Perla Engineering as employer | SAFE TO PUBLISH |
| General narrative ("consolidated 19 projects into one dashboard, replacing manual Excel") | PUBLIC WITH REDACTION |
| The two source documents themselves, or verbatim screenshots of them | DO NOT PUBLISH — both are marked "Internal / Confidential" and "For Chairman Review" in the files themselves |
| Specific project codes/names (e.g. individual project identifiers, delay reasons) | DO NOT PUBLISH — third-party client operational data |
| Named project managers, subcontractors, or their contact details | DO NOT PUBLISH — third-party employee/vendor names |
| The three KPI figures (100% / +18% / OMR 3,100) | NEEDS COMPANY APPROVAL — drawn from an internal, confidentiality-marked document; two of three are self-labeled estimates |
| Dashboard screenshots as visual evidence | NEEDS COMPANY APPROVAL — would need to be recreated with placeholder data or explicitly cleared by Tathmeer, not used as-is |
| Internal URLs / credentials | None found — N/A |

### Proposed Headlines (factual, not final copy)

1. "Replacing nineteen Excel reports with one management view"
2. "Building a live reporting layer without introducing a new platform"
3. "From department discovery to a Chairman-ready dashboard in two weeks"

### Quality Score

| Dimension | Score /10 | Why |
| --- | --- | --- |
| Evidence strength | 9 | Two independent documents, itemized deliverables |
| Authorship confidence | 9 | Explicit "Prepared by Milad" in both |
| Story clarity | 7 | Clear before/after arc |
| Visual potential | 8 | Rich dashboard/report visuals exist |
| Measurable outcome | 5 | Real figures exist but self-labeled "estimated" and confidential |
| Publicity safety | 3 | Explicitly confidential; real third-party client data embedded |
| **Average** | **6.8** | Best-evidenced project; currently the most publication-constrained |

---

# 2. Material Request System

```
Project:            Material Request System
Category:           Systems / Process Automation / Procurement
Company / Context:  Perla Engineering
Milad's Role:       Not explicitly named as builder in any file; strong circumstantial fit
Time Period:        Real generated documents dated 2026-05-24 and 2026-06-08; script at
                     version 3.0 (no dates for v1/v2)

Evidence Strength:   Strong
Authorship Evidence: Supported
Publicity Status:    PUBLIC WITH REDACTION
```

### The Story

**Context:** Perla Engineering's site engineers needed a way to request materials that could be
tracked, costed, and approved — not just asked for verbally or over WhatsApp.

**Problem:** The separate "Operations Manager Daily System" document requires every material
request to be "approved or returned with reason within 4 hours" — a rule that only makes sense if
requests are logged somewhere trackable, which points at this system as the mechanism that made
that rule enforceable.

**Challenge:** Making cost, urgency, and required-approval-level visible automatically from a
simple form submission — without deploying new procurement software.

**Role:** No file states outright "built by Milad." The build spec and the Apps Script code live
in a folder named "Milad OS & Automation" (Milad's own folder, not a client-named one), and the
script contains a Persian-language code comment — consistent with Milad's native language per his
CV. This is stronger circumstantial evidence than folder-location alone, but still not an
explicit byline.

**Approach:** Digitized the request as a Google Form, auto-processed submissions with Apps
Script, and generated a numbered, structured PDF per request rather than relying on manual
paperwork.

**System:** A Google Form (project, requester, role, up to 10 material line items) feeding a
"MRF Log" Google Sheet that auto-calculates total cost, earliest required date, days remaining,
procurement risk, and the required approval level, driving a status field
(`Pending Ops Review → Ops Approved → Finance Approved → GM Approved → Returned/Rejected →
Ordered → Delivered`).

**Workflow:** Engineer submits → auto-logged and calculated → routed to Operations Manager →
Finance Manager if above a cost threshold → General Manager if above a higher threshold (both
explicitly waived on the smaller real example seen: "Not required for this amount").

**Tools:** Google Forms, Google Sheets, Google Apps Script (`onFormSubmit` trigger, direct
HTML-to-PDF generation), Google Drive as a PDF archive.

**Implementation:** A real, working, numbered document series exists
(e.g. `MRF-2026-AHMEDM-007`), generated by a script already at its third revision — a genuinely
deployed system, not just a design spec.

**Outcome:** No before/after metric is stated anywhere (e.g. no processing-time or volume figure).

**Evidence:** The strongest *technical build* evidence of the five projects — versioned
automation code plus real generated output matching the spec exactly.

**Visual Evidence:** The generated MRF PDF (branded, structured, with a status badge and
signature/approval table) — but the actual samples contain a real requester name, a real project
name, and the company's real contact details.

**Lessons:** Not explicitly stated. The fact the script is versioned "v3.0" implies real
iteration, which could become a genuine "what changed and why" story — but only with Milad's
input on what v1/v2 actually were. `[NEEDS MILAD INPUT]`

### Publication Safety

| Item | Status |
| --- | --- |
| Naming Perla Engineering as employer | SAFE TO PUBLISH |
| General system narrative (Form → Sheet → Script → auto-generated PDF, tiered approval) | SAFE TO PUBLISH |
| The real MRF PDF samples as-is (requester name, project name, company phone/email) | DO NOT PUBLISH as-is |
| A redacted or recreated version of the MRF PDF with placeholder data | PUBLIC WITH REDACTION — recommended path for visual evidence |
| The actual Apps Script source code | NEEDS COMPANY APPROVAL — it's operational tooling built for a specific employer's process |
| Screenshots of the real "MRF Log" Google Sheet | DO NOT PUBLISH — would expose other real requests, costs, and names |
| Internal URLs / credentials | None found — N/A |

### Proposed Headlines (factual, not final copy)

1. "Turning a verbal material request into a self-tracking approval chain"
2. "Calculating procurement risk before a request is even reviewed"
3. "From a Google Form to a numbered, auditable request system"

### Quality Score

| Dimension | Score /10 | Why |
| --- | --- | --- |
| Evidence strength | 8 | Versioned code + real generated documents |
| Authorship confidence | 6 | Strong circumstantial fit, no explicit byline |
| Story clarity | 8 | Clear, self-contained "what was built" narrative |
| Visual potential | 6 | Real PDF exists but needs redaction or recreation |
| Measurable outcome | 2 | No outcome metric stated anywhere |
| Publicity safety | 6 | System description is safe; real artifacts need redaction |
| **Average** | **6.0** | Best combination of solid evidence and a tractable publication path |

---

# 3. Daily Site Reporting System

```
Project:            Daily Site Reporting System
Category:           Systems / Field Operations / Reporting
Company / Context:  Two related systems — a real, in-use version at Perla Engineering, and a
                     separate Tathmeer-specific Odoo prototype ("Built with Perla Engineering &
                     Design")
Milad's Role:       Not explicitly named in either system's files
Time Period:        Real usage log spans 21 May 2026 – early Jun 2026; prototype's internal
                     reference date is 23 Aug 2026

Evidence Strength:   Good
Authorship Evidence: Unconfirmed
Publicity Status:    NEEDS REDACTION
```

### The Story

**Context:** Site engineers across several Perla Engineering projects reported progress
informally; separately, Tathmeer relied on manual monthly Excel consolidation with no daily-level
digital input.

**Problem:** No standardized daily capture of site activity existed that could reliably feed
higher-level reporting; for Tathmeer specifically, the stated goal was for "daily inputs from
this system [to] become the source data" for the existing Group Management Review, replacing
manual monthly consolidation.

**Challenge:** Keeping the daily form simple enough for a site engineer to actually complete
every day, while producing data structured enough to support a technical-review-then-approval
chain before anything reaches management.

**Role:** Not stated in either the real-system files or the prototype. The prototype's reviewing
role is generically labeled "the Operations Manager" — matching Milad's title, not naming him.

**Approach:** The real, in-use version is a simple Google Form/Sheet workflow with a WhatsApp
photo-confirmation checkbox as a lightweight compliance mechanism. The separate prototype is a
structured, role-based wizard (discipline → category → KPI/activity → location → schedule →
actual status → manpower/notes → photo evidence) built directly from Tathmeer's real monthly-
report categories and signed construction schedule.

**System:** Real version: Google Form → Sheet → a "Daily Report Clean View" tab. Prototype:
a defined data model (report date, activity, location, submission/review/approval timestamps, a
WhatsApp-shared flag) targeting a future Odoo implementation.

**Workflow:** Real version: engineer submits, confirms a site photo was shared in the project
WhatsApp group. Prototype: Site Engineer submits → Project Engineer technical review (no approval
authority) → Project Manager validates and approves → only then eligible for management
dashboards, monthly reports, and WhatsApp distribution.

**Tools:** Real version: Google Forms, Sheets, WhatsApp, Google Drive for photos. Prototype
targets Odoo and the WhatsApp Business API — explicitly not yet integrated ("not connected to
live Odoo, WhatsApp Business API, or production data").

**Implementation:** The real system is actively used — logged submissions from five named site
engineers across roughly seven different project sites over at least three weeks. The prototype
is a complete, functional interactive demo, not a live system.

**Outcome:** No before/after metric stated for either version.

**Evidence:** A genuine multi-week, multi-engineer usage log for the real system, plus a fully
built interactive prototype for the Tathmeer version.

**Visual Evidence:** The prototype's role-based screens (role picker, submission wizard, PM
approval view, executive dashboards, a WhatsApp message preview) are polished and demo-ready —
but the file embeds real Tathmeer portfolio data throughout (see Publication Safety).

**Lessons:** Not explicitly stated.

### Publication Safety

| Item | Status |
| --- | --- |
| Naming Perla Engineering / Tathmeer as general employer/client context | SAFE TO PUBLISH |
| General workflow narrative (daily form → photo confirmation → review chain) | PUBLIC WITH REDACTION |
| Real engineer names appearing in the usage log (five individuals) | DO NOT PUBLISH |
| Real project/site names in the usage log (e.g. specific villa/building project names) | DO NOT PUBLISH |
| Real Tathmeer portfolio data embedded in the prototype (project codes, PM names, subcontractor names, delay details) | DO NOT PUBLISH — the most sensitive material found across all five projects |
| The prototype's UI/UX pattern and workflow structure, decoupled from real data | PUBLIC WITH REDACTION — would need a rebuild with placeholder data, not a screenshot of the file as-is |
| Odoo / WhatsApp Business API integration plans, described generally | PUBLIC WITH REDACTION |
| Internal URLs / credentials | None found — N/A |

### Proposed Headlines (factual, not final copy)

1. "Making a missing site report impossible to overlook"
2. "One photo, one checkbox: the smallest compliance rule that actually works"
3. "Designing a daily report structured enough for a dashboard to trust"

### Quality Score

| Dimension | Score /10 | Why |
| --- | --- | --- |
| Evidence strength | 7 | Real usage log + complete prototype |
| Authorship confidence | 4 | No byline in either system's files |
| Story clarity | 6 | Two related-but-distinct systems complicate one narrative |
| Visual potential | 8 | Rich, polished prototype UI |
| Measurable outcome | 2 | No outcome metric stated |
| Publicity safety | 3 | Prototype embeds substantial real third-party client data |
| **Average** | **5.0** | Good raw material, but the richest visual asset is also the least publishable as-is |

---

# 4. Project Operations System

```
Project:            Project Operations System
Category:           Systems / Management Operating System
Company / Context:  Perla Engineering
Milad's Role:       Not explicitly named; content matches Milad's CV title exactly
Time Period:        No date stated in the document

Evidence Strength:   Good
Authorship Evidence: Unconfirmed
Publicity Status:    NEEDS COMPANY APPROVAL
```

### The Story

**Context:** Perla Engineering needed a defined, repeatable daily operating rhythm for the
Operations Manager role, spanning site execution, materials, finance, and cross-department
coordination.

**Problem:** Not narrated as a before/after story in the source document — it's written as a
standing operating manual, not a retrospective — but its tone ("if you missed any of these, it
was not a full day") implies it was written to establish discipline and consistency.

**Challenge:** Coordinating site execution, materials/procurement, finance, and cross-department
issues on a single daily cycle, with clear-cut decision authority (e.g. specific OMR purchase
thresholds requiring GM sign-off) so nothing is ambiguous.

**Role:** Not stated. The entire document is written in the voice of "the Operations Manager" —
Milad's actual title at Perla Engineering — but never states who authored it.

**Approach:** Codified an hour-by-hour daily schedule, a full one-page job description ("what you
own / support / are not responsible for"), a decision-authority matrix, and five named Google-
Sheets-based "control instruments," plus a specific enforcement protocol for missed reports or
untracked work.

**System:** The daily schedule, the five control instruments (daily report log, project progress
tracker, cost tracker, issue log, weekly WhatsApp summary), the job description, and the
enforcement rules, functioning together as one operating system for the role.

**Workflow:** An hour-by-hour cycle (site reports by 8:00 → materials review by 10:30 → finance
by 12:00 → cross-department coordination by 1:00 → site follow-up 2–4pm → evening reports and
day close by 5:00), plus a weekly cadence (Sunday GM summary and cost reconciliation, Monday
engineer briefing, Thursday next-week planning).

**Tools:** Google Sheets (all five control instruments), WhatsApp (seven distinct communication
channels/audiences are explicitly documented).

**Implementation:** Reads as an already-enforced system (specific currency thresholds, specific
escalation timing, a real enforcement ladder for missed reports), not a proposal.

**Outcome:** No before/after metric stated.

**Evidence:** One detailed, internally consistent five-page document.

**Visual Evidence:** A well-designed hour-by-hour schedule table, a one-page printable daily
checklist, a full job-description page, and a control-system/enforcement diagram.

**Lessons:** Not explicitly stated.

### Publication Safety

| Item | Status |
| --- | --- |
| Naming Perla Engineering as employer | SAFE TO PUBLISH |
| General narrative ("codified a daily operating rhythm and decision-authority system") | PUBLIC WITH REDACTION |
| The document itself, or verbatim screenshots | DO NOT PUBLISH — every page is footer-marked "Confidential" |
| Specific OMR approval thresholds and escalation policy details | NEEDS COMPANY APPROVAL |
| Communication-channel table (who gets told what, and when) | NEEDS COMPANY APPROVAL — internal operating policy |
| Internal URLs / credentials | None found — N/A |

### Proposed Headlines (factual, not final copy)

1. "Turning an operations title into an hour-by-hour system"
2. "One page, no ambiguity: defining what an operations role actually owns"
3. "Building the decision-authority rules so escalation stops being a judgment call"

### Quality Score

| Dimension | Score /10 | Why |
| --- | --- | --- |
| Evidence strength | 7 | One detailed, internally consistent document |
| Authorship confidence | 4 | No byline; role/title match only |
| Story clarity | 7 | Clear, well-organized structure |
| Visual potential | 7 | Well-designed multi-page layout |
| Measurable outcome | 1 | No outcome stated anywhere |
| Publicity safety | 3 | Explicitly marked "Confidential" throughout |
| **Average** | **4.8** | Solid document, but explicitly gated by its own confidentiality marking |

---

# 5. Marketing & Lead Operations System

```
Project:            Marketing & Lead Operations System
Category:           Systems / Marketing Operations
Company / Context:  Perla Engineering
Milad's Role:       Not explicitly named; matches CV Marketing Manager dates (Aug 2025–Feb 2026)
Time Period:        No date stated in the document

Evidence Strength:   Moderate
Authorship Evidence: Unconfirmed
Publicity Status:    NEEDS COMPANY APPROVAL
```

### The Story

**Context:** Perla Engineering needed one role to own both content production and lead capture,
rather than treating marketing as ad hoc campaign work.

**Problem:** Not narrated explicitly, but the system's emphasis on "log every lead within 1
hour" and "never miss a follow-up" implies leads were previously at risk of falling through the
cracks before hand-off to Sales.

**Challenge:** Keeping content authentic (an explicit rule: "never post content that didn't
happen") while still hitting a defined lead-volume target, and making sure qualified leads
reached Sales with enough context to act on, not just a name.

**Role:** Not stated by name. The role described matches Milad's CV title, "Marketing Manager,"
at the same company and overlapping dates.

**Approach:** Split the role into two explicitly owned tracks — Content (what gets posted) and
Marketing (how leads are captured and handed off) — each with its own daily/weekly cadence and
explicit do's and don'ts.

**System:** A Google Sheet lead tracker (status: new / contacted / meeting / lost) with reply
templates and a weekly lead report to the GM, paired with a content calendar with category rules
and a GM-approval gate for sensitive posts (first-time client property photos, named
testimonials, paid campaigns).

**Workflow:** Lead arrives → logged within 1 hour → replied to within 2 hours using a template →
qualified leads passed to Sales the same day with full context → any lead unanswered after 24
hours is followed up → a weekly summary (total leads, source, status) goes to the GM.

**Tools:** Google Sheets (lead tracking), WhatsApp (Sales hand-off, GM reporting), social media
(specific platforms not named in the file) for content distribution.

**Implementation:** Reads as an active system with a stated internal success bar — "≥15 new
leads per month from social media" and "the lead sheet is always updated."

**Outcome:** No outcome figure is stated in this file. Critically — and checked explicitly — **the
CV's "+30% lead generation" result attributed to Perla Engineering does not appear in this file,
or in any file reviewed.** It cannot be connected to this system without Milad's direct
confirmation.

**Evidence:** One detailed operating-manual document; no corroborating outcome data anywhere
else in the reviewed files.

**Visual Evidence:** A structured weekly content-calendar grid and content-category definitions —
presentable, and less identity-sensitive than the other four projects' visual material.

**Lessons:** Not explicitly stated.

### Publication Safety

| Item | Status |
| --- | --- |
| Naming Perla Engineering as employer | SAFE TO PUBLISH |
| General narrative ("built a system connecting content output to lead capture and Sales hand-off") | PUBLIC WITH REDACTION |
| The internal lead-volume target ("≥15/month") | NEEDS COMPANY APPROVAL — an internal performance target |
| The content-approval policy (what needs GM sign-off) | NEEDS COMPANY APPROVAL — internal operating policy |
| Content-calendar grid / category structure, genericized | PUBLIC WITH REDACTION |
| Internal URLs / credentials | None found — N/A |

### Proposed Headlines (factual, not final copy)

1. "Giving every lead a one-hour clock and a place to live"
2. "One role, two jobs: connecting content output to the sales pipeline"
3. "Making 'never post what didn't happen' an operating rule, not a slogan"

### Quality Score

| Dimension | Score /10 | Why |
| --- | --- | --- |
| Evidence strength | 6 | One solid document, no corroboration elsewhere |
| Authorship confidence | 4 | Title/date match only |
| Story clarity | 7 | Clear two-track structure |
| Visual potential | 5 | Presentable but modest visual material |
| Measurable outcome | 1 | CV's own metric explicitly not traceable to this system |
| Publicity safety | 5 | Internal targets need approval; no third-party names found |
| **Average** | **4.7** | Weakest ownership signal of the five; CV metric can't be borrowed to strengthen it |

---

# Comparison Table

| # | Project | Evidence | Authorship | Publicity | Avg. Score |
| --- | --- | --- | --- | --- | --- |
| 1 | Operations Dashboard | Strong | Explicit | NEEDS APPROVAL | 6.8 |
| 2 | Material Request System | Strong | Supported | PUBLIC WITH REDACTION | 6.0 |
| 3 | Daily Site Reporting System | Good | Unconfirmed | NEEDS REDACTION | 5.0 |
| 4 | Project Operations System | Good | Unconfirmed | NEEDS COMPANY APPROVAL | 4.8 |
| 5 | Marketing & Lead Operations System | Moderate | Unconfirmed | NEEDS COMPANY APPROVAL | 4.7 |

# Which Project Should Become Case Study #1

**Recommendation: Material Request System.**

By raw evidence score, Operations Dashboard ranks highest (6.8 vs. 6.0) — and it has the single
best authorship evidence of the five, with two documents directly crediting Milad by name. But
its publication path is the hardest of the five: both source documents are explicitly marked
"Internal / Confidential" and "For Chairman Review," and the surrounding data includes real
third-party client operational detail (project delays, named subcontractors, project managers)
that isn't Milad's to disclose regardless of who prepared the dashboard. Clearing that would
require Tathmeer's explicit sign-off, not just Milad's.

The Material Request System has almost the same evidence strength, a genuinely self-contained
"what was built" story, and — critically — its main publication obstacle is *redacting personal/
contact details from example documents*, not clearing an entire body of work with a client
company. That's a problem Milad can solve directly (recreate the PDF with placeholder data, or
get simple internal sign-off from Perla Engineering that the *system design* itself isn't
confidential), rather than one that depends on a third party's approval process. It's also the
only one of the five with zero third-party (client-side) exposure risk in its core evidence.

# What's Still Missing for Case Study #1

1. **Direct confirmation Milad designed and built this system** — the form, the sheet structure,
   and the Apps Script — rather than it being someone else's work in his folder.
2. **What v1 and v2 looked like, and why they were revised** — the version number implies a real
   iteration story, but only Milad can supply it.
3. **Any measurable outcome** — volume of requests processed, approval-time change, error/
   rejection rate, anything that turns "we built a system" into "here's what changed."
4. **Explicit permission to use a redacted or recreated version of the MRF PDF** as visual
   evidence, or agreement to build a placeholder-data mockup instead.
5. **Confirmation from Milad (and ideally Perla Engineering) that the system design itself is not
   considered proprietary** — the documents aren't marked confidential, but that's an absence of
   a marking, not an explicit clearance.

# Evidence Safe to Use Publicly (across all five, right now)

- That Milad has worked at Perla Engineering and Tathmeer, in the roles and date ranges stated on
  his CV.
- The general *type* of problem each system solved (fragmented reporting, ad hoc material
  requests, inconsistent daily site reporting, an undefined operations rhythm, disconnected
  marketing and sales) — described generically, without company-specific numbers or names.
- The general *shape* of each solution (Google Forms/Sheets/Apps Script automation, a dashboard
  consolidating multiple data sources, a documented daily operating system, a lead-to-sales
  handoff process) — again, described generically.

# Evidence That Requires Approval or Redaction

- Every document explicitly marked "Confidential" or "For Chairman Review" (Operations Dashboard,
  Project Operations System) — needs company approval before any direct reference, screenshot, or
  quote.
- Every real name found in the evidence that isn't Milad's — engineers, project managers,
  subcontractors, specific client project names/codes — must never appear in public copy.
- Every specific internal number found (KPI targets/actuals, OMR thresholds, lead-volume targets)
  — needs company approval, and where a source file itself labels a figure "estimated," that
  caveat must travel with it if ever used.
- The real generated documents (MRF PDFs, the DSR CSV, the Tathmeer prototype's embedded
  portfolio data) — none should be used as-is; only redacted/recreated versions with placeholder
  data are candidates for public visual evidence.

---

**Not done, per instructions:** no visual design changes, no homepage changes, no content
published or inserted into any page, no final website copy written, no confidential information
exposed.
