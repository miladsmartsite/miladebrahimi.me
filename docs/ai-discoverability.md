# AI Discoverability & Entity Authority

Phase 16. This document audits how clearly search engines and AI answer engines can understand
who Milad Ebrahimi is, what he works on, and where the authoritative source for that lives. Every
claim below is labeled **VERIFIED** (confirmed directly from source code, built HTML, or a real
web search run this session), **RECOMMENDED** (a reasoned suggestion, not yet true), or
**UNAVAILABLE** (something this audit has no way to check from here). Nothing here claims that any
AI system recommends, ranks, or cites Milad — that was never tested and is never asserted.

## 1. AI discoverability audit

The test question: *if an AI system encountered this website with zero prior knowledge of Milad,
could it confidently understand the person, expertise, work, and content ecosystem?*

**VERIFIED — yes, structurally.** Every page carries a real `<h1>`, a specific title and
description, and machine-readable JSON-LD. The Person entity, the five expertise areas, the real
projects, the real articles, and the real books are all present, real, and internally connected
(see §3). A crawler or answer engine reading the *current* site has everything it needs to build
an accurate picture.

**VERIFIED — but the domain's search footprint currently contradicts the current site.** A live
web search this session for the site's own domain returned cached results from a **prior version**
of `miladebrahimi.me` — a Persian-language productivity-coaching site ("Milad Ebrahimi | International
Productivity Coach," "Milad Ebrahimi Academy," a "ME Model," pages like
`/about-milad-ebrahimi-academy/`). Those URLs were checked directly and correctly return `404` on
the current site — the current Astro build does not serve any of that content. This is Google's
index lagging behind a real site change, not a defect in the current codebase's crawlability. See
§11 for the full query results and §17 for what this means for crawlability going forward.

## 2. Canonical entity definition

Reused verbatim from what already exists — this phase does not invent new copy, it identifies the
already-approved description that should stay the canonical reference point:

> **Milad Ebrahimi** — Operations Manager. Business Operations · Systems · Organizational
> Transformation. "I build the systems that move organizations forward." Five lenses: Operations
> (core), Marketing, Productivity, AI, Leadership.

This is `SITE.positioning` + `SITE.jobTitle` + the `EXPERTISE_AREAS` list, already the single
source every page draws from (`src/lib/site.ts`). No new canonical statement was written — the
existing one already fits every place it needs to appear (Person schema, Author Block, homepage,
footer), worded slightly differently per context, which is correct (§6) rather than a defect.

## 3. Person entity graph

```
Milad Ebrahimi (Person, @id: https://miladebrahimi.me/#person)
  ↓
Website (WebSite, author → Person by @id)
  ↓
Expertise (5 areas, EXPERTISE_AREAS — no entity of its own, expressed as real page content)
  ↓
Articles (Article, author → Person by @id)
  ↓
Projects / Systems (real project pages, tag-matched to Expertise)
  ↓
Books (Book, author → Person by @id)
  ↓
Professional identity (/resume — Experience, Certifications, Education, Tools, Languages)
```

**IMPLEMENTED THIS PHASE (§18):** before this fix, the Person entity in `BaseLayout.astro` had no
stable identifier, and the Article and Book schemas each declared their *own* separate, anonymous
`{"@type": "Person", "name": "Milad Ebrahimi", ...}` object — same name, but no machine-readable
signal that it's the *same* entity as the sitewide Person node. A crawler reading strict JSON-LD
semantics would see three same-named-but-technically-distinct Person nodes across the homepage, an
article, and the books page.

Fixed by giving the sitewide Person node a stable `@id`
(`https://miladebrahimi.me/#person`, exported as `PERSON_ID` in `site.ts`) and having the WebSite,
every real article, and the Book schema reference that exact node via `{"@id": PERSON_ID}` instead
of re-declaring it. Verified in built HTML (see §18) — all four now resolve to the literal same
JSON-LD node. This is the one implementation change this phase makes; no new schema **type** was
introduced, only a linking mechanism (`@id`) already part of JSON-LD.

## 4. Authorship audit

**VERIFIED.** All three published articles set `author: "Milad Ebrahimi"` (the schema's own
default) and render "MILAD EBRAHIMI" in the visible byline. After §3's fix, each article's
`Article` JSON-LD now points its `author` field at the exact same Person node as the rest of the
site, rather than a disconnected same-named copy. The schema gracefully handles a hypothetical
future guest byline (`author !== SITE.name`) by falling back to a plain, non-linked Person object
— no guest author exists today, so this path is untested but correct by construction.

## 5. sameAs / external identity audit

