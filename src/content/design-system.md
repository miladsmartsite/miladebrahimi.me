# Design System — Milad Ebrahimi Personal Brand

Internal documentation. Not rendered publicly. Records the visual language so it stays coherent
as the site grows, and so decisions are traceable rather than re-litigated per page.

## Status

**Live system: 2C · Harbour (slate blue + brass) — see §17. Visual richness pass — see §18.**
Sections 1–16 below document the three earlier passes (Executive Intelligence navy/gold, then its
two escalations) for history; every color and typeface named in them has been superseded. Harbour
is a full replacement of the palette and type system, not a further evolution of navy/gold — it
keeps the architecture, components, and content model those passes built (Section primitives,
PageHero, SystemCard/SystemsArchive/SystemPreview/SystemDiagram, the mobile-nav focus trap, the
evidence model) and re-skins them entirely. §18 keeps Harbour's tokens exactly as-is and instead
adds visual density on top of it — new components, a richer hero, more prominent diagrams — after
the palette pass was judged directionally correct but too text-heavy/editorial-document-like on
its own. Read §17 for color/type, §18 for the components and composition built on top of it.

---

## 1. Brand direction

**EDITORIAL INTELLIGENCE × EXECUTIVE PRECISION × DIGITAL SYSTEMS.**

Reads like a premium independent publication crossed with a systems dossier — not a SaaS landing
page, not a freelancer portfolio, not a corporate consulting template. The personality comes from
typography, numbering, and restraint, not decoration.

**The site should feel like:** a systems thinker's working archive.
**It should never feel like:** a template with the logo swapped.

Central idea (PROVISIONAL positioning, not a factual claim): *"I build the systems that make
businesses work."* Milad works across Business Operations, Business Systems, Process
Improvement, Strategy, Marketing, AI/Digital Transformation, and Construction/Real Estate — as
one continuous practice, not seven unrelated services.

## 2. Color (v3 — Executive Intelligence × Digital Systems)

Evolved from the V1/V2 warm-paper-and-terracotta system into a three-role palette: **ivory**
(editorial surface), **navy** (authority/technology — the primary dark surface), **gold**
(premium interactive accent). Terracotta survives as a *separate*, deliberately rare secondary
accent — not a replacement for gold, and not used as a drop-in anywhere gold already appears.

