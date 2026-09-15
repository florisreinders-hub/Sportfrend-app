// Triggered every ~5 minutes by a pg_cron job (see
// supabase/migrations/0025_training_reminder_cron.sql) instead of a single
// row event like send-message-push/send-match-push - there's no "row
// inserted" event for "a training starts in 2 hours", so this is polled
// instead of triggered by a database webhook trigger.
//
// Deploy with the Supabase CLI (--no-verify-jwt: this is called by pg_cron
// via pg_net, not by a signed-in user, so there's no user JWT to verify -
// verifyWebhookSecret() in _shared/push.ts is the actual access control
// here, same as the other two push functions):
//   supabase functions deploy send-training-reminder-push --no-verify-jwt

import { createServiceRoleClient, jsonResponse, sendExpoPushNotifications, verifyWebhookSecret } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (!verifyWebhookSecret(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const supabase = createServiceRoleClient();

    // Atomically claims (marks reminder_sent_at) every accepted training
    // starting in the next [2h, 2h+5min) window, so overlapping/retried
    // cron ticks never double-send the same training's reminder - see
    // claim_training_reminders() for the actual query.
    const { data: due, error } = await supabase.rpc("claim_training_reminders", { p_window_minutes: 5 });
    if (error) {
      console.error("claim_training_reminders error:", error);
      return jsonResponse({ error: "Internal error" }, 500);
    }
    if (!due || due.length === 0) {
      return jsonResponse({ sent: 0 }, 200);
    }

    const recipientIds = Array.from(new Set(due.flatMap((t: { user_a_id: string; user_b_id: string }) => [t.user_a_id, t.user_b_id])));
    const { data: recipients } = await supabase
      .from("profiles")
      .select("id, expo_push_token, push_notifications_enabled")
      .in("id", recipientIds);
    const byId = new Map((recipients ?? []).map((r) => [r.id, r]));

    const messages = [];
    for (const t of due as {
      id: string;
      match_id: string;
      sport: string | null;
      location: string | null;
      user_a_id: string;
      user_b_id: string;
    }[]) {
      for (const userId of [t.user_a_id, t.user_b_id]) {
        const recipient = byId.get(userId);
        if (!recipient?.expo_push_token || recipient.push_notifications_enabled === false) continue;
        messages.push({
          to: recipient.expo_push_token,
          title: "Training over 2 uur",
          body: t.sport
            ? `${t.sport}${t.location ? ` bij ${t.location}` : ""} - tijd om je klaar te maken!`
            : "Tijd om je klaar te maken voor je training!",
          data: { type: "training_reminder", matchId: t.match_id, trainingId: t.id },
        });
      }
    }

    await sendExpoPushNotifications(messages);

    return jsonResponse({ sent: messages.length }, 200);
  } catch (error) {
    console.error("send-training-reminder-push error:", error);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
