import { Platform } from "react-native";
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesOffering } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

/**
 * Real RevenueCat integration (replaces the earlier sandbox scaffold - see
 * git history for `purchasePlanSandbox`/`restorePurchasesSandbox` if you
 * need to compare). `react-native-purchases`/`react-native-purchases-ui`
 * are native modules - they don't run in Expo Go, only in a custom EAS
 * dev/production build (see README.md's "RevenueCat" section).
 */

export type PlanId = "premium" | "elite";

/**
 * RevenueCat product identifiers. Must exactly match the product IDs
 * created in App Store Connect / Google Play Console and attached to
 * RevenueCat entitlements/offerings - see README.md's "RevenueCat"
 * section for the exact dashboard setup steps.
 */
export const REVENUECAT_PRODUCT_IDS: Record<PlanId, Record<"monthly" | "yearly", { ios: string; android: string }>> = {
  premium: {
    monthly: { ios: "sportfrend_premium_monthly", android: "sportfrend:premium-monthly" },
    yearly: { ios: "sportfrend_premium_yearly", android: "sportfrend:premium-yearly" },
  },
  elite: {
    monthly: { ios: "sportfrend_elite_monthly", android: "sportfrend:elite-monthly" },
    yearly: { ios: "sportfrend_elite_yearly", android: "sportfrend:elite-yearly" },
  },
};

/**
 * RevenueCat entitlement identifiers - one per paid plan. Each maps to the
 * `plan` value stored in `public.subscriptions` (see
 * getPlanFromCustomerInfo() below) - the actual feature-gating in the
 * database (daily limits, posts access, availability filter, trainings)
 * reads `subscriptions.plan`, not RevenueCat directly, so this mapping is
 * the one place that connects the two.
 */
export const REVENUECAT_ENTITLEMENTS: Record<PlanId, string> = {
  premium: "premium",
  elite: "elite",
};

/**
 * RevenueCat Offering identifiers (dashboard: Product catalog -> Offerings).
 * One offering per plan, each containing a monthly and an annual package -
 * this is what RevenueCatUI.presentPaywall() renders. Using named
 * offerings (rather than always presenting "current") is what lets
 * PricingScreen present a *specific* plan's paywall when the user taps
 * "Kies" on the Premium or Elite card.
 */
export const REVENUECAT_OFFERING_IDS: Record<PlanId, string> = {
  premium: "premium",
  elite: "elite",
};

/** Flat prices shown in the app's own UI (PricingScreen) - RevenueCat/the store is still the source of truth for what's actually charged; this is display-only. */
export const PLAN_PRICE_CENTS: Record<"basis" | PlanId, number> = {
  basis: 0,
  premium: 499,
  elite: 999,
};

const REVENUECAT_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
}) ?? "";

export const isPurchasesConfigured = Boolean(REVENUECAT_API_KEY);

let currentAppUserId: string | null = null;

/**
 * Call once, as early as possible in App.tsx (module level, like
 * initSentry()) - configures the SDK so getOfferings()/getCustomerInfo()/
 * the paywall UI all work. Fails open (console.warn + skip) exactly like
 * every other optional-config handling in this app (isSupabaseConfigured,
 * isSentryConfigured) - a missing key (e.g. local dev without .env, or a
 * plain Expo Go run where this module isn't even linked) shouldn't crash
 * the app at startup.
 *
 * No appUserID here on purpose - configure() runs before AuthContext has
 * had a chance to resolve the Supabase session, so the SDK starts with
 * its own anonymous id. identifyPurchaser()/resetPurchaserIdentity()
 * below (wired into AuthContext's sign-in/sign-out) call
 * Purchases.logIn()/logOut() once the real user id is known, aliasing the
 * anonymous id to it.
 */
export function configurePurchases() {
  if (!isPurchasesConfigured) {
    console.warn(
      "[RevenueCat] EXPO_PUBLIC_REVENUECAT_IOS_KEY/EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ontbreekt - in-app aankopen staan uit voor deze sessie. Zie .env.example en README.md's \"RevenueCat\"-sectie."
    );
    return;
  }

  // Wrapped in try/catch (not just the "key missing" check above): the
  // native module itself might not be linked into the running binary even
  // when the key IS set - Expo Go (never has it), or an OTA update that
  // shipped this code to a build compiled before react-native-purchases
  // was added (see README.md's "geen eas update" warning). Purchases.configure()
  // calling into a missing native module throws synchronously, and this
  // runs at module level in App.tsx before the app has rendered anything -
  // uncaught, that's a blank-crash on every launch, not just a broken
  // paywall. Fails open like every other optional-config handling in this
  // app instead.
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
  } catch (e) {
    console.warn("[RevenueCat] Purchases.configure() mislukt (native module niet gelinkt?):", e);
  }
}

/**
 * Call on sign-in (AuthContext). Aliases the RevenueCat identity to the
 * Supabase user id, so a purchase made on one device/session is
 * recognized as the same customer everywhere this id is used to log in -
 * and so the CustomerInfo update listener below knows which user to sync
 * to the database.
 */