| Token | Value | Use |
| --- | --- | --- |
| `--color-paper` | `#faf7f0` | Base ivory background |
| `--color-paper-dim` | `#f1ebdd` | Alternate section background (rhythm, not decoration) |
| `--color-ink-950` | `#0f1420` | Primary body text (navy-tinted, not warm-black — ties text to the primary color even on light surfaces) |
| `--color-ink-900` | `#161d2c` | Reserved |
| `--color-ink-700` | `#454e60` | Secondary body text |
| `--color-ink-500` | `#7c8494` | Metadata/tertiary text |
| `--color-ink-300` | `#c7c2b2` | Large decorative numerals, hairline-adjacent borders |
| `--color-ink-100` | `#e6e0d0` | Hairline borders on ivory |
| `--color-navy-950` | `#0a0f1a` | **Primary dark surface** — immersive sections, mobile nav, portrait/diagram plate |
| `--color-navy-900` | `#121a2b` | Slightly lighter navy for nested panels within a navy section |
| `--color-navy-line` | `#232c40` | Hairline borders on navy |
| `--color-accent` | `#c6a15b` | **Muted champagne gold** — the premium interactive accent: active states, borders, large text/numerals, bars, node highlights |
| `--color-accent-ink` | `#7d631f` | Gold darkened for small text on light backgrounds — verified ≈5.35:1 against paper (gold itself measured only ≈4.37:1, just under WCAG AA's 4.5:1, so small text never uses bare `--color-accent`) |
| `--color-accent-soft` | `#f1e6cf` | Gold-tinted backgrounds (badges) |
| `--color-terracotta` | `#b5502e` | Secondary accent — rare, deliberate "human warmth" moments only (see below) |
| `--color-terracotta-ink` | `#8a3d22` | Terracotta on light backgrounds |
| `--color-terracotta-soft` | `#f2e1d3` | Terracotta-tinted backgrounds |

**Where terracotta is actually used (and where it deliberately isn't):** as of this pass,
terracotta is defined as a token but not yet placed anywhere specific — gold covers every
interactive/accent need introduced so far. It's reserved for a future genuinely human moment (a
pull-quote, a handwritten-feeling note) rather than being forced in somewhere to "use" it. Two
colors competing for the same "accent" role in the same view would undercut the "one strong
accent" principle — better to leave it unused than to dilute gold's meaning.

**A real contrast bug this palette shift surfaced and fixed:** gold (`--color-accent`, a light
color) paired with pale text (`text-paper`) on hover states measured ~2.3:1 — a hard WCAG
failure. Every button/nav state that used `text-paper` on a gold background was changed to dark
navy text (`text-navy-950`), verified ≈7.7:1. See `Button.astro`'s `primary` and `accent`
variants.

**Navy vs. ink-950 — why two dark tokens:** `--color-ink-950` is a *text* color, tuned to read
correctly against light paper. `--color-navy-950` is a *surface* color, tuned to be an immersive
background. They're deliberately close but not identical — using ink-950 as a section background
would look flat; using navy-950 as body text on paper would look slightly off. Each stays in its
lane.

**Contrast:** body text `ink-700` on `paper` ≈ 8.3:1 (AAA). `ink-950` on `paper` ≈ 15.8:1 (AAA).
`accent-ink` on `paper` ≈ 5.4:1 (AA for normal text). Base `accent` is reserved for large text,
borders, and backgrounds where the 4.7:1 ratio against paper is sufficient — small accent-colored
text always uses `accent-ink`, never bare `accent`.

No gradients, no glassmorphism, no drop shadows except the two functional ones already in use
(dropdown/menu separation). Borders are 1px hairlines; nothing is rounded above the default
button/tag radius already in use (near-zero — an intentional editorial, not-SaaS choice).

## 3. Typography

Fraunces (display, self-hosted variable, weight 300–700 + italic 400–500) for anything that
carries brand personality; Inter (self-hosted variable, weight 400–800) for everything read at
length or functional. Both already self-hosted — no runtime Google Fonts request.

| Level | Face | Example size (desktop → mobile) | Use |
| --- | --- | --- | --- |
| Masthead | Fraunces | 0.875rem, tracked | The "MILAD EBRAHIMI" byline above the hero eyebrow |
| Display / Hero H1 | Fraunces | 4.5rem → 2.75rem | Hero headline only |
| Headline / H2 | Fraunces | 2.25rem → 1.875rem | Section headings |
| Subheadline | Fraunces | 1.75rem → 1.5rem | Positioning statement, pull-quotes |
| Body | Inter | 1rem–1.125rem | Paragraph copy |
| Metadata | Inter | 0.75rem, tracked | Dates, tags, tool chips, client/year lines |
| Label / Kicker | Inter | 0.75rem, tracked wide, accent | Section kickers, standing labels |
| Navigation | Inter | 0.875rem | Nav links |
| Caption | Inter | 0.6875rem–0.75rem | Placeholder tags, fine print |

Numerals (system index, career dates) use Inter's tabular figures so columns of numbers align.
Large decorative index numerals (Selected Systems) use Fraunces at display scale in `ink-300`, so
they read as structure, not competing content.

## 4. Grid, spacing, containers

- **Containers:** `--container-content` (72rem, most sections), `--container-wide` (90rem, nav/
  footer and the Selected Systems archive), `--container-prose` (42rem, body copy measure).
- **Spacing:** Tailwind v4's dynamic spacing scale (multiples of `--spacing`, 0.25rem) — no
  bespoke spacing tokens; arbitrary one-off values are avoided in favor of the scale.
- **Section rhythm:** `py-20` mobile → `py-28` desktop as the default vertical rhythm, alternating
  `tone="paper" | "dim" | "ink"` so no two adjacent sections share a background (see the ordered
  list in §9).
- **Grid:** editorial 12-column grid via CSS grid (`sm:grid-cols-12`), used asymmetrically
  (e.g. 7/5 hero split, 8/4 positioning split, 3/9 system-card split) rather than even columns —
  deliberately not `[card][card][card]`.

## 5. Motion

| Token | Value |
| --- | --- |
| `--ease-premium` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--duration-fast` | 200ms — hover/focus micro-interactions |
| `--duration-base` | 500ms — reveals, mobile nav |
| `--duration-slow` | 900ms — hero text reveal, scroll-reveal |

Principles: reveal-on-scroll for section entrances (IntersectionObserver, CSS class toggle, `<noscript>` fallback so content is never hidden if JS fails), word-by-word hero text reveal (pure
CSS keyframes, no JS), hover states as the only "constant" motion (nothing loops or auto-plays
except one slow, subtle center-node pulse in the hero diagram). Everything collapses to instant
under `prefers-reduced-motion: reduce` via a single global rule — no per-component opt-out needed.

## 6. Z-index strategy

| Layer | z-index |
| --- | --- |
| Sticky header | 40 |
| Mobile nav overlay | 40 (panel) / 50 (toggle button, stays above its own panel) |
| Everything else | static (0) |

Two layers are enough for this site's actual overlap needs — no z-index scale beyond this was
introduced, to avoid a token nobody needs yet.

## 7. Breakpoint strategy

Tailwind's defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280) are used as-is — no custom
breakpoints. Design checkpoints for this redesign: 320, 375, 390, 430 (mobile), 768 (tablet),
1024–1440+ (desktop). Mobile-first classes throughout; `lg:` is where multi-column compositions
(hero, positioning, system cards) switch on.

## 8. Component principles

- **One responsibility per component.** `Section` owns width/tone/kicker/heading/reveal;
  page/section components own their specific content, not layout primitives.
- **Data-driven, not duplicated.** Anything that repeats (systems, career stops, results, areas
  of practice, speaking topics) is an array in `site.ts` or a content collection, rendered by one
  component — adding a sixth system or a new career stop never touches a page layout.
- **No orphaned one-off classes.** Recurring values (colors, spacing, radii, motion) go through
  tokens; component files should read as content + token references, not magic numbers.
- **Content collections stay the extension point.** A new article/project/book/speaking entry is
  one Markdown file; the page and homepage teaser both pick it up automatically via
  `getCollection`, with `draft`/`placeholder`/`order` controlling visibility — no template edits
  required for routine additions.

## 9. This redesign's homepage rhythm (tone sequence)

Hero (paper, untoned — but its right column carries a navy plate) → The Idea (**navy**, with the
subtle `field-grid` texture — the homepage's first full-width "visual break") → Selected Systems
(paper) → How I Work (**navy**) → Areas of Practice (dim) → Career (paper) → Results (dim) →
Ideas (paper) → Books (dim) → About (paper) → Speaking (dim) → Final CTA (**navy**, field
texture). Three navy sections plus the hero's navy plate — comfortably inside the ~20–30%
dark-surface guideline, cinematic without becoming a dark site.

## 10. Personal brand signature (recurring motifs)

Introduced deliberately, and deliberately not everywhere:

1. **Ghost numerals.** Oversized `font-display` index numbers in `ink-300` as structural markers
   (Selected Systems' `01`–`05`). Signals "archive," not "list."
2. **Technical annotation ticks.** A small row of filled/unfilled domain codes (`OPS · SYS ·
   PROC · MKT · C/RE`) derived directly from each system's real tags — reads as a spec sheet, not
   decoration, because the fill state is genuinely data-driven.
3. **The accent as interaction currency, not decoration.** Terracotta only ever appears where
   something is *active*: the current nav section, a hovered system's underline and rail number,
   the live node in the System Map, the current career-timeline marker, the results bars. It
   never appears as a passive background or a flourish.

## 11. The Milad System Map

The hero's node diagram (`SystemDiagram.astro`) is the site's one signature interactive element —
six nodes (Operations, Systems, Strategy, AI, Marketing, Writing/Ideas) around a center,
hexagonally arranged. Hovering a node (desktop, mouse) brightens its connecting line and dims the
rest, and swaps a caption readout beneath the diagram — all via CSS `:has()`, no JavaScript. A
static legend below the diagram discloses every node's label and caption unconditionally, so the
interactive layer is enhancement, not a requirement — touch and keyboard/AT users get the full
content regardless. Node labels/captions are PROVISIONAL positioning language, not new factual
claims.

## 12. Selected Systems as an archive console

The homepage's Selected Systems section (`SystemsArchive.astro`) is a three-column row per
system: a large ghost numeral / title + description + metadata + domain ticks / a conceptual
`SystemPreview` visual. Hovering or focusing a row turns its numeral gold, draws an accent
underline under the title, intensifies its `SystemPreview` (via `currentColor`), and reveals a
problem/result detail panel — all through CSS `:has()` and grid-based height transitions, no
client-side JavaScript. On mobile the detail panel is open by default (there's no hover to
disclose it with) and the visual column is hidden (`lg:flex`) to keep the row scannable at
narrow widths.

## 13. SystemPreview — conceptual system visualizations

`SystemPreview.astro` renders one of five small abstract SVG diagrams (`dashboard`, `workflow`,
`reporting`, `operations`, `marketing`) via a `type` prop, e.g. `<SystemPreview type="dashboard"
/>`. These are **always recreated/conceptual representations, never real screenshots** — several
of the five real systems involve confidential company data that can't be shown, so the rule
applies uniformly rather than case by case. All strokes/fills use `currentColor`, so the parent
controls color with an ordinary `text-*` utility class (rest state: `text-ink-300`; active state:
`text-accent`, driven by the same `:has()` rules as the rest of the archive row). Adding a sixth
system later means picking one of the five existing types (or adding a new one to the component)
and setting `previewType` in that project's frontmatter — no page-layout change required.

## 14. Imagery & portrait architecture

**No stock photography, no AI-generated likeness of Milad, anywhere in this project.** Real
photography drops into `public/images/<category>/` (see `public/images/README.md` for the full
folder map and naming convention) and is served as-is — no build-time image pipeline for these
assets, so they should be pre-optimized before adding.

`Portrait.astro` and `BookCover.astro` share one pattern: check for the real file at **build
time** via Node's `fs.existsSync`, and render either the real `<img>` or an intentional,
clearly-labeled placeholder (a navy plate with a gold "M.E." monogram and a caption naming the
exact path expected) — never a stock substitute. Once the real file is added at that exact path,
the next build automatically switches to it; no component code changes.

- **Portrait** (`profile/milad-portrait.jpg`): 4:5 aspect (3:4 also supported via the `aspect`
  prop), `object-position` adjustable per-instance via `focus` for photos needing a specific crop
  anchor. Used in the Hero (inside a navy plate alongside the compact System Map) and the About
  teaser.
- **Book covers** (`books/<slug>.jpg`): 2:3 aspect, read from each book entry's optional
  `coverImage` frontmatter field.

## 15. What was kept vs. changed across the three redesign passes

## 13. What was kept vs. changed across the two redesign passes

**Kept throughout:** the two-font system, the tone-alternation mechanic (though the dark tone is
now navy, not near-black ink), the scroll-elevating nav, the full-screen mobile nav, the
reveal-on-scroll system, the overall homepage section order (it already matched the requested
Who → What → Built → Think → Practice → Trajectory → Evidence → Write → Engage arc on the very
first audit, and still matches the newest brief's suggested flow almost exactly).

**Changed, pass 1 (formalization):** masthead line, scroll cue, tone rhythm fix on Books.

**Changed, pass 2:** the System Map became genuinely interactive; Selected Systems moved to a
sticky-rail archive console; Hero gained a computed "spec readout"; Career became a connected
timeline; Results gained a proportional accent bar; Nav gained scroll-triggered compaction.

**Changed, pass 3 (this pass — full palette evolution + imagery + navy immersion):**
- **Palette:** warm terracotta-only accent → three-role navy/ivory/gold system (§2). Fixed a real
  contrast bug this surfaced (light text on gold).
- **Imagery introduced for the first time:** `Portrait.astro` and `BookCover.astro`, both with
  graceful, clearly-labeled placeholders — no stock/generated images used to fill the gap (§14).
- **Hero rebuilt** as a true split composition: portrait + compact System Map together in a navy
  plate on the right, "Explore My Work" / "Download CV" as the two CTAs.
- **Selected Systems rebuilt again** — dropped the sticky rail in favor of the three-column
  number/content/visual row per system, now including a `SystemPreview` conceptual diagram (§12,
  §13), which didn't exist before this pass.
- **Two more navy sections added** (Positioning/"The Idea" and Final CTA both gained the
  `field-grid` texture) for the cinematic light/dark rhythm requested.
- **Ideas** split into a featured entry + smaller archive list; **Books** gained a featured-title
  treatment (large cover) with the rest as a smaller shelf; **Speaking** became a typographic
  field with deterministic size variation instead of a uniform grid; **About teaser** gained the
  portrait + a Download CV button; **Mobile nav** was rebuilt: real 44×44px touch target, navy/
  gold full-screen panel, animated icon morph, a keyboard focus trap, and a Download CV link —
  addressing every item on the mobile-nav requirements list, including the one genuinely missing
  before (focus trap).
- **One accessibility course-correction made mid-pass:** Speaking topics were initially designed
  with hover-revealed descriptions, then simplified to always-visible after recognizing nothing
  in that component was focusable — a hover-only reveal would have been unreachable for keyboard
  users. Recorded here because catching it after writing it, not before, is worth being honest
  about.

**Not changed in pass 3 (deferred to pass 4 — see §16 below, now complete):** About, Work/Projects
listing, case-study detail pages, Articles, Speaking, Contact, CV page layouts. They already share
the same tokens/components (Section, Button, Timeline, PlaceholderTag, the original `SystemCard`
for the /projects listing) so they inherit every token/palette change automatically, but their page-level
composition stays untouched until the homepage language is confirmed.

---

## 16. Pass 4 — propagating the language site-wide (one brand system, different page experiences)

The homepage established the language; this pass applied it to every remaining route without
redesigning the homepage again, per "one brand system + different page experiences," not
"every page identical."

**New shared primitives** (per the request for reusable global components):
- **`PageHero.astro`** — the non-homepage "arrival" moment: kicker + big display title +
  optional subtitle, `paper` or `navy` tone. Used at the top of About, Work, Ideas, Books,
  Speaking, Resources, Contact, and CV. Deliberately smaller/quieter than the homepage's
  cinematic `Hero.astro` — they're different components on purpose, not the same one reused.
- **`BaseLayout`'s new `structuredData` prop** — lets any page attach extra JSON-LD (Article,
  Book) beyond the sitewide Person schema, without every page reimplementing `<script
  type="application/ld+json">` by hand.
- **`src/lib/reading-time.ts`** — real word-count-based reading time for articles, no dependency.

**Per-page identity (§24's requirement that pages must NOT all look the same):**

| Page | Identity | What makes it distinct |
| --- | --- | --- |
| `/about` | Personal + professional story | Portrait, a navy "the practice" statement, a condensed timeline, capabilities as prose rows (not bars) |
| `/projects` | Systems archive | Reuses `SystemCard` (now with a `SystemPreview` visual column); a pure-CSS domain filter (`:has()` + `[data-tags~=]`, zero JavaScript) appears automatically once there's enough inventory (>3 systems, >1 domain in use) |
| `/projects/[slug]` | Project dossier | Twelve numbered sections (some collapse when a field is empty, numbering never drifts), a generic but honest Evidence-status table (CONFIRMED/SUPPORTED/NEEDS VERIFICATION), tag-based Related Systems, prev/next |
| `/articles` | Intellectual archive | One large Featured entry, then a compact dated archive list — not a card grid |
| `/articles/[slug]` | Reading experience | Prose capped at `--container-prose` (≈65–75 characters/line), tag-based related articles, Article JSON-LD |
| `/books` | Author's shelf | Reuses the homepage's `BooksShowcase` (featured cover + smaller shelf) via a new `showHeading` prop so the page doesn't duplicate its own intro; Book JSON-LD for real fields only |
| `/speaking` | Topic platform | Reuses `SpeakingTopics` (typographic field) plus a new "Why I Speak" statement and CTA; real engagements would render via the untouched `SpeakingList`/`speaking` collection if any existed |
| `/resources` | Practical library | Organized by real category (`template`/`guide`/`framework`/`tool`/`download`/`link` — `framework` added to the schema enum this pass since the brief named it explicitly), with an honest "Nothing here yet" per empty category rather than one blanket message |
| `/contact` | Human invitation | Three real pathways only (email/LinkedIn/CV) — no fake form |
| `/cv` | Professional reference | Unchanged structure, now with a real Download CV button (previously said "not available yet" — the CV URL exists now) |
| `/404` | Brand moment | "404 / System not found" on a full navy `field-grid` surface — same ghost-numeral and navy language as everywhere else, not a generic error page |
| `/work` | (Unlisted) full experience detail | Retitled "Experience" in its own `<title>` to stop colliding with the nav's "Work" (which points at `/projects`) — same content, clearer identity |

**A real bug caught and fixed during this pass:** a `Button` override (`class="border-ink-300
text-paper ..."` on the 404 page's secondary CTA) would **not** have reliably beaten the
variant's own classes — Tailwind's cascade is resolved by stylesheet order, not by which class
appears later in the `class` attribute. Fixed by using `!`-important overrides, the same pattern
already established elsewhere in this codebase (`Section`'s `!py-24` usage) for exactly this
reason. Documented here so the same mistake isn't repeated the next time someone reaches for a
plain override class on a variant-driven component.

**Content-model change this pass:** added `'framework'` to the `resources` collection's `type`
enum (previously `template | guide | tool | download | link`) — the brief's resources category
list explicitly named "Frameworks," and the schema needed to actually support it before the page
could use it.

**Still not done (explicitly out of scope, or blocked on real assets, not a decision to skip):**
- No real portrait or book cover photography exists yet — every `Portrait`/`BookCover` instance
  site-wide still renders its placeholder. This is the single biggest remaining gap between "the
  architecture is ready" and "the site looks fully finished" — see content-status.md.
- Page transitions (§16 of the brief) were not added — Astro's View Transitions API would be the
  right tool, but introducing it now, untested, across a freshly-restructured 12-page site risked
  more than the subtle polish it would add. Flagged as a good next increment, not skipped by
  oversight.
- A CSS-only domain filter was added to `/projects`; the same pattern could extend to `/articles`
  (filter by tag) if the archive grows enough to need it — not added yet since three articles
  don't need filtering.

## 17. Pass 5 — 2C · Harbour (approved final design system)

A full palette and typography replacement per an approved external handoff ("Color and type
pairings for ME" → direction 2C). Not an evolution of navy/gold — a different design language
applied to the same architecture (Section/PageHero primitives, SystemCard/SystemsArchive/
SystemPreview/SystemDiagram, the content-collection routing, the mobile-nav focus trap). Positioning:
"closer to a studio than a startup" — quiet, classical, editorial, restrained. The luxury comes
from typography, spacing, and composition, not from more gold.

### Color tokens (`src/styles/global.css`)

| Token | Hex | Role |
| --- | --- | --- |
| `--color-ink` | `#22344a` | Primary text on paper; the one dark/immersive surface (no second dark shade) |
| `--color-paper` | `#edebe3` | Base editorial surface |
| `--color-paper-dim` | `#e4e0d2` | Alternate section background, same family |
| `--color-body` | `#55524b` | Paragraph text on paper |
| `--color-meta` | `#6d6757` | Metadata/tertiary text on paper — darkened from the handoff's `#8e8878` |
| `--color-line` | `#d5d1c6` | Hairline borders/dividers on paper |
| `--color-accent` | `#c9a227` | Brass — rules, underlines, active states, small markers only |
| `--color-accent-ink` | `#816311` | Brass as small text on paper — darkened from the handoff's `#8a6e12` |
| `--color-accent-tint` | `#efe0b0` | Large-fill brass (buttons, filter chips, badges) |
| `--color-on-dark-muted` | `#a6b5c8` | Secondary text on the ink surface |
| `--color-on-dark-line` | `#3f5470` | Hairlines on the ink surface |

**The two documented exceptions:** `--color-accent-ink` and `--color-meta` are each darkened a
few percent from the handoff's literal hex. Measured as small text on `--color-paper` (their
primary use — kickers, tags, metadata, source lines), the literal values land at ≈4.08:1 and
≈2.96:1 against paper — both fail WCAG AA's 4.5:1 for normal-size text. This is the same category
of fix §2 already made once for the previous gold palette (`#93762f` → `#7d631f`); the adjustment
is a few points of lightness, not a different color. Every other token is used at its exact
handoff value. Verified contrast: `--color-body` on paper ≈6.5:1, `--color-on-dark-muted` on
`--color-ink` ≈6.1:1, `--color-accent-ink` (adjusted) on paper ≈4.7:1, `--color-meta` (adjusted)
on paper ≈4.7:1, `--color-ink` text on `--color-accent` (buttons/badges) ≈5.2:1.

**Back-compat aliases:** every component was authored against the previous palette's token names.
Rather than hand-editing every class string, `global.css` aliases the old names onto the new
values (`--color-ink-950` → `--color-ink`, `--color-navy-950` → `--color-ink`, `--color-ink-700`
→ `--color-body`, `--color-ink-500` → `--color-meta`, `--color-ink-300`/`--color-ink-100` → the
single `--color-line`, `--color-navy-line` → `--color-on-dark-line`, `--color-accent-soft` →
`--color-accent-tint`). This re-themes the whole site correctly by construction. The one place
this could have gone wrong — `ink-500`/`ink-700` used as text on a dark surface, where `--meta`/
`--body`'s paper-tuned darkness would read as near-invisible on `--ink` — was audited file by file;
the only two real instances (Hero.astro, Footer.astro) were rewritten to use `--on-dark-muted`
directly rather than relying on the alias. `ink-300`'s two roles (pale border on paper, muted text
on dark) both land safely on `--line` (verified ≈8.3:1 against `--color-ink`), so it aliases
cleanly either way.

**Brass discipline (verified, not just documented):** grep-audited — `--color-accent` never
appears as a background fill wider than a 1px rule, an underline, a small dot/marker, or the
center node of the System Map. Every button, filter chip, and badge that needs a filled brass
surface uses `--color-accent-tint` (paired with `--color-ink` text) instead.

### Typography

Three families, three jobs — no overlap:

- **Bricolage Grotesque** (`font-display`) — display + structural UI: hero, section headings,
  card/entry titles, the wordmark, nav brand. Always bold (700) or heavier, with tight tracking
  (`-0.02em` to `-0.045em` depending on scale).
- **Crimson Pro** (`font-body`) — reading + voice. This is the sitewide default: `body` sets
  `font-family: var(--font-body)`, so any text with no explicit font class is already Crimson Pro.
  Italic is the brand's "voice" register (taglines, notes, the ghost/secondary link variant of
  `Button`).
