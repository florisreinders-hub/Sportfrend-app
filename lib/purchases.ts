/**
 * RevenueCat integration scaffold - NOT a real integration yet.
 *
 * `react-native-purchases` (RevenueCat's SDK) is a native module. It is
 * not one of the native modules Expo Go ships prebuilt (unlike
 * expo-image-picker, expo-location, or @react-native-community/
 * datetimepicker, used elsewhere in this app) - it needs to be compiled
 * into the app via a custom EAS development or production build.
 * Actually installing the package now would break the Expo Go testing
 * workflow every build in this project has used so far, for every screen,
 * not just this one - so it's deliberately not added as a dependency yet.
 *
 * What's here instead: the product/entitlement configuration a real
 * RevenueCat integration would use, and a sandbox implementation of the
 * same shape a real one exposes (fetch the offering, purchase a package,
 * restore purchases). PaymentScreen is written against this interface, so
 * swapping the two sandbox functions below for real
 * `Purchases.purchasePackage()` / `Purchases.restorePurchases()` calls -
 * once the account/product setup described in README.md is done and the
 * package is installed via a custom build - is the only change needed.
 */

export type PlanId = "premium" | "elite";

/**
 * RevenueCat product identifiers. These must exactly match the product IDs
 * created in App Store Connect / Google Play Console and attached to
 * RevenueCat entitlements - see the "RevenueCat" section in README.md for
 * the exact setup steps and price points (Premium €4,99/mnd, Elite
 * €9,99/mnd).
 */
export const REVENUECAT_PRODUCT_IDS: Record<PlanId, { ios: string; android: string }> = {
  premium: { ios: "sportfrend_premium_monthly", android: "sportfrend:premium-monthly" },
  elite: { ios: "sportfrend_elite_monthly", android: "sportfrend:elite-monthly" },
};

/** RevenueCat entitlement identifiers - one per paid plan, granted on a successful purchase. */
export const REVENUECAT_ENTITLEMENTS: Record<PlanId, string> = {
  premium: "premium",
  elite: "elite",
};

export type PurchaseResult = { success: true } | { success: false; error: string };

/**
 * Sandbox stand-in for `Purchases.purchasePackage()` - simulates the round
 * trip to the store's native purchase sheet (which is why this is async
 * and takes a beat) without processing any real payment. Always succeeds;
 * a real integration's equivalent can fail (user cancels, network error,
 * "product not available"), so PaymentScreen already handles a
 * `{ success: false }` result even though this sandbox never returns one.
 */
export async function purchasePlanSandbox(plan: PlanId): Promise<PurchaseResult> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  return { success: true };
}

/** Sandbox stand-in for `Purchases.restorePurchases()`. */
export async function restorePurchasesSandbox(): Promise<PurchaseResult> {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { success: true };
}