export async function identifyPurchaser(userId: string): Promise<void> {
  currentAppUserId = userId;
  if (!isPurchasesConfigured) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn("[RevenueCat] Purchases.logIn() mislukt:", e);
  }
}

/** Call on sign-out (AuthContext) - reverts to a fresh anonymous RevenueCat identity. */
export async function resetPurchaserIdentity(): Promise<void> {
  currentAppUserId = null;
  if (!isPurchasesConfigured) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn("[RevenueCat] Purchases.logOut() mislukt:", e);
  }
}

/** The Supabase user id last passed to identifyPurchaser(), or null when signed out/not yet identified. Used by the CustomerInfo listener to know which row to sync. */
export function getCurrentAppUserId(): string | null {
  return currentAppUserId;
}

/** Fails open (returns null) rather than throwing - every caller already treats "no entitlement info yet" the same as "not entitled", matching this app's other optional-status fetches. */
export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isPurchasesConfigured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.warn("[RevenueCat] Purchases.getCustomerInfo() mislukt:", e);
    return null;
  }
}

/**
 * Maps active RevenueCat entitlements to this app's plan model. Elite
 * takes priority over premium if a customer somehow has both active
 * (shouldn't normally happen, but a strict order is safer than an
 * unspecified one) - matches the same priority order used server-side in
 * supabase/functions/revenuecat-webhook/index.ts, which must stay in sync
 * with this function if either ever changes.
 */
export function getPlanFromCustomerInfo(customerInfo: CustomerInfo | null): "basis" | PlanId {
  if (!customerInfo) return "basis";
  if (customerInfo.entitlements.active[REVENUECAT_ENTITLEMENTS.elite]) return "elite";
  if (customerInfo.entitlements.active[REVENUECAT_ENTITLEMENTS.premium]) return "premium";
  return "basis";
}

/** The ISO expiration date of the given plan's active entitlement, or null if not active/unknown. */
export function getEntitlementExpiration(customerInfo: CustomerInfo | null, plan: PlanId): string | null {
  return customerInfo?.entitlements.active[REVENUECAT_ENTITLEMENTS[plan]]?.expirationDate ?? null;
}

/**
 * Subscribes to CustomerInfo changes (a purchase completing, a renewal, an
 * expiration, a refund, ...) - the modern alternative to polling
 * getCustomerInfo() on a timer. Returns the listener so it can be removed
 * with Purchases.removeCustomerInfoUpdateListener() later if ever needed;
 * this app registers one listener for the whole app lifetime (see
 * AuthContext.tsx) and never removes it.
 */
export function addCustomerInfoListener(listener: (customerInfo: CustomerInfo) => void) {
  if (!isPurchasesConfigured) return;
  // Same reasoning as configurePurchases()'s try/catch: this runs inside
  // AuthContext's mount effect, i.e. still very early in the app's
  // lifetime - a missing/unlinked native module here shouldn't crash
  // every screen behind AuthProvider.
  try {
    Purchases.addCustomerInfoUpdateListener(listener);
  } catch (e) {
    console.warn("[RevenueCat] Purchases.addCustomerInfoUpdateListener() mislukt:", e);
  }
}

/** Fetches the named Offering (REVENUECAT_OFFERING_IDS) for the given plan - null if the SDK isn't configured, the offering doesn't exist in the dashboard yet, or the fetch fails. */
export async function fetchOfferingForPlan(plan: PlanId): Promise<PurchasesOffering | null> {
  if (!isPurchasesConfigured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.all[REVENUECAT_OFFERING_IDS[plan]] ?? null;
  } catch (e) {
    console.warn("[RevenueCat] Purchases.getOfferings() mislukt:", e);
    return null;
  }
}

export type PresentPaywallResult = { result: PAYWALL_RESULT; customerInfo: CustomerInfo | null };

/**
 * Presents RevenueCat's own Paywall UI (react-native-purchases-ui) for the
 * given plan's offering - this is the actual purchase flow (replaces the
 * app's earlier custom PaymentScreen entirely, see PricingScreen.tsx).
 * RevenueCat's paywall handles package selection, the native store
 * purchase sheet, loading/error states, and restoring purchases, all
 * inside this one call - nothing else to build for the purchase UI
 * itself.
 */
export async function presentPaywallForPlan(plan: PlanId): Promise<PresentPaywallResult> {
  const offering = await fetchOfferingForPlan(plan);
  const result = await RevenueCatUI.presentPaywall(offering ? { offering } : {});
  const customerInfo =
    result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED ? await fetchCustomerInfo() : null;
  return { result, customerInfo };
}

/**
 * Presents RevenueCat's Customer Center - self-service subscription
 * management (cancel, change plan, view purchase history, request a
 * refund on iOS), configured entirely from the RevenueCat dashboard, no
 * custom UI needed. See SettingsScreen.tsx's "Abonnement beheren" row -
 * shown instead of PricingScreen once a paid entitlement is active.
 */
export async function presentCustomerCenter(): Promise<void> {
  await RevenueCatUI.presentCustomerCenter();
}
