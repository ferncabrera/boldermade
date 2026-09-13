/**
 * Pre-deploy gate. Fails on anything that must not reach production.
 * Run before `wrangler deploy`.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fail: string[] = [];
const warn: string[] = [];

// 1. Shipping rates must be real (MIGRATION_PLAN §14 Q13).
const shipping = readFileSync(join(ROOT, 'src/lib/shipping.ts'), 'utf8');
if (/export const PLACEHOLDER_RATES = true/.test(shipping)) {
  fail.push(
    'Shipping rates are still placeholders. Replace ZONES with the real Squarespace\n' +
    '    figures and set PLACEHOLDER_RATES = false. Customers would be charged\n' +
    '    invented postage otherwise.'
  );
}

// 2. KV namespace must be bound for the sold-out guard.
const wrangler = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8');
if (wrangler.includes('PLACEHOLDER_CREATE_WITH_WRANGLER')) {
  fail.push('KV namespace id is a placeholder. Run: wrangler kv namespace create SOLD');
}

// 3. Draft policy pages must be signed off.
for (const page of ['returns', 'privacy', 'shipping']) {
  const p = join(ROOT, 'src/pages/policies', `${page}.astro`);
  if (existsSync(p) && readFileSync(p, 'utf8').includes('draft-warning')) {
    warn.push(`/policies/${page} still shows a draft banner`);
  }
}

// 4. Alt text should be real before launch (SEO + a11y), but never blocks a preview deploy.
const products = join(ROOT, 'content/products');
let alts = 0, placeholders = 0;
for (const f of readdirSync(products).filter((f) => f.endsWith('.mdoc'))) {
  for (const m of readFileSync(join(products, f), 'utf8').matchAll(/^\s*alt:\s*"(.*)"\s*$/gm)) {
    alts++;
    if (/—\s*photo\s+\d+\s+of\s+\d+\s*$/i.test(m[1] ?? '')) placeholders++;
  }
}
if (placeholders) warn.push(`${placeholders}/${alts} images still have placeholder alt text (npm run audit:alt)`);

// 5. Images must actually exist in R2 before launch.
const manifest = join(ROOT, 'data/image-manifest.json');
if (existsSync(manifest)) {
  const n = JSON.parse(readFileSync(manifest, 'utf8')).length;
  warn.push(`${n} images must be downloaded from Squarespace and uploaded to R2 before cutover`);
}

if (warn.length) {
  console.log('\nWarnings:');
  for (const w of warn) console.log(`  ! ${w}`);
}
if (fail.length) {
  console.error('\nPREFLIGHT FAILED:');
  for (const f of fail) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}
console.log('\n✓ Preflight passed\n');
