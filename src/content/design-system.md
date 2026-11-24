# Design system: Milad Style (website)

The site uses the same brand as the YouTube channel, the `/start` page and the free worksheet.
Source of truth for the brand itself: ME Studio `brand/BRAND.md`. This file covers how the
website applies it. (The previous "Harbour" navy-and-brass system is in git history.)

## Positioning
- **Tagline:** Engineer your time. Coach yourself. Live in balance. (It names the three books.)
- **Pillars (kicker line):** Time Engineering · Self-Coaching · Balance
- **The site's one job:** turn a visitor from YouTube into a reader who comes back, through the
  free Balance Wheel worksheet and, once an email service is connected, the weekly email.

## Logo
- **Monogram "ME"** (`src/components/Monogram.astro`): Manrope 800, tracking −0.07em, a bronze bar
  below. The bar is the same accent bar that underlines key words in every Short.
- **Wordmark** (`Wordmark.astro`): monogram + "Milad Ebrahimi"; the large version adds the bronze
  rule and the pillars line.
- Icons: `public/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png`.
  Share image: `public/images/og/default.png` (1200×630).
- Never stretch or outline the logo, never pair it with an icon.

## Colour (tokens in `src/styles/global.css`)
| Token | Hex | Use |
|---|---|---|
| `ink` | #141414 | Charcoal. Default surface; text on ivory |
| `paper` | #F4EFE6 | Ivory. Text on charcoal; reading surface |
| `paper-dim` | #EBE5D9 | Slightly deeper ivory, for rhythm |
| `accent` | #C49A5A | Bronze on charcoal (~7:1) |
| `accent-ink` | #9A6B2A | Bronze on ivory (AA for text) |
| `body`, `meta`, `line` | | Text, metadata and hairlines on ivory |
| `on-dark-muted`, `on-dark-line` | | Text and hairlines on charcoal |

One accent per view. No gradients, no shadows, nothing rounded. One full bronze band is allowed
per page at most (the homepage worksheet band).

## Type
- **Manrope 800** for headlines (−0.03 to −0.05em), 700 for smaller titles.
- **Inter 400/500** for body text, **Inter 600 uppercase +0.2em** for labels (`.label`).
- A heading may mark one key word with `*word*` (Section, PageHero): it gets the bronze underline
  bar (`.accent-u`), exactly like the Shorts.
- Fonts are self-hosted in `public/fonts/` (OFL), the same files the Shorts renderer uses.

## Surfaces
- **Charcoal** is the default (hero, videos, books, footer).
- **Ivory** for reading and for rhythm: articles, pillars, ideas, offers, legal pages.
- Inner pages open with `PageHero` (charcoal) and alternate below it.

## Components
| Component | Job |
|---|---|
| `Header` | Wordmark, six sections, the "Free worksheet" button; full-screen menu on phones. |
| `Footer` | Large wordmark, worksheet invitation, Explore / More / Follow. |
| `Section`, `PageHero` | Section rhythm and page openings; `tone` = `dark` / `paper` / `dim`. |
| `Button` | `primary` (bronze), `secondary` (bronze border), `dark` (on ivory), `ghost` (underlined link). |
| `BalanceWheel` | The book's eight-area wheel (SVG); optional example scores. |
| `SignupForm` | The only email form. Hidden until `NEWSLETTER.action` is set in `site.ts`. |
| `VideoCard` | One YouTube video; 9:16 for Shorts, 16:9 for long videos. Links out, never embeds. |
| `IdeaRow` | One article in a list. |
| `BookCover` | Real cover if the file exists, otherwise a typographic cover in the brand. |

## Navigation
Start here · Videos · Ideas · Books · Coaching · About. Footer adds Newsletter, Work & resume,
Contact, Privacy, RSS. Every older URL redirects (see `redirects` in `astro.config.mjs`).
Never create a route or file named `start`, `coach`, `go`, `dota2`, `me.english`, `me.studio` or `Tathmeer`: those are separate platforms in the same host folder. The site only links to `/start` and `/coach`.

## Voice
Calm, exact, consulting-grade. Short declarative sentences. "You", not "we". No hype words, no
emojis. Only facts marked ✅ in ME Studio `books/bio-facts.md`.
