import type { AstroIntegration } from 'astro';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * Build-time Cloudflare output shaping.
 *
 * 1. `_redirects` from each product's `legacySlugs`. Redirects are DATA, not
 *    config: adding an old URL in Keystatic produces a 301 on the next build
 *    with no code change. Every Squarespace URL must land somewhere (§8.3).
 *
 * 2. `.assetsignore`, so Workers Static Assets does not publish the Worker
 *    bundle itself. Without it `dist/_worker.js/` is uploaded as static
 *    assets and the server source becomes publicly downloadable. The Astro
 *    Cloudflare adapter does not generate this — verified against v12.6.13.
 */
export function redirectsIntegration(): AstroIntegration {
  return {
    name: 'bolder:cloudflare-output',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const { getAllProducts } = await import('../lib/catalog.ts');
        const products = await getAllProducts();

        const lines: string[] = [
          '# Generated at build time — do not edit by hand.',
          '# Source: each product\'s legacySlugs in Keystatic.',
          '',
          '# Squarespace listed the home page at /home as well as /, which split',
          '# it into two indexed URLs. Collapse them.',
          '/home / 301',
          '',
          '# Retired Squarespace product URLs -> readable slugs.',
        ];

        let count = 0;
        for (const p of products) {
          for (const legacy of p.legacySlugs) {
            if (!legacy) continue;
            const target = p.status === 'published' ? `/shop/p/${p.slug}` : '/shop';
            lines.push(`/shop/p/${legacy} ${target} 301`);
            count++;
          }
        }

        lines.push(
          '',
          '# The custom-payment listing was a price-editing shim, not a product.',
          '# Commissions now run through Stripe Payment Links (§7.5).',
          '/shop/p/sqtf2ekwh6wa01pzfryruvdsswlian /custom-work 301',
          ''
        );

        const outDir = fileURLToPath(dir);
        writeFileSync(join(outDir, '_redirects'), lines.join('\n'), 'utf8');
        logger.info(`wrote ${count + 2} redirects to _redirects`);

        writeFileSync(
          join(outDir, '.assetsignore'),
          ['_worker.js', '_routes.json', '.assetsignore', ''].join('\n'),
          'utf8'
        );
        logger.info('wrote .assetsignore (keeps the Worker bundle out of public assets)');

        // 3. robots.txt and _headers depend on the environment, so they are
        //    generated rather than hand-maintained. A staging build must be
        //    impossible to index even if someone forgets Cloudflare Access.
        const staging = process.env.NOINDEX === '1';

        writeFileSync(
          join(outDir, 'robots.txt'),
          staging
            ? ['# Staging build — not for indexing.', 'User-agent: *', 'Disallow: /', ''].join('\n')
            : [
                'User-agent: *',
                'Allow: /',
                'Disallow: /api/',
                'Disallow: /keystatic/',
                'Disallow: /cart',
                '',
                'Sitemap: https://www.boldermade.ca/sitemap-index.xml',
                '',
              ].join('\n'),
          'utf8'
        );

        const headers = [
          '/*',
          '  X-Content-Type-Options: nosniff',
          '  Referrer-Policy: strict-origin-when-cross-origin',
          '  X-Frame-Options: DENY',
          ...(staging ? ['  X-Robots-Tag: noindex, nofollow'] : []),
          '',
          '/img/*',
          '  Cache-Control: public, max-age=31536000, immutable',
          '',
        ];
        writeFileSync(join(outDir, '_headers'), headers.join('\n'), 'utf8');
        logger.info(staging ? 'wrote robots.txt + _headers (STAGING: noindex)' : 'wrote robots.txt + _headers');
      },
    },
  };
}
