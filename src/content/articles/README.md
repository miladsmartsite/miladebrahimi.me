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
(`my-new-article-slug.md` → `/contents/articles/my-new-article-slug/`).

## Frontmatter template

```markdown
---
title: "A clear, specific title"
description: "One sentence — this becomes the meta description, the OG description, the RSS
  item description, and the archive-listing summary. Write it to stand alone."
publishDate: 2026-09-15
category: "Operations"
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

## What happens automatically once `draft: false`

- **Listing** — appears on `/contents/articles` (in the archive, or as the page's single
  "Featured" entry — see the `featured` field below).
- **Article page** — `/contents/articles/<filename-without-.md>/` is generated automatically.
- **Reading time** — computed from the real word count of the body (`src/lib/reading-time.ts`),
  no manual estimate needed.
- **SEO** — title, description, canonical URL, Open Graph, Twitter Card, and `Article` JSON-LD
  (headline, description, dates, author, breadcrumb) are all generated from the frontmatter —
  see `src/pages/contents/articles/[slug].astro` and `src/components/SEO.astro`.
- **Sitemap** — `@astrojs/sitemap` picks up the new route on the next build; a `draft: true`
  entry never appears (its page isn't even built). Nothing to edit either way.
- **RSS** — `/rss.xml` includes every published (`draft: false`, `placeholder: false`) article
  automatically — see `src/pages/rss.xml.ts`. A `placeholder: true` entry is deliberately left
  out of the feed, since its own body says "not yet published."
- **Related articles** — the detail page ranks other articles by same category first, then
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
| `publishDate` | Yes | `YYYY-MM-DD`. Controls sort order, RSS `pubDate`, and prev/next. |
| `updatedDate` | No | Only if the piece is revised after publishing. Feeds `dateModified` in JSON-LD. |
| `author` | No (defaults to `"Milad Ebrahimi"`) | Only set this for a genuine guest byline. |
| `category` | Yes | One of `Operations`, `Marketing`, `Productivity`, `AI`, `Leadership` — the article's one primary lens. The build fails on anything else, on purpose: this is a controlled list, not free text. |
| `tags` | No (defaults to `[]`) | Secondary topics, shown on the article page and used (alongside `category`) for "related articles." |
| `featured` | No (defaults to `false`) | `true` puts this piece in the archive's single "Featured" slot regardless of date. Leave every article `false` to let the most recent one hold that slot automatically. |
| `coverImage` | No | Path under `public/`, e.g. `/images/articles/my-slug.jpg`. Renders beside the Featured entry and at the top of the article page, and becomes the page's `og:image`/`twitter:image` once the file actually exists — drop it in, no other change needed. See `public/images/README.md`. |
| `quote` | No | A short pull-quote, rendered as a large `QuoteBlock` statement partway down the article. Plain text, one or two sentences. |
| `videoUrl` | No | A YouTube/Vimeo/LinkedIn video URL. Renders a `VideoFeature` block on the article page that links out to it — never an inline embed. |
| `externalUrl` | No | Set this if the piece is published elsewhere (LinkedIn, Medium) instead of on this site — every listing link will point out to it instead of to a local page. |
| `draft` | Yes | `true` hides the entry from every listing, the sitemap, and RSS entirely — its page still exists at the URL but is `noindex`, so nothing links to it in production. Set `false` to publish. |
| `placeholder` | Yes | `true` shows a visible "Placeholder" badge and excludes the entry from RSS — for demo/topic-in-development entries only. Real articles should be `false`. |
| `order` | No | Only used as a tiebreaker; `publishDate` drives the actual sort order. |

## What this does NOT require editing

- `src/pages/contents/articles/index.astro` or `[slug].astro` — these already read every
  non-draft entry automatically via `getCollection('articles', ...)`.
- `src/pages/rss.xml.ts` — same collection query, same automatic pickup.
- `src/lib/site.ts` — nav labels and homepage teaser logic aren't per-article.
- `public/sitemap*` — generated at build time.
- Any component.

The only reason to touch a component would be changing how *every* article looks, not adding one.
