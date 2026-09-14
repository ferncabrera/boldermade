# Deploying

For Fern. Samantha never needs this — see [EDITING.md](EDITING.md).

---

## Current state

| Resource | Status |
|---|---|
| R2 bucket `boldermade-images` | ✅ created, 57 objects uploaded |
| KV namespace `SOLD` | ✅ `2a050794a499463d95f1d5674f940242`, bound in `wrangler.toml` |
| Stripe account | ❌ not created — blocks checkout |
| Resend account | ❌ not created — blocks order + contact emails |
| Keystatic GitHub App | ❌ not created — blocks Samantha's login |
| Worker | ❌ never deployed |
| Domain | ❌ still at Squarespace |

`npm run preflight` passes. Remaining warnings are launch-blockers, not
deploy-blockers — a staging deploy is fine today.

---

## First deploy (staging)

```bash
npm run deploy          # runs preflight, builds, then wrangler deploy
```

This publishes to `boldermade.<your-subdomain>.workers.dev`. Everything except
checkout, emails and the CMS login works immediately — the storefront, images
from R2, and all redirects.

**Before sharing that URL with anyone**, note that `robots.txt` allows crawling.
A `workers.dev` URL that gets indexed becomes a duplicate of the real site. Either
keep it private or put Cloudflare Access in front of it.

---

## Secrets

None are in the repo. Set each with `wrangler secret put <NAME>`.

| Secret | Needed for | Where it comes from |
|---|---|---|
| `STRIPE_SECRET_KEY` | checkout | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | marking items sold, order emails | Stripe → Webhooks, after adding the endpoint |
| `RESEND_API_KEY` | order + contact emails | Resend → API keys |
| `ORDER_NOTIFY_EMAIL` | where orders go | `boldermade@gmail.com` |
| `KEYSTATIC_SECRET` | CMS session signing | `openssl rand -hex 32` |
| `KEYSTATIC_GITHUB_CLIENT_ID` | CMS login | GitHub App |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | CMS login | GitHub App |

---

## Stripe

1. Create the account **in Samantha's name** — Stripe requires the legal business
   owner, and payouts go to her bank. Identity and bank verification take days.
2. Set the account currency to **CAD**.
3. Add a webhook endpoint: `https://<your-domain>/api/webhook`, event
   `checkout.session.completed`. Copy the signing secret.
4. Test in test mode first. `scripts/preflight.ts` does not check this — put a
   real card through and refund it before launch.

---

## Resend

1. Verify the domain `boldermade.ca` (SPF + DKIM records).
2. Because the domain still lives at Squarespace, those DNS records have to go in
   wherever DNS is served from at the time. Easiest after the nameserver move.

---

## Keystatic login

1. GitHub → Settings → Developer settings → **GitHub Apps** → New.
2. Callback URL: `https://<your-domain>/api/keystatic/github/oauth/callback`
3. Permissions: **Contents: Read & write**, **Pull requests: Read & write**.
4. Install it on `ferncabrera/boldermade`.
5. Add Samantha as a repo collaborator, then set the two secrets above.

---

## Changing image keys

Image keys are content-addressed and served `immutable` with a one-year cache. If
a photo is ever *replaced*, give it a **new key** rather than overwriting the
object — otherwise browsers and the edge will serve the old bytes for a year.

---

## Launch checklist

Beyond the migration plan's §13 cutover sequence:

- [ ] Replace provisional shipping rates in Keystatic, untick "provisional"
- [ ] Sign off the three policy pages and remove their draft banners
- [ ] Real card transaction end to end, then refund it
- [ ] `node --experimental-strip-types scripts/verify-redirects.ts https://<domain>`
- [ ] Confirm `/keystatic` loads and Samantha can save a change
- [ ] Confirm an order email actually arrives
- [ ] Set up Google Search Console — still not done, still the top SEO item
