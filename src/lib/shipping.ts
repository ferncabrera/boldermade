/**
 * Flat-rate shipping by destination zone (MIGRATION_PLAN D17).
 *
 * These are WORKING DEFAULTS, not Samantha's real Squarespace rates (Q13 is
 * still open). They are deliberately in the right ballpark for a small insured
 * parcel out of Toronto rather than round invented numbers, so the store is
 * usable end to end while the real figures are confirmed.
 *
 * To change them, edit Shipping in Keystatic — the rates are content, not code,
 * so updating them is a save rather than a deploy.
 */
import type Stripe from 'stripe';
import zonesData from '../generated/shipping.json' with { type: 'json' };

export interface Zone {
  label: string;
  countries: string[];
  /** CAD cents */
  rate: number;
  minDays: number;
  maxDays: number;
}

export interface ShippingConfig {
  /** False once Samantha's real Squarespace rates are entered. */
  provisional: boolean;
  zones: Zone[];
}

export const SHIPPING: ShippingConfig = zonesData as ShippingConfig;
export const ZONES: Zone[] = SHIPPING.zones;
export const PLACEHOLDER_RATES = SHIPPING.provisional;

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
