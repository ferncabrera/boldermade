/**
 * Centralised SEO. Every page goes through here so none can ship without a
 * title, description, canonical and og:image — the four things the Squarespace
 * site was missing (docs/MIGRATION_PLAN.md §2.4).
 */
import type { Product } from './catalog.ts';
import { CURRENCY } from './money.ts';

export const SITE_URL = 'https://www.boldermade.ca';
export const SITE_NAME = 'bolder';
export const BRAND_TAGLINE = 'handmade statement rings';
export const LOCALITY = 'Toronto';
export const COUNTRY = 'CA';

export interface SeoInput {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'product' | 'article';
  noindex?: boolean;
}

export interface SeoTags {
  title: string;
  description: string;
  canonical: string;
  image: string;
  imageAlt: string;
  type: string;
  noindex: boolean;
}

export function canonical(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return p === '/' ? `${SITE_URL}/` : `${SITE_URL}${p.replace(/\/$/, '')}`;
}

export function buildSeo(input: SeoInput): SeoTags {
  const title =
    input.path === '/' ? `${SITE_NAME} — ${BRAND_TAGLINE}` : `${input.title} — ${SITE_NAME}`;
  return {
    title,
    description: input.description,
    canonical: canonical(input.path),
    image: input.image ?? `${SITE_URL}/og-default.jpg`,
    imageAlt: input.imageAlt ?? `${SITE_NAME} — ${BRAND_TAGLINE}`,
    type: input.type ?? 'website',
    noindex: input.noindex ?? false,
  };
}

/* ---------------------------------------------------------------------------
   JSON-LD
--------------------------------------------------------------------------- */

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    description: `Handmade statement rings, designed and cast by hand in ${LOCALITY}, Canada.`,
    address: { '@type': 'PostalAddress', addressLocality: LOCALITY, addressCountry: COUNTRY },
  };
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
  };
}

export function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: canonical(t.path),
    })),
  };
}

export function productLd(product: Product, imageUrls: string[]) {
  const offers = product.variants.map((v) => ({
    '@type': 'Offer',
    ...(v.size ? { name: `Size ${v.size}` } : {}),
    price: (v.effectivePrice / 100).toFixed(2),
    priceCurrency: CURRENCY,
    availability: v.soldOut
      ? 'https://schema.org/SoldOut'
      : 'https://schema.org/InStock',
    url: canonical(`/shop/p/${product.slug}`),
    itemCondition: 'https://schema.org/NewCondition',
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.displayTitle,
    description: product.seoDescription,
    image: imageUrls,
    brand: { '@type': 'Brand', name: SITE_NAME },
    ...(product.materials.length ? { material: product.materials.join(', ') } : {}),
    url: canonical(`/shop/p/${product.slug}`),
    offers: offers.length === 1 ? offers[0] : offers,
  };
}
