// Supabase Edge Function: e-mails the "Mijn gegevens opvragen" export
// (lib/dataExport.ts, assembled client-side from the caller's own
// RLS-scoped data) to the caller's own registered e-mail address.
//
// The client already assembled the export text (no service-role access
// needed for that - RLS already scopes every source table to "this user's
// own rows"), so this function's only job is relaying it through Resend to
// the *caller's own* address, resolved server-side via auth.getUser() -
// never a client-supplied recipient, so this can't be used to e-mail
// someone else's data to an attacker-controlled address.
//
// Deploy with the Supabase CLI (this sandbox has no network path to
// Supabase's API - see README.md's "Mijn gegevens opvragen" section):
//   supabase functions deploy send-data-export-email
//
// Requires the same RESEND_API_KEY / (optional) RESEND_FROM_EMAIL secrets
// already set up for send-support-email - nothing new to configure.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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
    if (userError || !user?.email) {
      return jsonResponse({ error: "Niet ingelogd." }, 401);
    }

    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return jsonResponse({ error: "text is verplicht." }, 400);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY secret is not set");
      return jsonResponse({ error: "RESEND_API_KEY is niet geconfigureerd op het Supabase-project." }, 500);
    }

    const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") ?? "Sportfrend <onboarding@resend.dev>";

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [user.email],
        subject: "Jouw Sportfrend-gegevensoverzicht",
        html: `<pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtml(text)}</pre>`,
      }),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, errorBody);
      return jsonResponse({ error: "Versturen van de e-mail via Resend is mislukt." }, 502);
    }

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error("send-data-export-email error:", error);
    return jsonResponse({ error: "Er is iets misgegaan." }, 500);
  }
});
