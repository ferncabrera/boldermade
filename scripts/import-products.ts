/**
 * Squarespace products CSV -> Keystatic content files.
 *
 * Implements the import rules in docs/MIGRATION_PLAN.md §6.2. The two that
 * matter most:
 *
 *   - A sale price is applied ONLY where `On Sale == Yes`. Squarespace keeps
 *     Price, Sale Price and the On Sale flag independent, so five dormant sale
 *     prices sit in the export waiting to be armed.
 *   - Any sale price below 10% of list is REFUSED and fails the run. This is
 *     what catches `leap ring`, which carries a $2.30 sale price against a
 *     $280 list price.
 *
 * Run: npm run import:products
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = join(ROOT, 'data/squarespace-products-export-2026-09-13.csv');
const OUT = join(ROOT, 'content/products');
const ALT = join(ROOT, 'data/alt-text.json');

/**
 * Alt text already written into the content files wins over anything generated
 * here. Re-running the import must never destroy Samantha's editing — losing a
 * pass over 57 photos to a routine re-run would be an unforced error.
 */
function existingAltText(): Map<string, string> {
  const found = new Map<string, string>();
  if (!existsSync(OUT)) return found;
  for (const file of readdirSync(OUT).filter((f) => f.endsWith('.mdoc'))) {
    const text = readFileSync(join(OUT, file), 'utf8');
    const keys = [...text.matchAll(/^\s*- key:\s*"(.*)"\s*\n\s*alt:\s*"(.*)"\s*$/gm)];
    for (const m of keys) {
      const [, key, alt] = m;
      if (key && alt && !/—\s*photo\s+\d+\s+of\s+\d+\s*$/i.test(alt)) found.set(key, alt);
    }
  }
  return found;
}

function altBases(): Record<string, string> {
  if (!existsSync(ALT)) return {};
  return JSON.parse(readFileSync(ALT, 'utf8')) as Record<string, string>;
}

/** Squarespace's own image CDN serves originals when asked for a big width. */
const FULL_RES = '?format=2500w';
/** Below this fraction of list price, a "sale" is assumed to be a data error. */
const IMPLAUSIBLE_SALE_RATIO = 0.1;

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  if (!header) throw new Error('empty CSV');
  return body
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

/** "275.00" -> 27500. Via string, because 275.00 * 100 is not 27500 in IEEE754. */
function toCents(dollars: string): number {
  const s = dollars.trim();
  if (!s) return 0;
  const neg = s.startsWith('-');
  const [whole, frac = ''] = s.replace(/^-/, '').split('.');
  const n = Number(`${whole}${(frac + '00').slice(0, 2)}`);
  if (!Number.isFinite(n)) throw new Error(`unparseable price: ${dollars}`);
  return neg ? -n : n;
}

