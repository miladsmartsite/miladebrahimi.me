# Publishing a New Article

Not rendered on the site — this is the workflow doc for whoever (Milad) adds content here.
Publishing a real article should take minutes, not hours, and never requires touching a
component, a route, the navigation, the sitemap, the RSS feed, or any SEO metadata by hand.

## The entire workflow

1. Create one file: `src/content/articles/my-new-article-slug.md`
2. Fill in the frontmatter (see template below).
3. Write the article body in Markdown underneath the `---`.
4. Run `npm run build` (or just `git push` if deploying via CI) — that's it.

The filename becomes the URL slug automatically
(`my-new-article-slug.md` → `/ideas/my-new-article-slug/`).

## Frontmatter template

```markdown
---
title: "A clear, specific title"
description: "One sentence — this becomes the meta description, the OG description, the RSS
  item description, and the archive-listing summary. Write it to stand alone."
publishDate: 2026-09-15
category: "Business"
tags: ["systems", "ai"]
featured: false
draft: false
placeholder: false
order: 0
---

The article body goes here, in Markdown. Write normally — headings, paragraphs, lists, links,
quotes, and code blocks all work.
```

`author` isn't in the template above because it defaults to "Milad Ebrahimi" — only add it if a
piece is ever genuinely co-authored or guest-written.

## Scheduling a publication

Set `draft: false` and a future `publishDate`, then merge to `main` as usual. Until that moment the
article has no page, no redirect, and no entry in the homepage, archive, RSS feed, or sitemap
(one rule for all of them: `src/lib/publication.ts`).

- **Time zone: UTC.** `2026-11-03T08:00:00` means 08:00 UTC. A date-only value means 00:00 UTC.
  Add an explicit offset (`2026-11-03T12:00:00+04:00`) if you prefer to think in local time.
- **Accepted formats (only these):** `YYYY-MM-DD`, or `YYYY-MM-DDTHH:MM[:SS[.fff]]` (a space instead of
  `T` also works), optionally ending in `Z` or `±HH:MM`. Write the date with or without quotes.
- **When it goes live:** the site is static, so it publishes on the first build at or after
  `publishDate`. A scheduled GitHub Actions run rebuilds hourly at :17 UTC (`.github/workflows/main.yml`);
  expect it live within roughly an hour after the time you set — not at the exact minute. The Actions tab
  also has a manual **Run workflow** button.
- **What fails the build (with the file name in the message):** a missing or empty `publishDate`; any
  other format (`Nov 3 2026`, `11/03/2026`, `2026/11/03`, `2026-11-3`, offsets like `+0400` or `UTC`);
  impossible calendar dates (`2026-02-31`, `2027-02-29`); an hour above 23, minute or second above 59;
  an offset beyond ±14:00. The raw line is checked before YAML parsing (`astro.config.mjs`), because YAML
  would otherwise quietly turn `2026-02-31` into 3 March; the content schema checks it again.
- **What is NOT caught:** a date that is valid but wrong (a typo such as `2026-11-30` for `2026-11-03`).
  Nothing can detect that, so re-read the date before you merge.

## What happens automatically once an article is published

"Published" means `draft: false`, `placeholder: false`, and the `publishDate` has been reached
(see "Scheduling a publication" above). Every item below follows that one rule.

- **Listing** — appears on `/ideas/` under its topic, and on the homepage while it is one of
  the three newest.
- **Article page** — `/ideas/<filename-without-.md>/` is generated automatically.
- **Reading time** — computed from the real word count of the body (`src/lib/reading-time.ts`),
  no manual estimate needed.
- **SEO** — title, description, canonical URL, Open Graph, Twitter Card, and `Article` JSON-LD
  (headline, description, dates, author, breadcrumb) are all generated from the frontmatter —
  see `src/pages/ideas/[slug].astro` and `src/components/SEO.astro`.
- **Sitemap** — `@astrojs/sitemap` picks up the new route on the next build. A draft, a
  placeholder, or an article that is not yet due never appears (its page isn't even built).
  Nothing to edit either way.
- **RSS** — `/rss.xml` includes every published article automatically — see
  `src/pages/rss.xml.ts`. Drafts, placeholders and not-yet-due articles are left out.
- **Related articles** — the detail page ranks other articles by same topic first, then
  shared tags, then recency, and shows up to three — no manual curation. If nothing matches
  closely enough, the section just doesn't render.
- **Previous / next** — computed from publish-date order automatically.
- **Homepage** — once at least one real (non-placeholder) article exists, the homepage Contents
  row links straight to the latest one and shows its title, with no component edit needed.

## Field reference

| Field | Required | Notes |
| --- | --- | --- |
| `title` | Yes | |
| `description` | Yes | One sentence. Used in several places (see above) — write it well. |
| `publishDate` | Yes | Read as UTC; accepted formats are listed under "Scheduling a publication". Controls when the article goes live, sort order, RSS `pubDate`, and prev/next. |
| `updatedDate` | No | Only if the piece is revised after publishing. Feeds `dateModified` in JSON-LD. |
| `author` | No (defaults to `"Milad Ebrahimi"`) | Only set this for a genuine guest byline. |
| `category` | Yes | The article's topic, one of `Time Engineering`, `Self-Coaching`, `Balance`, `Business` (from `TOPICS` in `src/lib/site.ts`). The build fails on anything else, on purpose: this is a controlled list, not free text. |
| `tags` | No (defaults to `[]`) | Secondary topics, shown on the article page and used (alongside `category`) for "related articles." |
| `featured` | No (defaults to `false`) | Not used by the current layout: lists are newest first. Kept so older files stay valid. |
| `coverImage` | No | Path under `public/`, e.g. `/images/articles/my-slug.jpg`. Renders at the top of the article page and becomes its `og:image` once the file exists. |
| `quote` | No | A short pull-quote, rendered as a large `QuoteBlock` statement partway down the article. Plain text, one or two sentences. |
| `videoUrl` | No | A YouTube/Vimeo/LinkedIn video URL. Renders a `VideoFeature` block on the article page that links out to it — never an inline embed. |
| `externalUrl` | No | Not used by the current layout. Kept so older files stay valid. |
| `draft` | Yes | `true` hides the entry everywhere: no page is generated at all (no URL, so nothing to index), and it never appears in any listing, the sitemap, or RSS. Set `false` to publish — with the `publishDate` you want it to go live on (a future date schedules it). |
| `placeholder` | Yes | `true` keeps the entry out of every public output, exactly like a draft: no page, no listing, no RSS, no sitemap. For topic-in-development stubs only. Real articles should be `false`. |
| `order` | No | Only used as a tiebreaker; `publishDate` drives the actual sort order. |

## What this does NOT require editing

- `src/pages/ideas/index.astro` or `[slug].astro` — these already read every
  published entry automatically via `getPublishedArticles()` (`src/lib/articles.ts`).
- `src/pages/rss.xml.ts` — same helper, same automatic pickup.
- `src/lib/site.ts` — nav labels and homepage teaser logic aren't per-article.
- `public/sitemap*` — generated at build time.
- Any component.

The only reason to touch a component would be changing how *every* article looks, not adding one.
