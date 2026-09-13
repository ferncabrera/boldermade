# bolder — Squarespace → Cloudflare Migration Plan

**Site:** https://www.boldermade.ca — "bolder", handmade statement rings, Toronto, Canada
**Owner / editor:** Samantha (non-technical)
**Engineer:** Fern
**Status:** Phases 2–3 built; see §17 for what is live in the repo.
**Last updated:** 2026-09-13 (implementation started)

---

## 1. Executive summary

Migrate `boldermade.ca` off Squarespace Commerce onto a statically-rendered
**Astro** site on **Cloudflare**, with **Stripe Checkout** for payments and
**Keystatic** (git-backed) as the CMS, so Samantha keeps Squarespace-grade
content editing without the Squarespace bill.

Four things make this migration unusually low-risk, and the plan leans on all
four:

1. **The site is tiny.** 5 pages and 13 products (11 public). Indexed surface ~15 URLs.
2. **The site is young.** Evidence (§2.3) puts its creation at **2025-07-01** —
   roughly 14 months old — so accumulated SEO equity is modest.
3. **No email on the domain.** Samantha uses a personal Gmail, which removes the
   single most common catastrophic failure mode in a domain migration.
4. **No blog, no newsletter, no customer accounts.** Nothing stateful to port
   beyond products and order history.

The genuinely hard parts are, in order: **getting the domain out of Squarespace
safely**, **standing up a new Stripe account from scratch**, and **not being
able to measure the SEO outcome because Search Console was never set up**.

### 1.1 What changes for Samantha

