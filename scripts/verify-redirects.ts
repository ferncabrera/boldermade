/**
 * Asserts every legacy Squarespace URL 301s to a URL that returns 200.
 * Run against a deployed origin: node scripts/verify-redirects.ts https://staging...
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] ?? 'http://localhost:8788').replace(/\/$/, '');

const rules = readFileSync(join(ROOT, 'dist/_redirects'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => { const [from, to, code] = l.split(/\s+/); return { from, to, code }; });

console.log(`\nVerifying ${rules.length} redirects against ${base}\n`);

let failed = 0;
for (const rule of rules) {
  try {
    const res = await fetch(base + rule.from, { redirect: 'manual' });
    const location = res.headers.get('location');
    const ok = String(res.status) === rule.code && location?.endsWith(rule.to!);
    if (!ok) { failed++; console.log(`  ✗ ${rule.from}  ->  ${res.status} ${location ?? ''} (want ${rule.code} ${rule.to})`); continue; }

    const final = await fetch(new URL(rule.to!, base), { redirect: 'follow' });
    if (!final.ok) { failed++; console.log(`  ✗ ${rule.from}  ->  target ${rule.to} returned ${final.status}`); continue; }
    console.log(`  ✓ ${rule.from}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${rule.from}  ->  ${err instanceof Error ? err.message : err}`);
  }
}

console.log(failed ? `\n${failed} of ${rules.length} failed\n` : `\nAll ${rules.length} redirects OK\n`);
process.exit(failed ? 1 : 0);