- **IBM Plex Mono** (`font-mono`) — functional metadata only: eyebrows/kickers, dates, tags,
  domain codes, button/label text, standing badges. Never sentences.

All three are self-hosted (`public/fonts/`), sourced from the official Fontsource builds at build
time rather than a runtime Google Fonts request — same performance posture as the previous
Fraunces/Inter setup. Preload links in `BaseLayout.astro` cover the two above-the-fold families.

### Geometry

Radius is 0 everywhere. No component applies a `rounded-*` utility except the handful of small
(≤6px) circular markers already in the codebase (career-timeline dots, list-item bullets) — these
read as "small visual markers," the one explicitly sanctioned use of a filled brass shape, never
as a card or pill. No `shadow-*` utility is used anywhere; elevation doesn't exist in this system,
only hairlines (`--color-line` on paper, `--color-on-dark-line` on ink).

### Motion

Retuned to be quieter, per the handoff's explicit "no entrance-animation-heavy website, no
looping/ambient motion" instruction:
- `--duration-fast` 160ms / `--duration-base` 320ms (was 200ms/500ms/900ms), `--ease-out` a
  standard ease-out curve (was a slower "premium" custom curve).
- The homepage hero's word-by-word staggered reveal was removed — the headline now renders
  plainly. The scroll-cue's infinite loop animation was removed (the line is now static).
