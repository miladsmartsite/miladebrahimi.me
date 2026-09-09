# Content Strategy — the Content & Authority Engine

Phase 12. This document is the architecture for what Milad writes about
and why — not the writing itself. No article is drafted here, no
credential is claimed here that the site doesn't already evidence
elsewhere. Everything below is either a direct reuse of data already
approved on the site (`EXPERTISE_AREAS`, `ARTICLE_CATEGORIES`, the five
audiences from Phase 10) or an explicit, honestly-labeled architectural
model. See `src/content/content-status.md` for the underlying
CONFIRMED/SUPPORTED/PROVISIONAL ledger this all still defers to.

## Positioning

> "I build the systems that move organizations forward."

Operations is the core. Marketing, Productivity, AI, and Leadership are
not separate service lines — they're lenses through which the same
underlying work (making organizations run better) gets examined. A piece
of content always belongs to exactly one of these five lenses (its
`category`), the same controlled vocabulary already enforced by
`ARTICLE_CATEGORIES` in `content.config.ts` and `EXPERTISE_AREAS` in
`src/lib/site.ts` — this document doesn't introduce a second taxonomy
next to those, it explains how to use the one that already exists.

## 1. The five content areas

Reusing `EXPERTISE_AREAS` exactly — no new area is introduced, and none
of the five is dropped:

| Area | Standing | Why it belongs | Useful for |
|---|---|---|---|
| **Operations** | Core | The throughline of every real system Milad has built (all 5 published projects) | CEOs/business owners with operational friction, executives inheriting messy processes |
| **Marketing** | Experience | CV-confirmed marketing roles + one real system (Marketing & Lead Operations) | Business owners/marketers who see marketing as a system, not a campaign |
| **Productivity** | Focus | A lens on the same operations work, applied to individuals/teams rather than whole orgs | Professionals, managers, individual collaborators |
| **AI** | Focus | Applied automation as it shows up inside real operations work, not AI hype | Executives evaluating AI, technically curious professionals |
| **Leadership** | Practice | CV-confirmed ("leadership," "cross-functional collaboration") | Managers, executives, recruiters assessing scope of past responsibility |

Each area's existing `relatedTags` already determine which real projects
connect to it (Operations and Marketing currently have real matches;
Productivity/AI/Leadership honestly show none yet — see
`src/pages/expertise/index.astro`). Content in those three areas
therefore leans more on frameworks and analysis than on "here's the
system I built for this," until a tagged project exists.

## 2. Content pillars

Rather than inventing a second taxonomy above the five areas, each
area's own three `tags` (already live on `/expertise` today) **are** its
content pillars — durable, already-approved, and proven not to
over-categorize (3 × 5 = 15 total, a ceiling, not a starting point):

| Area | Pillars (= existing `EXPERTISE_AREAS[].tags`) |
|---|---|
| Operations | Structure · Process · Systems |
| Marketing | Growth · Positioning · Demand |
| Productivity | Execution · Focus · Efficiency |
| AI | Applied AI · Automation · Leverage |
| Leadership | People · Direction · Change |

These are broad by design (they already had to survive being shown as
one-line descriptors on a live page) and support years of writing without
revision. A pillar is not a new frontmatter field — it's a lens for
planning ("which pillar does this idea serve?"), expressed through the
article's existing `category` + free-text `tags` fields. No schema
change was needed or made.

## 3. Target reader types

Reused from Phase 10's approved audience set — content doesn't get its
own persona list:

1. CEO / Business Owner
2. Executive / Manager
3. Recruiter / Hiring Manager
4. Professional / Collaborator
5. Reader / Audience Member (general interest in the ideas themselves)

A given article doesn't need to name its audience in frontmatter; the
combination of `category` + format (below) + depth level is enough for a
reader to self-select.

## 4. Content types and their role

