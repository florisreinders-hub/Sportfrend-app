// Triggered by a database webhook on INSERT into public.reports. Sends an
// e-mail to the moderator inbox so a new report doesn't sit unseen until
// someone happens to open the in-app moderatieoverzicht.
//
// This Supabase project doesn't have the supabase_functions schema
// available, so (unlike the SQL-trigger approach in
// 0011_push_notifications.sql) the webhook itself must be created by hand
// in the dashboard (Database -> Webhooks) rather than via a migration -
// see README.md's "Moderatie-e-mail (nieuwe rapportage)" section for the
// exact table/event/URL/header to fill in there.
//
// Deploy with the Supabase CLI (--no-verify-jwt: this is called by
// Postgres via a database webhook, not by a signed-in user, so there's no
// user JWT to verify - verifyWebhookSecret() in _shared/push.ts is the
// actual access control here, reusing the same DB_WEBHOOK_SECRET as
// send-message-push/send-match-push):
//   supabase functions deploy send-moderation-alert --no-verify-jwt
//
// Requires the RESEND_API_KEY and RESEND_FROM_EMAIL secrets (both already
// set for send-support-email) and, new for this function,
// MODERATOR_ALERT_EMAIL - falls back to info.sportfrend@gmail.com if that
// secret isn't set.

import { createServiceRoleClient, jsonResponse, verifyWebhookSecret } from "../_shared/push.ts";

const DEFAULT_MODERATOR_EMAIL = "info.sportfrend@gmail.com";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req) => {
  if (!verifyWebhookSecret(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await req.json();
    const report = payload.record;
    if (!report?.id || !report?.reported_id || typeof report?.reason !== "string") {
      return jsonResponse({ error: "Invalid payload" }, 400);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY secret is not set");
      return jsonResponse({ error: "RESEND_API_KEY is niet geconfigureerd." }, 500);
    }

    const supabase = createServiceRoleClient();
    const { data: reportedProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", report.reported_id)
      .maybeSingle();
    const reportedName = reportedProfile?.full_name ?? "Onbekende gebruiker";

    const createdAt = typeof report.created_at === "string" ? new Date(report.created_at) : new Date();
    const formattedCreatedAt = createdAt.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" });

    const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") ?? "Sportfrend <onboarding@resend.dev>";
    const toAddress = Deno.env.get("MODERATOR_ALERT_EMAIL") ?? DEFAULT_MODERATOR_EMAIL;

    const details = typeof report.details === "string" && report.details.trim() ? report.details : null;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toAddress],
        subject: "Nieuwe rapportage op Sportfrend",
        html: `
          <p>Er is een nieuwe rapportage ingediend op Sportfrend.</p>
          <p><strong>Gerapporteerde gebruiker:</strong> ${escapeHtml(reportedName)}</p>
          <p><strong>Reden:</strong> ${escapeHtml(report.reason)}</p>
          ${details ? `<p><strong>Details:</strong> ${escapeHtml(details).replace(/\n/g, "<br/>")}</p>` : ""}
          <p><strong>Tijdstip:</strong> ${escapeHtml(formattedCreatedAt)}</p>
          <p>Deze rapportage moet binnen 24 uur beoordeeld worden via
          Instellingen &gt; Moderatie-overzicht in de app.</p>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, errorBody);
      return jsonResponse({ error: "Versturen van de e-mail via Resend is mislukt." }, 502);
    }

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error("send-moderation-alert error:", error);
    return jsonResponse({ error: "Er is iets misgegaan." }, 500);
  }
});