- The System Map's one-time line-draw-in on load is kept (it's a single reveal, not a loop); its
  ambient 3.2s infinite pulse on the center node was removed.
- The scroll-reveal system (`[data-reveal]`, IntersectionObserver-driven) is kept but tuned down:
  smaller offset (0.75rem, was 1.25rem), shorter duration.

### The dark ink hero

The homepage hero (`Hero.astro`) is now a full `bg-ink` surface end to end (previously paper, with
only the portrait plate in navy) — the handoff's "dark ink hero" direction. The portrait/System
Map plate is a hairline-bordered frame with no fill of its own, since the whole section is already
ink — consistent with "no elevation, hairlines only." The desktop `Nav` stays light/paper-styled
and sits above the hero as a separate sticky bar; only the mobile full-screen menu (`MobileNav`)
uses the ink surface for navigation chrome, per the handoff's explicit instruction for that
surface specifically.

**A real bug caught by testing, not just written correctly the first time:** `Button`'s
`secondary` variant (`border-ink text-ink`) is illegible on an ink background — border and text
both match the surface. This shipped as a genuine mistake on the hero's "Download CV" CTA (the
`accent`/tint-fill CTA next to it was fine) and on `/404`'s "Explore the work" link, caught by
computed-style inspection in the browser, not by reading the code. Both now carry an explicit
`!border-on-dark-line !text-paper hover:!border-accent hover:!text-accent` override at the call
site — the same `!important` pattern already established in this codebase for exactly this
situation. Every other `secondary`/`ghost`/`primary` button in the site was grep-audited against
its surrounding `Section`'s tone and confirmed to sit on paper/dim, where the un-overridden
variant is correct.

