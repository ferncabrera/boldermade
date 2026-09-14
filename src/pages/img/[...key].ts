export const prerender = false;

import type { APIRoute } from 'astro';

/**
 * Product photography: R2 origin + Cloudflare Image Transformations.
 *
 * Two routes, because transformations apply to a fetch SUBREQUEST, not to a
 * Response you construct yourself:
 *
 *   /img/raw/<key>   streams the original straight out of R2
 *   /img/<key>?w=…   re-fetches that raw URL through `cf.image` to resize
 *
 * Returning `new Response(r2Object.body, { cf: { image } })` looks like it
 * works and silently serves the full-size original — `cf` is meaningless on a
 * Response. Verify any change here against real byte sizes, not appearances.
 *
 * R2 behind a Cloudflare custom domain is not slower than a static asset once
 * warm; it rides the same CDN. What R2 alone cannot do is resize.
 */

const ALLOWED_WIDTHS = new Set([160, 200, 320, 480, 640, 960, 1200, 1280, 1920, 2500]);
const IMMUTABLE = 'public, max-age=31536000, immutable';

function guessType(key: string): string {
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** Dev-only. Returns null in production so the branch cannot leak. */
async function readLocalImage(key: string): Promise<ArrayBuffer | null> {
  if (!import.meta.env.DEV) return null;
  try {
    const [{ readFile }, { join }, { cwd }] = await Promise.all([
      import('node:fs/promises'),
      import('node:path'),
      import('node:process'),
    ]);
    // Contain the read to tmp-images: a traversing key must not escape it.
    if (key.includes('..')) return null;
    const buf = await readFile(join(cwd(), 'tmp-images', key));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

export const GET: APIRoute = async ({ params, request, locals }) => {
  const env = (locals as any)?.runtime?.env ?? {};
  const raw = params.key ?? '';
  if (!raw) return new Response('not found', { status: 404 });
  if (!env.IMAGES) return new Response('image storage not configured', { status: 503 });

  const url = new URL(request.url);

  // --- origin route: stream the object out of R2 unchanged -----------------
  if (raw.startsWith('raw/')) {
    const key = raw.slice(4);
    const object = await env.IMAGES.get(key);

    if (!object) {
      // In `astro dev` the R2 binding is miniflare's local bucket, which is
      // empty — the real objects live in remote R2. Rather than making every
      // contributor seed 57 objects, fall back to ./tmp-images, which
      // `npm run fetch:images` already populates.
      //
      // Guarded by import.meta.env.DEV and dynamically imported, so node:fs
      // is never bundled into the Worker. scripts/preflight.ts asserts that.
      if (import.meta.env.DEV) {
        const local = await readLocalImage(key);
        if (local) {
          return new Response(local, {
            headers: { 'content-type': guessType(key), 'cache-control': 'no-store' },
          });
        }
      }
      return new Response('not found', { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        'content-type': object.httpMetadata?.contentType ?? 'image/jpeg',
        'cache-control': IMMUTABLE,
        etag: object.httpEtag,
      },
    });
  }

  // --- transform route -----------------------------------------------------
  const width = Number(url.searchParams.get('w') ?? 960);
  const quality = Math.min(95, Math.max(40, Number(url.searchParams.get('q') ?? 82)));
  const fitParam = url.searchParams.get('fit') ?? 'cover';
  const fit = (['cover', 'contain', 'scale-down'] as const).includes(fitParam as never)
    ? (fitParam as 'cover' | 'contain' | 'scale-down')
    : 'cover';

  // Capped so the endpoint cannot be used to mint unbounded transformation
  // variants — each distinct variant is separately billable and cached.
  if (!ALLOWED_WIDTHS.has(width)) return new Response('unsupported width', { status: 400 });

  const accept = request.headers.get('accept') ?? '';
  const format = accept.includes('image/avif')
    ? 'avif'
    : accept.includes('image/webp')
      ? 'webp'
      : 'jpeg';

  // In dev there is no Image Transformations service, and a self-referential
  // fetch back into the dev server does not resolve. Serve the local original
  // directly — unresized, which is correct enough for layout work.
  if (import.meta.env.DEV) {
    const local = await readLocalImage(raw);
    if (local) {
      return new Response(local, {
        headers: {
          'content-type': guessType(raw),
          'cache-control': 'no-store',
          'x-image-transform': 'dev-passthrough',
        },
      });
    }
    return new Response(
      'Image not found in ./tmp-images. Run: npm run fetch:images',
      { status: 404 }
    );
  }

  const originUrl = new URL(`/img/raw/${raw}`, url.origin).toString();

  const transformed = await fetch(originUrl, {
    cf: { image: { width, quality, fit, format } },
  } as RequestInit);

  if (!transformed.ok) {
    // Transformations are unavailable in `wrangler dev` and on some plans.
    // Falling back to the original keeps the site correct, just heavier.
    const fallback = await fetch(originUrl);
    if (!fallback.ok) return new Response('not found', { status: 404 });
    const body = await fallback.arrayBuffer();
    return new Response(body, {
      headers: {
        'content-type': fallback.headers.get('content-type') ?? 'image/jpeg',
        'cache-control': IMMUTABLE,
        'x-image-transform': 'fallback-original',
      },
    });
  }

  const out = new Response(transformed.body, transformed);
  out.headers.set('cache-control', IMMUTABLE);
  out.headers.set('x-image-transform', `w=${width};q=${quality};fit=${fit};f=${format}`);
  return out;
};
