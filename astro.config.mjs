// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Required for SEO: canonical URLs, sitemap, and RSS all derive from this.
  site: 'https://miladebrahimi.me',

  // Fully static output — no server runtime, deployable as flat files to Hostinger public_html.
  output: 'static',

  trailingSlash: 'ignore',

  // Shiki's default theme injects inline color styles on every code block,
  // which override the hand-written Harbour code-block CSS (.prose pre/code
  // in global.css) since inline styles always win over classes. Disabling
  // it — rather than fighting it with a Shiki theme config — keeps code
  // blocks fully in Harbour's own ink/paper palette with no per-token
  // styling library to maintain (Phase 9 §17: a highlighter isn't actually
  // necessary here).
  markdown: {
    syntaxHighlight: false,
  },

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [
    sitemap({
      // Legacy routes that only exist as 301-style redirects (each already
      // emits noindex + a canonical pointing at its real destination — see
      // the pages themselves) — excluded so the sitemap only ever lists a
      // page's one canonical URL, never the old address that forwards to
      // it. `/articles/` covers both the bare listing redirect and every
      // per-slug redirect (`/articles/<slug>/`, now that individual
      // articles live at /contents/articles/<slug>/) — matched by prefix
      // there, by exact pathname everywhere else, so this can't also catch
      // the real /contents/articles/ listing.
      filter: (page) => {
        const { pathname } = new URL(page);
        if (pathname.startsWith('/articles/')) return false;
        return !['/about/', '/cv/', '/books/', '/work/'].includes(pathname);
      },
    }),
  ]
});