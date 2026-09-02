# Content Brief — miladebrahimi.me

Master content brief for the site. This is a working document, not published content — it lives
in `src/content/` so it travels with the project, but no page renders it. Every section below is
either (a) a fact already established in the project, clearly marked **[KNOWN]**, or (b) a
placeholder/question waiting on real input from Milad, marked **[NEEDED]**.

**Ground rule for this entire file and everything built from it:** nothing gets written into
final site copy unless it is either explicitly provided by Milad or already verifiably present in
this project. No invented achievements, clients, revenue, outcomes, job titles, dates, awards,
testimonials, certifications, statistics, or credentials — see Section 12.

---

# 1. Brand Identity

| Field | Status | Value |
| --- | --- | --- |
| Name | **[KNOWN]** | Milad Ebrahimi |
| Brand wordmark | **[KNOWN]** | MILAD EBRAHIMI |
| Domain | **[KNOWN]** | miladebrahimi.me |
| Professional positioning | **[NEEDED — draft on file]** | Current placeholder: "Business Operations · Systems · Marketing · Productivity · AI" (`SITE.positioning` in `src/lib/site.ts`). This was supplied as a *possible* positioning line, explicitly not finalized. |
| Short descriptor (nav/meta, ~5–8 words) | **[NEEDED]** | Not yet defined. Needs a real answer to "operator? strategist? consultant? founder?" — see Group 1 below. |
| One-line introduction (hero headline) | **[NEEDED — draft on file]** | Current placeholder: "I build the systems behind businesses that work." (`HOME.hero.headline`). Provisional, needs to be either confirmed or replaced with something traceable to real work. |
| Long-form introduction (hero subhead / about intro) | **[NEEDED — draft on file]** | Current placeholder describes Milad as "an operator and strategist working across business operations, systems design, marketing, and applied AI" — this is a plausible synthesis of the stated practice areas, not a confirmed biography. |
| Core themes | **[KNOWN, as candidates]** | Business Operations, Business Systems, Process Improvement, Marketing & Brand Strategy, Productivity, AI & Digital Transformation, Construction / Real Estate Operations — supplied as the practice areas to evaluate. See Section 5 for how each should actually be positioned. |
| Industries | **[NEEDED]** | Construction / Real Estate is named as one practice area, but it's unclear whether it's an industry Milad has worked *in*, a client industry, or a personal interest. |
| Geographic / international positioning | **[NEEDED]** | The brief calls for "international" positioning. Unknown: where Milad is based, which markets/regions he's actually worked in or with, and whether "international" refers to client geography, remote/cross-border work, or something else. |

---

# 2. About

Structural placeholders exist on `/about` (`src/pages/about.astro`) but contain no real content.
Questions to answer before that page can be written:

- **Professional story** — What is the actual path that led here? (Not a highlight reel — the
  throughline.)
- **Career evolution** — What roles/fields came before the current focus, and what changed along
  the way?
- **Current work** — What does Milad actually do day-to-day right now? For whom, in what
  capacity (employee, consultant, founder, freelancer)?
- **What I care about** — Real, specific concerns — not generic "I'm passionate about X."
- **How I think** — A working method or mental model that's actually used, not an aspirational
  slogan.
