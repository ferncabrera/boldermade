/**
 * Downloads every product photo from Squarespace's CDN to ./tmp-images/.
 *
 * ⚠️ TIME-CRITICAL. These URLs stop working when the Squarespace subscription
 * lapses, and the originals are not recoverable afterwards. Run this BEFORE
 * cancelling anything — ideally today.
 *
 *   npm run fetch:images        download to ./tmp-images
 *   npm run upload:images       push ./tmp-images to R2 (needs wrangler auth)
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'data/image-manifest.json');
const OUT = join(ROOT, 'tmp-images');
const CONCURRENCY = 4;

interface Entry { key: string; src: string }

async function download(entry: Entry): Promise<{ key: string; bytes: number; skipped: boolean }> {
  const dest = join(OUT, entry.key);
  if (existsSync(dest) && statSync(dest).size > 0) {
    return { key: entry.key, bytes: statSync(dest).size, skipped: true };
  }
  mkdirSync(dirname(dest), { recursive: true });

  const res = await fetch(entry.src);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${entry.src}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 1024) throw new Error(`suspiciously small (${buf.byteLength}B): ${entry.src}`);
  writeFileSync(dest, buf);
  return { key: entry.key, bytes: buf.byteLength, skipped: false };
}

async function main() {
  const entries: Entry[] = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  console.log(`\nDownloading ${entries.length} images to tmp-images/\n`);

  let done = 0, failed = 0, bytes = 0;
  const queue = [...entries];
  const failures: string[] = [];

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const entry = queue.shift()!;
        try {
          const r = await download(entry);
          bytes += r.bytes;
          done++;
          process.stdout.write(`  ${done + failed}/${entries.length}  ${r.skipped ? 'cached' : 'ok'}  ${r.key}\n`);
        } catch (err) {
          failed++;
          failures.push(`${entry.key}: ${err instanceof Error ? err.message : err}`);
          process.stdout.write(`  ${done + failed}/${entries.length}  FAIL  ${entry.key}\n`);
        }
      }
    })
  );

  console.log(`\n${done} downloaded, ${failed} failed, ${(bytes / 1e6).toFixed(1)} MB total`);
  if (failures.length) {
    console.error('\nFailures:');
    for (const f of failures) console.error(`  ✗ ${f}`);
    console.error('\nThese images are NOT recoverable once Squarespace lapses. Retry before cancelling.\n');
    process.exit(1);
  }
  console.log('\nNext: npm run upload:images\n');
}

main();
