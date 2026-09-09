# SEO Growth — Search Discovery Audit

Phase 15. This is a growth audit of an already-correct SEO foundation (Phases 7–13), not a
redesign. Everything below is separated into three explicit categories, per this phase's own
requirement:

- **VERIFIED DATA** — confirmed directly from source code, built HTML, or live production.
- **RECOMMENDATIONS** — reasoned suggestions, not yet implemented, requiring a real decision or
  real future content.
- **UNAVAILABLE DATA** — data this audit cannot access in the current environment; explicitly
  flagged, never estimated.

## 1. SEO foundation audit — VERIFIED DATA

Inspected `BaseLayout.astro`, `SEO.astro`, `astro.config.mjs`, `robots.txt`, every page's
`structuredData`, image components, and all four legacy redirect pages. Confirmed already correct,
nothing rebuilt:

| Area | Status |
|---|---|
| Title tags | `SEO.astro` appends `" — Milad Ebrahimi"` unless the title already contains the name (homepage passes its own full title) — consistent across every page |
| Meta descriptions | Every page passes its own; falls back to `SITE.defaultDescription` only where none is given (none currently rely on the fallback) |
| Canonical URLs | Default to `Astro.url`; verified byte-identical to each article's own `ShareLinks` URL in built HTML (re-confirmed this phase, unchanged since Phase 14) |
| Open Graph / Twitter | `og:type/title/description/url/site_name/image`, `twitter:card` (large-image when an image exists, summary otherwise) — all present, all real |
| Person schema | `name`, `url`, `jobTitle`, `description`, `image`, `sameAs` — see §3 |
| WebSite schema | Minimal, accurate — no `SearchAction` (correctly omitted: **the site has no internal search**) |
| Article schema | Headline, description, dates, author, `mainEntityOfPage`, conditional `image` (only when the cover file genuinely exists) — present on all 3 real articles |
| Breadcrumb schema | Present on genuinely nested pages: articles, projects, and every `/contents/*` sub-page. Correctly **absent** from one-level nav destinations (`/expertise`, `/projects` listing, `/resume`, `/contact`, `/`) — breadcrumbs add no value on pages already one click from the nav, so this is a deliberate, appropriate scope, not a gap |
| Image metadata | Every real `<img>` (Portrait, ArticleImage, BookCover) has explicit `alt`, `width`, `height`, `loading="lazy"`, `decoding="async"` — verified in source. `VideoFeature`'s poster `<img>` is currently dormant (no page passes a `poster` prop yet), so no live image lacks metadata today |
| Headings | Exactly one `<h1>` per page, verified across every route in Phase 10's QA sweep; unchanged since |
| URL structure | Clean, lowercase, kebab-case throughout; no query-string-based content |
| Redirects | `/about`, `/cv`, `/work`, `/books`, `/articles`, `/articles/<slug>` are all real HTTP 301s (`Astro.redirect`), not client-side or meta-refresh redirects |
| 404 page | Real branded page, correctly `noindex` |
| `robots.txt` | `Allow: /` + a `Sitemap:` directive pointing at `sitemap-index.xml` — correct, minimal |

**One live discrepancy found and corrected**, not in code but in an internal doc:
`src/content/content-status.md` still describes Milad's portrait as "NEEDED — no real photo added
yet," but `public/images/profile/milad-portrait.jpg` is a real 269KB photograph already in place
(added after that doc was last updated). The Person schema's `image` field is therefore **accurate
in production** — this was checked directly (unlike `coverImage` on articles/projects, which *is*
conditionally included only when the file exists) and confirmed genuinely present, not a broken
reference. No code fix was needed; flagged here only so the internal doc's staleness on this one
point is visible for a future correction.

## 2. Search engine identity — VERIFIED DATA

Checked title tags, descriptions, H1s, structured data, navigation, and footer across the
homepage, Expertise, Work, Resume, Articles, and Footer for semantic (not literal) consistency:

- **Identity string** ("Milad Ebrahimi → Business Operations → Systems → Organizational
  Transformation") appears, worded differently per context but never contradicted: the homepage
  title (`Business Operations, Systems & Organizational Transformation`), the Person schema
  `jobTitle` (`Operations Manager`) and `description` (the same CV-consistent positioning line),
  the Author Block's line (`Business Operations · Systems · Organizational Transformation`), and
  the footer wordmark tagline (`Systems · Operations · Strategy · Ideas`).
- **Five expertise areas** are named identically everywhere they appear (nav, mega menu,
  `/expertise`, homepage Five Areas section, `ARTICLE_CATEGORIES`) — this one *is* meant to be
  exact, since it's a controlled taxonomy, and it is.

No inconsistency found. No change made.

## 3. Person entity audit — VERIFIED DATA

```json
{
  "@type": "Person",
  "name": "Milad Ebrahimi",
  "url": "https://miladebrahimi.me",
  "jobTitle": "Operations Manager",
  "description": "I build the systems that move organizations forward.",
  "image": "https://miladebrahimi.me/images/profile/milad-portrait.jpg",
  "sameAs": ["https://www.linkedin.com/in/miladebrahimi-me"]
}
```

Every field is either structural (`name`, `url`) or CV-confirmed (`jobTitle`, `image` — verified
real file above). No employer, award, certification, or follower/audience claim is asserted
anywhere in this entity. No change made — already minimal and accurate.

## 4. sameAs / digital identity audit — VERIFIED DATA

Exactly one external identity is linked anywhere on the site: LinkedIn
(`linkedin.com/in/miladebrahimi-me`), sourced from `SOCIAL_LINKS` in `site.ts` and confirmed real
by Milad per `content-status.md`. It appears consistently in the footer, `/contact`, the article
`ShareLinks` component, and the Person schema's `sameAs` — always the same URL, never a variant.
No other profile (Twitter/X, Instagram, GitHub, personal blog, etc.) is linked or claimed anywhere.
**No speculative profile was added.** If Milad has other genuine public professional profiles he
wants included, that's a real input this audit can't supply on its own — see Remaining Items.

## 5. Search intent model — RECOMMENDATIONS (grounded in real, already-public site content)

| Category | Example queries | Grounded in |
|---|---|---|
| **Branded** | "Milad Ebrahimi", "Milad Ebrahimi Oman", "Milad Ebrahimi operations" | Name (Person schema); "Oman" is real — every CV role except the earliest is based in Muscat, Oman, per `/resume`'s public experience entries |
| **Expertise** | "business operations", "operations systems", "organizational systems", "process improvement", "AI business systems", "productivity systems", "organizational transformation" | The five `EXPERTISE_AREAS` and their real `tags` |
| **Content** | "why operations problems are systems problems", "AI automation broken processes", "productivity work design vs time management" | Directly answered by the three published articles' actual arguments |

No attempt is made here to target high-volume generic terms ("productivity tips," "AI tools") the
site has no evidenced authority to compete for. The model optimizes for **relevance to what's
actually true**, not traffic volume.

## 6. Article SEO audit — VERIFIED DATA + RECOMMENDATIONS

| | Operations article | AI article | Productivity article |
|---|---|---|---|
| Search intent | Someone diagnosing recurring operational friction | Someone evaluating AI adoption | Someone re-examining personal/team productivity |
| Title | Specific, states the actual argument (not generic) | Same | Same |
| Meta description | One sentence, no keyword stuffing | Same | Same |
| H1 | Matches title exactly, one per page | Same | Same |
| Heading structure | 8 logical `##` sections, sequential | Same | Same |
| URL | `/contents/articles/operations-problem-is-a-systems-problem/` — descriptive, kebab-case | `/ai-wont-fix-broken-processes/` | `/productivity-is-designing-better-work/` |
| Internal links | Related Expertise (Operations) + 2 Related Work links (real) | Related Expertise (AI) only — honestly zero Related Work | Related Expertise (Productivity) only — honestly zero Related Work |
| Expertise relationship | Direct, `category` match | Direct | Direct |
| Project relationship | Real (tag-matched) | None (honest) | None (honest) |
| Semantic relevance | High — argument matches title and category exactly | High | High |
| Readability | Short paragraphs, concrete examples, no jargon | Same | Same |
| Originality | Own framework (Structure→Process→Visibility→Accountability→Improvement), not paraphrased | Own framework (Understand→...→Improve) | Own framework (Clarity→...→Improvement) |
| Cannibalization risk | **None** — the three articles share no overlapping tags or category, so they can't compete against each other in search for the same query |

**No rewrite recommended for any article.** All three pass the audit as published. The only
content-side observation: none currently targets a query in the *Marketing* or *Leadership*
expertise areas — see §11.

## 7. Internal linking audit

**VERIFIED (already correct, unchanged):** Homepage ↔ Expertise ↔ Projects ↔ Articles ↔ Resume ↔
Contact are all reachable from every page via the primary nav and mega menus alone — full baseline
connectivity was never in question. Layered on top: Article → Expertise → Work (Phase 10), Article
→ Author Block → Resume (Phase 9), Expertise → Work + Writing (Phase 10/13), Project → Expertise +
Writing (Phase 10) — all already correct and re-confirmed this phase.

**GAP FOUND AND FIXED:** `/expertise` links to `/projects` ("See selected work") in its own closing
section, but `/projects` had no reciprocal link back to `/expertise` — the only major hub page on
the site without a closing next-step section (every individual project/article page, and
`/expertise` itself, already has one). Fixed by adding a closing section to `/projects/index.astro`
with two links — "Explore expertise" (`/expertise#matrix`) and "Read the writing"
(`/contents/articles`) — mirroring the exact pattern already used on individual project pages
(`project-related-expertise` / `project-read-writing`). This is the one implementation change made
this phase; see §11 (Implementation).

**Considered and deliberately not changed:** `/contents/articles` (the archive listing) also has
no closing CTA section. Unlike `/projects` ↔ `/expertise` (a clean one-to-one pairing), the article
archive spans three different categories at once, so there's no single "reciprocal" expertise page
to point it at — forcing one would be exactly the kind of artificial link density this phase warns
against. `/resume` also has no Expertise/Articles link, which is intentional and unchanged from
Phase 10's explicit decision to keep Resume a trust/verification layer, not a content hub.

## 8. Sitemap / indexing audit — VERIFIED DATA

Checked `dist/sitemap-0.xml`, `dist/sitemap-index.xml`, and every page's `noindex` status:

- **Published content → indexable**: homepage, Expertise, Projects (listing + all 5 detail pages),
  Resume, Contact, `/contents` and all its real sub-pages, and all 3 real articles — all present in
  the sitemap, none `noindex`.
- **Draft content → excluded**: `getStaticPaths` never generates a page for `draft: true` content
  in any collection — there is no URL to exclude, by construction.
- **Placeholder content → excluded**: not currently applicable — all 3 articles that were
  `placeholder: true` were replaced with real content in Phase 13. The exclusion mechanism (sitemap
  filter + `noindex`, built in Phase 12) remains in place and will apply automatically the moment
  any future placeholder entry exists again.
- **Legacy URLs → redirect, correctly excluded from the sitemap**: `/about/`, `/cv/`, `/books/`,
  `/work/`, and every `/articles/*` path are real 301s, and the sitemap's `filter` explicitly
  excludes all of them — confirmed in both source and built `sitemap-0.xml`.

No indexing or sitemap issue found. No change made in this section.

## 9. Google Search Console — UNAVAILABLE DATA

**Search Console data unavailable in the current environment.** No Search Console (or any Google
Search Console API/MCP) access exists in this session's toolset, and none was fabricated,
estimated, or guessed at anywhere in this document. Every number that would normally come from
Search Console — indexed page count, impressions, clicks, CTR, average position, actual search
queries, coverage issues, sitemap submission status — is absent from this report entirely, by
design.

**What Milad should check manually in Search Console** (property: `miladebrahimi.me`):

1. **Coverage / Indexing** — confirm all real pages (homepage, Expertise, Projects × 5, Resume,
   Contact, Contents × 5 sub-pages, 3 articles) show as "Indexed," and that the 5 redirect routes
   show as "Page with redirect" (expected, not an error) rather than "Excluded" for some other
   reason.
2. **Sitemaps** — submit `https://miladebrahimi.me/sitemap-index.xml` if not already submitted;
   confirm it reports "Success" with the expected page count.
3. **Performance report** — check for any impressions at all on the three article URLs and on
   branded queries ("Milad Ebrahimi").
4. **URL Inspection** — spot-check one article URL directly to confirm Google's rendered version
   matches the live page (title, description, canonical).
5. **Core Web Vitals / Experience** — a general health check, unrelated to content but worth a
   glance given the phase's performance constraint.

## 10. Search performance baseline framework — RECOMMENDATIONS (no invented numbers)

A framework for tracking growth once real data exists — not a report with numbers in it:

```
BRANDED DISCOVERY     → impressions/clicks on "Milad Ebrahimi" and close variants
                         (Search Console — see §9)
        ↓
EXPERTISE DISCOVERY   → impressions/clicks on operations/systems/organizational-
                         transformation queries (Search Console)
        ↓
CONTENT DISCOVERY     → impressions/clicks on queries the 3 articles actually answer,
                         plus on-site pageviews per article (Umami — Phase 11)
        ↓
AUTHORITY             → whether branded + expertise queries increasingly co-occur
                         (e.g. "Milad Ebrahimi operations systems") — a Search Console
                         query-report read, not a computed metric
        ↓
CONVERSION            → search visitor → article → Related Expertise/Work click
                         (cta_click, Phase 11) → Contact
```

Every stage names a real, already-available measurement source (Search Console or the existing
Umami events) — nothing here requires new tracking infrastructure. This is a lens to view existing
data through, to be filled in once Search Console/Umami have accumulated real activity — not a
dashboard this phase builds.

## 11. Content SEO opportunities — RECOMMENDATIONS (no articles written)

Based only on the five real expertise areas, their pillars (Phase 12), and the three live
articles' actual semantic territory:

- **The most obvious gap: Marketing and Leadership have zero articles.** Marketing already has
  real project evidence (Marketing & Lead Operations System) to draw on the same way the Operations
  article did; Leadership has none yet, so a Leadership piece would need to lean on CV-confirmed
  experience and framing the way the AI article did, rather than a project reference.
- **Semantic clusters worth extending** (using each area's own pillar tags, not new categories):
  - Operations/Structure: what "clear ownership" actually looks like in a document, not just a
    principle.
  - Operations/Process: the standardize-before-automate argument from the AI article, explored on
    its own from the process side rather than the AI side.
  - AI/Automation: a practical follow-up specifically on the "map → clean → standardize → connect
    → automate" sequence from §06 of the AI article.
  - Productivity/Execution: a deeper piece on the context-switching cost mentioned briefly in the
    Productivity article.
- **Internal linking opportunity for later, not now:** the Operations and AI articles argue
  closely related points (systems-thinking applied to reporting/workflow problems) but share no
  `category` or `tags`, so they don't cross-link today. If a future article is deliberately tagged
  to bridge them (e.g., an Operations-categorized piece tagged with something AI-relevant, or vice
  versa), the existing related-articles ranking (same category first, then shared tags) would
  surface the connection automatically — no code change needed when that day comes.
- **Content pillars that could eventually anchor a cluster**: Operations' "Systems" pillar already
  has the most real-work backing (5 projects) and is the natural home for future case-study-style
  articles; Marketing's single real project makes it the next most defensible area to write in.

No article is drafted or published from this list — it's a backlog of directions, matching the
`docs/content-strategy.md` planning system already established in Phase 12.

## 12. Technical SEO — VERIFIED DATA

Re-checked page titles, meta descriptions, canonical, robots, sitemap, structured data, image alt
text, heading hierarchy, link accessibility, URL consistency, trailing-slash behavior, redirects,
404, Open Graph, and Twitter cards. **No genuine issue found beyond the internal-linking gap fixed
in §7.** Nothing else was changed, per this phase's instruction to fix only real issues.

## 13. Performance — VERIFIED DATA

The one code change this phase (`/projects/index.astro`) adds a single static `<Section>` with two
existing `Button` components — no new JavaScript, no new dependency, no client-side script. Static
generation, responsive behavior, and the site's JS budget are all unaffected.
