// Supabase Edge Function: RevenueCat webhook - the authoritative,
// server-side sync of public.subscriptions. Configure this URL as
// RevenueCat's webhook (Project settings -> Integrations -> Webhooks -> +
// Add) with an Authorization header value matching REVENUECAT_WEBHOOK_AUTH_HEADER
// below (set both places to the same random string - RevenueCat sends it
// back verbatim on every request, this function checks it matches before
// doing anything else). See README.md's "RevenueCat" section for the full
// dashboard setup.
//
// Why this exists (not just the client's own CustomerInfo): the SDK
// running on a device is not a trusted source for what the *database*
// should believe about a user's plan - a modified client could report
// whatever CustomerInfo it wants. This function is the one place that
// actually decides `subscriptions.plan` (see
// 0031_subscriptions_webhook_only.sql, which revokes the client's own
// INSERT/UPDATE on that table for exactly this reason). The client's own
// lib/purchases.ts still reads RevenueCat's CustomerInfo directly for
// *instant* UI feedback (no need to wait for this webhook round trip),
// but the database itself - and therefore every RLS policy/SQL function
// that gates a paid feature - only ever trusts what lands here.
//
// On every event, this re-fetches the subscriber from RevenueCat's own
// REST API (GET /v1/subscribers/{app_user_id}) rather than trying to
// derive the new state purely from the webhook payload - a single event
// only reports what changed for ONE entitlement, which isn't enough to
// correctly decide the plan when an account could have several
// entitlements (premium AND elite) active or expiring independently.
// Re-fetching the full subscriber avoids that class of bug entirely; it's
// also RevenueCat's own documented recommendation for webhook consumers.
//
// Deploy with the Supabase CLI (this sandbox has no network path to
// Supabase's API - see README.md's "Account verwijderen" section for the
// same limitation on delete-account):
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
// (--no-verify-jwt because RevenueCat's webhook calls carry no Supabase
// user JWT at all - this function's own Authorization-header check above
// is the real access control, same reasoning as send-message-push/
// send-match-push's database-webhook triggers.)
//
// Required secrets (supabase secrets set ...), never committed here:
//   REVENUECAT_SECRET_KEY        RevenueCat dashboard -> Project settings
//                                 -> API keys -> Secret API keys (NOT the
//                                 same as the public EXPO_PUBLIC_REVENUECAT_
//                                 *_KEY the app ships with - this one must
//                                 never reach the client).
//   REVENUECAT_WEBHOOK_AUTH_HEADER  Any random string you choose - set the
//                                 exact same value in RevenueCat's webhook
//                                 config's "Authorization header value"
//                                 field.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Must stay in sync with lib/purchases.ts's PLAN_PRICE_CENTS - duplicated
// rather than imported because this function runs on Deno, a separate
// runtime/bundler from the Expo/Metro app, and each Supabase Edge
// Function deploys as an isolated directory (no shared module resolution
// across supabase/functions/* and the app's own lib/ in practice).
const PLAN_PRICE_CENTS: Record<"basis" | "premium" | "elite", number> = {
  basis: 0,
  premium: 499,
  elite: 999,
};

// Same entitlement identifiers as lib/purchases.ts's REVENUECAT_ENTITLEMENTS -
// keep both in sync if either ever changes.
const ENTITLEMENT_PREMIUM = "premium";
const ENTITLEMENT_ELITE = "elite";

type RevenueCatSubscriberEntitlement = {
  expires_date: string | null;
};

type RevenueCatSubscriberResponse = {
  subscriber: {
    entitlements: Record<string, RevenueCatSubscriberEntitlement>;
  };
};