| Type | Role | Status |
|---|---|---|
| **Articles** | Ideas, frameworks, analysis — the day-to-day intellectual output | Architecture ready; 3 placeholder entries, 0 published |
| **Books** | Deeper, original long-form work | 3 real, published (CV-confirmed) |
| **Podcasts** | Long-form conversation | Honest "not yet" page; no collection until a real episode exists |
| **Videos** | Visual explanation | Honest "not yet" page; same rule |
| **More / Resources** | Practical tools, templates, references | Collection exists, empty; ships the moment a real resource does |
| **Projects** | Proof of applied work | 5 real, published case studies |
| **Resume** | Professional credibility / verification layer | Complete, CV-sourced |

### The conceptual chain

```
IDEAS            → an article states a claim or framework
  ↓
CONTENT          → published as an article (and eventually a book,
                    podcast, or video restating the same idea)
  ↓
APPLICATION      → a real project shows the idea applied (Related Work)
  ↓
PROOF            → the project's own Evidence section (Phase 8) states
                    exactly what's confirmed vs. not yet verified
  ↓
AUTHORITY        → Resume ties the applied work back to real roles/dates
  ↓
CONNECTION       → Contact — the one place this chain asks for anything
```

No step in this chain is skipped by design elsewhere on the site
already: Article → Related Expertise → Related Work (Phase 10) already
implements IDEAS→CONTENT→APPLICATION; Related Work → Evidence (Phase 8)
already implements APPLICATION→PROOF; AuthorBlock → Resume (Phase 9)
already implements PROOF→AUTHORITY; every page's Contact CTA (Phase 10)
already implements AUTHORITY→CONNECTION. Phase 12 documents this chain;
it doesn't need to build it.

## 5. Content → Expertise → Work graph (audit)

Already implemented, data-driven, verified in Phase 10 and re-confirmed
here — no fabricated relationship exists anywhere in this graph:

| Relationship | Mechanism | File |
|---|---|---|
| Article → Expertise | `article.category === area.title` (exact match, both drawn from the same 5-item enum) | `src/pages/contents/articles/[slug].astro` |
| Article → Work | that area's `relatedTags` matched against the project's own `tags` | same file |
| Project → Expertise | project `tags` matched against `area.relatedTags` | `src/pages/projects/[slug].astro` |
| Expertise → Work | `area.relatedTags` matched against project `tags` | `src/pages/expertise/index.astro` |
| Expertise → Articles | `article.category === area.title`, published+non-placeholder only | same file |
| Resume → Experience | direct render of the `experience` collection | `src/pages/resume.astro` |
| Resume → Systems/Projects | direct render of the `projects` collection | same file |

**Missing relationship, found and left alone (correctly):** Resume has
no computed link back to Expertise areas or to Articles. This is
intentional, not an oversight to fix — Resume is a chronological
career record (Phase 10 §09: "a trust/verification layer"), and forcing
it into the same tag-matching graph as Articles/Projects/Expertise would
turn a CV into a content hub, which the site's own Phase 10 instructions
explicitly ruled out. No change made here.

**No other missing relationship was found.** Every connection the data
model supports is already wired; nothing here needed new code beyond the
sitemap/noindex fix in §12 below.

## 6. Article formats

Eight formats, all consistent with the practitioner voice in
`content-brief.md` §11 (plain, specific, no jargon-gatekeeping). This is
a planning vocabulary — not a new frontmatter field; a working title
picks one mentally, the same way it picks a pillar.

| Format | Description | Recommended structure |
|---|---|---|
| **Framework** | A named, reusable way of thinking about a recurring problem | Problem → the framework's parts → how to apply it → a real or hypothetical walkthrough |
| **How-to** | A specific, actionable procedure | The outcome it produces → prerequisites → numbered steps → common mistake to avoid |
| **Case Study** | An article-length examination of one real situation (may cross-reference a `projects` entry, but is written as prose, not a dossier) | Context → problem → what was tried → outcome (with the same evidence-honesty as `projects`) → lesson |
| **Analysis** | Breaking down why something works or fails | The claim → the reasoning → the evidence or logic → the implication |
| **Lessons Learned** | Retrospective, specific, non-generic | What was attempted → what actually happened → what would be done differently |
| **Opinion / Perspective** | A stated position on a debatable question in the field | The question → the position → the reasoning → the acknowledged counter-case |
| **System Breakdown** | Explaining the internal mechanics of a system (real or illustrative) | What it does → how the pieces connect → why it's built that way |
| **Practical Guide** | Broader and less procedural than How-to; equips a reader to think about a class of problem | The problem class → the mental checklist → when it doesn't apply |