### The ME wordmark (`src/components/Wordmark.astro`)

New reusable component implementing the handoff's wordmark system: `size="large"` (the full
mark — 90px "ME," a 92×3px brass rule, name, italic tagline) for the footer, and `size="small"`
(a compact boxed "ME" + brand name) for the desktop nav and the mobile-nav panel's reversed header.
A `reversed` prop swaps to the on-dark tokens. Fixing a focus-order regression this introduced:
adding the wordmark as the mobile nav panel's first link put it ahead of the actual nav items in
DOM order, so the panel's open-state auto-focus landed on the logo instead of "About" — caught via
`document.activeElement` inspection, fixed by pointing initial focus explicitly at the first
`.mobile-nav-item a` rather than `getFocusable()[0]`. The focus trap's first/last (Tab-cycle
boundaries) still include the logo; only the *initial* autofocus target changed.

### QA performed for this pass

`npm run build` (19 pages, 0 errors) and `astro check` (0 errors — only pre-existing Zod-deprecation
and unused-declaration hints, unrelated to this change) both pass. In-browser verification used
computed-style/DOM assertions rather than screenshots once the pane reported itself hidden (a
hidden tab freezes CSS-transition and rAF timelines in this environment, so screenshots and
`getAnimations()` progress are unreliable there — confirmed by checking `document.body`'s resolved
background/text colors directly instead, which matched the intended tokens exactly). Verified:
every new CSS custom property resolves to its documented hex; mobile-nav focus trap, Escape-close,
focus-return-to-toggle, and zero horizontal overflow at 375px all still pass after the wordmark fix;
a case-study page and `/404` render with the correct fonts/weights.

