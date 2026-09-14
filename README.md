# boldermade

Migration of [boldermade.ca](https://www.boldermade.ca) — "bolder", handmade
statement rings by Samantha, Toronto — from Squarespace Commerce to a statically
rendered Astro site on Cloudflare, with Stripe Checkout and a git-backed CMS.

## Status

**Planning.** No implementation has begun.

- 🛠 **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** — run it locally in three commands
- 🚀 **[docs/DEPLOY.md](docs/DEPLOY.md)** — secrets, Stripe/Resend setup, keeping staging private
- ✍️ **[docs/EDITING.md](docs/EDITING.md)** — Samantha's guide, no jargon
- 📋 **[docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md)** — the plan: current-state
  audit, architecture, decisions and rejected alternatives, SEO/URL mapping,
  phased tasks, cutover runbook, open questions and risk register.

## Quick start

```bash
npm install
npm run fetch:images   # once — pulls product photos into ./tmp-images
npm run dev            # http://localhost:4321  (CMS at /keystatic)
```

## Repository contents

| Path | Purpose |
|---|---|
| `docs/MIGRATION_PLAN.md` | The migration plan |
| `src/` | Astro storefront, API routes, design tokens |
| `content/` | Products and settings, edited through Keystatic |
| `scripts/` | Import, image rescue, preflight, redirect verification |
| `html/`, `css/` | Squarespace captures used for the audit (reference only) |
| `data/` | Squarespace CSV export and derived manifests |

## Before any code is written

Phase 0 of the plan must be closed out first. In particular:

1. **Get the shipping zones and rates** — the last thing blocking checkout work.
2. **Set up Google Search Console** on the current Squarespace site — there is no
   SEO baseline today, and every week it runs before cutover is a week of data.
3. **Sort out the domain** — `boldermade.ca` is registered at Squarespace and must
   be transferred out *before* that subscription is cancelled.

Separately, and not part of the migration: the `leap ring` listing has a dormant
sale price of **$2.30** against a $280 list price. If anyone toggles "On Sale" on
that product it sells for $2.30. Worth fixing in Squarespace today.
