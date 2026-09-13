import type { AstroIntegration } from 'astro';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * Generates `_redirects` from each product's `legacySlugs`.
 *
 * Redirects are DATA, not config: adding an old URL in Keystatic produces a 301
 * on the next build with no code change. Every Squarespace product URL must
 * land somewhere — see MIGRATION_PLAN §8.3.
 */
export function redirectsIntegration(): AstroIntegration {
  return {
    name: 'bolder:redirects',
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

        const out = join(fileURLToPath(dir), '_redirects');
        writeFileSync(out, lines.join('\n'), 'utf8');
        logger.info(`wrote ${count + 2} redirects to _redirects`);
      },
    },
  };
}