### Still not done

Unchanged from §16: no real portrait/book-cover photography, no page transitions. Both remain
deliberate deferrals, not oversights.

## 18. Visual master polish (richness on top of Harbour)

Harbour's tokens (§17) didn't change here — this pass responds to feedback that the site, while
color-correct, still read as too minimal and text-heavy ("editorial-document-like"). The fix is
composition and new reusable visual primitives, not new colors or fonts.

### New components

- **`Wordmark.astro`'s identity plate, in `Hero.astro`.** The homepage hero's right column is now
  a framed "identity plate": brass corner brackets, a `Fig. 01 — Profile` / `4:5` technical
  annotation row, the `Portrait`, then a name plate (`MILAD EBRAHIMI` + domain list) below it. The
  System Map — previously compressed into this same corner — moved out to its own full-width
  section (see below), so the hero is a single dominant composition, not a hero-plus-diagram.
- **`QuoteBlock.astro`** — a large pull-quote/statement moment (oversized quotation mark, bold
  Bricolage statement, brass rule). Used on the homepage (Career section, closing on
  `HOME.manifesto`) and available to articles via the new `quote` frontmatter field.
- **`VideoFeature.astro`** — poster/title/duration/category/url, with a tasteful "Video coming
  soon" state when `url` is omitted (never a fake/broken player). Placed once, on `/speaking`
  under a new "On video" section — the one place a recorded talk would actually belong. Also
  wired into article detail pages via an optional `videoUrl` field.
