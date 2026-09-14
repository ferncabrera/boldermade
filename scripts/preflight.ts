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

// 1. Shipping rates (Q13). Working defaults are an accepted interim state, so
//    this warns rather than blocks — but loudly, because real customers pay it.
const shippingPath = join(ROOT, 'src/generated/shipping.json');
if (existsSync(shippingPath)) {
  const shipping = JSON.parse(readFileSync(shippingPath, 'utf8'));
  if (shipping.provisional) {
    warn.push(
      'Shipping rates are PROVISIONAL defaults, not the real Squarespace figures.\n' +
      '      Customers will be charged these amounts. Replace them in Keystatic\n' +
      '      (Settings -> Shipping) and untick "provisional" before launch.'
    );
  }
} else {
  fail.push('src/generated/shipping.json missing. Run: npm run build:catalog');
}

// 1b. The frozen catalog must exist, or checkout has no prices to resolve.
if (!existsSync(join(ROOT, 'src/generated/catalog.json'))) {
  fail.push('src/generated/catalog.json missing. Run: npm run build:catalog');
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

// 5. Every image referenced by content must exist in the manifest, so nothing
//    can reference an object that was never uploaded to R2.
const manifestPath = join(ROOT, 'data/image-manifest.json');
if (existsSync(manifestPath)) {
  const keys = new Set(
    (JSON.parse(readFileSync(manifestPath, 'utf8')) as { key: string }[]).map((e) => e.key)
  );
  const missing: string[] = [];
  for (const f of readdirSync(products).filter((f) => f.endsWith('.mdoc'))) {
    for (const m of readFileSync(join(products, f), 'utf8').matchAll(/^\s*key:\s*"(.*)"\s*$/gm)) {
      if (!keys.has(m[1] ?? '')) missing.push(m[1] ?? '');
    }
  }
  if (missing.length) {
    fail.push(`${missing.length} image key(s) are not in the R2 manifest, e.g. ${missing[0]}`);
  }
} else {
  warn.push('data/image-manifest.json missing — run npm run import:products');
}

// 6. The Worker bundle must not be published as a public static asset.
const assetsIgnore = join(ROOT, 'dist/.assetsignore');
if (existsSync(join(ROOT, 'dist')) && !existsSync(assetsIgnore)) {
  fail.push('dist/.assetsignore missing — the Worker bundle would be publicly downloadable. Rebuild.');
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
