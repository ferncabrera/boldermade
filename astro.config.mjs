// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import { redirectsIntegration } from './src/integrations/redirects.ts';

export const SITE = 'https://www.boldermade.ca';

export default defineConfig({
  site: SITE,
  // Static by default. Only /keystatic/* and /api/* opt out via `prerender = false`,
  // so the storefront ships as plain prerendered HTML with no framework runtime.
  output: 'static',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [
    redirectsIntegration(),
    // React and Keystatic are ADMIN ONLY. Both routes below are
    // `prerender = false`, so no React reaches a customer-facing page.
    react(),
    keystatic(),
    sitemap({
      filter: (page) =>
        !page.includes('/keystatic') &&
        !page.includes('/cart') &&
        !page.includes('/checkout/'),
      serialize: (item) => ({ ...item, lastmod: item.lastmod ?? new Date().toISOString() }),
    }),
  ],
  build: { inlineStylesheets: 'auto' },
});