/** Squarespace RTE HTML -> Markdown. Its output is narrow, so this stays small. */
function htmlToMarkdown(html: string): string {
  if (!html.trim()) return '';
  let s = html;
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  s = s.replace(/<\/?p[^>]*>/gi, '\n\n');
  s = s.replace(/<(strong|b)>(.*?)<\/\1>/gis, '**$2**');
  s = s.replace(/<(em|i)>(.*?)<\/\1>/gis, '_$2_');
  s = s.replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gis, '[$2]($1)');
  s = s.replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n');
  s = s.replace(/<[^>]+>/g, '');                       // drop remaining spans/divs
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'");
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function cleanTitleForAlt(title: string): string {
  return title
    .replace(/^one of a kind\s*\|\s*/i, '')
    .replace(/\s*\|\s*MADE TO ORDER\*?/i, '')
    .trim();
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    // "one of a kind | leap ring" puts the marker BEFORE the name, while
    // "bolder bird | MADE TO ORDER*" puts it after. Strip the prefix first,
    // or the suffix rule eats the actual ring name and yields an empty slug.
    .replace(/^one of a kind\s*\|\s*/, '')
    .replace(/\s*\|.*$/, '')
    .replace(/\*/g, '')
    .replace(/\./g, '-')                  // 7.25 -> 7-25
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function yamlString(v: string): string {
  return JSON.stringify(v);
}

type Variant = { size: string; price: number; salePrice?: number; stock: string };

interface Product {
  slug: string; title: string; status: 'published' | 'draft';
  sizing: 'fixed' | 'any' | 'variants' | 'adjustable';
  fixedSize: string; sizeRange: string;
  variants: Variant[]; materials: string[]; stone: string;
  images: { key: string; alt: string; src: string }[];
  description: string; legacySlugs: string[]; leadTime: string;
}

function main() {
  const preserved = existingAltText();
  const bases = altBases();
  const rows = parseCsv(readFileSync(CSV, 'utf8'));
  const products: Product[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let current: Product | null = null;

  const pushVariant = (p: Product, r: Row) => {
    const price = toCents(r['Price'] ?? '0');
    const saleRaw = toCents(r['Sale Price'] ?? '0');
    const onSale = (r['On Sale'] ?? '').toLowerCase() === 'yes';

    let salePrice: number | undefined;
    if (onSale && saleRaw > 0) {
      if (saleRaw < price * IMPLAUSIBLE_SALE_RATIO) {
        errors.push(
          `${p.title}: sale price $${saleRaw / 100} is under 10% of list $${price / 100} — refusing (see §2.2.1)`
        );
      } else salePrice = saleRaw;
    } else if (!onSale && saleRaw > 0 && saleRaw !== price) {
      warnings.push(`${p.title}: dormant sale price $${saleRaw / 100} dropped (On Sale = No)`);
      if (saleRaw < price * IMPLAUSIBLE_SALE_RATIO) {
        warnings.push(`  ^ that value is implausible — fix it in Squarespace before it is ever armed`);
      }
    }

    const stockRaw = (r['Stock'] ?? '').trim();
    p.variants.push({
      size: (r['Option Value 1'] ?? '').trim(),
      price,
      salePrice,
      stock: /^unlimited$/i.test(stockRaw) ? 'unlimited' : String(parseInt(stockRaw || '0', 10)),
    });
  };

  for (const r of rows) {
    const isParent = Boolean((r['Product ID [Non Editable]'] ?? '').trim());
    if (isParent) {
      const title = r['Title'] ?? '';
      const legacy = (r['Product URL'] ?? '').trim();
      const imgs = (r['Hosted Image URLs'] ?? '').split(/\s+/).filter(Boolean);
      const slug = slugify(title);

      current = {
        slug, title,
        status: (r['Visible'] ?? '').toLowerCase() === 'yes' ? 'published' : 'draft',
        sizing: 'fixed', fixedSize: '', sizeRange: '',
        variants: [], materials: [], stone: '',
        images: imgs.map((src, i) => {
          const key = `products/${slug}/${String(i + 1).padStart(2, '0')}.jpg`;
          const base = bases[slug];
          const generated = base
            ? i === 0
              ? base
              : `${base}, alternate view`
            : // No base written yet: fall back to a placeholder that audit:alt flags.
              `${cleanTitleForAlt(title)} — photo ${i + 1} of ${imgs.length}`;
          return { key, alt: preserved.get(key) ?? generated, src: src + FULL_RES };
        }),
        description: htmlToMarkdown(r['Description'] ?? ''),
        legacySlugs: legacy ? [legacy] : [],
        leadTime: /made to order/i.test(title) ? '3–4 weeks' : '',
      };

      // Sizing is inferred from the title and option columns, then corrected by
      // hand where the source data is wrong (drippy honey — see §14 Q14).
      const sizeInTitle = title.match(/sz\s+([\d.]+(?:\s*-\s*[\d.]+)?)/i)?.[1]?.trim();
      if (/adjustable/i.test(title)) {
        current.sizing = 'adjustable';
        current.sizeRange = sizeInTitle ?? '';
      } else if (/made to order/i.test(title)) {
        // Refined after import: a made-to-order ring with per-size rows keeps
        // 'variants'; one with no size rows is cast at whatever size is ordered,
        // which is 'any' — one price, but the size still has to be captured.
        current.sizing = 'variants';
      } else {
        current.sizing = 'fixed';
        current.fixedSize = sizeInTitle ?? '';
      }

      products.push(current);
      if ((r['Option Name 1'] ?? '') === 'Size' || (r['Price'] ?? '').trim()) pushVariant(current, r);
    } else if (current && (r['Variant ID [Non Editable]'] ?? '').trim()) {
      pushVariant(current, r);           // orphan variant row belongs to `current`
    }
  }

  // Fixed/adjustable rings must collapse to exactly one variant.
  for (const p of products) {
    if (p.sizing !== 'variants' && p.variants.length > 1) {
      warnings.push(`${p.title}: ${p.variants.length} variants on a non-variant ring — keeping the first`);
      p.variants = p.variants.slice(0, 1);
    }
    if (p.sizing !== 'variants') p.variants = p.variants.map((v) => ({ ...v, size: '' }));
    if (p.sizing === 'variants' && p.variants.length <= 1) {
      p.sizing = 'any';
      p.variants = p.variants.map((v) => ({ ...v, size: '' }));
      warnings.push(`${p.title}: made to order with no per-size pricing -> sizing "any" (one price, customer picks any standard size)`);
    }
    if (!p.variants.length) errors.push(`${p.title}: no pricing rows at all`);
  }

  if (errors.length) {
    console.error('\nIMPORT FAILED:\n' + errors.map((e) => `  ✗ ${e}`).join('\n') + '\n');
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });
  for (const p of products) {
    // Keystatic stores a contentField collection as a FLAT <slug>.mdoc, not a
    // <slug>/index.mdoc directory. Verified against the reader.

    const fm: string[] = [
      '---',
      `title: ${yamlString(p.title)}`,
      `status: ${p.status}`,
      `sizing: ${p.sizing}`,
      `fixedSize: ${yamlString(p.fixedSize)}`,
      `sizeRange: ${yamlString(p.sizeRange)}`,
      `leadTime: ${yamlString(p.leadTime)}`,
      'variants:',
      ...p.variants.flatMap((v) => [
        `  - size: ${yamlString(v.size)}`,
        `    price: ${v.price}`,
        ...(v.salePrice !== undefined ? [`    salePrice: ${v.salePrice}`] : []),
        `    stock: ${yamlString(v.stock)}`,
      ]),
      'materials: []',
      `stone: ""`,
      'images:',
      ...p.images.flatMap((im) => [`  - key: ${yamlString(im.key)}`, `    alt: ${yamlString(im.alt)}`]),
      `seoTitle: ""`,
      `seoDescription: ""`,
      'legacySlugs:',
      ...p.legacySlugs.map((s) => `  - ${yamlString(s)}`),
      '---',
      '',
      p.description,
      '',
    ];
    writeFileSync(join(OUT, `${p.slug}.mdoc`), fm.join('\n'), 'utf8');
  }

  // The image manifest drives the R2 upload step; originals must be pulled from
  // Squarespace BEFORE the subscription lapses or they are gone for good.
  const manifest = products.flatMap((p) => p.images.map((im) => ({ key: im.key, src: im.src })));
  const altTodo = products.flatMap((p) =>
    p.images.map((im) => ({ product: p.slug, key: im.key, provisionalAlt: im.alt }))
  );
  writeFileSync(join(ROOT, 'data/alt-text-todo.json'), JSON.stringify(altTodo, null, 2));
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(join(ROOT, 'data/image-manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\n✓ ${products.length} products -> content/products/`);
  console.log(`✓ ${manifest.length} images -> data/image-manifest.json`);
  const pub = products.filter((p) => p.status === 'published').length;
  console.log(`  ${pub} published, ${products.length - pub} draft`);
  if (warnings.length) console.log('\nWarnings:\n' + warnings.map((w) => `  ! ${w}`).join('\n'));
  console.log(
    `\nAlt text: written from data/alt-text.json, which is derived from Samantha's\n` +
    `own product copy. Accurate about each PIECE, but nobody has seen the actual\n` +
    `frames — improving them in Keystatic is still worthwhile. Anything edited\n` +
    `there is preserved across re-runs. Check with \`npm run audit:alt\`.\n`
  );
}

main();
