export const prerender = false;

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { buildCatalog, type CatalogEntry } from '../../lib/catalog.ts';
import { getShippingOptions, allowedCountries } from '../../lib/shipping.ts';

/**
 * Creates a Stripe Checkout session.
 *
 * SECURITY INVARIANT: the browser sends {slug, size, qty} and nothing else.
 * Every price is resolved here, from the build-time catalog. A design where the
 * client supplies a price is trivially exploitable — never accept one.
 *
 * The lookup key is the PAIR (slug, size), not the slug: bolder bird is $290 at
 * size 7 and $340 at size 12.
 */

interface IncomingLine { slug?: unknown; size?: unknown; qty?: unknown }

const MAX_LINES = 20;
const MAX_QTY = 10;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export const POST: APIRoute = async ({ request, locals, url }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const secret = env.STRIPE_SECRET_KEY ?? import.meta.env.STRIPE_SECRET_KEY;
  if (!secret) return json({ error: 'Payments are not configured yet.' }, 503);

  let payload: { items?: IncomingLine[] };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Malformed request.' }, 400);
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return json({ error: 'Your cart is empty.' }, 400);
  if (items.length > MAX_LINES) return json({ error: 'Too many items.' }, 400);

  const catalog: CatalogEntry[] = await buildCatalog();
  const bySlug = new Map(catalog.map((c) => [c.slug, c]));

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const metadata: Record<string, string> = {};

  for (const [i, raw] of items.entries()) {
    const slug = typeof raw.slug === 'string' ? raw.slug : '';
    const size = typeof raw.size === 'string' ? raw.size : '';
    const qty = Math.floor(Number(raw.qty));

    if (!slug || !Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) {
      return json({ error: 'That cart could not be read. Please refresh and try again.' }, 400);
    }

    const product = bySlug.get(slug);
    if (!product) return json({ error: 'One of those rings is no longer available.' }, 409);

    const variant =
      product.variants.length === 1
        ? product.variants[0]
        : product.variants.find((v) => v.size === size);
    if (!variant) return json({ error: `Please choose a size for ${product.title}.` }, 400);

    // Finite-stock guard. Best-effort by design (MIGRATION_PLAN §7.4): KV is
    // eventually consistent, and only one live product currently has finite stock.
    if (variant.stock !== null) {
      if (variant.stock < qty) {
        return json({ error: `${product.title} is no longer available.` }, 409);
      }
      const sold = await env.SOLD?.get(`${slug}:${size}`);
      if (sold) return json({ error: `${product.title} has just sold.` }, 409);
    }

    lineItems.push({
      quantity: qty,
      price_data: {
        currency: 'cad',
        unit_amount: variant.price, // server-resolved, always
        product_data: {
          name: size ? `${product.title} — size ${size}` : product.title,
          metadata: { slug, size },
        },
      },
    });
    metadata[`item_${i}`] = `${slug}|${size}|${qty}`;
  }

  const stripe = new Stripe(secret, {
    apiVersion: '2025-08-27.basil',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const origin = new URL(request.url).origin || url.origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      currency: 'cad',
      billing_address_collection: 'auto',
      shipping_address_collection: { allowed_countries: allowedCountries() },
      shipping_options: getShippingOptions(),
      phone_number_collection: { enabled: false },
      metadata,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop`,
    });

    if (!session.url) throw new Error('Stripe returned no redirect URL');
    return json({ url: session.url });
  } catch (err) {
    console.error('checkout failed', err);
    return json({ error: 'Could not start checkout. Please try again.' }, 502);
  }
};
