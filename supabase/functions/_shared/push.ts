// Shared helpers for the push-notification Edge Functions
// (send-message-push, send-match-push). Both are triggered by a database
// webhook (Postgres trigger -> supabase_functions.http_request -> this
// function), not by a signed-in user's own request, so there's no user
// JWT to verify - see verifyWebhookSecret() instead.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/**
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically
 * into every Edge Function's environment by Supabase - nothing to set
 * manually for these two. The service role key (not the caller's JWT,
 * there isn't one here) is what lets this read any user's profile/match
 * row regardless of RLS, which a webhook-triggered function legitimately
 * needs to do.
 */
export function createServiceRoleClient() {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
}

/**
 * Database webhooks aren't authenticated as any particular user, so
 * instead of JWT verification, both functions require a shared secret
 * (DB_WEBHOOK_SECRET) sent as a custom header - set once via
 * `supabase secrets set DB_WEBHOOK_SECRET=...` and embedded in the
 * trigger definition SQL (see supabase/migrations/0011_push_notifications.sql).
 * This stops anyone who finds the function's URL from spamming push
 * notifications through it.
 */
export function verifyWebhookSecret(req: Request): boolean {
  const expected = Deno.env.get("DB_WEBHOOK_SECRET");
  if (!expected) {
    console.error("DB_WEBHOOK_SECRET secret is not set");
    return false;
  }
  return req.headers.get("x-webhook-secret") === expected;
}

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

/**
 * POSTs to Expo's push API (https://exp.host/--/api/v2/push/send). No
 * API key is required for basic use; EXPO_ACCESS_TOKEN is optional (set
 * it if you've enabled Expo's "enhanced push security" for this project)
 * and is sent as a bearer token when present.
 */
export async function sendExpoPushNotifications(messages: ExpoPushMessage[]) {
  if (messages.length === 0) return;

  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers,
    body: JSON.stringify(messages),
  });

  const responseBody = await response.text();
  if (!response.ok) {
    console.error("Expo push API error:", response.status, responseBody);
  } else {
    console.log("Expo push API response:", responseBody);
  }
}

export function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
