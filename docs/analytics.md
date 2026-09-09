# Analytics

Phase 11. A small, honest measurement layer for a personal-brand site —
not a marketing platform. If a number here can't be explained in one
sentence to a visitor, it doesn't belong.

## Philosophy

This site measures **behavior**, not **people**. No cookies, no personal
data, no cross-site identifiers, no fabricated business KPIs (no
"conversion rate," no "revenue," no "pipeline" — this isn't a store). The
measurement model exists to answer five real questions:

| Layer | Question |
|---|---|
| **Visibility** | How do people find the site? (referrer / source data — built into the analytics platform's own dashboard, not custom code) |
| **Engagement** | Do visitors actually explore beyond the homepage? (pageviews per session, entry/exit pages — platform-native) |
| **Content** | Which ideas attract attention? (pageviews by URL under `/contents/articles/*`, `/contents/books/*`, etc. — platform-native) |
| **Authority** | Do visitors consume deeper professional material? (`article_engagement` — the one custom signal this phase adds) |
| **Conversion** | Do visitors take a meaningful next action? (`cta_click`, parameterized by the existing `data-cta` value) |

Two custom events cover Authority and Conversion. Everything else —
Visibility, Engagement, Content — comes for free from the analytics
platform's own automatic pageview tracking, segmented by URL. Building a
separate `article_open` / `project_open` / `expertise_open` event for
"someone loaded this page" would just duplicate what a pageview already
tells you (with better tooling — referrer, session path, entry/exit —
attached by the platform itself). That's a deliberate omission, not an
oversight.

## Chosen platform: Umami (Umami Cloud)

| | GA4 | Plausible | **Umami (chosen)** |
|---|---|---|---|
| Personal-brand fit | Overbuilt — ecommerce/funnel tooling this site doesn't need | Good | Good |
| Implementation | One script + cookie consent work | One script, cookieless | One script, cookieless |
| Performance | ~45KB, multiple requests | <1KB | ~2KB, single deferred request |
| Privacy | Cookies, cross-site ID, needs a consent banner in the EU | No cookies, no PII | No cookies, no PII |
| Reporting quality | Extensive but built for funnels/ecommerce | Clean, simple | Clean, simple |
| Cost | Free | Paid hosted plan (no free tier) | **Free hosted tier**, sufficient for this site's traffic |
| Future scalability | High ceiling, wrong shape for this site | Good, but costs from day one | Good; can self-host later without changing the event model |

GA4 was ruled out first: it's built for ecommerce funnels this site
doesn't have, its script is far heavier, and it would force a cookie
consent banner — something Phase 11 explicitly says not to build unless
genuinely required. Plausible is philosophically identical to Umami but
has no free hosted tier, which matters for a site with no revenue model
attached. **Umami Cloud's free tier** gives the same privacy and
performance profile at zero cost, so it's the one platform installed.

## Environment configuration

One environment variable, and it is **not a secret** — a website id is
meant to sit in public page source:

```
PUBLIC_UMAMI_WEBSITE_ID=your-umami-website-id
```

See `.env.example`. Copy it to `.env` locally and leave the value blank
(or omit `.env` entirely) to develop with analytics fully off — no
script is requested, no listener is attached, nothing renders.
`npm run build` succeeds identically with or without it set; this is
enforced by `Analytics.astro` rendering nothing at all when the variable
is unset, not by a runtime try/catch.

In production (GitHub Actions → Hostinger), set
`PUBLIC_UMAMI_WEBSITE_ID` as a repository/environment secret so the
build step picks it up — the value itself is public once shipped, but
keeping it out of the repo still avoids hard-coding an environment-
specific id into source.

## Implementation

- **`src/components/Analytics.astro`** — the entire integration. Renders
  two `<script>` tags, both conditional on `PUBLIC_UMAMI_WEBSITE_ID`
  being set:
  1. Umami's own tracker script (`defer`, ~2KB, auto-tracks pageviews).
  2. A ~6-line delegated click listener that reads the **existing**
     `data-cta` attribute (introduced in Phase 10) and calls
     `umami.track('cta_click', { cta, path })`. This reuses the current
     CTA metadata instead of adding a parallel `data-umami-event`
     attribute to every button and link sitewide (Phase 11 §4).
- **`BaseLayout.astro`** — renders `<Analytics />` once, in `<head>`, so
  every page gets it automatically with no per-page wiring.
- **`src/pages/contents/articles/[slug].astro`** — the one
  content-specific addition: a single `IntersectionObserver` watching the
  element right after the article's full body, tags, and related-content
  links (`#article-engagement-marker`, the author-block wrapper). When it
  scrolls into view, it fires `article_engagement` once and disconnects.
  No scroll-position tracking, no percentage-scrolled math, no repeated
  events — one boolean signal: "this visitor reached the end of the
  piece." This script only renders when analytics is configured.
- **`src/env.d.ts`** — types `import.meta.env.PUBLIC_UMAMI_WEBSITE_ID`
  and the optional `window.umami` global so both script blocks type-check
  under `astro check` without `any`.

No new dependency was added to `package.json` — the tracker is loaded
from Umami's CDN via a plain `<script>` tag, the same pattern already
used for fonts.

## Event taxonomy

| Event | Trigger | Purpose | Parameters |
|---|---|---|---|
| `cta_click` | Any click on an element carrying `data-cta` (nav, hero, every homepage section, resume, contact, article share/related links, footer) | Which specific call to action a visitor actually took, across the whole Discover→Contact journey | `cta` (the existing `data-cta` value, e.g. `hero-primary-contact`), `path` (page it was clicked from) |
| `article_engagement` | Visitor scrolls to the end of an article's body (author block comes into view) | A lightweight signal that a visitor actually read an article, not just opened the tab | `path` |
| *(pageview)* | Automatic, every page load | Visibility, Engagement, and Content questions — segmented by URL in Umami's own dashboard, no custom code | *(platform-native: referrer, URL, country, device)* |

Explicitly **not implemented**, and why:
- `hero_cta_click` / `expertise_cta_click` / `resume_cta_click` / etc. as
  separate event *names* — collapsed into one `cta_click` event
  parameterized by `cta`, so the taxonomy stays at two custom events
  instead of a dozen near-duplicates (§3: "prefer a small, meaningful
  event set").
- `linkedin_click` / `email_click` as distinct events — already covered
  by `cta_click` with `cta: "footer-linkedin"` / `"contact-email"` etc.
- `article_open` / `project_open` / `expertise_open` — redundant with the
  platform's own pageview-by-URL data (see Philosophy above).
- Scroll-depth percentage tracking — explicitly excluded by §8; the
  single end-of-article marker is the "reasonable reading-depth
  threshold" called for instead.

## CTA taxonomy

All CTAs already follow one convention from Phase 10, unchanged in this
phase: lowercase, kebab-case, `{context}-{action}`. No renaming was
needed — the existing set was audited and found consistent:

`hero-primary-contact`, `hero-secondary-work`, `five-areas-explore-expertise`,
`selected-work-view-all`, `proof-view-resume`, `contents-explore`,
`books-view-all`, `final-cta-contact`, `final-cta-resume`, `nav-contact`,
`footer-email`, `footer-linkedin`, `contact-email`, `contact-linkedin`,
`resume-download-cv`, `resume-contact`, `author-block-resume`,
`article-share-linkedin`, `article-share-copy`,
`project-related-expertise`, `project-read-writing`,
`article-related-expertise`, `article-related-work`,
`expertise-see-work`, `expertise-resume`.

Any future CTA should follow the same `{context}-{action}` shape and
needs no separate tracking work — `cta_click` picks it up automatically.

## Privacy

- No cookies are set by this integration.
- No personal data (name, email, IP, form contents) is collected by
  custom code. Umami itself does not use cookies or persistent
  identifiers and does not store personally identifying information.
- No consent banner is implemented. One was deliberately **not** built:
  Umami's cookieless, non-personal-data model doesn't trigger the legal
  requirement a banner exists to satisfy, and Phase 11 explicitly warns
  against building one "unless genuinely required."
- The contact form/links on `/contact` are unaffected — no data typed or
  submitted there is read by this integration.

## Performance

- Zero JavaScript ships when `PUBLIC_UMAMI_WEBSITE_ID` is unset (local
  dev by default).
- When configured: one `defer`red ~2KB script + one ~6-line inline
  listener sitewide, plus one small `IntersectionObserver` script on
  article pages only. Nothing blocks rendering, nothing hydrates a
  framework component, nothing runs on the main thread before paint.
- No new npm dependency, no build-time cost.

## How to verify

1. Set `PUBLIC_UMAMI_WEBSITE_ID` in `.env` (or the deployment
   environment) to a real Umami website id.
2. `npm run build && npm run preview`, open the site, and check the
   Network tab for a request to `cloud.umami.is/script.js` and a
   `send` beacon.
3. Click any CTA and confirm an `Event` (via `umami.track`) shows a
   `cta_click` entry with the correct `cta` value in Umami's own
   real-time dashboard.
4. Open any published article, scroll to the author block, and confirm
   one `article_engagement` event appears.
5. Unset the variable, rebuild, and confirm no analytics request is made
   at all and the build still succeeds.

## Future measurement opportunities (not built now)

- Once real articles are published (today all three are placeholders),
  revisit whether `article_engagement`'s single threshold is still the
  right signal, or whether a second checkpoint (e.g., reaching the TOC's
  last heading) adds real insight.
- If a genuine services/booking offering is ever added, a real
  conversion funnel (not fabricated) could be layered on top of the
  existing `cta_click` data — no restructuring needed, since `cta` values
  already map cleanly to funnel stages.
- Self-hosting Umami is a drop-in swap (same event API) if Umami Cloud's
  free tier is ever outgrown.
