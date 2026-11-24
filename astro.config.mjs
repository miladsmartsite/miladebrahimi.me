// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

import { findPublishDateProblem } from './src/lib/publication.ts';

const articlesDir = path.join(process.cwd(), 'src/content/articles');

// Validate each article's RAW `publishDate` line before YAML parsing. YAML
// silently normalises some unquoted dates (2026-02-31 becomes 3 March,
// 2026-13-01 becomes 1 January 2027), so by the time the content schema runs
// the mistake is invisible. Failing here — at build, dev and `astro check`
// start-up — names the offending file instead of publishing on the wrong day.
// The rules live in src/lib/publication.ts (shared with the schema and tests).
for (const file of fs.readdirSync(articlesDir)) {
  if (!file.endsWith('.md') || file === 'README.md') continue;
  const problem = findPublishDateProblem(fs.readFileSync(path.join(articlesDir, file), 'utf-8'));
  if (problem) throw new Error(`Invalid publishDate in src/content/articles/${file}: ${problem}`);
}

// Every URL the site has ever published keeps working after the November
// 2026 restructure (Start here · Videos · Ideas · Books · Coaching · About).
// Static output turns each into a small page with a canonical link and an
// instant redirect. Never add a route named start, coach, go, dota2,
// me.english, me.studio or Tathmeer: those are separate platforms that
// share the host folder (/resources only links to /start).
const redirects = {
  '/contents': '/ideas/',
  '/contents/articles': '/ideas/',
  '/contents/articles/[slug]': '/ideas/[slug]',
  '/articles': '/ideas/',
  '/articles/[slug]': '/ideas/[slug]',
  '/contents/books': '/books/',
  '/contents/videos': '/videos/',
  '/contents/podcasts': '/videos/',
  '/contents/more': '/coaching/',
  '/speaking': '/coaching/',
  '/resources': '/start/',
  '/expertise': '/about/',
  '/resume': '/about/resume/',
  '/cv': '/about/resume/',
  '/work': '/about/work/',
  '/projects': '/about/work/',
  '/projects/[slug]': '/about/work/[slug]',
};

// https://astro.build/config
export default defineConfig({
  // Required for SEO: canonical URLs, sitemap, and RSS all derive from this.
  site: 'https://miladebrahimi.me',

  // Fully static output, deployed as flat files to Hostinger public_html.
  output: 'static',

  trailingSlash: 'ignore',

  redirects,

  markdown: {
    syntaxHighlight: false,
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    sitemap({
      // Only canonical pages: never an old address that forwards elsewhere.
      filter: (page) => {
        const { pathname } = new URL(page);
        return !Object.keys(redirects).some((from) => {
          const prefix = from.replace(/\[slug\]$/, '');
          return from.endsWith('[slug]') ? pathname.startsWith(prefix) : pathname === `${from}/`;
        });
      },
    }),
  ],
});
