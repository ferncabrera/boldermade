/**
 * The catalog is the single source of truth for price and availability.
 *
 * It is built from the Keystatic content at build time and consumed by both the
 * storefront and the checkout Worker. The Worker resolves prices from HERE, never
 * from the browser — see docs/MIGRATION_PLAN.md §7.2.
 */
import { createReader } from '@keystatic/core/reader';
import Markdoc from '@markdoc/markdoc';
import keystaticConfig from '../../keystatic.config.ts';

const reader = createReader(process.cwd(), keystaticConfig);

export type Sizing = 'fixed' | 'variants' | 'adjustable';

export interface Variant {
  size: string;
  price: number;
  salePrice?: number;
  /** `null` means unlimited. */
  stock: number | null;
  /** Price actually charged. */
  effectivePrice: number;
  onSale: boolean;
  soldOut: boolean;
}

export interface ProductImage { key: string; alt: string }

export interface Product {
  slug: string;
  title: string;
  /** Display name with the "| MADE TO ORDER*" / "one of a kind |" markers removed. */
  displayTitle: string;
  status: 'published' | 'draft';
  sizing: Sizing;
  fixedSize: string;
  sizeRange: string;
  leadTime: string;
  madeToOrder: boolean;
  oneOfAKind: boolean;
  variants: Variant[];
  materials: string[];
  stone: string;
  images: ProductImage[];
  descriptionHtml: string;
  careHtml: string;
  seoTitle: string;
  seoDescription: string;
  legacySlugs: string[];
  /** Cheapest effective price, for grid display and "from $X" labels. */
  fromPrice: number;
  /** True when every variant is sold out. */
  soldOut: boolean;
}

function parseStock(raw: string): number | null {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s || s === 'unlimited') return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Keystatic's markdoc reader returns `{ node }`, not a bare Node. Passing the
 * wrapper straight to Markdoc.transform yields empty output — which is how a
 * missing meta description silently ships. Unwrap, and never swallow errors:
 * a content field that fails to render should fail the build loudly.
 */
function renderMarkdoc(content: unknown): string {
  if (!content) return '';
  const node =
    typeof content === 'object' && content !== null && 'node' in content
      ? (content as { node: unknown }).node
      : content;
  if (!node) return '';
  return Markdoc.renderers.html(Markdoc.transform(node as never)) ?? '';
}

function cleanTitle(title: string): string {
  return title
    .replace(/^one of a kind\s*\|\s*/i, '')
    .replace(/\s*\|\s*MADE TO ORDER\*?/i, '')
    .trim();
}

function firstSentences(html: string, max = 155): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return text.slice(0, text.lastIndexOf(' ', max)).replace(/[,;:]$/, '') + '…';
}

let cache: Product[] | null = null;

export async function getAllProducts(): Promise<Product[]> {
  if (cache) return cache;

  const entries = await reader.collections.products.all();

  const products = await Promise.all(
    entries.map(async ({ slug, entry }) => {
      const variants: Variant[] = (entry.variants ?? []).map((v) => {
        const price = v.price ?? 0;
        const salePrice = v.salePrice ?? undefined;
        const onSale = typeof salePrice === 'number' && salePrice > 0 && salePrice < price;
        const stock = parseStock(v.stock as string);
        return {
          size: v.size ?? '',
          price,
          salePrice,
          stock,
          effectivePrice: onSale ? (salePrice as number) : price,
          onSale,
          soldOut: stock !== null && stock <= 0,
        };
      });

      const descriptionHtml = renderMarkdoc(await entry.description());
      const careHtml = renderMarkdoc(await entry.care());
      const available = variants.filter((v) => !v.soldOut);

      return {
        slug,
        title: entry.title,
        displayTitle: cleanTitle(entry.title),
        status: entry.status as 'published' | 'draft',
        sizing: entry.sizing as Sizing,
        fixedSize: entry.fixedSize ?? '',
        sizeRange: entry.sizeRange ?? '',
        leadTime: entry.leadTime ?? '',
        madeToOrder: /made to order/i.test(entry.title),
        oneOfAKind: variants.some((v) => v.stock !== null),
        variants,
        materials: [...(entry.materials ?? [])],
        stone: entry.stone ?? '',
        images: (entry.images ?? []).map((i) => ({ key: i.key, alt: i.alt })),
        descriptionHtml,
        careHtml,
        seoTitle: entry.seoTitle || cleanTitle(entry.title),
        seoDescription: entry.seoDescription || firstSentences(descriptionHtml),
        legacySlugs: [...(entry.legacySlugs ?? [])],
        fromPrice: Math.min(...(available.length ? available : variants).map((v) => v.effectivePrice)),
        soldOut: variants.length > 0 && variants.every((v) => v.soldOut),
      } satisfies Product;
    })
  );

  cache = products;
  return products;
}

/** Only published products are ever built into pages, the sitemap, or the catalog. */
export async function getPublishedProducts(): Promise<Product[]> {
  return (await getAllProducts()).filter((p) => p.status === 'published');
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return (await getAllProducts()).find((p) => p.slug === slug);
}

/**
 * Resolve a (slug, size) pair to its variant. The lookup key is the PAIR, not
 * the slug: bolder bird is $290 at size 7 and $340 at size 12, so a slug-only
 * lookup would undercharge by up to $50.
 */
export function findVariant(product: Product, size: string | undefined): Variant | undefined {
  if (product.sizing !== 'variants') return product.variants[0];
  return product.variants.find((v) => v.size === size);
}

/** Flat, serialisable catalog bundled into the checkout Worker. */
export interface CatalogEntry {
  slug: string;
  title: string;
  variants: { size: string; price: number; stock: number | null }[];
}

export async function buildCatalog(): Promise<CatalogEntry[]> {
  return (await getPublishedProducts()).map((p) => ({
    slug: p.slug,
    title: p.displayTitle,
    variants: p.variants.map((v) => ({ size: v.size, price: v.effectivePrice, stock: v.stock })),
  }));
}
