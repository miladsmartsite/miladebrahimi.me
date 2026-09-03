# Image Asset Architecture

This folder is not built/processed by Astro's image pipeline (it's under `public/`, served
as-is) — that's deliberate: these are drop-in assets Milad adds directly, without a build step.

## Folders

| Folder | Contents | Naming |
| --- | --- | --- |
| `profile/` | Portrait photography | `milad-portrait.jpg` (primary), `milad-portrait-alt.jpg`, `milad-working.jpg`, `milad-speaking.jpg` |
| `work/` | Site/project/construction environment photos, dashboard screenshots | `<system-slug>-01.jpg`, e.g. `operations-dashboard-01.jpg` |
| `books/` | Book cover photography | `self-coaching-blueprint.jpg`, `the-balance.jpg`, `time-engineering.jpg` — exact paths already set in each book's `coverImage` frontmatter field, so dropping in a correctly-named file is the only step needed |
| `speaking/` | Event/speaking photography and video posters | `<event-slug>-01.jpg`; `VideoFeature`'s `poster` prop can point here too |
| `articles/` | Per-article header images (optional, via the `coverImage` frontmatter field) | `<article-slug>.jpg` |
| `ui/` | Site-chrome images that aren't content (rare — favicon etc. lives in `public/` root) | — |
| `diagrams/` | Exported diagram images, if a future diagram isn't feasible as inline SVG | `<name>.svg` preferred over `.png` |

## Book covers (not yet supplied)

`BookCover.astro` checks each book's `coverImage` path at build time and renders an intentional
typographic placeholder (styled to read as a closed book — spine, page-edge) until the real file
exists. All three books already have their `coverImage` frontmatter set:

| Book | Expected file |
| --- | --- |
| Self-Coaching Blueprint (featured) | `public/images/books/self-coaching-blueprint.jpg` |
| The Balance Book | `public/images/books/the-balance.jpg` |
| Time Engineering | `public/images/books/time-engineering.jpg` |

Add the file at that exact path and the real cover appears automatically — no frontmatter or
component change needed. Recommended: `.jpg`, 2:3 aspect ratio (e.g. 800×1200px), under ~300KB.

## Required portrait asset (not yet supplied)

**`profile/milad-portrait.jpg`** — the primary hero/About portrait. Until this file exists, the
`Portrait.astro` component renders an intentional placeholder (a labeled frame, not a stock
photo) so the layout is correct and the gap is obvious rather than hidden.

**Recommended spec:**
- Aspect ratio: **4:5** (portrait) — also works with 3:4.
- Minimum resolution: 1200×1500px (4:5) so it holds up at full hero size on large displays.
- Format: `.jpg` (photographic) or `.webp`. Keep under ~400KB — compress before adding.
- Framing: subject positioned so the face/shoulders read well when the image is cropped tighter
  on mobile (the component uses `object-position` to keep the subject anchored — default is
  `object-top`, adjustable via the component's `focus` prop if a specific photo needs it).

## Adding a real portrait later

1. Add the file at `public/images/profile/milad-portrait.jpg`.
2. Nothing else changes — `Portrait.astro` checks for the file at build time and automatically
   switches from the placeholder frame to the real `<img>` once it exists.

## General rules

- No stock photography, ever, without explicit approval.
- No AI-generated photos of Milad, ever.
- Optimize before committing — this repo has no image-processing build step for `public/`
  assets, so an unoptimized 8MB photo stays an 8MB download.
