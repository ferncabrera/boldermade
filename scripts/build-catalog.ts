/**
 * Serialises the catalog and shipping config to src/generated/*.json.
 *
 * WHY THIS EXISTS: the checkout Worker must resolve prices server-side, but it
 * cannot read the content files to do it. Keystatic's reader uses node:fs and
 * process.cwd(), neither of which exists in a Cloudflare Worker — importing it
 * from an API route bundles `readdir` into the Worker, and every checkout fails
 * at runtime with no build-time warning.
 *
 * So the catalog is frozen to JSON here, before `astro build`, and the API
 * routes import that JSON. Runs automatically via the `prebuild` script.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/generated');

const { buildCatalog } = await import('../src/lib/catalog.ts');
const { createReader } = await import('@keystatic/core/reader');
const keystaticConfig = (await import('../keystatic.config.ts')).default;

mkdirSync(OUT, { recursive: true });

const catalog = await buildCatalog();
writeFileSync(join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf8');
const variants = catalog.reduce((n, c) => n + c.variants.length, 0);
console.log(`✓ catalog.json — ${catalog.length} products, ${variants} variants`);

// Shipping is content too: edited in Keystatic, frozen here for the Worker.
const reader = createReader(ROOT, keystaticConfig);
const shipping = await reader.singletons.shipping.read();
if (!shipping) throw new Error('content/settings/shipping.yaml is missing');

const config = {
  provisional: shipping.provisional,
  zones: shipping.zones.map((z) => ({
    label: z.label,
    countries: [...z.countries],
    rate: z.rate,
    minDays: z.minDays,
    maxDays: z.maxDays,
  })),
};
writeFileSync(join(OUT, 'shipping.json'), JSON.stringify(config, null, 2), 'utf8');
console.log(
  `✓ shipping.json — ${config.zones.length} zones` +
    (config.provisional ? '  (PROVISIONAL RATES)' : '')
);
