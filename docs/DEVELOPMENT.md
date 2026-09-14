# Running locally

```bash
npm install
npm run fetch:images    # once — pulls 57 photos into ./tmp-images (gitignored)
npm run dev             # http://localhost:4321
```

That's it. No Cloudflare account, no Stripe key, no GitHub App.

---

## What works in `npm run dev`

| | Works | Notes |
|---|---|---|
| All pages | ✅ | Instant HMR |
| Product images | ✅ | Served from `./tmp-images`, unresized |
| **Keystatic CMS** | ✅ | `/keystatic` — **local mode**, saves straight to `content/` |
| Cart, size pickers | ✅ | Fully client-side |
| KV sold-out guard | ✅ | miniflare's local KV, starts empty |
| Checkout | ⚠️ | Returns "Payments are not configured yet" without a Stripe key |
| Contact form | ⚠️ | Returns a helpful error without a Resend key |
| Image resizing | ❌ | Cloudflare-only. Dev serves originals; look for `x-image-transform: dev-passthrough` |

**Keystatic runs in local mode in dev** (`storage.kind === 'local'`), so you can
add rings, edit copy and change shipping rates with no GitHub App and no auth.
Changes land in `content/` as normal file edits you can diff and commit.

### Images missing?

`/img/...` returns `Image not found in ./tmp-images. Run: npm run fetch:images`.
The photos live in R2 in production; `tmp-images` is the local stand-in, and it
is gitignored so it never bloats the repo.

---

## Testing checkout and emails locally

Put real test keys in `.dev.vars` (gitignored) and use the Worker runtime — the
plain dev server does not pick that file up:

```
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
ORDER_NOTIFY_EMAIL=you@example.com
```

```bash
npm run dev:worker          # real Workers runtime, local KV + R2
npm run dev:worker:remote   # same, but real remote R2 so images resize properly
```

Trade-off: `dev:worker` is the true runtime but rebuilds on every change and
runs Keystatic in **GitHub mode** (because `NODE_ENV` is production), so use
`npm run dev` for content and layout work and `dev:worker` for payment work.

To test the webhook, forward events with the Stripe CLI:

```bash
stripe listen --forward-to localhost:8787/api/webhook
```

---

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with CMS and local images |
| `npm run build` | Production build |
| `npm run build:staging` | Build with `NOINDEX=1` — un-indexable |
| `npm run preflight` | Pre-deploy gate |
| `npm run check` / `npm run typecheck` | Astro + TS diagnostics |
| `npm run import:products` | Re-import from the Squarespace CSV (preserves your alt text) |
| `npm run audit:alt` | List images still on placeholder alt text |
| `npm run build:catalog` | Regenerate `src/generated/*.json` (runs automatically before build) |

---

## Two things that will bite you

**The catalog is frozen at build time.** `src/generated/catalog.json` is what the
checkout Worker reads — it cannot read `content/` at runtime, because a Worker
has no filesystem. `prebuild` regenerates it, so a plain `astro build` without
`npm run build` will serve stale prices.

**Never import `src/lib/catalog.ts` from an API route.** It pulls in Keystatic's
reader, which needs `node:fs`. That bundles `readdir` into the Worker and every
request to that route fails in production with a completely clean build.
`npm run preflight` does not catch this — check with:

```bash
grep -rl "node:fs" dist/_worker.js/     # must return nothing
```
