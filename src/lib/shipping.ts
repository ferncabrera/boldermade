/**
 * Flat-rate shipping by destination zone (MIGRATION_PLAN D17).
 *
 * ⚠️ THE RATES BELOW ARE PLACEHOLDERS. They are the last open blocker (Q13) and
 * MUST be replaced with the real Squarespace figures before the store goes live.
 * `PLACEHOLDER_RATES` is asserted false by scripts/preflight.ts, so a deploy
 * cannot happen while they are still in place.
 */
import type Stripe from 'stripe';

export const PLACEHOLDER_RATES = true;

export interface Zone {
  label: string;
  countries: string[];
  /** CAD cents */
  rate: number;
  minDays: number;
  maxDays: number;
}

export const ZONES: Zone[] = [
  { label: 'Canada',         countries: ['CA'],                                     rate: 1500, minDays: 3,  maxDays: 8 },
  { label: 'United States',  countries: ['US'],                                     rate: 2500, minDays: 5,  maxDays: 12 },
  { label: 'International',  countries: ['GB', 'AU', 'NZ', 'FR', 'DE', 'IE', 'NL'], rate: 3500, minDays: 10, maxDays: 21 },
];

export function allowedCountries(): Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] {
  return ZONES.flatMap((z) => z.countries) as never;
}

export function getShippingOptions(): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  return ZONES.map((z) => ({
    shipping_rate_data: {
      type: 'fixed_amount',
      fixed_amount: { amount: z.rate, currency: 'cad' },
      display_name: `${z.label} shipping`,
      delivery_estimate: {
        minimum: { unit: 'business_day', value: z.minDays },
        maximum: { unit: 'business_day', value: z.maxDays },
      },
    },
  }));
}