| | Squarespace today | After migration |
|---|---|---|
| Edit a product | Squarespace admin | Keystatic at `/keystatic` |
| Publish delay | Instant | ~1–2 min (rebuild) |
| Mark sold | Toggle stock | Toggle `status` field |
| See an order | Squarespace orders panel | Stripe dashboard + email + Stripe mobile app |
| Refund | Squarespace | Stripe dashboard |
| Take a custom payment | Edit live listing price | Stripe Payment Link (no site edit) |
| Cost | ~CAD $40/mo | ~CAD $20/**yr** (domain) + Stripe fees |

The publish delay and the move to Stripe's order UI are the only two genuine
regressions. Both are addressed in §9.

---

## 2. Current-state audit

Everything in this section was derived from the `sitemap.xml` Fern supplied and
the five HTML captures committed under `html/`. **Anything not directly
observed is marked as an open question in §14 rather than assumed.**

### 2.1 Pages

| URL | Title tag | Meta description | Notes |
|---|---|---|---|
| `/` | `bolder` | **missing** | Canonical `https://www.boldermade.ca`. H1: "everything bolder is handmade to make a statement." H2: "shop bolder" |
| `/home` | — | — | **Duplicate of `/`.** Appears in sitemap; nav links to `/`. See §8.2 |
| `/shop` | `Shop \| Add to your wishlist — bolder` | **missing** | H2s: "the experimental collection", "Shop" |
| `/custom-work` | `Customs — bolder` | **empty string** | H2: "psst…your dream custom awaits". Hosts the custom-request form |
| `/about` | `FAQ + About — bolder` | present (only page with one) | H1s: "FAQs", "about bolder". Nav labels this **FAQ** |
| `/cart` | — | — | Squarespace cart; replaced by our own |

Navigation is five items: `Home /`, `Shop /shop`, `Customs /custom-work`,
`FAQ /about`, `Cart /cart`.

### 2.2 Products

Reconciled from three sources — the CSV export (authoritative), the sitemap, and
the shop grid. **No single source is complete.** 13 distinct product URLs exist.

| # | Product | Price (CAD) | Stock | Visible | Sizing | In CSV / map / grid |
|---|---|---|---|---|---|---|
| 1 | textured citrine sz 6 | 110 | **0** | Yes | fixed sz 6 | Y / Y / Y |
| 2 | opal shark sz 10 | 300 | ∞ | Yes | fixed sz 10 | Y / Y / Y |
| 3 | jelly bean opal ring sz 7.25 | 150 | **0** | Yes | fixed sz 7.25 | Y / Y / Y |
| 4 | one of a kind \| leap ring sz 10 | 280 | **1** | Yes | fixed sz 10 | Y / Y / Y |
| 5 | traveling stones adjustable sz 8-9.5* | 220 → **190 on sale** | ∞ | **No** | adjustable | Y / — / — |
| 6 | ruby shark sz 4.75 | 200 | ∞ | Yes | fixed sz 4.75 | Y / Y / Y |
| 7 | ruby tiger sz 9.5 | 245 → **215 on sale** | ∞ | Yes | fixed sz 9.5 | Y / Y / Y |
| 8 | bolder bird \| MADE TO ORDER* | **290–340** | ∞ | Yes | **6 size variants (7–12)** | Y / Y / Y |
| 9 | drippy honey \| MADE TO ORDER* | 275 | ∞ | Yes | **none — see below** | Y / Y / Y |
| 10 | toad ring \| MADE TO ORDER* | **90–140** | ∞ | Yes | **11 size variants (6–11)** | Y / — / Y |
| 11 | tri boulder opal sz 9 | 180 | ∞ | Yes | fixed sz 9 | Y / Y / Y |
| 12 | mirrored teardrop ring sz 7 | 175 | ∞ | **No** | fixed sz 7 | Y / — / — |
| 13 | Custom ring payment | ? | — | Yes | non-physical | — / Y / — |

57 product images across the 12 exported products.

**Stock is not what the brief assumed.** Only three products have finite stock.
Everything else is `Unlimited` — confirmed deliberate: Samantha can remake these
pieces on request. So the double-sell surface is **exactly one live product**
(leap ring, stock 1), which validates the best-effort inventory decision (D7)
for a different and better reason than originally argued.

**`one-of-a-kind` vs `made-to-order` is the wrong axis.** The data shows two
*independent* properties, and the schema in §6 models them separately:

- **stock** — a finite integer, or unlimited
- **sizing** — one of four modes:
  - `fixed` — one size, baked into the ring name
  - `any` — made to order, cast at whatever size is ordered, **one price**
  - `variants` — made to order where larger sizes cost more, **price per size**
  - `adjustable` — fits a range

  `any` and `variants` both capture the chosen size. That matters: without it
  Samantha does not know what to cast.

`opal shark sz 10` is a fixed-size ring with unlimited stock — a combination the
original enum could not express.

#### 2.2.1 Pricing anomalies — act on these

Squarespace stores `Price`, `Sale Price` and an `On Sale` flag independently, so
dormant sale prices sit in the data waiting to be activated.

**Live sales (must carry over):**

| Product | List | Sale |
|---|---|---|
| ruby tiger sz 9.5 | 245 | **215** |
| traveling stones (hidden) | 220 | **190** |

**Dormant sale prices (must NOT be applied on import):**
opal shark 300→280 · jelly bean 150→136 · ruby shark 200→153 ·
drippy honey 275→191.25 · mirrored teardrop 175→127.50

> ⚠️ **`leap ring` has a dormant sale price of $2.30 against a list price of
> $280.** Almost certainly a typo for $230.00. If anyone ever toggles "On Sale"
> on that product it sells for $2.30. **This is a live risk in the current store
> and should be corrected in Squarespace today**, independently of this
> migration. The import rule (§6.2) refuses it regardless.

**Import rule:** apply `salePrice` only where `On Sale == Yes`. Preserve dormant
values nowhere — they are re-enterable by hand if ever wanted.

#### 2.2.2 Other data issues

- **`drippy honey` is marked MADE TO ORDER but has no size options**, while its
  own description says "made to order in different colours and sizes". Almost
  certainly misconfigured. Treat as `variants` with sizes to be supplied.
- **Weight/dimension data is inconsistent** — 5 products carry `1.0–2.0` weight
  and `9×5×2`, 7 are all zeros. Since shipping is flat-rate per zone (D17),
  this data drives nothing and is not migrated.
- **Descriptions carry Squarespace RTE cruft** — `<p class="">`,
  `style="white-space:pre-wrap;"`, `data-rte-preserve-empty`,
  `<span style="color: rgb(0,0,0)">`, `&nbsp;`. Must be sanitised to clean
  Markdown on import, not copied verbatim.
- **Tags are sparse and inconsistent** — only 2 of 12 products have any
  (`opal, boulder opal`; `opal, cubic zirconia, ring, statement ring, fairy ring`).
  Categories are empty throughout. Imported as-is; could drive filtering later.
- **SKUs are `SQ`-prefixed and Squarespace-generated.** Not reused.


### 2.3 Site age (inferred)

The Squarespace site ID `686343550b484e68bb6fa9e8` is a MongoDB ObjectId whose
leading 4 bytes encode a creation timestamp of **2025-07-01 02:09 UTC**. Product
image asset prefixes corroborate this — the earliest uploads are 2025-08-01
through 2025-09-05.

> **This contradicts the brief's "hosted on Squarespace for some years."**
> Either the store was rebuilt on a new Squarespace site in July 2025 (losing
> the old site's history anyway), or the recollection is imprecise. **Resolve
> before cutover** (§14, Q2) — if an older site *did* exist on this domain, its
> historical URLs may still hold links and would need their own redirect audit.

### 2.4 Existing SEO state

Observed from the captures:

**Already good**
- Valid `Product` + `Offer` JSON-LD on product pages, with `price`, `priceCurrency`, `availability`, `sku`.
- `WebSite` JSON-LD sitewide.
- Canonical tags on `/`, `/shop`, `/custom-work`, `/about`.
- `og:title` / `og:url` on the main pages.

**Defects we inherit and should fix**
- **No meta description** on `/`, `/shop`, or product pages. `/custom-work` has an empty one. Only `/about` has a real one.
- **No canonical tag on the product page** and no `og:url`.
- **No `og:image` anywhere** — links shared to Instagram/iMessage render bare.
- Home `<title>` is just `bolder` — no keywords, no location, no category.
- `/home` duplicates `/`.
- Product slugs are random 30-character strings with zero keyword value.

Fixing these is a net SEO **gain**, not merely parity. That reframes the goal:
not "don't lose rankings" but "don't lose rankings *and* close the on-page gaps
Squarespace left open."

### 2.5 Content to preserve verbatim

- The **"about bolder"** narrative (wax casting, self-taught, the boulder-opal name origin, the Tim/Emerald Beach NSW workshop).
- **7 FAQ entries**: metals, custom work, custom pricing, lost-wax process, worldwide shipping, no repairs, the lost ring series.
- The **"lost ring series"** story (Feb–Mar 2026, Debbie's replacement ring) — **includes 3 videos**. Video hosting is an open question (§14, Q8).
- Instagram is linked from every page and is a primary channel.

---

## 3. Decisions locked in

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Framework | **Astro 5**, static output | Zero-JS by default, best-in-class content/SEO story, no React required for the public site |
| D2 | Host | **Cloudflare Workers** (static assets) | Most generous free tier; unifies static + API + R2 + KV in one account |
| D3 | CMS | **Keystatic**, GitHub storage | $0, content lives in the repo, fully portable, typed schema |
| D4 | Payments | **Stripe Checkout** (hosted) | PCI scope offloaded, Apple/Google Pay, built-in receipts |
| D5 | Cart | Client-side, **no framework** | nanostores + vanilla web components |
| D6 | Images | **R2** + Cloudflare Image Transformations | Keeps repo lean, edge-cached, scales past the current 50 images |
| D7 | Inventory | **Best-effort** KV guard | Only 1 live product has finite stock (§2.2); a hard guarantee would be over-engineering |
| D8 | Sold items | **Stay live, marked Sold** | Preserves URLs, doubles as portfolio, drives custom inquiries |
| D9 | Product URLs | **Clean slugs + 301s** | Old slugs are meaningless; site is young; 301s are near-free |
| D10 | Design | Same brand, cleaner execution | Familiar to returning customers |
| D11 | Editors | 2 (Fern + Samantha), GitHub login | Keystatic hides git behind a normal form UI |
| D12 | Ownership | Stripe + domain → Samantha; infra → Fern | Stripe must legally be in the business owner's name |
| D13 | Currency | **CAD** | Confirmed: live `Product` JSON-LD, Toronto business |
| D14 | Sale pricing | **Compare-at supported** | 2 products are live on sale; struck-through price is a real conversion cue |
| D15 | Size pricing | **Per-size variants** | bolder bird 290–340, toad ring 90–140 — imported verbatim |
| D16 | Hidden products | **Import as drafts** | Preserves photography and copy at zero cost |
| D17 | Shipping | **Flat rate per zone** | Weight data drives nothing today |
| D18 | Order history | **Export and archive** | Not migrated; kept out of the repo (customer PII) |

### 3.1 Rejected alternatives

| Considered | Rejected because |
|---|---|
| Next.js static export | Heavier runtime; its best features need a server we don't want |
| Sanity / Contentful | Re-introduces the vendor dependency we're migrating away from |
| Decap CMS | Unmaintained-feeling; Netlify Identity is deprecated |
| Shopify Buy Button | ~$5/mo and a second vendor for 11 products |
| Snipcart | ~2% of sales plus a monthly minimum |
| Stripe Payment Links only | No multi-item cart; manual link per product |
| Netlify | Lower free ceilings; we'd still want Cloudflare for R2/DNS |
| Cloudflare Pages | Being de-emphasised in favour of Workers static assets |
| Stripe Tax | Not needed — no tax currently collected (§14, Q4) |

---

## 4. Target architecture

```
                    ┌─────────────────────────────────────────┐
  Samantha ───────► │  Keystatic UI  (/keystatic, SSR)        │
   (browser)        │  GitHub OAuth · React (admin only)      │
                    └────────────────┬────────────────────────┘
                                     │ commits MDX + JSON
                                     ▼
                    ┌─────────────────────────────────────────┐
                    │  GitHub repo  ferncabrera/boldermade    │
                    │  content/products/*.mdoc · pages/*.mdoc │
                    └────────────────┬────────────────────────┘
                                     │ push → GitHub Actions
                                     ▼
                    ┌─────────────────────────────────────────┐
                    │  astro build  →  wrangler deploy        │
                    │  prerenders 11 products + 6 pages       │
                    └────────────────┬────────────────────────┘
                                     ▼
   Customer ──────► ┌─────────────────────────────────────────┐
   (browser)        │  Cloudflare Worker  boldermade.ca       │
                    │  ├─ static assets  (HTML/CSS/JS)        │
                    │  ├─ /img/*          → R2 + transforms   │
                    │  ├─ /api/checkout   → Stripe session    │
                    │  ├─ /api/webhook    → Stripe events     │
                    │  └─ /api/contact    → Turnstile+Resend  │
                    └───┬─────────────┬──────────────┬────────┘
                        │             │              │
                        ▼             ▼              ▼
                   ┌────────┐   ┌──────────┐   ┌──────────┐
                   │ R2     │   │ KV       │   │ Stripe   │
                   │ images │   │ sold[]   │   │ Checkout │
                   └────────┘   └──────────┘   └──────────┘
```

**The public site is 100% prerendered static HTML.** Only `/keystatic/*` and
`/api/*` execute server-side. This matters for D1: React ships **only** in the
admin bundle, which customers never download.

### 4.1 Repository layout

```
boldermade/
├─ docs/MIGRATION_PLAN.md        ← this file
├─ html/                         ← Squarespace captures (reference; deleted post-cutover)
├─ keystatic.config.ts           ← CMS schema (§6)
├─ astro.config.mjs
├─ wrangler.toml                 ← bindings: ASSETS, IMAGES(R2), SOLD(KV)
├─ content/
│  ├─ products/<slug>.mdoc
│  ├─ pages/{home,about,custom-work}.mdoc
│  └─ settings/{shipping,site}.json
├─ src/
│  ├─ layouts/ components/ styles/
│  ├─ pages/
│  │  ├─ index.astro  shop/index.astro  shop/p/[slug].astro
│  │  ├─ about.astro  custom-work.astro  contact.astro
│  │  └─ api/{checkout,webhook,contact}.ts   ← prerender = false
│  └─ lib/{catalog.ts,stripe.ts,seo.ts}
├─ scripts/
│  ├─ scrape-squarespace-images.ts
│  ├─ import-products.ts
│  └─ verify-redirects.ts
└─ public/{robots.txt,_redirects}
```

---

## 5. Technology justification

### 5.1 Astro over Next.js

Next.js static export still ships a React runtime and hydration payload for a
site that is, functionally, 17 documents and one cart. Astro prerenders to plain
HTML and ships JS only where explicitly requested. For a jewellery shop whose
traffic is mobile and image-heavy, LCP and CLS are the metrics that matter, and
Astro's default is the correct one. Astro's per-route `prerender = false` gives
us exactly the three dynamic endpoints we need on the same deployment.

### 5.2 Keystatic over hosted CMS

Content is 11 products and 4 pages of prose. A hosted CMS would put that behind
an API key and a vendor's uptime, which is the situation we are leaving. With
Keystatic the content is MDoc files in the repo: greppable, diffable,
code-reviewable, restorable from any clone, and portable to any future
framework.

The cost is real and should be stated plainly: **Samantha needs a GitHub
account**, and **saving triggers a rebuild rather than publishing instantly**.
Mitigations in §9.

### 5.3 Cloudflare Workers over Pages

Workers static assets is where Cloudflare is investing, and it lets the static
site, the image proxy, and the three API routes live in one deployment with one
set of bindings — no split-brain between a Pages project and a separate Worker.

---

## 6. Content model

The schema follows the data, not the brief. **`stock` and `sizing` are
independent** (§2.2), and price lives on the *variant*, not the product.

```ts
// keystatic.config.ts  (abridged — field types illustrative)
products: collection({
  slugField: 'title',
  path: 'content/products/*',
  schema: {
    title:   fields.slug({ name: { label: 'Ring name' } }),
    status:  fields.select({ options: ['published','draft','archived'] }),

    // --- how the customer picks a size
    sizing:  fields.select({ options: ['fixed','variants','adjustable'] }),
    fixedSize: fields.text(),        // sizing=fixed      e.g. "10", "7.25"
    sizeRange: fields.text(),        // sizing=adjustable e.g. "8-9.5"

    // --- price + stock live per variant
    variants: fields.array(fields.object({
      size:      fields.text(),      // "" when sizing != 'variants'
      price:     fields.integer({ label: 'CAD cents' }),
      salePrice: fields.integer({ label: 'CAD cents, blank = not on sale' }),
      stock:     fields.text({ label: 'integer, or "unlimited"' }),
    })),

    leadTime:  fields.text(),        // made-to-order turnaround
    materials: fields.array(fields.text()),
    stone:     fields.text(),
    images:    fields.array(fields.object({
                 key: fields.text(),   // R2 object key
                 alt: fields.text(),   // REQUIRED — §8.4
               })),
    description: fields.mdx(),
    care:        fields.mdx(),
    seoTitle:       fields.text(),
    seoDescription: fields.text(),
    legacySlugs:    fields.array(fields.text()),   // drives 301s — §8.3
  }
})
```

Why this shape:

- **`variants[]` always exists**, even for a fixed-size ring — it just has one
  entry. This means the checkout price lookup has exactly one code path.
- **`salePrice` blank means not on sale.** There is no separate `onSale` boolean,
  which is precisely the footgun that produced the $2.30 leap ring (§2.2.1).
  Removing the flag makes the dangerous state unrepresentable.
- **`alt` is required.** Jewellery earns real traffic from Google Images.
- **`legacySlugs` makes redirects data.** Adding an old URL regenerates
  `_redirects` on the next build — no code change.

### 6.1 Slug collisions

Sold rings keep their pages forever (D8), so a future "opal shark sz 10" collides
with the existing slug. Keystatic enforces uniqueness, so Samantha would hit an
error and must pick e.g. `opal-shark-sz-10-2`. **Must be covered in her runbook**
(§9) or it surfaces as a confusing failure at the worst moment.

### 6.2 Import rules

`scripts/import-products.ts` must:

1. Apply `salePrice` **only** where `On Sale == Yes` — dropping all 5 dormant values.
2. **Refuse any salePrice below 10% of list** and fail loudly. Catches the $2.30 leap ring.
3. Sanitise descriptions from Squarespace RTE HTML to clean Markdown.
4. Map `Stock: "Unlimited"` → `"unlimited"`, numerics → integers.
5. Collapse orphan variant rows (the CSV emits them with a blank Product ID) into their parent.
6. Set `status: draft` for `Visible == No` (traveling stones, mirrored teardrop).
7. Download every image at `?format=2500w` and upload to R2 before writing content.
8. Leave `alt` blank and **fail the build** until filled — forcing a real pass over all 57 images.

---

## 7. Commerce design

### 7.1 Cart

Client-side only, persisted to `localStorage` via `nanostores`. Stores
`{slug, qty, size}` — **never prices**. A cart drawer, an add-to-cart button,
and a header count badge, as three small vanilla web components.

### 7.2 Checkout — `POST /api/checkout`

```
1. Receive [{slug, size, qty}]
2. Resolve (slug, size) -> variant in the build-time catalog bundled
   into the Worker.  Price = variant.salePrice ?? variant.price
   ── money comes from the server, NEVER from the request body
3. If variant.stock is finite: reject if KV SOLD[slug:size] is set
4. stripe.checkout.sessions.create({
     mode: 'payment',
     currency: 'cad',                          // D13
     line_items: [price_data built server-side; size in metadata],
     shipping_address_collection: { allowed_countries: [...] },
     shipping_options: [...],                  // flat per zone — Q13
   })
5. Return { url }; client redirects
```

The lookup key is **`(slug, size)`, not `slug`** — bolder bird sells for $290 at
size 7 and $340 at size 12, so a slug-only lookup would undercharge by up to $50.

> **Security invariant:** the client sends slugs and quantities, never money.
> Any design where the browser supplies a price is trivially exploitable. The
> catalog is generated at build time and bundled into the Worker so this lookup
> costs no network round-trip.

### 7.3 Webhook — `POST /api/webhook`

Verifies the Stripe signature using Web Crypto (`constructEventAsync` with
`Stripe.createSubtleCryptoProvider()` — the synchronous Node path does not exist
in Workers). On `checkout.session.completed`:

1. Set `KV SOLD[slug:size]` for each finite-stock line item.
2. Email Samantha the order, **including ring size**, which she needs to make it.

Stripe emails the customer's receipt itself, so we send no customer email.

### 7.4 Inventory — accepted trade-off

D7 selected **best-effort**. Concretely:

- **Static layer** — `variants[].stock` in the CMS, baked into HTML at build.
- **Runtime layer** — KV guard checked before session creation, written by the webhook.

KV is eventually consistent (propagation can take up to ~60s globally), so two
buyers hitting checkout within the same minute could both succeed.

**The exposure is one product.** Per §2.2 only `leap ring` (stock 1) is both
live and finite; the other two finite items are already sold out. Two buyers
would have to hit the same ring within the same minute at a few orders a week.
The remedy — refund and apologise — is cheap, and a hard guarantee here would be
over-engineering.

**Upgrade path if it ever bites:** swap the KV read for a D1 transaction, or a
Durable Object keyed by slug, for a strict guarantee. The interface in
`lib/catalog.ts` should be written so this is a one-file change.

### 7.5 Custom ring payments

Today Samantha **edits the live listing price** for each commission. That is
racy — two simultaneous commissions cannot be priced independently, and the
public shop briefly displays an arbitrary price.

**Replace it with Stripe Payment Links.** Per commission she creates a one-off
link in the Stripe dashboard for the agreed amount and sends it directly. No
site edit, no race, no public price, and it works from her phone.

The listing is still live but is not a physical product, which is why it is
absent from the products CSV (§2.2). Its price is therefore unknown — and
irrelevant, since Payment Links are priced per commission.

Consequently `/shop/p/sqtf2ekwh6wa01pzfryruvdsswlian` does **not** become a
product. It 301s to `/custom-work` (§8.3).

---

## 8. SEO plan

### 8.1 Guiding principle

Preserve every URL's meaning; improve every page's markup. The site is 14
months old with modest equity, so the risk budget comfortably covers cleaning
up meaningless slugs — provided every old URL 301s.

### 8.2 Page-level mapping

| Old | New | Action |
|---|---|---|
| `/` | `/` | Unchanged. Add meta description + `og:image` |
| `/home` | `/` | **301** — removes the duplicate |
| `/shop` | `/shop` | Unchanged. Add meta description |
| `/custom-work` | `/custom-work` | Unchanged. Fill the empty meta description |
| `/about` | `/about` | Unchanged. Keep the existing (good) description |
| `/cart` | `/cart` | Rebuilt as our own cart page |
| — | `/contact` | **New** |
| — | `/policies/{shipping,returns,privacy}` | **New** — required by Stripe |
| — | `/sizing` | **New** — strong long-tail SEO target |

### 8.3 Product redirects

All 13 old slugs 301 to readable equivalents, generated from `legacySlugs`:

| Old `/shop/p/…` | New `/shop/p/…` | Note |
|---|---|---|
| `1zhw2o243y124yydvayxku0q8c4t96` | `textured-citrine-sz-6` | sold out |
| `7tuvix3lwe4hixbfdwbfm4az1s7awq` | `opal-shark-sz-10` | |
| `8w3mik8nwvjtmzqd76z54feb98u52l` | `jelly-bean-opal-ring-sz-7-25` | sold out |
| `ofkqtolf9xssc47mxb3ywtstqgv9q4` | `leap-ring-sz-10` | stock 1 |
| `product-1-ydar7-e8mlb-r2y28-fyje9` | `ruby-shark-sz-4-75` | |
| `product-2-5c6mb-j8mng-zyt72-7p2zw` | `ruby-tiger-sz-9-5` | on sale |
| `product-6-yrdld-pcpw6-t3kp7-fdcwe` | `tri-boulder-opal-sz-9` | |
| `product-3-szb2y-gzh2r-3ly82-s7ghx` | `bolder-bird` | 6 size variants |
| `product-4-9e76d-pr6ls-5tznn-wdzn6` | `drippy-honey` | sizes TBC |
| `product-5-f98ry-4ll53-pbaad-6mblk` | `toad-ring` | 11 size variants |
| `p0om2oddwmey43nrqa6ffzurff69av` | `traveling-stones-adjustable` | **draft** |
| `zg3idrj6agsfr28g6adocbadcgvkho` | `mirrored-teardrop-ring-sz-7` | **draft** |
| `sqtf2ekwh6wa01pzfryruvdsswlian` | → **`/custom-work`** | §7.5 |

Made-to-order slugs deliberately omit size, since the customer chooses it.

The two draft products were never public (`Visible: No`), so they were never
indexed and strictly need no redirect. They get one anyway — it costs nothing
and covers the case where either is later published.

`scripts/verify-redirects.ts` asserts every old URL returns 301 to a URL
returning 200. It runs in CI and blocks deploy on failure.

### 8.4 Per-page requirements

Every page must emit:
- Unique `<title>` and meta description (closing the §2.4 gaps)
- `rel=canonical` — **including product pages, which currently lack it**
- `og:title`, `og:description`, **`og:image`**, `og:url`, `twitter:card`
- `Product` + `Offer` JSON-LD with `availability` flipping to `SoldOut`
- `BreadcrumbList` on products, `Organization` sitewide
- Descriptive `alt` on every image

`src/lib/seo.ts` centralises this so no page can ship without it.

### 8.5 Measurement — the critical gap

**Google Search Console was never set up.** This is the single highest-priority
action item in this document and it is independent of every other decision.

Without it we have no baseline, no query data, no indexed-URL list, and no way
to detect a post-migration drop. Squarespace's own analytics die with the
subscription.

**Set up GSC and Bing Webmaster Tools on the *current* Squarespace site
immediately** — ideally weeks before cutover — so real baseline data accumulates
while the new site is being built. Verification via DNS TXT survives the
migration; it does not need redoing.

---

## 9. Samantha's experience

A plain-English runbook ships as `docs/EDITING.md`, covering: adding a ring,
marking one sold, editing About/FAQ, taking a custom payment, and what to do
when something looks wrong.

Regressions and their mitigations:

| Regression | Mitigation |
|---|---|
| ~1–2 min publish delay | State it in the runbook; show build status in Keystatic |
| Orders live in Stripe, not Squarespace | Install the Stripe mobile app — push notification per sale, better than Squarespace's email-only default |
| Needs a GitHub account | One-time setup by Fern; after first login she never sees GitHub |
| Slug collisions on repeat names (§6.1) | Documented, with the `-2` convention |
| No visual page builder | Structured fields instead — arguably safer, since she cannot break layout |

---

## 10. Cost

| Item | Cost |
|---|---|
| Cloudflare Workers, R2, KV, DNS | $0 at this scale |
| Cloudflare Image Transformations | Free allowance — **verify current limits at implementation** |
| GitHub | $0 |
| Keystatic | $0 (open source) |
| Resend (contact form) | $0 free tier — **verify current limits** |
| `.ca` domain | ~CAD $15–20/yr |
| Stripe | Per-transaction % — **confirm current Canadian rates at signup** |
| **Recurring** | **~CAD $20/yr + Stripe fees** vs ~CAD $480/yr today |

Percentages and free-tier thresholds are deliberately **not** stated as fact —
they change, and this plan should not encode a number nobody verified.

---

## 11. Security

- Prices resolved server-side only (§7.2).
- Stripe webhook signature verified via Web Crypto; reject unverified.
- Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `KEYSTATIC_SECRET`, `RESEND_API_KEY`, R2 creds) in Worker secrets — never in the repo.
- Contact form behind Cloudflare Turnstile; rate-limited.
- `/keystatic/*` gated by GitHub OAuth restricted to the two collaborators.
- CSP, `X-Content-Type-Options`, `Referrer-Policy` via `_headers`.
- No customer PII stored by us — it lives in Stripe.
- Staging behind Cloudflare Access **and** `noindex`, so it can never be indexed.

---

## 12. Phased delivery

### Phase 0 — De-risk (do first, blocks everything)
- [ ] 0.1 **Set up Google Search Console on the live Squarespace site** (§8.5)
- [ ] 0.2 Set up Bing Webmaster Tools
- [x] 0.3 ~~Confirm currency~~ — **CAD confirmed** (D13)
- [ ] 0.4 Open the Stripe account in Samantha's name; complete identity + bank verification
- [ ] 0.5 Confirm `.ca` registrar transfer path (§13.1) — **Cloudflare Registrar does not support `.ca`**
- [ ] 0.6 Record the Squarespace renewal date
- [ ] 0.7 Export Squarespace analytics history before it is lost
- [ ] 0.8 Resolve the site-age discrepancy (§2.3)
- [ ] 0.9 ⚠️ **Fix the leap ring $2.30 sale price in Squarespace** (§2.2.1)
- [ ] 0.10 Confirm `drippy honey` sizes (Q14) and the 2 hidden products (Q15, Q16)

### Phase 1 — Extract
- [x] 1.1 ~~Export products CSV~~ — done, at `data/squarespace-products-export-2026-09-13.csv`
- [ ] 1.2 Export order + customer history — archive **outside the repo** (customer PII, D18)
- [ ] 1.3 Download every image at full resolution (`?format=2500w`) — **before any cancellation**
- [ ] 1.4 Capture the 3 lost-ring-series videos (§14 Q8)
- [ ] 1.5 **Record exact shipping zones + rates (Q13) — last checkout blocker**
- [ ] 1.6 Archive remaining page HTML for copy parity

### Phase 2 — Foundation
- [ ] 2.1 Astro + TypeScript + Cloudflare adapter
- [ ] 2.2 `wrangler.toml` bindings (ASSETS, R2, KV)
- [ ] 2.3 Design system from the captures — type scale, palette, spacing
- [ ] 2.4 Base layout, nav (Home/Shop/Customs/FAQ/Cart), footer, Instagram links
- [ ] 2.5 `lib/seo.ts`
- [ ] 2.6 CI: build, typecheck, Lighthouse budget

### Phase 3 — Content
- [ ] 3.1 `keystatic.config.ts` (§6)
- [ ] 3.2 Keystatic GitHub App + OAuth
- [ ] 3.3 `/keystatic` + `/api/keystatic` as `prerender = false`
- [ ] 3.4 R2 upload path + custom image field
- [ ] 3.5 `/img/*` transform proxy
- [ ] 3.6 Import 13 products per §6.2 (11 published, 2 draft)
- [ ] 3.7 Port About + 7 FAQs + lost ring series verbatim
- [ ] 3.8 Port Customs page + form

### Phase 4 — Commerce
- [ ] 4.1 Cart store + components
- [ ] 4.2 `/api/checkout` with server-side pricing
- [ ] 4.3 Shipping options per country
- [ ] 4.4 Ring-size selection → Stripe metadata
- [ ] 4.5 `/api/webhook` + KV guard
- [ ] 4.6 Order email to Samantha
- [ ] 4.7 Success + cancel pages
- [ ] 4.8 **End-to-end test in Stripe test mode, including a real refund**

### Phase 5 — SEO + new pages
- [ ] 5.1 JSON-LD (Product/Offer/Breadcrumb/Organization)
- [ ] 5.2 `sitemap.xml` + `robots.txt` at identical paths
- [ ] 5.3 Generate `_redirects` from `legacySlugs` (13 product + `/home`)
- [ ] 5.4 `verify-redirects.ts` in CI
- [ ] 5.5 Write `/policies/*`, `/sizing`, `/contact`
- [ ] 5.6 Meta descriptions for every page
- [ ] 5.7 `og:image` generation

### Phase 6 — Pre-cutover
- [ ] 6.1 Staging behind Access + `noindex`
- [ ] 6.2 Samantha UAT — she adds a ring and marks one sold, unaided
- [ ] 6.3 Lighthouse ≥ 95 on mobile
- [ ] 6.4 Cross-browser + real-device check
- [ ] 6.5 Accessibility pass (contrast, focus, alt text)
- [ ] 6.6 `docs/EDITING.md`
- [ ] 6.7 Live Stripe smoke test with a real card, then refund

### Phase 7 — Cutover (§13)
### Phase 8 — Post-cutover (§13.3)

---

## 13. Cutover

### 13.1 Domain — the highest-risk item

`boldermade.ca` is **registered at Squarespace**. Two constraints compound:

1. **`.ca` is a CIRA TLD.** Transfers require an auth code *and* registrant
   approval through CIRA, and the registrant must satisfy Canadian Presence
   Requirements. Samantha being in Toronto satisfies CPR, but the approval email
   must reach an address she can actually access.
2. **Cloudflare Registrar's supported-TLD list is limited.** Verify whether
   `.ca` is accepted **before** planning the transfer (task 0.5). If it is not,
   pick a Canadian-friendly registrar instead — Porkbun, Namecheap and Rebel.ca
   are candidates.

   > **DNS and the registrar are separable.** Cloudflare can run DNS for free
   > regardless of who holds the registration, so a non-Cloudflare registrar
   > costs us nothing architecturally.

**Non-negotiable ordering:**

```
① Transfer the domain OUT of Squarespace   ← must fully complete first
② Verify the new registrar controls it
③ Point nameservers at Cloudflare
④ Cut over the site
⑤ Only then cancel Squarespace
```

> Cancelling Squarespace while the domain is still registered there risks losing
> the domain. Nothing in this plan is worth that. **Never reorder these steps.**

Also note ICANN's 60-day transfer lock after a registration or registrant-contact
change. If anything was recently changed, the transfer may be blocked for up to
60 days — which is precisely why this is Phase 0 work.

### 13.2 Cutover sequence

| # | Step | Notes |
|---|---|---|
| 1 | Confirm domain transfer complete | §13.1 |
| 2 | Add zone to Cloudflare, replicate DNS | No MX to preserve — Gmail is personal |
| 3 | Lower TTLs to 300s | ≥24h ahead |
| 4 | Verify staging against production Stripe | Test mode off |
| 5 | Point apex + `www` at the Worker | `www` canonical, apex 301s |
| 6 | Verify TLS | Full (strict) |
| 7 | Run `verify-redirects.ts` against production | All 13 + `/home` |
| 8 | Remove `noindex`; confirm `robots.txt` | Easy to forget; breaks everything |
| 9 | Submit `sitemap.xml` in GSC | |
| 10 | Request indexing for the 5 main pages | |
| 11 | Live transaction + refund | Real card |
| 12 | Restore TTLs | |
| 13 | **Keep Squarespace paid ~30 days** | Rollback insurance |

### 13.3 Post-cutover monitoring

| When | Check |
|---|---|
| Hour 1 | All 19 URLs 200/301; checkout works; no console errors |
| Day 1 | GSC crawl errors; Cloudflare analytics vs baseline |
| Day 3 | New URLs appearing in GSC index |
| Week 1 | Old slugs dropping out; new slugs entering; impressions stable |
| Week 2 | Core Web Vitals in GSC (expect improvement over Squarespace) |
| Week 4 | Impressions/clicks vs baseline — **decision point on rollback** |
| Week 4 | Cancel Squarespace if all green |
| Week 8 | Confirm all 301s still resolve; old URLs de-indexed |

### 13.4 Rollback

Within the ~30-day window, rollback is a DNS change back to Squarespace — which
is why TTLs are lowered and the subscription stays paid.

| Failure | Response |
|---|---|
| Checkout broken | Fix forward; Stripe outage is not a rollback trigger |
| Site down | DNS back to Squarespace (~5 min at 300s TTL) |
| Traffic drop >30% at week 2 | Investigate redirects first — most likely cause |
| Sustained drop at week 4 | Consider rollback; diagnose before deciding |

After Squarespace is cancelled there is no rollback. That is the point of the
30-day overlap.

---

## 14. Open questions

### 14.1 Closed by the CSV export (2026-09-13)

| # | Question | Answer |
|---|---|---|
| ~~Q1~~ | Currency | **CAD** — confirmed (D13) |
| ~~Q3~~ | Shipping model | **Flat rate per destination zone** (D17). *Rates still needed — see Q13* |
| ~~Q5~~ | Which products are sold out | textured citrine and jelly bean opal (stock 0) |
| ~~Q8~~ | Custom ring payment listing | Still live as a non-physical product; replaced by Payment Links (§7.5) |
| ~~Q14~~ | `drippy honey` sizes | **Cast at any size on order.** Drove a new `sizing: 'any'` mode — one price, customer picks any standard size, size captured for the order |

### 14.2 Still open

| # | Question | Blocks | Why it matters |
|---|---|---|---|
| Q13 | Real shipping rates | Launch | **Interim defaults accepted** — working rates now live in Keystatic (Settings → Shipping) and ship with `provisional: true`. Preflight warns; the shipping page shows a banner. Replace before launch |
| Q2 | Was there an earlier site before 2025-07-01? (§2.3) | Phase 0 | Changes the SEO risk model; may add redirects |
| Q4 | GST/HST registration status | Phase 0 | A Canadian business over the CRA small-supplier threshold must register. **An accountant's question, not an engineering one** — flagged, not decided here |
| Q6 | Squarespace renewal date | Phase 0 | Sets the outer deadline |
| Q7 | Custom-request form fields | Phase 3 | Must be reproduced faithfully |
| Q9 | Where do the 3 lost-ring-series videos live? | Phase 1 | If Squarespace-hosted they die with the account |
| Q10 | Instagram shopping tags pointing at product URLs? | Phase 5 | Would need retagging after slug changes |
| Q11 | Brand assets — logo source, fonts | Phase 2 | Squarespace inlined the fonts; originals preferred |
| Q12 | Return/refund policy wording | Phase 5 | Stripe requires a published policy |
| **Q15** | **Why are the 2 hidden products hidden?** | Phase 3 | Imported as drafts either way (D16), but determines whether they should later publish as available or sold |
| **Q16** | **Is `traveling stones` still on sale at $190?** | Phase 3 | It is flagged On Sale but hidden, so the sale may be stale |
| Q17 | Confirm `www` vs apex as canonical | Phase 7 | Current canonical is `www` — keep it |

### 14.3 Action items outside the migration

- ⚠️ **Fix the `leap ring` $2.30 sale price in Squarespace now** (§2.2.1). Live risk today, independent of this project.
- Consider whether `ruby tiger` should still be on sale at cutover.

---

## 15. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Domain lost during transfer | Low | **Catastrophic** | Strict ordering (§13.1); never cancel first |
| ~~Currency wrong~~ | — | — | **Closed** — CAD confirmed (D13) |
| Stripe verification delays | Medium | Medium | Started in Phase 0 |
| Squarespace images lost | Low | High | Downloaded in Phase 1 before any cancellation |
| Ranking drop from slug changes | Low | Medium | 301s + CI verification; young site, low equity |
| No SEO baseline | **Certain today** | Medium | GSC set up in Phase 0 — the earlier the better |
| Double-sell | **Very low** | Low | Only 1 live finite-stock product (§7.4); accepted (D7) |
| Dormant sale price activated by accident | Medium | **High** | Schema removes the `onSale` flag entirely (§6); importer rejects implausible values |
| Size-variant price undercharged | Low | Medium | Checkout keys on `(slug, size)`, not slug (§7.2) |
| Samantha finds CMS hard | Medium | Medium | UAT gate at 6.2 — she must succeed unaided |
| Build breaks, she can't publish | Low | Medium | CI on PRs; Fern on call; last good deploy stays live |
| Staging indexed by Google | Low | Medium | Access + `noindex` from day one |
| `.ca` registrar friction | Medium | Medium | Verified in Phase 0 before commitment |

---

## 16. Definition of done

- [ ] All 19 URLs resolve; all 13 legacy product URLs 301 correctly
- [ ] A real purchase completes end-to-end, with the ring size reaching Samantha
- [ ] Samantha adds a ring and marks one sold, **unaided**
- [ ] Lighthouse ≥ 95 mobile on home, shop, and a product page
- [ ] Every page has a unique title, meta description, canonical, and `og:image`
- [ ] Product JSON-LD validates in Google's Rich Results Test
- [ ] GSC shows the new sitemap indexed with no crawl errors
- [ ] 4 weeks post-cutover: impressions within tolerance of baseline
- [ ] Squarespace cancelled, domain safely elsewhere
- [ ] `docs/EDITING.md` exists and Samantha has used it

---

## Appendix A — Squarespace facts

| Item | Value |
|---|---|
| Site ID | `686343550b484e68bb6fa9e8` |
| Created (inferred) | 2025-07-01 02:09 UTC |
| Image CDN | `images.squarespace-cdn.com/content/v1/686343550b484e68bb6fa9e8/…` |
| Full-res trick | append `?format=2500w` |
| SKU prefix | `SQ…` (Squarespace-generated; not reused) |
| Canonical host | `www.boldermade.ca` |
| Known sample | opal shark sz 10 — CAD $300.00, SKU `SQ7847580`, `InStock` |
| Products export | `data/squarespace-products-export-2026-09-13.csv` (12 products, 15 orphan variant rows) |
| Currency | **CAD** |
| Total product images | 57 |

## Appendix B — Assumptions

Recorded so a reviewer can challenge them:

1. `www` stays canonical.
2. Sold rings keep their pages indefinitely (D8).
2b. The 5 dormant sale prices are stale, not pending.
3. `Unlimited` stock is deliberate and accurate — Samantha can remake those pieces.
4. Stripe's own receipt is sufficient for the customer.
5. Samantha will use the Stripe mobile app for order notifications.
6. No customer accounts are needed — guest checkout only.
7. `html/` captures are representative of current production.
8. No backlinks point at product slugs other than via the shop grid *(unverified — GSC would confirm)*.

---

## 17. Implementation status

Built and verified in-repo. Not deployed — no Cloudflare resources exist yet.

### 17.1 Done

| Area | State |
|---|---|
| Astro 5 + Cloudflare adapter | Builds clean; 22 pages prerendered |
| Design tokens | `src/styles/tokens.css` — every visual value is a token |
| Keystatic schema | `keystatic.config.ts`; admin at `/keystatic` |
| Product import | 12 products from the CSV; 10 published, 2 draft |
| Storefront | Home, shop, product detail, about/FAQ, customs, contact, sizing, cart, 404, 3 policy pages |
| Cart + checkout UI | nanostores + vanilla web components |
| `/api/checkout` | Server-side pricing from a frozen catalog, `(slug,size)` lookup, KV stock guard |
| Shipping | 3 zones, editable in Keystatic; frozen to JSON at build |
| `/api/webhook` | Async signature verification, KV write, order email |
| `/api/contact` | Honeypot, length caps, Resend delivery |
| `/img/*` | R2 origin + Image Transformations via fetch subrequest |
| SEO | Every page: title, description, canonical, `og:image`, one `h1` |
| Redirects | 14 rules generated from `legacySlugs` |
| Scripts | `import-products`, `fetch-images`, `upload-images`, `audit-alt`, `preflight`, `verify-redirects` |
| Samantha's runbook | `docs/EDITING.md` |

**Customer-facing JS: 3.8 kB uncompressed (~1.8 kB gzipped).** React is pulled in
only for the Keystatic admin bundle and is referenced by no public page —
verified against the built output, not assumed.

### 17.2 Bugs found by verifying output

Recorded because each would have shipped silently:

1. **Keystatic stores entries flat.** `<slug>.mdoc`, not `<slug>/index.mdoc`. The
   importer wrote directories and the reader returned zero products.
2. **`entry.description()` returns `{ node }`**, not a Markdoc node. Passing the
   wrapper to `Markdoc.transform` yields empty output — which produced exactly
   the missing meta descriptions this migration exists to fix. A `try/catch` was
   hiding it; it has been removed so the build fails loudly instead.
3. **`cf.image` applies to a fetch subrequest, not a Response.** The first image
   proxy would have served full-size originals while appearing to work.
4. **Slug prefix vs suffix.** `one of a kind | leap ring` puts the marker before
   the name; stripping the suffix first produced an empty slug.
5. **The checkout Worker read the filesystem.** `/api/checkout` imported the
   Keystatic reader, which uses `node:fs` and `process.cwd()`. A Worker has
   neither, so `readdir` was bundled into the Worker and **every checkout would
   have failed in production** — with a clean build and no warning. The catalog
   is now frozen to `src/generated/catalog.json` before `astro build`, which is
   what §7.2 described all along. Verified: zero `node:fs` references in the
   built Worker.
6. **The cart drawer priced `any`-size rings at $0.** It keyed prices by size,
   but an `any`-size ring stores an empty size while the cart line carries the
   customer's choice, so the lookup missed. Drawer and checkout now resolve
   prices the same way; a mismatch between them is the failure mode to watch.

### 17.3 Blocked on external input

| Item | Blocked by |
|---|---|
| **R2 upload** | All 57 images downloaded successfully (7.4 MB). Upload needs Cloudflare auth (`wrangler login`) and the bucket to exist |
| KV namespace | `wrangler kv namespace create SOLD` — the only hard preflight failure |
| Stripe keys | Account must exist first (Phase 0.4) |
| Real shipping rates | Q13 — defaults accepted for now |
| Alt text | 57/57 provisional. `npm run audit:alt` |

### 17.4 Deliberate deviations from the plan as written

- **Alt text does not fail the build.** §6.2 said it should. In practice that
  blocks all progress before a single page can be viewed, so the importer writes
  descriptive provisional text and `audit:alt` tracks the worklist. Preflight
  warns; it does not block.
- **`traveling-stones-adjustable-sz-8-9-5`** keeps its size range in the slug
  rather than §8.3's shorter `traveling-stones-adjustable`. It is a draft, and
  the generated form is more descriptive.
- **Policy pages carry visible draft banners** until Samantha signs off the
  wording (Q12). Preflight warns while they remain.
- **Provisional shipping rates warn rather than block.** §12 task 0 had them
  failing preflight. Fern accepted working defaults as an interim state, so the
  gate is now a loud warning plus a banner on `/policies/shipping`. Real
  customers are still charged these amounts — replace before launch.
