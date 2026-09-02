# Project Evidence

Evidence-gathering only. Sourced from files in `C:\Users\milad\Downloads` (and subfolders), inspected
2026-09-02 with Milad's permission. This file records what the files actually say — it does not
decide what goes on the website, and nothing here should be treated as final case-study copy.

**Label legend used throughout:**
- `[EXPLICITLY STATED]` — the file says this in so many words (a name, a date, a byline, a quoted line).
- `[SUPPORTED BY FILE]` — reasonably drawn from the file's content/structure, not a direct quote.
- `[NEEDS CONFIRMATION]` — plausible but the file doesn't settle it; ask Milad.
- `[INFERENCE — DO NOT USE AS FACT]` — my own connecting-the-dots; explicitly flagged as unsafe to publish as-is.

**Important caution honored throughout:** a file living in a "Tathmeer" or "PERLA"-named folder is
not by itself treated as evidence that Milad built it — company-named folders just mean the file is
*about* that company. Attribution to Milad is only made where the file itself says so, or where
another file explicitly attributes it to him.

---

## 1. Daily Site Reporting System

**Files:**
- `Tathmeer_Daily_Site_Report_Prototype.html` (Downloads root, 2026-08-23)
- `Tathmeer Reports/DSR_Tathmeer_57_1970-01-01.html`
- `Other/PERLA/PERLA – Daily Site Report System - Daily Report Clean View.csv`
- `Other/PERLA/perla_dsr_guide.html`, `Other/PERLA/perla_dsr_automation.html`
- `Other/Milad OS & Automation/daily_site_report_system_v2.html` (not opened in detail — see Evidence Gaps)

**Company:** Two distinct but related systems appear under this name:
1. A **Perla Engineering**-branded, already-operating Daily Site Report process
   `[EXPLICITLY STATED — CSV header and DSR_Tathmeer_57 file both carry "PERLA ENGINEERING & DESIGN" branding]`
2. A **Tathmeer**-specific interactive prototype for a *future* Odoo-based version of the same
   concept, explicitly noted as "Built with Perla Engineering & Design"
   `[EXPLICITLY STATED — footer text in Tathmeer_Daily_Site_Report_Prototype.html]`

**Role:** Not explicitly named as Milad's in either file. The prototype's own internal comment
says the workflow was designed around real Tathmeer source documents; the "Daily Site Reporting
System" project name Milad confirmed matches this workflow closely.
`[NEEDS CONFIRMATION — no line in either file names Milad as builder]`

**Timeline:**
- CSV rows span **21/05/2026 – at least early June 2026** `[EXPLICITLY STATED — CSV timestamps]`
- Prototype file's internal "TODAY" reference date is **2026-08-23** `[EXPLICITLY STATED]`

**Purpose:** Standardize daily site reporting: engineer submits a report (work done, plan for
tomorrow, workers on site, materials needed, issues) and confirms at least one site photo was
shared in the project WhatsApp group. `[EXPLICITLY STATED — CSV column headers and PDF-style
output field in DSR_Tathmeer_57 file]`

**Problem (as stated by the prototype file itself):** Tathmeer currently consolidates monthly
progress manually from Excel; the prototype's stated goal is for "daily inputs from this system
[to] become the source data for that review, replacing manual monthly Excel consolidation."
`[EXPLICITLY STATED]`

**Workflow:**
- Real, already-running version (Perla Engineering, CSV): Google Form (implied by field
  structure) → responses land in a Sheet → "Daily Report Clean View" tab. Engineer fills in
  work completed, plan for tomorrow, workers on site, optional photo links (Google Drive), and
  confirms WhatsApp sharing. `[SUPPORTED BY FILE]`
- Prototype version (Tathmeer): Site Engineer submits → Project Engineer technical review (no
  approval authority) → Project Manager validates/approves → only then eligible for management
  dashboards, monthly reports, and WhatsApp distribution.
  `[EXPLICITLY STATED — role definitions and workflow diagram in the prototype file]`

