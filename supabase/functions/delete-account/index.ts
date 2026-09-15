// Supabase Edge Function: permanently deletes the signed-in user's account.
// Called from the client (lib/auth.ts's deleteAccount(), triggered from the
// "Account verwijderen" row on SettingsScreen) after the user confirms a
// destructive-action alert.
//
// Deploying this WITHOUT --no-verify-jwt is deliberate (unlike
// send-message-push/send-match-push, which are triggered by a database
// webhook with no user JWT at all) - Supabase verifies the caller's JWT is
// valid before this code even runs, so only a genuinely signed-in user can
// reach it, and auth.getUser() below resolves *which* user from that same
// JWT rather than trusting anything the request body could claim.
//
// Deploy with the Supabase CLI (this sandbox has no network path to
// Supabase's API - see README.md's "Account verwijderen" section):
//   supabase functions deploy delete-account

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Niet ingelogd." }, 401);
    }

    // Service-role client: deleting a storage object and the auth.users row
    // both require privileges no ordinary user session has.
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // storage.objects isn't reached by any "on delete cascade" from
    // auth.users, so a profile photo would otherwise be left behind
    // (orphaned, but still publicly served from the public profile-photos
    // bucket) after the rest of the account is gone.
    const { data: files } = await admin.storage.from("profile-photos").list(user.id);
    if (files && files.length > 0) {
      await admin.storage.from("profile-photos").remove(files.map((file) => `${user.id}/${file.name}`));
    }

    // Same orphaning problem for chat images (0018_chat_images.sql), except
    // that bucket is keyed by match_id, not by this user's own id (both
    // participants need to reach a shared image), so there's no single
    // "<user_id>/" folder to just list and wipe. Look up every match this
    // user is (still, pre-cascade) part of, and remove only the objects
    // this user themself uploaded into each one - path convention
    // "<match_id>/<sender_id>-<timestamp>.<ext>", so a "<sender_id>-"
    // prefix match is exactly this user's own uploads, leaving the other
    // participant's images (if any) untouched.
    const { data: ownMatches } = await admin
      .from("matches")
      .select("id")
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
    for (const match of ownMatches ?? []) {
      const { data: matchFiles } = await admin.storage.from("chat-images").list(match.id);
      const ownFiles = (matchFiles ?? []).filter((file) => file.name.startsWith(`${user.id}-`));
      if (ownFiles.length > 0) {
        await admin.storage.from("chat-images").remove(ownFiles.map((file) => `${match.id}/${file.name}`));
      }
    }

    // public.profiles.id references auth.users(id) on delete cascade, and
    // every other table with personal data (swipes, matches, messages,
    // posts, post_likes, subscriptions, support_requests, reports, blocks)
    // references profiles(id) on delete cascade in turn - deleting the
    // auth user is therefore enough to remove all of it in one statement,
    // no per-table deletes needed here.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("delete-account: auth.admin.deleteUser failed:", deleteError);
      return jsonResponse({ error: "Account verwijderen is mislukt. Probeer het later opnieuw." }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error("delete-account error:", error);
    return jsonResponse({ error: "Er is iets misgegaan." }, 500);
  }
});
