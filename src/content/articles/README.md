# Publishing a New Article

Not rendered on the site — this is the workflow doc for whoever (Milad) adds content here.
Publishing a real article should take minutes, not hours, and never requires touching a
component, a route, the navigation, the sitemap, or any SEO metadata by hand.

## The entire workflow

1. Create one file: `src/content/articles/my-new-article-slug.md`
2. Fill in the frontmatter (see template below).
3. Write the article body in Markdown underneath the `---`.
4. Run `npm run build` (or just `git push` if deploying via CI) — that's it.

The filename becomes the URL slug automatically (`my-new-article-slug.md` → `/articles/my-new-article-slug`).

## Frontmatter template

```markdown
---
title: "A clear, specific title"
description: "One sentence — this becomes the meta description, the OG description, and the
  archive-listing summary. Write it to stand alone."
publishDate: 2026-09-15
tags: ["systems", "ai"]
draft: false
placeholder: false
order: 0
---

The article body goes here, in Markdown. Write normally — headings, paragraphs, lists, links,
and code blocks all work.
```

## What happens automatically once `draft: false`

- **Listing** — appears on `/articles` (in the archive, or as the new "Featured" entry if it's
  the most recent by `publishDate`).
- **Article page** — `/articles/<filename-without-.md>` is generated automatically.
- **Reading time** — computed from the real word count of the body (`src/lib/reading-time.ts`),
  no manual estimate needed.
- **Category label** — the first entry in `tags` is shown as the article's category on both the
  listing and the detail page. Put the most representative tag first.
- **SEO** — title, description, canonical URL, Open Graph, and Twitter Card metadata are all
  generated from the frontmatter (see `src/components/SEO.astro`).
- **Structured data** — an `Article` JSON-LD block is generated automatically (headline,
  description, publish date, author) — see `src/pages/articles/[slug].astro`.
- **Sitemap** — `@astrojs/sitemap` picks up the new route on the next build; nothing to edit.
- **Related articles** — the detail page automatically shows other articles that share at least
  one tag — no manual curation.

## Field reference

| Field | Required | Notes |
| --- | --- | --- |
| `title` | Yes | |
| `description` | Yes | One sentence. Used in three places (see above) — write it well. |
| `publishDate` | Yes | `YYYY-MM-DD`. Controls sort order and the "Featured" slot (most recent). |
| `updatedDate` | No | Only if the piece is revised after publishing. |
| `tags` | No (defaults to `[]`) | First tag = displayed category. Shared tags drive "related articles." |
| `coverImage` | No | Path under `public/`, e.g. `/images/articles/my-slug.jpg`. Renders as a large image beside the Featured entry and at the top of the article page. Drop the file in and it appears — no other change needed. See `public/images/README.md`. |
| `quote` | No | A short pull-quote, rendered as a large `QuoteBlock` statement partway down the article. Plain text, one or two sentences. |
| `videoUrl` | No | A YouTube/Vimeo/LinkedIn video URL. Renders a `VideoFeature` block on the article page that links out to it — never an inline embed. |
| `externalUrl` | No | Set this if the piece is published elsewhere (LinkedIn, Medium) instead of on this site — the listing will link out instead of to a local page. |
| `draft` | Yes | `true` hides the entry from every listing entirely. Set `false` to publish. |
| `placeholder` | Yes | `true` shows a visible "Placeholder" badge — for demo/topic-in-development entries only. Real articles should be `false`. |
| `order` | No | Only used as a tiebreaker; `publishDate` drives the actual sort order. |

## What this does NOT require editing

- `src/pages/articles/index.astro` or `[slug].astro` — these already read every non-draft entry
  automatically via `getCollection('articles', ...)`.
- `src/lib/site.ts` — nav labels and homepage teaser logic aren't per-article.
- `public/sitemap*` — generated at build time.
- Any component.

The only reason to touch a component would be changing how *every* article looks, not adding one.
