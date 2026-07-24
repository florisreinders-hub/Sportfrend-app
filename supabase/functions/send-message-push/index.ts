// Triggered by a database webhook on INSERT into public.messages (see
// supabase/migrations/0011_push_notifications.sql). Sends a push
// notification to the *other* participant of the match - never back to
// whoever just sent the message.
//
// Deploy with the Supabase CLI (--no-verify-jwt: this is called by
// Postgres via a database webhook, not by a signed-in user, so there's no
// user JWT to verify - verifyWebhookSecret() in _shared/push.ts is the
// actual access control here):
//   supabase functions deploy send-message-push --no-verify-jwt

import { createServiceRoleClient, jsonResponse, sendExpoPushNotifications, verifyWebhookSecret } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (!verifyWebhookSecret(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await req.json();
    const message = payload.record;
    if (!message?.match_id || !message?.sender_id) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const supabase = createServiceRoleClient();

    const { data: match } = await supabase
      .from("matches")
      .select("user_a_id, user_b_id")
      .eq("id", message.match_id)
      .maybeSingle();
    if (!match) {
      return jsonResponse({ skipped: "match not found" }, 200);
    }

    const recipientId = match.user_a_id === message.sender_id ? match.user_b_id : match.user_a_id;

    const [{ data: recipient }, { data: sender }] = await Promise.all([
      supabase.from("profiles").select("expo_push_token, push_notifications_enabled").eq("id", recipientId).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", message.sender_id).maybeSingle(),
    ]);

    if (!recipient?.expo_push_token || recipient.push_notifications_enabled === false) {
      return jsonResponse({ skipped: "no push token or notifications disabled" }, 200);
    }

    await sendExpoPushNotifications([
      {
        to: recipient.expo_push_token,
        title: sender?.full_name ?? "Nieuw bericht",
        body: typeof message.body === "string" && message.body.trim() ? message.body.slice(0, 120) : "Je hebt een nieuw bericht.",
        data: { type: "message", matchId: message.match_id },
      },
    ]);

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error("send-message-push error:", error);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