- **What makes the approach different** — Only fillable with a real comparison point (e.g., "most
  X treat Y as Z; I don't" — but only if true and specific).
- **Personal philosophy** — Optional; only include if there's a real, non-generic belief to state.

**[NEEDED]** — none of the above can be written from what currently exists in the project.

---

# 3. Work / Experience

Content collection already exists at `src/content/experience/` (schema: `organization`, `role`,
`location`, `startDate`, `endDate`, `summary`). It currently holds exactly one entry,
`_placeholder-role.md`, which is `draft: true` (hidden) and contains only bracketed placeholder
text — no real employer, title, or date has been entered anywhere in the project.

For **each real role**, the inventory needed is:

```
Company:
Role / title:
Location:
Dates (start – end, or "present"):
Responsibilities:
Systems / processes built:
Major initiatives:
Measurable outcomes (ONLY if you have real, verifiable numbers):
Tools / technologies used:
Lessons learned:
```

**[NEEDED]** — full inventory, for every role Milad wants represented (full employment history is
not required — only the roles relevant to this brand's positioning).

---

# 4. Projects / Case Studies

Content collection exists at `src/content/projects/` with a schema that supports exactly this
structure (`context`, `challenge`, `approach`, `outcome`, plus `title`, `summary`, `tags`, `role`,
`client`, `year`). It currently holds **three demo entries**, all flagged `placeholder: true` and
titled with an explicit `[Placeholder]` prefix:

1. `operating-model-redesign.md` — illustrative "operating model redesign"
2. `marketing-system-rebuild.md` — illustrative "marketing system rebuild"
3. `ai-assisted-workflow-pilot.md` — illustrative "AI-assisted workflow pilot"

Every field in all three is explicitly bracketed placeholder text (e.g. `"[Placeholder] A growing
company's operating model..."`) — none of it is real, and none of it should be mistaken for real
work. These exist only to prove the template renders correctly.

For **each real project**, the case-study questionnaire is:

```
Project:
Context:
Problem:
My role:
Challenge:
Approach:
System / process / design created:
Tools used:
Implementation:
Outcome:
Evidence (how could this outcome be verified, if asked?):
Lessons:
```

**[NEEDED]** — completed questionnaire for every real project Milad wants featured. A project
doesn't need every field filled to be usable — thin entries are fine — but every field that *is*
filled must be true and specific.

---

# 5. Areas of Work

The seven candidate themes exist in `AREAS_OF_WORK` (`src/lib/site.ts`) with generic, provisional
one-line descriptions of each *discipline* — not claims about Milad's personal experience in it.
None of them has been evaluated against real experience yet. For each, the real question is not
"do I know about this" but **what kind of claim is honest to make**:

| Theme | Candidate framing — needs a decision |
| --- | --- |
| Business Operations | expertise / practice / experience / content theme? |
| Business Systems | expertise / practice / experience / content theme? |
| Process Improvement | expertise / practice / experience / content theme? |
| Marketing & Brand Strategy | expertise / practice / experience / content theme? |
| Productivity | expertise / practice / experience / content theme? |
| AI & Digital Transformation | expertise / practice / experience / content theme / interest? |
| Construction / Real Estate Operations | expertise / practice / experience / content theme? |

Definitions to apply when deciding:
- **Expertise** — deep, demonstrable skill, backed by real project/role evidence in Section 3–4.
- **Practice** — active, ongoing work, even without a long track record yet.
- **Experience** — has done this, in the past, possibly not ongoing.
- **Interest** — genuinely engaged with, reads/thinks about, but not (yet) a body of work.
- **Content theme** — worth writing about, regardless of professional depth.

Some areas may not deserve a spot on the site at all if none of the above honestly applies —
that's a legitimate outcome of this exercise, not a gap to paper over.

**[NEEDED]** — a framing decision per theme, informed by Sections 3 and 4 once those are filled
in. This section cannot be finalized before Work/Experience and Projects are.

---

# 6. Ideas / Articles

Content collection exists at `src/content/articles/` (schema: `title`, `description`,
`publishDate`, `tags`, `externalUrl` for pieces published elsewhere). It currently holds three
demo entries, all `placeholder: true` with `[Placeholder]`-prefixed titles:

- "Systems Thinking for Small, Fast-Moving Teams"
- "Where AI Actually Saves Time in Operations"
- "Process Improvement Isn't Just Efficiency"

These are **structural stand-ins only** — no real opinions, arguments, or content. Per
instruction, no fictional articles will be written to replace them; instead, here is a **content
backlog structure** to fill in over time rather than a batch of finished pieces:

```
Category:        [Operations | Systems | Productivity | AI | Marketing | Business |
                  Construction / Real Estate]
Working title:
Core argument (one sentence — what does this piece actually claim?):
Why now / why this:
Status:          [idea | drafting | published elsewhere | published on site]
External link:   (if already published on LinkedIn/Medium/etc.)
```

**[NEEDED]** — the backlog itself: real working titles and core arguments Milad actually wants to
write about, even if none are drafted yet. An empty but honest backlog is fine; invented entries
are not.

---

# 7. Books

Content collection exists at `src/content/books/` (schema: `title`, `subtitle`, `author`,
`description`, `link`, `year`). It currently holds two demo entries — "[Placeholder] Book Title
One" and "[Placeholder] Book Title Two" — both explicitly bracketed, containing no real title or
description.

**Open question the collection doesn't yet resolve:** is this section for books Milad has
**authored**, books he **recommends**, or both? The schema is deliberately loose (`author` is
optional) to support either, but the site copy can't be written until this is decided.

For each **real, confirmed** book:

```
Title:
Subtitle:
Year:
Description:
Core idea:
Audience:
Cover status:      [have a real cover image | no cover yet | not applicable]
Purchase/read link:
Role:               [authored | recommended | referenced]
```

**[NEEDED]** — whether this section applies at all right now, and if so, the inventory above for
each confirmed book. If there are no real books yet, the honest move is to leave this section out
of the site entirely rather than fill it with placeholders indefinitely — flag if that's the case.

---

# 8. Speaking

Content collection exists at `src/content/speaking/` (schema: `title`, `event`, `location`,
`date`, `description`, `videoUrl`, `slidesUrl`). It currently holds two demo entries — "Talk Title
One" / "Talk Title Two" — both explicitly bracketed placeholders with no real event, date, or
location.

Inventory needed, per real engagement:

```
Type:          [talk | workshop | panel | podcast/interview appearance]
Title / topic:
Event / show name:
Location (or "remote"):
Date:
Description:
Video link:    (if recorded)
Slides link:   (if applicable)
```

**[NEEDED]** — the full list of real speaking topics Milad could speak on (even with zero past
engagements, a "topics I can speak on" list is legitimate content) plus any confirmed past/
upcoming engagements. If there is no speaking history at all yet, say so — an honest empty or
"topics only" version of this page is better than fabricated history.

---

# 9. Resources

Content collection exists at `src/content/resources/` (schema: `title`, `description`, `type`
[`template | guide | tool | download | link`], `url`). It currently holds one hidden
(`draft: true`) placeholder entry — not part of the current nav/homepage.

Future structure, per real resource:

```
Type:          [template | guide | tool | download | link]
Title:
Description:
Who it's for:
Link / file:
```

**[NEEDED]** — whether this section is a near-term priority at all, and if so, what real
templates/guides/tools currently exist (or are planned) to populate it. No content exists for
this yet, and none should be invented to fill the gap.

---

# 10. Contact

**[NEEDED — nothing here is currently known.]** `SOCIAL_LINKS` in `src/lib/site.ts` is
intentionally empty, and `/contact` (`src/pages/contact.astro`) explicitly states contact details
are pending. Nothing should be assumed or pre-filled — including any email address associated
with unrelated accounts or tools — until Milad confirms it explicitly.

Needed:

```
Preferred contact method:      [email | contact form | LinkedIn DM | other]
Public email (if any):
LinkedIn URL:
Other social/profile links:
Collaboration types welcomed:  (e.g. consulting, speaking, advising, full-time roles — only
                                list what's actually true)
```

---

# 11. Personal Brand Voice

Style direction, to guide the actual sentence-level writing once real content exists:

- Intelligent — assumes a capable reader, doesn't over-explain
- Clear — short sentences over impressive ones
- Practical — grounded in how things actually work, not theory for its own sake
- Confident — states things directly, without hedging or over-qualifying
- Human — reads like a person wrote it, not a brand voice guide
- International — not idiomatic to one country/market; plain, exportable English
- **Not** corporate — no "leverage synergies," no LinkedIn-speak
- **Not** motivational-guru — no "unlock your potential," no inspirational-poster tone
- **Not** exaggerated — no "world-class," "best-in-class," "revolutionary" unless demonstrably true
- **Not** overly technical — explains systems/AI concepts without jargon-gatekeeping

**Target effect:** reads like an experienced operator or thoughtful professional writing plainly
about real work — not a freelancer's sales pitch, not a thought-leader performing expertise.

---

# 12. Content Rules

These apply to every piece of copy written for this site, from hero headline to footer text:

1. No fake numbers, metrics, or statistics.
2. No fake clients, companies, or logos.
3. No fake testimonials or quotes attributed to anyone.
4. No generic motivational claims ("passionate about excellence," etc.).
5. No exaggerated "expert" language not backed by Section 3–5 evidence.
6. No unsupported claims of any kind — if it can't be traced to something in this brief or
   something Milad has said, it doesn't get written.
7. Prefer specific evidence over adjectives — a fact beats a superlative.
8. Prefer showing work over asserting quality ("I am great") — let the case studies and
   experience do that work.
9. Every claim on the live site should be traceable to a specific answer in this document or a
   real file in `src/content/`.
10. When real information is missing for a section, the honest options are: leave the section
    out, mark it clearly as forthcoming, or keep the current `placeholder: true` demo content
    (visibly badged) — never fill the gap with invented specifics.

---

# INFORMATION NEEDED FROM MILAD

Grouped into the smallest set of high-value asks that unblock the most content. Answer in
whatever order/format is easiest — bullet points, voice-to-text, existing bios/CVs/decks are all
fine as raw input.

**Group 1 — Identity & positioning**
Who are you professionally, in one sentence (title/role you'd actually use)? What's your current
primary work context (employed / consulting / founder / other)? Where are you based, and in what
sense is your work "international" (clients, markets, remote work, background)?

**Group 2 — Work history**
For each role you want represented on the site: company, title, location, dates, what you were
responsible for, and anything measurable you can stand behind. (CV or LinkedIn export is fine as
raw material — doesn't need to be pre-formatted.)

**Group 3 — Real projects / case studies**
Pick 1–5 real projects (from any role) you're willing to describe using the questionnaire in
Section 4. Thin answers are fine; specificity matters more than completeness.

**Group 4 — Areas of work, honestly framed**
For each of the seven candidate themes (Section 5): is this real expertise, active practice, past
experience, a personal interest, or just something you'd write about? Which ones should be
dropped entirely?

**Group 5 — Books, speaking, and resources**
Do any real, confirmed books, talks/podcast appearances, or resources (templates/guides/tools)
exist right now? If none exist yet, confirm that too — it determines whether those sections ship
now or wait.

**Group 6 — Contact & presence**
What contact method should the site actually offer, and what's the real email/LinkedIn/other
link to use? What kinds of collaboration are you actually open to?

**Group 7 — Voice check**
Does the voice direction in Section 11 sound right, or is there a different tone you want
(more formal, more informal, more technical, etc.)?

---

Once Groups 1–3 are answered, a first real draft of the homepage, About, and Work pages becomes
possible. Groups 4–7 refine and complete the rest.
