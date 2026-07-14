import * as Linking from "expo-linking";
import { supabase } from "./supabase";

/**
 * Redirect URL to hand to Supabase's emailRedirectTo/redirectTo options.
 * Linking.createURL() resolves to the right thing per environment
 * (exp://... in Expo Go/dev client, sportfrend://... in a standalone or
 * EAS Update build with the custom scheme) instead of hardcoding one that
 * would only work in one of them.
 */
export function getAuthRedirectUrl(): string {
  return Linking.createURL("auth/callback");
}

function extractAuthParams(url: string): Record<string, string> {
  // Supabase puts the tokens after either "?" (PKCE `code`) or "#" (implicit
  // flow access_token/refresh_token) depending on the project's auth flow
  // type - grab whichever comes first and parse it as a query string.
  const match = url.match(/[?#](.*)$/);
  if (!match) return {};
  const params = new URLSearchParams(match[1]);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function friendlyLinkError(rawDescription: string): string {
  const lower = rawDescription.toLowerCase();
  if (lower.includes("expired") || lower.includes("invalid")) {
    return "Deze link is ongeldig of verlopen. Vraag een nieuwe aan.";
  }
  return rawDescription || "Er ging iets mis bij het verwerken van de link.";
}

export type AuthLinkResult =
  | { status: "session" }
  | { status: "email_confirmed" }
  | { status: "error"; message: string }
  | { status: "ignored" };

/** Handles a sportfrend://auth/callback deep link from a Supabase auth email. */
export async function handleAuthDeepLink(url: string | null): Promise<AuthLinkResult> {
  if (!url) return { status: "ignored" };

  const params = extractAuthParams(url);

  if (params.error || params.error_description) {
    const raw = decodeURIComponent(params.error_description ?? params.error ?? "");
    return { status: "error", message: friendlyLinkError(raw) };
  }

  // Supabase includes `type` on these redirects (signup, recovery, invite,
  // email_change, ...). For a signup confirmation, the email is already
  // confirmed server-side by the time Supabase redirects here - the tokens
  // in the URL are just a convenience for auto-login, which we deliberately
  // skip so the user lands on a clear "E-mailadres bevestigd!" screen and
  // signs in explicitly afterward, rather than being silently logged in.
  if (params.type === "signup") {
    return { status: "email_confirmed" };
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) return { status: "error", message: error.message };
    return { status: "session" };
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) return { status: "error", message: error.message };
    return { status: "session" };
  }

  return { status: "ignored" };
}