**Tools:** Real version: Google Forms + Google Sheets (implied by CSV structure and the guide
file's explicit "Google Form → Sheet → Clean View → Auto Report" pipeline label), WhatsApp for
distribution, Google Drive for photo storage. `[EXPLICITLY STATED — perla_dsr_guide.html]`
Prototype's intended production target: **Odoo** ERP + **WhatsApp Business API** — explicitly
"not connected to live Odoo, WhatsApp Business API, or production data" as of the prototype.
`[EXPLICITLY STATED]`

**Implementation:** Real-world engineers submitting reports in the CSV include **Fawaz, Shahzad,
Helmi, Anas, Abdulrahman** across multiple project sites (Tathmeer 57, 3 Villa, Ahmed Memari, Sky
King, New Perla Office, and others) — none of these submitters is Milad.
`[EXPLICITLY STATED — none of these names is Milad; do not attribute the reports themselves to him]`
The guide document assigns the reviewing/enforcement role to "the Operations Manager" — a title
that matches Milad's CV role at Perla Engineering, but the guide itself never uses his name.
`[NEEDS CONFIRMATION]`

**Outcome:** No measurable outcome is stated in any of these files (no before/after numbers, no
adoption rate, no time-saved figure). `[EXPLICITLY STATED — absence noted, not invented]`

**Evidence:** The CSV is a real response export with dozens of dated rows across several
projects — strong evidence the *process itself* is genuinely in use at Perla Engineering, distinct
from the Tathmeer prototype which is explicitly a demo/reference build.

**Visual evidence:** The prototype HTML is a fully built, role-based interactive UI (login/role
picker, a multi-step Site-Engineer submission wizard, PM/PE review screens, OPS/GM/Chairman
dashboard views, a WhatsApp-message preview mockup, and a documented data model) — strong
candidate for case-study screenshots once permission/context is confirmed.

**Open questions:**
- Did Milad personally build the real Perla Engineering Google Form/Sheet system, the Tathmeer
  Odoo prototype, both, or neither (e.g., a colleague built one)?
- Is the real (CSV) system and the Tathmeer prototype the same "Daily Site Reporting System"
  Milad confirmed, or should these be treated as two related-but-separate systems?
- No outcome/adoption metric exists yet in any reviewed file — needed before this can be a case
  study with a real "outcome."

---

## 2. Project Operations System

**Files:**
- `Other/PERLA/Perla Engineering — Daily Operations System.pdf` (5 pages)
- `Other/PERLA/Perla Engineering — Detailed Daily Operations Manual.pdf` (not opened in full — see gaps)
- `Other/PERLA/perla_daily_ops_system.html` (not opened — likely web version of the same PDF)
- `Tathmeer Reports/Tathmeer_Construction_Operating_System_v11.html` (not opened in full — see gaps)
- `Tathmeer Reports/Tathmeer_Project_Execution_Progress_Control_System.pdf/.html`

**Company:** Perla Engineering (explicit letterhead: "PERLA ENGINEERING — Operations Manager —
Daily Schedule & Routine"). `[EXPLICITLY STATED]`

**Role:** The entire 5-page document is written in the voice of, and job-description for, "the
Operations Manager" — Milad's actual CV title at Perla Engineering (Mar 2026–Present) — but the
document itself never states "written by Milad Ebrahimi." `[NEEDS CONFIRMATION]`

**Timeline:** No creation date printed on the document itself. `[NEEDS CONFIRMATION]`

**Purpose (stated in the document itself):** "The Operations Manager ensures every project is
executed on time, within budget, with full documentation — by controlling the site team,
materials flow, and inter-department coordination daily." `[EXPLICITLY STATED — verbatim]`

**Problem:** Not stated as a "before" problem narrative — the document is written as an
operating manual/job description, not a case study, so there's no explicit "problem we had"
framing to quote. `[EXPLICITLY STATED — absence noted]`

**Workflow (explicitly documented):** A full hour-by-hour daily schedule (7:30 AM prep → 8:00 AM
site report review → 9:00 AM materials/procurement review → 10:30 AM finance/admin →
12:00 PM cross-department coordination → 14:00 afternoon site follow-up → 16:00 evening
reports/day close), plus weekly responsibilities (Sunday GM summary + cost reconciliation, Monday
engineer briefing, Thursday next-week planning), a full job description with "what you own /
support / are not responsible for," a decision-authority matrix (e.g., MRF approval under OMR 50
is Ops-alone; OMR 500+ needs GM), and 5 named "control instruments": daily report log, project
progress tracker, cost tracker, issue log, and weekly WhatsApp ops summary — all in Google Sheets.
`[EXPLICITLY STATED — verbatim from the PDF]`

**Tools:** Google Sheets (named explicitly for all 5 control instruments), WhatsApp (for daily
communication with site/management/finance/sales), physical/verbal Site Instruction Forms (SIFs).
`[EXPLICITLY STATED]`

**Implementation:** The document reads as an already-in-use operating system (specific OMR
currency thresholds, specific escalation timings, an enforcement protocol for missed reports),
not a proposal or draft. `[SUPPORTED BY FILE]`

**Outcome:** No measurable before/after outcome stated — the document defines the standard, not a
result of applying it. `[EXPLICITLY STATED — absence noted]`

**Evidence:** Internally consistent with the CV's Perla Engineering result ("Designed and
implemented operational systems that improved reporting, accountability, and process efficiency
across departments") — the control instruments described here are exactly reporting/
accountability/process-efficiency mechanisms — but the CV result is not explicitly linked to this
document by name in either source. `[NEEDS CONFIRMATION]`

**Visual evidence:** The PDF is a designed, multi-page document with color-coded schedule blocks,
a communication-channel table, a decision-authority table, and a one-page printable daily
checklist — usable as case-study visual material.

**Open questions:**
- Confirm authorship (was this written by Milad, for himself or for the role generally?).
- Is this the same thing Milad means by "Project Operations System," or is that a different,
  more technical/database-oriented system (the Tathmeer files reference a separate "28-entity
  data model" — see Operations Dashboard section below, which may be the better fit for that name)?

---

## 3. Material Request System

**Files:**
- `Other/Milad OS & Automation/Perla_MRF_System.md`
- `Other/Milad OS & Automation/Perla_MRF_AppsScript_v3.js`
- `Other/PERLA/MRF-2026-AHMEDM-007-20260608.pdf`, `Other/PERLA/MRF-2026-TWINVI-005-20260524.pdf`
- `Other/PERLA/PERLA – Request Management System - Request Master Log.pdf`
- `Archives/PERLA – Request Management System.zip` (not opened — archive)

**Company:** Perla Engineering. `[EXPLICITLY STATED — MRF PDFs carry "PERLA ENGINEERING,
info@perlaengineering.com, +968 9676-2502, Muscat Hills, Muscat, Oman" footer]`

**Role:** Not explicitly named as built by Milad in the spec or script files themselves.
However: the build spec and Apps Script code live in a folder named **"Milad OS & Automation"**
(Milad's own folder, not a client-named one), and the Apps Script file contains a Persian-language
code comment (`// اختیاری — ایمیل ops manager`, "optional — ops manager email") — consistent with
Milad's stated native language (Persian, per CV) writing his own code. This is meaningfully
stronger circumstantial evidence than a client-folder location would be, but is still not an
explicit byline. `[NEEDS CONFIRMATION — no explicit "written by Milad" line in the files]`

**Timeline:** Script is versioned "v3.0" — implying at least two prior iterations.
`[EXPLICITLY STATED]` No dates given for when v1/v2/v3 were built. `[NEEDED]`
Real MRF documents are dated 2026-05-24 and 2026-06-08. `[EXPLICITLY STATED]`

**Purpose:** Digitize and control the material-request process: engineers request materials via a
Google Form, the request is auto-numbered, costed, and risk-scored, and routed through an
approval chain before procurement. `[EXPLICITLY STATED — spec document]`

**Problem:** Not narrated in the spec (it's a build spec, not a case study), but the *Perla
Engineering — Daily Operations System* document (see Project Operations System, above) states the
Ops Manager must "review all pending MRFs — approve or reject with reason within 4 hours" — i.e.
this system existed to make that reviewable/trackable. `[SUPPORTED BY FILE, cross-referenced]`

**Workflow (explicitly specified):** Google Form (Project, Requested By, Role, up to 10 line
items with description/unit/qty/required date/urgency/est. cost/preferred supplier) → Google
Sheet "MRF Log" auto-calculates total cost, earliest required date, days left, procurement risk,
and required approval level → status moves through `Pending Ops Review → Ops Approved → Finance
Approved → GM Approved → Returned/Rejected → Ordered → Delivered` → a PDF is generated per
request. `[EXPLICITLY STATED — verbatim column/field spec]`
The real PDF sample confirms an approval chain of **Operations Manager → Finance Manager →
General Manager**, with Finance/GM approval explicitly waived for smaller amounts ("Not required
for this amount"). `[EXPLICITLY STATED — MRF-2026-AHMEDM-007 PDF]`

**Tools:** Google Forms, Google Sheets, Google Apps Script (`onFormSubmit` trigger, HTML→PDF
generation "no Google Docs template needed" per the v3 script header), Google Drive (PDF
archive folder named "MRF PDF Archive"). `[EXPLICITLY STATED]`

**Implementation:** A real, working, numbered document series exists
(`MRF-2026-AHMEDM-007`, `MRF-2026-TWINVI-005`) — this is a deployed system generating real
procurement documents, not just a design spec. `[EXPLICITLY STATED]`

**Outcome:** No stated before/after metric (e.g., no "requests processed 3x faster" claim
anywhere). `[EXPLICITLY STATED — absence noted]`

**Evidence:** Strongest technical build-evidence of the five projects — an actual versioned
automation script plus real generated output documents, matching the spec exactly.

**Visual evidence:** The generated MRF PDF itself (branded, structured, with status badges and a
signature/approval table) is strong, ready-to-use case-study visual material.

**Open questions:**
- Direct confirmation that Milad wrote the Apps Script and designed the form/sheet structure.
- What v1/v2 looked like and why they were revised (a "lessons learned" angle for a case study).
- Any real numbers on volume (how many MRFs processed) or approval-time improvement.

---

## 4. Operations Dashboard

**Files:**
- `Tathmeer Reports/Tathmeer_TBOS_Command_Center.html` (+ 3 numbered revisions)
- `Tathmeer Reports/Tathmeer_Document_Systems_Library.html` (+ 4 numbered revisions)
- `Tathmeer Reports/Tathmeer_Group_Management_Review.html` (+ numbered revisions, not opened in full)
- `Tathmeer Reports/Tathmeer_Subcontractor_Performance_Scorecard.html`
- `Other/PERLA/perla_dashboard_user_guide.html` (not opened in detail)
- `Other/PERLA/Perla Engineering — KPIs & Cost Control System.pdf` (not opened in detail)
- *(Explicitly excluded: `Other/Milad OS & Automation/MILAD_COMMAND_CENTER_Dashboard*.html` — this
  is Milad's **personal** life/productivity dashboard ("Personal Operating System · Mission
  Control," sections on workouts, career/migration, personal finance). It is not a company
  operations project and should not be used as evidence for this item.)*

**Company:** Tathmeer (Development Company / Tathmeer Properties). `[EXPLICITLY STATED]`

**Role:** **This is the strongest-evidenced project of the five.** The TBOS Command Center file's
footer reads: *"Prepared by Milad, Operations"* `[EXPLICITLY STATED — direct quote]`. The
Document & Systems Library file's footer reads: *"Prepared by Milad, Perla Engineering & Design ·
Generated 2026-08-16"* `[EXPLICITLY STATED — direct quote]`. Multiple specific initiatives inside
the TBOS file carry explicit `owner: 'Milad'` tags, including:
- "Group Management Review — Consolidated Executive View" — owner Milad, Aug 2026, status
  "Implemented" `[EXPLICITLY STATED]`
- "Tathmeer Project & Operations Library v0.1" — owner Milad, Aug 2026, status "Live v0.1"
  `[EXPLICITLY STATED]`
- "Subcontractor Performance Scorecard" — owner Milad, Aug 2026, status "Implemented"
  `[EXPLICITLY STATED]`
- "Standardized Monthly Project Reporting (EV Methodology)" — owner "Milad + Project Managers,"
  Jul–Aug 2026, status "Implemented" `[EXPLICITLY STATED]`
- "Business Operations Manager — Role Proposal" — appears in the Document & Systems Library as a
  role proposal *drafted during this work*, suggesting Milad's formal Tathmeer title may have
  resulted from work he did before/alongside the "Trial" period on his CV.
  `[SUPPORTED BY FILE — cross-referenced with CV title]`

**Timeline:** Document & Systems Library explicitly covers "Week 1–2, August 2026" of Milad's
engagement at Tathmeer, dated **2026-08-16**. `[EXPLICITLY STATED]` Some individual initiative
dates inside the TBOS file read "Jul 2026" — slightly earlier than the CV's stated Tathmeer start
date of Aug 2026. `[NEEDS CONFIRMATION — possible informal start before the "Trial" date, or a
date inconsistency]`

**Purpose:** A consolidated, single-view "Business Operating System" (TBOS) covering portfolio
status, KPIs, risks, and value-creation tracking for Tathmeer's ~19 active construction projects,
replacing manual monthly Excel consolidation. `[EXPLICITLY STATED]`

**Problem:** The Document & Systems Library frames the starting point as fragmented, manual,
Excel-based monthly reporting with no consolidated management view.
`[SUPPORTED BY FILE — "replacing manual monthly Excel consolidation" language recurs across files]`

**Workflow / system architecture:** A documented "28-entity data model behind every dashboard and
KPI — one formula, one owner, per field," built as "a lightweight reporting layer on top of Odoo
— live in 4 weeks, no parallel ERP, no new platform," feeding a GM Executive Dashboard (all
projects), per-group dashboards (Bousher/Al Seeb/Mega), the Subcontractor Performance Scorecard,
and the Group Management Review tool. `[EXPLICITLY STATED — Document & Systems Library]`

**Tools:** Explicitly targets integration with **Odoo** (Tathmeer's ERP) via a Google
Drive/Sheets reporting layer rather than a new platform. `[EXPLICITLY STATED]`

**Implementation:** Per the Library document: **16 frameworks/roadmaps produced, 6 categories
covered, 5 dashboards delivered, 7 discovery sessions run, 3 role/org proposals drafted, in the
first two weeks alone.** `[EXPLICITLY STATED — KPI row in the document]`

**Outcome / measurable results (explicitly attributed to Milad in the TBOS file's KPI section):**
- **Management Visibility:** target 100%, actual 100%, defined as "% of active projects visible
  in one consolidated management view," source "Group Management Review," owner Milad, status
  "🟢 Good." `[EXPLICITLY STATED]`
- **Employee Productivity:** target +20%, actual +18% (marked "estimated"), defined as "reduction
  in reporting/admin cycle time vs prior method," owner Milad, status "🟡 Watch."
  `[EXPLICITLY STATED, but the file itself labels this figure "estimated," not measured — do not
  present as a confirmed hard metric]`
- **Cost Saving:** target OMR 5,000/quarter, actual OMR 3,100 (marked "estimated"), owner Milad +
  Finance, status "🟡 Watch." `[EXPLICITLY STATED, same "estimated" caveat as above]`

**Evidence:** The strongest and most self-documented project of the five — two internal
documents both carry explicit "Prepared by Milad" attribution, and per-initiative ownership tags
throughout.

**Visual evidence:** The TBOS Command Center and Document & Systems Library are both fully
designed, chairman-facing documents (KPI cards, value-creation cards with before/after framing,
a categorized systems index, trend indicators) — excellent case-study visual candidates, though
they may need Tathmeer's permission to display externally given "Internal / Confidential" /
"For Chairman Review" markings on the documents themselves.

**Open questions:**
- The "Employee Productivity" and "Cost Saving" figures are explicitly self-labeled "estimated"
  in the source file — confirm whether these are usable publicly as estimates (clearly labeled as
  such) or should be omitted until independently verified.
- Confirm whether "Operations Dashboard" (the name Milad confirmed) refers to this TBOS/Group
  Management Review body of work specifically, or something narrower.
- These documents are marked "Internal / Confidential" and "For Chairman Review" — confirm
  whether/how this can be referenced publicly at all before any case study is drafted.

---

## 5. Marketing & Lead Operations System

**Files:**
- `Other/PERLA/perla_marketing_content_system.html`
- `Other/Personal/Milad_LinkedIn_Growth_Dashboard.md` — *(reviewed and explicitly excluded: this
  is Milad's own personal LinkedIn/career-growth tracker, unrelated to an employer's marketing
  operations)*

**Company:** Perla Engineering. `[EXPLICITLY STATED — "Perla Engineering — Marketing & Content
System" title]`

**Role:** Not explicitly attributed to Milad by name anywhere in the file.
`[NEEDS CONFIRMATION]` — but its content (lead tracking, GM reporting cadence, content calendar)
matches Milad's CV title "Marketing Manager" at Perla Engineering (Aug 2025–Feb 2026) closely.
`[SUPPORTED BY FILE, via CV cross-reference]`

**Timeline:** No date printed in the file itself. `[NEEDED]`

**Purpose (explicitly stated):** "Generate qualified leads through consistent content and fast
follow-up. This role owns two things: Content (what Perla posts) and Marketing (how leads are
captured and passed to Sales). Both must happen every day." `[EXPLICITLY STATED — verbatim]`

**Problem:** Not narrated as a before/after case — this is an operating manual, not a
retrospective. `[EXPLICITLY STATED — absence noted]`

**Workflow (explicitly documented):** Every new lead logged in a Google Sheet within 1 hour;
replied to within 2 hours using a template; qualified leads passed to Sales same day with
context; leads not replied to after 24 hours followed up; lead status tracked as
new/contacted/meeting/lost; a weekly lead report (total leads, source, status) sent to the GM;
content posted on a fixed weekly cadence using only real project photos (explicit rule: "Never
post content that didn't happen"); certain content (first-time client property photos, named
testimonials, paid ads) requires GM approval before posting.
`[EXPLICITLY STATED — verbatim from the file]`

**Tools:** Google Sheets (lead tracking), WhatsApp (lead handoff to Sales, GM reporting), social
media (unspecified platforms) for content distribution. `[EXPLICITLY STATED]`

**Implementation:** Reads as an active, in-use operating system with defined success criteria
("≥15 new leads per month from social media," "lead sheet is always updated") and explicit
common mistakes to avoid. `[SUPPORTED BY FILE]`

**Outcome:** No specific percentage or before/after outcome is stated in this file. In
particular, **the CV's "+30% lead generation... with a refined content strategy and stronger
brand visuals" result (attributed to Perla Engineering) does not appear anywhere in this file, or
in any other file checked** (see below). `[EXPLICITLY STATED — absence noted after a direct
search]`

**Evidence:** Solid system-level documentation; no outcome-level evidence.

**Visual evidence:** A structured, color-coded operating manual (lead-tracking rules, a weekly
content calendar grid, category definitions for post types) — usable for a case study focused on
the *system*, not on a specific outcome.

**Open questions:**
- Confirm authorship.
- The CV's 30% lead-generation figure is not corroborated by any file reviewed — see next
  section.

---

## Connecting the CV's percentage results to a specific project

Per instruction, checked explicitly and not forced:

- **"+30% lead generation... Perla Engineering"** — **no file reviewed states this figure or
  attributes it to a specific named system.** The Marketing & Content System file describes the
  lead-tracking *process* this figure would plausibly come from, but does not itself contain the
  number. `[NEEDS CONFIRMATION — do not connect these without Milad's direct confirmation]`
- **"+40% monthly inquiries... Skyland"** — no Skyland/SKYLAND-related files were found in the
  reviewed Downloads folders at all. `[NEEDS CONFIRMATION — no source file to check against]`
- **"+55% engagement... Noor Alyaqoot"** — no Noor AlYaghoot/Alyaqoot-related files were found in
  the reviewed Downloads folders at all. `[NEEDS CONFIRMATION — no source file to check against]`

**None of the three percentages in the CV are corroborated by any file inspected.** This doesn't
mean they're untrue — they may simply live in systems/exports Milad has access to but weren't in
this Downloads folder — but per instruction, no connection is being asserted without file support.

---

# Evidence Gaps

Only the important gaps that block moving from "system evidence" to "case study":

1. **No explicit, first-person authorship statement exists for 3 of the 5 projects** (Daily Site
   Reporting System, Project Operations System, Material Request System) — matching role/company/
   timing is strong for all three, but none carries a "by Milad" line the way the Operations
   Dashboard documents do.
2. **No measurable outcome exists in any file for 4 of the 5 projects** (everything except
   Operations Dashboard, which has two figures explicitly self-labeled "estimated," not measured).
3. **The CV's three percentage results are not corroborated by any file found** — see above.
4. **A large number of related files were found but not opened**, given the volume — most notably:
   `Tathmeer_Construction_Operating_System_v11.html`, `Tathmeer_Group_Management_Review.html` (and
   its numbered revisions), `Tathmeer_Project_Planning_*_Proposal.html`,
   `Tathmeer_Procurement_Restructuring_Plan.pdf/.pptx`, `Tathmeer_Onboarding_Prep.docx`,
   `Tathmeer_Mega_Projects.xlsx` / `Tathmeer_Al_Khuwair_Projects.xlsx` /
   `Tathmeer_Al_Seeb_Projects.xlsx`, `Perla Engineering — Engineer Reporting System.pdf`,
   `Perla Engineering — GM Daily System.pdf`, `Perla Engineering — Procurement System.pdf`,
   `Perla Engineering — Operational Forms & SOPs.pdf`, `perla_annual_report_2026.html`,
   `PERLA – Request Management System.zip`, `Material-Management-Workflow-Chart_Word.zip`, and
   the LinkedIn certificate PDFs. None of these were needed to establish a solid baseline for each
   of the five projects, but any could add detail, dates, or additional outcome evidence.
5. **Whether the Tathmeer documents can be referenced publicly at all** — several are explicitly
   marked "Internal / Confidential" or "For Chairman Review." This is a permission question, not
   an evidence question, but it blocks case-study publication regardless of how good the evidence is.
6. **The Jul 2026 vs. Aug 2026 Tathmeer start-date discrepancy** noted under Operations Dashboard.

# Recommended Case Study Order

Ranked strictly by strength of *currently available evidence* (explicit attribution + documented
outcome + reusable visual material) — not by assumed importance:

1. **Operations Dashboard** — explicit "Prepared by Milad" attribution (twice, in two separate
   documents), a dated timeline, a specific list of delivered artifacts, and the only two
   measurable (if self-labeled "estimated") outcome figures found anywhere in this evidence set.
   Held back only by the confidentiality markings and the estimated-vs-measured caveat.

2. **Material Request System** — no explicit byline, but the strongest technical build evidence
   (versioned automation script, real generated numbered documents, a complete field/workflow
   spec) and the clearest "what was built" story of the five, even without an outcome metric yet.

3. **Daily Site Reporting System** — solid real-world usage evidence (a genuine multi-project CSV
   response log) plus a polished interactive prototype, but authorship is unconfirmed and no
   outcome metric exists.

4. **Project Operations System** — a complete, well-documented operating system matching Milad's
   exact CV title, but no explicit authorship line and no outcome metric; also has some ambiguity
   about whether "Project Operations System" refers to this document or the Tathmeer dashboard's
   data architecture instead.

5. **Marketing & Lead Operations System** — a real, detailed operating manual, but the weakest
   ownership signal of the five (no title/company-match reinforcement beyond the CV's Marketing
   Manager dates) and the CV's own marketing percentages could not be traced to it.

---

**Not done, per instructions:** no visual design changes, no page changes, no final website copy,
no fictional case studies, no invented outcomes. `master-profile.md` was not modified — this file
stands alongside it and can be cross-referenced from there once Milad reviews the open questions
above.
