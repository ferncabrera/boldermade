export const prerender = false;

import type { APIRoute } from 'astro';
import Stripe from 'stripe';

/**
 * Stripe webhook.
 *
 * Workers have no synchronous Node crypto, so signature verification must use
 * the async path with a SubtleCrypto provider. `constructEvent` (sync) throws
 * here; `constructEventAsync` is the correct call.
 *
 * On payment: flag finite-stock variants as sold in KV, and email the order to
 * Samantha. Stripe sends the customer their own receipt, so we never do.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const secret = env.STRIPE_SECRET_KEY ?? import.meta.env.STRIPE_SECRET_KEY;
  const whsec = env.STRIPE_WEBHOOK_SECRET ?? import.meta.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');

  if (!secret || !whsec) return new Response('not configured', { status: 503 });
  if (!signature) return new Response('missing signature', { status: 400 });

  const stripe = new Stripe(secret, {
    apiVersion: '2025-08-27.basil',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      whsec,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err) {
    console.error('webhook signature rejected', err);
    return new Response('invalid signature', { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response('ignored', { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // metadata carries "slug|size|qty" per line, written at session creation.
  const lines = Object.entries(session.metadata ?? {})
    .filter(([k]) => k.startsWith('item_'))
    .map(([, v]) => {
      const [slug = '', size = '', qty = '1'] = String(v).split('|');
      return { slug, size, qty: Number(qty) || 1 };
    });

  // Mark sold. Best-effort; KV propagation is eventually consistent.
  if (env.SOLD) {
    await Promise.all(
      lines.map((l) =>
        env.SOLD.put(`${l.slug}:${l.size}`, new Date().toISOString(), {
          metadata: { sessionId: session.id },
        }).catch((e: unknown) => console.error('KV write failed', l.slug, e))
      )
    );
  }

  await notifyOwner(env, session, lines).catch((e) => console.error('order email failed', e));

  return new Response('ok', { status: 200 });
};

async function notifyOwner(
  env: Record<string, string | undefined>,
  session: Stripe.Checkout.Session,
  lines: { slug: string; size: string; qty: number }[]
): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const to = env.ORDER_NOTIFY_EMAIL;
  if (!apiKey || !to) return;

  const ship = session.collected_information?.shipping_details ?? (session as any).shipping_details;
  const addr = ship?.address;
  const money = (c: number | null | undefined) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`);

  const text = [
    `New order — ${money(session.amount_total)} ${(session.currency ?? 'cad').toUpperCase()}`,
    '',
    ...lines.map((l) => `  ${l.qty}x  ${l.slug}${l.size ? `   SIZE ${l.size}` : ''}`),
    '',
    `Customer: ${session.customer_details?.name ?? '—'} <${session.customer_details?.email ?? '—'}>`,
    '',
    'Ship to:',
    `  ${ship?.name ?? ''}`,
    `  ${addr?.line1 ?? ''}`,
    ...(addr?.line2 ? [`  ${addr.line2}`] : []),
    `  ${addr?.city ?? ''} ${addr?.state ?? ''} ${addr?.postal_code ?? ''}`,
    `  ${addr?.country ?? ''}`,
    '',
    `Stripe: https://dashboard.stripe.com/payments/${session.payment_intent}`,
  ].join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: 'bolder orders <orders@boldermade.ca>',
      to: [to],
      subject: `New order — ${lines.map((l) => l.slug).join(', ')}`,
      text,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}
