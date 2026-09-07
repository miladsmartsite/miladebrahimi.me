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

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [
    sitemap({
      // Legacy routes that only exist as 301-style redirects (each already
      // emits noindex + a canonical pointing at its real destination — see
      // the pages themselves) — excluded so the sitemap only ever lists a
      // page's one canonical URL, never the old address that forwards to
      // it. Matched by exact pathname, not suffix, so this can't also
      // catch a real page that merely ends the same way (e.g. the actual
      // /contents/articles/ listing).
      filter: (page) => !['/about/', '/cv/', '/books/', '/work/', '/articles/'].includes(new URL(page).pathname),
    }),
  ]
});