# miladebrahimi.me

Personal brand website for Milad Ebrahimi. Astro + TypeScript + Tailwind CSS, fully static
output — no server runtime, deployable as flat files.

**Status:** visual design implemented (homepage + shared design system). Copy throughout is
still provisional — see "Content status" and "What's provisional" below.

## Stack

- [Astro](https://astro.build) (static output, TypeScript strict mode)
- [Tailwind CSS v4](https://tailwindcss.com) (via `@tailwindcss/vite`, CSS-first `@theme` config)
- [@astrojs/sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
- Astro content collections (Content Layer API) for all structured content
- Self-hosted variable fonts (Fraunces + Inter) — no runtime Google Fonts request

## Design system

- **Type**: Fraunces (display/headings) + Inter (body/UI), both self-hosted as single variable
  woff2 files in `public/fonts/`. Declared in `src/styles/global.css`.
- **Color**: a warm "paper and ink" neutral scale (not cool digital gray) plus one terracotta
  accent — deliberately not tech-blue. All tokens are CSS custom properties under `@theme` in
  `src/styles/global.css` (`--color-paper`, `--color-ink-*`, `--color-accent*`), so the palette
  can be re-themed from that one block without touching components.
- **Motion**: a CSS-only scroll-reveal system (`data-reveal` attribute + IntersectionObserver in
  `BaseLayout.astro`, with a `<noscript>` fallback that shows content immediately), a word-by-word
  hero text reveal (pure CSS keyframes, no JS), and small hover/focus transitions on links and
  buttons. All motion respects `prefers-reduced-motion` (global override in `global.css`, plus
  Tailwind's `motion-safe:` on the hero animations).
- **No stock photography / no fake imagery anywhere** — sections that would typically use a photo
  (About teaser, Books) use typographic treatments instead.

## Project structure

```text
src/
  components/     Nav, MobileNav (full-screen mobile menu), Footer, Hero, Section,
                   Button, ProjectCard, ArticleCard, Timeline, SocialLinks, SEO,
                   PlaceholderTag (visible "Placeholder" badge for demo content)
  components/home/  Homepage-only sections: Positioning, AreasOfWork, BooksShowcase,
                     SpeakingList, AboutTeaser, FinalCta
  layouts/
    BaseLayout.astro   <head>, font preloads, Nav, Footer, JSON-LD Person schema,
                       global scroll-reveal script
  lib/
    site.ts        Single source of truth: brand name, nav items, social links,
                   the seven "Areas of Work", and all homepage copy (HOME object)
  content/
    projects/       Case studies (title, summary, tags + structured
                     context/challenge/approach/outcome fields)
    articles/        Long-form writing ("Ideas" in nav)
    books/           Authored / recommended / referenced books
    speaking/        Talks and conference appearances
    resources/       Templates, guides, tools, downloads (not currently in nav)
    experience/      Work history (rendered on /work as a timeline; not currently in nav)
  content.config.ts  Zod schemas for every collection above
  pages/
    index.astro        the homepage (Hero, Positioning, Selected Work, Areas of Work,
                       Ideas, Books, Speaking, About teaser, Final CTA)
    about.astro, work.astro, contact.astro, 404.astro, resources.astro
    projects/index.astro, projects/[slug].astro   (case study detail incl. context/
                       challenge/approach/outcome)
    articles/index.astro, articles/[slug].astro
    books.astro, speaking.astro
  styles/
    global.css      Font-face declarations, design tokens (@theme), motion tokens,
                    scroll-reveal utility, base resets

public/
  fonts/fraunces/, fonts/inter/   Self-hosted variable font files
  images/           Static images not run through Astro's image pipeline (currently empty —
                    the design deliberately uses no imagery yet)
  favicon.svg       Temporary placeholder monogram — replace before launch
  robots.txt        Points to /sitemap-index.xml (generated at build time)
```

## Navigation mapping

The primary nav is **About · Work · Ideas · Books · Speaking · Contact** (six items, per the
brand site's requested structure). Two labels map onto existing routes with different names:

- **Work** → `/projects` (case studies / "Selected Work")
- **Ideas** → `/articles` (long-form writing)

The original `/work` route (the experience timeline) and `/resources` still exist and build
normally — they're just not linked from the primary nav right now. Change `NAV_ITEMS` in
`src/lib/site.ts` if that mapping should change.

## Content status

Collections that appear on the homepage (`projects`, `articles`, `books`, `speaking`) each ship
with a few demo entries flagged `placeholder: true` — this is different from `draft: true`.
`draft` hides an entry from every listing entirely; `placeholder` **shows** it (so the homepage
looks complete rather than empty) but renders a visible orange "Placeholder" badge next to it via
the `PlaceholderTag` component, so nothing fabricated is ever presented unmarked. `experience` and
`resources` still use the original hidden (`draft: true`) placeholder pattern since they're not
part of the homepage.

**To replace a placeholder with real content:** edit the entry's frontmatter — set
`placeholder: false` (and fill in real values) once it reflects something real. To add a new real
entry, add a markdown file to the relevant `src/content/<collection>/` folder matching that
collection's schema in `src/content.config.ts`.

## What's provisional

Nothing on the homepage is a wireframe — it's meant to already read as a finished, launch-ready
page — but the actual words are a first draft, not final copy:

- **Hero headline/subhead and all homepage section copy** live in the `HOME` object in
  [`src/lib/site.ts`](src/lib/site.ts), each marked `[PROVISIONAL COPY]` in a comment. The hero
  itself also carries a small on-page "Draft copy" notice.
- **`SITE.positioning`** (the short tagline used in the hero eyebrow, footer, and meta
  description) is one line to edit in the same file.
- **The seven "Areas of Work" descriptions** (`AREAS_OF_WORK` in `site.ts`) are generic
  descriptions of each discipline, not claims about Milad's personal experience — rewrite freely.
- **Every project/article/book/talk** shown is a `placeholder: true` demo entry (see above) —
  replace with real work as it becomes available.

## Commands

| Command           | Action                                       |
| :---------------- | :-------------------------------------------- |
| `npm install`     | Install dependencies                          |
| `npm run dev`     | Start local dev server at `localhost:4321`    |
| `npm run build`   | Build static site to `./dist/`                |
| `npm run preview` | Preview the production build locally          |
| `npx astro check` | Type-check `.astro` files and content schemas |

## Deploying to Hostinger (static hosting)

1. `npm run build` — outputs a fully static site to `dist/`.
2. Upload the **contents** of `dist/` (not the folder itself) into `public_html/` via Hostinger's
   File Manager or an FTP/SFTP client.
3. No Node.js, build step, or server-side runtime is required on Hostinger — it only ever serves
   the static files in `dist/`.

## Not yet decided

- Contact form: static hosting has no backend, so `/contact` will need either a third-party form
  endpoint (e.g. Formspree) or a plain `mailto:` link. Not decided yet — see
  [`src/pages/contact.astro`](src/pages/contact.astro).
- Final favicon — `public/favicon.svg` is still a placeholder monogram.
- Social links — `SOCIAL_LINKS` in `src/lib/site.ts` is empty; the footer/Person JSON-LD both
  pick these up automatically once populated.