## 7. Content depth levels

Not every idea needs the same length or rigor. Three depths, so a short
practical note and a long framework piece both have a legitimate home:

1. **Quick note** — a single practical insight, short (the Level 1 rung
   of the Authority Ladder below).
2. **Standard article** — a full framework, analysis, or guide.
3. **Deep piece** — long-form, multi-section, TOC-worthy (Phase 9's
   `TableOfContents` already only activates at 3+ headings — depth is
   already structurally supported, not something to add).

## 8. Authority ladder

An architectural model for how content *could* build authority over
time — not a claim that every level is already reached. Marked honestly
against what the site can evidence today:

| Level | Description | Current evidence |
|---|---|---|
| 1. Practical insights | Short, standalone observations | **Not yet** — 0 published articles |
| 2. Frameworks and systems | Named, reusable models | Partial — "The Milad Method" exists (`MILAD_METHOD` in `site.ts`), explicitly labeled a personal working framework, not certified |
| 3. Applied experience | Real roles, real responsibility | **Yes** — CV-confirmed career history (`experience` collection) |
| 4. Case studies / documented work | Real systems with stated evidence | **Yes** — 5 published projects, each with an explicit Evidence section (Phase 8) |
| 5. Original intellectual models | A named way of thinking, originated by Milad | Partial — same as Level 2; one model exists, presented as personal framing, not as a validated methodology |
| 6. Books / long-form work | Complete original works | **Yes** — 3 published books (CV-confirmed) |

The honest reading: the site currently has strong evidence at Levels 3,
4, and 6, and a real (if singular, if modestly framed) claim at 5 —
but Levels 1 and 2 are structurally ready and currently empty. That gap
is the actual argument for writing the articles this phase deliberately
does not write yet.

## 9. Content quality standard

Every future article should have:

