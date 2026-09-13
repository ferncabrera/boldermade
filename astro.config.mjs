// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
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