function isEntitlementActive(entitlement: RevenueCatSubscriberEntitlement | undefined): boolean {
  if (!entitlement) return false;
  if (entitlement.expires_date === null) return true; // non-expiring (e.g. lifetime/promotional)
  return new Date(entitlement.expires_date).getTime() > Date.now();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Alleen POST wordt ondersteund." }, 405);
  }

  const expectedAuthHeader = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_HEADER") ?? "";
  const receivedAuthHeader = req.headers.get("Authorization") ?? "";
  if (!expectedAuthHeader || receivedAuthHeader !== expectedAuthHeader) {
    return jsonResponse({ error: "Ongeldige Authorization header." }, 401);
  }

  try {
    const body = await req.json().catch(() => null);
    const event = body?.event;
    if (!event || typeof event.app_user_id !== "string") {
      return jsonResponse({ error: "Ongeldige payload." }, 400);
    }

    // RevenueCat's dashboard "Send test event" button doesn't correspond
    // to a real subscriber - acknowledge without processing so a
    // dashboard connectivity test doesn't fail or write bogus data.
    if (event.type === "TEST") {
      return jsonResponse({ success: true, skipped: "TEST event" }, 200);
    }

    // A purchase made before Purchases.logIn(supabaseUserId) ever ran
    // (shouldn't normally happen in this app's flow, but is possible for
    // an edge case like a restored purchase on a fresh install before
    // sign-in) reports RevenueCat's own anonymous id format here instead
    // of a real Supabase user id - there's no subscriptions.user_id row
    // to sync it to.
    const appUserId: string = event.app_user_id;
    if (appUserId.startsWith("$RCAnonymousID:")) {
      return jsonResponse({ success: true, skipped: "anonymous app_user_id" }, 200);
    }

    const secretKey = Deno.env.get("REVENUECAT_SECRET_KEY") ?? "";
    if (!secretKey) {
      console.error("revenuecat-webhook: REVENUECAT_SECRET_KEY ontbreekt.");
      return jsonResponse({ error: "Server niet geconfigureerd." }, 500);
    }

    const subscriberResponse = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!subscriberResponse.ok) {
      console.error("revenuecat-webhook: kon subscriber niet ophalen:", subscriberResponse.status, await subscriberResponse.text());
      // Non-2xx so RevenueCat retries this webhook delivery later.
      return jsonResponse({ error: "Kon RevenueCat-subscriber niet ophalen." }, 502);
    }

    const { subscriber }: RevenueCatSubscriberResponse = await subscriberResponse.json();
    const entitlements = subscriber.entitlements ?? {};

    const eliteActive = isEntitlementActive(entitlements[ENTITLEMENT_ELITE]);
    const premiumActive = isEntitlementActive(entitlements[ENTITLEMENT_PREMIUM]);

    // Same priority order as lib/purchases.ts's getPlanFromCustomerInfo() -
    // keep both in sync if either ever changes.
    let plan: "basis" | "premium" | "elite";
    let currentPeriodEnd: string | null;
    if (eliteActive) {
      plan = "elite";
      currentPeriodEnd = entitlements[ENTITLEMENT_ELITE].expires_date;
    } else if (premiumActive) {
      plan = "premium";
      currentPeriodEnd = entitlements[ENTITLEMENT_PREMIUM].expires_date;
    } else {
      plan = "basis";
      currentPeriodEnd = null;
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // A subscriptions row already exists for every user (handle_new_user()
    // inserts one, plan 'basis', at sign-up) - this is always an update in
    // practice, upsert only as a defensive fallback.
    const { error } = await admin.from("subscriptions").upsert(
      {
        user_id: appUserId,
        plan,
        status: "active",
        price_cents: PLAN_PRICE_CENTS[plan],
        current_period_end: currentPeriodEnd,
      },
      { onConflict: "user_id" }
    );
    if (error) {
      console.error("revenuecat-webhook: upsert op subscriptions mislukt:", error);
      return jsonResponse({ error: "Kon subscriptions niet bijwerken." }, 500);
    }

    return jsonResponse({ success: true, plan }, 200);
  } catch (error) {
    console.error("revenuecat-webhook error:", error);
    return jsonResponse({ error: "Er is iets misgegaan." }, 500);
  }
});
