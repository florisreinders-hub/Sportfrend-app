import { AuthError, isAuthWeakPasswordError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getAuthRedirectUrl } from "./deepLinking";

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: getAuthRedirectUrl() },
  });
}

export async function sendPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl(),
  });
}

export async function resendConfirmationEmail(email: string) {
  return supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: getAuthRedirectUrl() },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

/**
 * Permanently deletes the signed-in user's account via the delete-account
 * Edge Function (service-role only - deleting the auth.users row and its
 * storage objects both need privileges no user session has). That single
 * deletion cascades (on delete cascade, all the way from auth.users down
 * through profiles) through every table holding this user's data: swipes,
 * matches, messages, posts, post_likes, subscriptions, support_requests,
 * reports, blocks - see the function's own comments for the full chain.
 *
 * Signs out locally afterwards so AuthContext's session clears immediately
 * and RootNavigator switches back to the signed-out stack - the server-side
 * deletion alone doesn't invalidate the token already held on this device.
 */
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke("delete-account");
  if (error) {
    const context = (error as { context?: Response }).context;
    const body = context ? await context.clone().json().catch(() => null) : null;
    throw body?.error ? new Error(body.error) : error;
  }
  await supabase.auth.signOut();
}

const weakPasswordReasonLabels: Record<string, string> = {
  length: "minstens 6 tekens",
  characters: "een mix van letters, cijfers en/of symbolen",
  pwned: "geen wachtwoord dat al eerder gelekt is",
};

/**
 * Supabase auth errors come back in English with an error `code` (e.g.
 * "email_exists", "weak_password"). Translate the ones users actually run
 * into during sign-up/sign-in into clear Dutch messages; fall back to the
 * raw message for anything unrecognized rather than a generic "iets ging
 * mis" that hides useful detail.
 */
export function getAuthErrorMessage(error: unknown): string {
  if (!error) return "Er is iets misgegaan. Probeer het opnieuw.";

  if (isAuthWeakPasswordError(error)) {
    const reasons = error.reasons.map((r) => weakPasswordReasonLabels[r] ?? r).join(", ");
    return `Dit wachtwoord is niet sterk genoeg. Zorg voor ${reasons}.`;
  }

  if (error instanceof AuthError) {
    switch (error.code) {
      case "email_exists":
      case "user_already_exists":
      case "identity_already_exists":
        return "Dit e-mailadres is al geregistreerd. Log in of gebruik een ander e-mailadres.";
      case "weak_password":
        return "Dit wachtwoord is niet sterk genoeg. Gebruik minstens 6 tekens.";
      case "email_address_invalid":
      case "validation_failed":
        return "Dit is geen geldig e-mailadres.";
      case "invalid_credentials":
        return "E-mailadres of wachtwoord is onjuist.";
      case "email_not_confirmed":
        return "Bevestig eerst je e-mailadres via de link die we je gestuurd hebben.";
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return "Te veel pogingen. Probeer het over een paar minuten opnieuw.";
      case "signup_disabled":
        return "Nieuwe registraties zijn momenteel niet mogelijk.";
      case "same_password":
        return "Dit is hetzelfde wachtwoord als je huidige wachtwoord.";
      default:
        return error.message;
    }
  }

  if (error instanceof Error) return error.message;
  return "Er is iets misgegaan. Probeer het opnieuw.";
}