**VERIFIED, unchanged from Phase 15.** Exactly one external identity is linked anywhere on the
site: LinkedIn (`linkedin.com/in/miladebrahimi-me`), consistent across the footer, `/contact`,
`ShareLinks`, and the Person schema's `sameAs`. Name and positioning on the website
("Milad Ebrahimi," "Business Operations · Systems · Organizational Transformation") were not
independently re-verified against the live LinkedIn profile's own headline text this phase — this
audit can read the URL is real and consistently used, but **cannot confirm the LinkedIn profile's
current headline/summary wording matches the site's positioning**, since that would require
visiting and reading the authenticated profile content, which is outside this audit's access.
**RECOMMENDED:** Milad should do a quick manual side-by-side check that his LinkedIn headline and
the site's positioning line don't contradict each other. No fix was made here because there is
nothing to fix from this codebase — this is a cross-platform consistency check only Milad can do.

## 6. Entity consistency

**VERIFIED.** Checked how "Milad Ebrahimi," "Business Operations," "Systems," "Organizational
Transformation," and the five expertise area names appear across the homepage, Person schema,
Author Block, footer, and navigation:

- The five expertise area names (Operations, Marketing, Productivity, AI, Leadership) are used
  **identically** everywhere — correct, since this is a controlled taxonomy (`ARTICLE_CATEGORIES`
  / `EXPERTISE_AREAS`), not free text.
- "Business Operations," "Systems," and "Organizational Transformation" appear worded slightly
  differently per context (e.g., footer tagline reads "Systems · Operations · Strategy · Ideas,"
  Author Block reads "Business Operations · Systems · Organizational Transformation") — this is
  **semantic consistency, not literal duplication**, which is what was asked for. No accidental
  contradiction or ambiguous wording was found. No change made.

## 7. Topical authority graph

Using only the existing, already-approved tags (`EXPERTISE_AREAS[].tags`) — no parallel taxonomy
created:

```
OPERATIONS (core)
├── Structure
├── Process
└── Systems

AI
├── Applied AI
├── Automation
└── Leverage

PRODUCTIVITY
├── Execution
├── Focus
└── Efficiency

MARKETING
├── Growth
├── Positioning
└── Demand

LEADERSHIP
├── People
├── Direction
└── Change
```