- **`ArticleImage.astro`** — same build-time `fs.existsSync` placeholder pattern as
  `Portrait`/`BookCover`, for the article `coverImage` field. Renders nothing (not even a
  placeholder box) when an article simply has no image configured, since a header image is
  optional for an article in a way a portrait or book cover isn't.

### Enhanced existing components

- **`SystemPreview.astro`** — all five conceptual diagrams (dashboard/workflow/reporting/
  operations/marketing) got more detail: background grid lines, small `<text>` annotations
  (`REQ`/`REVIEW`, `REACH`/`LEADS`, `OPS`), and — new — one permanent brass "evidence marker" dot
  per diagram using `var(--color-accent)` directly rather than `currentColor`, so every preview
  carries a small fixed brass accent even at rest, not just on hover. Still pure inline SVG, still
  conceptual/recreated, never a real screenshot.
- **Preview prominence.** Default opacity raised (0.5 → 0.65–0.7) in `SystemCard` and
  `SystemsArchive`, and — since the preview was previously `hidden` below `lg` entirely — a
  compact copy of the same preview now shows on mobile/tablet too (point: "diagrams shouldn't
  become tiny unreadable graphics," not "diagrams disappear on mobile").
- **`BookCover.astro`** placeholder now reads as a closed physical book (a brass spine rule down
  the left edge, a faint page-edge hatching on the right) instead of a flat typographic plate.
- **`Career.astro`** — added a large ghost year numeral per timeline entry (parsed from the
  existing `period` string — no new data), and closes with the new `QuoteBlock`.
- **`Results.astro`** — metrics enlarged substantially (5xl/6xl → 7xl/8xl), the proportional bar
  became a proper 3px `.brass-rule`, and columns get a hairline divider at `sm+`.
- **The System Map** is no longer hero-only: it's now also a dedicated full-width section on the
  homepage (`tone="dim"`, non-dark `SystemDiagram` variant — the hero above it is already the
  dark/navy beat, so this one stays on the paper family to preserve tone alternation).

### Content/schema additions (no fabrication)

- `articles` schema gained two optional fields: `quote` (a short pull-quote string) and `videoUrl`
  (an external video link). Both are purely presentational hooks — nothing renders until a real
  article sets them, and none of the three current placeholder articles do.
- All three books' `coverImage` frontmatter now points at the exact filenames requested
  (`self-coaching-blueprint.jpg`, `the-balance.jpg`, `time-engineering.jpg`) — the paths didn't
  exist before this pass, so `BookCover` had nothing to check for and always showed the
  placeholder. Documented in `public/images/README.md`.

### QA performed for this pass

`npm run build` (19 pages, 0 errors) and `astro check` (0 errors, same pre-existing hints) both
pass. Verified via DOM/computed-style assertions rather than screenshots for most of this pass —
the Browser pane's screenshot capture was unreliable mid-session (blank captures at scroll
positions where `getComputedStyle` simultaneously confirmed correct colors, opacity 1, and
visible layout — a capture/paint bug in that specific tool, not a page bug; DOM/text-content
extraction and computed style reads were used as the source of truth instead, and matched
expectations throughout). Confirmed: zero horizontal overflow at 320/375/390/430px on the
homepage; zero image/font 404s network-wide (placeholders correctly never request a file that
doesn't exist); Self-Coaching Blueprint still renders as the featured book; CV/LinkedIn/email
links resolve to the confirmed real destinations; all 19 routes return 200.

### Still not done

Same two items as §16/§17: no real portrait/book-cover photography, no page transitions. A third
Video architecture is now built and placed, but has no real video yet — same "ready, not faked"
treatment as everything else.
