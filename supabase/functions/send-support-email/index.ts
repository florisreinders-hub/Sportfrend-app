// Supabase Edge Function: sends an email to the Sportfrend inbox whenever a
// user submits the Klantenservice contact form. Called from the client
// (lib/api.ts's notifySupportRequest()) *after* the message has already
// been inserted into public.support_requests - that insert is the source
// of truth/back-up, this function is a best-effort notification on top of
// it, not a replacement for it.
//
// Deploy with the Supabase CLI (this sandbox has no network path to
// Supabase's API, so this can't be deployed from here - see README.md's
// "Klantenservice-e-mail (Resend)" section for the exact steps):
//   supabase functions deploy send-support-email
//
// Requires the RESEND_API_KEY secret to already be set on the project
// (`supabase secrets set RESEND_API_KEY=...` or via the dashboard). This
// function only reads it - it doesn't need to be able to change it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPPORT_INBOX = "info.sportfrend@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Alleen POST wordt ondersteund." }, 405);
  }

  try {
    // Authenticate the caller with their own JWT (forwarded automatically
    // by supabase-js's functions.invoke()) - only a logged-in user can
    // trigger this, and we trust supabase auth for who they are rather
    // than anything the request body claims.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Niet ingelogd." }, 401);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Niet ingelogd." }, 401);
    }

    const { subject, message } = await req.json();
    if (typeof subject !== "string" || !subject.trim() || typeof message !== "string" || !message.trim()) {
      return jsonResponse({ error: "subject en message zijn verplicht." }, 400);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY secret is not set");
      return jsonResponse({ error: "RESEND_API_KEY is niet geconfigureerd op het Supabase-project." }, 500);
    }

    const { data: profile } = await supabaseClient.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

    // Resend's shared onboarding@resend.dev sender works without a
    // verified domain (good for getting this running immediately) but is
    // rate-limited and not meant for production - set RESEND_FROM_EMAIL
    // once a domain is verified in Resend. See README.md.
    const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") ?? "Sportfrend <onboarding@resend.dev>";
    const userEmail = user.email ?? "onbekend e-mailadres";
    const userName = profile?.full_name ?? "Onbekende gebruiker";

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [SUPPORT_INBOX],
        reply_to: userEmail,
        subject: `[Klantenservice] ${subject}`,
        html: `
          <p><strong>Van:</strong> ${escapeHtml(userName)} (${escapeHtml(userEmail)})</p>
          <p><strong>Gebruikers-ID:</strong> ${escapeHtml(user.id)}</p>
          <p><strong>Onderwerp:</strong> ${escapeHtml(subject)}</p>
          <p><strong>Bericht:</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
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
    console.error("send-support-email error:", error);
    return jsonResponse({ error: "Er is iets misgegaan." }, 500);
  }
});