- a clear problem it's addressing
- a clear intended reader (from §3)
- one useful, specific insight — not restated common knowledge
- an original angle, even if the underlying idea isn't new
- a practical application a reader can actually use
- a supporting example, where one honestly exists (real or clearly
  hypothetical — never implied to be real when it isn't)
- a connection to exactly one expertise area (its `category`)
- a link to related work, only where a real tag match exists (never
  forced — see the existing `relatedArea`/`relatedProjects` logic, which
  already renders nothing when there's no genuine match)
- a real conclusion, not a summary restatement
- one clear, appropriately-weighted CTA (per Phase 10's CTA hierarchy —
  articles get Contact or Explore Expertise/Work, never "buy now"
  language)

No generic AI-filler framing ("In today's fast-paced world...", "Let's
dive in..."). The bar: does this read like a specific person who actually
did the work, or could it have been written by anyone about anything?

## 10. Homepage content role

Audited `ContentsPreview.astro` (homepage) — it already does the right
thing: a status row per content type, computed live from the real
collections (`Latest: <title>` once a real article exists, `Currently
Building` where nothing does), never a hard-coded claim. This already
says "this is where Milad's thinking lives" without overstating what
exists yet. No change made — the honest-empty-state pattern Phase 12
asks for was already built in Phase 8.

## 11. Content archive UX — scaling later without overbuilding now

`/contents/articles` currently renders one featured entry + a flat
archive list — correct for 3 entries. The architecture can add, **when
there's enough real content to justify it**, without a schema change:

- **Filter by category/area** — `article.data.category` already exists;
  a filter UI is a client-side array `.filter()` away.
- **Filter by content type** — once podcasts/videos get real collections,
  `/contents` already aggregates by type structurally.
- **Featured/latest** — already implemented (`featured` flag, falling
  back to most recent).
- **Related expertise/work per card** — already implemented on the
  detail page (Phase 10); could extend to archive cards later.

None of this is built now — three articles don't need a filter UI, and
building one today would be exactly the kind of premature complexity
Phase 12 warns against. The point is that adding it later touches
templates, not data.

## 12. RSS / sitemap / SEO compatibility

Verified against the existing SEO architecture (Phase 7) and Content
Engine (Phase 8):

- **RSS** (`src/pages/rss.xml.ts`) — already excludes `placeholder` and
  `draft` entries. No change needed.
- **Sitemap** — **gap found and fixed**: the sitemap's `filter` excluded
  legacy redirect routes but not placeholder article pages, so all 3
  placeholder articles were being submitted to search engines as if
  published. Fixed in `astro.config.mjs` by computing the same
  placeholder slugs RSS already excludes (via a plain frontmatter
  regex-check, not a new dependency) and excluding their pages from the
  sitemap too.
- **noindex** — **gap found and fixed**: placeholder article pages had
  no `noindex` meta tag, so even outside the sitemap they were fully
  indexable. `src/pages/contents/articles/[slug].astro` now passes
  `noindex={article.data.placeholder}` to `BaseLayout`. Both fixes read
  the same `placeholder` field already in the schema — once a real
  article ships (`placeholder: false`), it starts appearing in the
  sitemap and drops `noindex` automatically, with zero further code
  changes.
- **Canonical URLs, Article schema, Breadcrumb schema, Open Graph** —
  unaffected by the above; a noindexed page still renders correct
  canonical/OG tags (standard practice — `noindex` controls indexing,
  not tag correctness), so nothing else needed to change.

## 13. Future publishing workflow

```
IDEA               → captured wherever (no code needed)
  ↓
OUTLINE            → still no code — this is writing, not architecture
  ↓
DRAFT              → new file in src/content/articles/, draft: true
  ↓
EDIT               → same file, still draft: true
  ↓
FACT CHECK         → verify every claim against content-status.md's
                      CONFIRMED/SUPPORTED bar before publishing
  ↓
SEO REVIEW         → description is meta-description-ready, title fits
                      SEO.astro's title-suffix logic, category is set
  ↓
RELATED CONTENT     → confirm category creates a genuine Related
                      Expertise/Work link (or accept it won't, honestly)
  ↓
PUBLISH            → flip draft: false (and placeholder: false, if it
                      was replacing a placeholder stub)
  ↓
DISTRIBUTE          → see §14
  ↓
MEASURE             → Umami pageviews on the article's URL, plus the
                      article_engagement event (Phase 11)
  ↓
UPDATE              → set updatedDate; JSON-LD dateModified already
                      picks this up automatically (Phase 8)
```

Every step after DRAFT uses fields and mechanisms that already exist.
No code changes are required to publish a new article — only a new
markdown file.

## 14. Content distribution (documented, not built)

No distribution integration is built this phase. The intended path for
one real article, once it exists:

```
1 long-form article (canonical home: this site)
  → LinkedIn post (the article's thesis, linking back)
  → short LinkedIn insights (2-3 standalone claims from the piece)
  → Instagram content (one visual framework or quote from it)
  → video topic (the same idea, explained on camera)
  → podcast topic (the same idea, in conversation)
  → future book material (if a pillar accumulates enough depth over time)
```

The website stays the canonical, permanent home of the long-form asset;
everything else points back to it. `ShareLinks.astro` (Phase 9) already
covers the first manual step (LinkedIn share + copy link) — no further
tooling is needed until real distribution volume justifies it.

## 15. Future content database — decision

**Keep the current Markdown + Astro Content Collections architecture.**
No CMS migration is warranted. Reasoning against each alternative:

- **Simple** — a new article is one `.md` file; a CMS would add an
  admin UI and a hosted dependency for no functional gain at this scale.
- **Version-controlled** — every article's history lives in git already;
  a CMS would either lose this or require its own versioning system.
- **Fast** — static generation at build time; a CMS would add either a
  build-time API call or a runtime fetch, both slower than a local file.
- **Portable** — plain markdown + frontmatter has no vendor lock-in; a
  CMS's proprietary content model does.
- **Scalable** — Astro Content Collections handle thousands of entries
  fine; nothing about this site's current or foreseeable volume (tens to
  low hundreds of articles over years) approaches a real ceiling.

Revisit only if a genuine technical need appears — e.g., non-technical
collaborators need to publish without touching git, or true multi-author
workflows emerge. Neither applies today.