Each published article sits under exactly one branch via its `category` field; its `tags` field
picks the specific leaves it covers (e.g., the Operations article's `tags: ["Structure", "Process",
"Systems"]` covers all three of that branch's leaves at once).

## 8. Content clusters (the three live articles, mapped)

| Article | Primary topic | Expertise area | Supporting concepts | Related work | Related content | Natural future topics |
|---|---|---|---|---|---|---|
| "Why Most Organizations Don't Have an Operations Problem" | Operational dysfunction as a systems-design failure | Operations | Structure, Process, Visibility, Accountability, Improvement | Operations Dashboard, Material Request System (real, tag-matched) | — | A dedicated piece on any one layer (e.g., ownership/Structure alone) |
| "AI Won't Transform Your Organization If Your Processes Are Broken" | AI adoption ordering (fix the process before automating it) | AI | Understand, Simplify, Standardize, Automate, Measure, Improve | None (honest — AI has no tag-matched project yet) | — | A follow-up on the "map → clean → standardize → connect → automate" sequence alone |
| "Productivity Is Not About Doing More" | Productivity as work design, not personal discipline | Productivity | Clarity, Priority, Execution, Review, Improvement | None (honest — same reason) | *Time Engineering* (real book, referenced in prose only) | A deeper piece on context-switching cost |

No new article is created this phase — this table is the existing state, not a plan.

## 9. Original frameworks

Three genuinely original working frameworks exist in the published content today, presented
honestly as practical models — never as proprietary, patented, scientifically validated, or
industry-leading, because none of that is evidenced:

- **Operations:** Structure → Process → Visibility → Accountability → Improvement
- **AI:** Understand → Simplify → Standardize → Automate → Measure → Improve
- **Productivity:** Clarity → Priority → Execution → Review → Improvement

A fourth, older framework already exists sitewide and predates these three: **The Milad Method**
(Understand → Structure → Systemize → Optimize → Transform), already explicitly labeled on
`/expertise` and the homepage as "a personal working framework... not an academically validated or
certified methodology." The three article-level frameworks follow the same honest framing
convention already established there — consistent, not a new pattern.

## 10. Citation-worthiness

**VERIFIED — genuinely citable elements already exist**, none newly added this phase (this section
identifies, it doesn't create):

- The Operations article's five-question diagnostic (§07) is a self-contained, quotable checklist.
- The "Five Layers of an Operating System" definitions (Structure/Process/Visibility/
  Accountability/Improvement) are each a clear, one-paragraph definition — the kind of thing a
  reference article or another writer could quote directly.
- The AI article's explicit "AI doesn't remove ambiguity, it inherits it" line and the
  Understand→...→Improve sequence are similarly self-contained.
- The Productivity article's reframe ("why does this work require so much time in the first
  place," instead of "how can I manage my time better") is a clear, attributable perspective shift.

No artificial citation language (no "as an expert in..." or "renowned for...") was added anywhere
— citation-worthiness here means the content is *clear and definitional enough to be cited*, not
that it asks to be.

## 11. AI search query baseline

A live web search (via this session's search tool) was run for several realistic discovery
queries. Results are **VERIFIED** — real output from a real query, not estimated — but this audit
could not test any specific branded AI answer engine (ChatGPT, Perplexity, Google AI Overviews,
Gemini) directly; that capability is **UNAVAILABLE** in this environment, and no such platform's
behavior is claimed or implied anywhere below.

| Query | Result (VERIFIED) |
|---|---|
| `"Milad Ebrahimi" miladebrahimi.me` | Returned several **unrelated** people named Milad Ebrahimi (a software engineer at American Express, an academic, a GitHub user) — the site itself did not appear in this particular query's top results |
| `Milad Ebrahimi Oman business operations` | Returned other unrelated LinkedIn profiles named Milad Ebrahimi based in Muscat, Oman with different, unrelated professional backgrounds (finance/MBA) — a genuine name collision in the same city |
| `"miladebrahimi-me" linkedin` | The site (`miladebrahimi.me`) **did** appear, but described via old cached metadata: *"Milad Ebrahimi \| International Productivity Coach"* — the prior version of the site, not the current one |
| `site:miladebrahimi.me` | Returned old, no-longer-existing URLs (`/about-milad-ebrahimi-academy/`, a Persian-language blog post) — confirmed via direct `curl` to now 404 on the live site |
| `"I build the systems that move organizations forward"` | Zero results referencing Milad or this site at all — the current hero positioning line has not been indexed/associated with him yet |
| `who is Milad Ebrahimi operations systems organizational transformation` | Returned entirely unrelated Milad Ebrahimis (an IT manager in Iran, a systems integration engineer, an environmental-systems researcher) |

**Honest reading of this data:** "Milad Ebrahimi" is a common enough name (a common Persian
surname) that generic queries currently surface several unrelated people ahead of this specific
site, and the domain's own search footprint still reflects a **prior site** at the same URL rather
than the current one. This is not a defect in the current site's technical SEO (verified: the old
URLs correctly 404, robots/sitemap/canonical are all correct — Phase 15) — it's a combination of
(a) genuine name ambiguity in the underlying entity, and (b) Google's index not yet having fully
replaced its old cache of this domain with the new content. **No absence from these results is
treated as a flaw to fix by manipulation** — per this phase's explicit instruction, the response is
disambiguation and patience (new content needs to be crawled and re-indexed), not backlinks or
keyword stuffing.

## 12. AI / search citation path

**VERIFIED.** The path AI Search result → canonical page → author identity → expertise → work →
contact already exists end-to-end and was re-confirmed this phase: any real article's canonical
URL leads to a page with clear author identity (byline + now-linked Person schema), a direct
Related Expertise link, Related Work where genuinely supported, and a Contact CTA. No new UI was
needed — this is the same chain audited and confirmed working in Phases 14 and 15.

## 13. About / Resume as entity page

**VERIFIED.** `/resume` already establishes identity (Profile section), current positioning,
core expertise (linked areas), full career history (`experience` collection), systems/projects,
books, education, certifications, tools, and languages — exactly the IDENTITY + CREDIBILITY +
EVIDENCE role this phase asks for. No private information (DOB, marital status, nationality,
phone) is present, per the project's standing privacy rule. It is not keyword-stuffed — no change
made or needed.

## 14. Work / evidence audit

**VERIFIED.** Each of the 5 real project pages already states what the system is, the problem it
addresses, Milad's role, the system type, and (since Phase 10) its related expertise area — with
an explicit Evidence section (Phase 8) distinguishing CONFIRMED from SUPPORTED from NEEDS
VERIFICATION claims. No confidential detail (client financials, internal codes, third-party names)
is exposed anywhere; no outcome is invented where none exists. No change made.

## 15. Books as authority assets

**VERIFIED, and strengthened this phase.** All three real books (`Self-Coaching Blueprint`, `Time
Engineering`, `The Balance Book`) are represented with real author, title, language, year, and
description — no invented ISBN, publisher, review, or sales figure anywhere, consistent with the
schema's own field set. The Book JSON-LD's `author` field now references the same canonical Person
node as everything else on the site (§3), rather than a disconnected copy — the one change made
here.

## 16. Structured data audit

**VERIFIED.** Person, WebSite, Article, and BreadcrumbList were all re-validated (parsed as real
JSON via Node, not just visually inspected) after this phase's change — see §18 for the exact
validation output. No schema type was added or removed. The one improvement was linking existing
nodes together via `@id`, which is a JSON-LD addressing mechanism already part of the spec, not a
new vocabulary.

## 17. Search engine / AI crawlability

**VERIFIED, unchanged from Phase 15, re-confirmed this phase.** `robots.txt` allows all crawlers
and points at the sitemap; every published page is indexable; every draft/placeholder page is
either never generated or `noindex`; internal links are plain `<a href>` (no JS-only navigation);
RSS is valid and current; headings are semantic; author information is now more strongly linked
(§3–4). Nothing here blocks or manipulates any crawler — this is the same open, standard
architecture as before, just better internally connected.

## 18. Implementation changes

Three files changed, one linking mechanism added — no new schema type, no redesign, no new
dependency:

- **`src/lib/site.ts`** — added `PERSON_ID`, a stable JSON-LD `@id` string for the sitewide Person
  node.
- **`src/layouts/BaseLayout.astro`** — Person schema gets `'@id': PERSON_ID`; WebSite schema gets
  `author: { '@id': PERSON_ID }`.
- **`src/pages/contents/articles/[slug].astro`** — Article schema's `author` now references
  `{ '@id': PERSON_ID }` for the real (Milad-authored) case, with a graceful plain-Person fallback
  for a hypothetical future guest byline.
- **`src/pages/contents/books/index.astro`** — Book schema's `author` now references the same
  `{ '@id': PERSON_ID }`.

**Validated directly** (not just visually): built HTML for the homepage, one article, and the
books page were parsed as real JSON via Node, confirming the Person node carries the `@id` and
that WebSite/Article/Book all resolve their `author` to that exact same identifier string.

## 19. Documentation

This file (`docs/ai-discoverability.md`) is the deliverable for this phase — canonical entity
definition, entity graph, authorship model, structured-data strategy, external identity findings,
the real AI query baseline (§11), citation-worthiness, and the legitimate authority-building
strategy below (§20).

## 20. External authority strategy (no backlinks built)

No backlink was created, purchased, or arranged. Documented instead, as legitimate future
opportunities — none executed, none claimed as already happening:

- **LinkedIn** — the one real, already-linked profile; the natural first distribution channel
  (already the subject of Phase 14's distribution loop).
- **Professional profiles** — if Milad has other genuine professional profiles (e.g., a
  professional association, an alumni directory), adding them to `SOCIAL_LINKS`/`sameAs` would be
  legitimate — only if real and confirmed by Milad, never invented here.
- **Genuine publications, interviews, podcasts, guest articles, conference participation** — all
  legitimate future authority signals, all requiring an actual event to have happened before they
  can be represented. None claimed here.
- **Professional communities** — genuine participation (not manufactured mentions) in relevant
  operations/systems communities would be a real signal over time.
- **Third-party citations of the original frameworks (§9)** — the strongest possible legitimate
  authority signal, and entirely outside this site's control; it can only happen organically, if
  the frameworks are genuinely useful enough for someone else to reference.

## 21. Limitations

- This audit could not test any specific AI answer engine (ChatGPT, Perplexity, Google AI
  Overviews, Gemini) directly — labeled **UNAVAILABLE** throughout, not assumed to be favorable or
  unfavorable.
- The web search results in §11 reflect one search tool's index at one point in time — they are
  **VERIFIED** as real results from that query, not a comprehensive or permanent measurement of
  search visibility.
- "Milad Ebrahimi" is a genuinely common name; some degree of query collision with unrelated
  people is a structural reality this site cannot fully resolve through on-site changes alone.
- LinkedIn profile content itself was not independently re-read this phase (§5) — only the URL's
  consistency across the site was verified.

## 22. Future opportunities

- Re-submit the sitemap and use Search Console's URL Inspection tool (once Milad has access, per
  Phase 15 §9) to request re-crawling of the domain, addressing the stale-cache finding in §11.
- Once real distribution (Phase 14) produces external mentions or engagement, revisit whether any
  new *genuine* profile or citation should be added to `sameAs`.
- If a future article or framework is ever referenced by a third party, that reference — once
  real — would be the first legitimate external citation signal worth documenting.
