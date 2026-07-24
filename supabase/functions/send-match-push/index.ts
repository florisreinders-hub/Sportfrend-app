// Triggered by a database webhook on INSERT into public.matches (see
// supabase/migrations/0011_push_notifications.sql). Sends a push
// notification to *both* participants - unlike a message, a new match
// is new information for both sides at once.
//
// Deploy with the Supabase CLI (--no-verify-jwt: this is called by
// Postgres via a database webhook, not by a signed-in user, so there's no
// user JWT to verify - verifyWebhookSecret() in _shared/push.ts is the
// actual access control here):
//   supabase functions deploy send-match-push --no-verify-jwt

import { createServiceRoleClient, ExpoPushMessage, jsonResponse, sendExpoPushNotifications, verifyWebhookSecret } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (!verifyWebhookSecret(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await req.json();
    const match = payload.record;
    if (!match?.id || !match?.user_a_id || !match?.user_b_id) {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const supabase = createServiceRoleClient();

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, expo_push_token, push_notifications_enabled")
      .in("id", [match.user_a_id, match.user_b_id]);

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const userA = byId.get(match.user_a_id);
    const userB = byId.get(match.user_b_id);

    const pushMessages: ExpoPushMessage[] = [];
    if (userA?.expo_push_token && userA.push_notifications_enabled !== false) {
      pushMessages.push({
        to: userA.expo_push_token,
        title: "Nieuwe match!",
        body: `Je hebt een match met ${userB?.full_name ?? "een sportmaatje"}.`,
        data: { type: "match", matchId: match.id },
      });
    }
    if (userB?.expo_push_token && userB.push_notifications_enabled !== false) {
      pushMessages.push({
        to: userB.expo_push_token,
        title: "Nieuwe match!",
        body: `Je hebt een match met ${userA?.full_name ?? "een sportmaatje"}.`,
        data: { type: "match", matchId: match.id },
      });
    }

    await sendExpoPushNotifications(pushMessages);

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error("send-match-push error:", error);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
