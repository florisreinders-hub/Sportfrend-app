/**
 * Single source of truth for Premium's displayed price - PricingScreen,
 * FaqScreen and lib/purchases.ts's PLAN_PRICE_CENTS all read from here
 * instead of repeating the literal numbers, so a price change (the
 * values below are provisional - the final price is still to be
 * decided) only needs editing in this one file.
 *
 * RevenueCat/the store is still the source of truth for what's actually
 * charged once the real "premium" entitlement/offering is configured
 * there (see lib/purchases.ts) - these are display-only until then.
 */
export const PREMIUM_MONTHLY_PRICE_CENTS = 699;
export const PREMIUM_YEARLY_PRICE_CENTS = 4999;

export const PREMIUM_MONTHLY_PRICE_LABEL = "€6,99";
export const PREMIUM_YEARLY_PRICE_LABEL = "€49,99";
