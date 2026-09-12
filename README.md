# boldermade

Migration of [boldermade.ca](https://www.boldermade.ca) — "bolder", handmade
statement rings by Samantha, Toronto — from Squarespace Commerce to a statically
rendered Astro site on Cloudflare, with Stripe Checkout and a git-backed CMS.

## Status

**Planning.** No implementation has begun.

- 📋 **[docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md)** — the plan: current-state
  audit, architecture, decisions and rejected alternatives, SEO/URL mapping,
  phased tasks, cutover runbook, open questions and risk register.

## Repository contents

| Path | Purpose |
|---|---|
| `docs/MIGRATION_PLAN.md` | The migration plan |
| `html/` | Squarespace page captures used for the audit (reference only; removed after cutover) |

## Before any code is written

Phase 0 of the plan must be closed out first. In particular:

1. **Confirm the currency** — the brief said USD, the live product markup says `CAD`.
2. **Set up Google Search Console** on the current Squarespace site — there is no
   SEO baseline today, and every week it runs before cutover is a week of data.
3. **Sort out the domain** — `boldermade.ca` is registered at Squarespace and must
   be transferred out *before* that subscription is cancelled.
