/**
 * Lists product images still carrying importer-generated placeholder alt text.
 *
 * Placeholders match "<ring> — photo N of M". Anything else is assumed to be a
 * real human description and is not reported.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'content/products');
const PLACEHOLDER = /—\s*photo\s+\d+\s+of\s+\d+\s*$/i;

let total = 0;
let todo = 0;
const byProduct: Record<string, string[]> = {};

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.mdoc'))) {
  const text = readFileSync(join(DIR, file), 'utf8');
  for (const m of text.matchAll(/^\s*alt:\s*"(.*)"\s*$/gm)) {
    total++;
    const alt = m[1] ?? '';
    if (PLACEHOLDER.test(alt) || !alt.trim()) {
      todo++;
      (byProduct[file.replace('.mdoc', '')] ??= []).push(alt);
    }
  }
}

const done = total - todo;
console.log(`\nAlt text: ${done}/${total} written, ${todo} still placeholder\n`);
for (const [product, alts] of Object.entries(byProduct)) {
  console.log(`  ${product}  (${alts.length})`);
}
if (todo) {
  console.log(
    `\nEdit these in Keystatic under each ring's Photos. Describe the piece as you would\n` +
    `to someone who cannot see it — metal, stone, shape, setting.\n`
  );
}
