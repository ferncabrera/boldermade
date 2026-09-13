/**
 * All money in this codebase is an integer number of CAD cents.
 *
 * Floats are never used for money: 275.00 * 100 evaluates to 27499.999999999996
 * in IEEE754, and that rounding error becomes a genuinely mispriced order.
 */

export const CURRENCY = 'CAD' as const;

const formatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: CURRENCY,
  currencyDisplay: 'narrowSymbol',
});

/** 29000 -> "$290.00" */
export function formatPrice(cents: number): string {
  return formatter.format(cents / 100);
}

/** Drops the ".00" on whole amounts: 29000 -> "$290". */
export function formatPriceShort(cents: number): string {
  return cents % 100 === 0
    ? formatter.format(cents / 100).replace(/[.,]00$/, '')
    : formatter.format(cents / 100);
}
