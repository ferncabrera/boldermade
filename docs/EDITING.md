# Editing the bolder website

A guide for Samantha. No code, no jargon. If something here doesn't match what
you see on screen, ask Fern — the site changed, not you.

---

## Where to go

**https://www.boldermade.ca/keystatic**

Sign in with GitHub the first time. After that it remembers you.

You'll see three sections in the sidebar:

- **Rings** — everything in the shop
- **Pages** — the writing on About, Customs, and so on
- **Settings** — shipping rates and site-wide bits

---

## The one thing that's different from Squarespace

**Changes take about a minute to appear.**

When you hit Save, the website rebuilds itself in the background. Refresh the
live site after a minute or two and your change will be there. If it still
isn't after five minutes, something went wrong — tell Fern.

Everything else should feel familiar.

---

## Adding a ring

1. **Rings** → **+ New**
2. Fill in the **Ring name**. This also becomes the web address, so write it the
   way you'd want someone to read it — `opal shark sz 10`, not `ring 4 final v2`.
3. Set **Status** to **Draft** while you work. Nobody can see a draft. Switch it
   to **Published** when you're ready.
4. Choose the **Sizing**:
   - **Fixed size** — a one-off piece in one size. Put the size in the Size box.
   - **Any size** — made to order, cast at whatever size they pick, same price
     whatever the size. Add **one** row under Pricing & stock. The customer still
     chooses a size at checkout and it comes through on your order email.
   - **Price varies per size** — made to order where bigger sizes cost more, like
     bolder bird and toad ring. Add one row per size, each with its own price.
   - **Adjustable** — fits a range. Put the range in, like `8-9.5`.
5. Under **Pricing & stock**, add the price **in cents**. $290 is `29000`.
   This looks odd but it means a price can never be wrong by a rounding error.
   - Leave **Sale price** empty unless it's actually on sale.
   - **Stock**: type `unlimited` if you can remake it, or a number if there's
     genuinely only one.
6. Add your **Photos**. For each one, write **Alt text** — describe the ring to
   someone who can't see it. "Chunky silver band with a green boulder opal,
   bezel set." This is how Google Images finds your work, so it's worth the
   thirty seconds.
7. Write the **Description** the way you always have.
8. Save.

---

## Marking a ring sold

Open the ring → **Pricing & stock** → set **Stock** to `0` → Save.

The page stays up with a "Sold" badge. **That's deliberate.** Sold pieces show
people what you can do and bring in custom enquiries — taking them down would
throw away the search traffic they've earned.

---

## Putting something on sale

Open the ring → **Pricing & stock** → fill in **Sale price** (in cents) → Save.

To end the sale, **clear the Sale price box**. Leaving a number in there with
the sale "off" is exactly the trap the old site had — one listing was sitting on
a $2.30 sale price against a $280 ring, waiting for someone to switch it on.
Here, empty means not on sale. There's no separate switch to get wrong.

---

## Taking payment for a custom ring

**Don't edit a shop listing to do this.** The old site needed that; this one
doesn't, and changing a live price where customers can see it caused problems.

Instead:

1. Agree the price with your customer by email.
2. Go to the **Stripe dashboard** → **Payment links** → **New**.
3. Enter the amount and a name like "Custom ring — Debbie".
4. Send them the link.

It works from your phone, nothing appears in the public shop, and two
commissions can run at once without interfering.

---

## Changing shipping prices

**Settings** → **Shipping**. Each zone has a name, the countries it covers, the
price in cents, and how many business days it takes.

The rates in there now are **sensible guesses, not your real ones**. Until you
replace them and untick "These rates are still provisional", the shipping page
shows a warning. Customers are charged whatever is in there, so it's worth doing
early.

---

## Editing About, Customs, and the FAQs

**Pages** in the sidebar. Click, edit the text, Save.

---

## When a ring name repeats

If you make another "opal shark sz 10", the site will stop you using that name
again — the sold one still has that address. Add a number: `opal shark sz 10 2`.

---

## Orders

Orders don't live on the website. They're in **Stripe**.

- You get an email for every order, with the ring and **the size**.
- Install the **Stripe app** on your phone for a notification the moment
  something sells.
- Refunds are in the Stripe dashboard.
- Stripe emails the customer their own receipt — you don't need to.

---

## If something looks broken

1. Wait two minutes and refresh — it may still be rebuilding.
2. Check you hit Save.
3. Tell Fern what you were doing when it broke.

You can't permanently break the site from here. Every change is saved in full
history and can be undone.
