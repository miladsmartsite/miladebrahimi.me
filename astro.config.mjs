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

  integrations: [sitemap()]
});