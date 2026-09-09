// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// The sitemap integration's `filter` only ever sees a URL string, not
// content-collection data, so a placeholder article's own `placeholder:
// true` flag can't be checked there directly. Reading each article's
// frontmatter here (a plain regex line-check, not a new YAML-parsing
// dependency) computes the same slugs the page itself excludes from RSS
// (see src/pages/rss.xml.ts) — so once a real article ships (placeholder
// removed from its frontmatter), it starts appearing in the sitemap with
// no config change required (Phase 12 §12).
const articlesDir = path.join(process.cwd(), 'src/content/articles');
const placeholderArticleSlugs = new Set(
  fs
    .readdirSync(articlesDir)
    .filter((file) => file.endsWith('.md') && file !== 'README.md')
    .filter((file) => /^placeholder:\s*true\s*$/m.test(fs.readFileSync(path.join(articlesDir, file), 'utf-8')))
    .map((file) => file.replace(/\.md$/, '')),
);

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
        if (['/about/', '/cv/', '/books/', '/work/'].includes(pathname)) return false;
        for (const slug of placeholderArticleSlugs) {
          if (pathname === `/contents/articles/${slug}/`) return false;
        }
        return true;
      },
    }),
  ]
});